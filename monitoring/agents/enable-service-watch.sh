#!/usr/bin/env bash
# Aktifkan pantauan "service yang berjalan → alert saat mati" di VM ini.
# Satu perintah (dari VM):
#   curl -fsSL http://192.168.38.11:8088/enable-service-watch.sh | sudo bash
set -eu
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

MONITOR_IP="${MONITOR_IP:-192.168.38.11}"
PORT="${PORT:-8088}"
TEXTFILE_DIR=/var/lib/node_exporter/textfile

if [[ $(id -u) -ne 0 ]]; then
  echo "Jalankan sebagai root: curl -fsSL http://${MONITOR_IP}:${PORT}/enable-service-watch.sh | sudo bash"
  exit 1
fi

if ! systemctl list-unit-files node_exporter.service >/dev/null 2>&1 && [[ ! -x /usr/local/bin/node_exporter ]]; then
  echo "node_exporter belum terpasang. Pasang agent dulu (install-agent.sh)."
  exit 1
fi

mkdir -p "$TEXTFILE_DIR" /var/lib/lrt-monitoring /tmp/lrt-agent
id nodeexp >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin nodeexp
chown -R nodeexp:nodeexp /var/lib/node_exporter

echo "==> Unduh export-active-services.sh dari ${MONITOR_IP}"
curl -fsSL "http://${MONITOR_IP}:${PORT}/export-active-services.sh" -o /tmp/lrt-agent/export-active-services.sh
sed -i 's/\r$//' /tmp/lrt-agent/export-active-services.sh
install -m 0755 /tmp/lrt-agent/export-active-services.sh /usr/local/bin/export-active-services.sh

UNIT=/etc/systemd/system/node_exporter.service
if [[ -f "$UNIT" ]]; then
  if ! grep -q 'collector.textfile.directory' "$UNIT"; then
    echo "==> Aktifkan textfile collector di node_exporter"
    sed -i "s|--web.listen-address=:9100|--collector.textfile.directory=${TEXTFILE_DIR} --web.listen-address=:9100|" "$UNIT"
  fi
else
  echo "Peringatan: unit node_exporter.service tidak ditemukan di /etc/systemd/system"
fi

cat > /etc/systemd/system/lrt-export-services.service <<'EOF'
[Unit]
Description=LRT export daftar service aktif untuk pantauan
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/export-active-services.sh
EOF

cat > /etc/systemd/system/lrt-export-services.timer <<'EOF'
[Unit]
Description=Timer ekspor service aktif LRT (setiap 1 menit)

[Timer]
OnBootSec=30s
OnUnitActiveSec=1min
AccuracySec=15s
Unit=lrt-export-services.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl restart node_exporter.service
systemctl enable --now lrt-export-services.timer
systemctl start lrt-export-services.service

echo
echo "==== SELESAI ===="
echo "Daftar service dipantau:"
wc -l /var/lib/lrt-monitoring/expected-services.list || true
head -n 20 /var/lib/lrt-monitoring/expected-services.list || true
echo
echo "Metrik:"
curl -s localhost:9100/metrics | grep -c '^lrt_service_expected' || true
curl -s localhost:9100/metrics | grep '^lrt_service_expected' | head
