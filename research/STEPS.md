# From research to a working Canton app — the steps

How DeepTier went from an autonomously-discovered research idea to a real, privacy-preserving Canton
application. Three parts: **how the idea was found**, **the concept that makes privacy load-bearing**,
and **the build + verification steps** (reproducible).

---

## 1. How the idea was found

The idea was discovered by an autonomous research pipeline (Thinker) seeded with the Canton hackathon
tracks. For each track it gathered ~10 candidate problems and screened them for novelty, feasibility,
and real-world relevance, accepting one per bounty. For the **TradeFi / RWA** track it accepted
*deep-tier credit penetration*, then ran the full pipeline (decompose → research swarm → experiment →
LaTeX paper → review → PDF). The output is in [`paper/`](./paper).

**Why this idea:** deep-tier supply-chain finance is a real, multi-trillion-dollar gap — an anchor
buyer's credit reaches tier-1 suppliers, but tier-2/3 SMEs (who need it most) are locked out. The
research showed tokenizing the anchor's payable closes ~400–1000 bps of spread for deep tiers — *if*
you can preserve privacy.

---

## 2. The concept that makes privacy load-bearing

The original paper treated privacy as a feature. The key design move for a **Canton** app was to make
privacy the load-bearing element by separating two factors at the protocol level:

| Factor | What it is | Behavior |
|---|---|---|
| **Credit** | the anchor's signatory identity + a `lineage` provenance trail | **propagates** onto every descendant slice → any financier can verify a deep-tier slice is genuinely anchor-backed |
| **Commercial** | amount, counterparty, margin | stays **bilateral** → a slice's only stakeholders are `{anchor, owner, platform}`, so other tiers/financiers never receive it |

Two ledger-enforced guarantees complete it:
- **Conservation** — `sum(children) + fee == parent`, a hard Daml precondition inside the atomic
  accept choices → a slice cannot be over-issued.
- **Single-spend** — the parent/source is archived on split/discount → it cannot be financed twice.

Together these mean: **no slice can be over-issued or double-pledged, even though no single party ever
sees the whole tree.** On a public chain every amount leaks; a central registry forces competitors to
trust an operator. Canton's per-party (sub-transaction) projection is what makes "verify without
revealing" real.

### One correctness fix vs the reference
The reference design (`reference-prototype/daml/DeepTier.daml`) let the recipient `fetch`/`archive`
the parent slice — but the recipient is **not allowed to see** that slice (that's the whole point).
The shipped ledger fixes this: the **owner** consumes its own slice and emits a proposal carrying only
the next slice's data; the recipient mints the child from the proposal, never reading the parent.
Settlement was likewise re-authorized (`Settle` controlled by the anchor on each slice).

---

## 3. Build + verification steps (reproducible)

### Phase 0 — toolchain
- JDK 17 (`brew install openjdk@17`), Daml SDK 2.9.5 (`get.daml.com`), `cloudflared`.
- Smoke-tested a sandbox boot before writing any Daml.

### Phase 1 — Daml ledger (`../ledger`)
- One `CreditSlice` template = root payable + every descendant; `SplitProposal` / `DiscountProposal`
  propose-accept flows; `Settle`. Privacy via signatory (`anchor, owner, platform`) / observer topology.
- `Setup/Init.daml` seeds parties + a payable + one split; `Setup/Tests.daml` mirrors the paper's
  invariants.
- **Verify:**
  ```bash
  cd ../ledger && source env.sh && daml test    # conservation, single-spend, over-split, discount, settlement
  ```
  All five pass. Then `./run-ledger.sh` brings up the sandbox + JSON API on :7575.

### Phase 1 verification — the privacy proof (over HTTP)
```bash
# same query, two parties — Tier-2 omits the Anchor↔Tier-1 amount Anchor sees
curl -s -H "Cookie: dt_perspective=Tier2"  localhost:3000/api/holdings | grep faceAmount   # 400000 only
curl -s -H "Cookie: dt_perspective=Anchor" localhost:3000/api/holdings | grep faceAmount   # 600000 + 400000
```

### Phase 2 — Next.js app + stateless BFF (`../web`)
- `lib/ledger.ts` (single Daml JSON-API choke point), `lib/jwt.ts` (per-party dev token), `lib/perspective.ts`.
- API routes = the stateless backend; perspective cookie selects which party token to use.
- Dashboard with the perspective toggle + the financier verification moment (green ✓ backed / ✓ not
  double-pledged beside locked "Tier-1 margin — hidden").
- **Verify (end-to-end):** offer → fund (fee→Platform, balance→Financier, conserves) → verify →
  re-fund the archived slice = **HTTP 409 (singularity)**. `next build` passes; `tsc --noEmit` clean.

### Phase 3 — optional AI
- `/api/ai/parse-invoice`: one `generateObject` call (`gpt-4o-mini`, temp 0, ≤400 tokens) to prefill
  the Mint form. No key → graceful fallback + "Use sample invoice". Never on the critical path.

### Phase 4 — deploy
- `next build` green; live path verified through a `cloudflared` tunnel (authenticated POST queries
  Vercel-BFF → tunnel → ledger). Deploy runbook in [`../README.md`](../README.md): FE + stateless BFF
  on Vercel; the JVM ledger runs locally/tunneled.

---

## Mapping: paper → shipped app

| Paper concept | Shipped in |
|---|---|
| Anchor-signed divisible token, lineage traceability | `../ledger/daml/DeepTier/CreditSlice.daml` |
| Conservation invariant, single-spend | accept choices in `CreditSlice.daml` + `Setup/Tests.daml` |
| Sub-transaction privacy (per-party projection) | signatory/observer topology + per-party JWT in `../web/lib` |
| Origination fee to platform | `AcceptDiscount` choice |
| Atomic maturity settlement | `Settle` choice |
| Adversarial privacy test (0 leakage) | the perspective toggle + `/api/holdings` projection check above |
