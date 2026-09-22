"""Checkout logic for the online-payment path.

PaymentStartView is the only way a customer places an order now (the phone-order
path was removed), so these helpers have a single caller — but the rules stay
here rather than inline in the view so they remain testable and separate from
HTTP concerns.

The one thing these helpers deliberately do NOT do is clear the cart. An online
order is not complete until the money is verified, and clearing the cart before
that would strand a customer who abandons the bank page with nothing to return
to. The payment settlement step clears it once the order is confirmed.
"""

from __future__ import annotations

from .models import AllowedLocation, Cart, Order, OrderItem

# Persian messages, keyed by the field they belong to.
REQUIRED_FIELD_MESSAGES = {
    "recipient_name": "نام تحویل‌گیرنده الزامی است.",
    "phone_number": "شماره تماس الزامی است.",
    "province": "لطفاً استان را انتخاب کنید.",
    "city": "لطفاً شهر را وارد کنید.",
    "postal_code": "کد پستی الزامی است.",
    "address": "نشانی کامل الزامی است.",
}

UNSERVICEABLE_AREA_MESSAGE = "متأسفانه ارسال به این منطقه امکان‌پذیر نیست."
EMPTY_CART_MESSAGE = "سبد خرید شما خالی است."


def location_error(province: str, city: str) -> str | None:
    """Business rule: orders are only accepted for admin-defined allowed areas.
    A blank-city allowed row covers the whole province. Returns a Persian error
    message when the area is not serviceable, otherwise None.
    """
    allowed = AllowedLocation.objects.filter(is_active=True, province=province)
    province_wide = allowed.filter(city="").exists()
    city_match = bool(city) and allowed.filter(city=city).exists()
    if province_wide or city_match:
        return None
    return UNSERVICEABLE_AREA_MESSAGE


def validate_checkout(cart: Cart, data: dict) -> tuple[dict, dict]:
    """Normalise and check a checkout payload.

    Returns (cleaned, errors). `errors` is empty when the payload is valid; its
    keys are field names, plus "detail" for whole-form problems, which is the
    shape the frontend's error unwrapping in api/orders.js already reads.
    """
    customer = cart.customer

    province = (data.get("province") or "").strip()
    city = (data.get("city") or "").strip()
    postal_code = (data.get("postal_code") or "").strip()
    address = (data.get("address") or "").strip()
    recipient_name = (data.get("recipient_name") or "").strip() or (
        f"{customer.first_name} {customer.last_name}".strip()
    )
    phone_number = (data.get("phone_number") or "").strip() or customer.phone_number

    cleaned = {
        "recipient_name": recipient_name,
        "phone_number": phone_number,
        "province": province,
        "city": city,
        "postal_code": postal_code,
        "address": address,
    }

    errors = {
        field: message
        for field, message in REQUIRED_FIELD_MESSAGES.items()
        if not cleaned[field]
    }
    if errors:
        return cleaned, errors

    area_error = location_error(province, city)
    if area_error:
        return cleaned, {"detail": area_error}

    return cleaned, {}


def create_order_from_cart(cart: Cart, cleaned: dict) -> Order:
    """Create the Order and its OrderItems from `cart`.

    Must be called inside transaction.atomic(): the order and its items are one
    unit, and an order with no lines is worse than no order.

    Does NOT clear the cart — see the module docstring. The payment settlement
    step does that once the order is confirmed.
    """
    items = list(cart.items.select_related("mattress", "size").all())

    order = Order.objects.create(
        customer=cart.customer,
        method=Order.ONLINE,
        # Payable: the discount is already applied. OrderItem.unit_price stays
        # the per-item price the customer was shown, so the order page can show
        # both the lines and the coupon that reduced them.
        total_amount=cart.total,
        coupon=cart.coupon,
        coupon_code=cart.coupon.code if cart.coupon_id else "",
        discount_amount=cart.discount_amount,
        **cleaned,
    )
    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                mattress=item.mattress,
                # Snapshots, so a historical order stays correct when the
                # product or its sizes are later renamed or repriced.
                mattress_name=item.mattress.name,
                size_label=item.size.label if item.size_id else "",
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in items
        ]
    )
    return order
