from __future__ import annotations

from rest_framework import serializers

from users.models import Customer

from .models import MattressInstance, Review
from .utils import generate_qr_code_base64, get_warranty_public_url


class AdminInstanceSerializer(serializers.ModelSerializer):
    """Compact row for the CRM instance table."""

    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    mattress_id = serializers.IntegerField(source="mattress.id", read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    is_sold = serializers.SerializerMethodField()
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)
    is_warranty_active = serializers.BooleanField(read_only=True)

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
            "warranty_status",
            "warranty_rejection_reason",
            "activation_date",
            "manufacture_date",
            "created_at",
            "warranty_expiration_date",
            "warranty_remaining_days",
            "is_under_warranty",
        ]

    def get_is_sold(self, obj: MattressInstance) -> bool:
        return obj.customer_id is not None

    def get_customer_name(self, obj: MattressInstance) -> str:
        # The buyer of this specific sale — read from the per-instance snapshot.
        return obj.buyer_full_name

    def get_customer_phone(self, obj: MattressInstance) -> str:
        if obj.buyer_phone_number:
            return obj.buyer_phone_number
        return obj.customer.phone_number if obj.customer_id is not None else ""


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
        # Show the buyer recorded for THIS sale (the per-instance snapshot),
        # not the mutable shared account profile. Fall back to the linked
        # Customer for legacy rows registered before the snapshot existed.
        if obj.customer_id is None and not obj.buyer_full_name:
            return None
        c = obj.customer
        return {
            "id": obj.customer_id,
            "first_name": obj.buyer_first_name or (c.first_name if c else ""),
            "last_name": obj.buyer_last_name or (c.last_name if c else ""),
            "phone_number": obj.buyer_phone_number or (c.phone_number if c else ""),
            "address": obj.buyer_address or (c.address if c else ""),
            "postal_code": obj.buyer_postal_code or (c.postal_code if c else ""),
        }

    def get_warranty_url(self, obj: MattressInstance) -> str:
        return get_warranty_public_url(obj.serial_number, self.context.get("request"))

    def get_qr_code(self, obj: MattressInstance) -> str:
        return generate_qr_code_base64(
            get_warranty_public_url(obj.serial_number, self.context.get("request"))
        )


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


class AdminReviewSerializer(serializers.ModelSerializer):
    """Review row for the moderation panel. Only `is_approved` is writable so a
    staff member can approve a pending review; everything else is read-only."""

    customer_name = serializers.SerializerMethodField()
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    mattress_slug = serializers.CharField(source="mattress.slug", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "mattress_name",
            "mattress_slug",
            "customer_name",
            "rating",
            "title",
            "body",
            "pros",
            "cons",
            "is_approved",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "mattress_name",
            "mattress_slug",
            "customer_name",
            "rating",
            "title",
            "body",
            "pros",
            "cons",
            "created_at",
        ]

    def get_customer_name(self, obj: Review) -> str:
        return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or "کاربر"


class AdminWarrantyRequestSerializer(AdminInstanceSerializer):
    """A row in the warranty review queue.

    Carries the full buyer snapshot and the product photo, because approving is
    a verification decision: the reviewer compares what the customer submitted
    against the product the serial actually belongs to.
    """

    warranty_months = serializers.IntegerField(
        source="mattress.warranty_months", read_only=True
    )
    mattress_image = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta(AdminInstanceSerializer.Meta):
        fields = AdminInstanceSerializer.Meta.fields + [
            "warranty_months",
            "mattress_image",
            "warranty_submitted_at",
            "warranty_reviewed_at",
            "reviewed_by_name",
            "buyer_address",
            "buyer_postal_code",
        ]

    def get_mattress_image(self, obj: MattressInstance) -> str | None:
        image = obj.mattress.image
        if not image:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(image.url)
        return image.url

    def get_reviewed_by_name(self, obj: MattressInstance) -> str:
        reviewer = obj.warranty_reviewed_by
        if reviewer is None:
            return ""
        full_name = f"{reviewer.first_name} {reviewer.last_name}".strip()
        return full_name or reviewer.get_username()


class WarrantyReviewActionSerializer(serializers.Serializer):
    """Applies an approve/reject decision to a pending warranty request.

    An explicit `action` rather than a writable `warranty_status`, so the API
    cannot be used to drive an illegal transition — APPROVED back to PENDING,
    for instance.
    """

    APPROVE = "approve"
    REJECT = "reject"

    action = serializers.ChoiceField(choices=[APPROVE, REJECT])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs: dict) -> dict:
        if attrs["action"] == self.REJECT and not (
            attrs.get("rejection_reason") or ""
        ).strip():
            raise serializers.ValidationError(
                {"rejection_reason": "دلیل رد درخواست الزامی است."}
            )
        return attrs
