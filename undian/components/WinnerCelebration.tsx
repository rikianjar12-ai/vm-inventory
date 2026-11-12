"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  pesertaNama: string;
  hadiahNama: string;
  namaKegiatan: string;
  onClose: () => void;
};

type Particle = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
  drift: number;
};

const COLORS = ["#e4b454", "#3dcfb0", "#f0d48a", "#79e4cb", "#ff8e6b", "#fff4c8"];

export function WinnerCelebration({
  open,
  pesertaNama,
  hadiahNama,
  namaKegiatan,
  onClose,
}: Props) {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setBurstKey((k) => k + 1);
  }, [open, pesertaNama, hadiahNama]);

  const particles = useMemo<Particle[]>(() => {
    if (!open) return [];
    return Array.from({ length: 48 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.2 + Math.random() * 2.4,
      size: 6 + Math.random() * 10,
      color: COLORS[i % COLORS.length],
      rotate: Math.random() * 360,
      drift: -40 + Math.random() * 80,
    }));
  }, [open, burstKey]);

  if (!open) return null;

  return (
    <div className="celebrate-overlay" role="dialog" aria-modal="true">
      <div className="celebrate-burst" key={burstKey}>
        {particles.map((p) => (
          <span
            key={p.id}
            className="celebrate-particle"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.55,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--drift" as string]: `${p.drift}px`,
              ["--rot" as string]: `${p.rotate}deg`,
            }}
          />
        ))}
      </div>

      <div className="celebrate-card">
        <div className="celebrate-rings" aria-hidden />
        <p className="celebrate-eyebrow">{namaKegiatan}</p>
        <h2 className="celebrate-title">Selamat!</h2>
        <p className="celebrate-name">{pesertaNama}</p>
        <p className="celebrate-prize">
          Memenangkan <strong>{hadiahNama}</strong>
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Tutup Animasi
        </button>
      </div>
    </div>
  );
}
