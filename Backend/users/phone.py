"""Iranian mobile-number normalisation.

The phone number *is* the username, so it has to reach the database in exactly
one shape — otherwise "09121234567", "+989121234567" and "۰۹۱۲۱۲۳۴۵۶۷" become
three separate accounts for one person, and the second signup fails with a
confusing "already taken" instead of logging them in.
"""

from django.core.exceptions import ValidationError

# Persian (U+06F0) and Arabic-Indic (U+0660) digits, as typed on a Farsi keyboard
# or pasted from an SMS. Mirrors toLatinDigits() in Frontend/src/utils/persian.js.
_DIGIT_TRANSLATION = {
    **{0x06F0 + i: str(i) for i in range(10)},
    **{0x0660 + i: str(i) for i in range(10)},
}

PHONE_ERROR = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود."


def normalize_phone(value: str) -> str:
    """Return `value` as 09XXXXXXXXX, or raise ValidationError.

    Accepts the country-code spellings people actually paste (+98…, 0098…, 98…)
    and any separators (spaces, dashes, parentheses).
    """
    digits = str(value or "").translate(_DIGIT_TRANSLATION)
    digits = "".join(ch for ch in digits if ch.isdigit())

    # Strip the country code in whichever form it arrived, then re-add the
    # national trunk "0" so every stored number has the same 11-digit shape.
    for prefix in ("0098", "98"):
        if digits.startswith(prefix) and len(digits) == len(prefix) + 10:
            digits = digits[len(prefix):]
            break
    if len(digits) == 10 and digits.startswith("9"):
        digits = "0" + digits

    if len(digits) != 11 or not digits.startswith("09"):
        raise ValidationError(PHONE_ERROR)

    return digits
