import { NextResponse } from "next/server";
import { readStore, shuffleArray, writeStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await readStore();
  if (store.peserta.length < 2) {
    return NextResponse.json(
      { error: "Minimal 2 peserta untuk diacak" },
      { status: 400 }
    );
  }
  store.peserta = shuffleArray(store.peserta);
  await writeStore(store);
  return NextResponse.json({
    ok: true,
    peserta: store.peserta,
    message: "Urutan nama peserta berhasil diacak",
  });
}
