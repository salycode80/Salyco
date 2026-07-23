from __future__ import annotations

from django.http import HttpResponse
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Mattress, MattressInstance
from .permissions import IsAdminUser
from .serializers import (
    MattressDetailSerializer,
    MattressInstanceCreateSerializer,
    MattressInstanceSerializer,
    MattressSerializer,
    ReviewCreateSerializer,
    WarrantyCheckSerializer,
    WarrantyRegistrationSerializer,
)
from .utils import generate_qr_code_base64, get_warranty_public_url


class MattressViewSet(viewsets.ModelViewSet):
    queryset = Mattress.objects.all()
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MattressDetailSerializer
        if self.action == "reviews":
            return ReviewCreateSerializer
        return MattressSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "retrieve":
            qs = qs.prefetch_related(
                "images", "sizes", "specifications", "features",
                "faqs", "pros_cons", "reviews__customer",
            )
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "reviews":
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["post"], url_path="reviews")
    def reviews(self, request, slug=None):
        """Submit a review for this mattress. Saved unapproved and hidden from
        the public detail page until a staff member approves it."""
        mattress = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(mattress=mattress)
        return Response(
            {"detail": "نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود."},
            status=status.HTTP_201_CREATED,
        )


class MattressInstanceAdminViewSet(viewsets.ModelViewSet):
    queryset = MattressInstance.objects.select_related("mattress").all()
    permission_classes = [IsAdminUser]
    lookup_field = "serial_number"

    def get_serializer_class(self):
        if self.action in ("create", "list", "retrieve"):
            return MattressInstanceCreateSerializer
        return MattressInstanceSerializer

    http_method_names = ["get", "post", "head", "options"]


class MattressInstanceQRView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, serial_number: str):
        try:
            instance = MattressInstance.objects.get(serial_number=serial_number)
        except MattressInstance.DoesNotExist:
            return Response(
                {"detail": "Mattress instance not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        url = get_warranty_public_url(instance.serial_number, request)
        qr_data_url = generate_qr_code_base64(url)

        if request.query_params.get("format") == "json":
            return Response(
                {
                    "serial_number": instance.serial_number,
                    "warranty_url": url,
                    "qr_code": qr_data_url,
                }
            )

        _, encoded = qr_data_url.split(",", 1)
        import base64

        image_bytes = base64.b64decode(encoded)
        return HttpResponse(image_bytes, content_type="image/png")


class WarrantyRegistrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WarrantyRegistrationSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            MattressInstanceSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )


class WarrantyCheckView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = WarrantyCheckSerializer
    lookup_field = "serial_number"
    queryset = MattressInstance.objects.select_related("mattress")


class CustomerWarrantyListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MattressInstanceSerializer

    def get_queryset(self):
        customer = getattr(self.request.user, "customer", None)
        if customer is None:
            return MattressInstance.objects.none()
        return (
            MattressInstance.objects.filter(customer=customer, is_warranty_active=True)
            .select_related("mattress", "customer")
            .order_by("-activation_date")
        )
