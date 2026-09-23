from unittest import skip
from urllib.parse import urlparse

from django.conf import settings
from django.test import TestCase
from wagtail.models import Page, Site

from articles.models import ArticleIndexPage, ArticlePage


def root():
    return Page.objects.get(depth=1)


def make_index():
    """The index under the real Wagtail root, the way the site is arranged.

    Built here rather than through setup_salyco_cms so each test controls its own
    tree and a bug in the management command cannot make the model tests pass.
    """
    index = ArticleIndexPage(title="مقالات", slug="articles")
    root().add_child(instance=index)
    return index


def make_article(index, **kwargs):
    defaults = {
        "title": "راهنمای انتخاب تشک",
        "slug": "rahnama",
        "excerpt": "چگونه تشک مناسب را انتخاب کنیم.",
        "body": [],
    }
    defaults.update(kwargs)
    article = ArticlePage(**defaults)
    index.add_child(instance=article)
    return article


def site_on_root():
    """Point the default site at the Wagtail Root, which is what Task 14 does.

    Wagtail's own initial data creates a default site whose root_page is its
    "Welcome" page, so until this runs a page under the real root has no URL at
    all — get_url() returns None rather than a path, because the page is not
    under any site's root. /articles/ being routable is the arrangement the whole
    design rests on, so the URL tests build it here.
    """
    site = Site.objects.get(is_default_site=True)
    site.root_page = root()
    site.save()
    return site


class PageTreeTests(TestCase):
    def test_an_article_cannot_live_outside_the_index(self):
        # can_exist_under rather than add_child: Wagtail does not validate page
        # types on save. add_child comes from treebeard and writes the row, so
        # the constraint lives in this predicate — which is what the admin, the
        # page mover and the "add child page" menu all consult.
        self.assertFalse(ArticlePage.can_exist_under(root()))

    def test_the_index_refuses_a_non_article_child(self):
        index = make_index()
        self.assertFalse(Page.can_exist_under(index))

    def test_only_one_index_can_exist(self):
        make_index()
        self.assertFalse(ArticleIndexPage.can_create_at(root()))

    def test_the_index_parent_type_is_the_wagtail_root(self):
        self.assertEqual(ArticleIndexPage.parent_page_types, ["wagtailcore.Page"])

    def test_an_article_has_a_subpage_of_nothing(self):
        # An empty list, not None: Wagtail treats a missing subpage_types as
        # "any page type", so [] is the only way to say "this is a leaf".
        self.assertEqual(ArticlePage.subpage_types, [])
        self.assertEqual(ArticlePage.clean_subpage_models(), [])


class ArticleUrlTests(TestCase):
    def test_the_index_url_is_prefixed_with_its_slug(self):
        # This is the whole reason Site.root_page stays the Wagtail Root: if the
        # index were the site root its own URL would be "/" and every article
        # would sit at "/<slug>/", and every canonical tag would be wrong.
        site_on_root()
        index = make_index()
        self.assertEqual(index.get_url(), "/articles/")

    def test_an_article_url_sits_under_the_index(self):
        site_on_root()
        index = make_index()
        article = make_article(index)
        self.assertEqual(article.get_url(), "/articles/rahnama/")

    @skip("site hostname set by setup_salyco_cms in Task 14")
    def test_the_default_site_uses_the_canonical_hostname(self):
        site = Site.objects.get(is_default_site=True)
        self.assertEqual(site.hostname, urlparse(settings.SITE_URL).hostname)
