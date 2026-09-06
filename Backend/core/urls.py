"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path ,include
from django.conf import settings
from django.conf.urls.static import static
from users.views import (
    AuthCompleteView,
    AuthStartView,
    AuthVerifyView,
    ChangePasswordView,
    CurrentUserView,
    LoginOTPRequestView,
    RegisterView,
    ResendOTPView,
    VerifyOTPView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    # Unified login/registration: one phone number in, the server decides which
    # of the two it was. See users/views.py.
    path("api/user/auth/start/", AuthStartView.as_view(), name="auth-start"),
    path("api/user/auth/verify/", AuthVerifyView.as_view(), name="auth-verify"),
    path("api/user/auth/complete/", AuthCompleteView.as_view(), name="auth-complete"),
    # Older split flow. Still routed, no longer called by the frontend.
    path("api/user/register/", RegisterView.as_view(), name="register"),
    path("api/user/verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("api/user/resend-otp/", ResendOTPView.as_view(), name="resend-otp"),
    path("api/user/login-otp/", LoginOTPRequestView.as_view(), name="login-otp"),
    path("api/user/me/", CurrentUserView.as_view(), name="current-user"),
    path("api/user/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("api/token/", TokenObtainPairView.as_view(), name="get_token"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("api-auth",include("rest_framework.urls")),
    path("api/", include("mattress.urls")),
    path("api/", include("articles.urls")),
    path("api/", include("contact.urls")),
    path("api/", include("search.urls")),
    path("api/", include("orders.urls")),
    path("api/", include("payments.urls")),
    path("api/banners/", include("banners.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
