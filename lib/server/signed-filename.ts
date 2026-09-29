/**
 * Nama berkas hasil sign: nama dokumen asal dipertahankan, hanya sufiks status
 * (-signed / -multi-signed) yang ditambahkan sebelum ekstensi .pdf.
 * Sufiks lama dibuang lebih dulu agar tidak menumpuk saat dokumen hasil sign
 * ditandatangani lagi (x-signed.pdf → x-multi-signed.pdf, bukan x-signed-multi-signed.pdf).
 */
export function signedFileName(original: string | undefined, suffix: "signed" | "multi-signed"): string {
  let base = (original ?? "").replace(/[\x00-\x1f"\\/]/g, "_").trim().replace(/\.pdf$/i, "");
  base = base.replace(/-(?:multi-)?signed$/i, "");
  return `${base.slice(0, 120) || "document"}-${suffix}.pdf`;
}
