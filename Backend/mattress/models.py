from __future__ import annotations
import calendar
from datetime import date
from typing import Optional
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Avg, Count
from django.utils import timezone
from users.models import Customer

User = get_user_model()


def add_months(source_date: date, months: int) -> date:
    month_index = source_date.month - 1 + months
    year = source_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


class Mattress(models.Model):
    name = models.CharField(max_length=255, verbose_name="name")
    brand = models.CharField(max_length=100, blank=True, default="", verbose_name="brand")
    subtitle = models.CharField(max_length=255, blank=True, default="", verbose_name="subtitle")
    description = models.TextField(verbose_name="description")
    long_description = models.TextField(blank=True, default="", verbose_name="long description")
    slug = models.SlugField(unique=True, verbose_name="slug")
    warranty_months = models.PositiveIntegerField(verbose_name="warranty months")
    price = models.DecimalField(max_digits=18, decimal_places=2, verbose_name="price")
    image = models.ImageField(upload_to="mattresses/", blank=True, null=True, verbose_name="image")
    width = models.IntegerField(default=0)
    length = models.IntegerField(default=0)
    height = models.IntegerField(default=0, verbose_name="height (cm)")
    is_available = models.BooleanField(default=True, verbose_name="is available")
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0, verbose_name="average rating")
    review_count = models.IntegerField(default=0, verbose_name="review count")

    class Meta:
        verbose_name = "mattress"
        verbose_name_plural = "mattresses"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def update_rating_cache(self):
        stats = self.reviews.filter(is_approved=True).aggregate(
            avg=Avg("rating"), cnt=Count("id")
        )
        self.average_rating = stats["avg"] or 0
        self.review_count = stats["cnt"] or 0
        self.save(update_fields=["average_rating", "review_count"])


class MattressImage(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="mattresses/gallery/")
    alt_text = models.CharField(max_length=255, blank=True, default="")
    is_primary = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress image"
        verbose_name_plural = "mattress images"

    def __str__(self):
        return f"{self.mattress.name} - image {self.display_order}"


class MattressSize(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="sizes")
    label = models.CharField(max_length=50, verbose_name="size label")
    width = models.IntegerField(verbose_name="width (cm)")
    length = models.IntegerField(verbose_name="length (cm)")
    price = models.DecimalField(max_digits=18, decimal_places=2, verbose_name="price")
    in_stock = models.BooleanField(default=True, verbose_name="in stock")

    class Meta:
        ordering = ["width", "length"]
        verbose_name = "mattress size"
        verbose_name_plural = "mattress sizes"

    def __str__(self):
        return f"{self.mattress.name} - {self.width}x{self.length}"


class MattressSpecification(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="specifications")
    key = models.CharField(max_length=100, verbose_name="specification key")
    value = models.CharField(max_length=255, verbose_name="specification value")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress specification"
        verbose_name_plural = "mattress specifications"

    def __str__(self):
        return f"{self.key}: {self.value}"


class MattressFeature(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="features")
    title = models.CharField(max_length=100, verbose_name="feature title")
    icon_name = models.CharField(max_length=50, blank=True, default="", verbose_name="lucide icon name")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress feature"
        verbose_name_plural = "mattress features"

    def __str__(self):
        return self.title


class MattressFAQ(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="faqs")
    question = models.CharField(max_length=255, verbose_name="question")
    answer = models.TextField(verbose_name="answer")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order"]
        verbose_name = "mattress FAQ"
        verbose_name_plural = "mattress FAQs"

    def __str__(self):
        return self.question


class MattressProCon(models.Model):
    PRO = "PRO"
    CON = "CON"
    TYPE_CHOICES = [(PRO, "Pro"), (CON, "Con")]

    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="pros_cons")
    text = models.CharField(max_length=255, verbose_name="text")
    type = models.CharField(max_length=3, choices=TYPE_CHOICES, verbose_name="type")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["type", "display_order"]
        verbose_name = "mattress pro/con"
        verbose_name_plural = "mattress pros & cons"

    def __str__(self):
        return f"[{self.type}] {self.text}"


class Review(models.Model):
    mattress = models.ForeignKey(Mattress, on_delete=models.CASCADE, related_name="reviews")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveIntegerField(verbose_name="rating")
    title = models.CharField(max_length=200, verbose_name="review title")
    body = models.TextField(verbose_name="review body")
    pros = models.TextField(blank=True, default="", verbose_name="pros")
    cons = models.TextField(blank=True, default="", verbose_name="cons")
    created_at = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False, verbose_name="is approved")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "review"
        verbose_name_plural = "reviews"

    def __str__(self):
        return f"{self.customer} - {self.mattress.name} ({self.rating}/5)"


class MattressInstance(models.Model):
    serial_number = models.CharField(
        max_length=100,
        primary_key=True,
        verbose_name="serial number",
    )
    mattress = models.ForeignKey(
        Mattress,
        on_delete=models.PROTECT,
        related_name="instances",
        verbose_name="mattress",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mattress_instances",
        verbose_name="customer",
    )
    # Per-sale snapshot of the buyer's details, captured at warranty
    # registration. Kept on the instance (not only on the linked Customer) so
    # that registering a later instance for a different buyer can never rewrite
    # the recorded buyer of an earlier sale — the shared account Customer used
    # to be overwritten in place, which retroactively changed every past sale.
    buyer_first_name = models.CharField(max_length=150, blank=True, default="", verbose_name="buyer first name")
    buyer_last_name = models.CharField(max_length=150, blank=True, default="", verbose_name="buyer last name")
    buyer_phone_number = models.CharField(max_length=20, blank=True, default="", verbose_name="buyer phone number")
    buyer_address = models.TextField(blank=True, default="", verbose_name="buyer address")
    buyer_postal_code = models.CharField(max_length=20, blank=True, default="", verbose_name="buyer postal code")
    is_warranty_active = models.BooleanField(
        default=False,
        verbose_name="warranty active",
    )
    activation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="activation date",
    )
    manufacture_date = models.DateField(verbose_name="manufacture date")

    class Meta:
        verbose_name = "mattress instance"
        verbose_name_plural = "mattress instances"
        ordering = ["-manufacture_date", "serial_number"]

    def __str__(self) -> str:
        return self.serial_number

    @property
    def buyer_full_name(self) -> str:
        """The buyer recorded for this specific sale.

        Prefers the per-instance snapshot; falls back to the linked account
        Customer for instances registered before the snapshot fields existed.
        """
        name = f"{self.buyer_first_name} {self.buyer_last_name}".strip()
        if name:
            return name
        if self.customer_id is not None:
            return f"{self.customer.first_name} {self.customer.last_name}".strip()
        return ""

    @property
    def warranty_expiration_date(self) -> Optional[date]:
        if self.activation_date is None:
            return None
        return add_months(self.activation_date, self.mattress.warranty_months)

    @property
    def warranty_remaining_days(self) -> Optional[int]:
        expiration_date = self.warranty_expiration_date
        if expiration_date is None:
            return None
        return (expiration_date - timezone.localdate()).days

    @property
    def is_under_warranty(self) -> bool:
        if not self.is_warranty_active or self.activation_date is None:
            return False
        expiration_date = self.warranty_expiration_date
        if expiration_date is None:
            return False
        return timezone.localdate() <= expiration_date
