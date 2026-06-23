from __future__ import annotations

from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Mattress, MattressInstance
from .serializers import (
    MattressInstanceSerializer,
    MattressSerializer,
    WarrantyCheckSerializer,
    WarrantyRegistrationSerializer,
)


class MattressViewSet(viewsets.ModelViewSet):
    queryset = Mattress.objects.all()
    serializer_class = MattressSerializer
    lookup_field = "slug"

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]


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
