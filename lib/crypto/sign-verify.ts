import {
  sign,
  verify,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";

/**
 * ECDSA P-256 / SHA-256 atas SEMUA byte `data` (bukan cuma hash dokumen —
 * metadata signer ikut ditandatangani agar pemalsuan nama/institusi terdeteksi).
 */
import type { KeyObject } from "node:crypto";

export function signData(
  data: Buffer | Uint8Array,
  privateKey: Buffer | string | KeyObject,
): Buffer {
  const key =
    typeof privateKey === "string"
      ? createPrivateKey(privateKey)
      : Buffer.isBuffer(privateKey)
        ? createPrivateKey({ key: privateKey, format: "der", type: "pkcs8" })
        : privateKey;
  return sign("sha256", data, key);
}

/** Verifikasi signature terhadap public key SPKI/PEM. false = tidak cocok (TASK.md §3.3 lapis 2). */
export function verifySignature(
  data: Buffer | Uint8Array,
  signature: Buffer | Uint8Array,
  publicKeyPem: string,
): boolean {
  try {
    return verify("sha256", data, createPublicKey(publicKeyPem), signature);
  } catch {
    return false;
  }
}

/**
 * Helper attack-lab (TASK.md §3.5): tanda tangani data dengan private key SEMBARANGAN
 * (bukan pasangan public key yang dipakai verifier) → menghasilkan signature invalid.
 */
export function forgeSignatureWithRandomKey(data: Buffer | Uint8Array): Buffer {
  // Key dummy dibuat ulang tiap panggilan, tidak pernah disimpan (AGENTS.md: no fixtures).
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return signData(data, privateKey);
}

export function randomSignatureBytes(): Buffer {
  return randomBytes(72);
}
