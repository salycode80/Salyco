from django.contrib import admin

from .models import Suggestion


@admin.register(Suggestion)
class SuggestionAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "phone", "is_read", "created_at"]
    list_filter = ["is_read", "created_at"]
    search_fields = ["name", "email", "phone", "message"]
    list_editable = ["is_read"]
    readonly_fields = ["name", "email", "phone", "message", "created_at"]
