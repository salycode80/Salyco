"""OTP settings, in one place so switching to a real SMS provider is one edit.

Right now the code is static ("1234") and nothing is sent anywhere: this is a
development stand-in for the SMS gateway, and it is the reason OTP *login* is
refused below. Registration can accept a fake code because the password the
user just chose is what actually protects the account — but letting anyone type
1234 to obtain tokens for an arbitrary phone number would be an open door, so
that path stays closed until a provider is wired up.
"""

from datetime import timedelta

# The stand-in code every registration OTP is issued with.
STATIC_OTP_CODE = "1234"

# How long a code stays valid. Mirrored by OTP_TTL_SECONDS in
# Frontend/salyco-front/src/constants.js, which drives the countdown.
OTP_TTL = timedelta(minutes=2)

# Wrong guesses allowed before the code is burned, so a 4-digit code can't be
# walked through in a loop.
OTP_MAX_ATTEMPTS = 5

# Set to True only once codes are actually delivered by SMS.
OTP_LOGIN_ENABLED = False

OTP_LOGIN_DISABLED_MESSAGE = (
    "ورود با رمز یک‌بار مصرف هنوز فعال نشده است. لطفاً با رمز عبور وارد شوید."
)


def send_otp_sms(phone_number: str, code: str) -> None:
    """Deliver `code` to `phone_number`.

    No-op stand-in. When a gateway is added, this is the only function that
    needs to change — every caller already treats delivery as fire-and-forget.
    """
    return None
