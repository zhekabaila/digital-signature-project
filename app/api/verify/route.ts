import { verifyAllSignatures, verifyQrPayload } from "@/lib/pdf/multi-signer";

export const runtime = "nodejs";

/**
 * TASK.md §3.3 — terima PDF bertanda tangan ATAU qrPayload hasil scan kamera.
 * Opsi publicKeyPem untuk uji "kunci tidak cocok" (§3.5).
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const doc = form.get("document");
  const qrPayload = form.get("qrPayload");
  const overrideKey = form.get("publicKeyPem");

  if (typeof qrPayload === "string" && qrPayload.length > 0) {
    const res = verifyQrPayload(qrPayload, typeof overrideKey === "string" ? overrideKey : undefined);
    return Response.json(res);
  }
  if (!(doc instanceof File)) {
    return Response.json({ error: "Unggah PDF atau kirim qrPayload" }, { status: 400 });
  }
  if (doc.type && doc.type !== "application/pdf") {
    return Response.json({ error: "File harus berformat PDF" }, { status: 400 });
  }
  const bytes = Buffer.from(await doc.arrayBuffer());
  const res = await verifyAllSignatures(bytes, typeof overrideKey === "string" ? overrideKey : undefined);
  return Response.json(res);
}
