"""Payment records for the Zibal gateway.

One row per *attempt*, not per order. A customer whose card is declined and who
then retries leaves two rows, and the first stays readable — overwriting it
would destroy the record of a real interaction with a bank, which is exactly
what someone reconciling a disputed charge needs to see.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import models

from orders.models import Order

# Zibal rejects amounts at or below this with result 105 ("amount بایستی بزرگتر
# از 1,000 ریال باشد"). Strictly greater: 1000 itself is not payable, so a cart
# of 100 Toman cannot be paid online.
MIN_AMOUNT_RIAL = 1000


def toman_to_rial(amount_toman: Decimal) -> int:
    """Convert a Toman price to the Rial integer Zibal's `amount` expects.

    Every price in this project is Toman — Mattress.price, MattressSize.price,
    Order.total_amount, and the «تومان» suffix rendered throughout the UI. Zibal
    is Rial. int() truncates, which matters because a percentage discount can
    leave two decimal places (1999.99 Toman → 19999 Rial); truncating rounds in
    the customer's favour by at most one Rial, which is the harmless direction.
    """
    return int(amount_toman * 10)


class Payment(models.Model):
    """One attempt to pay one order through Zibal.

    The status values track a state machine spanning three processes — us,
    Zibal, and the customer's bank — so they are not merely decorative:

      INITIATED       row written, Zibal not yet called
      REDIRECTED      Zibal accepted the order; customer is at the gateway
      PAID_UNVERIFIED the callback said paid but verify could not be reached.
                      Money is probably captured. reconcile_payments retries.
      VERIFIED        /v1/verify returned 100 or 201 and the amount matched
      FAILED          terminal failure, or an amount mismatch
      CANCELLED       the customer chose to abort (Zibal status 3)

    PAID_UNVERIFIED is the state that makes reconciliation possible. Without it,
    a verify call lost to a network blip would be indistinguishable from a
    customer who never paid.
    """

    INITIATED = "INITIATED"
    REDIRECTED = "REDIRECTED"
    PAID_UNVERIFIED = "PAID_UNVERIFIED"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (INITIATED, "Initiated"),
        (REDIRECTED, "Redirected to gateway"),
        (PAID_UNVERIFIED, "Paid, not yet verified"),
        (VERIFIED, "Verified"),
        (FAILED, "Failed"),
        (CANCELLED, "Cancelled by customer"),
    ]

    # PROTECT mirrors Order.customer: a paid order must not be deletable out
    # from under the record proving it was paid.
    order = models.ForeignKey(
        Order, on_delete=models.PROTECT, related_name="payments"
    )

    # Exactly what Zibal was asked for, in Rial. Stored rather than recomputed
    # so the verify-time amount comparison compares against a fixed number —
    # a recomputed cart total may have moved while the customer was paying.
    amount_rial = models.BigIntegerField(verbose_name="amount (Rial)")

    # Zibal's payment-session id. Null until /v1/request succeeds, so a refused
    # request leaves a row with no trackId. unique=True with null=True permits
    # many such rows while still rejecting a duplicate real trackId.
    track_id = models.BigIntegerField(
        null=True, blank=True, unique=True, verbose_name="Zibal trackId"
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=INITIATED, db_index=True
    )

    # Raw codes from the last Zibal response, stored untranslated because Zibal
    # support asks for exactly these numbers and a Persian sentence cannot be
    # turned back into one. See the tables in payments/zibal.py.
    zibal_result = models.IntegerField(null=True, blank=True)
    zibal_status = models.IntegerField(null=True, blank=True)

    ref_number = models.CharField(max_length=64, blank=True, default="")
    card_number = models.CharField(max_length=32, blank=True, default="")

    # From Zibal's response, not our clock — it is the bank's record of when the
    # money moved, and the two can differ by minutes.
    paid_at = models.DateTimeField(null=True, blank=True)

    # The idempotency latch. Set exactly once, when the order is confirmed. Both
    # the callback and reconcile_payments check it before doing any work, which
    # is what stops a re-sent callback double-confirming an order, double-
    # clearing a cart or double-sending an SMS. This is the portable guarantee:
    # select_for_update is a no-op on SQLite and only hardens it on PostgreSQL.
    verified_at = models.DateTimeField(null=True, blank=True, editable=False)

    # Persian, ready to display — the customer sees this on the result page.
    failure_reason = models.CharField(max_length=255, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "payment"
        verbose_name_plural = "payments"
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"Payment #{self.pk} for order #{self.order_id} ({self.status})"

    @property
    def is_settled(self) -> bool:
        """True once this payment has confirmed its order. Read this rather than
        comparing status: it is the latch that guarantees the work happened
        exactly once."""
        return self.verified_at is not None

    @property
    def amount_toman(self) -> Decimal:
        """The stored Rial amount back in the unit the UI displays.

        Quantized to two places so it serialises like every other price in this
        API (Order.total_amount, OrderItem.unit_price are DecimalField with
        decimal_places=2) instead of dropping trailing zeros — 20000000 Rial
        should read "2000000.00", not "2000000". Dividing an int by 10 is exact
        at one place, so this never rounds.
        """
        return (Decimal(self.amount_rial) / 10).quantize(Decimal("0.01"))
