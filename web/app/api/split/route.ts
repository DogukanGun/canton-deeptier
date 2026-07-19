import { NextResponse } from "next/server";
import { getActiveRole } from "@/lib/perspective";
import { exerciseAs, TPL, LedgerError } from "@/lib/ledger";
import { partyId, Role } from "@/lib/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Slow-but-successful Devnet writes need room beyond Vercel's default cap.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const role = await getActiveRole();
    const body = (await req.json()) as {
      action: "propose" | "accept";
      contractId?: string;
      splitAmt?: number;
      recipientRole?: Role;
      proposalCid?: string;
    };

    if (body.action === "propose") {
      if (!body.contractId || !body.splitAmt || !body.recipientRole) {
        return NextResponse.json({ error: "contractId, splitAmt, recipientRole required" }, { status: 400 });
      }
      const res = await exerciseAs(role, TPL.CreditSlice, body.contractId, "ProposeSplit", {
        splitAmt: String(body.splitAmt),
        recipient: partyId(body.recipientRole),
      });
      return NextResponse.json({ ok: true, result: res.result });
    }

    if (body.action === "accept") {
      if (!body.proposalCid) {
        return NextResponse.json({ error: "proposalCid required" }, { status: 400 });
      }
      const res = await exerciseAs(role, TPL.SplitProposal, body.proposalCid, "AcceptSplit", {});
      return NextResponse.json({ ok: true, result: res.result });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    const err = e as LedgerError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
