import secrets

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

from .otp import OTP_MAX_ATTEMPTS, OTP_TTL, STATIC_OTP_CODE

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


class PhoneOTP(models.Model):
    """A one-time code issued against a phone number.

    Keyed by phone rather than by user because the registration code is issued
    before the account is usable, and the same table serves the (currently
    disabled) login flow where no signup is involved.
    """

    PURPOSE_REGISTER = "REGISTER"
    PURPOSE_LOGIN = "LOGIN"
    PURPOSE_CHOICES = [
        (PURPOSE_REGISTER, "register"),
        (PURPOSE_LOGIN, "login"),
    ]

    phone_number = models.CharField(max_length=20, db_index=True, verbose_name="phone number")
    code = models.CharField(max_length=8, verbose_name="code")
    purpose = models.CharField(
        max_length=16, choices=PURPOSE_CHOICES, default=PURPOSE_REGISTER, verbose_name="purpose"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="created at")
    expires_at = models.DateTimeField(verbose_name="expires at")
    attempts = models.PositiveSmallIntegerField(default=0, verbose_name="attempts")
    is_used = models.BooleanField(default=False, verbose_name="is used")

    class Meta:
        verbose_name = "phone OTP"
        verbose_name_plural = "phone OTPs"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.phone_number} ({self.purpose})"

    @classmethod
    def issue(cls, phone_number: str, purpose: str = PURPOSE_REGISTER) -> "PhoneOTP":
        """Create a fresh code, retiring any earlier one for this phone+purpose.

        Retiring the old rows is what makes "resend" safe: only the newest code
        can be redeemed, so a code read off an older SMS stops working the
        moment a new one is requested.
        """
        cls.objects.filter(
            phone_number=phone_number, purpose=purpose, is_used=False
        ).update(is_used=True)

        # Generate a real OTP code using the new function
        from .otp import generate_otp_code
        code = generate_otp_code()

        return cls.objects.create(
            phone_number=phone_number,
            code=code,
            purpose=purpose,
            expires_at=timezone.now() + OTP_TTL,
        )

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def seconds_remaining(self) -> int:
        return max(0, int((self.expires_at - timezone.now()).total_seconds()))

    def verify(self, code: str) -> tuple[bool, str]:
        """Check `code`, counting the attempt. Returns (ok, error_message)."""
        if self.is_used:
            return False, "این کد قبلاً استفاده شده است. کد جدید درخواست کنید."
        if self.is_expired:
            return False, "کد تأیید منقضی شده است. کد جدید درخواست کنید."
        if self.attempts >= OTP_MAX_ATTEMPTS:
            return False, "تعداد تلاش‌های مجاز به پایان رسید. کد جدید درخواست کنید."

        # Count the attempt before comparing, so a failed guess is recorded even
        # if the response never reaches the client.
        self.attempts += 1
        if str(code).strip() != self.code:
            self.save(update_fields=["attempts"])
            return False, "کد تأیید نادرست است."

        self.is_used = True
        self.save(update_fields=["attempts", "is_used"])
        return True, ""