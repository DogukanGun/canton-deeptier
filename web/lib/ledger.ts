// The single choke point for the Canton JSON Ledger API v2 on the 5N Sandbox
// Devnet validator. All endpoint/response-shape coupling lives here.
//
// Auth is a single shared OIDC credential (lib/jwt.ts), not a per-party dev
// token — v2 commands carry actAs/readAs explicitly in the request body
// instead. The ledger's per-party projection on queries is still what
// enforces privacy: a query filtered to a party's actAs/readAs only ever
// returns contracts that party is a stakeholder of.
//
// NOTE: response parsing below (queryActiveContracts) is written against the
// documented v2 JSON shape but has not yet been exercised against a live,
// successfully-authorized call (blocked on a validator-side rights/quota
// issue as of 2026-07-12 — see project memory). Re-verify the createdEvent
// envelope shape the first time a query actually succeeds.
import "server-only";
import { getAccessToken } from "./jwt";
import { partyId, Role, roleOf, ROLE_LABELS } from "./parties";

const BASE = process.env.LEDGER_API_URL ?? "https://ledger-api.validator.devnet.sandbox.fivenorth.io";
const PKG = process.env.LEDGER_PACKAGE_ID ?? "";
const PKG_NAME = process.env.LEDGER_PACKAGE_NAME ?? "deeptier";
const MOD = "DeepTier.CreditSlice";
// The Daml ledger user the OIDC token authenticates as on the 5N Sandbox
// (token sub=6, primaryParty 5nsandbox-devnet-2::...). This user must hold
// CanActAs rights on our parties (granted via POST /v2/users/6/rights).
const USER_ID = process.env.LEDGER_USER_ID ?? "6";

export const TPL = {
  CreditSlice: `${PKG}:${MOD}:CreditSlice`,
  SplitProposal: `${PKG}:${MOD}:SplitProposal`,
  DiscountProposal: `${PKG}:${MOD}:DiscountProposal`,
};

// Query filters (active-contracts TemplateFilter) reject package-id templateIds
// with "expected a package name" - they want the #package-name form instead.
// Command submission (create/exercise) keeps using the pinned package-id form.
const TPL_FILTER = {
  CreditSlice: `#${PKG_NAME}:${MOD}:CreditSlice`,
  SplitProposal: `#${PKG_NAME}:${MOD}:SplitProposal`,
  DiscountProposal: `#${PKG_NAME}:${MOD}:DiscountProposal`,
};

export class LedgerError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function call(path: string, method: "GET" | "POST", body?: unknown): Promise<any> {
  const token = await getAccessToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
    if (res.ok) return {};
    throw new LedgerError(`Non-JSON response from ledger (HTTP ${res.status})`, 502);
  }
  if (!res.ok) {
    const text = JSON.stringify(json);
    const msg = json?.cause || (json?.errors && json.errors.join("; ")) || `Ledger error ${res.status}`;
    let status = 502;
    if (/PERMISSION_DENIED|security-sensitive/i.test(text)) status = 403;
    else if (/CONTRACT_NOT_FOUND|not.*active|already.*archived|inactive/i.test(text)) status = 409;
    else if (/conservation|fee must be|split must be|feeRate|assertion failed|requires authoriz|ALLOWED_LANGUAGE/i.test(text)) status = 422;
    else if (res.status === 401) status = 401;
    throw new LedgerError(msg, status);
  }
  return json;
}

async function ledgerEndOffset(): Promise<number> {
  const json = await call("/v2/state/ledger-end", "GET");
  return Number(json.offset ?? 0);
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

function toSlice(payload: any, contractId: string): Slice {
  return {
    contractId,
    anchor: payload.anchor,
    owner: payload.owner,
    platform: payload.platform,
    instrumentId: payload.instrumentId,
    faceAmount: Number(payload.faceAmount),
    tier: Number(payload.tier),
    maturity: payload.maturity,
    lineage: (payload.lineage ?? []).map(cleanLineageEntry),
    isFee: Boolean(payload.isFee),
  };
}

export type ProposalContract = { contractId: string; payload: any };

// ---- Reads (projected to the acting party = the privacy demo) ---------------

async function queryActiveContracts(role: Role, filterTemplateId: string): Promise<ProposalContract[]> {
  const party = partyId(role);
  const offset = await ledgerEndOffset();
  const json = await call("/v2/state/active-contracts", "POST", {
    eventFormat: {
      filtersByParty: {
        [party]: {
          cumulative: [
            { identifierFilter: { TemplateFilter: { value: { templateId: filterTemplateId, includeCreatedEventBlob: false } } } },
          ],
        },
      },
      verbose: false,
    },
    activeAtOffset: offset,
  });
  const rows: any[] = Array.isArray(json) ? json : json.result ?? json.contracts ?? [];
  return rows
    .map((r) => r.contractEntry?.JsActiveContract?.createdEvent ?? r.createdEvent)
    .filter(Boolean)
    .map((ev: any) => ({ contractId: ev.contractId, payload: ev.createArgument ?? ev.createArguments }));
}

export async function querySlices(role: Role): Promise<Slice[]> {
  const rows = await queryActiveContracts(role, TPL_FILTER.CreditSlice);
  return rows.map((r) => toSlice(r.payload, r.contractId));
}

export async function querySplitProposals(role: Role): Promise<ProposalContract[]> {
  return queryActiveContracts(role, TPL_FILTER.SplitProposal);
}

export async function queryDiscountProposals(role: Role): Promise<ProposalContract[]> {
  return queryActiveContracts(role, TPL_FILTER.DiscountProposal);
}

// ---- Writes -----------------------------------------------------------------

function extractContractId(submitResult: any): string | undefined {
  const events = submitResult?.transaction?.events ?? submitResult?.events ?? [];
  const created = events.find((e: any) => e.CreatedEvent || e.createdEvent);
  return (created?.CreatedEvent ?? created?.createdEvent)?.contractId;
}

export async function exerciseAs(
  role: Role,
  templateId: string,
  contractId: string,
  choice: string,
  argument: Record<string, unknown> = {},
): Promise<any> {
  const party = partyId(role);
  const res = await call("/v2/commands/submit-and-wait-for-transaction", "POST", {
    commands: {
      commands: [{ ExerciseCommand: { templateId, contractId, choice, choiceArgument: argument } }],
      userId: USER_ID,
      commandId: `dt-${choice}-${contractId.slice(-12)}-${Date.now()}`,
      actAs: [party],
      readAs: [party],
    },
  });
  return { result: { contractId: extractContractId(res) }, raw: res };
}

export async function createAs(
  parties: Role[],
  templateId: string,
  payload: Record<string, unknown>,
): Promise<any> {
  const partyIds = parties.map(partyId);
  const res = await call("/v2/commands/submit-and-wait-for-transaction", "POST", {
    commands: {
      commands: [{ CreateCommand: { templateId, createArguments: payload } }],
      userId: USER_ID,
      commandId: `dt-create-${Date.now()}`,
      actAs: partyIds,
      readAs: partyIds,
    },
  });
  return { result: { contractId: extractContractId(res) }, raw: res };
}
