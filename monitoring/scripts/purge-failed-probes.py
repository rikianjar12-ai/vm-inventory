"""Hapus target blackbox HTTP/TCP yang gagal probe dan belum pernah sukses.

Jalankan di server monitoring:
  python3 scripts/purge-failed-probes.py
  python3 scripts/purge-failed-probes.py --apply
  curl -X POST http://127.0.0.1:9091/-/reload
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
TARGET_FILES = ("http.yml", "tcp.yml")
BLOCK_RE = re.compile(r"(?ms)^- targets:.*?(?=^- targets:|\Z)")


def query(expr):
    url = "%s/api/v1/query?%s" % (PROM, urlencode({"query": expr}))
    raw = urlopen(url, timeout=30).read()
    payload = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
    if payload.get("status") != "success":
        raise RuntimeError("Query gagal: %s" % payload)
    return payload["data"]["result"]


def failing_keys():
    rows = query(
        "(probe_success == 0) unless on (instance, server_id, job) "
        "(max_over_time(probe_success[2d]) == 1)"
    )
    servers, instances, detail = set(), set(), []
    for item in rows:
        metric = item.get("metric") or {}
        server = (metric.get("server_id") or "").strip()
        instance = (metric.get("instance") or "").strip()
        if server:
            servers.add(server)
        if instance:
            instances.add(instance)
            # juga cocokkan host tanpa skema/path
            host = instance.replace("http://", "").replace("https://", "").split("/")[0]
            instances.add(host)
            instances.add(host.split(":")[0])
        detail.append(
            (
                server or "-",
                instance or "-",
                metric.get("application") or "-",
                metric.get("job") or "-",
            )
        )
    return servers, instances, sorted(set(detail))


def block_matches(block, servers, instances):
    sid = re.search(r"(?m)^\s*server_id:\s*(.+)$", block)
    target = re.search(r"(?m)^\s*-\s+([^\s]+)$", block)
    server = sid.group(1).strip().strip("\"'") if sid else ""
    address = target.group(1).strip() if target else ""
    host = address.replace("http://", "").replace("https://", "").split("/")[0]
    bare = host.split(":")[0]
    if server and server in servers:
        return True, server, address
    if address and address in instances:
        return True, server or "-", address
    if host and host in instances:
        return True, server or "-", address
    if bare and bare in instances:
        return True, server or "-", address
    return False, server or "-", address


def prune_file(path, servers, instances, apply_changes):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    if not text.strip() or text.strip() == "[]":
        return []

    header_lines, body = [], text
    for line in text.splitlines(True):
        if line.startswith("#") or line.strip() == "":
            header_lines.append(line)
            body = body[len(line) :]
        else:
            break

    kept, removed = [], []
    for match in BLOCK_RE.finditer(body):
        block = match.group(0)
        if not block.strip():
            continue
        hit, server, address = block_matches(block, servers, instances)
        if hit:
            removed.append("%s %s" % (server, address))
        else:
            kept.append(block if block.endswith("\n") else block + "\n")

    if apply_changes and removed:
        header = "".join(header_lines).rstrip() + "\n"
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(header + ("".join(kept) if kept else "[]\n"))
    return removed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--empty-all",
        action="store_true",
        help="Kosongkan http.yml dan tcp.yml sepenuhnya (reset probe)",
    )
    args = parser.parse_args()

    if args.empty_all:
        for name in TARGET_FILES:
            path = os.path.join(ROOT, name)
            header = "# Probe dikosongkan — isi lagi setelah service siap\n"
            if args.apply:
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write(header + "[]\n")
                print("Dikosongkan:", path)
            else:
                print("Dry-run kosongkan:", path)
        if not args.apply:
            print("Jalankan dengan --empty-all --apply untuk menulis.")
        return 0

    print("Prometheus:", PROM)
    servers, instances, detail = failing_keys()
    print("Probe gagal & belum pernah sukses:", len(detail))
    for row in detail:
        print("  - %s\t%s\t%s\t%s" % row)

    if not detail:
        print("Tidak ada yang perlu dihapus.")
        return 0

    print("\n%s" % ("Menulis" if args.apply else "Dry-run"))
    total = 0
    for name in TARGET_FILES:
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            continue
        removed = prune_file(path, servers, instances, args.apply)
        total += len(removed)
        print("  %s: hapus %s" % (name, len(removed)))
        for item in removed:
            print("    -", item)

    if args.apply:
        print("Total dihapus:", total)
        print("curl -X POST http://127.0.0.1:9091/-/reload")
    else:
        print("Jalankan dengan --apply untuk menulis.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("Gagal:", exc, file=sys.stderr)
        sys.exit(1)
