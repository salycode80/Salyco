import base64
import io
import shutil
import tempfile

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from wagtail.contrib.redirects.models import Redirect
from wagtail.images.models import Image
from wagtail.models import Page

from articles.legacy import content_to_blocks, parse_slugmap
from articles.models import ArticlePage
from articles.models import Article as LegacyArticle

# A real 1x1 PNG. Not decoration: Django's ImageField reads the dimensions out of
# the file when the row is saved (width_field/height_field), so bytes that Pillow
# cannot decode would leave width and height unset — and those columns are not
# nullable.
PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)

SLUGMAP = """OLD : /articles/old-one
NEW : /articles/جدید-یک
ENC : /articles/%D8%AC%D8%AF%DB%8C%D8%AF-%DB%8C%DA%A9

OLD : /articles/old-two
NEW : /articles/جدید-دو
ENC : /articles/%D8%AC%D8%AF%DB%8C%D8%AF-%D8%AF%D9%88
"""

LEGACY_TEXT = """مقدمه‌ای درباره انتخاب تشک.

نکته مهم:

پاراگراف دوم که توضیح می‌دهد چرا سختی تشک مهم است.

پاراگراف سوم."""


class SlugmapTests(TestCase):
    def test_old_paths_map_to_the_persian_replacement(self):
        mapping = parse_slugmap(SLUGMAP)
        self.assertEqual(mapping["/articles/old-one"], "/articles/جدید-یک")

    def test_the_encoded_line_is_ignored(self):
        self.assertEqual(len(parse_slugmap(SLUGMAP)), 2)

    def test_a_malformed_block_is_skipped_not_crashed(self):
        self.assertEqual(parse_slugmap("OLD : /a\n\nNEW : /b\n"), {})


class ContentConversionTests(TestCase):
    def test_paragraphs_become_paragraph_blocks(self):
        blocks = content_to_blocks("اول.\n\nدوم.")
        self.assertEqual([kind for kind, _ in blocks], ["paragraph", "paragraph"])

    def test_a_short_standalone_line_ending_in_a_colon_becomes_a_heading(self):
        blocks = content_to_blocks("مقدمه.\n\nنکته مهم:\n\nبدنه.")
        self.assertEqual(
            [kind for kind, _ in blocks],
            ["paragraph", "heading", "paragraph"],
        )

    def test_no_text_is_lost(self):
        # The command aborts an article whose conversion is shorter than the
        # original, so this is what makes that guard meaningful.
        blocks = content_to_blocks(LEGACY_TEXT)
        joined = " ".join(
            value.get("text") if kind == "heading" else value
            for kind, value in blocks
        )
        for fragment in ("مقدمه‌ای درباره", "نکته مهم", "پاراگراف دوم", "پاراگراف سوم"):
            self.assertIn(fragment, joined)

    def test_whitespace_only_input_produces_nothing(self):
        self.assertEqual(content_to_blocks("\n\n   \n\n"), [])

    def test_crlf_content_converts_the_same_as_lf(self):
        # Not hypothetical: every one of the four legacy articles in production
        # separates its paragraphs with CRLF, and not one line ends in a bare LF.
        # Without normalisation the split still works — r"\n\s*\n" matches across
        # the "\r\n\r\n" — but each block keeps its stray carriage return, which
        # then travels into the stored HTML.
        lf = content_to_blocks("اول.\n\nنکته مهم:\n\nدوم.")
        crlf = content_to_blocks("اول.\r\n\r\nنکته مهم:\r\n\r\nدوم.")
        self.assertEqual(lf, crlf)
        self.assertNotIn("\r", str(crlf))


class MigrationCommandTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.legacy = LegacyArticle.objects.create(
            title="سایز تشک استاندارد",
            slug="sz-tsh-mnsb-st-rhnm-baad-stndrd-nfrh-o-do-nfrh",
            excerpt="راهنمای سایز",
            content=LEGACY_TEXT,
        )

    def setUp(self):
        call_command("setup_salyco_cms", verbosity=0)
        self.index = Page.objects.get(slug="articles").specific

    def run_command(self, *args):
        call_command("migrate_legacy_articles", *args, stdout=self._out())

    def _out(self):
        import io

        return io.StringIO()

    def test_it_creates_a_page_per_legacy_article(self):
        self.run_command()
        self.assertEqual(ArticlePage.objects.count(), 1)

    def test_it_uses_the_slug_from_the_slug_map(self):
        # Reads the expectation out of the real _slugmap.txt rather than
        # hard-coding a Persian string here, which would go stale the moment
        # someone edits the map. This still fails if the command ignores the map
        # and slugifies the title instead — the two values differ.
        from articles.legacy import parse_slugmap
        from articles.management.commands.migrate_legacy_articles import SLUGMAP_PATH

        mapping = parse_slugmap(SLUGMAP_PATH.read_text(encoding="utf-8"))
        expected = mapping[f"/articles/{self.legacy.slug}"].rsplit("/", 1)[-1]

        self.run_command()
        self.assertEqual(ArticlePage.objects.get().slug, expected)

    def test_it_records_the_legacy_id(self):
        self.run_command()
        self.assertEqual(ArticlePage.objects.get().legacy_id, self.legacy.id)

    def test_it_preserves_the_publication_date(self):
        # first_published_at is the article's own date — what the page displays
        # and what the JSON-LD calls datePublished — and the migration carries it
        # over. last_published_at is deliberately not asserted: publish() sets it
        # to now() unconditionally, which is a record of this import publishing
        # the page rather than a value the command controls.
        self.run_command()
        page = ArticlePage.objects.get()
        self.assertEqual(page.first_published_at, self.legacy.created_at)

    def test_a_published_legacy_article_goes_live(self):
        # The other half of the draft test below: the flag has to be honoured in
        # both directions, and Page.live defaults to True, so "it went live" is
        # the outcome a bug would produce by accident too.
        self.run_command()
        self.assertTrue(ArticlePage.objects.get().live)

    def test_the_body_carries_the_article_text(self):
        self.run_command()
        page = ArticlePage.objects.get()
        self.assertTrue(any(b.block_type == "paragraph" for b in page.body))

    def test_it_creates_a_permanent_redirect_from_the_old_path(self):
        self.run_command()
        # No trailing slash in the lookup: Redirect.save() normalises old_path
        # through Redirect.normalise_path, which strips it. Redirect has no custom
        # manager, so a lookup is a raw query and does not normalise to match.
        redirect = Redirect.objects.get(old_path=f"/articles/{self.legacy.slug}")
        # .specific, because the FK hands back a Page and Django's Model.__eq__
        # compares _meta.concrete_model — so a Page and an ArticlePage with the
        # same pk are not equal, and asserting on the raw FK always fails.
        self.assertEqual(redirect.redirect_page.specific, ArticlePage.objects.get())
        # Permanent, because the old URL is never coming back. A 302 would tell
        # the crawler to keep the old entry and re-check it forever.
        self.assertTrue(redirect.is_permanent)

    def test_the_old_url_redirects_to_the_new_one(self):
        from urllib.parse import unquote

        from articles.legacy import parse_slugmap
        from articles.management.commands.migrate_legacy_articles import SLUGMAP_PATH

        mapping = parse_slugmap(SLUGMAP_PATH.read_text(encoding="utf-8"))
        expected = mapping[f"/articles/{self.legacy.slug}"]

        self.run_command()
        response = self.client.get(f"/articles/{self.legacy.slug}/")

        self.assertEqual(response.status_code, 301)
        # unquote, because Django runs the Location header through iri_to_uri:
        # the wire form is percent-encoded even though the page's own path is
        # Persian. Asserting the raw Persian here fails on the first run.
        #
        # The trailing slashes are compared loosely because the two sides spell
        # the same path differently: _slugmap.txt stores a path, while a Wagtail
        # page URL is always slash-terminated, and the redirect lands on the page.
        self.assertEqual(
            unquote(response["Location"]).rstrip("/"), expected.rstrip("/")
        )

    def test_a_second_run_imports_nothing(self):
        self.run_command()
        self.run_command()
        self.assertEqual(ArticlePage.objects.count(), 1)

    def test_dry_run_writes_nothing(self):
        before = (ArticlePage.objects.count(), Redirect.objects.count())
        self.run_command("--dry-run")
        after = (ArticlePage.objects.count(), Redirect.objects.count())
        self.assertEqual(before, after)
        self.assertEqual(before, (0, 0))

    def test_an_unpublished_legacy_article_becomes_a_draft(self):
        unpublished = LegacyArticle.objects.create(
            title="منتشرنشده", slug="hidden", content="متن", is_published=False
        )
        self.run_command()
        # Looked up by legacy_id, not by slug: this article has no _slugmap entry,
        # so its slug comes from the Persian title rather than from "hidden".
        page = ArticlePage.objects.get(legacy_id=unpublished.id)
        self.assertFalse(page.live)

    def test_the_legacy_table_is_left_alone(self):
        self.run_command()
        self.assertEqual(LegacyArticle.objects.count(), 1)


class ImageMigrationTests(TestCase):
    """The hero-image path, which the rest of this module does not touch.

    Worth its own class because it is the one part of the command that reads and
    writes files, and because every one of the four articles this has to import
    in production carries an image — so it will run for real on the first
    deploy even though nothing else here exercises it.
    """

    @classmethod
    def setUpClass(cls):
        cls._media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._media)
        cls._override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)

    def setUp(self):
        call_command("setup_salyco_cms", verbosity=0)

    def test_it_copies_the_legacy_image_into_the_image_library(self):
        legacy = LegacyArticle.objects.create(
            title="با تصویر", slug="with-image", excerpt="خلاصه", content="متن کوتاه."
        )
        legacy.image.save("hero.png", ContentFile(PNG_1PX), save=True)

        call_command("migrate_legacy_articles", stdout=io.StringIO())

        page = ArticlePage.objects.get(legacy_id=legacy.id)
        self.assertIsNotNone(page.hero_image)
        self.assertEqual(page.hero_image.title, "با تصویر")
        self.assertEqual(page.hero_image_alt, "با تصویر")
        # The dimensions are read off the file rather than left unset: `width`
        # and `height` are non-nullable, and Django fills them from the image
        # itself. Real bytes, not a placeholder string — a fake file would fail
        # to decode and import as a broken image, which is exactly the failure
        # this test exists to catch before four production articles hit it.
        self.assertEqual((page.hero_image.width, page.hero_image.height), (1, 1))
        # The copy goes to the configured media root, so a test run does not
        # leave files in the repository's own media/ directory.
        self.assertTrue(page.hero_image.file.path.startswith(self._media))
