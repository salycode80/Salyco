"""Client for the Zibal internet payment gateway (IPG).

The wire-format boundary: nothing outside this module knows Zibal's field
names, result codes or status numbers. Contract source is `api-1.json`
(OpenAPI 3.1.1) and `zibal-doc.txt` in the repo root.

Modelled on users/sms_service.py, with one deliberate difference: there is no
cached singleton. get_sms_service() caches the API key at first use, which
makes override_settings() in tests silently ineffective. Reading the merchant
from settings per call costs nothing measurable and keeps the tests honest.

Every function returns (ok, data). `ok` means "Zibal answered with parseable
JSON" — NOT "the payment succeeded". A result of 102 is a real answer, so it
comes back as (True, {"result": 102, ...}); the caller reads `result` and
decides. Network failures return (False, {}) and never raise, so a dead
gateway becomes a Persian message rather than a 500.
"""

from __future__ import annotations

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://gateway.zibal.ir"
TIMEOUT_SECONDS = 15

# Zibal's status table. These describe the PAYMENT's state and are the only
# reliable signal that money was captured — see the warning on result codes
# below. Prefixed STATUS_ to keep them distinct from Payment's own status
# strings, which use some of the same words for different things.
STATUS_AWAITING_PAYMENT = -1
STATUS_PAID_VERIFIED = 1
STATUS_PAID_UNVERIFIED = 2
# Singled out because "the customer pressed cancel" is not a failure and must
# not be reported to them as one.
STATUS_CANCELLED_BY_USER = 3
# Money came back after we may already have treated the order as paid. Rare,
# and always worth a human's attention — see settlement.py.
REFUND_STATUSES = (15, 16, 18)

# ── A trap worth stating plainly ──────────────────────────────────────────────
# `result: 100` does NOT mean the same thing on every endpoint:
#
#   /v1/request  100 = "با موفقیت تایید شد"       (order registered)
#   /v1/verify   100 = "با موفقیت تایید شد"       (payment verified — money ours)
#   /v1/inquiry  100 = "با موفقیت گزارش ایجاد شد" (a REPORT was produced)
#
# So an inquiry answering `result: 100, status: 3` describes a payment the
# customer CANCELLED, reported successfully. Treating that 100 as proof of
# payment would confirm an unpaid order. Only /v1/verify's 100 and 201 prove
# capture; for an inquiry, `status` is the answer and result only says whether
# the question was understood. settlement._apply() takes a from_verify flag for
# exactly this reason.

# Result codes from /v1/verify meaning the payment is ours. 201 is "already
# verified", which is what a retried verify returns — success, not an error.
VERIFY_SUCCESS = 100
VERIFY_ALREADY_VERIFIED = 201
VERIFY_NOT_PAID = 202

REQUEST_SUCCESS = 100

_FALLBACK_MESSAGE = "خطای نامشخص در ارتباط با درگاه پرداخت."

# api-1.json → "جدول کدهای نتیجه درخواست پرداخت". Codes 107-111 and 116 concern
# payment splitting and fee mode, which this integration does not use; they are
# mapped anyway so an unexpected one still reads as a sentence.
REQUEST_RESULT_MESSAGES = {
    100: "درخواست پرداخت با موفقیت ثبت شد.",
    102: "درگاه پرداخت یافت نشد.",
    103: "درگاه پرداخت غیرفعال است.",
    104: "اطلاعات درگاه پرداخت نامعتبر است.",
    105: "مبلغ سفارش برای پرداخت آنلاین کافی نیست.",
    106: "آدرس بازگشت از درگاه پرداخت نامعتبر است.",
    107: "تنظیمات تسهیم درگاه پرداخت نامعتبر است.",
    108: "اطلاعات ذی‌نفعان تسهیم نامعتبر است.",
    109: "یکی از ذی‌نفعان تسهیم غیرفعال است.",
    110: "تنظیمات تسهیم درگاه پرداخت کامل نیست.",
    111: "مبلغ سفارش با مجموع سهم‌های تسهیم برابر نیست.",
    112: "موجودی کیف پول کارمزد کافی نیست.",
    113: "مبلغ سفارش از سقف مجاز تراکنش بیشتر است.",
    114: "کد ملی ارسال‌شده نامعتبر است.",
    115: "دسترسی این سرور به درگاه پرداخت مجاز نیست.",
    116: "تنظیمات کارمزد درگاه پرداخت نامعتبر است.",
}

# api-1.json → "جدول کدهای نتیجه تایید پرداخت"
VERIFY_RESULT_MESSAGES = {
    100: "پرداخت با موفقیت تأیید شد.",
    102: "درگاه پرداخت یافت نشد.",
    103: "درگاه پرداخت غیرفعال است.",
    104: "اطلاعات درگاه پرداخت نامعتبر است.",
    201: "این پرداخت پیش‌تر تأیید شده است.",
    202: "پرداخت انجام نشده یا ناموفق بوده است.",
    203: "شناسه پیگیری پرداخت نامعتبر است.",
}

# api-1.json → "جدول وضعیت‌ها", worded for a customer rather than a developer.
STATUS_MESSAGES = {
    -2: "خطای داخلی درگاه پرداخت.",
    -1: "در انتظار پرداخت.",
    1: "پرداخت انجام و تأیید شد.",
    2: "پرداخت انجام شده و در انتظار تأیید است.",
    3: "پرداخت توسط شما لغو شد.",
    4: "شماره کارت نامعتبر است.",
    5: "موجودی حساب کافی نیست.",
    6: "رمز واردشده اشتباه است.",
    7: "تعداد درخواست‌ها بیش از حد مجاز است.",
    8: "تعداد پرداخت اینترنتی روزانه بیش از حد مجاز است.",
    9: "مبلغ پرداخت اینترنتی روزانه بیش از حد مجاز است.",
    10: "صادرکننده‌ی کارت نامعتبر است.",
    11: "خطای سوییچ بانکی. لطفاً چند دقیقه بعد تلاش کنید.",
    12: "کارت قابل دسترسی نیست.",
    15: "تراکنش استرداد شده است.",
    16: "تراکنش در حال استرداد است.",
    18: "تراکنش برگشت خورده است.",
    21: "پذیرنده نامعتبر است.",
}


def request_message(result: int | None) -> str:
    return REQUEST_RESULT_MESSAGES.get(result, _FALLBACK_MESSAGE)


def verify_message(result: int | None) -> str:
    return VERIFY_RESULT_MESSAGES.get(result, _FALLBACK_MESSAGE)


def status_message(status: int | None) -> str:
    return STATUS_MESSAGES.get(status, _FALLBACK_MESSAGE)


def start_url(track_id: int) -> str:
    """Where the customer's browser must be sent to pay.

    Must be reached by a full-page navigation, not fetch/XHR: Zibal requires a
    `Referer` header whose domain matches the gateway's registered website, and
    refuses to show the payment page without one.
    """
    return f"{BASE_URL}/start/{track_id}"


def _post(path: str, payload: dict) -> tuple[bool, dict]:
    """POST `payload` to `path`. Returns (answered, parsed_body). Never raises."""
    url = f"{BASE_URL}{path}"
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT_SECONDS,
        )
    except requests.RequestException:
        logger.exception("Zibal %s unreachable", path)
        return False, {}

    if response.status_code != 200:
        logger.error(
            "Zibal %s returned HTTP %s: %s", path, response.status_code, response.text
        )
        return False, {}

    try:
        data = response.json()
    except ValueError:
        logger.error("Zibal %s returned a non-JSON body", path)
        return False, {}

    return True, data


def request_payment(
    amount_rial: int,
    callback_url: str,
    order_id: str,
    description: str = "",
    mobile: str = "",
) -> tuple[bool, dict]:
    """Register an order with Zibal. On result 100, `data["trackId"]` is the
    payment session id, and start_url(trackId) is where the customer pays.

    `amount_rial` is Rial, not Toman — see toman_to_rial() in models.py.
    """
    payload = {
        "merchant": settings.ZIBAL_MERCHANT,
        "amount": amount_rial,
        "callbackUrl": callback_url,
        "orderId": order_id,
    }
    # Sent only when non-empty: Zibal reads a blank mobile as a value, and it is
    # the field that makes the customer's saved cards appear on the pay page.
    if description:
        payload["description"] = description
    if mobile:
        payload["mobile"] = mobile
    return _post("/v1/request", payload)


def verify(track_id: int) -> tuple[bool, dict]:
    """Confirm a payment and end its session. THE source of truth for whether
    money was captured — never the callback's query string.

    result 100 = verified now, 201 = verified earlier (also success).
    """
    return _post(
        "/v1/verify",
        {"merchant": settings.ZIBAL_MERCHANT, "trackId": track_id},
    )


def inquiry(track_id: int) -> tuple[bool, dict]:
    """Read a payment session's current state without changing it. That
    read-only property is what makes it safe to poll in reconciliation.

    Careful: this endpoint's `result: 100` means "a report was produced", not
    "the payment succeeded". Read `status`, not `result`.
    """
    return _post(
        "/v1/inquiry",
        {"merchant": settings.ZIBAL_MERCHANT, "trackId": track_id},
    )
