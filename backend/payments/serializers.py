"""Serializers for payment tracking."""

from rest_framework import serializers

from .models import PaymentRecord


class PaymentRecordSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.name", read_only=True)
    pooja_option = serializers.CharField(source="registration.pooja_option.name", read_only=True)

    class Meta:
        model = PaymentRecord
        fields = (
            "id",
            "donor",
            "donor_name",
            "registration",
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
        )
        read_only_fields = (
            "id",
            "donor",
            "donor_name",
            "pooja_option",
            "created_at",
            "updated_at",
        )

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["donor"] = request.user
        return super().create(validated_data)
