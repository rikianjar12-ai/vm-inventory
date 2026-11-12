import type { PoolClient } from "pg";
import { ready } from "./db";
import type { SubDraftInput, SubInput, SubRow, WorkInput, WorkRow } from "./progress";

const globalForProgress = globalThis as unknown as {
  progressReady?: Promise<void>;
};

function dateOnly(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : "";
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapWork(row: Record<string, unknown>): WorkRow {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    owner: String(row.owner ?? ""),
    weight: asNumber(row.weight),
    manual_progress: asNumber(row.manual_progress),
    start_date: dateOnly(row.start_date),
    due_date: dateOnly(row.due_date),
  };
}

function mapSub(row: Record<string, unknown>): SubRow {
  return {
    id: Number(row.id),
    work_id: Number(row.work_id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    owner: String(row.owner ?? ""),
    weight: asNumber(row.weight),
    progress: asNumber(row.progress),
    due_date: dateOnly(row.due_date),
    sort_order: asNumber(row.sort_order),
  };
}

async function initProgress(pool: Awaited<ReturnType<typeof ready>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_items (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner VARCHAR(128) NOT NULL DEFAULT '',
      weight NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (weight > 0),
      manual_progress INTEGER NOT NULL DEFAULT 0 CHECK (manual_progress BETWEEN 0 AND 100),
      start_date DATE,
      due_date DATE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_subitems (
      id SERIAL PRIMARY KEY,
      work_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner VARCHAR(128) NOT NULL DEFAULT '',
      weight NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (weight > 0),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      due_date DATE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS work_subitems_work_id_idx ON work_subitems (work_id, sort_order, id)"
  );
}

async function readyProgress() {
  const pool = await ready();
  if (!globalForProgress.progressReady) {
    globalForProgress.progressReady = initProgress(pool).catch((error) => {
      globalForProgress.progressReady = undefined;
      throw error;
    });
  }
  await globalForProgress.progressReady;
  return pool;
}

export async function listWorks(): Promise<WorkRow[]> {
  const pool = await readyProgress();
  const { rows } = await pool.query(
    `SELECT id, title, description, owner, weight, manual_progress, start_date, due_date
     FROM work_items
     ORDER BY id`
  );
  return rows.map((row) => mapWork(row));
}

export async function listSubs(workId?: number): Promise<SubRow[]> {
  const pool = await readyProgress();
  if (workId) {
    const { rows } = await pool.query(
      `SELECT id, work_id, title, description, owner, weight, progress, due_date, sort_order
       FROM work_subitems
       WHERE work_id = $1
       ORDER BY sort_order, id`,
      [workId]
    );
    return rows.map((row) => mapSub(row));
  }
  const { rows } = await pool.query(
    `SELECT id, work_id, title, description, owner, weight, progress, due_date, sort_order
     FROM work_subitems
     ORDER BY sort_order, id`
  );
  return rows.map((row) => mapSub(row));
}

export async function getWork(id: number): Promise<WorkRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const pool = await readyProgress();
  const { rows } = await pool.query(
    `SELECT id, title, description, owner, weight, manual_progress, start_date, due_date
     FROM work_items
     WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapWork(rows[0]) : null;
}

export async function insertWork(input: WorkInput) {
  const pool = await readyProgress();
  const { rows } = await pool.query(
    `INSERT INTO work_items
      (title, description, owner, weight, manual_progress, start_date, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.title,
      input.description,
      input.owner,
      input.weight,
      input.manualProgress,
      input.startDate,
      input.dueDate,
    ]
  );
  return Number(rows[0].id);
}

export async function updateWork(id: number, input: WorkInput) {
  const pool = await readyProgress();
  const result = await pool.query(
    `UPDATE work_items
     SET title = $1,
         description = $2,
         owner = $3,
         weight = $4,
         manual_progress = $5,
         start_date = $6,
         due_date = $7,
         updated_at = NOW()
     WHERE id = $8`,
    [
      input.title,
      input.description,
      input.owner,
      input.weight,
      input.manualProgress,
      input.startDate,
      input.dueDate,
      id,
    ]
  );
  if (!result.rowCount) {
    throw new Error("Pekerjaan tidak ditemukan.");
  }
}

export async function deleteWork(id: number) {
  const pool = await readyProgress();
  await pool.query("DELETE FROM work_items WHERE id = $1", [id]);
}

export async function insertSub(workId: number, input: SubInput) {
  const pool = await readyProgress();
  const parent = await pool.query("SELECT id FROM work_items WHERE id = $1", [
    workId,
  ]);
  if (!parent.rowCount) {
    throw new Error("Pekerjaan tidak ditemukan.");
  }
  const max = await pool.query(
    "SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM work_subitems WHERE work_id = $1",
    [workId]
  );
  const { rows } = await pool.query(
    `INSERT INTO work_subitems
      (work_id, title, description, owner, weight, progress, due_date, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      workId,
      input.title,
      input.description,
      input.owner,
      input.weight,
      input.progress,
      input.dueDate,
      max.rows[0].next,
    ]
  );
  await pool.query("UPDATE work_items SET updated_at = NOW() WHERE id = $1", [
    workId,
  ]);
  return Number(rows[0].id);
}

export async function updateSub(workId: number, subId: number, input: SubInput) {
  const pool = await readyProgress();
  const result = await pool.query(
    `UPDATE work_subitems
     SET title = $1,
         description = $2,
         owner = $3,
         weight = $4,
         progress = $5,
         due_date = $6,
         updated_at = NOW()
     WHERE id = $7 AND work_id = $8`,
    [
      input.title,
      input.description,
      input.owner,
      input.weight,
      input.progress,
      input.dueDate,
      subId,
      workId,
    ]
  );
  if (!result.rowCount) {
    throw new Error("Sub pekerjaan tidak ditemukan.");
  }
  await pool.query("UPDATE work_items SET updated_at = NOW() WHERE id = $1", [
    workId,
  ]);
}

async function writeSubs(client: PoolClient, workId: number, items: SubDraftInput[]) {
  const existing = await client.query(
    "SELECT id FROM work_subitems WHERE work_id = $1",
    [workId]
  );
  const keep = new Set<number>();
  let order = 10;

  for (const item of items) {
    if (item.id) {
      const updated = await client.query(
        `UPDATE work_subitems
         SET title = $1, progress = $2, description = $3, weight = 1, sort_order = $4, updated_at = NOW()
         WHERE id = $5 AND work_id = $6`,
        [item.title, item.progress, item.note, order, item.id, workId]
      );
      if (!updated.rowCount) {
        throw new Error("Sub pekerjaan tidak ditemukan.");
      }
      keep.add(item.id);
    } else {
      await client.query(
        `INSERT INTO work_subitems
          (work_id, title, description, owner, weight, progress, due_date, sort_order)
         VALUES ($1, $2, $3, '', 1, $4, NULL, $5)`,
        [workId, item.title, item.note, item.progress, order]
      );
    }
    order += 10;
  }

  const remove = existing.rows
    .map((row) => Number(row.id))
    .filter((id) => !keep.has(id));
  if (remove.length > 0) {
    await client.query(
      "DELETE FROM work_subitems WHERE work_id = $1 AND id = ANY($2::int[])",
      [workId, remove]
    );
  }
}

export async function insertWorkWithSubs(input: WorkInput, subs: SubDraftInput[]) {
  const pool = await readyProgress();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO work_items
        (title, description, owner, weight, manual_progress, start_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.title,
        input.description,
        input.owner,
        input.weight,
        input.manualProgress,
        input.startDate,
        input.dueDate,
      ]
    );
    const id = Number(inserted.rows[0].id);
    await writeSubs(client, id, subs);
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateWorkWithSubs(
  id: number,
  input: WorkInput,
  subs: SubDraftInput[]
) {
  const pool = await readyProgress();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE work_items
       SET title = $1,
           description = $2,
           owner = $3,
           weight = $4,
           manual_progress = $5,
           start_date = $6,
           due_date = $7,
           updated_at = NOW()
       WHERE id = $8`,
      [
        input.title,
        input.description,
        input.owner,
        input.weight,
        input.manualProgress,
        input.startDate,
        input.dueDate,
        id,
      ]
    );
    if (!updated.rowCount) {
      throw new Error("Pekerjaan tidak ditemukan.");
    }
    await writeSubs(client, id, subs);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSub(workId: number, subId: number) {
  const pool = await readyProgress();
  const result = await pool.query(
    "DELETE FROM work_subitems WHERE id = $1 AND work_id = $2",
    [subId, workId]
  );
  if (!result.rowCount) {
    throw new Error("Sub pekerjaan tidak ditemukan.");
  }
  await pool.query("UPDATE work_items SET updated_at = NOW() WHERE id = $1", [
    workId,
  ]);
}
