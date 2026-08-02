from __future__ import annotations

from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Customer

from .models import AllowedLocation, Cart, CartItem, Order, OrderItem
from .notifications import send_order_confirmation
from .serializers import (
    AddCartItemSerializer,
    AllowedLocationSerializer,
    CartSerializer,
    MergeCartSerializer,
    OrderSerializer,
    PublicOrderSerializer,
)


def _get_customer(user) -> Customer:
    """Resolve (or create) the Customer for the logged-in account, mirroring the
    get_or_create pattern used for reviews and warranty registration."""
    customer, _ = Customer.objects.get_or_create(
        user=user,
        defaults={
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "address": "",
            "phone_number": "",
            "postal_code": "",
        },
    )
    return customer


def _get_cart(user) -> Cart:
    cart, _ = Cart.objects.get_or_create(customer=_get_customer(user))
    return cart


def _location_error(province: str, city: str) -> str | None:
    """Business rule: orders are only accepted for admin-defined allowed areas.
    A blank-city allowed row covers the whole province. Returns a Persian error
    message when the area is not serviceable, otherwise None."""
    allowed = AllowedLocation.objects.filter(is_active=True, province=province)
    province_wide = allowed.filter(city="").exists()
    city_match = bool(city) and allowed.filter(city=city).exists()
    if province_wide or city_match:
        return None
    return "متأسفانه ارسال به این منطقه امکان‌پذیر نیست."


def _add_to_cart(cart: Cart, mattress, size, quantity: int) -> CartItem:
    """Add a line or bump its quantity if the (product, size) already exists."""
    item, created = CartItem.objects.get_or_create(
        cart=cart, mattress=mattress, size=size, defaults={"quantity": quantity}
    )
    if not created:
        item.quantity += quantity
        item.save(update_fields=["quantity"])
    return item


class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = _get_cart(request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AddCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = _get_cart(request.user)
        _add_to_cart(
            cart,
            serializer.validated_data["mattress"],
            serializer.validated_data["size"],
            serializer.validated_data["quantity"],
        )
        return Response(
            CartSerializer(cart, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CartItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_item(self, request, pk) -> CartItem | None:
        cart = _get_cart(request.user)
        return cart.items.filter(pk=pk).first()

    def patch(self, request, pk):
        item = self._get_item(request, pk)
        if item is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        quantity = request.data.get("quantity")
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return Response(
                {"detail": "تعداد نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST
            )
        if quantity < 1:
            item.delete()
        else:
            item.quantity = quantity
            item.save(update_fields=["quantity"])
        return Response(
            CartSerializer(item.cart, context={"request": request}).data
        )

    def delete(self, request, pk):
        item = self._get_item(request, pk)
        if item is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        cart = item.cart
        item.delete()
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartMergeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MergeCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = _get_cart(request.user)
        for entry in serializer.validated_data["items"]:
            _add_to_cart(cart, entry["mattress"], entry["size"], entry["quantity"])
        return Response(CartSerializer(cart, context={"request": request}).data)


class OrderCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        cart = _get_cart(request.user)
        items = list(cart.items.select_related("mattress", "size").all())
        if not items:
            return Response(
                {"detail": "سبد خرید شما خالی است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        method = request.data.get("method")
        if method not in (Order.ONLINE, Order.PHONE):
            return Response(
                {"detail": "روش سفارش نامعتبر است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer = cart.customer
        customer_phone = (request.data.get("customer_phone") or "").strip()
        call_time_preference = (request.data.get("call_time_preference") or "").strip()
        province = (request.data.get("province") or "").strip()
        city = (request.data.get("city") or "").strip()
        postal_code = (request.data.get("postal_code") or "").strip()
        address = (request.data.get("address") or "").strip()
        recipient_name = (request.data.get("recipient_name") or "").strip() or (
            f"{customer.first_name} {customer.last_name}".strip()
        )
        phone_number = (
            request.data.get("phone_number") or ""
        ).strip() or customer.phone_number

        # The checkout form collects the full delivery address before the order
        # method is picked, so both ONLINE and PHONE orders carry the same
        # required fields and go through the same allowed-area check.
        errors = {}
        for field, value, message in (
            ("recipient_name", recipient_name, "نام تحویل‌گیرنده الزامی است."),
            ("phone_number", phone_number, "شماره تماس الزامی است."),
            ("province", province, "لطفاً استان را انتخاب کنید."),
            ("city", city, "لطفاً شهر را وارد کنید."),
            ("postal_code", postal_code, "کد پستی الزامی است."),
            ("address", address, "نشانی کامل الزامی است."),
        ):
            if not value:
                errors[field] = message
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        location_error = _location_error(province, city)
        if location_error:
            return Response(
                {"detail": location_error}, status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            order = Order.objects.create(
                customer=customer,
                method=method,
                # Phone orders are followed up by a sales call, so keep a
                # dedicated contact number even when it matches phone_number.
                customer_phone=(customer_phone or phone_number)
                if method == Order.PHONE
                else customer_phone,
                call_time_preference=call_time_preference,
                recipient_name=recipient_name,
                phone_number=phone_number,
                province=province,
                city=city,
                postal_code=postal_code,
                address=address,
                total_amount=cart.total,
            )
            OrderItem.objects.bulk_create(
                [
                    OrderItem(
                        order=order,
                        mattress=item.mattress,
                        mattress_name=item.mattress.name,
                        size_label=item.size.label if item.size_id else "",
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                    )
                    for item in items
                ]
            )
            # Clear the cart now that the order is recorded.
            cart.items.all().delete()

        # Tell the customer their order is in. Sent after the atomic block has
        # committed, so the order is durable before the SMS goes out and the
        # request is not made while a transaction is open. Best-effort: a dead
        # gateway must not fail an order that is already recorded — and if it
        # does fail here, confirming the order in the admin panel retries it.
        send_order_confirmation(order)

        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class OrderListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        customer = getattr(self.request.user, "customer", None)
        if customer is None:
            return Order.objects.none()
        return Order.objects.filter(customer=customer).prefetch_related("items")


class PublicOrderDetailView(generics.RetrieveAPIView):
    """GET /api/orders/public/<token>/ — the order behind an SMS link.

    Unauthenticated by design: the customer opens this from a text message on a
    phone that is usually not signed in, and requiring auth would put a login
    wall in front of their own confirmation. The token in the URL is the
    credential — 32 hex chars, unique per order, never exposed by any other
    endpoint — so it is looked up by that and nothing else.
    """

    permission_classes = [AllowAny]
    serializer_class = PublicOrderSerializer
    lookup_field = "public_token"
    lookup_url_kwarg = "token"
    queryset = Order.objects.prefetch_related("items")


class PublicOrderCancelView(APIView):
    """POST /api/orders/public/<token>/cancel — cancel via the SMS link.

    Same auth model as PublicOrderDetailView: the token in the URL is the
    credential, so this is deliberately unauthenticated. A customer who holds
    the link can cancel the order it names, with two guardrails:

      1. Only PENDING and CONFIRMED orders may be cancelled. Once SHIPPED, the
         parcel is in motion and the customer must contact support instead.
      2. An order that is already CANCELLED does nothing (idempotent).

    Returns the updated order on success, or 400 when the status does not
    permit cancellation.
    """

    permission_classes = [AllowAny]

    def post(self, request, token):
        try:
            order = Order.objects.prefetch_related("items").get(public_token=token)
        except Order.DoesNotExist:
            return Response(
                {"detail": "سفارش یافت نشد"}, status=status.HTTP_404_NOT_FOUND
            )

        if order.status == Order.CANCELLED:
            # Already cancelled, nothing to do. Return the current state rather
            # than an error, so retrying an already-cancelled link is harmless.
            return Response(PublicOrderSerializer(order).data)

        if order.status == Order.SHIPPED:
            return Response(
                {"detail": "سفارش ارسال شده قابل لغو نیست. لطفاً با پشتیبانی تماس بگیرید."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = Order.CANCELLED
        order.save(update_fields=["status"])
        return Response(PublicOrderSerializer(order).data)


class AllowedLocationPublicView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = AllowedLocationSerializer
    pagination_class = None
    queryset = AllowedLocation.objects.filter(is_active=True)
