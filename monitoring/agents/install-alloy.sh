#!/usr/bin/env bash
# Pasang Grafana Alloy di VM yang dipantau. Mengirim syslog, auth, dan journal ke Loki.
#   sudo bash install-alloy.sh --monitor-ip 192.168.38.11 --server-id NAMA-SERVER
set -eu
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

ALLOY_VER="${ALLOY_VERSION:-1.5.1}"
MONITOR_IP="${MONITOR_IP:-192.168.38.11}"
SERVER_ID="${SERVER_ID:-}"
INSTALL_DIR=/usr/local/bin
CONF_DIR=/etc/alloy
DATA_DIR=/var/lib/alloy

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
  x86_64) pe_arch=amd64 ;;
  aarch64|arm64) pe_arch=arm64 ;;
  *) echo "Arsitektur tidak didukung: $arch"; exit 1 ;;
esac

command -v curl >/dev/null || { echo "Perlu curl"; exit 1; }

# Matikan Promtail lama jika masih ada (migrasi PPT: Alloy menggantikan Promtail)
if systemctl list-unit-files promtail.service >/dev/null 2>&1; then
  systemctl disable --now promtail.service 2>/dev/null || true
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"

echo "==> Unduh Grafana Alloy ${ALLOY_VER}"
curl -fL --retry 3 -o alloy.zip \
  "https://github.com/grafana/alloy/releases/download/v${ALLOY_VER}/alloy-linux-${pe_arch}.zip"

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

unzip -o alloy.zip
alloy_bin=$(find . -type f -name 'alloy*' -perm -u+x | head -n1)
[[ -n "$alloy_bin" ]] || { echo "Binary alloy tidak ditemukan di arsip"; ls -la; exit 1; }
install -m 0755 "$alloy_bin" "$INSTALL_DIR/alloy"
[[ -x "$INSTALL_DIR/alloy" ]] || { echo "Gagal memasang binary alloy"; exit 1; }

mkdir -p "$CONF_DIR" "$DATA_DIR"

AUTH_PATH="/var/log/auth.log"
SYSLOG_PATH="/var/log/syslog"
[[ -f /var/log/secure ]] && AUTH_PATH="/var/log/secure"
[[ -f /var/log/messages ]] && SYSLOG_PATH="/var/log/messages"

cat > "$CONF_DIR/config.alloy" <<EOF
logging {
  level  = "info"
  format = "logfmt"
}

loki.write "default" {
  endpoint {
    url = "http://${MONITOR_IP}:3100/loki/api/v1/push"
  }
}

loki.relabel "journal" {
  forward_to = []

  rule {
    source_labels = ["__journal__systemd_unit"]
    target_label  = "unit"
  }

  rule {
    source_labels = ["__journal__hostname"]
    target_label  = "host"
  }

  rule {
    source_labels = ["__journal_syslog_identifier"]
    target_label  = "ident"
  }

  rule {
    source_labels = ["__journal_priority_keyword"]
    target_label  = "level"
  }
}

loki.source.journal "systemd" {
  max_age       = "24h"
  relabel_rules = loki.relabel.journal.rules
  forward_to    = [loki.write.default.receiver]
  labels        = {
    job       = "systemd",
    server_id = "${SERVER_ID}",
  }
}

local.file_match "syslog" {
  path_targets = [{
    __path__  = "${SYSLOG_PATH}",
    job       = "syslog",
    server_id = "${SERVER_ID}",
    host      = "${SERVER_ID}",
  }]
}

loki.source.file "syslog" {
  targets    = local.file_match.syslog.targets
  forward_to = [loki.write.default.receiver]
}

local.file_match "auth" {
  path_targets = [{
    __path__  = "${AUTH_PATH}",
    job       = "auth",
    server_id = "${SERVER_ID}",
    host      = "${SERVER_ID}",
  }]
}

loki.source.file "auth" {
  targets    = local.file_match.auth.targets
  forward_to = [loki.write.default.receiver]
}
EOF

cat > /etc/systemd/system/alloy.service <<'UNIT'
[Unit]
Description=Grafana Alloy (Loki log agent)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/alloy run /etc/alloy/config.alloy --storage.path=/var/lib/alloy
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now alloy.service
sleep 1
systemctl --no-pager --full status alloy.service | sed -n '1,16p' || true

echo
echo "==== Alloy aktif di ${SERVER_ID} ===="
echo "Mengirim log ke http://${MONITOR_IP}:3100"
echo "Tes dari VM ini:"
echo "  curl -s --max-time 5 -o /dev/null -w '%{http_code}\\n' http://${MONITOR_IP}:3100/ready"
echo
echo "Firewall jaringan: izinkan ${SERVER_ID} → ${MONITOR_IP} TCP 3100"
echo "Grafana Explore → Loki → {server_id=\"${SERVER_ID}\"}"
