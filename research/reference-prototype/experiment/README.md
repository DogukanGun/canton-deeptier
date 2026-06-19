# Deep-Tier Credit Penetration — Experiment

Monte-Carlo benchmark of a **cross-tier direct-financing token** design against delegate
financing and legacy supply-chain-finance baselines. This is a **numpy-only statistical
simulation** of the design hypothesis — it does **not** stand up Daml/Canton (that is the
packaging step that follows a winning configuration). It exists to decide whether the token
design is worth packaging by scoring it on financing-cost reduction, penetration depth,
traceability, privacy, and settlement.

- **Problem ID:** `deep-tier-credit-penetration`
- **Approach (candidate):** `anchor-payable-transferable-fungible-token`
- **Baselines:** `reverse-factoring`, `po-financing`, `plain-factoring`, `delegate-financing`
- **Reference:** `standalone-sme` (the no-tokenization counterfactual)

## Hypothesis

Modeling an anchor's confirmed payable as a Daml-Finance `TransferableFungible` holding —
with the anchor as **issuer-signatory on every descendant token** — lets credit penetrate to
tier-2/3/4 SMEs at **near-anchor rates**, because the credit risk priced into every split is
the anchor's, not the deep-tier SME's. Canton **sub-transaction privacy** keeps each
bilateral split confidential.

## Model

Calibrated in spirit to the Dong–Qiu–Xu (MSOM) multi-tier financing model and ADB
trade-finance-gap stylized facts:

- Standalone SME borrowing spread **over the anchor rate widens with chain depth**
  (tier-1 ≈ 200 bps → tier-4 ≈ 1100 bps): deep-tier SMEs are credit-constrained.
- **Candidate** prices the anchor's risk regardless of depth → cost ≈ origination fee
  (30 bps), converging to within 50 bps of the anchor at every tier.
- **Reverse factoring** onboards only the anchor's *direct* (tier-1) suppliers; deeper tiers
  fall back to standalone (no penetration).
- **PO financing** reaches tier-1/2 but still prices SME risk (≈60% of standalone spread).
- **Plain factoring** is available at all tiers but only shaves a thin discount.
- **Delegate financing** re-lends downstream, **stacking a margin per hop** → deep-tier cost
  grows with depth and never converges to the anchor.

## What is simulated

1. Synthetic workload of **120,000 tokenized payables** across **4 tiers** (order sizes,
   per-tier standalone spreads, default probabilities).
2. Per-tier **spread reduction (bps)** vs each SME's standalone rate, for candidate and every
   baseline, plus total financing-cost savings (USD) over a 90-day tenor.
3. **Penetration depth** and **coverage of beyond-tier-1 chain spend** at a meaningful
   benefit threshold.
4. **Paired bootstrap 95% CIs** (300 resamples) on candidate spread reduction at tiers 2/3/4
   and on candidate−delegate at tier-4.
5. **Traceability** + **conservation invariant** (`sum(children)+originationFee == parent`)
   over 50,000 integer-cents split tests.
6. **Privacy / adversarial**: 20,000 probes of a tier-3 party attempting to fetch tier-1↔2
   sub-transaction projections (structurally impossible under Canton sub-tx privacy).
7. **Settlement latency** (p50/p99) and **double-financing** over 120,000 replay attempts
   against consumed token IDs.
8. **Sensitivity**: the origination-fee level at which the tier-2 advantage drops below the
   200 bps bar.

## Run

```bash
python main.py        # writes results.json next to the script; ~0.3 s, numpy only
```

No network, no GPU, no Daml/Canton/torch. Dependencies: Python 3.11 + NumPy.

## Output: `results.json`

Top-level keys: `status`, `problem_id`, `approach`, `baselines`, `metrics`, `config`,
`errors`. `metrics` holds one block per system plus `bootstrap_ci`, `privacy`, `settlement`,
`sensitivity`, `conservation_ratio`, `validation`, and a compact `summary`.

## Validation gates (all pass in the recorded run)

| Criterion | Result |
|---|---|
| Tier-2 & tier-3 spread reduction ≥ 200 bps | 420 / 719 bps |
| Deep-tier cost within 50 bps of anchor | 30 bps |
| Bootstrap 95% CI excludes zero (tier-2/3) | yes |
| Penetration depth ≥ tier 4 | tier 4 |
| Coverage of beyond-tier-1 spend ≥ 80% | 100% |
| Traceability ratio = 1.0 | 1.0 |
| Conservation invariant holds 100% | 1.0 |
| Privacy leakage = 0 | 0 leaks / 20k probes |
| p99 settlement latency < 10 s | ~5 s |
| Zero double-financing across replays | 0 / 120k |

## Caveats

The win is **structural by construction** given the calibration: it demonstrates the design's
logic and the conditions under which it dominates, not an empirical measurement on a live
Canton network. The `sensitivity` block records where the advantage breaks down (anchor
credit degrading toward the SME, or origination fee rising above ~standalone − 200 bps). The
real Daml Finance extension, propose-accept endorsement, conservation-enforced splits, and
atomic maturity settlement are the **packaging step** that follows this benchmark.
