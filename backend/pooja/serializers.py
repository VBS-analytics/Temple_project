"""Serializers for pooja domain."""

from django.db import transaction
from rest_framework import serializers

from .models import (
    DailyMessage,
    DonorMessageTemplate,
    FeaturedPooja,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    PoojaRegistrationMember,
)


class PoojaOptionSerializer(serializers.ModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=PoojaOption.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = PoojaOption
        fields = (
            "id",
            "code",
            "name",
            "description",
            "min_amount",
            "max_amount",
            "default_amount",
            "is_active",
            "is_group_header",
            "parent_id",
        )


class FeaturedPoojaSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = FeaturedPooja
        fields = (
            "id",
            "name",
            "image",
            "image_url",
            "amount",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_image_url(self, obj):  # pragma: no cover - used in API responses
        if not obj.image:
            return ""
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class PoojaDayOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PoojaDayOption
        fields = (
            "id",
            "code",
            "description",
            "category",
            "display_order",
        )
        read_only_fields = ("id", "display_order")


class DailyMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyMessage
        fields = (
            "id",
            "label",
            "header_text",
            "footer_text",
        )


class DonorMessageTemplateSerializer(serializers.ModelSerializer):
    day_option = PoojaDayOptionSerializer(read_only=True)
    day_option_id = serializers.PrimaryKeyRelatedField(
        source="day_option",
        queryset=PoojaDayOption.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = DonorMessageTemplate
        fields = (
            "id",
            "preferred_date",
            "day_option",
            "day_option_id",
            "summary_text",
            "tamil_text",
            "gothra_details",
        )
        read_only_fields = ("id",)


class PoojaRegistrationMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PoojaRegistrationMember
        fields = (
            "id",
            "name",
            "phone_number",
            "relationship",
        )
        read_only_fields = ("id",)


class PoojaRegistrationSerializer(serializers.ModelSerializer):
    members = PoojaRegistrationMemberSerializer(many=True, required=False)
    donor_name = serializers.SerializerMethodField()
    donor_phone = serializers.SerializerMethodField()
    pooja_option_name = serializers.SerializerMethodField()
    day_option_description = serializers.SerializerMethodField()

    class Meta:
        model = PoojaRegistration
        fields = (
            "id",
            "donor",
            "donor_name",
            "donor_phone",
            "pooja_option",
            "pooja_option_name",
            "day_option",
            "day_option_description",
            "start_date",
            "quantity",
            "is_group_registration",
            "post_prasadam",
            "additional_notes",
            "total_amount",
            "created_at",
            "updated_at",
            "members",
        )
        read_only_fields = (
            "id",
            "donor",
            "donor_name",
            "donor_phone",
            "pooja_option_name",
            "day_option_description",
            "created_at",
            "updated_at",
        )

    @transaction.atomic
    def create(self, validated_data):
        members = validated_data.pop("members", [])
        registration = PoojaRegistration.objects.create(**validated_data)
        self._sync_members(registration, members)
        return registration

    @transaction.atomic
    def update(self, instance, validated_data):
        members = validated_data.pop("members", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if members is not None:
            instance.members.all().delete()
            self._sync_members(instance, members)
        return instance

    def _sync_members(self, registration, members_payload):
        for member_data in members_payload:
            PoojaRegistrationMember.objects.create(registration=registration, **member_data)

    def get_donor_name(self, obj):  # pragma: no cover - simple property mapping
        return getattr(obj.donor, "name", None)

    def get_donor_phone(self, obj):  # pragma: no cover
        return getattr(obj.donor, "phone_number", None)

    def get_pooja_option_name(self, obj):  # pragma: no cover
        return getattr(obj.pooja_option, "name", None)

    def get_day_option_description(self, obj):  # pragma: no cover
        return getattr(obj.day_option, "description", None)
