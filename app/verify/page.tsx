"use client";

import { useRef, useState } from "react";
import { PageHead, Panel, FileField, Stamp } from "@/components/ui";

type VerifyResp = {
  valid: boolean;
  reason?: string;
  signers?: { signer: { signerName: string; signerRole: string; institution: string; timestamp: string }; valid: boolean; reason?: string }[];
  error?: string;
};

export default function VerifyPage() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [keyPem, setKeyPem] = useState<File | null>(null);
  const [result, setResult] = useState<VerifyResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  async function verifyUpload() {
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      if (pdf) fd.append("document", pdf);
      if (keyPem) fd.append("publicKeyPem", await keyPem.text());
      const r = await fetch("/api/verify", { method: "POST", body: fd });
      setResult(await r.json());
    } finally { setBusy(false); }
  }

  async function startScan() {
    setScanning(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;
    const v = videoRef.current!;
    v.srcObject = stream;
    await v.play();
    const { default: jsQR } = await import("jsqr");
    const tick = async () => {
      const canvas = canvasRef.current!;
      if (v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          stopScan();
          const fd = new FormData();
          fd.append("qrPayload", code.data);
          const r = await fetch("/api/verify", { method: "POST", body: fd });
          setResult(await r.json());
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopScan() {
    setScanning(false);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  return (
    <div>
      <PageHead
        step="Langkah 03 — Verify"
        title="Periksa keaslian dokumen"
        sub="Verifikasi dua lapis: jika hash dokumen tidak cocok → “dokumen diubah”; jika signature tidak cocok dengan public key → “kunci tidak cocok”. Unggah public key pihak lain secara opsional untuk menguji penolakan kunci salah."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Unggah PDF tertanda" desc="Sertakan file public key signer untuk memaksa verifikasi terhadap kunci tertentu.">
          <div className="space-y-4">
            <FileField label="PDF bertanda tangan" accept="application/pdf" onChange={setPdf} fileName={pdf?.name ?? null} hint="Belum ada PDF dipilih" />
            <FileField label="Public key (opsional)" onChange={setKeyPem} fileName={keyPem?.name ?? null} hint="Untuk uji kunci tidak cocok — biarkan kosong untuk verifikasi normal" />
            <button className="btn btn-seal w-full justify-center" onClick={verifyUpload} disabled={busy || !pdf}>
              {busy ? "Memverifikasi…" : "⚖ Verifikasi PDF"}
            </button>
          </div>
        </Panel>
        <Panel title="Scan QR dari kamera" desc="Arahkan kamera ke QR-Code pada halaman tanda tangan. Scan hanya mengesahkan payload QR — tetap unggah PDF aslinya untuk memastikan isi dokumen utuh.">
          {scanning ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-lg border border-[var(--line-strong)]">
                <video ref={videoRef} className="w-full" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">Arahkan kamera ke QR pada halaman tanda tangan…</p>
              </div>
              <button className="btn btn-ghost w-full justify-center !border-[var(--err-line)] !text-[var(--err-ink)]" onClick={stopScan}>■ Hentikan scan</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="stamp !rotate-0" style={{ color: "var(--ink-soft)" }}>📷</span>
              <p className="text-sm text-[var(--ink-soft)]">Kamera mati. Tekan tombol di bawah untuk mulai memindai QR-Code pada dokumen tercetak/layar lain.</p>
              <button className="btn btn-ghost" onClick={startScan}>▶ Mulai scan QR</button>
            </div>
          )}
        </Panel>
      </div>

      {result && (
        <div className={`panel rise mt-6 p-5 ${result.valid ? "border-[var(--ok-line)] bg-[var(--ok-bg)]" : "border-[var(--err-line)] bg-[var(--err-bg)]"}`}>
          <div className="flex items-start justify-between gap-4">
            <p className={`font-[family-name:var(--font-display)] text-xl font-bold ${result.valid ? "text-[var(--ok-ink)]" : "text-[var(--err-ink)]"}`}>
              {result.error ? `Kesalahan: ${result.error}` : result.valid ? "Tanda tangan valid" : "Verifikasi gagal"}
            </p>
            <Stamp valid={result.valid} label={result.valid ? "SAH" : "DITOLAK"} />
          </div>
          {result.reason && <p className={`mt-2 text-sm ${result.valid ? "text-[var(--ok-ink)]" : "text-[var(--err-ink)]"}`}>{result.reason}</p>}
          {result.signers?.length ? (
            <ul className="mt-4 space-y-2">
              {result.signers.map((s, i) => (
                <li key={i} className="rounded-lg border border-[var(--line)] bg-white/70 p-3">
                  <span className={s.valid ? "text-[var(--ok-ink)]" : "text-[var(--err-ink)]"}>{s.valid ? "✓" : "✗"}</span>{" "}
                  <b>{s.signer.signerName}</b>
                  <span className="mono text-xs text-[var(--ink-soft)]"> — {s.signer.signerRole}, {s.signer.institution}</span>
                  <span className="mt-1 block text-xs text-[var(--ink-soft)]">
                    {new Date(s.signer.timestamp).toLocaleString("id-ID")} · {s.reason ?? "signature & hash cocok dengan kunci publik signer"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {result.valid && result.signers?.length === 1 && (
            <p className="mt-3 text-xs text-[var(--ink-soft)]">
              Catatan: verifikasi dari scan QR mengesahkan signature terhadap kunci publik; cocokkan juga
              file PDF aslinya lewat unggah PDF di atas untuk memastikan isi dokumen belum diubah.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
