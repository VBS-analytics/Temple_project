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
from accounts.models import UserRole


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
            "date_of_birth",
            "family_name",
            "tamil_star",
            "gothra",
        )
        read_only_fields = ("id",)
        extra_kwargs = {
            "date_of_birth": {"required": False, "allow_null": True},
            "family_name": {"required": False, "allow_blank": True},
            "tamil_star": {"required": False, "allow_blank": True},
            "gothra": {"required": False, "allow_blank": True},
            "phone_number": {"required": False, "allow_blank": True},
            "relationship": {"required": False, "allow_blank": True},
        }


class PoojaRegistrationSerializer(serializers.ModelSerializer):
    members = PoojaRegistrationMemberSerializer(many=True, required=False)
    donor_name = serializers.SerializerMethodField()
    donor_phone = serializers.SerializerMethodField()
    pooja_option_name = serializers.SerializerMethodField()
    pooja_option_code = serializers.SerializerMethodField()
    day_option_description = serializers.SerializerMethodField()
    day_option_category = serializers.SerializerMethodField()
    pooja_reg_id = serializers.SerializerMethodField()

    class Meta:
        model = PoojaRegistration
        fields = (
            "id",
            "donor",
            "donor_name",
            "donor_phone",
            "pooja_reg_id",
            "pooja_option",
            "pooja_option_name",
            "pooja_option_code",
            "day_option",
            "day_option_description",
            "day_option_category",
            "start_date",
            "quantity",
            "is_group_registration",
            "post_prasadam",
            "additional_notes",
            "total_amount",
            "status",
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
            "pooja_option_code",
            "day_option_description",
            "day_option_category",
            "pooja_reg_id",
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

    def get_pooja_option_code(self, obj):  # pragma: no cover
        return getattr(obj.pooja_option, "code", None)

    def get_day_option_description(self, obj):  # pragma: no cover
        return getattr(obj.day_option, "description", None)

    def get_day_option_category(self, obj):  # pragma: no cover
        return getattr(obj.day_option, "category", None)

    def get_pooja_reg_id(self, obj):
        return obj.pooja_reg_id


class PublicTodayRegistrationMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PoojaRegistrationMember
        fields = (
            "id",
            "name",
        )
        read_only_fields = (
            "id",
            "name",
        )


class PublicTodayPoojaRegistrationSerializer(serializers.ModelSerializer):
    pooja_reg_id = serializers.CharField(allow_null=True, read_only=True)
    pooja_option_name = serializers.SerializerMethodField()
    day_option_description = serializers.SerializerMethodField()
    donor_name = serializers.SerializerMethodField()
    members = PublicTodayRegistrationMemberSerializer(many=True, read_only=True)

    class Meta:
        model = PoojaRegistration
        fields = (
            "id",
            "pooja_reg_id",
            "start_date",
            "pooja_option_name",
            "day_option_description",
            "donor_name",
            "post_prasadam",
            "created_at",
            "members",
        )

    def get_pooja_option_name(self, obj):
        option = getattr(obj, "pooja_option", None)
        if option is None:
            return ""
        name = getattr(option, "name", "") or ""
        return name.strip()

    def get_day_option_description(self, obj):
        option = getattr(obj, "day_option", None)
        if option is None:
            return ""
        description = getattr(option, "description", "") or ""
        return description.strip()

    def get_donor_name(self, obj):
        donor = getattr(obj, "donor", None)
        if donor is None:
            return "Temple Admin"
        name = getattr(donor, "name", "") or ""
        if name.strip():
            return name.strip()
        username = getattr(donor, "username", "") or ""
        if username.strip():
            return username.strip()
        email = getattr(donor, "email", "") or ""
        if email.strip():
            return email.strip()
        return "Temple Admin"


class LandingPoojaRegistrationSerializer(serializers.ModelSerializer):
    pooja_name = serializers.CharField(source="pooja_option.name", default="")
    day_option = serializers.CharField(source="day_option.description", default="")
    donor_name = serializers.SerializerMethodField()
    status = serializers.CharField()

    class Meta:
        model = PoojaRegistration
        fields = (
            "id",
            "pooja_name",
            "day_option",
            "donor_name",
            "status",
            "created_at",
        )

    def get_donor_name(self, obj):
        donor = getattr(obj, "donor", None)
        if donor is None:
            return "Temple Admin"
        name = getattr(donor, "name", "") or ""
        if name.strip():
            return name.strip()
        username = getattr(donor, "username", "") or ""
        if username.strip():
            return username.strip()
        email = getattr(donor, "email", "") or ""
        if email.strip():
            return email.strip()
        return "Temple Admin"
