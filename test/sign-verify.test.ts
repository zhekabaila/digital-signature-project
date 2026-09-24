import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { generateKeypair } from "@/lib/crypto/keypair";
import { encryptPrivateKey, decryptPrivateKey } from "@/lib/crypto/key-protection";
import { signData, verifySignature, forgeSignatureWithRandomKey, randomSignatureBytes } from "@/lib/crypto/sign-verify";
import { signDocument, verifyAllSignatures } from "@/lib/pdf/multi-signer";
import { makeTestPdf, DEMO_META } from "./helpers";

describe("sign/verify tingkat primitif (ECDSA P-256)", () => {
  it("sign → verify dengan pasangan kunci benar = valid", () => {
    const kp = generateKeypair();
    const data = Buffer.from("isi dokumen penting 123");
    const sig = signData(data, kp.privateKeyDer);
    expect(verifySignature(data, sig, kp.publicKeyPem)).toBe(true);
  });

  it("ubah 1 byte data → verify GAGAL", () => {
    const kp = generateKeypair();
    const data = Buffer.from("isi dokumen penting 123");
    const sig = signData(data, kp.privateKeyDer);
    const tampered = Buffer.from(data);
    tampered[tampered.length - 1] = tampered[tampered.length - 1] === 51 /*3*/ ? 52 /*4*/ : 51;
    expect(verifySignature(tampered, sig, kp.publicKeyPem)).toBe(false);
  });

  it("verify dengan kunci publik LAIN → GAGAL", () => {
    const signer = generateKeypair();
    const other = generateKeypair();
    const data = Buffer.from("dokumen");
    const sig = signData(data, signer.privateKeyDer);
    expect(verifySignature(data, sig, other.publicKeyPem)).toBe(false);
  });

  it("signature acak / dari key lain → GAGAL", () => {
    const kp = generateKeypair();
    const data = Buffer.from("dokumen");
    expect(verifySignature(data, randomSignatureBytes(), kp.publicKeyPem)).toBe(false);
    expect(verifySignature(data, forgeSignatureWithRandomKey(data), kp.publicKeyPem)).toBe(false);
  });

  it("ECDSA P-256 menghasilkan ukuran signature ±71-72 byte (jauh lebih kecil dari RSA-2048)", () => {
    const kp = generateKeypair();
    const sig = signData(Buffer.from("x".repeat(100)), kp.privateKeyDer);
    expect(sig.length).toBeGreaterThanOrEqual(64);
    expect(sig.length).toBeLessThanOrEqual(72);
  });
});

describe("alur sign → verify dokumen PDF lengkap (TASK.md §3.2–3.3)", () => {
  it("PDF ditandatangani lalu diverifikasi → valid, metadata signer muncul", async () => {
    const kp = generateKeypair();
    const pdf = await makeTestPdf();
    const { signedPdfBytes, payload } = await signDocument(pdf, kp.privateKeyDer, kp.publicKeyPem, DEMO_META);
    const res = await verifyAllSignatures(signedPdfBytes);
    expect(res.valid).toBe(true);
    expect(res.signers).toHaveLength(1);
    expect(res.signers[0].signer.signerName).toBe(DEMO_META.signerName);
    expect(res.signers[0].signer.timestamp).toBe(DEMO_META.timestamp);
    expect(payload.documentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("private key lewat jalur enkripsi (passphrase) tetap menghasilkan tanda tangan sah", async () => {
    const kp = generateKeypair();
    const enc = encryptPrivateKey(kp.privateKeyDer, "pass123");
    const der = decryptPrivateKey(enc, "pass123");
    const { signedPdfBytes } = await signDocument(await makeTestPdf(), der, kp.publicKeyPem, DEMO_META);
    expect((await verifyAllSignatures(signedPdfBytes)).valid).toBe(true);
  });

  it("UJI TAMPER: isi dokumen diubah (1 karakter teks digambar ulang) → verify GAGAL, alasan dokumen diubah", async () => {
    const kp = generateKeypair();
    const { signedPdfBytes } = await signDocument(await makeTestPdf("Jumlah anggaran: 1000 rupiah"), kp.privateKeyDer, kp.publicKeyPem, DEMO_META);

    // simulasikan editor PDF mengubah "1000" → "9000"
    const doc = await PDFDocument.load(signedPdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPage(0).drawText("Jumlah anggaran: 9000 rupiah", { x: 50, y: 750, size: 14, font });
    const tampered = Buffer.from(await doc.save({ useObjectStreams: true }));

    const res = await verifyAllSignatures(tampered);
    expect(res.valid).toBe(false);
    expect(res.signers[0].reason).toMatch(/diubah/i);
  });

  it("UJI TAMPER tingkat byte: 1 byte stream konten halaman di-flip → verify GAGAL", async () => {
    const kp = generateKeypair();
    const { signedPdfBytes } = await signDocument(await makeTestPdf(), kp.privateKeyDer, kp.publicKeyPem, DEMO_META);
    // ambil stream konten halaman 1 (hasil decode), flip satu byte di tengah, pasang kembali
    const { loadPdf } = await import("@/lib/pdf/pdf-utils");
    const doc = await loadPdf(signedPdfBytes);
    const leaf = doc.getPage(0).node;
    // Contents = array PDFRef ke PDFRawStream (Flate) — decode manual via zlib, flip 1 byte
    const { PDFRawStream, PDFContext, PDFName, PDFArray } = await import("pdf-lib");
    const zlib = await import("node:zlib");
    const contents = leaf.Contents() as unknown;
    const firstRef = contents instanceof PDFArray ? (contents as { get(i: number): unknown }).get(0) : contents;
    const raw = doc.context.lookup(firstRef as never) as unknown as {
      getContents(): Uint8Array;
      dict: { get(k: unknown): unknown };
    };
    const packed = Buffer.from(raw.getContents());
    const decoded = raw.dict.get(PDFName.of("Filter")) ? zlib.inflateSync(packed) : packed;
    decoded[Math.floor(decoded.length / 2)] ^= 0xff;
    const fresh = doc.context.register(
      PDFRawStream.of(PDFContext.create().obj({}) as import("pdf-lib").PDFDict, decoded),
    );
    leaf.set(PDFName.of("Contents"), fresh);
    const res = await verifyAllSignatures(Buffer.from(await doc.save({ useObjectStreams: true })));
    expect(res.valid).toBe(false);
  });

  it("UJI KUNCI SALAH: verify pakai public key berbeda → GAGAL, alasan kunci tidak cocok", async () => {
    const signer = generateKeypair();
    const stranger = generateKeypair();
    const { signedPdfBytes } = await signDocument(await makeTestPdf(), signer.privateKeyDer, signer.publicKeyPem, DEMO_META);
    const res = await verifyAllSignatures(signedPdfBytes, stranger.publicKeyPem);
    expect(res.valid).toBe(false);
    expect(res.signers[0].reason).toMatch(/kunci publik/i);
  });

  it("dokumen tanpa tanda tangan → verify menolak dengan alasan jelas", async () => {
    const res = await verifyAllSignatures(await makeTestPdf());
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/tidak memiliki tanda tangan/i);
  });

  it("metadata signer di payload diubah (nama diganti) → signature tidak valid", async () => {
    const kp = generateKeypair();
    const { signedPdfBytes } = await signDocument(await makeTestPdf(), kp.privateKeyDer, kp.publicKeyPem, DEMO_META);
    // muat ulang, edit nama signer di metadata, simpan
    const { readSignInfo, writeSignInfo, loadPdf } = await import("@/lib/pdf/pdf-utils");
    const doc = await loadPdf(signedPdfBytes);
    const info = readSignInfo(doc)!;
    info.signatures[0].signerName = "Penyusup";
    writeSignInfo(doc, info);
    const res = await verifyAllSignatures(Buffer.from(await doc.save({ useObjectStreams: true })));
    expect(res.valid).toBe(false);
    expect(res.signers[0].reason).toMatch(/tidak valid|dipalsukan/i);
  });
});
