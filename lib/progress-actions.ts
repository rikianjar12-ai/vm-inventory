"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import {
  deleteSub,
  deleteWork,
  insertSub,
  insertWorkWithSubs,
  updateSub,
  updateWorkWithSubs,
} from "./progress-db";
import { averageProgress, parseSubForm, parseSubList, parseWorkForm } from "./progress";

function bounce(path: string, error: string): never {
  redirect(`${path}?err=${encodeURIComponent(error)}`);
}

function withAutomaticProgress(formData: FormData) {
  const parsed = parseWorkForm(formData);
  if (!parsed.ok) return parsed;
  const subs = parseSubList(formData);
  if (!subs.ok) return subs;
  return {
    ok: true as const,
    value: {
      ...parsed.value,
      weight: 1,
      manualProgress: averageProgress(subs.value.map((sub) => sub.progress)),
    },
    subs: subs.value,
  };
}

export async function createWorkAction(formData: FormData) {
  await requireUser();
  const parsed = withAutomaticProgress(formData);
  if (!parsed.ok) bounce("/progress/baru", parsed.error);

  let id = 0;
  try {
    id = await insertWorkWithSubs(parsed.value, parsed.subs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan pekerjaan";
    bounce("/progress/baru", message);
  }

  revalidatePath("/progress");
  redirect(`/progress/${id}?msg=ditambah`);
}

export async function updateWorkAction(id: number, formData: FormData) {
  await requireUser();
  const parsed = withAutomaticProgress(formData);
  if (!parsed.ok) bounce(`/progress/${id}`, parsed.error);

  try {
    await updateWorkWithSubs(id, parsed.value, parsed.subs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengubah pekerjaan";
    bounce(`/progress/${id}`, message);
  }

  revalidatePath("/progress");
  revalidatePath(`/progress/${id}`);
  redirect(`/progress/${id}?msg=diubah`);
}

export async function deleteWorkAction(id: number) {
  await requireUser();
  await deleteWork(id);
  revalidatePath("/progress");
  redirect("/progress?msg=dihapus");
}

export async function createSubAction(workId: number, formData: FormData) {
  await requireUser();
  const parsed = parseSubForm(formData);
  if (!parsed.ok) bounce(`/progress/${workId}`, parsed.error);

  let subId = 0;
  try {
    subId = await insertSub(workId, parsed.value);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambah sub pekerjaan";
    bounce(`/progress/${workId}`, message);
  }

  revalidatePath("/progress");
  revalidatePath(`/progress/${workId}`);
  redirect(`/progress/${workId}?msg=subditambah#sub-${subId}`);
}

export async function updateSubAction(
  workId: number,
  subId: number,
  formData: FormData
) {
  await requireUser();
  const parsed = parseSubForm(formData);
  if (!parsed.ok) bounce(`/progress/${workId}`, parsed.error);

  try {
    await updateSub(workId, subId, parsed.value);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan sub pekerjaan";
    bounce(`/progress/${workId}`, message);
  }

  revalidatePath("/progress");
  revalidatePath(`/progress/${workId}`);
  redirect(`/progress/${workId}?msg=subdiubah#sub-${subId}`);
}

export async function deleteSubAction(workId: number, subId: number) {
  await requireUser();
  try {
    await deleteSub(workId, subId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus sub pekerjaan";
    bounce(`/progress/${workId}`, message);
  }

  revalidatePath("/progress");
  revalidatePath(`/progress/${workId}`);
  redirect(`/progress/${workId}?msg=subdihapus`);
}
