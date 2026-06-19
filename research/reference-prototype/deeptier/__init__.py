"""Deep-tier credit-penetration prototype.

Reference implementation of the winning cross-tier direct-financing token
design: an anchor's confirmed payable is a TransferableFungible holding on
which the anchor is instrument issuer and a signatory of every descendant
token. Splits are conservation-enforced, financing mints an origination fee,
and maturity settlement atomically archives outstanding tokens.

The on-ledger template design this mirrors lives in ``daml/DeepTier.daml``.
"""

from .core import (
    Ledger,
    Holding,
    Fee,
    MintRequest,
    ConservationError,
    SingularityError,
    AuthorizationError,
)
from .simulation import evaluate, monte_carlo_spreads, run_multi_tier_chain

__all__ = [
    "Ledger",
    "Holding",
    "Fee",
    "MintRequest",
    "ConservationError",
    "SingularityError",
    "AuthorizationError",
    "evaluate",
    "monte_carlo_spreads",
    "run_multi_tier_chain",
]

__version__ = "0.1.0"
