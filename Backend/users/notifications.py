"""Transactional SMS notifications, sent through the same SMS.ir "verify"
(pattern/template) endpoint the OTP already uses.

Three events, one template each — the IDs live in settings so they can be moved
between the SMS.ir panels for staging and production without a code change:

  * a finished first-time registration   → SMS_IR_TEMPLATE_WELCOME
  * a warranty activation               → SMS_IR_TEMPLATE_WARRANTY
  * a placed order                      → SMS_IR_TEMPLATE_ORDER

Every function here is best-effort and returns a bool instead of raising. That
is the one thing that separates them from send_otp_sms(): an OTP that does not
arrive makes the next step impossible, so RegisterView deletes the account and
returns 503. These three fire *after* the thing they describe has already been
committed, so a dead SMS gateway must not turn a successful registration, a
live warranty or a paid order into an error the user sees. Failures are logged
and swallowed.

Template parameter names are the ones this codebase sends; they must match the
#placeholders# in the SMS.ir template of the same ID. If a template is authored
with different placeholder names, SMS.ir accepts the request and silently drops
the unmatched parameter — so a template edit means editing the dict here too.
"""

from __future__ import annotations

import logging

from django.conf import settings

from .sms_service import get_sms_service

logger = logging.getLogger(__name__)


def _send(event: str, phone_number: str, template_setting: str, parameters: dict) -> bool:
    """Send one template message. Never raises."""
    if not phone_number:
        logger.warning("%s SMS skipped: no phone number", event)
        return False

    template_id = getattr(settings, template_setting, None)
    if not template_id:
        logger.warning("%s SMS skipped: %s not configured", event, template_setting)
        return False

    try:
        service = get_sms_service()
        ok, message = service.send_template(phone_number, int(template_id), parameters)
    except Exception:
        # get_sms_service() raises when the API key is missing; send_template
        # already swallows network errors but not a misconfiguration.
        logger.exception("%s SMS failed for %s", event, phone_number)
        return False

    if not ok:
        logger.error("%s SMS rejected for %s: %s", event, phone_number, message)
    return ok


def send_welcome_sms(phone_number: str, first_name: str = "") -> bool:
    """Sent once, when an account is first created — not on later logins.

    Template 596133 parameters: #PHONE#, #NAME#
    """
    return _send(
        "welcome",
        phone_number,
        "SMS_IR_TEMPLATE_WELCOME",
        {"PHONE": phone_number, "NAME": first_name or "کاربر"},
    )


def send_warranty_activated_sms(
    phone_number: str,
    customer_name: str = "",
    activation_date: str = "",
    activation_time: str = "",
) -> bool:
    """Sent when a product's warranty is activated.

    Template 475048 parameters: #NAME#, #TIME#, #DATE#, #PHONE#
    """
    return _send(
        "warranty",
        phone_number,
        "SMS_IR_TEMPLATE_WARRANTY",
        {
            "NAME": customer_name or "کاربر",
            "TIME": activation_time,
            "DATE": activation_date,
            "PHONE": phone_number,
        },
    )


def send_order_registered_sms(
    phone_number: str,
    customer_name: str = "",
    order_number: str = "",
    order_link: str = "",
) -> bool:
    """Sent when an order is recorded.

    Template 248731 parameters: #NAME#, #ORDER_NUMBER#, #LINK#
    """
    return _send(
        "order",
        phone_number,
        "SMS_IR_TEMPLATE_ORDER",
        {
            "NAME": customer_name or "کاربر",
            "ORDER_NUMBER": order_number,
            "LINK": order_link,
        },
    )
