import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar, ProgressRing } from "@/components/ProgressVisuals";
import { WorkWithSubsForm } from "@/components/WorkWithSubsForm";
import { deleteWorkAction, updateWorkAction } from "@/lib/progress-actions";
import { getWork, listSubs, listWorks } from "@/lib/progress-db";
import {
  STATUS_LABEL,
  formatDateID,
  formatPoints,
  presentWork,
  statusBadgeClass,
  todayIso,
} from "@/lib/progress";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  ditambah: "Pekerjaan tersimpan. Persentase dihitung otomatis dari sub pekerjaan.",
  diubah: "Perubahan tersimpan. Persentase dihitung ulang otomatis.",
  subditambah: "Sub pekerjaan berhasil ditambahkan.",
  subdiubah: "Sub pekerjaan berhasil disimpan. Persentase ikut diperbarui.",
  subdihapus: "Sub pekerjaan berhasil dihapus.",
};

export default async function ProgressDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string; hapus?: string }>;
}) {
  const { id: rawId } = await params;
  const query = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [work, subs, works] = await Promise.all([
    getWork(id),
    listSubs(id),
    listWorks(),
  ]);
  if (!work) notFound();

  const view = presentWork(work, subs, todayIso(), works.length);
  const message = query.msg ? MESSAGES[query.msg] : "";

  if (query.hapus === "ya") {
    return (
      <div className="card confirm-card">
        <h2>Hapus pekerjaan</h2>
        <p>
          Yakin ingin menghapus <strong>{view.title}</strong> beserta seluruh
          sub pekerjaannya? Tindakan ini tidak bisa dibatalkan.
        </p>
        <form action={deleteWorkAction.bind(null, view.id)} className="form-actions">
          <button className="btn btn-danger" type="submit">
            Ya, hapus
          </button>
          <Link className="btn btn-ghost" href={`/progress/${view.id}`}>
            Batal
          </Link>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="hero">
        <div>
          <p className="prg-kicker">
            <Link href="/progress">Progress pekerjaan</Link>
          </p>
          <h2>{view.title}</h2>
          <p>
            {view.owner || "Belum ada penanggung jawab"}
            {view.start_date ? ` · Mulai ${formatDateID(view.start_date)}` : ""}
            {view.due_date ? ` · Target ${formatDateID(view.due_date)}` : ""}
          </p>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-ghost" href="/progress">
            Kembali
          </Link>
          <Link className="btn btn-danger" href={`/progress/${view.id}?hapus=ya`}>
            Hapus
          </Link>
        </div>
      </div>

      {message ? <p className="flash flash-ok">{message}</p> : null}
      {query.err ? <p className="flash flash-err">{query.err}</p> : null}

      <section className="card prg-overview prg-overview-detail">
        <ProgressRing value={view.progress} label="Pekerjaan ini" />
        <div>
          <div className="prg-badges">
            <span className={statusBadgeClass(view.status)}>
              {STATUS_LABEL[view.status]}
            </span>
            <span className="badge">Otomatis dari sub pekerjaan</span>
          </div>
          <h3>{view.progress}% tercapai</h3>
          <p>
            {view.usesSubs
              ? `${view.subs.filter((sub) => sub.progress >= 100).length} dari ${view.subs.length} sub pekerjaan Complete.`
              : "Belum ada sub pekerjaan, jadi pencapaian masih 0% sampai ada sub yang Complete."}
          </p>
          <div className="prg-metrics">
            <div>
              <span>Sub selesai</span>
              <strong>
                {view.subs.filter((sub) => sub.progress >= 100).length}
              </strong>
            </div>
            <div>
              <span>Porsi dari total</span>
              <strong>{formatPoints(view.weightShare)}%</strong>
            </div>
            <div>
              <span>Kontribusi</span>
              <strong>{formatPoints(view.contribution)}%</strong>
            </div>
            <div>
              <span>Sub pekerjaan</span>
              <strong>{view.subs.length}</strong>
            </div>
          </div>
          <p className="prg-formula">
            {view.usesSubs
              ? `${view.subs.filter((sub) => sub.progress >= 100).length} dari ${view.subs.length} sub pekerjaan Complete = ${view.progress}%.`
              : "Isi sub pekerjaan di bawah, lalu centang Complete agar persentase bertambah."}{" "}
            Kontribusi ke keseluruhan {formatPoints(view.contribution)}%.
          </p>
          <ProgressBar
            value={view.progress}
            status={view.status}
            label={`Pencapaian ${view.title}`}
          />
        </div>
      </section>

      <h3 className="prg-section">Pekerjaan dan sub pekerjaan</h3>
      <WorkWithSubsForm
        action={updateWorkAction.bind(null, view.id)}
        submitLabel="Simpan dan hitung ulang"
        cancelHref="/progress"
        values={{
          title: view.title,
          description: view.description,
          owner: view.owner,
          start_date: view.start_date,
          due_date: view.due_date,
        }}
        subs={view.subs.map((sub) => ({
          id: sub.id,
          title: sub.title,
          progress: sub.progress,
          note: sub.description,
        }))}
      />
    </>
  );
}
