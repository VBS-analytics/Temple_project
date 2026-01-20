"""Serializers for payment tracking."""

from decimal import Decimal

from django.utils import timezone

from rest_framework import serializers

from .models import ExpenseRecord, PaymentRecord
from pooja.services.calendar import get_calendar_service


class PaymentRecordSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.name", read_only=True)
    pooja_option = serializers.SerializerMethodField()
    registration_start_date = serializers.SerializerMethodField()
    registration_total_amount = serializers.SerializerMethodField()
    pooja_due_amount = serializers.SerializerMethodField()
    registration_status = serializers.SerializerMethodField()
    registration_donor_name = serializers.SerializerMethodField()
    registration_is_group_registration = serializers.SerializerMethodField()
    upcoming_occurrences = serializers.SerializerMethodField()
    is_due_record = serializers.SerializerMethodField()

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
            "is_due_record",
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
            "is_due_record",
        )

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["donor"] = request.user
        return super().create(validated_data)

    def get_is_due_record(self, obj):
        """Check if this is a due record (registration is None)."""
        return obj.registration is None

    def get_pooja_option(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is not None:
            pooja_option = getattr(registration, "pooja_option", None)
            if pooja_option:
                return pooja_option.name
        return None

    def get_registration_start_date(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is not None:
            return getattr(registration, "start_date", None)
        # For due records, use the payment_month as reference
        if obj.payment_month:
            return obj.payment_month
        return None

    def get_registration_total_amount(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is not None:
            return getattr(registration, "total_amount", None)
        # For due records, return the amount
        return obj.amount

    def get_pooja_due_amount(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is None:
            # For due records, show the full amount as due if status is PENDING
            if obj.status == "pending":
                return obj.amount
            return Decimal("0.00")
        
        total_amount = getattr(registration, "total_amount", None)
        if total_amount is None:
            return None
        payments = getattr(registration, "payments", None)
        if payments is None:
            return Decimal(total_amount)
        total_paid = sum((payment.amount or Decimal("0.00")) for payment in payments.all())
        due_value = Decimal(total_amount) - total_paid
        return max(due_value, Decimal("0.00"))

    def get_registration_status(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is not None:
            return getattr(registration, "status", None)
        # For due records, indicate the payment status
        return f"due_{obj.status}"

    def get_registration_donor_name(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is not None:
            donor = getattr(registration, "donor", None)
            if donor:
                return getattr(donor, "name", None)
        return None

    def get_registration_is_group_registration(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is not None:
            return getattr(registration, "is_group_registration", False)
        return False

    def get_upcoming_occurrences(self, obj):
        registration = getattr(obj, "registration", None)
        if registration is None:
            return []
        day_option = getattr(registration, "day_option", None)
        if day_option is None or not day_option.code:
            return []
        # Use payment_month (when payment was recorded) instead of current date
        # to avoid showing incorrect "late payment" status when system date changes
        reference_date = obj.payment_month or registration.start_date or timezone.localdate()
        reference_date = max(reference_date, registration.start_date or timezone.localdate())
        service = get_calendar_service()
        try:
            occurrence = service.next_occurrence(day_option.code, reference_date)
        except (ValueError, RuntimeError):
            return []
        return occurrence.meta.get("upcoming_occurrences") or []



class ExpenseRecordSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)

    class Meta:
        model = ExpenseRecord
        fields = (
            "id",
            "transaction_date",
            "category",
            "amount",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_by_name", "created_at", "updated_at")
