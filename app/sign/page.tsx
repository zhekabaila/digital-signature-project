"use client";

import { useState } from "react";
import { PageHead, Panel, FileField, TextField, Banner } from "@/components/ui";

export default function SignPage() {
  const [fields, setFields] = useState({ passphrase: "", signerName: "", signerRole: "", institution: "" });
  const [pdf, setPdf] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof fields) => (v: string) => setFields({ ...fields, [k]: v });

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
    <div>
      <PageHead
        step="Langkah 02 — Sign"
        title="Bubuhkan tanda tangan ke dokumen PDF"
        sub="Private key didekripsi dengan passphrase → konten dokumen di-hash dengan SHA-256 → signature ECDSA P-256 dibuat atas hash + identitas signer → QR-Code metadata ditempel sebagai halaman baru. Hash dihitung sebelum QR ditempel, agar verifikasi tidak salah tuduh."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Berkas" desc="Dua file ini berpasangan: .dsk hasil keygen + PDF yang akan ditandatangani.">
          <div className="space-y-4">
            <FileField label="Dokumen PDF" accept="application/pdf" onChange={setPdf} fileName={pdf?.name ?? null} hint="Belum ada PDF dipilih" />
            <FileField label="Private key terenkripsi (.dsk)" onChange={setKeyFile} fileName={keyFile?.name ?? null} hint="Belum ada .dsk dipilih" />
            <TextField label="Passphrase private key" type="password" value={fields.passphrase} onChange={set("passphrase")} placeholder="••••••••" />
          </div>
        </Panel>
        <Panel title="Identitas signer" desc="Tercetak di halaman QR dan ikut tersign — mengubahnya setelah sign akan membatalkan signature.">
          <div className="space-y-4">
            <TextField label="Nama lengkap" value={fields.signerName} onChange={set("signerName")} placeholder="mis. Dr. Andi Pratama" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Jabatan" value={fields.signerRole} onChange={set("signerRole")} placeholder="Dekan" />
              <TextField label="Institusi" value={fields.institution} onChange={set("institution")} placeholder="Universitas Siliwangi" />
            </div>
            <button className="btn btn-seal w-full justify-center" onClick={sign} disabled={busy}>
              {busy ? "Menandatangani…" : "⑂ Sign & Unduh PDF + QR"}
            </button>
            {status && <Banner tone={status.ok ? "ok" : "err"}>{status.msg}</Banner>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
