"use client";

import { useState } from "react";

export default function SignPage() {
  const [fields, setFields] = useState({ passphrase: "", signerName: "", signerRole: "", institution: "" });
  const [pdf, setPdf] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [k]: e.target.value });
  const inputCls = "w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

  async function sign() {
    setStatus(null);
    if (!pdf || !keyFile) return setStatus({ ok: false, msg: "Lengkapi file PDF dan private key" });
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("document", pdf);
      fd.append("encryptedPrivateKey", keyFile);
      fd.append("passphrase", fields.passphrase);
      fd.append("signerName", fields.signerName);
      fd.append("signerRole", fields.signerRole);
      fd.append("institution", fields.institution);
      const r = await fetch("/api/sign", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: "Gagal" }));
        throw new Error(j.error ?? r.statusText);
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "signed-document.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus({ ok: true, msg: `Dokumen tertanda terunduh (${(blob.size / 1024).toFixed(1)} KB) — QR-Code signer "${fields.signerName}" tertanam di halaman terakhir.` });
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Tandatangani Dokumen PDF</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Alur (TASK.md §3.2): private key didekripsi dengan passphrase → SHA-256 konten dokumen →
        signature ECDSA P-256 (mencakup identitas signer) → QR-Code metadata + signature ditempel
        sebagai halaman baru.
      </p>
      <div className="mt-6 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Dokumen PDF</span>
          <input type="file" accept="application/pdf" className={inputCls} onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Private key terenkripsi (.dsk)</span>
          <input type="file" className={inputCls} onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)} />
        </label>
        <input className={inputCls} type="password" placeholder="Passphrase private key" value={fields.passphrase} onChange={set("passphrase")} />
        <input className={inputCls} placeholder="Nama lengkap signer" value={fields.signerName} onChange={set("signerName")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Jabatan (mis. Dekan)" value={fields.signerRole} onChange={set("signerRole")} />
          <input className={inputCls} placeholder="Institusi" value={fields.institution} onChange={set("institution")} />
        </div>
        <button onClick={sign} disabled={busy} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy ? "Menandatangani…" : "Sign & Unduh PDF + QR"}
        </button>
        {status && (
          <p className={`rounded p-3 text-sm ${status.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
            {status.msg}
          </p>
        )}
      </div>
    </div>
  );
}
