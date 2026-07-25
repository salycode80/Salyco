from django.contrib import admin
from .models import Banner


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ["title", "link", "order", "is_active", "created_at"]
    list_filter = ["is_active", "created_at"]
    list_editable = ["order", "is_active"]
    search_fields = ["title", "link"]
    ordering = ["order", "-created_at"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        (None, {
            "fields": ("title", "image", "link")
        }),
        ("تنظیمات", {
            "fields": ("order", "is_active")
        }),
        ("اطلاعات زمانی", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

