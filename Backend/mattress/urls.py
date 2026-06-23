from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"mattresses", views.MattressViewSet, basename="mattress")

urlpatterns = [
    path("", include(router.urls)),
    path("warranty/register/", views.WarrantyRegistrationView.as_view(), name="warranty-register"),
    path(
        "warranty/check/<str:serial_number>/",
        views.WarrantyCheckView.as_view(),
        name="warranty-check",
    ),
    path("warranty/my/", views.CustomerWarrantyListView.as_view(), name="warranty-my-list"),
    path("mattress/", views.MattressViewSet.as_view({"get": "list", "post": "create"}), name="mattress-create"),
]
