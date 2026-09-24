import QRCode from "qrcode";
import jsQR from "jsqr";

/**
 * Generate gambar QR-Code (PNG) berisi payload JSON metadata+signature.
 * Deterministik: teks yang sama → PNG yang sama.
 */
export async function generateQRPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 6,
    type: "png",
  });
}

export interface QRBitmap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Bitmap monokrom (RGBA 1:1 dengan modul QR) untuk uji round-trip di Node
 * tanpa perlu decoder PNG. 1 modul = 4 px agar mudah dibaca jsQR.
 */
export function qrTextToRawBitmap(text: string, moduleSize = 4): QRBitmap {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const dim = size * moduleSize;
  const out = new Uint8ClampedArray(dim * dim * 4);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const dark = data[Math.floor(y / moduleSize) * size + Math.floor(x / moduleSize)] ? 0 : 255;
      const o = (y * dim + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = dark;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: dim, height: dim };
}

/** Decode QR dari pixel RGBA (dipakai test Node DAN browser hasil canvas getImageData). */
export function decodeQRBitmap(bmp: QRBitmap): string | null {
  const res = jsQR(bmp.data, bmp.width, bmp.height);
  return res?.data ?? null;
}

/** Validasi bentuk payload QR — payload rusak/dipotong harus ditolak (test §3.5 kasus 3). */
export function isSignerPayloadJson(text: string): boolean {
  try {
    const o = JSON.parse(text);
    return (
      typeof o === "object" && o !== null &&
      typeof o.documentHash === "string" && /^[0-9a-f]{64}$/.test(o.documentHash) &&
      typeof o.signature === "string" && o.signature.length > 0 &&
      typeof o.publicKeyPem === "string" && o.publicKeyPem.includes("BEGIN PUBLIC KEY") &&
      typeof o.signerName === "string" && typeof o.timestamp === "string"
    );
  } catch {
    return false;
  }
}
