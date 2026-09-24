import { describe, it, expect } from "vitest";
import { generateQRPng, qrTextToRawBitmap, decodeQRBitmap, isSignerPayloadJson } from "@/lib/qrcode/qr-utils";
import { verifyQrPayload } from "@/lib/pdf/multi-signer";
import { generateKeypair } from "@/lib/crypto/keypair";
import { signDocument } from "@/lib/pdf/multi-signer";
import { makeTestPdf, DEMO_META } from "./helpers";

describe("QR-Code generate/decode round-trip", () => {
  it("teks payload → bitmap QR → decode kembali identik", () => {
    const payload = JSON.stringify({ hello: "dunia", n: 42 });
    const bmp = qrTextToRawBitmap(payload);
    expect(decodeQRBitmap(bmp)).toBe(payload);
  });

  it("generateQRPng menghasilkan PNG valid (magic bytes) dan deterministik", async () => {
    const png = await generateQRPng("test-123");
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    const png2 = await generateQRPng("test-123");
    expect(png.equals(png2)).toBe(true);
  });

  it("bitmap rusak / bukan QR → decode menghasilkan null", () => {
    const broken = new Uint8ClampedArray(64 * 64 * 4);
    let seed = 12345;
    for (let i = 0; i < broken.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      broken[i] = seed & 0xff;
    }
    expect(decodeQRBitmap({ data: broken, width: 64, height: 64 })).toBeNull();
  });

  it("payload hasil tanda tangan PDF lolos validasi skema QR", async () => {
    const kp = generateKeypair();
    const { payload } = await signDocument(await makeTestPdf(), kp.privateKeyDer, kp.publicKeyPem, DEMO_META);
    const json = JSON.stringify(payload);
    expect(isSignerPayloadJson(json)).toBe(true);
    // dan benar-benar bisa di-decode dari QR-nya
    expect(decodeQRBitmap(qrTextToRawBitmap(json))).toBe(json);
  });

  it("payload rusak/dipotong → ditolak skema", () => {
    expect(isSignerPayloadJson("{ bukan json")).toBe(false);
    expect(isSignerPayloadJson(JSON.stringify({ dokumen: "tanpa field wajib" }))).toBe(false);
    expect(isSignerPayloadJson(JSON.stringify({ ...DEMO_META, documentHash: "zz", signature: "x", publicKeyPem: "y" }))).toBe(false);
  });

  it("UJI QR DIPALSUKAN: payload QR hasil-scan yang namaya diubah → verifyQrPayload GAGAL", async () => {
    const kp = generateKeypair();
    const { payload } = await signDocument(await makeTestPdf(), kp.privateKeyDer, kp.publicKeyPem, DEMO_META);
    const forged = { ...payload, signerName: "Penyerang" };
    const res = verifyQrPayload(JSON.stringify(forged));
    expect(res.valid).toBe(false);
    expect(res.signers[0].reason).toMatch(/kunci publik|dipalsukan/i);
  });

  it("UJI QR DIPALSUKAN: signature diganti string acak → verifyQrPayload GAGAL", async () => {
    const kp = generateKeypair();
    const { payload } = await signDocument(await makeTestPdf(), kp.privateKeyDer, kp.publicKeyPem, DEMO_META);
    const forged = { ...payload, signature: Buffer.from("palsu").toString("base64") };
    expect(verifyQrPayload(JSON.stringify(forged)).valid).toBe(false);
  });

  it("verifyQrPayload dengan kunci publik salah → GAGAL; kunci benar → OK", async () => {
    const kp = generateKeypair();
    const other = generateKeypair();
    const { payload } = await signDocument(await makeTestPdf(), kp.privateKeyDer, kp.publicKeyPem, DEMO_META);
    const json = JSON.stringify(payload);
    expect(verifyQrPayload(json).valid).toBe(true);
    expect(verifyQrPayload(json, other.publicKeyPem).valid).toBe(false);
  });
});
