#!/usr/bin/env bash
# Cek di server pantauan: berapa host sudah mengirim lrt_service_expected,
# dan service mana yang sedang tidak aktif.
set -eu
PROM="${PROMETHEUS_URL:-http://127.0.0.1:9091}"

echo "== Host yang sudah kirim daftar service =="
curl -sG "$PROM/api/v1/query" \
  --data-urlencode 'query=count by (server_id) (lrt_service_expected == 1)' \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
rows=d.get("data",{}).get("result",[])
print("jumlah server:", len(rows))
for r in sorted(rows, key=lambda x: x["metric"].get("server_id","")):
    print(" ", r["metric"].get("server_id","-"), "services=", r["value"][1])
'

echo
echo "== Service expected yang sedang TIDAK aktif =="
curl -sG "$PROM/api/v1/query" \
  --data-urlencode 'query=max by (server_id, name, instance) (lrt_service_expected == 1 and on(instance, name) lrt_service_up == 0)' \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
rows=d.get("data",{}).get("result",[])
print("jumlah:", len(rows))
for r in sorted(rows, key=lambda x: (x["metric"].get("server_id",""), x["metric"].get("name",""))):
    m=r["metric"]
    print(" ", m.get("server_id","-"), m.get("name","-"), m.get("instance","-"))
'

echo
echo "== Alert ServiceTidakAktif (firing) =="
curl -sG "$PROM/api/v1/query" \
  --data-urlencode 'query=ALERTS{alertname="ServiceTidakAktif", alertstate="firing"}' \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
rows=d.get("data",{}).get("result",[])
print("firing:", len(rows))
for r in rows:
    m=r["metric"]
    print(" ", m.get("server_id","-"), m.get("name","-"))
'
