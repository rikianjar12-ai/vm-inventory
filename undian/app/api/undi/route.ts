import { NextRequest, NextResponse } from "next/server";
import {
  eligiblePeserta,
  hadiahTersisa,
  newId,
  nextHadiahToDraw,
  readStore,
  writeStore,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const hadiahId = body.hadiahId ? String(body.hadiahId) : null;

  const store = await readStore();
  const target =
    (hadiahId
      ? store.hadiah.find((h) => h.id === hadiahId) ?? null
      : null) ?? nextHadiahToDraw(store.hadiah, store.pemenang);

  if (!target) {
    return NextResponse.json(
      { error: "Tidak ada hadiah tersisa untuk diundi" },
      { status: 400 }
    );
  }

  if (hadiahTersisa(target, store.pemenang) <= 0) {
    return NextResponse.json(
      { error: "Kuota hadiah ini sudah habis" },
      { status: 400 }
    );
  }

  const pool = eligiblePeserta(store.peserta, store.pemenang);
  if (!pool.length) {
    return NextResponse.json(
      { error: "Tidak ada peserta yang masih eligible" },
      { status: 400 }
    );
  }

  const winner = pool[Math.floor(Math.random() * pool.length)];
  const record = {
    id: newId(),
    hadiahId: target.id,
    hadiahNama: target.nama,
    pesertaId: winner.id,
    pesertaNama: winner.nama,
    drawnAt: new Date().toISOString(),
  };
  store.pemenang.unshift(record);
  await writeStore(store);

  return NextResponse.json({
    pemenang: record,
    sisaHadiah: hadiahTersisa(target, store.pemenang),
    sisaPeserta: eligiblePeserta(store.peserta, store.pemenang).length,
    nextHadiah: nextHadiahToDraw(store.hadiah, store.pemenang),
  });
}
