"""Optional end-to-end check: coupon -> paid order -> redemption -> cancel.

Runs in-process against the dev database with the Zibal TEST merchant
(`ZIBAL_MERCHANT=zibal`, supplied by the caller's environment so .env is never
touched). The gateway itself is live for everyone; the test merchant is what
makes a payment simulated rather than real.

Prints labelled lines so the output can be read without a debugger.
"""

import json
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from decimal import Decimal  # noqa: E402

from django.contrib.auth.models import User  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402
from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402

from mattress.models import Mattress  # noqa: E402
from orders.models import (  # noqa: E402
    AllowedLocation,
    Cart,
    CartItem,
    Coupon,
    CouponRedemption,
    Order,
)
from django.conf import settings  # noqa: E402

from payments import zibal  # noqa: E402
from payments.models import Payment  # noqa: E402

print("MERCHANT", settings.ZIBAL_MERCHANT)
PHONE = "09120000000"
CODE = "ZTEST10"

user = User.objects.get(username=PHONE)
customer = user.customer
AllowedLocation.objects.get_or_create(province="تهران", city="")

mattress = (
    Mattress.objects.filter(category=Mattress.CATEGORY_MATTRESS).first()
    or Mattress.objects.first()
)
print("MATTRESS", mattress.pk, mattress.name, "price", mattress.price)

cart, _ = Cart.objects.get_or_create(customer=customer)
cart.items.all().delete()
CartItem.objects.create(cart=cart, mattress=mattress, quantity=1)
cart.coupon = None
cart.save(update_fields=["coupon", "updated_at"])

coupon, _ = Coupon.objects.get_or_create(
    code=CODE,
    defaults={
        "description": "کد آزمون سرتاسری",
        "discount_type": Coupon.PERCENT,
        "percent": 10,
        "applies_to_all_products": True,
        "is_active": True,
    },
)
coupon.is_active = True
coupon.percent = 10
coupon.save()
print("COUPON", coupon.pk, coupon.code, "redemptions", coupon.redemptions.count())

client = APIClient()
client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
client.defaults["HTTP_HOST"] = "127.0.0.1"

r = client.post("/api/cart/coupon/", {"code": CODE}, format="json")
print("APPLY", r.status_code, json.dumps(r.json(), ensure_ascii=False)[:220])

payload = {
    "province": "تهران",
    "city": "تهران",
    "postal_code": "1234567890",
    "address": "خیابان آزمایشی، پلاک ۱",
    "recipient_name": "آزمون کاربر",
    "phone_number": PHONE,
}
r = client.post("/api/payments/start/", payload, format="json")
print("START", r.status_code, json.dumps(r.json(), ensure_ascii=False)[:300])

payment = Payment.objects.filter(order__customer=customer).order_by("-pk").first()
print("PAYMENT", payment.pk, "order", payment.order_id, "track", payment.track_id,
      "status", payment.status, "amount_rial", payment.amount_rial)

order = payment.order
print("ORDER", order.pk, "subtotal", order.total_amount, "discount",
      order.discount_amount, "coupon", order.coupon_code, "status", order.status)

# What does the live gateway say about this session right now?
if payment.track_id:
    ok, data = zibal.inquiry(payment.track_id) if hasattr(zibal, "inquiry") else zibal.verify(payment.track_id)
    print("GATEWAY", ok, json.dumps(data, ensure_ascii=False)[:300])
    print("GATEWAY STATUS", data.get("status"), zibal.status_message(data.get("status")))
