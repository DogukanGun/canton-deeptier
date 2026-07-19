"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLE_THEME } from "@/lib/roleTheme";
import { fmtAmount, fmtDate } from "@/lib/format";

type Role = "Anchor" | "Tier1" | "Tier2" | "Financier";
const PERSPECTIVES: Role[] = ["Anchor", "Tier1", "Tier2", "Financier"];

type Slice = {
  contractId: string;
  anchor: string;
  owner: string;
  instrumentId: string;
  faceAmount: number;
  tier: number;
  maturity: string;
  lineage: string[];
  isFee: boolean;
};
type SplitProposal = { contractId: string; from: string; amount: number; instrumentId: string };
type DiscountProposal = {
  contractId: string;
  from: string;
  amount: number;
  feeRate: number;
  instrumentId: string;
};
type Holdings = {
  role: Role;
  roleLabel: string;
  slices: Slice[];
  splitProposals: SplitProposal[];
  discountProposals: DiscountProposal[];
};
type Verification = {
  backedByAnchor: boolean;
  notDoublePledged: boolean;
  anchor: string;
  instrumentId: string;
  maturity: string;
  fundedAmount: number;
  lineage: string[];
  withheld: string[];
};

function shortParty(p: string): string {
  const head = p.split("::")[0].replace(/^'/, "").replace(/'$/, "");
  return head;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${res.status}`);
  return json;
}

export default function Dashboard() {
  const [data, setData] = useState<Holdings | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [splitAmt, setSplitAmt] = useState<Record<string, number>>({});

  const role = data?.role ?? "Anchor";
  const theme = ROLE_THEME[role];

  const load = useCallback(async () => {
    try {
      const d = (await api("/api/holdings")) as Holdings;
      setData(d);
    } catch (e) {
      setToast({ kind: "err", msg: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const switchRole = (r: Role) =>
    act(async () => {
      await api("/api/perspective", { method: "POST", body: JSON.stringify({ role: r }) });
      setVerification(null);
      await load();
    });

  const endorse = (s: Slice) =>
    act(async () => {
      const amt = splitAmt[s.contractId] ?? Math.round(s.faceAmount * 0.4);
      await api("/api/split", {
        method: "POST",
        body: JSON.stringify({ action: "propose", contractId: s.contractId, splitAmt: amt, recipientRole: "Tier2" }),
      });
      flash("ok", `Endorsed ${fmtAmount(amt)} down to Tier-2 — awaiting their acceptance.`);
      await load();
    });

  const offer = (s: Slice) =>
    act(async () => {
      await api("/api/finance", {
        method: "POST",
        body: JSON.stringify({ action: "offer", contractId: s.contractId, feeRate: 0.0025, financierRole: "Financier" }),
      });
      flash("ok", "Slice offered to the Financier for discounting.");
      await load();
    });

  const acceptSplit = (p: SplitProposal) =>
    act(async () => {
      await api("/api/split", { method: "POST", body: JSON.stringify({ action: "accept", proposalCid: p.contractId }) });
      flash("ok", `Accepted ${fmtAmount(p.amount)} slice.`);
      await load();
    });

  const fund = (p: DiscountProposal) =>
    act(async () => {
      await api("/api/finance", { method: "POST", body: JSON.stringify({ action: "accept", proposalCid: p.contractId }) });
      flash("ok", "Funded. Verifying anchor backing…");
      await load();
      const v = (await api("/api/verify")) as Verification;
      setVerification(v);
    });

  const settle = (s: Slice) =>
    act(async () => {
      await api("/api/settle", { method: "POST", body: JSON.stringify({ contractId: s.contractId }) });
      flash("ok", "Settled at maturity (cash leg paid to owner).");
      await load();
    });

  const resetDemo = () =>
    act(async () => {
      if (!confirm("Reset the demo to the starting state? This settles every current slice and re-seeds a fresh $1,000,000 payable split down to Tier-2.")) return;
      flash("ok", "Resetting the demo… this takes a few seconds.");
      await api("/api/reset", { method: "POST" });
      await api("/api/perspective", { method: "POST", body: JSON.stringify({ role: "Anchor" }) });
      setVerification(null);
      await load();
      flash("ok", "Demo reset to the starting state.");
    });

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-widest">DeepTier · Canton</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Anchor credit, deep &amp; private
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            An anchor&apos;s confirmed payable propagates down supply-chain tiers. Each party sees only its own
            slice — the ledger never reveals upstream amounts or margins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetDemo}
            disabled={busy}
            title="Settle all slices and re-seed the starting state"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-50"
          >
            {busy ? "Working…" : "↻ Reset demo"}
          </button>
          <a
            href="/mint"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            + Mint payable
          </a>
        </div>
      </header>

      {/* Perspective toggle */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">View as</div>
        <div className="flex flex-wrap gap-2">
          {PERSPECTIVES.map((r) => {
            const t = ROLE_THEME[r];
            const active = r === role;
            return (
              <button
                key={r}
                onClick={() => switchRole(r)}
                disabled={busy}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  active ? `${t.chip} ring-2 ${t.ring}` : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                {t.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Flow strip */}
      <FlowStrip role={role} />

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2 text-sm ${
            toast.kind === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Slices visible to this party */}
        <section className="lg:col-span-2">
          <SectionTitle>
            What <span className={`rounded px-1.5 py-0.5 text-xs ${theme.chip} border`}>{theme.label}</span> can see
          </SectionTitle>

          {!data ? (
            <Skeleton />
          ) : data.slices.length === 0 ? (
            <Empty>No slices visible to this party.</Empty>
          ) : (
            <div className="space-y-3">
              {data.slices.map((s) => (
                <div
                  key={s.contractId}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-white">{fmtAmount(s.faceAmount)}</span>
                        {s.isFee && (
                          <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                            origination fee
                          </span>
                        )}
                        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          tier {s.tier}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {s.instrumentId} · matures {fmtDate(s.maturity)} · held by {shortParty(s.owner)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span className="text-slate-600">lineage:</span>
                        {s.lineage.map((l, i) => (
                          <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                    <SliceActions
                      role={role}
                      slice={s}
                      busy={busy}
                      splitAmt={splitAmt[s.contractId] ?? Math.round(s.faceAmount * 0.4)}
                      onSplitAmt={(v) => setSplitAmt((m) => ({ ...m, [s.contractId]: v }))}
                      onEndorse={() => endorse(s)}
                      onOffer={() => offer(s)}
                      onSettle={() => settle(s)}
                      onVerify={async () => {
                        try {
                          const v = (await api(`/api/verify?cid=${encodeURIComponent(s.contractId)}`)) as Verification;
                          setVerification(v);
                        } catch (e) {
                          flash("err", (e as Error).message);
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending offers for this party */}
          {data && (data.splitProposals.length > 0 || data.discountProposals.length > 0) && (
            <div className="mt-6">
              <SectionTitle>Pending for you</SectionTitle>
              <div className="space-y-3">
                {data.splitProposals.map((p) => (
                  <Pending key={p.contractId} title={`Incoming slice · ${fmtAmount(p.amount)}`} sub={`Endorsed by ${p.from} · ${p.instrumentId}`}>
                    <Btn onClick={() => acceptSplit(p)} disabled={busy} kind="primary">
                      Accept slice
                    </Btn>
                  </Pending>
                ))}
                {data.discountProposals.map((p) => (
                  <Pending
                    key={p.contractId}
                    title={`Financing offer · ${fmtAmount(p.amount)}`}
                    sub={`From ${p.from} · fee ${(p.feeRate * 10000).toFixed(0)} bps · ${p.instrumentId}`}
                  >
                    <Btn onClick={() => fund(p)} disabled={busy} kind="primary">
                      Fund this slice
                    </Btn>
                  </Pending>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right column: privacy + verification */}
        <aside className="space-y-6">
          {verification ? (
            <VerificationCard v={verification} />
          ) : (
            <PrivacyCard role={role} />
          )}
        </aside>
      </div>
    </div>
  );
}

function SliceActions(props: {
  role: Role;
  slice: Slice;
  busy: boolean;
  splitAmt: number;
  onSplitAmt: (v: number) => void;
  onEndorse: () => void;
  onOffer: () => void;
  onSettle: () => void;
  onVerify: () => void;
}) {
  const { role, slice, busy } = props;
  if (slice.isFee) return null;

  if (role === "Tier1" && slice.tier === 1) {
    return (
      <div className="flex flex-col items-end gap-2">
        <input
          type="number"
          value={props.splitAmt}
          onChange={(e) => props.onSplitAmt(Number(e.target.value))}
          className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right text-sm text-slate-200"
        />
        <Btn onClick={props.onEndorse} disabled={busy} kind="primary">
          Endorse to Tier-2 →
        </Btn>
      </div>
    );
  }
  if (role === "Tier2") {
    return (
      <Btn onClick={props.onOffer} disabled={busy} kind="primary">
        Offer to Financier →
      </Btn>
    );
  }
  if (role === "Financier") {
    return (
      <Btn onClick={props.onVerify} disabled={busy} kind="ghost">
        Verify backing
      </Btn>
    );
  }
  if (role === "Anchor") {
    return (
      <Btn onClick={props.onSettle} disabled={busy} kind="ghost">
        Settle
      </Btn>
    );
  }
  return null;
}

function FlowStrip({ role }: { role: Role }) {
  const nodes: Role[] = ["Anchor", "Tier1", "Tier2", "Financier"];
  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      {nodes.map((n, i) => {
        const t = ROLE_THEME[n];
        const active = n === role;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                active ? `${t.chip} ring-2 ${t.ring}` : "border-slate-800 bg-slate-900 text-slate-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${t.dot}`} />
              {t.short}
            </div>
            {i < nodes.length - 1 && <span className="text-slate-600">→</span>}
          </div>
        );
      })}
      <span className="ml-auto hidden text-xs text-slate-500 sm:block">amounts visible only to a slice&apos;s stakeholders</span>
    </div>
  );
}

function PrivacyCard({ role }: { role: Role }) {
  const lines: Record<Role, string[]> = {
    Anchor: ["You are a signatory of every slice, so you see the whole tree.", "In production, only you and direct counterparties would — each org on its own participant node."],
    Tier1: ["You see your own slice.", "Tier-2's onward terms and the Financier's discount are NOT disclosed to you."],
    Tier2: ["You see the slice endorsed to you.", "Tier-1's margin and the Anchor↔Tier-1 amount are NOT disclosed to you."],
    Financier: ["You see only the slice offered to you.", "Tier-1's margin and the Anchor↔Tier-1 amount are absent from every query you make."],
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2 text-slate-200">
        <LockIcon className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold">Load-bearing privacy</h3>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-slate-400">
        {lines[role].map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            {l}
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
        This isn&apos;t hidden in the UI — the Canton ledger never returns the contracts you aren&apos;t a
        stakeholder of. Switch perspectives to watch the same data appear and disappear.
      </p>
    </div>
  );
}

function VerificationCard({ v }: { v: Verification }) {
  return (
    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.06] p-5">
      <h3 className="text-sm font-semibold text-emerald-200">Financier verification</h3>
      <div className="mt-3 space-y-2">
        <Check ok={v.backedByAnchor} label="Backed by anchor obligation" detail={`${shortParty(v.anchor)} · matures ${fmtDate(v.maturity)}`} />
        <Check ok={v.notDoublePledged} label="Not double-pledged" detail="source receivable archived · exclusive control" />
      </div>
      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Funded</div>
        <div className="text-lg font-semibold text-white">{fmtAmount(v.fundedAmount)}</div>
        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
          {v.lineage.map((l, i) => (
            <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{l}</span>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Cannot be shown to you</div>
        <ul className="mt-2 space-y-1.5">
          {v.withheld.map((w) => (
            <li key={w} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-500">
              <LockIcon className="h-3.5 w-3.5 text-slate-600" />
              <span className="font-mono text-slate-400">▓▓▓▓</span>
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
          ok ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"
        }`}
      >
        {ok ? "✓" : "✕"}
      </span>
      <div>
        <div className="text-sm font-medium text-emerald-100">{label}</div>
        <div className="text-xs text-slate-400">{detail}</div>
      </div>
    </div>
  );
}

function Pending({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
      <div>
        <div className="text-sm font-semibold text-amber-100">{title}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">{children}</h2>;
}

function Btn({
  children,
  onClick,
  disabled,
  kind,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  kind: "primary" | "ghost";
}) {
  const base = "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition disabled:opacity-50";
  const styles =
    kind === "primary"
      ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
      : "border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">{children}</div>;
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40" />
      ))}
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
