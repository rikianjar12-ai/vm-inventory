# Monitoring Data Center LRT Jabodebek

Satu tampilan untuk seluruh server, fisik maupun VM. Halaman utama ada di aplikasi inventory (`/monitoring`) dan di Grafana. Sumber datanya Prometheus.

Ambang yang dipakai kartu Warning dan alert:

| Parameter | Normal | Warning | Critical |
| --- | --- | --- | --- |
| CPU | di bawah 70% | 70–85% | di atas 85% |
| RAM | di bawah 75% | 75–90% | di atas 90% |
| Disk | di bawah 75% | 75–85% | di atas 85% |
| Server | Online | — | Offline |
| Service | berjalan | — | mati |

Alert CPU, RAM, dan disk baru menyala setelah kondisi bertahan **10 menit**.

## 1. Jalankan dashboard

Dari folder `monitoring`:

```powershell
copy .env.example .env
```

Isi `GRAFANA_ADMIN_PASSWORD` di `.env` dengan password yang panjang. Stack tidak mau jalan kalau password itu kosong, dan tidak ada password bawaan.

```powershell
docker compose up -d
```

| Layanan | URL | Jangkauan |
| --- | --- | --- |
| Overview (inventory) | http://192.168.38.11:3000/monitoring | layar ruang Data Center |
| Grafana | http://192.168.38.11:3001 | jaringan server, user `admin`, password dari `.env` |
| Loki | port 3100 | VM yang mengirim log |
| Prometheus | http://127.0.0.1:9091 | hanya di server pantauan |
| Alertmanager | http://127.0.0.1:9093 | hanya di server pantauan |

Dashboard Grafana, berurutan dari ringkasan ke detail:

1. **Data Center Overview** — total server, online, offline, warning, grafik CPU/RAM, tabel kesehatan
2. **Server Detail** — CPU per core, RAM, swap, disk per mount, I/O, trafik, uptime
3. **Aplikasi & Database** — service systemd, probe HTTP/TCP, PostgreSQL setelah exporter dipasang
4. **Jaringan & Infrastruktur** — bandwidth, drop, error interface. SNMP hardware menyusul
5. **Alert & Insiden** — alert aktif dan proses abnormal
6. **Log server** — syslog dan log service

Setelah mengubah `alerts.yml`, muat ulang Prometheus:

```powershell
docker compose restart prometheus
```

Overview di aplikasi inventory membaca Prometheus lewat `PROMETHEUS_URL`. Di server pantauan, container inventory ikut jaringan `lrt-monitoring_default` dan memakai `http://prometheus:9090`. Jalankan stack monitoring ini dulu, baru inventory.

## 2. Pasang agen di setiap VM

Satu perintah memasang metrik dan log (node_exporter, process-exporter, Promtail):

```bash
curl -fsSL http://192.168.38.11:8088/install-agent.sh -o /tmp/install-agent.sh
curl -fsSL http://192.168.38.11:8088/install-linux.sh -o /tmp/install-linux.sh
curl -fsSL http://192.168.38.11:8088/install-promtail.sh -o /tmp/install-promtail.sh
sed -i 's/\r$//' /tmp/install-*.sh
sudo bash /tmp/install-agent.sh --monitor-ip 192.168.38.11 --server-id NAMA-SERVER --application APP --lokasi DC
```

Server pantauan melayani skrip itu lewat `agents/serve-installer.sh` (port **8088**, hanya di IP server pantauan). Hentikan proses itu setelah agen selesai dipasang.

Buka firewall dari host monitoring ke VM: port **9100** (node_exporter) dan **9256** (process_exporter). VM harus bisa mengirim log ke host monitoring port **3100** (Loki).

Windows Server, di PowerShell Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -MonitorIp 192.168.38.11 -ServerId NAMA-SERVER
```

Itu memasang windows_exporter di port **9182**. `windows.yml` terisi otomatis saat sync inventory menemukan OS Windows. Saat ini inventory tidak punya baris Windows, jadi file itu sengaja kosong.

## 3. Daftarkan server

**Hanya daftarkan server yang agent-nya sudah terpasang.** Server tanpa agent akan tampil sebagai DOWN palsu.

File target (`nodes.yml`, dll.) **lokal di server** dan diabaikan Git, supaya `git pull` tidak mengembalikan daftar lama.

- `nodes.yml` — Linux
- `process.yml` — proses (CPU/RAM/zombie)
- `http.yml` — probe HTTP
- `tcp.yml` — health check SSH
- `windows.yml` — Windows (`:9182`)

Lihat `prometheus/targets/README.md`. Sync inventory hanya memasukkan VM dengan `agent_installed=yes`.

Jika Server DOWN muncul lagi setelah `git checkout`, jalankan:

```bash
python3 scripts/prune-down-targets.py --apply
curl -X POST http://127.0.0.1:9091/-/reload
```

Sebelum pull/checkout, backup dulu: `cp -a prometheus/targets /root/lrt-targets.bak`

### Service aktif → alert saat mati → hilang saat UP lagi

Setiap VM mengirim daftar service yang dipantau (`lrt_service_expected`) dan status saat ini (`lrt_service_up`).
Daftar bersifat sticky: service baru yang aktif ditambahkan; yang mati tetap dipantau.

Alur notifikasi (tidak dinonaktifkan):
1. Service tadinya UP (`lrt_service_up=1`) lalu mati → alert **ServiceTidakAktif** FIRING
2. Service UP kembali → kondisi alert hilang → status **RESOLVED**, baris notifikasi hilang otomatis

Agent mengekspor status setiap **1 menit**.

Upgrade VM yang agent-nya sudah ada:

```bash
curl -fsSL http://192.168.38.11:8088/export-active-services.sh -o /tmp/export-active-services.sh
curl -fsSL http://192.168.38.11:8088/upgrade-service-watch.sh -o /tmp/upgrade-service-watch.sh
sed -i 's/\r$//' /tmp/*.sh
sudo bash /tmp/upgrade-service-watch.sh
```

Hapus service dari pantauan (misalnya sengaja dimatikan):

```bash
sudo sed -i '/^NAMA.service$/d' /var/lib/lrt-monitoring/expected-services.list
sudo /usr/local/bin/export-active-services.sh
```

## 4. Notifikasi

Alert yang sudah aktif:

- Server down, CPU/RAM/disk di atas ambang warning atau kritis
- Service systemd failed / probe HTTP-TCP gagal
- Proses CPU > 80%, RAM proses > 35%, zombie, terlalu banyak proses, D-state

Isi penerima di `alertmanager/alertmanager.yml` (contoh Telegram/email: `alertmanager/notifikasi.contoh.yml`), lalu:

```powershell
docker compose restart alertmanager
```

## 5. Inventory app

Menu **Monitoring** membuka Data Center Overview. Set `GRAFANA_URL` dan `PROMETHEUS_URL` di lingkungan aplikasi. `docker-compose.inventory.yml` sudah mengarah ke Grafana `http://192.168.38.11:3001` dan Prometheus `http://prometheus:9090`.

Agent host (hanya Linux yang menjalankan Docker): `docker compose --profile local-agent up -d`.
