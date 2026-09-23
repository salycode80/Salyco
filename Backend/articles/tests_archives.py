"""The listings: the index, the category archive and the tag archive.

These are the pages a crawler reaches first and the ones most likely to
silently duplicate each other, so the assertions cover both what is listed and
what the robots directive says about listing it.
"""
from datetime import UTC, datetime, timedelta

from django.test import TestCase
from wagtail.models import Page, Site

from articles.models import ARTICLES_PER_PAGE, ArticleIndexPage, ArticlePage
from articles.snippets import ArticleCategory
from articles.testing_support import plain_staticfiles

# The card links to the article, so this counts cards without depending on the
# surrounding markup. Titles alone would not do: "مقاله 1" is a substring of
# "مقاله 14".
CARD = 'href="/articles/a-'


def cards(html):
    return html.count(CARD)


@plain_staticfiles
class ArchiveTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        root = Page.objects.get(depth=1)
        # Same repoint as tests_rendering: Wagtail's initial data roots the
        # default site at its own "Welcome" page, so nothing under the real root
        # would have a URL.
        site = Site.objects.get(is_default_site=True)
        site.root_page = root
        site.save()

        cls.index = ArticleIndexPage(title="مقالات", slug="articles")
        root.add_child(instance=cls.index)

        cls.guide = ArticleCategory.objects.create(name="راهنما", slug="rahnama")
        cls.other = ArticleCategory.objects.create(name="خواب", slug="khab")

        # Explicit, increasing timestamps. The listing orders by
        # -first_published_at and publish() stamps "now", so fifteen pages
        # published in a loop can share a timestamp and fall back to the -id
        # tiebreak — which would make "newest first" true by accident rather
        # than by construction.
        base = datetime(2026, 1, 1, tzinfo=UTC)
        cls.articles = []
        for i in range(ARTICLES_PER_PAGE + 3):
            article = ArticlePage(
                title=f"مقاله {i}",
                slug=f"a-{i}",
                excerpt="خلاصه",
                category=cls.guide if i % 2 == 0 else cls.other,
                body=[],
            )
            cls.index.add_child(instance=article)
            article.save_revision().publish()
            ArticlePage.objects.filter(pk=article.pk).update(
                first_published_at=base + timedelta(days=i)
            )
            cls.articles.append(article)

    def tag(self, article, name):
        """Attach a tag and commit it.

        The save() is the whole helper. ArticlePageTag.content_object is a
        ParentalKey, so modelcluster hands back a DeferringRelatedManager whose
        add() deliberately does not write to the database (see
        modelcluster/contrib/taggit.py) — it stages the tag in memory and the
        rows land on the next page save. Without it this test would build an
        archive over an empty through table and prove nothing.
        """
        article.tags.add(name)
        article.save()

    def test_the_index_lists_articles(self):
        response = self.client.get("/articles/")
        self.assertEqual(response.status_code, 200)
        # 14 is the newest, so it is on the first page.
        self.assertIn(">مقاله 14</h3>", response.content.decode())

    def test_the_index_paginates(self):
        # 15 articles at 12 per page: 12 and 3, whichever way they are ordered.
        first = self.client.get("/articles/").content.decode()
        second = self.client.get("/articles/?page=2").content.decode()
        self.assertEqual(cards(first), ARTICLES_PER_PAGE)
        self.assertEqual(cards(second), 3)

    def test_the_second_page_holds_the_oldest_articles(self):
        first = self.client.get("/articles/").content.decode()
        second = self.client.get("/articles/?page=2").content.decode()
        self.assertIn(">مقاله 0</h3>", second)
        self.assertNotIn(">مقاله 0</h3>", first)

    def test_the_pagination_links_carry_rel_prev_and_next(self):
        # What tells a crawler the pages are one sequence rather than duplicates.
        # 15 articles at 12 per page is exactly two pages, so page 1 is the one
        # with a next and page 2 the one with a prev.
        first = self.client.get("/articles/").content.decode()
        second = self.client.get("/articles/?page=2").content.decode()
        self.assertIn('rel="next"', first)
        self.assertIn('href="/articles/?page=2"', first)
        self.assertNotIn('rel="prev"', first)
        self.assertIn('rel="prev"', second)
        self.assertIn('href="/articles/?page=1"', second)
        # The last page must not advertise a page 3: a rel="next" pointing at a
        # 404 is how a crawler learns to distrust the whole sequence.
        self.assertNotIn('rel="next"', second)

    def test_the_category_archive_filters(self):
        response = self.client.get("/articles/category/rahnama/")
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        # The even-numbered articles are the guide's: 0,2,...,14.
        self.assertEqual(cards(body), 8)
        self.assertIn(">مقاله 0</h3>", body)
        self.assertNotIn(">مقاله 1</h3>", body)

    def test_the_category_archive_is_indexable(self):
        response = self.client.get("/articles/category/rahnama/")
        self.assertIn("index,follow", response.content.decode())

    def test_the_category_archive_canonical_is_the_archive_path(self):
        # Not the index's URL: two archives sharing a canonical would tell a
        # crawler that one of them does not exist.
        response = self.client.get("/articles/category/rahnama/")
        self.assertIn(
            '<link rel="canonical" href="https://salyco.ir/articles/category/rahnama/">',
            response.content.decode(),
        )

    def test_the_category_archive_title_names_the_category(self):
        response = self.client.get("/articles/category/rahnama/")
        self.assertIn("<h1", response.content.decode())
        self.assertIn("راهنما", response.content.decode())

    def test_an_inactive_category_is_404(self):
        self.guide.is_active = False
        self.guide.save()
        self.assertEqual(self.client.get("/articles/category/rahnama/").status_code, 404)

    def test_an_unknown_category_is_404(self):
        self.assertEqual(self.client.get("/articles/category/nope/").status_code, 404)

    def test_the_tag_archive_lists_the_tagged_article(self):
        self.tag(self.articles[0], "تشک")
        response = self.client.get("/articles/tag/تشک/")
        self.assertEqual(response.status_code, 200)
        # Without this the test passes on an empty listing, which is exactly the
        # failure it is meant to catch — taggit slugs Persian with
        # allow_unicode, so the route has to match a non-ASCII slug.
        self.assertEqual(cards(response.content.decode()), 1)

    def test_the_tag_archive_is_noindex(self):
        self.tag(self.articles[0], "تشک")
        response = self.client.get("/articles/tag/تشک/")
        self.assertIn("noindex,follow", response.content.decode())

    def test_an_unknown_tag_is_404(self):
        # Not a 200 with an empty listing: taggit's Tag table is global and any
        # typo in a URL would otherwise be an infinite space of thin pages.
        self.assertEqual(self.client.get("/articles/tag/nope/").status_code, 404)

    def test_a_draft_never_appears_in_a_listing(self):
        # live=False: Page.live defaults to True, so without it this creates a
        # published page and asserts nothing.
        draft = ArticlePage(
            title="منتشرنشده", slug="hidden", excerpt="x", body=[], live=False
        )
        self.index.add_child(instance=draft)
        body = self.client.get("/articles/").content.decode()
        self.assertNotIn("منتشرنشده", body)
        self.assertNotIn("hidden", body)

    def test_an_article_with_no_category_appears_in_the_index_only(self):
        orphan = ArticlePage(
            title="بی‌دسته", slug="orphan", excerpt="x", body=[]
        )
        self.index.add_child(instance=orphan)
        orphan.save_revision().publish()
        self.assertIn(">بی‌دسته</h3>", self.client.get("/articles/").content.decode())
        self.assertNotIn(
            ">بی‌دسته</h3>",
            self.client.get("/articles/category/rahnama/").content.decode(),
        )
