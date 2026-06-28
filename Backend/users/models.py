from django.db import models
from django.contrib.auth import get_user_model

# Create your models here.

User = get_user_model()


class Customer(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="customer",
    )
    first_name = models.CharField(max_length=150, verbose_name="first name")
    last_name = models.CharField(max_length=150, verbose_name="last name")
    address = models.TextField(verbose_name="address")
    phone_number = models.CharField(max_length=20, verbose_name="phone number")
    postal_code = models.CharField(max_length=20, verbose_name="postal code")

    class Meta:
        verbose_name = "customer"
        verbose_name_plural = "customers"
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"