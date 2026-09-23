import json

from django.template import Context, Template
from django.test import TestCase
from wagtail.models import Page, Site

from articles.models import ArticleIndexPage, ArticlePage
from articles.seo import (
    breadcrumb_json_ld,
    canonical_url,
    meta_title,
    robots_directive,
)


def make_index():
    root = Page.objects.get(depth=1)
    # Repoint the default site at the Wagtail Root before measuring any URL:
    # Wagtail's initial data roots it at its own "Welcome" page, so a page under
    # the real root is under no site's root path and get_url() returns None.
    site = Site.objects.get(is_default_site=True)
    site.root_page = root
    site.save()

    index = ArticleIndexPage(title="مقالات", slug="articles")
    root.add_child(instance=index)
    return index


def make_article(index, **kwargs):
    defaults = {"title": "راهنمای تشک", "slug": "a", "excerpt": "خلاصه", "body": []}
    defaults.update(kwargs)
    article = ArticlePage(**defaults)
    index.add_child(instance=article)
    return article


class TitleTests(TestCase):
    def test_the_suffix_is_appended_once(self):
        index = make_index()
        article = make_article(index)
        self.assertEqual(meta_title(article), "راهنمای تشک | سالیکو")

    def test_the_suffix_is_not_doubled(self):
        index = make_index()
        article = make_article(index, seo_title="راهنمای تشک | سالیکو")
        self.assertEqual(meta_title(article), "راهنمای تشک | سالیکو")

    def test_seo_title_wins_over_the_page_title(self):
        index = make_index()
        article = make_article(index, seo_title="عنوان سئو")
        self.assertEqual(meta_title(article), "عنوان سئو | سالیکو")


class CanonicalTests(TestCase):
    def test_the_canonical_uses_the_site_url_not_the_request(self):
        index = make_index()
        article = make_article(index)
        self.assertEqual(canonical_url(article), "https://salyco.ir/articles/a/")

    def test_the_override_wins(self):
        index = make_index()
        article = make_article(index, canonical_url_override="https://example.com/x")
        self.assertEqual(canonical_url(article), "https://example.com/x")

    def test_no_canonical_can_contain_a_local_host(self):
        # The whole reason SITE_URL exists rather than request.build_absolute_uri.
        index = make_index()
        article = make_article(index)
        for forbidden in ("localhost", "127.0.0.1", "backend:8000"):
            self.assertNotIn(forbidden, canonical_url(article))


class RobotsTests(TestCase):
    def test_a_live_indexable_article_is_index_follow(self):
        index = make_index()
        article = make_article(index)
        article.save_revision().publish()
        self.assertEqual(robots_directive(article), "index,follow")

    def test_allow_indexing_false_is_noindex(self):
        index = make_index()
        article = make_article(index, allow_indexing=False)
        article.save_revision().publish()
        self.assertEqual(robots_directive(article), "noindex,follow")

    def test_a_draft_is_noindex_nofollow(self):
        index = make_index()
        article = make_article(index, live=False)
        article.save_revision()
        self.assertEqual(robots_directive(article), "noindex,nofollow")


class JsonLdScriptTests(TestCase):
    def render(self, data):
        template = Template("{% load article_tags %}{% json_ld_script data %}")
        return template.render(Context({"data": data}))

    def test_a_script_tag_is_produced(self):
        html = self.render({"@type": "Article"})
        self.assertIn('<script type="application/ld+json">', html)
        self.assertIn('"@type":"Article"', html)

    def test_a_closing_script_tag_in_a_title_cannot_escape(self):
        html = self.render({"headline": "</script><img src=x onerror=alert(1)>"})
        self.assertEqual(html.count("</script>"), 1)
        self.assertNotIn("<img", html)
        self.assertIn("\\u003c/script\\u003e", html)

    def test_persian_is_not_escaped_into_ascii(self):
        # ensure_ascii=False keeps the payload readable for a human debugging a
        # rich-result problem in view-source.
        self.assertIn("سالیکو", self.render({"headline": "سالیکو"}))


class StructuredDataTests(TestCase):
    def test_the_breadcrumb_walks_the_real_tree(self):
        index = make_index()
        article = make_article(index)
        data = breadcrumb_json_ld(article)
        names = [item["name"] for item in data["itemListElement"]]
        self.assertEqual(names, ["مقالات", "راهنمای تشک"])

    def test_the_breadcrumb_entries_are_absolute(self):
        index = make_index()
        article = make_article(index)
        data = breadcrumb_json_ld(article)
        for item in data["itemListElement"]:
            self.assertTrue(item["item"].startswith("https://salyco.ir/"))

    def test_the_breadcrumb_is_valid_json_when_serialised(self):
        index = make_index()
        article = make_article(index)
        template = Template("{% load article_tags %}{% json_ld_script data %}")
        html = template.render(Context({"data": breadcrumb_json_ld(article)}))
        payload = html.split(">", 1)[1].rsplit("<", 1)[0]
        json.loads(payload)
