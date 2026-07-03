from django.contrib import admin

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


class MattressImageInline(admin.TabularInline):
    model = MattressImage
    extra = 1


class MattressSizeInline(admin.TabularInline):
    model = MattressSize
    extra = 1


class MattressSpecificationInline(admin.TabularInline):
    model = MattressSpecification
    extra = 1


class MattressFeatureInline(admin.TabularInline):
    model = MattressFeature
    extra = 1


class MattressFAQInline(admin.StackedInline):
    model = MattressFAQ
    extra = 1


class MattressProConInline(admin.TabularInline):
    model = MattressProCon
    extra = 1


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "phone_number", "postal_code", "user")
    search_fields = ("first_name", "last_name", "phone_number", "postal_code", "user__username")
    raw_id_fields = ("user",)


@admin.register(Mattress)
class MattressAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "slug", "price", "is_available", "average_rating", "review_count")
    list_filter = ("is_available", "brand")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "slug", "brand")
    inlines = [
        MattressImageInline,
        MattressSizeInline,
        MattressSpecificationInline,
        MattressFeatureInline,
        MattressFAQInline,
        MattressProConInline,
    ]


@admin.register(MattressInstance)
class MattressInstanceAdmin(admin.ModelAdmin):
    list_display = (
        "serial_number",
        "mattress",
        "customer",
        "is_warranty_active",
        "activation_date",
        "manufacture_date",
    )
    list_filter = ("is_warranty_active", "mattress")
    search_fields = ("serial_number", "customer__first_name", "customer__last_name")
    raw_id_fields = ("customer",)
    readonly_fields = (
        "warranty_expiration_date",
        "warranty_remaining_days",
        "is_under_warranty",
    )


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("mattress", "customer", "rating", "title", "is_approved", "created_at")
    list_filter = ("is_approved", "rating", "mattress")
    search_fields = ("title", "body", "customer__first_name", "customer__last_name")
    actions = ["approve_reviews"]

    @admin.action(description="Approve selected reviews")
    def approve_reviews(self, request, queryset):
        queryset.update(is_approved=True)
        for review in queryset:
            review.mattress.update_rating_cache()
