import "server-only";
import { cookies } from "next/headers";
import { Role, ROLES } from "./parties";

export const PERSPECTIVE_COOKIE = "dt_perspective";

// The "session" is just which party the stateless BFF acts as. No ledger state
// lives in Vercel. Real auth would replace this with the authenticated user's
// party (see lib/jwt.ts).
export async function getActiveRole(): Promise<Role> {
  const store = await cookies();
  const v = store.get(PERSPECTIVE_COOKIE)?.value as Role | undefined;
  return v && (ROLES as string[]).includes(v) ? (v as Role) : "Anchor";
}
