import Link from "next/link";
import {
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
} from "@/lib/auth-actions";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function PenggunaPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const users = await listUsers();

  return (
    <>
      <div className="hero">
        <div>
          <h2>Manajemen pengguna</h2>
          <p>Tambah, edit peran, atur ulang password, atau hapus user.</p>
        </div>
      </div>

      {params.msg ? <div className="flash flash-ok">{params.msg}</div> : null}
      {params.err ? <div className="flash flash-err">{params.err}</div> : null}

      <div className="card stack-card">
        <h3>Tambah pengguna</h3>
        <form action={createUserAction} className="form-grid">
          <div className="form-section">
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" required minLength={3} />
            </div>
            <div className="field">
              <label htmlFor="display_name">Nama tampilan</label>
              <input id="display_name" name="display_name" />
            </div>
            <div className="field">
              <label htmlFor="password">Password awal</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="role">Peran</label>
              <select id="role" name="role" defaultValue="operator">
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">
              Simpan pengguna
            </button>
          </div>
        </form>
      </div>

      <div className="card stack-card">
        <h3>Daftar pengguna</h3>
        <div className="table-wrap nested-table">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama</th>
                <th>Peran</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const reset = resetUserPasswordAction;
                const remove = deleteUserAction.bind(null, user.id);
                const self = user.id === actor.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <code>{user.username}</code>
                    </td>
                    <td>{user.display_name || "-"}</td>
                    <td>
                      <span className="badge">{user.role}</span>
                    </td>
                    <td>
                      <div className="user-actions">
                        <Link
                          className="btn btn-ghost"
                          href={`/pengguna/edit/${user.id}`}
                        >
                          Edit
                        </Link>
                        <form action={reset} className="reset-pass-form">
                          <input type="hidden" name="user_id" value={user.id} />
                          <input
                            name="password"
                            type="password"
                            placeholder="Password baru"
                            minLength={8}
                            required
                            aria-label={`Password baru untuk ${user.username}`}
                          />
                          <button className="btn btn-ghost" type="submit">
                            Reset
                          </button>
                        </form>
                        {self ? (
                          <span className="muted-note">Akun ini</span>
                        ) : (
                          <form action={remove}>
                            <button className="btn btn-danger" type="submit">
                              Hapus
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted-note">
          Admin bisa mengubah daftar server dan mengelola username. User biasa
          hanya bisa melihat dashboard.{" "}
          <Link href="/akun">Ubah password akun sendiri</Link>
        </p>
      </div>
    </>
  );
}
