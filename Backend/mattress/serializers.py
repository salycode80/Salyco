from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Customer,
    Mattress,
    MattressFAQ,
    MattressFeature,
    MattressImage,
    MattressInstance,
    MattressProCon,
    MattressSize,
    MattressSpecification,
    Review,
)
from .utils import generate_qr_code_base64, generate_serial_number, get_warranty_public_url

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
            "brand",
            "subtitle",
            "description",
            "slug",
            "warranty_months",
            "price",
            "width",
            "length",
            "height",
            "image",
            "is_available",
            "average_rating",
            "review_count",
        ]


class MattressImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MattressImage
        fields = ["id", "image", "alt_text", "is_primary", "display_order"]


class MattressSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MattressSize
        fields = ["id", "label", "width", "length", "price", "in_stock"]


class MattressSpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MattressSpecification
        fields = ["id", "key", "value", "display_order"]


class MattressFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = MattressFeature
        fields = ["id", "title", "icon_name", "display_order"]


class MattressFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = MattressFAQ
        fields = ["id", "question", "answer", "display_order"]


class MattressProConSerializer(serializers.ModelSerializer):
    class Meta:
        model = MattressProCon
        fields = ["id", "text", "type", "display_order"]


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "customer_name", "rating", "title", "body", "pros", "cons", "created_at"]

    def get_customer_name(self, obj):
        return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or "کاربر"


class ReviewCreateSerializer(serializers.ModelSerializer):
    """Public review submission. The mattress and customer are supplied by the
    view; every new review starts unapproved and is hidden until a staff member
    approves it in the moderation panel."""

    class Meta:
        model = Review
        fields = ["id", "rating", "title", "body", "pros", "cons"]
        read_only_fields = ["id"]

    def validate_rating(self, value: int) -> int:
        if value < 1 or value > 5:
            raise serializers.ValidationError("امتیاز باید بین ۱ تا ۵ باشد.")
        return value

    def save(self, **kwargs) -> Review:
        user = self.context["request"].user

        # Reuse the account's Customer profile, creating a minimal one from the
        # user record when it doesn't exist yet (e.g. the buyer never registered
        # a warranty). We never overwrite an existing profile here.
        customer, _created = Customer.objects.get_or_create(
            user=user,
            defaults={
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "address": "",
                "phone_number": "",
                "postal_code": "",
            },
        )
        return super().save(customer=customer, is_approved=False, **kwargs)


class MattressDetailSerializer(serializers.ModelSerializer):
    images = MattressImageSerializer(many=True, read_only=True)
    sizes = MattressSizeSerializer(many=True, read_only=True)
    specifications = MattressSpecificationSerializer(many=True, read_only=True)
    features = MattressFeatureSerializer(many=True, read_only=True)
    faqs = MattressFAQSerializer(many=True, read_only=True)
    pros_cons = MattressProConSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()

    class Meta:
        model = Mattress
        fields = [
            "id",
            "name",
            "brand",
            "subtitle",
            "description",
            "long_description",
            "slug",
            "warranty_months",
            "price",
            "width",
            "length",
            "height",
            "image",
            "is_available",
            "average_rating",
            "review_count",
            "images",
            "sizes",
            "specifications",
            "features",
            "faqs",
            "pros_cons",
            "reviews",
        ]

    def get_reviews(self, obj):
        approved = obj.reviews.filter(is_approved=True)
        return ReviewSerializer(approved, many=True).data


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

        # Link the instance to the registering account's Customer profile (so it
        # shows up under "My Warranties"). We only ever create this profile or
        # fill blank fields on it — we never overwrite existing profile data,
        # because a single account may register several instances for different
        # buyers and that shared row must not be clobbered.
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
            # Backfill only fields that are still empty on the profile; leave
            # already-set values untouched.
            changed = []
            for field in ("first_name", "last_name", "address", "phone_number", "postal_code"):
                value = self.validated_data.get(field)
                if value and not getattr(customer, field):
                    setattr(customer, field, value)
                    changed.append(field)
            if changed:
                customer.save(update_fields=changed)

        # Record the buyer for THIS sale on the instance itself. Falling back to
        # the account/profile values when a field wasn't provided in the form.
        instance.customer = customer
        instance.buyer_first_name = self.validated_data.get("first_name", "") or customer.first_name
        instance.buyer_last_name = self.validated_data.get("last_name", "") or customer.last_name
        instance.buyer_phone_number = self.validated_data.get("phone_number", "") or customer.phone_number
        instance.buyer_address = self.validated_data.get("address", "") or customer.address
        instance.buyer_postal_code = self.validated_data.get("postal_code", "") or customer.postal_code
        instance.activation_date = timezone.localdate()
        instance.is_warranty_active = True
        instance.save(
            update_fields=[
                "customer",
                "buyer_first_name",
                "buyer_last_name",
                "buyer_phone_number",
                "buyer_address",
                "buyer_postal_code",
                "activation_date",
                "is_warranty_active",
            ]
        )
        return instance


class WarrantyCheckSerializer(serializers.ModelSerializer):
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    warranty_months = serializers.IntegerField(source="mattress.warranty_months", read_only=True)
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)

    class Meta:
        model = MattressInstance
        fields = [
            "serial_number",
            "mattress_name",
            "warranty_months",
            "is_warranty_active",
            "activation_date",
            "warranty_expiration_date",
            "warranty_remaining_days",
            "is_under_warranty",
        ]


class MattressInstanceCreateSerializer(serializers.ModelSerializer):
    mattress_id = serializers.PrimaryKeyRelatedField(
        queryset=Mattress.objects.all(),
        source="mattress",
        write_only=True,
    )
    serial_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    warranty_url = serializers.SerializerMethodField(read_only=True)
    qr_code = serializers.SerializerMethodField(read_only=True)
    mattress = MattressSerializer(read_only=True)

    class Meta:
        model = MattressInstance
        fields = [
            "serial_number",
            "mattress_id",
            "mattress",
            "manufacture_date",
            "warranty_url",
            "qr_code",
        ]
        read_only_fields = ["serial_number", "mattress", "warranty_url", "qr_code"]

    def validate_serial_number(self, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            return normalized
        if MattressInstance.objects.filter(serial_number=normalized).exists():
            raise serializers.ValidationError("This serial number already exists.")
        return normalized

    def create(self, validated_data) -> MattressInstance:
        serial_number = validated_data.get("serial_number", "").strip()
        if not serial_number:
            serial_number = generate_serial_number()
            while MattressInstance.objects.filter(serial_number=serial_number).exists():
                serial_number = generate_serial_number()
            validated_data["serial_number"] = serial_number
        else:
            validated_data["serial_number"] = serial_number

        return super().create(validated_data)

    def get_warranty_url(self, obj: MattressInstance) -> str:
        return get_warranty_public_url(obj.serial_number, self.context.get("request"))

    def get_qr_code(self, obj: MattressInstance) -> str:
        return generate_qr_code_base64(
            get_warranty_public_url(obj.serial_number, self.context.get("request"))
        )
