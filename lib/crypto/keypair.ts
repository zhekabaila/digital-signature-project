import { generateKeyPairSync, createPrivateKey, createPublicKey } from "node:crypto";
import { sha256Hex } from "./hash";
import { encryptPrivateKey, decryptPrivateKey } from "./key-protection";

export interface KeyPairResult {
  /** Public key format SPKI/PEM — boleh dibagikan bebas. */
  publicKeyPem: string;
  /** Private key PKCS#8 DER mentah — HANYA boleh diproses lebih lanjut oleh key-protection. */
  privateKeyDer: Buffer;
  /** Fingerprint pendek (16 hex pertama SHA-256 dari SPKI DER) utk pencocokan verifier. */
  fingerprint: string;
}

export function fingerprintFromPublicKeyPem(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256Hex(der).slice(0, 16);
}

/** TASK.md §3.1 — generate keypair ECDSA P-256. */
export function generateKeypair(): KeyPairResult {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
  return {
    publicKeyPem,
    privateKeyDer,
    fingerprint: fingerprintFromPublicKeyPem(publicKeyPem),
  };
}

/**
 * Load private key PKCS#8 DER (hasil decryptPrivateKey) menjadi KeyObject siap pakai.
 * Private key plaintext hanya hidup di memory selama sign() — lihat §8 TASK.md.
 */
export function loadPrivateKey(der: Buffer) {
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

export function loadPublicKey(pem: string) {
  return createPublicKey(pem);
}

/**
 * Bungkus privat+publik dalam SATU file terenkripsi (public key ikut di dalam
 * karena payload QR/metadata saat sign membutuhkan pasangan publiknya).
 * Struktur plaintext hanya hidup sesaat dalam memori (TASK.md §8).
 */
export function exportEncryptedKeyBundle(passphrase: string): {
  bundleFile: string;
  publicKeyPem: string;
  fingerprint: string;
} {
  const kp = generateKeypair();
  const payload = Buffer.from(
    JSON.stringify({ d: kp.privateKeyDer.toString("base64"), p: kp.publicKeyPem }),
  );
  // zero-out DER plaintext secepat mungkin
  kp.privateKeyDer.fill(0);
  return {
    bundleFile: encryptPrivateKey(payload, passphrase),
    publicKeyPem: kp.publicKeyPem,
    fingerprint: kp.fingerprint,
  };
}

export function openKeyBundle(
  bundleFile: string,
  passphrase: string,
): { privateKeyDer: Buffer; publicKeyPem: string } {
  const obj = JSON.parse(decryptPrivateKey(bundleFile, passphrase).toString("utf8"));
  return { privateKeyDer: Buffer.from(obj.d, "base64"), publicKeyPem: obj.p };
}
