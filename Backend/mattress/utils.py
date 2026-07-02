from __future__ import annotations

import base64
import io
import secrets

import qrcode
from django.conf import settings


def get_warranty_public_url(serial_number: str) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
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
