from django.urls import path

from . import admin_views, views

urlpatterns = [
    # ── customer-facing ──
    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/items/", views.CartItemView.as_view(), name="cart-items"),
    path("cart/items/<int:pk>/", views.CartItemDetailView.as_view(), name="cart-item-detail"),
    path("cart/merge/", views.CartMergeView.as_view(), name="cart-merge"),
    path("orders/", views.OrderCreateView.as_view(), name="order-create"),
    path("orders/my/", views.OrderListView.as_view(), name="order-my-list"),
    # Public, token-authorised order page linked from the confirmation SMS.
    # Declared after "orders/my/" so that literal path is never shadowed by the
    # token pattern.
    path(
        "orders/public/<str:token>/",
        views.PublicOrderDetailView.as_view(),
        name="order-public-detail",
    ),
    path(
        "orders/public/<str:token>/cancel/",
        views.PublicOrderCancelView.as_view(),
        name="order-public-cancel",
    ),
    path("locations/allowed/", views.AllowedLocationPublicView.as_view(), name="locations-allowed"),

    # ── admin ──
    path("admin/orders/", admin_views.AdminOrderListView.as_view(), name="admin-orders"),
    path("admin/orders/<int:pk>/", admin_views.AdminOrderDetailView.as_view(), name="admin-order-detail"),
    path("admin/locations/", admin_views.AdminAllowedLocationListView.as_view(), name="admin-locations"),
    path("admin/locations/<int:pk>/", admin_views.AdminAllowedLocationDetailView.as_view(), name="admin-location-detail"),
]
