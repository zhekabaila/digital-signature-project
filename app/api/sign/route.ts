import { signDocument } from "@/lib/pdf/multi-signer";
import { putDocument } from "@/lib/pdf/sign-session-store";
import { parseSignForm } from "@/lib/server/sign-form";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

/** TASK.md §3.2 — PDF + private key terenkripsi + passphrase → PDF bertanda tangan + QR. */
export async function POST(request: Request) {
  let ctx: Awaited<ReturnType<typeof parseSignForm>>;
  try {
    ctx = await parseSignForm(request);
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json({ error: msg }, { status: /passphrase/i.test(msg) ? 403 : 400 });
  }
  if (!ctx.meta.signerName.trim()) {
    return Response.json({ error: "Nama penandatangan wajib diisi" }, { status: 400 });
  }
  try {
    const { signedPdfBytes } = await signDocument(
      ctx.pdfBytes,
      ctx.privateKeyDer,
      ctx.publicKeyPem,
      ctx.meta,
    );
    ctx.privateKeyDer.fill(0); // TASK.md §8 — buang plaintext segera
    const docId = randomUUID();
    putDocument(docId, signedPdfBytes, "signed-document.pdf");
    return new Response(new Uint8Array(signedPdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="signed-document.pdf"`,
        "X-Document-Id": docId,
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
