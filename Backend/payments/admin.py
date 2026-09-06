from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Read-only by design. Every field here is either our own record of what we
    sent Zibal or Zibal's record of what happened; hand-editing any of it would
    make the row a fiction while leaving it indistinguishable from evidence.
    Statuses are changed by the callback and reconcile_payments, never by hand.
    """

    list_display = (
        "id",
        "order",
        "status",
        "amount_rial",
        "track_id",
        "zibal_result",
        "zibal_status",
        "ref_number",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("track_id", "ref_number", "order__id")
    readonly_fields = [f.name for f in Payment._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
