"""Shared checkout logic for both order paths.

OrderCreateView (phone orders) and PaymentStartView (online orders) must agree
exactly on what a valid checkout is — above all on the allowed-area rule, where
a divergence would mean selling to somewhere the business cannot deliver. So
the rule lives here once and both call it.

The one thing these helpers deliberately do NOT do is clear the cart. That is
the single point where the two callers legitimately differ: a phone order is
complete the moment it is recorded, while an online order is not complete until
the money is verified — and clearing the cart before that would strand a
customer who abandons the bank page with nothing to return to.
"""

from __future__ import annotations

from .models import AllowedLocation, Cart, Order, OrderItem

# Persian messages, keyed by the field they belong to. Kept as data so the two
# callers cannot drift on wording either.
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
INVALID_METHOD_MESSAGE = "روش سفارش نامعتبر است."


def location_error(province: str, city: str) -> str | None:
    """Business rule: orders are only accepted for admin-defined allowed areas.
    A blank-city allowed row covers the whole province. Returns a Persian error
    message when the area is not serviceable, otherwise None.

    Moved here verbatim from OrderCreateView's module-level _location_error so
    the payment path enforces the identical rule.
    """
    allowed = AllowedLocation.objects.filter(is_active=True, province=province)
    province_wide = allowed.filter(city="").exists()
    city_match = bool(city) and allowed.filter(city=city).exists()
    if province_wide or city_match:
        return None
    return UNSERVICEABLE_AREA_MESSAGE


def validate_checkout(cart: Cart, data: dict, method: str) -> tuple[dict, dict]:
    """Normalise and check a checkout payload.

    Returns (cleaned, errors). `errors` is empty when the payload is valid; its
    keys are field names, plus "detail" for whole-form problems, which is the
    shape the frontend's error unwrapping in api/orders.js already reads.

    The checkout form collects the full delivery address before the order method
    is picked, so ONLINE and PHONE carry the same required fields and go through
    the same allowed-area check.
    """
    customer = cart.customer

    customer_phone = (data.get("customer_phone") or "").strip()
    call_time_preference = (data.get("call_time_preference") or "").strip()
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
        # Phone orders are followed up by a sales call, so they always keep a
        # number to ring even when it duplicates phone_number.
        "customer_phone": (customer_phone or phone_number)
        if method == Order.PHONE
        else customer_phone,
        "call_time_preference": call_time_preference,
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


def create_order_from_cart(cart: Cart, cleaned: dict, method: str) -> Order:
    """Create the Order and its OrderItems from `cart`.

    Must be called inside transaction.atomic(): the order and its items are one
    unit, and an order with no lines is worse than no order.

    Does NOT clear the cart — see the module docstring. Callers do that when
    their own definition of "complete" is met.
    """
    items = list(cart.items.select_related("mattress", "size").all())

    order = Order.objects.create(
        customer=cart.customer,
        method=method,
        total_amount=cart.total,
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
