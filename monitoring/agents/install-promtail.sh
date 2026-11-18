#!/usr/bin/env bash
# LEGACY: Promtail. Prefer Grafana Alloy (install-alloy.sh / install-agent.sh tanpa --use-promtail).
# Pasang Promtail di VM yang dipantau. Mengirim syslog, login (auth), dan service (journal) ke Loki.
#   sudo bash install-promtail.sh --monitor-ip 192.168.38.11 --server-id NAMA-SERVER
set -eu
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

PROMTAIL_VER="${PROMTAIL_VERSION:-2.9.8}"
MONITOR_IP="${MONITOR_IP:-192.168.38.11}"
SERVER_ID="${SERVER_ID:-}"
INSTALL_DIR=/usr/local/bin
CONF_DIR=/etc/promtail
DATA_DIR=/var/lib/promtail

while [[ $# -gt 0 ]]; do
  case "$1" in
    --monitor-ip) MONITOR_IP="$2"; shift 2 ;;
    --server-id) SERVER_ID="$2"; shift 2 ;;
    -h|--help)
      echo "sudo bash $0 --monitor-ip 192.168.38.11 --server-id NAMA-SERVER"
      exit 0
      ;;
    *) echo "Opsi tidak dikenal: $1"; exit 1 ;;
  esac
done

if [[ $(id -u) -ne 0 ]]; then
  echo "Jalankan sebagai root: sudo bash $0"
  exit 1
fi

if [[ -z "$SERVER_ID" ]]; then
  SERVER_ID="$(hostname -s 2>/dev/null || hostname)"
fi

arch=$(uname -m)
case "$arch" in
  x86_64) pe_arch=linux-amd64 ;;
  aarch64) pe_arch=linux-arm64 ;;
  *) echo "Arsitektur tidak didukung: $arch"; exit 1 ;;
esac

command -v curl >/dev/null || { echo "Perlu curl"; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"

echo "==> Unduh Promtail ${PROMTAIL_VER}"
curl -fL --retry 3 -o promtail.zip \
  "https://github.com/grafana/loki/releases/download/v${PROMTAIL_VER}/promtail-${pe_arch}.zip"
if ! command -v unzip >/dev/null; then
  echo "==> Pasang unzip"
  if command -v apt-get >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get update -y
    DEBIAN_FRONTEND=noninteractive apt-get install -y unzip
  elif command -v dnf >/dev/null; then
    dnf install -y unzip
  elif command -v yum >/dev/null; then
    yum install -y unzip
  else
    echo "Perlu paket unzip. Pasang manual, lalu jalankan skrip lagi."
    exit 1
  fi
fi
unzip -o promtail.zip
if [[ -x promtail ]]; then
  install -m 0755 promtail "$INSTALL_DIR/promtail"
elif [[ -x "promtail-${pe_arch}" ]]; then
  install -m 0755 "promtail-${pe_arch}" "$INSTALL_DIR/promtail"
else
  find . -type f -name 'promtail*' -executable -exec install -m 0755 {} "$INSTALL_DIR/promtail" \;
fi
[[ -x "$INSTALL_DIR/promtail" ]] || { echo "Gagal memasang binary promtail"; ls -la; exit 1; }

mkdir -p "$CONF_DIR" "$DATA_DIR"

AUTH_PATH="/var/log/auth.log"
SYSLOG_PATH="/var/log/syslog"
[[ -f /var/log/secure ]] && AUTH_PATH="/var/log/secure"
[[ -f /var/log/messages ]] && SYSLOG_PATH="/var/log/messages"

cat > "$CONF_DIR/config.yml" <<EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: ${DATA_DIR}/positions.yaml

clients:
  - url: http://${MONITOR_IP}:3100/loki/api/v1/push

scrape_configs:
  - job_name: journal
    journal:
      max_age: 24h
      labels:
        job: systemd
        server_id: ${SERVER_ID}
    relabel_configs:
      - source_labels: ["__journal__systemd_unit"]
        target_label: unit
      - source_labels: ["__journal__hostname"]
        target_label: host
      - source_labels: ["__journal_syslog_identifier"]
        target_label: ident
      - source_labels: ["__journal_priority_keyword"]
        target_label: level

  - job_name: syslog
    static_configs:
      - targets: ["localhost"]
        labels:
          job: syslog
          server_id: ${SERVER_ID}
          host: ${SERVER_ID}
          __path__: ${SYSLOG_PATH}

  - job_name: auth
    static_configs:
      - targets: ["localhost"]
        labels:
          job: auth
          server_id: ${SERVER_ID}
          host: ${SERVER_ID}
          __path__: ${AUTH_PATH}
EOF

cat > /etc/systemd/system/promtail.service <<'UNIT'
[Unit]
Description=Promtail (Loki log agent)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/promtail -config.file=/etc/promtail/config.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now promtail.service
sleep 1
systemctl --no-pager --full status promtail.service | sed -n '1,16p' || true

echo
echo "==== Promtail aktif di ${SERVER_ID} ===="
echo "Mengirim log ke http://${MONITOR_IP}:3100"
echo "Tes dari VM ini:"
echo "  curl -s --max-time 5 -o /dev/null -w '%{http_code}\\n' http://${MONITOR_IP}:3100/ready"
echo
echo "Firewall jaringan: izinkan ${SERVER_ID} → ${MONITOR_IP} TCP 3100"
echo "Grafana Explore → Loki → {server_id=\"${SERVER_ID}\"}"
