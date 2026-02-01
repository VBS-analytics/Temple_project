"\"\"\"Serializers for accounts authentication and donor profile handling.\"\"\""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Max, Subquery, Sum, Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from pooja.models import PoojaRegistration, PoojaDayOption, RecurrenceKind
from payments.models import PaymentRecord, PaymentStatus

from .models import DonorProfile, FamilyMember, GothraOption, OtpPurpose, OtpToken, User


def _start_of_next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _current_month_bounds(reference: date | None = None) -> tuple[date, date]:
    reference_date = reference or timezone.localdate()
    start = reference_date.replace(day=1)
    return start, _start_of_next_month(start)


def _decimal_to_string(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _compute_monthly_summary_for_user(user: User) -> dict[str, Decimal]:
    start, end = _current_month_bounds()
    due_total = Decimal("0.00")
    
    # Identify CHRT-linked registrations (legacy rows may have day_option null)
    from pooja.models import RecurringPoojaPlan
    chrt_registration_ids = RecurringPoojaPlan.objects.filter(
        donor=user,
    ).filter(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)).values_list(
        "origin_registration_id", flat=True
    )

    # For non-CHRT poojas, use start_date as before
    non_chrt_totals = (
        PoojaRegistration.objects.filter(
            donor=user,
            start_date__gte=start,
            start_date__lt=end,
        )
        .exclude(day_option__code="CHRT")  # Exclude CHRT poojas from current-month dues
        .exclude(id__in=chrt_registration_ids)
        .values_list("total_amount", flat=True)
    )
    for total_amount in non_chrt_totals:
        due_total += Decimal(total_amount or 0)

    # For CHRT poojas, use preferred date from RecurringPoojaPlan.one_time_date
    chrt_plans = RecurringPoojaPlan.objects.filter(
        donor=user,
        is_active=True,
        one_time_date__gte=start,
        one_time_date__lt=end,
    ).filter(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))
    for plan in chrt_plans:
        due_total += plan.amount or Decimal("0.00")
    
    # Exclude CHRT (Choose Your Preferred Date) payment records from current month due calculation
    # CHRT dues are created with notes__icontains='CHRT' and should only appear in their preferred month
    due_records_total = (
        PaymentRecord.objects.filter(
            donor=user,
            registration__isnull=True,
            payment_month__gte=start,
            payment_month__lt=end,
        )
        .exclude(notes__icontains='CHRT')  # Exclude CHRT payment records
        .aggregate(total=Sum("amount"))
        .get("total")
    )
    due_total += Decimal(due_records_total or 0)
    raw_payments = (
        PaymentRecord.objects.filter(
            donor=user,
            payment_month__gte=start,
            payment_month__lt=end,
            status=PaymentStatus.SUCCESS,
        )
        .aggregate(total=Sum("amount"))
        .get("total")
    )
    payments_total = Decimal(raw_payments or 0)
    return {"due": due_total, "payments": payments_total}


def _compute_opening_balance_for_user(user: User) -> Decimal:
    """Get opening balance from the donor profile's custom_number field.
    
    This value should be imported from the opening-balance-december.xlsx file
    and represents the closing balance from the previous month.
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        return Decimal("0.00")
    
    custom_number = getattr(profile, "custom_number", None)
    if custom_number is None:
        return Decimal("0.00")
    
    return Decimal(custom_number or 0)


def build_phone_candidates(phone_number: str | None) -> list[str]:
    if not phone_number:
        return []
    candidates: list[str] = []
    trimmed = phone_number.strip()
    if trimmed and trimmed not in candidates:
        candidates.append(trimmed)
    normalized = "".join(ch for ch in phone_number if ch.isdigit())
    if normalized and normalized not in candidates:
        candidates.append(normalized)
    if phone_number.startswith("+"):
        stripped_plus = phone_number.lstrip("+").strip()
        if stripped_plus and stripped_plus not in candidates:
            candidates.append(stripped_plus)
    if normalized and len(normalized) > 10:
        local_suffix = normalized[-10:]
        if local_suffix not in candidates:
            candidates.append(local_suffix)
    return candidates


class DonorProfileSerializer(serializers.ModelSerializer):
    donor_id = serializers.SerializerMethodField()
    current_month_due = serializers.SerializerMethodField()
    current_month_payments = serializers.SerializerMethodField()
    calculated_current_balance = serializers.SerializerMethodField()
    opening_balance = serializers.SerializerMethodField()
    last_payment_date = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._monthly_summary_cache: dict[str, Decimal] | None = None
        self._opening_balance_cache: Decimal | None = None

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
            "custom_number",
            "monthly_donation_amount",
            "opening_balance",
            "current_month_due",
            "current_month_payments",
            "calculated_current_balance",
            "last_payment_date",
        )
        read_only_fields = (
            "donor_id",
            "monthly_donation_amount",
            "opening_balance",
            "current_month_due",
            "current_month_payments",
            "calculated_current_balance",
            "last_payment_date",
        )
        extra_kwargs = {
            "gender": {"required": False, "allow_blank": True},
            "rasi": {"required": False, "allow_blank": True},
        }

    def get_donor_id(self, obj):
        return obj.donor_id

    def _get_monthly_summary(self, user: User) -> dict[str, Decimal]:
        if self._monthly_summary_cache is None:
            self._monthly_summary_cache = _compute_monthly_summary_for_user(user)
        return self._monthly_summary_cache

    def _summary_for(self, obj: DonorProfile) -> dict[str, Decimal]:
        user = getattr(obj, "user", None)
        if user is None:
            return {"due": Decimal("0.00"), "payments": Decimal("0.00")}
        return self._get_monthly_summary(user)

    def get_current_month_due(self, obj):
        summary = self._summary_for(obj)
        return _decimal_to_string(summary["due"])

    def get_current_month_payments(self, obj):
        summary = self._summary_for(obj)
        return _decimal_to_string(summary["payments"])

    def _get_opening_balance(self, obj: DonorProfile) -> Decimal:
        if self._opening_balance_cache is None:
            user = getattr(obj, "user", None)
            if user is None:
                self._opening_balance_cache = Decimal("0.00")
            else:
                self._opening_balance_cache = _compute_opening_balance_for_user(user)
        return self._opening_balance_cache

    def get_opening_balance(self, obj):
        opening = self._get_opening_balance(obj)
        return _decimal_to_string(opening)

    def get_calculated_current_balance(self, obj):
        summary = self._summary_for(obj)
        opening = self._get_opening_balance(obj)
        result = opening + summary["due"] - summary["payments"]
        return _decimal_to_string(result)

    def get_last_payment_date(self, obj):
        user = getattr(obj, "user", None)
        last_payment = getattr(user, "latest_payment_date", None)
        if last_payment is None:
            return None
        return last_payment.isoformat()


PROFILE_FIELDS = [
    field
    for field in DonorProfileSerializer.Meta.fields
    if field not in {"donor_id"}
]


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


class GothraOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GothraOption
        fields = ("id", "name", "display_order")
        read_only_fields = ("id", "display_order")


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
        user = self._authenticate_with_variations(phone_number, password)
        if not user:
            raise serializers.ValidationError("Invalid phone number or password")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled")
        attrs["user"] = user
        return attrs

    def _authenticate_with_variations(self, phone_number: str | None, password: str | None):
        if not phone_number or not password:
            return None
        candidates = build_phone_candidates(phone_number)

        for candidate in candidates:
            user = authenticate(username=candidate, password=password)
            if user:
                return user
        return None

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
    password = serializers.CharField(write_only=True, required=False)
    confirm_password = serializers.CharField(write_only=True, required=False)
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
        password = attrs.get("password")
        confirm_password = attrs.get("confirm_password")
        skip_otp = self.context.get("skip_otp", False)
        allow_update = self.context.get("allow_update", False)
        existing_user = User.objects.filter(phone_number=attrs["phone_number"]).first()
        if existing_user and not allow_update:
            raise serializers.ValidationError({"phone_number": "Phone number already registered"})
        if not existing_user:
            if not password or not confirm_password:
                raise serializers.ValidationError({"password": "Password is required"})
            if password != confirm_password:
                raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        else:
            attrs["existing_user"] = existing_user
            if password or confirm_password:
                if not password or not confirm_password:
                    raise serializers.ValidationError({"password": "Both password fields must be provided to change the password"})
                if password != confirm_password:
                    raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        if settings.REGISTRATION_OTP_ENABLED and not skip_otp:
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
        validated_data.pop("confirm_password", None)
        otp_code = validated_data.pop("otp_code", "")  # noqa: F841 - kept for audit/logging if needed
        profile_data = _build_profile_data(validated_data)
        existing_user = validated_data.pop("existing_user", None)
        if existing_user:
            user = _update_existing_user(existing_user, validated_data)
            profile, _ = DonorProfile.objects.update_or_create(user=user, defaults=profile_data)
        else:
            user, profile = _create_user_and_profile(validated_data, profile_data)
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


def _build_profile_data(validated_data: dict):
    gender_marker = object()
    gender_value = validated_data.pop("gender", gender_marker)
    profile_data: dict[str, object] = {}
    for field in PROFILE_FIELDS:
        if field in validated_data:
            profile_data[field] = validated_data.pop(field, "")
    if gender_value is not gender_marker:
        profile_data["gender"] = gender_value or ""
    return profile_data


def _update_existing_user(user: User, validated_data: dict):
    name = validated_data.get("name")
    email = validated_data.get("email")
    password = validated_data.get("password")
    if name and name != user.name:
        user.name = name
    if email is not None and email != user.email:
        user.email = email
    if password:
        user.set_password(password)
    user.save()
    return user


def _create_user_and_profile(validated_data: dict, profile_data: dict):
    user = User.objects.create_user(
        phone_number=validated_data.pop("phone_number"),
        name=validated_data.pop("name"),
        password=validated_data.pop("password"),
        email=validated_data.pop("email", ""),
    )
    profile, _ = DonorProfile.objects.update_or_create(user=user, defaults=profile_data)
    return user, profile


class BulkDonorRecordSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    name = serializers.CharField(max_length=255)
    password = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    source_row = serializers.IntegerField(required=False)

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


class BulkDonorUploadSerializer(serializers.Serializer):
    records = BulkDonorRecordSerializer(many=True)
    default_password = serializers.CharField(required=False, allow_blank=True)


class PasswordResetSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    otp_code = serializers.CharField(max_length=6, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        candidates = build_phone_candidates(attrs["phone_number"])
        user = None
        for candidate in candidates:
            try:
                user = User.objects.get(phone_number=candidate)
                attrs["phone_number"] = candidate
                break
            except User.DoesNotExist:
                continue
        if not user:
            raise serializers.ValidationError({"phone_number": "Account not found"})
        attrs["user"] = user
        if settings.RESET_PASSWORD_OTP_ENABLED:
            otp_code = attrs.get("otp_code") or ""
            if not otp_code:
                raise serializers.ValidationError({"otp_code": "OTP is required"})
            token = (
                OtpToken.objects.filter(phone_number__in=candidates, purpose=OtpPurpose.RESET_PASSWORD)
                .order_by("-created_at")
                .first()
            )
            if not token or not token.is_valid(otp_code):
                raise serializers.ValidationError({"otp_code": "Invalid or expired OTP"})
            attrs["token"] = token
        return attrs

    def create(self, validated_data):
        user: User = validated_data["user"]
        token: OtpToken | None = validated_data.get("token")
        user.set_password(validated_data["new_password"])
        user.save(update_fields=["password"])
        if token:
            token.mark_used()
        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonorProfile
        fields = [
            f for f in DonorProfileSerializer.Meta.fields
            if f
            not in (
                "opening_balance",
                "current_month_due",
                "current_month_payments",
                "calculated_current_balance",
                "last_payment_date",
            )
        ]

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
