from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Article
from .serializers import ArticleDetailSerializer, ArticleListSerializer


class ArticleListCreate(generics.ListCreateAPIView):
    serializer_class = ArticleListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Article.objects.filter(is_published=True)


class ArticleDetail(generics.RetrieveAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return Article.objects.filter(is_published=True)
