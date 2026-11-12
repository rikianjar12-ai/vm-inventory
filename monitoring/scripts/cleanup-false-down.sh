#!/usr/bin/env bash
# Bersihkan target tanpa agent (Server DOWN palsu) dan backup hasilnya.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Backup target =="
cp -a prometheus/targets "/root/lrt-targets.bak.$(date +%Y%m%d-%H%M%S)"
cp -a prometheus/targets /root/lrt-targets.bak

APPLY=0
if [[ "${1:-}" == "--apply" || "${1:-}" == "-y" ]]; then
  APPLY=1
fi

echo "== Dry-run prune =="
python3 scripts/prune-down-targets.py

if [[ "$APPLY" -ne 1 ]]; then
  echo
  echo "Dry-run saja. Jalankan lagi dengan --apply untuk menulis file:"
  echo "  bash scripts/cleanup-false-down.sh --apply"
  exit 0
fi

echo
echo "== Apply prune (sedang DOWN) =="
python3 scripts/prune-down-targets.py --apply

echo "== Hapus yang belum pernah UP (belum agent) =="
python3 scripts/purge-never-up-targets.py --apply

echo "== Hapus probe HTTP/TCP yang gagal dari awal =="
python3 scripts/purge-failed-probes.py --apply

curl -s -X POST http://127.0.0.1:9091/-/reload || true
sleep 5

echo
echo "== Status target setelah prune =="
curl -sG 'http://127.0.0.1:9091/api/v1/targets' | python3 -c '
import sys,json
from collections import Counter
a=json.load(sys.stdin)["data"]["activeTargets"]
print("total", len(a))
print("job", dict(Counter(t["labels"].get("job") for t in a)))
print("up", sum(1 for t in a if t["health"]=="up"), "down", sum(1 for t in a if t["health"]!="up"))
'

echo
echo "== Alert yang masih firing =="
curl -sG 'http://127.0.0.1:9091/api/v1/query' \
  --data-urlencode 'query=ALERTS{alertstate="firing",alertname=~"ServerDown|ServiceDown"}' \
  | python3 -c '
import json,sys
rows=json.load(sys.stdin).get("data",{}).get("result",[])
print("firing:", len(rows))
for r in sorted(rows, key=lambda x: (x["metric"].get("alertname",""), x["metric"].get("server_id",""))):
    m=r["metric"]
    print(" ", m.get("alertname","-"), m.get("server_id","-"), m.get("instance","-"), m.get("application","-"))
'

echo
echo "Selesai. Backup: /root/lrt-targets.bak"
echo "Lanjut di setiap server UP:"
echo "  curl -fsSL http://192.168.38.11:8088/enable-service-watch.sh | sudo bash"
