import { WorkWithSubsForm } from "@/components/WorkWithSubsForm";
import { createWorkAction } from "@/lib/progress-actions";

export const dynamic = "force-dynamic";

export default async function ProgressBaruPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <div className="hero">
        <div>
          <h2>Tambah pekerjaan</h2>
          <p>
            Isi pekerjaan utama beserta sub pekerjaannya. Persentase utama
            terhitung dari sub pekerjaan yang dicentang Complete.
          </p>
        </div>
      </div>
      {params.err ? <p className="flash flash-err">{params.err}</p> : null}
      <WorkWithSubsForm
        action={createWorkAction}
        submitLabel="Simpan pekerjaan"
        cancelHref="/progress"
        values={{
          title: "",
          description: "",
          owner: "",
          start_date: "",
          due_date: "",
        }}
        subs={[]}
      />
    </>
  );
}
