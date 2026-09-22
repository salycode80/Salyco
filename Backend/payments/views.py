"""Customer-facing payment endpoints.

Three views, with deliberately different auth models:

  PaymentStartView    IsAuthenticated — only the cart's owner may spend it
  PaymentCallbackView AllowAny        — Zibal redirects a browser here, so it
                                       cannot require a session. Its authority
                                       comes from the trackId lookup plus a
                                       server-side verify, never from the URL.
  PaymentStatusView   IsAuthenticated — scoped to the caller's own orders
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.shortcuts import redirect
from django.urls import reverse
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.checkout import (
    EMPTY_CART_MESSAGE,
    create_order_from_cart,
    validate_checkout,
)
from orders.models import Cart
from orders.promotions import validate_coupon
from orders.views import _get_customer

from . import settlement, zibal
from .models import MIN_AMOUNT_RIAL, Payment, toman_to_rial

logger = logging.getLogger(__name__)

AMOUNT_TOO_LOW_MESSAGE = "مبلغ سبد خرید برای پرداخت آنلاین کافی نیست."
GATEWAY_UNREACHABLE_MESSAGE = (
    "در حال حاضر امکان اتصال به درگاه پرداخت وجود ندارد. لطفاً چند دقیقه بعد "
    "دوباره تلاش کنید."
)


def callback_url(request) -> str:
    """Absolute URL Zibal sends the customer's browser back to.

    Zibal rejects a callbackUrl that does not start with http/https (result 106),
    so this must be absolute. ZIBAL_CALLBACK_BASE_URL wins when set — needed
    whenever the public origin differs from the one Django sees, e.g. behind
    Caddy. Otherwise the request's own host is correct for the single-origin
    nginx deployment.
    """
    from django.conf import settings

    path = reverse("payment-callback")
    base = (settings.ZIBAL_CALLBACK_BASE_URL or "").rstrip("/")
    if base:
        return f"{base}{path}"
    return request.build_absolute_uri(path)


class PaymentStartView(APIView):
    """POST /api/payments/start/ — create an ONLINE order and open a Zibal session.

    Order-before-payment, deliberately: an abandoned payment then leaves a
    PENDING ONLINE order visible in the admin panel, because a customer who
    reached the bank page and stopped is a sales lead rather than something to
    discard. It also fixes prices in OrderItem.unit_price at redirect time, so a
    discount expiring mid-payment cannot change what the customer owes.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        cart, _ = Cart.objects.get_or_create(customer=_get_customer(request.user))

        if not cart.items.exists():
            return Response(
                {"detail": EMPTY_CART_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
            )

        cleaned, errors = validate_checkout(cart, request.data)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # The cart may have been sitting since yesterday, so the coupon is
        # re-checked here rather than trusted. Clearing it is the point: leaving
        # it applied would make every retry fail the same way with no way out.
        if cart.coupon_id:
            error = validate_coupon(cart.coupon, cart, cart.customer)
            if error:
                cart.coupon = None
                cart.save(update_fields=["coupon", "updated_at"])
                return Response(
                    {"detail": error, "coupon_cleared": True},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        amount_rial = toman_to_rial(cart.total)
        if amount_rial <= MIN_AMOUNT_RIAL:
            # Refused here rather than at the gateway (result 105) so the
            # customer gets a sentence instead of a failed redirect.
            return Response(
                {"detail": AMOUNT_TOO_LOW_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order = create_order_from_cart(cart, cleaned)
            payment = Payment.objects.create(order=order, amount_rial=amount_rial)
            # Cart intentionally not cleared and no SMS sent: nothing is paid yet.

        # Outside the transaction — a slow gateway must not hold a write lock,
        # the same reasoning the settlement step applies to its SMS call.
        ok, data = zibal.request_payment(
            amount_rial=amount_rial,
            callback_url=callback_url(request),
            order_id=str(order.pk),
            description=f"سفارش {order.pk} سالیکو",
            mobile=cleaned["phone_number"],
        )

        result = data.get("result")
        track_id = data.get("trackId")

        if not ok:
            return self._fail(payment, None, GATEWAY_UNREACHABLE_MESSAGE)

        if result != zibal.REQUEST_SUCCESS or not track_id:
            # A 100 with no trackId is nonsense; treating it as success would
            # send the customer to ".../start/None".
            reason = (
                zibal.request_message(result)
                if result != zibal.REQUEST_SUCCESS
                else GATEWAY_UNREACHABLE_MESSAGE
            )
            logger.error(
                "Zibal refused payment for order %s: result=%s message=%r",
                order.pk,
                result,
                data.get("message"),
            )
            return self._fail(payment, result, reason)

        payment.track_id = track_id
        payment.status = Payment.REDIRECTED
        payment.zibal_result = result
        payment.save(update_fields=["track_id", "status", "zibal_result", "updated_at"])

        return Response(
            {
                "payment_url": zibal.start_url(track_id),
                "track_id": track_id,
                "order_id": order.pk,
            },
            status=status.HTTP_201_CREATED,
        )

    def _fail(self, payment: Payment, result: int | None, reason: str) -> Response:
        """Record the refusal and tell the customer. 502, not 400: nothing the
        customer sent was wrong, and the PENDING order stays for staff to see."""
        payment.status = Payment.FAILED
        payment.zibal_result = result
        payment.failure_reason = reason
        payment.save(
            update_fields=["status", "zibal_result", "failure_reason", "updated_at"]
        )
        return Response({"detail": reason}, status=status.HTTP_502_BAD_GATEWAY)


class PaymentCallbackView(APIView):
    """GET /api/payments/callback/ — where Zibal returns the customer.

    Unauthenticated by necessity: Zibal redirects the customer's browser here,
    often on a phone whose session has lapsed, and a login wall in front of
    someone who has just paid would be indefensible. Authority comes from the
    trackId lookup plus the server-side verify in settlement — never from the
    query string, whose `success` and `status` are logged and then ignored.

    Always answers with a 302. A real customer is looking at this URL, so an
    error page or a 500 is never the right response; failures redirect to the
    result page with a Persian explanation.
    """

    permission_classes = [AllowAny]
    # DRF would otherwise try JWT auth on a request that legitimately has none,
    # matching the reasoning on PublicOrderDetailView.
    authentication_classes = []

    def get(self, request):
        raw_track_id = request.query_params.get("trackId") or ""
        reported_success = request.query_params.get("success")
        reported_status = request.query_params.get("status")

        try:
            track_id = int(raw_track_id)
        except (TypeError, ValueError):
            logger.warning("Zibal callback with unusable trackId: %r", raw_track_id)
            return redirect(settlement.result_page_url(settlement.NOT_FOUND, None))

        payment = Payment.objects.filter(track_id=track_id).first()
        if payment is None:
            logger.warning("Zibal callback for unknown trackId %s", track_id)
            return redirect(settlement.result_page_url(settlement.NOT_FOUND, None))

        # Logged for support, deliberately not acted on.
        logger.info(
            "Zibal callback: trackId=%s reported success=%r status=%r (payment %s)",
            track_id,
            reported_success,
            reported_status,
            payment.pk,
        )

        outcome, message = settlement.verify_and_settle(payment)
        payment.refresh_from_db()
        return redirect(settlement.result_page_url(outcome, payment, message))


class PaymentStatusView(APIView):
    """GET /api/payments/<track_id>/status/ — the outcome of one payment.

    Scoped to the caller's own orders, so a guessed trackId reveals nothing: a
    payment belonging to someone else is a 404, not a 403, because "this is not
    yours" and "this does not exist" should be indistinguishable from outside.

    The result page reads this so it can show the truth from the database rather
    than trusting the query string it was redirected with.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, track_id: int):
        customer = getattr(request.user, "customer", None)
        if customer is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        payment = (
            Payment.objects.select_related("order")
            .filter(track_id=track_id, order__customer=customer)
            .first()
        )
        if payment is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "status": payment.status,
                "status_display": payment.get_status_display(),
                "order_id": payment.order_id,
                # Toman, matching every price the UI renders.
                "amount_toman": str(payment.amount_toman),
                "ref_number": payment.ref_number,
                "card_number": payment.card_number,
                "failure_reason": payment.failure_reason,
                "paid_at": payment.paid_at,
            }
        )
