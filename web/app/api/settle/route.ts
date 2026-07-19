import { NextResponse } from "next/server";
import { getActiveRole } from "@/lib/perspective";
import { exerciseAs, TPL, LedgerError } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Slow-but-successful Devnet writes need room beyond Vercel's default cap.
export const maxDuration = 60;

// Anchor settles a slice at maturity (off-ledger cash leg pays the owner).
export async function POST(req: Request) {
  try {
    const role = await getActiveRole();
    if (role !== "Anchor") {
      return NextResponse.json({ error: "Only the Anchor can settle" }, { status: 403 });
    }
    const { contractId } = (await req.json()) as { contractId?: string };
    if (!contractId) {
      return NextResponse.json({ error: "contractId required" }, { status: 400 });
    }
    await exerciseAs("Anchor", TPL.CreditSlice, contractId, "Settle", {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as LedgerError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
