from __future__ import annotations

from rest_framework import serializers

from .models import AllowedLocation, Order
from .serializers import OrderItemSerializer


class AdminOrderSerializer(serializers.ModelSerializer):
    """Order row for the admin panel. Only `status` is writable so staff can
    move an order through its lifecycle; everything else is read-only."""

    items = OrderItemSerializer(many=True, read_only=True)
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "customer_name",
            "method",
            "method_display",
            "status",
            "status_display",
            "recipient_name",
            "phone_number",
            "province",
            "city",
            "postal_code",
            "address",
            "total_amount",
            "created_at",
            "items",
        ]
        read_only_fields = [f for f in fields if f != "status"]

    def get_customer_name(self, obj: Order) -> str:
        c = obj.customer
        return f"{c.first_name} {c.last_name}".strip() or "کاربر"


class AdminAllowedLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedLocation
        fields = ["id", "province", "city", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]
