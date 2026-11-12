"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSessionCookie, clearSessionCookie, requireAdmin, requireUser } from "./auth";
import {
  countAdmins,
  createUser,
  deleteUser,
  getUserAuthByUsername,
  getUserById,
  updateUser,
  updateUserPassword,
} from "./users";
import {
  normalizeUsername,
  validPassword,
  validUsername,
  verifyPassword,
} from "./password";

export async function loginAction(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = await getUserAuthByUsername(username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect("/login?err=Username+atau+password+salah");
  }
  await createSessionCookie(user);
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (!validPassword(next)) {
    redirect("/akun?err=Password+baru+minimal+8+karakter");
  }
  if (next !== confirm) {
    redirect("/akun?err=Konfirmasi+password+tidak+cocok");
  }
  const auth = await getUserAuthByUsername(user.username);
  if (!auth || !(await verifyPassword(current, auth.password_hash))) {
    redirect("/akun?err=Password+saat+ini+salah");
  }
  await updateUserPassword(user.id, next);
  redirect("/akun?msg=Password+berhasil+diubah");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const displayName = String(formData.get("display_name") ?? "").trim() || username;
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "operator");
  const role = roleRaw === "admin" ? "admin" : "operator";

  if (!validUsername(username)) {
    redirect("/pengguna?err=Username+3-32+karakter+huruf+kecil%2C+angka%2C+titik%2C+_");
  }
  if (!validPassword(password)) {
    redirect("/pengguna?err=Password+minimal+8+karakter");
  }
  try {
    await createUser({ username, password, displayName, role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambah pengguna";
    redirect(`/pengguna?err=${encodeURIComponent(message)}`);
  }
  revalidatePath("/pengguna");
  redirect("/pengguna?msg=Pengguna+baru+ditambahkan");
}

export async function updateUserAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = Number(formData.get("user_id"));
  const displayName = String(formData.get("display_name") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "operator");
  const role = roleRaw === "admin" ? "admin" : "operator";

  if (!Number.isInteger(id) || id <= 0) {
    redirect("/pengguna?err=Pengguna+tidak+valid");
  }
  const target = await getUserById(id);
  if (!target) redirect("/pengguna?err=Pengguna+tidak+ditemukan");

  if (
    target.role === "admin" &&
    role !== "admin" &&
    (await countAdmins()) <= 1
  ) {
    redirect(
      `/pengguna/edit/${id}?err=${encodeURIComponent("Admin terakhir tidak bisa diturunkan")}`
    );
  }

  await updateUser(id, {
    displayName: displayName || target.username,
    role,
  });

  if (actor.id === id) {
    await createSessionCookie({
      id: actor.id,
      username: actor.username,
      display_name: actor.display_name,
      role,
    });
    if (role !== "admin") {
      revalidatePath("/");
      redirect("/");
    }
  }

  revalidatePath("/pengguna");
  redirect("/pengguna?msg=Akun+berhasil+diperbarui");
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("user_id"));
  const password = String(formData.get("password") ?? "");
  if (!Number.isInteger(id) || id <= 0) {
    redirect("/pengguna?err=Pengguna+tidak+valid");
  }
  if (!validPassword(password)) {
    redirect("/pengguna?err=Password+minimal+8+karakter");
  }
  const target = await getUserById(id);
  if (!target) redirect("/pengguna?err=Pengguna+tidak+ditemukan");
  await updateUserPassword(id, password);
  revalidatePath("/pengguna");
  redirect("/pengguna?msg=Password+berhasil+diatur+ulang");
}

export async function deleteUserAction(id: number) {
  const actor = await requireAdmin();
  const target = await getUserById(id);
  if (!target) redirect("/pengguna?err=Pengguna+tidak+ditemukan");
  if (target.id === actor.id) {
    redirect("/pengguna?err=Tidak+bisa+menghapus+akun+sendiri");
  }
  if (target.role === "admin" && (await countAdmins()) <= 1) {
    redirect("/pengguna?err=Admin+terakhir+tidak+bisa+dihapus");
  }
  await deleteUser(id);
  revalidatePath("/pengguna");
  redirect("/pengguna?msg=Pengguna+dihapus");
}
