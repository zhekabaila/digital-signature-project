import { describe, it, expect } from "vitest";
import { decryptPrivateKey, encryptPrivateKey } from "@/lib/crypto/key-protection";
import { exportEncryptedKeyBundle, generateKeypair } from "@/lib/crypto/keypair";
import { signDocument, verifyAllSignatures } from "@/lib/pdf/multi-signer";
import { readSignInfo, writeSignInfo, loadPdf } from "@/lib/pdf/pdf-utils";
import { makeTestPdf, DEMO_META } from "./helpers";

const meta = (name: string, ts: string) => ({ ...DEMO_META, signerName: name, timestamp: ts });

describe("Tabel 5.3 — skenario negatif tambahan", () => {
  it("(1) Passphrase salah saat dekripsi private key → ditolak di level library", () => {
    const bundle = encryptPrivateKey(Buffer.from("kunci-dummy-untuk-uji"), "passphrase-benar-12345");
    let msg = "";
    expect(() => {
      try {
        decryptPrivateKey(bundle, "passphrase-salah-12345");
      } catch (e) {
        msg = (e as Error).message;
        throw e;
      }
    }).toThrow(/passphrase salah/i);
    console.log("HASIL AKTUAL (library):", JSON.stringify(msg));
  });

  it("(1b) Passphrase salah via API /api/sign → HTTP 403 + pesan dekripsi gagal", async () => {
    const { POST } = await import("@/app/api/sign/route");
    const { publicKeyPem, bundleFile } = exportEncryptedKeyBundle("passphrase-benar-12345");
    void publicKeyPem;
    const pdf = await makeTestPdf();
    const fd = new FormData();
    fd.append("document", new File([new Uint8Array(pdf)], "uji.pdf", { type: "application/pdf" }));
    fd.append("encryptedPrivateKey", new File([bundleFile], "k.dsk"));
    fd.append("passphrase", "passphrase-salah-12345");
    fd.append("signerName", "Penguji");
    fd.append("signerRole", "Staf");
    fd.append("institution", "Universitas Siliwangi");
    const req = new Request("http://localhost/api/sign", { method: "POST", body: fd });
    const res = await POST(req);
    const body = (await res.json()) as { error?: string };
    console.log("HASIL AKTUAL (API): status", res.status, "error:", JSON.stringify(body.error));
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/passphrase/i);
  });

  it("(2) Multi-signer: signature ke-2 dihapus dari rantai → signer ke-3 gagal chained-hash", async () => {
    const kps = [generateKeypair(), generateKeypair(), generateKeypair()];
    let bytes = await makeTestPdf();
    for (let i = 0; i < 3; i++) {
      ({ signedPdfBytes: bytes } = await signDocument(bytes, kps[i].privateKeyDer, kps[i].publicKeyPem, meta(`Signer ${i + 1}`, `2026-09-23T0${i + 1}:00:00.000Z`)));
    }
    // kondisi awal: semua sah
    expect((await verifyAllSignatures(bytes)).valid).toBe(true);

    // penyerang membuang ENTRI KE-2 dari metadata /DSig (memalsukan "signer 2 tidak pernah ikut")
    const doc = await loadPdf(bytes);
    const info = readSignInfo(doc)!;
    info.signatures.splice(1, 1);
    writeSignInfo(doc, info);
    const tampered = Buffer.from(await doc.save({ useObjectStreams: true }));

    const res = await verifyAllSignatures(tampered);
    console.log(
      "HASIL AKTUAL (rantai): valid=" + res.valid,
      JSON.stringify(
        res.signers.map((s) => ({ signer: s.signer.signerName, valid: s.valid, reason: s.reason ?? null })),
      ),
    );
    expect(res.valid).toBe(false);
    expect(res.signers.some((s) => s.signer.signerName === "Signer 3" && !s.valid && /hash tidak cocok/.test(s.reason ?? ""))).toBe(true);
  });
});
