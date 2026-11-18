"use client";

import { useEffect, useMemo, useState } from "react";
import type { Health, OverviewData, Point, ServerRow } from "@/lib/dc-overview";
import styles from "./DataCenterBoard.module.css";

type Filter = "all" | "offline" | "warning" | "online";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "offline", label: "Offline" },
  { id: "warning", label: "Warning" },
  { id: "online", label: "Online" },
];

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatClock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function healthLabel(health: Health) {
  if (health === "online") return "Online";
  if (health === "warning") return "Warning";
  if (health === "critical") return "Critical";
  return "Offline";
}

function meterTone(value: number | null, warn: number, crit: number) {
  if (value === null) return "idle";
  if (value > crit) return "crit";
  if (value >= warn) return "warn";
  return "ok";
}

function AreaChart({
  points,
  color,
  marks,
}: {
  points: Point[];
  color: string;
  marks: number[];
}) {
  const gradientId = `fill-${color.replace("#", "")}`;
  if (points.length < 2) {
    return <p className={styles.chartEmpty}>Belum ada riwayat 6 jam</p>;
  }
  const width = 640;
  const height = 148;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - (Math.min(100, Math.max(0, point.v)) / 100) * height;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const fill = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {marks.map((mark) => {
        const y = height - (mark / 100) * height;
        return (
          <line
            key={mark}
            x1="0"
            x2={width}
            y1={y}
            y2={y}
            className={styles.gridLine}
          />
        );
      })}
      <path d={fill} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

function ServerLine({ server, detailBase }: { server: ServerRow; detailBase: string }) {
  const href = `${detailBase}&var-server=${encodeURIComponent(server.id)}`;
  return (
    <a className={styles.server} href={href}>
      <span className={styles.serverName}>
        <strong>{server.name}</strong>
        <em>
          {[server.lokasi, server.instance].filter(Boolean).join(" · ")}
        </em>
      </span>
      <Meter label="CPU" value={server.cpu} warn={70} crit={85} />
      <Meter label="RAM" value={server.ram} warn={75} crit={90} />
      <Meter label="Disk" value={server.disk} warn={75} crit={85} />
      <span className={`${styles.pill} ${styles[server.health]}`}>
        {healthLabel(server.health)}
      </span>
    </a>
  );
}

function Meter({
  label,
  value,
  warn,
  crit,
}: {
  label: string;
  value: number | null;
  warn: number;
  crit: number;
}) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <span className={styles.meter}>
      <span className={styles.meterTop}>
        <span>{label}</span>
        <span>{formatPercent(value)}</span>
      </span>
      <span className={styles.track}>
        <span
          className={`${styles.fill} ${styles[meterTone(value, warn, crit)]}`}
          style={{ width: `${width}%` }}
        />
      </span>
    </span>
  );
}

export function DataCenterBoard({
  initial,
  links,
}: {
  initial: OverviewData;
  links: {
    overview: string;
    server: string;
    app: string;
    network: string;
    alerts: string;
  };
}) {
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [lokasi, setLokasi] = useState("Semua");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let stop = false;
    async function refresh() {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/dc-overview", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as OverviewData;
        if (!stop) setData(next);
      } catch {
        /* data terakhir tetap ditampilkan */
      }
    }
    const timer = setInterval(refresh, 30000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const locations = useMemo(() => {
    const names = new Set(data.servers.map((server) => server.lokasi).filter(Boolean));
    return ["Semua", ...Array.from(names).sort((a, b) => a.localeCompare(b, "id"))];
  }, [data.servers]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.servers.filter((server) => {
      if (lokasi !== "Semua" && server.lokasi !== lokasi) return false;
      if (filter === "offline" && server.health !== "offline") return false;
      if (filter === "online" && server.health !== "online") return false;
      if (
        filter === "warning" &&
        server.health !== "warning" &&
        server.health !== "critical"
      ) {
        return false;
      }
      if (!needle) return true;
      return `${server.name} ${server.instance} ${server.lokasi}`
        .toLowerCase()
        .includes(needle);
    });
  }, [data.servers, filter, lokasi, query]);

  const critical = data.servers.filter((server) => server.health === "critical").length;

  return (
    <div className={`dc-board ${styles.page}`}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>LRT Jabodebek</p>
            <h1>IT Data Center • Server Monitoring Overview</h1>
          </div>
          <div className={styles.headerSide}>
            <span className={styles.live}>
              <span className={styles.dot} />
              Live · {formatClock(data.updatedAt)} WIB
            </span>
            <a className={styles.ghost} href="/">
              Inventory
            </a>
          </div>
        </header>

        <nav className={styles.tabs} aria-label="Dashboard monitoring">
          <span className={styles.tabActive}>Overview</span>
          <a href={links.server}>Server Detail</a>
          <a href={links.app}>Aplikasi & Database</a>
          <a href={links.network}>Jaringan</a>
          <a href={links.alerts}>Alert</a>
          <a href={links.overview}>Grafana</a>
        </nav>

        {data.error ? <p className={styles.error}>{data.error}</p> : null}

        <section className={styles.cards} aria-label="Ringkasan">
          <article className={styles.card}>
            <span>Total Server</span>
            <strong>{data.totals.total}</strong>
          </article>
          <article className={`${styles.card} ${styles.cardOnline}`}>
            <span>Online</span>
            <strong>{data.totals.online}</strong>
          </article>
          <article className={`${styles.card} ${styles.cardOffline}`}>
            <span>Offline</span>
            <strong>{data.totals.offline}</strong>
          </article>
          <article className={`${styles.card} ${styles.cardWarning}`}>
            <span>Warning</span>
            <strong>{data.totals.warning}</strong>
            <em>{critical > 0 ? `${critical} kritis di dalamnya` : "CPU, RAM, atau disk"}</em>
          </article>
        </section>

        <section className={styles.charts}>
          <article className={styles.panel}>
            <header>
              <h2>CPU Utilization</h2>
              <strong>{formatPercent(data.cpuAvg)}</strong>
              <span>rata-rata</span>
            </header>
            <AreaChart points={data.cpuSeries} color="#38bdf8" marks={[70, 85]} />
          </article>
          <article className={styles.panel}>
            <header>
              <h2>Memory Utilization</h2>
              <strong>{formatPercent(data.ramAvg)}</strong>
              <span>rata-rata</span>
            </header>
            <AreaChart points={data.ramSeries} color="#a78bfa" marks={[75, 90]} />
          </article>
        </section>

        <section className={styles.listPanel}>
          <header className={styles.listHead}>
            <div>
              <h2>Server Health Status</h2>
              <p>Ambang warning/kritis: CPU 70/85 · RAM 75/90 · Disk 75/85. Alert menyala setelah 10 menit.</p>
            </div>
            <label className={styles.search}>
              <span className={styles.visuallyHidden}>Cari server</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari server atau IP"
              />
            </label>
          </header>

          <div className={styles.filters}>
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? styles.filterOn : styles.filter}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
            {locations.length > 2
              ? locations.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={lokasi === name ? styles.filterOn : styles.filter}
                    onClick={() => setLokasi(name)}
                  >
                    {name}
                  </button>
                ))
              : null}
          </div>

          {!data.ok ? (
            <p className={styles.chartEmpty}>Daftar server muncul setelah Prometheus terhubung.</p>
          ) : visible.length === 0 ? (
            <p className={styles.chartEmpty}>Tidak ada server pada saringan ini.</p>
          ) : (
            <div className={styles.servers}>
              {visible.map((server) => (
                <ServerLine key={server.id} server={server} detailBase={links.server} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
