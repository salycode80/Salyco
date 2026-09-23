"""Plain-text extraction and reading time.

Both callers want the same thing — the words an editor actually wrote — so the
block walk lives here once: the API's `content` field and the reading-time
estimate are the same traversal with different consumers.
"""
import math
import re

from django.utils.html import strip_tags

# Words per minute for Persian prose, lower than the 200-250 usually quoted for
# English: Vazirmatn at the sizes Design.md specifies fits fewer words to a line
# and Persian readers measure slightly slower.
WORDS_PER_MINUTE = 200

_WHITESPACE_RE = re.compile(r"\s+")


def _clean(text):
    return _WHITESPACE_RE.sub(" ", strip_tags(text or "")).strip()


def block_text(block):
    """The editor-visible prose of one StreamField block.

    Returns "" for blocks that carry no prose. An image's alt text and a CTA's
    button label are not part of what a reader reads as the article, and counting
    them would inflate both the API's `content` and the reading time.
    """
    kind = block.block_type
    value = block.value

    if kind == "heading":
        return _clean(value.get("text"))
    if kind == "paragraph":
        return _clean(str(value))
    if kind == "quote":
        return _clean(value.get("quote"))
    if kind == "callout":
        return _clean(f"{value.get('title', '')} {value.get('content', '')}")
    if kind == "faq":
        return _clean(
            " ".join(
                f"{item.get('question', '')} {item.get('answer', '')}"
                for item in value.get("items", [])
            )
        )
    return ""


def body_to_text(body):
    """The body as plain text, one paragraph per block.

    This is what the legacy API's `content` field always was, so consumers of
    /api/articles/<slug>/ keep seeing the same shape they always did.
    """
    return "\n\n".join(text for text in (block_text(b) for b in body) if text)


def estimate_reading_time(body):
    """Minutes to read, rounded up, never below one.

    Counts only prose, which is why it walks blocks rather than rendering the
    body and stripping tags: rendered output includes the FAQ heading and the
    CTA copy, which are chrome, not article.
    """
    words = sum(len(block_text(block).split()) for block in body)
    return max(1, math.ceil(words / WORDS_PER_MINUTE))
