"use client";

import { useState } from "react";

function download(name: string, content: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function KeygenPage() {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [result, setResult] = useState<{ publicKeyPem: string; fingerprint: string; encryptedPrivateKeyFile: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setError("");
    if (pass !== pass2) return setError("Konfirmasi passphrase tidak sama");
    setBusy(true);
    try {
      const r = await fetch("/api/keys/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: pass }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gagal generate");
      setResult(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Generate KeyPair ECDSA P-256</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Private key akan dienkripsi <b>AES-256-GCM</b> dengan key diturunkan dari passphrase Anda via
        <b> scrypt</b>. Jangan lupa passphrase — tanpa itu key tidak bisa dipulihkan.
      </p>
      <div className="mt-6 space-y-3">
        <input className="w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" type="password" placeholder="Passphrase (≥8 karakter)" value={pass} onChange={(e) => setPass(e.target.value)} />
        <input className="w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" type="password" placeholder="Ulangi passphrase" value={pass2} onChange={(e) => setPass2(e.target.value)} />
        <button onClick={generate} disabled={busy || pass.length < 8} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy ? "Memproses…" : "Generate KeyPair"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      {result && (
        <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">KeyPair berhasil dibuat</p>
          <p className="mt-1">Fingerprint: <code className="font-mono">{result.fingerprint}</code></p>
          <pre className="mt-2 max-h-28 overflow-auto rounded bg-white p-2 font-mono text-xs dark:bg-zinc-900">{result.publicKeyPem}</pre>
          <div className="mt-3 flex gap-2">
            <button className="rounded border border-emerald-400 px-3 py-1.5 text-xs" onClick={() => download("public-key.pem", result.publicKeyPem)}>
              ⬇ public-key.pem
            </button>
            <button className="rounded border border-emerald-400 px-3 py-1.5 text-xs" onClick={() => download("private-key.dsk", result.encryptedPrivateKeyFile)}>
              ⬇ private-key.dsk (terenkripsi)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
