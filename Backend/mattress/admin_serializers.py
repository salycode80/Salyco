from __future__ import annotations

from rest_framework import serializers

from users.models import Customer

from .models import MattressInstance
from .utils import generate_qr_code_base64, get_warranty_public_url


class AdminInstanceSerializer(serializers.ModelSerializer):
    """Compact row for the CRM instance table."""

    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    mattress_id = serializers.IntegerField(source="mattress.id", read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="customer.phone_number", read_only=True, default="")
    is_sold = serializers.SerializerMethodField()
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)

    class Meta:
        model = MattressInstance
        fields = [
            "serial_number",
            "mattress_id",
            "mattress_name",
            "customer_name",
            "customer_phone",
            "is_sold",
            "is_warranty_active",
            "activation_date",
            "manufacture_date",
            "warranty_expiration_date",
            "warranty_remaining_days",
            "is_under_warranty",
        ]

    def get_is_sold(self, obj: MattressInstance) -> bool:
        return obj.customer_id is not None

    def get_customer_name(self, obj: MattressInstance) -> str:
        if obj.customer_id is None:
            return ""
        return f"{obj.customer.first_name} {obj.customer.last_name}".strip()


class AdminInstanceDetailSerializer(AdminInstanceSerializer):
    """Full detail incl. embedded customer + on-demand QR code."""

    mattress = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    warranty_url = serializers.SerializerMethodField()
    qr_code = serializers.SerializerMethodField()
    warranty_months = serializers.IntegerField(source="mattress.warranty_months", read_only=True)

    class Meta(AdminInstanceSerializer.Meta):
        fields = AdminInstanceSerializer.Meta.fields + [
            "mattress",
            "customer",
            "warranty_months",
            "warranty_url",
            "qr_code",
        ]

    def get_mattress(self, obj: MattressInstance) -> dict:
        m = obj.mattress
        return {
            "id": m.id,
            "name": m.name,
            "brand": m.brand,
            "slug": m.slug,
            "warranty_months": m.warranty_months,
        }

    def get_customer(self, obj: MattressInstance) -> dict | None:
        c = obj.customer
        if c is None:
            return None
        return {
            "id": c.id,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone_number": c.phone_number,
            "address": c.address,
            "postal_code": c.postal_code,
        }

    def get_warranty_url(self, obj: MattressInstance) -> str:
        return get_warranty_public_url(obj.serial_number)

    def get_qr_code(self, obj: MattressInstance) -> str:
        return generate_qr_code_base64(get_warranty_public_url(obj.serial_number))


class AdminCustomerSerializer(serializers.ModelSerializer):
    """Customer row with aggregated purchase counts."""

    full_name = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username", read_only=True, default="")
    email = serializers.CharField(source="user.email", read_only=True, default="")
    total_products = serializers.IntegerField(read_only=True)
    active_warranties = serializers.IntegerField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "full_name",
            "first_name",
            "last_name",
            "phone_number",
            "address",
            "postal_code",
            "username",
            "email",
            "total_products",
            "active_warranties",
        ]

    def get_full_name(self, obj: Customer) -> str:
        return f"{obj.first_name} {obj.last_name}".strip()
