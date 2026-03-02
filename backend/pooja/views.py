"""ViewSets for pooja master data and registrations."""

from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import date, datetime, timedelta
from itertools import count
import calendar
import re
import sys
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Max, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.access import can_download_reports, REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE
from accounts.models import DonorProfile, User, UserRole
from common.permissions import IsAdminRole, ReadOnlyOrAdmin
from payments.models import CombinePaymentMapping, PaymentRecord, PaymentStatus

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
from .services.recurrence import create_plan_from_registration
from .services.calendar import TempleCalendarService, get_calendar_service
from .services.recurrence import (
    calculate_next_recurring_occurrence,
    find_due_registration,
    prepare_recurring_registration,
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

class LargePagePagination(PageNumberPagination):
    page_size = 200
    page_size_query_param = "page_size"
    max_page_size = 1000

PAUSE_REASON_NO_POJA_NO_PAYMENT = "No Pooja and No Payment"
PAUSE_REASON_USE_FOR_TEMPLE = "No Pooja and use the money for temple purpose"
PAUSE_REASON_SAMY = "Continue the pooja with the Swamy's names"

SATURDAY_NAVAGRAHA_POOJA_NAME = "4 saturday navagraha pooja per month"
PRADOSHA_POOJA_NAME = "2 pradosha pooja per month"
TILL_OIL_FOR_LAMPS_NAME = "till oil for lamps"
NITYA_NEIVEDHYAM_NAME = "nitya neivedhyam"
GAU_SAMRAKHSHANA_SEVA_NAME = "gau samrakshana seva"
GEN_DONATION_POOJA_NAME = "gen donation"
UBHAYAM_EXCLUDED_PARENT_CODES = {"SPECIAL"}
UBHAYAM_EXCLUDED_POOJA_CODES = {"GP1", "GP2", "GP3", "GP4", "GP6"}
UBHAYAM_EXCLUDED_POOJA_NAMES = {
    SATURDAY_NAVAGRAHA_POOJA_NAME,
    "saturday navagraha pooja",
    PRADOSHA_POOJA_NAME,
    "pradosha pooja",
    TILL_OIL_FOR_LAMPS_NAME,
    NITYA_NEIVEDHYAM_NAME,
    GAU_SAMRAKHSHANA_SEVA_NAME,
    "gau samrakhshana seva",
    "sivan koil kumbabishekam",
    "aarudhra darsanam pooja",
    GEN_DONATION_POOJA_NAME,
    "gen donation pooja",
    "mahashivrathri",
    "mahashivratri",
    "navarathri for 1 day pooja",
    "navaratri for 1 day pooja",
}
POOJA_REGISTRATION_ACCESS_DENIED_MESSAGE = "Please contact Admin for the pooja registration"
ANY_DAY_OPTION_CODES = {"AD", "ANYDAY"}
ANY_DAY_OPTION_DESCRIPTIONS = {
    "any day of month",
    "any day of the month",
}
RUNNING_TESTS = "test" in sys.argv


def _normalize_text(value: str | None) -> str:
    return re.sub(
        r"\s+",
        " ",
        re.sub(r"[^a-z0-9 ]", " ", (value or "").strip().lower()),
    ).strip()


UBHAYAM_EXCLUDED_POOJA_NORMALIZED_NAMES = {
    _normalize_text(name) for name in UBHAYAM_EXCLUDED_POOJA_NAMES
}


def _ensure_report_download_access(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise PermissionDenied("Admin access required.")
    if not can_download_reports(user):
        raise PermissionDenied(REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)


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


def _is_any_day_option(code: str | None, description: str | None) -> bool:
    normalized_code = (code or "").strip().upper()
    if normalized_code in ANY_DAY_OPTION_CODES:
        return True
    return _normalize_text(description) in ANY_DAY_OPTION_DESCRIPTIONS


def _resolve_donor_identifier(donor: User | None) -> str:
    if donor is None:
        return ""
    profile = getattr(donor, "profile", None)
    donor_number = getattr(profile, "donor_number", None)
    if donor_number:
        return f"D{donor_number}"
    donor_pk = getattr(donor, "id", None)
    return str(donor_pk) if donor_pk is not None else ""


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

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        registration = self.get_object()
        payments = PaymentRecord.objects.filter(registration=registration)
        if payments.filter(status=PaymentStatus.SUCCESS).exists():
            return Response(
                {
                    "detail": "From your side it is not possible to delete, please contact the Temple Admin."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        payments.delete()
        registration.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = PoojaRegistrationSerializer
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = LargePagePagination

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
            # For non-admin users: show only their own registrations.
            # Parent-donor registrations are surfaced via Combine Payment views instead of this endpoint
            # to avoid mixing ownership in the main profile tabs.
            queryset = base_qs.filter(donor=self.request.user)

        if has_filters:
            queryset = queryset.filter(filters)

        return queryset.prefetch_related("members")

    def perform_create(self, serializer):
        if self.request.user.role != UserRole.ADMIN:
            donor_profile, _ = DonorProfile.objects.get_or_create(user=self.request.user)
            if not donor_profile.pooja_registration_access:
                raise PermissionDenied(POOJA_REGISTRATION_ACCESS_DENIED_MESSAGE)
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
        _ensure_report_download_access(request.user)

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
        _ensure_report_download_access(request.user)

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
        _ensure_report_download_access(request.user)

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
        _ensure_report_download_access(request.user)

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
        _ensure_report_download_access(request.user)

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

    @action(detail=False, methods=["get"], url_path="post-prasadam-report")
    def post_prasadam_report(self, request):
        _ensure_report_download_access(request.user)

        queryset = (
            PoojaRegistration.objects.filter(
                post_prasadam=True,
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
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RecurringPoojaPlanSerializer
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = LargePagePagination

    def list(self, request, *args, **kwargs):
        self._auto_resume_expired_pauses()
        self._backfill_missing_chrt_plans()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = RecurringPoojaPlan.objects.select_related(
            "donor",
            "pooja_option",
            "day_option",
            "origin_registration",
            "due_registration",
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

    def _backfill_missing_chrt_plans(self) -> None:
        """
        Automatically create CHRT recurring plans for CHRT registrations that were saved
        without a corresponding RecurringPoojaPlan (legacy gap that collapses counts).
        Runs only for the current donor (non-admin) or filtered donor (admin).
        """
        # Determine which donors to process
        if self.request.user.role == UserRole.ADMIN:
            donor_id_param = self.request.query_params.get("donor")
            if not donor_id_param:
                return
            try:
                donor_ids = [int(donor_id_param)]
            except (TypeError, ValueError):
                return
        else:
            donor_ids = [self.request.user.id]

        # Find CHRT registrations for these donors without a recurring plan
        missing_regs = (
            PoojaRegistration.objects.filter(
                donor_id__in=donor_ids,
                day_option__code="CHRT",
            )
            .exclude(
                originating_recurring_plans__recurrence_kind=RecurrenceKind.RECURRING,
            )
            .select_related("day_option", "pooja_option", "donor")
        )

        for registration in missing_regs:
            try:
                preferred_date = registration.start_date or (
                    registration.created_at.date() if hasattr(registration, "created_at") and registration.created_at else None
                )
                create_plan_from_registration(
                    registration,
                    recurrence_kind=RecurrenceKind.RECURRING,
                    recurrence_one_time_date=preferred_date,
                )
            except Exception:
                # Fail quietly; do not block the endpoint
                continue

    def _deduct_plan_amount_from_due_records(self, plan: RecurringPoojaPlan) -> None:
        amount = plan.amount or Decimal("0.00")
        if amount <= Decimal("0.00") or plan.donor is None:
            return
        due_records = PaymentRecord.objects.filter(
            donor=plan.donor,
            registration__isnull=True,
            status=PaymentStatus.PENDING,
        )
        for record in due_records:
            existing_amount = record.amount or Decimal("0.00")
            new_amount = existing_amount - amount
            if new_amount <= Decimal("0.00"):
                record.delete()
            else:
                record.amount = new_amount
                record.save(update_fields=["amount"])

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

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        plan = self.get_object()
        registration_ids = []
        if plan.due_registration_id:
            registration_ids.append(plan.due_registration_id)
        if plan.origin_registration_id and plan.origin_registration_id not in registration_ids:
            registration_ids.append(plan.origin_registration_id)

        if registration_ids:
            payments = PaymentRecord.objects.filter(registration_id__in=registration_ids)
            if payments.filter(status=PaymentStatus.SUCCESS).exists():
                return Response(
                    {"detail": "From your side it is not possible to delete, please contact the Temple Admin."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payments.delete()

        self._deduct_plan_amount_from_due_records(plan)
        if registration_ids:
            PoojaRegistration.objects.filter(pk__in=registration_ids).delete()
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        if not can_download_reports(request.user):
            return Response(
                {"detail": REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE},
                status=status.HTTP_403_FORBIDDEN,
            )

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


def _collect_tithi_dates_at_hour(
    service: TempleCalendarService,
    start: date,
    end: date,
    targets: tuple[int, ...],
    *,
    hour: int,
    minute: int = 0,
) -> list[date]:
    wanted = set(targets)
    matches: list[date] = []
    cursor = start
    while cursor <= end:
        if service._tithi_on(cursor, hour=hour, minute=minute) in wanted:
            matches.append(cursor)
        cursor += timedelta(days=1)
    return matches


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
        # Sashti follows the panchang midday tithi shown on temple calendars.
        return _collect_tithi_dates_at_hour(service, start, end, targets=(6, 21), hour=12)
    if canonical == "second_ashtami":
        # 2-Ashtami aligns with morning panchang assignment.
        return _collect_tithi_dates_at_hour(service, start, end, targets=(8, 23), hour=9)
    if canonical == "pradosham":
        # Pradosham requires Trayodashi at Pradosha kala (sunset), not just any daytime match.
        return _collect_tithi_dates_at_hour(service, start, end, targets=(13, 28), hour=18)
    if canonical == "pournami":
        return _collect_tithi_dates_at_hour(service, start, end, targets=(15,), hour=12)
    if canonical == "amavasya":
        return _collect_tithi_dates_at_hour(service, start, end, targets=(30,), hour=12)
    if canonical == "sankata_chaturthi":
        # Sankatahara Chaturthi is observed against moonrise/evening tithi.
        return _collect_tithi_dates_at_hour(service, start, end, targets=(19,), hour=21)
    if canonical == "chaturthi":
        return _collect_tithi_dates_at_hour(service, start, end, targets=(4,), hour=12)
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


@method_decorator(cache_page(60 * 60), name="dispatch")
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

        debug_mode = request.query_params.get("debug") == "1"
        force_refresh = (request.query_params.get("refresh") or "").strip()
        cache_key = f"pooja_donor_calendar:{year}:{month}"
        cache_enabled = not RUNNING_TESTS and not debug_mode and not settings.DEBUG
        should_bypass_cache = force_refresh not in {"", "0", "false", "False"}

        if cache_enabled and not should_bypass_cache:
            cached_payload = cache.get(cache_key)
            if cached_payload is not None:
                return Response(cached_payload)

        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        month_start_dt = timezone.make_aware(datetime.combine(first_day, datetime.min.time()))
        month_end_dt = timezone.make_aware(datetime.combine(last_day + timedelta(days=1), datetime.min.time()))
        service = get_calendar_service()
        canonical_occurrences_cache: dict[str, list[date]] = {}
        debug_info: list[dict[str, Any]] = [] if debug_mode else []
        snapshot_option_counter = count(-1, -1)
        # Pre-fetch all PoojaDayOption records once to avoid N+1 queries in
        # build_snapshot_day_option_payload and any-day canonical-options loading.
        _all_day_options = list(PoojaDayOption.objects.order_by("display_order", "id"))
        all_day_options_by_id: dict[int, PoojaDayOption] = {opt.id: opt for opt in _all_day_options}
        all_day_options_by_code: dict[str, PoojaDayOption] = {opt.code: opt for opt in _all_day_options}
        normalized_excluded_parent_codes = {
            code.strip().upper() for code in UBHAYAM_EXCLUDED_PARENT_CODES
        }
        normalized_excluded_codes = {code.strip().upper() for code in UBHAYAM_EXCLUDED_POOJA_CODES}
        normalized_excluded_names = set(UBHAYAM_EXCLUDED_POOJA_NORMALIZED_NAMES)
        excluded_options_query = Q(code__in=normalized_excluded_codes)
        for excluded_name in UBHAYAM_EXCLUDED_POOJA_NAMES:
            excluded_options_query |= Q(name__iexact=excluded_name)
        for parent_code in normalized_excluded_parent_codes:
            excluded_options_query |= Q(parent__code__iexact=parent_code)
        excluded_option_rows = list(
            PoojaOption.objects.filter(excluded_options_query).values("id", "code", "name")
        )
        excluded_option_ids = {row["id"] for row in excluded_option_rows}
        normalized_excluded_codes.update(
            (row.get("code") or "").strip().upper()
            for row in excluded_option_rows
            if row.get("code")
        )
        normalized_excluded_names.update(
            _normalize_text(row.get("name")) for row in excluded_option_rows if row.get("name")
        )

        def is_ubhayam_excluded_pooja(
            *,
            pooja_id: int | None = None,
            pooja_code: str | None = None,
            pooja_name: str | None = None,
        ) -> bool:
            if pooja_id is not None and pooja_id in excluded_option_ids:
                return True
            normalized_code = (pooja_code or "").strip().upper()
            if normalized_code and normalized_code in normalized_excluded_codes:
                return True
            normalized_name = _normalize_text(pooja_name)
            return bool(normalized_name and normalized_name in normalized_excluded_names)

        queryset = (
            PoojaRegistration.objects.filter(
                donor__isnull=False,
                status__in=(PoojaStatus.PENDING, PoojaStatus.CONFIRMED, PoojaStatus.COMPLETED),
            )
            .exclude(pooja_option_id__in=excluded_option_ids)
            .filter(
                Q(start_date__range=(first_day, last_day))
                | Q(start_date__isnull=True, created_at__gte=month_start_dt, created_at__lt=month_end_dt)
            )
            .select_related("donor", "donor__profile", "day_option")
            .only(
                "id",
                "start_date",
                "created_at",
                "donor__id",
                "donor__name",
                "donor__phone_number",
                "donor__profile__donor_number",
                "day_option__id",
                "day_option__code",
                "day_option__description",
                "day_option__category",
                "day_option__display_order",
            )
            .order_by("start_date", "created_at", "donor__id")
        )

        donors_by_date: dict[date, list[dict[str, str]]] = defaultdict(list)
        seen_donor_ids: dict[date, set[int]] = defaultdict(set)
        day_options_by_date: dict[date, dict[int, dict[str, Any]]] = defaultdict(dict)
        unassigned_any_day_donors: list[dict[str, Any]] = []

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

        def build_any_day_fallback_payload() -> dict[str, Any]:
            return {
                "id": next(snapshot_option_counter),
                "code": "AD",
                "description": "Any Day of Month",
                "category": DayOptionCategory.CODE,
                "display_order": 0,
            }

        def is_any_day_payload(payload: dict[str, Any] | None) -> bool:
            if payload is None:
                return False
            return _is_any_day_option(payload.get("code"), payload.get("description"))

        def queue_unassigned_any_day_donor(
            donor_id: int,
            donor_payload: dict[str, str],
            day_option_payload: dict[str, Any] | None,
            *,
            source: str,
        ):
            unassigned_any_day_donors.append(
                {
                    "donor_id": donor_id,
                    "donor_payload": donor_payload,
                    "day_option_payload": day_option_payload or build_any_day_fallback_payload(),
                    "source": source,
                }
            )

        def build_snapshot_day_option_payload(item: dict[str, Any]) -> dict[str, Any] | None:
            option = None
            option_id = item.get("dayOptionId")
            if option_id:
                try:
                    option = all_day_options_by_id.get(int(option_id))
                except (TypeError, ValueError):
                    pass
            if option is None:
                day_option_code = item.get("dayOptionCode")
                if day_option_code:
                    option = all_day_options_by_code.get(day_option_code)
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

        def add_donor_for_date(
            donor_id: int,
            donor_payload: dict[str, str],
            target_date: date | None,
            day_option_for_date: dict[str, Any] | None = None,
        ) -> bool:
            if target_date is None or target_date < first_day or target_date > last_day:
                return False
            if donor_id in seen_donor_ids[target_date]:
                return False
            seen_donor_ids[target_date].add(donor_id)
            donors_by_date[target_date].append(donor_payload)
            record_day_option_entry(target_date, day_option_for_date)
            return True

        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            donor_payload = {
                "donor_id": _resolve_donor_identifier(donor),
                "name": donor.name or "",
                "phone_number": donor.phone_number or "",
            }

            day_option = getattr(registration, "day_option", None)
            day_option_payload = build_day_option_payload(day_option)
            registration_date = registration.start_date or (
                registration.created_at.date() if registration.created_at else None
            )
            if _is_any_day_option(getattr(day_option, "code", None), getattr(day_option, "description", None)):
                queue_unassigned_any_day_donor(
                    donor.id,
                    donor_payload,
                    day_option_payload,
                    source="registration",
                )
                continue
            if registration_date is None:
                continue

            canonical_code = (
                TempleCalendarService._canonicalize_code(day_option.code or "") if day_option else None
            )
            is_canonical = bool(canonical_code and canonical_code in CALENDAR_DAY_OPTION_CANONICAL_CODES)
            # For canonical day options (sashti, pournami, pradosham, etc.) the day option label
            # must only appear on the actual canonical occurrence dates, not on the donor's
            # registration_date which may fall on a completely different date type.
            add_donor_for_date(
                donor.id, donor_payload, registration_date,
                None if is_canonical else day_option_payload,
            )
            if is_canonical:
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
                    add_donor_for_date(donor.id, donor_payload, occurrence_date, day_option_payload)
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

        cart_snapshots = (
            PoojaCartSnapshot.objects.select_related("donor", "donor__profile")
            .only(
                "id",
                "items",
                "donor__id",
                "donor__name",
                "donor__phone_number",
                "donor__profile__donor_number",
            )
            .order_by("id")
        )
        for snapshot in cart_snapshots:
            donor = getattr(snapshot, "donor", None)
            if donor is None:
                continue
            donor_payload = {
                "donor_id": _resolve_donor_identifier(donor),
                "name": donor.name or "",
                "phone_number": donor.phone_number or "",
            }
            for item in snapshot.items or []:
                if is_ubhayam_excluded_pooja(
                    pooja_id=item.get("poojaId"),
                    pooja_code=item.get("poojaCode"),
                    pooja_name=item.get("poojaName"),
                ):
                    continue
                snapshot_option_payload = build_snapshot_day_option_payload(item)
                if is_any_day_payload(snapshot_option_payload):
                    queue_unassigned_any_day_donor(
                        donor.id,
                        donor_payload,
                        snapshot_option_payload,
                        source="cart_snapshot",
                    )
                    continue
                registration_date = _parse_iso_date(item.get("customDayDate") or item.get("bookingDate"))
                if registration_date is None:
                    continue
                if not add_donor_for_date(donor.id, donor_payload, registration_date, snapshot_option_payload):
                    continue
                # Include additional upcoming occurrence dates stored on the cart
                occurrences = item.get("dayOptionOccurrences")
                if isinstance(occurrences, list):
                    for occurrence in occurrences:
                        occurrence_date = _parse_iso_date(occurrence.get("date"))
                        add_donor_for_date(
                            donor.id,
                            donor_payload,
                            occurrence_date,
                            snapshot_option_payload,
                        )

        recurring_plans = (
            RecurringPoojaPlan.objects.filter(
                is_active=True,
                recurrence_kind=RecurrenceKind.RECURRING,
            )
            .filter(Q(start_date__isnull=True) | Q(start_date__lte=last_day))
            .exclude(pooja_option_id__in=excluded_option_ids)
            .select_related("donor", "donor__profile", "day_option")
            .only(
                "id",
                "start_date",
                "next_occurrence",
                "cart_payload",
                "day_option__id",
                "day_option__code",
                "day_option__description",
                "day_option__category",
                "day_option__display_order",
                "donor__id",
                "donor__name",
                "donor__phone_number",
                "donor__profile__donor_number",
            )
            .order_by("donor__id", "id")
        )
        for plan in recurring_plans:
            donor = getattr(plan, "donor", None)
            if donor is None:
                continue
            donor_payload = {
                "donor_id": _resolve_donor_identifier(donor),
                "name": donor.name or "",
                "phone_number": donor.phone_number or "",
            }
            payload = getattr(plan, "cart_payload", {}) or {}
            plan_day_option_payload = build_day_option_payload(plan.day_option)
            if is_any_day_payload(plan_day_option_payload):
                queue_unassigned_any_day_donor(
                    donor.id,
                    donor_payload,
                    plan_day_option_payload,
                    source="recurring_plan",
                )
                continue
            canonical_code = (
                TempleCalendarService._canonicalize_code(plan.day_option.code or "")
                if plan.day_option
                else None
            )
            is_canonical = bool(canonical_code and canonical_code in CALENDAR_DAY_OPTION_CANONICAL_CODES)

            if is_canonical:
                occurrences = canonical_occurrences_cache.get(canonical_code)
                if occurrences is None:
                    occurrences = _collect_dates_for_canonical(service, canonical_code, first_day, last_day)
                    canonical_occurrences_cache[canonical_code] = occurrences
                anchor_date = plan.start_date or plan.next_occurrence or first_day
                anchor_date = anchor_date if anchor_date >= first_day else first_day
                for occurrence_date in occurrences:
                    if occurrence_date < anchor_date:
                        continue
                    add_donor_for_date(
                        donor.id,
                        donor_payload,
                        occurrence_date,
                        plan_day_option_payload,
                    )
                # Canonical plans must not fall back to stale cart_payload dayOptionOccurrences.
                # Those payload dates can be out of sync with corrected tithi calculations.
                continue

            occurrences = payload.get("dayOptionOccurrences")
            added = False
            if isinstance(occurrences, list):
                for entry in occurrences:
                    occurrence_date = _parse_iso_date(entry.get("date"))
                    if add_donor_for_date(
                        donor.id,
                        donor_payload,
                        occurrence_date,
                        plan_day_option_payload,
                    ):
                        added = True
            if added:
                continue
            target_date = plan.next_occurrence
            if target_date is None:
                continue
            add_donor_for_date(
                donor.id,
                donor_payload,
                target_date,
                plan_day_option_payload,
            )

        if unassigned_any_day_donors and debug_mode:
            # Do not auto-distribute unassigned "Any Day of Month" entries into
            # concrete dates. Injecting them into date rows causes incorrect donor
            # attribution in the Ubhayam calendar/report output.
            debug_info.append(
                {
                    "any_day_unassigned_skipped": {
                        "queued": len(unassigned_any_day_donors),
                        "sources": sorted(
                            {
                                str(entry.get("source"))
                                for entry in unassigned_any_day_donors
                                if entry.get("source")
                            }
                        ),
                    }
                }
            )

        payload_dates = []
        cursor = first_day
        while cursor <= last_day:
            donors = donors_by_date.get(cursor, [])
            donor_ids = [donor.get("donor_id", "").strip() for donor in donors if donor.get("donor_id", "").strip()]
            names = [donor["name"].strip() for donor in donors if donor["name"].strip()]
            phones = [donor["phone_number"].strip() for donor in donors if donor["phone_number"].strip()]
            donor_ids_label = ", ".join(donor_ids) if donor_ids else ""
            names_label = ", ".join(names) if names else ""
            phones_label = ", ".join(phones) if phones else ""
            day_option_entries = list(day_options_by_date.get(cursor, {}).values())
            day_option_entries.sort(key=lambda opt: (opt.get("display_order", 0), opt.get("code") or ""))
            payload_dates.append(
                {
                    "date": cursor.isoformat(),
                    "donors": donors,
                    "donor_ids": donor_ids_label,
                    "donor_names": names_label,
                    "donor_phones": phones_label,
                    "day_options": day_option_entries,
                }
            )
            cursor += timedelta(days=1)

        response_payload = {"year": year, "month": month, "dates": payload_dates}
        if debug_mode:
            response_payload["debug"] = debug_info

        if cache_enabled:
            cache.set(cache_key, response_payload, timeout=60 * 5)

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
