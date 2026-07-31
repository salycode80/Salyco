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
from .notifications import send_welcome_sms
from .serializer import (
    AuthCompleteSerializer,
    AuthStartSerializer,
    AuthVerifySerializer,
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LoginOTPRequestSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    UserSerializer,
    VerifyOTPSerializer,
    make_registration_token,
    MODE_LOGIN,
    MODE_REGISTER,
    classify_phone,
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


# ── Unified login/registration flow ──────────────────────────────────────────
# One entry point: the caller posts a phone number, gets a code, and only after
# the code is verified does the server say whether that was a login or the
# first half of a signup. The views above implement the older flow, where the
# client had to know which one it was before it started; they are still routed
# but the frontend no longer calls them.


class AuthStartView(APIView):
    """POST /api/user/auth/start/ — send a code to a phone number.

    Also the resend endpoint: PhoneOTP.issue retires any previous unused code
    for the same phone and purpose, so calling this twice is harmless.
    """

    permission_classes = [AllowAny]
    throttle_scope = "otp"

    def post(self, request):
        serializer = AuthStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data["phone_number"]

        mode, _user = classify_phone(phone_number)
        if mode is None:
            return Response(
                {"detail": "این حساب غیرفعال شده است. با پشتیبانی تماس بگیرید."},
                status=status.HTTP_403_FORBIDDEN,
            )

        purpose = (
            PhoneOTP.PURPOSE_LOGIN if mode == MODE_LOGIN else PhoneOTP.PURPOSE_REGISTER
        )
        # No User row is created for a new number. The account is written once,
        # in AuthCompleteView, when there is a password and a name to write.
        otp = PhoneOTP.issue(phone_number=phone_number, purpose=purpose)

        success, message = send_otp_sms(phone_number, otp.code)
        if not success:
            return Response(
                {"detail": message},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "detail": message,
                "mode": mode,
                "phone_number": phone_number,
                "expires_in": otp.seconds_remaining(),
            },
            status=status.HTTP_200_OK,
        )


class AuthVerifyView(APIView):
    """POST /api/user/auth/verify/ — redeem the code.

    Returns tokens for a known number, or a signed registration_token for a new
    one. `mode` tells the client which of the two it got.
    """

    permission_classes = [AllowAny]
    throttle_scope = "otp"

    def post(self, request):
        serializer = AuthVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mode = serializer.validated_data["mode"]
        user = serializer.validated_data["user"]
        phone_number = serializer.validated_data["phone_number"]

        if mode == MODE_LOGIN:
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "detail": "خوش آمدید.",
                    "mode": MODE_LOGIN,
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
                status=status.HTTP_200_OK,
            )

        # New number: verified, but there is no account to log into yet.
        return Response(
            {
                "detail": "شماره شما تأیید شد. لطفاً ثبت‌نام را تکمیل کنید.",
                "mode": MODE_REGISTER,
                "phone_number": phone_number,
                "registration_token": make_registration_token(phone_number),
            },
            status=status.HTTP_200_OK,
        )


class AuthCompleteView(APIView):
    """POST /api/user/auth/complete/ — create the account and log in.

    Reachable only with a registration_token minted by AuthVerifyView, which is
    what proves the number was verified: the OTP is burned by this point.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AuthCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Welcome SMS. This endpoint is only reachable for a registration — a
        # number that already has an active account is rejected in validate() —
        # so reaching here means the account was just created, and this fires
        # once per account rather than on every login. Sent after save() so the
        # request is not made while the serializer's transaction is open, and
        # best-effort: a dead gateway must not fail a completed signup.
        send_welcome_sms(user.username, user.first_name)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "detail": "ثبت‌نام شما تکمیل شد.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
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