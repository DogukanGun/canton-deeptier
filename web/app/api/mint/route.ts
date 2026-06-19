import { NextResponse } from "next/server";
import { createAs, TPL, LedgerError } from "@/lib/ledger";
import { partyId, Role } from "@/lib/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mint the root anchor payable to a first-tier supplier. Requires anchor + owner
// + platform authority, so the BFF uses a multi-party operator token.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      instrumentId?: string;
      faceAmount?: number;
      maturity?: string;
      ownerRole?: Role;
    };
    const instrumentId = body.instrumentId?.trim() || `PAYABLE-${Date.now()}`;
    const faceAmount = Number(body.faceAmount);
    const maturity = body.maturity || "2026-12-31";
    const ownerRole: Role = body.ownerRole || "Tier1";

    if (!faceAmount || faceAmount <= 0) {
      return NextResponse.json({ error: "faceAmount must be > 0" }, { status: 400 });
    }

    const res = await createAs(["Anchor", ownerRole, "Platform"], TPL.CreditSlice, {
      anchor: partyId("Anchor"),
      owner: partyId(ownerRole),
      platform: partyId("Platform"),
      instrumentId,
      faceAmount: String(faceAmount),
      tier: 1,
      maturity,
      lineage: [instrumentId],
      isFee: false,
    });

    return NextResponse.json({ ok: true, contractId: res.result?.contractId, instrumentId });
  } catch (e) {
    const err = e as LedgerError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
