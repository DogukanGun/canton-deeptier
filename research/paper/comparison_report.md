# Comparison Report: deep-tier-credit-penetration

## Our Approach
We built Daml contracts that turn an anchor buyer's confirmed payable into a divisible, endorsable credit token that suppliers split and transfer down the chain, propagating anchor creditworthiness to tier-2, tier-3 and tier-4 SMEs while keeping each bilateral relationship private. It is validated by a numpy Monte-Carlo simulation (not real Daml/Canton) measuring per-tier spread reductions, full traceability, value conservation, and zero privacy leakage.

## Compared Systems
- Linklogis WeChain / Multi-tier Transfer Cloud (commercial splittable digipos across arbitrary tiers)
- PBOC Greater Bay Area Trade Finance Blockchain Platform (central-bank multi-level AR financing)
- Dong, Qiu & Xu MSOM 2022 (academic blockchain deep-tier SCF three-tier game model)

## Strengths
- Privacy-preserving: zero leakage across 20k adversarial probes while still propagating credit
- Deep penetration to tier-4 at near-anchor cost (~30 bps gap), beyond typical 3-4 commercial tiers
- Full traceability and value conservation (1.0); no double-financing or replay successes
- Measurable spread cuts (tier2 420 bps, tier3 719 bps) with tight bootstrap 95% CIs

## Weaknesses
- Evidence is a self-measuring numpy simulation; no real Daml/Canton deployment yet
- Multi-bank funder liquidity and origination-fee economics not empirically validated
- Consortium governance and liquidity risk (Marco Polo cautionary case) untested
- Simulated parameters may overstate spread savings versus live developing-market rates
