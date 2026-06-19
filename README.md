# DeepTier — anchor credit, deep & private

**Deep-tier supply-chain finance on [Canton](https://www.canton.network/), where privacy is load-bearing.**

An anchor buyer's creditworthiness normally stops at its tier-1 suppliers. The tier-2/tier-3 SMEs
deeper in the chain — who need financing most — are locked out. DeepTier turns an anchor's *confirmed
payable* into a **divisible credit token** that propagates down the chain (Anchor → Tier-1 → Tier-2 → …),
so a financier can fund a deep-tier slice at the anchor's rate — **without anyone revealing their
margins, amounts, or counterparties.**

This is only possible on a privacy-enabled ledger. On a public chain every amount leaks; a central
registry forces competitors to trust an operator with their books. Canton's sub-transaction privacy is
the thing that makes it real.

---

## The idea that fixes privacy

We separate two factors at the protocol level:

| | What it is | How it behaves |
|---|---|---|
| **Credit factor** | the anchor's signatory identity + a `lineage` provenance trail | **propagates** onto every descendant slice — any financier can verify a slice is genuinely anchor-backed |
| **Commercial factor** | amount, counterparty, margin | stays **bilateral** — a slice's only stakeholders are `{anchor, owner, platform}`, so other tiers/financiers never receive it |

A **conservation invariant** (`sum(children) + fee == parent`, a hard Daml precondition) plus
**single-spend** (the parent/source is archived on split/discount) make a slice impossible to
over-issue or double-pledge — *even though no single party ever sees the whole tree.*

> Privacy is enforced by the ledger, not the UI. The backend queries the Daml JSON API with each
> party's token, so withheld contracts **never arrive**. Switch perspectives in the app and watch the
> same data appear and disappear.

---

## Architecture

```
┌────────────────── Vercel ──────────────────┐      ┌──────── local / tunneled ────────┐
│ Next.js (App Router)                        │ HTTPS│ Daml sandbox + JSON API (:7575)   │
│  • dashboard / mint pages                   │ ───▶ │  • CreditSlice + propose/accept   │
│  • /api/* = STATELESS BFF                   │ +JWT │    + discount + settle            │
│    picks party token by perspective cookie  │      │  • per-party projection = privacy │
│    → calls the Daml JSON API (lib/ledger.ts)│      │  holds ALL state                  │
│  • /api/ai/parse-invoice → AI (optional)    │      └───────────────────────────────────┘
└─────────────────────────────────────────────┘            ▲ cloudflared tunnel
```

- **`ledger/`** — the Daml package (Canton). One `CreditSlice` template is both the root payable and
  every descendant. Privacy = signatory/observer topology + Canton sub-transaction projection.
- **`web/`** — Next.js frontend + a genuinely **stateless** backend-for-frontend. No DB/KV; all state
  lives in the ledger. Deployable to Vercel.

---

## Run it locally

**Prereqs:** JDK 17, [Daml SDK 2.9.5](https://docs.daml.com), Node 18+, and (for the public link)
[`cloudflared`](https://github.com/cloudflare/cloudflared).

```bash
# 1. Ledger — Canton sandbox + JSON API on :7575, seeded with a demo payable + split
cd ledger
source env.sh                 # pins JDK 17 + puts daml on PATH
daml start --start-navigator no --open-browser no --json-api-port none &
daml json-api --ledger-host localhost --ledger-port 6865 --http-port 7575 --allow-insecure-tokens &

# 2. Web — Next.js on :3000
cd ../web
npm install
npm run dev
# open http://localhost:3000
```

After `daml build`, the package id changes — re-sync `web/.env.local`'s `LEDGER_PACKAGE_ID`:
```bash
cd ledger && daml damlc inspect-dar .daml/dist/deeptier-0.1.0.dar | grep deeptier-0.1.0
```
Party ids: run `daml ledger list-parties --host localhost --port 6865` and put the shared namespace in
`web/.env.local`'s `DT_NAMESPACE`.

### Verify the ledger logic
```bash
cd ledger && daml test        # conservation, single-spend, over-split, discount, settlement
```

### Prove the privacy (same query, two parties)
```bash
# Tier-2's response omits the Anchor↔Tier-1 amount that Anchor's response includes.
curl -s -H "Cookie: dt_perspective=Tier2"  localhost:3000/api/holdings | grep faceAmount
curl -s -H "Cookie: dt_perspective=Anchor" localhost:3000/api/holdings | grep faceAmount
```

---

## Deploy (FE + BFF on Vercel, ledger via tunnel)

```bash
# expose the local ledger
cloudflared tunnel --url http://localhost:7575     # prints https://xxxx.trycloudflare.com

cd web
vercel link
vercel env add LEDGER_API_URL       # = the tunnel URL
vercel env add LEDGER_PACKAGE_ID    # current DAR package id
vercel env add DT_NAMESPACE         # participant namespace
vercel env add LEDGER_LEDGER_ID     # "sandbox"
vercel env add LEDGER_APP_ID        # "deeptier"
# optional AI prefill: vercel env add OPENAI_API_KEY  (or AI_GATEWAY_API_KEY)
vercel --prod
```

The Vercel FE is the live URL judges click; only the JVM ledger runs off-Vercel.

---

## AI (optional, cheap)

Drop an invoice on the Mint page to prefill the form via one `generateObject` call
(`openai/gpt-4o-mini`, temperature 0, ≤400 output tokens — well under a cent). Set `OPENAI_API_KEY`
or `AI_GATEWAY_API_KEY`. With no key it falls back to manual entry + a deterministic **Use sample
invoice** button — the demo never depends on AI.

---

## Demo script (3 min)

1. **Mint** (as Anchor) — drop a sample invoice, mint a $1,000,000 confirmed payable to Tier-1.
2. **Endorse** (as Tier-1) — split $400,000 down to Tier-2; **Tier-2 accepts** the incoming slice.
3. **Privacy reveal** — toggle **Tier-2**: the Anchor↔Tier-1 amount and Tier-1's margin are simply
   *absent*. Toggle back to **Anchor**: they reappear. Same UI, same ledger — different projection.
4. **The climax** (as Financier) — a financing offer appears; **Fund it**. A green
   **✓ backed by anchor obligation · ✓ not double-pledged** lands, beside locked rows
   *"Tier-1 margin — hidden"*, *"Anchor↔Tier-1 amount — hidden."*
5. **Settle** (as Anchor) at maturity; re-funding the archived slice returns **409 — singularity
   enforced.**

---

## Future work
Each organization on its own Canton participant node (cryptographic sub-transaction privacy across a
trust boundary); Daml Finance instruments + real DvP cash settlement; ERP/ISO-20022 ingest; deeper
tiers (T3/T4) and multilateral netting.
