from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import signing
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.utils import aware_utcnow

from .models import Customer, PhoneOTP
from .serializer import REGISTRATION_TOKEN_SALT


# The inactivity window enforced by the frontend (IDLE_TIMEOUT_MS in
# Frontend/salyco-front/src/constants.js). Duplicated here so a change to either
# side that breaks the invariant fails a test instead of only failing in a
# browser, 30 minutes into a session.
FRONTEND_IDLE_TIMEOUT = timedelta(minutes=30)


class TokenLifetimeSettingsTests(APITestCase):
    """Guards the SIMPLE_JWT config that the idle-session feature depends on."""

    def test_refresh_lifetime_exceeds_frontend_idle_timeout(self):
        # If these are equal, the refresh token dies at the same instant the
        # client decides to log out — and the «ادامه نشست» button, pressed at
        # 29:59, hits an expired token. LEEWAY is 0, so there is no slack.
        self.assertGreater(
            api_settings.REFRESH_TOKEN_LIFETIME,
            FRONTEND_IDLE_TIMEOUT,
            "REFRESH_TOKEN_LIFETIME must exceed the frontend IDLE_TIMEOUT_MS",
        )

    def test_access_lifetime_shorter_than_refresh_lifetime(self):
        self.assertLess(
            api_settings.ACCESS_TOKEN_LIFETIME,
            api_settings.REFRESH_TOKEN_LIFETIME,
        )

    def test_rotation_enabled_without_blacklist(self):
        # Rotation is what makes the window slide. Blacklisting is deliberately
        # off: it would invalidate a token another tab already has in flight,
        # and it requires the token_blacklist app (a DB write per rotation).
        self.assertTrue(api_settings.ROTATE_REFRESH_TOKENS)
        self.assertFalse(api_settings.BLACKLIST_AFTER_ROTATION)


class TokenRotationTests(APITestCase):
    """The sliding-window behaviour the frontend keep-alive relies on."""

    @classmethod
    def setUpTestData(cls):
        cls.password = "idle-timeout-test-pw"
        cls.user = User.objects.create_user(
            username="idletester",
            email="idle@example.com",
            password=cls.password,
        )

    def obtain(self):
        response = self.client.post(
            reverse("get_token"),
            {"username": self.user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_obtain_returns_both_tokens(self):
        data = self.obtain()
        self.assertIn("access", data)
        self.assertIn("refresh", data)

    def test_refresh_returns_a_new_rotated_refresh_token(self):
        # This is the regression test for the frontend bug where api.js stored
        # only `data.access` and dropped the rotated refresh token, which logged
        # active users out as soon as the original token expired.
        original = self.obtain()["refresh"]

        response = self.client.post(
            reverse("refresh"), {"refresh": original}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("refresh", response.data)
        self.assertNotEqual(response.data["refresh"], original)
        self.assertIn("access", response.data)

    def test_rotated_token_carries_a_full_fresh_window(self):
        original = self.obtain()["refresh"]
        rotated = self.client.post(
            reverse("refresh"), {"refresh": original}, format="json"
        ).data["refresh"]

        original_payload = RefreshToken(original).payload
        rotated_payload = RefreshToken(rotated).payload

        expected = int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds())
        self.assertEqual(
            rotated_payload["exp"] - rotated_payload["iat"],
            expected,
            "each rotation must reset the clock to a full REFRESH_TOKEN_LIFETIME",
        )
        # The window actually moved forward — this is what "sliding" means.
        self.assertGreaterEqual(rotated_payload["exp"], original_payload["exp"])
        self.assertNotEqual(rotated_payload["jti"], original_payload["jti"])

    def test_access_token_lifetime_matches_settings(self):
        access = self.obtain()["access"]
        payload = AccessToken(access).payload
        self.assertEqual(
            payload["exp"] - payload["iat"],
            int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        )

    def test_expired_refresh_token_is_rejected(self):
        # An idle session: nothing refreshed the token inside its window.
        # Lifetimes are class attributes bound at import (tokens.py), so
        # override_settings cannot shorten them — backdate the token instead.
        token = RefreshToken.for_user(self.user)
        token.set_exp(
            from_time=aware_utcnow() - api_settings.REFRESH_TOKEN_LIFETIME
            - timedelta(minutes=1)
        )

        response = self.client.post(
            reverse("refresh"), {"refresh": str(token)}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get("code"), "token_not_valid")

    def test_refresh_within_the_window_still_works_near_expiry(self):
        # The «ادامه نشست» case: a token issued 30 minutes ago (the client's
        # timeout) must still be redeemable, or the continue button is a lie.
        token = RefreshToken.for_user(self.user)
        token.set_exp(from_time=aware_utcnow() - FRONTEND_IDLE_TIMEOUT)

        response = self.client.post(
            reverse("refresh"), {"refresh": str(token)}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("refresh", response.data)


class AuthenticatedEndpointTests(APITestCase):
    """An expired access token must not reach a protected endpoint."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="meuser", password="me-test-pw"
        )

    def test_current_user_requires_a_live_access_token(self):
        token = AccessToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(reverse("current-user"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], self.user.username)

    def test_expired_access_token_is_rejected(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(
            from_time=aware_utcnow() - api_settings.ACCESS_TOKEN_LIFETIME
            - timedelta(minutes=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(reverse("current-user"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Unified login/registration flow ──────────────────────────────────────────
# The endpoints under /api/user/auth/. `send_otp_sms` is patched throughout:
# these tests are about the state machine, not SMS.ir, and an unpatched call
# would try to reach the network.

PHONE = "09121110001"
STRONG_PASSWORD = "salyco-unified-pw-7719"


class ThrottleFreeMixin:
    """Reset the throttle counters between tests.

    ScopedRateThrottle keeps its per-IP history in the cache, which outlives a
    single test — without this, the suite starts 429ing partway through and the
    failures point at whatever test happened to be twelfth.
    """

    def setUp(self):
        super().setUp()
        cache.clear()
        self.addCleanup(cache.clear)


@patch("users.views.send_otp_sms", return_value=(True, "کد ارسال شد"))
class AuthStartTests(ThrottleFreeMixin, APITestCase):
    """Step 1 classifies the number without writing anything."""

    def start(self, phone=PHONE):
        return self.client.post(
            reverse("auth-start"), {"phone_number": phone}, format="json"
        )

    def test_unknown_phone_is_register_mode_and_creates_no_user(self, _sms):
        response = self.start()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mode"], "register")
        # The whole point of the new flow: no half-made account exists until a
        # password and a name have actually been supplied.
        self.assertFalse(User.objects.filter(username=PHONE).exists())
        self.assertTrue(PhoneOTP.objects.filter(phone_number=PHONE).exists())

    def test_active_phone_is_login_mode(self, _sms):
        User.objects.create_user(username=PHONE, password=STRONG_PASSWORD)

        response = self.start()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mode"], "login")
        otp = PhoneOTP.objects.filter(phone_number=PHONE).first()
        self.assertEqual(otp.purpose, PhoneOTP.PURPOSE_LOGIN)

    def test_abandoned_signup_is_register_mode(self, _sms):
        # Inactive with no login history: someone closed the tab at the OTP step.
        User.objects.create_user(
            username=PHONE, password=STRONG_PASSWORD, is_active=False
        )

        response = self.start()

        self.assertEqual(response.data["mode"], "register")

    def test_deactivated_account_is_refused(self, _sms):
        # Inactive *with* a login history is an account an admin switched off.
        # Letting a signup reuse the row would be a way to take it over.
        user = User.objects.create_user(
            username=PHONE, password=STRONG_PASSWORD, is_active=False
        )
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        response = self.start()

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_phone_is_normalised(self, _sms):
        response = self.start("+98 912 111 0001")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["phone_number"], PHONE)

    def test_resending_retires_the_previous_code(self, _sms):
        self.start()
        first = PhoneOTP.objects.filter(phone_number=PHONE).first()

        self.start()

        first.refresh_from_db()
        self.assertTrue(first.is_used, "issuing a new code must retire the old one")
        self.assertEqual(
            PhoneOTP.objects.filter(phone_number=PHONE, is_used=False).count(), 1
        )


@patch("users.views.send_otp_sms", return_value=(True, "کد ارسال شد"))
class AuthVerifyTests(ThrottleFreeMixin, APITestCase):
    """Step 2 branches on what the phone number turned out to be."""

    def start_and_get_code(self, phone=PHONE):
        self.client.post(reverse("auth-start"), {"phone_number": phone}, format="json")
        return PhoneOTP.objects.filter(phone_number=phone, is_used=False).first().code

    def verify(self, code, phone=PHONE):
        return self.client.post(
            reverse("auth-verify"),
            {"phone_number": phone, "code": code},
            format="json",
        )

    def test_new_phone_returns_a_registration_token_and_no_jwt(self, _sms):
        code = self.start_and_get_code()

        response = self.verify(code)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mode"], "register")
        self.assertIn("registration_token", response.data)
        # No account exists yet, so there is nothing to issue tokens for.
        self.assertNotIn("access", response.data)
        self.assertEqual(
            signing.loads(
                response.data["registration_token"], salt=REGISTRATION_TOKEN_SALT
            ),
            PHONE,
        )

    def test_existing_phone_returns_tokens(self, _sms):
        User.objects.create_user(username=PHONE, password=STRONG_PASSWORD)
        code = self.start_and_get_code()

        response = self.verify(code)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mode"], "login")
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertNotIn("registration_token", response.data)

    def test_wrong_code_is_rejected(self, _sms):
        code = self.start_and_get_code()
        wrong = "0000" if code != "0000" else "1111"

        response = self.verify(wrong)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_code_is_single_use(self, _sms):
        code = self.start_and_get_code()
        self.assertEqual(self.verify(code).status_code, status.HTTP_200_OK)

        # The duplicate-submit case the frontend's submittedRef latch guards
        # against — the server has to refuse it regardless.
        self.assertEqual(self.verify(code).status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_code_is_rejected(self, _sms):
        code = self.start_and_get_code()
        otp = PhoneOTP.objects.filter(phone_number=PHONE).first()
        otp.expires_at = timezone.now() - timedelta(seconds=1)
        otp.save(update_fields=["expires_at"])

        response = self.verify(code)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_without_a_code_on_record_is_rejected(self, _sms):
        response = self.verify("1234")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@patch("users.views.send_otp_sms", return_value=(True, "کد ارسال شد"))
class AuthCompleteTests(ThrottleFreeMixin, APITestCase):
    """Step 3 creates the account, and only accepts a token this server signed."""

    def registration_token(self, phone=PHONE):
        self.client.post(reverse("auth-start"), {"phone_number": phone}, format="json")
        code = PhoneOTP.objects.filter(phone_number=phone, is_used=False).first().code
        response = self.client.post(
            reverse("auth-verify"),
            {"phone_number": phone, "code": code},
            format="json",
        )
        return response.data["registration_token"]

    def complete(self, token, **overrides):
        payload = {
            "registration_token": token,
            "first_name": "امیر",
            "last_name": "رضایی",
            "password": STRONG_PASSWORD,
            "password2": STRONG_PASSWORD,
        }
        payload.update(overrides)
        return self.client.post(reverse("auth-complete"), payload, format="json")

    def test_creates_an_active_user_with_both_names(self, _sms):
        response = self.complete(self.registration_token())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)

        user = User.objects.get(username=PHONE)
        self.assertTrue(user.is_active, "the number is already verified by now")
        self.assertEqual(user.first_name, "امیر")
        self.assertEqual(user.last_name, "رضایی")
        self.assertTrue(user.check_password(STRONG_PASSWORD))

    def test_mirrors_the_names_onto_the_customer_profile(self, _sms):
        self.complete(self.registration_token())

        customer = Customer.objects.get(user__username=PHONE)
        self.assertEqual(customer.first_name, "امیر")
        self.assertEqual(customer.last_name, "رضایی")
        self.assertEqual(customer.phone_number, PHONE)

    def test_resulting_account_can_log_in_with_the_password(self, _sms):
        self.complete(self.registration_token())

        response = self.client.post(
            reverse("get_token"),
            {"username": PHONE, "password": STRONG_PASSWORD},
            format="json",
        )

        # This is the bug the old flow had: it posted the *typed name* as the
        # username, which no account was ever created under.
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_mismatched_passwords_are_rejected(self, _sms):
        response = self.complete(
            self.registration_token(), password2="something-else-entirely"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username=PHONE).exists())

    def test_weak_password_is_rejected(self, _sms):
        response = self.complete(
            self.registration_token(), password="1234", password2="1234"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_may_not_be_the_phone_number(self, _sms):
        response = self.complete(
            self.registration_token(), password=PHONE, password2=PHONE
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_forged_token_is_rejected(self, _sms):
        # Without this, anyone could create an account on any phone number by
        # calling this endpoint directly and skipping the OTP entirely.
        response = self.complete(signing.dumps(PHONE, salt="not-the-real-salt"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username=PHONE).exists())

    def test_tampered_token_is_rejected(self, _sms):
        token = self.registration_token()

        response = self.complete(token[:-1] + ("a" if token[-1] != "a" else "b"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stale_token_is_rejected(self, _sms):
        token = self.registration_token()

        # max_age is read from the module at call time, so shrinking it is
        # equivalent to letting the clock run past the window — and avoids
        # patching time.time(), which the signer and the ORM both rely on.
        with patch("users.serializer.REGISTRATION_TOKEN_MAX_AGE", -1):
            response = self.complete(token)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username=PHONE).exists())

    def test_abandoned_signup_row_is_reused_not_duplicated(self, _sms):
        User.objects.create_user(
            username=PHONE, password="old-abandoned-pw-991", is_active=False
        )

        response = self.complete(self.registration_token())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(username=PHONE).count(), 1)
        user = User.objects.get(username=PHONE)
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password(STRONG_PASSWORD))

    def test_token_cannot_be_redeemed_twice(self, _sms):
        token = self.registration_token()
        self.assertEqual(self.complete(token).status_code, status.HTTP_201_CREATED)

        # The account now exists and is active, so the second attempt is a
        # "already registered" conflict rather than a second account.
        response = self.complete(token)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.filter(username=PHONE).count(), 1)
