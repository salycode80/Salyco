from rest_framework import serializers
from .models import Article


class ArticleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = [
            "title",
            "slug",
            "excerpt",
            "image",
            "created_at",
        ]


class ArticleDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = [
            "title",
            "slug",
            "excerpt",
            "content",
            "image",
            "created_at",
            "updated_at",
        ]
