"""Metadata and structured data for article pages.

Every function here is pure over a page (and optionally a request), so each
fallback chain can be tested without going through a view — and so the sitemap
and the tests call exactly what the template calls.

Nothing in this module reads the request's host. Behind host nginx → container
nginx → gunicorn one wrong X-Forwarded-* header would put "backend:8000" into a
canonical tag and a social card, so the origin comes from settings.SITE_URL.
"""
from django.conf import settings
from wagtail.models import Site

from .snippets import GlobalSeoSettings

# Must match the rendition filter used in social_image(). The two values are
# only valid together: og:image:width/height that disagree with the actual file
# are worse than no dimensions at all.
OG_IMAGE_WIDTH = 1200
OG_IMAGE_HEIGHT = 630
OG_IMAGE_FILTER = f"fill-{OG_IMAGE_WIDTH}x{OG_IMAGE_HEIGHT}"

DEFAULT_TITLE_SUFFIX = "سالیکو"
DEFAULT_BRAND_FA = "سالیکو"


def absolute_url(path):
    """Join a site-relative path onto SITE_URL."""
    if not path:
        return f"{settings.SITE_URL}/"
    if path.startswith(("http://", "https://")):
        return path
    return f"{settings.SITE_URL}{path}"


def site_settings_for(request):
    """Global SEO settings for the request's site, or None.

    Returns None rather than raising: a management command, a test and a request
    with no matching Site all reach here, and every caller already has a
    sensible default for each field.
    """
    if request is None:
        return None
    site = Site.find_for_request(request)
    if site is None:
        return None
    return GlobalSeoSettings.for_site(site)


def with_title_suffix(raw, site_settings=None):
    """Append the brand suffix to a title string.

    Separate from meta_title because an archive has no seo_title field to read:
    its heading comes from the category snippet, not from a page.
    """
    raw = (raw or "").strip()
    suffix = (
        getattr(site_settings, "default_title_suffix", "") or DEFAULT_TITLE_SUFFIX
    ).strip()
    if not suffix or raw.endswith(suffix):
        # "عنوان | سالیکو | سالیکو" is what a crawler sees as a keyword-stuffed
        # title, so an editor who typed the suffix by hand is not punished for it.
        return raw
    return f"{raw} | {suffix}"


def meta_title(page, site_settings=None):
    return with_title_suffix(page.seo_title or page.title or "", site_settings)


def meta_description(page, site_settings=None):
    text = (
        getattr(page, "search_description", "") or getattr(page, "excerpt", "") or ""
    ).strip()
    if text:
        return text
    return (getattr(site_settings, "default_meta_description", "") or "").strip()


def canonical_url(page):
    override = (getattr(page, "canonical_url_override", "") or "").strip()
    if override:
        return override
    return absolute_url(page.get_url())


def robots_directive(page, request=None):
    if request is not None and getattr(request, "is_preview", False):
        return "noindex,nofollow"
    if not page.live:
        return "noindex,nofollow"
    index = "index" if getattr(page, "allow_indexing", True) else "noindex"
    follow = "follow" if getattr(page, "allow_following", True) else "nofollow"
    return f"{index},{follow}"


def social_image(page, site_settings=None):
    image = (
        getattr(page, "og_image", None)
        or getattr(page, "hero_image", None)
        or getattr(site_settings, "default_og_image", None)
    )
    if image is None:
        return ""
    return absolute_url(image.get_rendition(OG_IMAGE_FILTER).url)


def build_meta(page, request=None, site_settings=None):
    if site_settings is None:
        site_settings = site_settings_for(request)
    title = meta_title(page, site_settings)
    description = meta_description(page, site_settings)
    image = social_image(page, site_settings)
    return {
        "title": title,
        "description": description,
        "canonical": canonical_url(page),
        "robots": robots_directive(page, request),
        "og_type": "article",
        "og_locale": "fa_IR",
        "og_title": (getattr(page, "og_title", "") or title).strip(),
        "og_description": (getattr(page, "og_description", "") or description).strip(),
        "og_image": image,
        "og_image_width": OG_IMAGE_WIDTH,
        "og_image_height": OG_IMAGE_HEIGHT,
        "twitter_card": "summary_large_image",
    }


def page_meta_context(page, request=None):
    """Everything base_article.html needs to render <head>.

    One place, so no page can ship a canonical tag while forgetting og:url —
    and so the tests assert against the same dict the template renders.
    """
    site_settings = site_settings_for(request)
    return {
        "meta": build_meta(page, request, site_settings),
        "seo_settings": site_settings,
    }


def archive_meta(page, request, title, description, path, robots=None):
    """Metadata for a sub-route of `page` — a category or a tag archive.

    The og:* fields are re-derived rather than patched: build_meta fills them
    from the page's own title, so an archive that replaced only "title" would
    announce the index's name on every social card while its <title> tag said
    something else.
    """
    site_settings = site_settings_for(request)
    meta = build_meta(page, request, site_settings)
    title = with_title_suffix(title, site_settings)
    meta.update(
        {
            "title": title,
            "og_title": title,
            "description": description,
            "og_description": description,
            "canonical": absolute_url(path),
        }
    )
    if robots is not None:
        meta["robots"] = robots
    return meta


def _publisher(site_settings):
    publisher = {
        "@type": "Organization",
        "name": (getattr(site_settings, "brand_name_fa", "") or DEFAULT_BRAND_FA),
        "url": settings.SITE_URL,
    }
    logo = getattr(site_settings, "organization_logo", None)
    if logo is not None:
        publisher["logo"] = {
            "@type": "ImageObject",
            "url": absolute_url(logo.get_rendition("width-512").url),
        }
    same_as = [
        value
        for value in (
            (getattr(site_settings, field, "") or "").strip()
            for field in ("instagram_url", "telegram_url", "linkedin_url", "aparat_url")
        )
        if value
    ]
    if same_as:
        publisher["sameAs"] = same_as
    return publisher


def article_json_ld(page, request=None):
    site_settings = site_settings_for(request)
    data = {
        "@context": "https://schema.org",
        "@type": "Article",
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical_url(page)},
        "headline": page.title,
        "description": meta_description(page, site_settings),
        "inLanguage": "fa-IR",
        "publisher": _publisher(site_settings),
    }
    author = page.author
    if author is not None:
        # author_type decides whether this is a Person or an Organization. An
        # Organization described as a Person is a factual error in structured
        # data, not a cosmetic one, which is why the field exists at all.
        entry = {"@type": author.author_type, "name": author.name}
        if author.author_type == "Person" and author.job_title:
            entry["jobTitle"] = author.job_title
        if author.website_url:
            entry["url"] = author.website_url
        data["author"] = entry
    if page.first_published_at:
        data["datePublished"] = page.first_published_at.isoformat()
    if page.last_published_at:
        data["dateModified"] = page.last_published_at.isoformat()
    image = social_image(page, site_settings)
    if image:
        data["image"] = [image]
    return data


def breadcrumb_json_ld(page):
    """A BreadcrumbList built by walking the page's real ancestors.

    Walking the tree rather than using a hand-written list is what makes it
    impossible for a breadcrumb item to point at a URL that does not exist.
    """
    chain = [item for item in page.get_ancestors(inclusive=True) if item.depth > 1]
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": position,
                "name": item.title,
                "item": absolute_url(item.get_url()),
            }
            for position, item in enumerate(chain, start=1)
        ],
    }


def faq_json_ld(page):
    """FAQPage data, or None when the article has no FAQ block."""
    body = getattr(page, "body", None)
    if not body:
        return None
    pairs = []
    for block in body:
        if block.block_type != "faq":
            continue
        for item in block.value.get("items", []):
            question = (item.get("question") or "").strip()
            answer = (item.get("answer") or "").strip()
            if question and answer:
                pairs.append((question, answer))
    if not pairs:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": question,
                "acceptedAnswer": {"@type": "Answer", "text": answer},
            }
            for question, answer in pairs
        ],
    }
