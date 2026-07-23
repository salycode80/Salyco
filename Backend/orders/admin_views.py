from __future__ import annotations

from django.db.models import Q
from rest_framework import generics

from mattress.permissions import IsAdminUser

from .admin_serializers import AdminAllowedLocationSerializer, AdminOrderSerializer
from .models import AllowedLocation, Order


class AdminOrderListView(generics.ListAPIView):
    """List orders for fulfillment. Filter by `status`, `method`, `search`."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminOrderSerializer
    pagination_class = None

    def get_queryset(self):
        qs = (
            Order.objects.select_related("customer")
            .prefetch_related("items")
            .order_by("-created_at")
        )

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

        return qs


class AdminOrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH to change status, DELETE to remove an order."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminOrderSerializer
    queryset = Order.objects.select_related("customer").prefetch_related("items")


class AdminAllowedLocationListView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminAllowedLocationSerializer
    pagination_class = None
    queryset = AllowedLocation.objects.all()


class AdminAllowedLocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminAllowedLocationSerializer
    queryset = AllowedLocation.objects.all()
