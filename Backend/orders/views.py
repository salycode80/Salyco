from __future__ import annotations

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Customer

from .checkout import EMPTY_CART_MESSAGE
from .models import AllowedLocation, Cart, CartItem, Coupon, Order
from .promotions import COUPON_NOT_FOUND_MESSAGE, validate_coupon
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


class CartCouponView(APIView):
    """POST /api/cart/coupon/ — apply a code. DELETE — remove it.

    Both answer with the whole cart payload, because applying or removing a code
    changes every number the cart page renders.

    The applied coupon is persisted on the cart rather than passed in the
    checkout payload: the customer must see the reduction before deciding to
    pay, and PaymentStartView re-validates it in case the cart sat overnight.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        cart = _get_cart(request.user)

        if not cart.items.exists():
            return Response(
                {"detail": EMPTY_CART_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
            )

        code = " ".join(str(request.data.get("code") or "").split()).upper()
        if not code:
            return Response(
                {"detail": "کد تخفیف را وارد کنید."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        coupon = Coupon.objects.filter(code=code).first()
        if coupon is None:
            return Response(
                {"detail": COUPON_NOT_FOUND_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        error = validate_coupon(coupon, cart, cart.customer)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        # Replaces whatever was applied: trying a second code should not require
        # clearing the first.
        cart.coupon = coupon
        cart.save(update_fields=["coupon", "updated_at"])
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        cart = _get_cart(request.user)
        if cart.coupon_id is not None:
            cart.coupon = None
            cart.save(update_fields=["coupon", "updated_at"])
        # Idempotent: removing when nothing is applied is a 200, not an error, so
        # the frontend never has to check first.
        return Response(CartSerializer(cart, context={"request": request}).data)
