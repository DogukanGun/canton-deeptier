// The five demo parties. Party ids are namespace-qualified (Role::<namespace>).
// The namespace is the participant's; all demo parties share it on the single
// sandbox participant.
export type Role = "Anchor" | "Tier1" | "Tier2" | "Financier" | "Platform";

export const ROLES: Role[] = ["Anchor", "Tier1", "Tier2", "Financier", "Platform"];

// Roles surfaced in the perspective toggle (Platform is the backend operator).
export const PERSPECTIVE_ROLES: Role[] = ["Anchor", "Tier1", "Tier2", "Financier"];

export const ROLE_LABELS: Record<Role, string> = {
  Anchor: "Anchor Buyer",
  Tier1: "Tier-1 Supplier",
  Tier2: "Tier-2 Supplier",
  Financier: "Financier",
  Platform: "Platform",
};

const NS = process.env.DT_NAMESPACE ?? "";

export function partyId(role: Role): string {
  return NS ? `${role}::${NS}` : role;
}

// Reverse-map a full party id back to a Role (for rendering counterparties).
export function roleOf(party: string | undefined): Role | undefined {
  if (!party) return undefined;
  const head = party.split("::")[0]?.replace(/^'/, "").replace(/'$/, "");
  return (ROLES as string[]).includes(head) ? (head as Role) : undefined;
}
