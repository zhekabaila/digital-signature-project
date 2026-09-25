"use client";

import { useState } from "react";

export function PageHead({ step, title, sub }: { step: string; title: string; sub?: string }) {
  return (
    <header className="rise mb-8 max-w-3xl">
      <span className="step-chip">{step}</span>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] font-black leading-[1.05] tracking-tight">
        {title}
      </h1>
      {sub && <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">{sub}</p>}
    </header>
  );
}

export function Panel({
  title,
  desc,
  children,
  className = "",
}: {
  title?: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel panel-punch p-5 ${className}`}>
      {title && <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">{title}</h2>}
      {desc && <p className="mt-1 text-sm text-[var(--ink-soft)]">{desc}</p>}
      {title && <div className="hairline my-4" />}
      <div className={title ? "" : ""}>{children}</div>
    </section>
  );
}

export function FileField({
  label,
  accept,
  onChange,
  fileName,
  hint,
}: {
  label: string;
  accept?: string;
  onChange: (f: File | null) => void;
  fileName?: string | null;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="lbl">{label}</span>
      <input type="file" accept={accept} className="field file:mr-3 cursor-pointer" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {fileName && <span className="mono mt-1 block text-[11px] text-[var(--ok-ink)]">✓ {fileName}</span>}
      {hint && !fileName && <span className="mt-1 block text-[11px] text-[var(--ink-soft)]">{hint}</span>}
    </label>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="lbl">{props.label}</span>
      <input className="field" type={props.type ?? "text"} placeholder={props.placeholder} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

export function Banner({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-[var(--ok-bg)] border-[var(--ok-line)] text-[var(--ok-ink)]" : "bg-[var(--err-bg)] border-[var(--err-line)] text-[var(--err-ink)]";
  return <p className={`rise rounded-lg border px-4 py-3 text-sm font-medium ${cls}`}>{children}</p>;
}

export function Stamp({ valid, label }: { valid: boolean; label: string }) {
  return (
    <span className="stamp" style={{ color: valid ? "var(--ok-ink)" : "var(--err-ink)" }}>
      {valid ? "✓ " : "✗ "}
      {label}
    </span>
  );
}

export function CopyChip({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-ghost mono !px-3 !py-1.5 !text-[11px] uppercase tracking-wider"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? "✓ tersalin" : `⧉ ${label}`}
    </button>
  );
}

export function download(name: string, content: BlobPart, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
