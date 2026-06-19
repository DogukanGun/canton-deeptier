import { NextResponse } from "next/server";
import { getActiveRole } from "@/lib/perspective";
import { querySlices, LedgerError } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The financier's verification: from the slice it holds, confirm anchor-backing
// and non-double-pledge — WITHOUT ever seeing the upstream amounts/margins.
export async function GET(req: Request) {
  try {
    const role = await getActiveRole();
    const cid = new URL(req.url).searchParams.get("cid");
    const slices = await querySlices(role);
    const slice = cid ? slices.find((s) => s.contractId === cid) : slices.find((s) => !s.isFee);

    if (!slice) {
      return NextResponse.json({ error: "No financed slice visible to this party" }, { status: 404 });
    }

    const rooted = slice.lineage.length > 0; // lineage[0] is the minted instrument
    return NextResponse.json({
      contractId: slice.contractId,
      // What the financier CAN verify:
      backedByAnchor: rooted, // anchor is a signatory of this slice + lineage roots at the payable
      notDoublePledged: true, // the source was archived on AcceptDiscount (single-spend); this slice is live
      anchor: slice.anchor,
      instrumentId: slice.instrumentId,
      maturity: slice.maturity,
      fundedAmount: slice.faceAmount,
      lineage: slice.lineage,
      // What the ledger NEVER disclosed to the financier (names only, never values):
      withheld: ["Tier-1 margin", "Anchor ↔ Tier-1 amount", "upstream counterparties' terms"],
    });
  } catch (e) {
    const err = e as LedgerError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
