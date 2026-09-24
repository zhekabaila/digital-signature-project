import { describe, it, expect } from "vitest";
import { createPublicKey, createPrivateKey, sign, verify } from "node:crypto";
import { generateKeypair, fingerprintFromPublicKeyPem, loadPrivateKey } from "@/lib/crypto/keypair";

describe("keypair ECDSA P-256", () => {
  it("menghasilkan public key SPKI/PEM dan private key PKCS#8 DER", () => {
    const kp = generateKeypair();
    expect(kp.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(kp.privateKeyDer.length).toBeGreaterThan(100);
    expect(() => createPublicKey(kp.publicKeyPem)).not.toThrow();
    expect(() => loadPrivateKey(kp.privateKeyDer)).not.toThrow();
  });

  it("kurva yang dipakai benar-benar P-256", () => {
    const kp = generateKeypair();
    const der = createPublicKey(kp.publicKeyPem).export({ type: "spki", format: "der" });
    // OID 1.2.840.10045.3.1.7 (prime256v1 / P-256) harus muncul di SPKI DER
    expect(der.toString("hex")).toContain("2a8648ce3d030107");
  });

  it("dua kali generate menghasilkan key berbeda (randomness)", () => {
    const a = generateKeypair();
    const b = generateKeypair();
    expect(a.publicKeyPem).not.toBe(b.publicKeyPem);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("fingerprint konsisten dihitung ulang dari PEM yang sama", () => {
    const kp = generateKeypair();
    expect(fingerprintFromPublicKeyPem(kp.publicKeyPem)).toBe(kp.fingerprint);
    expect(kp.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("round-trip export/import private key DER mempertahankan pasangan kunci", () => {
    const kp = generateKeypair();
    const key = createPrivateKey({ key: kp.privateKeyDer, format: "der", type: "pkcs8" });
    const sig = sign("sha256", Buffer.from("data"), key);
    expect(verify("sha256", Buffer.from("data"), createPublicKey(kp.publicKeyPem), sig)).toBe(true);
  });
});
