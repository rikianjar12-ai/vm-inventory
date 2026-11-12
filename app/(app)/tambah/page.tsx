import { VmForm } from "@/components/VmForm";
import { createVmAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { listColumns } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TambahPage() {
  await requireAdmin();
  const columns = await listColumns();

  return (
    <>
      <div className="hero">
        <div>
          <h2>Tambah Virtual Machine</h2>
          <p>Isi data inventory untuk VM baru di server.</p>
        </div>
      </div>
      <VmForm
        action={createVmAction}
        columns={columns}
        values={{}}
        submitLabel="Simpan VM"
      />
    </>
  );
}
