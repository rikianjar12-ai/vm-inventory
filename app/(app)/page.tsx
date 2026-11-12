import Link from "next/link";
import { listColumns, listVms } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ExportMenu } from "@/components/ExportMenu";
import {
  groupedSections,
  isGroupedHeader,
  sectionTitle,
  statusClass,
} from "@/lib/types";
import { grafanaDashboardUrl } from "@/lib/grafana";

export const dynamic = "force-dynamic";

function columnClass(fieldKey: string) {
  if (fieldKey === "system_status") return "col-sticky col-status";
  if (fieldKey === "server_id") return "col-sticky col-server";
  return undefined;
}

const MESSAGES: Record<string, string> = {
  ditambah: "Virtual machine berhasil ditambahkan.",
  diubah: "Data VM berhasil diperbarui.",
  dihapus: "Virtual machine berhasil dihapus.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const statusFilter = (params.status ?? "").trim().toUpperCase();
  const msg = params.msg ? MESSAGES[params.msg] : "";

  const [columns, rows, user] = await Promise.all([
    listColumns(),
    listVms(),
    getCurrentUser(),
  ]);
  const isAdmin = user?.role === "admin";
  const sections = groupedSections(columns);
  const hasGrouped = sections.some(isGroupedHeader);
  const rowSpan = hasGrouped ? 2 : 1;

  const filtered = rows.filter((row) => {
    const haystack = Object.values(row.data).join(" ").toLowerCase();
    const status = String(row.data.system_status ?? "").toUpperCase();
    if (q && !haystack.includes(q)) return false;
    if (statusFilter && status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: rows.length,
    up: rows.filter((r) => String(r.data.system_status).toUpperCase() === "UP")
      .length,
    down: rows.filter(
      (r) => String(r.data.system_status).toUpperCase() === "DOWN"
    ).length,
    maintenance: rows.filter(
      (r) => String(r.data.system_status).toUpperCase() === "MAINTENANCE"
    ).length,
  };

  const emptyAll = rows.length === 0;
  const emptyFilter = !emptyAll && filtered.length === 0;

  function filterHref(status: string) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    const query = next.toString();
    return query ? `/?${query}` : "/";
  }

  return (
    <>
      <div className="hero">
        <div>
          <h2>
            Dashboard <span className="accent">Inventory</span>
          </h2>
          <p>
            {isAdmin
              ? "Kelola status, spesifikasi, dan versi aplikasi pada setiap VM."
              : "Tampilan inventory virtual machine (hanya lihat)."}
          </p>
        </div>
        <div className="hero-actions">
          <a
            className="btn btn-ghost"
            href={grafanaDashboardUrl()}
            target="_blank"
            rel="noreferrer"
          >
            Grafana
          </a>
          <ExportMenu />
          {isAdmin ? (
            <Link className="btn btn-primary" href="/tambah">
              + Tambah VM
            </Link>
          ) : null}
        </div>
      </div>

      <div className="stats">
        <Link
          className={`stat${statusFilter ? "" : " stat-active"}`}
          href={filterHref("")}
          aria-current={!statusFilter ? "page" : undefined}
        >
          <span>Total VM</span>
          <strong>{stats.total}</strong>
        </Link>
        <Link
          className={`stat${statusFilter === "UP" ? " stat-active" : ""}`}
          href={filterHref("UP")}
          aria-current={statusFilter === "UP" ? "page" : undefined}
        >
          <span>UP</span>
          <strong>{stats.up}</strong>
        </Link>
        <Link
          className={`stat${statusFilter === "DOWN" ? " stat-active" : ""}`}
          href={filterHref("DOWN")}
          aria-current={statusFilter === "DOWN" ? "page" : undefined}
        >
          <span>DOWN</span>
          <strong>{stats.down}</strong>
        </Link>
        <Link
          className={`stat${statusFilter === "MAINTENANCE" ? " stat-active" : ""}`}
          href={filterHref("MAINTENANCE")}
          aria-current={statusFilter === "MAINTENANCE" ? "page" : undefined}
        >
          <span>Maintenance</span>
          <strong>{stats.maintenance}</strong>
        </Link>
      </div>

      {msg ? <div className="flash flash-ok">{msg}</div> : null}

      <form className="toolbar" method="get">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Cari IP, server, aplikasi..."
          aria-label="Kata kunci pencarian"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          aria-label="Filter status"
        >
          <option value="">Semua status</option>
          <option value="UP">UP</option>
          <option value="DOWN">DOWN</option>
          <option value="MAINTENANCE">MAINTENANCE</option>
        </select>
        <button className="btn btn-primary" type="submit">
          Filter
        </button>
        <Link className="btn btn-ghost" href="/">
          Reset
        </Link>
        <span className="toolbar-meta">
          Menampilkan {filtered.length} dari {rows.length} VM
        </span>
      </form>

      <div className="table-wrap">
        {emptyAll ? (
          <div className="empty">
            <strong>Belum ada virtual machine.</strong>
            <p>
              {isAdmin
                ? "Tambah VM pertama untuk mulai mengisi inventory."
                : "Belum ada data yang bisa ditampilkan."}
            </p>
            {isAdmin ? (
              <Link className="btn btn-primary" href="/tambah">
                + Tambah VM
              </Link>
            ) : null}
          </div>
        ) : emptyFilter ? (
          <div className="empty">
            <strong>Tidak ada data yang cocok.</strong>
            <p>Ubah kata kunci atau reset filter untuk melihat semua VM.</p>
            <Link className="btn btn-ghost" href="/">
              Reset filter
            </Link>
          </div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                {sections.flatMap((section) =>
                  isGroupedHeader(section)
                    ? [
                        <th
                          key={section.name}
                          className="group-head"
                          colSpan={section.columns.length}
                        >
                          {sectionTitle(section.name)}
                        </th>,
                      ]
                    : section.columns.map((col) => (
                        <th
                          key={col.id}
                          rowSpan={rowSpan}
                          className={columnClass(col.field_key)}
                        >
                          {col.label}
                        </th>
                      ))
                )}
                {isAdmin ? (
                  <th rowSpan={rowSpan} className="col-aksi">
                    Aksi
                  </th>
                ) : null}
              </tr>
              {hasGrouped ? (
                <tr>
                  {sections.flatMap((section) =>
                    isGroupedHeader(section)
                      ? section.columns.map((col) => (
                          <th key={col.id} className="sub-head">
                            {col.label}
                          </th>
                        ))
                      : []
                  )}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {filtered.map((vm) => (
                <tr key={vm.id}>
                  {columns.map((col) => (
                    <td key={col.id} className={columnClass(col.field_key)}>
                      {col.field_key === "system_status" ? (
                        <span
                          className={statusClass(vm.data[col.field_key] ?? "")}
                        >
                          {vm.data[col.field_key] || "-"}
                        </span>
                      ) : (
                        vm.data[col.field_key] || "-"
                      )}
                    </td>
                  ))}
                  {isAdmin ? (
                    <td className="col-aksi">
                      <div className="actions">
                        <Link className="btn btn-ghost" href={`/edit/${vm.id}`}>
                          Edit
                        </Link>
                        <Link className="btn btn-danger" href={`/hapus/${vm.id}`}>
                          Hapus
                        </Link>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
