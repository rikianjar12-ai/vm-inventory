#!/usr/bin/env bash
# Agen pantauan VM: node_exporter :9100 + process-exporter :9256
# Jalankan di SETIAP VM yang ingin masuk Grafana (bukan hanya server 192.168.38.22).
#
# Dari VM (setelah skrip dilayani di server pantauan):
#   curl -fsSL http://192.168.38.11:8088/install-linux.sh -o /tmp/install-linux.sh
#   sudo bash /tmp/install-linux.sh --monitor-ip 192.168.38.11 --server-id VM-APP-01
set -eu
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

NODE_VER="${NODE_EXPORTER_VERSION:-1.8.2}"
PROC_VER="${PROCESS_EXPORTER_VERSION:-0.8.7}"
INSTALL_DIR=/usr/local/bin
CONFIG_DIR=/etc/process-exporter
MONITOR_IP="${MONITOR_IP:-192.168.38.11}"
SERVER_ID="${SERVER_ID:-}"
SKIP_FIREWALL=0
APPLICATION="${APPLICATION:-}"
LOKASI="${LOKASI:-}"

usage() {
  cat <<EOF
Pemakaian: sudo bash $0 [opsi]

  --monitor-ip IP     IP server Grafana/Prometheus (default: 192.168.38.11)
  --server-id NAMA    Label server_id untuk Prometheus (default: hostname)
  --application NAMA  Label aplikasi (opsional)
  --lokasi NAMA       Label lokasi (opsional)
  --skip-firewall     Jangan ubah ufw/firewalld
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --monitor-ip) MONITOR_IP="$2"; shift 2 ;;
    --server-id) SERVER_ID="$2"; shift 2 ;;
    --application) APPLICATION="$2"; shift 2 ;;
    --lokasi) LOKASI="$2"; shift 2 ;;
    --skip-firewall) SKIP_FIREWALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opsi tidak dikenal: $1"; usage; exit 1 ;;
  esac
done

if [[ $(id -u) -ne 0 ]]; then
  echo "Jalankan sebagai root: sudo bash $0"
  exit 1
fi

if [[ -z "$SERVER_ID" ]]; then
  SERVER_ID="$(hostname -s 2>/dev/null || hostname)"
fi

pick_local_ip() {
  hostname -I 2>/dev/null | tr ' ' '\n' | awk '
    $1 ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ &&
    $1 !~ /^127\./ &&
    $1 !~ /^169\.254\./ &&
    $1 !~ /^172\.17\./ { print $1; exit }
  '
}

LOCAL_IP="$(pick_local_ip)"
[[ -n "$LOCAL_IP" ]] || LOCAL_IP="IP_VM_INI"

arch=$(uname -m)
case "$arch" in
  x86_64) ne_arch=linux-amd64; pe_arch=linux-amd64 ;;
  aarch64) ne_arch=linux-arm64; pe_arch=linux-arm64 ;;
  *) echo "Arsitektur tidak didukung: $arch"; exit 1 ;;
esac

for cmd in curl tar; do
  command -v "$cmd" >/dev/null || {
    echo "Perlu $cmd. Install dulu (apt/yum), lalu jalankan skrip lagi."
    exit 1
  }
done

echo "==> Unduh node_exporter ${NODE_VER} dan process-exporter ${PROC_VER}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"

curl -fL --retry 3 -o node.tgz \
  "https://github.com/prometheus/node_exporter/releases/download/v${NODE_VER}/node_exporter-${NODE_VER}.${ne_arch}.tar.gz"
tar -xzf node.tgz
install -m 0755 "node_exporter-${NODE_VER}.${ne_arch}/node_exporter" "$INSTALL_DIR/node_exporter"

curl -fL --retry 3 -o proc.tgz \
  "https://github.com/ncabatoff/process-exporter/releases/download/v${PROC_VER}/process-exporter-${PROC_VER}.${pe_arch}.tar.gz"
tar -xzf proc.tgz
install -m 0755 "process-exporter-${PROC_VER}.${pe_arch}/process-exporter" "$INSTALL_DIR/process-exporter"

id nodeexp >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin nodeexp

TEXTFILE_DIR=/var/lib/node_exporter/textfile
mkdir -p "$TEXTFILE_DIR" /var/lib/lrt-monitoring
chown -R nodeexp:nodeexp /var/lib/node_exporter
chmod 0755 "$TEXTFILE_DIR"

mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.yml" <<'YAML'
process_names:
  - name: "{{.Comm}}"
    cmdline:
      - ".+"
YAML

# Skrip ekspor service aktif (sticky). Disalin dari installer bila tersedia di folder yang sama.
EXPORT_SRC="$(cd "$(dirname "$0")" && pwd)/export-active-services.sh"
if [[ -f "$EXPORT_SRC" ]]; then
  install -m 0755 "$EXPORT_SRC" /usr/local/bin/export-active-services.sh
else
  echo "Peringatan: export-active-services.sh tidak ditemukan di samping installer; unduh manual ke /usr/local/bin/"
fi

cat > /etc/systemd/system/node_exporter.service <<UNIT
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
User=nodeexp
Group=nodeexp
ExecStart=/usr/local/bin/node_exporter --collector.systemd --collector.processes --collector.textfile.directory=${TEXTFILE_DIR} --web.listen-address=:9100
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/lrt-export-services.service <<'UNIT'
[Unit]
Description=LRT export daftar service aktif untuk pantauan
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/export-active-services.sh
UNIT

cat > /etc/systemd/system/lrt-export-services.timer <<'UNIT'
[Unit]
Description=Timer ekspor service aktif LRT (setiap 1 menit)

[Timer]
OnBootSec=30s
OnUnitActiveSec=1min
AccuracySec=15s
Unit=lrt-export-services.service

[Install]
WantedBy=timers.target
UNIT

cat > /etc/systemd/system/process_exporter.service <<'UNIT'
[Unit]
Description=Prometheus Process Exporter
After=network.target

[Service]
User=root
ExecStart=/usr/local/bin/process-exporter --config.path=/etc/process-exporter/config.yml --web.listen-address=:9256
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now node_exporter.service process_exporter.service
if [[ -x /usr/local/bin/export-active-services.sh ]]; then
  systemctl enable --now lrt-export-services.timer
  systemctl start lrt-export-services.service || true
fi

if [[ "$SKIP_FIREWALL" -eq 0 ]]; then
  echo "==> Izinkan scrape dari ${MONITOR_IP} ke port 9100 dan 9256"
  if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow from "$MONITOR_IP" to any port 9100 proto tcp comment 'lrt-node-exporter' || true
    ufw allow from "$MONITOR_IP" to any port 9256 proto tcp comment 'lrt-process-exporter' || true
  elif command -v firewall-cmd >/dev/null && systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-rich-rule="rule family=ipv4 source address=${MONITOR_IP} port port=9100 protocol=tcp accept" || true
    firewall-cmd --permanent --add-rich-rule="rule family=ipv4 source address=${MONITOR_IP} port port=9256 protocol=tcp accept" || true
    firewall-cmd --reload || true
  else
    echo "    Firewall OS tidak diubah. Pastikan ${MONITOR_IP} boleh ke TCP 9100 dan 9256."
  fi
fi

sleep 1
systemctl --no-pager --full status node_exporter.service process_exporter.service | sed -n '1,12p' || true

echo
echo "==== SELESAI di VM ${SERVER_ID} (${LOCAL_IP}) ===="
echo "Cek lokal:  curl -s localhost:9100/metrics | head"
echo "            curl -s localhost:9256/metrics | head"
echo "Service dipantau: curl -s localhost:9100/metrics | grep lrt_service_expected | head"
echo "Daftar sticky:    cat /var/lib/lrt-monitoring/expected-services.list"
echo
echo "Tempel blok ini di server pantauan ${MONITOR_IP}"
echo "  /opt/lrt-monitoring/prometheus/targets/nodes.yml"
echo
cat <<YAML
- targets:
    - ${LOCAL_IP}:9100
  labels:
    server_id: ${SERVER_ID}
    application: ${APPLICATION:-isi-aplikasi}
    lokasi: ${LOKASI:-isi-lokasi}
YAML
echo
echo "Dan di process.yml:"
echo
cat <<YAML
- targets:
    - ${LOCAL_IP}:9256
  labels:
    server_id: ${SERVER_ID}
    application: ${APPLICATION:-isi-aplikasi}
    lokasi: ${LOKASI:-isi-lokasi}
YAML
echo
echo "Di server pantauan, cek http://127.0.0.1:9091/targets (job node & process harus UP)"
echo "Dashboard: http://${MONITOR_IP}:3001"
