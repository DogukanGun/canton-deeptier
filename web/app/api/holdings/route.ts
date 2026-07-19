import { NextResponse } from "next/server";
import { getActiveRole } from "@/lib/perspective";
import {
  querySlices,
  querySplitProposals,
  queryDiscountProposals,
  LedgerError,
} from "@/lib/ledger";
import { partyId, roleOf, ROLE_LABELS } from "@/lib/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reads chain ledger-end + active-contracts; give room under Devnet load.
export const maxDuration = 60;

export async function GET() {
  try {
    const role = await getActiveRole();
    const [slices, splitProposals, discountProposals] = await Promise.all([
      querySlices(role),
      querySplitProposals(role),
      queryDiscountProposals(role),
    ]);

    const liveSlices = slices.filter((s) => !s.isFee || role === "Platform" || role === "Anchor");

    // Only surface a pending offer to the party that can actually act on it: the
    // recipient can accept a split; the financier can fund a discount. Other
    // stakeholders (e.g. the offering party) can see the proposal on-ledger but
    // must not be shown an action button that the ledger would reject.
    const me = partyId(role);

    return NextResponse.json({
      role,
      roleLabel: ROLE_LABELS[role],
      slices,
      liveSlices,
      splitProposals: splitProposals
        .filter((p) => p.payload.recipient === me)
        .map((p) => ({
          contractId: p.contractId,
          from: ROLE_LABELS[roleOf(p.payload.owner) ?? "Platform"] ?? p.payload.owner,
          amount: Number(p.payload.childFace),
          instrumentId: p.payload.instrumentId,
        })),
      discountProposals: discountProposals
        .filter((p) => p.payload.financier === me)
        .map((p) => ({
          contractId: p.contractId,
          from: ROLE_LABELS[roleOf(p.payload.owner) ?? "Platform"] ?? p.payload.owner,
          amount: Number(p.payload.sourceFace),
          feeRate: Number(p.payload.feeRate),
          instrumentId: p.payload.instrumentId,
        })),
    });
  } catch (e) {
    const err = e as LedgerError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
