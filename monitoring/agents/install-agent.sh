#!/usr/bin/env bash
# Agen lengkap: node_exporter + process-exporter + Grafana Alloy (log → Loki).
# Default Grafana/Prometheus/Loki: 192.168.38.11
#
#   sudo bash install-agent.sh --monitor-ip 192.168.38.11 --server-id NAMA --application APP --lokasi DC
# Legacy CentOS 6 / glibc lama: tambah --use-promtail
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"

fetch_helpers() {
  local base="http://${MONITOR_IP}:8088"
  local need=0
  for f in install-linux.sh install-alloy.sh install-promtail.sh export-active-services.sh; do
    if [[ ! -f "$DIR/$f" ]]; then
      need=1
      break
    fi
  done
  if [[ "$need" -eq 0 ]]; then
    return
  fi
  DIR=/tmp
  for f in install-linux.sh install-alloy.sh install-promtail.sh export-active-services.sh; do
    echo "==> Unduh $f dari ${base}"
    curl -fsSL "$base/$f" -o "/tmp/$f"
    sed -i 's/\r$//' "/tmp/$f"
  done
}

MONITOR_IP="${MONITOR_IP:-192.168.38.11}"
SERVER_ID="${SERVER_ID:-}"
APPLICATION="${APPLICATION:-}"
LOKASI="${LOKASI:-}"
SKIP_FIREWALL=0
USE_PROMTAIL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --monitor-ip) MONITOR_IP="$2"; shift 2 ;;
    --server-id) SERVER_ID="$2"; shift 2 ;;
    --application) APPLICATION="$2"; shift 2 ;;
    --lokasi) LOKASI="$2"; shift 2 ;;
    --skip-firewall) SKIP_FIREWALL=1; shift ;;
    --use-promtail) USE_PROMTAIL=1; shift ;;
    -h|--help)
      echo "sudo bash $0 --monitor-ip 192.168.38.11 --server-id NAMA [--application APP] [--lokasi DC] [--use-promtail]"
      exit 0
      ;;
    *) echo "Opsi tidak dikenal: $1"; exit 1 ;;
  esac
done

fetch_helpers

linux_args=(--monitor-ip "$MONITOR_IP")
[[ -n "$SERVER_ID" ]] && linux_args+=(--server-id "$SERVER_ID")
[[ -n "$APPLICATION" ]] && linux_args+=(--application "$APPLICATION")
[[ -n "$LOKASI" ]] && linux_args+=(--lokasi "$LOKASI")
[[ "$SKIP_FIREWALL" -eq 1 ]] && linux_args+=(--skip-firewall)

bash "$DIR/install-linux.sh" "${linux_args[@]}"

log_args=(--monitor-ip "$MONITOR_IP")
[[ -n "$SERVER_ID" ]] && log_args+=(--server-id "$SERVER_ID")

if [[ "$USE_PROMTAIL" -eq 1 ]]; then
  echo "==> Memakai Promtail (mode legacy)"
  bash "$DIR/install-promtail.sh" "${log_args[@]}"
else
  echo "==> Memakai Grafana Alloy"
  if ! bash "$DIR/install-alloy.sh" "${log_args[@]}"; then
    echo "!! Alloy gagal dipasang. Coba lagi dengan --use-promtail untuk server legacy."
    exit 1
  fi
fi
