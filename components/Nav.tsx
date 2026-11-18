"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
  return (
    <svg
      className="nav-home-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-7h6v7" />
    </svg>
  );
}

const LINKS = [
  {
    href: "/progress",
    label: "Project",
    adminOnly: false,
    active: (path: string) => path.startsWith("/progress"),
  },
  {
    href: "/tambah",
    label: "Tambah VM",
    adminOnly: true,
    active: (path: string) => path === "/tambah",
  },
  {
    href: "/kolom",
    label: "Kelola Kolom",
    adminOnly: true,
    active: (path: string) => path.startsWith("/kolom"),
  },
  {
    href: "/pengguna",
    label: "Pengguna",
    adminOnly: true,
    active: (path: string) => path.startsWith("/pengguna"),
  },
  {
    href: "/akun",
    label: "Akun",
    adminOnly: false,
    active: (path: string) => path.startsWith("/akun"),
  },
];

export function Nav({
  role,
  grafanaUrl,
}: {
  role?: "admin" | "operator";
  grafanaUrl: string;
}) {
  const pathname = usePathname();
  const homeActive =
    pathname === "/" ||
    pathname.startsWith("/edit/") ||
    pathname.startsWith("/hapus/");
  const visible = LINKS.filter((link) => !link.adminOnly || role === "admin");

  return (
    <nav className="nav">
      <Link
        href="/"
        className={homeActive ? "nav-home active" : "nav-home"}
        aria-label="Beranda"
        title="Beranda"
      >
        <HomeIcon />
        <span>Home</span>
      </Link>
      <Link
        href="/monitoring"
        className={pathname.startsWith("/monitoring") ? "active" : undefined}
      >
        Monitoring
      </Link>
      <a
        href={grafanaUrl}
        target="_blank"
        rel="noreferrer"
        title="Buka dashboard Grafana"
      >
        Grafana
      </a>
      {visible.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={link.active(pathname) ? "active" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
