import Link from "next/link";

const MODES = [
  {
    href: "/keygen", num: "01", title: "Keygen",
    desc: "Pasangan kunci ECDSA P-256. Private key terenkripsi AES-256-GCM (scrypt) — tidak pernah ada sebagai plaintext.",
    meta: "passphrase → .dsk + public-key.pem",
  },
  {
    href: "/sign", num: "02", title: "Sign",
    desc: "Unggah PDF + kunci terenkripsi + passphrase. Hash SHA-256 konten ditandatangani, QR-Code metadata menempel sebagai halaman tanda tangan.",
    meta: "PDF → SHA-256 → ECDSA → QR",
  },
  {
    href: "/verify", num: "03", title: "Verify",
    desc: "Unggah PDF atau scan QR langsung dari kamera. Menolak dokumen yang diubah DAN kunci yang tidak cocok — dua lapis pemeriksaan terpisah.",
    meta: "hash match + signature match",
  },
  {
    href: "/multi-sign", num: "04", title: "Multi-Signer",
    desc: "Chained integrity: tanda tangan signer berikutnya mengunci seluruh signature sebelumnya. Urutan tidak bisa diubah atau dilewati.",
    meta: "SHA256(doc ‖ sig₁ ‖ … ‖ sigᵢ₋₁)",
  },
  {
    href: "/attack-lab", num: "05", title: "Attack Lab",
    desc: "Benchmark ≥30 percobaan, uji tamper satu karakter, uji kunci salah, uji QR dipalsukan. Tabel hasil siap diekspor ke XLSX.",
    meta: "timing · tamper · wrong-key · forged-QR",
  },
];

export default function Home() {
  return (
    <div className="py-4">
      <div className="rise relative max-w-3xl">
        <span className="step-chip">Tugas Kriptografi · Topik D</span>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[52px] font-black leading-[0.98] tracking-tight">
          Bubuhkan tanda tangan,
          <br />
          <span style={{ color: "var(--seal)" }}>bukan sekadar nama.</span>
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-[var(--ink-soft)]">
          Laboratorium tanda tangan digital: ECDSA P-256 di atas hash SHA-256, verifikasi lewat QR-Code,
          dan multi-penandatangan berantai. Keamanan Informasi · Universitas Siliwangi.
        </p>
      </div>

      <div className="mt-12 space-y-3">
        {MODES.map((m, i) => (
          <Link
            key={m.href}
            href={m.href}
            className={`mode-card panel rise rise-${i + 1} flex items-start gap-5 p-5 sm:gap-8`}
          >
            <span className="mono w-10 shrink-0 pt-1 text-2xl font-medium text-[var(--line-strong)]">{m.num}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">{m.title}</span>
                <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--seal)]">{m.meta}</span>
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-[var(--ink-soft)]">{m.desc}</span>
            </span>
            <span className="mono self-center text-lg text-[var(--line-strong)]" aria-hidden>→</span>
          </Link>
        ))}
      </div>

      <p className="mono rise rise-5 mt-10 text-center text-[11px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
        Tanpa key hardcode · SHA-256 (bukan MD5/SHA-1) · private key selalu terenkripsi
      </p>
    </div>
  );
}
