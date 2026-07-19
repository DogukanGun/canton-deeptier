# DeepTier: anchor credit, deep and private

**Deep-tier supply-chain finance on [Canton](https://www.canton.network/), where privacy is load-bearing.**

**Live demo:** https://web-delta-three-89.vercel.app (running on Canton Devnet)
**Track:** TradeFi, RWA and Tokenized Assets (with a Private DeFi and Capital Markets angle)

An anchor buyer's creditworthiness normally stops at its tier-1 suppliers. The tier-2 and tier-3 SMEs deeper in the chain, the ones who need financing most, are locked out. DeepTier turns an anchor's *confirmed payable* into a **divisible credit token** that propagates down the chain (Anchor to Tier-1 to Tier-2 and beyond), so a financier can fund a deep-tier slice at the anchor's rate, without anyone revealing their margins, amounts, or counterparties.

This is only possible on a privacy-enabled ledger. On a public chain every amount leaks; a central registry forces competitors to trust an operator with their books, and still cannot prove a slice was not pledged twice. Canton's per-party projection is the thing that makes it real.

---

## The idea that fixes privacy

We separate two factors at the protocol level:

| | What it is | How it behaves |
|---|---|---|
| **Credit factor** | the anchor's signatory identity plus a `lineage` provenance trail | **propagates** onto every descendant slice, so any financier can verify a slice is genuinely anchor-backed |
| **Commercial factor** | amount, counterparty, margin | stays **bilateral**: a slice's only stakeholders are `{anchor, owner, platform}`, so other tiers and financiers never receive it |

A **conservation invariant** (`sum(children) + fee == parent`, a hard Daml precondition) plus **single-spend** (the parent/source is archived on split/discount) make a slice impossible to over-issue or double-pledge, even though no single party ever sees the whole tree.

> Privacy is enforced by the ledger, not the UI. The backend queries the Canton ledger as each party, so contracts that party is not a stakeholder of **never arrive**. Switch perspectives in the app and watch the same data appear and disappear.

---

## What is live

- The `CreditSlice` Daml contract is **deployed on Canton Devnet** (the 5N Sandbox validator), running on-ledger. Not a mock.
- A stateless Next.js app is **deployed on Vercel** and reads/writes that real ledger over the JSON Ledger API v2, authenticating with a real OIDC token.
- The full flow works end to end and is verifiable in the live app: mint, split (propose/accept), finance (offer/fund), financier verification, settlement, and double-spend rejection.
- Per-party privacy is real over HTTP: querying as Tier-2 omits the Anchor to Tier-1 amount and Tier-1's margin that the Anchor query includes.

The headline economics (deep-tier cost within ~30 bps of the anchor, versus 400 to 1000+ bps standalone) come from the research simulation, not the live app. See [Research](#research).

---

## Architecture

```
┌────────────────── Vercel ──────────────────┐        ┌──── Canton Devnet (5N Sandbox) ────┐
│ Next.js (App Router)                        │ HTTPS  │ Validator + JSON Ledger API v2      │
│  • dashboard / mint pages                   │  +     │  • CreditSlice: split / discount /  │
│  • /api/* = STATELESS backend               │ OIDC   │    settle, propose-accept flows     │
│    picks the acting party by cookie,        │ ─────▶ │  • per-party projection = privacy   │
│    calls the ledger (lib/ledger.ts)         │ token  │  • holds ALL state                  │
│  • /api/ai/parse-invoice (optional)         │        └─────────────────────────────────────┘
└─────────────────────────────────────────────┘
```

- **`ledger/`**: the Daml package (Canton). One `CreditSlice` template is both the root payable and every descendant. Privacy is the signatory/observer topology plus Canton projection.
- **`web/`**: the Next.js frontend and a genuinely **stateless** backend-for-frontend. No DB or KV; all state lives on the ledger.
- **`research/`**: the paper, method, and reference simulation the design was validated against.

---

## Run the ledger locally

**Prereqs:** JDK 17+, [dpm](https://docs.digitalasset.com/build/3.4/dpm/dpm.html) (the Daml toolchain), Node 18+.

```bash
# build + test the Daml contract (uses SDK 3.5.2, pinned in ledger/daml.yaml)
cd ledger
dpm build
dpm test        # conservation, single-spend, over-split, discount, settlement
```

The deployed DAR compiles to Daml-LF 2.x, which the 5N Sandbox validator requires.

## Run the web app (against Devnet)

The app talks to the live Devnet validator, so no local ledger is needed. Set `web/.env.local`:

```bash
LEDGER_API_URL=https://ledger-api.validator.devnet.sandbox.fivenorth.io
LEDGER_PACKAGE_ID=<deployed package id>
DT_NAMESPACE=<participant namespace>
LEDGER_OIDC_TOKEN_URL=https://auth.sandbox.fivenorth.io/application/o/token/
LEDGER_OIDC_CLIENT_ID=<oidc client id>
LEDGER_OIDC_CLIENT_SECRET=<oidc client secret>   # keep secret, never commit
LEDGER_OIDC_AUDIENCE=<oidc audience>
LEDGER_OIDC_SCOPE=daml_ledger_api
LEDGER_USER_ID=<ledger user with actAs rights on the parties>
# optional AI prefill: OPENAI_API_KEY or AI_GATEWAY_API_KEY
```

```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

### Prove the privacy (same query, two parties)

```bash
# Tier-2's response omits the Anchor to Tier-1 amount that Anchor's response includes.
curl -s -H "Cookie: dt_perspective=Tier2"  https://web-delta-three-89.vercel.app/api/holdings | grep faceAmount
curl -s -H "Cookie: dt_perspective=Anchor" https://web-delta-three-89.vercel.app/api/holdings | grep faceAmount
```

---

## Deploy notes

The Daml package is uploaded to the 5N Sandbox validator via Seaport (the hackathon deploy tool). The web app deploys to Vercel with `vercel --prod`, with the env vars above set in the Vercel project. The live URL is what judges click; the ledger runs on Canton Devnet.

There is a **↻ Reset demo** button in the app header that settles all slices and re-seeds the starting state, so anyone can try the platform and return it to a clean state.

---

## AI (optional, cheap)

Drop an invoice on the Mint page to prefill the form via one `generateObject` call (`openai/gpt-4o-mini`, temperature 0, small output). With no key it falls back to manual entry and a **Use sample invoice** button, so the demo never depends on AI.

---

## Demo script (3 min)

1. **Mint** (as Anchor): a $1,000,000 confirmed payable to Tier-1.
2. **Endorse** (as Tier-1): split $400,000 down to Tier-2; **Tier-2 accepts**.
3. **Privacy reveal**: toggle to **Tier-2** and the Anchor to Tier-1 amount and Tier-1's margin are simply absent. Toggle back to **Anchor** and they reappear. Same UI, same ledger, different projection.
4. **The climax** (as Financier): fund the offered slice. A green **backed by anchor obligation** and **not double-pledged** card lands, beside locked rows for Tier-1 margin and the Anchor to Tier-1 amount.
5. **Settle** (as Anchor) at maturity; re-funding an archived slice returns a 409, singularity enforced.

---

## Research

The design and economics were validated in a research paper and calibrated Monte-Carlo simulation before the live app was built.

- **Paper:** [`research/paper/deep-tier-credit-penetration.pdf`](./research/paper/deep-tier-credit-penetration.pdf)
- **Method, data, and reference prototype:** [`research/`](./research)

Headline results (simulation): deep-tier financing cost within ~30 bps of the anchor at every tier, spread reductions of 420/719/1072 bps at tiers 2/3/4, traceability and conservation ratios of 1.0, zero privacy leakage and zero double-financing across adversarial trials.

---

## Future work

Each organization on its own Canton participant node (cryptographic sub-transaction privacy across a real trust boundary); Daml Finance instruments plus real delivery-vs-payment cash settlement; ERP/ISO 20022 ingest; deeper tiers (T3/T4) and multilateral netting.
