"""Base interface and helpers for search providers."""

from __future__ import annotations

from typing import Optional


class SearchResult(dict):
    """A single unified search hit.

    Kept as a plain ``dict`` subclass so it serialises straight to JSON. Every
    provider emits the same shape, which lets the frontend render any result
    type with one component.

    Fields
    ------
    type      : provider key (e.g. ``"mattress"``) — groups/badges the result
    type_label: human label for the group (e.g. ``"محصول"``)
    id        : stable identifier within the type
    title     : primary display text
    subtitle  : secondary line (optional)
    url       : SPA path the result links to (e.g. ``/products/mattress/foo``)
    image     : absolute image URL or ``None``
    """

    def __init__(
        self,
        *,
        type: str,
        type_label: str,
        id,
        title: str,
        url: str,
        subtitle: str = "",
        image: Optional[str] = None,
    ):
        super().__init__(
            type=type,
            type_label=type_label,
            id=id,
            title=title,
            subtitle=subtitle,
            url=url,
            image=image,
        )


class SearchProvider:
    """Interface every search provider implements.

    Subclasses set ``key`` (machine name) and ``label`` (human name) and
    implement :meth:`search`.
    """

    key: str = ""
    label: str = ""

    def search(self, query: str, limit: int, request) -> list[SearchResult]:
        """Return up to ``limit`` :class:`SearchResult` items for ``query``.

        ``request`` is passed so providers can build absolute media URLs.
        """
        raise NotImplementedError

    # ── helpers ──────────────────────────────────────────────────────────
    def absolute_media_url(self, request, image_field) -> Optional[str]:
        """Turn an ImageField (or falsy) into an absolute URL, or ``None``."""
        if not image_field:
            return None
        try:
            url = image_field.url
        except (ValueError, AttributeError):
            return None
        if request is not None:
            return request.build_absolute_uri(url)
        return url
