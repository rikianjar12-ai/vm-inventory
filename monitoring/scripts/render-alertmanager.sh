#!/usr/bin/env bash
# Isi alertmanager.yml dari .env (Telegram / email).
#   cd monitoring && bash scripts/render-alertmanager.sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"
TEMPLATE="$ROOT/alertmanager/alertmanager.yml.template"
OUT="$ROOT/alertmanager/alertmanager.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "File .env tidak ada: $ENV_FILE"
  echo "Salin dulu: cp .env.example .env"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-0}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_FROM="${SMTP_FROM:-}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"

smtp_global=""
notify_block=""

if [[ -n "$SMTP_HOST" && -n "$SMTP_FROM" ]]; then
  smtp_global=$(cat <<EOF
  smtp_smarthost: '${SMTP_HOST}'
  smtp_from: '${SMTP_FROM}'
EOF
)
  if [[ -n "$SMTP_USER" ]]; then
    smtp_global+=$'\n'"  smtp_auth_username: '${SMTP_USER}'"
  fi
  if [[ -n "$SMTP_PASSWORD" ]]; then
    smtp_global+=$'\n'"  smtp_auth_password: '${SMTP_PASSWORD}'"
  fi
fi

if [[ -n "$TELEGRAM_BOT_TOKEN" && "$TELEGRAM_CHAT_ID" != "0" && -n "$TELEGRAM_CHAT_ID" ]]; then
  notify_block+=$(cat <<EOF

    telegram_configs:
      - bot_token: '${TELEGRAM_BOT_TOKEN}'
        chat_id: ${TELEGRAM_CHAT_ID}
        parse_mode: HTML
        send_resolved: true
        message: |
          <b>{{ .Status | toUpper }}</b> {{ .CommonLabels.alertname }}
          Severity: {{ .CommonLabels.severity }}
          Server: {{ .CommonLabels.server_id }}
          {{ range .Alerts }}• {{ .Annotations.summary }}
          {{ end }}
EOF
)
fi

if [[ -n "$ALERT_EMAIL" && -n "$SMTP_HOST" && -n "$SMTP_FROM" ]]; then
  notify_block+=$(cat <<EOF

    email_configs:
      - to: '${ALERT_EMAIL}'
        send_resolved: true
        headers:
          Subject: '[LRT Observability] {{ .Status | toUpper }} {{ .CommonLabels.alertname }}'
EOF
)
fi

if [[ -z "$notify_block" ]]; then
  notify_block=$'\n    # Belum ada Telegram/email di .env — alert tetap dievaluasi, tanpa kirim keluar.'
fi

# Escape & for sed replacement safety: use python-free awk/perl approach via bash
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
cp "$TEMPLATE" "$tmp"

# Replace placeholders (use python if available, else awk)
replace_placeholder() {
  local key="$1"
  local value="$2"
  local file="$3"
  awk -v k="$key" -v v="$value" '
    BEGIN { found=0 }
    index($0, k) {
      print v
      found=1
      next
    }
    { print }
  ' "$file" > "${file}.out"
  mv "${file}.out" "$file"
}

replace_placeholder "__SMTP_GLOBAL__" "${smtp_global:-# smtp belum diisi}" "$tmp"
replace_placeholder "__NOTIFY_DEFAULT__" "$notify_block" "$tmp"
replace_placeholder "__NOTIFY_CRITICAL__" "$notify_block" "$tmp"

cp "$tmp" "$OUT"
echo "Ditulis: $OUT"
if [[ -n "$TELEGRAM_BOT_TOKEN" && "$TELEGRAM_CHAT_ID" != "0" ]]; then
  echo "Telegram: aktif (chat_id=${TELEGRAM_CHAT_ID})"
else
  echo "Telegram: belum diisi"
fi
if [[ -n "$ALERT_EMAIL" && -n "$SMTP_HOST" ]]; then
  echo "Email: aktif → ${ALERT_EMAIL}"
else
  echo "Email: belum diisi"
fi
echo "Lanjut: docker compose restart alertmanager"
