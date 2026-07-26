from __future__ import annotations

from rest_framework import serializers

from mattress.models import Mattress, MattressSize

from .models import AllowedLocation, Cart, CartItem, Order, OrderItem


class CartItemSerializer(serializers.ModelSerializer):
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    mattress_slug = serializers.CharField(source="mattress.slug", read_only=True)
    mattress_image = serializers.ImageField(source="mattress.image", read_only=True)
    size_label = serializers.CharField(source="size.label", read_only=True, default="")
    unit_price = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    line_total = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )

    class Meta:
        model = CartItem
        fields = [
            "id",
            "mattress",
            "mattress_name",
            "mattress_slug",
            "mattress_image",
            "size",
            "size_label",
            "quantity",
            "unit_price",
            "line_total",
        ]
        read_only_fields = ["id"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cart
        fields = ["id", "items", "total", "count"]


class AddCartItemSerializer(serializers.Serializer):
    """Add a product (optionally a size) to the cart, or bump its quantity."""

    mattress_id = serializers.IntegerField()
    size_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(required=False, default=1, min_value=1)

    def validate(self, attrs):
        try:
            attrs["mattress"] = Mattress.objects.get(pk=attrs["mattress_id"])
        except Mattress.DoesNotExist:
            raise serializers.ValidationError({"mattress_id": "محصول یافت نشد."})

        size = None
        size_id = attrs.get("size_id")
        if size_id:
            try:
                size = MattressSize.objects.get(pk=size_id, mattress=attrs["mattress"])
            except MattressSize.DoesNotExist:
                raise serializers.ValidationError({"size_id": "سایز یافت نشد."})
        attrs["size"] = size
        return attrs


class MergeCartSerializer(serializers.Serializer):
    """Merge a pre-login local cart into the server cart."""

    items = AddCartItemSerializer(many=True)


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "mattress",
            "mattress_name",
            "size_label",
            "quantity",
            "unit_price",
            "line_total",
        ]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "method",
            "method_display",
            "status",
            "status_display",
            "recipient_name",
            "phone_number",
            "customer_phone",
            "call_time_preference",
            "province",
            "city",
            "postal_code",
            "address",
            "total_amount",
            "created_at",
            "items",
        ]
        read_only_fields = fields


class AllowedLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedLocation
        fields = ["id", "province", "city"]
