import { promises as fs } from "fs";
import path from "path";
import type { Hadiah, Peserta, Pemenang, StoreData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

export const DEFAULT_NAMA_KEGIATAN = "Undian Hadiah";

const emptyStore = (): StoreData => ({
  pengaturan: { namaKegiatan: DEFAULT_NAMA_KEGIATAN },
  peserta: [],
  hadiah: [],
  pemenang: [],
});

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(emptyStore(), null, 2), "utf8");
  }
}

function normalize(parsed: Partial<StoreData>): StoreData {
  return {
    pengaturan: {
      namaKegiatan:
        String(parsed.pengaturan?.namaKegiatan ?? "").trim() ||
        DEFAULT_NAMA_KEGIATAN,
    },
    peserta: Array.isArray(parsed.peserta) ? parsed.peserta : [],
    hadiah: Array.isArray(parsed.hadiah) ? parsed.hadiah : [],
    pemenang: Array.isArray(parsed.pemenang) ? parsed.pemenang : [],
  };
}

export async function readStore(): Promise<StoreData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    return normalize(JSON.parse(raw) as Partial<StoreData>);
  } catch {
    return emptyStore();
  }
}

export async function writeStore(data: StoreData): Promise<void> {
  await ensureFile();
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify(normalize(data), null, 2),
    "utf8"
  );
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function hadiahTersisa(hadiah: Hadiah, pemenang: Pemenang[]): number {
  const taken = pemenang.filter((p) => p.hadiahId === hadiah.id).length;
  return Math.max(0, hadiah.jumlah - taken);
}

export function nextHadiahToDraw(
  hadiah: Hadiah[],
  pemenang: Pemenang[]
): Hadiah | null {
  const sorted = [...hadiah].sort(
    (a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama)
  );
  for (const h of sorted) {
    if (hadiahTersisa(h, pemenang) > 0) return h;
  }
  return null;
}

export function eligiblePeserta(
  peserta: Peserta[],
  pemenang: Pemenang[]
): Peserta[] {
  const won = new Set(pemenang.map((p) => p.pesertaId));
  return peserta.filter((p) => !won.has(p.id));
}

/** Fisher–Yates shuffle untuk urutan adil */
export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
