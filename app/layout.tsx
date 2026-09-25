import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import SiteNav from "@/components/site-nav";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Studio Tanda Tangan Digital — ECDSA P-256 · QR · Multi-Signer",
  description:
    "Tugas Kriptografi Universitas Siliwangi: tanda tangan digital ECDSA P-256, verifikasi QR-Code, dan multi-signer chained.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${fraunces.variable} ${plex.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/92 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
            <Link href="/" className="flex items-center gap-3">
              <span className="stamp !border-[var(--seal)] !text-[var(--seal)] px-2.5 py-0.5 !text-sm !font-black !tracking-widest" aria-hidden>
                ✒
              </span>
              <span>
                <span className="block font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight">
                  Studio Tanda Tangan Digital
                </span>
                <span className="mono block text-[10px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                  ECDSA P-256 · SHA-256 · QR verification
                </span>
              </span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
        <footer className="border-t border-dashed border-[var(--line-strong)] py-5 text-center">
          <p className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
            Keamanan Informasi · Universitas Siliwangi — kunci privat selalu terenkripsi, tidak ada secret di kode
          </p>
        </footer>
      </body>
    </html>
  );
}
