import Link from "next/link";
import { notFound } from "next/navigation";
import { updateUserAction } from "@/lib/auth-actions";
import { requireAdmin } from "@/lib/auth";
import { getUserById } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function EditPenggunaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const user = await getUserById(Number(id));
  if (!user) notFound();

  return (
    <>
      <div className="hero">
        <div>
          <h2>Edit akun</h2>
          <p>
            Ubah nama tampilan atau peran untuk{" "}
            <strong>{user.username}</strong>.
          </p>
        </div>
      </div>

      {query.err ? <div className="flash flash-err">{query.err}</div> : null}

      <form className="card" action={updateUserAction}>
        <input type="hidden" name="user_id" value={user.id} />
        <div className="form-section">
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" value={user.username} disabled />
          </div>
          <div className="field">
            <label htmlFor="display_name">Nama tampilan</label>
            <input
              id="display_name"
              name="display_name"
              defaultValue={user.display_name}
            />
          </div>
          <div className="field">
            <label htmlFor="role">Peran</label>
            <select id="role" name="role" defaultValue={user.role}>
              <option value="operator">Operator (hanya lihat)</option>
              <option value="admin">Admin (tanpa batasan)</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Simpan perubahan
          </button>
          <Link className="btn btn-ghost" href="/pengguna">
            Batal
          </Link>
        </div>
      </form>
    </>
  );
}
