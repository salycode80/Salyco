from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import admin_views, views

router = DefaultRouter()
router.register(r"mattresses", views.MattressViewSet, basename="mattress")
router.register(r"instances", views.MattressInstanceAdminViewSet, basename="mattress-instance")

urlpatterns = [
    path("", include(router.urls)),
    path("warranty/register/", views.WarrantyRegistrationView.as_view(), name="warranty-register"),
    path(
        "warranty/check/<str:serial_number>/",
        views.WarrantyCheckView.as_view(),
        name="warranty-check",
    ),
    path("warranty/my/", views.CustomerWarrantyListView.as_view(), name="warranty-my-list"),
    path(
        "instances/<str:serial_number>/qr/",
        views.MattressInstanceQRView.as_view(),
        name="mattress-instance-qr",
    ),
    path("mattress/", views.MattressViewSet.as_view({"get": "list", "post": "create"}), name="mattress-create"),

    # ── CRM / admin dashboard ──
    path("admin/stats/", admin_views.AdminStatsView.as_view(), name="admin-stats"),
    path("admin/instances/export/", admin_views.AdminInstanceExportView.as_view(), name="admin-instances-export"),
    path("admin/instances/", admin_views.AdminInstanceListView.as_view(), name="admin-instances"),
    path("admin/instances/<str:serial_number>/", admin_views.AdminInstanceDetailView.as_view(), name="admin-instance-detail"),
    path("admin/customers/export/", admin_views.AdminCustomerExportView.as_view(), name="admin-customers-export"),
    path("admin/customers/", admin_views.AdminCustomerListView.as_view(), name="admin-customers"),
]
