// The single choke point for the Daml v1 JSON API. All endpoint/response-shape
// coupling lives here. Stateless: every call mints a per-party dev JWT and the
// ledger filters results by that party's projection — which is exactly the
// privacy guarantee (withheld contracts never arrive).
import "server-only";
import { devToken } from "./jwt";
import { partyId, Role, roleOf, ROLE_LABELS } from "./parties";

const BASE = process.env.LEDGER_API_URL ?? "http://localhost:7575";
const PKG = process.env.LEDGER_PACKAGE_ID ?? "";
const MOD = "DeepTier.CreditSlice";

export const TPL = {
  CreditSlice: `${PKG}:${MOD}:CreditSlice`,
  SplitProposal: `${PKG}:${MOD}:SplitProposal`,
  DiscountProposal: `${PKG}:${MOD}:DiscountProposal`,
};

export class LedgerError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function callAs(path: string, parties: string[], body: unknown): Promise<any> {
  const token = devToken(parties);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new LedgerError(`Ledger unreachable at ${BASE}: ${(e as Error).message}`, 504);
  }
  clearTimeout(timer);

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new LedgerError(`Non-JSON response from ledger (HTTP ${res.status})`, 502);
  }
  const apiStatus = typeof json?.status === "number" ? json.status : res.status;
  if (!res.ok || apiStatus >= 400) {
    const text = JSON.stringify(json);
    const msg = (json?.errors && json.errors.join("; ")) || json?.error || `Ledger error ${apiStatus}`;
    let status = 502;
    if (/not.*active|already.*archived|CONTRACT_NOT_FOUND|locally.*consumed|inactive/i.test(text)) status = 409;
    else if (/conservation|fee must be|split must be|feeRate|assertion failed|requires authoriz/i.test(text)) status = 422;
    else if (apiStatus === 401) status = 401;
    throw new LedgerError(msg, status);
  }
  return json;
}

// ---- Domain model -----------------------------------------------------------

export type Slice = {
  contractId: string;
  anchor: string;
  owner: string;
  platform: string;
  instrumentId: string;
  faceAmount: number;
  tier: number;
  maturity: string;
  lineage: string[]; // cleaned, role-friendly
  isFee: boolean;
};

// `show recipient` yields quoted ids like 'Tier2::1220...'; reduce to role names.
function cleanLineageEntry(raw: string): string {
  const head = raw.replace(/^'/, "").replace(/'$/, "");
  if (head === "fee") return "Origination fee";
  const role = roleOf(head);
  return role ? ROLE_LABELS[role] : head;
}

function toSlice(c: any): Slice {
  const p = c.payload;
  return {
    contractId: c.contractId,
    anchor: p.anchor,
    owner: p.owner,
    platform: p.platform,
    instrumentId: p.instrumentId,
    faceAmount: Number(p.faceAmount),
    tier: Number(p.tier),
    maturity: p.maturity,
    lineage: (p.lineage ?? []).map(cleanLineageEntry),
    isFee: Boolean(p.isFee),
  };
}

export type ProposalContract = { contractId: string; payload: any };

// ---- Reads (projected to the acting party = the privacy demo) ---------------

export async function querySlices(role: Role): Promise<Slice[]> {
  const json = await callAs("/v1/query", [partyId(role)], { templateIds: [TPL.CreditSlice] });
  return (json.result ?? []).map(toSlice);
}

export async function querySplitProposals(role: Role): Promise<ProposalContract[]> {
  const json = await callAs("/v1/query", [partyId(role)], { templateIds: [TPL.SplitProposal] });
  return json.result ?? [];
}

export async function queryDiscountProposals(role: Role): Promise<ProposalContract[]> {
  const json = await callAs("/v1/query", [partyId(role)], { templateIds: [TPL.DiscountProposal] });
  return json.result ?? [];
}

// ---- Writes -----------------------------------------------------------------

export async function exerciseAs(
  role: Role,
  templateId: string,
  contractId: string,
  choice: string,
  argument: Record<string, unknown> = {},
): Promise<any> {
  return callAs("/v1/exercise", [partyId(role)], { templateId, contractId, choice, argument });
}

export async function createAs(
  parties: Role[],
  templateId: string,
  payload: Record<string, unknown>,
): Promise<any> {
  return callAs("/v1/create", parties.map(partyId), { templateId, payload });
}
