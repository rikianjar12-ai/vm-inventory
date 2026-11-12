"use client";

import { FormEvent, useEffect, useState } from "react";

export default function PengaturanPage() {
  const [namaKegiatan, setNamaKegiatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/pengaturan", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setNamaKegiatan(d.namaKegiatan || ""))
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/pengaturan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaKegiatan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setNamaKegiatan(data.namaKegiatan);
      setMsg("Nama kegiatan disimpan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" style={{ maxWidth: 640 }}>
      <h1>Pengaturan Kegiatan</h1>
      <p className="lead">
        Ubah nama kegiatan. Nama ini tampil di header dan di panggung undian.
      </p>

      <form onSubmit={save}>
        <div className="form-row">
          <label htmlFor="namaKegiatan">Nama kegiatan</label>
          <input
            id="namaKegiatan"
            value={namaKegiatan}
            onChange={(e) => setNamaKegiatan(e.target.value)}
            placeholder="Contoh: Undian Doorprize HUT LRT 2026"
            maxLength={120}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Menyimpan…" : "Simpan Nama Kegiatan"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="success">{msg}</p> : null}
    </section>
  );
}
