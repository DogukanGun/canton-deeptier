import { NextResponse } from "next/server";
import { PERSPECTIVE_COOKIE } from "@/lib/perspective";
import { ROLES, Role } from "@/lib/parties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { role } = (await req.json()) as { role?: Role };
  if (!role || !(ROLES as string[]).includes(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(PERSPECTIVE_COOKIE, role, { path: "/", sameSite: "lax", httpOnly: false });
  return res;
}
