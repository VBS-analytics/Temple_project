"""Serializers for pooja domain."""

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import (
    DailyMessage,
    DonorMessageTemplate,
    FeaturedPooja,
    PoojaCartSnapshot,
    PoojaCartSnapshotExportEntry,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    PoojaRegistrationMember,
    RecurringPoojaPlan,
    RecurrenceFrequency,
    RecurrenceKind,
    SpecialAnnouncement,
)
from accounts.models import UserRole

from .services.recurrence import create_plan_from_registration, get_plan_due_summary


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
            "display_order",
        )
        read_only_fields = ("id", "display_order")


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


class SpecialAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecialAnnouncement
        fields = ("id", "label", "description", "created_at")
        read_only_fields = ("id", "created_at")


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
            "rasi",
            "gothra",
        )
        read_only_fields = ("id",)
        extra_kwargs = {
            "date_of_birth": {"required": False, "allow_null": True},
            "family_name": {"required": False, "allow_blank": True},
            "tamil_star": {"required": False, "allow_blank": True},
            "rasi": {"required": False, "allow_blank": True},
            "gothra": {"required": False, "allow_blank": True},
            "phone_number": {"required": False, "allow_blank": True},
            "relationship": {"required": False, "allow_blank": True},
        }


class PoojaRegistrationSerializer(serializers.ModelSerializer):
    members = PoojaRegistrationMemberSerializer(many=True, required=False)
    recurrence_kind = serializers.ChoiceField(
        choices=RecurrenceKind.choices,
        required=False,
        write_only=True,
    )
    recurrence_frequency = serializers.ChoiceField(
        choices=RecurrenceFrequency.choices,
        required=False,
        write_only=True,
    )
    recurrence_one_time_date = serializers.DateField(required=False, write_only=True, allow_null=True)
    cart_item = serializers.DictField(required=False, write_only=True)
    donor_name = serializers.SerializerMethodField()
    donor_phone = serializers.SerializerMethodField()
    pooja_option_name = serializers.SerializerMethodField()
    pooja_option_code = serializers.SerializerMethodField()
    day_option_description = serializers.SerializerMethodField()
    day_option_category = serializers.SerializerMethodField()
    pooja_reg_id = serializers.SerializerMethodField()
    created_at_override = serializers.DateTimeField(write_only=True, required=False, allow_null=True)

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
            "recurrence_kind",
            "recurrence_frequency",
            "recurrence_one_time_date",
            "cart_item",
            "created_at_override",
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

    def validate(self, attrs):
        """Ensure start_date is always set to prevent NULL values in database."""
        from django.utils import timezone
        
        # If start_date is not provided, default to today
        if attrs.get("start_date") is None:
            attrs["start_date"] = timezone.localdate()
        
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        members = validated_data.pop("members", [])
        recurrence_kind = validated_data.pop("recurrence_kind", None)
        recurrence_frequency = validated_data.pop("recurrence_frequency", None)
        recurrence_one_time_date = validated_data.pop("recurrence_one_time_date", None)
        cart_item_payload = validated_data.pop("cart_item", None)
        created_at_override = validated_data.pop("created_at_override", None)
        registration = PoojaRegistration.objects.create(**validated_data)
        self._sync_members(registration, members)
        if recurrence_kind:
            create_plan_from_registration(
                registration=registration,
                recurrence_kind=recurrence_kind,
                recurrence_frequency=recurrence_frequency,
                recurrence_one_time_date=recurrence_one_time_date,
                cart_item_payload=cart_item_payload,
            )
        if created_at_override:
            PoojaRegistration.objects.filter(pk=registration.pk).update(created_at=created_at_override)
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
        for member_data in members_payload or []:
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


class PoojaCartSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PoojaCartSnapshot
        fields = ("items", "updated_at")
        read_only_fields = ("updated_at",)

    def validate_items(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Items must be a list.")
        return value


class PoojaCartSnapshotExportEntrySerializer(serializers.ModelSerializer):
    updated_at = serializers.DateTimeField(source="source_updated_at", read_only=True)

    class Meta:
        model = PoojaCartSnapshotExportEntry
        fields = ("donor_id", "donor_name", "donor_phone", "items", "updated_at")
        read_only_fields = ("donor_id", "donor_name", "donor_phone", "items", "updated_at")


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


class RecurringPoojaPlanSerializer(serializers.ModelSerializer):
    pooja_option_name = serializers.CharField(source="pooja_option.name", read_only=True)
    pooja_option_code = serializers.CharField(source="pooja_option.code", read_only=True)
    day_option_description = serializers.SerializerMethodField()
    day_option_code = serializers.CharField(source="day_option.code", read_only=True)
    donor_name = serializers.SerializerMethodField()
    donor_phone = serializers.SerializerMethodField()
    donor_email = serializers.SerializerMethodField()
    origin_registration_created_at = serializers.DateTimeField(
        source="origin_registration.created_at", read_only=True
    )
    origin_registration_updated_at = serializers.DateTimeField(
        source="origin_registration.updated_at", read_only=True
    )
    origin_registration_id = serializers.IntegerField(read_only=True, required=False)
    due_registration = serializers.SerializerMethodField()

    class Meta:
        model = RecurringPoojaPlan
        fields = (
            "id",
            "pooja_option_name",
            "pooja_option_code",
            "day_option_description",
            "day_option_code",
            "donor_name",
            "donor_phone",
            "donor_email",
            "recurrence_kind",
            "recurrence_frequency",
            "start_date",
            "next_occurrence",
            "last_occurrence",
            "one_time_date",
            "amount",
            "is_active",
            "pause_from",
            "pause_until",
            "metadata",
            "cart_payload",
            "origin_registration_created_at",
            "origin_registration_updated_at",
            "origin_registration_id",
            "due_registration",
        )

    def get_day_option_description(self, obj):
        day_option = getattr(obj, "day_option", None)
        if day_option is None:
            return None
        return getattr(day_option, "description", "") or None

    def get_donor_name(self, obj):
        donor = getattr(obj, "donor", None)
        if donor is None:
            return None
        name = getattr(donor, "name", "") or ""
        if name.strip():
            return name.strip()
        username = getattr(donor, "username", "") or ""
        if username.strip():
            return username.strip()
        email = getattr(donor, "email", "") or ""
        if email.strip():
            return email.strip()
        return None

    def get_donor_phone(self, obj):
        donor = getattr(obj, "donor", None)
        if donor is None:
            return None
        return getattr(donor, "phone_number", None)

    def get_donor_email(self, obj):
        donor = getattr(obj, "donor", None)
        if donor is None:
            return None
        return getattr(donor, "email", None)

    def get_due_registration(self, obj):
        due_data = get_plan_due_summary(obj)
        if due_data is None:
            return None
        registration = due_data["registration"]
        due_amount = due_data["due_amount"]
        total_amount = due_data["total_amount"]
        paid_amount = due_data["total_paid"]
        return {
            "id": registration.id,
            "pooja_reg_id": getattr(registration, "pooja_reg_id", None),
            "start_date": registration.start_date,
            "total_amount": str(total_amount),
            "paid_amount": str(paid_amount),
            "due_amount": str(due_amount),
            "is_paid": due_amount <= Decimal("0.00"),
            "status": registration.status,
        }


class RecurringPoojaPlanUpdateSerializer(serializers.ModelSerializer):
    recurrence_frequency = serializers.ChoiceField(
        choices=RecurrenceFrequency.choices,
        required=False,
    )
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = RecurringPoojaPlan
        fields = ("recurrence_frequency", "amount")

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance and instance.recurrence_kind != RecurrenceKind.RECURRING and "recurrence_frequency" in attrs:
            raise serializers.ValidationError("Only recurring plans can change frequency.")
        return attrs

    def validate_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Amount must be zero or greater.")
        return value


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
