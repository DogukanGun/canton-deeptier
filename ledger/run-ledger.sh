#!/usr/bin/env bash
# Start the Canton sandbox (with DAR + seed) and the JSON API on :7575.
# Usage:  ./run-ledger.sh        (run from the ledger/ dir)
set -euo pipefail
cd "$(dirname "$0")"
source ./env.sh

echo "[1/2] sandbox + DAR upload + init script (JSON API disabled here)…"
daml start --start-navigator no --open-browser no --json-api-port none &
SANDBOX_PID=$!

# wait until the ledger has allocated the demo parties
until daml ledger list-parties --host localhost --port 6865 2>/dev/null | grep -q "Tier2"; do sleep 2; done
echo "[2/2] JSON API on http://localhost:7575 …"
daml json-api --ledger-host localhost --ledger-port 6865 --http-port 7575 --allow-insecure-tokens &
JSONAPI_PID=$!

echo
echo "Ledger up. Party namespace:"
daml ledger list-parties --host localhost --port 6865 | grep -oE "::[0-9a-f]{64}" | head -1 | sed 's/^:://'
echo "Set DT_NAMESPACE (web/.env.local) to that value if it changed."
echo "Ctrl-C to stop."
wait $SANDBOX_PID $JSONAPI_PID
