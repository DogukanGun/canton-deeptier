"""CLI metrics emitter for the deep-tier credit-penetration prototype.

Examples
--------
    python -m deeptier.cli                 # emit KPI JSON (20k MC trials)
    python -m deeptier.cli --trials 2000   # faster run
    python -m deeptier.cli --gates         # include per-gate + settlement detail
"""

from __future__ import annotations

import argparse
import json
import sys

from .simulation import DEFAULT_TRIALS, evaluate


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="deeptier",
        description="Benchmark the cross-tier direct-financing token design and "
        "emit per-tier KPIs, invariant checks, and validation gates as JSON.",
    )
    ap.add_argument(
        "--trials",
        type=int,
        default=DEFAULT_TRIALS,
        help=f"Monte-Carlo trials per tier (default {DEFAULT_TRIALS})",
    )
    ap.add_argument(
        "--gates",
        action="store_true",
        help="also print per-gate results and the maturity settlement record",
    )
    args = ap.parse_args(argv)

    metrics, gates, settlement = evaluate(trials=args.trials)
    payload: dict = {"metrics": metrics}
    if args.gates:
        payload["gates"] = gates
        payload["settlement"] = settlement

    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
