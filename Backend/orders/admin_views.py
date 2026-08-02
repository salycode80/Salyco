from __future__ import annotations

from django.db.models import Q
from rest_framework import generics

from mattress.permissions import IsAdminUser
from mattress.admin_views import apply_ordering

from .admin_serializers import AdminAllowedLocationSerializer, AdminOrderSerializer
from .models import AllowedLocation, Order
from .notifications import send_order_confirmation

# Whitelisted sort options, same shape as the instance list. Every choice ends
# in a unique-ish tie-breaker so equal values don't shuffle between requests.
ORDER_ORDERING = {
    "newest": ["-created_at", "-id"],
    "oldest": ["created_at", "id"],
    "amount_desc": ["-total_amount", "-created_at"],
    "amount_asc": ["total_amount", "-created_at"],
    "status": ["status", "-created_at"],
    "recipient": ["recipient_name", "-created_at"],
}

DEFAULT_ORDER_ORDERING = "newest"


class AdminOrderListView(generics.ListAPIView):
    """List orders for fulfillment. Filter by `status`, `method`, `search`,
    sort with `ordering` (see ORDER_ORDERING)."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminOrderSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Order.objects.select_related("customer").prefetch_related("items")

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        method = self.request.query_params.get("method")
        if method:
            qs = qs.filter(method=method)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(recipient_name__icontains=search)
                | Q(phone_number__icontains=search)
                | Q(city__icontains=search)
                | Q(province__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
            )

        return apply_ordering(
            qs,
            self.request.query_params.get("ordering"),
            ORDER_ORDERING,
            DEFAULT_ORDER_ORDERING,
        )


class AdminOrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH to change status, DELETE to remove an order."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminOrderSerializer
    queryset = Order.objects.select_related("customer").prefetch_related("items")

    def perform_update(self, serializer):
        """Retry the order SMS if checkout's attempt never landed.

        The customer is normally notified at checkout, in OrderCreateView. This
        is the backstop for when that send failed — a gateway outage, say —
        since send_order_confirmation() latches on success and so does nothing
        here for the overwhelming majority of orders.
        """
        order = serializer.save()
        send_order_confirmation(order)


class AdminAllowedLocationListView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminAllowedLocationSerializer
    pagination_class = None
    queryset = AllowedLocation.objects.all()


class AdminAllowedLocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminAllowedLocationSerializer
    queryset = AllowedLocation.objects.all()
