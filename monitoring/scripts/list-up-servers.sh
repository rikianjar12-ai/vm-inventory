#!/usr/bin/env bash
# Tampilkan server UP (punya agent) yang perlu dijalankan enable-service-watch.
set -eu
PROM="${PROMETHEUS_URL:-http://127.0.0.1:9091}"

curl -sG "$PROM/api/v1/query" \
  --data-urlencode 'query=up{job="node"} == 1' \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
rows=d.get("data",{}).get("result",[])
print("Server UP:", len(rows))
print("IP\tserver_id\tapplication\tlokasi")
for r in sorted(rows, key=lambda x: x["metric"].get("server_id","")):
    m=r["metric"]
    inst=m.get("instance","")
    ip=inst.split(":")[0]
    print("%s\t%s\t%s\t%s" % (ip, m.get("server_id","-"), m.get("application","-"), m.get("lokasi","-")))
'
echo
echo "Di setiap server di atas, jalankan:"
echo "  curl -fsSL http://192.168.38.11:8088/enable-service-watch.sh | sudo bash"
