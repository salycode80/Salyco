from rest_framework import serializers
from .models import Banner


class BannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = ["id", "title", "image", "image_url", "link", "order"]
        read_only_fields = ["id"]

    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None
