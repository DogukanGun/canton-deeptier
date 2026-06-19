# DeepTier — anchor credit, deep & private

**Track:** TradeFi, RWA & Tokenized Assets (also touches Private DeFi & Capital Markets)
**One line:** An anchor buyer's confirmed payable becomes a divisible credit token that reaches
tier-2/3 SME suppliers at near-anchor rates — while Canton's privacy keeps every tier's margins and
counterparties confidential.

---

## The problem

Supply-chain finance has a credit cliff. A large, creditworthy "anchor" buyer (think a global retailer
or manufacturer) can get its tier-1 suppliers financed cheaply against its confirmed invoices. But that
creditworthiness **stops at tier-1**. The tier-2 and tier-3 SMEs deeper in the chain — who need
working capital the most — borrow at their own standalone risk rates, often 400–1000+ basis points
higher, or can't borrow at all. The Asian Development Bank puts the global trade-finance gap in the
trillions, concentrated exactly in these deep-tier SMEs.

The reason it stays broken isn't a lack of credit — it's a **privacy deadlock**:

- The anchor won't publish its full supplier map (it reveals sourcing strategy and dependencies).
- Tier-1 won't reveal its **margin** (the gap between what the anchor pays it and what it pays tier-2).
- SMEs and financiers won't expose their terms to competitors.
- Yet a financier funding a deep-tier slice **must** be able to prove it's backed by the anchor's real
  obligation and hasn't already been pledged elsewhere.

You can't solve this on a public chain (every amount leaks) or with a central registry (competitors
won't trust an operator with their books, and it can't *prove* non-double-pledging). It needs a ledger
where you can **verify without revealing**.

---

## The solution

DeepTier tokenizes the anchor's confirmed payable as a **divisible credit slice** on Canton and lets it
flow down the chain: Anchor → Tier-1 → Tier-2, with a Financier funding a deep-tier slice. The design
makes privacy **load-bearing** by separating two things at the protocol level:

- **Credit factor** — the anchor's signatory identity + a provenance trail — *propagates* onto every
  descendant slice. Any financier can cryptographically verify a slice is genuinely anchor-backed.
- **Commercial factor** — amount, counterparty, margin — stays *bilateral*. A slice's only stakeholders
  are the anchor, its current owner, and the platform, so other tiers and financiers **never receive
  the upstream slice at all** — it's absent from their queries, not hidden in the UI.

Two ledger-enforced invariants make it trustworthy:

- **Conservation** (`children + fee = parent`, a hard precondition) — a slice can't be over-issued.
- **Single-spend** (the source is archived on financing) — a slice can't be double-pledged.

The result: **anchor credit reaches deep tiers, a financier can prove backing and non-double-pledging,
and nobody sees the margins or amounts of hops they aren't party to — even though no single party ever
sees the whole tree.**

---

## Why it makes someone show up to Canton

This is a use case that is **impossible without Canton's privacy model** and pointless without its
atomic multi-party settlement. It's not "we put a thing on chain" — remove the sub-transaction privacy
and the product collapses (margins leak, suppliers walk away). That's the bar this hackathon set:
build something a real institution would actually use *because of* how Canton works.

The buyers are obvious and current: factoring houses, trade-finance banks, supply-chain finance
platforms, and the anchors themselves — all of whom lose money to the deep-tier gap today.

---

## How it works

```
┌────────────────── Vercel ──────────────────┐      ┌──────── Canton (Daml) ───────────┐
│ Next.js app                                 │ HTTPS│ Daml JSON API (:7575, tunneled)  │
│  • perspective dashboard (Anchor/T1/T2/Fin) │ ───▶ │  • CreditSlice: propagate, split, │
│  • stateless backend-for-frontend           │ +JWT │    discount, settle               │
│    picks a party token per perspective      │      │  • per-party projection = privacy │
│  • optional AI invoice → form prefill        │      │  holds ALL state                  │
└─────────────────────────────────────────────┘      └───────────────────────────────────┘
```

- **Ledger (Daml on Canton):** one `CreditSlice` template is both the root payable and every descendant.
  Propose/accept flows (`SplitProposal`, `DiscountProposal`) move value while keeping each hop bilateral;
  the anchor co-signs every slice; settlement archives slices atomically at maturity.
- **App (Next.js):** a genuinely **stateless** backend — no database; all state lives in the ledger.
  Each request queries the Daml JSON API with the active party's token, so the privacy is enforced by
  the ledger, not the interface.
- **Optional AI:** drop an invoice on the Mint page and a single cheap model call prefills the fields;
  with no key it falls back to manual entry, so the demo never depends on AI.

---

## The demo moment

Flip the **perspective toggle**:

- As **Tier-2**, the Anchor↔Tier-1 amount and Tier-1's margin are simply *gone* — not greyed out,
  absent. Flip to **Anchor** and they reappear. Same UI, same ledger, different projection.
- As the **Financier**, fund a deep-tier slice. A green **✓ backed by anchor obligation · ✓ not
  double-pledged** lands — right beside locked rows reading *"Tier-1 margin — hidden"* and *"Anchor ↔
  Tier-1 amount — hidden."* The financier got everything it needs to underwrite, and **literally
  cannot** see what it shouldn't.
- Try to finance the same slice twice → **rejected: singularity enforced.**

---

## What we built (and verified)

- A real Daml package on a Canton sandbox — not a simulation. `daml test` passes the full invariant
  suite (conservation, single-spend, over-split rejection, discount, settlement).
- The privacy claim proven over HTTP: querying as different parties returns different projections of
  the same ledger; the financier's funding flow never exposes upstream amounts.
- A production Next.js build, a stateless BFF, and the live path validated end-to-end through a
  cloudflared tunnel (Vercel → tunnel → ledger).

**Stack:** Daml 2.9.5 / Canton · Next.js (App Router) + TypeScript on Vercel · Tailwind · Daml HTTP
JSON API · optional Vercel AI Gateway / OpenAI.

---

## Real-world grounding

The economics come from a research study (in [`research/`](./research)) calibrated on supply-chain
finance data: deep-tier financing costs drop to ~30 bps over the anchor's rate versus 400–1000+ bps
standalone, with full traceability to the anchor obligation and zero privacy leakage across adversarial
tests. This isn't "tokenize a thing because we could" — it's a financing mechanism that only works
because of confidentiality.

## What's next

- Each organization on its own Canton participant node — cryptographic sub-transaction privacy across a
  real trust boundary.
- Daml Finance instruments + real delivery-vs-payment cash settlement (tokenized deposits / ISO 20022).
- Deeper tiers (T3/T4) and multilateral intercompany netting.
- ERP / e-invoicing ingest so anchors tokenize approved invoices automatically.

---

## Links

- **Live demo:** _(Vercel URL — deployed at demo time; FE on Vercel, ledger via tunnel)_
- **Repo:** this repository — `ledger/` (Canton contracts), `web/` (app), `research/` (paper + method)
- **Demo video:** _(3-min walkthrough)_
