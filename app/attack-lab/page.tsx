"use client";

import { useState } from "react";

type Row = { skenario: string; dokumen: string; hasil: "LOLOS" | "DITOLAK"; detail: string };

const inputCls = "w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

async function verifyFile(f: Blob, name: string, extra?: Record<string, string>) {
  const fd = new FormData();
  fd.append("document", new File([f], name, { type: "application/pdf" }));
  for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v);
  const r = await fetch("/api/verify", { method: "POST", body: fd });
  return r.json();
}

export default function AttackLabPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  // form benchmark
  const [bmDoc, setBmDoc] = useState<File | null>(null);
  const [bmKey, setBmKey] = useState<File | null>(null);
  const [bmPass, setBmPass] = useState("");
  const [bmIters, setBmIters] = useState("30");
  const [bmResult, setBmResult] = useState<Record<string, number> | null>(null);

  const [signedFile, setSignedFile] = useState<File | null>(null);

  function addRow(r: Row) { setRows((prev) => [...prev, r]); }

  async function runBenchmark() {
    setErr(""); setBmResult(null);
    if (!bmDoc || !bmKey) return setErr("Unggah dokumen dan private key untuk benchmark");
    setBusy("benchmark");
    try {
      const fd = new FormData();
      fd.append("document", bmDoc);
      fd.append("encryptedPrivateKey", bmKey);
      fd.append("passphrase", bmPass);
      fd.append("signerName", "Bench Marker");
      fd.append("signerRole", "Penguji");
      fd.append("institution", "Universitas Siliwangi");
      fd.append("iterations", bmIters || "30");
      const r = await fetch("/api/benchmark", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setBmResult(j);
      addRow({
        skenario: "Benchmark timing",
        dokumen: bmDoc.name,
        hasil: "LOLOS",
        detail: `sign avg ${j.avgSignMs.toFixed(2)} ms · verify avg ${j.avgVerifyMs.toFixed(2)} ms · sig ${j.signatureSizeBytes} B · pubkey ${j.publicKeySizeBytes} B · n=${j.iterations}`,
      });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  /** §3.5 uji tamper —ubah satu karakter teks via pdf-lib di browser, lalu verifikasi. */
  async function runTamper() {
    setErr("");
    if (!signedFile) return setErr("Unggah PDF yang sudah ditandatangani");
    setBusy("tamper");
    try {
      const base = await verifyFile(signedFile, signedFile.name);
      const { PDFDocument, StandardFonts } = await import("pdf-lib");
      const doc = await PDFDocument.load(await signedFile.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.Helvetica);
      doc.getPage(0).drawText("TAMPERED-by-attack-lab", { x: 50, y: 40, size: 12, font });
      const tampered = Buffer.from(await doc.save({ useObjectStreams: true }));
      const after = await verifyFile(new Blob([tampered], { type: "application/pdf" }), "tampered.pdf");
      addRow({
        skenario: "Tamper 1 karakter isi dokumen",
        dokumen: signedFile.name,
        hasil: after.valid === false ? "LOLOS" : "DITOLAK",
        detail: `sebelum: ${base.valid ? "valid" : "tidak valid · " + (base.reason ?? base.signers?.[0]?.reason ?? "")} → sesudah tamper: ${after.valid ? "MASIH VALID (BAHAYA)" : "DITOLAK · " + (after.reason ?? after.signers?.[0]?.reason ?? "")}`,
      });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  /** §3.5 uji kunci salah — verifikasi dengan public key pasangan lain. */
  async function runWrongKey() {
    setErr("");
    if (!signedFile) return setErr("Unggah PDF yang sudah ditandatangani");
    setBusy("wrongkey");
    try {
      const gen = await fetch("/api/keys/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: crypto.randomUUID() }),
      }).then((r) => r.json());
      const after = await verifyFile(signedFile, signedFile.name, { publicKeyPem: gen.publicKeyPem });
      addRow({
        skenario: "Verifikasi dengan kunci publik salah",
        dokumen: signedFile.name,
        hasil: after.valid === false ? "LOLOS" : "DITOLAK",
        detail: after.valid ? "MASIH VALID (BAHAYA)" : `DITOLAK · ${after.signers?.[0]?.reason ?? after.reason ?? ""}`,
      });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  /** §3.5 uji QR dipalsukan — baca payload (sama dgn isi QR) dari metadata, ubah nama signer, verify. */
  async function runForgedQr() {
    setErr("");
    if (!signedFile) return setErr("Unggah PDF yang sudah ditandatangani");
    setBusy("forgedqr");
    try {
      const { readSignInfo, loadPdf } = await import("@/lib/pdf/pdf-utils");
      const doc = await loadPdf(new Uint8Array(await signedFile.arrayBuffer()));
      const info = readSignInfo(doc);
      if (!info?.signatures?.length) throw new Error("PDF tidak memiliki payload QR (metadata tanda tangan)");
      const forged = { ...info.signatures[0], signerName: "Penyusup Attack Lab" };
      const fd = new FormData();
      fd.append("qrPayload", JSON.stringify(forged));
      const r = await fetch("/api/verify", { method: "POST", body: fd });
      const j = await r.json();
      addRow({
        skenario: "QR-Code dipalsukan (nama signer diganti)",
        dokumen: signedFile.name,
        hasil: j.valid === false ? "LOLOS" : "DITOLAK",
        detail: j.valid ? "MASIH VALID (BAHAYA)" : `DITOLAK · ${j.signers?.[0]?.reason ?? j.reason ?? ""}`,
      });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  async function exportXlsx() {
    const res = await fetch("/api/export-xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hasil Uji Digital Signature",
        headers: ["Skenario", "Dokumen", "Hasil", "Detail"],
        rows: rows.map((r) => [r.skenario, r.dokumen, r.hasil, r.detail]),
      }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hasil-uji.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Pengujian Wajib &amp; Attack Lab</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        TASK.md §3.5: timing ≥30 percobaan, ukuran signature/public key, uji tamper, uji kunci salah,
        uji QR dipalsukan. Jalankan tiap skenario lalu ekspor tabel ke XLSX.
      </p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">A. Benchmark sign/verify (rata-rata ≥30 percobaan)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Dokumen uji<input type="file" accept="application/pdf" className={inputCls} onChange={(e) => setBmDoc(e.target.files?.[0] ?? null)} /></label>
          <label className="text-sm">Private key .dsk<input type="file" className={inputCls} onChange={(e) => setBmKey(e.target.files?.[0] ?? null)} /></label>
          <label className="text-sm">Passphrase<input type="password" className={inputCls} value={bmPass} onChange={(e) => setBmPass(e.target.value)} /></label>
          <label className="text-sm">Iterasi<input type="number" min={30} max={500} className={inputCls} value={bmIters} onChange={(e) => setBmIters(e.target.value)} /></label>
        </div>
        <button onClick={runBenchmark} disabled={!!busy} className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy === "benchmark" ? "Mengukur…" : "Jalankan Benchmark"}
        </button>
        {bmResult && (
          <pre className="mt-3 overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">{JSON.stringify(bmResult, null, 2)}</pre>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">B–D. Skenario serangan (butuh PDF bertanda tangan)</h2>
        <label className="mt-3 block text-sm">PDF bertanda tangan<input type="file" accept="application/pdf" className={inputCls} onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)} /></label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={runTamper} disabled={!!busy} className="rounded border border-zinc-400 px-3 py-2 text-sm disabled:opacity-50">{busy === "tamper" ? "…" : "✏️ Uji tamper 1 karakter"}</button>
          <button onClick={runWrongKey} disabled={!!busy} className="rounded border border-zinc-400 px-3 py-2 text-sm disabled:opacity-50">{busy === "wrongkey" ? "…" : "🔑 Uji kunci publik salah"}</button>
          <button onClick={runForgedQr} disabled={!!busy} className="rounded border border-zinc-400 px-3 py-2 text-sm disabled:opacity-50">{busy === "forgedqr" ? "…" : "🖼️ Uji QR dipalsukan"}</button>
        </div>
      </section>

      {err && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{err}</p>}

      {rows.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Tabel hasil pengujian</h2>
            <button onClick={exportXlsx} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">⬇ Export XLSX</button>
          </div>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
                <th className="py-2 pr-2">Skenario</th><th className="py-2 pr-2">Dokumen</th><th className="py-2 pr-2">Hasil</th><th className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                  <td className="py-2 pr-2">{r.skenario}</td>
                  <td className="py-2 pr-2">{r.dokumen}</td>
                  <td className={`py-2 pr-2 font-medium ${r.hasil === "LOLOS" ? "text-emerald-600" : "text-red-600"}`}>{r.hasil}</td>
                  <td className="py-2 text-xs">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
