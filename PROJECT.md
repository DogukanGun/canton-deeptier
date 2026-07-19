# DeepTier: anchor credit, deep and private

**Track:** TradeFi, RWA and Tokenized Assets (also touches Private DeFi and Capital Markets)

**One line:** An anchor buyer's confirmed payable becomes a divisible credit token that reaches tier-2 and tier-3 SME suppliers at near-anchor rates, while Canton's privacy keeps every tier's margins and counterparties confidential.

**Live on Canton Devnet:** https://web-delta-three-89.vercel.app

---

## The problem

Supply-chain finance has a credit cliff. A large, creditworthy "anchor" buyer, think a global retailer or manufacturer, can get its tier-1 suppliers financed cheaply against its confirmed invoices. But that creditworthiness **stops at tier-1**. The tier-2 and tier-3 SMEs deeper in the chain, the ones who need working capital the most, borrow at their own standalone risk rates, often 400 to 1000+ basis points higher, or cannot borrow at all. The Asian Development Bank puts the global trade-finance gap in the trillions, concentrated exactly in these deep-tier SMEs.

The reason it stays broken is not a lack of credit. It is a **privacy deadlock**:

- The anchor will not publish its full supplier map, because it reveals sourcing strategy and dependencies.
- Tier-1 will not reveal its **margin**, the gap between what the anchor pays it and what it pays tier-2.
- SMEs and financiers will not expose their terms to competitors.
- Yet a financier funding a deep-tier slice **must** be able to prove it is backed by the anchor's real obligation and has not already been pledged elsewhere.

You cannot solve this on a public chain, where every amount leaks, or with a central registry, where competitors have to trust an operator with their books and it still cannot *prove* non-double-pledging. It needs a ledger where you can **verify without revealing**.

---

## The solution

DeepTier tokenizes the anchor's confirmed payable as a **divisible credit slice** on Canton and lets it flow down the chain: Anchor to Tier-1 to Tier-2, with a Financier funding a deep-tier slice. The design makes privacy **load-bearing** by separating two things at the protocol level:

- **Credit factor:** the anchor's signatory identity plus a provenance trail. It *propagates* onto every descendant slice, so any financier can cryptographically verify a slice is genuinely anchor-backed.
- **Commercial factor:** amount, counterparty, margin. It stays *bilateral*. A slice's only stakeholders are the anchor, its current owner, and the platform, so other tiers and financiers **never receive the upstream slice at all**. It is absent from their queries, not hidden in the UI.

Two ledger-enforced invariants make it trustworthy:

- **Conservation** (`children + fee = parent`, a hard precondition): a slice cannot be over-issued.
- **Single-spend** (the source is archived on financing): a slice cannot be double-pledged.

The result: anchor credit reaches deep tiers, a financier can prove backing and non-double-pledging, and nobody sees the margins or amounts of hops they are not party to, even though no single party ever sees the whole tree.

---

## Why it makes someone show up to Canton

This is a use case that is **impossible without Canton's privacy model** and pointless without its atomic multi-party settlement. It is not "we put a thing on chain." Remove the sub-transaction privacy and the product collapses: margins leak and suppliers walk away. That is the bar this hackathon set: build something a real institution would actually use *because of* how Canton works.

The buyers are obvious and current: factoring houses, trade-finance banks, supply-chain finance platforms, and the anchors themselves, all of whom lose money to the deep-tier gap today.

---

## How it works

```
┌────────────────── Vercel ──────────────────┐        ┌──── Canton Devnet (5N Sandbox) ────┐
│ Next.js app                                 │ HTTPS  │ Validator + JSON Ledger API v2      │
│  • perspective dashboard (Anchor/T1/T2/Fin) │  +     │  • CreditSlice: propagate, split,   │
│  • stateless backend-for-frontend           │ OIDC   │    discount, settle                 │
│    picks the acting party per perspective   │ token  │  • per-party projection = privacy   │
│  • optional AI invoice to form prefill      │ ─────▶ │  • holds ALL state                  │
└─────────────────────────────────────────────┘        └─────────────────────────────────────┘
```

- **Ledger (Daml on Canton):** one `CreditSlice` template is both the root payable and every descendant. Propose/accept flows (`SplitProposal`, `DiscountProposal`) move value while keeping each hop bilateral; the anchor co-signs every slice; settlement archives slices at maturity.
- **App (Next.js):** a genuinely **stateless** backend, no database, all state lives on the ledger. Each request queries the Canton ledger as the active party, so privacy is enforced by the ledger, not the interface. Auth is a real OIDC token to the Devnet validator.
- **Optional AI:** drop an invoice on the Mint page and a single cheap model call prefills the fields. With no key it falls back to manual entry, so the demo never depends on AI.

---

## The demo moment

Flip the **perspective toggle**:

- As **Tier-2**, the Anchor to Tier-1 amount and Tier-1's margin are simply *gone*, not greyed out, absent. Flip to **Anchor** and they reappear. Same UI, same ledger, different projection.
- As the **Financier**, fund a deep-tier slice. A green **backed by anchor obligation** and **not double-pledged** result lands, right beside locked rows for *Tier-1 margin* and the *Anchor to Tier-1 amount*. The financier gets everything it needs to underwrite, and literally cannot see what it should not.
- Try to finance the same slice twice and it is **rejected: singularity enforced.**

---

## What we built (and verified)

- A real Daml package **deployed live on Canton Devnet** (the 5N Sandbox validator), running on-ledger. Not a simulation. The invariant suite (conservation, single-spend, over-split rejection, discount, settlement) passes under `dpm test`.
- The privacy claim proven over HTTP against the live ledger: querying as different parties returns different projections of the same ledger, and the financier's funding flow never exposes upstream amounts.
- A stateless Next.js app on Vercel that reads and writes the real ledger through the JSON Ledger API v2, with the full flow verified end to end in the deployed app: mint, split, finance, financier verification, settlement, and double-spend rejection.

**Stack:** Daml 3.5.2 / Canton Devnet (5N Sandbox), JSON Ledger API v2, OIDC auth, Next.js (App Router) and TypeScript on Vercel, Tailwind, optional Vercel AI Gateway / OpenAI.

---

## Real-world grounding

The economics come from a research study (in [`research/`](./research)) calibrated on supply-chain finance data: deep-tier financing costs drop to about 30 bps over the anchor's rate versus 400 to 1000+ bps standalone, with full traceability to the anchor obligation and zero privacy leakage across adversarial tests. This is not "tokenize a thing because we could." It is a financing mechanism that only works because of confidentiality.

---

## What's next

- Each organization on its own Canton participant node, for cryptographic sub-transaction privacy across a real trust boundary.
- Daml Finance instruments plus real delivery-vs-payment cash settlement (tokenized deposits / ISO 20022).
- Deeper tiers (T3/T4) and multilateral intercompany netting.
- ERP / e-invoicing ingest so anchors tokenize approved invoices automatically.

---

## Links

- **Live demo:** https://web-delta-three-89.vercel.app
- **Repo:** this repository. `ledger/` (Canton contracts), `web/` (app), `research/` (paper and method).
- **Research paper:** [`research/paper/deep-tier-credit-penetration.pdf`](./research/paper/deep-tier-credit-penetration.pdf)
