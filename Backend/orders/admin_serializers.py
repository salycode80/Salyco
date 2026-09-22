from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from rest_framework import serializers

from .models import AllowedLocation, Coupon, CouponProduct, CouponRedemption, Order
from .promotions import coupon_status, redeemed_count
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
        read_only_fields = [f for f in fields if f != "status"]

    def get_customer_name(self, obj: Order) -> str:
        c = obj.customer
        return f"{c.first_name} {c.last_name}".strip() or "کاربر"


class AdminAllowedLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedLocation
        fields = ["id", "province", "city", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class CouponProductSerializer(serializers.ModelSerializer):
    """Read side of the product scope. Carries the name so the panel can show
    «۳ محصول» without a second lookup per row."""

    mattress_id = serializers.IntegerField(read_only=True)
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)

    class Meta:
        model = CouponProduct
        fields = ["mattress_id", "mattress_name"]


class AdminCouponSerializer(serializers.ModelSerializer):
    """Coupon row for the admin panel.

    `product_ids` is the write side of the CouponProduct through-table: a plain
    list of ids, replaced wholesale on every save. `products` is the read side.
    They are separate names on purpose — a single writable `product_ids` field
    would have no attribute on the model to read back, so DRF would blow up on
    serializing an instance that never had one set this request.
    """

    product_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    products = CouponProductSerializer(many=True, read_only=True)

    status = serializers.SerializerMethodField()
    redeemed_count = serializers.SerializerMethodField()
    remaining_uses = serializers.SerializerMethodField()
    total_discount_given = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "description",
            "discount_type",
            "percent",
            "amount",
            "max_discount_amount",
            "min_order_amount",
            "starts_at",
            "expires_at",
            "usage_limit",
            "per_customer_limit",
            "applies_to_all_products",
            "is_active",
            "created_at",
            "product_ids",
            "products",
            "status",
            "redeemed_count",
            "remaining_uses",
            "total_discount_given",
        ]
        read_only_fields = ["id", "created_at", "products"]

    # ── computed ──

    def get_status(self, obj: Coupon) -> str:
        return coupon_status(obj)

    def get_redeemed_count(self, obj: Coupon) -> int:
        return redeemed_count(obj)

    def get_remaining_uses(self, obj: Coupon):
        if obj.usage_limit is None:
            return None
        return max(obj.usage_limit - redeemed_count(obj), 0)

    def get_total_discount_given(self, obj: Coupon) -> str:
        total = CouponRedemption.objects.filter(coupon=obj).aggregate(
            total=Sum("amount")
        )["total"]
        return str(total if total is not None else Decimal("0"))

    # ── validation ──

    def validate(self, attrs):
        """Mirror Coupon.clean(), plus the scope rule clean() cannot reach.

        DRF never calls a model's clean(), so the cross-field rules are run here
        by hand against the merged object — a PATCH carries only the keys it
        changes, so validating the fragment alone would pass a coupon whose
        combined state is invalid.
        """
        instance = self.instance or Coupon()
        for key, value in attrs.items():
            setattr(instance, key, value)

        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", None) or {"detail": exc.messages}
            )

        product_ids = attrs.get("product_ids")
        if product_ids is None and self.instance is not None:
            product_ids = list(
                self.instance.products.values_list("mattress_id", flat=True)
            )
        if not instance.applies_to_all_products and not product_ids:
            raise serializers.ValidationError(
                {"product_ids": "حداقل یک محصول را انتخاب کنید."}
            )

        return attrs

    # ── writes ──

    def create(self, validated_data):
        product_ids = validated_data.pop("product_ids", [])
        coupon = Coupon.objects.create(**validated_data)
        self._set_products(coupon, product_ids)
        return coupon

    def update(self, instance, validated_data):
        product_ids = validated_data.pop("product_ids", None)
        coupon = super().update(instance, validated_data)
        if product_ids is not None:
            self._set_products(coupon, product_ids)
        return coupon

    @staticmethod
    def _set_products(coupon: Coupon, product_ids: list[int]) -> None:
        """Replace the scope wholesale. dedupe via set() because the panel's
        multi-select can hand back the same id twice."""
        CouponProduct.objects.filter(coupon=coupon).delete()
        CouponProduct.objects.bulk_create(
            [CouponProduct(coupon=coupon, mattress_id=pid) for pid in set(product_ids)]
        )


class AdminCouponRedemptionSerializer(serializers.ModelSerializer):
    """One use of a coupon, for the panel's expandable row."""

    order_id = serializers.IntegerField(read_only=True)
    customer_name = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()

    class Meta:
        model = CouponRedemption
        fields = [
            "id",
            "order_id",
            "customer_name",
            "phone_number",
            "amount",
            "created_at",
        ]

    def get_customer_name(self, obj: CouponRedemption) -> str:
        c = obj.customer
        return f"{c.first_name} {c.last_name}".strip() or "کاربر"

    def get_phone_number(self, obj: CouponRedemption) -> str:
        # The order's snapshot first — that is the number the parcel went to.
        return obj.order.phone_number or obj.customer.phone_number
