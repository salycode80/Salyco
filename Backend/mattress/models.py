from __future__ import annotations
import calendar
from datetime import date
from typing import Optional
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from users.models import Customer

User = get_user_model()


def add_months(source_date: date, months: int) -> date:
    """Return source_date shifted forward by the given number of months."""
    month_index = source_date.month - 1 + months
    year = source_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)



class Mattress(models.Model):
    name = models.CharField(max_length=255, verbose_name="name")
    description = models.TextField(verbose_name="description")
    slug = models.SlugField(unique=True, verbose_name="slug")
    warranty_months = models.PositiveIntegerField(verbose_name="warranty months")
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="price",
    )
    image = models.ImageField(
        upload_to="mattresses/",
        blank=True,
        null=True,
        verbose_name="image",
    )
    width = models.IntegerField(default=0)
    length = models.IntegerField(default=0)

    class Meta:
        verbose_name = "mattress"
        verbose_name_plural = "mattresses"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


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
