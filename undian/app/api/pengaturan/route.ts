import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_NAMA_KEGIATAN, readStore, writeStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store.pengaturan);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const namaKegiatan =
    String(body.namaKegiatan ?? "").trim() || DEFAULT_NAMA_KEGIATAN;

  if (namaKegiatan.length > 120) {
    return NextResponse.json(
      { error: "Nama kegiatan maksimal 120 karakter" },
      { status: 400 }
    );
  }

  const store = await readStore();
  store.pengaturan = { namaKegiatan };
  await writeStore(store);
  return NextResponse.json(store.pengaturan);
}
