// Dev (alg:none) JWT minting for the Daml JSON API started with
// --allow-insecure-tokens. SERVER-ONLY: this module is imported only by route
// handlers; the secret-free token never reaches the browser. In production this
// is where real IdP-issued tokens (per the authenticated user's party) slot in.
import "server-only";

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

// One token may act/read as several parties (e.g. minting the root needs
// anchor + owner + platform authority in a single submission).
export function devToken(parties: string[]): string {
  const header = { alg: "none", typ: "JWT" };
  const payload = {
    "https://daml.com/ledger-api": {
      ledgerId: process.env.LEDGER_LEDGER_ID ?? "sandbox",
      applicationId: process.env.LEDGER_APP_ID ?? "deeptier",
      actAs: parties,
      readAs: parties,
    },
  };
  return `${b64url(header)}.${b64url(payload)}.`;
}
