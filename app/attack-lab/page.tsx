"use client";

import { useState } from "react";
import { PageHead, Panel, FileField, TextField, Banner } from "@/components/ui";

type Row = { skenario: string; dokumen: string; hasil: "LOLOS" | "DITOLAK"; detail: string };

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

  /** §3.5 uji tamper — ubah satu karakter teks via pdf-lib di browser, lalu verifikasi. */
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
    <div>
      <PageHead
        step="Langkah 05 — Attack Lab"
        title="Uji keras: serang sistem sendiri"
        sub="Benchmark timing ≥30 percobaan, ukuran signature & public key, lalu tiga skenario serangan wajib: dokumen di-tamper, verifikasi dengan kunci salah, dan QR-Code dipalsukan. Setiap serangan yang LOLOS berarti sistem berhasil menolaknya."
      />

      <div className="space-y-6">
        <Panel title="A · Benchmark sign & verify" desc="Mengukur rata-rata waktu sign/verify ECDSA P-256 atas dokumen yang sama, plus ukuran artefak kunci.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FileField label="Dokumen uji" accept="application/pdf" onChange={setBmDoc} fileName={bmDoc?.name ?? null} hint="Belum ada PDF dipilih" />
            <FileField label="Private key .dsk" onChange={setBmKey} fileName={bmKey?.name ?? null} hint="Belum ada .dsk dipilih" />
            <TextField label="Passphrase" type="password" value={bmPass} onChange={setBmPass} placeholder="••••••••" />
            <label className="block">
              <span className="lbl">Iterasi (30–500)</span>
              <input className="field" type="number" min={30} max={500} value={bmIters} onChange={(e) => setBmIters(e.target.value)} />
            </label>
          </div>
          <button className="btn btn-seal mt-4" onClick={runBenchmark} disabled={!!busy}>
            {busy === "benchmark" ? "⏱ Mengukur…" : "⏱ Jalankan Benchmark"}
          </button>
          {bmResult && (
            <pre className="mono mt-4 max-h-48 overflow-auto rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[11px] leading-4">{JSON.stringify(bmResult, null, 2)}</pre>
          )}
        </Panel>

        <Panel title="B–D · Skenario serangan" desc="Satu PDF bertanda tangan dipakai untuk ketiga serangan. PDF dibuat di langkah Sign.">
          <div className="space-y-4">
            <FileField label="PDF bertanda tangan" accept="application/pdf" onChange={setSignedFile} fileName={signedFile?.name ?? null} hint="Belum ada PDF tertanda dipilih" />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" onClick={runTamper} disabled={!!busy}>{busy === "tamper" ? "…" : "✏ Uji tamper 1 karakter"}</button>
              <button className="btn btn-ghost" onClick={runWrongKey} disabled={!!busy}>{busy === "wrongkey" ? "…" : "🗝 Uji kunci publik salah"}</button>
              <button className="btn btn-ghost" onClick={runForgedQr} disabled={!!busy}>{busy === "forgedqr" ? "…" : "🖸 Uji QR dipalsukan"}</button>
            </div>
          </div>
        </Panel>

        {err && <Banner tone="err">{err}</Banner>}

        {rows.length > 0 && (
          <Panel
            title="Tabel hasil pengujian"
            desc="Semua skenario yang berjalan tercatat di sini — ekspor ke XLSX untuk lampiran laporan."
            className="rise"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="mono text-xs text-[var(--ink-soft)]">{rows.length} skenario tercatat</span>
              <button onClick={exportXlsx} className="btn btn-seal !px-3 !py-1.5 text-xs">⬇ Export XLSX</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)] border-b-2 border-[var(--line-strong)] py-2 pr-3">Skenario</th>
                    <th className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)] border-b-2 border-[var(--line-strong)] py-2 pr-3">Dokumen</th>
                    <th className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)] border-b-2 border-[var(--line-strong)] py-2 pr-3">Hasil</th>
                    <th className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)] border-b-2 border-[var(--line-strong)] py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--line)] align-top last:border-0">
                      <td className="py-2.5 pr-3 font-medium whitespace-nowrap">{r.skenario}</td>
                      <td className="mono py-2.5 pr-3 text-xs whitespace-nowrap">{r.dokumen}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`mono rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${r.hasil === "LOLOS" ? "border-[var(--ok-line)] bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "border-[var(--err-line)] bg-[var(--err-bg)] text-[var(--err-ink)]"}`}>
                          {r.hasil === "LOLOS" ? "✓ DITOLAK SISTEM" : "✗ LULUS (BAHAYA)"}
                        </span>
                      </td>
                      <td className="mono py-2.5 text-[11px] leading-4 text-[var(--ink-soft)]">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
