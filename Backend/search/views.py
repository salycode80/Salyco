"""Unified search endpoint.

``GET /api/search/?q=<query>&limit=<n>&type=<key>``

Iterates every registered :class:`~search.base.SearchProvider` and returns the
hits grouped by provider. Public (no auth required).
"""

from __future__ import annotations

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .registry import get_provider, get_providers

# Per-provider result cap for the live/autocomplete dropdown. Kept small so the
# endpoint stays fast; the full results page raises it via ?limit=.
DEFAULT_LIMIT = 6
MAX_LIMIT = 50


class SearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()

        try:
            limit = int(request.query_params.get("limit", DEFAULT_LIMIT))
        except (TypeError, ValueError):
            limit = DEFAULT_LIMIT
        limit = max(1, min(limit, MAX_LIMIT))

        # Optionally restrict to a single provider (e.g. ?type=article).
        type_filter = (request.query_params.get("type") or "").strip()

        if len(query) < 2:
            return Response({"query": query, "count": 0, "groups": []})

        if type_filter:
            provider = get_provider(type_filter)
            providers = [provider] if provider else []
        else:
            providers = get_providers()

        groups = []
        total = 0
        for provider in providers:
            results = provider.search(query, limit, request)
            if not results:
                continue
            total += len(results)
            groups.append(
                {
                    "key": provider.key,
                    "label": provider.label,
                    "results": results,
                }
            )

        return Response({"query": query, "count": total, "groups": groups})
