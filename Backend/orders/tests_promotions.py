"""Coupon rules: the data model, the engine, and the checkout/settlement path.

Kept in one module rather than split per app: a coupon is only meaningful as a
round trip through cart → order → payment, so the tests that matter cross app
boundaries on purpose.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from mattress.models import Mattress
from users.models import Customer, User

from .models import Cart, CartItem, Coupon, CouponProduct, CouponRedemption, Order
from .promotions import (
    calculate_discount,
    coupon_status,
    customer_redemption_count,
    eligible_subtotal,
    minimum_order_message,
    redeemed_count,
    validate_coupon,
)


# ═══ fixtures ══════════════════════════════════════════════════════════════════


# Mirrors payments/tests.py:282 exactly. There is no custom user model
# (settings has no AUTH_USER_MODEL), so the default auth.User with a username is
# right. Customer.address / postal_code are CharField/TextField with no default,
# so create() fills them with "" — passing them is not required.
def make_customer(phone: str = "09120000000") -> Customer:
    user = User.objects.create_user(username=phone, password="x")
    return Customer.objects.create(
        user=user,
        first_name="آزمون",
        last_name="کاربر",
        phone_number=phone,
    )


def make_mattress(slug: str = "m-test", price: str = "10000000") -> Mattress:
    return Mattress.objects.create(
        name=f"تشک {slug}",
        description="توضیح",
        slug=slug,
        warranty_months=12,
        price=Decimal(price),
    )


def make_cart(customer: Customer, *mattresses: Mattress, coupon: Coupon | None = None) -> Cart:
    """One cart per customer (the relation is a OneToOne), so a test that already
    has a cart for this customer must reuse it rather than call this again."""
    cart = Cart.objects.create(customer=customer, coupon=coupon)
    for m in mattresses:
        CartItem.objects.create(cart=cart, mattress=m, quantity=1)
    return cart


# ═══ Coupon model ══════════════════════════════════════════════════════════════


class CouponModelTests(TestCase):
    def test_code_is_trimmed_and_uppercased_on_save(self):
        coupon = Coupon.objects.create(code="  salyco10  ", percent=10)
        coupon.refresh_from_db()
        self.assertEqual(coupon.code, "SALYCO10")

    def test_internal_whitespace_collapses_to_one_space(self):
        # " ".join(split()) collapses a run to a single space rather than
        # deleting it, so an internal space survives — what converges is the
        # number of spaces, not their presence.
        self.assertEqual(Coupon.objects.create(code="salyco  10", percent=10).code, "SALYCO 10")

    def test_differently_spaced_codes_are_the_same_coupon(self):
        coupon = Coupon.objects.create(code="  salyco   10  ", percent=10)
        # The point of normalising: what the customer types must find the row
        # regardless of how it was spaced when the admin created it.
        self.assertEqual(Coupon.objects.get(code=coupon.code).pk, coupon.pk)

    def test_persian_code_is_allowed_and_unchanged(self):
        # upper() is a no-op for Persian, so a Persian code survives verbatim.
        coupon = Coupon.objects.create(code="تخفیف۱۰", percent=10)
        self.assertEqual(coupon.code, "تخفیف۱۰")

    def test_percent_coupon_requires_percent_in_range(self):
        with self.assertRaises(ValidationError):
            Coupon(code="A", discount_type=Coupon.PERCENT, percent=None).clean()
        with self.assertRaises(ValidationError):
            Coupon(code="A", discount_type=Coupon.PERCENT, percent=0).clean()
        with self.assertRaises(ValidationError):
            # 100 would zero the payable amount, which Zibal cannot charge.
            Coupon(code="A", discount_type=Coupon.PERCENT, percent=100).clean()
        Coupon(code="A", discount_type=Coupon.PERCENT, percent=99).clean()

    def test_percent_coupon_must_not_carry_a_fixed_amount(self):
        with self.assertRaises(ValidationError):
            Coupon(
                code="A",
                discount_type=Coupon.PERCENT,
                percent=10,
                amount=Decimal("1000"),
            ).clean()

    def test_fixed_coupon_requires_a_positive_amount(self):
        with self.assertRaises(ValidationError):
            Coupon(code="A", discount_type=Coupon.FIXED, amount=None).clean()
        with self.assertRaises(ValidationError):
            Coupon(code="A", discount_type=Coupon.FIXED, amount=Decimal("0")).clean()
        Coupon(code="A", discount_type=Coupon.FIXED, amount=Decimal("5000")).clean()

    def test_fixed_coupon_must_not_carry_a_percent(self):
        with self.assertRaises(ValidationError):
            Coupon(
                code="A",
                discount_type=Coupon.FIXED,
                amount=Decimal("5000"),
                percent=10,
            ).clean()

    def test_expires_at_must_be_after_starts_at(self):
        now = timezone.now()
        with self.assertRaises(ValidationError):
            Coupon(
                code="A",
                percent=10,
                starts_at=now,
                expires_at=now - timedelta(days=1),
            ).clean()

    def test_open_ended_window_is_valid(self):
        Coupon(code="A", percent=10).clean()
        Coupon(code="A", percent=10, starts_at=timezone.now()).clean()
        Coupon(code="A", percent=10, expires_at=timezone.now()).clean()

    def test_coupon_product_is_unique_per_coupon_and_mattress(self):
        from django.db import IntegrityError, transaction

        coupon = Coupon.objects.create(code="A", percent=10)
        mattress = make_mattress()
        CouponProduct.objects.create(coupon=coupon, mattress=mattress)
        # Wrapped in its own atomic block: without it the IntegrityError poisons
        # the surrounding transaction and the test errors at teardown instead of
        # passing.
        with self.assertRaises(IntegrityError), transaction.atomic():
            CouponProduct.objects.create(coupon=coupon, mattress=mattress)


# ═══ Order fields ══════════════════════════════════════════════════════════════


class OrderCouponFieldTests(TestCase):
    def test_order_defaults_to_no_coupon_and_zero_discount(self):
        customer = make_customer()
        order = Order.objects.create(customer=customer, method=Order.ONLINE)
        self.assertIsNone(order.coupon_id)
        self.assertEqual(order.coupon_code, "")
        self.assertEqual(order.discount_amount, Decimal("0"))

    def test_redeemed_coupon_cannot_be_deleted(self):
        from django.db.models import ProtectedError

        customer = make_customer()
        coupon = Coupon.objects.create(code="A", percent=10)
        Order.objects.create(
            customer=customer, method=Order.ONLINE, coupon=coupon, coupon_code="A"
        )
        with self.assertRaises(ProtectedError):
            coupon.delete()


# ═══ engine: arithmetic ════════════════════════════════════════════════════════


def paid_order(customer: Customer, coupon: Coupon, amount: str = "1000") -> Order:
    """An order that has been paid for and therefore spent a use.

    Redemption is what the limits count, so a test about a limit needs one of
    these rather than an order alone.
    """
    order = Order.objects.create(
        customer=customer,
        method=Order.ONLINE,
        status=Order.CONFIRMED,
        coupon=coupon,
        coupon_code=coupon.code,
        discount_amount=Decimal(amount),
    )
    CouponRedemption.objects.create(
        coupon=coupon, order=order, customer=customer, amount=Decimal(amount)
    )
    return order


class DiscountArithmeticTests(TestCase):
    def test_percent_discount_rounds_like_the_product_sale(self):
        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="10000000"))
        coupon = Coupon.objects.create(code="TEN", percent=10)
        self.assertEqual(calculate_discount(coupon, cart), Decimal("1000000.00"))

    def test_percent_discount_rounds_half_up_to_two_places(self):
        # 10,000,000 × 10% would divide evenly; 333,333 at 10% is 33,333.3, so
        # the rounding rule rather than luck decides the cents.
        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="333333"))
        coupon = Coupon.objects.create(code="TEN", percent=10)
        self.assertEqual(calculate_discount(coupon, cart), Decimal("33333.30"))

    def test_max_discount_amount_bounds_a_percent_coupon(self):
        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="10000000"))
        coupon = Coupon.objects.create(
            code="TEN", percent=10, max_discount_amount=Decimal("500000")
        )
        self.assertEqual(calculate_discount(coupon, cart), Decimal("500000.00"))

    def test_fixed_discount(self):
        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="10000000"))
        coupon = Coupon.objects.create(
            code="FIX", discount_type=Coupon.FIXED, amount=Decimal("2000000")
        )
        self.assertEqual(calculate_discount(coupon, cart), Decimal("2000000.00"))

    def test_fixed_discount_larger_than_the_subtotal_is_clamped(self):
        customer = make_customer()
        coupon = Coupon.objects.create(
            code="BIG", discount_type=Coupon.FIXED, amount=Decimal("9999999")
        )
        cart = make_cart(customer, make_mattress(price="1000000"), coupon=coupon)
        self.assertEqual(calculate_discount(coupon, cart), Decimal("1000000.00"))
        # …and the payable total therefore never goes negative.
        self.assertEqual(cart.total, Decimal("0.00"))

    def test_mixed_cart_discounts_only_the_eligible_line(self):
        customer = make_customer()
        pillow = make_mattress(slug="pillow", price="2000000")
        bed = make_mattress(slug="bed", price="10000000")
        coupon = Coupon.objects.create(
            code="BED10", percent=10, applies_to_all_products=False
        )
        CouponProduct.objects.create(coupon=coupon, mattress=bed)
        cart = make_cart(customer, pillow, bed, coupon=coupon)

        self.assertEqual(eligible_subtotal(coupon, cart), Decimal("10000000.00"))
        self.assertEqual(calculate_discount(coupon, cart), Decimal("1000000.00"))
        self.assertEqual(cart.total, Decimal("11000000.00"))

    def test_all_products_coupon_discounts_the_whole_cart(self):
        customer = make_customer()
        cart = make_cart(
            customer,
            make_mattress(slug="a", price="2000000"),
            make_mattress(slug="b", price="8000000"),
        )
        coupon = Coupon.objects.create(code="ALL10", percent=10)
        self.assertEqual(calculate_discount(coupon, cart), Decimal("1000000.00"))

    def test_stacking_multiplies_against_the_sale_price(self):
        # A product already 20% off the 10,000,000 list price sells for
        # 8,000,000. A 10% coupon takes 800,000 off that, landing at 7,200,000
        # — 28% off list, which is what "stack on the sale price" means.
        customer = make_customer()
        mattress = make_mattress(price="10000000")
        # is_on_off is load-bearing: `Mattress.has_discount` is
        # `is_on_off and off_percentage > 0`, so setting off_percentage alone
        # leaves final_price at the full price and this test would silently
        # assert the wrong thing.
        mattress.is_on_off = True
        mattress.off_percentage = 20
        mattress.save(update_fields=["is_on_off", "off_percentage"])
        coupon = Coupon.objects.create(code="TEN", percent=10)
        cart = make_cart(customer, mattress, coupon=coupon)

        self.assertEqual(cart.subtotal, Decimal("8000000.00"))
        self.assertEqual(calculate_discount(coupon, cart), Decimal("800000.00"))
        self.assertEqual(cart.total, Decimal("7200000.00"))

    def test_coupon_with_nothing_eligible_discounts_nothing(self):
        customer = make_customer()
        pillow = make_mattress(slug="pillow", price="2000000")
        bed = make_mattress(slug="bed", price="10000000")
        coupon = Coupon.objects.create(
            code="BED10", percent=10, applies_to_all_products=False
        )
        CouponProduct.objects.create(coupon=coupon, mattress=bed)
        cart = make_cart(customer, pillow, coupon=coupon)
        self.assertEqual(eligible_subtotal(coupon, cart), Decimal("0"))
        self.assertEqual(calculate_discount(coupon, cart), Decimal("0"))
        self.assertEqual(cart.total, Decimal("2000000.00"))

    def test_no_coupon_means_no_discount(self):
        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="5000000"))
        self.assertEqual(cart.discount_amount, Decimal("0"))
        self.assertEqual(cart.total, cart.subtotal)


# ═══ engine: eligibility rules ═════════════════════════════════════════════════


class ValidateCouponTests(TestCase):
    def setUp(self):
        self.customer = make_customer()
        self.cart = make_cart(self.customer, make_mattress(price="10000000"))

    def test_an_ordinary_coupon_passes(self):
        coupon = Coupon.objects.create(code="OK", percent=10)
        self.assertIsNone(validate_coupon(coupon, self.cart, self.customer))

    def test_inactive(self):
        coupon = Coupon.objects.create(code="OFF", percent=10, is_active=False)
        self.assertEqual(
            validate_coupon(coupon, self.cart, self.customer),
            "این کد تخفیف غیرفعال است.",
        )

    def test_not_started_yet(self):
        coupon = Coupon.objects.create(
            code="SOON", percent=10, starts_at=timezone.now() + timedelta(days=1)
        )
        self.assertEqual(
            validate_coupon(coupon, self.cart, self.customer),
            "این کد تخفیف هنوز فعال نشده است.",
        )

    def test_expired(self):
        coupon = Coupon.objects.create(
            code="OLD", percent=10, expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(
            validate_coupon(coupon, self.cart, self.customer),
            "این کد تخفیف منقضی شده است.",
        )

    def test_expires_at_is_exclusive(self):
        # Exactly at expires_at the coupon is already spent — the boundary is
        # asserted here so an off-by-one cannot slip in later.
        coupon = Coupon.objects.create(
            code="EDGE", percent=10, expires_at=timezone.now()
        )
        self.assertEqual(
            validate_coupon(coupon, self.cart, self.customer),
            "این کد تخفیف منقضی شده است.",
        )

    def test_starts_at_is_inclusive(self):
        coupon = Coupon.objects.create(
            code="NOW", percent=10, starts_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertIsNone(validate_coupon(coupon, self.cart, self.customer))

    def test_nothing_eligible(self):
        # A fresh customer: setUp already gave self.customer a cart, and the
        # relation is a OneToOne.
        customer = make_customer("09120000010")
        pillow = make_mattress(slug="pillow", price="2000000")
        cart = make_cart(customer, pillow)
        bed = make_mattress(slug="bed", price="10000000")
        coupon = Coupon.objects.create(
            code="BED10", percent=10, applies_to_all_products=False
        )
        CouponProduct.objects.create(coupon=coupon, mattress=bed)
        self.assertEqual(
            validate_coupon(coupon, cart, customer),
            "این کد تخفیف برای محصولات سبد خرید شما معتبر نیست.",
        )

    def test_below_minimum_order_uses_the_eligible_subtotal(self):
        # Cart is 12,000,000 but only 2,000,000 of it is eligible; a 5,000,000
        # minimum must therefore fail. This is the rule that catches a cart
        # padded with an unrelated expensive product.
        customer = make_customer("09120000011")
        pillow = make_mattress(slug="pillow", price="2000000")
        bed = make_mattress(slug="bed", price="10000000")
        cart = make_cart(customer, pillow, bed)
        coupon = Coupon.objects.create(
            code="MIN",
            percent=10,
            applies_to_all_products=False,
            min_order_amount=Decimal("5000000"),
        )
        CouponProduct.objects.create(coupon=coupon, mattress=pillow)
        self.assertEqual(
            validate_coupon(coupon, cart, customer),
            "این کد تخفیف برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان است.",
        )

    def test_at_exactly_the_minimum_order_the_coupon_applies(self):
        coupon = Coupon.objects.create(
            code="MIN", percent=10, min_order_amount=Decimal("10000000")
        )
        self.assertIsNone(validate_coupon(coupon, self.cart, self.customer))

    def test_usage_limit_reached(self):
        coupon = Coupon.objects.create(code="ONE", percent=10, usage_limit=1)
        paid_order(make_customer("09120000001"), coupon)
        self.assertEqual(
            validate_coupon(coupon, self.cart, self.customer),
            "ظرفیت استفاده از این کد تخفیف تکمیل شده است.",
        )

    def test_usage_limit_is_not_reached_before_the_first_use(self):
        coupon = Coupon.objects.create(code="ONE", percent=10, usage_limit=1)
        self.assertIsNone(validate_coupon(coupon, self.cart, self.customer))

    def test_per_customer_limit_reached(self):
        coupon = Coupon.objects.create(code="ONCE", percent=10, per_customer_limit=1)
        paid_order(self.customer, coupon)
        self.assertEqual(
            validate_coupon(coupon, self.cart, self.customer),
            "شما پیش‌تر از این کد تخفیف استفاده کرده‌اید.",
        )

    def test_per_customer_limit_is_per_customer(self):
        coupon = Coupon.objects.create(code="ONCE", percent=10, per_customer_limit=1)
        paid_order(make_customer("09120000002"), coupon)
        self.assertIsNone(validate_coupon(coupon, self.cart, self.customer))

    def test_a_cancelled_order_does_not_count_against_either_limit(self):
        coupon = Coupon.objects.create(
            code="ONE", percent=10, usage_limit=1, per_customer_limit=1
        )
        order = paid_order(self.customer, coupon)
        order.status = Order.CANCELLED
        order.save(update_fields=["status"])

        self.assertEqual(redeemed_count(coupon), 0)
        self.assertEqual(customer_redemption_count(coupon, self.customer), 0)
        self.assertIsNone(validate_coupon(coupon, self.cart, self.customer))

    def test_rules_are_checked_in_specificity_order(self):
        # Inactive beats everything: a deactivated code that is also expired
        # must say so, not blame the date.
        coupon = Coupon.objects.create(
            code="OFF",
            percent=10,
            is_active=False,
            expires_at=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(
            validate_coupon(coupon, self.cart, self.customer),
            "این کد تخفیف غیرفعال است.",
        )


class CouponStatusTests(TestCase):
    def test_statuses(self):
        self.assertEqual(coupon_status(Coupon(percent=10, is_active=False)), "INACTIVE")
        self.assertEqual(
            coupon_status(
                Coupon(percent=10, starts_at=timezone.now() + timedelta(days=1))
            ),
            "SCHEDULED",
        )
        self.assertEqual(
            coupon_status(
                Coupon(percent=10, expires_at=timezone.now() - timedelta(days=1))
            ),
            "EXPIRED",
        )
        self.assertEqual(coupon_status(Coupon(percent=10)), "ACTIVE")

    def test_exhausted(self):
        coupon = Coupon.objects.create(code="ONE", percent=10, usage_limit=1)
        paid_order(make_customer("09120000003"), coupon)
        self.assertEqual(coupon_status(coupon), "EXHAUSTED")

    def test_persian_amount_formatting(self):
        self.assertEqual(
            minimum_order_message(Decimal("5000000")),
            "این کد تخفیف برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان است.",
        )


# ═══ customer cart API ═════════════════════════════════════════════════════════


class CartCouponApiTests(APITestCase):
    URL = "/api/cart/coupon/"

    def setUp(self):
        self.customer = make_customer()
        self.mattress = make_mattress(price="10000000")
        self.cart = make_cart(self.customer, self.mattress)
        self.client.force_authenticate(self.customer.user)

    def test_applying_a_code_returns_the_whole_cart_payload(self):
        Coupon.objects.create(code="SALYCO10", percent=10)
        res = self.client.post(self.URL, {"code": "salyco10"}, format="json")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["coupon"]["code"], "SALYCO10")
        self.assertEqual(res.data["coupon"]["percent"], 10)
        self.assertEqual(res.data["subtotal"], "10000000.00")
        self.assertEqual(res.data["discount_amount"], "1000000.00")
        self.assertEqual(res.data["total"], "9000000.00")

    def test_lowercase_and_padded_codes_are_accepted(self):
        Coupon.objects.create(code="SALYCO10", percent=10)
        res = self.client.post(self.URL, {"code": "  salyco 10 "}, format="json")
        # " salyco 10 " normalises to "SALYCO 10", not "SALYCO10", so this must
        # NOT match — the internal space is the interesting half of this test.
        self.assertEqual(res.status_code, 400)

    def test_a_padded_code_matches(self):
        Coupon.objects.create(code="SALYCO10", percent=10)
        res = self.client.post(self.URL, {"code": " SALYCO10 "}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_unknown_code(self):
        res = self.client.post(self.URL, {"code": "NOPE"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "کد تخفیف یافت نشد.")

    def test_empty_code(self):
        res = self.client.post(self.URL, {"code": "   "}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "کد تخفیف را وارد کنید.")

    def test_a_rule_failure_is_returned_verbatim(self):
        Coupon.objects.create(code="OFF", percent=10, is_active=False)
        res = self.client.post(self.URL, {"code": "OFF"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "این کد تخفیف غیرفعال است.")

    def test_applying_on_an_empty_cart_is_refused(self):
        CartItem.objects.all().delete()
        Coupon.objects.create(code="SALYCO10", percent=10)
        res = self.client.post(self.URL, {"code": "SALYCO10"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "سبد خرید شما خالی است.")

    def test_applying_a_second_code_replaces_the_first(self):
        Coupon.objects.create(code="TEN", percent=10)
        second = Coupon.objects.create(code="TWENTY", percent=20)
        self.client.post(self.URL, {"code": "TEN"}, format="json")

        res = self.client.post(self.URL, {"code": "TWENTY"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.cart.refresh_from_db()
        self.assertEqual(self.cart.coupon_id, second.pk)
        self.assertEqual(res.data["discount_amount"], "2000000.00")

    def test_removing_clears_the_coupon(self):
        Coupon.objects.create(code="TEN", percent=10)
        self.client.post(self.URL, {"code": "TEN"}, format="json")

        res = self.client.delete(self.URL)
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["coupon"])
        # Quantized to the field's two places, so "0.00" rather than "0".
        self.assertEqual(res.data["discount_amount"], "0.00")
        self.assertEqual(res.data["total"], "10000000.00")
        self.cart.refresh_from_db()
        self.assertIsNone(self.cart.coupon_id)

    def test_removing_when_nothing_is_applied_is_still_a_200(self):
        # Idempotent on purpose: the frontend never has to check first.
        res = self.client.delete(self.URL)
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["coupon"])

    def test_anonymous_is_refused(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.URL, {"code": "X"}).status_code, 401)

    def test_covered_by_coupon_flags_only_the_eligible_line(self):
        pillow = make_mattress(slug="pillow", price="2000000")
        CartItem.objects.create(cart=self.cart, mattress=pillow, quantity=1)
        coupon = Coupon.objects.create(
            code="BED10", percent=10, applies_to_all_products=False
        )
        CouponProduct.objects.create(coupon=coupon, mattress=self.mattress)
        self.client.post(self.URL, {"code": "BED10"}, format="json")

        res = self.client.get("/api/cart/")
        by_mattress = {row["mattress"]: row for row in res.data["items"]}
        self.assertTrue(by_mattress[self.mattress.pk]["covered_by_coupon"])
        self.assertFalse(by_mattress[pillow.pk]["covered_by_coupon"])

    def test_covered_by_coupon_is_false_for_every_line_with_no_coupon(self):
        res = self.client.get("/api/cart/")
        self.assertFalse(res.data["items"][0]["covered_by_coupon"])

    def test_all_products_coupon_covers_every_line(self):
        pillow = make_mattress(slug="pillow", price="2000000")
        CartItem.objects.create(cart=self.cart, mattress=pillow, quantity=1)
        Coupon.objects.create(code="ALL10", percent=10)
        self.client.post(self.URL, {"code": "ALL10"}, format="json")

        res = self.client.get("/api/cart/")
        self.assertTrue(all(row["covered_by_coupon"] for row in res.data["items"]))
