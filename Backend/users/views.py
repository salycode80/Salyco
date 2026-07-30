from django.shortcuts import render
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .otp import (
    OTP_LOGIN_DISABLED_MESSAGE,
    OTP_LOGIN_ENABLED,
    send_otp_sms,
)
from .serializer import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LoginOTPRequestSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)
from .models import PhoneOTP


# class NoteListCreate(generics.ListCreateAPIView):
#     serializer_class = NoteSerializer
#     permission_classes = [IsAuthenticated]

#     def get_queryset(self):
#         user = self.request.user
#         return Note.objects.filter(author=user)

#     def perform_create(self, serializer):
#         if serializer.is_valid():
#             serializer.save(author=self.request.user)
#         else:
#             print(serializer.errors)


# class NoteDelete(generics.DestroyAPIView):
#     serializer_class = NoteSerializer
#     permission_classes = [IsAuthenticated]

#     def get_queryset(self):
#         user = self.request.user
#         return Note.objects.filter(author=user)


class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


class RegisterView(APIView):
    """POST /api/user/register/ — phone + password, then wait for the OTP.

    Returns 201 with no tokens: the account is inactive until the code is
    verified, so there is nothing to log in with yet.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        otp = serializer.otp

        # Send OTP via SMS.ir
        success, message = send_otp_sms(user.username, otp.code)

        if not success:
            # Delete the created user if SMS failed
            user.delete()
            return Response(
                {"detail": message},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "detail": message,
                "phone_number": user.username,
                "expires_in": otp.seconds_remaining(),
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyOTPView(APIView):
    """POST /api/user/verify-otp/ — redeem the registration or login OTP.

    On success for registration: the account is activated and tokens are returned.
    On success for login: tokens are returned for passwordless login.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "detail": "شماره شما تأیید شد.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class ResendOTPView(APIView):
    """POST /api/user/resend-otp/ — a fresh code for an unverified signup."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        otp = serializer.save()

        # Send OTP via SMS.ir
        success, message = send_otp_sms(otp.phone_number, otp.code)

        if not success:
            return Response(
                {"detail": message},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "detail": message,
                "expires_in": otp.seconds_remaining(),
            },
            status=status.HTTP_200_OK,
        )


class LoginOTPRequestView(APIView):
    """POST /api/user/login-otp/ — send OTP for passwordless login.

    Requires a valid phone number with an existing active account.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not OTP_LOGIN_ENABLED:
            return Response(
                {"detail": OTP_LOGIN_DISABLED_MESSAGE, "otp_login_enabled": False},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        phone_number = serializer.validated_data['phone_number']

        # Check if user exists and is active
        try:
            user = User.objects.get(username=phone_number)
            if not user.is_active:
                return Response(
                    {"detail": "این حساب هنوز فعال نشده است. لطفاً ثبت‌نام را تکمیل کنید."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except User.DoesNotExist:
            return Response(
                {"detail": "حساب کاربری با این شماره یافت نشد."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Issue OTP for login
        otp = PhoneOTP.issue(phone_number=phone_number, purpose=PhoneOTP.PURPOSE_LOGIN)

        # Send OTP via SMS.ir
        success, message = send_otp_sms(phone_number, otp.code)

        if not success:
            return Response(
                {"detail": message},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "detail": message,
                "phone_number": phone_number,
                "expires_in": otp.seconds_remaining(),
            },
            status=status.HTTP_200_OK,
        )

        return Response(
            {
                "detail": message,
                "phone_number": phone_number,
                "expires_in": otp.seconds_remaining(),
            },
            status=status.HTTP_200_OK,
        )


class CurrentUserView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "رمز عبور با موفقیت تغییر کرد."},
            status=status.HTTP_200_OK,
        )