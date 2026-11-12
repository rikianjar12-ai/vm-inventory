"""Isi prometheus/targets dari DB inventory. Lokasi KCI dilewati."""
from __future__ import print_function

import json
import os
import re
import sys

try:
    import psycopg2
except ImportError:
    print("Instal driver PostgreSQL dulu:")
    print("  python -m pip install psycopg2-binary")
    sys.exit(1)

EXCLUDE = os.environ.get("EXCLUDE_LOKASI", "kci").lower()
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prometheus", "targets"))
DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/vm_inventory",
)


def yaml_scalar(value):
    text = ("" if value is None else str(value)).strip() or "-"
    if re.match(r"^[A-Za-z0-9_.:/@+-]+$", text):
        return text
    return json.dumps(text)


def parse_data(raw):
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return {}
    return {k: "" if v is None else str(v) for k, v in raw.items()}


def is_ipv4(ip):
    return bool(re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", ip or ""))


def is_windows(data):
    blob = "%s %s" % (data.get("os") or "", data.get("os_version") or "")
    return bool(re.search(r"windows|win32|microsoft windows", blob, re.I))


def has_agent(data):
    """Hanya pantau VM yang agent-nya sudah dipasang (hindari Server DOWN palsu)."""
    for key in (
        "agent_installed",
        "monitoring_agent",
        "monitor_agent",
        "agent_status",
        "monitoring",
    ):
        value = (data.get(key) or "").strip().lower()
        if value in ("1", "true", "yes", "y", "installed", "ok", "up", "aktif", "active"):
            return True
    return False


def infer_http(data, ip):
    for key in ("http_url", "health_url", "url", "service_url", "web_url"):
        raw = (data.get(key) or "").strip()
        if raw.lower().startswith("http://") or raw.lower().startswith("https://"):
            return [(raw, "http", "http_2xx")]
    app = (data.get("application") or "").lower()
    blob = "%s %s" % (app, (data.get("server_id") or "").lower())
    if not app or app == "-":
        return []
    if "grafana" in blob:
        port = "3001" if ip == "192.168.38.11" else "3000"
        return [("http://%s:%s/api/health" % (ip, port), "grafana", "http_2xx")]
    if (
        app.startswith("db")
        or "proxmox" in blob
        or "bindplane" in blob
        or "backup" in blob
        or "registry" in blob
        or "nats" in blob
        or re.search(r"(^|-)ntp($|-)", app)
    ):
        return []
    if "jenkins" in blob and "agent" not in blob:
        return [("http://%s:8080/" % ip, "jenkins", "http_any")]
    if "graylog" in blob:
        return [("http://%s:9000/" % ip, "graylog", "http_any")]
    if "sonar" in blob:
        return [("http://%s:9000/" % ip, "sonarqube", "http_any")]
    if "zabbix" in blob or "zabix" in blob:
        return [("http://%s/" % ip, "zabbix", "http_any")]
    if re.search(r"web|portal|survey|dashboard|virtualtour|pengaduan|peta|frontend|-fe\b|^fe[-_]", blob):
        return [("http://%s/" % ip, "http", "http_any")]
    return []


def http_block(url, data, service, module):
    return (
        "- targets:\n"
        "    - {url}\n"
        "  labels:\n"
        "    server_id: {sid}\n"
        "    application: {app}\n"
        "    lokasi: {lok}\n"
        "    service: {svc}\n"
        "    module: {mod}\n"
        "\n"
    ).format(
        url=url,
        sid=yaml_scalar(data.get("server_id")),
        app=yaml_scalar(data.get("application")),
        lok=yaml_scalar(data.get("lokasi_server")),
        svc=yaml_scalar(service),
        mod=module,
    )


def block(ip, port, data):
    return (
        "- targets:\n"
        "    - {ip}:{port}\n"
        "  labels:\n"
        "    server_id: {sid}\n"
        "    application: {app}\n"
        "    lokasi: {lok}\n"
        "\n"
    ).format(
        ip=ip,
        port=port,
        sid=yaml_scalar(data.get("server_id")),
        app=yaml_scalar(data.get("application")),
        lok=yaml_scalar(data.get("lokasi_server")),
    )


def write_file(name, header, body):
    path = os.path.join(ROOT, name)
    text = header + "\n" + (body if body.strip() else "[]\n")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def main():
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute("SELECT id, data FROM vm_records ORDER BY id")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    linux, process, windows, tcp, http = [], [], [], [], []
    skipped, included = [], []

    for row_id, raw in rows:
        data = parse_data(raw)
        ip = (data.get("ip") or "").strip()
        lokasi = data.get("lokasi_server") or ""
        name = data.get("server_id") or ("id-%s" % row_id)
        if EXCLUDE in lokasi.lower():
            skipped.append("%s %s lokasi=%s (KCI)" % (name, ip, lokasi))
            continue
        if not is_ipv4(ip):
            skipped.append("%s IP tidak valid: %s" % (name, ip or "(kosong)"))
            continue
        if not has_agent(data):
            skipped.append(
                "%s %s belum ada agent (isi agent_installed=yes di inventory)"
                % (name, ip)
            )
            continue
        included.append("%s %s %s" % (name, ip, lokasi or "-"))
        for url, service, module in infer_http(data, ip):
            http.append(http_block(url, data, service, module))
        if is_windows(data):
            windows.append(block(ip, 9182, data))
        else:
            linux.append(block(ip, 9100, data))
            process.append(block(ip, 9256, data))
            tcp.append(
                "- targets:\n    - %s:22\n  labels:\n    server_id: %s\n    service: ssh\n\n"
                % (ip, yaml_scalar(data.get("server_id")))
            )

    if not os.path.isdir(ROOT):
        os.makedirs(ROOT)
    write_file("nodes.yml", "# Linux node_exporter — lokasi KCI dilewati", "".join(linux))
    write_file("process.yml", "# process-exporter", "".join(process))
    write_file("windows.yml", "# windows_exporter :9182", "".join(windows))
    write_file("tcp.yml", "# Probe SSH", "".join(tcp))
    write_file(
        "http.yml",
        "# Probe HTTP dari inventory. Isi kolom http_url untuk URL pasti; selain itu diambil dari nama aplikasi web.",
        "".join(http),
    )

    print("Ditulis ke", ROOT)
    print("Dipantau (bukan KCI):", len(included))
    for line in included:
        print("  +", line)
    print("Dilewati:", len(skipped))
    for line in skipped:
        print("  -", line)


if __name__ == "__main__":
    main()
