import { NextResponse } from "next/server";
import {
  eligiblePeserta,
  hadiahTersisa,
  nextHadiahToDraw,
  readStore,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  const next = nextHadiahToDraw(store.hadiah, store.pemenang);
  return NextResponse.json({
    ...store,
    hadiah: [...store.hadiah]
      .sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama))
      .map((h) => ({
        ...h,
        tersisa: hadiahTersisa(h, store.pemenang),
      })),
    nextHadiah: next
      ? { ...next, tersisa: hadiahTersisa(next, store.pemenang) }
      : null,
    eligibleCount: eligiblePeserta(store.peserta, store.pemenang).length,
  });
}
