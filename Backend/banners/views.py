from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import Banner
from .serializers import BannerSerializer


class BannerListView(generics.ListAPIView):
    """Public endpoint for active banners."""
    permission_classes = [AllowAny]
    serializer_class = BannerSerializer
    pagination_class = None

    def get_queryset(self):
        return Banner.objects.filter(is_active=True).order_by("order", "-created_at")
