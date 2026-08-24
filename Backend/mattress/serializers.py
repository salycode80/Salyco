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
    discount_price = serializers.SerializerMethodField()
    is_on_off = serializers.BooleanField()
    off_percentage = serializers.IntegerField()
    # The frontend builds every product URL as /products/<category>/<slug>, so
    # `category` has to travel with each row in list responses too — cards, cart
    # lines, and search results all need it to link to the right page.
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    is_warranty_registrable = serializers.BooleanField(read_only=True)
    # The score to render. Equals average_rating once reviews exist, and the
    # unreviewed default (5.00) before that — see Mattress.rating. Clients should
    # read this and use review_count to decide whether to caption it.
    rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)

    class Meta:
        model = Mattress
        fields = [
            "id",
            "category",
            "category_label",
            "name",
            "brand",
            "subtitle",
            "description",
            "slug",
            "warranty_months",
            "is_warranty_registrable",
            "price",
            "discount_price",
            "width",
            "length",
            "height",
            "firmness",
            "material",
            "is_washable",
            "trial_nights",
            "image",
            "is_available",
            "rating",
            "average_rating",
            "review_count",
            "is_on_off",
            "off_percentage",
        ]

    def get_discount_price(self, obj):
        return obj.discount_price


class MattressImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MattressImage
        fields = ["id", "image", "alt_text", "is_primary", "display_order"]


class MattressSizeSerializer(serializers.ModelSerializer):
    # Null unless the parent mattress is on sale — same convention as the
    # mattress serializers, so the frontend can treat both the same way.
    discount_price = serializers.SerializerMethodField()

    class Meta:
        model = MattressSize
        fields = ["id", "label", "width", "length", "price", "discount_price", "in_stock"]

    def get_discount_price(self, obj):
        return obj.discount_price


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
    discount_price = serializers.SerializerMethodField()
    rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    is_warranty_registrable = serializers.BooleanField(read_only=True)

    class Meta:
        model = Mattress
        fields = [
            "id",
            "category",
            "category_label",
            "name",
            "brand",
            "subtitle",
            "description",
            "long_description",
            "slug",
            "warranty_months",
            "is_warranty_registrable",
            "price",
            "discount_price",
            "width",
            "length",
            "height",
            "firmness",
            "material",
            "is_washable",
            "trial_nights",
            "image",
            "is_available",
            "rating",
            "average_rating",
            "review_count",
            "is_on_off",
            "off_percentage",
            "images",
            "sizes",
            "specifications",
            "features",
            "faqs",
            "pros_cons",
            "reviews",
        ]

    def get_discount_price(self, obj):
        return obj.discount_price

    def get_reviews(self, obj):
        approved = obj.reviews.filter(is_approved=True)
        return ReviewSerializer(approved, many=True).data


class MattressInstanceSerializer(serializers.ModelSerializer):
    mattress = MattressSerializer(read_only=True)
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)
    is_warranty_active = serializers.BooleanField(read_only=True)

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
        if instance.warranty_status == MattressInstance.APPROVED:
            raise serializers.ValidationError(
                {"serial_number": "گارانتی این محصول قبلاً فعال شده است."}
            )
        if instance.warranty_status == MattressInstance.PENDING:
            raise serializers.ValidationError(
                {
                    "serial_number": (
                        "درخواست ثبت گارانتی این محصول قبلاً ارسال شده و "
                        "در انتظار تأیید است."
                    )
                }
            )
        # Pillows and duvets are not tracked per unit. An instance for one should
        # never exist (MattressInstanceCreateSerializer refuses to mint it), but
        # check here too so a row created before this rule — or straight from the
        # Django admin, which bypasses the API serializers — can't be activated.
        if not instance.mattress.is_warranty_registrable:
            raise serializers.ValidationError(
                {"serial_number": "برای این دسته از محصولات ثبت گارانتی انجام نمی‌شود."}
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
        # A resubmission after rejection must not carry the old verdict
        # forward — clear the review fields as well as setting PENDING.
        instance.warranty_status = MattressInstance.PENDING
        instance.warranty_submitted_at = timezone.now()
        instance.warranty_rejection_reason = ""
        instance.warranty_reviewed_at = None
        instance.warranty_reviewed_by = None
        instance.save(
            update_fields=[
                "customer",
                "buyer_first_name",
                "buyer_last_name",
                "buyer_phone_number",
                "buyer_address",
                "buyer_postal_code",
                "activation_date",
                "warranty_status",
                "warranty_submitted_at",
                "warranty_rejection_reason",
                "warranty_reviewed_at",
                "warranty_reviewed_by",
            ]
        )
        return instance


class WarrantyCheckSerializer(serializers.ModelSerializer):
    mattress_name = serializers.CharField(source="mattress.name", read_only=True)
    warranty_months = serializers.IntegerField(source="mattress.warranty_months", read_only=True)
    warranty_expiration_date = serializers.DateField(read_only=True)
    warranty_remaining_days = serializers.IntegerField(read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)
    is_warranty_active = serializers.BooleanField(read_only=True)

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

    def validate(self, attrs: dict) -> dict:
        # Only serial-numbered product lines get instances. Minting one for a
        # pillow would produce a QR code and a warranty page for a unit the
        # business does not track, so refuse it at the source.
        mattress = attrs.get("mattress")
        if mattress is not None and not mattress.is_warranty_registrable:
            raise serializers.ValidationError(
                {
                    "mattress_id": (
                        f"برای دسته «{mattress.get_category_display()}» "
                        "نمونه سریال‌دار ساخته نمی‌شود."
                    )
                }
            )
        return attrs

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
