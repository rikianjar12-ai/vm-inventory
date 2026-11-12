import Link from "next/link";
import { notFound } from "next/navigation";
import { updateColumnAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getColumn } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditKolomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const column = await getColumn(Number(id));
  if (!column) notFound();

  const action = updateColumnAction.bind(null, column.id);

  return (
    <>
      <div className="hero">
        <div>
          <h2>Edit kolom</h2>
          <p>
            Ubah nama tampilan untuk kunci <code>{column.field_key}</code>. Data
            di setiap VM tidak berubah.
          </p>
        </div>
      </div>

      {query.err ? <div className="flash flash-err">{query.err}</div> : null}

      <form className="card" action={action}>
        <div className="form-section">
          <div className="field">
            <label htmlFor="field_key">Kunci</label>
            <input id="field_key" value={column.field_key} disabled />
          </div>
          <div className="field">
            <label htmlFor="label">Nama kolom</label>
            <input
              id="label"
              name="label"
              defaultValue={column.label}
              required
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Simpan perubahan
          </button>
          <Link className="btn btn-ghost" href="/kolom">
            Batal
          </Link>
        </div>
      </form>
    </>
  );
}
