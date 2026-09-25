"""Order-side notification helpers.

Kept out of views so the payment settlement step and the admin panel
(AdminOrderDetailView) share one definition of "tell the customer about this
order", including the once-per-order guarantee.
"""

from __future__ import annotations

from django.utils import timezone

from users.notifications import send_order_registered_sms

from .models import Order


def order_public_link_path(order: Order) -> str:
    """Path of the customer-facing order page, *relative to the site root*.

    Deliberately not an absolute URL, unlike get_warranty_public_url() in
    mattress/utils.py. Two SMS.ir pattern-template rules shape this:

      1. A parameter value may not contain a URL, so the origin is baked into
         the approved template body and only the tail is substituted:
         "https://salyco.ir/#LINK#".
      2. A parameter value may be at most 25 characters. "orders/" spends 7 of
         them, which is what fixes generate_order_token() at 18 chars.

    Violating either one makes SMS.ir refuse the send — that is why the order
    SMS never arrived while the OTP and warranty ones did: they carry no link.

    Consequences worth knowing: the origin now lives in the SMS.ir panel, so
    staging cannot retarget this link via FRONTEND_BASE_URL the way the warranty
    QR code can; and this string must stay under 25 characters, so neither the
    "orders/" prefix nor the token can grow without the other shrinking.

    The path carries the order's capability token, not its id — the SMS link is
    opened on phones that are usually not signed in, so the token is what
    authorises the view. Must stay in step with the SPA route in App.jsx.
    """
    return f"orders/{order.public_token}"


def send_order_confirmation(order: Order) -> bool:
    """Send the order SMS for `order`, at most once in its lifetime.

    Called from two places, and the latch — not the caller — is what keeps it to
    one message and one SMS credit per order:

      * The payment settlement step, the moment an online payment is verified.
        This is the normal path.
      * AdminOrderDetailView, when staff move an order to CONFIRMED. A retry
        rather than a second notification: it only does anything if settlement's
        attempt never landed, e.g. the gateway was down at the time.

    A CANCELLED order is the one status that must not notify — an order that was
    cancelled before anything was sent has nothing worth announcing.

    Returns True only when a message was actually accepted, so callers can tell
    "sent just now" from "already sent" / "gateway refused".
    """
    if order.status == Order.CANCELLED:
        return False
    if order.confirmation_sms_sent_at is not None:
        return False

    sent = send_order_registered_sms(
        # Both ONLINE and PHONE orders reach here. phone_number is the delivery
        # contact and is required at checkout for both; customer_phone is the
        # extra sales-call number on PHONE orders, and the account phone is the
        # last resort.
        phone_number=(
            order.phone_number
            or order.customer_phone
            or order.customer.phone_number
        ),
        customer_name=order.recipient_name
        or f"{order.customer.first_name} {order.customer.last_name}".strip(),
        order_number=str(order.pk),
        order_link=order_public_link_path(order),
    )

    if sent:
        # Only latch on success, so a gateway outage doesn't permanently
        # suppress the message — the next save retries it.
        order.confirmation_sms_sent_at = timezone.now()
        order.save(update_fields=["confirmation_sms_sent_at"])

    return sent
