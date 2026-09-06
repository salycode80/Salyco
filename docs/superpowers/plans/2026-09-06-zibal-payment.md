# Zibal Payment Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the disabled "خرید آنلاین" button on checkout take real money through Zibal's IPG, and couple the result to the existing order system so a paid order is indistinguishable from a hand-confirmed one.

**Architecture:** A new `payments` Django app owns one `Payment` row per attempt and a thin `zibal.py` wire-format client. Checkout creates the Order as PENDING before redirecting to Zibal; the callback trusts only a server-side `/v1/verify` response, and a `reconcile_payments` command settles anything whose callback never arrived. Order-creation logic is extracted from `OrderCreateView` into `orders/checkout.py` so both the phone and online paths share one definition of a valid checkout.

**Tech Stack:** Django 5 + DRF, `requests`, SQLite (dev/test) / PostgreSQL (production), React + Vite + Tailwind frontend, `unittest.mock.patch` for gateway isolation.

**Spec:** `docs/superpowers/specs/2026-09-06-zibal-payment-design.md`

## Global Constraints

- **Currency:** every price in this project is **Toman**; Zibal's `amount` is **Rial**. `amount_rial = int(total_toman * 10)`, computed once and stored on the `Payment` row.
- **Minimum amount:** Zibal requires `amount` **greater than** 1,000 Rial (`result: 105`). Enforce `amount_rial > 1000` locally, before any HTTP call.
- **Gateway base URL:** `https://gateway.zibal.ir`. Endpoints: `POST /v1/request`, `GET /start/{trackId}`, `POST /v1/verify`, `POST /v1/inquiry`.
- **Never trust the callback query string.** `success` and `status` arrive in the URL and are logged only. Only a server-side `/v1/verify` response decides whether an order is paid.
- **Verify result codes that mean success:** `100` (verified) and `201` (already verified). Both confirm the order.
- **Amount check:** the verify response's `amount` must equal the stored `amount_rial`. A mismatch fails the payment and logs at ERROR.
- **All customer-facing strings are Persian.** No English reaches the UI.
- **Test isolation:** no test may touch the network. Patch at the `payments.zibal` boundary, the way `users/tests.py` patches `send_otp_sms`.
- **Test command** (from `Backend/`): `./env/Scripts/python.exe manage.py test <label> -v 2`
- **`select_for_update` is a no-op on SQLite.** The portable guarantee against double-confirmation is the `verified_at` latch; the row lock hardens it on PostgreSQL only. Never write a test that relies on locking alone.
- **Commit after every task.** Do not batch commits across tasks.

## File Structure

**New — `Backend/payments/`:**

| File | Responsibility |
| :--- | :--- |
| `__init__.py`, `apps.py` | App registration (`PaymentsConfig`, `BigAutoField`) |
| `zibal.py` | The only module that knows Zibal's wire format: HTTP calls, result/status code→Persian maps |
| `models.py` | `Payment` + `toman_to_rial()` + `MIN_AMOUNT_RIAL` |
| `settlement.py` | The shared state transition: verify → confirm order, clear cart, send SMS. Called by both the callback and the reconcile command |
| `views.py` | `PaymentStartView`, `PaymentCallbackView`, `PaymentStatusView` |
| `urls.py`, `admin.py` | Routing; read-only admin over payment rows |
| `tests.py` | All payment tests |
| `migrations/0001_initial.py` | The `Payment` table |
| `management/commands/reconcile_payments.py` | Settles payments whose callback never arrived |

**New — `Backend/orders/checkout.py`:** `validate_checkout()` + `create_order_from_cart()`, extracted from `OrderCreateView` so both checkout paths share them.

**Modified:** `orders/views.py` (thin caller), `core/settings.py` (Zibal config), `core/urls.py` (mount `payments.urls`), `.env.example`, `DEPLOYMENT.md` (cron note).

**Frontend:** new `src/api/payments.js`, new `src/pages/PaymentResult.jsx`; modified `src/pages/checkout/CheckoutOrder.jsx` (enable the button), `src/App.jsx` (one route).

---

### Task 1: Zibal gateway client

**Files:**
- Create: `Backend/payments/__init__.py` (empty), `Backend/payments/apps.py`, `Backend/payments/zibal.py`, `Backend/payments/migrations/__init__.py` (empty), `Backend/payments/tests.py`
- Modify: `Backend/core/settings.py` (add `payments` to `INSTALLED_APPS`; add Zibal config block after the SMS.ir block ending at line 230)
- Modify: `.env.example` (document the two new variables)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `zibal.request_payment(amount_rial: int, callback_url: str, order_id: str, description: str = "", mobile: str = "") -> tuple[bool, dict]`
  - `zibal.verify(track_id: int) -> tuple[bool, dict]`
  - `zibal.inquiry(track_id: int) -> tuple[bool, dict]`
  - `zibal.start_url(track_id: int) -> str`
  - `zibal.request_message(result: int) -> str`, `zibal.verify_message(result: int) -> str`, `zibal.status_message(status: int | None) -> str`
  - In every `(ok, data)` pair, `ok` means **"Zibal returned a parseable JSON response"** — not "the payment succeeded". Callers must inspect `data["result"]`.

- [ ] **Step 1: Create the app scaffolding**

`Backend/payments/__init__.py` and `Backend/payments/migrations/__init__.py` are empty files.

`Backend/payments/apps.py`:

```python
from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "payments"
```

- [ ] **Step 2: Register the app and add settings**

In `Backend/core/settings.py`, add `"payments",` to `INSTALLED_APPS` immediately after `"orders",`.

Then append this block directly after the `SMS_IR_TEMPLATE_ORDER` line (currently line 230):

```python
# ── Zibal payment gateway (IPG) ───────────────────────────────────────────────
# Merchant key from the Zibal panel. "zibal" is the test account documented in
# api-1.json — it exercises the whole flow without moving real money, so it is
# the default and the production key arrives via .env with no code change.
ZIBAL_MERCHANT = os.getenv('ZIBAL_MERCHANT', 'zibal')

# Origin Zibal redirects the customer's browser back to. Must be public HTTPS —
# Zibal drives a real browser to it, so localhost cannot work for an end-to-end
# test. Empty falls back to the request's own host, which is correct for the
# single-origin nginx deployment where /api is proxied to Django.
ZIBAL_CALLBACK_BASE_URL = os.getenv('ZIBAL_CALLBACK_BASE_URL', '')
```

In `.env.example`, after the `FRONTEND_BASE_URL` block:

```
# Zibal payment gateway ------------------------------------------------------
# Merchant key from https://zibal.ir panel. Leave as `zibal` to use Zibal's
# shared test account (full flow, no real money). Set the real key to go live.
ZIBAL_MERCHANT=zibal
# Public HTTPS origin Zibal redirects the customer back to after payment.
# Must be reachable from the open internet — localhost will not work.
# Leave empty to use whatever host served the API request.
ZIBAL_CALLBACK_BASE_URL=https://salyco.ir
```

- [ ] **Step 3: Write the failing tests**

`Backend/payments/tests.py`:

```python
from decimal import Decimal
from unittest.mock import patch

import requests
from django.test import TestCase, override_settings

from . import zibal


class ZibalClientTests(TestCase):
    """The wire-format boundary. Every test patches requests.post — no test in
    this file may touch the network."""

    @override_settings(ZIBAL_MERCHANT="test-merchant")
    @patch("payments.zibal.requests.post")
    def test_request_payment_sends_documented_payload(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "trackId": 15966442233311,
            "result": 100,
            "message": "success",
        }

        ok, data = zibal.request_payment(
            amount_rial=1600000,
            callback_url="https://salyco.ir/api/payments/callback/",
            order_id="42",
            description="سفارش ۴۲",
            mobile="09123456789",
        )

        self.assertTrue(ok)
        self.assertEqual(data["trackId"], 15966442233311)
        url, kwargs = mock_post.call_args[0][0], mock_post.call_args[1]
        self.assertEqual(url, "https://gateway.zibal.ir/v1/request")
        self.assertEqual(
            kwargs["json"],
            {
                "merchant": "test-merchant",
                "amount": 1600000,
                "callbackUrl": "https://salyco.ir/api/payments/callback/",
                "orderId": "42",
                "description": "سفارش ۴۲",
                "mobile": "09123456789",
            },
        )

    @patch("payments.zibal.requests.post")
    def test_optional_fields_are_omitted_when_blank(self, mock_post):
        # Zibal treats an empty description/mobile as a value, not an absence,
        # and a blank mobile suppresses the saved-cards feature it enables.
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"result": 100, "trackId": 1}

        zibal.request_payment(
            amount_rial=20000,
            callback_url="https://salyco.ir/cb",
            order_id="7",
        )

        payload = mock_post.call_args[1]["json"]
        self.assertNotIn("description", payload)
        self.assertNotIn("mobile", payload)

    @patch("payments.zibal.requests.post")
    def test_verify_posts_merchant_and_track_id(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"result": 100, "status": 1}

        ok, data = zibal.verify(15966442233311)

        self.assertTrue(ok)
        self.assertEqual(data["status"], 1)
        self.assertEqual(
            mock_post.call_args[0][0], "https://gateway.zibal.ir/v1/verify"
        )
        self.assertEqual(mock_post.call_args[1]["json"]["trackId"], 15966442233311)

    @patch("payments.zibal.requests.post")
    def test_inquiry_posts_to_its_own_endpoint(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"result": 100, "status": 2}

        ok, data = zibal.inquiry(999)

        self.assertTrue(ok)
        self.assertEqual(
            mock_post.call_args[0][0], "https://gateway.zibal.ir/v1/inquiry"
        )

    @patch("payments.zibal.requests.post", side_effect=requests.Timeout)
    def test_timeout_returns_not_ok_without_raising(self, _mock_post):
        # A dead gateway must never surface as a 500 — the caller decides what
        # the customer sees.
        ok, data = zibal.verify(1)
        self.assertFalse(ok)
        self.assertEqual(data, {})

    @patch("payments.zibal.requests.post")
    def test_non_200_returns_not_ok(self, mock_post):
        mock_post.return_value.status_code = 502
        mock_post.return_value.text = "bad gateway"
        ok, data = zibal.verify(1)
        self.assertFalse(ok)
        self.assertEqual(data, {})

    @patch("payments.zibal.requests.post")
    def test_unparseable_body_returns_not_ok(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.side_effect = ValueError("not json")
        ok, data = zibal.verify(1)
        self.assertFalse(ok)

    @patch("payments.zibal.requests.post")
    def test_ok_is_true_even_when_zibal_rejects_the_request(self, mock_post):
        # ok means "Zibal answered", not "the payment worked". Result 102 is a
        # real answer, and the caller must be the one to read it.
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "result": 102,
            "message": "authentication error",
        }
        ok, data = zibal.request_payment(
            amount_rial=20000, callback_url="https://x/cb", order_id="1"
        )
        self.assertTrue(ok)
        self.assertEqual(data["result"], 102)

    def test_start_url_uses_the_documented_shape(self):
        self.assertEqual(
            zibal.start_url(15966442233311),
            "https://gateway.zibal.ir/start/15966442233311",
        )

    def test_messages_are_persian_for_every_documented_code(self):
        # Codes from api-1.json's tables. An unmapped code must still produce a
        # usable sentence rather than a KeyError in front of a customer.
        for code in (100, 102, 103, 104, 105, 106, 113, 115):
            self.assertTrue(zibal.request_message(code))
        for code in (100, 201, 202, 203):
            self.assertTrue(zibal.verify_message(code))
        for code in (-2, -1, 1, 2, 3, 4, 5, 6, 11, 15, 18, 21):
            self.assertTrue(zibal.status_message(code))
        self.assertTrue(zibal.request_message(9999))
        self.assertTrue(zibal.status_message(None))

    def test_cancelled_by_user_status_is_distinguishable(self):
        # Status 3 must not read as an error — the customer chose to stop.
        self.assertEqual(zibal.STATUS_CANCELLED_BY_USER, 3)

    def test_paid_statuses_are_distinct_from_each_other(self):
        # 1 = captured and claimed; 2 = captured but not yet claimed. Conflating
        # them either abandons money or claims money twice.
        self.assertEqual(zibal.STATUS_PAID_VERIFIED, 1)
        self.assertEqual(zibal.STATUS_PAID_UNVERIFIED, 2)
        self.assertEqual(zibal.STATUS_AWAITING_PAYMENT, -1)
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: FAIL — `ModuleNotFoundError: No module named 'payments.zibal'`

- [ ] **Step 5: Implement the client**

`Backend/payments/zibal.py`:

```python
"""Client for the Zibal internet payment gateway (IPG).

The wire-format boundary: nothing outside this module knows Zibal's field
names, result codes or status numbers. Contract source is `api-1.json`
(OpenAPI 3.1.1) and `zibal-doc.txt` in the repo root.

Modelled on users/sms_service.py, with one deliberate difference: there is no
cached singleton. get_sms_service() caches the API key at first use, which
makes override_settings() in tests silently ineffective. Building a payload
per call costs nothing measurable and keeps the tests honest.

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
    """
    return _post(
        "/v1/inquiry",
        {"merchant": settings.ZIBAL_MERCHANT, "trackId": track_id},
    )
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: PASS, 12 tests.

- [ ] **Step 7: Confirm nothing else broke**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test -v 1`
Expected: the full suite passes (79+ existing tests plus the new 12).

- [ ] **Step 8: Commit**

```bash
git add Backend/payments Backend/core/settings.py .env.example
git commit -m "feat(payments): add Zibal gateway client and configuration"
```

---

### Task 2: Payment model

**Files:**
- Create: `Backend/payments/models.py`, `Backend/payments/admin.py`, `Backend/payments/migrations/0001_initial.py` (generated)
- Modify: `Backend/payments/tests.py` (append `PaymentModelTests`)

**Interfaces:**
- Consumes: `payments.zibal` constants (Task 1).
- Produces:
  - `models.Payment` with class constants `INITIATED`, `REDIRECTED`, `PAID_UNVERIFIED`, `VERIFIED`, `FAILED`, `CANCELLED`
  - Fields: `order`, `amount_rial`, `track_id`, `status`, `zibal_result`, `zibal_status`, `ref_number`, `card_number`, `paid_at`, `verified_at`, `failure_reason`, `created_at`, `updated_at`
  - `models.toman_to_rial(amount_toman: Decimal) -> int`
  - `models.MIN_AMOUNT_RIAL: int` (= 1000; valid amounts are strictly greater)
  - `Payment.is_settled` property → `bool`

- [ ] **Step 1: Write the failing tests**

Append to `Backend/payments/tests.py`:

```python
from django.contrib.auth.models import User
from django.utils import timezone

from orders.models import Order
from users.models import Customer

from .models import MIN_AMOUNT_RIAL, Payment, toman_to_rial


class TomanToRialTests(TestCase):
    """Every price in this project is Toman; Zibal wants Rial. Getting this
    wrong by a factor of ten is the single most expensive bug available here,
    in either direction."""

    def test_converts_toman_to_rial(self):
        self.assertEqual(toman_to_rial(Decimal("1000")), 10000)

    def test_returns_an_int_not_a_decimal(self):
        # Zibal's amount is an int64; a Decimal would serialise as a JSON
        # string and be rejected.
        self.assertIsInstance(toman_to_rial(Decimal("50000")), int)

    def test_truncates_sub_rial_fractions(self):
        # Prices are DecimalField(decimal_places=2), so a discount can produce
        # 1999.99 Toman = 19999.9 Rial. Zibal takes integers only.
        self.assertEqual(toman_to_rial(Decimal("1999.99")), 19999)

    def test_minimum_is_one_thousand_rial(self):
        # api-1.json result 105: "amount بایستی بزرگتر از 1,000 ریال باشد" —
        # strictly greater, so 1000 itself is not payable.
        self.assertEqual(MIN_AMOUNT_RIAL, 1000)
        self.assertFalse(toman_to_rial(Decimal("100")) > MIN_AMOUNT_RIAL)
        self.assertTrue(toman_to_rial(Decimal("101")) > MIN_AMOUNT_RIAL)


class PaymentModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = User.objects.create_user(username="09120000001", password="x")
        cls.customer = Customer.objects.create(
            user=user, first_name="علی", last_name="رضایی", phone_number="09120000001"
        )
        cls.order = Order.objects.create(
            customer=cls.customer, method=Order.ONLINE, total_amount=Decimal("500000")
        )

    def test_defaults_to_initiated_with_no_track_id(self):
        payment = Payment.objects.create(order=self.order, amount_rial=5000000)
        self.assertEqual(payment.status, Payment.INITIATED)
        self.assertIsNone(payment.track_id)
        self.assertIsNone(payment.verified_at)
        self.assertEqual(payment.failure_reason, "")

    def test_track_id_is_unique_when_set(self):
        Payment.objects.create(order=self.order, amount_rial=5000000, track_id=777)
        with self.assertRaises(Exception):
            Payment.objects.create(order=self.order, amount_rial=5000000, track_id=777)

    def test_many_payments_may_share_a_null_track_id(self):
        # A retry after a gateway refusal leaves rows with no trackId. Those must
        # not collide with each other under the unique constraint.
        Payment.objects.create(order=self.order, amount_rial=5000000)
        Payment.objects.create(order=self.order, amount_rial=5000000)
        self.assertEqual(Payment.objects.filter(track_id=None).count(), 2)

    def test_order_keeps_every_attempt(self):
        # One row per attempt, not per order: a declined card followed by a
        # successful retry must leave both records readable.
        Payment.objects.create(order=self.order, amount_rial=5000000, track_id=1)
        Payment.objects.create(order=self.order, amount_rial=5000000, track_id=2)
        self.assertEqual(self.order.payments.count(), 2)

    def test_is_settled_is_true_only_once_verified_at_is_set(self):
        payment = Payment.objects.create(order=self.order, amount_rial=5000000)
        self.assertFalse(payment.is_settled)
        payment.verified_at = timezone.now()
        self.assertTrue(payment.is_settled)

    def test_newest_payment_comes_first(self):
        first = Payment.objects.create(order=self.order, amount_rial=1, track_id=10)
        second = Payment.objects.create(order=self.order, amount_rial=1, track_id=11)
        self.assertEqual(list(Payment.objects.all()), [second, first])
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: FAIL — `ImportError: cannot import name 'Payment' from 'payments.models'`

- [ ] **Step 3: Write the model**

`Backend/payments/models.py`:

```python
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
```

- [ ] **Step 4: Write the admin**

`Backend/payments/admin.py`:

```python
from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Read-only by design. Every field here is either our own record of what we
    sent Zibal or Zibal's record of what happened; hand-editing any of it would
    make the row a fiction while leaving it indistinguishable from evidence.
    Statuses are changed by the callback and reconcile_payments, never by hand.
    """

    list_display = (
        "id",
        "order",
        "status",
        "amount_rial",
        "track_id",
        "zibal_result",
        "zibal_status",
        "ref_number",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("track_id", "ref_number", "order__id")
    readonly_fields = [f.name for f in Payment._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

- [ ] **Step 5: Generate and inspect the migration**

Run: `cd Backend && ./env/Scripts/python.exe manage.py makemigrations payments`
Expected: creates `Backend/payments/migrations/0001_initial.py`.

Open it and confirm `track_id` carries both `null=True` and `unique=True`, and that `status` has `db_index=True`. If either is missing, the model was edited after generation — delete the file and regenerate.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: PASS, 22 tests (12 from Task 1 + 10 new).

- [ ] **Step 7: Verify the migration applies cleanly**

Run: `cd Backend && ./env/Scripts/python.exe manage.py migrate`
Expected: `Applying payments.0001_initial... OK`

- [ ] **Step 8: Commit**

```bash
git add Backend/payments
git commit -m "feat(payments): add Payment model, admin and Toman/Rial conversion"
```

---

### Task 3: Extract shared checkout logic

**Why this task exists:** `OrderCreateView.post` (`Backend/orders/views.py:145-242`) holds cart-empty checking, field normalisation, the six required-field check, the `_location_error` allowed-area rule, and order+item creation — all inline. The payment path needs every one of them, identically. Duplicating would let the two paths drift, most damagingly on the allowed-area rule, where divergence means selling to a place the business cannot deliver to.

**This task must not change any behaviour.** Its gate is that the existing suite passes untouched.

**Files:**
- Create: `Backend/orders/checkout.py`
- Modify: `Backend/orders/views.py` (replace the body of `OrderCreateView.post`; move `_location_error` into `checkout.py`)
- Modify: `Backend/orders/tests.py` (create — the app has no test file yet; add `CheckoutHelperTests`)

**Interfaces:**
- Consumes: `orders.models.{Cart, Order, OrderItem, AllowedLocation}`.
- Produces:
  - `checkout.validate_checkout(cart, data: dict, method: str) -> tuple[dict, dict]` → `(cleaned, errors)`. `errors` empty means valid. `cleaned` keys: `recipient_name`, `phone_number`, `customer_phone`, `call_time_preference`, `province`, `city`, `postal_code`, `address`.
  - `checkout.create_order_from_cart(cart, cleaned: dict, method: str) -> Order` — creates the Order and its OrderItems. **Does not clear the cart**, and must be called inside `transaction.atomic()`.
  - `checkout.location_error(province: str, city: str) -> str | None`

- [ ] **Step 1: Write the failing tests**

Create `Backend/orders/tests.py`:

```python
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from mattress.models import Mattress, MattressSize
from users.models import Customer

from .checkout import create_order_from_cart, location_error, validate_checkout
from .models import AllowedLocation, Cart, CartItem, Order

VALID_FORM = {
    "recipient_name": "علی رضایی",
    "phone_number": "09121112233",
    "province": "تهران",
    "city": "تهران",
    "postal_code": "1234567890",
    "address": "خیابان آزادی، پلاک ۱۲، واحد ۳",
}


class CheckoutHelperTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        AllowedLocation.objects.create(province="تهران", city="", is_active=True)
        cls.mattress = Mattress.objects.create(
            name="تشک ابری",
            description="تشک طبی",
            slug="abri",
            warranty_months=120,
            price=Decimal("2000000"),
        )
        cls.size = MattressSize.objects.create(
            mattress=cls.mattress, label="۱۶۰×۲۰۰", price=Decimal("2500000")
        )

    def setUp(self):
        user = User.objects.create_user(username="09121112233", password="x")
        self.customer = Customer.objects.create(
            user=user, first_name="علی", last_name="رضایی", phone_number="09121112233"
        )
        self.cart = Cart.objects.create(customer=self.customer)
        CartItem.objects.create(
            cart=self.cart, mattress=self.mattress, size=self.size, quantity=2
        )

    def test_valid_form_produces_no_errors(self):
        cleaned, errors = validate_checkout(self.cart, dict(VALID_FORM), Order.ONLINE)
        self.assertEqual(errors, {})
        self.assertEqual(cleaned["recipient_name"], "علی رضایی")

    def test_every_required_field_is_reported_in_persian(self):
        cleaned, errors = validate_checkout(self.cart, {}, Order.ONLINE)
        for field in (
            "recipient_name",
            "phone_number",
            "province",
            "city",
            "postal_code",
            "address",
        ):
            self.assertIn(field, errors)
            self.assertTrue(errors[field])

    def test_recipient_name_falls_back_to_the_profile(self):
        data = dict(VALID_FORM, recipient_name="")
        cleaned, errors = validate_checkout(self.cart, data, Order.ONLINE)
        self.assertEqual(errors, {})
        self.assertEqual(cleaned["recipient_name"], "علی رضایی")

    def test_phone_number_falls_back_to_the_profile(self):
        data = dict(VALID_FORM, phone_number="")
        cleaned, errors = validate_checkout(self.cart, data, Order.ONLINE)
        self.assertEqual(cleaned["phone_number"], "09121112233")

    def test_unserviceable_area_is_rejected(self):
        data = dict(VALID_FORM, province="یزد", city="یزد")
        cleaned, errors = validate_checkout(self.cart, data, Order.ONLINE)
        self.assertIn("detail", errors)

    def test_phone_order_gets_a_contact_number_even_when_not_supplied(self):
        # A phone order is followed up by a sales call, so it must always carry a
        # number to call — falling back to the delivery contact.
        cleaned, _ = validate_checkout(self.cart, dict(VALID_FORM), Order.PHONE)
        self.assertEqual(cleaned["customer_phone"], "09121112233")

    def test_online_order_does_not_invent_a_contact_number(self):
        cleaned, _ = validate_checkout(self.cart, dict(VALID_FORM), Order.ONLINE)
        self.assertEqual(cleaned["customer_phone"], "")

    def test_create_order_snapshots_items_and_total(self):
        cleaned, _ = validate_checkout(self.cart, dict(VALID_FORM), Order.ONLINE)
        order = create_order_from_cart(self.cart, cleaned, Order.ONLINE)

        self.assertEqual(order.method, Order.ONLINE)
        self.assertEqual(order.status, Order.PENDING)
        self.assertEqual(order.items.count(), 1)
        item = order.items.first()
        self.assertEqual(item.mattress_name, "تشک ابری")
        self.assertEqual(item.size_label, "۱۶۰×۲۰۰")
        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.unit_price, Decimal("2500000"))
        self.assertEqual(order.total_amount, Decimal("5000000"))

    def test_create_order_leaves_the_cart_alone(self):
        # The two callers differ on exactly this point: a phone order is complete
        # on creation, an online order is not complete until it is paid. So the
        # helper never clears; each caller decides when.
        cleaned, _ = validate_checkout(self.cart, dict(VALID_FORM), Order.ONLINE)
        create_order_from_cart(self.cart, cleaned, Order.ONLINE)
        self.assertEqual(self.cart.items.count(), 1)

    def test_location_error_accepts_a_province_wide_row(self):
        self.assertIsNone(location_error("تهران", "شهریار"))

    def test_location_error_rejects_an_unlisted_province(self):
        self.assertIsNotNone(location_error("یزد", "یزد"))

    def test_location_error_accepts_a_specific_city_row(self):
        AllowedLocation.objects.create(province="فارس", city="شیراز", is_active=True)
        self.assertIsNone(location_error("فارس", "شیراز"))
        self.assertIsNotNone(location_error("فارس", "مرودشت"))

    def test_inactive_rows_do_not_grant_service(self):
        AllowedLocation.objects.create(province="گیلان", city="", is_active=False)
        self.assertIsNotNone(location_error("گیلان", "رشت"))


class OrderCreateViewRegressionTests(TestCase):
    """The refactor must not change the phone-order path. These assert the
    behaviour that existed before it."""

    @classmethod
    def setUpTestData(cls):
        AllowedLocation.objects.create(province="تهران", city="", is_active=True)
        cls.mattress = Mattress.objects.create(
            name="تشک ابری",
            description="تشک طبی",
            slug="abri",
            warranty_months=120,
            price=Decimal("2000000"),
        )

    def setUp(self):
        self.user = User.objects.create_user(username="09121112233", password="x")
        self.customer = Customer.objects.create(
            user=self.user, first_name="علی", last_name="رضایی",
            phone_number="09121112233",
        )
        self.cart = Cart.objects.create(customer=self.customer)
        CartItem.objects.create(cart=self.cart, mattress=self.mattress, quantity=1)
        self.client.force_login(self.user)

    def _post(self, **overrides):
        payload = dict(VALID_FORM, method=Order.PHONE, **overrides)
        return self.client.post("/api/orders/", payload)

    def test_phone_order_is_created_and_the_cart_is_cleared(self):
        with patch("orders.views.send_order_confirmation", return_value=True):
            response = self._post()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(self.cart.items.count(), 0)

    def test_empty_cart_is_rejected(self):
        self.cart.items.all().delete()
        response = self._post()
        self.assertEqual(response.status_code, 400)
        self.assertIn("سبد خرید", response.json()["detail"])

    def test_invalid_method_is_rejected(self):
        response = self._post(method="TELEPATHY")
        self.assertEqual(response.status_code, 400)

    def test_unserviceable_area_is_rejected(self):
        response = self._post(province="یزد", city="یزد")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_confirmation_sms_is_attempted_once(self):
        with patch("orders.views.send_order_confirmation", return_value=True) as sms:
            self._post()
        self.assertEqual(sms.call_count, 1)
```

Add `from unittest.mock import patch` to the imports at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders -v 2`
Expected: FAIL — `ModuleNotFoundError: No module named 'orders.checkout'`

- [ ] **Step 3: Write the checkout module**

Create `Backend/orders/checkout.py`:

```python
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
```

- [ ] **Step 4: Rewrite OrderCreateView as a thin caller**

In `Backend/orders/views.py`: delete the module-level `_location_error` function (lines 44-53) and replace the whole `OrderCreateView` class with:

```python
class OrderCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        cart = _get_cart(request.user)
        if not cart.items.exists():
            return Response(
                {"detail": EMPTY_CART_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
            )

        method = request.data.get("method")
        if method not in (Order.ONLINE, Order.PHONE):
            return Response(
                {"detail": "روش سفارش نامعتبر است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cleaned, errors = validate_checkout(cart, request.data, method)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            order = create_order_from_cart(cart, cleaned, method)
            # A phone order is complete the moment it is recorded, so its cart
            # clears here. The online path clears only after payment verifies.
            cart.items.all().delete()

        # Tell the customer their order is in. Sent after the atomic block has
        # committed, so the order is durable before the SMS goes out and the
        # request is not made while a transaction is open. Best-effort: a dead
        # gateway must not fail an order that is already recorded — and if it
        # does fail here, confirming the order in the admin panel retries it.
        send_order_confirmation(order)

        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
```

Update the imports at the top of `orders/views.py`:

```python
from .checkout import EMPTY_CART_MESSAGE, create_order_from_cart, validate_checkout
```

and drop `AllowedLocation` from the `.models` import only if nothing else in the file still uses it — `AllowedLocationPublicView` does, so keep it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders -v 2`
Expected: PASS, 18 tests.

- [ ] **Step 6: Confirm the refactor changed nothing elsewhere**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test -v 1`
Expected: the whole suite passes. Any failure in `mattress` or `users` means the refactor altered shared behaviour — fix it rather than adjusting the test.

- [ ] **Step 7: Commit**

```bash
git add Backend/orders
git commit -m "refactor(orders): extract checkout validation and order creation

Both the phone path and the coming online-payment path need identical
validation, above all the allowed-area rule. One definition, two callers.
create_order_from_cart deliberately does not clear the cart — that is the
one point where the two paths legitimately differ."
```

---

### Task 4: Start a payment

**Files:**
- Create: `Backend/payments/views.py`, `Backend/payments/urls.py`
- Modify: `Backend/core/urls.py` (mount `payments.urls` under `api/`)
- Modify: `Backend/payments/tests.py` (append `PaymentStartViewTests`)

**Interfaces:**
- Consumes: `orders.checkout.{validate_checkout, create_order_from_cart, EMPTY_CART_MESSAGE}`, `payments.models.{Payment, toman_to_rial, MIN_AMOUNT_RIAL}`, `payments.zibal`.
- Produces:
  - `POST /api/payments/start/` (name `payment-start`), `IsAuthenticated`. Success 201: `{"payment_url": str, "track_id": int, "order_id": int}`.
  - `views.callback_url(request) -> str` — absolute URL Zibal posts back to; reused by Task 5's tests.
  - `views.AMOUNT_TOO_LOW_MESSAGE: str`

- [ ] **Step 1: Write the failing tests**

Append to `Backend/payments/tests.py`:

```python
from mattress.models import Mattress
from orders.models import AllowedLocation, Cart, CartItem

CHECKOUT_FORM = {
    "recipient_name": "علی رضایی",
    "phone_number": "09121112233",
    "province": "تهران",
    "city": "تهران",
    "postal_code": "1234567890",
    "address": "خیابان آزادی، پلاک ۱۲، واحد ۳",
}


class PaymentStartViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        AllowedLocation.objects.create(province="تهران", city="", is_active=True)
        cls.mattress = Mattress.objects.create(
            name="تشک ابری",
            description="تشک طبی",
            slug="abri",
            warranty_months=120,
            price=Decimal("2000000"),
        )

    def setUp(self):
        self.user = User.objects.create_user(username="09121112233", password="x")
        self.customer = Customer.objects.create(
            user=self.user, first_name="علی", last_name="رضایی",
            phone_number="09121112233",
        )
        self.cart = Cart.objects.create(customer=self.customer)
        CartItem.objects.create(cart=self.cart, mattress=self.mattress, quantity=1)
        self.client.force_login(self.user)

    def _start(self, **overrides):
        return self.client.post("/api/payments/start/", dict(CHECKOUT_FORM, **overrides))

    def _accepted(self, track_id=15966442233311):
        return True, {"result": 100, "trackId": track_id, "message": "success"}

    @patch("payments.views.zibal.request_payment")
    def test_creates_pending_order_and_returns_the_gateway_url(self, mock_request):
        mock_request.return_value = self._accepted()

        response = self._start()

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(
            body["payment_url"], "https://gateway.zibal.ir/start/15966442233311"
        )
        self.assertEqual(body["track_id"], 15966442233311)

        order = Order.objects.get()
        self.assertEqual(order.method, Order.ONLINE)
        self.assertEqual(order.status, Order.PENDING)
        self.assertEqual(order.total_amount, Decimal("2000000"))

        payment = Payment.objects.get()
        self.assertEqual(payment.order, order)
        self.assertEqual(payment.status, Payment.REDIRECTED)
        self.assertEqual(payment.track_id, 15966442233311)
        # 2,000,000 Toman = 20,000,000 Rial
        self.assertEqual(payment.amount_rial, 20000000)

    @patch("payments.views.zibal.request_payment")
    def test_cart_survives_until_payment_is_verified(self, mock_request):
        # The customer has not paid yet. Clearing here would strand anyone who
        # abandons the bank page.
        mock_request.return_value = self._accepted()
        self._start()
        self.assertEqual(self.cart.items.count(), 1)

    @patch("payments.views.zibal.request_payment")
    def test_no_sms_is_sent_before_payment(self, mock_request):
        mock_request.return_value = self._accepted()
        with patch("orders.notifications.send_order_registered_sms") as sms:
            self._start()
        sms.assert_not_called()

    @patch("payments.views.zibal.request_payment")
    def test_amount_and_mobile_are_sent_to_zibal(self, mock_request):
        mock_request.return_value = self._accepted()
        self._start()
        kwargs = mock_request.call_args[1]
        self.assertEqual(kwargs["amount_rial"], 20000000)
        self.assertEqual(kwargs["mobile"], "09121112233")
        self.assertTrue(kwargs["callback_url"].endswith("/api/payments/callback/"))
        self.assertTrue(kwargs["callback_url"].startswith("http"))
        self.assertEqual(kwargs["order_id"], str(Order.objects.get().pk))

    @patch("payments.views.zibal.request_payment")
    def test_gateway_refusal_fails_the_payment_and_keeps_the_order(self, mock_request):
        # Result 102 = merchant not found. The order stays PENDING so staff can
        # see that a customer tried and the gateway was misconfigured.
        mock_request.return_value = (True, {"result": 102, "message": "auth error"})

        response = self._start()

        self.assertEqual(response.status_code, 502)
        self.assertTrue(response.json()["detail"])
        payment = Payment.objects.get()
        self.assertEqual(payment.status, Payment.FAILED)
        self.assertEqual(payment.zibal_result, 102)
        self.assertTrue(payment.failure_reason)
        self.assertIsNone(payment.track_id)
        self.assertEqual(Order.objects.get().status, Order.PENDING)
        self.assertEqual(self.cart.items.count(), 1)

    @patch("payments.views.zibal.request_payment", return_value=(False, {}))
    def test_unreachable_gateway_fails_loudly(self, _mock_request):
        # Unlike the SMS calls, this is not best-effort: telling a customer to
        # pay when the gateway never accepted the order would be a lie.
        response = self._start()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(Payment.objects.get().status, Payment.FAILED)

    @patch("payments.views.zibal.request_payment")
    def test_missing_track_id_is_treated_as_a_refusal(self, mock_request):
        # result 100 with no trackId is nonsense, but a nonsense response must
        # not produce a redirect URL ending in "None".
        mock_request.return_value = (True, {"result": 100})
        response = self._start()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(Payment.objects.get().status, Payment.FAILED)

    def test_empty_cart_is_rejected_before_any_gateway_call(self):
        self.cart.items.all().delete()
        with patch("payments.views.zibal.request_payment") as mock_request:
            response = self._start()
        self.assertEqual(response.status_code, 400)
        mock_request.assert_not_called()
        self.assertEqual(Payment.objects.count(), 0)

    def test_invalid_form_is_rejected_before_any_gateway_call(self):
        with patch("payments.views.zibal.request_payment") as mock_request:
            response = self._start(postal_code="", address="")
        self.assertEqual(response.status_code, 400)
        self.assertIn("postal_code", response.json())
        mock_request.assert_not_called()
        self.assertEqual(Order.objects.count(), 0)

    def test_unserviceable_area_is_rejected_before_any_gateway_call(self):
        with patch("payments.views.zibal.request_payment") as mock_request:
            response = self._start(province="یزد", city="یزد")
        self.assertEqual(response.status_code, 400)
        mock_request.assert_not_called()
        self.assertEqual(Order.objects.count(), 0)

    def test_amount_at_or_below_the_zibal_floor_is_rejected_locally(self):
        # Zibal refuses amounts not greater than 1,000 Rial (result 105). 100
        # Toman is exactly 1,000 Rial, so it must fail here, not at the gateway.
        cheap = Mattress.objects.create(
            name="نمونه", description="نمونه", slug="cheap",
            warranty_months=1, price=Decimal("100"),
        )
        self.cart.items.all().delete()
        CartItem.objects.create(cart=self.cart, mattress=cheap, quantity=1)

        with patch("payments.views.zibal.request_payment") as mock_request:
            response = self._start()

        self.assertEqual(response.status_code, 400)
        mock_request.assert_not_called()
        self.assertEqual(Order.objects.count(), 0)

    def test_anonymous_users_cannot_start_a_payment(self):
        self.client.logout()
        response = self._start()
        self.assertIn(response.status_code, (401, 403))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: FAIL — 404s, because `/api/payments/start/` is not routed yet.

- [ ] **Step 3: Write the view**

Create `Backend/payments/views.py`:

```python
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
from django.urls import reverse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.checkout import (
    EMPTY_CART_MESSAGE,
    create_order_from_cart,
    validate_checkout,
)
from orders.models import Cart, Order
from orders.views import _get_customer

from . import zibal
from .models import MIN_AMOUNT_RIAL, Payment, toman_to_rial

logger = logging.getLogger(__name__)

AMOUNT_TOO_LOW_MESSAGE = "مبلغ سبد خرید برای پرداخت آنلاین کافی نیست."
GATEWAY_UNREACHABLE_MESSAGE = (
    "در حال حاضر امکان اتصال به درگاه پرداخت وجود ندارد. لطفاً چند دقیقه بعد "
    "دوباره تلاش کنید یا سفارش تلفنی ثبت کنید."
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

        cleaned, errors = validate_checkout(cart, request.data, Order.ONLINE)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        amount_rial = toman_to_rial(cart.total)
        if amount_rial <= MIN_AMOUNT_RIAL:
            # Refused here rather than at the gateway (result 105) so the
            # customer gets a sentence instead of a failed redirect.
            return Response(
                {"detail": AMOUNT_TOO_LOW_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order = create_order_from_cart(cart, cleaned, Order.ONLINE)
            payment = Payment.objects.create(order=order, amount_rial=amount_rial)
            # Cart intentionally not cleared and no SMS sent: nothing is paid yet.

        # Outside the transaction — a slow gateway must not hold a write lock,
        # the same reasoning the phone path applies to its SMS call.
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
```

- [ ] **Step 4: Route it**

Create `Backend/payments/urls.py`:

```python
from django.urls import path

from . import views

urlpatterns = [
    path("payments/start/", views.PaymentStartView.as_view(), name="payment-start"),
    # Zibal redirects the customer's browser here. Unauthenticated by necessity —
    # see PaymentCallbackView.
    path(
        "payments/callback/",
        views.PaymentCallbackView.as_view(),
        name="payment-callback",
    ),
]
```

`PaymentCallbackView` arrives in Task 5. To keep this task's tests runnable, add a placeholder at the end of `views.py` now and replace it in Task 5:

```python
class PaymentCallbackView(APIView):
    """Implemented in Task 5. Routed now so reverse("payment-callback") resolves,
    which PaymentStartView needs to build its callbackUrl."""

    permission_classes = [IsAuthenticated]
```

In `Backend/core/urls.py`, add after the `orders.urls` include:

```python
    path("api/", include("payments.urls")),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: PASS, 34 tests (22 + 12 new).

- [ ] **Step 6: Commit**

```bash
git add Backend/payments Backend/core/urls.py
git commit -m "feat(payments): add POST /api/payments/start/

Creates a PENDING ONLINE order plus a Payment row, then opens a Zibal
session. Cart is not cleared and no SMS is sent — nothing is paid yet. A
gateway refusal fails loudly with 502 rather than best-effort, because
telling a customer to pay when the gateway refused the order would be a lie."
```

---

### Task 5: Settlement and the callback

**The core of the feature.** Everything that makes a payment trustworthy lives here: verify-as-only-truth, the amount check, and idempotency.

**Files:**
- Create: `Backend/payments/settlement.py`
- Modify: `Backend/payments/views.py` (replace the `PaymentCallbackView` placeholder)
- Modify: `Backend/payments/tests.py` (append `SettlementTests` and `PaymentCallbackViewTests`)

**Interfaces:**
- Consumes: `payments.zibal`, `payments.models.Payment`, `orders.notifications.send_order_confirmation`, `orders.models.{Order, Cart}`.
- Produces:
  - `settlement.verify_and_settle(payment: Payment) -> tuple[str, str]` → `(outcome, message)`. Calls Zibal verify, applies the result. Idempotent.
  - `settlement.settle_from_status(payment: Payment, data: dict) -> tuple[str, str]` — apply an already-fetched verify/inquiry body. Used by Task 7's reconciliation.
  - Outcome constants: `settlement.{SUCCESS, FAILED, CANCELLED, PENDING, MISMATCH}` (values `"success"`, `"failed"`, `"cancelled"`, `"pending"`, `"mismatch"`).
  - `settlement.result_page_url(outcome: str, payment: Payment | None, message: str = "") -> str`
  - `GET /api/payments/callback/` (name `payment-callback`), `AllowAny`, always a 302.

- [ ] **Step 1: Write the failing tests**

Append to `Backend/payments/tests.py`:

```python
from urllib.parse import parse_qs, urlparse

from . import settlement


class SettlementMixin:
    """Shared fixture: one ONLINE order of 2,000,000 Toman with a REDIRECTED
    payment of 20,000,000 Rial, and a cart still holding its item."""

    @classmethod
    def setUpTestData(cls):
        AllowedLocation.objects.create(province="تهران", city="", is_active=True)
        cls.mattress = Mattress.objects.create(
            name="تشک ابری", description="تشک طبی", slug="abri",
            warranty_months=120, price=Decimal("2000000"),
        )

    def setUp(self):
        self.user = User.objects.create_user(username="09121112233", password="x")
        self.customer = Customer.objects.create(
            user=self.user, first_name="علی", last_name="رضایی",
            phone_number="09121112233",
        )
        self.cart = Cart.objects.create(customer=self.customer)
        CartItem.objects.create(cart=self.cart, mattress=self.mattress, quantity=1)
        self.order = Order.objects.create(
            customer=self.customer,
            method=Order.ONLINE,
            status=Order.PENDING,
            recipient_name="علی رضایی",
            phone_number="09121112233",
            province="تهران", city="تهران",
            postal_code="1234567890", address="خیابان آزادی",
            total_amount=Decimal("2000000"),
        )
        self.payment = Payment.objects.create(
            order=self.order,
            amount_rial=20000000,
            track_id=15966442233311,
            status=Payment.REDIRECTED,
        )

    def verified_body(self, **overrides):
        return dict(
            {
                "result": 100,
                "status": 1,
                "amount": 20000000,
                "refNumber": 987654,
                "cardNumber": "62741****44",
                "paidAt": "2026-09-06T14:18:21.742000",
                "orderId": "1",
                "message": "success",
            },
            **overrides,
        )


class SettlementTests(SettlementMixin, TestCase):
    @patch("payments.settlement.zibal.verify")
    def test_verified_payment_confirms_the_order_and_clears_the_cart(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())

        with patch("orders.notifications.send_order_registered_sms", return_value=True):
            outcome, message = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.SUCCESS)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.VERIFIED)
        self.assertIsNotNone(self.payment.verified_at)
        self.assertIsNotNone(self.payment.paid_at)
        self.assertEqual(self.payment.ref_number, "987654")
        self.assertEqual(self.payment.card_number, "62741****44")
        self.assertEqual(self.order.status, Order.CONFIRMED)
        self.assertEqual(self.cart.items.count(), 0)

    @patch("payments.settlement.zibal.verify")
    def test_confirmation_sms_is_sent_once(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        with patch(
            "orders.notifications.send_order_registered_sms", return_value=True
        ) as sms:
            settlement.verify_and_settle(self.payment)
        self.assertEqual(sms.call_count, 1)

    @patch("payments.settlement.zibal.verify")
    def test_already_verified_result_201_counts_as_success(self, mock_verify):
        # 201 is what a retried verify returns. It means "this payment was
        # already verified" — success, not an error.
        mock_verify.return_value = (True, self.verified_body(result=201))
        with patch("orders.notifications.send_order_registered_sms", return_value=True):
            outcome, _ = settlement.verify_and_settle(self.payment)
        self.assertEqual(outcome, settlement.SUCCESS)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.CONFIRMED)

    @patch("payments.settlement.zibal.verify")
    def test_settling_twice_does_the_work_once(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        with patch(
            "orders.notifications.send_order_registered_sms", return_value=True
        ) as sms:
            settlement.verify_and_settle(self.payment)
            first_verified_at = Payment.objects.get(pk=self.payment.pk).verified_at
            outcome, _ = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.SUCCESS)
        self.assertEqual(sms.call_count, 1)
        self.assertEqual(mock_verify.call_count, 1)  # second call short-circuits
        self.assertEqual(
            Payment.objects.get(pk=self.payment.pk).verified_at, first_verified_at
        )

    @patch("payments.settlement.zibal.verify")
    def test_amount_mismatch_refuses_to_confirm(self, mock_verify):
        # Zibal says 100 but for a different amount than we asked. Money may have
        # moved; the order must not be confirmed on that basis.
        mock_verify.return_value = (True, self.verified_body(amount=10000))

        with self.assertLogs("payments.settlement", level="ERROR"):
            outcome, message = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.MISMATCH)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.FAILED)
        self.assertIsNone(self.payment.verified_at)
        self.assertEqual(self.order.status, Order.PENDING)
        self.assertEqual(self.cart.items.count(), 1)

    @patch("payments.settlement.zibal.verify")
    def test_not_paid_result_202_fails_without_touching_the_order(self, mock_verify):
        mock_verify.return_value = (True, {"result": 202, "status": 5})
        outcome, message = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.FAILED)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.FAILED)
        self.assertEqual(self.payment.zibal_status, 5)
        self.assertIn("موجودی", self.payment.failure_reason)  # status 5 message
        self.assertEqual(Order.objects.get().status, Order.PENDING)
        self.assertEqual(self.cart.items.count(), 1)

    @patch("payments.settlement.zibal.verify")
    def test_cancelled_by_user_reads_as_cancelled_not_failed(self, mock_verify):
        mock_verify.return_value = (True, {"result": 202, "status": 3})
        outcome, message = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.CANCELLED)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.CANCELLED)

    @patch("payments.settlement.zibal.verify")
    def test_awaiting_payment_stays_pending(self, mock_verify):
        # status -1: the customer may still be on the bank page. Nothing is
        # terminal yet, so nothing is written off.
        mock_verify.return_value = (True, {"result": 202, "status": -1})
        outcome, _ = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.PENDING)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.REDIRECTED)

    @patch("payments.settlement.zibal.verify", return_value=(False, {}))
    def test_unreachable_verify_parks_the_payment_for_reconciliation(self, _mock):
        # We cannot tell whether money moved. PAID_UNVERIFIED is the honest state
        # and is exactly what reconcile_payments looks for.
        outcome, _ = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.PENDING)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.PAID_UNVERIFIED)
        self.assertEqual(Order.objects.get().status, Order.PENDING)

    @patch("payments.settlement.zibal.verify")
    def test_refund_status_is_logged_at_error(self, mock_verify):
        # Money came back. Whether or not we ever confirmed, a human must know.
        mock_verify.return_value = (True, {"result": 202, "status": 15})
        with self.assertLogs("payments.settlement", level="ERROR"):
            outcome, _ = settlement.verify_and_settle(self.payment)
        self.assertEqual(outcome, settlement.FAILED)

    @patch("payments.settlement.zibal.verify")
    def test_a_dead_sms_gateway_does_not_unwind_a_real_payment(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        with patch(
            "orders.notifications.send_order_registered_sms", return_value=False
        ):
            outcome, _ = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.SUCCESS)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.CONFIRMED)
        self.assertIsNone(self.order.confirmation_sms_sent_at)  # latch not set


class PaymentCallbackViewTests(SettlementMixin, TestCase):
    def _callback(self, **params):
        query = dict({"trackId": 15966442233311, "success": 1, "status": 2}, **params)
        return self.client.get("/api/payments/callback/", query)

    def _outcome_of(self, response):
        self.assertEqual(response.status_code, 302)
        parsed = urlparse(response["Location"])
        self.assertEqual(parsed.path, "/payment/result")
        return parse_qs(parsed.query)

    @patch("payments.settlement.zibal.verify")
    def test_verified_callback_confirms_and_redirects_to_success(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        with patch("orders.notifications.send_order_registered_sms", return_value=True):
            response = self._callback()

        params = self._outcome_of(response)
        self.assertEqual(params["status"], ["success"])
        self.assertEqual(params["order"], [str(self.order.pk)])
        self.assertEqual(params["ref"], ["987654"])
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.CONFIRMED)

    @patch("payments.settlement.zibal.verify")
    def test_a_forged_success_flag_confirms_nothing(self, mock_verify):
        # THE security property: the query string is decoration. Zibal's verify
        # says not-paid, so no order is confirmed however the URL is dressed up.
        mock_verify.return_value = (True, {"result": 202, "status": 3})

        response = self._callback(success=1, status=1)

        params = self._outcome_of(response)
        self.assertEqual(params["status"], ["cancelled"])
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.PENDING)
        self.assertEqual(self.cart.items.count(), 1)

    @patch("payments.settlement.zibal.verify")
    def test_duplicate_callback_is_a_no_op(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        with patch(
            "orders.notifications.send_order_registered_sms", return_value=True
        ) as sms:
            self._callback()
            second = self._callback()

        params = self._outcome_of(second)
        self.assertEqual(params["status"], ["success"])
        self.assertEqual(sms.call_count, 1)
        self.assertEqual(mock_verify.call_count, 1)

    def test_unknown_track_id_redirects_instead_of_erroring(self):
        # A real customer is looking at this page. It must never be a 500.
        with patch("payments.settlement.zibal.verify") as mock_verify:
            response = self._callback(trackId=999999999)
        params = self._outcome_of(response)
        self.assertEqual(params["status"], ["notfound"])
        mock_verify.assert_not_called()

    def test_non_numeric_track_id_redirects_instead_of_erroring(self):
        response = self._callback(trackId="../../etc/passwd")
        params = self._outcome_of(response)
        self.assertEqual(params["status"], ["notfound"])

    def test_missing_track_id_redirects_instead_of_erroring(self):
        response = self.client.get("/api/payments/callback/")
        params = self._outcome_of(response)
        self.assertEqual(params["status"], ["notfound"])

    @patch("payments.settlement.zibal.verify")
    def test_callback_needs_no_session(self, mock_verify):
        # Zibal drives the browser here; requiring auth would put a login wall in
        # front of a customer who has just paid.
        mock_verify.return_value = (True, self.verified_body())
        self.client.logout()
        with patch("orders.notifications.send_order_registered_sms", return_value=True):
            response = self._callback()
        self.assertEqual(self._outcome_of(response)["status"], ["success"])

    @override_settings(FRONTEND_BASE_URL="https://salyco.ir")
    @patch("payments.settlement.zibal.verify")
    def test_frontend_base_url_is_honoured_when_set(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        with patch("orders.notifications.send_order_registered_sms", return_value=True):
            response = self._callback()
        self.assertTrue(
            response["Location"].startswith("https://salyco.ir/payment/result")
        )

    @patch("payments.settlement.zibal.verify")
    def test_failure_message_reaches_the_result_page(self, mock_verify):
        mock_verify.return_value = (True, {"result": 202, "status": 5})
        response = self._callback(success=0)
        params = self._outcome_of(response)
        self.assertEqual(params["status"], ["failed"])
        self.assertIn("موجودی", params["message"][0])
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: FAIL — `ModuleNotFoundError: No module named 'payments.settlement'`

- [ ] **Step 3: Write the settlement module**

Create `Backend/payments/settlement.py`:

```python
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

from orders.models import Cart, Order
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

    # The order is paid, so the cart it came from is spent.
    cart = Cart.objects.filter(customer_id=order.customer_id).first()
    if cart is not None:
        cart.items.all().delete()

    # After commit, so the order is durable before the SMS goes out and no HTTP
    # request is made with a transaction open. send_order_confirmation carries
    # its own once-per-order latch and is best-effort — a dead SMS gateway must
    # not unwind a real payment.
    transaction.on_commit(lambda: send_order_confirmation(order))

    return SUCCESS, ""
```

- [ ] **Step 4: Replace the callback placeholder**

In `Backend/payments/views.py`, replace the `PaymentCallbackView` placeholder with:

```python
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
```

Add to the imports at the top of `views.py`:

```python
from django.shortcuts import redirect
from rest_framework.permissions import AllowAny, IsAuthenticated

from . import settlement, zibal
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: PASS, 54 tests (34 + 20 new).

- [ ] **Step 6: Confirm the whole suite is still green**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test -v 1`
Expected: everything passes.

- [ ] **Step 7: Commit**

```bash
git add Backend/payments
git commit -m "feat(payments): verify payments and confirm orders idempotently

The callback trusts only the server-side /v1/verify response — a forged
?success=1 confirms nothing. The verify amount is checked against what we
stored, and verified_at latches settlement so a re-sent callback cannot
double-confirm, double-clear the cart or double-send the SMS."
```

---

### Task 6: Payment status endpoint

Lets the result page show the outcome even when the redirect's query string is lost — a customer who bookmarks or reloads the result page still gets the truth from the database rather than from a URL.

**Files:**
- Modify: `Backend/payments/views.py` (append `PaymentStatusView`), `Backend/payments/urls.py`
- Modify: `Backend/payments/tests.py` (append `PaymentStatusViewTests`)

**Interfaces:**
- Consumes: `payments.models.Payment`.
- Produces: `GET /api/payments/<int:track_id>/status/` (name `payment-status`), `IsAuthenticated`. 200: `{"status", "status_display", "order_id", "amount_toman", "ref_number", "card_number", "failure_reason", "paid_at"}`. 404 when the payment belongs to another customer.

- [ ] **Step 1: Write the failing tests**

Append to `Backend/payments/tests.py`:

```python
class PaymentStatusViewTests(SettlementMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.user)

    def test_owner_sees_their_payment_status(self):
        self.payment.status = Payment.VERIFIED
        self.payment.ref_number = "987654"
        self.payment.verified_at = timezone.now()
        self.payment.save()

        response = self.client.get(f"/api/payments/{self.payment.track_id}/status/")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], Payment.VERIFIED)
        self.assertEqual(body["order_id"], self.order.pk)
        self.assertEqual(body["ref_number"], "987654")
        self.assertEqual(body["amount_toman"], "2000000.00")
        self.assertTrue(body["status_display"])

    def test_another_customer_gets_a_404_not_someone_elses_payment(self):
        other = User.objects.create_user(username="09129999999", password="x")
        Customer.objects.create(
            user=other, first_name="ب", last_name="ب", phone_number="09129999999"
        )
        self.client.force_login(other)

        response = self.client.get(f"/api/payments/{self.payment.track_id}/status/")

        self.assertEqual(response.status_code, 404)

    def test_unknown_track_id_is_a_404(self):
        response = self.client.get("/api/payments/424242/status/")
        self.assertEqual(response.status_code, 404)

    def test_anonymous_users_are_refused(self):
        self.client.logout()
        response = self.client.get(f"/api/payments/{self.payment.track_id}/status/")
        self.assertIn(response.status_code, (401, 403))

    def test_failure_reason_is_exposed_for_the_result_page(self):
        self.payment.status = Payment.FAILED
        self.payment.failure_reason = "موجودی حساب کافی نیست."
        self.payment.save()

        response = self.client.get(f"/api/payments/{self.payment.track_id}/status/")

        self.assertEqual(response.json()["failure_reason"], "موجودی حساب کافی نیست.")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments.tests.PaymentStatusViewTests -v 2`
Expected: FAIL — 404 on every case, the route does not exist.

- [ ] **Step 3: Write the view**

Append to `Backend/payments/views.py`:

```python
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
```

- [ ] **Step 4: Route it**

Add to `Backend/payments/urls.py`, after the callback path:

```python
    path(
        "payments/<int:track_id>/status/",
        views.PaymentStatusView.as_view(),
        name="payment-status",
    ),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: PASS, 59 tests.

- [ ] **Step 6: Commit**

```bash
git add Backend/payments
git commit -m "feat(payments): add payment status endpoint scoped to the owner"
```

---

### Task 7: Reconciliation command

**Why this task exists:** it is the half of "transactional" that the callback cannot provide. If a callback is lost to a deploy, a restart or a network blip, a real customer has been charged and nothing in the system would ever notice. This command is what notices.

**Files:**
- Create: `Backend/payments/management/__init__.py` (empty), `Backend/payments/management/commands/__init__.py` (empty), `Backend/payments/management/commands/reconcile_payments.py`
- Modify: `Backend/payments/tests.py` (append `ReconcilePaymentsTests`)
- Modify: `DEPLOYMENT.md` (document the cron entry)

**Interfaces:**
- Consumes: `payments.zibal.inquiry`, `payments.settlement.{settle_from_status, verify_and_settle}`, `payments.models.Payment`.
- Produces: `python manage.py reconcile_payments [--minutes N] [--dry-run]`. Default `--minutes 30`.

- [ ] **Step 1: Write the failing tests**

Append to `Backend/payments/tests.py`:

```python
from datetime import timedelta
from io import StringIO

from django.core.management import call_command


class ReconcilePaymentsTests(SettlementMixin, TestCase):
    def _age_the_payment(self, minutes=45):
        # created_at is auto_now_add, so it must be back-dated with an update()
        # that bypasses save().
        Payment.objects.filter(pk=self.payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=minutes)
        )

    def _run(self, **kwargs):
        out = StringIO()
        call_command("reconcile_payments", stdout=out, **kwargs)
        return out.getvalue()

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_paid_and_verified_status_1_settles_the_order(self, mock_inquiry):
        # Zibal already considers this verified — it has the money. The lost
        # callback is why our side never confirmed.
        self._age_the_payment()
        mock_inquiry.return_value = (True, self.verified_body(result=100, status=1))

        with patch("orders.notifications.send_order_registered_sms", return_value=True):
            self._run()

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.VERIFIED)
        self.assertEqual(self.order.status, Order.CONFIRMED)
        self.assertEqual(self.cart.items.count(), 0)

    @patch("payments.management.commands.reconcile_payments.zibal.verify")
    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_paid_unverified_status_2_is_verified_then_settled(
        self, mock_inquiry, mock_verify
    ):
        # THE case this command exists for: money captured, never verified.
        self._age_the_payment()
        mock_inquiry.return_value = (True, {"result": 100, "status": 2, "amount": 20000000})
        mock_verify.return_value = (True, self.verified_body())

        with patch("orders.notifications.send_order_registered_sms", return_value=True):
            self._run()

        mock_verify.assert_called_once_with(self.payment.track_id)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.VERIFIED)
        self.assertEqual(self.order.status, Order.CONFIRMED)

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_awaiting_payment_is_left_alone(self, mock_inquiry):
        self._age_the_payment()
        mock_inquiry.return_value = (True, {"result": 100, "status": -1})

        self._run()

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.REDIRECTED)
        self.assertEqual(Order.objects.get().status, Order.PENDING)

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_terminal_failure_marks_the_payment_failed(self, mock_inquiry):
        self._age_the_payment()
        mock_inquiry.return_value = (True, {"result": 100, "status": 5})

        self._run()

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.FAILED)
        self.assertEqual(Order.objects.get().status, Order.PENDING)
        self.assertEqual(self.cart.items.count(), 1)

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_inquiry_result_100_does_not_by_itself_confirm_an_order(self, mock_inquiry):
        # THE trap: /v1/inquiry's result 100 means "a report was produced", not
        # "the payment succeeded" — unlike /v1/verify's 100. An inquiry saying
        # result 100 + status 3 describes a CANCELLED payment, reported
        # successfully. Reading result instead of status here would confirm an
        # order nobody paid for.
        self._age_the_payment()
        mock_inquiry.return_value = (
            True,
            {"result": 100, "status": 3, "amount": 20000000},
        )

        with patch("orders.notifications.send_order_registered_sms") as sms:
            self._run()

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.CANCELLED)
        self.assertEqual(self.order.status, Order.PENDING)
        self.assertEqual(self.cart.items.count(), 1)
        sms.assert_not_called()

    @patch("payments.management.commands.reconcile_payments.zibal.verify")
    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_inquiry_reporting_status_2_is_never_written_off(
        self, mock_inquiry, mock_verify
    ):
        # Status 2 is money captured but unclaimed. It must never become FAILED —
        # that would abandon a real payment. It parks as PAID_UNVERIFIED so the
        # next run retries the verify.
        self._age_the_payment()
        mock_inquiry.return_value = (True, {"result": 100, "status": 2})
        mock_verify.return_value = (False, {})  # verify unreachable this time

        self._run()

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.PAID_UNVERIFIED)
        self.assertIsNone(self.payment.verified_at)

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_refund_is_reported_loudly(self, mock_inquiry):
        self._age_the_payment()
        mock_inquiry.return_value = (True, {"result": 100, "status": 15})

        with self.assertLogs("payments.settlement", level="ERROR"):
            self._run()

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.FAILED)

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_recent_payments_are_not_touched(self, mock_inquiry):
        # Fresh payment: the customer may still be at the bank.
        mock_inquiry.return_value = (True, self.verified_body())
        self._run()
        mock_inquiry.assert_not_called()

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_minutes_option_controls_the_threshold(self, mock_inquiry):
        self._age_the_payment(minutes=10)
        mock_inquiry.return_value = (True, {"result": 100, "status": -1})

        self._run(minutes=5)

        mock_inquiry.assert_called_once()

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_settled_payments_are_never_revisited(self, mock_inquiry):
        self._age_the_payment()
        self.payment.status = Payment.VERIFIED
        self.payment.verified_at = timezone.now()
        self.payment.save()

        self._run()

        mock_inquiry.assert_not_called()

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_failed_payments_are_never_revisited(self, mock_inquiry):
        self._age_the_payment()
        self.payment.status = Payment.FAILED
        self.payment.save()

        self._run()

        mock_inquiry.assert_not_called()

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_running_twice_changes_nothing_the_second_time(self, mock_inquiry):
        self._age_the_payment()
        mock_inquiry.return_value = (True, self.verified_body(status=1))

        with patch(
            "orders.notifications.send_order_registered_sms", return_value=True
        ) as sms:
            self._run()
            self._run()

        self.assertEqual(sms.call_count, 1)

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_dry_run_reports_without_writing(self, mock_inquiry):
        self._age_the_payment()
        mock_inquiry.return_value = (True, self.verified_body(status=1))

        output = self._run(dry_run=True)

        self.assertIn(str(self.payment.track_id), output)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.REDIRECTED)
        self.assertEqual(Order.objects.get().status, Order.PENDING)

    @patch(
        "payments.management.commands.reconcile_payments.zibal.inquiry",
        return_value=(False, {}),
    )
    def test_unreachable_gateway_leaves_the_payment_for_the_next_run(self, _mock):
        self._age_the_payment()
        self._run()
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.REDIRECTED)

    @patch("payments.management.commands.reconcile_payments.zibal.inquiry")
    def test_one_bad_payment_does_not_stop_the_rest(self, mock_inquiry):
        # A crash partway through must not leave later payments unreconciled.
        self._age_the_payment()
        second_order = Order.objects.create(
            customer=self.customer, method=Order.ONLINE, total_amount=Decimal("100000")
        )
        second = Payment.objects.create(
            order=second_order,
            amount_rial=1000000,
            track_id=222,
            status=Payment.REDIRECTED,
        )
        Payment.objects.filter(pk=second.pk).update(
            created_at=timezone.now() - timedelta(minutes=45)
        )
        mock_inquiry.side_effect = [
            RuntimeError("boom"),
            (True, {"result": 100, "status": 5}),
        ]

        self._run()

        second.refresh_from_db()
        self.assertEqual(second.status, Payment.FAILED)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments.tests.ReconcilePaymentsTests -v 2`
Expected: FAIL — `CommandError: Unknown command: 'reconcile_payments'`

- [ ] **Step 3: Write the command**

Create the two empty `__init__.py` files, then `Backend/payments/management/commands/reconcile_payments.py`:

```python
"""Settle payments whose callback never arrived.

This command is the half of the payment guarantee that the callback cannot
provide. The callback runs in the customer's browser; if it is lost to a deploy,
a container restart, a closed laptop or a network blip, a real customer has been
charged and our side still shows an unpaid order. Nothing else in the system
would ever notice, so without this command "transactional" would be a claim
rather than a property.

Run it on a schedule — every 15 minutes is ample:

    */15 * * * * cd /app && python manage.py reconcile_payments

Safe to run concurrently with a live callback and safe to run twice: both paths
settle through payments.settlement, which locks the row and checks the
verified_at latch before doing anything.

/v1/inquiry is used to read state because, unlike /v1/verify, it changes
nothing — so a payment the customer is still working on is not disturbed by
being looked at.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from payments import settlement, zibal
from payments.models import Payment

logger = logging.getLogger(__name__)

# Statuses that mean "we do not yet know how this ended". Anything else is
# already terminal and must never be revisited.
UNSETTLED_STATUSES = (Payment.REDIRECTED, Payment.PAID_UNVERIFIED)

DEFAULT_MINUTES = 30


class Command(BaseCommand):
    help = "Settle Zibal payments whose callback never arrived."

    def add_arguments(self, parser):
        parser.add_argument(
            "--minutes",
            type=int,
            default=DEFAULT_MINUTES,
            help=(
                "Only consider payments older than this many minutes. The delay "
                "avoids racing a customer who is still on the bank page "
                f"(default: {DEFAULT_MINUTES})."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be settled without writing anything.",
        )

    def handle(self, *args, **options):
        minutes = options["minutes"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(minutes=minutes)

        payments = (
            Payment.objects.select_related("order")
            .filter(
                status__in=UNSETTLED_STATUSES,
                verified_at__isnull=True,
                track_id__isnull=False,
                created_at__lt=cutoff,
            )
            .order_by("created_at")
        )

        self.stdout.write(
            f"Reconciling {payments.count()} payment(s) older than {minutes} minute(s)"
            + (" [dry run]" if dry_run else "")
        )

        for payment in payments:
            try:
                self._reconcile(payment, dry_run=dry_run)
            except Exception:
                # One unreconcilable payment must not strand the rest — the next
                # one in the queue may be a customer waiting on a confirmed order.
                logger.exception(
                    "Reconciliation failed for payment %s (trackId %s)",
                    payment.pk,
                    payment.track_id,
                )
                self.stderr.write(
                    f"  trackId {payment.track_id}: error, skipped (see logs)"
                )

    def _reconcile(self, payment: Payment, *, dry_run: bool) -> None:
        ok, data = zibal.inquiry(payment.track_id)
        if not ok:
            # Leave it exactly as it is; the next run tries again.
            self.stdout.write(f"  trackId {payment.track_id}: gateway unreachable")
            return

        zibal_status = data.get("status")

        if dry_run:
            self.stdout.write(
                f"  trackId {payment.track_id}: Zibal status {zibal_status} "
                f"({zibal.status_message(zibal_status)}) — would settle"
            )
            return

        if zibal_status == zibal.STATUS_PAID_UNVERIFIED:
            # Money is captured but the session was never closed. Verifying is
            # what actually claims it, so go through verify rather than applying
            # the inquiry body directly.
            outcome, message = settlement.verify_and_settle(payment)
        else:
            # Everything else is applied from the inquiry body, which
            # settle_from_status reads status-first — an inquiry's result 100
            # means "report produced", not "payment succeeded".
            outcome, message = settlement.settle_from_status(payment, data)

        self.stdout.write(
            f"  trackId {payment.track_id}: Zibal status {zibal_status} → {outcome}"
            + (f" ({message})" if message else "")
        )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 2`
Expected: PASS, 74 tests.

- [ ] **Step 5: Verify the command runs against a real database**

Run: `cd Backend && ./env/Scripts/python.exe manage.py reconcile_payments --dry-run`
Expected: `Reconciling 0 payment(s) older than 30 minute(s) [dry run]` — no traceback.

- [ ] **Step 6: Document the schedule**

Append to `DEPLOYMENT.md`:

```markdown
## Payment reconciliation (required)

Zibal notifies the site of a payment by redirecting the customer's browser to
`/api/payments/callback/`. That redirect is the only automatic notification, so
if it is lost — a deploy mid-payment, a container restart, a closed laptop, a
dropped connection — a customer has been charged and the order stays PENDING
with nothing to correct it.

`reconcile_payments` closes that gap by asking Zibal directly (`/v1/inquiry`)
about any payment left unsettled, and confirming the order when Zibal reports
the money as captured. **Online payments are not safe to enable without it.**

Add to the host's crontab:

    */15 * * * * cd /path/to/Backend && /path/to/python manage.py reconcile_payments >> /var/log/salyco-reconcile.log 2>&1

Or, in the docker-compose deployment, on the host:

    */15 * * * * docker compose -f /path/to/docker-compose.yml exec -T backend python manage.py reconcile_payments

Safe to run concurrently with live traffic and safe to run twice — settlement
locks the payment row and checks a once-only latch. `--dry-run` reports what it
would do without writing. `--minutes N` changes the age threshold (default 30).
```

- [ ] **Step 7: Commit**

```bash
git add Backend/payments DEPLOYMENT.md
git commit -m "feat(payments): add reconcile_payments for lost callbacks

The callback runs in the customer's browser, so it can be lost. This asks
Zibal directly about anything left unsettled and confirms orders whose money
Zibal reports as captured — the half of the guarantee the callback cannot give."
```

---

### Task 8: Frontend — enable the button and show the result

**Files:**
- Create: `Frontend/salyco-front/src/api/payments.js`
- Create: `Frontend/salyco-front/src/pages/PaymentResult.jsx`
- Modify: `Frontend/salyco-front/src/pages/checkout/CheckoutOrder.jsx` (lines 519-535: the disabled button; plus a handler and the notices copy)
- Modify: `Frontend/salyco-front/src/App.jsx` (one route)

**Interfaces:**
- Consumes: `POST /api/payments/start/` → `{payment_url, track_id, order_id}`; `GET /api/payments/<track_id>/status/`.
- Produces: `startPayment(data) -> Promise<{payment_url, track_id, order_id}>`, `getPaymentStatus(trackId) -> Promise<object>`, route `/payment/result`.

There is no frontend test runner in this project, so this task is verified in a browser against the running backend. Do not add one — that is a separate decision.

- [ ] **Step 1: Write the API client**

Create `Frontend/salyco-front/src/api/payments.js`:

```javascript
import api from "../api";

// Starts a Zibal payment session for the current cart. Returns the gateway URL
// the browser must be sent to. Errors are unwrapped the same way as
// api/orders.js so callers can show err.message directly.
export async function startPayment(data) {
  try {
    const res = await api.post("/api/payments/start/", data);
    return res.data;
  } catch (err) {
    const body = err.response?.data;
    const firstError =
      body && typeof body === "object"
        ? body.detail || Object.values(body).flat()[0]
        : null;
    throw new Error(firstError || "خطا در اتصال به درگاه پرداخت");
  }
}

// The authoritative outcome of one payment, read from the database rather than
// from the query string the gateway redirected with. Used by the result page so
// a reload or a bookmarked URL still shows the truth.
export async function getPaymentStatus(trackId) {
  try {
    const res = await api.get(`/api/payments/${trackId}/status/`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت وضعیت پرداخت";
    throw new Error(msg);
  }
}
```

- [ ] **Step 2: Enable the online payment button**

In `CheckoutOrder.jsx`, add to the imports:

```javascript
import { startPayment } from "../../api/payments";
import { CreditCard } from "lucide-react";
```

Add a handler next to `handleSubmit`:

```javascript
  // Online payment. Runs the same validation the phone path does, then hands the
  // browser to Zibal.
  const handleOnlinePayment = async () => {
    setError("");
    if (noServiceableAreas || !validate()) return;

    setStatus("redirecting");
    try {
      const { payment_url } = await startPayment({
        recipient_name: form.recipient_name.trim(),
        phone_number: toLatinDigits(form.phone_number).replace(/\D/g, ""),
        province: form.province,
        city: form.city.trim(),
        postal_code: toLatinDigits(form.postal_code).replace(/\D/g, ""),
        address: form.address.trim(),
      });
      // A full-page navigation, deliberately not a router transition: Zibal
      // requires a Referer header whose domain matches the gateway's registered
      // website and will not show the payment page without one. The cart is left
      // intact — nothing is paid yet, and clearing it would strand a customer
      // who abandons the bank page.
      window.location.href = payment_url;
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };
```

Replace the disabled-button block (lines 523-534) with:

```javascript
                <div>
                  <button
                    type="button"
                    onClick={handleOnlinePayment}
                    disabled={submitBlocked}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "redirecting" ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        در حال انتقال به درگاه...
                      </>
                    ) : (
                      <>
                        <CreditCard size={17} />
                        پرداخت آنلاین
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center font-persian text-xs text-[#687173]">
                    پرداخت امن از طریق درگاه زیبال
                  </p>
                </div>
```

Extend `submitBlocked` so neither button is clickable mid-redirect:

```javascript
  const submitBlocked =
    status === "sending" ||
    status === "redirecting" ||
    loadingAreas ||
    noServiceableAreas;
```

**Also update the first notice**, which currently tells every customer that orders are finalised by phone and that no money will be taken — now false for the online path. Replace `NOTICES[0]` with:

```javascript
  "سفارش خود را می‌توانید به‌صورت آنلاین پرداخت کنید یا به‌صورت تلفنی ثبت کنید. در ثبت سفارش تلفنی، کارشناسان ما برای هماهنگی جزئیات و مبلغ نهایی با شما تماس می‌گیرند و تا پیش از آن مبلغی دریافت نمی‌شود.",
```

- [ ] **Step 3: Write the result page**

Create `Frontend/salyco-front/src/pages/PaymentResult.jsx`:

```jsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { getPaymentStatus } from "../api/payments";
import { toPersianNumber } from "../utils/persian";
import PageBackground from "../components/PageBackground";

const CARD =
  "rounded-xl border border-[#CBD2D6] bg-white shadow-[0_1px_4px_rgba(0,48,135,0.06)]";

const SALES_PHONE = "09126847234";

// Keyed by the `status` the backend redirects with — settlement.py's outcome
// constants. Kept as data so a new outcome is one entry, not a new branch.
const OUTCOMES = {
  success: {
    icon: CheckCircle2,
    tone: "text-[#019C34]",
    title: "پرداخت شما با موفقیت انجام شد",
    body: "سفارش شما ثبت و تأیید شد. جزئیات سفارش از طریق پیامک برای شما ارسال می‌شود.",
  },
  cancelled: {
    icon: Info,
    tone: "text-[#687173]",
    title: "پرداخت لغو شد",
    body: "پرداخت توسط شما لغو شد. سبد خرید شما دست‌نخورده باقی مانده و می‌توانید دوباره تلاش کنید.",
  },
  failed: {
    icon: XCircle,
    tone: "text-[#D20000]",
    title: "پرداخت انجام نشد",
    body: "مبلغی از حساب شما کسر نشده است. می‌توانید دوباره تلاش کنید یا سفارش خود را تلفنی ثبت کنید.",
  },
  pending: {
    icon: Loader2,
    tone: "text-[#009CDE]",
    title: "پرداخت شما در حال بررسی است",
    body: "نتیجه پرداخت شما به‌زودی مشخص می‌شود. در صورت کسر مبلغ، سفارش شما به‌صورت خودکار تأیید خواهد شد.",
  },
  mismatch: {
    icon: XCircle,
    tone: "text-[#D20000]",
    title: "عدم تطابق مبلغ پرداخت",
    body: "مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد. لطفاً با پشتیبانی تماس بگیرید تا بررسی شود.",
  },
  notfound: {
    icon: XCircle,
    tone: "text-[#D20000]",
    title: "اطلاعات پرداخت یافت نشد",
    body: "این پرداخت در سیستم ما ثبت نشده است. اگر مبلغی از حساب شما کسر شده، با پشتیبانی تماس بگیرید.",
  },
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const outcomeKey = params.get("status") || "failed";
  const orderId = params.get("order");
  const refNumber = params.get("ref");
  const message = params.get("message");
  const trackId = params.get("trackId");

  const outcome = OUTCOMES[outcomeKey] || OUTCOMES.failed;
  const Icon = outcome.icon;

  // The query string is what the gateway redirected with; the database is the
  // authority. Re-read it when a trackId is present so a reloaded or shared URL
  // cannot show a stale — or hand-edited — result.
  const [confirmed, setConfirmed] = useState(null);
  useEffect(() => {
    if (!trackId) return;
    let alive = true;
    getPaymentStatus(trackId)
      .then((data) => alive && setConfirmed(data))
      .catch(() => {
        /* The redirect params are enough to render — this is corroboration. */
      });
    return () => {
      alive = false;
    };
  }, [trackId]);

  const shownRef = confirmed?.ref_number || refNumber;
  const shownOrderId = confirmed?.order_id || orderId;
  const shownMessage = confirmed?.failure_reason || message;

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F5F7FA] pt-[var(--navbar-height)]">
      <PageBackground />
      <div className="relative mx-auto max-w-[560px] px-6 py-16" dir="rtl">
        <div className={`${CARD} flex flex-col items-center p-10 text-center`}>
          <Icon
            className={`h-16 w-16 ${outcome.tone} ${
              outcomeKey === "pending" ? "animate-spin" : ""
            }`}
          />
          <h1 className="mt-4 font-persian text-2xl font-bold text-[#1A1A2E]">
            {outcome.title}
          </h1>
          <p className="mt-2 font-persian text-sm leading-7 text-[#687173]">
            {outcome.body}
          </p>

          {shownMessage && outcomeKey !== "success" && (
            <p className="mt-4 w-full rounded-lg bg-[#FDE7E7] px-4 py-3 font-persian text-sm text-[#D20000]">
              {shownMessage}
            </p>
          )}

          {(shownOrderId || shownRef) && (
            <dl className="mt-6 w-full divide-y divide-[#CBD2D6] rounded-lg bg-[#F5F7FA] px-4 text-sm">
              {shownOrderId && (
                <div className="flex justify-between py-3">
                  <dt className="font-persian text-[#687173]">شماره سفارش</dt>
                  <dd className="font-persian font-bold text-[#1A1A2E]">
                    {toPersianNumber(shownOrderId)}
                  </dd>
                </div>
              )}
              {shownRef && (
                <div className="flex justify-between py-3">
                  <dt className="font-persian text-[#687173]">شماره پیگیری</dt>
                  <dd
                    className="font-persian font-bold text-[#1A1A2E] [font-feature-settings:'tnum']"
                    dir="ltr"
                  >
                    {shownRef}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            {outcomeKey === "success" ? (
              <>
                <Link
                  to="/user-info"
                  className="flex-1 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
                >
                  سفارش‌های من
                </Link>
                <Link
                  to="/products"
                  className="flex-1 rounded-lg border-2 border-[#003087] px-6 py-3 font-persian text-sm font-bold text-[#003087] transition hover:bg-[#003087] hover:text-white"
                >
                  ادامه خرید
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/cart"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#003087] px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-[#00246B]"
                >
                  <ArrowRight size={16} />
                  بازگشت به سبد خرید
                </Link>
                <a
                  href={`tel:${SALES_PHONE}`}
                  dir="ltr"
                  className="flex-1 rounded-lg border-2 border-[#003087] px-6 py-3 font-persian text-sm font-bold text-[#003087] transition hover:bg-[#003087] hover:text-white"
                >
                  {SALES_PHONE}
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3b: Pass the trackId through the redirect**

The result page reads `trackId` to corroborate against the database, so the backend must send it. In `Backend/payments/settlement.py`, inside `result_page_url`, add it to the params:

```python
    params = {"status": outcome}
    if payment is not None:
        params["order"] = payment.order_id
        params["trackId"] = payment.track_id
        if payment.ref_number:
            params["ref"] = payment.ref_number
```

Then run `cd Backend && ./env/Scripts/python.exe manage.py test payments -v 1` to confirm the existing callback tests still pass — they assert on `status`, `order` and `ref`, so an extra parameter is additive.

- [ ] **Step 4: Add the route**

In `App.jsx`, next to the other public routes (after the `/cart` route):

```jsx
            <Route path="/payment/result" element={<PaymentResult />} />
```

with the import alongside the other page imports:

```jsx
import PaymentResult from "./pages/PaymentResult";
```

Check how sibling pages are imported first — if the file uses `lazy()` for page components, match that instead.

- [ ] **Step 5: Verify the build**

Run: `cd Frontend/salyco-front && npm run build`
Expected: build succeeds with no unresolved imports.

- [ ] **Step 6: Verify in a browser**

Start the backend (`cd Backend && ./env/Scripts/python.exe manage.py runserver`) and the frontend (`cd Frontend/salyco-front && npm run dev`), then:

1. Sign in, add a product, go to checkout.
2. Confirm "پرداخت آنلاین" is enabled and the notice no longer claims no money is taken.
3. Submit with an empty postal code — the field error appears and no request is sent.
4. Fill the form and click "پرداخت آنلاین". With `ZIBAL_MERCHANT=zibal`, the browser should reach Zibal's payment page. **This is the step that will fail on localhost** if the test merchant rejects a non-public callbackUrl — that is expected and not a code fault. Verify instead that `POST /api/payments/start/` returned 201 with a `gateway.zibal.ir/start/...` URL, and that a `Payment` row exists with status `REDIRECTED`.
5. Visit `/payment/result?status=success&order=1&ref=987654` directly and check the success layout renders RTL and correctly.
6. Repeat for `?status=failed&message=موجودی حساب کافی نیست.`, `?status=cancelled`, `?status=pending`, `?status=notfound`.

- [ ] **Step 7: Commit**

```bash
git add Frontend/salyco-front/src Backend/payments/settlement.py
git commit -m "feat(payments): enable online checkout and add the result page

The gateway redirect is a full-page navigation, not a router transition:
Zibal requires a matching Referer header and will not render the payment
page without one."
```

---

## Verification Checklist

Run after Task 8, before considering the feature done.

- [ ] `cd Backend && ./env/Scripts/python.exe manage.py test -v 1` — whole suite green
- [ ] `cd Frontend/salyco-front && npm run build` — builds clean
- [ ] `cd Backend && ./env/Scripts/python.exe manage.py reconcile_payments --dry-run` — runs without traceback
- [ ] `git log --oneline` shows one commit per task, none batched
- [ ] `grep -rn "ZIBAL" .env.example` shows both variables documented
- [ ] `DEPLOYMENT.md` contains the reconciliation cron section

## Deployment Notes

Carry these into whatever go-live checklist you keep. None is code.

1. **Set `ZIBAL_MERCHANT`** to the real key in production `.env`. Until then the test merchant is live and no real money moves.
2. **Set `ZIBAL_CALLBACK_BASE_URL=https://salyco.ir`.** Zibal rejects a non-HTTP(S) callback with result 106, and redirects a real browser to it.
3. **Register the site domain** on the gateway in the Zibal panel. `/start/{trackId}` is refused when the browser's `Referer` does not match it.
4. **If the gateway is IP-restricted**, register the server's egress IP or every request returns result 115.
5. **Install the reconciliation cron entry.** Online payments should not be enabled without it — see `DEPLOYMENT.md`.
6. **Do the first real payment yourself**, for the smallest orderable amount, and confirm: the order reaches CONFIRMED, the SMS arrives once, the cart is empty, and the `Payment` row holds a `ref_number` matching the Zibal panel.
7. **Optional:** the Zibal trust badge for the footer (`https://zibal.ir/trust/scripts/zibal-trust-v4.js`) — documented in `api-1.json` under «نشان اعتماد زیبال», deliberately out of scope here.







