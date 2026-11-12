import Link from "next/link";
import { ProgressBar, ProgressRing } from "@/components/ProgressVisuals";
import { listSubs, listWorks } from "@/lib/progress-db";
import {
  STATUS_LABEL,
  formatDateID,
  formatPoints,
  presentDashboard,
  statusBadgeClass,
  todayIso,
  type WorkStatus,
  type WorkView,
} from "@/lib/progress";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  dihapus: "Pekerjaan berhasil dihapus.",
};

function isStatus(value: string): value is WorkStatus {
  return (
    value === "selesai" ||
    value === "berjalan" ||
    value === "belum" ||
    value === "terlambat"
  );
}

function scheduleText(start: string, due: string) {
  const parts: string[] = [];
  if (start) parts.push(`Mulai ${formatDateID(start)}`);
  if (due) parts.push(`Target ${formatDateID(due)}`);
  return parts.join(" · ");
}

function filterHref(status: string, q: string) {
  const next = new URLSearchParams();
  if (q) next.set("q", q);
  if (status) next.set("status", status);
  const query = next.toString();
  return query ? `/progress?${query}` : "/progress";
}

function WorkCard({ work }: { work: WorkView }) {
  const schedule = scheduleText(work.start_date, work.due_date);
  return (
    <article className="card prg-work">
      <div className="prg-work-head">
        <div>
          <div className="prg-badges">
            <span className={statusBadgeClass(work.status)}>
              {STATUS_LABEL[work.status]}
            </span>
            <span className="badge">
              {work.usesSubs ? "Otomatis dari sub pekerjaan" : "Belum ada sub pekerjaan"}
            </span>
          </div>
          <h3>
            <Link href={`/progress/${work.id}`}>{work.title}</Link>
          </h3>
          <p className="prg-kicker">
            {work.owner || "Belum ada penanggung jawab"}
            {schedule ? ` · ${schedule}` : ""}
          </p>
        </div>
        <div className="prg-score">
          <strong className={work.status === "terlambat" ? "prg-pct late" : "prg-pct"}>
            {work.progress}%
          </strong>
          <span>pencapaian</span>
        </div>
      </div>

      {work.description ? <p className="prg-desc">{work.description}</p> : null}
      <ProgressBar
        value={work.progress}
        status={work.status}
        label={`Pencapaian ${work.title}`}
      />

      <div className="prg-metrics">
        <div>
          <span>Sub pekerjaan</span>
          <strong>{work.subs.length}</strong>
        </div>
        <div>
          <span>Sub selesai</span>
          <strong>
            {work.subs.filter((sub) => sub.progress >= 100).length}
          </strong>
        </div>
        <div>
          <span>Pencapaian</span>
          <strong>{work.progress}%</strong>
        </div>
        <div>
          <span>Kontribusi</span>
          <strong>{formatPoints(work.contribution)}%</strong>
        </div>
      </div>
      <p className="prg-formula">
        {work.usesSubs
          ? `${work.subs.filter((sub) => sub.progress >= 100).length} dari ${work.subs.length} sub pekerjaan Complete = ${work.progress}%.`
          : "Belum ada sub pekerjaan, jadi pencapaian masih 0%."}{" "}
        Kontribusi ke keseluruhan {formatPoints(work.contribution)}%.
      </p>

      <div className="prg-subhead">
        <h4>Sub pekerjaan yang menunjang</h4>
        <Link className="btn btn-primary" href={`/progress/${work.id}`}>
          Kelola
        </Link>
      </div>

      {work.subs.length === 0 ? (
        <p className="prg-kicker">
          Belum ada sub pekerjaan. Buka Kelola, lalu isi bagian seperti penyiapan
          server atau pembuatan akses.
        </p>
      ) : (
        <ul className="prg-subs">
          {work.subs.map((sub) => (
            <li key={sub.id} className="prg-sub">
              <div>
                <div className="prg-sub-title">{sub.title}</div>
                <div className="prg-sub-meta">
                  <span className={sub.progress >= 100 ? "badge badge-up" : "badge badge-maint"}>
                    {sub.progress >= 100 ? "Complete" : "In Progress"}
                  </span>
                </div>
                {sub.progress < 100 && sub.description ? (
                  <p className="prg-note">{sub.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const status = params.status && isStatus(params.status) ? params.status : "";
  const message = params.msg ? MESSAGES[params.msg] : "";
  const today = todayIso();

  const [works, subs] = await Promise.all([listWorks(), listSubs()]);
  const dashboard = presentDashboard(works, subs, today);
  const rank: Record<WorkStatus, number> = {
    terlambat: 0,
    berjalan: 1,
    belum: 2,
    selesai: 3,
  };

  const visible = dashboard.views
    .filter((work) => {
      if (status && work.status !== status) return false;
      if (!q) return true;
      const haystack = [
        work.title,
        work.description,
        work.owner,
        ...work.subs.flatMap((sub) => [sub.title, sub.description, sub.owner]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => {
      const byStatus = rank[a.status] - rank[b.status];
      if (byStatus) return byStatus;
      return (a.due_date || "9999-99-99").localeCompare(b.due_date || "9999-99-99");
    });

  const counts = dashboard.counts;

  return (
    <>
      <div className="hero">
        <div>
          <h2>
            Progress <span className="accent">Pekerjaan</span>
          </h2>
          <p>
            Pantau persentase pencapaian dari setiap pekerjaan dan sub pekerjaan
            yang menunjangnya.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/progress/baru">
            + Tambah pekerjaan
          </Link>
        </div>
      </div>

      {message ? <p className="flash flash-ok">{message}</p> : null}

      {counts.total === 0 ? (
        <div className="card empty">
          <strong>Belum ada pekerjaan</strong>
          <p>
            Tambah pekerjaan utama beserta sub pekerjaannya. Centang Complete
            pada sub yang sudah selesai agar persentasenya terakumulasi.
          </p>
          <Link className="btn btn-primary" href="/progress/baru">
            Tambah pekerjaan
          </Link>
        </div>
      ) : (
        <>
          <div className="prg-top">
            <section className="card prg-overview">
              <ProgressRing value={dashboard.overall} label="Keseluruhan" />
              <div>
                <h3>Pencapaian keseluruhan</h3>
                <p>
                  {counts.subTotal} sub pekerjaan menunjang {counts.total}{" "}
                  pekerjaan.
                </p>
                <p className="prg-formula">
                  Persentase tiap pekerjaan adalah jumlah sub yang Complete
                  dibagi seluruh sub pekerjaan. Persentase keseluruhan adalah
                  rata-rata seluruh pekerjaan.
                </p>
              </div>
            </section>
            <div className="stats">
              <Link
                className={`stat${status ? "" : " stat-active"}`}
                href={filterHref("", q)}
                aria-current={!status ? "page" : undefined}
              >
                <span>Semua</span>
                <strong>{counts.total}</strong>
              </Link>
              <Link
                className={`stat${status === "terlambat" ? " stat-active" : ""}`}
                href={filterHref("terlambat", q)}
              >
                <span>Terlambat</span>
                <strong>{counts.terlambat}</strong>
              </Link>
              <Link
                className={`stat${status === "berjalan" ? " stat-active" : ""}`}
                href={filterHref("berjalan", q)}
              >
                <span>Berjalan</span>
                <strong>{counts.berjalan}</strong>
              </Link>
              <Link
                className={`stat${status === "belum" ? " stat-active" : ""}`}
                href={filterHref("belum", q)}
              >
                <span>Belum mulai</span>
                <strong>{counts.belum}</strong>
              </Link>
              <Link
                className={`stat${status === "selesai" ? " stat-active" : ""}`}
                href={filterHref("selesai", q)}
              >
                <span>Selesai</span>
                <strong>{counts.selesai}</strong>
              </Link>
            </div>
          </div>

          <form className="toolbar" action="/progress">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Cari pekerjaan atau sub pekerjaan"
              aria-label="Cari pekerjaan"
            />
            <button className="btn btn-primary" type="submit">
              Cari
            </button>
            {q || status ? (
              <Link className="btn btn-ghost" href="/progress">
                Reset
              </Link>
            ) : null}
            <span className="toolbar-meta">
              {visible.length} dari {counts.total} pekerjaan
              {status ? ` · ${STATUS_LABEL[status]}` : ""}
            </span>
          </form>

          {visible.length === 0 ? (
            <div className="card empty">
              <strong>Tidak ada pekerjaan pada saringan ini</strong>
              <p>Ubah kata kunci atau pilih status lain.</p>
            </div>
          ) : (
            <div className="prg-list">
              {visible.map((work) => (
                <WorkCard key={work.id} work={work} />
              ))}
            </div>
          )}

          <p className="prg-legend">
            Daftar diurutkan dari pekerjaan yang terlambat. Kontribusi = porsi
            bobot × pencapaian.
          </p>
        </>
      )}
    </>
  );
}
