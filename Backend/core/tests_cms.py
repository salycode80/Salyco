"""The CMS surface exists and is not public.

These are deliberately shallow. They answer "did the install and the settings
land" — the questions that are otherwise discovered by opening a browser — so a
broken settings edit fails here instead of in production.
"""
from django.conf import settings
from django.test import TestCase


class CmsSettingsTests(TestCase):
    def test_wagtail_is_installed(self):
        self.assertIn("wagtail.admin", settings.INSTALLED_APPS)
        self.assertIn("wagtail.contrib.settings", settings.INSTALLED_APPS)
        self.assertIn("django.contrib.sites", settings.INSTALLED_APPS)

    def test_site_url_has_no_trailing_slash(self):
        # Every caller concatenates a path onto this value, so a trailing slash
        # would produce "https://salyco.ir//articles/".
        self.assertTrue(settings.SITE_URL.startswith("https://"))
        self.assertFalse(settings.SITE_URL.endswith("/"))

    def test_redirect_middleware_is_installed(self):
        # Without it the legacy-slug 301s in Task 15 never fire.
        self.assertIn(
            "wagtail.contrib.redirects.middleware.RedirectMiddleware",
            settings.MIDDLEWARE,
        )

    def test_cms_requires_a_login(self):
        response = self.client.get("/cms/")
        self.assertIn(response.status_code, (301, 302))
        self.assertIn("/cms/login/", response["Location"])

    def test_existing_django_admin_still_answers(self):
        response = self.client.get("/admin/")
        self.assertIn(response.status_code, (301, 302))
        self.assertIn("/admin/login/", response["Location"])
