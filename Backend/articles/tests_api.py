"""The public article API, now served from the Wagtail pages.

Nothing here asserted the API's *shape* before, which is the shape React reads:
the response is a bare array of objects with fixed key names, and
FeaturedArticles.jsx / Articles.jsx call .slice() on it. These tests pin the
contract rather than the values, because a pagination wrapper or a renamed key
breaks the homepage without raising anything.
"""
from django.test import TestCase
from wagtail.models import Page

from articles.models import ArticleIndexPage, ArticlePage


class ArticleApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)

        cls.article = ArticlePage(
            title="راهنمای تشک",
            slug="rahnama",
            excerpt="خلاصه مقاله",
            body=[("paragraph", "<p>متن کامل مقاله</p>")],
        )
        cls.index.add_child(instance=cls.article)
        cls.article.save_revision().publish()

        # live=False is load-bearing. Page.live defaults to True and add_child is
        # treebeard's, so it validates nothing — a fixture that merely omits
        # save_revision().publish() still creates a *published* page, and this
        # draft would appear in the list it is meant to prove is filtered.
        cls.draft = ArticlePage(
            title="پیش‌نویس", slug="draft", excerpt="x", body=[("paragraph", "<p>پنهان</p>")],
            live=False,
        )
        cls.index.add_child(instance=cls.draft)

    def test_the_list_is_a_bare_array(self):
        # The React components call .slice(0, 4) on the response, so a pagination
        # wrapper here would break the homepage silently.
        response = self.client.get("/api/articles/")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_the_list_keeps_its_field_names(self):
        entry = self.client.get("/api/articles/").json()[0]
        self.assertEqual(
            sorted(entry), ["created_at", "excerpt", "image", "slug", "title"]
        )

    def test_the_detail_keeps_its_field_names(self):
        entry = self.client.get("/api/articles/rahnama/").json()
        self.assertEqual(
            sorted(entry),
            ["content", "created_at", "excerpt", "image", "slug", "title", "updated_at"],
        )

    def test_the_detail_content_is_plain_text(self):
        # The old column was a TextField rendered inside whitespace-pre-wrap, so
        # consumers get text, not HTML. Sending markup here would show literal
        # tags to anyone still reading the field.
        content = self.client.get("/api/articles/rahnama/").json()["content"]
        self.assertEqual(content, "متن کامل مقاله")
        self.assertNotIn("<p>", content)

    def test_drafts_are_not_listed(self):
        slugs = [entry["slug"] for entry in self.client.get("/api/articles/").json()]
        self.assertNotIn("draft", slugs)

    def test_a_draft_detail_is_404(self):
        self.assertEqual(self.client.get("/api/articles/draft/").status_code, 404)

    def test_the_slug_is_the_persian_one(self):
        self.assertEqual(
            self.client.get("/api/articles/rahnama/").json()["slug"], "rahnama"
        )

    def test_the_query_count_does_not_grow_with_the_number_of_articles(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        # The invariant is flatness, not a magic number. An N+1 list is one query
        # per row, so comparing a small list against a large one catches it
        # without pinning a count that a Wagtail upgrade could legitimately
        # change — which would make this test cry wolf and then get deleted.
        with CaptureQueriesContext(connection) as small:
            self.client.get("/api/articles/")

        for i in range(6):
            extra = ArticlePage(
                title=f"مقاله {i}", slug=f"a-{i}", excerpt="x", body=[]
            )
            self.index.add_child(instance=extra)
            extra.save_revision().publish()

        with CaptureQueriesContext(connection) as large:
            self.client.get("/api/articles/")

        self.assertEqual(len(small), len(large))
