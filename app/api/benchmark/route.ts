import { signDocument, verifyAllSignatures } from "@/lib/pdf/multi-signer";
import { measure } from "@/lib/metrics/timing";
import { parseSignForm } from "@/lib/server/sign-form";
import { createPublicKey } from "node:crypto";

export const runtime = "nodejs";

/**
 * TASK.md §3.5 — ≥30 percobaan sign() dan verify() pada satu dokumen,
 * plus ukuran signature & public key. iterations default 30, maks 500.
 */
export async function POST(request: Request) {
  let ctx: Awaited<ReturnType<typeof parseSignForm>>;
  let iterations = 30;
  try {
    ctx = await parseSignForm(request);
    iterations = ctx.iterations;
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json({ error: msg }, { status: /passphrase/i.test(msg) ? 403 : 400 });
  }
  try {
    const first = await signDocument(ctx.pdfBytes, ctx.privateKeyDer, ctx.publicKeyPem, ctx.meta);
    const signRes = await measure(
      () => signDocument(ctx.pdfBytes, ctx.privateKeyDer, ctx.publicKeyPem, { ...ctx.meta }),
      iterations,
    );
    const verifyRes = await measure(() => verifyAllSignatures(first.signedPdfBytes), iterations);
    ctx.privateKeyDer.fill(0);

    return Response.json({
      avgSignMs: signRes.avgMs,
      minSignMs: signRes.minMs,
      maxSignMs: signRes.maxMs,
      avgVerifyMs: verifyRes.avgMs,
      minVerifyMs: verifyRes.minMs,
      maxVerifyMs: verifyRes.maxMs,
      iterations,
      signatureSizeBytes: Buffer.from(first.payload.signature, "base64").length,
      publicKeySizeBytes: Buffer.from(
        createPublicKey(ctx.publicKeyPem).export({ format: "der", type: "spki" }),
      ).length,
      documentSizeBytes: ctx.pdfBytes.length,
      signedDocumentSizeBytes: first.signedPdfBytes.length,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
