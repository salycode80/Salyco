from __future__ import annotations

import base64
import io
import secrets

import qrcode
from django.conf import settings


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
