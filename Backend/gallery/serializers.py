from rest_framework import serializers

from .models import GalleryImage


class GalleryImageSerializer(serializers.ModelSerializer):
    """Public read shape. `image` is the raw stored path and `image_url` the
    servable one — the frontend only ever needs the latter, but the admin
    serializer inherits this and needs the former to round-trip an edit."""

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = GalleryImage
        fields = ["id", "title", "image", "image_url", "order"]
        read_only_fields = ["id"]

    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None


class AdminGalleryImageSerializer(GalleryImageSerializer):
    class Meta(GalleryImageSerializer.Meta):
        fields = GalleryImageSerializer.Meta.fields + [
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
