import { NextResponse } from "next/server";
import { getActiveRole } from "@/lib/perspective";
import {
  querySlices,
  querySplitProposals,
  queryDiscountProposals,
  LedgerError,
} from "@/lib/ledger";
import { roleOf, ROLE_LABELS } from "@/lib/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const role = await getActiveRole();
    const [slices, splitProposals, discountProposals] = await Promise.all([
      querySlices(role),
      querySplitProposals(role),
      queryDiscountProposals(role),
    ]);

    // Privacy framing for the UI: from the slices this party CAN see, how many
    // distinct upstream counterparties appear in lineage that are NOT this party
    // — i.e. the chain it knows exists but whose amounts it can never see.
    const liveSlices = slices.filter((s) => !s.isFee || role === "Platform" || role === "Anchor");

    return NextResponse.json({
      role,
      roleLabel: ROLE_LABELS[role],
      slices,
      liveSlices,
      splitProposals: splitProposals.map((p) => ({
        contractId: p.contractId,
        from: ROLE_LABELS[roleOf(p.payload.owner) ?? "Platform"] ?? p.payload.owner,
        amount: Number(p.payload.childFace),
        instrumentId: p.payload.instrumentId,
      })),
      discountProposals: discountProposals.map((p) => ({
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
