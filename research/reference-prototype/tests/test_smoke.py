"""Smoke tests for the deep-tier credit-penetration prototype."""

from deeptier import Ledger, MintRequest, evaluate
from deeptier.core import SingularityError


def test_invariants_and_gates():
    metrics, gates, settlement = evaluate(trials=500)
    # On-ledger invariants hold exactly.
    assert metrics["conservation_ratio"] == 1.0
    assert metrics["traceability_ratio"] == 1.0
    assert metrics["privacy_leakage"] == 0.0
    assert metrics["penetration_depth_tier"] == 4.0
    assert metrics["coverage_beyond_tier1_pct"] == 100.0
    assert metrics["double_financing_successes"] == 0.0
    # Deep tiers finance at a small residual over the anchor.
    assert metrics["deep_tier_cost_gap_to_anchor_bps"] <= 50.0
    assert metrics["tier2_spread_reduction_bps"] > 300.0
    assert metrics["tier4_spread_reduction_bps"] > 800.0
    # All 12 validation gates pass.
    assert metrics["validation_gates_passed"] == metrics["validation_gates_total"] == 12.0
    assert all(gates.values())
    assert settlement["count"] >= 1


def test_singularity_blocks_double_financing():
    led = Ledger()
    h = led.mint_from_erp_event(MintRequest("A", "I1", "S1", 100.0, "2026-12-31"))
    led.discount_to_financier(h, 0.01, "F1")
    try:
        led.discount_to_financier(h, 0.01, "F2")  # archived token -> blocked
    except SingularityError:
        pass
    else:
        raise AssertionError("expected SingularityError on re-financing")
