import type { Role } from "./parties";

export const ROLE_THEME: Record<
  Role,
  { label: string; short: string; chip: string; dot: string; ring: string }
> = {
  Anchor: {
    label: "Anchor Buyer",
    short: "Anchor",
    chip: "bg-indigo-500/15 text-indigo-200 border-indigo-500/40",
    dot: "bg-indigo-400",
    ring: "ring-indigo-400/60",
  },
  Tier1: {
    label: "Tier-1 Supplier",
    short: "Tier-1",
    chip: "bg-sky-500/15 text-sky-200 border-sky-500/40",
    dot: "bg-sky-400",
    ring: "ring-sky-400/60",
  },
  Tier2: {
    label: "Tier-2 Supplier",
    short: "Tier-2",
    chip: "bg-teal-500/15 text-teal-200 border-teal-500/40",
    dot: "bg-teal-400",
    ring: "ring-teal-400/60",
  },
  Financier: {
    label: "Financier",
    short: "Financier",
    chip: "bg-amber-500/15 text-amber-200 border-amber-500/40",
    dot: "bg-amber-400",
    ring: "ring-amber-400/60",
  },
  Platform: {
    label: "Platform",
    short: "Platform",
    chip: "bg-slate-500/15 text-slate-200 border-slate-500/40",
    dot: "bg-slate-400",
    ring: "ring-slate-400/60",
  },
};
