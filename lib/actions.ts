"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteColumn,
  deleteVm,
  getColumn,
  insertColumn,
  insertVm,
  listColumns,
  updateColumnLabel,
  updateVm,
} from "./db";
import { requireAdmin } from "./auth";
import {
  PROTECTED_KEYS,
  REQUIRED_KEYS,
  isProtectedColumn,
  normalizeSectionName,
  slugify,
} from "./types";

function payloadFromForm(formData: FormData, keys: string[]) {
  const data: Record<string, string> = {};
  for (const key of keys) {
    data[key] = String(formData.get(key) ?? "").trim();
  }
  return data;
}

export async function createVmAction(formData: FormData) {
  await requireAdmin();
  const columns = await listColumns();
  const data = payloadFromForm(
    formData,
    columns.map((c) => c.field_key)
  );
  for (const key of REQUIRED_KEYS) {
    if (!data[key]) {
      throw new Error("SERVER ID dan IP wajib diisi.");
    }
  }
  await insertVm(data);
  revalidatePath("/");
  redirect("/?msg=ditambah");
}

export async function updateVmAction(id: number, formData: FormData) {
  await requireAdmin();
  const columns = await listColumns();
  const data = payloadFromForm(
    formData,
    columns.map((c) => c.field_key)
  );
  for (const key of REQUIRED_KEYS) {
    if (!data[key]) {
      throw new Error("SERVER ID dan IP wajib diisi.");
    }
  }
  await updateVm(id, data);
  revalidatePath("/");
  redirect("/?msg=diubah");
}

export async function deleteVmAction(id: number) {
  await requireAdmin();
  await deleteVm(id);
  revalidatePath("/");
  redirect("/?msg=dihapus");
}

export async function createColumnAction(formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const sectionName =
    normalizeSectionName(String(formData.get("section_name") ?? "").trim()) ||
    "Lainnya";
  const fieldKey = slugify(String(formData.get("field_key") ?? "").trim() || label);

  if (!label) {
    redirect("/kolom?err=Nama+kolom+wajib+diisi");
  }
  if (PROTECTED_KEYS.has(fieldKey)) {
    redirect("/kolom?err=Kunci+kolom+standar+tidak+bisa+dipakai");
  }

  try {
    await insertColumn(fieldKey, label, sectionName);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambah kolom";
    redirect(`/kolom?err=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/kolom");
  redirect("/kolom?msg=Kolom+baru+berhasil+ditambahkan");
}

export async function updateColumnAction(id: number, formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) {
    redirect(`/kolom/edit/${id}?err=${encodeURIComponent("Nama kolom wajib diisi")}`);
  }

  const column = await getColumn(id);
  if (!column) {
    redirect("/kolom?err=Kolom+tidak+ditemukan");
  }

  try {
    await updateColumnLabel(id, label);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengubah nama kolom";
    redirect(`/kolom/edit/${id}?err=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/kolom");
  redirect("/kolom?msg=Nama+kolom+berhasil+diubah");
}

export async function deleteColumnAction(id: number) {
  await requireAdmin();
  const column = await getColumn(id);
  if (!column) {
    redirect("/kolom?err=Kolom+tidak+ditemukan");
  }
  if (isProtectedColumn(column)) {
    redirect("/kolom?err=Kolom+standar+tidak+dapat+dihapus");
  }
  await deleteColumn(id, column.field_key);
  revalidatePath("/");
  revalidatePath("/kolom");
  redirect("/kolom?msg=Kolom+berhasil+dihapus");
}
