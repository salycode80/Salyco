"""Second half of the E2E: settle the paid order, then cancel it and watch the
counters. Replays what Zibal's browser redirect would do, against the local
callback endpoint — the only simulated part is the redirect itself; the verify
inside settlement is a real gateway call."""

import json
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth.models import User  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402
from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402

from orders.models import Coupon, Order  # noqa: E402
from orders.promotions import customer_redemption_count  # noqa: E402
from payments.models import Payment  # noqa: E402

TRACK = 4802893792
customer = User.objects.get(username="09120000000").customer
coupon = Coupon.objects.get(code="ZTEST10")
order = Order.objects.get(pk=4)


def counters(label):
    print(
        f"COUNTERS[{label}]",
        "total=", coupon.redemptions.exclude(order__status=Order.CANCELLED).count(),
        "for-customer=", customer_redemption_count(coupon, customer),
        "| rows=", coupon.redemptions.count(),
        "| order=", Order.objects.get(pk=order.pk).status,
        "| cart_coupon=", getattr(customer.cart.coupon, "code", None),
    )


counters("before-settlement")

client = APIClient()
client.defaults["HTTP_HOST"] = "127.0.0.1"

r = client.get(f"/api/payments/callback/?trackId={TRACK}&success=1&status=1")
print("CALLBACK", r.status_code, "->", r.headers.get("Location", "(no redirect)"))
print("PAYMENT", Payment.objects.get(track_id=TRACK).status)
counters("after-settlement")
print("REDEMPTION ROW", json.dumps(
    {"order": order.pk, "coupon": Order.objects.get(pk=4).coupon_code,
     "amount": str(order.redemption.amount) if hasattr(order, "redemption") else None},
    ensure_ascii=False))

# Read it back the way the admin panel does.
staff = User.objects.get(username="probe-admin")
admin = APIClient()
admin.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(staff).access_token}")
admin.defaults["HTTP_HOST"] = "127.0.0.1"
listing = admin.get("/api/admin/coupons/").json()
row = next(c for c in listing if c["code"] == "ZTEST10")
print("PANEL", json.dumps({k: row[k] for k in
      ["code", "status", "redeemed_count", "remaining_uses", "total_discount_given"]},
      ensure_ascii=False))
print("PANEL REDEMPTIONS", json.dumps(
    admin.get(f"/api/admin/coupons/{row['id']}/redemptions/").json(), ensure_ascii=False))

# Cancel it from the admin panel, exactly as staff would.
r = admin.patch(f"/api/admin/orders/{order.pk}/", {"status": "CANCELLED"}, format="json")
print("CANCEL", r.status_code, Order.objects.get(pk=order.pk).status)
counters("after-cancel")
listing = admin.get("/api/admin/coupons/").json()
row = next(c for c in listing if c["code"] == "ZTEST10")
print("PANEL AFTER CANCEL", json.dumps({k: row[k] for k in
      ["code", "status", "redeemed_count", "remaining_uses", "total_discount_given"]},
      ensure_ascii=False))
