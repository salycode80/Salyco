"""Template helpers for the article pages."""
import json

from django import template
from django.utils.safestring import mark_safe
from django.utils.text import slugify

register = template.Library()


@register.filter
def heading_anchor(text):
    """A usable fragment id for a Persian heading.

    allow_unicode keeps the id readable instead of stripping every character and
    leaving an empty string, which would give every heading on the page the same
    (empty) id.
    """
    return slugify(text or "", allow_unicode=True)


@register.simple_tag
def link_href(link):
    """The href for an ArticleLinkBlock value.

    A page target is resolved through the page tree, so the link keeps working
    after a slug change; only a genuinely external target is used verbatim.
    """
    page = link.get("page")
    if page is not None:
        return page.get_url()
    return link.get("url") or ""


@register.filter
def fa_digits(value):
    """Write a numeral with Persian digits: 12 -> ۱۲.

    "1 دقیقه مطالعه" next to "۱۰ سال ضمانت" reads as a rendering fault.
    """
    from mattress.utils import persian_digits

    return persian_digits(value)


@register.filter
def jalali_long(value):
    """A date the way the rest of the site writes dates out: '۹ مهر ۱۴۰۵'.

    Delegates to mattress.utils so there is one calendar implementation. The
    <time datetime="..."> attribute stays ISO — only the visible text changes,
    because a machine reading the markup wants the unambiguous form.
    """
    from mattress.utils import format_jalali_long

    return format_jalali_long(value)


@register.simple_tag
def json_ld_script(data):
    """Serialise a JSON-LD dict into a script tag that cannot be broken out of.

    json.dumps leaves "<", ">" and "&" as literal characters, so a title
    containing "</script>" would close the tag early and everything after it
    would be parsed as markup. Escaping them to \\u003c, \\u003e and \\u0026 is
    exactly what Django's own json_script filter does; it is invisible to any
    JSON parser, so the structured data a crawler reads is unchanged.
    """
    if not data:
        return ""
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    for char, escaped in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026")):
        raw = raw.replace(char, escaped)
    return mark_safe(f'<script type="application/ld+json">{raw}</script>')
