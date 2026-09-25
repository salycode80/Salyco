from io import StringIO
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase

from mattress.models import Mattress
from mattress.brand_content import MODELS
from mattress.management.commands.sync_brand_content import ALIASES

# The slugs the live catalogue serves, read off GET /api/mattresses/. Spelled out
# here on purpose: if production renames a model, this should fail loudly rather
# than let the command skip it and leave stale copy on the site.
LIVE_SLUGS = {
    "imperial": "tsh-slo-mdl-shmrh-1",
    "prestige": "mdl-rst",
    "hermes": "mdl-hrms-hermes",
}


class BrandContentCommandTests(TestCase):
    def setUp(self):
        self.product = Mattress.objects.create(
            name="امپریال", slug="تشک-امپریال", category="mattress",
            price=Decimal("123456"), warranty_months=120, height=24,
            description="old copy", is_available=False, is_on_off=True,
            off_percentage=10,
        )
        self.product.faqs.create(question="old claim", answer="old answer")

    def test_default_is_read_only_preview(self):
        call_command("sync_brand_content", stdout=StringIO())
        self.product.refresh_from_db()
        self.assertEqual(self.product.height, 24)
        self.assertEqual(self.product.description, "old copy")
        self.assertEqual(self.product.faqs.get().question, "old claim")

    def test_apply_preserves_commercial_data_and_converges(self):
        for _ in range(2):
            call_command("sync_brand_content", apply=True, stdout=StringIO())
        self.product.refresh_from_db()
        self.assertEqual(self.product.height, 31)
        self.assertEqual(self.product.price, Decimal("123456"))
        self.assertFalse(self.product.is_available)
        self.assertTrue(self.product.is_on_off)
        self.assertEqual(self.product.off_percentage, 10)
        self.assertEqual(self.product.features.count(), 4)
        self.assertEqual(self.product.specifications.count(), 6)
        self.assertEqual(self.product.faqs.count(), 2)
        self.assertIn("۱۴۰", self.product.specifications.get(key="تحمل وزن تقریبی برای هر نفر").value)
        self.assertEqual(Mattress.objects.count(), 1)

    def test_model_selection_does_not_change_other_products(self):
        call_command("sync_brand_content", model=["hermes"], apply=True, stdout=StringIO())
        self.product.refresh_from_db()
        self.assertEqual(self.product.height, 24)


class LiveSlugCoverageTests(TestCase):
    """Every model must resolve against the slug the live catalogue actually serves.

    The fixture above uses the legacy "تشک-امپریال" slug, so it keeps passing even
    when an alias stops matching production. This class seeds the real slugs and
    asserts nothing is skipped, which is what the earlier `hermes` alias failed to do.
    """

    def setUp(self):
        for key, slug in LIVE_SLUGS.items():
            Mattress.objects.create(
                name=key, slug=slug, category=Mattress.CATEGORY_MATTRESS,
                price=Decimal("1000000"), height=1, warranty_months=1,
                description="stale",
            )

    def test_aliases_resolve_every_model(self):
        for key, slug in LIVE_SLUGS.items():
            self.assertIn(slug, ALIASES[key], f"{key} alias no longer covers {slug}")

    def test_apply_reaches_every_live_slug(self):
        out = StringIO()
        call_command("sync_brand_content", apply=True, stdout=out)
        self.assertNotIn("SKIP", out.getvalue())
        for key, slug in LIVE_SLUGS.items():
            product = Mattress.objects.get(slug=slug)
            self.assertEqual(product.height, MODELS[key]["height"], key)
            self.assertEqual(product.specifications.count(), 6, key)
            self.assertIn("میکرو بونل", product.material, key)
