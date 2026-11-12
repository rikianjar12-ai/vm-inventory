"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Undian" },
  { href: "/peserta", label: "Daftar Peserta" },
  { href: "/hadiah", label: "Daftar Hadiah" },
  { href: "/pengaturan", label: "Pengaturan" },
];

export function Nav() {
  const pathname = usePathname();
  const [namaKegiatan, setNamaKegiatan] = useState("Undian Hadiah");

  useEffect(() => {
    let alive = true;
    fetch("/api/pengaturan", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.namaKegiatan) setNamaKegiatan(d.namaKegiatan);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <header className="topnav">
      <div className="brand">
        <strong>{namaKegiatan}</strong>
        <span>Kelola peserta, hadiah, dan urutan undian</span>
      </div>
      <nav className="nav-links">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : undefined}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
