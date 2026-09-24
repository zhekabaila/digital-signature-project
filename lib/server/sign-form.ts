import { openKeyBundle } from "@/lib/crypto/keypair";

/**
 * Parse + validasi form sign/multi-sign/benchmark (route handler tetap tipis).
 * Private key plaintext dikembalikan untuk dipakai segera lalu di-zero oleh pemanggil.
 */
export async function parseSignForm(request: Request) {
  const form = await request.formData();
  const doc = form.get("document");
  const key = form.get("encryptedPrivateKey");
  const passphrase = String(form.get("passphrase") ?? "");
  if (!(doc instanceof File)) throw new Error("File dokumen PDF wajib diunggah");
  if (!(key instanceof File)) throw new Error("File private key terenkripsi wajib diunggah");
  const { privateKeyDer, publicKeyPem } = openKeyBundle(await key.text(), passphrase);
  return {
    privateKeyDer,
    publicKeyPem,
    pdfBytes: Buffer.from(await doc.arrayBuffer()),
    iterations: Math.min(500, Math.max(1, Number(form.get("iterations")) || 30)),
    meta: {
      signerName: String(form.get("signerName") ?? ""),
      signerRole: String(form.get("signerRole") ?? ""),
      institution: String(form.get("institution") ?? ""),
      timestamp: new Date().toISOString(),
    },
  };
}
