#!/usr/bin/env bash
# Jalankan di server Grafana 192.168.38.11 agar VM bisa unduh skrip agen.
#   sudo bash /opt/lrt-monitoring/agents/serve-installer.sh
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8088}"
MONITOR_IP="${MONITOR_IP:-192.168.38.11}"
BIND="${BIND:-$MONITOR_IP}"

echo "Melayani ${DIR} di http://${MONITOR_IP}:${PORT}/"
echo "Biarkan jendela ini terbuka. Stop: Ctrl+C"
echo
echo "Di setiap VM (bukan lokasi KCI):"
echo "  curl -fsSL http://${MONITOR_IP}:${PORT}/install-agent.sh -o /tmp/install-agent.sh"
echo "  curl -fsSL http://${MONITOR_IP}:${PORT}/install-linux.sh -o /tmp/install-linux.sh"
echo "  curl -fsSL http://${MONITOR_IP}:${PORT}/install-alloy.sh -o /tmp/install-alloy.sh"
echo "  curl -fsSL http://${MONITOR_IP}:${PORT}/install-promtail.sh -o /tmp/install-promtail.sh"
echo "  curl -fsSL http://${MONITOR_IP}:${PORT}/export-active-services.sh -o /tmp/export-active-services.sh"
echo "  sed -i 's/\\r\$//' /tmp/install-*.sh /tmp/export-active-services.sh"
echo "  sudo bash /tmp/install-agent.sh --monitor-ip ${MONITOR_IP} --server-id NAMA-SERVER"
echo "  # Legacy: tambah --use-promtail jika Alloy tidak jalan"
echo
echo "VM yang agent-nya sudah ada (aktifkan pantauan service berjalan):"
echo "  curl -fsSL http://${MONITOR_IP}:${PORT}/enable-service-watch.sh | sudo bash"
echo
echo "Windows Server (salin install-windows.ps1, lalu di PowerShell Administrator):"
echo "  powershell -ExecutionPolicy Bypass -File .\\install-windows.ps1 -MonitorIp ${MONITOR_IP} -ServerId NAMA-SERVER"
echo

cd "$DIR"
exec python3 -m http.server "$PORT" --bind "$BIND"
