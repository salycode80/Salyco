"""Registry for pluggable search providers.

A provider is any object exposing the :class:`SearchProvider` interface. To make
a new content type searchable, define a provider in ``search/providers.py`` (or
any module imported at startup) and decorate it with :func:`register`::

    @register
    class DealerSearchProvider(SearchProvider):
        key = "dealer"
        label = "نمایندگی"

        def search(self, query, limit, request):
            ...

The unified search endpoint iterates every registered provider, so no other
code needs to change when a new type is plugged in.
"""

from __future__ import annotations

# Providers are stored in registration order; the endpoint preserves this order
# when grouping results, so declare providers in the priority you want shown.
_registry: list = []


def register(provider_cls):
    """Class decorator that instantiates a provider and adds it to the registry."""
    _registry.append(provider_cls())
    return provider_cls


def get_providers() -> list:
    """Return all registered provider instances, in registration order."""
    return list(_registry)


def get_provider(key: str):
    """Return the provider with the given ``key``, or ``None``."""
    for provider in _registry:
        if provider.key == key:
            return provider
    return None
