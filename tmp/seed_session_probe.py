"""Mint a staff session and print the tokens, for the UI verification probes.

A probe needs to see the authenticated header — the account control and the cart
badge only exist for a signed-in visitor — and the OTP login is the only path in,
which needs a real SMS. This mints the pair directly.

The account is left deliberately without a first_name/last_name: it is the shape
that produced the "0" in the avatar, since the phone number is then the only
name the header can fall back to.
"""

import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402

from users.models import Customer, User  # noqa: E402

PHONE = "09123334444"

user, created = User.objects.get_or_create(username=PHONE)
user.is_staff = True
user.first_name = ""
user.last_name = ""
user.save()

Customer.objects.get_or_create(user=user, defaults={"phone_number": PHONE})

refresh = RefreshToken.for_user(user)
print("USER", user.username, "created" if created else "reused")
print("ACCESS", str(refresh.access_token))
print("REFRESH", str(refresh))
