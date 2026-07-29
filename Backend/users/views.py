from django.shortcuts import render
from django.contrib.auth.models import User
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
# from .models import Note


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

        send_otp_sms(user.username, otp.code)

        return Response(
            {
                "detail": "کد تأیید ارسال شد.",
                "phone_number": user.username,
                "expires_in": otp.seconds_remaining(),
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyOTPView(APIView):
    """POST /api/user/verify-otp/ — redeem the registration code.

    On success the account is activated and tokens are returned, so the user
    lands logged in rather than being bounced back to the login form.
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

        send_otp_sms(otp.phone_number, otp.code)

        return Response(
            {
                "detail": "کد تأیید مجدداً ارسال شد.",
                "expires_in": otp.seconds_remaining(),
            },
            status=status.HTTP_200_OK,
        )


class LoginOTPRequestView(APIView):
    """POST /api/user/login-otp/ — deliberately refuses while OTP is a stand-in.

    The request shape is validated so the frontend path is real, but no code is
    issued and no tokens are ever returned: with STATIC_OTP_CODE in place,
    anyone who knows a phone number could otherwise sign in as its owner.
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

        # Unreachable until a real SMS provider is wired up; see users/otp.py.
        raise NotImplementedError("OTP login requires an SMS provider")


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