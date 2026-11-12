export type HadiahView = {
  id: string;
  nama: string;
  jumlah: number;
  urutan: number;
  createdAt: string;
  tersisa?: number;
};

export type Peserta = {
  id: string;
  nama: string;
  keterangan: string;
  createdAt: string;
};

export type Pemenang = {
  id: string;
  hadiahId: string;
  hadiahNama: string;
  pesertaId: string;
  pesertaNama: string;
  drawnAt: string;
};

export type Pengaturan = {
  namaKegiatan: string;
};

export type AppState = {
  pengaturan: Pengaturan;
  peserta: Peserta[];
  hadiah: HadiahView[];
  pemenang: Pemenang[];
  nextHadiah: HadiahView | null;
  eligibleCount: number;
};

export const DRAW_DURATION_MS = 30_000;

export async function fetchState(): Promise<AppState> {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal memuat data");
  return res.json();
}
