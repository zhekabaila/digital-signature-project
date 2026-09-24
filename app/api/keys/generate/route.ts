import { exportEncryptedKeyBundle } from "@/lib/crypto/keypair";

export const runtime = "nodejs";

/** TASK.md §4: passphrase → keypair ECDSA P-256, private key terenkripsi (bundle). */
export async function POST(request: Request) {
  const { passphrase } = (await request.json()) as { passphrase?: string };
  if (!passphrase || passphrase.length < 8) {
    return Response.json(
      { error: "Passphrase wajib diisi minimal 8 karakter" },
      { status: 400 },
    );
  }
  try {
    const { bundleFile, publicKeyPem, fingerprint } = exportEncryptedKeyBundle(passphrase);
    return Response.json({ publicKeyPem, fingerprint, encryptedPrivateKeyFile: bundleFile });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
