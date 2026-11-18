#!/usr/bin/env node
/**
 * Isi alertmanager.yml dari .env (Telegram / email).
 *   node scripts/render-alertmanager.mjs
 *   node scripts/render-alertmanager.mjs path/ke/.env
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.resolve(process.argv[2] || path.join(root, ".env"));
const templatePath = path.join(root, "alertmanager", "alertmanager.yml.template");
const outPath = path.join(root, "alertmanager", "alertmanager.yml");

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

if (!fs.existsSync(envPath)) {
  console.error(`File .env tidak ada: ${envPath}`);
  console.error("Salin dulu: copy .env.example .env");
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const token = (env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (env.TELEGRAM_CHAT_ID || "0").trim();
const email = (env.ALERT_EMAIL || "").trim();
const smtpHost = (env.SMTP_HOST || "").trim();
const smtpFrom = (env.SMTP_FROM || "").trim();
const smtpUser = (env.SMTP_USER || "").trim();
const smtpPass = (env.SMTP_PASSWORD || "").trim();

let smtpGlobal = "# smtp belum diisi";
if (smtpHost && smtpFrom) {
  const lines = [
    `  smtp_smarthost: '${smtpHost}'`,
    `  smtp_from: '${smtpFrom}'`,
  ];
  if (smtpUser) lines.push(`  smtp_auth_username: '${smtpUser}'`);
  if (smtpPass) lines.push(`  smtp_auth_password: '${smtpPass}'`);
  smtpGlobal = lines.join("\n");
}

const notifyParts = [];
if (token && chatId && chatId !== "0") {
  notifyParts.push(`    telegram_configs:
      - bot_token: '${token}'
        chat_id: ${chatId}
        parse_mode: HTML
        send_resolved: true
        message: |
          <b>{{ .Status | toUpper }}</b> {{ .CommonLabels.alertname }}
          Severity: {{ .CommonLabels.severity }}
          Server: {{ .CommonLabels.server_id }}
          {{ range .Alerts }}• {{ .Annotations.summary }}
          {{ end }}`);
}
if (email && smtpHost && smtpFrom) {
  notifyParts.push(`    email_configs:
      - to: '${email}'
        send_resolved: true
        headers:
          Subject: '[LRT Observability] {{ .Status | toUpper }} {{ .CommonLabels.alertname }}'`);
}

const notifyBlock =
  notifyParts.length > 0
    ? "\n" + notifyParts.join("\n")
    : "\n    # Belum ada Telegram/email di .env — alert tetap dievaluasi, tanpa kirim keluar.";

let template = fs.readFileSync(templatePath, "utf8");
template = template
  .replace("__SMTP_GLOBAL__", smtpGlobal)
  .replace("__NOTIFY_DEFAULT__", notifyBlock)
  .replace("__NOTIFY_CRITICAL__", notifyBlock);

fs.writeFileSync(outPath, template, "utf8");
console.log(`Ditulis: ${outPath}`);
console.log(
  token && chatId !== "0"
    ? `Telegram: aktif (chat_id=${chatId})`
    : "Telegram: belum diisi"
);
console.log(
  email && smtpHost ? `Email: aktif → ${email}` : "Email: belum diisi"
);
console.log("Lanjut: docker compose restart alertmanager");
