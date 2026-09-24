import { describe, it, expect } from "vitest";
import { generateKeypair } from "@/lib/crypto/keypair";
import { encryptPrivateKey, decryptPrivateKey } from "@/lib/crypto/key-protection";

describe("proteksi private key (AES-256-GCM + scrypt)", () => {
  it("round-trip enkripsi→dekripsi dengan passphrase benar menghasilkan DER identik", () => {
    const { privateKeyDer } = generateKeypair();
    const file = encryptPrivateKey(privateKeyDer, "rahasia123");
    const back = decryptPrivateKey(file, "rahasia123");
    expect(back.equals(privateKeyDer)).toBe(true);
  });

  it("passphrase SALAH harus gagal didekripsi (authTag GCM)", () => {
    const { privateKeyDer } = generateKeypair();
    const file = encryptPrivateKey(privateKeyDer, "benar");
    expect(() => decryptPrivateKey(file, "salah")).toThrow(/passphrase/i);
  });

  it("file terenkripsi tidak pernah memuat plaintext private key", () => {
    const { privateKeyDer } = generateKeypair();
    const file = encryptPrivateKey(privateKeyDer, "kunci");
    const raw = Buffer.from(file, "base64").toString("binary");
    expect(raw.includes(privateKeyDer.toString("binary"))).toBe(false);
    // dan cek juga pada level DER vs ciphertext mentah
    expect(Buffer.from(file, "base64").includes(privateKeyDer.subarray(20, 50))).toBe(false);
  });

  it("dua enkripsi passphrase sama menghasilkan file berbeda (salt & IV acak)", () => {
    const { privateKeyDer } = generateKeypair();
    const f1 = encryptPrivateKey(privateKeyDer, "sama");
    const f2 = encryptPrivateKey(privateKeyDer, "sama");
    expect(f1).not.toBe(f2);
    expect(decryptPrivateKey(f1, "sama").equals(decryptPrivateKey(f2, "sama"))).toBe(true);
  });

  it("file rusak / format asing ditolak", () => {
    expect(() => decryptPrivateKey("AAAA", "x")).toThrow();
    const tampered = encryptPrivateKey(generateKeypair().privateKeyDer, "ok");
    const buf = Buffer.from(tampered, "base64");
    buf[buf.length - 1] ^= 0xff; // ubah 1 byte ciphertext
    expect(() => decryptPrivateKey(buf.toString("base64"), "ok")).toThrow();
  });

  it("passphrase kosong ditolak", () => {
    const { privateKeyDer } = generateKeypair();
    expect(() => encryptPrivateKey(privateKeyDer, "")).toThrow();
  });
});
