from django.contrib import admin

from .models import PhoneOTP

# Register your models here.


@admin.register(PhoneOTP)
class PhoneOTPAdmin(admin.ModelAdmin):
    """Read-only view of issued codes — useful while OTP delivery is a stand-in."""

    list_display = ("phone_number", "code", "purpose", "created_at", "expires_at", "attempts", "is_used")
    list_filter = ("purpose", "is_used")
    search_fields = ("phone_number",)
    readonly_fields = ("phone_number", "code", "purpose", "created_at", "expires_at", "attempts", "is_used")

    def has_add_permission(self, request):
        # Codes are only ever issued by the register/resend endpoints, so that
        # the retire-previous-codes rule in PhoneOTP.issue() always holds.
        return False
