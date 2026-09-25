"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const FLOW = [
  { href: "/keygen", num: "01", label: "Keygen" },
  { href: "/sign", num: "02", label: "Sign" },
  { href: "/verify", num: "03", label: "Verify" },
  { href: "/multi-sign", num: "04", label: "Multi-Signer" },
  { href: "/attack-lab", num: "05", label: "Attack Lab" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Alur utama">
      <Link key="/" href="/" className="navlink" data-active={pathname === "/"} aria-current={pathname === "/" ? "page" : undefined}>
        <span className="num">⌂</span>
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
