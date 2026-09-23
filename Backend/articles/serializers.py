"""Serializers for the public article API.

Deliberately hand-written rather than ModelSerializers: the fields keep the
legacy names (`created_at`, `updated_at`, `content`, `image`) even though the
underlying page uses Wagtail's names, because consumers already read those keys.
"""
from rest_framework import serializers

from .models import ArticlePage
from .services import body_to_text


class ArticleListSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(source="first_published_at", read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = ArticlePage
        fields = ["title", "slug", "excerpt", "image", "created_at"]

    def get_image(self, page):
        """A URL, matching what the old ImageField produced.

        The old column serialised to a path the frontend joined onto API_URL;
        getArticleImageUrl() accepts either, so this stays absolute and needs no
        frontend change.
        """
        if not page.hero_image:
            return None
        return page.hero_image.get_rendition("width-1200").url


class ArticleDetailSerializer(ArticleListSerializer):
    content = serializers.SerializerMethodField()
    updated_at = serializers.DateTimeField(source="last_published_at", read_only=True)

    class Meta(ArticleListSerializer.Meta):
        fields = ArticleListSerializer.Meta.fields + ["content", "updated_at"]

    def get_content(self, page):
        # Plain text, one paragraph per line — what the old TextField held and
        # what the old detail page rendered inside whitespace-pre-wrap. HTML here
        # would print literal tags for any consumer still reading this field.
        return body_to_text(page.body)
