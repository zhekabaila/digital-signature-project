import {
  computeCanonicalBytes,
  embedSignaturePage,
  loadPdf,
  readSignInfo,
  writeSignInfo,
} from "./pdf-utils";
import { generateQRPng } from "../qrcode/qr-utils";
import { hashForSigner } from "../crypto/hash";
import { signData, verifySignature } from "../crypto/sign-verify";
import { fingerprintFromPublicKeyPem } from "../crypto/keypair";

export interface SignerMeta {
  signerName: string;
  signerRole: string;
  institution: string;
  /** ISO timestamp — diisi pemanggil (agar fungsi pure & teruji). */
  timestamp: string;
}

/** Payload yang ditanam di QR-Code DAN di metadata PDF (TASK.md §3.2). */
export interface SignerPayload {
  signerName: string;
  signerRole: string;
  institution: string;
  timestamp: string;
  documentHash: string;
  signature: string; // base64 DER ECDSA
  publicKeyFingerprint: string;
  publicKeyPem: string;
}

export interface SignInfo {
  v: 1;
  /** Jumlah halaman dokumen ASLI (halaman setelah ini = halaman tanda tangan). */
  origPageCount: number;
  signatures: SignerPayload[];
}

export interface SignResult {
  signedPdfBytes: Buffer;
  payload: SignerPayload;
  qrPng: Buffer;
}

/**
 * Susun string metadata dengan URUTAN KEY TETAP — bagian yang ikut
 * ditandatangani, sehingga perubahan nama/institusi/waktu terdeteksi verify.
 */
export function metaSignableBytes(p: Pick<SignerPayload, "signerName" | "signerRole" | "institution" | "timestamp" | "publicKeyFingerprint">): Buffer {
  return Buffer.from(
    JSON.stringify([p.signerName, p.signerRole, p.institution, p.timestamp, p.publicKeyFingerprint]),
    "utf8",
  );
}

/**
 * DATA utuh yang ditandatangani signer ke-i (TASK.md §3.4 Opsi A — chained):
 *   SHA256(kanonik PDF || sig_1 || ... || sig_{i-1})  ||  metaBytes
 */
function signingDataFor(
  canonical: Buffer,
  prevSignatures: readonly Buffer[],
  metaBytes: Buffer,
): { digest: Buffer; data: Buffer } {
  const digest = hashForSigner(canonical, prevSignatures);
  return { digest, data: Buffer.concat([digest, metaBytes]) };
}

/**
 * Tanda tangani dokumen (atau tambah penandatangan berikutnya pada dokumen
 * yang sudah bertanda tangan — alur sama karena chained hashing membaca
 * signature sebelumnya dari metadata).
 */
export async function signDocument(
  pdfBytes: Buffer | Uint8Array,
  privateKey: Buffer | import("node:crypto").KeyObject,
  publicKeyPem: string,
  meta: SignerMeta,
): Promise<SignResult> {
  const fingerprint = fingerprintFromPublicKeyPem(publicKeyPem);
  const { canonical, info } = await computeCanonicalBytes(pdfBytes);
  const prevSignatures = (info?.signatures ?? []).map((s) => Buffer.from(s.signature, "base64"));

  const { digest, data } = signingDataFor(canonical, prevSignatures, metaSignableBytes({ ...meta, publicKeyFingerprint: fingerprint }));
  const signature = signData(data, privateKey);

  const payload: SignerPayload = {
    ...meta,
    documentHash: digest.toString("hex"),
    signature: signature.toString("base64"),
    publicKeyFingerprint: fingerprint,
    publicKeyPem,
  };

  const qrPng = await generateQRPng(JSON.stringify(payload));

  const doc = await loadPdf(pdfBytes);
  const existing = readSignInfo(doc);
  const signers = existing ? existing.signatures : [];
  await embedSignaturePage(
    doc,
    qrPng,
    [
      `Nama    : ${payload.signerName}`,
      `Jabatan : ${payload.signerRole}`,
      `Instansi: ${payload.institution}`,
      `Waktu   : ${payload.timestamp}`,
      `Signer ke-${signers.length + 1} dari dokumen bertanda tangan digital`,
    ],
    `Halaman Tanda Tangan Digital — ${payload.signerName}`,
  );
  const newInfo: SignInfo = {
    v: 1,
    origPageCount: existing ? existing.origPageCount : (info ? info.origPageCount : doc.getPageCount() - 1),
    signatures: [...signers, payload],
  };
  writeSignInfo(doc, newInfo);
  return { signedPdfBytes: Buffer.from(await doc.save({ useObjectStreams: true })), payload, qrPng };
}

export interface SignerStatus {
  signer: SignerPayload;
  valid: boolean;
  /** Bahasa Indonesia, siap ditampilkan di UI. */
  reason?: string;
}

export interface VerifyResult {
  valid: boolean;
  signers: SignerStatus[];
  reason?: string;
}

/**
 * Verifikasi SEMUA tanda tangan pada PDF (TASK.md §3.3 + §3.4):
 *  1) hitung ulang hash kanonik → beda = dokumen diubah (lapis tolak 1)
 *  2) verifySignature per signer dengan publicKeyPem override (uji kunci salah)
 *     atau publicKeyPem bawaan payload (lapis tolak 2)
 */
export async function verifyAllSignatures(
  pdfBytes: Buffer | Uint8Array,
  overridePublicKeyPem?: string,
): Promise<VerifyResult> {
  let canonical: Buffer;
  let info: SignInfo | null;
  try {
    ({ canonical, info } = await computeCanonicalBytes(pdfBytes));
  } catch {
    return { valid: false, signers: [], reason: "Dokumen bukan PDF valid atau rusak" };
  }
  if (!info || info.signatures.length === 0) {
    return { valid: false, signers: [], reason: "Dokumen tidak memiliki tanda tangan digital" };
  }

  const statuses: SignerStatus[] = [];
  const prevSignatures: Buffer[] = [];
  for (const p of info.signatures) {
    const { data, digest } = signingDataFor(
      canonical,
      prevSignatures,
      metaSignableBytes(p),
    );
    let reason: string | undefined;
    if (digest.toString("hex") !== p.documentHash) {
      reason = "Dokumen telah diubah setelah ditandatangani (hash tidak cocok)";
    } else {
      const keyPem = overridePublicKeyPem ?? p.publicKeyPem;
      const ok = verifySignature(data, Buffer.from(p.signature, "base64"), keyPem);
      if (!ok) {
        reason = overridePublicKeyPem
          ? `Tanda tangan tidak cocok dengan kunci publik yang diberikan (fingerprint signer: ${p.publicKeyFingerprint})`
          : "Tanda tangan tidak valid (dipalsukan atau data payload diubah)";
      }
    }
    statuses.push({ signer: p, valid: !reason, reason });
    prevSignatures.push(Buffer.from(p.signature, "base64"));
  }
  return { valid: statuses.every((s) => s.valid), signers: statuses };
}

/**
 * Verifikasi HANYA dari payload hasil scan QR (tanpa file PDF):
 * membuktikan signature sah terhadap kunci publik & hash yang tercantum,
 * tapi kecocokan dokumen fisik tidak bisa dicek tanpa PDF-nya.
 */
export function verifyQrPayload(qrJson: string, overridePublicKeyPem?: string): VerifyResult {
  let p: SignerPayload;
  try {
    p = JSON.parse(qrJson) as SignerPayload;
    if (!p.documentHash || !p.signature || !p.publicKeyPem) throw new Error();
  } catch {
    return { valid: false, signers: [], reason: "Payload QR tidak dikenali / bukan payload tanda tangan" };
  }
  const digest = Buffer.from(p.documentHash, "hex");
  const data = Buffer.concat([digest, metaSignableBytes(p)]);
  const keyPem = overridePublicKeyPem ?? p.publicKeyPem;
  const ok = verifySignature(data, Buffer.from(p.signature, "base64"), keyPem);
  const status: SignerStatus = {
    signer: p,
    valid: ok,
    reason: ok
      ? undefined
      : "Tanda tangan tidak cocok dengan kunci publik (payload QR mungkin dipalsukan)",
  };
  return { valid: ok, signers: [status] };
}

/** Daftar signer (nama + status) untuk UI multi-sign. */
export function listSigners(info: SignInfo | null) {
  if (!info) return [];
  return info.signatures.map((s, i) => ({ index: i + 1, name: s.signerName, role: s.signerRole, timestamp: s.timestamp }));
}
