"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Peserta } from "@/lib/client";

export default function PesertaPage() {
  const [list, setList] = useState<Peserta[]>([]);
  const [nama, setNama] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/peserta", { cache: "no-store" });
    const data = await res.json();
    setList(data);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function addOne(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/peserta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, keterangan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah");
      setNama("");
      setKeterangan("");
      setMsg("Peserta ditambahkan");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setLoading(false);
    }
  }

  async function addBulk(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const lines = bulk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      setError("Isi minimal satu nama (satu baris satu peserta)");
      return;
    }
    setLoading(true);
    try {
      for (const line of lines) {
        const [n, ...rest] = line.split("|");
        const res = await fetch("/api/peserta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama: n.trim(),
            keterangan: rest.join("|").trim(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Gagal menambah: ${line}`);
        }
      }
      setBulk("");
      setMsg(`${lines.length} peserta ditambahkan`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus peserta ini?")) return;
    await fetch(`/api/peserta?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="grid-2">
      <section className="panel">
        <h1>Daftar Peserta</h1>
        <p className="lead">Tambah peserta satu per satu atau tempel daftar.</p>

        <form onSubmit={addOne}>
          <div className="form-row">
            <label htmlFor="nama">Nama</label>
            <input
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama peserta"
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="ket">Keterangan (opsional)</label>
            <input
              id="ket"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Divisi / nomor undian / dll"
            />
          </div>
          <button className="btn btn-mint" type="submit" disabled={loading}>
            Tambah Peserta
          </button>
        </form>

        <form onSubmit={addBulk} style={{ marginTop: "1.4rem" }}>
          <div className="form-row">
            <label htmlFor="bulk">Import massal (satu baris = satu peserta)</label>
            <textarea
              id="bulk"
              rows={7}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"Andi\nBudi|IT\nCitra|Operasi"}
            />
            <p className="hint">Format opsional: Nama|Keterangan</p>
          </div>
          <button className="btn btn-ghost" type="submit" disabled={loading}>
            Import Daftar
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="success">{msg}</p> : null}
      </section>

      <section className="panel">
        <div className="actions" style={{ justifyContent: "space-between", marginBottom: "0.8rem" }}>
          <h2 style={{ margin: 0 }}>
            Peserta terdaftar{" "}
            <span className="badge badge-mint">{list.length}</span>
          </h2>
          <button
            type="button"
            className="btn btn-mint"
            disabled={list.length < 2 || loading}
            onClick={async () => {
              setError("");
              setMsg("");
              setLoading(true);
              try {
                const res = await fetch("/api/peserta/acak", { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Gagal mengacak");
                setMsg(data.message || "Nama berhasil diacak");
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal");
              } finally {
                setLoading(false);
              }
            }}
          >
            Acak Nama
          </button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Tombol Acak Nama mengacak urutan daftar agar lebih adil sebelum undian.
        </p>
        <div className="table-wrap" style={{ marginTop: "0.8rem" }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nama</th>
                <th>Keterangan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={4}>Belum ada peserta</td>
                </tr>
              ) : (
                list.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.nama}</td>
                    <td>{p.keterangan || "—"}</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => remove(p.id)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
