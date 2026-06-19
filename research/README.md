# Research

The research behind **DeepTier** — the deep-tier supply-chain finance app in this repo.

The idea, the privacy design, and the validated economics were produced by an autonomous research
pipeline (Thinker) and then turned into a real Canton/Daml + Next.js application. This folder is the
provenance: the paper, the supporting data, and the reference implementation the app was built from.

## Contents

```
research/
├── STEPS.md                       # how the idea was found, the privacy concept, and the build/repro steps
├── paper/
│   ├── deep-tier-credit-penetration.pdf    # the generated research paper (compiled)
│   ├── deep-tier-credit-penetration.tex    # LaTeX source
│   ├── figures/                            # architecture, pipeline, metrics, comparison
│   ├── comparison_report.md                # vs reverse factoring / PO financing / delegate financing
│   ├── execution_plan.json                 # architecture + the 5 validation gates
│   ├── test_results.json                   # gate outcomes
│   └── blog.json                           # plain-language summary
└── reference-prototype/           # Thinker's reference implementation (simulation, not the deployed app)
    ├── daml/DeepTier.daml         # illustrative on-ledger design (adapted into ../../ledger)
    ├── deeptier/                  # Python in-memory ledger encoding the invariants (the test oracle)
    ├── experiment/                # Monte-Carlo benchmark (120k payables, 4 tiers)
    └── tests/
```

> The **shipped** ledger lives in [`../ledger`](../ledger) and the app in [`../web`](../web). The
> reference-prototype here is the research artifact those were derived from — it is a simulation, not
> the deployed system.

## Paper in one line
Model an anchor's confirmed payable as a **divisible, anchor-signed credit token** so financing reaches
tier-2/3/4 SMEs at ~30 bps over the anchor's rate (vs 400–1000+ bps standalone), while Canton
sub-transaction privacy keeps every tier's margin and counterparty confidential and a conservation
invariant makes double-pledging impossible.

## Validation gates (all passed in the paper's experiment)
1. Spread reduction ≥ 200 bps at tier-2/3; deep-tier cost within ~30 bps of the anchor.
2. Penetration to tier-4; ≥ 80% coverage of beyond-tier-1 spend.
3. Traceability = 1.0; conservation holds across 50k split/merge ops.
4. Privacy leakage = 0 across 20k adversarial probes.
5. p99 settlement < 10s; 0 double-financing across 120k replay attempts.
