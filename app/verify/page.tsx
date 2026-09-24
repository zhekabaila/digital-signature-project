"use client";

import { useRef, useState } from "react";

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

  const inputCls = "w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Verifikasi Tanda Tangan</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Dua lapis penolakan (TASK.md §3.3): hash dokumen tidak cocok → &ldquo;dokumen diubah&rdquo;; signature tidak
        cocok dengan public key → &ldquo;kunci tidak cocok&rdquo;. Opsional: unggah public key tertentu untuk menguji
        verifikasi dengan kunci yang salah.
      </p>

      <div className="mt-6 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">PDF bertanda tangan</span>
          <input type="file" accept="application/pdf" className={inputCls} onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Public key (opsional — untuk uji kunci tidak cocok)</span>
          <input type="file" className={inputCls} onChange={(e) => setKeyPem(e.target.files?.[0] ?? null)} />
        </label>
        <div className="flex gap-2">
          <button onClick={verifyUpload} disabled={busy || !pdf} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            {busy ? "Memverifikasi…" : "Verifikasi PDF"}
          </button>
          {!scanning ? (
            <button onClick={startScan} className="rounded border border-zinc-400 px-4 py-2 text-sm">📷 Scan QR dari kamera</button>
          ) : (
            <button onClick={stopScan} className="rounded border border-red-400 px-4 py-2 text-sm text-red-600">Hentikan scan</button>
          )}
        </div>
        {scanning && (
          <div className="relative overflow-hidden rounded-lg">
            <video ref={videoRef} className="w-full" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">Arahkan kamera ke QR pada halaman tanda tangan…</p>
          </div>
        )}
      </div>

      {result && (
        <div className={`mt-6 rounded-lg border p-4 text-sm ${result.valid ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950" : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"}`}>
          <p className={`font-semibold ${result.valid ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
            {result.error ? `Kesalahan: ${result.error}` : result.valid ? "✔ TANDA TANGAN VALID" : "✗ VERIFIKASI GAGAL"}
          </p>
          {result.reason && <p className="mt-1">{result.reason}</p>}
          {result.signers?.length ? (
            <ul className="mt-3 space-y-2">
              {result.signers.map((s, i) => (
                <li key={i} className="rounded bg-white/70 p-2 dark:bg-zinc-900/60">
                  <span className={s.valid ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}>{s.valid ? "✓" : "✗"}</span>{" "}
                  <b>{s.signer.signerName}</b> — {s.signer.signerRole}, {s.signer.institution}
                  <span className="block text-xs text-zinc-500">
                    {new Date(s.signer.timestamp).toLocaleString("id-ID")} · {s.reason ?? "signature & hash cocok dengan kunci publik signer"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {result.valid && result.signers?.length === 1 && (
            <p className="mt-2 text-xs text-zinc-500">
              Catatan: verifikasi dari scan QR mengesahkan signature terhadap kunci publik; cocokkan juga
              file PDF aslinya lewat unggah PDF di atas untuk memastikan isi dokumen belum diubah.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
