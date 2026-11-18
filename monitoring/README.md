# Monitoring Data Center LRT Jabodebek

Stack Observability sesuai PPT: **Grafana • Prometheus • Loki • Alloy • Alerting • Blackbox • SNMP**.

Ambang alert (standar PPT):

| Parameter | High | Critical | Durasi |
| --- | --- | --- | --- |
| Server down | — | Offline | 2 menit |
| CPU | di atas 85% | — | 10 menit |
| RAM | di atas 90% | — | 10 menit |
| Disk | di atas 85% | di atas 95% | 5 menit |
| Service gagal | — | mati | 2 menit |

Dashboard Grafana:

1. **01 Executive Overview**
2. **02 Infrastructure Health** (bandwidth, SNMP, ICMP)
3. **03 Server Deep Dive**
4. **04 Centralized Logs** (Alloy → Loki)
5. **05 Service Availability**
6. **06 Incident Monitoring**

---

## Perintah go-live (server pantauan 192.168.38.11)

Jalankan di folder repo `monitoring` (Linux/PowerShell sesuai OS server).

### A. Update kode & naikkan stack

```bash
cd /path/ke/vm_inventory
git pull origin master
cd monitoring
cp -n .env.example .env   # sekali saja; lalu edit password + Telegram/email
```

PowerShell:

```powershell
cd "C:\path\ke\vm_inventory"
git pull origin master
cd monitoring
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Isi minimal di `.env`:

- `GRAFANA_ADMIN_PASSWORD` (wajib)
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (opsional tapi disarankan)
- `ALERT_EMAIL` + `SMTP_*` (opsional)

Render notifikasi lalu jalankan seluruh stack:

```bash
node scripts/render-alertmanager.mjs
docker compose up -d
docker compose ps
```

PowerShell:

```powershell
node .\scripts\render-alertmanager.mjs
docker compose up -d
docker compose ps
```

| Layanan | URL |
| --- | --- |
| Grafana | http://192.168.38.11:3001 |
| Inventory overview | http://192.168.38.11:3000/monitoring |
| Uptime Kuma | http://192.168.38.11:3002 |
| Loki | :3100 (dari VM) |
| Prometheus | http://127.0.0.1:9091 |
| Alertmanager | http://127.0.0.1:9093 |

Muat ulang setelah ubah alert/target:

```bash
docker compose restart prometheus alertmanager grafana blackbox-exporter snmp-exporter
# atau hot-reload Prometheus:
curl -X POST http://127.0.0.1:9091/-/reload
```

### B. Layani skrip agen (port 8088)

```bash
sudo bash agents/serve-installer.sh
```

### C. Pasang agen di setiap VM Linux

```bash
curl -fsSL http://192.168.38.11:8088/install-agent.sh -o /tmp/install-agent.sh
curl -fsSL http://192.168.38.11:8088/install-linux.sh -o /tmp/install-linux.sh
curl -fsSL http://192.168.38.11:8088/install-alloy.sh -o /tmp/install-alloy.sh
curl -fsSL http://192.168.38.11:8088/export-active-services.sh -o /tmp/export-active-services.sh
sed -i 's/\r$//' /tmp/*.sh
sudo bash /tmp/install-agent.sh --monitor-ip 192.168.38.11 --server-id NAMA-SERVER --application APP --lokasi DC
```

Server legacy (Alloy gagal): tambah `--use-promtail`.

Migrasi VM yang masih Promtail → Alloy:

```bash
curl -fsSL http://192.168.38.11:8088/install-alloy.sh -o /tmp/install-alloy.sh
sed -i 's/\r$//' /tmp/install-alloy.sh
sudo bash /tmp/install-alloy.sh --monitor-ip 192.168.38.11 --server-id NAMA-SERVER
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -MonitorIp 192.168.38.11 -ServerId NAMA-SERVER
```

Firewall: monitoring → VM **9100** / **9256** / **9182**; VM → monitoring **3100**.

### D. Target Prometheus

Salin contoh jika file lokal belum ada, lalu edit IP:

```bash
cp -n prometheus/targets/nodes.yml.example prometheus/targets/nodes.yml
cp -n prometheus/targets/process.yml.example prometheus/targets/process.yml
cp -n prometheus/targets/http.yml.example prometheus/targets/http.yml
cp -n prometheus/targets/tcp.yml.example prometheus/targets/tcp.yml
cp -n prometheus/targets/windows.yml.example prometheus/targets/windows.yml
cp -n prometheus/targets/snmp.yml.example prometheus/targets/snmp.yml   # hardware/switch
cp -n prometheus/targets/icmp.yml.example prometheus/targets/icmp.yml   # ping
curl -X POST http://127.0.0.1:9091/-/reload
```

`nodes.yml` / `http.yml` / dll. diabaikan Git (lokal server). `snmp.yml` & `icmp.yml` bisa di-commit berisi `[]` kosong.

### E. Notifikasi Telegram / email

1. Isi token di `.env`
2. `node scripts/render-alertmanager.mjs`
3. `docker compose restart alertmanager`

Contoh format ada di `alertmanager/notifikasi.contoh.yml`.

### F. Agent di host Docker sendiri (opsional)

```bash
docker compose --profile local-agent up -d
```

---

## Ringkasan arsitektur

```
Linux/Windows VM → node/windows exporter + process-exporter → Prometheus
                 → Grafana Alloy → Loki
Blackbox (HTTP/TCP/ICMP) + SNMP exporter → Prometheus
Prometheus + Loki → Grafana (6 dashboard)
Prometheus → Alertmanager → Telegram / email
```

## Catatan

- Hanya daftarkan server yang agent-nya sudah terpasang (hindari Server DOWN palsu).
- Setelah ubah `alerts.yml`: `docker compose restart prometheus`
- Backup target sebelum `git checkout`: `cp -a prometheus/targets /root/lrt-targets.bak`
