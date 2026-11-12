"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { HadiahView } from "@/lib/client";

export default function HadiahPage() {
  const [list, setList] = useState<HadiahView[]>([]);
  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState(1);
  const [urutan, setUrutan] = useState<number | "">("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/hadiah", { cache: "no-store" });
    const data = await res.json();
    setList(data);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function addHadiah(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/hadiah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama,
          jumlah,
          urutan: urutan === "" ? undefined : Number(urutan),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah hadiah");
      setNama("");
      setJumlah(1);
      setUrutan("");
      setMsg("Hadiah ditambahkan");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setLoading(false);
    }
  }

  async function persistOrder(next: HadiahView[]) {
    setList(next);
    const res = await fetch("/api/hadiah", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((h) => h.id) }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Gagal menyimpan urutan");
      await load();
      return;
    }
    setMsg("Urutan undian disimpan — atas = diundi lebih dulu");
    await load();
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = list.findIndex((h) => h.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const next = [...list];
    const tmp = next[idx];
    next[idx] = next[swap];
    next[swap] = tmp;
    await persistOrder(next);
  }

  async function updateField(
    id: string,
    patch: { nama?: string; jumlah?: number; urutan?: number }
  ) {
    const res = await fetch("/api/hadiah", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Gagal mengubah");
      return;
    }
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Hapus hadiah ini?")) return;
    await fetch(`/api/hadiah?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="grid-2">
      <section className="panel">
        <h1>Daftar Hadiah</h1>
        <p className="lead">
          Atur hadiah dan tentukan urutan undian. Item paling atas diundi
          lebih dulu.
        </p>

        <form onSubmit={addHadiah}>
          <div className="form-row">
            <label htmlFor="nama">Nama hadiah</label>
            <input
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Smart TV 43 inch"
              required
            />
          </div>
          <div className="form-row inline">
            <div>
              <label htmlFor="jumlah">Jumlah kuota</label>
              <input
                id="jumlah"
                type="number"
                min={1}
                value={jumlah}
                onChange={(e) => setJumlah(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <label htmlFor="urutan">Urutan (opsional)</label>
              <input
                id="urutan"
                type="number"
                min={1}
                value={urutan}
                onChange={(e) =>
                  setUrutan(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="Otomatis"
              />
            </div>
          </div>
          <p className="hint">
            Kosongkan urutan untuk menaruh hadiah di akhir antrian.
          </p>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            Tambah Hadiah
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="success">{msg}</p> : null}
      </section>

      <section className="panel">
        <h2>
          Urutan undian <span className="badge badge-gold">{list.length}</span>
        </h2>
        <p className="hint" style={{ marginBottom: "0.8rem" }}>
          Gunakan tombol naik/turun untuk menentukan hadiah mana yang diundi
          lebih dulu.
        </p>

        <ul className="hadiah-queue">
          {list.length === 0 ? (
            <li>
              <span className="ord">–</span>
              <div>
                <strong>Belum ada hadiah</strong>
                <div className="hint">Tambahkan di formulir kiri</div>
              </div>
              <span className="badge badge-muted">0</span>
            </li>
          ) : (
            list.map((h, i) => (
              <li key={h.id}>
                <span className="ord">{i + 1}</span>
                <div>
                  <input
                    value={h.nama}
                    onChange={(e) =>
                      setList((prev) =>
                        prev.map((x) =>
                          x.id === h.id ? { ...x, nama: e.target.value } : x
                        )
                      )
                    }
                    onBlur={(e) => updateField(h.id, { nama: e.target.value })}
                    style={{ marginBottom: "0.4rem" }}
                  />
                  <div className="actions">
                    <label className="hint" htmlFor={`j-${h.id}`}>
                      Kuota
                    </label>
                    <input
                      id={`j-${h.id}`}
                      type="number"
                      min={1}
                      value={h.jumlah}
                      style={{ width: 80 }}
                      onChange={(e) =>
                        setList((prev) =>
                          prev.map((x) =>
                            x.id === h.id
                              ? {
                                  ...x,
                                  jumlah: Math.max(1, Number(e.target.value) || 1),
                                }
                              : x
                          )
                        )
                      }
                      onBlur={(e) =>
                        updateField(h.id, {
                          jumlah: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => move(h.id, -1)}
                      disabled={i === 0}
                    >
                      Naik
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => move(h.id, 1)}
                      disabled={i === list.length - 1}
                    >
                      Turun
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => remove(h.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                <span className="badge badge-gold">#{i + 1}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
