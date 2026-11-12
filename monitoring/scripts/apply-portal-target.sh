#!/usr/bin/env bash
# Jalankan di server Grafana 192.168.38.22:
#   sudo bash apply-portal-target.sh
set -eu
ROOT="${ROOT:-/opt/lrt-monitoring}"
VM_IP="${VM_IP:-192.168.64.27}"
SERVER_ID="${SERVER_ID:-vm-db-portal-layanan-lrt-prd-dcd}"
APP="${APP:-Portal Layanan}"
LOKASI="${LOKASI:-DC}"

if [[ ! -d "$ROOT/prometheus/targets" ]]; then
  echo "Folder $ROOT tidak ditemukan. Clone repo dulu ke /opt/lrt-monitoring"
  exit 1
fi

mkdir -p "$ROOT/prometheus/targets"

cat > "$ROOT/prometheus/targets/nodes.yml" <<EOF
- targets:
    - ${VM_IP}:9100
  labels:
    server_id: ${SERVER_ID}
    application: ${APP}
    lokasi: ${LOKASI}
EOF

cat > "$ROOT/prometheus/targets/process.yml" <<EOF
- targets:
    - ${VM_IP}:9256
  labels:
    server_id: ${SERVER_ID}
    application: ${APP}
    lokasi: ${LOKASI}
EOF

cat > "$ROOT/prometheus/targets/http.yml" <<'EOF'
[]
EOF

cat > "$ROOT/prometheus/targets/tcp.yml" <<EOF
- targets:
    - ${VM_IP}:22
  labels:
    server_id: ${SERVER_ID}
    service: ssh
EOF

echo "==> File target:"
cat "$ROOT/prometheus/targets/nodes.yml"

cd "$ROOT"
if command -v docker >/dev/null; then
  docker compose up -d
  docker compose restart prometheus || true
  echo
  echo "==> Container:"
  docker compose ps
else
  echo "docker tidak ada di PATH"
fi

echo
echo "==> Tes scrape ke VM ${VM_IP}"
code9100=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://${VM_IP}:9100/metrics" || true)
code9256=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://${VM_IP}:9256/metrics" || true)
echo "  :9100 HTTP ${code9100}  (harus 200)"
echo "  :9256 HTTP ${code9256}  (harus 200)"

if [[ "$code9100" != "200" || "$code9256" != "200" ]]; then
  echo
  echo "GAGAL: 192.168.38.22 belum bisa ke ${VM_IP} port 9100/9256."
  echo "Buka firewall/security group: sumber 192.168.38.22, tujuan ${VM_IP} TCP 9100 dan 9256."
  echo "Di VM, cek: systemctl status node_exporter process_exporter"
  exit 2
fi

echo
echo "OK. Buka:"
echo "  http://192.168.38.22:9090/targets"
echo "  http://192.168.38.22:3001"
echo "Filter Server: ${SERVER_ID}"
