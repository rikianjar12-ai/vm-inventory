"""Bangun dashboard Grafana Data Center LRT. Jalankan dari root repo."""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "grafana" / "dashboards"
PROM = {"type": "prometheus", "uid": "prometheus"}
DS = {"type": "prometheus", "uid": "prometheus"}

NAV = [
    ("lrt-server-health", "data-center-overview", "Overview"),
    ("lrt-server-detail", "server-detail", "Server Detail"),
    ("lrt-app-db", "aplikasi-database", "Aplikasi & Database"),
    ("lrt-network", "jaringan", "Jaringan"),
    ("lrt-alerts", "alert-insiden", "Alert"),
    ("lrt-server-logs", "log-server", "Log"),
]


def links(current):
    return [
        {
            "asDropdown": False,
            "icon": "dashboard",
            "includeVars": True,
            "keepTime": True,
            "targetBlank": False,
            "title": title,
            "type": "link",
            "url": f"/d/{uid}/{slug}",
        }
        for uid, slug, title in NAV
        if uid != current
    ]


def server_var(include_all=True, multi=True):
    var = {
        "datasource": DS,
        "definition": 'label_values(up{job=~"node|windows"}, server_id)',
        "hide": 0,
        "includeAll": include_all,
        "label": "Server",
        "multi": multi,
        "name": "server",
        "options": [],
        "query": {
            "qryType": 1,
            "query": 'label_values(up{job=~"node|windows"}, server_id)',
            "refId": "PrometheusVariableQueryEditor-VariableQuery",
        },
        "refresh": 2,
        "regex": "",
        "skipUrlSync": False,
        "sort": 1,
        "type": "query",
    }
    if include_all:
        var["allValue"] = ".*"
        var["current"] = {"selected": True, "text": "All", "value": "$__all"}
    return var


def target(expr, ref="A", legend="", instant=False, fmt="time_series"):
    item = {
        "datasource": DS,
        "editorMode": "code",
        "expr": expr,
        "legendFormat": legend,
        "refId": ref,
    }
    if instant:
        item["instant"] = True
        item["format"] = fmt
    return item


def stat(title, expr, x, y, w, h, color, unit="short"):
    return {
        "type": "stat",
        "title": title,
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "targets": [target(expr, legend=title, instant=True)],
        "fieldConfig": {
            "defaults": {
                "displayName": title,
                "color": {"mode": "fixed", "fixedColor": color},
                "mappings": [],
                "thresholds": {"mode": "absolute", "steps": [{"color": color, "value": None}]},
                "unit": unit,
            },
            "overrides": [],
        },
        "options": {
            "colorMode": "value",
            "graphMode": "none",
            "justifyMode": "center",
            "orientation": "auto",
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "textMode": "value",
        },
        "pluginVersion": "11.2.2",
    }


def row(title, y):
    return {
        "type": "row",
        "title": title,
        "collapsed": False,
        "gridPos": {"h": 1, "w": 24, "x": 0, "y": y},
        "panels": [],
    }


def timeseries(title, targets, x, y, w, h, unit="percent", description="", max_value=100):
    defaults = {
        "color": {"mode": "palette-classic"},
        "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "fillOpacity": 16,
            "lineWidth": 2,
            "showPoints": "never",
            "spanNulls": True,
            "thresholdsStyle": {"mode": "off"},
        },
        "unit": unit,
        "min": 0,
    }
    if max_value is not None:
        defaults["max"] = max_value
    return {
        "type": "timeseries",
        "title": title,
        "description": description,
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "targets": targets,
        "fieldConfig": {"defaults": defaults, "overrides": []},
        "options": {
            "legend": {"displayMode": "list", "placement": "bottom", "calcs": []},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "pluginVersion": "11.2.2",
    }


def table(title, targets, x, y, w, h, transformations, description=""):
    return {
        "type": "table",
        "title": title,
        "description": description,
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "targets": targets,
        "transformations": transformations,
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "custom": {"align": "auto", "cellOptions": {"type": "auto"}, "inspect": False},
                "thresholds": {"mode": "absolute", "steps": [{"color": "text", "value": None}]},
            },
            "overrides": [],
        },
        "options": {
            "cellHeight": "sm",
            "footer": {"show": False},
            "showHeader": True,
        },
        "pluginVersion": "11.2.2",
    }


def text(title, content, x, y, w, h):
    return {
        "type": "text",
        "title": title,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "options": {"mode": "markdown", "content": content},
        "pluginVersion": "11.2.2",
    }


def organize(rename, index, exclude=None):
    return [
        {"id": "merge", "options": {}},
        {
            "id": "organize",
            "options": {
                "excludeByName": exclude
                or {
                    "Time": True,
                    "__name__": True,
                    "job": True,
                    "host": True,
                    "monitor": True,
                    "datacenter": True,
                },
                "indexByName": index,
                "renameByName": rename,
            },
        },
    ]


S = 'server_id=~"$server"'
FS = 'fstype!~"tmpfs|overlay|squashfs|devtmpfs",mountpoint!~"/boot|/boot/efi"'
CPU = (
    f'max by (instance, server_id, application, lokasi) ('
    f'(100 * (1 - avg by (instance, server_id, application, lokasi) (rate(node_cpu_seconds_total{{mode="idle",{S}}}[5m]))))'
    f' or (100 * (1 - avg by (instance, server_id, application, lokasi) (rate(windows_cpu_time_total{{mode="idle",{S}}}[5m]))))'
    f")"
)
RAM = (
    f"max by (instance, server_id, application, lokasi) ("
    f"(100 * (1 - node_memory_MemAvailable_bytes{{{S}}} / node_memory_MemTotal_bytes{{{S}}}))"
    f" or (100 * (1 - windows_memory_available_bytes{{{S}}} / windows_cs_physical_memory_bytes{{{S}}}))"
    f")"
)
DISK = (
    f"max by (instance, server_id, application, lokasi) ("
    f'(100 - (100 * node_filesystem_avail_bytes{{{FS},{S}}} / node_filesystem_size_bytes{{{FS},{S}}}))'
    f' or (100 - (100 * windows_logical_disk_free_bytes{{volume=~"[A-Z]:",{S}}} / windows_logical_disk_size_bytes{{volume=~"[A-Z]:",{S}}}))'
    f")"
)
CPU_AVG = (
    "avg((100 * (1 - avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\",job=\"node\"}[5m]))))"
    " or (100 * (1 - avg by (instance) (rate(windows_cpu_time_total{mode=\"idle\",job=\"windows\"}[5m])))))"
)
RAM_AVG = (
    "avg((100 * (1 - node_memory_MemAvailable_bytes{job=\"node\"} / node_memory_MemTotal_bytes{job=\"node\"}))"
    " or (100 * (1 - windows_memory_available_bytes{job=\"windows\"} / windows_cs_physical_memory_bytes{job=\"windows\"})))"
)
WARN = """
(
  count(
    (
      (max by (instance) (100 * (1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="node"}[5m]))) > 70))
      or
      (max by (instance) (100 * (1 - node_memory_MemAvailable_bytes{job="node"} / node_memory_MemTotal_bytes{job="node"}) > 75))
      or
      (max by (instance) (100 - (100 * node_filesystem_avail_bytes{job="node",FS} / node_filesystem_size_bytes{job="node",FS}) > 75))
    )
    and on (instance) (up{job="node"} == 1)
  )
  or vector(0)
)
+
(
  count(
    (
      (max by (instance) (100 * (1 - avg by (instance) (rate(windows_cpu_time_total{mode="idle",job="windows"}[5m]))) > 70))
      or
      (max by (instance) (100 * (1 - windows_memory_available_bytes{job="windows"} / windows_cs_physical_memory_bytes{job="windows"}) > 75))
      or
      (max by (instance) (100 - (100 * windows_logical_disk_free_bytes{job="windows",volume=~"[A-Z]:"} / windows_logical_disk_size_bytes{job="windows",volume=~"[A-Z]:"}) > 75))
    )
    and on (instance) (up{job="windows"} == 1)
  )
  or vector(0)
)
""".replace("FS", FS).replace("\n", " ")


def dash(title, uid, description, panels, variable=None, tags=None):
    body = {
        "annotations": {"list": []},
        "description": description,
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "id": None,
        "links": links(uid),
        "liveNow": True,
        "panels": [],
        "refresh": "30s",
        "schemaVersion": 39,
        "tags": tags or ["lrt", "datacenter"],
        "time": {"from": "now-6h", "to": "now"},
        "timezone": "Asia/Jakarta",
        "title": title,
        "uid": uid,
        "weekStart": "monday",
    }
    if variable:
        body["templating"] = {"list": [variable]}
    n = 1
    for panel in panels:
        panel["id"] = n
        n += 1
        body["panels"].append(panel)
    return body


def write(name, body):
    path = OUT / name
    path.write_text(json.dumps(body, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(path.name, len(body["panels"]))


def overview():
    health = table(
        "Server Health Status",
        [
            target(f'up{{job=~"node|windows",{S}}}', "A", instant=True, fmt="table"),
            target(CPU, "C", instant=True, fmt="table"),
            target(RAM, "B", instant=True, fmt="table"),
            target(DISK, "D", instant=True, fmt="table"),
        ],
        0,
        13,
        24,
        12,
        organize(
            {
                "server_id": "Server",
                "application": "Aplikasi",
                "lokasi": "Lokasi",
                "instance": "Instance",
                "Value #A": "UP",
                "Value #C": "CPU %",
                "Value #B": "RAM %",
                "Value #D": "Disk %",
            },
            {
                "Server": 0,
                "Aplikasi": 1,
                "Lokasi": 2,
                "Instance": 3,
                "UP": 4,
                "CPU %": 5,
                "RAM %": 6,
                "Disk %": 7,
            },
        ),
        "UP=1 online. Warning: CPU ≥ 70, RAM ≥ 75, disk ≥ 75. Kritis: CPU > 85, RAM > 90, disk > 85.",
    )
    return dash(
        "Data Center Overview",
        "lrt-server-health",
        "Halaman utama ruang Data Center: total server, online/offline, warning, rata-rata CPU/RAM, dan kesehatan tiap server.",
        [
            row("Ringkasan", 0),
            stat('count(up{job=~"node|windows"}) or vector(0)', "Total Server", 0, 1, 6, 4, "text"),
            stat('count(up{job=~"node|windows"} == 1) or vector(0)', "Online", 6, 1, 6, 4, "green"),
            stat('count(up{job=~"node|windows"} == 0) or vector(0)', "Offline", 12, 1, 6, 4, "red"),
            stat(WARN, "Warning", 18, 1, 6, 4, "yellow"),
            row("Utilisasi", 5),
            timeseries(
                "CPU Utilization",
                [target(CPU_AVG, legend="Rata-rata")],
                0,
                6,
                12,
                7,
                description="Rata-rata CPU server yang sedang mengirim metrik. Garis acuan operasional: 70% dan 85%.",
            ),
            timeseries(
                "Memory Utilization",
                [target(RAM_AVG, legend="Rata-rata")],
                12,
                6,
                12,
                7,
                description="Rata-rata RAM. Garis acuan operasional: 75% dan 90%.",
            ),
            row("Kesehatan server", 13),
            health,
        ],
        server_var(),
        ["lrt", "overview"],
    )


def fix_stat_order(panel):
    """stat() saat ini menerima (title, expr) tapi pemanggilan di overview terbalik. Diperbaiki di builder."""
    return panel


def server_detail():
    return dash(
        "Server Detail",
        "lrt-server-detail",
        "CPU per core, RAM, swap, disk per mount, I/O, trafik jaringan, dan uptime satu server.",
        [
            row("Kondisi server", 0),
            stat(
                "Uptime",
                f'(time() - node_boot_time_seconds{{{S}}}) or (time() - windows_system_system_up_time{{{S}}})',
                0, 1, 4, 4, "text", "s",
            ),
            stat("CPU", CPU, 4, 1, 4, 4, "blue", "percent"),
            stat("RAM", RAM, 8, 1, 4, 4, "purple", "percent"),
            stat(
                "Swap",
                f'(node_memory_SwapTotal_bytes{{{S}}} > 0) * (100 * (1 - node_memory_SwapFree_bytes{{{S}}} / node_memory_SwapTotal_bytes{{{S}}}))',
                12, 1, 4, 4, "orange", "percent",
            ),
            stat("Load 1m", f'node_load1{{{S}}}', 16, 1, 4, 4, "text", "short"),
            stat(
                "Disk tersibuk",
                DISK,
                20, 1, 4, 4, "yellow", "percent",
            ),
            row("CPU dan memori", 5),
            timeseries(
                "CPU per core",
                [target(
                    f'100 * (1 - avg by (cpu) (rate(node_cpu_seconds_total{{mode="idle",{S}}}[5m])))',
                    legend="core {{cpu}}",
                )],
                0, 6, 12, 8,
            ),
            timeseries(
                "RAM terpakai",
                [target(RAM, legend="{{server_id}}")],
                12, 6, 12, 8,
            ),
            row("Storage", 14),
            table(
                "Disk per mount",
                [target(
                    f'max by (instance, server_id, mountpoint, volume) ('
                    f'(100 - (100 * node_filesystem_avail_bytes{{{FS},{S}}} / node_filesystem_size_bytes{{{FS},{S}}}))'
                    f' or (100 - (100 * windows_logical_disk_free_bytes{{volume=~"[A-Z]:",{S}}} / windows_logical_disk_size_bytes{{volume=~"[A-Z]:",{S}}}))'
                    f")",
                    "A", instant=True, fmt="table",
                )],
                0, 15, 12, 8,
                organize(
                    {"server_id": "Server", "mountpoint": "Mount", "volume": "Volume", "Value": "Terpakai %"},
                    {"Server": 0, "Mount": 1, "Volume": 2, "Terpakai %": 3},
                ),
            ),
            timeseries(
                "Disk I/O",
                [
                    target(
                        f'sum by (server_id, device) (rate(node_disk_read_bytes_total{{{S}}}[5m]))',
                        "A", "{{server_id}} {{device}} baca",
                    ),
                    target(
                        f'sum by (server_id, device) (rate(node_disk_written_bytes_total{{{S}}}[5m]))',
                        "B", "{{server_id}} {{device}} tulis",
                    ),
                ],
                12, 15, 12, 8, unit="Bps", max_value=None,
            ),
            row("Jaringan dan proses", 23),
            timeseries(
                "Trafik jaringan",
                [
                    target(
                        f'sum by (server_id) (rate(node_network_receive_bytes_total{{{S},device!~"lo|veth.*|docker.*|br-.*"}}[5m]))',
                        "A", "{{server_id}} masuk",
                    ),
                    target(
                        f'sum by (server_id) (rate(node_network_transmit_bytes_total{{{S},device!~"lo|veth.*|docker.*|br-.*"}}[5m]))',
                        "B", "{{server_id}} keluar",
                    ),
                ],
                0, 24, 12, 8, unit="Bps", max_value=None,
            ),
            timeseries(
                "Proses CPU tertinggi",
                [target(
                    f'topk(10, sum by (server_id, groupname) (rate(namedprocess_namegroup_cpu_seconds_total{{{S}}}[5m])) * 100)',
                    legend="{{server_id}} {{groupname}}",
                )],
                12, 24, 12, 8,
                description="Butuh process-exporter di VM.",
            ),
        ],
        server_var(False, False),
        ["lrt", "server"],
    )


def app_db():
    return dash(
        "Aplikasi & Database",
        "lrt-app-db",
        "Status service systemd, probe HTTP/TCP, dan metrik PostgreSQL bila exporter sudah dipasang.",
        [
            row("Service", 0),
            stat("Service UP", 'count(lrt_service_up == 1) or vector(0)', 0, 1, 6, 4, "green"),
            stat(
                "Service DOWN",
                "count((lrt_service_expected == 1) and on(instance, name) (lrt_service_up == 0)) or vector(0)",
                6, 1, 6, 4, "red",
            ),
            stat("Probe OK", 'count(probe_success == 1) or vector(0)', 12, 1, 6, 4, "green"),
            stat("Probe gagal", 'count(probe_success == 0) or vector(0)', 18, 1, 6, 4, "red"),
            table(
                "Status service",
                [target(
                    f'max by (instance, server_id, application, name) (lrt_service_up{{{S}}})',
                    "A", instant=True, fmt="table",
                )],
                0, 5, 14, 9,
                organize(
                    {"server_id": "Server", "application": "Aplikasi", "name": "Service", "Value": "UP"},
                    {"Server": 0, "Aplikasi": 1, "Service": 2, "UP": 3},
                ),
                "1 = berjalan, 0 = mati. Daftar service berasal dari agent lrt_service_expected.",
            ),
            table(
                "Probe HTTP / TCP",
                [target(
                    f'max by (instance, server_id, job) (probe_success{{{S}}})',
                    "A", instant=True, fmt="table",
                )],
                14, 5, 10, 9,
                organize(
                    {"server_id": "Server", "job": "Jenis", "instance": "Target", "Value": "OK"},
                    {"Server": 0, "Jenis": 1, "Target": 2, "OK": 3},
                ),
            ),
            timeseries(
                "Waktu respons probe",
                [target(f'probe_duration_seconds{{{S}}}', legend="{{instance}}")],
                0, 14, 24, 7, unit="s", max_value=None,
            ),
            row("Database", 21),
            text(
                "PostgreSQL",
                "Panel di bawah terisi setelah **postgres_exporter** dipasang pada server database (tahap 2). Service dan probe di atas sudah memakai data yang ada.",
                0, 22, 24, 3,
            ),
            stat(
                "Koneksi",
                'sum(pg_stat_activity_count) or sum(pg_stat_database_numbackends) or vector(0)',
                0, 25, 8, 4, "text",
            ),
            timeseries(
                "Transaksi commit",
                [target("sum by (datname) (rate(pg_stat_database_xact_commit[5m]))", legend="{{datname}}")],
                8, 25, 8, 8, unit="ops", max_value=None,
            ),
            timeseries(
                "Database locks",
                [target("sum by (mode) (pg_locks_count)", legend="{{mode}}")],
                16, 25, 8, 8, unit="short", max_value=None,
            ),
        ],
        server_var(),
        ["lrt", "aplikasi", "database"],
    )


def network():
    dev = 'device!~"lo|veth.*|docker.*|br-.*"'
    return dash(
        "Jaringan & Infrastruktur",
        "lrt-network",
        "Bandwidth, error, drop, dan perkiraan packet loss dari interface server. Hardware fisik menyusul lewat SNMP.",
        [
            row("Bandwidth", 0),
            timeseries(
                "Bandwidth masuk",
                [target(
                    f'sum by (server_id) (rate(node_network_receive_bytes_total{{{S},{dev}}}[5m]))',
                    legend="{{server_id}}",
                )],
                0, 1, 12, 8, unit="Bps", max_value=None,
            ),
            timeseries(
                "Bandwidth keluar",
                [target(
                    f'sum by (server_id) (rate(node_network_transmit_bytes_total{{{S},{dev}}}[5m]))',
                    legend="{{server_id}}",
                )],
                12, 1, 12, 8, unit="Bps", max_value=None,
            ),
            row("Kualitas", 9),
            timeseries(
                "Packet loss (drop masuk)",
                [target(
                    f'100 * sum by (server_id) (rate(node_network_receive_drop_total{{{S},{dev}}}[5m]))'
                    f' / sum by (server_id) (rate(node_network_receive_packets_total{{{S},{dev}}}[5m]) + rate(node_network_receive_drop_total{{{S},{dev}}}[5m]))',
                    legend="{{server_id}}",
                )],
                0, 10, 12, 8,
                description="Perkiraan dari drop interface. Warning di atas 0%, kritis di atas 2%.",
            ),
            timeseries(
                "Error interface",
                [target(
                    f'sum by (server_id) (rate(node_network_receive_errs_total{{{S},{dev}}}[5m]) + rate(node_network_transmit_errs_total{{{S},{dev}}}[5m]))',
                    legend="{{server_id}}",
                )],
                12, 10, 12, 8, unit="ops", max_value=None,
            ),
            text(
                "Hardware",
                "Suhu, fan, PSU, dan RAID belum ada sumber datanya. Tahap 3 menambahkan SNMP exporter untuk server fisik dan perangkat jaringan.",
                0, 18, 24, 3,
            ),
        ],
        server_var(),
        ["lrt", "jaringan"],
    )


def alerts():
    return dash(
        "Alert & Insiden",
        "lrt-alerts",
        "Alert yang sedang menyala, severity, server terdampak, dan proses abnormal.",
        [
            row("Aktif", 0),
            stat("Critical", 'count(ALERTS{alertstate="firing",severity="critical"}) or vector(0)', 0, 1, 8, 4, "red"),
            stat("Warning", 'count(ALERTS{alertstate="firing",severity="warning"}) or vector(0)', 8, 1, 8, 4, "yellow"),
            stat("Pending", 'count(ALERTS{alertstate="pending"}) or vector(0)', 16, 1, 8, 4, "text"),
            table(
                "Alert aktif",
                [target(
                    'ALERTS{alertstate=~"firing|pending"}',
                    "A", instant=True, fmt="table",
                )],
                0, 5, 24, 10,
                organize(
                    {
                        "alertname": "Alert",
                        "alertstate": "Status",
                        "severity": "Severity",
                        "server_id": "Server",
                        "instance": "Instance",
                        "name": "Service",
                        "mountpoint": "Mount",
                    },
                    {"Alert": 0, "Status": 1, "Severity": 2, "Server": 3, "Service": 4, "Mount": 5, "Instance": 6},
                    {
                        "Time": True,
                        "__name__": True,
                        "Value": True,
                        "job": True,
                        "monitor": True,
                        "datacenter": True,
                        "prometheus": True,
                    },
                ),
                "Baris hilang sendiri saat kondisi pulih (RESOLVED).",
            ),
            row("Proses abnormal", 15),
            table(
                "Proses zombie",
                [target(
                    "sum by (server_id, groupname) (namedprocess_namegroup_zombie_count) > 0",
                    "A", instant=True, fmt="table",
                )],
                0, 16, 12, 8,
                organize(
                    {"server_id": "Server", "groupname": "Proses", "Value": "Jumlah"},
                    {"Server": 0, "Proses": 1, "Jumlah": 2},
                ),
            ),
            timeseries(
                "Jumlah alert firing",
                [target('count(ALERTS{alertstate="firing"}) or vector(0)', legend="Firing")],
                12, 16, 12, 8, unit="short", max_value=None,
            ),
        ],
        tags=["lrt", "alert"],
    )


def main():
    write("pantauan-server.json", overview_fixed())
    write("server-detail.json", server_detail())
    write("app-database.json", app_db())
    write("network.json", network())
    write("alerts.json", alerts())


def overview_fixed():
    health = table(
        "Server Health Status",
        [
            target(f'up{{job=~"node|windows",{S}}}', "A", instant=True, fmt="table"),
            target(CPU, "C", instant=True, fmt="table"),
            target(RAM, "B", instant=True, fmt="table"),
            target(DISK, "D", instant=True, fmt="table"),
        ],
        0, 14, 24, 12,
        organize(
            {
                "server_id": "Server",
                "application": "Aplikasi",
                "lokasi": "Lokasi",
                "instance": "Instance",
                "Value #A": "UP",
                "Value #C": "CPU %",
                "Value #B": "RAM %",
                "Value #D": "Disk %",
            },
            {"Server": 0, "Aplikasi": 1, "Lokasi": 2, "Instance": 3, "UP": 4, "CPU %": 5, "RAM %": 6, "Disk %": 7},
        ),
        "UP=1 online. Warning: CPU ≥ 70, RAM ≥ 75, disk ≥ 75. Kritis: CPU > 85, RAM > 90, disk > 85.",
    )
    return dash(
        "Data Center Overview",
        "lrt-server-health",
        "Halaman utama ruang Data Center: total server, online/offline, warning, rata-rata CPU/RAM, dan kesehatan tiap server.",
        [
            row("Ringkasan", 0),
            stat("Total Server", 'count(up{job=~"node|windows"}) or vector(0)', 0, 1, 6, 4, "text"),
            stat("Online", 'count(up{job=~"node|windows"} == 1) or vector(0)', 6, 1, 6, 4, "green"),
            stat("Offline", 'count(up{job=~"node|windows"} == 0) or vector(0)', 12, 1, 6, 4, "red"),
            stat("Warning", WARN, 18, 1, 6, 4, "yellow"),
            row("Utilisasi", 5),
            timeseries("CPU Utilization", [target(CPU_AVG, legend="Rata-rata")], 0, 6, 12, 7),
            timeseries("Memory Utilization", [target(RAM_AVG, legend="Rata-rata")], 12, 6, 12, 7),
            row("Kesehatan server", 13),
            health,
        ],
        server_var(),
        ["lrt", "overview"],
    )


if __name__ == "__main__":
    main()
