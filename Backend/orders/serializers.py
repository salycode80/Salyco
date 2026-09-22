from __future__ import annotations

from rest_framework import serializers

from mattress.models import Mattress, MattressSize

from .models import (
    AllowedLocation,
    Cart,
    CartItem,
    Coupon,
    CouponProduct,
    Order,
    OrderItem,
)


class CartCouponSerializer(serializers.ModelSerializer):
    """The applied coupon, as much of it as the cart page needs to describe the
    reduction. Never the usage counters — those are staff's business."""

    class Meta:
        model = Coupon
        fields = ["code", "discount_type", "percent", "amount"]
        read_only_fields = fields


class CartItemSerializer(serializers.ModelSerializer):
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    mattress_slug = serializers.CharField(source="mattress.slug", read_only=True)
    # Cart rows link back to the product page, which is /products/<category>/<slug>.
    # Without the category a pillow in the cart would link to a mattress URL.
    mattress_category = serializers.CharField(source="mattress.category", read_only=True)
    mattress_image = serializers.ImageField(source="mattress.image", read_only=True)
    size_label = serializers.CharField(source="size.label", read_only=True, default="")
    unit_price = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    line_total = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    # Without this a mixed cart shows a discount smaller than the headline
    # percentage with nothing on screen to explain why.
    covered_by_coupon = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "mattress",
            "mattress_name",
            "mattress_slug",
            "mattress_category",
            "mattress_image",
            "size",
            "size_label",
            "quantity",
            "unit_price",
            "line_total",
            "covered_by_coupon",
        ]
        read_only_fields = ["id"]

    def get_covered_by_coupon(self, obj: CartItem) -> bool:
        # self.root is the parent CartSerializer, so its instance is the cart
        # being serialized — reading the coupon from there avoids one query per
        # line. The fallback keeps this correct if the serializer is ever used
        # standalone.
        cart = getattr(self.root, "instance", None) or obj.cart
        coupon = cart.coupon if cart is not None else None
        if coupon is None:
            return False
        if coupon.applies_to_all_products:
            return True
        # One existence query per line, but only for a product-scoped coupon. A
        # cart holds a handful of lines, so this stays cheap and avoids pulling
        # the whole id set through the parent serializer.
        return CouponProduct.objects.filter(
            coupon=coupon, mattress_id=obj.mattress_id
        ).exists()


class CartSerializer(serializers.ModelSerializer):
    """The cart page's whole money picture.

    `total` keeps its name and now means *payable* — subtotal minus the coupon —
    so every existing consumer of cart.total is already correct.
    """

    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    discount_amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    total = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    count = serializers.IntegerField(read_only=True)
    coupon = CartCouponSerializer(read_only=True)

    class Meta:
        model = Cart
        fields = [
            "id",
            "items",
            "subtotal",
            "discount_amount",
            "total",
            "count",
            "coupon",
        ]


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
            "coupon_code",
            "discount_amount",
            "total_amount",
            "created_at",
            "items",
        ]
        read_only_fields = fields


class PublicOrderSerializer(serializers.ModelSerializer):
    """One order, as shown on the tokenless public page linked from the SMS.

    Anyone holding the link can read this, so it deliberately omits the token
    itself and anything about the account behind the order. The delivery
    details it does expose are what the recipient already knows — they are on
    the parcel — and are what makes the page useful for checking an address
    before dispatch.
    """

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
            "province",
            "city",
            "postal_code",
            "address",
            "coupon_code",
            "discount_amount",
            "total_amount",
            "created_at",
            "items",
        ]
        read_only_fields = fields


class AllowedLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedLocation
        fields = ["id", "province", "city"]
