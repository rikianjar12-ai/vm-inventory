import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  sessionExpiry,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";
import { getUserById } from "./users";

export type AuthUser = {
  id: number;
  username: string;
  display_name: string;
  role: "admin" | "operator";
};

export async function readSessionFromCookie(token?: string) {
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await readSessionFromCookie(token);
  if (!session) return null;
  const user = await getUserById(session.id);
  if (!user || user.username !== session.username) return null;
  return user;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/?err=akses");
  return user;
}

export async function createSessionCookie(user: SessionPayload | AuthUser) {
  const token = await signSession({
    id: user.id,
    username: user.username,
    role: user.role,
    exp: sessionExpiry(),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
    secure: false,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
