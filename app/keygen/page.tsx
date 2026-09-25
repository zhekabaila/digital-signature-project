"use client";

import { useState } from "react";
import { PageHead, Panel, TextField, Banner, CopyChip, download } from "@/components/ui";

export default function KeygenPage() {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [result, setResult] = useState<{ publicKeyPem: string; fingerprint: string; encryptedPrivateKeyFile: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = pass.length >= 16 ? "kuat" : pass.length >= 8 ? "minimum terpenuhi" : "kurang dari 8 karakter";

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
    <div>
      <PageHead
        step="Langkah 01 — Keygen"
        title="Buat pasangan kunci ECDSA P-256"
        sub="Private key langsung dienkripsi AES-256-GCM dengan key yang diturunkan dari passphrase via scrypt, lalu diunduh sebagai file .dsk. Public key (SPKI/PEM) bebas dibagikan ke siapa pun yang perlu memverifikasi tanda tangan Anda."
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Passphrase" desc="Passphrase tidak dikirim ke server dalam bentuk apa pun selain untuk menurunkan key AES — tidak disimpan di mana pun.">
          <div className="space-y-4">
            <TextField label="Passphrase (≥ 8 karakter)" type="password" value={pass} onChange={setPass} placeholder="••••••••" />
            <div>
              <TextField label="Ulangi passphrase" type="password" value={pass2} onChange={setPass2} placeholder="••••••••" />
              {pass && (
                <p className={`mono mt-1 text-[11px] ${pass.length >= 8 ? "text-[var(--ok-ink)]" : "text-[var(--err-ink)]"}`}>
                  {pass.length}/ karakter · {strength}
                </p>
              )}
            </div>
            <button className="btn btn-seal w-full justify-center" onClick={generate} disabled={busy || pass.length < 8 || pass !== pass2}>
              {busy ? "Membangkitkan kunci…" : "Generate KeyPair"}
            </button>
            {pass !== pass2 && pass2 && <p className="text-sm text-[var(--err-ink)]">Konfirmasi belum cocok.</p>}
            {error && <Banner tone="err">{error}</Banner>}
          </div>
        </Panel>
        <Panel title="Hasil" desc="Simpan KEDUA file ini bersama-sama — .dsk tidak ada gunanya tanpa passphrase Anda.">
          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--ok-line)] bg-[var(--ok-bg)] p-3 text-sm text-[var(--ok-ink)]">
                ✓ KeyPair berhasil dibuat
                <p className="mono mt-1 text-[11px]">fingerprint: {result.fingerprint}</p>
              </div>
              <div>
                <span className="lbl">public-key.pem (boleh dibagikan)</span>
                <pre className="mono max-h-28 overflow-auto rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[11px] leading-4">{result.publicKeyPem}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => download("public-key.pem", result.publicKeyPem)}>⬇ public-key.pem</button>
                <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => download("private-key.dsk", result.encryptedPrivateKeyFile)}>⬇ private-key.dsk</button>
                <CopyChip text={result.publicKeyPem} label="salin PEM" />
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-[var(--ink-soft)]">Hasil generate akan muncul di sini — lengkap dengan tombol unduh public key dan private key terenkripsi.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
