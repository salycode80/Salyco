from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import Customer, Mattress, MattressInstance

User = get_user_model()


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


class MattressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mattress
        fields = [
            "id",
            "name",
            "description",
            "slug",
            "warranty_months",
            "price",
            "width",
            "length",
            "image",
        ]


class MattressInstanceSerializer(serializers.ModelSerializer):
    mattress = MattressSerializer(read_only=True)
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)

    class Meta:
        model = MattressInstance
        fields = [
            "serial_number",
            "mattress",
            "customer",
            "is_warranty_active",
            "activation_date",
            "manufacture_date",
            "warranty_expiration_date",
            "warranty_remaining_days",
            "is_under_warranty",
        ]
        read_only_fields = fields


class WarrantyRegistrationSerializer(serializers.Serializer):
    serial_number = serializers.CharField(max_length=100)
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    address = serializers.CharField(required=False)
    phone_number = serializers.CharField(max_length=20, required=False)
    postal_code = serializers.CharField(max_length=20, required=False)

    def validate_serial_number(self, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Serial number cannot be empty.")
        if not MattressInstance.objects.filter(serial_number=normalized).exists():
            raise serializers.ValidationError("No mattress found with this serial number.")
        return normalized

    def validate(self, attrs: dict) -> dict:
        instance = MattressInstance.objects.select_related("mattress").get(
            serial_number=attrs["serial_number"]
        )
        if instance.is_warranty_active:
            raise serializers.ValidationError(
                {"serial_number": "Warranty has already been activated for this mattress."}
            )
        attrs["instance"] = instance
        return attrs

    def save(self, **kwargs) -> MattressInstance:
        user = self.context["request"].user
        instance: MattressInstance = self.validated_data["instance"]

        customer, _created = Customer.objects.get_or_create(
            user=user,
            defaults={
                "first_name": self.validated_data.get("first_name", user.first_name or ""),
                "last_name": self.validated_data.get("last_name", user.last_name or ""),
                "address": self.validated_data.get("address", ""),
                "phone_number": self.validated_data.get("phone_number", ""),
                "postal_code": self.validated_data.get("postal_code", ""),
            },
        )

        if not _created:
            for field in ("first_name", "last_name", "address", "phone_number", "postal_code"):
                value = self.validated_data.get(field)
                if value:
                    setattr(customer, field, value)
            customer.save()

        instance.customer = customer
        instance.activation_date = timezone.localdate()
        instance.is_warranty_active = True
        instance.save(
            update_fields=["customer", "activation_date", "is_warranty_active"]
        )
        return instance


class WarrantyCheckSerializer(serializers.ModelSerializer):
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)

    class Meta:
        model = MattressInstance
        fields = [
            "serial_number",
            "mattress_name",
            "is_warranty_active",
            "activation_date",
            "warranty_expiration_date",
            "warranty_remaining_days",
            "is_under_warranty",
        ]
