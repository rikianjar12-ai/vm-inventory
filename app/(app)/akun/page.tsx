import { changeOwnPasswordAction } from "@/lib/auth-actions";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AkunPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  return (
    <>
      <div className="hero">
        <div>
          <h2>Akun saya</h2>
          <p>
            Masuk sebagai <strong>{user.display_name || user.username}</strong> (
            {user.role}).
          </p>
        </div>
      </div>
      {params.msg ? <div className="flash flash-ok">{params.msg}</div> : null}
      {params.err ? <div className="flash flash-err">{params.err}</div> : null}
      <form className="card" action={changeOwnPasswordAction}>
        <h3>Ubah password</h3>
        <div className="form-section">
          <div className="field">
            <label htmlFor="current_password">Password saat ini</label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label htmlFor="new_password">Password baru</label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Konfirmasi password baru</label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Simpan password
          </button>
        </div>
      </form>
    </>
  );
}
