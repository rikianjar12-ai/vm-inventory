# Target Prometheus (lokal)

File `nodes.yml`, `process.yml`, `windows.yml`, `tcp.yml`, dan `http.yml`
**tidak disimpan di GitHub**, supaya `git checkout` / `git pull` tidak
mengembalikan server tanpa agent (yang tampil sebagai DOWN palsu).

`snmp.yml` dan `icmp.yml` ikut repo (default `[]`). Edit lokal untuk perangkat
hardware/ping; lihat `snmp.yml.example` dan `icmp.yml.example`.

## Setup awal

```bash
cd /opt/lrt-monitoring/prometheus/targets
for f in nodes process windows tcp http; do
  [[ -f ${f}.yml ]] || cp ${f}.yml.example ${f}.yml
done
```

Isi hanya IP yang sudah `install-agent`, atau:

```bash
python3 /opt/lrt-monitoring/scripts/prune-down-targets.py --apply
curl -X POST http://127.0.0.1:9091/-/reload
```

## Sebelum git pull / checkout

```bash
cp -a /opt/lrt-monitoring/prometheus/targets /root/lrt-targets.bak
```

Sesudah pull, jika file target hilang:

```bash
cp -a /root/lrt-targets.bak/*.yml /opt/lrt-monitoring/prometheus/targets/
curl -X POST http://127.0.0.1:9091/-/reload
```
