/**
 * Isi prometheus/targets dari database VM Inventory.
 * Server lokasi KCI dilewati (tidak dipantau dari Grafana 192.168.38.11).
 *
 * Dari folder proyek:
 *   set DATABASE_URL=postgresql://...
 *   node monitoring/scripts/sync-targets-from-inventory.mjs
 *
 * Tanpa database, isi ulang http.yml dari nodes.yml yang sudah ada:
 *   node monitoring/scripts/sync-targets-from-inventory.mjs --from-targets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = process.env.TARGET_DIR
  ? path.resolve(process.env.TARGET_DIR)
  : path.resolve(__dirname, "../prometheus/targets");
const EXCLUDE = (process.env.EXCLUDE_LOKASI || "kci").toLowerCase();

function yamlScalar(value) {
  const text = String(value ?? "").trim() || "-";
  if (!/^[A-Za-z0-9_.:/@+-]+$/.test(text)) return JSON.stringify(text);
  return text;
}

function isKci(lokasi) {
  return String(lokasi || "").toLowerCase().includes(EXCLUDE);
}

function parseData(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

function isIpv4(ip) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip);
}

function isWindows(data) {
  const blob = `${data.os || ""} ${data.os_version || ""}`;
  return /windows|win32|microsoft windows/i.test(blob);
}

function explicitHttp(data) {
  for (const key of ["http_url", "health_url", "url", "service_url", "web_url"]) {
    const raw = String(data[key] || "").trim();
    if (/^https?:\/\//i.test(raw)) {
      return [{ url: raw, service: "http", module: "http_2xx" }];
    }
  }
  return null;
}

function inferHttp(data, ip) {
  const found = explicitHttp(data);
  if (found) return found;
  const app = String(data.application || "").toLowerCase();
  const blob = `${app} ${String(data.server_id || "").toLowerCase()}`;
  if (!app || app === "-") return [];
  if (blob.includes("grafana")) {
    const port = ip === "192.168.38.11" ? "3001" : "3000";
    return [{ url: `http://${ip}:${port}/api/health`, service: "grafana", module: "http_2xx" }];
  }
  if (
    app.startsWith("db") ||
    blob.includes("proxmox") ||
    blob.includes("bindplane") ||
    blob.includes("backup") ||
    blob.includes("registry") ||
    blob.includes("nats") ||
    /(^|-)ntp($|-)/.test(app)
  ) {
    return [];
  }
  if (blob.includes("jenkins") && !blob.includes("agent")) {
    return [{ url: `http://${ip}:8080/`, service: "jenkins", module: "http_any" }];
  }
  if (blob.includes("graylog")) {
    return [{ url: `http://${ip}:9000/`, service: "graylog", module: "http_any" }];
  }
  if (blob.includes("sonar")) {
    return [{ url: `http://${ip}:9000/`, service: "sonarqube", module: "http_any" }];
  }
  if (blob.includes("zabbix") || blob.includes("zabix")) {
    return [{ url: `http://${ip}/`, service: "zabbix", module: "http_any" }];
  }
  const web =
    /web|portal|survey|dashboard|virtualtour|pengaduan|peta|frontend|-fe\b|^fe[-_]/.test(
      blob
    );
  if (web) return [{ url: `http://${ip}/`, service: "http", module: "http_any" }];
  return [];
}

function block(ip, port, data) {
  return [
    "- targets:",
    `    - ${ip}:${port}`,
    "  labels:",
    `    server_id: ${yamlScalar(data.server_id)}`,
    `    application: ${yamlScalar(data.application)}`,
    `    lokasi: ${yamlScalar(data.lokasi_server)}`,
    "",
  ].join("\n");
}

function httpBlock(url, data, service, moduleName) {
  const target = /[:/?]/.test(url) && !/^https?:\/\//.test(url) ? JSON.stringify(url) : url;
  return [
    "- targets:",
    `    - ${target}`,
    "  labels:",
    `    server_id: ${yamlScalar(data.server_id)}`,
    `    application: ${yamlScalar(data.application)}`,
    `    lokasi: ${yamlScalar(data.lokasi_server)}`,
    `    service: ${yamlScalar(service)}`,
    `    module: ${moduleName}`,
    "",
  ].join("\n");
}

function writeFile(name, header, body) {
  const content = `${header}\n${body.trim() ? body : "[]\n"}`;
  fs.writeFileSync(path.join(TARGET_DIR, name), content, "utf8");
}

function parseNodesFile(text) {
  const rows = [];
  for (const chunk of text.split(/\n(?=- targets:)/)) {
    const ip = (chunk.match(/- (\d{1,3}(?:\.\d{1,3}){3}):\d+/) || [])[1];
    if (!ip) continue;
    const label = (name) => {
      const match = chunk.match(new RegExp(`${name}:\\s*(.+)`));
      if (!match) return "";
      return match[1].trim().replace(/^"|"$/g, "");
    };
    rows.push({
      ip,
      server_id: label("server_id"),
      application: label("application"),
      lokasi_server: label("lokasi"),
    });
  }
  return rows;
}

function httpBody(rows) {
  const blocks = [];
  for (const data of rows) {
    for (const probe of inferHttp(data, data.ip)) {
      blocks.push(httpBlock(probe.url, data, probe.service, probe.module));
    }
  }
  return blocks.join("\n");
}

if (process.argv.includes("--from-targets")) {
  const nodesPath = path.join(TARGET_DIR, "nodes.yml");
  const rows = parseNodesFile(fs.readFileSync(nodesPath, "utf8"));
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  writeFile(
    "http.yml",
    "# Probe HTTP dari inventory / nodes.yml. URL eksplisit (http_url) memakai modul http_2xx.",
    httpBody(rows)
  );
  console.log(`http.yml: ${rows.length} server dibaca, probe ditulis ke ${TARGET_DIR}`);
  process.exit(0);
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/vm_inventory";

const client = new Client({ connectionString });
await client.connect();

try {
  const { rows } = await client.query(
    "SELECT id, data FROM vm_records ORDER BY id"
  );

  const linuxBlocks = [];
  const processBlocks = [];
  const windowsBlocks = [];
  const tcpBlocks = [];
  const httpBlocks = [];
  const skipped = [];
  const included = [];

  for (const row of rows) {
    const data = parseData(row.data);
    const ip = String(data.ip || "").trim();
    const lokasi = data.lokasi_server || "";
    const name = data.server_id || `id-${row.id}`;

    if (isKci(lokasi)) {
      skipped.push(`${name} ${ip} lokasi=${lokasi} (KCI)`);
      continue;
    }
    if (!isIpv4(ip)) {
      skipped.push(`${name} IP tidak valid: ${ip || "(kosong)"}`);
      continue;
    }

    included.push(`${name} ${ip} ${lokasi || "-"}`);
    for (const probe of inferHttp(data, ip)) {
      httpBlocks.push(httpBlock(probe.url, data, probe.service, probe.module));
    }
    if (isWindows(data)) {
      windowsBlocks.push(block(ip, 9182, data));
    } else {
      linuxBlocks.push(block(ip, 9100, data));
      processBlocks.push(block(ip, 9256, data));
      tcpBlocks.push(
        [
          "- targets:",
          `    - ${ip}:22`,
          "  labels:",
          `    server_id: ${yamlScalar(data.server_id)}`,
          "    service: ssh",
          "",
        ].join("\n")
      );
    }
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  writeFile(
    "nodes.yml",
    "# Linux node_exporter — diisi dari inventory, lokasi KCI dilewati",
    linuxBlocks.join("\n")
  );
  writeFile(
    "process.yml",
    "# process-exporter — server_id sama dengan nodes.yml",
    processBlocks.join("\n")
  );
  writeFile(
    "windows.yml",
    "# windows_exporter :9182",
    windowsBlocks.join("\n")
  );
  writeFile("tcp.yml", "# Probe SSH", tcpBlocks.join("\n"));
  writeFile(
    "http.yml",
    "# Probe HTTP dari inventory. Isi kolom http_url untuk URL pasti; selain itu diambil dari nama aplikasi web.",
    httpBlocks.join("\n")
  );

  console.log(`Ditulis ke ${TARGET_DIR}`);
  console.log(`Dipantau (bukan KCI): ${included.length}`);
  for (const line of included) console.log(`  + ${line}`);
  console.log(`Dilewati: ${skipped.length}`);
  for (const line of skipped) console.log(`  - ${line}`);
} finally {
  await client.end();
}
