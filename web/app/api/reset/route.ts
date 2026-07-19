import { NextResponse } from "next/server";
import {
  querySlices,
  querySplitProposals,
  exerciseAs,
  createAs,
  TPL,
  LedgerError,
} from "@/lib/ledger";
import { partyId } from "@/lib/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Runs many sequential ledger writes; needs the full window.
export const maxDuration = 60;

// Demo reset: settle every outstanding slice, then re-seed the canonical
// starting state (a $1,000,000 payable to Tier-1, split $400,000 down to
// Tier-2). Lets judges and teammates return the shared demo to a clean state.
// Destructive by design; intended for the hackathon Devnet, not production.
export async function POST() {
  try {
    // 1. Clear: the Anchor is a signatory of every slice, so it can see and
    // settle (archive) all of them. Loop in case new slices surface.
    for (let round = 0; round < 12; round++) {
      const slices = await querySlices("Anchor");
      if (slices.length === 0) break;
      for (const s of slices) {
        await exerciseAs("Anchor", TPL.CreditSlice, s.contractId, "Settle", {});
      }
    }

    // 2. Mint the root payable to Tier-1.
    await createAs(["Anchor", "Tier1", "Platform"], TPL.CreditSlice, {
      anchor: partyId("Anchor"),
      owner: partyId("Tier1"),
      platform: partyId("Platform"),
      instrumentId: "PAYABLE-2026-001",
      faceAmount: "1000000",
      tier: "1",
      maturity: "2026-12-31",
      lineage: ["PAYABLE-2026-001"],
      isFee: false,
    });

    // 3. Tier-1 endorses $400,000 down to Tier-2.
    const [root] = await querySlices("Tier1");
    if (!root) throw new LedgerError("reset: root slice not found after mint", 502);
    await exerciseAs("Tier1", TPL.CreditSlice, root.contractId, "ProposeSplit", {
      splitAmt: "400000",
      recipient: partyId("Tier2"),
    });

    // 4. Tier-2 accepts the incoming slice.
    const proposals = await querySplitProposals("Tier2");
    const prop = proposals[0];
    if (!prop) throw new LedgerError("reset: split proposal not found", 502);
    await exerciseAs("Tier2", TPL.SplitProposal, prop.contractId, "AcceptSplit", {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as LedgerError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
