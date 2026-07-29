from datetime import timedelta

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.utils import aware_utcnow


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
