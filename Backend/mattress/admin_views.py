from __future__ import annotations

import csv

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Customer

from .admin_serializers import (
    AdminCustomerSerializer,
    AdminInstanceDetailSerializer,
    AdminInstanceSerializer,
)
from .models import MattressInstance
from .permissions import IsAdminUser


# ── shared query helpers ─────────────────────────────────────────────────────

def filter_instances(request):
    """Build a filtered MattressInstance queryset from query params.

    Params:
      search   – matches serial number, customer name, or phone
      sold     – "true" | "false"     (has a customer or not)
      warranty – "active" | "inactive"
      mattress – mattress id
    """
    qs = MattressInstance.objects.select_related("mattress", "customer")

    search = (request.query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(serial_number__icontains=search)
            | Q(customer__first_name__icontains=search)
            | Q(customer__last_name__icontains=search)
            | Q(customer__phone_number__icontains=search)
        )

    sold = request.query_params.get("sold")
    if sold == "true":
        qs = qs.filter(customer__isnull=False)
    elif sold == "false":
        qs = qs.filter(customer__isnull=True)

    warranty = request.query_params.get("warranty")
    if warranty == "active":
        qs = qs.filter(is_warranty_active=True)
    elif warranty == "inactive":
        qs = qs.filter(is_warranty_active=False)

    mattress_id = request.query_params.get("mattress")
    if mattress_id:
        qs = qs.filter(mattress_id=mattress_id)

    return qs


def filter_customers(request):
    qs = Customer.objects.select_related("user").annotate(
        total_products=Count("mattress_instances", distinct=True),
        active_warranties=Count(
            "mattress_instances",
            filter=Q(mattress_instances__is_warranty_active=True),
            distinct=True,
        ),
    )
    search = (request.query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(phone_number__icontains=search)
            | Q(postal_code__icontains=search)
        )
    return qs


# ── endpoints ────────────────────────────────────────────────────────────────

class AdminStatsView(APIView):
    """Headline numbers for the dashboard cards."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        instances = MattressInstance.objects.all()
        total = instances.count()
        sold = instances.filter(customer__isnull=False).count()
        active = instances.filter(is_warranty_active=True).count()

        today = timezone.localdate()
        active_qs = instances.filter(
            is_warranty_active=True, activation_date__isnull=False
        ).select_related("mattress")
        under_warranty = sum(1 for i in active_qs if i.is_under_warranty)
        expired = active - under_warranty

        by_mattress = list(
            instances.values("mattress__id", "mattress__name")
            .annotate(
                count=Count("serial_number"),
                sold=Count("serial_number", filter=Q(customer__isnull=False)),
            )
            .order_by("-count")
        )

        return Response(
            {
                "total_instances": total,
                "sold_instances": sold,
                "in_stock_instances": total - sold,
                "active_warranties": active,
                "under_warranty": under_warranty,
                "expired_warranties": expired,
                "total_customers": Customer.objects.count(),
                "by_mattress": [
                    {
                        "mattress_id": row["mattress__id"],
                        "mattress_name": row["mattress__name"],
                        "count": row["count"],
                        "sold": row["sold"],
                    }
                    for row in by_mattress
                ],
            }
        )


class AdminInstanceListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminInstanceSerializer
    pagination_class = None

    def get_queryset(self):
        return filter_instances(self.request)


class AdminInstanceDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminInstanceDetailSerializer
    lookup_field = "serial_number"
    queryset = MattressInstance.objects.select_related("mattress", "customer")


class AdminCustomerListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminCustomerSerializer
    pagination_class = None

    def get_queryset(self):
        return filter_customers(self.request)


class AdminInstanceExportView(APIView):
    """Download the (filtered) instance list as CSV."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = filter_instances(request)
        response = HttpResponse(content_type="text/csv; charset=utf-8-sig")
        response["Content-Disposition"] = 'attachment; filename="instances.csv"'
        response.write("﻿")  # BOM so Excel reads UTF-8 (Persian) correctly

        writer = csv.writer(response)
        writer.writerow(
            [
                "Serial Number",
                "Mattress",
                "Customer",
                "Phone",
                "Sold",
                "Warranty Active",
                "Activation Date",
                "Manufacture Date",
                "Expiration Date",
                "Under Warranty",
            ]
        )
        for i in qs:
            customer_name = (
                f"{i.customer.first_name} {i.customer.last_name}".strip()
                if i.customer_id
                else ""
            )
            writer.writerow(
                [
                    i.serial_number,
                    i.mattress.name,
                    customer_name,
                    i.customer.phone_number if i.customer_id else "",
                    "Yes" if i.customer_id else "No",
                    "Yes" if i.is_warranty_active else "No",
                    i.activation_date or "",
                    i.manufacture_date or "",
                    i.warranty_expiration_date or "",
                    "Yes" if i.is_under_warranty else "No",
                ]
            )
        return response


class AdminCustomerExportView(APIView):
    """Download the (filtered) customer list as CSV."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = filter_customers(request)
        response = HttpResponse(content_type="text/csv; charset=utf-8-sig")
        response["Content-Disposition"] = 'attachment; filename="customers.csv"'
        response.write("﻿")

        writer = csv.writer(response)
        writer.writerow(
            [
                "Full Name",
                "Phone",
                "Postal Code",
                "Address",
                "Username",
                "Email",
                "Total Products",
                "Active Warranties",
            ]
        )
        for c in qs:
            writer.writerow(
                [
                    f"{c.first_name} {c.last_name}".strip(),
                    c.phone_number,
                    c.postal_code,
                    c.address,
                    getattr(c.user, "username", ""),
                    getattr(c.user, "email", ""),
                    c.total_products,
                    c.active_warranties,
                ]
            )
        return response
