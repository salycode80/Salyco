from decimal import Decimal
from datetime import timedelta
from io import StringIO
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import requests
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from mattress.models import Mattress, MattressSize
from orders.models import AllowedLocation, Cart, CartItem, Order
from users.models import Customer

from . import settlement, zibal
from .models import MIN_AMOUNT_RIAL, Payment, toman_to_rial


# ══════════════════════════════════════════════════════════════════════════════
# Zibal Client Tests
# ══════════════════════════════════════════════════════════════════════════════


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


# ══════════════════════════════════════════════════════════════════════════════
# Payment Model Tests
# ══════════════════════════════════════════════════════════════════════════════


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


# ══════════════════════════════════════════════════════════════════════════════
# Payment Views Tests
# ══════════════════════════════════════════════════════════════════════════════

CHECKOUT_FORM = {
    "recipient_name": "علی رضایی",
    "phone_number": "09121112233",
    "province": "تهران",
    "city": "تهران",
    "postal_code": "1234567890",
    "address": "خیابان آزادی، پلاک ۱۲، واحد ۳",
}


class PaymentStartViewTests(APITestCase):
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
            user=self.user,
            first_name="علی",
            last_name="رضایی",
            phone_number="09121112233",
        )
        self.cart = Cart.objects.create(customer=self.customer)
        CartItem.objects.create(cart=self.cart, mattress=self.mattress, quantity=1)
        self.client.force_authenticate(user=self.user)

    def _start(self, **overrides):
        return self.client.post(
            "/api/payments/start/", dict(CHECKOUT_FORM, **overrides)
        )

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
            name="نمونه",
            description="نمونه",
            slug="cheap",
            warranty_months=1,
            price=Decimal("100"),
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


# ══════════════════════════════════════════════════════════════════════════════
# Settlement Tests
# ══════════════════════════════════════════════════════════════════════════════


class SettlementMixin:
    """Shared fixture: one ONLINE order of 2,000,000 Toman with a REDIRECTED
    payment of 20,000,000 Rial, and a cart still holding its item.

    NOTE: This mixin must be used with TransactionTestCase, not TestCase,
    because settlement uses transaction.on_commit() for SMS sending."""

    def setUp(self):
        # TransactionTestCase doesn't support setUpTestData, so everything goes in setUp
        AllowedLocation.objects.create(province="تهران", city="", is_active=True)
        self.mattress = Mattress.objects.create(
            name="تشک ابری",
            description="تشک طبی",
            slug="abri",
            warranty_months=120,
            price=Decimal("2000000"),
        )
        self.user = User.objects.create_user(username="09121112233", password="x")
        self.customer = Customer.objects.create(
            user=self.user,
            first_name="علی",
            last_name="رضایی",
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
            province="تهران",
            city="تهران",
            postal_code="1234567890",
            address="خیابان آزادی",
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


class SettlementTests(SettlementMixin, TransactionTestCase):
    @patch("payments.settlement.zibal.verify")
    def test_verified_payment_confirms_the_order_and_clears_the_cart(
        self, mock_verify
    ):
        mock_verify.return_value = (True, self.verified_body())

        with patch("orders.notifications.send_order_confirmation", return_value=True):
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
        # transaction.on_commit() fires the SMS send. In TransactionTestCase,
        # the callback actually runs, but checking the mock inside the test
        # happens before on_commit fires. Check the side effect instead.
        mock_verify.return_value = (True, self.verified_body())
        settlement.verify_and_settle(self.payment)
        self.order.refresh_from_db()
        # If SMS was sent, the latch is set
        self.assertIsNotNone(self.order.confirmation_sms_sent_at)

    @patch("payments.settlement.zibal.verify")
    def test_already_verified_result_201_counts_as_success(self, mock_verify):
        # 201 is what a retried verify returns. It means "this payment was
        # already verified" — success, not an error.
        mock_verify.return_value = (True, self.verified_body(result=201))
        with patch("orders.notifications.send_order_confirmation", return_value=True):
            outcome, _ = settlement.verify_and_settle(self.payment)
        self.assertEqual(outcome, settlement.SUCCESS)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.CONFIRMED)

    @patch("payments.settlement.zibal.verify")
    def test_settling_twice_does_the_work_once(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        settlement.verify_and_settle(self.payment)
        first_verified_at = Payment.objects.get(pk=self.payment.pk).verified_at
        first_sms_at = Order.objects.get(pk=self.order.pk).confirmation_sms_sent_at
        # Refresh payment so second call sees verified_at
        self.payment.refresh_from_db()
        outcome, _ = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.SUCCESS)
        self.assertEqual(mock_verify.call_count, 1)  # second call short-circuits
        self.assertEqual(
            Payment.objects.get(pk=self.payment.pk).verified_at, first_verified_at
        )
        # SMS timestamp unchanged - only sent once
        self.assertEqual(
            Order.objects.get(pk=self.order.pk).confirmation_sms_sent_at, first_sms_at
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

    @patch("orders.notifications.send_order_registered_sms")
    @patch("payments.settlement.zibal.verify")
    def test_a_dead_sms_gateway_does_not_unwind_a_real_payment(
        self, mock_verify, mock_sms
    ):
        # Mock the actual SMS sender to fail
        mock_sms.return_value = False
        mock_verify.return_value = (True, self.verified_body())
        outcome, _ = settlement.verify_and_settle(self.payment)

        self.assertEqual(outcome, settlement.SUCCESS)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.CONFIRMED)
        # SMS was attempted but the latch not set because send_order_registered_sms returned False
        self.assertIsNone(self.order.confirmation_sms_sent_at)


class PaymentCallbackViewTests(SettlementMixin, TransactionTestCase):
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
        with patch("orders.notifications.send_order_confirmation", return_value=True):
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
        self._callback()
        first_sms_at = Order.objects.get(pk=self.order.pk).confirmation_sms_sent_at
        # Refresh payment so the second call sees verified_at
        self.payment.refresh_from_db()
        second = self._callback()

        params = self._outcome_of(second)
        self.assertEqual(params["status"], ["success"])
        # First callback calls verify, second one short-circuits
        self.assertEqual(mock_verify.call_count, 1)
        # SMS timestamp unchanged
        self.assertEqual(
            Order.objects.get(pk=self.order.pk).confirmation_sms_sent_at, first_sms_at
        )

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
        with patch("orders.notifications.send_order_confirmation", return_value=True):
            response = self._callback()
        self.assertEqual(self._outcome_of(response)["status"], ["success"])

    @override_settings(FRONTEND_BASE_URL="https://salyco.ir")
    @patch("payments.settlement.zibal.verify")
    def test_frontend_base_url_is_honoured_when_set(self, mock_verify):
        mock_verify.return_value = (True, self.verified_body())
        with patch("orders.notifications.send_order_confirmation", return_value=True):
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


class PaymentStatusViewTests(SettlementMixin, TransactionTestCase):
    def setUp(self):
        super().setUp()
        # Use APIClient with force_authenticate for REST framework
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        # Clean up for TransactionTestCase
        self.client = None

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
        # Switch authentication to the other user
        self.client.force_authenticate(user=other)

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

        self.assertEqual(
            response.json()["failure_reason"], "موجودی حساب کافی نیست."
        )


# ══════════════════════════════════════════════════════════════════════════════
# Reconciliation Tests
# ══════════════════════════════════════════════════════════════════════════════


class ReconcilePaymentsTests(SettlementMixin, TransactionTestCase):
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

        with patch("orders.notifications.send_order_confirmation", return_value=True):
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
        mock_inquiry.return_value = (
            True,
            {"result": 100, "status": 2, "amount": 20000000},
        )
        mock_verify.return_value = (True, self.verified_body())

        with patch("orders.notifications.send_order_confirmation", return_value=True):
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

        with patch("orders.notifications.send_order_confirmation") as sms:
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

        self._run()
        first_sms_at = Order.objects.get(pk=self.order.pk).confirmation_sms_sent_at
        self._run()

        # SMS timestamp unchanged - only sent once
        self.assertEqual(
            Order.objects.get(pk=self.order.pk).confirmation_sms_sent_at, first_sms_at
        )

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
            customer=self.customer,
            method=Order.ONLINE,
            total_amount=Decimal("100000"),
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
