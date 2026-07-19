// Real OIDC client-credentials auth for the 5N Sandbox Devnet validator's
// JSON Ledger API v2. Replaces the old alg:none dev-token minting, which only
// worked against a local sandbox started with --allow-insecure-tokens.
// SERVER-ONLY: the client secret never reaches the browser.
import "server-only";

const TOKEN_URL = process.env.LEDGER_OIDC_TOKEN_URL ?? "https://auth.sandbox.fivenorth.io/application/o/token/";
const CLIENT_ID = process.env.LEDGER_OIDC_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.LEDGER_OIDC_CLIENT_SECRET ?? "";
const AUDIENCE = process.env.LEDGER_OIDC_AUDIENCE ?? CLIENT_ID;
const SCOPE = process.env.LEDGER_OIDC_SCOPE ?? "daml_ledger_api";

// 60s safety margin so an in-flight request never races a token refresh.
const REFRESH_BUFFER_MS = 60_000;

let cached: { token: string; expiresAt: number } | null = null;

async function fetchToken(): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: AUDIENCE,
      scope: SCOPE,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`OIDC token request failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  const expiresInMs = (Number(json.expires_in) || 3600) * 1000;
  return { token: json.access_token as string, expiresAt: Date.now() + expiresInMs };
}

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
    return cached.token;
  }
  cached = await fetchToken();
  return cached.token;
}
