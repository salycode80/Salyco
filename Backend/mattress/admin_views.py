from __future__ import annotations

import csv
import logging

from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Customer
from users.notifications import send_warranty_activated_sms

from .admin_serializers import (
    AdminCustomerSerializer,
    AdminInstanceDetailSerializer,
    AdminInstanceSerializer,
    AdminInstanceUpdateSerializer,
    AdminReviewSerializer,
    AdminWarrantyRequestSerializer,
    WarrantyReviewActionSerializer,
)
from .models import MattressInstance, Review
from .permissions import IsAdminUser
from .utils import format_jalali

logger = logging.getLogger(__name__)


# ── shared query helpers ─────────────────────────────────────────────────────

# Whitelist of sortable columns. Mapping the public param to real field names
# keeps arbitrary ORM paths out of order_by(), and lets a single choice expand
# to a tie-breaker so equal values come back in a stable order.
INSTANCE_ORDERING = {
    "newest": ["-created_at", "serial_number"],
    "oldest": ["created_at", "serial_number"],
    "manufacture_desc": ["-manufacture_date", "-created_at"],
    "manufacture_asc": ["manufacture_date", "created_at"],
    "activation_desc": ["-activation_date", "-created_at"],
    "activation_asc": ["activation_date", "created_at"],
    "serial_asc": ["serial_number"],
    "serial_desc": ["-serial_number"],
}

DEFAULT_INSTANCE_ORDERING = "newest"


def apply_ordering(qs, requested: str | None, allowed: dict, default: str):
    """Order `qs` by a whitelisted key, falling back to `default`."""
    return qs.order_by(*allowed.get(requested or default, allowed[default]))


def filter_instances(request):
    """Build a filtered MattressInstance queryset from query params.

    Params:
      search   – matches serial number, customer name, or phone
      sold     – "true" | "false"     (has a customer or not)
      warranty – "active" | "inactive" | "pending" | "rejected"
      mattress – mattress id
      ordering – one of INSTANCE_ORDERING (default: newest first)
    """
    qs = MattressInstance.objects.select_related("mattress", "customer")

    search = (request.query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(serial_number__icontains=search)
            | Q(buyer_first_name__icontains=search)
            | Q(buyer_last_name__icontains=search)
            | Q(buyer_phone_number__icontains=search)
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
        qs = qs.filter(warranty_status=MattressInstance.APPROVED)
    elif warranty == "inactive":
        qs = qs.exclude(warranty_status=MattressInstance.APPROVED)
    elif warranty == "pending":
        qs = qs.filter(warranty_status=MattressInstance.PENDING)
    elif warranty == "rejected":
        qs = qs.filter(warranty_status=MattressInstance.REJECTED)

    mattress_id = request.query_params.get("mattress")
    if mattress_id:
        qs = qs.filter(mattress_id=mattress_id)

    return apply_ordering(
        qs,
        request.query_params.get("ordering"),
        INSTANCE_ORDERING,
        DEFAULT_INSTANCE_ORDERING,
    )


def filter_customers(request):
    qs = Customer.objects.select_related("user").annotate(
        total_products=Count("mattress_instances", distinct=True),
        active_warranties=Count(
            "mattress_instances",
            filter=Q(mattress_instances__warranty_status=MattressInstance.APPROVED),
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
        active = instances.filter(warranty_status=MattressInstance.APPROVED).count()
        pending = instances.filter(warranty_status=MattressInstance.PENDING).count()

        today = timezone.localdate()
        active_qs = instances.filter(
            warranty_status=MattressInstance.APPROVED,
            activation_date__isnull=False,
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
                "pending_warranties": pending,
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


class AdminInstanceDetailView(generics.RetrieveUpdateAPIView):
    """Read one instance, or PATCH it to point at a different product model.

    PATCH exists so a serial printed against the wrong model can be corrected
    after the fact — the QR sticker stays valid and starts resolving to the new
    product. Writes go through a narrow serializer (mattress only); the response
    is the full detail payload so the panel can show the recalculated warranty
    months and expiry without a second request.
    """

    permission_classes = [IsAdminUser]
    lookup_field = "serial_number"
    queryset = MattressInstance.objects.select_related("mattress", "customer")
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return AdminInstanceUpdateSerializer
        return AdminInstanceDetailSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()
        return Response(
            AdminInstanceDetailSerializer(
                instance, context=self.get_serializer_context()
            ).data
        )


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
                "Warranty Status",
                "Activation Date",
                "Manufacture Date",
                "Created At",
                "Expiration Date",
                "Under Warranty",
            ]
        )
        for i in qs:
            writer.writerow(
                [
                    i.serial_number,
                    i.mattress.name,
                    i.buyer_full_name,
                    i.buyer_phone_number
                    or (i.customer.phone_number if i.customer_id else ""),
                    "Yes" if i.customer_id else "No",
                    i.get_warranty_status_display(),
                    i.activation_date or "",
                    i.manufacture_date or "",
                    timezone.localtime(i.created_at).strftime("%Y-%m-%d %H:%M:%S")
                    if i.created_at
                    else "",
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


class AdminReviewListView(generics.ListAPIView):
    """List all reviews for moderation. Filter by `is_approved` query param."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminReviewSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Review.objects.select_related("mattress", "customer").order_by("-created_at")

        # Filter by approval status
        is_approved = self.request.query_params.get("is_approved")
        if is_approved == "true":
            qs = qs.filter(is_approved=True)
        elif is_approved == "false":
            qs = qs.filter(is_approved=False)

        # Search across title, body, customer name
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(body__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
            )

        return qs


class AdminReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve/update/delete a single review. PATCH to approve (set is_approved=True),
    DELETE to reject and remove. Both operations refresh the mattress rating cache."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminReviewSerializer
    queryset = Review.objects.select_related("mattress", "customer")

    # The parent mattress's cached rating is refreshed by the Review
    # post_save/post_delete signals (mattress/models.py), so approving or
    # deleting here needs no extra bookkeeping.


class AdminWarrantyRequestListView(generics.ListAPIView):
    """The warranty review queue: every instance a customer has claimed."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminWarrantyRequestSerializer
    pagination_class = None

    def get_queryset(self):
        qs = MattressInstance.objects.select_related(
            "mattress", "customer", "warranty_reviewed_by"
        ).exclude(warranty_status=MattressInstance.UNREGISTERED)

        requested = (self.request.query_params.get("status") or "").strip()
        valid = {value for value, _label in MattressInstance.WARRANTY_STATUS_CHOICES}
        if requested in valid:
            qs = qs.filter(warranty_status=requested)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(serial_number__icontains=search)
                | Q(buyer_first_name__icontains=search)
                | Q(buyer_last_name__icontains=search)
                | Q(buyer_phone_number__icontains=search)
            )

        # Oldest first. Every other admin list here is newest-first, but a
        # newest-first review queue starves the oldest request — the one a
        # customer has already been waiting on longest.
        return qs.order_by("warranty_submitted_at", "serial_number")


class AdminWarrantyRequestDetailView(generics.RetrieveUpdateAPIView):
    """PATCH {"action": "approve"} or {"action": "reject", "rejection_reason": ...}."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminWarrantyRequestSerializer
    lookup_field = "serial_number"
    queryset = MattressInstance.objects.select_related(
        "mattress", "customer", "warranty_reviewed_by"
    )
    http_method_names = ["get", "patch", "head", "options"]

    def update(self, request, *args, **kwargs):
        action = WarrantyReviewActionSerializer(data=request.data)
        action.is_valid(raise_exception=True)
        decision = action.validated_data
        approved = decision["action"] == WarrantyReviewActionSerializer.APPROVE

        # Lock the row and re-check inside the transaction: two admins clicking
        # approve at the same moment, or a customer resubmitting mid-review,
        # would otherwise both pass the status check and double-send the SMS.
        # get_object_or_404, not a bare .get(): DoesNotExist does not reach DRF's
        # exception handler, so a bare .get() answers an unknown serial with a
        # 500. GET on this same view already 404s via DRF's get_object(), and the
        # two verbs must not disagree.
        with transaction.atomic():
            instance = get_object_or_404(
                MattressInstance.objects.select_for_update().select_related(
                    "mattress", "customer"
                ),
                serial_number=self.kwargs["serial_number"],
            )
            if instance.warranty_status != MattressInstance.PENDING:
                raise ValidationError({"detail": "این درخواست قبلاً بررسی شده است."})

            instance.warranty_status = (
                MattressInstance.APPROVED if approved else MattressInstance.REJECTED
            )
            instance.warranty_rejection_reason = (
                "" if approved else decision["rejection_reason"].strip()
            )
            instance.warranty_reviewed_at = timezone.now()
            instance.warranty_reviewed_by = request.user
            instance.save(
                update_fields=[
                    "warranty_status",
                    "warranty_rejection_reason",
                    "warranty_reviewed_at",
                    "warranty_reviewed_by",
                ]
            )

        if approved:
            # Best-effort, and outside the transaction: the approval is
            # committed by now, so a gateway failure must not roll it back or
            # surface as a 500. Prefer the phone recorded for this sale over
            # the account's — a dealer may have registered for the customer.
            try:
                send_warranty_activated_sms(
                    phone_number=instance.buyer_phone_number
                    or (
                        instance.customer.phone_number
                        if instance.customer_id
                        else ""
                    ),
                    customer_name=instance.buyer_full_name,
                    activation_date=format_jalali(
                        instance.activation_date or timezone.localdate()
                    ),
                    product_name=instance.mattress.name,
                )
            except Exception:
                logger.exception(
                    "Warranty approval SMS failed for %s", instance.serial_number
                )

        instance.refresh_from_db()
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)
