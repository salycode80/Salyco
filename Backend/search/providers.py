"""Concrete search providers.

Each provider is registered on import (via the module's ``@register`` calls,
triggered from ``SearchConfig.ready``). To add a new searchable content type,
write another ``SearchProvider`` subclass here and decorate it with
``@register`` — the endpoint picks it up with no further changes.
"""

from __future__ import annotations

from django.db.models import Q

from articles.models import Article
from mattress.models import Mattress

from .base import SearchProvider, SearchResult
from .registry import register


def _truncate(text: str, length: int = 120) -> str:
    text = (text or "").strip()
    return text if len(text) <= length else text[: length - 1].rstrip() + "…"


@register
class MattressSearchProvider(SearchProvider):
    key = "mattress"
    label = "محصولات"

    def search(self, query, limit, request):
        qs = (
            Mattress.objects.filter(
                Q(name__icontains=query)
                | Q(brand__icontains=query)
                | Q(subtitle__icontains=query)
                | Q(description__icontains=query)
            )
            .order_by("name")[:limit]
        )
        return [
            SearchResult(
                type=self.key,
                type_label=self.label,
                id=m.pk,
                title=m.name,
                subtitle=m.subtitle or _truncate(m.description, 90),
                url=f"/products/mattress/{m.slug}",
                image=self.absolute_media_url(request, m.image),
            )
            for m in qs
        ]


@register
class ArticleSearchProvider(SearchProvider):
    key = "article"
    label = "مقالات"

    def search(self, query, limit, request):
        qs = (
            Article.objects.filter(is_published=True)
            .filter(
                Q(title__icontains=query)
                | Q(excerpt__icontains=query)
                | Q(content__icontains=query)
            )
            .order_by("-created_at")[:limit]
        )
        return [
            SearchResult(
                type=self.key,
                type_label=self.label,
                id=a.pk,
                title=a.title,
                subtitle=_truncate(a.excerpt, 110),
                url=f"/articles/{a.slug}",
                image=self.absolute_media_url(request, a.image),
            )
            for a in qs
        ]
