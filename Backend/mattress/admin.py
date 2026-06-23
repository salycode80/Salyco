from django.contrib import admin

from .models import Customer, Mattress, MattressInstance


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "phone_number", "postal_code", "user")
    search_fields = ("first_name", "last_name", "phone_number", "postal_code", "user__username")
    raw_id_fields = ("user",)


@admin.register(Mattress)
class MattressAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "warranty_months", "price")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "slug")


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
