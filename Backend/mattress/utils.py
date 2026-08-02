from __future__ import annotations

import base64
import io
import secrets
from datetime import date

import qrcode
from django.conf import settings


def to_jalali(value: date) -> tuple[int, int, int]:
    """Convert a Gregorian date to the Jalali (Shamsi) calendar.

    Hand-rolled rather than pulled from jdatetime/persiantools, to avoid adding a
    dependency for the one thing this project needs from one: formatting a date
    for a Persian-language SMS. The algorithm is the standard division-based
    conversion and is exact for the Gregorian range 1901-2099, which covers every
    date this system can hold (activation dates are "today" at registration and
    manufacture dates are recent).
    """
    gy, gm, gd = value.year, value.month, value.day

    g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gy2 = gy - 1600
    gm2 = gm - 1
    gd2 = gd - 1

    g_day_no = 365 * gy2 + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400
    for i in range(gm2):
        g_day_no += g_days_in_month[i]
    # March-onward dates in a Gregorian leap year fall after 29 February.
    if gm2 > 1 and ((gy % 4 == 0 and gy % 100 != 0) or (gy % 400 == 0)):
        g_day_no += 1
    g_day_no += gd2

    # 1600-03-21 Gregorian == 979-01-01 Jalali, the epoch this offset encodes.
    j_day_no = g_day_no - 79
    j_np = j_day_no // 12053
    j_day_no %= 12053
    jy = 979 + 33 * j_np + 4 * (j_day_no // 1461)
    j_day_no %= 1461
    if j_day_no >= 366:
        jy += (j_day_no - 1) // 365
        j_day_no = (j_day_no - 1) % 365

    # First six Jalali months have 31 days, the next five have 30.
    for i in range(11):
        month_length = 31 if i < 6 else 30
        if j_day_no < month_length:
            return jy, i + 1, j_day_no + 1
        j_day_no -= month_length
    return jy, 12, j_day_no + 1


def format_jalali(value: date | None) -> str:
    """Render a date as a Shamsi 'YYYY/MM/DD' string, or "" when absent.

    Used for customer-facing SMS text, where a Gregorian date reads as wrong to
    an Iranian customer even though it names the same day.
    """
    if value is None:
        return ""
    jy, jm, jd = to_jalali(value)
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def get_warranty_public_url(serial_number: str, request=None) -> str:
    """Absolute URL the warranty QR points at.

    Prefers the explicit FRONTEND_BASE_URL setting (e.g. https://salyco.ir in
    production, or a LAN IP like http://192.168.1.20:8080 for phone testing).
    When it is left empty, fall back to the host that actually served this
    request, so a scanned QR resolves against whatever origin the API was
    reached on instead of an unreachable http://localhost default.
    """
    base = (settings.FRONTEND_BASE_URL or "").rstrip("/")
    if not base and request is not None:
        base = request.build_absolute_uri("/").rstrip("/")
    return f"{base}/warranty/mattress/{serial_number}"


def generate_serial_number() -> str:
    return f"SAL-{secrets.token_hex(4).upper()}"


def generate_qr_code_base64(url: str) -> str:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
