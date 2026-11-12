#!/usr/bin/env bash
# Upgrade cepat di VM yang agent-nya sudah terpasang:
# aktifkan textfile collector + ekspor service aktif.
#   sudo bash upgrade-service-watch.sh
set -eu

TEXTFILE_DIR=/var/lib/node_exporter/textfile
mkdir -p "$TEXTFILE_DIR" /var/lib/lrt-monitoring
id nodeexp >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin nodeexp
chown -R nodeexp:nodeexp /var/lib/node_exporter

SRC="$(cd "$(dirname "$0")" && pwd)/export-active-services.sh"
if [[ ! -f "$SRC" ]]; then
  echo "Letakkan export-active-services.sh di folder yang sama, atau:"
  echo "  curl -fsSL http://192.168.38.11:8088/export-active-services.sh -o /usr/local/bin/export-active-services.sh"
  exit 1
fi
install -m 0755 "$SRC" /usr/local/bin/export-active-services.sh

UNIT=/etc/systemd/system/node_exporter.service
if [[ -f "$UNIT" ]] && ! grep -q 'collector.textfile.directory' "$UNIT"; then
  sed -i "s|--web.listen-address=:9100|--collector.textfile.directory=${TEXTFILE_DIR} --web.listen-address=:9100|" "$UNIT"
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
echo "Selesai. Cek: curl -s localhost:9100/metrics | grep lrt_service_expected | head"
