import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Buat PDF 1 halaman berisi teks given — dipakai sebagai dokumen uji di semua test. */
export async function makeTestPdf(text = "Dokumen Uji Kriptografi nomor satu"): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText(text, { x: 50, y: 750, size: 14, font, color: rgb(0, 0, 0) });
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

export const DEMO_META = {
  signerName: "Asep Nugraha",
  signerRole: "Dekan",
  institution: "Universitas Siliwangi",
  timestamp: "2026-09-23T08:00:00.000Z",
};
