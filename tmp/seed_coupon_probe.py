"""Seed the local dev database for the CDP cart verification (Task 6, Step 6).

Idempotent, and scoped to the dev sqlite database only. Prints a JWT access
token for the probe customer so the browser can be signed in without going
through the phone+OTP flow, which would send a real SMS.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from mattress.models import Mattress
from orders.models import AllowedLocation, Cart, CartItem, Coupon
from users.models import Customer

PHONE = "09120000000"

user, created = User.objects.get_or_create(username=PHONE)
if created:
    user.set_unusable_password()
    user.save()

customer, _ = Customer.objects.get_or_create(
    user=user,
    defaults={
        "first_name": "آزمون",
        "last_name": "کاربر",
        "address": "خیابان آزمایشی، پلاک ۱۲، واحد ۳",
        "phone_number": PHONE,
        "postal_code": "1234567890",
    },
)

AllowedLocation.objects.get_or_create(province="تهران", city="")

mattress = Mattress.objects.filter(category=Mattress.CATEGORY_MATTRESS).first()
if mattress is None:
    mattress = Mattress.objects.create(
        name="تشک آزمایشی سالیکو",
        description="محصول آزمایشی برای بررسی کد تخفیف.",
        slug="probe-mattress",
        warranty_months=12,
        price=Decimal("10000000"),
    )

cart, _ = Cart.objects.get_or_create(customer=customer)
if not cart.items.exists():
    CartItem.objects.create(cart=cart, mattress=mattress, quantity=1)

# A whole-cart percent code with no window, so the probe exercises the simple
# path. The rule wording and limits are covered by the backend tests.
coupon, _ = Coupon.objects.get_or_create(
    code="SALYCO10",
    defaults={
        "description": "کد آزمایشی ۱۰ درصد",
        "discount_type": Coupon.PERCENT,
        "percent": 10,
        "applies_to_all_products": True,
        "is_active": True,
    },
)

print("PROBE_MATTRESS", mattress.pk, mattress.name, mattress.price)
print("PROBE_CART_ITEMS", cart.items.count())
print("PROBE_COUPON", coupon.pk, coupon.code, coupon.get_discount_type_display())
print("PROBE_NOW", timezone.now().isoformat())
print("PROBE_TOKEN", str(RefreshToken.for_user(user).access_token))
