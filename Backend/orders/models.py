from __future__ import annotations

from decimal import Decimal

from django.db import models

from mattress.models import Mattress, MattressSize
from users.models import Customer


class Cart(models.Model):
    """One persistent cart per customer. Created on demand the first time a
    logged-in customer touches their cart (get_or_create), mirroring the
    Customer.objects.get_or_create pattern used across the codebase."""

    customer = models.OneToOneField(
        Customer, on_delete=models.CASCADE, related_name="cart"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "cart"
        verbose_name_plural = "carts"

    def __str__(self) -> str:
        return f"Cart({self.customer})"

    @property
    def total(self) -> Decimal:
        return sum((item.line_total for item in self.items.all()), Decimal("0"))

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
    created_at = models.DateTimeField(auto_now_add=True)

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
