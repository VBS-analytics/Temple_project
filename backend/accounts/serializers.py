"""Serializers for accounts authentication and donor profile handling."""

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import DonorProfile, FamilyMember, OtpPurpose, OtpToken, User


class DonorProfileSerializer(serializers.ModelSerializer):
    donor_id = serializers.SerializerMethodField()

    class Meta:
        model = DonorProfile
        fields = (
            "donor_id",
            "address_line1",
            "address_line2",
            "address_line3",
            "city",
            "state",
            "postal_code",
            "gothra",
            "tamil_star",
            "rasi",
            "gender",
            "date_of_birth",
            "tamil_name",
            "family_name",
            "notes",
        )
        read_only_fields = ("donor_id",)
        extra_kwargs = {
            "gender": {"required": False, "allow_blank": True},
            "rasi": {"required": False, "allow_blank": True},
        }

    def get_donor_id(self, obj):
        return obj.donor_id


class FamilyMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyMember
        fields = (
            "id",
            "name",
            "gender",
            "relationship",
            "date_of_birth",
            "tamil_star",
            "rasi",
            "gothra",
            "family_name",
        )
        read_only_fields = ("id",)
        extra_kwargs = {
            "gender": {"required": False, "allow_blank": True},
            "relationship": {"required": False, "allow_blank": True},
            "date_of_birth": {"required": False, "allow_null": True},
            "tamil_star": {"required": False, "allow_blank": True},
            "rasi": {"required": False, "allow_blank": True},
            "gothra": {"required": False, "allow_blank": True},
            "family_name": {"required": False, "allow_blank": True},
        }

    def create(self, validated_data):
        user = validated_data.pop("user")
        return FamilyMember.objects.create(user=user, **validated_data)


class UserSerializer(serializers.ModelSerializer):
    profile = DonorProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "phone_number",
            "name",
            "email",
            "role",
            "profile",
        )
        read_only_fields = ("id", "role")


class AdminDonorUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("name", "phone_number", "email")
        extra_kwargs = {
            "name": {"required": False, "allow_blank": True},
            "phone_number": {"required": False},
            "email": {"required": False, "allow_blank": True},
        }


class TokenSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        phone_number = attrs.get("phone_number")
        password = attrs.get("password")
        user = authenticate(username=phone_number, password=password)
        if not user:
            raise serializers.ValidationError("Invalid phone number or password")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled")
        attrs["user"] = user
        return attrs

    def create(self, validated_data):
        user = validated_data["user"]
        refresh = RefreshToken.for_user(user)
        return {
            "user": UserSerializer(user).data,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }


class OtpRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    purpose = serializers.ChoiceField(choices=OtpPurpose.choices)

    def create(self, validated_data):
        token = OtpToken.create_code(
            phone_number=validated_data["phone_number"],
            purpose=validated_data["purpose"],
        )
        return token


class OtpVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    purpose = serializers.ChoiceField(choices=OtpPurpose.choices)
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone = attrs["phone_number"]
        purpose = attrs["purpose"]
        code = attrs["code"]
        token = (
            OtpToken.objects.filter(phone_number=phone, purpose=purpose)
            .order_by("-created_at")
            .first()
        )
        if not token or not token.is_valid(code):
            raise serializers.ValidationError("Invalid or expired OTP")
        attrs["token"] = token
        return attrs

    def create(self, validated_data):
        token: OtpToken = validated_data["token"]
        token.mark_used()
        return token


class RegisterSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    otp_code = serializers.CharField(max_length=6, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    # Donor profile fields
    address_line1 = serializers.CharField(required=False, allow_blank=True)
    address_line2 = serializers.CharField(required=False, allow_blank=True)
    address_line3 = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)
    state = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(required=False, allow_blank=True)
    gothra = serializers.CharField(required=False, allow_blank=True)
    tamil_star = serializers.CharField(required=False, allow_blank=True)
    rasi = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    family_name = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.CharField(required=False, allow_blank=True)
    tamil_name = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        if User.objects.filter(phone_number=attrs["phone_number"]).exists():
            raise serializers.ValidationError({"phone_number": "Phone number already registered"})
        if settings.REGISTRATION_OTP_ENABLED:
            otp_code = attrs.get("otp_code") or ""
            if not otp_code:
                raise serializers.ValidationError({"otp_code": "OTP is required"})
            token = (
                OtpToken.objects.filter(phone_number=attrs["phone_number"], purpose=OtpPurpose.REGISTRATION)
                .order_by("-created_at")
                .first()
            )
            if not token or not token.is_valid(otp_code):
                raise serializers.ValidationError({"otp_code": "Invalid or expired OTP"})
            attrs["token"] = token
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        token = validated_data.pop("token", None)
        validated_data.pop("confirm_password")
        otp_code = validated_data.pop("otp_code", "")  # noqa: F841 - kept for audit/logging if needed

        gender_marker = object()
        gender_value = validated_data.pop("gender", gender_marker)

        profile_fields = [
            field
            for field in DonorProfileSerializer.Meta.fields
            if field not in {"donor_id"}
        ]
        profile_data = {field: validated_data.pop(field, "") for field in profile_fields if field in validated_data}
        if gender_value is not gender_marker:
            profile_data["gender"] = gender_value or ""

        user = User.objects.create_user(
            phone_number=validated_data.pop("phone_number"),
            name=validated_data.pop("name"),
            password=validated_data.pop("password"),
            email=validated_data.pop("email", ""),
        )
        profile, _ = DonorProfile.objects.update_or_create(user=user, defaults=profile_data)
        if token:
            token.mark_used()
        user.refresh_from_db()
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        # Ensure the freshly updated profile data is reflected in the response.
        user_data["profile"] = DonorProfileSerializer(profile).data
        return {
            "user": user_data,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }


class PasswordResetSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    otp_code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        try:
            user = User.objects.get(phone_number=attrs["phone_number"])
        except User.DoesNotExist as exc:  # pragma: no cover - raised only when data bad
            raise serializers.ValidationError({"phone_number": "Account not found"}) from exc
        token = (
            OtpToken.objects.filter(phone_number=attrs["phone_number"], purpose=OtpPurpose.RESET_PASSWORD)
            .order_by("-created_at")
            .first()
        )
        if not token or not token.is_valid(attrs["otp_code"]):
            raise serializers.ValidationError({"otp_code": "Invalid or expired OTP"})
        attrs["user"] = user
        attrs["token"] = token
        return attrs

    def create(self, validated_data):
        user: User = validated_data["user"]
        token: OtpToken = validated_data["token"]
        user.set_password(validated_data["new_password"])
        user.save(update_fields=["password"])
        token.mark_used()
        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonorProfile
        fields = DonorProfileSerializer.Meta.fields

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
