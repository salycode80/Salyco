from rest_framework import generics
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from mattress.permissions import IsAdminUser

from .models import GalleryImage
from .serializers import AdminGalleryImageSerializer


class AdminGalleryImageListView(generics.ListCreateAPIView):
    """The control panel's gallery list — every row, active or not.

    MultiPartParser is what lets the panel post the picked file directly; the
    banner and article uploads go through the same three parsers.
    """

    permission_classes = [IsAdminUser]
    serializer_class = AdminGalleryImageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None
    queryset = GalleryImage.objects.all()


class AdminGalleryImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminGalleryImageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = GalleryImage.objects.all()
