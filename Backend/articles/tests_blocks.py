from django.core.exceptions import ValidationError
from django.test import TestCase

from articles.blocks import ArticleLinkBlock, BodyBlock, HeadingBlock, ParagraphBlock


class HeadingBlockTests(TestCase):
    def test_h1_is_not_an_available_level(self):
        # The page title is the only h1 on the page. A choice that must never be
        # taken should not be offered, rather than validated against later.
        choices = dict(HeadingBlock().child_blocks["level"].field.choices)
        self.assertEqual(sorted(choices), ["h2", "h3"])


class ParagraphBlockTests(TestCase):
    def test_heading_features_are_not_available(self):
        # Without this, an editor can produce an <h2> inside a paragraph and
        # break the document outline the HeadingBlock exists to control.
        features = ParagraphBlock().features
        self.assertNotIn("h2", features)
        self.assertNotIn("h3", features)
        self.assertNotIn("h4", features)

    def test_inline_emphasis_and_links_are_available(self):
        features = ParagraphBlock().features
        for feature in ("bold", "italic", "link", "ol", "ul", "blockquote"):
            self.assertIn(feature, features)


class ArticleLinkBlockTests(TestCase):
    def test_a_block_with_neither_target_is_rejected(self):
        with self.assertRaises(ValidationError):
            ArticleLinkBlock().clean({"page": None, "url": "", "label": "بیشتر"})

    def test_a_block_with_both_targets_is_rejected(self):
        # Both set is ambiguous: the template would silently prefer one and the
        # editor would never learn which.
        with self.assertRaises(ValidationError):
            ArticleLinkBlock().clean(
                {"page": 1, "url": "https://example.com", "label": "بیشتر"}
            )

    def test_a_page_target_is_accepted(self):
        value = ArticleLinkBlock().clean({"page": 1, "url": "", "label": "بیشتر"})
        self.assertEqual(value["page"].pk, 1)


class BodyBlockTests(TestCase):
    def test_the_declared_block_types_are_the_stored_names(self):
        # These strings are what the migration writes and what block_text()
        # dispatches on, so they are an interface, not an implementation detail.
        self.assertEqual(
            sorted(BodyBlock().child_blocks),
            ["callout", "cta", "faq", "heading", "image", "paragraph", "quote"],
        )

    def test_no_raw_html_block_exists(self):
        for name, block in BodyBlock().child_blocks.items():
            self.assertNotEqual(
                type(block).__name__, "RawHTMLBlock", f"{name} is a RawHTMLBlock"
            )
