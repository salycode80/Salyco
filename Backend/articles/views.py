"""The article API, now served from the Wagtail pages.

The response shape is unchanged on purpose. FeaturedArticles.jsx and
Articles.jsx read these fields by name and call .slice() on the list, so a
pagination wrapper or a renamed key would break the homepage without a single
test failing — which is why tests_api.py pins both shapes rather than the values.
"""
from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import ArticlePage
from .serializers import ArticleDetailSerializer, ArticleListSerializer


def published_articles():
    """Live, public articles with their joins done.

    select_related here is what keeps a list request at a fixed number of queries
    instead of one per row; prefetch_related does the same for tags, which the
    serializer does not read today but a later filter will.
    """
    return (
        ArticlePage.objects.live()
        .public()
        .select_related("category", "author", "hero_image")
        .prefetch_related("tags")
        .order_by("-first_published_at", "-id")
    )


class ArticleListCreate(generics.ListCreateAPIView):
    serializer_class = ArticleListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return published_articles()


class ArticleDetail(generics.RetrieveAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return published_articles()
