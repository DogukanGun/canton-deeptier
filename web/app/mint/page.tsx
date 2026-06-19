"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Fields = { instrumentId: string; faceAmount: number; maturity: string; debtor?: string };

const SAMPLE: Fields = {
  instrumentId: `PAYABLE-${new Date().getFullYear()}-001`,
  faceAmount: 1000000,
  maturity: "2026-12-31",
  debtor: "Anchor Buyer Corp",
};

export default function MintPage() {
  const [f, setF] = useState<Fields>({ instrumentId: "", faceAmount: 0, maturity: "2026-12-31" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function parseInvoice(file: File) {
    setBusy(true);
    setMsg({ kind: "info", text: "Reading invoice…" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/parse-invoice", { method: "POST", body: fd });
      const j = await res.json();
      if (j.available === false) {
        setMsg({ kind: "info", text: "AI prefill unavailable — enter fields manually or use the sample." });
        return;
      }
      setF((cur) => ({ ...cur, ...j }));
      setMsg({ kind: "ok", text: "Prefilled from invoice — review before minting." });
    } catch {
      setMsg({ kind: "info", text: "Couldn't parse — enter fields manually." });
    } finally {
      setBusy(false);
    }
  }

  async function mint() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentId: f.instrumentId, faceAmount: f.faceAmount, maturity: f.maturity, ownerRole: "Tier1" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "mint failed");
      setMsg({ kind: "ok", text: `Minted ${j.instrumentId} → Tier-1.` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">
        ← Dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Mint a confirmed payable</h1>
      <p className="mt-1 text-sm text-slate-400">
        Tokenize an anchor&apos;s approved invoice as a tier-1 credit slice. Drop the invoice to prefill, or use the
        sample.
      </p>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50"
          >
            Upload invoice (AI prefill)
          </button>
          <button
            onClick={() => setF(SAMPLE)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 hover:border-slate-500"
          >
            Use sample invoice
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && parseInvoice(e.target.files[0])}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Instrument ID">
            <input value={f.instrumentId} onChange={(e) => setF({ ...f, instrumentId: e.target.value })} className={inputCls} placeholder="PAYABLE-2026-001" />
          </Field>
          <Field label="Face amount (USD)">
            <input type="number" value={f.faceAmount || ""} onChange={(e) => setF({ ...f, faceAmount: Number(e.target.value) })} className={inputCls} placeholder="1000000" />
          </Field>
          <Field label="Maturity">
            <input type="date" value={f.maturity} onChange={(e) => setF({ ...f, maturity: e.target.value })} className={inputCls} />
          </Field>
          <Field label="First-tier owner">
            <input value="Tier-1 Supplier" disabled className={`${inputCls} opacity-60`} />
          </Field>
        </div>

        {msg && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              msg.kind === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : msg.kind === "err"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                : "border-slate-700 bg-slate-800/50 text-slate-300"
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          onClick={mint}
          disabled={busy || !f.instrumentId || !f.faceAmount}
          className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-500 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          Mint payable
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
