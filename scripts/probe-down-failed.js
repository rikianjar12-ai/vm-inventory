const fs = require("fs");
const net = require("net");
const http = require("http");
const path = require("path");

const root = path.join(__dirname, "..");

function parseTargets(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const blocks = text.split(/^- /m).slice(1);
  const out = [];
  for (const b of blocks) {
    const t = b.match(/-\s+([0-9.]+:\d+)/);
    const sid = b.match(/server_id:\s*(.+)/);
    const app = b.match(/application:\s*(.+)/);
    const loc = b.match(/lokasi:\s*(.+)/);
    if (!t) continue;
    out.push({
      target: t[1].trim(),
      server_id: (sid ? sid[1].trim() : "").replace(/^"|"$/g, ""),
      application: (app ? app[1].trim() : "").replace(/^"|"$/g, ""),
      lokasi: (loc ? loc[1].trim() : "").replace(/^"|"$/g, ""),
    });
  }
  return out;
}

function probe(host, port, ms = 1200) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port }, () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.setTimeout(ms, () => {
      s.destroy();
      resolve(false);
    });
  });
}

function fetchMetrics(host, port, ms = 8000) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: "/metrics", timeout: ms }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        data += c;
        if (data.length > 12_000_000) {
          req.destroy();
          resolve(null);
        }
      });
      res.on("end", () => resolve(data));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function parseFailed(metrics) {
  if (!metrics) return [];
  const failed = [];
  const lines = metrics.split("\n");
  for (const line of lines) {
    if (!line.startsWith("node_systemd_unit_state{")) continue;
    if (!line.includes('state="failed"')) continue;
    const m = line.match(/^node_systemd_unit_state\{([^}]*)\}\s+(\S+)/);
    if (!m) continue;
    if (m[2] !== "1") continue;
    const labels = {};
    const re = /(\w+)="([^"]*)"/g;
    let lm;
    while ((lm = re.exec(m[1]))) labels[lm[1]] = lm[2];
    failed.push({ name: labels.name || "", type: labels.type || "" });
  }
  return failed;
}

async function mapPool(items, concurrency, fn) {
  let i = 0;
  const results = new Array(items.length);
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

(async () => {
  const targets = parseTargets(
    path.join(root, "monitoring", "prometheus", "targets", "nodes.yml")
  );

  const reach = await mapPool(targets, 25, async (t) => {
    const [host, port] = t.target.split(":");
    const ok = await probe(host, Number(port));
    return { ...t, up: ok };
  });

  const down = reach.filter((r) => !r.up);
  const up = reach.filter((r) => r.up);

  const failedRows = [];
  await mapPool(up, 8, async (t) => {
    const [host, port] = t.target.split(":");
    const metrics = await fetchMetrics(host, Number(port));
    const failed = parseFailed(metrics);
    for (const f of failed) {
      failedRows.push({
        server_id: t.server_id,
        application: t.application,
        lokasi: t.lokasi,
        target: t.target,
        unit: f.name,
        type: f.type,
      });
    }
  });

  const byUnit = {};
  for (const r of failedRows) byUnit[r.unit] = (byUnit[r.unit] || 0) + 1;

  const byLokasiDown = {};
  for (const r of down) byLokasiDown[r.lokasi] = (byLokasiDown[r.lokasi] || 0) + 1;

  const out = {
    generated_at: new Date().toISOString(),
    note:
      "Probe TCP :9100 + scrape /metrics dari workstation. Angka Grafana (48 UP / 32 DOWN, 146 service gagal) dari Prometheus di 192.168.38.11 bisa berbeda karena routing/firewall.",
    grafana_snapshot: { up: 48, down: 32, service_gagal: 146 },
    probed_total: targets.length,
    up_from_here: up.length,
    down_from_here: down.length,
    down_by_lokasi: byLokasiDown,
    down_list: down
      .map(({ server_id, application, lokasi, target }) => ({
        server_id,
        application,
        lokasi,
        target,
      }))
      .sort(
        (a, b) =>
          a.lokasi.localeCompare(b.lokasi) ||
          a.server_id.localeCompare(b.server_id)
      ),
    failed_service_count_from_reachable: failedRows.length,
    failed_by_unit: Object.entries(byUnit)
      .sort((a, b) => b[1] - a[1])
      .map(([unit, count]) => ({ unit, count })),
    failed_rows: failedRows.sort(
      (a, b) =>
        a.unit.localeCompare(b.unit) || a.server_id.localeCompare(b.server_id)
    ),
  };

  const outPath = path.join(root, "scripts", "probe-down-failed-result.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    JSON.stringify(
      {
        outPath,
        probed_total: out.probed_total,
        up_from_here: out.up_from_here,
        down_from_here: out.down_from_here,
        failed_service_count_from_reachable:
          out.failed_service_count_from_reachable,
        failed_by_unit: out.failed_by_unit.slice(0, 25),
        down_by_lokasi: out.down_by_lokasi,
      },
      null,
      2
    )
  );
})();
