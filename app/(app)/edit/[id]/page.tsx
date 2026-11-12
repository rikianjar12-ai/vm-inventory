import { notFound } from "next/navigation";
import { VmForm } from "@/components/VmForm";
import { updateVmAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getVm, listColumns } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const vmId = Number(id);
  const [columns, vm] = await Promise.all([listColumns(), getVm(vmId)]);
  if (!vm) notFound();

  const action = updateVmAction.bind(null, vmId);

  return (
    <>
      <div className="hero">
        <div>
          <h2>Edit Virtual Machine</h2>
          <p>{vm.data.server_id || `VM #${vm.id}`}</p>
        </div>
      </div>
      <VmForm
        action={action}
        columns={columns}
        values={vm.data}
        submitLabel="Simpan Perubahan"
      />
    </>
  );
}
