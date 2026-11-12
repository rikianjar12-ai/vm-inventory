import { NextRequest, NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? "pemenang");
  const store = await readStore();

  if (mode === "semua") {
    store.peserta = [];
    store.hadiah = [];
    store.pemenang = [];
    // nama kegiatan tetap dipertahankan
  } else {
    store.pemenang = [];
  }

  await writeStore(store);
  return NextResponse.json({ ok: true });
}
