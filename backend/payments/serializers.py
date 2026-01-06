"""Serializers for payment tracking."""

from decimal import Decimal

from django.utils import timezone

from rest_framework import serializers

from .models import PaymentRecord
from pooja.services.calendar import get_calendar_service


class PaymentRecordSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.name", read_only=True)
    pooja_option = serializers.CharField(source="registration.pooja_option.name", read_only=True)
    registration_start_date = serializers.DateField(source="registration.start_date", read_only=True)
    registration_total_amount = serializers.DecimalField(
        source="registration.total_amount",
        max_digits=10,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    pooja_due_amount = serializers.SerializerMethodField()
    registration_status = serializers.CharField(source="registration.status", read_only=True, allow_null=True)
    registration_donor_name = serializers.CharField(
        source="registration.donor.name",
        read_only=True,
        allow_null=True,
    )
    registration_is_group_registration = serializers.BooleanField(
        source="registration.is_group_registration",
        read_only=True,
        default=False,
    )
    upcoming_occurrences = serializers.SerializerMethodField()

    class Meta:
        model = PaymentRecord
        fields = (
            "id",
            "donor",
            "donor_name",
            "registration",
            "registration_start_date",
            "registration_total_amount",
            "pooja_due_amount",
            "pooja_option",
            "amount",
            "currency",
            "mode",
        "status",
        "transaction_reference",
        "payment_month",
        "notes",
        "created_at",
        "updated_at",
        "registration_status",
        "registration_donor_name",
        "registration_is_group_registration",
        "upcoming_occurrences",
    )
        read_only_fields = (
            "id",
            "donor",
            "donor_name",
            "registration_start_date",
            "registration_total_amount",
            "pooja_due_amount",
            "pooja_option",
            "created_at",
            "updated_at",
        "registration_status",
        "registration_donor_name",
        "registration_is_group_registration",
        "upcoming_occurrences",
    )

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["donor"] = request.user
        return super().create(validated_data)

    def get_pooja_due_amount(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is None:
            return None
        total_amount = getattr(registration, "total_amount", None)
        if total_amount is None:
            return None
        payments = getattr(registration, "payments", None)
        if payments is None:
            return Decimal(total_amount)
        total_paid = sum((payment.amount or Decimal("0.00")) for payment in payments.all())
        due_value = Decimal(total_amount) - total_paid
        return max(due_value, Decimal("0.00"))

    def get_upcoming_occurrences(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is None:
            return []
        day_option = getattr(registration, "day_option", None)
        if day_option is None or not day_option.code:
            return []
        reference_date = registration.start_date or timezone.localdate()
        reference_date = max(reference_date, timezone.localdate())
        service = get_calendar_service()
        try:
            occurrence = service.next_occurrence(day_option.code, reference_date)
        except (ValueError, RuntimeError):
            return []
        return occurrence.meta.get("upcoming_occurrences") or []
