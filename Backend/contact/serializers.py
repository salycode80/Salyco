from rest_framework import serializers

from .models import Suggestion


class SuggestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Suggestion
        fields = ["id", "name", "email", "phone", "message", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        # Require at least one way to reach the person back.
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError(
                "لطفاً ایمیل یا شماره تماس را وارد کنید."
            )
        return attrs
