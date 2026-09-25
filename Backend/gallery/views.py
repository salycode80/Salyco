from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import GalleryImage
from .serializers import GalleryImageSerializer


class GalleryImageListView(generics.ListAPIView):
    """Public endpoint for the About page gallery.

    Unpaginated because the section is a masonry column layout, not a browsing
    list: a second page would have nowhere to appear. Inactive rows are absent
    so an image can be pulled without deleting it.
    """

    permission_classes = [AllowAny]
    serializer_class = GalleryImageSerializer
    pagination_class = None

    def get_queryset(self):
        return GalleryImage.objects.filter(is_active=True).order_by(
            "order", "-created_at"
        )
