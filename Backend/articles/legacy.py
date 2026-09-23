"""Converting the legacy plain-text articles into structured blocks.

The old `content` column is a TextField of paragraphs separated by blank lines —
NOT HTML. The SEO design spec assumed a sanitisation problem would have to be
solved to get links into article bodies; there is no HTML to sanitise, so this is
a clean parse and no RawHTMLBlock is needed anywhere.
"""
import re

# A standalone line this short that ends in a colon is a section label, not a
# sentence: "نکته مهم:" is a heading, "پس توجه کنید:" at the end of a sentence is
# not — which is why the length bound matters and why the colon must be final.
_HEADING_MAX_WORDS = 8

_SLUGMAP_LINE_RE = re.compile(r"^(OLD|NEW|ENC)\s*:\s*(.+?)\s*$")


def parse_slugmap(text):
    """Parse _slugmap.txt into {old_path: new_path}.

    The file repeats each entry three times — OLD, NEW, and ENC with the
    percent-encoded form. Django's request.path is already decoded, so the ENC
    line is redundant and is skipped; a block missing its OLD or NEW line is
    dropped rather than half-applied.
    """
    mapping = {}
    current = {}
    for line in text.splitlines():
        if not line.strip():
            _flush(current, mapping)
            current = {}
            continue
        match = _SLUGMAP_LINE_RE.match(line)
        if match:
            current[match.group(1)] = match.group(2)
    _flush(current, mapping)
    return mapping


def _flush(current, mapping):
    if "OLD" in current and "NEW" in current:
        mapping[current["OLD"]] = current["NEW"]


def content_to_blocks(text):
    """Turn the legacy plain text into (block_type, value) pairs.

    Only paragraphs and H2 headings are produced. The old format carried no
    other structure — no lists, no images, no links — so inferring any would be
    inventing content the author never wrote.
    """
    blocks = []
    for chunk in re.split(r"\n\s*\n", _normalise_newlines(text)):
        chunk = chunk.strip()
        if not chunk:
            continue
        if _is_heading(chunk):
            blocks.append(
                ("heading", {"text": chunk, "level": "h2", "anchor_id": ""})
            )
        else:
            # Escaped and wrapped: the value is a RichTextBlock, which stores
            # HTML source. The text is plain already, but a bare "&" or "<" in
            # the original would otherwise be parsed as markup on render.
            blocks.append(("paragraph", f"<p>{_escape(chunk)}</p>"))
    return blocks


def _normalise_newlines(text):
    """Fold CRLF and lone CR to LF before parsing.

    Not defensive coding for its own sake: every paragraph break in the four
    articles this has to import is CRLF, with no bare LF anywhere. The split
    would still find them — r"\\n\\s*\\n" matches across a "\\r\\n\\r\\n" — but each
    block would keep a trailing carriage return, which then travels into the
    stored HTML of the article body. Reading the real data is what showed this;
    it is not visible from the model definition.
    """
    return (text or "").replace("\r\n", "\n").replace("\r", "\n")


def _is_heading(chunk):
    if not chunk.endswith((":", "：")):
        return False
    if "\n" in chunk:
        return False
    return len(chunk.split()) <= _HEADING_MAX_WORDS


def _escape(text):
    return (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )
