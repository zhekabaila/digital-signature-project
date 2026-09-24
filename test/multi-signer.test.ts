import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { generateKeypair } from "@/lib/crypto/keypair";
import { signDocument, verifyAllSignatures } from "@/lib/pdf/multi-signer";
import { readSignInfo, loadPdf } from "@/lib/pdf/pdf-utils";
import { makeTestPdf, DEMO_META } from "./helpers";

const meta = (name: string, ts: string) => ({ ...DEMO_META, signerName: name, timestamp: ts });

describe("multi-penandatangan chained (TASK.md §3.4 Opsi A)", () => {
  it("3 signer berurutan → semua tervalidasi, urutan tersimpan", async () => {
    const kps = [generateKeypair(), generateKeypair(), generateKeypair()];
    let bytes = await makeTestPdf();
    for (let i = 0; i < 3; i++) {
      ({ signedPdfBytes: bytes } = await signDocument(bytes, kps[i].privateKeyDer, kps[i].publicKeyPem, meta(`Signer ${i + 1}`, `2026-09-23T0${i}:00:00.000Z`)));
    }
    const res = await verifyAllSignatures(bytes);
    expect(res.valid).toBe(true);
    expect(res.signers.map((s) => s.signer.signerName)).toEqual(["Signer 1", "Signer 2", "Signer 3"]);

    const doc = await loadPdf(bytes);
    expect(readSignInfo(doc)!.signatures).toHaveLength(3);
  });

  it("tanda tangan signer 2 TIDAK SAH bila signer 1 dihapus (chained integrity)", async () => {
    const k1 = generateKeypair();
    const k2 = generateKeypair();
    let bytes = await makeTestPdf();
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k1.privateKeyDer, k1.publicKeyPem, meta(" Satu", "2026-09-23T01:00:00.000Z")));
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k2.privateKeyDer, k2.publicKeyPem, meta(" Dua", "2026-09-23T02:00:00.000Z")));

    // buang entri signer 1 dari metadata (percobaan melewati signer pertama)
    const doc = await loadPdf(bytes);
    const info = readSignInfo(doc)!;
    info.signatures = [info.signatures[1]];
    const { writeSignInfo } = await import("@/lib/pdf/pdf-utils");
    writeSignInfo(doc, info);
    const res = await verifyAllSignatures(Buffer.from(await doc.save({ useObjectStreams: true })));
    expect(res.valid).toBe(false);
    expect(res.signers[0].reason).toMatch(/diubah|tidak valid/i);
  });

  it("menukar URUTAN dua tanda tangan → verify GAGAL (hash signer 2 mengunci signature signer 1)", async () => {
    const k1 = generateKeypair();
    const k2 = generateKeypair();
    let bytes = await makeTestPdf();
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k1.privateKeyDer, k1.publicKeyPem, meta("A", "2026-09-23T01:00:00.000Z")));
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k2.privateKeyDer, k2.publicKeyPem, meta("B", "2026-09-23T02:00:00.000Z")));

    const doc = await loadPdf(bytes);
    const info = readSignInfo(doc)!;
    info.signatures.reverse();
    const { writeSignInfo } = await import("@/lib/pdf/pdf-utils");
    writeSignInfo(doc, info);
    const res = await verifyAllSignatures(Buffer.from(await doc.save({ useObjectStreams: true })));
    expect(res.valid).toBe(false);
  });

  it("dokumen dengan 2 signer lalu isinya diubah → KEDUA signer gagal (hash inti berubah)", async () => {
    const k1 = generateKeypair();
    const k2 = generateKeypair();
    let bytes = await makeTestPdf("Anggaran 500 juta");
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k1.privateKeyDer, k1.publicKeyPem, meta("A", "2026-09-23T01:00:00.000Z")));
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k2.privateKeyDer, k2.publicKeyPem, meta("B", "2026-09-23T02:00:00.000Z")));

    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPage(0).drawText("Anggaran 900 juta", { x: 50, y: 750, size: 14, font });
    const res = await verifyAllSignatures(Buffer.from(await doc.save({ useObjectStreams: true })));
    expect(res.valid).toBe(false);
    expect(res.signers.every((s) => !s.valid && /diubah/i.test(s.reason!))).toBe(true);
  });

  it("menambah signer kedua tidak membatalkan tanda tangan signer pertama", async () => {
    const k1 = generateKeypair();
    const k2 = generateKeypair();
    let bytes = await makeTestPdf();
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k1.privateKeyDer, k1.publicKeyPem, meta("A", "2026-09-23T01:00:00.000Z")));
    const afterOne = await verifyAllSignatures(bytes);
    expect(afterOne.valid).toBe(true);
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k2.privateKeyDer, k2.publicKeyPem, meta("B", "2026-09-23T02:00:00.000Z")));
    const afterTwo = await verifyAllSignatures(bytes);
    expect(afterTwo.valid).toBe(true);
    expect(afterTwo.signers[0].valid).toBe(true);
  });

  it("origPageCount & halaman tanda tangan bertambah tepat 1 per signer", async () => {
    const k1 = generateKeypair();
    const k2 = generateKeypair();
    const base = await makeTestPdf();
    const baseDoc = await PDFDocument.load(base);
    const n = baseDoc.getPageCount();
    let bytes = base;
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k1.privateKeyDer, k1.publicKeyPem, meta("A", "2026-09-23T01:00:00.000Z")));
    ({ signedPdfBytes: bytes } = await signDocument(bytes, k2.privateKeyDer, k2.publicKeyPem, meta("B", "2026-09-23T02:00:00.000Z")));
    const finalDoc = await PDFDocument.load(bytes);
    expect(finalDoc.getPageCount()).toBe(n + 2);
    expect(readSignInfo(finalDoc)!.origPageCount).toBe(n);
  });
});
