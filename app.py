from flask import Flask, render_template, request, redirect, url_for, flash
from psycopg2 import sql
from psycopg2.extras import RealDictCursor
import psycopg2
import re

app = Flask(__name__)
app.secret_key = "vm-inventory-secret-key"

DB_HOST = "localhost"
DB_NAME = "vm_inventory"
DB_USER = "postgres"
DB_PASSWORD = "postgres"
DB_PORT = "5432"

PROTECTED_KEYS = {
    "system_status",
    "server_id",
    "ip",
    "lokasi_server",
    "application",
    "cpu_core",
    "ram_gb",
    "storage_gb",
    "os_version",
    "app_version",
    "db_version",
}

DEFAULT_COLUMNS = [
    ("system_status", "SYSTEM STATUS", "Umum", 10, True),
    ("server_id", "SERVER ID", "Umum", 20, True),
    ("ip", "IP", "Umum", 30, True),
    ("lokasi_server", "Lokasi Server", "Umum", 40, True),
    ("application", "APPLICATION", "Umum", 50, True),
    ("cpu_core", "CPUs (CORE)", "Spesifikasi", 60, True),
    ("ram_gb", "RAM (GB)", "Spesifikasi", 70, True),
    ("storage_gb", "STORAGE (GB)", "Spesifikasi", 80, True),
    ("os_version", "OS VERSION", "Versi", 90, True),
    ("app_version", "APP VERSION", "Versi", 100, True),
    ("db_version", "DB VERSION", "Versi", 110, True),
]

SAMPLE_VMS = [
    {
        "system_status": "UP",
        "server_id": "VM-PROD-01",
        "ip": "10.10.1.11",
        "lokasi_server": "DC Jakarta - Rack A1",
        "application": "Core Banking",
        "cpu_core": "8",
        "ram_gb": "32",
        "storage_gb": "500",
        "os_version": "RHEL 8.8",
        "app_version": "4.2.1",
        "db_version": "PostgreSQL 15.4",
    },
    {
        "system_status": "UP",
        "server_id": "VM-APP-02",
        "ip": "10.10.1.21",
        "lokasi_server": "DC Jakarta - Rack A2",
        "application": "Internet Banking",
        "cpu_core": "16",
        "ram_gb": "64",
        "storage_gb": "1000",
        "os_version": "Ubuntu 22.04 LTS",
        "app_version": "3.8.0",
        "db_version": "MySQL 8.0",
    },
    {
        "system_status": "MAINTENANCE",
        "server_id": "VM-DB-03",
        "ip": "10.10.2.31",
        "lokasi_server": "DC Surabaya - Rack B3",
        "application": "Database Cluster",
        "cpu_core": "32",
        "ram_gb": "128",
        "storage_gb": "4000",
        "os_version": "Oracle Linux 8",
        "app_version": "-",
        "db_version": "Oracle 19c",
    },
    {
        "system_status": "DOWN",
        "server_id": "VM-DEV-04",
        "ip": "10.20.5.44",
        "lokasi_server": "DC Bandung - Rack C1",
        "application": "Portal Internal",
        "cpu_core": "4",
        "ram_gb": "16",
        "storage_gb": "250",
        "os_version": "Windows Server 2022",
        "app_version": "2.1.5",
        "db_version": "SQL Server 2019",
    },
]


def get_db_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT,
    )
    conn.autocommit = True
    return conn


def slugify(label):
    key = label.strip().lower()
    key = re.sub(r"[^a-z0-9]+", "_", key)
    key = re.sub(r"_+", "_", key).strip("_")
    return key[:64] or "kolom_baru"


def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS inventory_columns (
            id SERIAL PRIMARY KEY,
            field_key VARCHAR(64) UNIQUE NOT NULL,
            label VARCHAR(128) NOT NULL,
            section_name VARCHAR(64) NOT NULL DEFAULT 'Lainnya',
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_protected BOOLEAN NOT NULL DEFAULT FALSE
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS virtual_machines (
            id SERIAL PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )

    cur.execute("SELECT COUNT(*) FROM inventory_columns")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            """
            INSERT INTO inventory_columns
                (field_key, label, section_name, sort_order, is_protected)
            VALUES (%s, %s, %s, %s, %s)
            """,
            DEFAULT_COLUMNS,
        )

    cur.execute("SELECT COUNT(*) FROM virtual_machines")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO virtual_machines (data) VALUES (%s)",
            [(psycopg2.extras.Json(row),) for row in SAMPLE_VMS],
        )

    cur.close()
    conn.close()


def fetch_columns(conn):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT id, field_key, label, section_name, sort_order, is_protected
        FROM inventory_columns
        ORDER BY sort_order, id
        """
    )
    columns = cur.fetchall()
    cur.close()
    return columns


def grouped_sections(columns):
    sections = []
    current = None
    for col in columns:
        name = col["section_name"]
        if current is None or current["name"] != name:
            current = {"name": name, "columns": []}
            sections.append(current)
        current["columns"].append(col)
    return sections


def fetch_vm(conn, vm_id):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, data FROM virtual_machines WHERE id = %s", (vm_id,))
    row = cur.fetchone()
    cur.close()
    return row


def form_data_from_request(columns):
    payload = {}
    for col in columns:
        payload[col["field_key"]] = request.form.get(col["field_key"], "").strip()
    return payload


def stats_from_rows(rows):
    total = len(rows)
    up = sum(1 for r in rows if str(r["data"].get("system_status", "")).upper() == "UP")
    down = sum(1 for r in rows if str(r["data"].get("system_status", "")).upper() == "DOWN")
    maint = sum(
        1
        for r in rows
        if str(r["data"].get("system_status", "")).upper() == "MAINTENANCE"
    )
    return {"total": total, "up": up, "down": down, "maintenance": maint}


@app.route("/")
def home():
    conn = get_db_connection()
    columns = fetch_columns(conn)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, data FROM virtual_machines ORDER BY id DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    q = request.args.get("q", "").strip().lower()
    status_filter = request.args.get("status", "").strip().upper()

    filtered = []
    for row in rows:
        data = row["data"] or {}
        haystack = " ".join(str(v) for v in data.values()).lower()
        status = str(data.get("system_status", "")).upper()
        if q and q not in haystack:
            continue
        if status_filter and status != status_filter:
            continue
        filtered.append(row)

    return render_template(
        "index.html",
        columns=columns,
        sections=grouped_sections(columns),
        virtual_machines=filtered,
        stats=stats_from_rows(rows),
        q=q,
        status_filter=status_filter,
    )


@app.route("/tambah", methods=["GET", "POST"])
def tambah_vm():
    conn = get_db_connection()
    columns = fetch_columns(conn)

    if request.method == "POST":
        payload = form_data_from_request(columns)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO virtual_machines (data) VALUES (%s)",
            (psycopg2.extras.Json(payload),),
        )
        cur.close()
        conn.close()
        flash("Virtual machine berhasil ditambahkan.", "success")
        return redirect(url_for("home"))

    conn.close()
    return render_template(
        "form_vm.html",
        title="Tambah Virtual Machine",
        action=url_for("tambah_vm"),
        columns=columns,
        sections=grouped_sections(columns),
        values={},
        submit_label="Simpan VM",
    )


@app.route("/edit/<int:vm_id>", methods=["GET", "POST"])
def edit_vm(vm_id):
    conn = get_db_connection()
    columns = fetch_columns(conn)
    vm = fetch_vm(conn, vm_id)
    if not vm:
        conn.close()
        flash("Data VM tidak ditemukan.", "error")
        return redirect(url_for("home"))

    if request.method == "POST":
        payload = form_data_from_request(columns)
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE virtual_machines
            SET data = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (psycopg2.extras.Json(payload), vm_id),
        )
        cur.close()
        conn.close()
        flash("Data VM berhasil diperbarui.", "success")
        return redirect(url_for("home"))

    conn.close()
    return render_template(
        "form_vm.html",
        title="Edit Virtual Machine",
        action=url_for("edit_vm", vm_id=vm_id),
        columns=columns,
        sections=grouped_sections(columns),
        values=vm["data"] or {},
        submit_label="Simpan Perubahan",
    )


@app.route("/hapus/<int:vm_id>", methods=["GET", "POST"])
def hapus_vm(vm_id):
    conn = get_db_connection()
    vm = fetch_vm(conn, vm_id)
    if not vm:
        conn.close()
        flash("Data VM tidak ditemukan.", "error")
        return redirect(url_for("home"))

    if request.method == "POST":
        cur = conn.cursor()
        cur.execute("DELETE FROM virtual_machines WHERE id = %s", (vm_id,))
        cur.close()
        conn.close()
        flash("Virtual machine berhasil dihapus.", "success")
        return redirect(url_for("home"))

    conn.close()
    return render_template("confirm_hapus.html", vm=vm)


@app.route("/kolom")
def kelola_kolom():
    conn = get_db_connection()
    columns = fetch_columns(conn)
    conn.close()
    return render_template(
        "kolom.html",
        columns=columns,
        sections=grouped_sections(columns),
    )


@app.route("/kolom/tambah", methods=["POST"])
def tambah_kolom():
    label = request.form.get("label", "").strip()
    section_name = request.form.get("section_name", "").strip() or "Lainnya"
    field_key = slugify(request.form.get("field_key", "").strip() or label)

    if not label:
        flash("Nama kolom wajib diisi.", "error")
        return redirect(url_for("kelola_kolom"))

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM inventory_columns WHERE field_key = %s",
        (field_key,),
    )
    if cur.fetchone():
        cur.close()
        conn.close()
        flash("Kunci kolom sudah dipakai. Gunakan nama lain.", "error")
        return redirect(url_for("kelola_kolom"))

    cur.execute("SELECT COALESCE(MAX(sort_order), 0) + 10 FROM inventory_columns")
    next_order = cur.fetchone()[0]
    cur.execute(
        """
        INSERT INTO inventory_columns
            (field_key, label, section_name, sort_order, is_protected)
        VALUES (%s, %s, %s, %s, FALSE)
        """,
        (field_key, label, section_name, next_order),
    )
    cur.close()
    conn.close()
    flash("Kolom baru berhasil ditambahkan.", "success")
    return redirect(url_for("kelola_kolom"))


@app.route("/kolom/hapus/<int:column_id>", methods=["GET", "POST"])
def hapus_kolom(column_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT id, field_key, label, is_protected
        FROM inventory_columns WHERE id = %s
        """,
        (column_id,),
    )
    column = cur.fetchone()
    if not column:
        cur.close()
        conn.close()
        flash("Kolom tidak ditemukan.", "error")
        return redirect(url_for("kelola_kolom"))

    if column["is_protected"] or column["field_key"] in PROTECTED_KEYS:
        cur.close()
        conn.close()
        flash("Kolom standar tidak dapat dihapus.", "error")
        return redirect(url_for("kelola_kolom"))

    if request.method == "POST":
        field_key = column["field_key"]
        cur.execute("DELETE FROM inventory_columns WHERE id = %s", (column_id,))
        cur.execute(
            sql.SQL("UPDATE virtual_machines SET data = data - %s"),
            (field_key,),
        )
        cur.close()
        conn.close()
        flash("Kolom berhasil dihapus.", "success")
        return redirect(url_for("kelola_kolom"))

    cur.close()
    conn.close()
    return render_template("confirm_hapus_kolom.html", column=column)


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
