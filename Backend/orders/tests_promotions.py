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

from mattress.models import Mattress
from users.models import Customer, User

from .models import Cart, CartItem, Coupon, CouponProduct, CouponRedemption, Order


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


def make_cart(customer: Customer, *mattresses: Mattress) -> Cart:
    cart = Cart.objects.create(customer=customer)
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
