"""The one place a payment's outcome is applied.

Both the callback and reconcile_payments must make an identical transition —
"this payment verified, so confirm the order, clear the cart, send the SMS" —
and two copies of that would drift. Same reasoning as orders/checkout.py.

Three properties this module is responsible for, each load-bearing:

  1. Zibal's /v1/verify response is the ONLY thing that can confirm an order.
     The callback's `success` and `status` query parameters are logged and
     otherwise ignored, so a hand-typed ?success=1 confirms nothing.

  2. The verify response's `amount` must equal the amount we stored when the
     payment was created. A mismatch fails the payment and logs at ERROR: money
     may have moved, and a human needs to chase it.

  3. Settlement happens exactly once. `verified_at` is the latch, checked under
     select_for_update. That makes a re-sent callback, a customer refreshing,
     and a concurrent reconcile run all produce one confirmation, one cleared
     cart and one SMS.

Note on the lock: the Zibal HTTP call happens while the payment row is locked,
which can hold it for up to zibal.TIMEOUT_SECONDS. That is intentional — it is
what serialises a duplicate callback against a reconcile run. The lock covers
one payment row, so it cannot block unrelated checkout traffic. Be aware that
select_for_update is a silent no-op on SQLite, so the dev/test database does not
exercise it; `verified_at` is what holds the guarantee everywhere.
"""

from __future__ import annotations

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from orders.models import Cart, CouponRedemption, Order
from orders.notifications import send_order_confirmation

from . import zibal
from .models import Payment

logger = logging.getLogger(__name__)

# Outcomes, which double as the `status` value on the result page URL.
SUCCESS = "success"
FAILED = "failed"
CANCELLED = "cancelled"
PENDING = "pending"
MISMATCH = "mismatch"
NOT_FOUND = "notfound"

MISMATCH_MESSAGE = (
    "مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد. لطفاً با پشتیبانی تماس بگیرید."
)
PENDING_MESSAGE = "وضعیت پرداخت شما در حال بررسی است. نتیجه به‌زودی مشخص می‌شود."


def result_page_url(outcome: str, payment: Payment | None, message: str = "") -> str:
    """Where the customer's browser is sent after the callback.

    Relative when FRONTEND_BASE_URL is unset, which is correct for the
    single-origin deployment where nginx serves the SPA and proxies /api to
    Django. Must stay in step with the /payment/result route in App.jsx.
    """
    params = {"status": outcome}
    if payment is not None:
        params["order"] = payment.order_id
        params["trackId"] = payment.track_id
        if payment.ref_number:
            params["ref"] = payment.ref_number
    if message:
        params["message"] = message

    base = (settings.FRONTEND_BASE_URL or "").rstrip("/")
    return f"{base}/payment/result?{urlencode(params)}"


def verify_and_settle(payment: Payment) -> tuple[str, str]:
    """Verify `payment` with Zibal and apply the outcome. Returns (outcome, message).

    Idempotent: an already-settled payment returns SUCCESS without calling Zibal
    a second time.
    """
    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked.is_settled:
            return SUCCESS, ""

        ok, data = zibal.verify(locked.track_id)

        if not ok:
            # We cannot tell whether money moved. Say so honestly and let
            # reconcile_payments resolve it — writing this off as failed would
            # abandon a paid order.
            locked.status = Payment.PAID_UNVERIFIED
            locked.save(update_fields=["status", "updated_at"])
            payment.refresh_from_db()
            return PENDING, PENDING_MESSAGE

        return _apply(locked, data, from_verify=True)


def settle_from_status(payment: Payment, data: dict) -> tuple[str, str]:
    """Apply an already-fetched /v1/inquiry body to `payment`.

    Used by reconcile_payments, which learns a payment's state from inquiry and
    must apply it through the same code path as the callback.

    NOTE the from_verify=False: an inquiry's `result: 100` only means "a report
    was produced", not "the payment succeeded". See the trap documented in
    zibal.py — passing True here would confirm cancelled orders.
    """
    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked.is_settled:
            return SUCCESS, ""
        return _apply(locked, data, from_verify=False)


def _apply(payment: Payment, data: dict, *, from_verify: bool) -> tuple[str, str]:
    """Transition `payment` (already locked) from a Zibal response body.

    `from_verify` says which endpoint produced `data`, and it is load-bearing:
    /v1/verify's result 100/201 prove the money is ours, while /v1/inquiry's
    result 100 proves only that Zibal understood the question. For an inquiry,
    the payment's state lives entirely in `status`.
    """
    result = data.get("result")
    zibal_status = data.get("status")
    payment.zibal_result = result
    payment.zibal_status = zibal_status

    if from_verify:
        settled = result in (zibal.VERIFY_SUCCESS, zibal.VERIFY_ALREADY_VERIFIED)
    else:
        # Only status 1 means captured AND claimed. An inquiry reporting status 2
        # needs a verify call to claim it — handled below as non-terminal.
        settled = zibal_status == zibal.STATUS_PAID_VERIFIED

    if settled:
        paid_amount = data.get("amount")
        if paid_amount is not None and int(paid_amount) != payment.amount_rial:
            logger.error(
                "Zibal amount mismatch on payment %s (trackId %s): asked %s Rial, "
                "paid %s Rial. Order %s left unconfirmed — money may have moved.",
                payment.pk,
                payment.track_id,
                payment.amount_rial,
                paid_amount,
                payment.order_id,
            )
            payment.status = Payment.FAILED
            payment.failure_reason = MISMATCH_MESSAGE
            payment.save()
            return MISMATCH, MISMATCH_MESSAGE

        return _confirm(payment, data)

    # Not settled. How final that is depends on Zibal's status, not its result.
    if zibal_status == zibal.STATUS_AWAITING_PAYMENT:
        # The customer may still be at the bank. Leave the row alone so
        # reconciliation looks again later.
        payment.save(update_fields=["zibal_result", "zibal_status", "updated_at"])
        return PENDING, PENDING_MESSAGE

    if zibal_status == zibal.STATUS_PAID_UNVERIFIED:
        # Money is captured but not yet claimed, and verify is what claims it.
        # Never terminal: writing this off would abandon a real payment. Park it
        # where reconcile_payments will find it and call verify.
        payment.status = Payment.PAID_UNVERIFIED
        payment.save(
            update_fields=["status", "zibal_result", "zibal_status", "updated_at"]
        )
        return PENDING, PENDING_MESSAGE

    message = zibal.status_message(zibal_status)

    if zibal_status in zibal.REFUND_STATUSES:
        logger.error(
            "Zibal reports payment %s (trackId %s, order %s) as refunded/reversed "
            "(status %s). Money has moved back — check the order.",
            payment.pk,
            payment.track_id,
            payment.order_id,
            zibal_status,
        )

    if zibal_status == zibal.STATUS_CANCELLED_BY_USER:
        # Not an error: the customer chose to stop, and must not be shown one.
        payment.status = Payment.CANCELLED
        payment.failure_reason = message
        payment.save()
        return CANCELLED, message

    payment.status = Payment.FAILED
    payment.failure_reason = message
    payment.save()
    return FAILED, message


def _confirm(payment: Payment, data: dict) -> tuple[str, str]:
    """Money is captured and the amount checks out. Latch, confirm, clear, notify."""
    payment.status = Payment.VERIFIED
    payment.verified_at = timezone.now()
    # paidAt comes from Zibal (ISO 8601) — the bank's record of when the money
    # moved, which can differ from our clock by minutes.
    paid_at = parse_datetime(data.get("paidAt") or "")
    if paid_at is not None:
        payment.paid_at = (
            timezone.make_aware(paid_at) if timezone.is_naive(paid_at) else paid_at
        )
    ref_number = data.get("refNumber")
    payment.ref_number = "" if ref_number is None else str(ref_number)
    payment.card_number = data.get("cardNumber") or ""
    payment.failure_reason = ""
    payment.save()

    order = payment.order
    if order.status != Order.CONFIRMED:
        # Payment is proof the customer committed, so an online order skips the
        # sales call a phone order needs and goes straight to CONFIRMED.
        order.status = Order.CONFIRMED
        order.save(update_fields=["status"])

    if order.coupon_id:
        # One row per paid order. The OneToOneField is what makes this
        # idempotent — and it is load-bearing rather than belt-and-braces:
        # settlement is reachable twice for one payment (the browser callback and
        # a later status inquiry), and the `is_settled` guard that would catch
        # the second one sits behind select_for_update, which this module's own
        # docstring notes is a silent no-op on SQLite. A duplicate redemption
        # would silently spend a second use.
        CouponRedemption.objects.get_or_create(
            order=order,
            defaults={
                "coupon": order.coupon,
                "customer": order.customer,
                "amount": order.discount_amount,
            },
        )

    # The order is paid, so the cart it came from is spent.
    cart = Cart.objects.filter(customer_id=order.customer_id).first()
    if cart is not None:
        cart.items.all().delete()
        # The coupon goes with it. Leaving it applied would show a stale discount
        # on the customer's next, empty cart, and for a once-per-customer code it
        # would only be refused later, at payment time.
        if cart.coupon_id is not None:
            cart.coupon = None
            cart.save(update_fields=["coupon", "updated_at"])

    # After commit, so the order is durable before the SMS goes out and no HTTP
    # request is made with a transaction open. send_order_confirmation carries
    # its own once-per-order latch and is best-effort — a dead SMS gateway must
    # not unwind a real payment.
    transaction.on_commit(lambda: send_order_confirmation(order))

    return SUCCESS, ""
