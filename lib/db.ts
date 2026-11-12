import { Pool } from "pg";
import { hashPassword } from "./password";
import {
  DEFAULT_COLUMNS,
  SAMPLE_VMS,
  normalizeSectionName,
  type InventoryColumn,
  type VirtualMachine,
} from "./types";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/vm_inventory";

const globalForPg = globalThis as unknown as {
  pool?: Pool;
  dbReady?: Promise<void>;
};

function getPool() {
  if (!globalForPg.pool) {
    globalForPg.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalForPg.pool;
}

async function tableExists(pool: Pool, tableName: string) {
  const { rowCount } = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return Boolean(rowCount);
}

async function columnExists(pool: Pool, tableName: string, columnName: string) {
  const { rowCount } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return Boolean(rowCount);
}

function parseData(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

async function migrateLegacyVms(pool: Pool) {
  if (!(await tableExists(pool, "virtual_machines"))) return;

  if (await columnExists(pool, "virtual_machines", "data")) {
    const legacy = await pool.query(
      "SELECT data FROM virtual_machines ORDER BY id"
    );
    for (const row of legacy.rows) {
      await pool.query("INSERT INTO vm_records (data) VALUES ($1::jsonb)", [
        JSON.stringify(parseData(row.data)),
      ]);
    }
    return;
  }

  if (await columnExists(pool, "virtual_machines", "hostname")) {
    const legacy = await pool.query("SELECT * FROM virtual_machines ORDER BY id");
    for (const row of legacy.rows) {
      const data = {
        system_status: String(row.status ?? "UP"),
        server_id: String(row.hostname ?? ""),
        ip: String(row.ip_address ?? ""),
        lokasi_server: String(row.location ?? row.environment ?? ""),
        application: String(row.application ?? ""),
        cpu_core: row.cpu == null ? "" : String(row.cpu),
        ram_gb: row.ram == null ? "" : String(row.ram),
        storage_gb: row.storage == null ? "" : String(row.storage),
        os: "",
        os_version: String(row.operating_system ?? ""),
        app_version: "",
        db_version: "",
      };
      await pool.query("INSERT INTO vm_records (data) VALUES ($1::jsonb)", [
        JSON.stringify(data),
      ]);
    }
  }
}

async function initDb() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_columns (
      id SERIAL PRIMARY KEY,
      field_key VARCHAR(64) UNIQUE NOT NULL,
      label VARCHAR(128) NOT NULL,
      section_name VARCHAR(64) NOT NULL DEFAULT 'Lainnya',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_protected BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vm_records (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  for (const row of DEFAULT_COLUMNS) {
    await pool.query(
      `INSERT INTO inventory_columns
        (field_key, label, section_name, sort_order, is_protected)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (field_key) DO UPDATE
         SET is_protected = TRUE`,
      row
    );
  }

  await pool.query(
    `UPDATE inventory_columns
     SET section_name = 'Spesifikasi'
     WHERE lower(section_name) = 'specifikasi'`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name VARCHAR(128) NOT NULL DEFAULT '',
      role VARCHAR(16) NOT NULL DEFAULT 'operator',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const userCount = await pool.query(
    "SELECT COUNT(*)::int AS n FROM app_users"
  );
  if (userCount.rows[0].n === 0) {
    const passwordHash = await hashPassword("AdminLrt123");
    await pool.query(
      `INSERT INTO app_users (username, password_hash, display_name, role)
       VALUES ('admin', $1, 'Administrator', 'admin')`,
      [passwordHash]
    );
  }

  const vms = await pool.query("SELECT COUNT(*)::int AS n FROM vm_records");
  if (vms.rows[0].n === 0) {
    await migrateLegacyVms(pool);
    const after = await pool.query("SELECT COUNT(*)::int AS n FROM vm_records");
    if (after.rows[0].n === 0) {
      for (const data of SAMPLE_VMS) {
        await pool.query("INSERT INTO vm_records (data) VALUES ($1::jsonb)", [
          JSON.stringify(data),
        ]);
      }
    }
  }
}

export async function ready() {
  if (!globalForPg.dbReady) {
    globalForPg.dbReady = initDb().catch((error) => {
      globalForPg.dbReady = undefined;
      throw error;
    });
  }
  await globalForPg.dbReady;
  return getPool();
}

export async function listColumns(): Promise<InventoryColumn[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT id, field_key, label, section_name, sort_order, is_protected
     FROM inventory_columns
     ORDER BY sort_order, id`
  );
  return rows;
}

export async function listVms(): Promise<VirtualMachine[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT id, data FROM vm_records ORDER BY id DESC"
  );
  return rows.map((row) => ({
    id: row.id,
    data: parseData(row.data),
  }));
}

export async function getVm(id: number): Promise<VirtualMachine | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT id, data FROM vm_records WHERE id = $1",
    [id]
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, data: parseData(rows[0].data) };
}

export async function insertVm(data: Record<string, string>) {
  const pool = await ready();
  await pool.query("INSERT INTO vm_records (data) VALUES ($1::jsonb)", [
    JSON.stringify(data),
  ]);
}

export async function updateVm(id: number, data: Record<string, string>) {
  const pool = await ready();
  await pool.query(
    "UPDATE vm_records SET data = $1::jsonb, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(data), id]
  );
}

export async function deleteVm(id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM vm_records WHERE id = $1", [id]);
}

export async function insertColumn(
  fieldKey: string,
  label: string,
  sectionName: string
) {
  const pool = await ready();
  const exists = await pool.query(
    "SELECT 1 FROM inventory_columns WHERE field_key = $1",
    [fieldKey]
  );
  if (exists.rowCount) {
    throw new Error("Kunci kolom sudah dipakai. Gunakan nama lain.");
  }
  const max = await pool.query(
    "SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM inventory_columns"
  );
  await pool.query(
    `INSERT INTO inventory_columns
      (field_key, label, section_name, sort_order, is_protected)
     VALUES ($1, $2, $3, $4, FALSE)`,
    [fieldKey, label, normalizeSectionName(sectionName) || "Lainnya", max.rows[0].next]
  );
}

export async function getColumn(id: number): Promise<InventoryColumn | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT id, field_key, label, section_name, sort_order, is_protected
     FROM inventory_columns WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateColumnLabel(id: number, label: string) {
  const pool = await ready();
  const result = await pool.query(
    `UPDATE inventory_columns
     SET label = $1
     WHERE id = $2
     RETURNING id`,
    [label, id]
  );
  if (!result.rowCount) {
    throw new Error("Kolom tidak ditemukan.");
  }
}

export async function deleteColumn(id: number, fieldKey: string) {
  const pool = await ready();
  await pool.query("DELETE FROM inventory_columns WHERE id = $1", [id]);
  await pool.query("UPDATE vm_records SET data = data - $1", [fieldKey]);
}
