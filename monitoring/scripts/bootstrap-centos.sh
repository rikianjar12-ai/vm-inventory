#!/usr/bin/env bash
# Bootstrap stack Grafana di CentOS (192.168.38.11).
#   sudo bash bootstrap-centos.sh
set -eu

if [[ $(id -u) -ne 0 ]]; then
  echo "Jalankan: sudo bash $0"
  exit 1
fi

if command -v dnf >/dev/null 2>&1; then
  PKG=dnf
else
  PKG=yum
fi

echo "==> Paket dasar"
$PKG install -y git curl python3 unzip wget

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Install Docker"
  $PKG install -y yum-utils
  yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || true
  $PKG install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin \
    || $PKG install -y docker docker-compose
fi

systemctl enable --now docker

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Mengunduh docker-compose..."
  curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  COMPOSE="docker-compose"
fi

echo "==> Firewalld: Grafana 3001, Loki 3100, skrip agen 8088"
echo "    Prometheus (9091) dan Alertmanager (9093) hanya di localhost, tidak dibuka."
if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-port=3001/tcp
  firewall-cmd --permanent --remove-port=9091/tcp || true
  firewall-cmd --permanent --add-port=3100/tcp
  firewall-cmd --permanent --add-port=8088/tcp
  firewall-cmd --reload
  firewall-cmd --list-ports
else
  echo "firewalld tidak aktif. Buka port 3001, 3100, 8088 di security group. Jangan buka 9091."
fi

echo
echo "Docker: $(docker --version)"
echo "Compose: $COMPOSE"
echo "Lanjut: cd /opt/lrt-monitoring && $COMPOSE up -d"
