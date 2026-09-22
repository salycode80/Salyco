from __future__ import annotations

import secrets
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from mattress.models import Mattress, MattressSize
from users.models import Customer


def generate_order_token() -> str:
    """Unguessable identifier for an order's public page. Module-level (not a
    lambda) so migrations can reference it.

    Length is dictated by SMS.ir, not by taste: a pattern parameter value may be
    at most 25 characters, and the confirmation SMS sends "orders/<token>" as
    one parameter (see order_public_link_path in notifications.py). That leaves
    18 for the token, so this is token_urlsafe(13) rather than the token_hex(16)
    it started as — 104 bits of entropy in 18 chars instead of 128 in 32.

    Do not lengthen without also re-checking that 25-character budget; going
    over it makes SMS.ir reject the send outright, with no SMS and no error the
    customer can see.
    """
    return secrets.token_urlsafe(13)


class Cart(models.Model):
    """One persistent cart per customer. Created on demand the first time a
    logged-in customer touches their cart (get_or_create), mirroring the
    Customer.objects.get_or_create pattern used across the codebase."""

    customer = models.OneToOneField(
        Customer, on_delete=models.CASCADE, related_name="cart"
    )
    # Named as a string because Cart is declared above Coupon: a direct class
    # reference here would be a NameError at import time. Django resolves the
    # string lazily, so the two can stay in reading order.
    #
    # SET_NULL, not CASCADE: retiring a coupon must not take live carts with it,
    # it must just stop discounting them.
    coupon = models.ForeignKey(
        "Coupon",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="coupon",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "cart"
        verbose_name_plural = "carts"

    def __str__(self) -> str:
        return f"Cart({self.customer})"

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
        """Payable. Keeps its name so payments/views.py (`toman_to_rial(cart.total)`)
        stays correct without being edited."""
        return max(self.subtotal - self.discount_amount, Decimal("0"))

    @property
    def count(self) -> int:
        return sum(item.quantity for item in self.items.all())


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    mattress = models.ForeignKey(Mattress, on_delete=models.PROTECT, related_name="+")
    # Null size means the customer added the base product (no size chosen).
    size = models.ForeignKey(
        MattressSize, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "cart item"
        verbose_name_plural = "cart items"
        # One row per (product, size) — adding again bumps quantity instead.
        unique_together = [("cart", "mattress", "size")]
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.quantity}× {self.mattress.name}"

    @property
    def unit_price(self) -> Decimal:
        """Live price: the chosen size's price, else the base mattress price —
        with the mattress's active discount applied, so an on-sale product is
        charged at the price the product page advertises."""
        if self.size_id is not None:
            return self.size.final_price
        return self.mattress.final_price

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity


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


class Order(models.Model):
    ONLINE = "ONLINE"
    PHONE = "PHONE"
    METHOD_CHOICES = [(ONLINE, "Online"), (PHONE, "Phone")]

    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    SHIPPED = "SHIPPED"
    CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (CONFIRMED, "Confirmed"),
        (SHIPPED, "Shipped"),
        (CANCELLED, "Cancelled"),
    ]

    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, related_name="orders"
    )
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)

    # Buyer snapshot — captured at order time so later profile edits don't
    # rewrite the recorded order (same rationale as MattressInstance buyer_*).
    recipient_name = models.CharField(max_length=255, blank=True, default="")
    phone_number = models.CharField(max_length=20, blank=True, default="")

    # Phone order specific fields
    customer_phone = models.CharField(max_length=20, blank=True, default="", verbose_name="شماره تماس مشتری")
    call_time_preference = models.CharField(max_length=255, blank=True, default="", verbose_name="ترجیح زمان تماس")

    # Shipping snapshot — blank for phone orders.
    province = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    postal_code = models.CharField(max_length=20, blank=True, default="")
    address = models.TextField(blank=True, default="")

    total_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)

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

    created_at = models.DateTimeField(auto_now_add=True)

    # Capability token for the public order page linked from the confirmation
    # SMS. The customer taps that link on a phone that is often not signed in,
    # so the page cannot require auth; the token is the credential instead, in
    # the same spirit as the warranty QR URL. 32 hex chars of os.urandom —
    # unguessable, and scoped to exactly one order.
    public_token = models.CharField(
        max_length=64,
        unique=True,
        default=generate_order_token,
        editable=False,
        verbose_name="public token",
    )

    # Latch so the confirmation SMS is sent once per order. Staff re-saving a
    # CONFIRMED order, or moving it SHIPPED → CONFIRMED again, must not spend
    # another SMS credit or re-notify the customer.
    confirmation_sms_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        editable=False,
        verbose_name="confirmation SMS sent at",
    )

    class Meta:
        verbose_name = "order"
        verbose_name_plural = "orders"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Order #{self.pk} ({self.get_method_display()})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    mattress = models.ForeignKey(Mattress, on_delete=models.PROTECT, related_name="+")
    # Snapshots so a historical order stays correct if the product/size changes.
    mattress_name = models.CharField(max_length=255)
    size_label = models.CharField(max_length=50, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        verbose_name = "order item"
        verbose_name_plural = "order items"

    def __str__(self) -> str:
        return f"{self.quantity}× {self.mattress_name}"

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity


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


class AllowedLocation(models.Model):
    """Admin-managed area where online ordering is accepted. A blank city means
    the whole province is allowed."""

    province = models.CharField(max_length=100, verbose_name="province")
    city = models.CharField(max_length=100, blank=True, default="", verbose_name="city")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "allowed location"
        verbose_name_plural = "allowed locations"
        unique_together = [("province", "city")]
        ordering = ["province", "city"]

    def __str__(self) -> str:
        return f"{self.province}{f' - {self.city}' if self.city else ''}"
