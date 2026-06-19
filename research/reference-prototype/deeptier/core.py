"""In-memory ledger modelling the Daml Finance deep-tier extension semantics.

This is a research prototype, not a Canton node. It reproduces the *semantics*
that the on-ledger Daml templates enforce (see ``daml/DeepTier.daml``):

* the anchor is a signatory on every descendant holding;
* every split conserves face value (children sum to the parent);
* financing mints an origination-fee holding to the platform;
* a financed/settled token is archived, so it cannot be financed again
  (singularity / exclusive control => no double financing or replay);
* maturity settlement is an atomic allocate-approve-settle of all outstanding
  holdings, and only then is the anchor signatory released.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field


class ConservationError(ValueError):
    """A split or settlement would break face-value conservation."""


class SingularityError(ValueError):
    """A double-financing / replay attempt against an archived token."""


class AuthorizationError(ValueError):
    """The anchor signatory would be dropped outside of settlement."""


@dataclass
class Holding:
    """A TransferableFungible holding of an anchor's confirmed payable."""

    holding_id: str
    instrument_id: str   # anchor confirmed-payable instrument
    anchor: str          # issuer + signatory on EVERY descendant token
    owner: str
    amount: float
    tier: int
    maturity: str
    lineage: tuple = ()                 # provenance chain: (root, ..., self)
    disclosed_to: frozenset = frozenset()  # explicit-disclosure set (no perm. observers)
    is_fee: bool = False
    archived: bool = False


@dataclass
class Fee:
    """An origination-fee holding minted to the platform on financing."""

    holding_id: str
    instrument_id: str
    amount: float
    beneficiary: str


@dataclass
class MintRequest:
    """Typed request backing ``mintFromErpEvent`` (ISO 20022 / Peppol event)."""

    anchor: str
    instrument_id: str
    tier1_supplier: str
    amount: float
    maturity: str


class Ledger:
    """A tiny event-sourced ledger enforcing the extension's invariants."""

    def __init__(self, platform: str = "platform", fee_rate: float = 0.0025) -> None:
        self.platform = platform
        self.fee_rate = fee_rate
        self.holdings: dict[str, Holding] = {}
        self.fees: list[Fee] = []
        self.cash_legs: list[dict] = []
        self.roots: set[str] = set()
        self.face_value: dict[str, float] = {}
        self.settled: set[str] = set()
        self._ids = itertools.count(1)

    # ------------------------------------------------------------------ ids
    def _new_id(self, prefix: str = "h") -> str:
        return f"{prefix}-{next(self._ids):05d}"

    def _live(self, holding_id: str) -> Holding:
        h = self.holdings.get(holding_id)
        if h is None:
            raise KeyError(holding_id)
        if h.archived:
            raise SingularityError(
                f"{holding_id} is archived (double-financing/replay blocked)"
            )
        return h

    # -------------------------------------------------------------- operator API
    def mint_from_erp_event(self, req: MintRequest) -> str:
        """Mint the root tier-1 holding from an approved ERP payable event."""
        if req.amount <= 0:
            raise ConservationError("face value must be positive")
        hid = self._new_id()
        self.holdings[hid] = Holding(
            holding_id=hid,
            instrument_id=req.instrument_id,
            anchor=req.anchor,
            owner=req.tier1_supplier,
            amount=round(req.amount, 2),
            tier=1,
            maturity=req.maturity,
            lineage=(hid,),
            disclosed_to=frozenset({req.anchor, req.tier1_supplier}),
        )
        self.roots.add(hid)
        self.face_value[req.instrument_id] = round(req.amount, 2)
        return hid

    def split_and_endorse(
        self, holding_id: str, amount: float, recipient: str, accept: bool = True
    ) -> tuple[str, str | None]:
        """Propose-accept, conservation-enforced split.

        Endorses ``amount`` down to the next tier (``recipient``) while the
        anchor co-signs every child. Returns ``(child_id, remainder_id)``.
        """
        p = self._live(holding_id)
        if amount <= 0:
            raise ConservationError("split amount must be > 0 (no zero/negative split)")
        if amount > p.amount + 1e-9:
            raise ConservationError("split exceeds parent amount (no split below zero)")
        if not accept:
            raise AuthorizationError("recipient declined the endorsement proposal")

        p.archived = True
        child_id = self._new_id()
        self.holdings[child_id] = Holding(
            holding_id=child_id,
            instrument_id=p.instrument_id,
            anchor=p.anchor,
            owner=recipient,
            amount=round(amount, 2),
            tier=p.tier + 1,
            maturity=p.maturity,
            lineage=p.lineage + (child_id,),
            disclosed_to=frozenset({p.anchor, recipient}),  # bilateral privacy
        )

        remainder_id = None
        rem = round(p.amount - amount, 2)
        if rem > 0:
            remainder_id = self._new_id()
            self.holdings[remainder_id] = Holding(
                holding_id=remainder_id,
                instrument_id=p.instrument_id,
                anchor=p.anchor,
                owner=p.owner,
                amount=rem,
                tier=p.tier,
                maturity=p.maturity,
                lineage=p.lineage + (remainder_id,),
                disclosed_to=frozenset({p.anchor, p.owner}),
            )

        kids = round(amount, 2) + (rem if rem > 0 else 0.0)
        if abs(kids - p.amount) > 0.01:
            raise ConservationError("split broke conservation")
        return child_id, remainder_id

    def discount_to_financier(
        self, holding_id: str, rate: float, financier: str, tenor_days: int = 90
    ) -> tuple[str, float, float]:
        """Sell a holding to a financier at ``rate``.

        Mints an origination-fee holding to the platform and archives the
        source token (exclusive control), so the same receivable cannot be
        financed twice. Returns ``(financier_holding_id, proceeds, fee)``.
        """
        h = self._live(holding_id)
        fee_amt = round(h.amount * self.fee_rate, 2)
        fin_amt = round(h.amount - fee_amt, 2)
        h.archived = True

        fee_id = self._new_id("fee")
        self.holdings[fee_id] = Holding(
            holding_id=fee_id,
            instrument_id=h.instrument_id,
            anchor=h.anchor,
            owner=self.platform,
            amount=fee_amt,
            tier=h.tier,
            maturity=h.maturity,
            lineage=h.lineage + (fee_id,),
            disclosed_to=frozenset({h.anchor, self.platform}),
            is_fee=True,
        )
        self.fees.append(Fee(fee_id, h.instrument_id, fee_amt, self.platform))

        fin_id = self._new_id()
        self.holdings[fin_id] = Holding(
            holding_id=fin_id,
            instrument_id=h.instrument_id,
            anchor=h.anchor,
            owner=financier,
            amount=fin_amt,
            tier=h.tier,
            maturity=h.maturity,
            lineage=h.lineage + (fin_id,),
            disclosed_to=frozenset({h.anchor, financier}),
        )

        proceeds = round(fin_amt * (1.0 - rate * tenor_days / 365.0), 2)
        self.cash_legs.append(
            {"from": financier, "to": h.owner, "amount": proceeds, "kind": "discount"}
        )
        return fin_id, proceeds, fee_amt

    def settle_at_maturity(self, instrument_id: str) -> dict:
        """Atomic allocate-approve-settle of every outstanding holding.

        The anchor funds face value, all live tokens are archived (the anchor
        signatory is released only here), and conservation is re-checked.
        """
        if instrument_id in self.settled:
            raise SingularityError("instrument already settled (replay blocked)")
        face = self.face_value[instrument_id]
        outstanding = [
            h
            for h in self.holdings.values()
            if h.instrument_id == instrument_id and not h.archived
        ]
        total = round(sum(h.amount for h in outstanding), 2)
        if abs(total - face) > 0.01:
            raise ConservationError(f"settlement conservation failed: {total} != {face}")

        legs = []
        for h in outstanding:
            h.archived = True  # anchor signatory removed only at settlement
            legs.append(
                {
                    "from": h.anchor,
                    "to": h.owner,
                    "amount": h.amount,
                    "kind": "fee" if h.is_fee else "principal",
                }
            )
        self.cash_legs.extend(legs)
        self.settled.add(instrument_id)
        return {
            "instrument_id": instrument_id,
            "face_value": face,
            "legs": legs,
            "count": len(legs),
        }

    # ----------------------------------------------------------------- invariants
    def conservation_ratio(self, instrument_id: str) -> float:
        """(sum of live holdings incl. fees) / original face value. Target 1.0."""
        face = self.face_value.get(instrument_id, 0.0)
        live = sum(
            h.amount
            for h in self.holdings.values()
            if h.instrument_id == instrument_id and not h.archived
        )
        return round(live / face, 6) if face else 0.0

    def traceability_ratio(self) -> float:
        """Fraction of holdings whose lineage roots at a minted ERP event."""
        hs = list(self.holdings.values())
        if not hs:
            return 1.0
        traced = sum(1 for h in hs if h.lineage and h.lineage[0] in self.roots)
        return round(traced / len(hs), 6)

    def privacy_leakage(self) -> float:
        """Count holdings disclosed beyond their bilateral/explicit set."""
        leaks = 0
        for h in self.holdings.values():
            allowed = {h.anchor, h.owner, self.platform}
            if h.disclosed_to - allowed:
                leaks += 1
        return float(leaks)

    def penetration_depth(self) -> int:
        """Deepest tier reached by any live or archived holding."""
        return max((h.tier for h in self.holdings.values()), default=0)
