"""What a reader — and a crawler — receives from /articles/<slug>/.

Every assertion here reads `response.content`, the bytes Django sent, rather
than a parsed DOM. That is deliberate: the requirement this work exists to
satisfy is that the article is present *before any JavaScript runs*, and only
the raw response can prove it.
"""
import json
from datetime import UTC, datetime

from django.test import TestCase
from wagtail.models import Page, Site

from articles.models import ArticleIndexPage, ArticlePage
from articles.testing_support import plain_staticfiles

ARTICLE_BODY = [
    ("heading", {"text": "چگونه انتخاب کنیم", "level": "h2", "anchor_id": ""}),
    ("paragraph", "<p>اولین نکته این است که <strong>سختی</strong> تشک مهم است.</p>"),
    ("faq", {"items": [{"question": "کدام تشک؟", "answer": "بستگی دارد."}]}),
]


@plain_staticfiles
class ArticleRenderingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        # Repoint the default site at the Wagtail Root before anything is built.
        # Wagtail's own initial data roots it at its "Welcome" page, so without
        # this the article sits under no site's root path: get_url() returns None
        # (emptying the canonical tag) and the request 404s. Task 14 does the same
        # thing for real via setup_salyco_cms.
        site = Site.objects.get(is_default_site=True)
        site.root_page = root
        site.save()

        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)
        cls.article = ArticlePage(
            title="راهنمای انتخاب تشک",
            slug="rahnama",
            excerpt="چگونه تشک مناسب را انتخاب کنیم.",
            body=ARTICLE_BODY,
        )
        cls.index.add_child(instance=cls.article)
        cls.article.save_revision().publish()

    def get(self):
        return self.client.get("/articles/rahnama/")

    def test_the_page_is_served_by_django(self):
        self.assertEqual(self.get().status_code, 200)

    def test_the_body_text_is_in_the_raw_response(self):
        # The whole point of the change: this must hold with no JavaScript run.
        html = self.get().content.decode()
        self.assertIn("اولین نکته این است که", html)
        self.assertIn("بستگی دارد.", html)

    def test_the_document_is_persian_and_rtl(self):
        html = self.get().content.decode()
        self.assertIn('<html lang="fa" dir="rtl">', html)

    def test_there_is_exactly_one_h1(self):
        html = self.get().content.decode()
        self.assertEqual(html.count("<h1"), 1)
        self.assertIn("راهنمای انتخاب تشک", html)

    def test_the_head_carries_the_metadata(self):
        html = self.get().content.decode()
        self.assertIn("<title>راهنمای انتخاب تشک | سالیکو</title>", html)
        self.assertIn(
            '<link rel="canonical" href="https://salyco.ir/articles/rahnama/">', html
        )
        self.assertIn('<meta name="robots" content="index,follow">', html)
        self.assertIn('<meta property="og:type" content="article">', html)

    def test_exactly_one_canonical_is_emitted(self):
        self.assertEqual(self.get().content.decode().count('rel="canonical"'), 1)

    def test_the_json_ld_parses(self):
        html = self.get().content.decode()
        self.assertEqual(html.count("application/ld+json"), 3)  # Article, breadcrumb, FAQ
        for chunk in html.split('application/ld+json">')[1:]:
            json.loads(chunk.split("</script>")[0])

    def test_a_draft_is_not_public(self):
        # live=False is the whole test. Page.live defaults to True, and add_child
        # validates nothing, so without it this builds a *published* page and the
        # assertion below would be measuring a 200.
        draft = ArticlePage(
            title="پیش‌نویس", slug="draft", excerpt="x", body=[], live=False
        )
        self.index.add_child(instance=draft)
        self.assertEqual(self.client.get("/articles/draft/").status_code, 404)

    def test_the_faq_renders_as_details(self):
        html = self.get().content.decode()
        self.assertIn("<details", html)
        self.assertIn("<summary", html)

    def test_the_body_carries_no_tailwind_utility_classes(self):
        # The article CSS is plain semantic CSS, because Django templates cannot
        # compile Tailwind's @theme. A stray bg-brand-navy here would silently do
        # nothing.
        html = self.get().content.decode()
        self.assertNotIn("bg-brand-navy", html)

    def test_no_template_comment_leaks_into_the_response(self):
        # Django's tag_re has no re.DOTALL (template/base.py), so a {# ... #}
        # spanning a newline is not a comment — it is emitted verbatim, and a
        # reader sees the note the developer wrote to themselves. {# #} is safe
        # only on one line; anything longer needs {% comment %}.
        html = self.get().content.decode()
        self.assertNotIn("{#", html)
        self.assertNotIn("{%", html)

    def test_the_reading_time_uses_persian_digits(self):
        # "1 دقیقه مطالعه" beside "۱۰ سال ضمانت" reads as a rendering fault.
        html = self.get().content.decode()
        self.assertIn("۱ دقیقه مطالعه", html)

    def test_the_date_is_jalali_like_the_rest_of_the_site(self):
        # `date:"j F Y"` under LANGUAGE_CODE 'fa' renders "23 سپتامبر 2026": the
        # Persian word for September on a Gregorian date. Every other date the
        # site shows goes through the SPA's formatJalaliLong, so this one must
        # too, or a reader comparing an article to a product sees two calendars.
        article = ArticlePage.objects.get(pk=self.article.pk)
        article.first_published_at = datetime(2026, 9, 23, tzinfo=UTC)
        article.save(update_fields=["first_published_at"])
        html = self.client.get("/articles/rahnama/").content.decode()
        self.assertIn("۱ مهر ۱۴۰۵", html)
        # The machine-readable attribute stays ISO.
        self.assertIn('datetime="2026-09-23T00:00:00+00:00"', html)
