from django.urls import path

from . import views

urlpatterns = [
    path("payments/start/", views.PaymentStartView.as_view(), name="payment-start"),
    # Zibal redirects the customer's browser here. Unauthenticated by necessity —
    # see PaymentCallbackView.
    path(
        "payments/callback/",
        views.PaymentCallbackView.as_view(),
        name="payment-callback",
    ),
    path(
        "payments/<int:track_id>/status/",
        views.PaymentStatusView.as_view(),
        name="payment-status",
    ),
]
