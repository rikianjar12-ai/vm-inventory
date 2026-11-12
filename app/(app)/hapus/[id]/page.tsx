import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteVmAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getVm } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HapusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const vm = await getVm(Number(id));
  if (!vm) notFound();

  const action = deleteVmAction.bind(null, vm.id);

  return (
    <div className="card confirm-card">
      <h2>Hapus Virtual Machine</h2>
      <p>
        Yakin ingin menghapus{" "}
        <strong>{vm.data.server_id || `VM #${vm.id}`}</strong> (
        {vm.data.ip || "tanpa IP"})? Tindakan ini tidak bisa dibatalkan.
      </p>
      <dl className="confirm-meta">
        <div>
          <dt>Status</dt>
          <dd>{vm.data.system_status || "-"}</dd>
        </div>
        <div>
          <dt>Aplikasi</dt>
          <dd>{vm.data.application || "-"}</dd>
        </div>
        <div>
          <dt>Lokasi</dt>
          <dd>{vm.data.lokasi_server || "-"}</dd>
        </div>
      </dl>
      <form action={action} className="form-actions">
        <button className="btn btn-danger" type="submit">
          Ya, hapus
        </button>
        <Link className="btn btn-ghost" href="/">
          Batal
        </Link>
      </form>
    </div>
  );
}
