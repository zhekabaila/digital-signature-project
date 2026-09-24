import {
  PDFDocument,
  PDFName,
  PDFHexString,
  StandardFonts,
  PageSizes,
  rgb,
} from "pdf-lib";
import type { SignInfo } from "./multi-signer";

/** Custom key di PDF catalog tempat metadata tanda tangan disimpan (JSON). */
export const SIG_INFO_KEY = PDFName.of("DSig");

export async function loadPdf(bytes: Buffer | Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

/** Baca metadata tanda tangan dari catalog. null = dokumen belum bertanda tangan. */
export function readSignInfo(doc: PDFDocument): SignInfo | null {
  const obj = doc.catalog.get(SIG_INFO_KEY);
  if (obj instanceof PDFHexString) {
    return JSON.parse(obj.decodeText()) as SignInfo;
  }
  return null;
}

export function writeSignInfo(doc: PDFDocument, info: SignInfo): void {
  doc.catalog.set(SIG_INFO_KEY, PDFHexString.fromText(JSON.stringify(info)));
}

export function removeSignInfo(doc: PDFDocument): void {
  doc.catalog.delete(SIG_INFO_KEY);
}

/**
 * Bentuk kanonik byte PDF yang di-hash (TASK.md §8: hash dihitung dari konten
 * SEBELUM QR ditempel). Strategi: buang metadata DSig + buang semua halaman
 * tanda tangan (indeks >= origPageCount), lalu salin halaman asli ke dokumen
 * segar supaya objek gambar/font sisa tidak ikut tersimpan.
 * Terbukti deterministik & berubah bila 1 karakter teks diubah (lihat test).
 */
export async function computeCanonicalBytes(pdfBytes: Buffer | Uint8Array): Promise<{
  canonical: Buffer;
  info: SignInfo | null;
}> {
  const doc = await loadPdf(pdfBytes);
  const info = readSignInfo(doc);
  removeSignInfo(doc);
  const pageCount = info ? info.origPageCount : doc.getPageCount();
  if (doc.getPageCount() < pageCount) {
    throw new Error("Dokumen rusak: jumlah halaman kurang dari saat ditandatangani");
  }
  const fresh = await PDFDocument.create({ updateMetadata: false });
  const copied = await fresh.copyPages(
    doc,
    Array.from({ length: pageCount }, (_, i) => i),
  );
  copied.forEach((p) => fresh.addPage(p));
  return { canonical: Buffer.from(await fresh.save({ useObjectStreams: true })), info };
}

/** Tambahkan halaman tanda tangan terakhir: gambar QR + teks identitas signer. */
export async function embedSignaturePage(
  doc: PDFDocument,
  qrPng: Buffer,
  lines: string[],
  signerLabel: string,
): Promise<void> {
  const [w, h] = PageSizes.A4;
  const page = doc.addPage([w, h]);
  const img = await doc.embedPng(qrPng);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(sanitizeLatin1(signerLabel), {
    x: 56, y: h - 70, size: 16, font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText("Scan QR untuk verifikasi tanda tangan digital (ECDSA P-256 + SHA-256)", {
    x: 56, y: h - 92, size: 9, font, color: rgb(0.35, 0.35, 0.35),
  });
  const size = Math.min(w - 112, 300);
  page.drawImage(img, { x: (w - size) / 2, y: h - 120 - size, width: size, height: size });
  lines.forEach((line, i) => {
    page.drawText(sanitizeLatin1(line), {
      x: 56, y: h - 170 - size - i * 16, size: 10, font, color: rgb(0.2, 0.2, 0.2),
    });
  });
}

/** Helvetica bawaan pdf-lib hanya mendukung WinAnsi — buang karakter di luar Latin-1. */
export function sanitizeLatin1(s: string): string {
  return s.replace(/[^\x20-\xff]/g, "");
}
