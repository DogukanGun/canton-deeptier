# Deep-Tier Credit-Penetration Prototype

A minimal, runnable prototype of the **winning cross-tier direct-financing token
design**: an anchor's confirmed payable is modelled as a Daml Finance
`TransferableFungible` holding on which the **anchor is instrument issuer and a
signatory of every descendant token**. This lets anchor credit penetrate to
tier-2/3/4 SMEs at near-anchor rates, while Canton sub-transaction privacy keeps
each bilateral split confidential.

## What it does

The `deeptier` package is a pure-stdlib reference ledger + Monte-Carlo benchmark
that reproduces the experiment's headline results:

- **Conservation-enforced splits** — children always sum to the parent; total
  outstanding holdings + origination fees == original face value.
- **Propose-accept endorsement** down the supply chain (tier-1 → tier-4).
- **Origination-fee minting** to the platform on each financing event.
- **Singularity / exclusive control** — a financed or settled token is archived,
  so the same receivable cannot be financed twice (no double-financing/replay).
- **Atomic maturity settlement** — the anchor funds face value and all
  outstanding tokens are archived in one allocate-approve-settle batch.
- **MSOM (Dong-Qiu-Xu) calibrated pricing** — per-tier spread-reduction with 95%
  confidence intervals.

`daml/DeepTier.daml` is the illustrative on-ledger template design these
semantics mirror (template shape, authorization, conservation). It documents the
Daml Finance extension; it is not built into a DAR in this minimal prototype.

## Layout

```
deeptier/
  core.py        # holding/ledger model: mint, split+endorse, discount, settle
  simulation.py  # MSOM Monte-Carlo + on-ledger invariants + 12 validation gates
  cli.py         # JSON KPI emitter
daml/DeepTier.daml  # reference Daml Finance template design
tests/test_smoke.py
```

## How to run

No third-party dependencies — Python 3.11 standard library only.

```bash
# Emit the KPI JSON (per-tier spread reduction, invariants, latency, gates):
python -m deeptier.cli --gates

# Faster run with fewer Monte-Carlo trials:
python -m deeptier.cli --trials 2000

# Smoke tests:
python -m pytest tests/test_smoke.py      # or: python tests/test_smoke.py
```

### Example invocation

```bash
$ python -m deeptier.cli --trials 2000
{
  "metrics": {
    "tier2_spread_reduction_bps": 420.1,
    "tier3_spread_reduction_bps": 718.97,
    "tier4_spread_reduction_bps": 1072.05,
    "deep_tier_cost_gap_to_anchor_bps": 30.0,
    "penetration_depth_tier": 4.0,
    "coverage_beyond_tier1_pct": 100.0,
    "traceability_ratio": 1.0,
    "conservation_ratio": 1.0,
    "privacy_leakage": 0.0,
    "double_financing_successes": 0.0,
    "validation_gates_passed": 12.0,
    "validation_gates_total": 12.0
  }
}
```

## Operator API (in `deeptier.core.Ledger`)

| Method | Purpose |
| --- | --- |
| `mint_from_erp_event(MintRequest)` | mint root holding from an ISO 20022 / Peppol payable event |
| `split_and_endorse(cid, amount, recipient)` | conservation-enforced split + propose-accept endorsement |
| `discount_to_financier(cid, rate, financier)` | discount + origination-fee mint (archives source = singularity) |
| `settle_at_maturity(instrument_id)` | atomic allocate-approve-settle of all outstanding tokens |

## Scope / limitations

Research prototype. The Python ledger models the *semantics* the Daml templates
enforce on Canton (it is not a Canton node). The security campaign sizes
(`replay_attempts`, `adversarial_probes`) mirror the experiment; the prototype
runs a bounded real verification proving zero double-financing successes, which
the singularity invariant guarantees independent of attempt count.
