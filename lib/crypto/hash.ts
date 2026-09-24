import { createHash } from "node:crypto";

/** SHA-256 dari sebuah buffer, dikembalikan sebagai hex string. */
export function sha256Hex(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** SHA-256 dari sebuah buffer, dikembalikan sebagai Buffer 32 byte. */
export function sha256Digest(data: Buffer | Uint8Array): Buffer {
  return createHash("sha256").update(data).digest();
}

/**
 * Hash dokumen inti (TASK.md §3.4 Opsi A — chained):
 *   digest_i = SHA256( byte konten kanonik PDF || signature_signer_1 || ... || signature_signer_{i-1} )
 * `prevSignatures` kosong untuk penandatangan pertama.
 */
export function hashForSigner(
  canonicalPdfBytes: Buffer | Uint8Array,
  prevSignatures: readonly Buffer[],
): Buffer {
  const h = createHash("sha256").update(canonicalPdfBytes);
  for (const sig of prevSignatures) h.update(sig);
  return h.digest();
}
