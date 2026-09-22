"""Coupon eligibility and arithmetic.

Pure functions over an already-fetched cart, so every rule is testable without
HTTP. The model layer calls back in here for Cart.discount_amount, which is why
models.py imports this module locally inside that property rather than at module
scope.

This module deliberately does not import the Cart serializer, the views, or
anything else in the request path: it answers questions about a coupon and a
cart, and nothing more.
"""

from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from mattress.models import apply_discount

from .models import CartItem, Coupon, CouponProduct, CouponRedemption, Order

# ── status values ──
STATUS_INACTIVE = "INACTIVE"
STATUS_SCHEDULED = "SCHEDULED"
STATUS_ACTIVE = "ACTIVE"
STATUS_EXPIRED = "EXPIRED"
STATUS_EXHAUSTED = "EXHAUSTED"

# ── messages ──
# Persian, on the server, so the frontend can render {"detail": ...} verbatim.
COUPON_NOT_FOUND_MESSAGE = "کد تخفیف یافت نشد."
INACTIVE_MESSAGE = "این کد تخفیف غیرفعال است."
NOT_STARTED_MESSAGE = "این کد تخفیف هنوز فعال نشده است."
EXPIRED_MESSAGE = "این کد تخفیف منقضی شده است."
NOT_APPLICABLE_MESSAGE = "این کد تخفیف برای محصولات سبد خرید شما معتبر نیست."
USAGE_LIMIT_MESSAGE = "ظرفیت استفاده از این کد تخفیف تکمیل شده است."
PER_CUSTOMER_LIMIT_MESSAGE = "شما پیش‌تر از این کد تخفیف استفاده کرده‌اید."

_FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def _fa_amount(value: Decimal) -> str:
    """Toman with thousands separators in Persian digits.

    Rendered here rather than in the frontend so the minimum-order message is a
    finished sentence the moment it leaves the API.
    """
    return f"{int(value):,}".translate(_FA_DIGITS).replace(",", "٬")


def minimum_order_message(amount: Decimal) -> str:
    return f"این کد تخفیف برای سفارش‌های بالای {_fa_amount(amount)} تومان است."


def eligible_items(coupon: Coupon, cart) -> list[CartItem]:
    """The cart's lines this coupon covers.

    Every line when the coupon is catalogue-wide; otherwise only lines whose
    product is in the coupon's scope.
    """
    items = list(cart.items.all())
    if coupon.applies_to_all_products:
        return items
    allowed = set(
        CouponProduct.objects.filter(coupon=coupon).values_list("mattress_id", flat=True)
    )
    return [item for item in items if item.mattress_id in allowed]


def eligible_subtotal(coupon: Coupon, cart) -> Decimal:
    """What the covered lines add up to, at their current sale prices."""
    return sum((item.line_total for item in eligible_items(coupon, cart)), Decimal("0"))


def redeemed_count(coupon: Coupon) -> int:
    """Uses spent, excluding cancelled orders so cancelling gives the use back."""
    return (
        CouponRedemption.objects.filter(coupon=coupon)
        .exclude(order__status=Order.CANCELLED)
        .count()
    )


def customer_redemption_count(coupon: Coupon, customer) -> int:
    if customer is None:
        return 0
    return (
        CouponRedemption.objects.filter(coupon=coupon, customer=customer)
        .exclude(order__status=Order.CANCELLED)
        .count()
    )


def validate_coupon(coupon: Coupon, cart, customer) -> str | None:
    """The first rule this coupon fails against this cart, or None.

    Ordered most-specific-first so the customer is told the most useful thing
    that is wrong rather than an arbitrary one of several.
    """
    now = timezone.now()

    if not coupon.is_active:
        return INACTIVE_MESSAGE
    if coupon.starts_at and now < coupon.starts_at:
        return NOT_STARTED_MESSAGE
    if coupon.expires_at and now >= coupon.expires_at:
        return EXPIRED_MESSAGE

    subtotal = eligible_subtotal(coupon, cart)
    if subtotal <= 0:
        return NOT_APPLICABLE_MESSAGE
    # Threshold is inclusive: a subtotal exactly equal to the minimum passes.
    # The message reads «بالای X تومان», which is this codebase's rendering of
    # "minimum order X" rather than a strict inequality.
    if subtotal < coupon.min_order_amount:
        return minimum_order_message(coupon.min_order_amount)

    if coupon.usage_limit is not None and redeemed_count(coupon) >= coupon.usage_limit:
        return USAGE_LIMIT_MESSAGE
    if (
        coupon.per_customer_limit is not None
        and customer_redemption_count(coupon, customer) >= coupon.per_customer_limit
    ):
        return PER_CUSTOMER_LIMIT_MESSAGE

    return None


def calculate_discount(coupon: Coupon, cart) -> Decimal:
    """Toman off this cart. Never negative, never more than the eligible lines.

    The final clamp is what guarantees a coupon cannot make the payable amount
    negative, including a fixed amount larger than the eligible subtotal.
    """
    subtotal = eligible_subtotal(coupon, cart)
    if subtotal <= 0:
        return Decimal("0")

    if coupon.discount_type == Coupon.PERCENT:
        # Reuse the product sale's rounding rather than re-deriving it, so a
        # coupon and a product discount round identically.
        discount = subtotal - apply_discount(subtotal, coupon.percent)
        if coupon.max_discount_amount is not None:
            discount = min(discount, coupon.max_discount_amount)
    else:
        discount = coupon.amount

    return max(min(discount, subtotal), Decimal("0"))


def coupon_status(coupon: Coupon) -> str:
    """One label for the admin list, in the same precedence validate_coupon uses."""
    if not coupon.is_active:
        return STATUS_INACTIVE
    now = timezone.now()
    if coupon.starts_at and now < coupon.starts_at:
        return STATUS_SCHEDULED
    if coupon.expires_at and now >= coupon.expires_at:
        return STATUS_EXPIRED
    if coupon.usage_limit is not None and redeemed_count(coupon) >= coupon.usage_limit:
        return STATUS_EXHAUSTED
    return STATUS_ACTIVE
