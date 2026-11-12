"""Keluarkan target Prometheus yang statusnya DOWN dari file targets/*.yml.

Jalankan di server monitoring (dekat Prometheus):
  python3 scripts/prune-down-targets.py              # dry-run, hanya tampilkan
  python3 scripts/prune-down-targets.py --apply      # tulis ulang file targets

Env opsional:
  PROMETHEUS_URL=http://127.0.0.1:9091
"""
from __future__ import print_function

import argparse
import json
import os
import re
import sys

try:
    from urllib.parse import urlencode
    from urllib.request import urlopen
except ImportError:
    from urllib import urlencode
    from urllib2 import urlopen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prometheus", "targets"))
PROM = os.environ.get("PROMETHEUS_URL", "http://127.0.0.1:9091").rstrip("/")
TARGET_FILES = ("nodes.yml", "process.yml", "windows.yml", "tcp.yml", "http.yml")
BLOCK_RE = re.compile(r"(?ms)^- targets:.*?(?=^- targets:|\Z)")


def query(expr):
    url = "%s/api/v1/query?%s" % (PROM, urlencode({"query": expr}))
    raw = urlopen(url, timeout=20).read()
    payload = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
    if payload.get("status") != "success":
        raise RuntimeError("Query gagal: %s" % payload)
    return payload["data"]["result"]


def down_keys():
    rows = query('up{job=~"node|windows"} == 0')
    by_server, by_instance = set(), set()
    detail = []
    for item in rows:
        metric = item.get("metric") or {}
        server = (metric.get("server_id") or "").strip()
        instance = (metric.get("instance") or "").strip()
        app = metric.get("application") or "-"
        lokasi = metric.get("lokasi") or "-"
        if server:
            by_server.add(server)
        if instance:
            by_instance.add(instance)
            by_instance.add(instance.split(":")[0])
        detail.append((server or "-", instance or "-", app, lokasi))
    return by_server, by_instance, sorted(detail)


def failed_services():
    rows = query(
        'max by (server_id, name, application, lokasi) '
        '(node_systemd_unit_state{state="failed", name!~"aide.*|aidecheck.*"} == 1)'
    )
    out = []
    for item in rows:
        metric = item.get("metric") or {}
        out.append(
            (
                metric.get("server_id") or "-",
                metric.get("name") or "-",
                metric.get("application") or "-",
                metric.get("lokasi") or "-",
            )
        )
    return sorted(out)


def block_matches(block, servers, instances):
    sid = re.search(r"(?m)^\s*server_id:\s*(.+)$", block)
    target = re.search(r"(?m)^\s*-\s+([^\s]+)$", block)
    server = (sid.group(1).strip().strip("\"'") if sid else "")
    address = (target.group(1).strip() if target else "")
    host = address.split(":")[0] if address else ""
    if server and server in servers:
        return True, server, address
    if address and address in instances:
        return True, server or "-", address
    if host and host in instances:
        return True, server or "-", address
    return False, server or "-", address


def prune_file(path, servers, instances, apply_changes):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    if not text.strip() or text.strip() == "[]":
        return [], text

    header_lines = []
    body = text
    for line in text.splitlines(True):
        if line.startswith("#"):
            header_lines.append(line)
            body = body[len(line) :]
        elif line.strip() == "":
            header_lines.append(line)
            body = body[len(line) :]
        else:
            break

    kept = []
    removed = []
    for match in BLOCK_RE.finditer(body):
        block = match.group(0)
        if not block.strip():
            continue
        hit, server, address = block_matches(block, servers, instances)
        if hit:
            removed.append("%s %s" % (server, address))
        else:
            kept.append(block if block.endswith("\n") else block + "\n")

    header = "".join(header_lines).rstrip() + "\n"
    new_body = "".join(kept) if kept else "[]\n"
    new_text = header + new_body
    if apply_changes and removed:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(new_text)
    return removed, new_text


def main():
    parser = argparse.ArgumentParser(description="Hapus target server DOWN dari file targets/")
    parser.add_argument("--apply", action="store_true", help="Tulis perubahan ke file (default: dry-run)")
    args = parser.parse_args()

    print("Prometheus:", PROM)
    servers, instances, detail = down_keys()
    print("Server DOWN:", len(detail))
    for row in detail:
        print("  - %s\t%s\t%s\t%s" % row)

    print("\nService gagal (bukan aidecheck):")
    failed = failed_services()
    print("Jumlah:", len(failed))
    for row in failed:
        print("  - %s\t%s\t%s\t%s" % row)

    if not servers and not instances:
        print("\nTidak ada target DOWN. File targets tidak diubah.")
        return 0

    print("\n%s file targets di %s" % ("Menulis" if args.apply else "Dry-run", ROOT))
    total = 0
    for name in TARGET_FILES:
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            continue
        removed, _ = prune_file(path, servers, instances, args.apply)
        total += len(removed)
        print("  %s: hapus %s blok" % (name, len(removed)))
        for item in removed:
            print("    -", item)

    if args.apply:
        print("\nSelesai. Total blok dihapus:", total)
        print("Muat ulang Prometheus:")
        print("  curl -X POST http://127.0.0.1:9091/-/reload")
        print("atau: docker-compose exec prometheus kill -HUP 1")
    else:
        print("\nDry-run saja. Jalankan lagi dengan --apply untuk menulis file.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("Gagal:", exc, file=sys.stderr)
        sys.exit(1)
