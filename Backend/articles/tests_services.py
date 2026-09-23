from django.test import TestCase
from wagtail.blocks import StreamValue

from articles.blocks import BodyBlock
from articles.services import WORDS_PER_MINUTE, body_to_text, estimate_reading_time


def body(*blocks):
    """Build a StreamValue the way the database would hand one back."""
    return StreamValue(BodyBlock(), list(blocks))


class ReadingTimeTests(TestCase):
    def test_an_empty_body_still_reads_as_one_minute(self):
        # "۰ دقیقه مطالعه" reads as broken, not as "very short".
        self.assertEqual(estimate_reading_time(body()), 1)

    def test_a_short_article_is_one_minute(self):
        self.assertEqual(
            estimate_reading_time(body(("paragraph", "<p>سلام دنیا</p>"))), 1
        )

    def test_a_long_article_is_rounded_up(self):
        words = " ".join(["کلمه"] * (WORDS_PER_MINUTE * 2 + 1))
        result = estimate_reading_time(body(("paragraph", f"<p>{words}</p>")))
        self.assertEqual(result, 3)

    def test_markup_is_not_counted_as_words(self):
        plain = estimate_reading_time(body(("paragraph", "<p>یک دو سه</p>")))
        markup = estimate_reading_time(
            body(("paragraph", '<p><a href="https://example.com/a/b/c">یک</a> دو سه</p>'))
        )
        # The URL lives in an attribute, not in the text, so it must not inflate
        # the count — the design doc excludes URLs and link targets explicitly.
        self.assertEqual(plain, markup)

    def test_image_alt_text_is_not_counted(self):
        with_alt = body(
            ("paragraph", "<p>یک دو سه</p>"),
            (
                "image",
                {
                    "image": None,
                    "alt_text": " ".join(["توضیح"] * 400),
                    "decorative": False,
                    "caption": "",
                    "credit": "",
                },
            ),
        )
        self.assertEqual(estimate_reading_time(with_alt), 1)


class BodyTextTests(TestCase):
    def test_blocks_are_joined_with_a_blank_line(self):
        text = body_to_text(
            body(("paragraph", "<p>اول</p>"), ("paragraph", "<p>دوم</p>"))
        )
        self.assertEqual(text, "اول\n\nدوم")

    def test_html_is_stripped(self):
        text = body_to_text(body(("paragraph", "<p>متن <strong>مهم</strong></p>")))
        self.assertEqual(text, "متن مهم")

    def test_headings_and_quotes_are_included(self):
        text = body_to_text(
            body(
                ("heading", {"text": "عنوان", "level": "h2", "anchor_id": ""}),
                (
                    "quote",
                    {
                        "quote": "نقل",
                        "source_name": "",
                        "source_title": "",
                        "source_url": "",
                    },
                ),
            )
        )
        self.assertEqual(text, "عنوان\n\nنقل")

    def test_an_empty_body_is_an_empty_string(self):
        self.assertEqual(body_to_text(body()), "")
