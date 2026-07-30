"""OTP settings and SMS.ir integration for sending real verification codes."""

from datetime import timedelta
import secrets
from .sms_service import send_sms_otp

# Real 4-digit OTP code generation
STATIC_OTP_CODE = None  # Disable static codes - use real SMS

# How long a code stays valid. Mirrored by OTP_TTL_SECONDS in
# Frontend/salyco-front/src/constants.js, which drives the countdown.
OTP_TTL = timedelta(minutes=2)

# Wrong guesses allowed before the code is burned, so a 4-digit code can't be
# walked through in a loop.
OTP_MAX_ATTEMPTS = 5

# OTP login is now enabled with real SMS delivery
OTP_LOGIN_ENABLED = True

OTP_LOGIN_DISABLED_MESSAGE = (
    "ورود با رمز یک‌بار مصرف هنوز فعال نشده است. لطفاً با رمز عبور وارد شوید."
)


def send_otp_sms(phone_number: str, code: str) -> tuple[bool, str]:
    """
    Send OTP code via SMS.ir to the given phone number.

    Returns tuple(success: bool, message: str)
    """
    return send_sms_otp(phone_number, code)


def generate_otp_code() -> str:
    """Generate a secure 4-digit OTP code."""
    return f"{secrets.randbelow(10000):04d}"
