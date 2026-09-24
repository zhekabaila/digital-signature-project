import Link from "next/link";

const MODES = [
  {
    href: "/keygen",
    title: "Generate KeyPair",
    desc: "Buat pasangan kunci ECDSA P-256. Private key langsung terenkripsi AES-256-GCM dengan passphrase Anda — tidak pernah tersimpan sebagai plaintext.",
  },
  {
    href: "/sign",
    title: "Tandatangani Dokumen",
    desc: "Unggah PDF + private key terenkripsi + passphrase → hash SHA-256 → tanda tangan ECDSA → QR-Code metadata ditempel di halaman terakhir.",
  },
  {
    href: "/verify",
    title: "Verifikasi Dokumen",
    desc: "Unggah PDF bertanda tangan atau scan QR langsung dari kamera. Verifikasi menolak dokumen yang diubah DAN kunci yang tidak cocok.",
  },
  {
    href: "/multi-sign",
    title: "Multi-Penandatangan",
    desc: "Beberapa signer menandatangani satu dokumen secara chained: tanda tangan signer berikutnya mengunci seluruh tanda tangan sebelumnya.",
  },
  {
    href: "/attack-lab",
    title: "Pengujian & Attack Lab",
    desc: "Benchmark sign/verify ≥30 percobaan, uji tamper 1 byte, uji kunci salah, uji QR dipalsukan — hasil bisa diekspor ke XLSX.",
  },
];

export default function Home() {
  return (
    <div className="py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Tanda Tangan Digital — ECDSA P-256 + QR Verification</h1>
      <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Proyek Kriptografi Topik D · Mata kuliah Keamanan Informasi, Universitas Siliwangi. Semua kunci
        berasal dari input user — tidak ada key atau passphrase yang di-hardcode di aplikasi ini.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {MODES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="font-medium">{m.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
