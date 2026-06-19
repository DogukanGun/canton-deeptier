#!/usr/bin/env bash
# Mint a dev (alg:none) JWT for the Daml JSON API (sandbox started with
# --allow-insecure-tokens). The frontend BFF mints these itself in lib/jwt.ts;
# this script is for curl-testing the per-party privacy projections.
#
# Usage: ./gen-token.sh '<full-party-id>' [ledgerId] [appId]
#   e.g. ./gen-token.sh 'Tier2::1220abc...'  sandbox  deeptier
set -euo pipefail
party="${1:?party id required (e.g. Tier2::1220...)}"
ledger="${2:-sandbox}"
app="${3:-deeptier}"
python3 - "$party" "$ledger" "$app" <<'PY'
import sys, json, base64
party, ledger, app = sys.argv[1], sys.argv[2], sys.argv[3]
def b64(d): return base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).rstrip(b'=').decode()
header = {"alg": "none", "typ": "JWT"}
payload = {"https://daml.com/ledger-api": {
    "ledgerId": ledger, "applicationId": app, "actAs": [party], "readAs": [party]}}
print(f"{b64(header)}.{b64(payload)}.")
PY
