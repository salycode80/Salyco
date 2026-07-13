from django.apps import AppConfig


class SearchConfig(AppConfig):
    name = "search"

    def ready(self):
        # Importing the providers module runs the @register decorators,
        # populating the search registry. Any new provider added to
        # search/providers.py (or registered elsewhere on startup) becomes
        # searchable automatically — no other wiring required.
        from . import providers  # noqa: F401
