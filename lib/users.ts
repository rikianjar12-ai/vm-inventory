import { ready } from "./db";
import { hashPassword } from "./password";

export type AppUser = {
  id: number;
  username: string;
  display_name: string;
  role: "admin" | "operator";
  created_at: string;
};

type UserRow = AppUser & { password_hash: string };

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    created_at: row.created_at,
  };
}

export async function listUsers(): Promise<AppUser[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT id, username, display_name, role, created_at
     FROM app_users
     ORDER BY id`
  );
  return rows;
}

export async function getUserById(id: number): Promise<AppUser | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT id, username, display_name, role, created_at
     FROM app_users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getUserAuthByUsername(username: string) {
  const pool = await ready();
  const { rows } = await pool.query<UserRow>(
    `SELECT id, username, display_name, role, created_at, password_hash
     FROM app_users WHERE username = $1`,
    [username]
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "operator";
}) {
  const pool = await ready();
  const passwordHash = await hashPassword(input.password);
  try {
    const { rows } = await pool.query(
      `INSERT INTO app_users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role, created_at`,
      [input.username, passwordHash, input.displayName, input.role]
    );
    return mapUser(rows[0]);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      throw new Error("Username sudah dipakai.");
    }
    throw error;
  }
}

export async function updateUser(
  id: number,
  input: { displayName: string; role: "admin" | "operator" }
) {
  const pool = await ready();
  await pool.query(
    "UPDATE app_users SET display_name = $1, role = $2 WHERE id = $3",
    [input.displayName, input.role, id]
  );
}

export async function updateUserPassword(id: number, password: string) {
  const pool = await ready();
  const passwordHash = await hashPassword(password);
  await pool.query(
    "UPDATE app_users SET password_hash = $1 WHERE id = $2",
    [passwordHash, id]
  );
}

export async function countAdmins() {
  const pool = await ready();
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM app_users WHERE role = 'admin'"
  );
  return rows[0].n as number;
}

export async function deleteUser(id: number) {
  const pool = await ready();
  await pool.query("DELETE FROM app_users WHERE id = $1", [id]);
}
