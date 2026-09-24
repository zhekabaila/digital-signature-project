import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Digital Signature — ECDSA P-256 + QR Verification",
  description:
    "Tugas Kriptografi Universitas Siliwangi: tanda tangan digital ECDSA P-256, verifikasi QR-Code, dan multi-signer chained.",
};

const NAV = [
  { href: "/keygen", label: "1. Generate Key" },
  { href: "/sign", label: "2. Sign" },
  { href: "/verify", label: "3. Verify" },
  { href: "/multi-sign", label: "4. Multi-Signer" },
  { href: "/attack-lab", label: "5. Pengujian & Attack Lab" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <div className="mx-auto max-w-5xl px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="font-semibold tracking-tight">
              ✒️ Digital Signature Lab
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-zinc-900 dark:hover:text-zinc-100">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800 py-4 text-center text-xs text-zinc-500">
          Keamanan Informasi · Universitas Siliwangi — ECDSA P-256 · SHA-256 · AES-256-GCM
        </footer>
      </body>
    </html>
  );
}
