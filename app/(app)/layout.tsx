import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { grafanaDashboardUrl } from "@/lib/grafana";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <div className="app-shell">
        <div className="app-frame">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Kembali ke beranda">
              <span className="brand-logo-wrap">
                <Image
                  src="/lrt-logo-white.png"
                  alt="LRT Jabodebek"
                  width={360}
                  height={174}
                  className="brand-logo"
                  priority
                />
              </span>
              <span className="brand-copy">
                <p className="brand-kicker">Datacenter Operations</p>
                <h1>Inventory Server</h1>
              </span>
            </Link>
            <div className="topbar-end">
              <Nav role={user.role} grafanaUrl={grafanaDashboardUrl()} />
              <ThemeToggle />
              <form action={logoutAction}>
                <button className="btn btn-ghost" type="submit">
                  Keluar
                </button>
              </form>
            </div>
          </header>
          <main className="page">{children}</main>
        </div>
      </div>
    </>
  );
}
