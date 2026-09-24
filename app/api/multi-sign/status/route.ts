import { getDocument } from "@/lib/pdf/sign-session-store";
import { verifyAllSignatures } from "@/lib/pdf/multi-signer";

export const runtime = "nodejs";

/**
 * TASK.md §4: GET /api/multi-sign/status?docId=... → daftar signer + status.
 * docId dikembalikan oleh /api/sign dan /api/multi-sign/add (header X-Document-Id).
 * Dokumen disimpan HANYA di memori sesi (lihat sign-session-store.ts).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const docId = url.searchParams.get("docId");
  if (!docId) return Response.json({ error: "Parameter docId wajib ada" }, { status: 400 });
  const stored = getDocument(docId);
  if (!stored) {
    return Response.json(
      { error: "Dokumen tidak ditemukan (sesi berakhir / server restart — unggah ulang PDF)" },
      { status: 404 },
    );
  }
  const res = await verifyAllSignatures(stored.bytes);
  return Response.json({
    signers: res.signers.map((s) => ({
      name: s.signer.signerName,
      role: s.signer.signerRole,
      institution: s.signer.institution,
      timestamp: s.signer.timestamp,
      signed: true,
      valid: s.valid,
      reason: s.reason,
    })),
    documentValid: res.valid,
    documentReason: res.reason,
  });
}
