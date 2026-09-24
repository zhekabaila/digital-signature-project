/**
 * Jalankan SELURUH pengujian wajib TASK.md §3.5 pada 5 dokumen data-uji:
 *  - timing sign/verify rata-rata 30 percobaan
 *  - ukuran signature & public key
 *  - uji tamper, uji kunci salah, uji QR dipalsukan
 * Hasil ditulis ke hasil-uji/ (tabel markdown, JSON, dan XLSX).
 * Semua key di-generate ulang saat script jalan — tidak ada key disimpan/di-hardcode.
 * Jalankan: npx tsx scripts/run-tests.mts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import ExcelJS from "exceljs";
import { createPublicKey } from "node:crypto";
import { generateKeypair } from "../lib/crypto/keypair";
import { signDocument, verifyAllSignatures } from "../lib/pdf/multi-signer";
import { verifySignature } from "../lib/crypto/sign-verify";
import { measure } from "../lib/metrics/timing";

const ITERATIONS = 30;
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "hasil-uji");

function meta(n: string) {
  return { signerName: n, signerRole: "Penguji", institution: "Universitas Siliwangi", timestamp: new Date().toISOString() };
}

async function tamperOneChar(bytes: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPage(0).drawText("ANGKA DIGANTI 999", { x: 50, y: 100, size: 12, font });
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

const files = [
  "surat-keterangan.pdf", "kontrak-karya.pdf", "hasil-rapat.pdf",
  "sertifikat-training.pdf", "proposal-penelitian.pdf",
];

const rows: Record<string, string | number>[] = [];
for (const f of files) {
  const pdf = await readFile(path.join(ROOT, "data-uji", f));
  const kp = generateKeypair();
  const kpWrong = generateKeypair();

  const signT = await measure(() => signDocument(pdf, kp.privateKeyDer, kp.publicKeyPem, meta(f)), ITERATIONS);
  const { signedPdfBytes } = await signDocument(pdf, kp.privateKeyDer, kp.publicKeyPem, meta(f));
  const verifyT = await measure(() => verifyAllSignatures(signedPdfBytes), ITERATIONS);

  const tampered = await tamperOneChar(signedPdfBytes);
  const tamperRes = await verifyAllSignatures(tampered);

  const wrongKeyRes = await verifyAllSignatures(signedPdfBytes, kpWrong.publicKeyPem);

  const { payload } = await signDocument(pdf, kp.privateKeyDer, kp.publicKeyPem, meta(f));
  const forgedQr = { ...payload, signerName: "Penyusup" };
  const forgedData = Buffer.concat([
    Buffer.from(payload.documentHash, "hex"),
    Buffer.from(JSON.stringify([forgedQr.signerName, forgedQr.signerRole, forgedQr.institution, forgedQr.timestamp, forgedQr.publicKeyFingerprint])),
  ]);
  const forgedRejected = !verifySignature(forgedData, Buffer.from(payload.signature, "base64"), kp.publicKeyPem);

  rows.push({
    Dokumen: f,
    "Ukuran PDF (B)": pdf.length,
    "Ukuran PDF bertanda (B)": signedPdfBytes.length,
    "Rata2 sign (ms)": +signT.avgMs.toFixed(3),
    "Min sign (ms)": +signT.minMs.toFixed(3),
    "Max sign (ms)": +signT.maxMs.toFixed(3),
    "Rata2 verify (ms)": +verifyT.avgMs.toFixed(3),
    "Min verify (ms)": +verifyT.minMs.toFixed(3),
    "Max verify (ms)": +verifyT.maxMs.toFixed(3),
    "Iterasi": ITERATIONS,
    "Ukuran signature (B)": Buffer.from(payload.signature, "base64").length,
    "Ukuran public key SPKI DER (B)": Buffer.from(createPublicKey(kp.publicKeyPem).export({ format: "der", type: "spki" })).length,
    "Tamper ditolak": tamperRes.valid === false ? "YA" : "TIDAK",
    "Alasan tamper": tamperRes.signers[0]?.reason ?? "",
    "Kunci salah ditolak": wrongKeyRes.valid === false ? "YA" : "TIDAK",
    "Alasan kunci salah": wrongKeyRes.signers[0]?.reason ?? "",
    "QR palsu ditolak": forgedRejected ? "YA" : "TIDAK",
  });
  console.log(`✓ ${f} selesai`);
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "hasilmengujian.json"), JSON.stringify(rows, null, 2));

// markdown
const headers = Object.keys(rows[0]);
const md = [
  "# Hasil Pengujian Wajib (TASK.md §3.5)",
  "",
  `ECDSA P-256 · SHA-256 · Node.js ${process.version} · ${ITERATIONS} percobaan per dokumen · digenerate: ${new Date().toISOString()}`,
  "",
  `| ${headers.join(" | ")} |`,
  `|${headers.map(() => "---").join("|")}|`,
  ...rows.map((r) => `| ${headers.map((h) => String(r[h])).join(" | ")} |`),
].join("\n");
await writeFile(path.join(OUT, "hasilmengujian.md"), md);

// xlsx
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Hasil Uji");
ws.addRow(headers);
ws.getRow(1).font = { bold: true };
rows.forEach((r) => ws.addRow(headers.map((h) => r[h])));
ws.columns.forEach((c) => {
  let w = 10;
  c.eachCell?.((cell: ExcelJS.Cell) => (w = Math.max(w, String(cell.value ?? "").length + 2)));
  c.width = Math.min(w, 50);
});
await wb.xlsx.writeFile(path.join(OUT, "hasilmengujian.xlsx"));
console.log("Hasil ditulis ke hasil-uji/ (json, md, xlsx)");
