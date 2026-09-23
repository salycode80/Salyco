"""Arrange Wagtail's tree, site, collections and settings for Salyco.

Idempotent on purpose: this runs on every deploy, so it creates what is missing
and never overwrites what an editor has changed. A setup command that resets
configured values is a command nobody dares run twice.
"""
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.sites.models import Site as DjangoSite
from django.core.management.base import BaseCommand
from django.db import transaction
from wagtail.models import Collection, Page, Site

from articles.models import ArticleIndexPage
from articles.snippets import GlobalSeoSettings

COLLECTIONS = ["مقالات", "محصولات", "عمومی"]

SEO_DEFAULTS = {
    "brand_name": "Salyco",
    "brand_name_fa": "سالیکو",
    "default_title_suffix": "سالیکو",
    "default_meta_description": "راهنمای انتخاب تشک و خرید خواب بهتر از سالیکو.",
    "instagram_url": "https://instagram.com/salyco.ir",
}

SITE_NAME = "سالیکو"


class Command(BaseCommand):
    help = "Create the Wagtail site, articles index, collections and SEO settings."

    @transaction.atomic
    def handle(self, *args, **options):
        parsed = urlparse(settings.SITE_URL)
        hostname = parsed.hostname
        if not hostname:
            raise ValueError(f"SITE_URL is not a usable URL: {settings.SITE_URL!r}")
        # Wagtail's Site has no scheme field: root_url() infers https from
        # port 443 and http from port 80. Deriving the port from SITE_URL rather
        # than hard-coding it keeps the canonical URLs in step with the one place
        # the site's own address is configured.
        port = parsed.port or (443 if parsed.scheme == "https" else 80)

        self._sync_sites_framework(hostname)
        root = self._root_page()
        site = self._ensure_site(root, hostname, port)
        self._ensure_index(root)
        self._ensure_collections()
        self._ensure_seo_settings(site)

        self.stdout.write(self.style.SUCCESS("CMS setup complete."))

    def _sync_sites_framework(self, hostname):
        row, _ = DjangoSite.objects.get_or_create(pk=settings.SITE_ID)
        if row.domain != hostname or row.name != hostname:
            row.domain = hostname
            row.name = hostname
            row.save()
            self.stdout.write(f"django.contrib.sites row set to {hostname}")

    def _root_page(self):
        """Wagtail's own Root page, which is what Site.root_page must point at.

        Not the articles index: if the index were the site root its own URL would
        be "/" and every article would sit at "/<slug>/", and every canonical tag
        and sitemap entry would be wrong.
        """
        root = Page.objects.filter(depth=1).first()
        if root is None:
            raise RuntimeError(
                "No Wagtail root page. Run 'manage.py migrate' first — wagtailcore "
                "creates it."
            )
        return root

    def _ensure_site(self, root, hostname, port):
        """Repoint the default site at the Wagtail root.

        The site is found by `is_default_site`, never by hostname. Wagtail's own
        initial data already creates a default site — hostname "localhost", rooted
        at its own "Welcome" page — so a `get_or_create(hostname=...)` lookup does
        not find it and instead creates a *second* default site. Nothing rejects
        that at the point of creation: `get_or_create` writes the row without
        calling `full_clean()`, and Wagtail's "only one site can be default" rule
        lives in `Site.clean()`. The damage shows up on the next lookup, as
        `Site.objects.get(is_default_site=True)` raising MultipleObjectsReturned —
        which takes down the SEO settings below and any other reader.
        """
        site = Site.objects.filter(is_default_site=True).first()
        if site is None:
            site = Site(
                hostname=hostname,
                port=port,
                is_default_site=True,
                root_page=root,
                site_name=SITE_NAME,
            )
            site.save()
            self.stdout.write(f"Wagtail site {hostname} created")
            return site

        changes = []
        for field, value in (
            ("hostname", hostname),
            ("port", port),
            ("site_name", SITE_NAME),
        ):
            if getattr(site, field) != value:
                setattr(site, field, value)
                changes.append(field)
        if site.root_page_id != root.id:
            site.root_page = root
            changes.append("root_page")
        if changes:
            site.save(update_fields=changes)
            self.stdout.write(
                f"Wagtail site repointed at the Wagtail root ({', '.join(changes)})"
            )
        return site

    def _ensure_index(self, root):
        index = ArticleIndexPage.objects.first()
        if index is not None:
            if index.get_parent().id != root.id:
                index.move(root, pos="last-child")
                self.stdout.write("Articles index moved under the Wagtail root")
            return index
        index = ArticleIndexPage(
            title="مقالات",
            slug="articles",
            hero_title="مقالات سالیکو",
            hero_description="راهنماها و نکته‌هایی برای خواب بهتر و انتخابی آگاهانه.",
        )
        root.add_child(instance=index)
        index.save_revision().publish()
        self.stdout.write("Articles index created at /articles/")
        return index

    def _ensure_collections(self):
        root = Collection.get_first_root_node()
        for name in COLLECTIONS:
            if root.get_children().filter(name=name).exists():
                continue
            root.add_child(instance=Collection(name=name))
            self.stdout.write(f"Collection {name} created")

    def _ensure_seo_settings(self, site):
        """Fill in the SEO defaults, once, and never again.

        The existence check has to happen *before* `for_site` is called.
        `BaseSiteSetting.for_site` is `get_or_create(site=site)`, so it creates the
        row as a side effect and the returned object always has a pk — making the
        obvious `if seo.pk is not None: return` guard dead code that would leave
        the defaults unapplied forever. (The unsaved-instance behaviour belongs to
        the *generic* setting base, `BaseGenericSetting.for_site`, which is a
        different class.)
        """
        if GlobalSeoSettings.objects.filter(site=site).exists():
            # An editor may have set every one of these; on a per-deploy command,
            # that has to win.
            return
        seo = GlobalSeoSettings.for_site(site)
        for field, value in SEO_DEFAULTS.items():
            setattr(seo, field, value)
        seo.save()
        self.stdout.write("Global SEO settings created with Salyco defaults")
