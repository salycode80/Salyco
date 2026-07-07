from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Customer
# from .models import Note

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "first_name",
            "last_name",
            "address",
            "phone_number",
            "postal_code",
        ]
        read_only_fields = ["id"]

        
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        print(validated_data)
        user = User.objects.create_user(**validated_data)
        return user


class CurrentUserSerializer(serializers.ModelSerializer):
    # Profile fields that live on the related Customer model.
    phone_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )
    address = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "address",
            "postal_code",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = ["id", "username", "is_staff", "date_joined"]

    def to_representation(self, instance):
        """Merge the linked Customer's fields into the User representation."""
        data = super().to_representation(instance)
        customer = getattr(instance, "customer", None)
        data["phone_number"] = getattr(customer, "phone_number", "") or ""
        data["address"] = getattr(customer, "address", "") or ""
        data["postal_code"] = getattr(customer, "postal_code", "") or ""
        return data

    def update(self, instance, validated_data):
        # Pull out the Customer-owned fields before touching the User.
        phone_number = validated_data.pop("phone_number", None)
        address = validated_data.pop("address", None)
        postal_code = validated_data.pop("postal_code", None)

        # Update the User fields (email, first_name, last_name).
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        # Mirror the profile fields onto the linked Customer, creating it
        # on first save (same pattern as the warranty registration flow).
        customer, _created = Customer.objects.get_or_create(
            user=instance,
            defaults={
                "first_name": instance.first_name or "",
                "last_name": instance.last_name or "",
                "address": address or "",
                "phone_number": phone_number or "",
                "postal_code": postal_code or "",
            },
        )
        if not _created:
            if phone_number is not None:
                customer.phone_number = phone_number
            if address is not None:
                customer.address = address
            if postal_code is not None:
                customer.postal_code = postal_code
            # Keep the customer's name in sync with the user's.
            customer.first_name = instance.first_name or customer.first_name
            customer.last_name = instance.last_name or customer.last_name
            customer.save()

        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("رمز عبور فعلی نادرست است.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user


# class NoteSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Note
#         fields = ["id", "title", "content", "created_at", "author"]
#         extra_kwargs = {"author": {"read_only": True}}