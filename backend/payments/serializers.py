"""Serializers for payment tracking."""

from decimal import Decimal

from rest_framework import serializers

from .models import PaymentRecord


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
