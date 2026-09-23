"""The crawler surface: /sitemap.xml and /robots.txt.

Both paths used to fall through to the SPA shell, so a crawler asking for a
sitemap was handed a React application with HTTP 200. These assertions are about
what a crawler can *reach*, which is why they parse the XML rather than
substring-matching it.
"""
from xml.etree import ElementTree

from django.test import TestCase
from wagtail.models import Page, Site

from articles.models import ArticleIndexPage, ArticlePage
from articles.snippets import ArticleCategory
from mattress.models import Mattress

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


class SitemapTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        # Without this the pages sit under no site's root, get_url() returns
        # None and every article entry in the sitemap reads "https://salyco.irNone".
        site = Site.objects.get(is_default_site=True)
        site.root_page = root
        site.save()

        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)

        cls.live = ArticlePage(title="منتشرشده", slug="live", excerpt="x", body=[])
        cls.index.add_child(instance=cls.live)
        cls.live.save_revision().publish()

        # No live=False needed here only because this one is never published;
        # add_child alone would otherwise leave it live.
        cls.draft = ArticlePage(title="پیش‌نویس", slug="draft", excerpt="x", body=[], live=False)
        cls.index.add_child(instance=cls.draft)

        cls.hidden = ArticlePage(
            title="پنهان", slug="hidden", excerpt="x", body=[], allow_indexing=False
        )
        cls.index.add_child(instance=cls.hidden)
        cls.hidden.save_revision().publish()

        cls.guide = ArticleCategory.objects.create(name="راهنما", slug="rahnama")
        cls.inactive = ArticleCategory.objects.create(
            name="غیرفعال", slug="off", is_active=False
        )
        Mattress.objects.create(
            category="mattress",
            name="تشک تست",
            slug="test",
            description="برای آزمون.",
            warranty_months=12,
            price=1000,
        )

    def urls(self):
        response = self.client.get("/sitemap.xml")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml")
        tree = ElementTree.fromstring(response.content)
        return [loc.text for loc in tree.findall(".//sm:loc", NS)]

    def test_published_articles_are_listed(self):
        self.assertIn("https://salyco.ir/articles/live/", self.urls())

    def test_drafts_are_not_listed(self):
        self.assertNotIn("https://salyco.ir/articles/draft/", self.urls())

    def test_noindex_articles_are_not_listed(self):
        # allow_indexing=False is an editor saying "do not put this in front of a
        # crawler". A sitemap entry would overrule them.
        self.assertNotIn("https://salyco.ir/articles/hidden/", self.urls())

    def test_active_categories_are_listed_and_inactive_ones_are_not(self):
        urls = self.urls()
        self.assertIn("https://salyco.ir/articles/category/rahnama/", urls)
        self.assertNotIn("https://salyco.ir/articles/category/off/", urls)

    def test_tag_archives_are_not_listed(self):
        # They are noindex,follow; listing one would contradict its own robots
        # directive in the same document set.
        self.assertFalse([url for url in self.urls() if "/tag/" in url])

    def test_products_are_listed(self):
        self.assertIn("https://salyco.ir/products/mattress/test", self.urls())

    def test_the_index_and_static_routes_are_listed(self):
        urls = self.urls()
        for path in ("/articles/", "/", "/products", "/about", "/contact", "/dealers"):
            self.assertIn(f"https://salyco.ir{path}", urls)

    def test_a_published_article_carries_a_lastmod(self):
        response = self.client.get("/sitemap.xml")
        tree = ElementTree.fromstring(response.content)
        entry = [
            node
            for node in tree.findall("sm:url", NS)
            if node.findtext("sm:loc", None, NS) == "https://salyco.ir/articles/live/"
        ][0]
        lastmod = entry.findtext("sm:lastmod", None, NS)
        self.assertIsNotNone(lastmod)
        # A date, not a datetime: the schema wants W3C but a bare date is valid
        # and does not invite a crawler to re-fetch on every publish second.
        self.assertRegex(lastmod, r"^\d{4}-\d{2}-\d{2}$")

    def test_products_carry_no_lastmod(self):
        # Mattress has no created_at or updated_at, and stamping now() would
        # claim the whole catalogue changed on every fetch — devaluing the signal
        # for the pages that do carry a real date.
        response = self.client.get("/sitemap.xml")
        tree = ElementTree.fromstring(response.content)
        entry = [
            node
            for node in tree.findall("sm:url", NS)
            if node.findtext("sm:loc", None, NS) == "https://salyco.ir/products/mattress/test"
        ][0]
        self.assertIsNone(entry.findtext("sm:lastmod", None, NS))

    def test_no_url_can_contain_a_local_host(self):
        # The reason every URL is built from SITE_URL rather than the request.
        body = self.client.get("/sitemap.xml").content.decode()
        for forbidden in ("localhost", "127.0.0.1", "backend:8000"):
            self.assertNotIn(forbidden, body)


class RobotsTests(TestCase):
    def test_it_is_served_as_plain_text(self):
        response = self.client.get("/robots.txt")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain")

    def test_it_disallows_the_cms_and_points_at_the_sitemap(self):
        body = self.client.get("/robots.txt").content.decode()
        self.assertIn("Disallow: /cms/", body)
        self.assertIn("Disallow: /admin/", body)
        self.assertIn("Sitemap: https://salyco.ir/sitemap.xml", body)
