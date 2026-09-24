/** Buat 5 PDF sampel di data-uji/ (TASK.md §2 & §3.5). Jalankan: npx tsx scripts/generate-data-uji.mts */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../data-uji");
mkdirSync(OUT, { recursive: true });

const DOCS: [string, string, string[]][] = [
  ["surat-keterangan.pdf", "Surat Keterangan Aktif Kuliah", [
    "Nomor: 452/UNUSIL/SKAK/2026", "Nama: Asep Nugraha", "NIM: 210101001",
    "Program Studi: Teknik Informatika", "Keterangan: Mahasiswa aktif semester 7.",
  ]],
  ["kontrak-karya.pdf", "Kontrak Karya Proyek Perangkat Lunak", [
    "Pihak I: PT Contoh Sejahtera", "Pihak II: CV Digital Nusantara",
    "Nilai kontrak: Rp 100.000.000", "Jangka waktu: 6 bulan",
    "Pembayaran dilakukan dalam 3 termin.",
  ]],
  ["hasil-rapat.pdf", "Notulen Rapat Senat Fakultas", [
    "Hari/Tanggal: Rabu, 23 September 2026", "Agenda: Persetujuan kurikulum 2026",
    "Keputusan: Kurikulum disahkan dengan 3 catatan revisi minor.",
    "Jumlah peserta: 17 anggota senat.",
  ]],
  ["sertifikat-training.pdf", "Sertifikat Pelatihan Keamanan Siber", [
    "Diberikan kepada: Dewi Lestari", "Materi: Kriptografi Terapan",
    "Durasi: 40 jam pelajaran", "Institusi: Universitas Siliwangi",
    "Nilai kelulusan: 92 (Sangat Baik)",
  ]],
  ["proposal-penelitian.pdf", "Proposal Penelitian Hibah Dikti", [
    "Judul: Verifikasi Dokumen Berbasis Tanda Tangan Digital dan QR-Code",
    "Ketuapeneliti: R. Hidayat", "Biaya diajukan: Rp 75.000.000",
    "Luaran: Publikasi nasional dan HKI aplikasi.",
  ]],
];

for (const [file, title, lines] of DOCS) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  page.drawText(title, { x: 56, y: 770, size: 18, font: bold, color: rgb(0.1, 0.1, 0.3) });
  lines.forEach((l, i) => page.drawText(l, { x: 56, y: 730 - i * 24, size: 12, font }));
  page.drawText("Dokumen uji kriptografi - bukan dokumen resmi.", { x: 56, y: 60, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  const bytes = await doc.save();
  const target = path.join(OUT, file);
  if (!existsSync(target)) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(target, bytes);
    console.log("dibuat:", file);
  } else console.log("dilewati (sudah ada):", file);
}
