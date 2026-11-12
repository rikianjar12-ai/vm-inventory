import Link from "next/link";
import { createColumnAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { listColumns } from "@/lib/db";
import {
  groupedSections,
  isProtectedColumn,
  sectionTitle,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KolomPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const columns = await listColumns();
  const sections = groupedSections(columns);

  return (
    <>
      <div className="hero">
        <div>
          <h2>Kelola Kolom</h2>
          <p>
            Ubah nama kolom, tambah kolom kustom, atau hapus kolom yang tidak
            dilindungi.
          </p>
        </div>
      </div>

      {params.msg ? <div className="flash flash-ok">{params.msg}</div> : null}
      {params.err ? <div className="flash flash-err">{params.err}</div> : null}

      <div className="card stack-card">
        <h3>Tambah kolom baru</h3>
        <form action={createColumnAction} className="toolbar nested-toolbar">
          <input name="label" placeholder="Nama kolom (contoh: PIC)" required />
          <input
            name="section_name"
            placeholder="Grup (Umum / Spesifikasi / Versi / Lainnya)"
          />
          <input name="field_key" placeholder="Kunci opsional (pic)" />
          <button className="btn btn-primary" type="submit">
            Tambah Kolom
          </button>
        </form>
      </div>

      {sections.map((section) => (
        <div className="card stack-card" key={section.name}>
          <h3>{sectionTitle(section.name)}</h3>
          <div className="table-wrap nested-table">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Kunci</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {section.columns.map((col) => {
                  const locked = isProtectedColumn(col);
                  return (
                    <tr key={col.id}>
                      <td>{col.label}</td>
                      <td>
                        <code>{col.field_key}</code>
                      </td>
                      <td>
                        {locked ? (
                          <span className="badge">Standar (terkunci)</span>
                        ) : (
                          <span className="badge">Kustom</span>
                        )}
                      </td>
                      <td>
                        <div className="user-actions">
                          <Link
                            className="btn btn-ghost"
                            href={`/kolom/edit/${col.id}`}
                          >
                            Edit
                          </Link>
                          {locked ? null : (
                            <Link
                              className="btn btn-danger"
                              href={`/kolom/hapus/${col.id}`}
                            >
                              Hapus
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
