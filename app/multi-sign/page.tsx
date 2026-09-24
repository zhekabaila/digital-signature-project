"use client";

import { useState } from "react";

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

  const inputCls = "w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [k]: e.target.value });

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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Multi-Penandatangan (Chained)</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        TASK.md §3.4 Opsi A: setiap signer menandatangani SHA-256(<i>dokumen asli</i> + seluruh signature
        sebelumnya). Urutan tanda tangan terkunci — signer ke-2 tidak bisa disisipkan sebelum signer ke-1,
        dan membuang/me reorder tanda tangan membuat verifikasi gagal.
      </p>
      <div className="mt-6 space-y-3">
        {!docBlob ? (
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Dokumen PDF awal</span>
            <input type="file" accept="application/pdf" className={inputCls} onChange={(e) => setDoc(e.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <p className="rounded bg-zinc-100 p-2 text-sm dark:bg-zinc-900">
            Dokumen aktif: <b>{docBlob.label}</b> ({sigCount} tanda tangan) —{" "}
            <button className="underline" onClick={downloadCurrent}>unduh</button>
            {" · "}
            <button className="underline" onClick={() => { setDocBlob(null); setSigCount(0); setSigners([]); }}>ganti dokumen</button>
          </p>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Private key terenkripsi signer ini (.dsk)</span>
          <input type="file" className={inputCls} onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)} />
        </label>
        <input className={inputCls} type="password" placeholder="Passphrase" value={fields.passphrase} onChange={set("passphrase")} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={inputCls} placeholder="Nama signer" value={fields.signerName} onChange={set("signerName")} />
          <input className={inputCls} placeholder="Jabatan" value={fields.signerRole} onChange={set("signerRole")} />
          <input className={inputCls} placeholder="Institusi" value={fields.institution} onChange={set("institution")} />
        </div>
        <button onClick={addSigner} disabled={busy} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy ? "Menambahkan tanda tangan…" : "Tambah Tanda Tangan (Signer Berikutnya)"}
        </button>
        {docId && signers.length > 0 && (
          <button className="ml-2 rounded border border-zinc-400 px-3 py-2 text-sm" onClick={() => refreshStatus(docId)}>
            ↻ Cek status via /api/multi-sign/status
          </button>
        )}
        {msg && (
          <p className={`rounded p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>{msg.text}</p>
        )}
        {signers.length > 0 && (
          <ul className="space-y-2">
            {signers.map((s, i) => (
              <li key={i} className={`rounded border p-3 text-sm ${s.valid ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950" : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"}`}>
                <span className={s.valid ? "text-emerald-700" : "text-red-600"}>{s.valid ? `✓ Signer ${i + 1}: ${s.name} valid` : `✗ Signer ${i + 1}: ${s.name} GAGAL`}</span>
                <span className="block text-xs text-zinc-500">{s.role} · {s.institution} · {s.timestamp ? new Date(s.timestamp).toLocaleString("id-ID") : ""}</span>
                {s.reason && <span className="block text-xs text-red-600">{s.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
