"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

export const FLOW = [
  { href: "/keygen", num: "01", label: "Pembuatan Kunci" },
  { href: "/sign", num: "02", label: "Tanda Tangan" },
  { href: "/verify", num: "03", label: "Verifikasi" },
  { href: "/multi-sign", num: "04", label: "Tanda Tangan Ganda" },
  { href: "/attack-lab", num: "05", label: "Pengujian" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Alur utama">
      <Link key="/" href="/" className="navlink" data-active={pathname === "/"} aria-current={pathname === "/" ? "page" : undefined}>
        <span className="num flex items-center"><Home size={12} aria-hidden /></span>
        Beranda
      </Link>
      {FLOW.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} className="navlink" data-active={active} aria-current={active ? "page" : undefined}>
            <span className="num">{n.num}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
