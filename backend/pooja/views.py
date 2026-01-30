"""ViewSets for pooja master data and registrations."""

from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import date, datetime, timedelta
from itertools import count
import calendar
from typing import Any

from django.db import transaction
from django.db.models import Max, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import DonorProfile, User, UserRole
from common.permissions import IsAdminRole, ReadOnlyOrAdmin
from payments.models import CombinePaymentMapping

from .models import (
    DailyMessage,
    DayOptionCategory,
    DonorMessageTemplate,
    FeaturedPooja,
    PoojaCartSnapshot,
    PoojaCartSnapshotExportBatch,
    PoojaCartSnapshotExportEntry,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    PoojaStatus,
    SpecialAnnouncement,
    RecurrenceKind,
    RecurringPoojaPlan,
)
from .services.calendar import TempleCalendarService, get_calendar_service
from .services.recurrence import (
    calculate_next_recurring_occurrence,
    find_due_registration,
    prepare_recurring_registration,
    process_recurring_plans,
    sum_successful_payments,
)
from .serializers import (
    DailyMessageSerializer,
    DonorMessageTemplateSerializer,
    FeaturedPoojaSerializer,
    PoojaCartSnapshotExportEntrySerializer,
    PoojaCartSnapshotSerializer,
    PoojaDayOptionSerializer,
    PoojaOptionSerializer,
    PoojaRegistrationSerializer,
    RecurringPoojaPlanSerializer,
    RecurringPoojaPlanUpdateSerializer,
    LandingPoojaRegistrationSerializer,
    PublicTodayPoojaRegistrationSerializer,
    SpecialAnnouncementSerializer,
)

PAUSE_REASON_NO_POJA_NO_PAYMENT = "No Pooja and No Payment"
PAUSE_REASON_USE_FOR_TEMPLE = "No Pooja and use the money for temple purpose"
PAUSE_REASON_SAMY = "Continue the pooja with the Samy's names"

SATURDAY_NAVAGRAHA_POOJA_NAME = "4 saturday navagraha pooja per month"
PRADOSHA_POOJA_NAME = "2 pradosha pooja per month"
TILL_OIL_FOR_LAMPS_NAME = "till oil for lamps"
NITYA_NEIVEDHYAM_NAME = "nitya neivedhyam"
GAU_SAMRAKHSHANA_SEVA_NAME = "gau samrakshana seva"


def _is_registration_in_pause_window(registration, pause_start):
    if registration is None:
        return False
    registration_date = getattr(registration, "start_date", None)
    if registration_date is None:
        return False
    return registration_date >= pause_start


def _round_to_whole_rupee(amount: Decimal) -> int:
    return int(amount.to_integral_value(rounding=ROUND_HALF_UP))


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        parsed = value.split("T", 1)[0]
        return date.fromisoformat(parsed)
    except ValueError:
        return None


def _credit_custom_balance(user, amount: Decimal):
    if amount <= Decimal("0.00"):
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    profile.custom_number = (profile.custom_number or 0) + _round_to_whole_rupee(amount)
    profile.save(update_fields=["custom_number"])


def _credit_monthly_donation(user, amount: Decimal):
    if amount <= Decimal("0.00"):
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    profile.monthly_donation_amount = (profile.monthly_donation_amount or Decimal("0.00")) + amount
    profile.save(update_fields=["monthly_donation_amount"])


def _debit_monthly_donation(user, amount: Decimal):
    if amount <= Decimal("0.00"):
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    current_value = profile.monthly_donation_amount or Decimal("0.00")
    updated_value = max(current_value - amount, Decimal("0.00"))
    if updated_value == current_value:
        return
    profile.monthly_donation_amount = updated_value
    profile.save(update_fields=["monthly_donation_amount"])


def _debit_custom_balance(user, amount):
    if amount is None or amount <= Decimal("0.00"):
        return
    deduction = _round_to_whole_rupee(amount)
    if deduction <= 0:
        return
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    current_balance = profile.custom_number or 0
    profile.custom_number = max(current_balance - deduction, 0)
    profile.save(update_fields=["custom_number"])


class PoojaOptionViewSet(viewsets.ModelViewSet):
    queryset = PoojaOption.objects.select_related("parent").prefetch_related("children")
    serializer_class = PoojaOptionSerializer
    permission_classes = (ReadOnlyOrAdmin,)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()

            if instance.is_group_header:
                PoojaOption.objects.filter(parent_id=instance.id).delete()

            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PoojaOption.DoesNotExist:
            return Response(
                {"detail": "Pooja option no longer exists"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def perform_create(self, serializer):
        parent = serializer.validated_data.get("parent")
        max_order = (
            PoojaOption.objects.filter(parent=parent)
            .aggregate(Max("display_order"))
            .get("display_order__max")
            or 0
        )
        serializer.save(display_order=max_order + 1)

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        ordered_ids = request.data.get("order")
        parent_id = request.data.get("parent_id")

        if parent_id is not None:
            try:
                parent_id = int(parent_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "parent_id must be an integer or null."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not isinstance(ordered_ids, list) or not all(isinstance(item, int) for item in ordered_ids):
            return Response(
                {"detail": "Order must be a list of integer IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filters = {"parent__isnull": True} if parent_id is None else {"parent_id": parent_id}
        sibling_ids = list(
            PoojaOption.objects.filter(**filters).order_by("display_order", "code").values_list("id", flat=True)
        )

        if len(ordered_ids) != len(sibling_ids) or set(ordered_ids) != set(sibling_ids):
            return Response(
                {"detail": "Order list must include all siblings for the given parent."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                for position, option_id in enumerate(ordered_ids, start=1):
                    PoojaOption.objects.filter(id=option_id).update(display_order=position)
            return Response({"detail": "Pooja options reordered."})
        except Exception as exc:
            return Response(
                {"detail": f"Unable to reorder options: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class PoojaDayOptionViewSet(viewsets.ModelViewSet):
    queryset = PoojaDayOption.objects.all()
    serializer_class = PoojaDayOptionSerializer
    permission_classes = (ReadOnlyOrAdmin,)

    def perform_create(self, serializer):  # pragma: no cover - simple aggregate call
        max_order = PoojaDayOption.objects.aggregate(Max("display_order")).get("display_order__max") or 0
        serializer.save(display_order=max_order + 1)

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        ordered_ids = request.data.get("order")
        if not isinstance(ordered_ids, list) or not all(isinstance(item, int) for item in ordered_ids):
            return Response({"detail": "Order must be a list of IDs."}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = set(PoojaDayOption.objects.filter(id__in=ordered_ids).values_list("id", flat=True))
        if len(existing_ids) != len(ordered_ids):
            return Response({"detail": "One or more IDs are invalid."}, status=status.HTTP_400_BAD_REQUEST)

        remaining_ids = list(
            PoojaDayOption.objects.exclude(id__in=ordered_ids).order_by("display_order", "id").values_list("id", flat=True)
        )
        final_order = [*ordered_ids, *remaining_ids]

        with transaction.atomic():
            for position, option_id in enumerate(final_order, start=1):
                PoojaDayOption.objects.filter(id=option_id).update(display_order=position)

        return Response({"detail": "Day options reordered."})

    @action(detail=True, methods=["get"], url_path="next-occurrence")
    def next_occurrence(self, request, pk=None):
        day_option = self.get_object()
        start_date_str = request.query_params.get("start_date")
        if start_date_str:
            try:
                parsed = datetime.fromisoformat(start_date_str)
                start_date = parsed.date()
            except ValueError:
                return Response({"detail": "start_date must be in ISO format (YYYY-MM-DD)."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            start_date = timezone.localdate()

        tamil_star_labels = None
        tamil_star_id = request.query_params.get("tamil_star_id")
        tamil_star_label = request.query_params.get("tamil_star")
        if tamil_star_id is not None:
            try:
                star_option = PoojaDayOption.objects.get(id=int(tamil_star_id), category="tamil_star")
                tamil_star_labels = [star_option.description, star_option.code]
            except (ValueError, PoojaDayOption.DoesNotExist):
                return Response({"detail": "Invalid tamil_star_id provided."}, status=status.HTTP_400_BAD_REQUEST)
        elif tamil_star_label:
            tamil_star_labels = [tamil_star_label]

        service = get_calendar_service()
        try:
            occurrence = service.next_occurrence(day_option.code, start_date, tamil_star_labels=tamil_star_labels)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        payload = {
            "day_option_id": day_option.id,
            "day_option_code": day_option.code,
            "start_date": start_date.isoformat(),
            "occurrence_date": occurrence.date.isoformat(),
            "occurrence_label": occurrence.description,
            "meta": occurrence.meta,
        }
        return Response(payload)


class FeaturedPoojaViewSet(viewsets.ModelViewSet):
    queryset = FeaturedPooja.objects.all()
    serializer_class = FeaturedPoojaSerializer

    def get_permissions(self):  # pragma: no cover - simple branching
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsAdminRole()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated and self.request.user.role == UserRole.ADMIN:
            return qs
        return qs.filter(is_active=True)


class DailyMessageViewSet(viewsets.ModelViewSet):
    queryset = DailyMessage.objects.all()
    serializer_class = DailyMessageSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class SpecialAnnouncementViewSet(viewsets.ModelViewSet):
    queryset = SpecialAnnouncement.objects.all()
    serializer_class = SpecialAnnouncementSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class DonorMessageTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = DonorMessageTemplateSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = DonorMessageTemplate.objects.filter(donor=self.request.user).select_related("day_option")
        return qs

    def perform_create(self, serializer):
        serializer.save(donor=self.request.user)


class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = PoojaRegistrationSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        process_recurring_plans()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        base_qs = PoojaRegistration.objects.select_related("pooja_option", "day_option", "donor")
        donor_id = self.request.query_params.get("donor_id")
        donor_phone = self.request.query_params.get("donor_phone")
        donor_search = self.request.query_params.get("donor")
        filters = Q()
        has_filters = False

        if donor_id:
            donor_id = donor_id.strip()
            if donor_id:
                try:
                    donor_id_value = int(donor_id)
                except ValueError:
                    donor_id_value = None
                if donor_id_value is not None:
                    filters &= Q(donor__id=donor_id_value)
                    has_filters = True

        if donor_phone:
            donor_phone = donor_phone.strip()
            if donor_phone:
                filters &= Q(donor__phone_number__icontains=donor_phone)
                has_filters = True

        if donor_search:
            donor_search = donor_search.strip()
            if donor_search:
                search_filters = Q(donor__phone_number__icontains=donor_search)
                if donor_search.isdigit():
                    search_filters |= Q(donor__id=int(donor_search))
                filters &= search_filters
                has_filters = True

        if self.request.user.role == UserRole.ADMIN:
            queryset = base_qs
        else:
            # For non-admin users: Include own registrations + active parent donor registrations
            current_month = timezone.localdate().replace(day=1)
            active_parent_ids = {
                mapping.parent_donor_id
                for mapping in CombinePaymentMapping.objects.filter(main_donor=self.request.user)
                if mapping.is_active_on(current_month) and mapping.parent_donor_id is not None
            }
            if active_parent_ids:
                queryset = base_qs.filter(Q(donor=self.request.user) | Q(donor_id__in=active_parent_ids))
            else:
                queryset = base_qs.filter(donor=self.request.user)

        if has_filters:
            queryset = queryset.filter(filters)

        return queryset.prefetch_related("members")

    def perform_create(self, serializer):
        serializer.save(donor=self.request.user)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.get_queryset()
        if request.user.role == UserRole.ADMIN:
            queryset = queryset.filter(donor=request.user)
        queryset = queryset.prefetch_related(Prefetch("members"))
        data = PoojaRegistrationSerializer(queryset, many=True, context={"request": request}).data
        return Response({"count": len(data), "results": data})

    @action(detail=False, methods=["get"], url_path="admin-overview")
    def admin_overview(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.select_related("donor", "pooja_option", "day_option")
            .prefetch_related("members")
            .order_by("donor__name", "donor_id", "-created_at")
        )

        grouped = {}
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                # Should not happen, but skip defensively
                continue
            donor_id = donor.id
            if donor_id not in grouped:
                grouped[donor_id] = {
                    "donor_id": donor_id,
                    "donor_name": donor.name,
                    "donor_phone": getattr(donor, "phone_number", ""),
                    "donor_email": getattr(donor, "email", None),
                    "registrations": [],
                }
            grouped[donor_id]["registrations"].append(registration)

        serializer_context = {"request": request}
        results = []
        for group in grouped.values():
            serialized_registrations = PoojaRegistrationSerializer(
                group["registrations"], many=True, context=serializer_context
            ).data
            results.append(
                {
                    "donor_id": group["donor_id"],
                    "donor_name": group["donor_name"],
                    "donor_phone": group["donor_phone"],
                    "donor_email": group["donor_email"],
                    "registrations": serialized_registrations,
                }
            )

        results.sort(key=lambda item: (item["donor_name"] or "").lower())
        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="donor-directory")
    def donor_directory(self, request):
        qs = User.objects.filter(role=UserRole.DONOR)
        if request.user.is_authenticated and request.user.role == UserRole.DONOR:
            qs = qs.exclude(id=request.user.id)
        donors = qs.order_by("name", "id").values("id", "name", "phone_number")
        payload = [
            {
                "id": entry["id"],
                "name": entry["name"] or "",
                "phone_number": entry["phone_number"] or "",
            }
            for entry in donors
        ]
        return Response(payload)

    @action(detail=False, methods=["get"], url_path="saturday-navagraha-report")
    def saturday_navagraha_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=SATURDAY_NAVAGRAHA_POOJA_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("donor__name", "donor__id", "start_date")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="pradosha-pooja-report")
    def pradosha_pooja_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=PRADOSHA_POOJA_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="till-oil-for-lamps-report")
    def till_oil_for_lamps_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=TILL_OIL_FOR_LAMPS_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="nitya-neivedhyam-report")
    def nitya_neivedhyam_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=NITYA_NEIVEDHYAM_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="gau-samrakshana-seva-report")
    def gau_samrakshana_seva_report(self, request):
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        queryset = (
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=GAU_SAMRAKHSHANA_SEVA_NAME,
                donor__isnull=False,
            )
            .select_related("donor")
            .order_by("start_date", "donor__name", "donor__id")
        )

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})


class RecurringPoojaPlanViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RecurringPoojaPlanSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        self._auto_resume_expired_pauses()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = RecurringPoojaPlan.objects.select_related(
            "donor", "pooja_option", "day_option", "origin_registration"
        )
        if self.request.user.role == UserRole.ADMIN:
            # Allow admin to filter by donor if donor parameter is provided
            donor_id = self.request.query_params.get('donor')
            if donor_id:
                try:
                    qs = qs.filter(donor_id=int(donor_id))
                except (ValueError, TypeError):
                    pass
            return qs.order_by("donor__name", "-next_occurrence", "-created_at")
        return qs.filter(donor=self.request.user).order_by("-next_occurrence", "-created_at")

    def get_serializer_class(self):
        if self.action in ('partial_update', 'update'):
            return RecurringPoojaPlanUpdateSerializer
        return RecurringPoojaPlanSerializer

    def get_object(self):
        plan = super().get_object()
        self._ensure_plan_access(plan)
        self._reactivate_plan(plan)
        return plan

    def _ensure_plan_access(self, plan: RecurringPoojaPlan) -> None:
        if self.request.user.role == UserRole.ADMIN:
            return
        if plan.donor_id != self.request.user.id:
            raise PermissionDenied("You can only manage your own recurring plans.")

    def _auto_resume_expired_pauses(self) -> None:
        today = timezone.localdate()
        queryset = self.filter_queryset(self.get_queryset())
        expired_plans = queryset.filter(
            pause_until__isnull=False,
            pause_until__lt=today,
            recurrence_kind=RecurrenceKind.RECURRING,
        )
        for plan in expired_plans:
            self._reactivate_plan(plan, reference_date=today)

    def _reactivate_plan(
        self,
        plan: RecurringPoojaPlan,
        *,
        reference_date=None,
        force: bool = False,
        additional_metadata_keys=None,
    ) -> bool:
        if plan.recurrence_kind != RecurrenceKind.RECURRING:
            return False
        today = reference_date or timezone.localdate()
        if not force and (plan.pause_until is None or plan.pause_until >= today):
            return False
        plan.pause_from = None
        plan.pause_until = None
        plan.is_active = True
        metadata = dict(plan.metadata or {})
        metadata.pop("pause_reason", None)
        metadata.pop("pause_handling_amount", None)
        for key in additional_metadata_keys or ():
            metadata.pop(key, None)
        plan.metadata = metadata
        next_occurrence = calculate_next_recurring_occurrence(plan, reference_date=today)
        if next_occurrence:
            plan.next_occurrence = next_occurrence
        plan.save(update_fields=["pause_from", "pause_until", "is_active", "metadata", "next_occurrence"])
        return True

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        plan = self.get_object()
        pause_from_value = request.data.get("pause_from")
        pause_until_value = request.data.get("pause_until")
        pause_reason_value = request.data.get("pause_reason")
        if not pause_until_value:
            return Response({"detail": "Provide a pause_until date."}, status=status.HTTP_400_BAD_REQUEST)
        pause_until = parse_date(pause_until_value)
        if pause_until is None:
            return Response({"detail": "Invalid date provided for pause_until."}, status=status.HTTP_400_BAD_REQUEST)
        pause_from = parse_date(pause_from_value) if pause_from_value else timezone.localdate()
        if pause_from is None:
            return Response({"detail": "Invalid date provided for pause_from."}, status=status.HTTP_400_BAD_REQUEST)
        today = timezone.localdate()
        if pause_from < today:
            return Response({"detail": "Pause start must be today or later."}, status=status.HTTP_400_BAD_REQUEST)
        if pause_until <= pause_from:
            return Response({"detail": "Pause end must be after the pause start."}, status=status.HTTP_400_BAD_REQUEST)
        metadata = dict(plan.metadata or {})
        due_registration = find_due_registration(plan, pause_from)
        paid_amount = sum_successful_payments(due_registration)
        if pause_reason_value == PAUSE_REASON_NO_POJA_NO_PAYMENT:
            _credit_custom_balance(plan.donor, paid_amount)
        elif pause_reason_value == PAUSE_REASON_USE_FOR_TEMPLE:
            if paid_amount > Decimal("0.00") and _is_registration_in_pause_window(due_registration, pause_from):
                _credit_monthly_donation(plan.donor, paid_amount)
        elif pause_reason_value == PAUSE_REASON_SAMY and paid_amount > Decimal("0.00"):
            metadata["handled_for_samy"] = True
        if pause_reason_value:
            metadata["pause_reason"] = pause_reason_value
        else:
            metadata.pop("pause_reason", None)
        if paid_amount > Decimal("0.00"):
            metadata["pause_handling_amount"] = str(paid_amount)
        plan.metadata = metadata
        plan.pause_from = pause_from
        plan.pause_until = pause_until
        plan.is_active = False
        plan.save()
        serializer = self.get_serializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="resume")
    def resume(self, request, pk=None):
        plan = self.get_object()
        was_paused = bool(plan.pause_until or plan.pause_from or not plan.is_active)
        pause_metadata = dict(plan.metadata or {})
        pause_reason = pause_metadata.get("pause_reason")
        pause_handling_amount = pause_metadata.get("pause_handling_amount")
        pause_until = plan.pause_until
        reactivated = self._reactivate_plan(
            plan,
            force=True,
            additional_metadata_keys=("canceled_at",),
        )
        if reactivated and was_paused:
            _debit_custom_balance(plan.donor, plan.amount)
            if (
                pause_reason == PAUSE_REASON_USE_FOR_TEMPLE
                and pause_handling_amount
                and pause_until
                and pause_until > timezone.localdate()
            ):
                try:
                    amount_to_reverse = Decimal(pause_handling_amount)
                except (InvalidOperation, TypeError):
                    amount_to_reverse = Decimal("0.00")
                _debit_monthly_donation(plan.donor, amount_to_reverse)
        serializer = self.get_serializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="prepare-payment")
    def prepare_payment(self, request, pk=None):
        plan = self.get_object()
        if plan.recurrence_kind != RecurrenceKind.RECURRING or not plan.is_active:
            return Response(
                {"detail": "Only active recurring plans can be prepared for payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        registration = prepare_recurring_registration(plan)
        if registration is None:
            return Response(
                {
                    "detail": "Unable to prepare the registration for payment at this time."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = PoojaRegistrationSerializer(registration, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        plan = self.get_object()
        plan.pause_from = None
        plan.pause_until = None
        plan.is_active = False
        plan.next_occurrence = None
        metadata = dict(plan.metadata or {})
        metadata.pop("pause_reason", None)
        metadata["canceled_at"] = timezone.localdate().isoformat()
        plan.metadata = metadata
        plan.save()
        serializer = self.get_serializer(plan)
        return Response(serializer.data)


class PoojaCartSnapshotView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def _ensure_donor(self, request):
        if request.user.role != UserRole.DONOR:
            raise PermissionDenied("Only donor accounts can manage cart snapshots.")

    def get(self, request):
        self._ensure_donor(request)
        snapshot, _ = PoojaCartSnapshot.objects.get_or_create(donor=request.user)
        serializer = PoojaCartSnapshotSerializer(snapshot)
        return Response(serializer.data)

    def put(self, request):
        self._ensure_donor(request)
        snapshot, _ = PoojaCartSnapshot.objects.get_or_create(donor=request.user)
        serializer = PoojaCartSnapshotSerializer(instance=snapshot, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PoojaCartSnapshotAssignView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        donor_id_raw = request.data.get("donor_id")
        if donor_id_raw is None:
            return Response(
                {"detail": "donor_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            donor_id = int(donor_id_raw)
        except (TypeError, ValueError):
            return Response({"detail": "donor_id must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        donor_user = User.objects.filter(id=donor_id, role=UserRole.DONOR).first()
        if donor_user is None:
            return Response({"detail": "Donor not found."}, status=status.HTTP_404_NOT_FOUND)

        if donor_user != request.user and request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Cannot update snapshots for other donors.")

        snapshot, _ = PoojaCartSnapshot.objects.get_or_create(donor=donor_user)
        serializer = PoojaCartSnapshotSerializer(instance=snapshot, data={"items": request.data.get("items", [])})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CombinePaymentLookupView(APIView):
    """Fetch cart selections for a donor to support group / combined payments."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        donor_id_raw = request.query_params.get("donor_id")
        donor_phone_raw = request.query_params.get("phone")

        if not donor_id_raw and not donor_phone_raw:
            return Response(
                {"detail": "Provide a donor_id or phone query parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        donor_user = None

        if donor_id_raw:
            try:
                donor_id = int(donor_id_raw)
            except (TypeError, ValueError):
                return Response({"detail": "Invalid donor_id provided."}, status=status.HTTP_400_BAD_REQUEST)
            donor_user = User.objects.filter(id=donor_id, role=UserRole.DONOR).first()
        else:
            donor_phone = (donor_phone_raw or "").strip()
            if not donor_phone:
                return Response({"detail": "Provide a donor phone number."}, status=status.HTTP_400_BAD_REQUEST)
            donor_user = User.objects.filter(phone_number__iexact=donor_phone, role=UserRole.DONOR).first()

        if donor_user is None:
            return Response({"detail": "Donor not found."}, status=status.HTTP_404_NOT_FOUND)

        snapshot = PoojaCartSnapshot.objects.filter(donor=donor_user).first()
        items = snapshot.items if snapshot else []

        payload = {
            "donor_id": donor_user.id,
            "donor_name": donor_user.name,
            "donor_phone": donor_user.phone_number,
            "items": items,
        }
        return Response(payload)


class PoojaCartSnapshotReportView(APIView):
    permission_classes = (IsAdminRole,)

    def _create_export_batch(self, user, snapshots):
        batch = PoojaCartSnapshotExportBatch.objects.create(created_by=user)
        entries = []
        snapshot_list = list(snapshots)
        for snapshot in snapshot_list:
            donor = getattr(snapshot, "donor", None)
            entries.append(
                PoojaCartSnapshotExportEntry(
                    batch=batch,
                    donor_id=getattr(snapshot, "donor_id", None),
                    donor_name=(getattr(donor, "name", "") or ""),
                    donor_phone=(getattr(donor, "phone_number", "") or ""),
                    items=list(snapshot.items or []),
                    source_updated_at=snapshot.updated_at,
                )
            )
        if entries:
            PoojaCartSnapshotExportEntry.objects.bulk_create(entries)
        return batch

    def get(self, request):
        donor_id_raw = request.query_params.get("donor_id")
        donor_phone_raw = request.query_params.get("phone")
        batch_id_raw = request.query_params.get("batch_id")

        batch = None
        if batch_id_raw:
            try:
                batch_id = int(batch_id_raw)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "batch_id must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            batch = PoojaCartSnapshotExportBatch.objects.filter(id=batch_id).first()
            if batch is None:
                return Response(
                    {"detail": "Export batch not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            queryset = PoojaCartSnapshot.objects.select_related("donor").order_by("-updated_at")
            if donor_id_raw:
                try:
                    donor_id = int(donor_id_raw)
                except (TypeError, ValueError):
                    return Response(
                        {"detail": "donor_id must be an integer."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                queryset = queryset.filter(donor_id=donor_id)
            elif donor_phone_raw:
                donor_phone = donor_phone_raw.strip()
                queryset = queryset.filter(donor__phone_number__iexact=donor_phone)
            batch = self._create_export_batch(request.user, queryset)

        entries = batch.entries.order_by("donor_id", "id")
        serializer = PoojaCartSnapshotExportEntrySerializer(entries, many=True)
        return Response(serializer.data)


CALENDAR_DAY_OPTION_CANONICAL_CODES = {
    "gregorian_1st",
    "tamil_1st",
    "first_tuesday",
    "last_saturday",
    "weekly_sunday",
    "sashti",
    "second_ashtami",
    "pradosham",
    "pournami",
    "amavasya",
    "sankata_chaturthi",
    "chaturthi",
}


def _collect_tithi_dates_in_range(service: TempleCalendarService, start: date, end: date, targets: tuple[int, ...]) -> list[date]:
    occurrences = service._collect_tithi_dates(start, end, targets)
    return service._compress_consecutive_dates(occurrences)


def _collect_tamil_month_starts(service: TempleCalendarService, start: date, end: date) -> list[date]:
    dates: list[date] = []
    cursor = start
    while cursor <= end:
        if service._is_tamil_month_start(cursor):
            dates.append(cursor)
        cursor += timedelta(days=1)
    return dates


def _collect_dates_for_canonical(service: TempleCalendarService, canonical: str, start: date, end: date) -> list[date]:
    if canonical == "gregorian_1st":
        return [start]
    if canonical == "tamil_1st":
        return _collect_tamil_month_starts(service, start, end)
    if canonical == "first_tuesday":
        candidate = service._first_weekday_of_month(start, weekday=1)
        return [candidate] if start <= candidate <= end else []
    if canonical == "last_saturday":
        candidate = service._last_weekday_of_month(start, weekday=5)
        return [candidate] if start <= candidate <= end else []
    if canonical == "weekly_sunday":
        return service._weekday_window(start, end, weekday=6)
    if canonical == "sashti":
        return _collect_tithi_dates_in_range(service, start, end, targets=(6, 21))
    if canonical == "second_ashtami":
        occurrences = service._upcoming_ashtami_window(start)
        return [occurrence_date for occurrence_date in occurrences if start <= occurrence_date <= end]
    if canonical == "pradosham":
        return _collect_tithi_dates_in_range(service, start, end, targets=(13, 28))
    if canonical == "pournami":
        return _collect_tithi_dates_in_range(service, start, end, targets=(15,))
    if canonical == "amavasya":
        return _collect_tithi_dates_in_range(service, start, end, targets=(30,))
    if canonical == "sankata_chaturthi":
        return _collect_tithi_dates_in_range(service, start, end, targets=(19,))
    if canonical == "chaturthi":
        return _collect_tithi_dates_in_range(service, start, end, targets=(4,))
    return []


@method_decorator(cache_page(60 * 60), name="dispatch")
class PoojaDayOptionCalendarView(APIView):
    permission_classes = (IsAdminRole,)

    def get(self, request):
        today = timezone.localdate()
        try:
            year = int(request.query_params.get("year", today.year))
        except (TypeError, ValueError):
            year = today.year
        if year < 1 or year > 9999:
            year = today.year
        try:
            month = int(request.query_params.get("month", today.month))
        except (TypeError, ValueError):
            month = today.month
        if month < 1:
            month = 1
        elif month > 12:
            month = 12

        first_day = date(year, month, 1)
        service = get_calendar_service()
        last_day = service._month_end(first_day)

        canonical_options: dict[str, list[PoojaDayOption]] = {}
        for option in PoojaDayOption.objects.order_by("display_order", "id"):
            canonical = TempleCalendarService._canonicalize_code(option.code)
            if canonical in CALENDAR_DAY_OPTION_CANONICAL_CODES:
                canonical_options.setdefault(canonical, []).append(option)

        date_to_options: dict[date, list[PoojaDayOption]] = {}
        cursor = first_day
        while cursor <= last_day:
            date_to_options[cursor] = []
            cursor += timedelta(days=1)

        for canonical, options in canonical_options.items():
            for occurrence in _collect_dates_for_canonical(service, canonical, first_day, last_day):
                if occurrence in date_to_options:
                    date_to_options[occurrence].extend(options)

        for options in date_to_options.values():
            options.sort(key=lambda opt: (opt.display_order, opt.code))

        payload_dates = []
        cursor = first_day
        while cursor <= last_day:
            payload_dates.append(
                {
                    "date": cursor.isoformat(),
                    "day_options": [
                        {
                            "id": opt.id,
                            "code": opt.code,
                            "description": opt.description,
                            "display_order": opt.display_order,
                            "category": opt.category,
                        }
                        for opt in date_to_options[cursor]
                    ],
                }
            )
            cursor += timedelta(days=1)

        return Response({"year": year, "month": month, "dates": payload_dates})


class TamilNakshatraCalendarView(APIView):
    permission_classes = (IsAdminRole,)

    def get(self, request):
        today = timezone.localdate()
        try:
            year = int(request.query_params.get("year", today.year))
        except (TypeError, ValueError):
            year = today.year
        if year < 1 or year > 9999:
            year = today.year
        try:
            month = int(request.query_params.get("month", today.month))
        except (TypeError, ValueError):
            month = today.month
        if month < 1:
            month = 1
        elif month > 12:
            month = 12
        cursor = date(year, month, 1)
        results = []
        service = get_calendar_service()
        while cursor.month == month:
            results.append(
                {
                    "date": cursor.isoformat(),
                    "index": service.nakshatra_index_on(cursor),
                    "tamil_star": service.nakshatra_name_on(cursor),
                    "tamil_star_native": service.nakshatra_native_name_on(cursor),
                }
            )
            cursor += timedelta(days=1)
        return Response(results)


class PoojaDonorCalendarView(APIView):
    permission_classes = (IsAdminRole,)

    def get(self, request):
        today = timezone.localdate()
        try:
            year = int(request.query_params.get("year", today.year))
        except (TypeError, ValueError):
            year = today.year
        if year < 1 or year > 9999:
            year = today.year
        try:
            month = int(request.query_params.get("month", today.month))
        except (TypeError, ValueError):
            month = today.month
        if month < 1:
            month = 1
        elif month > 12:
            month = 12

        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        service = get_calendar_service()
        canonical_occurrences_cache: dict[str, list[date]] = {}
        debug_mode = request.query_params.get("debug") == "1"
        debug_info: list[dict[str, Any]] = [] if debug_mode else []
        snapshot_option_counter = count(-1, -1)

        queryset = (
            PoojaRegistration.objects.filter(
                donor__isnull=False,
                status__in=(PoojaStatus.PENDING, PoojaStatus.CONFIRMED, PoojaStatus.COMPLETED),
            )
            .filter(
                Q(start_date__range=(first_day, last_day))
                | Q(start_date__isnull=True, created_at__date__range=(first_day, last_day))
            )
            .select_related("donor", "day_option")
            .order_by("start_date", "created_at", "donor__name", "donor__id")
        )

        donors_by_date: dict[date, list[dict[str, str]]] = defaultdict(list)
        seen_donor_ids: dict[date, set[int]] = defaultdict(set)
        day_options_by_date: dict[date, dict[int, dict[str, Any]]] = defaultdict(dict)

        def build_day_option_payload(option: PoojaDayOption | None) -> dict[str, Any] | None:
            if option is None or option.id is None:
                return None
            return {
                "id": option.id,
                "code": option.code or "",
                "description": option.description or "",
                "category": option.category or "",
                "display_order": option.display_order or 0,
            }

        def build_snapshot_day_option_payload(item: dict[str, Any]) -> dict[str, Any] | None:
            option = None
            option_id = item.get("dayOptionId")
            if option_id:
                option = PoojaDayOption.objects.filter(id=option_id).first()
            if option is None:
                day_option_code = item.get("dayOptionCode")
                if day_option_code:
                    option = PoojaDayOption.objects.filter(code=day_option_code).first()
            if option is not None:
                return build_day_option_payload(option)
            raw_code = item.get("dayOptionCode") or ""
            raw_description = item.get("dayOptionDescription") or item.get("dayOptionLabel") or raw_code or ""
            description_value = raw_description.strip() if isinstance(raw_description, str) else str(raw_description or "").strip()
            label = description_value or ""
            return {
                "id": next(snapshot_option_counter),
                "code": raw_code,
                "description": label,
                "category": item.get("dayOptionCategory") or DayOptionCategory.CODE,
                "display_order": 0,
            }

        def record_day_option_entry(target_date: date | None, payload: dict[str, Any] | None):
            if target_date is None or payload is None:
                return
            option_id = payload.get("id")
            if option_id is None:
                return
            entries = day_options_by_date[target_date]
            entries.setdefault(option_id, payload)

        for registration in queryset:
            registration_date = registration.start_date or (
                registration.created_at.date() if registration.created_at else None
            )
            donor = registration.donor
            if registration_date is None or donor is None:
                continue
            donor_payload = {
                "name": donor.name or "",
                "phone_number": donor.phone_number or "",
            }

            def add_donor_for_date(target_date: date | None, day_option_for_date: dict[str, Any] | None = None) -> bool:
                if target_date is None or target_date < first_day or target_date > last_day:
                    return False
                if donor.id in seen_donor_ids[target_date]:
                    return False
                seen_donor_ids[target_date].add(donor.id)
                donors_by_date[target_date].append(donor_payload)
                record_day_option_entry(target_date, day_option_for_date)
                return True

            day_option = getattr(registration, "day_option", None)
            day_option_payload = build_day_option_payload(day_option)
            add_donor_for_date(registration_date, day_option_payload)
            if day_option:
                canonical_code = TempleCalendarService._canonicalize_code(day_option.code or "")
                if canonical_code in CALENDAR_DAY_OPTION_CANONICAL_CODES:
                    occurrences = canonical_occurrences_cache.get(canonical_code)
                    if occurrences is None:
                        occurrences = _collect_dates_for_canonical(service, canonical_code, first_day, last_day)
                        canonical_occurrences_cache[canonical_code] = occurrences
                    anchor_date = registration_date or (
                        registration.created_at.date() if registration.created_at else first_day
                    )
                    anchor_date = anchor_date if anchor_date >= first_day else first_day
                    for occurrence_date in occurrences:
                        if occurrence_date < anchor_date:
                            continue
                        add_donor_for_date(occurrence_date, day_option_payload)
                    if debug_mode:
                        debug_info.append(
                            {
                                "registration": registration.id,
                                "day_option_code": day_option.code,
                                "canonical_code": canonical_code,
                                "occurrences": [occurrence_date.isoformat() for occurrence_date in occurrences],
                                "anchor_date": anchor_date.isoformat(),
                            }
                        )

        cart_snapshots = PoojaCartSnapshot.objects.select_related("donor")
        for snapshot in cart_snapshots:
            donor = getattr(snapshot, "donor", None)
            if donor is None:
                continue
            for item in snapshot.items or []:
                registration_date = _parse_iso_date(item.get("customDayDate") or item.get("bookingDate"))
                if registration_date is None or not (first_day <= registration_date <= last_day):
                    continue
                if donor.id in seen_donor_ids[registration_date]:
                    continue
                seen_donor_ids[registration_date].add(donor.id)
                donors_by_date[registration_date].append(
                    {
                        "name": donor.name or "",
                        "phone_number": donor.phone_number or "",
                    }
                )
                snapshot_option_payload = build_snapshot_day_option_payload(item)
                record_day_option_entry(registration_date, snapshot_option_payload)
                # Include additional upcoming occurrence dates stored on the cart
                occurrences = item.get("dayOptionOccurrences")
                if isinstance(occurrences, list):
                    for occurrence in occurrences:
                        occurrence_date = _parse_iso_date(occurrence.get("date"))
                        if occurrence_date is None or not (first_day <= occurrence_date <= last_day):
                            continue
                        if donor.id in seen_donor_ids[occurrence_date]:
                            continue
                        seen_donor_ids[occurrence_date].add(donor.id)
                        donors_by_date[occurrence_date].append(
                            {
                                "name": donor.name or "",
                                "phone_number": donor.phone_number or "",
                            }
                        )
                        record_day_option_entry(occurrence_date, snapshot_option_payload)

        recurring_plans = (
            RecurringPoojaPlan.objects.filter(
                is_active=True,
                recurrence_kind=RecurrenceKind.RECURRING,
            )
            .select_related("donor")
            .order_by("donor__name", "donor__id")
        )
        for plan in recurring_plans:
            donor = getattr(plan, "donor", None)
            if donor is None:
                continue
            payload = getattr(plan, "cart_payload", {}) or {}
            plan_day_option_payload = build_day_option_payload(plan.day_option)
            occurrences = payload.get("dayOptionOccurrences")
            added = False
            if isinstance(occurrences, list):
                for entry in occurrences:
                    occurrence_date = _parse_iso_date(entry.get("date"))
                    if (
                        occurrence_date is None
                        or occurrence_date < first_day
                        or occurrence_date > last_day
                        or donor.id in seen_donor_ids[occurrence_date]
                    ):
                        continue
                    seen_donor_ids[occurrence_date].add(donor.id)
                    donors_by_date[occurrence_date].append(
                        {
                            "name": donor.name or "",
                            "phone_number": donor.phone_number or "",
                        }
                    )
                    added = True
                    record_day_option_entry(occurrence_date, plan_day_option_payload)
            if added:
                continue
            target_date = plan.next_occurrence
            if (
                target_date is None
                or target_date < first_day
                or target_date > last_day
                or donor.id in seen_donor_ids[target_date]
            ):
                continue
            seen_donor_ids[target_date].add(donor.id)
            donors_by_date[target_date].append(
                {
                    "name": donor.name or "",
                    "phone_number": donor.phone_number or "",
                }
            )
            record_day_option_entry(target_date, plan_day_option_payload)

        payload_dates = []
        cursor = first_day
        while cursor <= last_day:
            donors = donors_by_date.get(cursor, [])
            names = [donor["name"].strip() for donor in donors if donor["name"].strip()]
            phones = [donor["phone_number"].strip() for donor in donors if donor["phone_number"].strip()]
            names_label = ", ".join(names) if names else ""
            phones_label = ", ".join(phones) if phones else ""
            day_option_entries = list(day_options_by_date.get(cursor, {}).values())
            day_option_entries.sort(key=lambda opt: (opt.get("display_order", 0), opt.get("code") or ""))
            payload_dates.append(
                {
                    "date": cursor.isoformat(),
                    "donors": donors,
                    "donor_names": names_label,
                    "donor_phones": phones_label,
                    "day_options": day_option_entries,
                }
            )
            cursor += timedelta(days=1)

        response_payload = {"year": year, "month": month, "dates": payload_dates}
        if debug_mode:
            response_payload["debug"] = debug_info
        return Response(response_payload)


class RecentPoojaRegistrationsView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        queryset = (
            PoojaRegistration.objects.select_related("pooja_option", "day_option", "donor")
            .filter(status__in=("confirmed", "completed"))
            .order_by("-created_at")[:5]
        )
        serializer = LandingPoojaRegistrationSerializer(queryset, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})


class TodayPoojaRegistrationsPublicView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        today = timezone.localdate()
        queryset = (
            PoojaRegistration.objects.select_related("pooja_option", "day_option", "donor")
            .prefetch_related("members")
            .filter(start_date=today)
            .order_by("-created_at")
        )
        serializer = PublicTodayPoojaRegistrationSerializer(queryset, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})
