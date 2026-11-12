import { NextRequest, NextResponse } from "next/server";
import { newId, readStore, writeStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store.peserta);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const nama = String(body.nama ?? "").trim();
  const keterangan = String(body.keterangan ?? "").trim();
  if (!nama) {
    return NextResponse.json({ error: "Nama peserta wajib diisi" }, { status: 400 });
  }

  const store = await readStore();
  const item = {
    id: newId(),
    nama,
    keterangan,
    createdAt: new Date().toISOString(),
  };
  store.peserta.push(item);
  await writeStore(store);
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id wajib" }, { status: 400 });
  }
  const store = await readStore();
  store.peserta = store.peserta.filter((p) => p.id !== id);
  await writeStore(store);
  return NextResponse.json({ ok: true });
}
