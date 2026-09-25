# Staff session + a redeemed coupon, for the admin panel probe (Task 7, Step 6).
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from decimal import Decimal  # noqa: E402

from django.contrib.auth.models import User  # noqa: E402
from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402

from orders.models import Coupon, CouponRedemption, Order  # noqa: E402
from users.models import Customer  # noqa: E402

staff, _ = User.objects.get_or_create(username="probe-admin")
staff.is_staff = True
staff.set_unusable_password()
staff.save()
assert User.objects.get(pk=staff.pk).is_staff, "is_staff did not stick"

coupon, _ = Coupon.objects.get_or_create(code="NOPE")
coupon.is_active = True
# get_or_create bypasses clean(), so give it a percent the model accepts.
coupon.percent = 10
coupon.save()

# Restore the main probe code: the toggle test switches it off.
Coupon.objects.filter(code="SALYCO10").update(is_active=True)
customer = Customer.objects.first()

order, _ = Order.objects.get_or_create(
    customer=customer,
    coupon=coupon,
    defaults={
        "coupon_code": coupon.code,
        "discount_amount": Decimal("1000"),
        "method": Order.ONLINE,
        "status": Order.CONFIRMED,
        "recipient_name": "آزمون کاربر",
        "phone_number": customer.phone_number,
        "province": "تهران",
        "city": "تهران",
        "postal_code": "1234567890",
        "address": "خیابان آزمایشی، پلاک ۱۲",
        "total_amount": Decimal("1000"),
    },
)
CouponRedemption.objects.get_or_create(
    order=order,
    defaults={"coupon": coupon, "customer": customer, "amount": Decimal("1000")},
)

print("STAFF is_staff =", staff.is_staff)
print("REDEMPTIONS =", CouponRedemption.objects.filter(coupon=coupon).count())
print("STAFF_TOKEN", str(RefreshToken.for_user(staff).access_token))
