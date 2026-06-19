#!/usr/bin/env bash
# Expose the local Daml JSON API (:7575) to the internet so the Vercel-hosted
# BFF can reach it. Prints a https://*.trycloudflare.com URL — set that as
# LEDGER_API_URL in Vercel. (For a stable hostname across restarts, configure a
# named cloudflared tunnel instead.)
set -euo pipefail
exec cloudflared tunnel --url http://localhost:7575
