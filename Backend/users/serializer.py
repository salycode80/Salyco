from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from .models import Customer, PhoneOTP
from .phone import normalize_phone
# from .models import Note

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "first_name",
            "last_name",
            "address",
            "phone_number",
            "postal_code",
        ]
        read_only_fields = ["id"]

        
class PhoneField(serializers.CharField):
    """A CharField that normalises Iranian mobile numbers on the way in."""

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        try:
            return normalize_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0]) from exc


class RegisterSerializer(serializers.Serializer):
    """Phone + password signup. Nothing else is asked for.

    The phone number becomes the username, so it is the login identity and the
    OTP target both. Name, email and address are deliberately absent: the user
    fills those in from the profile page, or at checkout when an order actually
    needs them.

    The account is created *inactive* and stays that way until the OTP is
    verified, which is what stops an unverified signup from being able to log
    in — `authenticate()` refuses inactive users, so the JWT endpoint does too.
    """

    phone_number = PhoneField(max_length=20)
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password2": "رمز عبور و تکرار آن یکسان نیستند."}
            )

        phone = attrs["phone_number"]
        existing = User.objects.filter(username=phone).first()
        if existing is not None and not self._is_abandoned_signup(existing):
            raise serializers.ValidationError(
                {"phone_number": "این شماره قبلاً ثبت شده است. وارد شوید."}
            )
        self._existing = existing

        # Run Django's validators against the username too, so "09121234567"
        # can't also be the password (UserAttributeSimilarityValidator).
        validate_password(attrs["password"], User(username=phone))
        return attrs

    @staticmethod
    def _is_abandoned_signup(user: User) -> bool:
        """True for a signup that never got past the OTP step.

        Reusing such a row is what lets someone who closed the tab try again
        instead of being told their own number is taken. `last_login is None` is
        the guard that keeps this away from accounts an admin has deactivated —
        those have a login history, so they are never overwritten.
        """
        return not user.is_active and user.last_login is None

    @transaction.atomic
    def create(self, validated_data):
        phone = validated_data["phone_number"]
        password = validated_data["password"]

        user = self._existing or User(username=phone)
        user.set_password(password)
        user.is_active = False
        user.save()

        # Mirror the number onto the profile row now, so the phone the user
        # verified is already there when they open the profile page.
        Customer.objects.update_or_create(
            user=user,
            defaults={"phone_number": phone},
            create_defaults={
                "phone_number": phone,
                "first_name": "",
                "last_name": "",
                "address": "",
                "postal_code": "",
            },
        )

        otp = PhoneOTP.issue(phone, purpose=PhoneOTP.PURPOSE_REGISTER)
        self.otp = otp
        return user


class VerifyOTPSerializer(serializers.Serializer):
    """Redeem a registration or login OTP code."""

    phone_number = PhoneField(max_length=20)
    code = serializers.CharField(max_length=8)

    def validate(self, attrs):
        phone = attrs["phone_number"]

        user = User.objects.filter(username=phone).first()
        if user is None:
            raise serializers.ValidationError(
                {"phone_number": "ثبت‌نامی با این شماره یافت نشد."}
            )

        # Look for OTP with any purpose (REGISTER or LOGIN)
        otp = (
            PhoneOTP.objects.filter(
                phone_number=phone, is_used=False
            )
            .order_by("-created_at")
            .first()
        )
        if otp is None:
            raise serializers.ValidationError(
                {"code": "کد تأییدی برای این شماره وجود ندارد. کد جدید درخواست کنید."}
            )

        ok, error = otp.verify(attrs["code"])
        if not ok:
            raise serializers.ValidationError({"code": error})

        attrs["user"] = user
        attrs["otp"] = otp
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        # Only activate if this was a registration OTP
        otp = self.validated_data.get("otp")
        if otp and otp.purpose == PhoneOTP.PURPOSE_REGISTER and not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        return user


class ResendOTPSerializer(serializers.Serializer):
    """Issue a new registration code for a signup still awaiting verification."""

    phone_number = PhoneField(max_length=20)

    def validate_phone_number(self, value):
        user = User.objects.filter(username=value).first()
        if user is None:
            raise serializers.ValidationError("ثبت‌نامی با این شماره یافت نشد.")
        if user.is_active:
            raise serializers.ValidationError("این شماره قبلاً تأیید شده است. وارد شوید.")
        return value

    def save(self, **kwargs):
        phone = self.validated_data["phone_number"]
        return PhoneOTP.issue(phone, purpose=PhoneOTP.PURPOSE_REGISTER)


class LoginOTPRequestSerializer(serializers.Serializer):
    """Validates a login-by-OTP request. Issuing the code is refused elsewhere.

    See users/otp.py: while the code is the static stand-in, handing out tokens
    for anyone who types it would be an open door, so the view returns 503
    rather than sending anything. This serializer exists so the shape of the
    request is already settled when a real SMS provider is wired up.
    """

    phone_number = PhoneField(max_length=20)


# ── Unified login/registration flow ──────────────────────────────────────────
# Three serializers for the one-entry-point flow: the user types a phone number
# and a code, and only *then* is told whether they just logged in or still need
# to pick a name and password. The older RegisterSerializer above cannot express
# that, because it needs the password before the OTP is even sent.

# How long the signed registration token stays redeemable. Generous enough to
# type a name and a password twice, short enough that a leaked token from a
# browser history or a proxy log is worthless.
REGISTRATION_TOKEN_MAX_AGE = 600  # seconds
REGISTRATION_TOKEN_SALT = "users.auth.registration"

MODE_LOGIN = "login"
MODE_REGISTER = "register"


def classify_phone(phone: str):
    """Decide what an incoming phone number means. Returns (mode, user).

    `user` is the existing row when there is one worth reusing, else None. The
    inactive-with-a-login-history case is neither: that is an account an admin
    switched off, and letting a signup overwrite it would be a way to take it
    over, so it is refused by the caller.
    """
    user = User.objects.filter(username=phone).first()
    if user is None:
        return MODE_REGISTER, None
    if user.is_active:
        return MODE_LOGIN, user
    if user.last_login is None:
        # Abandoned signup — someone closed the tab at the OTP step. Reuse it
        # rather than telling them their own number is taken.
        return MODE_REGISTER, user
    return None, user


class AuthStartSerializer(serializers.Serializer):
    """Step 1: a phone number, and nothing else."""

    phone_number = PhoneField(max_length=20)


class AuthVerifySerializer(serializers.Serializer):
    """Step 2: redeem the code.

    Deliberately not VerifyOTPSerializer, which rejects any phone without a
    User row — for a new signup that row does not exist yet and is not supposed
    to. The purpose recorded on the OTP is not re-checked here: `mode` is
    re-derived from the database, so a code issued for one flow cannot be spent
    to reach the other.
    """

    phone_number = PhoneField(max_length=20)
    code = serializers.CharField(max_length=8)

    def validate(self, attrs):
        phone = attrs["phone_number"]

        otp = (
            PhoneOTP.objects.filter(phone_number=phone, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if otp is None:
            raise serializers.ValidationError(
                {"code": "کد تأییدی برای این شماره وجود ندارد. کد جدید درخواست کنید."}
            )

        mode, user = classify_phone(phone)
        if mode is None:
            raise serializers.ValidationError(
                {"phone_number": "این حساب غیرفعال شده است. با پشتیبانی تماس بگیرید."}
            )

        # Burn the code only after the account state is known to be usable, so a
        # 403 doesn't also cost the user their code.
        ok, error = otp.verify(attrs["code"])
        if not ok:
            raise serializers.ValidationError({"code": error})

        attrs["mode"] = mode
        attrs["user"] = user
        return attrs


class AuthCompleteSerializer(serializers.Serializer):
    """Step 3: name + password for a phone that was just verified.

    The phone number arrives inside `registration_token` rather than as a field
    of its own. That token is a signed, timestamped value this server minted at
    the end of step 2, and it is the only proof that the number was verified —
    the OTP itself is already burned by now, so it cannot be re-checked. Taking
    the phone from the request body instead would let anyone create an account
    on any number by skipping straight to this endpoint.
    """

    registration_token = serializers.CharField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate_registration_token(self, value):
        try:
            phone = signing.loads(
                value,
                salt=REGISTRATION_TOKEN_SALT,
                max_age=REGISTRATION_TOKEN_MAX_AGE,
            )
        except signing.SignatureExpired as exc:
            raise serializers.ValidationError(
                "زمان ثبت‌نام به پایان رسید. لطفاً دوباره شماره خود را وارد کنید."
            ) from exc
        except signing.BadSignature as exc:
            raise serializers.ValidationError(
                "درخواست ثبت‌نام معتبر نیست. لطفاً دوباره تلاش کنید."
            ) from exc
        self._phone = phone
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password2": "رمز عبور و تکرار آن یکسان نیستند."}
            )

        # Set by validate_registration_token, which DRF runs first. If the token
        # was bad, this method is never reached.
        phone = self._phone
        mode, existing = classify_phone(phone)
        if mode == MODE_LOGIN:
            # Someone finished a signup on this number while this form sat open.
            raise serializers.ValidationError(
                {"phone_number": "این شماره قبلاً ثبت شده است. وارد شوید."}
            )
        if mode is None:
            raise serializers.ValidationError(
                {"phone_number": "این حساب غیرفعال شده است. با پشتیبانی تماس بگیرید."}
            )

        # Same reason as RegisterSerializer: stop the phone number from doubling
        # as the password (UserAttributeSimilarityValidator needs the username).
        validate_password(attrs["password"], User(username=phone))

        attrs["phone_number"] = phone
        self._existing = existing
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        phone = validated_data["phone_number"]

        user = self._existing or User(username=phone)
        user.first_name = validated_data["first_name"]
        user.last_name = validated_data["last_name"]
        user.set_password(validated_data["password"])
        # Active immediately: the number is already verified by the time this
        # endpoint is reachable, which is what `is_active = False` was guarding
        # against in the older two-step signup.
        user.is_active = True
        user.save()

        Customer.objects.update_or_create(
            user=user,
            defaults={
                "phone_number": phone,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            create_defaults={
                "phone_number": phone,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "address": "",
                "postal_code": "",
            },
        )
        return user


def make_registration_token(phone: str) -> str:
    """Sign a just-verified phone number for AuthCompleteSerializer to redeem."""
    return signing.dumps(phone, salt=REGISTRATION_TOKEN_SALT)


class UserSerializer(serializers.ModelSerializer):
    """Legacy username+password signup, kept for the admin/tests path."""

    class Meta:
        model = User
        fields = ["id", "username", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class CurrentUserSerializer(serializers.ModelSerializer):
    # Profile fields that live on the related Customer model.
    # Not a PhoneField: this is where a user completes the profile the signup
    # form deliberately left empty, and rejecting a half-typed number mid-edit
    # would be worse than storing it. It is validated on the way in only when it
    # would change the login identity — see validate_phone_number().
    phone_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )
    address = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "address",
            "postal_code",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = ["id", "username", "is_staff", "date_joined"]

    def validate_phone_number(self, value):
        """Keep the profile phone from silently diverging from the login identity.

        The username is the verified phone number, so a user editing this field
        to something else would end up with a profile that disagrees with the
        number they log in and receive codes on. Changing it needs a
        verify-the-new-number flow, which does not exist yet, so a mismatch is
        rejected instead of half-applied.
        """
        user = self.instance
        if user is None or not value:
            return value

        try:
            normalized = normalize_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0]) from exc

        # Only accounts registered by phone have a phone-shaped username; the
        # legacy username+password ones are free to set any number here.
        try:
            username_phone = normalize_phone(user.username)
        except DjangoValidationError:
            return normalized

        if normalized != username_phone:
            raise serializers.ValidationError(
                "شماره موبایل حساب قابل تغییر نیست، زیرا نام کاربری شما همین شماره است."
            )
        return normalized

    def to_representation(self, instance):
        """Merge the linked Customer's fields into the User representation."""
        data = super().to_representation(instance)
        customer = getattr(instance, "customer", None)
        data["phone_number"] = getattr(customer, "phone_number", "") or ""
        data["address"] = getattr(customer, "address", "") or ""
        data["postal_code"] = getattr(customer, "postal_code", "") or ""
        return data

    def update(self, instance, validated_data):
        # Pull out the Customer-owned fields before touching the User.
        phone_number = validated_data.pop("phone_number", None)
        address = validated_data.pop("address", None)
        postal_code = validated_data.pop("postal_code", None)

        # Update the User fields (email, first_name, last_name).
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        # Mirror the profile fields onto the linked Customer, creating it
        # on first save (same pattern as the warranty registration flow).
        customer, _created = Customer.objects.get_or_create(
            user=instance,
            defaults={
                "first_name": instance.first_name or "",
                "last_name": instance.last_name or "",
                "address": address or "",
                "phone_number": phone_number or "",
                "postal_code": postal_code or "",
            },
        )
        if not _created:
            if phone_number is not None:
                customer.phone_number = phone_number
            if address is not None:
                customer.address = address
            if postal_code is not None:
                customer.postal_code = postal_code
            # Keep the customer's name in sync with the user's.
            customer.first_name = instance.first_name or customer.first_name
            customer.last_name = instance.last_name or customer.last_name
            customer.save()

        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("رمز عبور فعلی نادرست است.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user


# class NoteSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Note
#         fields = ["id", "title", "content", "created_at", "author"]
#         extra_kwargs = {"author": {"read_only": True}}