from django.conf import settings
from django.core.management import call_command
from django.test import TestCase
from wagtail.models import Collection, Page, Site

from articles.models import ArticleIndexPage
from articles.snippets import GlobalSeoSettings


class SetupCommandTests(TestCase):
    def test_it_creates_the_articles_index_under_the_root(self):
        call_command("setup_salyco_cms")
        index = ArticleIndexPage.objects.get()
        self.assertEqual(index.slug, "articles")
        self.assertEqual(index.get_parent().depth, 1)
        self.assertEqual(index.get_url(), "/articles/")

    def test_it_points_the_default_site_at_the_wagtail_root(self):
        call_command("setup_salyco_cms")
        site = Site.objects.get(is_default_site=True)
        self.assertEqual(site.hostname, "salyco.ir")
        self.assertTrue(site.root_page.is_root())

    def test_it_matches_the_sites_framework_row_to_the_site_url(self):
        from django.contrib.sites.models import Site as DjangoSite

        call_command("setup_salyco_cms")
        row = DjangoSite.objects.get(pk=settings.SITE_ID)
        self.assertEqual(row.domain, "salyco.ir")

    def test_it_creates_the_collections(self):
        call_command("setup_salyco_cms")
        names = set(Collection.objects.values_list("name", flat=True))
        self.assertLessEqual({"مقالات", "محصولات", "عمومی"}, names)

    def test_it_creates_the_seo_settings_with_the_instagram_handle(self):
        call_command("setup_salyco_cms")
        site = Site.objects.get(is_default_site=True)
        seo = GlobalSeoSettings.for_site(site)
        self.assertEqual(seo.brand_name_fa, "سالیکو")
        self.assertEqual(seo.instagram_url, "https://instagram.com/salyco.ir")

    def test_running_it_twice_creates_nothing_new(self):
        call_command("setup_salyco_cms")
        before = (ArticleIndexPage.objects.count(), Site.objects.count(), Collection.objects.count())
        call_command("setup_salyco_cms")
        after = (ArticleIndexPage.objects.count(), Site.objects.count(), Collection.objects.count())
        self.assertEqual(before, after)

    def test_it_does_not_clobber_an_edited_seo_setting(self):
        call_command("setup_salyco_cms")
        site = Site.objects.get(is_default_site=True)
        seo = GlobalSeoSettings.for_site(site)
        seo.brand_name_fa = "سالیکو تشک"
        seo.save()
        call_command("setup_salyco_cms")
        seo.refresh_from_db()
        self.assertEqual(seo.brand_name_fa, "سالیکو تشک")
