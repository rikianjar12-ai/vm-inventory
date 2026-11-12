import { NextRequest, NextResponse } from "next/server";
import { newId, readStore, writeStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  const sorted = [...store.hadiah].sort(
    (a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama)
  );
  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const nama = String(body.nama ?? "").trim();
  const jumlah = Math.max(1, Number(body.jumlah) || 1);
  const store = await readStore();

  let urutan = Number(body.urutan);
  if (!Number.isFinite(urutan)) {
    urutan =
      store.hadiah.reduce((max, h) => Math.max(max, h.urutan), 0) + 1 || 1;
  }

  if (!nama) {
    return NextResponse.json({ error: "Nama hadiah wajib diisi" }, { status: 400 });
  }

  const item = {
    id: newId(),
    nama,
    jumlah,
    urutan,
    createdAt: new Date().toISOString(),
  };
  store.hadiah.push(item);
  await writeStore(store);
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "id wajib" }, { status: 400 });
  }

  const store = await readStore();
  const idx = store.hadiah.findIndex((h) => h.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Hadiah tidak ditemukan" }, { status: 404 });
  }

  const current = store.hadiah[idx];
  if (body.nama !== undefined) {
    const nama = String(body.nama).trim();
    if (!nama) {
      return NextResponse.json({ error: "Nama hadiah wajib diisi" }, { status: 400 });
    }
    current.nama = nama;
  }
  if (body.jumlah !== undefined) {
    current.jumlah = Math.max(1, Number(body.jumlah) || 1);
  }
  if (body.urutan !== undefined) {
    current.urutan = Number(body.urutan) || current.urutan;
  }

  store.hadiah[idx] = current;
  await writeStore(store);
  return NextResponse.json(current);
}

export async function PUT(req: NextRequest) {
  /** Reorder: body.ids = array id sesuai urutan baru (index 0 = diundi pertama) */
  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (!ids.length) {
    return NextResponse.json({ error: "ids wajib" }, { status: 400 });
  }

  const store = await readStore();
  const map = new Map(store.hadiah.map((h) => [h.id, h]));
  const ordered = ids.map((id: string, i: number) => {
    const h = map.get(id);
    if (!h) return null;
    map.delete(id);
    return { ...h, urutan: i + 1 };
  }).filter(Boolean);

  const rest = [...map.values()].map((h, i) => ({
    ...h,
    urutan: ordered.length + i + 1,
  }));

  store.hadiah = [...ordered, ...rest] as typeof store.hadiah;
  await writeStore(store);
  return NextResponse.json(store.hadiah);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id wajib" }, { status: 400 });
  }
  const store = await readStore();
  store.hadiah = store.hadiah.filter((h) => h.id !== id);
  await writeStore(store);
  return NextResponse.json({ ok: true });
}
