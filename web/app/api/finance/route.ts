import { NextResponse } from "next/server";
import { getActiveRole } from "@/lib/perspective";
import { exerciseAs, TPL, LedgerError } from "@/lib/ledger";
import { partyId, Role } from "@/lib/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const role = await getActiveRole();
    const body = (await req.json()) as {
      action: "offer" | "accept";
      contractId?: string;
      feeRate?: number;
      financierRole?: Role;
      proposalCid?: string;
    };

    if (body.action === "offer") {
      if (!body.contractId || body.feeRate == null || !body.financierRole) {
        return NextResponse.json({ error: "contractId, feeRate, financierRole required" }, { status: 400 });
      }
      const res = await exerciseAs(role, TPL.CreditSlice, body.contractId, "ProposeDiscount", {
        financier: partyId(body.financierRole),
        feeRate: String(body.feeRate),
      });
      return NextResponse.json({ ok: true, result: res.result });
    }

    if (body.action === "accept") {
      if (!body.proposalCid) {
        return NextResponse.json({ error: "proposalCid required" }, { status: 400 });
      }
      const res = await exerciseAs(role, TPL.DiscountProposal, body.proposalCid, "AcceptDiscount", {});
      return NextResponse.json({ ok: true, result: res.result });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    const err = e as LedgerError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
