import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

const PUBLIC_PATHS = new Set(["/login", "/monitoring"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/api/health" || pathname === "/api/dc-overview") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 });
  }

  if (!session && !isPublic) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const adminOnly =
    pathname.startsWith("/tambah") ||
    pathname.startsWith("/edit") ||
    pathname.startsWith("/hapus") ||
    pathname.startsWith("/kolom") ||
    pathname.startsWith("/pengguna");

  if (session && adminOnly && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
