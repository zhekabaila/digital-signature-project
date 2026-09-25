"use client";

import { useState } from "react";
import { PageHead, Panel, FileField, TextField, Banner } from "@/components/ui";

type SignerStatus = { name: string; role: string; institution: string; timestamp: string; valid: boolean; reason?: string };

export default function MultiSignPage() {
  const [doc, setDoc] = useState<File | null>(null);
  const [docBlob, setDocBlob] = useState<{ blob: Blob; label: string } | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [fields, setFields] = useState({ passphrase: "", signerName: "", signerRole: "", institution: "" });
  const [signers, setSigners] = useState<SignerStatus[]>([]);
  const [docId, setDocId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sigCount, setSigCount] = useState(0);

  const set = (k: keyof typeof fields) => (v: string) => setFields({ ...fields, [k]: v });

  async function refreshStatus(id: string, fallbackBlob?: Blob) {
    const r = await fetch(`/api/multi-sign/status?docId=${encodeURIComponent(id)}`);
    const j = await r.json();
    if (r.ok && Array.isArray(j.signers)) {
      setSigners(j.signers);
      return;
    }
    if (fallbackBlob) {
      const fd = new FormData();
      fd.append("document", new File([fallbackBlob], "doc.pdf", { type: "application/pdf" }));
      const v = await fetch("/api/verify", { method: "POST", body: fd });
      const vr = await v.json();
      setSigners((vr.signers ?? []).map((s: { signer: SignerStatus & Record<string, unknown>; valid: boolean; reason?: string }) => ({
        name: s.signer.signerName, role: s.signer.signerRole, institution: s.signer.institution,
        timestamp: s.signer.timestamp, valid: s.valid, reason: s.reason,
      })));
    }
  }

  async function addSigner() {
    setMsg(null);
    const source = docBlob ?? (doc ? { blob: doc as unknown as Blob, label: doc.name } : null);
    if (!source || !keyFile || !fields.signerName) {
      return setMsg({ ok: false, text: "Lengkapi dokumen, file key, passphrase, dan nama signer" });
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("document", new File([source.blob], source.label));
      fd.append("encryptedPrivateKey", keyFile);
      fd.append("passphrase", fields.passphrase);
      fd.append("signerName", fields.signerName);
      fd.append("signerRole", fields.signerRole);
      fd.append("institution", fields.institution);
      const r = await fetch("/api/multi-sign/add", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: "Gagal" }));
        throw new Error(j.error ?? r.statusText);
      }
      const id = r.headers.get("X-Document-Id") ?? "";
      const blob = await r.blob();
      setDocBlob({ blob, label: `multi-signed-${sigCount + 1}.pdf` });
      setSigCount((n) => n + 1);
      setDocId(id);
      setMsg({ ok: true, text: `Signer "${fields.signerName}" berhasil menambahkan tanda tangan (ke-${sigCount + 1}).` });
      await refreshStatus(id, blob);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  }

  function downloadCurrent() {
    if (!docBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(docBlob.blob);
    a.download = docBlob.label;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHead
        step="Langkah 04 — Multi-sign"
        title="Beberapa signer, satu rantai tanda tangan"
        sub="Setiap signer menandatangani SHA-256(dokumen asli ‖ seluruh signature sebelumnya). Urutan tanda tangan terkunci — signer ke-2 tidak bisa disisipkan sebelum signer ke-1, dan membuang/mengubah urutan membuat verifikasi gagal."
      />
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Signer berikutnya" desc="Siapkan dokumen dan kunci signer yang sedang mengantri. Setelah satu orang menandatangani, dokumen aktif otomatis berlanjut ke signer berikutnya.">
          <div className="space-y-4">
            {!docBlob ? (
              <FileField label="Dokumen PDF awal" accept="application/pdf" onChange={setDoc} fileName={doc?.name ?? null} hint="Belum ada PDF dipilih" />
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-white/60 p-3 text-sm">
                <span className="lbl">Dokumen aktif</span>
                <p className="mono mt-1 truncate text-xs">{docBlob.label} · {sigCount} tanda tangan</p>
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={downloadCurrent}>⬇ unduh</button>
                  <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setDocBlob(null); setSigCount(0); setSigners([]); }}>↺ ganti dokumen</button>
                </div>
              </div>
            )}
            <FileField label="Private key signer ini (.dsk)" onChange={setKeyFile} fileName={keyFile?.name ?? null} hint="Belum ada .dsk dipilih" />
            <TextField label="Passphrase" type="password" value={fields.passphrase} onChange={set("passphrase")} placeholder="••••••••" />
            <TextField label="Nama signer" value={fields.signerName} onChange={set("signerName")} placeholder="mis. Dra. Ratna Wijaya" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Jabatan" value={fields.signerRole} onChange={set("signerRole")} placeholder="Wakil Rektor" />
              <TextField label="Institusi" value={fields.institution} onChange={set("institution")} placeholder="Universitas Siliwangi" />
            </div>
            <button className="btn btn-seal w-full justify-center" onClick={addSigner} disabled={busy}>
              {busy ? "Menambahkan tanda tangan…" : `⑂ Tanda Tangani (Signer ke-${sigCount + 1})`}
            </button>
            {docId && signers.length > 0 && (
              <button className="btn btn-ghost w-full justify-center" onClick={() => refreshStatus(docId)}>
                ↻ Cek status rantai via server
              </button>
            )}
            {msg && <Banner tone={msg.ok ? "ok" : "err"}>{msg.text}</Banner>}
          </div>
        </Panel>
        <Panel title="Rantai tanda tangan" desc="Urutan dari kiri-atas ke bawah adalah urutan sign yang sebenarnya — sama seperti urutan di chained digest.">
          {signers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="mono text-3xl text-[var(--line-strong)]">⛓</span>
              <p className="max-w-[26ch] text-sm italic text-[var(--ink-soft)]">Belum ada tanda tangan. Rantai akan terbentuk di sini setelah signer pertama membubuhkan tanda tangannya.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {signers.map((s, i) => (
                <li key={i} className={`relative rounded-lg border p-3 pl-10 text-sm ${s.valid ? "border-[var(--ok-line)] bg-[var(--ok-bg)]" : "border-[var(--err-line)] bg-[var(--err-bg)]"}`}>
                  <span className={`mono absolute left-3 top-3 text-xs ${s.valid ? "text-[var(--ok-ink)]" : "text-[var(--err-ink)]"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <b className={s.valid ? "text-[var(--ok-ink)]" : "text-[var(--err-ink)]"}>{s.valid ? "✓ " : "✗ "}{s.name}</b>
                  <span className="mono block text-[11px] text-[var(--ink-soft)]">{s.role} · {s.institution}</span>
                  <span className="mono mt-1 block text-[11px] text-[var(--ink-soft)]">{new Date(s.timestamp).toLocaleString("id-ID")}</span>
                  {s.reason && <p className="mt-1 text-xs">{s.reason}</p>}
                  {i < signers.length - 1 && <span aria-hidden className="mono absolute -bottom-[15px] left-4 z-10 text-[var(--line-strong)]">↓</span>}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
