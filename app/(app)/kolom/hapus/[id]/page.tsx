import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteColumnAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getColumn } from "@/lib/db";
import { isProtectedColumn } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HapusKolomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const column = await getColumn(Number(id));
  if (!column) notFound();
  if (isProtectedColumn(column)) {
    redirect("/kolom?err=Kolom+standar+tidak+dapat+dihapus");
  }

  const action = deleteColumnAction.bind(null, column.id);

  return (
    <div className="card confirm-card">
      <h2>Hapus Kolom</h2>
      <p>
        Hapus kolom <strong>{column.label}</strong> (
        <code>{column.field_key}</code>) dari semua VM? Data pada kolom ini
        akan ikut dihapus.
      </p>
      <form action={action} className="form-actions">
        <button className="btn btn-danger" type="submit">
          Ya, hapus kolom
        </button>
        <Link className="btn btn-ghost" href="/kolom">
          Batal
        </Link>
      </form>
    </div>
  );
}
