"use client";

import Link from "next/link";
import { useState } from "react";

type Phase = "progress" | "complete";

type Row = {
  key: string;
  id: number | null;
  title: string;
  state: Phase;
  note: string;
};

const PLACEHOLDERS = [
  "Penyiapan server",
  "Pembuatan akses",
  "Sub pekerjaan lain",
];

function startingRows(
  subs: Array<{ id: number; title: string; progress: number; note: string }>
): Row[] {
  if (subs.length === 0) {
    return [
      { key: "baru-1", id: null, title: "", state: "progress", note: "" },
      { key: "baru-2", id: null, title: "", state: "progress", note: "" },
    ];
  }
  return subs.map((sub) => ({
    key: `sub-${sub.id}`,
    id: sub.id,
    title: sub.title,
    state: sub.progress >= 100 ? "complete" : "progress",
    note: sub.note,
  }));
}

export function WorkWithSubsForm({
  action,
  submitLabel,
  cancelHref,
  values,
  subs,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  cancelHref: string;
  values: {
    title: string;
    description: string;
    owner: string;
    start_date: string;
    due_date: string;
  };
  subs: Array<{ id: number; title: string; progress: number; note: string }>;
}) {
  const [rows, setRows] = useState(() => startingRows(subs));
  const named = rows.filter((row) => row.title.trim());
  const done = named.filter((row) => row.state === "complete").length;
  const auto = named.length === 0 ? 0 : Math.round((done / named.length) * 100);

  function patch(key: string, next: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...next } : row))
    );
  }

  return (
    <form className="card" action={action}>
      <input type="hidden" name="weight" value="1" />
      <input type="hidden" name="manual_progress" value={String(auto)} />
      <input type="hidden" name="subs_included" value="1" />

      <div className="prg-auto">
        <div>
          <span>Pencapaian otomatis</span>
          <p>
            {named.length === 0
              ? "Isi sub pekerjaan. Hanya yang dicentang Complete yang masuk ke persentase."
              : `${done} dari ${named.length} sub pekerjaan Complete.`}
          </p>
        </div>
        <strong>{auto}%</strong>
      </div>

      <div className="form-section">
        <div className="field prg-span">
          <label htmlFor="title">Pekerjaan utama</label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={values.title}
            placeholder="Migrasi server AFC ke DRC Bandung"
          />
        </div>
        <div className="field prg-span">
          <label htmlFor="description">Deskripsi</label>
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={4000}
            defaultValue={values.description}
            placeholder="Ringkasan pekerjaan utama"
          />
        </div>
        <div className="field">
          <label htmlFor="owner">Penanggung jawab</label>
          <input
            id="owner"
            name="owner"
            maxLength={128}
            defaultValue={values.owner}
            placeholder="Nama tim atau orang"
          />
        </div>
        <div className="field">
          <label htmlFor="start_date">Tanggal mulai</label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={values.start_date}
          />
        </div>
        <div className="field">
          <label htmlFor="due_date">Target selesai</label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={values.due_date}
          />
        </div>
      </div>

      <div className="prg-sub-editor">
        <h3>Sub pekerjaan</h3>
        <p className="prg-hint">
          Centang In Progress untuk mencatat perkembangan, atau Complete bila
          bagian itu sudah selesai. Persentase pekerjaan utama bertambah setiap
          ada sub yang Complete.
        </p>
        {rows.map((row, index) => (
          <div className="prg-sub-block" key={row.key}>
            <div className="prg-sub-line">
              <input type="hidden" name="sub_id" value={row.id ?? ""} />
              <input type="hidden" name="sub_state" value={row.state} />
              <input
                name="sub_title"
                maxLength={200}
                value={row.title}
                placeholder={PLACEHOLDERS[index] ?? "Sub pekerjaan lain"}
                aria-label={`Nama sub pekerjaan ${index + 1}`}
                onChange={(event) => patch(row.key, { title: event.target.value })}
              />
              <label className="prg-check">
                <input
                  type="checkbox"
                  checked={row.state === "progress"}
                  onChange={(event) => {
                    if (event.target.checked) patch(row.key, { state: "progress" });
                  }}
                />
                In Progress
              </label>
              <label className="prg-check">
                <input
                  type="checkbox"
                  checked={row.state === "complete"}
                  onChange={(event) => {
                    if (event.target.checked) patch(row.key, { state: "complete" });
                  }}
                />
                Complete
              </label>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() =>
                  setRows((current) => current.filter((item) => item.key !== row.key))
                }
              >
                Hapus
              </button>
            </div>
            {row.state === "progress" ? (
              <textarea
                name="sub_note"
                rows={2}
                maxLength={4000}
                value={row.note}
                placeholder="Keterangan perkembangan, misalnya server sudah dinyalakan dan menunggu akses jaringan"
                aria-label={`Keterangan sub pekerjaan ${index + 1}`}
                onChange={(event) => patch(row.key, { note: event.target.value })}
              />
            ) : (
              <input type="hidden" name="sub_note" value={row.note} />
            )}
          </div>
        ))}
        <div className="form-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  key: `baru-${Date.now()}-${current.length}`,
                  id: null,
                  title: "",
                  state: "progress",
                  note: "",
                },
              ])
            }
          >
            + Tambah sub pekerjaan
          </button>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit">
          {submitLabel}
        </button>
        <Link className="btn btn-ghost" href={cancelHref}>
          Batal
        </Link>
      </div>
    </form>
  );
}
