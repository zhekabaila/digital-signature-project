import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

const MAGIC = "DSG1";
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN);
}

/**
 * TASK.md §3.1 — private key DER dienkripsi AES-256-GCM dengan key dari scrypt(passphrase).
 * Format file: base64( "DSG1" | salt(16) | iv(12) | authTag(16) | ciphertext ).
 * Private key plaintext TIDAK PERNAH ditulis ke disk.
 */
export function encryptPrivateKey(privateKeyDer: Buffer, passphrase: string): string {
  if (!passphrase) throw new Error("Passphrase tidak boleh kosong");
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKeyDer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from(MAGIC, "ascii"), salt, iv, authTag, ciphertext]).toString(
    "base64",
  );
}

/** Dekripsi file private key terenkripsi → DER. Melempar error jika passphrase salah (authTag gagal). */
export function decryptPrivateKey(encryptedFileBase64: string, passphrase: string): Buffer {
  const raw = Buffer.from(encryptedFileBase64.trim(), "base64");
  if (raw.length < 4 + SALT_LEN + IV_LEN + TAG_LEN || raw.subarray(0, 4).toString("ascii") !== MAGIC) {
    throw new Error("Format file private key tidak dikenali");
  }
  let o = 4;
  const salt = raw.subarray(o, o + SALT_LEN); o += SALT_LEN;
  const iv = raw.subarray(o, o + IV_LEN); o += IV_LEN;
  const authTag = raw.subarray(o, o + TAG_LEN); o += TAG_LEN;
  const ciphertext = raw.subarray(o);
  const key = deriveKey(passphrase, salt);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Gagal dekripsi: passphrase salah atau file rusak");
  }
}
