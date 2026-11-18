const PROMETHEUS_URL = (
  process.env.PROMETHEUS_URL || "http://127.0.0.1:9091"
).replace(/\/$/, "");

export type Health = "online" | "warning" | "critical" | "offline";

export type ServerRow = {
  id: string;
  name: string;
  lokasi: string;
  instance: string;
  cpu: number | null;
  ram: number | null;
  disk: number | null;
  health: Health;
};

export type Point = { t: number; v: number };

export type OverviewData = {
  ok: boolean;
  error: string;
  updatedAt: string;
  totals: { total: number; online: number; offline: number; warning: number };
  cpuAvg: number | null;
  ramAvg: number | null;
  cpuSeries: Point[];
  ramSeries: Point[];
  servers: ServerRow[];
};

type PromVector = {
  result?: Array<{ metric?: Record<string, string>; value?: [number, string] }>;
};

type PromMatrix = {
  result?: Array<{ values?: Array<[number, string]> }>;
};

const CPU = `
max by (instance, server_id, application, lokasi) (
  (
    100 * (1 - avg by (instance, server_id, application, lokasi) (rate(node_cpu_seconds_total{mode="idle",job="node"}[5m])))
  )
  or
  (
    100 * (1 - avg by (instance, server_id, application, lokasi) (rate(windows_cpu_time_total{mode="idle",job="windows"}[5m])))
  )
)
`;

const RAM = `
max by (instance, server_id, application, lokasi) (
  (
    100 * (1 - (node_memory_MemAvailable_bytes{job="node"} / node_memory_MemTotal_bytes{job="node"}))
  )
  or
  (
    100 * (1 - (windows_memory_available_bytes{job="windows"} / windows_cs_physical_memory_bytes{job="windows"}))
  )
)
`;

const DISK = `
max by (instance, server_id, application, lokasi) (
  (
    100 - (
      100 * node_filesystem_avail_bytes{job="node",fstype!~"tmpfs|overlay|squashfs|devtmpfs",mountpoint!~"/boot|/boot/efi"}
      / node_filesystem_size_bytes{job="node",fstype!~"tmpfs|overlay|squashfs|devtmpfs",mountpoint!~"/boot|/boot/efi"}
    )
  )
  or
  (
    100 - (
      100 * windows_logical_disk_free_bytes{job="windows",volume=~"[A-Z]:"}
      / windows_logical_disk_size_bytes{job="windows",volume=~"[A-Z]:"}
    )
  )
)
`;

const CPU_AVG = `
avg(
  (
    100 * (1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="node"}[5m])))
  )
  or
  (
    100 * (1 - avg by (instance) (rate(windows_cpu_time_total{mode="idle",job="windows"}[5m])))
  )
)
`;

const RAM_AVG = `
avg(
  (
    100 * (1 - (node_memory_MemAvailable_bytes{job="node"} / node_memory_MemTotal_bytes{job="node"}))
  )
  or
  (
    100 * (1 - (windows_memory_available_bytes{job="windows"} / windows_cs_physical_memory_bytes{job="windows"}))
  )
)
`;

function explain(error: unknown) {
  if (!(error instanceof Error)) return "Prometheus tidak terjangkau";
  const cause = error.cause as { code?: string } | undefined;
  if (
    error.name === "TimeoutError" ||
    error.message === "fetch failed" ||
    cause?.code === "ECONNREFUSED" ||
    cause?.code === "ENOTFOUND" ||
    cause?.code === "EHOSTUNREACH"
  ) {
    return "Prometheus tidak terjangkau";
  }
  return error.message;
}

function empty(error: string): OverviewData {
  return {
    ok: false,
    error,
    updatedAt: new Date().toISOString(),
    totals: { total: 0, online: 0, offline: 0, warning: 0 },
    cpuAvg: null,
    ramAvg: null,
    cpuSeries: [],
    ramSeries: [],
    servers: [],
  };
}

function num(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function prom(query: string, range?: { start: number; end: number; step: number }) {
  const url = new URL(range ? "/api/v1/query_range" : "/api/v1/query", `${PROMETHEUS_URL}/`);
  url.searchParams.set("query", query);
  if (range) {
    url.searchParams.set("start", String(range.start));
    url.searchParams.set("end", String(range.end));
    url.searchParams.set("step", String(range.step));
  }
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`Prometheus menjawab ${response.status}`);
  }
  const body = (await response.json()) as {
    status?: string;
    error?: string;
    data?: PromVector & PromMatrix;
  };
  if (body.status !== "success" || !body.data) {
    throw new Error(body.error || "Query Prometheus gagal");
  }
  return body.data;
}

function series(data: PromMatrix): Point[] {
  const values = data.result?.[0]?.values ?? [];
  return values.flatMap(([t, raw]) => {
    const v = num(raw);
    return v === null ? [] : [{ t: t * 1000, v }];
  });
}

function lastValue(data: PromVector): number | null {
  return num(data.result?.[0]?.value?.[1]);
}

function displayName(labels: Record<string, string>) {
  if (labels.application) return labels.application;
  const serverId = labels.server_id || labels.instance || "server";
  const vm = serverId.match(/^vm-(.+?)-lrt-/i);
  if (vm?.[1]) return vm[1];
  return serverId.replace(/^vm-/i, "");
}

function healthOf(
  up: boolean,
  cpu: number | null,
  ram: number | null,
  disk: number | null
): Health {
  if (!up) return "offline";
  if (
    (cpu !== null && cpu > 85) ||
    (ram !== null && ram > 90) ||
    (disk !== null && disk > 85)
  ) {
    return "critical";
  }
  if (
    (cpu !== null && cpu >= 70) ||
    (ram !== null && ram >= 75) ||
    (disk !== null && disk >= 75)
  ) {
    return "warning";
  }
  return "online";
}

const RANK: Record<Health, number> = {
  offline: 0,
  critical: 1,
  warning: 2,
  online: 3,
};

export async function getOverview(): Promise<OverviewData> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 6 * 60 * 60;
  const range = { start, end, step: 60 };
  try {
    const [up, cpu, ram, disk, cpuNow, ramNow, cpuHist, ramHist] = await Promise.all([
      prom(`up{job=~"node|windows"}`),
      prom(CPU),
      prom(RAM),
      prom(DISK),
      prom(CPU_AVG),
      prom(RAM_AVG),
      prom(CPU_AVG, range),
      prom(RAM_AVG, range),
    ]);

    const cpuBy = new Map<string, { value: number | null; labels: Record<string, string> }>();
    for (const row of cpu.result ?? []) {
      const instance = row.metric?.instance;
      if (!instance) continue;
      cpuBy.set(instance, { value: num(row.value?.[1]), labels: row.metric ?? {} });
    }
    const ramBy = new Map<string, number | null>();
    for (const row of ram.result ?? []) {
      const instance = row.metric?.instance;
      if (instance) ramBy.set(instance, num(row.value?.[1]));
    }
    const diskBy = new Map<string, number | null>();
    for (const row of disk.result ?? []) {
      const instance = row.metric?.instance;
      if (instance) diskBy.set(instance, num(row.value?.[1]));
    }

    const servers: ServerRow[] = (up.result ?? []).map((row) => {
      const labels = row.metric ?? {};
      const instance = labels.instance || labels.server_id || "unknown";
      const cpuSample = cpuBy.get(instance);
      const merged = { ...labels, ...(cpuSample?.labels ?? {}) };
      const cpuValue = cpuSample?.value ?? null;
      const ramValue = ramBy.get(instance) ?? null;
      const diskValue = diskBy.get(instance) ?? null;
      const isUp = num(row.value?.[1]) === 1;
      return {
        id: merged.server_id || instance,
        name: displayName(merged),
        lokasi: merged.lokasi || "",
        instance: instance.replace(/:\d+$/, ""),
        cpu: isUp ? cpuValue : null,
        ram: isUp ? ramValue : null,
        disk: isUp ? diskValue : null,
        health: healthOf(isUp, cpuValue, ramValue, diskValue),
      };
    });

    servers.sort((a, b) => {
      const rank = RANK[a.health] - RANK[b.health];
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name, "id");
    });

    const warning = servers.filter(
      (server) => server.health === "warning" || server.health === "critical"
    ).length;

    return {
      ok: true,
      error: "",
      updatedAt: new Date().toISOString(),
      totals: {
        total: servers.length,
        online: servers.filter((server) => server.health === "online").length,
        offline: servers.filter((server) => server.health === "offline").length,
        warning,
      },
      cpuAvg: lastValue(cpuNow),
      ramAvg: lastValue(ramNow),
      cpuSeries: series(cpuHist),
      ramSeries: series(ramHist),
      servers,
    };
  } catch (error) {
    const message = explain(error);
    return empty(
      `${message}. Pastikan Prometheus berjalan dan PROMETHEUS_URL mengarah ke sana.`
    );
  }
}
