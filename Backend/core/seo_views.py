"""The crawler surface: /sitemap.xml and /robots.txt.

Both paths used to fall through to the SPA shell — HTTP 200 with Content-Type
text/html — so a crawler asking for a sitemap was handed a React application.

Every URL here is built from settings.SITE_URL rather than from the request, for
the same reason the article metadata is: three proxies sit between Django and
the client, and a canonical sitemap entry pointing at "http://backend:8000/" is
worse than no sitemap at all.
"""
from django.conf import settings
from django.http import HttpResponse
from django.utils.html import escape
from django.views.decorators.http import require_GET

from articles.models import ArticleIndexPage, ArticlePage
from articles.snippets import ArticleCategory
from mattress.models import Mattress

# Routes the SPA owns. They are static, so they are listed here rather than
# crawled — there is nothing to enumerate.
STATIC_PATHS = ["/", "/products", "/about", "/contact", "/dealers"]


def _url(loc, lastmod=None):
    parts = [f"<loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"<lastmod>{lastmod.date().isoformat()}</lastmod>")
    return f"<url>{''.join(parts)}</url>"


@require_GET
def sitemap_xml(request):
    entries = [_url(f"{settings.SITE_URL}{path}") for path in STATIC_PATHS]

    index = ArticleIndexPage.objects.live().first()
    if index is not None:
        entries.append(_url(f"{settings.SITE_URL}{index.get_url()}"))

    for category in ArticleCategory.objects.filter(is_active=True):
        # The archive is a sub-route of the index, so its URL is built rather
        # than read: a category has no page of its own to call get_url() on.
        path = f"/articles/category/{category.slug}/"
        entries.append(_url(f"{settings.SITE_URL}{path}"))

    # Tag archives are deliberately absent: they are noindex,follow, and listing
    # one here would contradict its own robots directive in the same document set.
    articles = (
        ArticlePage.objects.live()
        .public()
        .filter(allow_indexing=True)
        .order_by("-first_published_at")
    )
    for article in articles:
        entries.append(
            _url(f"{settings.SITE_URL}{article.get_url()}", article.last_published_at)
        )

    # Products carry no <lastmod>. Mattress has no created_at or updated_at, and
    # stamping timezone.now() would claim the whole catalogue changed on every
    # fetch — which devalues the signal for the pages that do carry a real date.
    # is_available is ignored on purpose: an out-of-stock page still holds
    # inbound links, and stock state belongs in Offer.availability.
    for product in Mattress.objects.all().only("category", "slug"):
        path = f"/products/{product.category}/{product.slug}"
        entries.append(_url(f"{settings.SITE_URL}{path}"))

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{''.join(entries)}</urlset>"
    )
    return HttpResponse(body, content_type="application/xml")


@require_GET
def robots_txt(request):
    lines = [
        "User-agent: *",
        "Allow: /",
        # The CMS and the legacy Django admin are staff surfaces; the API is not
        # a document.
        "Disallow: /cms/",
        "Disallow: /admin/",
        "Disallow: /api/",
        "",
        f"Sitemap: {settings.SITE_URL}/sitemap.xml",
    ]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")
