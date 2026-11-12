"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WinnerCelebration } from "@/components/WinnerCelebration";
import {
  DRAW_DURATION_MS,
  fetchState,
  type AppState,
  type Peserta,
} from "@/lib/client";

function shuffleLocal<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export default function UndianPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [displayName, setDisplayName] = useState("Siap undi");
  const [winnerMode, setWinnerMode] = useState(false);
  const [lastPrizeName, setLastPrizeName] = useState("");
  const [lastWinnerName, setLastWinnerName] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [selectedHadiahId, setSelectedHadiahId] = useState("");
  const [remainSec, setRemainSec] = useState(30);
  const [progress, setProgress] = useState(0);
  const [shuffling, setShuffling] = useState(false);
  const tickRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    tickRef.current = null;
    countdownRef.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const load = useCallback(async () => {
    const data = await fetchState();
    setState(data);
    if (!selectedHadiahId && data.nextHadiah) {
      setSelectedHadiahId(data.nextHadiah.id);
    }
  }, [selectedHadiahId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const queue = useMemo(() => state?.hadiah ?? [], [state]);
  const activeHadiah =
    queue.find((h) => h.id === selectedHadiahId) ?? state?.nextHadiah ?? null;
  const namaKegiatan = state?.pengaturan?.namaKegiatan || "Undian Hadiah";

  async function acakNama() {
    setError("");
    setMsg("");
    setShuffling(true);
    try {
      const res = await fetch("/api/peserta/acak", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengacak");
      setMsg(data.message || "Nama berhasil diacak");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengacak");
    } finally {
      setShuffling(false);
    }
  }

  async function handleDraw() {
    if (!state || spinning) return;
    setError("");
    setMsg("");
    setWinnerMode(false);
    setCelebrate(false);

    let pool: Peserta[] = state.peserta.filter(
      (p) => !state.pemenang.some((w) => w.pesertaId === p.id)
    );
    if (!pool.length) {
      setError("Tidak ada peserta eligible");
      return;
    }
    if (!activeHadiah || (activeHadiah.tersisa ?? 0) <= 0) {
      setError("Pilih hadiah yang masih ada kuota");
      return;
    }

    // Acak dulu urutan pool agar putaran visual lebih adil
    pool = shuffleLocal(pool);

    setSpinning(true);
    setRemainSec(30);
    setProgress(0);
    const start = Date.now();

    tickRef.current = window.setInterval(() => {
      const name = pool[Math.floor(Math.random() * pool.length)].nama;
      setDisplayName(name);
    }, 80);

    countdownRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, Math.ceil((DRAW_DURATION_MS - elapsed) / 1000));
      setRemainSec(left);
      setProgress(Math.min(1, elapsed / DRAW_DURATION_MS));
    }, 100);

    try {
      // Tunggu hampir selesai animasi, baru ambil pemenang dari server
      await new Promise((r) => setTimeout(r, DRAW_DURATION_MS - 400));

      const res = await fetch("/api/undi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hadiahId: activeHadiah.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Undian gagal");

      const elapsed = Date.now() - start;
      const wait = Math.max(0, DRAW_DURATION_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));
      clearTimers();

      setDisplayName(data.pemenang.pesertaNama);
      setLastWinnerName(data.pemenang.pesertaNama);
      setLastPrizeName(data.pemenang.hadiahNama);
      setWinnerMode(true);
      setCelebrate(true);
      setRemainSec(0);
      setProgress(1);
      await load();
      if (data.nextHadiah?.id) setSelectedHadiahId(data.nextHadiah.id);
    } catch (e) {
      clearTimers();
      setError(e instanceof Error ? e.message : "Undian gagal");
      setDisplayName("Siap undi");
      setRemainSec(30);
    } finally {
      setSpinning(false);
    }
  }

  async function resetPemenang() {
    if (!confirm("Reset semua hasil undian? Peserta & hadiah tetap ada.")) return;
    await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "pemenang" }),
    });
    setDisplayName("Siap undi");
    setWinnerMode(false);
    setCelebrate(false);
    setRemainSec(30);
    await load();
  }

  if (!state) {
    return (
      <section className="panel">
        <p className="lead">Memuat data undian…</p>
      </section>
    );
  }

  return (
    <>
      <div className="grid-2">
        <section className="panel">
          <h1>{namaKegiatan}</h1>
          <p className="lead">
            Putaran undian berlangsung 30 detik. Acak nama dulu agar urutan
            tampilan lebih adil, lalu undi hadiah yang dipilih.
          </p>

          <div className="stats">
            <div className="stat">
              <span>Peserta eligible</span>
              <strong>{state.eligibleCount}</strong>
            </div>
            <div className="stat">
              <span>Total hadiah item</span>
              <strong>
                {state.hadiah.reduce((s, h) => s + (h.tersisa ?? 0), 0)}
              </strong>
            </div>
            <div className="stat">
              <span>Sudah diundi</span>
              <strong>{state.pemenang.length}</strong>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="hadiah">Hadiah yang diundi sekarang</label>
            <select
              id="hadiah"
              value={selectedHadiahId}
              onChange={(e) => setSelectedHadiahId(e.target.value)}
              disabled={spinning}
            >
              {queue
                .filter((h) => (h.tersisa ?? 0) > 0)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    #{h.urutan} — {h.nama} (sisa {h.tersisa}/{h.jumlah})
                  </option>
                ))}
            </select>
          </div>

          <div className={`draw-stage ${spinning ? "is-spinning" : ""} ${winnerMode ? "is-winner" : ""}`}>
            <div className="draw-inner">
              <div className="draw-label">
                {activeHadiah
                  ? `Hadiah: ${activeHadiah.nama}`
                  : "Belum ada hadiah tersisa"}
              </div>
              {spinning ? (
                <div className="draw-timer" aria-live="polite">
                  <div
                    className="draw-timer-ring"
                    style={{
                      ["--progress" as string]: String(progress),
                    }}
                  />
                  <span>{remainSec}s</span>
                </div>
              ) : null}
              <p
                className={`draw-name ${spinning ? "spinning" : ""} ${
                  winnerMode ? "winner" : ""
                }`}
              >
                {displayName}
              </p>
              {winnerMode && lastPrizeName ? (
                <div className="draw-sub">
                  Selamat! Pemenang {lastPrizeName}
                </div>
              ) : spinning ? (
                <div className="draw-sub">Mengundi… tunggu {remainSec} detik</div>
              ) : (
                <div className="draw-sub">Acak peserta secara adil</div>
              )}
            </div>
          </div>

          <div className="actions" style={{ marginTop: "1rem" }}>
            <button
              className="btn btn-mint"
              onClick={acakNama}
              disabled={spinning || shuffling || state.peserta.length < 2}
              type="button"
            >
              {shuffling ? "Mengacak…" : "Acak Nama"}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleDraw}
              disabled={
                spinning ||
                !activeHadiah ||
                state.eligibleCount === 0 ||
                (activeHadiah.tersisa ?? 0) <= 0
              }
            >
              {spinning ? `Mengundi (${remainSec}s)` : "Undi 30 Detik"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={resetPemenang}
              disabled={spinning}
            >
              Reset Hasil Undian
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          {msg ? <p className="success">{msg}</p> : null}
        </section>

        <section className="panel">
          <h2>Antrian Hadiah</h2>
          <p className="lead">Urutan undian dari menu hadiah.</p>
          <ul className="hadiah-queue">
            {queue.length === 0 ? (
              <li>
                <span className="ord">–</span>
                <div>
                  <strong>Belum ada hadiah</strong>
                  <div className="hint">Tambah di menu Daftar Hadiah</div>
                </div>
                <span className="badge badge-muted">0</span>
              </li>
            ) : (
              queue.map((h) => {
                const done = (h.tersisa ?? 0) <= 0;
                const current = h.id === selectedHadiahId && !done;
                return (
                  <li
                    key={h.id}
                    className={`${done ? "done" : ""} ${current ? "current" : ""}`}
                  >
                    <span className="ord">{h.urutan}</span>
                    <div>
                      <strong>{h.nama}</strong>
                      <div className="hint">
                        {done
                          ? "Selesai"
                          : current
                            ? "Sedang dipilih"
                            : "Menunggu"}
                      </div>
                    </div>
                    <span
                      className={`badge ${done ? "badge-muted" : "badge-gold"}`}
                    >
                      {h.tersisa}/{h.jumlah}
                    </span>
                  </li>
                );
              })
            )}
          </ul>

          <h2 style={{ marginTop: "1.4rem" }}>Pemenang Terbaru</h2>
          <div className="table-wrap" style={{ marginTop: "0.7rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Peserta</th>
                  <th>Hadiah</th>
                </tr>
              </thead>
              <tbody>
                {state.pemenang.length === 0 ? (
                  <tr>
                    <td colSpan={2}>Belum ada pemenang</td>
                  </tr>
                ) : (
                  state.pemenang.slice(0, 12).map((p) => (
                    <tr key={p.id}>
                      <td>{p.pesertaNama}</td>
                      <td>{p.hadiahNama}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <WinnerCelebration
        open={celebrate}
        pesertaNama={lastWinnerName}
        hadiahNama={lastPrizeName}
        namaKegiatan={namaKegiatan}
        onClose={() => setCelebrate(false)}
      />
    </>
  );
}
