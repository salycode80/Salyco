# Discount Codes (Coupons) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Do not dispatch subagents.** Work through every task in this session, in order.

**Goal:** Add a coupon system — admin-managed discount codes with validity windows, usage caps, eligibility rules and product scoping — threaded through the existing cart → order → Zibal payment flow so the gateway amount, the order page and the staff panel all agree.

**Architecture:** Models and the eligibility engine live in the `orders` app (`orders/models.py`, new `orders/promotions.py`), because `Coupon` hangs off the cart → order aggregate and `PaymentStartView` must call the engine. `orders/promotions.py` holds pure functions over an already-fetched cart so every rule is testable without HTTP. The applied coupon is persisted on `Cart`, re-validated at payment start, frozen onto `Order`, and finally recorded as a `CouponRedemption` row only when settlement confirms the money.

**Tech Stack:** Django 6.0.6 + DRF (backend, `Backend/`), React 19 + Vite + Tailwind v4 (frontend, `Frontend/salyco-front/`), SQLite in dev.

**Spec:** `docs/superpowers/specs/2026-09-22-discount-coupons-design.md`

## Global Constraints

- **Backend commands run from `Backend/` through the project venv:** `./env/Scripts/python.exe manage.py <cmd>`. There is no activated virtualenv and no `python` on PATH that has Django.
- **Frontend commands run from `Frontend/salyco-front/`:** `npm run lint`, `npm run build`, `npm run dev`.
- **No `pytest`.** Tests are Django `TestCase` / `APITestCase` with `unittest.mock.patch`, discovered by `manage.py test`. Run them with `./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`.
- **All user-facing strings are Persian and live on the server** where the frontend can display them verbatim from `{"detail": ...}`. Never build a user-facing message in JS when the server already knows the rule.
- **Money is `Decimal`, Toman, 2 decimal places, rounded with `ROUND_HALF_UP`.** Reuse `mattress.models.apply_discount`; never re-derive a rounding rule.
- **Persian digits in rendered numbers** go through the existing helpers: `toPersianNumber` / `formatPersianPrice` from `src/utils/persian.js`.
- **Commit after every task.** The repo's default branch is `master`; work directly on it (this repo has no feature-branch convention and the user has not asked for one).
- Frontend has **no test runner** — its verification is `npm run lint` (baseline: 69 pre-existing problems, do not add to it), `npm run build` (must stay clean), and CDP screenshots against the dev server.
- Do not change `Cart.total`'s *name* or `Order.total_amount`'s *meaning*: `total` is what the customer owes. `payments/views.py` and every SMS/order-page consumer depend on that and must keep working untouched.

---

## File Structure

**Backend — `Backend/`**
| File | Responsibility |
|---|---|
| `orders/models.py` | *(modify)* `Coupon`, `CouponProduct`, `CouponRedemption`; `Cart.coupon` + money properties; `Order.coupon` + snapshots |
| `orders/migrations/0005_coupons.py` | *(generated)* the additive schema change |
| `orders/promotions.py` | *(new)* the engine: eligibility, validation, arithmetic, status. Pure functions, no HTTP |
| `orders/serializers.py` | *(modify)* cart payload gains `subtotal` / `discount_amount` / `coupon`; items gain `covered_by_coupon`; orders gain `coupon_code` / `discount_amount` |
| `orders/views.py` | *(modify)* `CartCouponView` |
| `orders/urls.py` | *(modify)* `cart/coupon/`, the three admin coupon routes |
| `orders/checkout.py` | *(modify)* freeze the coupon onto the order |
| `orders/admin_serializers.py` | *(modify)* `AdminCouponSerializer`, `AdminCouponRedemptionSerializer`; order serializers gain the coupon fields |
| `orders/admin_views.py` | *(modify)* coupon list/detail/redemptions views |
| `orders/tests_promotions.py` | *(new)* every backend test for this feature |
| `payments/views.py` | *(modify)* re-validate the coupon before creating the order |
| `payments/settlement.py` | *(modify)* write the redemption when the payment is confirmed |

**Frontend — `Frontend/salyco-front/src/`**
| File | Responsibility |
|---|---|
| `api/cart.js` | *(modify)* `applyCartCoupon`, `removeCartCoupon` |
| `api/admin.js` | *(modify)* coupon CRUD + redemptions |
| `context/CartContext.jsx` | *(modify)* own `coupon` / `discount` / `subtotal`; `applyCoupon` / `removeCoupon` |
| `pages/CartPage.jsx` | *(modify)* the code input, the applied state, the «تخفیف» row |
| `pages/checkout/CheckoutOrder.jsx` | *(modify)* read-only discount line |
| `pages/admin/CouponsPanel.jsx` | *(new)* the admin CRUD panel |
| `pages/admin/AdminWorkspace.jsx` | *(modify)* nav entry |
| `pages/admin/OrdersPanel.jsx` | *(modify)* the code and the discount on an order |
| `App.jsx` | *(modify)* the `/admin/coupons` route |

---

### Task 1: Coupon data model

**Files:**
- Modify: `Backend/orders/models.py`
- Create: `Backend/orders/migrations/0005_coupons.py` (via `makemigrations --name coupons`)
- Test: `Backend/orders/tests_promotions.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `Coupon` (fields `code, description, discount_type, percent, amount, max_discount_amount, min_order_amount, starts_at, expires_at, usage_limit, per_customer_limit, applies_to_all_products, is_active, created_at`; constants `Coupon.PERCENT`, `Coupon.FIXED`; methods `save()`, `clean()`); `CouponProduct` (`coupon`, `mattress`); `CouponRedemption` (`coupon`, `order` OneToOne, `customer`, `amount`, `created_at`); `Cart.coupon`; `Order.coupon` / `Order.coupon_code` / `Order.discount_amount`.

- [ ] **Step 1: Write the failing tests**

Create `Backend/orders/tests_promotions.py`:

```python
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

    def test_internal_whitespace_is_collapsed(self):
        coupon = Coupon.objects.create(code="salyco  10", percent=10)
        self.assertEqual(coupon.code, "SALYCO10")

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
        coupon = Coupon.objects.create(code="A", percent=10)
        mattress = make_mattress()
        CouponProduct.objects.create(coupon=coupon, mattress=mattress)
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: `ImportError: cannot import name 'Coupon' from 'orders.models'`

- [ ] **Step 3: Add the models**

In `Backend/orders/models.py`, add `ValidationError` to the imports at the top:

```python
from django.core.exceptions import ValidationError
from django.db import models
```

Insert **above** `class Order` (so `Order.coupon` can name `Coupon` directly), i.e. between `CartItem` and `Order`:

```python
class Coupon(models.Model):
    """An admin-authored discount code.

    Scoped through the cart → order → payment flow: it is applied to a Cart,
    re-validated at payment start, frozen onto the Order it creates, and only
    counted as used once settlement confirms the money moved.
    """

    PERCENT = "PERCENT"
    FIXED = "FIXED"
    DISCOUNT_TYPE_CHOICES = [(PERCENT, "Percent"), (FIXED, "Fixed amount")]

    code = models.CharField(max_length=32, unique=True, verbose_name="code")
    description = models.CharField(
        max_length=255, blank=True, default="", verbose_name="description"
    )

    discount_type = models.CharField(
        max_length=10,
        choices=DISCOUNT_TYPE_CHOICES,
        default=PERCENT,
        verbose_name="discount type",
    )
    # 1..99 for PERCENT, null for FIXED. The ceiling is 99 rather than 100
    # because a 100% coupon makes the payable amount zero, and PaymentStartView
    # refuses an amount at or below MIN_AMOUNT_RIAL — Zibal cannot charge zero.
    # A 100% coupon would be creatable in the panel and impossible to redeem.
    percent = models.PositiveIntegerField(null=True, blank=True, verbose_name="percent")
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="amount (Toman)",
    )
    # Bounds a PERCENT coupon. Ignored for FIXED, whose `amount` is its own cap.
    max_discount_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="maximum discount",
    )
    # Measured against the ELIGIBLE subtotal, not the whole cart: a coupon that
    # covers one product must not be unlocked by an unrelated expensive line.
    min_order_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        verbose_name="minimum order amount",
    )

    # Null means unbounded on that side. Both compare against timezone.now().
    starts_at = models.DateTimeField(null=True, blank=True, verbose_name="starts at")
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name="expires at")

    # Null means unlimited. Counted over non-cancelled orders only, so a
    # cancelled order gives the use back.
    usage_limit = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="usage limit"
    )
    per_customer_limit = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="per-customer limit"
    )

    applies_to_all_products = models.BooleanField(
        default=True, verbose_name="applies to all products"
    )
    # Kill switch, independent of the dates: staff can stop a campaign now
    # without editing (and thereby losing) its validity window.
    is_active = models.BooleanField(default=True, verbose_name="is active")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "coupon"
        verbose_name_plural = "coupons"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.code

    def save(self, *args, **kwargs):
        """Normalise the code, so every lookup can be a plain equality test.

        Trimming and collapsing means " salyco 10 " and "SALYCO10" are the same
        coupon; upper() is a no-op for Persian codes, which are allowed.
        """
        self.code = " ".join((self.code or "").split()).upper()
        super().save(*args, **kwargs)

    def clean(self):
        """The cross-field rules no single field can express.

        Scope is deliberately NOT checked here: at creation time the coupon has
        no pk and therefore no CouponProduct rows to count, so "at least one
        product when applies_to_all_products is off" is enforced by
        AdminCouponSerializer.validate(), which is the only place that sees the
        submitted product_ids. See promotions.py for the runtime rules.
        """
        errors = {}

        if self.discount_type == self.PERCENT:
            if self.percent is None:
                errors["percent"] = "برای تخفیف درصدی، درصد تخفیف الزامی است."
            elif not 1 <= self.percent <= 99:
                errors["percent"] = "درصد تخفیف باید بین ۱ تا ۹۹ باشد."
            if self.amount is not None:
                errors["amount"] = "برای تخفیف درصدی، مبلغ ثابت نباید تعیین شود."
        else:
            if self.amount is None or self.amount <= 0:
                errors["amount"] = "برای تخفیف مبلغی، مبلغ باید بیشتر از صفر باشد."
            if self.percent is not None:
                errors["percent"] = "برای تخفیف مبلغی، درصد نباید تعیین شود."

        if self.starts_at and self.expires_at and self.expires_at <= self.starts_at:
            errors["expires_at"] = "تاریخ پایان باید بعد از تاریخ شروع باشد."

        if errors:
            raise ValidationError(errors)


class CouponProduct(models.Model):
    """The admin's «محصولات مشمول» list.

    Scoped per product, not per size: a size has no independent campaign
    meaning here, so every size of a listed product follows the coupon.
    """

    coupon = models.ForeignKey(
        Coupon, on_delete=models.CASCADE, related_name="products", verbose_name="coupon"
    )
    mattress = models.ForeignKey(
        Mattress, on_delete=models.CASCADE, related_name="+", verbose_name="product"
    )

    class Meta:
        verbose_name = "coupon product"
        verbose_name_plural = "coupon products"
        unique_together = [("coupon", "mattress")]

    def __str__(self) -> str:
        return f"{self.coupon.code} → {self.mattress.name}"
```

On `Cart`, add the relation next to `customer` and the money properties:

```python
    # The coupon the customer has applied but not yet paid with. SET_NULL, not
    # CASCADE: retiring a coupon must not take live carts with it, it must just
    # stop discounting them.
    coupon = models.ForeignKey(
        Coupon,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="coupon",
    )
```

and replace the existing `total` property with the three-property block:

```python
    @property
    def subtotal(self) -> Decimal:
        """What the lines add up to before any coupon."""
        return sum((item.line_total for item in self.items.all()), Decimal("0"))

    @property
    def discount_amount(self) -> Decimal:
        """What the applied coupon takes off. Zero when none is applied."""
        if self.coupon_id is None:
            return Decimal("0")
        # Imported locally: promotions imports this module for the models it
        # queries, so a module-level import here would be a cycle.
        from .promotions import calculate_discount

        return calculate_discount(self.coupon, self)

    @property
    def total(self) -> Decimal:
        """Payable. Keeps its name so payments/views.py:87
        (`toman_to_rial(cart.total)`) stays correct without being edited."""
        return max(self.subtotal - self.discount_amount, Decimal("0"))
```

On `Order`, add the three fields after `total_amount`:

```python
    # PROTECT rather than SET_NULL: an order that was discounted must keep the
    # coupon that did it, so a redeemed coupon cannot be deleted at all. The
    # admin API turns that into a Persian message instead of a 500.
    coupon = models.ForeignKey(
        Coupon,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="coupon",
    )
    # Snapshot: a coupon renamed or deactivated later must not rewrite history.
    coupon_code = models.CharField(
        max_length=32, blank=True, default="", verbose_name="coupon code"
    )
    discount_amount = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="discount amount"
    )
```

Then add `CouponRedemption` **after** `OrderItem`:

```python
class CouponRedemption(models.Model):
    """One row per PAID order that used a coupon.

    Written by settlement, never at redirect: an abandoned bank page must not
    burn a use. The OneToOne on `order` is what makes settlement idempotent —
    see payments/settlement.py.
    """

    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.CASCADE,
        related_name="redemptions",
        verbose_name="coupon",
    )
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="redemption",
        verbose_name="order",
    )
    # PROTECT: the record of who used a code outlives the customer row.
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="+",
        verbose_name="customer",
    )
    amount = models.DecimalField(
        max_digits=18, decimal_places=2, verbose_name="amount (Toman)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "coupon redemption"
        verbose_name_plural = "coupon redemptions"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.coupon.code} × {self.amount}"
```

- [ ] **Step 4: Generate the migration**

Run: `cd Backend && ./env/Scripts/python.exe manage.py makemigrations orders --name coupons`
Expected: `orders/migrations/0005_coupons.py` created. Confirm it contains `CreateModel` for `Coupon`, `CouponProduct`, `CouponRedemption` and `AddField` for `cart.coupon`, `order.coupon`, `order.coupon_code`, `order.discount_amount`. It must be purely additive — no `RemoveField`, no `AlterField` on an existing column.

Then apply it: `./env/Scripts/python.exe manage.py migrate orders`
Expected: `Applying orders.0005_coupons... OK`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: PASS — 12 tests.

Two of them (`Cart.discount_amount`, and the `ProtectedError` one) will not pass until Task 2's `promotions.py` exists, because `Cart.discount_amount` imports it. If the import error surfaces here, create `Backend/orders/promotions.py` now with only the module docstring and move on; Task 2 fills it in.

- [ ] **Step 6: Commit**

```bash
cd /e/salyco-fullstack
git add Backend/orders/models.py Backend/orders/migrations/0005_coupons.py Backend/orders/tests_promotions.py
git commit -m "feat(orders): add coupon, product scope and redemption models

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: The promotion engine

**Files:**
- Create: `Backend/orders/promotions.py`
- Modify: `Backend/orders/models.py` (only if Task 1 deferred `Cart.discount_amount`)
- Test: `Backend/orders/tests_promotions.py`

**Interfaces:**
- Consumes: `Coupon`, `CouponProduct`, `CouponRedemption`, `Cart`, `CartItem`, `Order` from Task 1; `mattress.models.apply_discount(price: Decimal, percentage: int) -> Decimal`.
- Produces:
  - `eligible_items(coupon, cart) -> list[CartItem]`
  - `eligible_subtotal(coupon, cart) -> Decimal`
  - `validate_coupon(coupon, cart, customer) -> str | None`
  - `calculate_discount(coupon, cart) -> Decimal`
  - `coupon_status(coupon) -> str`
  - `redeemed_count(coupon) -> int`
  - `customer_redemption_count(coupon, customer) -> int`
  - Constants: `STATUS_INACTIVE/SCHEDULED/ACTIVE/EXPIRED/EXHAUSTED` (the string values are `"INACTIVE"`, `"SCHEDULED"`, `"ACTIVE"`, `"EXPIRED"`, `"EXHAUSTED"`), `COUPON_NOT_FOUND_MESSAGE`, and the six rule messages.

- [ ] **Step 1: Write the failing tests**

Append to `Backend/orders/tests_promotions.py` — first add these to the existing
top-of-file import block, since they are module-level imports and do not belong
next to the test classes:

```python
from . import promotions
from .promotions import (
    calculate_discount,
    coupon_status,
    customer_redemption_count,
    eligible_subtotal,
    redeemed_count,
    validate_coupon,
)
```

Then append the test classes:

```python
def paid_order(customer: Customer, coupon: Coupon, amount: str = "1000") -> Order:
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
        # 333333 * 10% = 33333.3 exactly → 33333.30. A price chosen so the
        # rounding rule, not luck, decides the cents.
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
        cart = make_cart(customer, make_mattress(price="1000000"))
        coupon = Coupon.objects.create(
            code="BIG", discount_type=Coupon.FIXED, amount=Decimal("9999999")
        )
        self.assertEqual(calculate_discount(coupon, cart), Decimal("1000000.00"))
        # …and the payable total therefore never goes negative.
        self.assertEqual(cart.total, Decimal("0.00"))

    def test_mixed_cart_discounts_only_the_eligible_line(self):
        customer = make_customer()
        pillow = make_mattress(slug="pillow", price="2000000")
        bed = make_mattress(slug="bed", price="10000000")
        cart = make_cart(customer, pillow, bed)
        coupon = Coupon.objects.create(
            code="BED10", percent=10, applies_to_all_products=False
        )
        CouponProduct.objects.create(coupon=coupon, mattress=bed)

        self.assertEqual(eligible_subtotal(coupon, cart), Decimal("10000000.00"))
        self.assertEqual(calculate_discount(coupon, cart), Decimal("1000000.00"))
        self.assertEqual(cart.total, Decimal("11000000.00"))

    def test_all_products_coupon_discounts_the_whole_cart(self):
        customer = make_customer()
        cart = make_cart(
            customer, make_mattress(slug="a", price="2000000"), make_mattress(slug="b", price="8000000")
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
        cart = make_cart(customer, mattress)
        coupon = Coupon.objects.create(code="TEN", percent=10)

        self.assertEqual(cart.subtotal, Decimal("8000000.00"))
        self.assertEqual(calculate_discount(coupon, cart), Decimal("800000.00"))
        self.assertEqual(cart.total, Decimal("7200000.00"))

    def test_coupon_with_nothing_eligible_discounts_nothing(self):
        customer = make_customer()
        pillow = make_mattress(slug="pillow", price="2000000")
        bed = make_mattress(slug="bed", price="10000000")
        cart = make_cart(customer, pillow)
        coupon = Coupon.objects.create(
            code="BED10", percent=10, applies_to_all_products=False
        )
        CouponProduct.objects.create(coupon=coupon, mattress=bed)
        self.assertEqual(eligible_subtotal(coupon, cart), Decimal("0"))
        self.assertEqual(calculate_discount(coupon, cart), Decimal("0"))
        self.assertEqual(cart.total, Decimal("2000000.00"))

    def test_no_coupon_means_no_discount(self):
        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="5000000"))
        self.assertEqual(cart.discount_amount, Decimal("0"))
        self.assertEqual(cart.total, cart.subtotal)


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
        pillow = make_mattress(slug="pillow", price="2000000")
        cart = make_cart(self.customer, pillow)
        bed = make_mattress(slug="bed", price="10000000")
        coupon = Coupon.objects.create(
            code="BED10", percent=10, applies_to_all_products=False
        )
        CouponProduct.objects.create(coupon=coupon, mattress=bed)
        self.assertEqual(
            validate_coupon(coupon, cart, self.customer),
            "این کد تخفیف برای محصولات سبد خرید شما معتبر نیست.",
        )

    def test_below_minimum_order_uses_the_eligible_subtotal(self):
        # Cart is 12,000,000 but only 2,000,000 of it is eligible; a 5,000,000
        # minimum must therefore fail. This is the rule that catches a cart
        # padded with an unrelated expensive product.
        pillow = make_mattress(slug="pillow", price="2000000")
        bed = make_mattress(slug="bed", price="10000000")
        cart = make_cart(self.customer, pillow, bed)
        coupon = Coupon.objects.create(
            code="MIN",
            percent=10,
            applies_to_all_products=False,
            min_order_amount=Decimal("5000000"),
        )
        CouponProduct.objects.create(coupon=coupon, mattress=pillow)
        self.assertEqual(
            validate_coupon(coupon, cart, self.customer),
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
            promotions.minimum_order_message(Decimal("5000000")),
            "این کد تخفیف برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان است.",
        )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: `ModuleNotFoundError: No module named 'orders.promotions'`

- [ ] **Step 3: Write the engine**

Create `Backend/orders/promotions.py`:

```python
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
        CouponProduct.objects.filter(coupon=coupon).values_list(
            "mattress_id", flat=True
        )
    )
    return [item for item in items if item.mattress_id in allowed]


def eligible_subtotal(coupon: Coupon, cart) -> Decimal:
    """What the covered lines add up to, at their current sale prices."""
    return sum(
        (item.line_total for item in eligible_items(coupon, cart)), Decimal("0")
    )


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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: PASS — 40 tests.

- [ ] **Step 5: Commit**

```bash
cd /e/salyco-fullstack
git add Backend/orders/promotions.py Backend/orders/tests_promotions.py Backend/orders/models.py
git commit -m "feat(orders): add the coupon eligibility and pricing engine

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Customer cart API

**Files:**
- Modify: `Backend/orders/serializers.py`, `Backend/orders/views.py`, `Backend/orders/urls.py`
- Test: `Backend/orders/tests_promotions.py`

**Interfaces:**
- Consumes: `promotions.validate_coupon`, `promotions.COUPON_NOT_FOUND_MESSAGE` (Task 2); `CartCouponSerializer` is new.
- Produces: `POST|DELETE /api/cart/coupon/`; `CartSerializer` fields `id, items, subtotal, discount_amount, total, count, coupon`; `CartItemSerializer` field `covered_by_coupon`.

- [ ] **Step 1: Write the failing tests**

Append to `Backend/orders/tests_promotions.py` — add `from rest_framework.test import APITestCase` to the imports, then:

```python
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
        # NOT match — the blank input is the interesting half of this test.
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
        self.assertEqual(res.data["discount_amount"], "0")
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: FAIL — `404` on every `CartCouponApiTests` request, and `KeyError: 'subtotal'`.

- [ ] **Step 3: Extend the serializers**

In `Backend/orders/serializers.py`, change the import line to include `Coupon`:

```python
from .models import AllowedLocation, Cart, CartItem, Coupon, Order, OrderItem
```

Add the nested coupon serializer above `CartItemSerializer`:

```python
class CartCouponSerializer(serializers.ModelSerializer):
    """The applied coupon, as much of it as the cart page needs to describe the
    reduction. Never the usage counters — those are staff's business."""

    class Meta:
        model = Coupon
        fields = ["code", "discount_type", "percent", "amount"]
        read_only_fields = fields
```

Add `covered_by_coupon` to `CartItemSerializer` — field declaration next to `line_total`:

```python
    # Without this a mixed cart shows a discount smaller than the headline
    # percentage with nothing on screen to explain why (§ edge cases).
    covered_by_coupon = serializers.SerializerMethodField()
```

and add `"covered_by_coupon"` to its `fields` list after `"line_total"`, plus the method:

```python
    def get_covered_by_coupon(self, obj: CartItem) -> bool:
        # self.root is the parent CartSerializer, so its instance is the cart
        # being serialized — reading the coupon from there avoids one query per
        # line. The fallback keeps this correct if the serializer is ever used
        # standalone.
        cart = getattr(self.root, "instance", None) or obj.cart
        coupon = cart.coupon if cart is not None else None
        if coupon is None:
            return False
        if coupon.applies_to_all_products:
            return True
        # One existence query per line, but only for a product-scoped coupon. A
        # cart holds a handful of lines, so this stays cheap and avoids the
        # import cycle that prefetching the id set through the parent would need.
        return CouponProduct.objects.filter(
            coupon=coupon, mattress_id=obj.mattress_id
        ).exists()
```

Import `CouponProduct` too:

```python
from .models import (
    AllowedLocation,
    Cart,
    CartItem,
    Coupon,
    CouponProduct,
    Order,
    OrderItem,
)
```

Replace `CartSerializer` entirely:

```python
class CartSerializer(serializers.ModelSerializer):
    """The cart page's whole money picture.

    `total` keeps its name and now means *payable* — subtotal minus the coupon
    — so every existing consumer of cart.total is already correct.
    """

    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    discount_amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    total = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    count = serializers.IntegerField(read_only=True)
    coupon = CartCouponSerializer(read_only=True)

    class Meta:
        model = Cart
        fields = [
            "id",
            "items",
            "subtotal",
            "discount_amount",
            "total",
            "count",
            "coupon",
        ]
```

Add `coupon_code` and `discount_amount` to `OrderSerializer`'s and `PublicOrderSerializer`'s `fields` lists (immediately before `"total_amount"` in both), so the customer can see why a total sits below the sum of its lines. Their `read_only_fields = fields` already covers them.

- [ ] **Step 4: Add the view**

In `Backend/orders/views.py`, the existing model import is
`from .models import AllowedLocation, Cart, CartItem, Order` — extend it (keep
`AllowedLocation`, it is used by the location views):

```python
from .models import AllowedLocation, Cart, CartItem, Coupon, Order
```

and add `Coupon`-related imports. The file currently imports **nothing** from
`.checkout`, so `EMPTY_CART_MESSAGE` must be added rather than assumed present:

```python
from .checkout import EMPTY_CART_MESSAGE
from .promotions import COUPON_NOT_FOUND_MESSAGE, validate_coupon
```

finally extend the existing `.serializers` import with any names the coupon view
needs; it already pulls `AddCartItemSerializer`, `CartSerializer`,
`MergeCartSerializer`, `OrderSerializer` and `PublicOrderSerializer`, and
`CartCouponView` needs none of them beyond `CartSerializer`, so no change there.

Append at the end of the file:

```python
class CartCouponView(APIView):
    """POST /api/cart/coupon/ — apply a code. DELETE — remove it.

    Both answer with the whole cart payload, because applying or removing a code
    changes every number the cart page renders.

    The applied coupon is persisted on the cart rather than passed in the
    checkout payload: the customer must see the reduction before deciding to
    pay, and PaymentStartView re-validates it in case the cart sat overnight.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        cart = _get_cart(request.user)

        if not cart.items.exists():
            return Response(
                {"detail": EMPTY_CART_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
            )

        code = " ".join(str(request.data.get("code") or "").split()).upper()
        if not code:
            return Response(
                {"detail": "کد تخفیف را وارد کنید."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        coupon = Coupon.objects.filter(code=code).first()
        if coupon is None:
            return Response(
                {"detail": COUPON_NOT_FOUND_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        error = validate_coupon(coupon, cart, cart.customer)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        # Replaces whatever was applied: trying a second code should not require
        # clearing the first.
        cart.coupon = coupon
        cart.save(update_fields=["coupon", "updated_at"])
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        cart = _get_cart(request.user)
        if cart.coupon_id is not None:
            cart.coupon = None
            cart.save(update_fields=["coupon", "updated_at"])
        # Idempotent: removing when nothing is applied is a 200, not an error, so
        # the frontend never has to check first.
        return Response(CartSerializer(cart, context={"request": request}).data)
```

- [ ] **Step 5: Add the route**

In `Backend/orders/urls.py`, after the `cart/merge/` line:

```python
    path("cart/coupon/", views.CartCouponView.as_view(), name="cart-coupon"),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: PASS — 54 tests.

- [ ] **Step 7: Run the whole backend suite for regressions**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test -v 1`
Expected: PASS. In particular nothing in `payments` or `orders` should have moved — `Cart.total` gained a discount term that is zero when no coupon is applied.

- [ ] **Step 8: Commit**

```bash
cd /e/salyco-fullstack
git add Backend/orders/serializers.py Backend/orders/views.py Backend/orders/urls.py Backend/orders/tests_promotions.py
git commit -m "feat(orders): apply and remove a coupon through the cart API

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Checkout, payment start and settlement

**Files:**
- Modify: `Backend/orders/checkout.py`, `Backend/payments/views.py`, `Backend/payments/settlement.py`
- Test: `Backend/orders/tests_promotions.py`

**Interfaces:**
- Consumes: `promotions.validate_coupon` (Task 2); `Cart.coupon` / `Cart.total` / `Cart.discount_amount` (Task 1–2); `CouponRedemption` (Task 1).
- Produces: `Order.coupon` / `coupon_code` / `discount_amount` populated by `create_order_from_cart`; `PaymentStartView` returns `400 {"detail": <rule>, "coupon_cleared": true}` when a stale coupon is dropped; `_confirm` writes exactly one `CouponRedemption`.

- [ ] **Step 1: Write the failing tests**

Append to `Backend/orders/tests_promotions.py`. Add these to the top-of-file
import block:

```python
from unittest.mock import patch

from payments.models import Payment
from payments.settlement import _confirm
```

and add `AllowedLocation` to the existing `from .models import (...)` line.

**Two mocking details that are easy to get wrong.** Zibal is patched at
`payments.views.zibal.request_payment`, not at `requests.post`, and its contract
is an `(ok, data)` tuple rather than a requests-style response object (see
`payments/tests.py:302`). And `PaymentStartView`'s response carries
`payment_url` and `track_id` — there is no `order_id` key — so the assertions
read the created rows back through the ORM. Note also that `Payment.order` is a
foreign key, so those lookups are `Payment.objects.get()` on the single row, not
`get(order_id=...)` against a response field.

```python
# ═══ checkout, payment start and settlement ════════════════════════════════════


class CreateOrderFromCartTests(TestCase):
    def test_the_coupon_and_the_payable_total_are_frozen_onto_the_order(self):
        from .checkout import create_order_from_cart

        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="10000000"))
        coupon = Coupon.objects.create(code="TEN", percent=10)
        cart.coupon = coupon
        cart.save(update_fields=["coupon"])

        order = create_order_from_cart(cart, {"recipient_name": "آزمون"})

        self.assertEqual(order.coupon_id, coupon.pk)
        self.assertEqual(order.coupon_code, "TEN")
        self.assertEqual(order.discount_amount, Decimal("1000000.00"))
        self.assertEqual(order.total_amount, Decimal("9000000.00"))

    def test_an_order_without_a_coupon_records_zero(self):
        from .checkout import create_order_from_cart

        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="10000000"))
        order = create_order_from_cart(cart, {"recipient_name": "آزمون"})

        self.assertIsNone(order.coupon_id)
        self.assertEqual(order.coupon_code, "")
        self.assertEqual(order.discount_amount, Decimal("0"))
        self.assertEqual(order.total_amount, Decimal("10000000.00"))

    def test_the_order_rows_still_snapshot_the_sale_price(self):
        # The discount lives on the order, not in the line unit_prices: the
        # lines keep the price the customer was shown per item.
        from .checkout import create_order_from_cart

        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="10000000"))
        cart.coupon = Coupon.objects.create(code="TEN", percent=10)
        cart.save(update_fields=["coupon"])

        order = create_order_from_cart(cart, {"recipient_name": "آزمون"})
        self.assertEqual(order.items.get().unit_price, Decimal("10000000.00"))


class PaymentStartCouponTests(APITestCase):
    """The gateway amount — not just the cart page — must reflect the discount."""

    URL = "/api/payments/start/"

    # The same body payments/tests.py:260 posts.
    BODY = {
        "recipient_name": "علی رضایی",
        "phone_number": "09121112233",
        "province": "تهران",
        "city": "تهران",
        "postal_code": "1234567890",
        "address": "خیابان آزادی، پلاک ۱۲، واحد ۳",
    }

    def setUp(self):
        AllowedLocation.objects.create(province="تهران", city="", is_active=True)
        self.customer = make_customer("09121112233")
        self.cart = make_cart(self.customer, make_mattress(price="10000000"))
        self.client.force_authenticate(self.customer.user)

    def _accepted(self, track_id=15966442233311):
        # request_payment's contract is (ok, data).
        return True, {"result": 100, "trackId": track_id, "message": "success"}

    @patch("payments.views.zibal.request_payment")
    def test_the_gateway_is_asked_for_the_discounted_amount(self, mock_request):
        mock_request.return_value = self._accepted()
        self.cart.coupon = Coupon.objects.create(code="TEN", percent=10)
        self.cart.save(update_fields=["coupon"])

        res = self.client.post(self.URL, self.BODY)

        self.assertEqual(res.status_code, 201)

        order = Order.objects.get()
        self.assertEqual(order.total_amount, Decimal("9000000.00"))
        self.assertEqual(order.coupon_code, "TEN")
        self.assertEqual(order.discount_amount, Decimal("1000000.00"))

        # 9,000,000 Toman = 90,000,000 Rial — on the row AND in the request, so a
        # discount that reached the order but not the gateway cannot pass.
        payment = Payment.objects.get()
        self.assertEqual(payment.amount_rial, 90_000_000)
        self.assertEqual(mock_request.call_args[1]["amount_rial"], 90_000_000)

    def test_a_coupon_that_expired_overnight_is_cleared_and_explained(self):
        coupon = Coupon.objects.create(
            code="OLD", percent=10, expires_at=timezone.now() - timedelta(hours=1)
        )
        self.cart.coupon = coupon
        self.cart.save(update_fields=["coupon"])

        res = self.client.post(self.URL, self.BODY)

        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "این کد تخفیف منقضی شده است.")
        self.assertTrue(res.data["coupon_cleared"])
        # Cleared, or every retry would hit the same wall.
        self.cart.refresh_from_db()
        self.assertIsNone(self.cart.coupon_id)
        # The coupon check runs before the order is created, so a refused coupon
        # leaves no order and no payment behind.
        self.assertFalse(Payment.objects.exists())
        self.assertFalse(Order.objects.exists())

    @patch("payments.views.zibal.request_payment")
    def test_the_customer_can_pay_the_full_price_after_the_coupon_is_cleared(
        self, mock_request
    ):
        mock_request.return_value = self._accepted(15966442233399)
        self.cart.coupon = Coupon.objects.create(
            code="OLD", percent=10, expires_at=timezone.now() - timedelta(hours=1)
        )
        self.cart.save(update_fields=["coupon"])

        self.client.post(self.URL, self.BODY)  # refused, coupon cleared
        res = self.client.post(self.URL, self.BODY)  # retry at full price

        self.assertEqual(res.status_code, 201)
        # One payment, not two: the refused attempt left no row behind.
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Payment.objects.get().amount_rial, 100_000_000)

    def test_a_usage_limited_coupon_is_caught_at_payment_time(self):
        # The cap can be reached by someone else between cart and checkout.
        coupon = Coupon.objects.create(code="ONE", percent=10, usage_limit=1)
        paid_order(make_customer("09120000004"), coupon)
        self.cart.coupon = coupon
        self.cart.save(update_fields=["coupon"])

        res = self.client.post(self.URL, self.BODY)

        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.data["detail"], "ظرفیت استفاده از این کد تخفیف تکمیل شده است."
        )
        self.assertTrue(res.data["coupon_cleared"])


class SettlementRedemptionTests(TestCase):
    """A use is spent when the money is confirmed — and exactly once.

    `_confirm` ends with `transaction.on_commit(...)`, which never fires under
    `TestCase` (Django runs on_commit callbacks only when the outermost atomic
    block commits, and TestCase wraps each test in one that rolls back). That is
    why payments/tests.py uses TransactionTestCase for its settlement tests. Here
    the redemption row is written synchronously, so a TestCase can assert on it;
    the `send_order_confirmation` patch is kept as a guard for anyone who later
    converts this class.
    """

    def _paid_payment(self, *, with_coupon: bool):
        from .checkout import create_order_from_cart

        customer = make_customer()
        cart = make_cart(customer, make_mattress(price="10000000"))
        coupon = None
        if with_coupon:
            coupon = Coupon.objects.create(code="TEN", percent=10)
            cart.coupon = coupon
            cart.save(update_fields=["coupon"])

        order = create_order_from_cart(cart, {"recipient_name": "آزمون"})
        # amount_rial is a BigIntegerField; int() the Decimal.
        payment = Payment.objects.create(
            order=order, amount_rial=int(order.total_amount * 10)
        )
        return payment, order, coupon

    def test_no_redemption_is_written_at_redirect(self):
        _, order, coupon = self._paid_payment(with_coupon=True)

        # The order exists and carries the frozen discount, but nothing has been
        # verified yet, so no use is spent.
        self.assertEqual(order.discount_amount, Decimal("1000000.00"))
        self.assertEqual(CouponRedemption.objects.count(), 0)
        self.assertEqual(promotions.redeemed_count(coupon), 0)

    def test_settlement_writes_exactly_one_redemption(self):
        payment, order, coupon = self._paid_payment(with_coupon=True)

        with patch("orders.notifications.send_order_confirmation"):
            _confirm(payment, {"refNumber": "123", "cardNumber": "6037"})
            # A second call is reachable in production: the browser callback and
            # a later status inquiry both land here, and settlement.py's own
            # module docstring notes that select_for_update is a silent no-op on
            # SQLite, so the upstream `is_settled` check cannot serialise them.
            # The OneToOne get_or_create is what actually holds the line.
            _confirm(payment, {"refNumber": "123", "cardNumber": "6037"})

        self.assertEqual(CouponRedemption.objects.count(), 1)
        redemption = CouponRedemption.objects.get()
        self.assertEqual(redemption.coupon_id, coupon.pk)
        self.assertEqual(redemption.order_id, order.pk)
        self.assertEqual(redemption.customer_id, order.customer_id)
        self.assertEqual(redemption.amount, Decimal("1000000.00"))

    def test_settlement_without_a_coupon_writes_nothing(self):
        payment, _, _ = self._paid_payment(with_coupon=False)

        with patch("orders.notifications.send_order_confirmation"):
            _confirm(payment, {"refNumber": "123", "cardNumber": "6037"})

        self.assertEqual(CouponRedemption.objects.count(), 0)

    def test_settlement_clears_the_cart_items_and_leaves_the_coupon_fk(self):
        payment, order, _ = self._paid_payment(with_coupon=True)

        with patch("orders.notifications.send_order_confirmation"):
            _confirm(payment, {"refNumber": "123", "cardNumber": "6037"})

        cart = Cart.objects.get(customer_id=order.customer_id)
        self.assertEqual(cart.items.count(), 0)
        # Only the items are wiped, so the FK survives. Stated explicitly rather
        # than left implied.
        self.assertEqual(cart.coupon_id, order.coupon_id)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: FAIL — `create_order_from_cart` does not set the coupon fields, and `PaymentStartView` ignores the coupon entirely (the gateway is asked for the full amount).

- [ ] **Step 3: Freeze the coupon onto the order**

In `Backend/orders/checkout.py`, replace the `Order.objects.create(...)` call inside `create_order_from_cart`:

```python
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
```

- [ ] **Step 4: Re-validate at payment start**

In `Backend/payments/views.py`, add to the imports:

```python
from orders.promotions import validate_coupon
```

and insert this block immediately after the `if errors: ...` check on `validate_checkout` and **before** `amount_rial = toman_to_rial(cart.total)`:

```python
        # The cart may have been sitting since yesterday, so the coupon is
        # re-checked here rather than trusted. Clearing it is the point: leaving
        # it applied would make every retry fail the same way with no way out.
        if cart.coupon_id:
            error = validate_coupon(cart.coupon, cart, cart.customer)
            if error:
                cart.coupon = None
                cart.save(update_fields=["coupon", "updated_at"])
                return Response(
                    {"detail": error, "coupon_cleared": True},
                    status=status.HTTP_400_BAD_REQUEST,
                )
```

- [ ] **Step 5: Write the redemption at settlement**

In `Backend/payments/settlement.py`, change the models import:

```python
from orders.models import Cart, CouponRedemption, Order
```

and insert this block inside `_confirm`, **after** the `order.status = Order.CONFIRMED` block and **before** the cart-clearing block:

```python
    if order.coupon_id:
        # One row per paid order. The OneToOneField is what makes this
        # idempotent — and it is load-bearing rather than belt-and-braces:
        # settlement is reachable twice for one payment (the browser callback and
        # a later status inquiry), and the `is_settled` guard that would catch
        # the second one sits behind select_for_update, which this module's own
        # docstring notes is a silent no-op on SQLite. A duplicate redemption
        # would silently spend a second use.
        CouponRedemption.objects.get_or_create(
            order=order,
            defaults={
                "coupon": order.coupon,
                "customer": order.customer,
                "amount": order.discount_amount,
            },
        )
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: PASS — 65 tests.

- [ ] **Step 7: Run the whole backend suite**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test -v 1`
Expected: PASS. The `payments` suite is the one to watch: `_confirm` gained a branch, and `PaymentStartView` gained a check that must not fire when no coupon is applied.

- [ ] **Step 8: Commit**

```bash
cd /e/salyco-fullstack
git add Backend/orders/checkout.py Backend/payments/views.py Backend/payments/settlement.py Backend/orders/tests_promotions.py
git commit -m "feat(payments): re-validate the coupon at payment start and count it at settlement

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Admin coupon API

**Files:**
- Modify: `Backend/orders/admin_serializers.py`, `Backend/orders/admin_views.py`, `Backend/orders/urls.py`
- Test: `Backend/orders/tests_promotions.py`

**Interfaces:**
- Consumes: `promotions.coupon_status`, `redeemed_count`, and the message constants (Task 2); `Coupon.clean()` (Task 1).
- Produces: `AdminCouponSerializer` (writable `product_ids: list[int]`, read-only `products`, `status`, `redeemed_count`, `remaining_uses`, `total_discount_given`); `AdminCouponRedemptionSerializer` (`id`, `order_id`, `customer_name`, `phone_number`, `amount`, `created_at`); routes `GET|POST /api/admin/coupons/`, `GET|PATCH|DELETE /api/admin/coupons/<pk>/`, `GET /api/admin/coupons/<pk>/redemptions/`.

- [ ] **Step 1: Write the failing tests**

Append to `Backend/orders/tests_promotions.py`:

```python
# ═══ admin API ═════════════════════════════════════════════════════════════════


class AdminCouponApiTests(APITestCase):
    LIST = "/api/admin/coupons/"

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", password="x", is_staff=True
        )
        self.client.force_authenticate(self.admin)

    def _create(self, **overrides):
        payload = {"code": "SALYCO10", "discount_type": "PERCENT", "percent": 10}
        payload.update(overrides)
        return self.client.post(self.LIST, payload, format="json")

    def test_staff_can_create_a_percent_coupon(self):
        res = self._create()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["code"], "SALYCO10")
        self.assertEqual(res.data["status"], "ACTIVE")
        self.assertEqual(res.data["redeemed_count"], 0)
        # `products` is the read side; `product_ids` is write-only and so does
        # not appear in a response at all.
        self.assertEqual(res.data["products"], [])

    def test_create_scopes_products_and_reports_them_back(self):
        a = make_mattress(slug="a")
        b = make_mattress(slug="b")
        res = self._create(applies_to_all_products=False, product_ids=[a.pk, b.pk])

        self.assertEqual(res.status_code, 201)
        ids = sorted(p["mattress_id"] for p in res.data["products"])
        self.assertEqual(ids, sorted([a.pk, b.pk]))
        names = sorted(p["mattress_name"] for p in res.data["products"])
        self.assertEqual(names, sorted([a.name, b.name]))

    def test_scoping_to_nothing_is_refused(self):
        res = self._create(applies_to_all_products=False, product_ids=[])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["product_ids"][0], "حداقل یک محصول را انتخاب کنید.")

    def test_a_percent_coupon_without_a_percent_is_refused(self):
        res = self._create(percent=None)
        self.assertEqual(res.status_code, 400)
        self.assertIn("percent", res.data)

    def test_a_percent_of_100_is_refused(self):
        res = self._create(percent=100)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["percent"][0], "درصد تخفیف باید بین ۱ تا ۹۹ باشد.")

    def test_a_fixed_coupon_carries_its_amount(self):
        res = self._create(discount_type="FIXED", amount="200000", percent=None)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["amount"], "200000.00")

    def test_a_fixed_coupon_without_an_amount_is_refused(self):
        res = self._create(discount_type="FIXED", percent=None)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.data["amount"][0], "برای تخفیف مبلغی، مبلغ باید بیشتر از صفر باشد."
        )

    def test_expiry_before_start_is_refused(self):
        now = timezone.now()
        res = self._create(
            starts_at=now.isoformat(),
            expires_at=(now - timedelta(days=1)).isoformat(),
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.data["expires_at"][0], "تاریخ پایان باید بعد از تاریخ شروع باشد."
        )

    def test_patch_can_deactivate_without_touching_the_rest(self):
        created = self._create().data
        res = self.client.patch(
            f"{self.LIST}{created['id']}/", {"is_active": False}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["is_active"])
        self.assertEqual(res.data["percent"], 10)
        self.assertEqual(res.data["status"], "INACTIVE")

    def test_patch_can_replace_the_product_scope(self):
        a = make_mattress(slug="a")
        b = make_mattress(slug="b")
        created = self._create(
            applies_to_all_products=False, product_ids=[a.pk]
        ).data

        res = self.client.patch(
            f"{self.LIST}{created['id']}/", {"product_ids": [b.pk]}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            [p["mattress_id"] for p in res.data["products"]], [b.pk]
        )

    def test_patch_cannot_leave_a_scoped_coupon_with_nothing_selected(self):
        a = make_mattress(slug="a")
        created = self._create(
            applies_to_all_products=False, product_ids=[a.pk]
        ).data

        res = self.client.patch(
            f"{self.LIST}{created['id']}/", {"product_ids": []}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("product_ids", res.data)

    def test_redeemed_count_and_remaining_uses(self):
        coupon = Coupon.objects.create(code="ONE", percent=10, usage_limit=3)
        paid_order(make_customer("09120000005"), coupon)

        res = self.client.get(f"{self.LIST}{coupon.pk}/")
        self.assertEqual(res.data["redeemed_count"], 1)
        self.assertEqual(res.data["remaining_uses"], 2)

    def test_remaining_uses_is_null_when_unlimited(self):
        coupon = Coupon.objects.create(code="INF", percent=10)
        res = self.client.get(f"{self.LIST}{coupon.pk}/")
        self.assertIsNone(res.data["remaining_uses"])

    def test_total_discount_given_sums_the_redemptions(self):
        coupon = Coupon.objects.create(code="TEN", percent=10)
        paid_order(make_customer("09120000006"), coupon, amount="1000")
        paid_order(make_customer("09120000007"), coupon, amount="2500")

        res = self.client.get(f"{self.LIST}{coupon.pk}/")
        self.assertEqual(Decimal(res.data["total_discount_given"]), Decimal("3500"))

    def test_deleting_a_redeemed_coupon_is_refused_with_a_persian_message(self):
        coupon = Coupon.objects.create(code="TEN", percent=10)
        paid_order(make_customer("09120000008"), coupon)

        res = self.client.delete(f"{self.LIST}{coupon.pk}/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.data["detail"],
            "این کد تخفیف استفاده شده و قابل حذف نیست؛ آن را غیرفعال کنید.",
        )
        self.assertTrue(Coupon.objects.filter(pk=coupon.pk).exists())

    def test_deleting_an_unused_coupon_works(self):
        coupon = Coupon.objects.create(code="TEN", percent=10)
        res = self.client.delete(f"{self.LIST}{coupon.pk}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Coupon.objects.filter(pk=coupon.pk).exists())

    def test_deleting_a_coupon_sitting_in_a_live_cart_works(self):
        # Cart.coupon is SET_NULL: retiring a coupon must not take carts with it.
        customer = make_customer()
        cart = make_cart(customer, make_mattress())
        coupon = Coupon.objects.create(code="TEN", percent=10)
        cart.coupon = coupon
        cart.save(update_fields=["coupon"])

        res = self.client.delete(f"{self.LIST}{coupon.pk}/")

        self.assertEqual(res.status_code, 204)
        cart.refresh_from_db()
        self.assertIsNone(cart.coupon_id)
        self.assertEqual(cart.items.count(), 1)

    def test_a_non_admin_is_refused(self):
        customer = make_customer("09120000009")
        self.client.force_authenticate(customer.user)
        self.assertEqual(self.client.get(self.LIST).status_code, 403)
        self.assertEqual(self._create().status_code, 403)

    def test_redemptions_endpoint(self):
        coupon = Coupon.objects.create(code="TEN", percent=10)
        customer = make_customer("09120000010")
        order = paid_order(customer, coupon, amount="4000")
        order.phone_number = "09121112233"
        order.save(update_fields=["phone_number"])

        res = self.client.get(f"{self.LIST}{coupon.pk}/redemptions/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        row = res.data[0]
        self.assertEqual(row["order_id"], order.pk)
        self.assertEqual(row["customer_name"], "آزمون کاربر")
        self.assertEqual(row["phone_number"], "09121112233")
        self.assertEqual(row["amount"], "4000.00")

    def test_the_redemption_phone_falls_back_to_the_customer(self):
        coupon = Coupon.objects.create(code="TEN", percent=10)
        customer = make_customer("09120000011")
        paid_order(customer, coupon)

        res = self.client.get(f"{self.LIST}{coupon.pk}/redemptions/")
        self.assertEqual(res.data[0]["phone_number"], "09120000011")

    def test_the_admin_order_payload_carries_the_coupon(self):
        customer = make_customer("09120000012")
        coupon = Coupon.objects.create(code="TEN", percent=10)
        order = Order.objects.create(
            customer=customer,
            method=Order.ONLINE,
            coupon=coupon,
            coupon_code="TEN",
            discount_amount=Decimal("5000"),
            total_amount=Decimal("45000"),
        )

        res = self.client.get(f"/api/admin/orders/{order.pk}/")
        self.assertEqual(res.data["coupon_code"], "TEN")
        self.assertEqual(res.data["discount_amount"], "5000.00")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: FAIL — `404` on every `AdminCouponApiTests` request.

- [ ] **Step 3: Write the admin serializers**

In `Backend/orders/admin_serializers.py`, replace the imports with:

```python
from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from rest_framework import serializers

from .models import AllowedLocation, Coupon, CouponProduct, CouponRedemption, Order
from .promotions import coupon_status, redeemed_count
from .serializers import OrderItemSerializer
```

Add the order-serializer fields — add `"coupon_code"` and `"discount_amount"` to `AdminOrderSerializer`'s `fields` immediately before `"total_amount"`. Its `read_only_fields = [f for f in fields if f != "status"]` picks them up automatically.

Append the coupon serializers:

```python
class CouponProductSerializer(serializers.ModelSerializer):
    """Read side of the product scope. Carries the name so the panel can show
    «۳ محصول» without a second lookup per row."""

    mattress_id = serializers.IntegerField(read_only=True)
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)

    class Meta:
        model = CouponProduct
        fields = ["mattress_id", "mattress_name"]


class AdminCouponSerializer(serializers.ModelSerializer):
    """Coupon row for the admin panel.

    `product_ids` is the write side of the CouponProduct through-table: a plain
    list of ids, replaced wholesale on every save. `products` is the read side.
    They are separate names on purpose — a single writable `product_ids` field
    would have no attribute on the model to read back, so DRF would blow up on
    serializing an instance that never had one set this request.
    """

    product_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    products = CouponProductSerializer(many=True, read_only=True)

    status = serializers.SerializerMethodField()
    redeemed_count = serializers.SerializerMethodField()
    remaining_uses = serializers.SerializerMethodField()
    total_discount_given = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "description",
            "discount_type",
            "percent",
            "amount",
            "max_discount_amount",
            "min_order_amount",
            "starts_at",
            "expires_at",
            "usage_limit",
            "per_customer_limit",
            "applies_to_all_products",
            "is_active",
            "created_at",
            "product_ids",
            "products",
            "status",
            "redeemed_count",
            "remaining_uses",
            "total_discount_given",
        ]
        read_only_fields = ["id", "created_at", "products"]

    # ── computed ──

    def get_status(self, obj: Coupon) -> str:
        return coupon_status(obj)

    def get_redeemed_count(self, obj: Coupon) -> int:
        return redeemed_count(obj)

    def get_remaining_uses(self, obj: Coupon):
        if obj.usage_limit is None:
            return None
        return max(obj.usage_limit - redeemed_count(obj), 0)

    def get_total_discount_given(self, obj: Coupon) -> str:
        total = CouponRedemption.objects.filter(coupon=obj).aggregate(
            total=Sum("amount")
        )["total"]
        return str(total if total is not None else Decimal("0"))

    # ── validation ──

    def validate(self, attrs):
        """Mirror Coupon.clean(), plus the scope rule clean() cannot reach.

        DRF never calls a model's clean(), so the cross-field rules are run here
        by hand against the merged object — a PATCH carries only the keys it
        changes, so validating the fragment alone would pass a coupon whose
        combined state is invalid.
        """
        instance = self.instance or Coupon()
        for key, value in attrs.items():
            setattr(instance, key, value)

        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", None) or {"detail": exc.messages}
            )

        product_ids = attrs.get("product_ids")
        if product_ids is None and self.instance is not None:
            product_ids = list(
                self.instance.products.values_list("mattress_id", flat=True)
            )
        if not instance.applies_to_all_products and not product_ids:
            raise serializers.ValidationError(
                {"product_ids": "حداقل یک محصول را انتخاب کنید."}
            )

        return attrs

    # ── writes ──

    def create(self, validated_data):
        product_ids = validated_data.pop("product_ids", [])
        coupon = Coupon.objects.create(**validated_data)
        self._set_products(coupon, product_ids)
        return coupon

    def update(self, instance, validated_data):
        product_ids = validated_data.pop("product_ids", None)
        coupon = super().update(instance, validated_data)
        if product_ids is not None:
            self._set_products(coupon, product_ids)
        return coupon

    @staticmethod
    def _set_products(coupon: Coupon, product_ids: list[int]) -> None:
        """Replace the scope wholesale. dedupe via set() because the panel's
        multi-select can hand back the same id twice."""
        CouponProduct.objects.filter(coupon=coupon).delete()
        CouponProduct.objects.bulk_create(
            [CouponProduct(coupon=coupon, mattress_id=pid) for pid in set(product_ids)]
        )


class AdminCouponRedemptionSerializer(serializers.ModelSerializer):
    """One use of a coupon, for the panel's expandable row."""

    order_id = serializers.IntegerField(read_only=True)
    customer_name = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()

    class Meta:
        model = CouponRedemption
        fields = [
            "id",
            "order_id",
            "customer_name",
            "phone_number",
            "amount",
            "created_at",
        ]

    def get_customer_name(self, obj: CouponRedemption) -> str:
        c = obj.customer
        return f"{c.first_name} {c.last_name}".strip() or "کاربر"

    def get_phone_number(self, obj: CouponRedemption) -> str:
        # The order's snapshot first — that is the number the parcel went to.
        return obj.order.phone_number or obj.customer.phone_number
```

- [ ] **Step 4: Write the admin views**

In `Backend/orders/admin_views.py`, replace the imports with:

```python
from __future__ import annotations

from django.db.models import ProtectedError, Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError

from mattress.permissions import IsAdminUser
from mattress.admin_views import apply_ordering

from .admin_serializers import (
    AdminAllowedLocationSerializer,
    AdminCouponRedemptionSerializer,
    AdminCouponSerializer,
    AdminOrderSerializer,
)
from .models import AllowedLocation, Coupon, CouponRedemption, Order
from .notifications import send_order_confirmation
```

Append:

```python
# A coupon referenced by an order cannot be deleted — Order.coupon is PROTECT so
# that a discounted order keeps the code that discounted it. Reported as a
# sentence rather than a 500, and the panel offers deactivation instead.
COUPON_IN_USE_MESSAGE = (
    "این کد تخفیف استفاده شده و قابل حذف نیست؛ آن را غیرفعال کنید."
)


class AdminCouponListView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminCouponSerializer
    pagination_class = None
    # prefetch_related so the `products` read field does not cost one query per
    # row in the list.
    queryset = Coupon.objects.prefetch_related("products__mattress")


class AdminCouponDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminCouponSerializer
    queryset = Coupon.objects.prefetch_related("products__mattress")

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": COUPON_IN_USE_MESSAGE})


class AdminCouponRedemptionsView(generics.ListAPIView):
    """Who used this code, newest first. A separate endpoint rather than an
    embedded field so the coupon list stays light."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminCouponRedemptionSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            CouponRedemption.objects.filter(coupon_id=self.kwargs["pk"])
            .select_related("order", "customer")
            .order_by("-created_at")
        )
```

- [ ] **Step 5: Add the routes**

In `Backend/orders/urls.py`, in the admin block:

```python
    path("admin/coupons/", admin_views.AdminCouponListView.as_view(), name="admin-coupons"),
    path("admin/coupons/<int:pk>/", admin_views.AdminCouponDetailView.as_view(), name="admin-coupon-detail"),
    path(
        "admin/coupons/<int:pk>/redemptions/",
        admin_views.AdminCouponRedemptionsView.as_view(),
        name="admin-coupon-redemptions",
    ),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test orders.tests_promotions -v 2`
Expected: PASS — 86 tests.

- [ ] **Step 7: Run the whole backend suite**

Run: `cd Backend && ./env/Scripts/python.exe manage.py test -v 1`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /e/salyco-fullstack
git add Backend/orders/admin_serializers.py Backend/orders/admin_views.py Backend/orders/urls.py Backend/orders/tests_promotions.py
git commit -m "feat(orders): admin API for discount codes and their redemptions

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Storefront — cart and checkout

**Files:**
- Modify: `Frontend/salyco-front/src/api/cart.js`, `src/context/CartContext.jsx`, `src/pages/CartPage.jsx`, `src/pages/checkout/CheckoutOrder.jsx`

**Interfaces:**
- Consumes: `POST|DELETE /api/cart/coupon/` and the extended `CartSerializer` payload (Task 3).
- Produces: `useCart()` gains `subtotal`, `discount`, `coupon`, `applyCoupon(code)`, `removeCoupon()`. `total` keeps its name and now means payable.

- [ ] **Step 1: Add the API calls**

Append to `Frontend/salyco-front/src/api/cart.js`:

```js
// Applying and removing a code both answer with the whole cart payload — the
// server owns the money arithmetic (which lines are eligible, how the
// percentage rounds), so the client never recomputes a discount.
export async function applyCartCoupon(code) {
  try {
    const res = await api.post("/api/cart/coupon/", { code });
    return res.data;
  } catch (err) {
    // The server writes these in Persian and they are shown verbatim, which is
    // why the rule wording lives there and not here.
    const msg = err.response?.data?.detail || "خطا در اعمال کد تخفیف";
    throw new Error(msg);
  }
}

export async function removeCartCoupon() {
  try {
    const res = await api.delete("/api/cart/coupon/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در حذف کد تخفیف";
    throw new Error(msg);
  }
}
```

- [ ] **Step 2: Give CartContext the coupon state**

In `Frontend/salyco-front/src/context/CartContext.jsx`:

Extend the `../api/cart` import with `applyCartCoupon, removeCartCoupon`.

Add state next to `items`:

```js
  const [coupon, setCoupon] = useState(null);
  // Toman off, as the server computed it. Kept separate from `items` because
  // which lines are eligible is the server's call, not something the client can
  // derive from the item list alone.
  const [discount, setDiscount] = useState(0);
```

Add the applier above `refresh`:

```js
  // Every server cart response carries items, coupon and discount_amount
  // together, so they are applied together — there is no state in which the
  // items have arrived and the discount has not.
  const applyCartState = useCallback((data) => {
    setItems(data.items || []);
    setCoupon(data.coupon || null);
    setDiscount(Number(data.discount_amount || 0));
  }, []);
```

In `refresh`, replace `setItems(data.items || [])` with `applyCartState(data)` and add `applyCartState` to the `useCallback` dependency array — it becomes `}, [applyCartState]);`. Add `setCoupon(null); setDiscount(0);` to the two branches that build a local cart directly (the `catch` in `refresh`, and the logged-out branch), because a signed-out cart has no coupon.

In `addItem`, `updateItem` and `removeItem`, replace every `setItems(data.items || [])` with `applyCartState(data)` and add `applyCartState` to each dependency array.

Replace the computed `total` with:

```js
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unit_price) * i.quantity,
    0
  );
  // Uniform for both carts: `discount` is always 0 when signed out, because a
  // coupon needs a server-side cart to hang off.
  const total = Math.max(subtotal - discount, 0);
```

Add the two mutations after `removeItem`:

```js
  // Both throw the server's Persian message on failure so the caller can show
  // err.message directly; neither swallows it the way the cart mutations do,
  // because a refused code is the whole point of the interaction.
  const applyCoupon = useCallback(async (code) => {
    applyCartState(await applyCartCoupon(code));
  }, [applyCartState]);

  const removeCoupon = useCallback(async () => {
    applyCartState(await removeCartCoupon());
  }, [applyCartState]);
```

Extend the context `value` object:

```js
  const value = {
    items,
    count,
    subtotal,
    discount,
    coupon,
    total,
    loading,
    addItem,
    updateItem,
    removeItem,
    clear,
    refresh,
    applyCoupon,
    removeCoupon,
  };
```

Also add `setCoupon(null); setDiscount(0);` to `clear`, so signing out does not leave a coupon badge on an empty local cart.

- [ ] **Step 3: Add the coupon box and the discount row to the cart page**

In `Frontend/salyco-front/src/pages/CartPage.jsx`, extend the hooks import:

```js
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
```

Extend the lucide import with `TicketPercent, X, Loader2`.

Add a `CouponBox` component above `OrderCard`:

```js
/* The code input, its applied state, and the error the server sent back.
   Rendered only for a signed-in cart: applying a code needs a server-side cart
   to persist it on, and the API is authenticated. */
function CouponBox({ coupon, onApply, onRemove }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onApply(code);
      setCode("");
    } catch (err) {
      // Shown verbatim: the server writes the rule wording in Persian.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (coupon) {
    return (
      <div className={`${CARD} flex items-center justify-between gap-3 p-4`}>
        <span className="flex items-center gap-2 font-persian text-sm text-text-primary">
          <TicketPercent size={18} className="text-brand-navy" aria-hidden="true" />
          کد تخفیف: <strong className="font-bold">{coupon.code}</strong>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-persian text-sm font-medium text-status-error transition hover:bg-status-error-bg"
        >
          <X size={16} aria-hidden="true" />
          حذف
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${CARD} p-4`}>
      <label
        htmlFor="coupon-code"
        className="mb-1.5 block font-persian text-sm font-medium text-text-primary"
      >
        کد تخفیف
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="کد تخفیف را وارد کنید"
          className="h-12 min-w-0 flex-1 rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm text-text-primary placeholder-text-secondary outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-lg bg-brand-navy px-5 font-persian text-sm font-bold text-white transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          اعمال
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
        >
          {error}
        </p>
      )}
    </form>
  );
}
```

Add `useState` to the React import at the top of the file:

```js
import { useState } from "react";
```

In the `CartPage` component, extend the destructure and the `OrderCard` map:

```js
  const {
    items,
    count,
    subtotal,
    discount,
    coupon,
    total,
    updateItem,
    removeItem,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const { isAuthenticated } = useAuth();
```

In the order-cards column, below the `items.map(...)`, add the coupon box — visible only to a signed-in customer:

```jsx
              {isAuthenticated && (
                <CouponBox
                  coupon={coupon}
                  onApply={applyCoupon}
                  onRemove={removeCoupon}
                />
              )}
```

In the invoice summary, replace the `جمع کل` row and add the discount row. The whole `<div className="flex flex-col gap-3 border-b border-brand-mist pb-4">` block becomes:

```jsx
                <div className="flex flex-col gap-3 border-b border-brand-mist pb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">تعداد اقلام</span>
                    <span className="font-medium text-text-primary">
                      {toPersianNumber(count)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">جمع کل</span>
                    <span className="font-medium text-text-primary [font-feature-settings:'tnum']">
                      {formatPersianPrice(subtotal)} تومان
                    </span>
                  </div>
                  {/* Only when there is something to explain: a zero row on
                      every cart reads as a broken discount. */}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-status-success">تخفیف</span>
                      <span className="font-medium text-status-success [font-feature-settings:'tnum']">
                        {formatPersianPrice(discount)}− تومان
                      </span>
                    </div>
                  )}
                </div>
```

`status-success` / `status-success-bg` are real tokens in `src/index.css:59-60`
(`--color-status-success: #21633e`), so the discount row uses them directly rather
than reaching for a navy that would read as decoration.

- [ ] **Step 4: Add the read-only discount line to checkout**

In `Frontend/salyco-front/src/pages/checkout/CheckoutOrder.jsx`, extend the destructure:

```js
  const { items, count, subtotal, discount, coupon, total, refresh } = useCart();
```

Replace the `تعداد اقلام` block's following sibling — the `<div className="flex items-center justify-between py-4">` containing `مبلغ قابل پرداخت` — by inserting the coupon rows **before** it:

```jsx
              {coupon && (
                <div className="flex justify-between border-b border-brand-mist py-3 text-sm">
                  <span className="text-text-secondary">
                    کد تخفیف ({coupon.code})
                  </span>
                  <span className="font-medium text-status-success [font-feature-settings:'tnum']">
                    {formatPersianPrice(discount)}− تومان
                  </span>
                </div>
              )}
```

And place a «جمع کل» line above it so the arithmetic on screen adds up:

```jsx
              <div className="flex justify-between border-b border-brand-mist py-3 text-sm">
                <span className="text-text-secondary">جمع کل</span>
                <span className="font-medium text-text-primary [font-feature-settings:'tnum']">
                  {formatPersianPrice(subtotal)} تومان
                </span>
              </div>
```

Finally, in `handleSubmit`'s `catch`, refresh the cart so a coupon the server cleared is also cleared on screen:

```js
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      // The server clears a coupon it refuses at payment time and says so in
      // `detail`. Re-reading the cart is what makes the summary above the pay
      // button agree with it — one GET, and only on a failed attempt.
      refresh();
    }
```

- [ ] **Step 5: Lint and build**

Run: `cd Frontend/salyco-front && npm run lint`
Expected: no new problems beyond the 69-problem baseline. Watch for `react-hooks/exhaustive-deps` on the changed `useCallback` arrays and for `preserve-caught-error` on the `catch` blocks that re-throw a new `Error` — the latter should match the existing pattern in `api/cart.js`, which is already counted in the baseline.

Run: `cd Frontend/salyco-front && npm run build`
Expected: clean.

- [ ] **Step 6: Verify in a browser**

Start the dev server (`npm run dev`, note the port) and drive it with CDP — `chrome --headless --window-size` lays out wider than it crops and is not usable here.

Script to write as `tmp/coupon-probe.mjs` and run with `node`:

```js
// Applies a coupon on the cart page and reads the rendered totals back.
// Needs: dev server on 5174, headless Chrome on 9333, and a seeded coupon +
// signed-in session — check by hand first, then assert here.
const PORT = 9333;
import { writeFileSync } from "node:fs";
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (m, p = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
await new Promise((r) => (ws.onopen = r));
await send("Page.enable");

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 900,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url: "http://localhost:5174/cart" });
await new Promise((r) => setTimeout(r, 4000));

// Type the code and submit the coupon form.
await send("Runtime.evaluate", {
  expression: `(() => {
    const input = document.querySelector('#coupon-code');
    if (!input) return 'no coupon box';
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(input, 'SALYCO10');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('form').requestSubmit();
    return 'submitted';
  })()`,
});
await new Promise((r) => setTimeout(r, 2500));

const read = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const summary = document.querySelector('.sticky');
    const rows = [...summary.querySelectorAll('div.flex')]
      .map((d) => d.textContent.trim())
      .filter(Boolean);
    return JSON.stringify({
      hasCouponBadge: !!document.body.textContent.includes('کد تخفیف:'),
      summaryRows: rows,
      errorShown: !!document.querySelector('[role="alert"]'),
      errorText: document.querySelector('[role="alert"]')?.textContent || '',
    });
  })()`,
});
console.log(
  read.result.exceptionDetails
    ? read.result.exceptionDetails.exception.description.split("\n")[0]
    : read.result.result.value
);
writeFileSync(
  "shots/coupon-cart-390.png",
  Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64")
);
ws.close();
process.exit(0);
```

Check by hand what the screenshot shows: the applied-code chip, a «تخفیف» row, and a «مبلغ قابل پرداخت» that is the discounted number. Then repeat with a bad code (`NOPE`) and confirm the server's «کد تخفیف یافت نشد.» appears in the `role="alert"` paragraph.

- [ ] **Step 7: Commit**

```bash
cd /e/salyco-fullstack
git add Frontend/salyco-front/src/api/cart.js Frontend/salyco-front/src/context/CartContext.jsx Frontend/salyco-front/src/pages/CartPage.jsx Frontend/salyco-front/src/pages/checkout/CheckoutOrder.jsx
git commit -m "feat(cart): apply and show a discount code on the cart and checkout

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Admin panel

**Files:**
- Create: `Frontend/salyco-front/src/pages/admin/CouponsPanel.jsx`
- Modify: `Frontend/salyco-front/src/api/admin.js`, `src/pages/admin/AdminWorkspace.jsx`, `src/pages/admin/OrdersPanel.jsx`, `src/App.jsx`

**Interfaces:**
- Consumes: `/api/admin/coupons/` CRUD and `/api/admin/coupons/<pk>/redemptions/` (Task 5); `listMattresses()` from `src/api/warranty.js`.
- Produces: the `/admin/coupons` route and its nav entry; `listAdminCoupons`, `createAdminCoupon`, `updateAdminCoupon`, `deleteAdminCoupon`, `listAdminCouponRedemptions` exported from `api/admin.js`.

- [ ] **Step 1: Add the API functions**

Append to `Frontend/salyco-front/src/api/admin.js`:

```js
// ── Discount codes (کدهای تخفیف) ──────────────────────────────────────────────

export async function listAdminCoupons() {
  try {
    const res = await api.get("/api/admin/coupons/");
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت کدهای تخفیف";
    throw new Error(msg);
  }
}

export async function createAdminCoupon(data) {
  try {
    const res = await api.post("/api/admin/coupons/", data);
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? data_.detail || Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در افزودن کد تخفیف");
  }
}

export async function updateAdminCoupon(id, data) {
  try {
    const res = await api.patch(`/api/admin/coupons/${id}/`, data);
    return res.data;
  } catch (err) {
    const data_ = err.response?.data;
    const firstError =
      data_ && typeof data_ === "object"
        ? data_.detail || Object.values(data_).flat()[0]
        : null;
    throw new Error(firstError || "خطا در بروزرسانی کد تخفیف");
  }
}

export async function deleteAdminCoupon(id) {
  try {
    await api.delete(`/api/admin/coupons/${id}/`);
  } catch (err) {
    // "این کد تخفیف استفاده شده و قابل حذف نیست" arrives here.
    const msg = err.response?.data?.detail || "خطا در حذف کد تخفیف";
    throw new Error(msg);
  }
}

export async function listAdminCouponRedemptions(id) {
  try {
    const res = await api.get(`/api/admin/coupons/${id}/redemptions/`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.detail || "خطا در دریافت استفاده‌ها";
    throw new Error(msg);
  }
}
```

- [ ] **Step 2: Write the panel**

Create `Frontend/salyco-front/src/pages/admin/CouponsPanel.jsx`. It follows `AllowedLocationsPanel.jsx` closely — same header, same card styling, same `busyId` pattern, same `load()` with `useCallback`.

```jsx
import { useState, useEffect, useCallback } from "react";
import {
  TicketPercent,
  Plus,
  Trash2,
  Loader2,
  Filter,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import {
  listAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  listAdminCouponRedemptions,
} from "../../api/admin";
import { listMattresses } from "../../api/warranty";
import { toPersianNumber, formatPersianPrice } from "../../utils/persian";

const CARD =
  "rounded-xl border border-brand-mist bg-white shadow-[0_1px_4px_rgba(5,46,95,0.06)]";
const INPUT =
  "h-12 w-full rounded-lg border border-brand-mist bg-white px-4 font-persian text-sm " +
  "text-text-primary placeholder-text-secondary outline-none transition " +
  "focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20";
const LABEL = "mb-1.5 block font-persian text-sm font-medium text-text-primary";

const EMPTY_FORM = {
  code: "",
  description: "",
  discount_type: "PERCENT",
  percent: "",
  amount: "",
  max_discount_amount: "",
  min_order_amount: "",
  starts_at: "",
  ends_at: "",
  usage_limit: "",
  per_customer_limit: "",
  applies_to_all_products: true,
  is_active: true,
  product_ids: [],
};

// The admin API never sends these, so the labels live here.
const STATUS_LABELS = {
  ACTIVE: "فعال",
  SCHEDULED: "زمان‌بندی‌شده",
  EXPIRED: "منقضی‌شده",
  EXHAUSTED: "تکمیل‌شده",
  INACTIVE: "غیرفعال",
};

const STATUS_CLASSES = {
  ACTIVE: "bg-status-success-bg text-status-success",
  SCHEDULED: "bg-brand-warm-white text-brand-navy",
  EXPIRED: "bg-status-error-bg text-status-error",
  EXHAUSTED: "bg-status-error-bg text-status-error",
  INACTIVE: "bg-brand-warm-white text-text-secondary",
};

// <input type="date"> wants YYYY-MM-DD; the API sends an ISO datetime or null.
function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

// An empty string means "unbounded", which the API spells as null. Numbers are
// sent as numbers, not strings, so DRF does not have to coerce them.
function optionalInt(value) {
  const trimmed = String(value).trim();
  return trimmed === "" ? null : Number(trimmed);
}

function optionalMoney(value) {
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function payloadFrom(form) {
  const percent = optionalInt(form.percent);
  const amount = optionalMoney(form.amount);
  return {
    code: form.code.trim(),
    description: form.description.trim(),
    discount_type: form.discount_type,
    // Exactly one of the two is sent: the model rejects a coupon carrying both.
    percent: form.discount_type === "PERCENT" ? percent : null,
    amount: form.discount_type === "FIXED" ? amount : null,
    max_discount_amount:
      form.discount_type === "PERCENT"
        ? optionalMoney(form.max_discount_amount)
        : null,
    min_order_amount: optionalMoney(form.min_order_amount) || "0",
    // Dates are sent as-is; the API stores datetimes and Django parses the
    // date-only string as midnight, which is what a day boundary should mean.
    starts_at: form.starts_at || null,
    expires_at: form.ends_at || null,
    usage_limit: optionalInt(form.usage_limit),
    per_customer_limit: optionalInt(form.per_customer_limit),
    applies_to_all_products: form.applies_to_all_products,
    is_active: form.is_active,
    product_ids: form.applies_to_all_products ? [] : form.product_ids,
  };
}
```

Then the component itself:

```jsx
export default function CouponsPanel() {
  const [rows, setRows] = useState([]);
  const [mattresses, setMattresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Redemptions are fetched per row on first expand and cached by id, so the
  // coupon list itself stays a single request.
  const [expandedId, setExpandedId] = useState(null);
  const [redemptions, setRedemptions] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAdminCoupons());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The product picker's options, from GET /api/mattress/ — the same source the
  // other admin panels read, so no new endpoint.
  useEffect(() => {
    let alive = true;
    listMattresses()
      .then((data) => {
        if (alive) setMattresses(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => {
        // Not fatal: a catalogue-wide coupon needs no options, and the rest of
        // the panel still works with the picker empty.
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setFormError("");
    setForm({
      code: row.code,
      description: row.description || "",
      discount_type: row.discount_type,
      percent: row.percent ?? "",
      amount: row.amount ?? "",
      max_discount_amount: row.max_discount_amount ?? "",
      min_order_amount: row.min_order_amount ?? "",
      // <input type="date"> only accepts YYYY-MM-DD; the API sends an ISO
      // datetime or null.
      starts_at: toDateInput(row.starts_at),
      ends_at: toDateInput(row.expires_at),
      usage_limit: row.usage_limit ?? "",
      per_customer_limit: row.per_customer_limit ?? "",
      applies_to_all_products: row.applies_to_all_products,
      is_active: row.is_active,
      // The write side is reconstructed from the read side's mattress_id.
      product_ids: (row.products || []).map((p) => p.mattress_id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleProduct = (id) =>
    setForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(id)
        ? f.product_ids.filter((p) => p !== id)
        : [...f.product_ids, id],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = payloadFrom(form);
      if (editingId) await updateAdminCoupon(editingId, payload);
      else await createAdminCoupon(payload);
      resetForm();
      await load();
    } catch (err) {
      // The server's Persian, verbatim: it knows which rule failed.
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row) => {
    setBusyId(row.id);
    setError("");
    try {
      const updated = await updateAdminCoupon(row.id, {
        is_active: !row.is_active,
      });
      setRows((rs) => rs.map((r) => (r.id === row.id ? updated : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Unlike AllowedLocationsPanel's, this delete must NOT swallow the error:
  // "این کد تخفیف استفاده شده و قابل حذف نیست" is the message the admin needs,
  // and it is the only way they learn the coupon has to be deactivated instead.
  const handleDelete = async (id) => {
    if (!window.confirm("این کد تخفیف حذف شود؟")) return;
    setBusyId(id);
    setError("");
    try {
      await deleteAdminCoupon(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleExpand = async (row) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (redemptions[row.id]) return; // already fetched
    try {
      const data = await listAdminCouponRedemptions(row.id);
      setRedemptions((r) => ({ ...r, [row.id]: data }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.3em] text-text-secondary">
        <TicketPercent size={16} aria-hidden="true" />
        Discount Codes
      </p>
      <h1 className="mt-2 font-persian text-3xl font-bold text-brand-navy md:text-4xl">
        کدهای تخفیف
      </h1>
      <hr className="mt-4 w-24 border-t-2 border-brand-navy" />
      <p className="mt-4 max-w-2xl font-persian text-sm leading-7 text-text-secondary">
        کدهای تخفیف را تعریف کنید؛ می‌توانید بازهٔ اعتبار، سقف استفاده، حداقل مبلغ
        سفارش و محصولات مشمول را تعیین کنید.
      </p>

      {/* ── create / edit ── */}
      <form onSubmit={handleSubmit} className={`${CARD} mt-6 p-4 md:p-6`}>
        <h2 className="mb-4 font-persian text-lg font-semibold text-brand-navy">
          {editingId ? "ویرایش کد تخفیف" : "افزودن کد تخفیف"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="c-code" className={LABEL}>
              کد تخفیف
            </label>
            <input
              id="c-code"
              dir="ltr"
              required
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="c-desc" className={LABEL}>
              توضیح
            </label>
            <input
              id="c-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div className="mt-4">
          <span className={LABEL}>نوع تخفیف</span>
          <div className="flex gap-2">
            {[
              ["PERCENT", "درصدی"],
              ["FIXED", "مبلغ ثابت"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => set("discount_type", value)}
                aria-pressed={form.discount_type === value}
                className={
                  form.discount_type === value
                    ? "rounded-lg bg-brand-navy px-5 py-2.5 font-persian text-sm font-bold text-white"
                    : "rounded-lg border-2 border-brand-navy bg-white px-5 py-2.5 font-persian text-sm font-bold text-brand-navy"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {form.discount_type === "PERCENT" ? (
            <>
              <div>
                <label htmlFor="c-pct" className={LABEL}>
                  درصد تخفیف
                </label>
                <input
                  id="c-pct"
                  type="number"
                  min="1"
                  max="99"
                  value={form.percent}
                  onChange={(e) => set("percent", e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="c-max" className={LABEL}>
                  سقف تخفیف (تومان)
                </label>
                <input
                  id="c-max"
                  type="number"
                  min="0"
                  placeholder="بدون سقف"
                  value={form.max_discount_amount}
                  onChange={(e) => set("max_discount_amount", e.target.value)}
                  className={INPUT}
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="c-amt" className={LABEL}>
                مبلغ تخفیف (تومان)
              </label>
              <input
                id="c-amt"
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className={INPUT}
              />
            </div>
          )}
          <div>
            <label htmlFor="c-min" className={LABEL}>
              حداقل مبلغ سفارش (تومان)
            </label>
            <input
              id="c-min"
              type="number"
              min="0"
              placeholder="بدون حداقل"
              value={form.min_order_amount}
              onChange={(e) => set("min_order_amount", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        {/* Plain date inputs: there is no Jalali picker in this codebase, which
            is the precedent CreateInstancePanel.jsx:123 already set. */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="c-start" className={LABEL}>
              تاریخ شروع
            </label>
            <input
              id="c-start"
              type="date"
              dir="ltr"
              value={form.starts_at}
              onChange={(e) => set("starts_at", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="c-end" className={LABEL}>
              تاریخ پایان
            </label>
            <input
              id="c-end"
              type="date"
              dir="ltr"
              value={form.ends_at}
              onChange={(e) => set("ends_at", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="c-uses" className={LABEL}>
              سقف کل استفاده
            </label>
            <input
              id="c-uses"
              type="number"
              min="1"
              placeholder="نامحدود"
              value={form.usage_limit}
              onChange={(e) => set("usage_limit", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="c-per" className={LABEL}>
              سقف استفاده هر کاربر
            </label>
            <input
              id="c-per"
              type="number"
              min="1"
              placeholder="نامحدود"
              value={form.per_customer_limit}
              onChange={(e) => set("per_customer_limit", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-brand-mist p-3">
          <label className="flex cursor-pointer items-center gap-2 font-persian text-sm font-medium text-text-primary">
            <input
              type="checkbox"
              checked={form.applies_to_all_products}
              onChange={(e) => set("applies_to_all_products", e.target.checked)}
              className="h-4 w-4 accent-brand-navy"
            />
            همهٔ محصولات
          </label>

          {!form.applies_to_all_products && (
            <>
              <p className="mt-2 font-persian text-xs text-text-secondary">
                محصولات مشمول را انتخاب کنید (
                {toPersianNumber(form.product_ids.length)} انتخاب‌شده)
              </p>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-brand-mist p-2">
                {mattresses.length === 0 ? (
                  <p className="p-2 font-persian text-sm text-text-secondary">
                    محصولی یافت نشد.
                  </p>
                ) : (
                  mattresses.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 font-persian text-sm text-text-primary hover:bg-brand-warm-white"
                    >
                      <input
                        type="checkbox"
                        checked={form.product_ids.includes(m.id)}
                        onChange={() => toggleProduct(m.id)}
                        className="h-4 w-4 accent-brand-navy"
                      />
                      {m.name}
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
          >
            {formError}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-3 font-persian text-sm font-bold text-white transition hover:bg-action-hover disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
            {editingId ? "ذخیره تغییرات" : "افزودن کد تخفیف"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border-2 border-brand-navy px-6 py-3 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white"
            >
              انصراف
            </button>
          )}
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-status-error-bg px-4 py-2.5 font-persian text-sm text-status-error"
        >
          {error}
        </p>
      )}

      {/* ── list ── */}
      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2
              className="animate-spin text-brand-navy"
              size={28}
              aria-hidden="true"
            />
          </div>
        ) : rows.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center gap-3 py-12`}>
            <Filter size={40} className="text-brand-mist" aria-hidden="true" />
            <p className="font-persian text-sm text-text-secondary">
              هنوز کد تخفیفی تعریف نشده است.
            </p>
          </div>
        ) : (
          rows.map((row) => {
            const busy = busyId === row.id;
            const open = expandedId === row.id;
            return (
              <div key={row.id} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="font-sans text-base font-bold text-brand-navy"
                      >
                        {row.code}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-persian text-xs font-medium ${
                          STATUS_CLASSES[row.status] || STATUS_CLASSES.INACTIVE
                        }`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </div>

                    {row.description && (
                      <p className="mt-1 font-persian text-sm text-text-secondary">
                        {row.description}
                      </p>
                    )}

                    <p className="mt-2 font-persian text-sm text-text-primary">
                      {row.discount_type === "PERCENT"
                        ? `٪${toPersianNumber(row.percent)}${
                            row.max_discount_amount
                              ? ` (حداکثر ${formatPersianPrice(
                                  row.max_discount_amount
                                )} تومان)`
                              : ""
                          }`
                        : `${formatPersianPrice(row.amount)} تومان`}
                    </p>

                    <p className="mt-1 font-persian text-xs text-text-secondary">
                      اعتبار:{" "}
                      {row.starts_at || row.expires_at
                        ? `${toDateInput(row.starts_at) || "—"} تا ${
                            toDateInput(row.expires_at) || "—"
                          }`
                        : "بدون محدودیت زمانی"}
                    </p>

                    <p className="mt-1 font-persian text-xs text-text-secondary">
                      استفاده: {toPersianNumber(row.redeemed_count)} از{" "}
                      {row.usage_limit === null
                        ? "نامحدود"
                        : toPersianNumber(row.usage_limit)}
                      {" · "}
                      {row.applies_to_all_products
                        ? "همهٔ محصولات"
                        : `${toPersianNumber((row.products || []).length)} محصول`}
                      {Number(row.min_order_amount) > 0 &&
                        ` · حداقل خرید ${formatPersianPrice(
                          row.min_order_amount
                        )} تومان`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy px-3 py-2 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white"
                    >
                      <Pencil size={15} aria-hidden="true" />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-navy px-3 py-2 font-persian text-sm font-bold text-brand-navy transition hover:bg-brand-warm-white disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2
                          size={15}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : row.is_active ? (
                        <ToggleRight size={16} aria-hidden="true" />
                      ) : (
                        <ToggleLeft size={16} aria-hidden="true" />
                      )}
                      {row.is_active ? "غیرفعال کن" : "فعال کن"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-status-error px-3 py-2 font-persian text-sm font-bold text-status-error transition hover:bg-status-error-bg disabled:opacity-60"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      حذف
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpand(row)}
                      aria-expanded={open}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-persian text-sm font-medium text-text-secondary transition hover:bg-brand-warm-white"
                    >
                      {open ? (
                        <ChevronUp size={16} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={16} aria-hidden="true" />
                      )}
                      استفاده‌ها
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-3 border-t border-brand-mist pt-3">
                    {(redemptions[row.id] || []).length === 0 ? (
                      <p className="font-persian text-sm text-text-secondary">
                        هنوز استفاده نشده است.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-right font-persian text-sm">
                          <thead>
                            <tr className="text-xs text-text-secondary">
                              <th className="pb-2 font-medium">تاریخ</th>
                              <th className="pb-2 font-medium">مشتری</th>
                              <th className="pb-2 font-medium">موبایل</th>
                              <th className="pb-2 font-medium">مبلغ تخفیف</th>
                            </tr>
                          </thead>
                          <tbody>
                            {redemptions[row.id].map((r) => (
                              <tr key={r.id} className="border-t border-brand-mist">
                                <td className="py-2 [font-feature-settings:'tnum']">
                                  {toDateInput(r.created_at)}
                                </td>
                                <td className="py-2">{r.customer_name}</td>
                                <td className="py-2 [font-feature-settings:'tnum']">
                                  {toPersianNumber(r.phone_number)}
                                </td>
                                <td className="py-2 [font-feature-settings:'tnum']">
                                  {formatPersianPrice(r.amount)} تومان
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register the panel**

In `Frontend/salyco-front/src/pages/admin/AdminWorkspace.jsx`, add `TicketPercent` to the lucide import and a control after the «مناطق مجاز ارسال» entry:

```js
  {
    to: "/admin/coupons",
    label: "کدهای تخفیف",
    hint: "تعریف و مدیریت کدهای تخفیف",
    icon: TicketPercent,
  },
```

In `Frontend/salyco-front/src/App.jsx`, add the import next to the other panels and the route inside the `/admin` children:

```js
import CouponsPanel from "./pages/admin/CouponsPanel";
```

```jsx
              <Route path="coupons" element={<CouponsPanel />} />
```

- [ ] **Step 4: Show the coupon on an order**

In `Frontend/salyco-front/src/pages/admin/OrdersPanel.jsx`, add a discount row to the order detail and the code to the summary line so staff can see why a total sits below its line items:

- Wherever the panel renders the order's money total, add above it, when `order.discount_amount` is non-zero:

```jsx
{Number(order.discount_amount) > 0 && (
  <div className="flex justify-between text-sm">
    <span className="text-text-secondary">
      تخفیف {order.coupon_code && `(${order.coupon_code})`}
    </span>
    <span className="font-medium text-status-success [font-feature-settings:'tnum']">
      {formatPersianPrice(order.discount_amount)}− تومان
    </span>
  </div>
)}
```

Confirm `formatPersianPrice` is imported in `OrdersPanel.jsx`; add it to the `../../utils/persian` import if not.

- [ ] **Step 5: Lint and build**

Run: `cd Frontend/salyco-front && npm run lint`
Expected: no new problems beyond the 69-problem baseline.

Run: `cd Frontend/salyco-front && npm run build`
Expected: clean.

- [ ] **Step 6: Verify the panel in a browser**

With the dev server running and a staff session, drive `/admin/coupons` with CDP and screenshot at 390 and 1440. Confirm by eye:

- a coupon can be created with a percent, a window and a usage cap,
- with «همهٔ محصولات» turned off the product list appears and the form refuses to submit with nothing selected (the server's «حداقل یک محصول را انتخاب کنید.» shows),
- the status badge reads «فعال»,
- toggling deactivates and the badge becomes «غیرفعال»,
- deleting a coupon that has been redeemed shows the server's Persian refusal in the error paragraph and the row survives.

Also load `/admin/orders` for an order that used a code and confirm the discount row renders.

- [ ] **Step 7: Commit**

```bash
cd /e/salyco-fullstack
git add Frontend/salyco-front/src/api/admin.js Frontend/salyco-front/src/pages/admin/CouponsPanel.jsx Frontend/salyco-front/src/pages/admin/AdminWorkspace.jsx Frontend/salyco-front/src/pages/admin/OrdersPanel.jsx Frontend/salyco-front/src/App.jsx
git commit -m "feat(admin): discount code panel with scope, limits and redemption history

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Final verification

- [ ] `cd Backend && ./env/Scripts/python.exe manage.py test -v 1` — the whole suite passes.
- [ ] `cd Backend && ./env/Scripts/python.exe manage.py makemigrations --check --dry-run` — prints `No changes detected`, proving the migration matches the models.
- [ ] `cd Frontend/salyco-front && npm run lint && npm run build` — no new lint problems, clean build.
- [ ] End to end by hand against the dev server: create a coupon in the panel, apply it on the cart, pay through Zibal's sandbox, and confirm the redemption row appears in the panel, the order shows the discount, and the discount is counted exactly once.
- [ ] Cancel that order from the admin panel and confirm both usage counters drop by one.

## Known deviations from the spec (decided during planning)

1. **`applies_to_all_products = False` with no products is enforced in `AdminCouponSerializer.validate()`, not `Coupon.clean()`.** `clean()` cannot see it: at creation time the coupon has no pk and therefore no `CouponProduct` rows, so the check there would make every scoped coupon impossible to create.
2. **The admin serializer exposes a read-only `products` list alongside the write-only `product_ids`.** The spec named only `product_ids`; a single field cannot be both, because DRF has no model attribute to read it from. `products` carries the mattress names the panel needs anyway.
3. **`min_order_amount` is inclusive** — a subtotal exactly equal to the minimum passes, while the message wording «بالای X تومان» is kept as the standard Iranian-shop rendering of a minimum-order rule.
4. **`CartPage` renders the coupon box only for a signed-in customer.** `/api/cart/coupon/` is `IsAuthenticated`, and a coupon needs a server-side cart to be persisted on; the logged-out localStorage cart cannot carry one. The spec did not say either way.
