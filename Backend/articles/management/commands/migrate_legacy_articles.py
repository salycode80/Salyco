"""Import the legacy articles.Article rows as Wagtail ArticlePages.

Idempotent through legacy_id, one transaction per article so a single bad row
cannot take the run down with it, and --dry-run writes nothing.

The legacy table is left in place: it is both the source and the rollback path,
and removing it is a separate change after this one has been verified in
production.
"""
from pathlib import Path

from django.conf import settings
from django.core.files.images import ImageFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from wagtail.contrib.redirects.models import Redirect
from wagtail.images.models import Image
from wagtail.models import Collection

from articles.legacy import content_to_blocks, parse_slugmap
from articles.models import ArticleIndexPage, ArticlePage

from ...models import Article as LegacyArticle

SLUGMAP_PATH = Path(settings.BASE_DIR).parent / "_slugmap.txt"


class Command(BaseCommand):
    help = "Import legacy Article rows into Wagtail ArticlePages."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would happen and write nothing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        mapping = self._load_slugmap()
        index = ArticleIndexPage.objects.first()
        if index is None:
            self.stderr.write(
                "No articles index. Run 'manage.py setup_salyco_cms' first."
            )
            return

        stats = {"total": 0, "migrated": 0, "skipped": 0, "failed": 0}
        for legacy in LegacyArticle.objects.order_by("id"):
            stats["total"] += 1
            if ArticlePage.objects.filter(legacy_id=legacy.id).exists():
                stats["skipped"] += 1
                continue
            try:
                with transaction.atomic():
                    self._migrate_one(legacy, index, mapping, dry_run)
                stats["migrated"] += 1
            except Exception as error:  # noqa: BLE001 — one bad row must not stop the rest
                stats["failed"] += 1
                # The legacy id and slug, never the body: an editor's draft text
                # has no business in a log file.
                self.stderr.write(
                    f"FAILED legacy_id={legacy.id} slug={legacy.slug!r}: {error}"
                )

        self.stdout.write(
            "total={total} migrated={migrated} skipped={skipped} failed={failed}".format(
                **stats
            )
        )
        if dry_run:
            self.stdout.write("Dry run — nothing was written.")

    def _load_slugmap(self):
        if not SLUGMAP_PATH.exists():
            self.stdout.write(f"No {SLUGMAP_PATH.name} found; slugs will be derived.")
            return {}
        return parse_slugmap(SLUGMAP_PATH.read_text(encoding="utf-8"))

    def _migrate_one(self, legacy, index, mapping, dry_run):
        blocks = content_to_blocks(legacy.content)
        if not self._conversion_kept_everything(legacy.content, blocks):
            # A parsing bug that silently drops half a paragraph is the one
            # failure nobody would notice until a reader did.
            raise ValueError("conversion lost text; refusing to import this article")

        slug = self._slug_for(legacy, mapping)
        page = ArticlePage(
            title=legacy.title,
            slug=slug,
            excerpt=(legacy.excerpt or "")[:500],
            body=blocks,
            legacy_id=legacy.id,
            # Set from the legacy flag, not left to the default. Page.live
            # defaults to True and add_child() writes the row without validating
            # anything, so an unlisted draft would otherwise be published by the
            # act of importing it. save_revision().publish() below raises it again
            # for the ones that really are published.
            live=legacy.is_published,
            # The article's own date, and the one that matters: it is what the
            # page shows, what the JSON-LD calls datePublished and what the
            # sitemap can carry. publish() only fills this in when it is empty
            # (actions/publish_revision.py:146), so a value set here survives.
            #
            # last_published_at is deliberately NOT carried over: publish() sets
            # it to now() unconditionally (:143), so passing the legacy value
            # would be dead code. It is Wagtail's record of when this page was
            # last published, and these articles were published by this import.
            first_published_at=legacy.created_at,
        )
        if dry_run:
            self.stdout.write(f"[dry-run] {legacy.slug} -> {slug}")
            return

        index.add_child(instance=page)
        if legacy.image:
            # Attached before the first publish, so the released revision already
            # carries the hero image rather than needing a second one.
            self._attach_image(page, legacy)
        if legacy.is_published:
            page.save_revision().publish()
        self._replace_redirect(legacy, page)
        self.stdout.write(f"{legacy.slug} -> {slug}")

    def _slug_for(self, legacy, mapping):
        new_path = mapping.get(f"/articles/{legacy.slug}")
        if new_path:
            return new_path.rsplit("/", 1)[-1]
        # No mapping entry: fall back to the title, which is Persian, rather than
        # to the transliterated slug nobody can read.
        return slugify(legacy.title, allow_unicode=True)[:250]

    def _conversion_kept_everything(self, original, blocks):
        source_words = len((original or "").split())
        result_words = sum(
            len(value["text"].split()) if kind == "heading" else len(value.split())
            for kind, value in blocks
        )
        return result_words >= source_words

    def _attach_image(self, page, legacy):
        """Copy the legacy image into the Wagtail image library.

        A copy, not a reference: Wagtail generates renditions from its own store,
        and the legacy file stays where the old table expects it so the rollback
        path still renders.
        """
        collection = Collection.objects.filter(name="مقالات").first()
        image = Image(
            title=legacy.title[:255],
            collection=collection or Collection.get_first_root_node(),
        )
        with legacy.image.open("rb") as handle:
            image.file = ImageFile(handle, name=legacy.image.name.rsplit("/", 1)[-1])
            image.save()
        page.hero_image = image
        page.hero_image_alt = legacy.title[:255]
        # save(), not save_revision().publish(): the caller publishes once after
        # this returns, so publishing here would create a revision per image and
        # leave the first one without it.
        page.save()

    def _replace_redirect(self, legacy, page):
        # Direct and single-hop: a chain of redirects costs a round trip and
        # dilutes what the crawler attributes to the destination.
        #
        # normalise_path, because save() runs old_path through it — and it strips
        # the trailing slash. Redirect has no custom manager, so update_or_create's
        # lookup is a raw query that does not normalise to match: passing the
        # trailing-slash form would miss the row written last time and try to
        # insert a duplicate of it.
        Redirect.objects.update_or_create(
            old_path=Redirect.normalise_path(f"/articles/{legacy.slug}/"),
            defaults={
                "redirect_page": page,
                "is_permanent": True,
                "site": page.get_site(),
            },
        )
