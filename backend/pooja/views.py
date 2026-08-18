"""ViewSets for pooja master data and registrations."""

from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import date, datetime, timedelta
from itertools import count
import calendar
import logging
import re
import sys
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Exists, F, Max, Min, OuterRef, Prefetch, Q, Sum
from django.db.models.functions import Coalesce, TruncDate
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
    UbhayamAllocationRow,
    UbhayamAllocationRun,
    UbhayamAllocationStatus,
    UbhayamDateOverride,
    UbhayamReport,
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
from .services.calendar import TempleCalendarService, get_calendar_service, resolve_nakshatra_index
from .services.recurrence import (
    _plan_contributes_amount_for_month,
    _resolve_plan_occurrence_date_in_month,
    calculate_next_recurring_occurrence,
    find_due_registration,
    prepare_recurring_registration,
    recalculate_pending_dues_for_donor_window,
    rerun_due_payments_for_donor,
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

logger = logging.getLogger(__name__)


_TAMIL_NAKSHATRA_NATIVE_NAMES = [
    "அசுவினி",
    "பரணி",
    "கிருத்திகை",
    "ரோகிணி",
    "மிருகசீரிடம்",
    "திருவாதிரை",
    "புனர்பூசம்",
    "பூசம்",
    "ஆயில்யம்",
    "மகம்",
    "பூரம்",
    "உத்தரம்",
    "அஸ்தம்",
    "சித்திரை",
    "சுவாதி",
    "விசாகம்",
    "அனுஷம்",
    "கேட்டை",
    "மூலம்",
    "பூராடம்",
    "உத்திராடம்",
    "திருவோணம்",
    "அவிட்டம்",
    "சதயம்",
    "பூரட்டாதி",
    "உத்திரட்டாதி",
    "ரேவதி",
]


def _split_comma_separated_values(value: str | None) -> list[str]:
    return [entry.strip() for entry in (value or "").split(",") if entry.strip()]


def _normalize_ubhayam_donor_identifier(value: str | None) -> str:
    return (value or "").strip().upper()


def _serialize_ubhayam_allocation_row(row: UbhayamAllocationRow) -> dict[str, str]:
    return {
        "date": row.date.isoformat(),
        "day_of_month": row.day_of_month,
        "tamil_star": row.tamil_star,
        "pooja_day_option": row.pooja_day_option,
        "donor_id": row.donor_id,
        "donor_name": row.donor_name,
        "donor_mobile_number": row.donor_mobile_number,
    }


def _serialize_ubhayam_allocation_row_for_donor(
    row: UbhayamAllocationRow,
    donor_identifier: str | None,
) -> dict[str, str] | None:
    normalized_target = _normalize_ubhayam_donor_identifier(donor_identifier)
    if not normalized_target:
        return None

    donor_ids = _split_comma_separated_values(row.donor_id)
    donor_index = next(
        (
            index
            for index, value in enumerate(donor_ids)
            if _normalize_ubhayam_donor_identifier(value) == normalized_target
        ),
        -1,
    )
    if donor_index < 0:
        return None

    donor_names = _split_comma_separated_values(row.donor_name)
    donor_mobile_numbers = _split_comma_separated_values(row.donor_mobile_number)
    return {
        "date": row.date.isoformat(),
        "day_of_month": row.day_of_month,
        "tamil_star": row.tamil_star,
        "pooja_day_option": row.pooja_day_option,
        "donor_id": donor_ids[donor_index] if donor_index < len(donor_ids) else "",
        "donor_name": donor_names[donor_index] if donor_index < len(donor_names) else "",
        "donor_mobile_number": (
            donor_mobile_numbers[donor_index] if donor_index < len(donor_mobile_numbers) else ""
        ),
    }


class LargePagePagination(PageNumberPagination):
    page_size = 200
    page_size_query_param = "page_size"
    max_page_size = 1000

PAUSE_REASON_NO_POJA_NO_PAYMENT = "No Pooja and No Payment"
PAUSE_REASON_USE_FOR_TEMPLE = "No Pooja and use money for temple purpose"
PAUSE_REASON_SAMY = "Continue the pooja with Samy's names"
PAUSE_REASON_USE_FOR_TEMPLE_LEGACY = "No Pooja and use the money for temple purpose"
PAUSE_REASON_SAMY_LEGACY = "Continue the pooja with the Swamy's names"
NO_PAYMENT_PAUSE_REASON_VALUES = (PAUSE_REASON_NO_POJA_NO_PAYMENT,)
TEMPLE_PURPOSE_PAUSE_REASON_VALUES = (PAUSE_REASON_USE_FOR_TEMPLE, PAUSE_REASON_USE_FOR_TEMPLE_LEGACY)
SAMY_PAUSE_REASON_VALUES = (PAUSE_REASON_SAMY, PAUSE_REASON_SAMY_LEGACY)


def _canonicalize_pause_reason(value: str | None) -> str | None:
    if not value:
        return None
    normalized = _normalize_text(value)
    if normalized == _normalize_text(PAUSE_REASON_NO_POJA_NO_PAYMENT):
        return PAUSE_REASON_NO_POJA_NO_PAYMENT
    if normalized in {_normalize_text(reason) for reason in TEMPLE_PURPOSE_PAUSE_REASON_VALUES}:
        return PAUSE_REASON_USE_FOR_TEMPLE
    if normalized in {_normalize_text(reason) for reason in SAMY_PAUSE_REASON_VALUES}:
        return PAUSE_REASON_SAMY
    return value.strip()


def _pause_reason_report_label(reason: str | None) -> str | None:
    if not reason:
        return None
    normalized = _normalize_text(reason)
    if normalized in {_normalize_text(item) for item in TEMPLE_PURPOSE_PAUSE_REASON_VALUES}:
        return "temple purpose"
    if normalized in {_normalize_text(item) for item in SAMY_PAUSE_REASON_VALUES}:
        return "Samy's names"
    return None

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
PLAN_SPECIFIC_OPTION_CODES = {"CS", "CHRT"}
PLAN_SPECIFIC_OPTION_DESCRIPTIONS = {
    "choose your star",
    "choose your date for pooja",
    "choose your preferred date",
}
RUNNING_TESTS = "test" in sys.argv
UBHAYAM_DB_CUTOVER_MONTH = "2026-07"


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


def _parse_month_key(value: str | None) -> tuple[str, int, int] | None:
    if not value:
        return None
    normalized = value.strip()
    match = re.fullmatch(r"(\d{4})-(\d{2})", normalized)
    if not match:
        return None
    year = int(match.group(1))
    month = int(match.group(2))
    if month < 1 or month > 12:
        return None
    return normalized, year, month


def _month_range(year: int, month: int) -> tuple[date, date]:
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    return first_day, last_day


def _is_any_day_option(code: str | None, description: str | None) -> bool:
    normalized_code = (code or "").strip().upper()
    if normalized_code in ANY_DAY_OPTION_CODES:
        return True
    return _normalize_text(description) in ANY_DAY_OPTION_DESCRIPTIONS


def _is_plan_specific_ubhayam_option(code: str | None, description: str | None) -> bool:
    normalized_code = (code or "").strip().upper()
    if normalized_code in PLAN_SPECIFIC_OPTION_CODES:
        return True
    return _normalize_text(description) in PLAN_SPECIFIC_OPTION_DESCRIPTIONS


def _resolve_donor_identifier(donor: User | None) -> str:
    if donor is None:
        return ""
    profile = getattr(donor, "profile", None)
    donor_number = getattr(profile, "donor_number", None)
    if donor_number:
        return f"D{donor_number}"
    donor_pk = getattr(donor, "id", None)
    return str(donor_pk) if donor_pk is not None else ""


def _is_ubhayam_excluded_pooja_option(option: PoojaOption | None) -> bool:
    if option is None:
        return False
    parent_code = (getattr(getattr(option, "parent", None), "code", None) or "").strip().upper()
    if parent_code in UBHAYAM_EXCLUDED_PARENT_CODES:
        return True
    option_code = (getattr(option, "code", None) or "").strip().upper()
    if option_code in UBHAYAM_EXCLUDED_POOJA_CODES:
        return True
    option_name = _normalize_text(getattr(option, "name", None))
    return bool(option_name and option_name in UBHAYAM_EXCLUDED_POOJA_NORMALIZED_NAMES)


def _normalize_ubhayam_option_label(code: str | None, description: str | None) -> str:
    if _is_any_day_option(code, description):
        return "any day of month"
    return _normalize_text(description or code)


def _resolve_user_id_from_ubhayam_donor_identifier(donor_identifier: str | None) -> int | None:
    raw_value = (donor_identifier or "").strip()
    if not raw_value:
        return None
    normalized = raw_value.upper()
    if normalized.startswith("D") and normalized[1:].isdigit():
        donor_number = int(normalized[1:])
        return (
            DonorProfile.objects.filter(donor_number=donor_number)
            .values_list("user_id", flat=True)
            .first()
        )
    if raw_value.isdigit():
        return int(raw_value)
    return None


def _ubhayam_donor_option_contributes_for_month(
    donor_identifier: str | None,
    option_label: str | None,
    month_start: date,
) -> bool:
    user_id = _resolve_user_id_from_ubhayam_donor_identifier(donor_identifier)
    normalized_option = _normalize_ubhayam_option_label(None, option_label)
    if user_id is None or not normalized_option:
        return True

    matching_plans = [
        plan
        for plan in RecurringPoojaPlan.objects.filter(
            donor_id=user_id,
            recurrence_kind=RecurrenceKind.RECURRING,
        ).select_related("day_option", "origin_registration", "pooja_option", "pooja_option__parent")
        if not _is_ubhayam_excluded_pooja_option(getattr(plan, "pooja_option", None))
        and _normalize_ubhayam_option_label(
            getattr(getattr(plan, "day_option", None), "code", None),
            getattr(getattr(plan, "day_option", None), "description", None),
        )
        == normalized_option
    ]
    if not matching_plans:
        return True

    return any(_plan_contributes_amount_for_month(plan, month_start) for plan in matching_plans)


def _resolve_tamil_star_option_label(raw_value: Any) -> str | None:
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None

    star_option = None
    if text.isdigit():
        star_option = PoojaDayOption.objects.filter(
            id=int(text),
            category=DayOptionCategory.TAMIL_STAR,
        ).only("description", "code").first()
    else:
        star_option = PoojaDayOption.objects.filter(
            code__iexact=text,
            category=DayOptionCategory.TAMIL_STAR,
        ).only("description", "code").first()

    if star_option is None:
        return None
    return (star_option.description or star_option.code or "").strip() or None


def _extract_plan_tamil_star_indexes(plan: RecurringPoojaPlan) -> set[int]:
    labels: list[str] = []

    cart_payload = plan.cart_payload if isinstance(plan.cart_payload, dict) else {}

    selected_labels: list[str] = []
    for key in (
        "selectedTamilStarLabel",
        "selected_tamil_star_label",
        "selectedTamilStar",
        "selected_tamil_star",
    ):
        selected_label = (cart_payload.get(key) or "").strip()
        if selected_label:
            selected_labels.append(selected_label)

    for key in ("selectedTamilStarId", "selected_tamil_star_id"):
        option_label = _resolve_tamil_star_option_label(cart_payload.get(key))
        if option_label:
            selected_labels.append(option_label)

    # For Choose Your Star plans, the explicitly selected star is authoritative.
    # Do not mix in family-member stars when a selected star exists, or the plan
    # can incorrectly match multiple month rows.
    if selected_labels:
        labels.extend(selected_labels)
    else:
        def append_member_stars(members: Any) -> None:
            if not isinstance(members, list):
                return
            for member in members:
                if not isinstance(member, dict):
                    continue
                for key in ("tamil_star", "tamilStar"):
                    star = (member.get(key) or "").strip()
                    if star:
                        labels.append(star)

        append_member_stars(cart_payload.get("members"))

        metadata = plan.metadata if isinstance(plan.metadata, dict) else {}
        append_member_stars(metadata.get("members"))

        origin_registration = getattr(plan, "origin_registration", None)
        origin_members = getattr(origin_registration, "members", None)
        if origin_members is not None:
            try:
                append_member_stars(origin_members.all())
            except Exception:
                pass

        donor = getattr(plan, "donor", None)
        donor_profile = getattr(donor, "profile", None) if donor is not None else None
        donor_star = (getattr(donor_profile, "tamil_star", None) or "").strip()
        if donor_star:
            labels.append(donor_star)

    indexes: set[int] = set()
    for label in labels:
        index = resolve_nakshatra_index(label)
        if index is not None:
            indexes.add(index)
    return indexes


def _extract_plan_fallback_tamil_star_indexes(plan: RecurringPoojaPlan) -> set[int]:
    labels: list[str] = []

    def append_member_stars(members: Any) -> None:
        if not isinstance(members, list):
            return
        for member in members:
            if not isinstance(member, dict):
                continue
            for key in ("tamil_star", "tamilStar"):
                    star = (member.get(key) or "").strip()
                    if star:
                        labels.append(star)

    metadata = plan.metadata if isinstance(plan.metadata, dict) else {}
    append_member_stars(metadata.get("members"))

    origin_registration = getattr(plan, "origin_registration", None)
    origin_members = getattr(origin_registration, "members", None)
    if origin_members is not None:
        try:
            append_member_stars(origin_members.all())
        except Exception:
            pass

    donor = getattr(plan, "donor", None)
    donor_profile = getattr(donor, "profile", None) if donor is not None else None
    donor_star = (getattr(donor_profile, "tamil_star", None) or "").strip()
    if donor_star:
        labels.append(donor_star)

    indexes: set[int] = set()
    for label in labels:
        index = resolve_nakshatra_index(label)
        if index is not None:
            indexes.add(index)
    return indexes


def _resolve_plan_day_option_label(plan: RecurringPoojaPlan) -> str:
    day_option = getattr(plan, "day_option", None)
    cart_payload = plan.cart_payload if isinstance(plan.cart_payload, dict) else {}
    code = getattr(day_option, "code", None) or cart_payload.get("dayOptionCode")
    description = getattr(day_option, "description", None) or cart_payload.get("dayOptionDescription")
    if _is_any_day_option(code, description):
        return "any day of month"
    return (str(description or code or "").strip()) or "Any day of the month"


def _resolve_plan_specific_target_date(
    plan: RecurringPoojaPlan,
    month_start: date,
    *,
    tamil_star_indexes_by_date: dict[date, set[int]] | None = None,
    option_labels_by_date: dict[date, list[str]] | None = None,
) -> date | None:
    day_option = getattr(plan, "day_option", None)
    code = (getattr(day_option, "code", None) or "").strip().upper()
    cart_payload = plan.cart_payload if isinstance(plan.cart_payload, dict) else {}
    option_label = _resolve_plan_day_option_label(plan)

    if code == "CHRT" or (not code and (cart_payload.get("dayOptionCode") or "").strip().upper() == "CHRT"):
        preferred = (
            plan.one_time_date
            or _parse_iso_date(cart_payload.get("recurrenceOneTimeDate"))
            or plan.start_date
        )
        if preferred and preferred.year == month_start.year and preferred.month == month_start.month:
            return preferred
        return None

    normalized_label = _normalize_ubhayam_option_label(
        getattr(day_option, "code", None) or cart_payload.get("dayOptionCode"),
        getattr(day_option, "description", None) or cart_payload.get("dayOptionDescription"),
    )
    if normalized_label in ANY_DAY_OPTION_DESCRIPTIONS:
        anchor_date = plan.next_occurrence or plan.start_date or month_start
        if anchor_date.year == month_start.year and anchor_date.month == month_start.month:
            return anchor_date
        return month_start

    try:
        target_date = _resolve_plan_occurrence_date_in_month(plan, month_start)
    except Exception:
        target_date = None

    if (
        code == "CS"
        and tamil_star_indexes_by_date is not None
        and option_labels_by_date is not None
    ):
        donor_star_indexes = _extract_plan_tamil_star_indexes(plan)
        if donor_star_indexes:
            matching_dates = [
                candidate
                for candidate, star_indexes in tamil_star_indexes_by_date.items()
                if (
                    candidate.year == month_start.year
                    and candidate.month == month_start.month
                    and option_label in option_labels_by_date.get(candidate, [])
                    and bool(donor_star_indexes & star_indexes)
                )
            ]

            def _date_matches(candidate: date) -> bool:
                return (
                    candidate.year == month_start.year
                    and candidate.month == month_start.month
                    and option_label in option_labels_by_date.get(candidate, [])
                    and bool(donor_star_indexes & tamil_star_indexes_by_date.get(candidate, set()))
                )

            if target_date and _date_matches(target_date):
                return target_date

            if target_date:
                previous_day = target_date - timedelta(days=1)
                if _date_matches(previous_day):
                    return previous_day

                next_day = target_date + timedelta(days=1)
                if _date_matches(next_day):
                    return next_day

            if len(matching_dates) == 1:
                return matching_dates[0]

    if target_date and target_date.year == month_start.year and target_date.month == month_start.month:
        return target_date
    return None


def _plan_is_assignable_for_ubhayam_target_date(
    plan: RecurringPoojaPlan,
    target_date: date,
) -> bool:
    if plan.recurrence_kind != RecurrenceKind.RECURRING:
        return False

    metadata = plan.metadata if isinstance(plan.metadata, dict) else {}
    cancel_effective_from = metadata.get("cancel_effective_from")
    if isinstance(cancel_effective_from, str):
        cancel_date = _parse_iso_date(cancel_effective_from)
        if cancel_date is not None and target_date >= cancel_date:
            return False

    if plan.is_active:
        return True

    if plan.pause_from is None:
        return False

    if target_date < plan.pause_from:
        return True

    if plan.pause_until is not None and target_date > plan.pause_until:
        return True

    return False


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

        queryset = self._exclude_paused_window_registrations(queryset)
        return queryset.prefetch_related("members")

    def _exclude_paused_window_registrations(self, queryset):
        paused_plan_match = RecurringPoojaPlan.objects.filter(
            donor_id=OuterRef("donor_id"),
            pooja_option_id=OuterRef("pooja_option_id"),
            recurrence_kind=RecurrenceKind.RECURRING,
            pause_from__isnull=False,
            pause_until__isnull=False,
            pause_from__lte=OuterRef("start_date"),
            pause_until__gte=OuterRef("start_date"),
            metadata__pause_reason__in=NO_PAYMENT_PAUSE_REASON_VALUES,
        ).filter(day_option_id=OuterRef("day_option_id"))
        return queryset.annotate(is_paused_registration=Exists(paused_plan_match)).exclude(is_paused_registration=True)

    def _report_name_for_registration(self, registration: PoojaRegistration) -> str:
        donor = getattr(registration, "donor", None)
        if donor is None:
            return ""
        start_date = getattr(registration, "start_date", None)
        if start_date is None:
            return donor.name or ""
        pause_plan = (
            RecurringPoojaPlan.objects.filter(
                donor_id=registration.donor_id,
                pooja_option_id=registration.pooja_option_id,
                day_option_id=registration.day_option_id,
                recurrence_kind=RecurrenceKind.RECURRING,
                pause_from__isnull=False,
                pause_until__isnull=False,
                pause_from__lte=start_date,
                pause_until__gte=start_date,
            )
            .order_by("-updated_at")
            .first()
        )
        if not pause_plan:
            return donor.name or ""
        reason = (pause_plan.metadata or {}).get("pause_reason")
        label = _pause_reason_report_label(reason if isinstance(reason, str) else None)
        return label or (donor.name or "")

    def perform_create(self, serializer):
        if self.request.user.role != UserRole.ADMIN:
            donor_profile, _ = DonorProfile.objects.get_or_create(user=self.request.user)
            if not donor_profile.pooja_registration_access:
                raise PermissionDenied(POOJA_REGISTRATION_ACCESS_DENIED_MESSAGE)
        serializer.save(donor=self.request.user)

    def _resolve_month_range(self, request) -> tuple[date, date]:
        """Resolve month range from ?month=YYYY-MM or default to current month."""
        month_param = (request.query_params.get("month") or "").strip()
        today = timezone.localdate()
        year, month = today.year, today.month
        if month_param:
            try:
                year_str, month_str = month_param.split("-", 1)
                parsed_year = int(year_str)
                parsed_month = int(month_str)
                if 1 <= parsed_month <= 12:
                    year, month = parsed_year, parsed_month
            except (ValueError, AttributeError):
                pass

        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        return first_day, last_day

    def _active_plan_queryset_for_month(self, request):
        """Active recurring plans for the selected month.

        A plan contributes to a month when it is registered on/before month end,
        is active, and not paused for that month.
        """
        first_day, last_day = self._resolve_month_range(request)
        local_tz = timezone.get_current_timezone()
        return (
            RecurringPoojaPlan.objects.filter(
                donor__isnull=False,
                recurrence_kind=RecurrenceKind.RECURRING,
                is_active=True,
            )
            .annotate(
                registered_on=Coalesce(
                    TruncDate("origin_registration__created_at", tzinfo=local_tz),
                    TruncDate("created_at", tzinfo=local_tz),
                    "start_date",
                )
            )
            .filter(registered_on__lte=last_day)
            .exclude(
                Q(pause_from__lte=last_day)
                & (Q(pause_until__gte=first_day) | Q(pause_until__isnull=True))
                & Q(metadata__pause_reason__in=NO_PAYMENT_PAUSE_REASON_VALUES)
            )
        )

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

    @action(detail=False, methods=["get"], url_path="donors-by-option")
    def donors_by_option(self, request):
        """Return active recurring-plan donors for the selected month. Admin only.

        Params:
          ?codes=GP1,GP2        – comma-separated option codes (exact)
          ?parent_codes=ONE-DAY,ABISHEKAM  – comma-separated parent codes (all children)
          ?month=YYYY-MM        – target month for active-plan totals (defaults to current month)
          Legacy: ?match=<substring>  – fallback name-icontains (kept for compatibility)
        """
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        codes = [c.strip() for c in (request.query_params.get("codes") or "").split(",") if c.strip()]
        parent_codes = [c.strip() for c in (request.query_params.get("parent_codes") or "").split(",") if c.strip()]
        match = (request.query_params.get("match") or "").strip()
        include_pooja_names = (request.query_params.get("include_pooja_names") or "").strip().lower() in {"1", "true", "yes"}

        if not codes and not parent_codes and not match:
            return Response({"detail": "Provide ?codes=, ?parent_codes=, or ?match= query params."}, status=400)

        filter_q = Q()
        if codes:
            filter_q |= Q(pooja_option__code__in=codes)
        if parent_codes:
            filter_q |= Q(pooja_option__parent__code__in=parent_codes)
        if match and not codes and not parent_codes:
            filter_q |= Q(pooja_option__name__icontains=match)

        plan_rows = self._active_plan_queryset_for_month(request).filter(filter_q)
        registration_count = plan_rows.count()

        donor_pooja_names: dict[int, str] = {}
        if include_pooja_names:
            pooja_name_rows = (
                plan_rows.values("donor_id", "pooja_option__name")
                .annotate(option_count=Count("id"))
                .order_by("donor_id", "pooja_option__name")
            )
            grouped_names: dict[int, list[str]] = defaultdict(list)
            for row in pooja_name_rows:
                donor_id = row["donor_id"]
                option_name = (row["pooja_option__name"] or "").strip()
                if donor_id is None or not option_name:
                    continue
                option_count = row["option_count"] or 0
                label = f"{option_name} x{option_count}" if option_count > 1 else option_name
                grouped_names[donor_id].append(label)
            donor_pooja_names = {
                donor_id: ", ".join(names)
                for donor_id, names in grouped_names.items()
            }

        rows = (
            plan_rows.values("donor_id")
            .annotate(
                donor_name=F("donor__name"),
                donor_phone=F("donor__phone_number"),
                total_amount=Sum("amount"),
                donor_registration_count=Count("id"),
            )
            .order_by("donor_name", "donor_id")
        )

        results = []
        for row in rows:
            donor_id = row["donor_id"]
            if donor_id is None:
                continue
            results.append(
                {
                    "donor_id": donor_id,
                    "donor_name": row["donor_name"] or "—",
                    "donor_phone": row["donor_phone"] or "—",
                    "pooja_option_name": donor_pooja_names.get(donor_id, ""),
                    "total_amount": str(row["total_amount"] or "0.00"),
                    "start_date": None,
                    "registration_count": row["donor_registration_count"] or 0,
                }
            )

        return Response(
            {
                "count": len(results),
                "unique_donors": len(results),
                "registration_count": registration_count,
                "results": results,
            }
        )

    @action(detail=False, methods=["get"], url_path="option-totals")
    def option_totals(self, request):
        """Return aggregated active recurring-plan totals for the selected month.

        Optional query param:
            ?month=YYYY-MM  — target month to compute active-plan totals for (defaults to current month)
        """
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        rows = (
            self._active_plan_queryset_for_month(request)
            .values(
                name=F("pooja_option__name"),
                option_code=F("pooja_option__code"),
                parent_code=F("pooja_option__parent__code"),
                parent_name=F("pooja_option__parent__name"),
            )
            .annotate(
                total=Sum("amount"),
                count=Count("id"),
            )
            .order_by("parent_code", "option_code")
        )

        return Response(
            [
                {
                    "pooja_option_name": row["name"] or "Unknown",
                    "option_code": row["option_code"] or "",
                    "parent_code": row["parent_code"] or "",
                    "parent_name": row["parent_name"] or "",
                    "total_amount": str(row["total"] or "0.00"),
                    "registration_count": row["count"],
                }
                for row in rows
                if row["name"]
            ]
        )

    @action(detail=False, methods=["get"], url_path="paid-totals-by-option")
    def paid_totals_by_option(self, request):
        """Return paid-by-option totals for donors who fully paid selected month dues.

        Optional query params:
          ?codes=GP1,GP2
          ?parent_codes=ONE-DAY,ABISHEKAM
          ?match=<substring> (fallback name-icontains when codes are not provided)
          ?month=YYYY-MM
        """
        if request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Admin access required.")

        codes = [c.strip() for c in (request.query_params.get("codes") or "").split(",") if c.strip()]
        parent_codes = [c.strip() for c in (request.query_params.get("parent_codes") or "").split(",") if c.strip()]
        match = (request.query_params.get("match") or "").strip()

        first_day, last_day = self._resolve_month_range(request)

        filter_q = Q()
        if codes:
            filter_q |= Q(pooja_option__code__in=codes)
        if parent_codes:
            filter_q |= Q(pooja_option__parent__code__in=parent_codes)
        if match and not codes and not parent_codes:
            filter_q |= Q(pooja_option__name__icontains=match)

        all_active_plans = self._active_plan_queryset_for_month(request)
        filtered_plans = all_active_plans.filter(filter_q) if filter_q else all_active_plans

        # Donor considered as paid for the month only when successful payments for
        # that month cover their full active recurring amount for the month.
        donor_monthly_due_rows = (
            all_active_plans.values("donor_id")
            .annotate(total_due=Sum("amount"))
            .order_by()
        )
        donor_due_map = {
            row["donor_id"]: (row["total_due"] or Decimal("0.00"))
            for row in donor_monthly_due_rows
            if row["donor_id"] is not None
        }

        donor_option_rows = list(
            filtered_plans.values(
                "donor_id",
                name=F("pooja_option__name"),
                option_code=F("pooja_option__code"),
                parent_code=F("pooja_option__parent__code"),
                parent_name=F("pooja_option__parent__name"),
            )
            .annotate(option_amount=Sum("amount"))
            .order_by("parent_code", "option_code", "donor_id")
        )
        donor_ids = [row["donor_id"] for row in donor_option_rows if row["donor_id"] is not None]

        month_payment_q = Q(payment_month__gte=first_day, payment_month__lte=last_day) | (
            Q(payment_month__isnull=True) & Q(created_at__date__gte=first_day, created_at__date__lte=last_day)
        )
        donor_paid_rows = (
            PaymentRecord.objects.filter(
                status=PaymentStatus.SUCCESS,
                donor_id__in=donor_ids,
            )
            .filter(month_payment_q)
            .values("donor_id")
            .annotate(total_paid=Sum("amount"))
            .order_by()
        )
        donor_paid_map = {
            row["donor_id"]: (row["total_paid"] or Decimal("0.00"))
            for row in donor_paid_rows
            if row["donor_id"] is not None
        }

        option_totals: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        for row in donor_option_rows:
            donor_id = row["donor_id"]
            if donor_id is None:
                continue

            donor_due = donor_due_map.get(donor_id, Decimal("0.00"))
            donor_paid = donor_paid_map.get(donor_id, Decimal("0.00"))
            is_fully_paid = donor_due > Decimal("0.00") and donor_paid >= donor_due
            if not is_fully_paid:
                continue

            key = (
                row["name"] or "Unknown",
                row["option_code"] or "",
                row["parent_code"] or "",
                row["parent_name"] or "",
            )
            if key not in option_totals:
                option_totals[key] = {
                    "pooja_option_name": key[0],
                    "option_code": key[1],
                    "parent_code": key[2],
                    "parent_name": key[3],
                    "paid_total": Decimal("0.00"),
                    "paid_donor_ids": set(),
                }
            option_totals[key]["paid_total"] = option_totals[key]["paid_total"] + (row["option_amount"] or Decimal("0.00"))
            option_totals[key]["paid_donor_ids"].add(donor_id)

        ordered_keys = sorted(option_totals.keys(), key=lambda item: (item[2], item[1], item[0]))

        return Response(
            [
                {
                    "pooja_option_name": option_totals[key]["pooja_option_name"],
                    "option_code": option_totals[key]["option_code"],
                    "parent_code": option_totals[key]["parent_code"],
                    "parent_name": option_totals[key]["parent_name"],
                    "paid_amount": str(option_totals[key]["paid_total"]),
                    "paid_donor_count": len(option_totals[key]["paid_donor_ids"]),
                    "payment_count": len(option_totals[key]["paid_donor_ids"]),
                }
                for key in ordered_keys
            ]
        )

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

        queryset = self._exclude_paused_window_registrations(
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=SATURDAY_NAVAGRAHA_POOJA_NAME,
                donor__isnull=False,
            )
        )
        queryset = queryset.select_related("donor").order_by("donor__name", "donor__id", "start_date")

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": self._report_name_for_registration(registration),
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="pradosha-pooja-report")
    def pradosha_pooja_report(self, request):
        _ensure_report_download_access(request.user)

        queryset = self._exclude_paused_window_registrations(
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=PRADOSHA_POOJA_NAME,
                donor__isnull=False,
            )
        )
        queryset = queryset.select_related("donor").order_by("start_date", "donor__name", "donor__id")

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": self._report_name_for_registration(registration),
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="till-oil-for-lamps-report")
    def till_oil_for_lamps_report(self, request):
        _ensure_report_download_access(request.user)

        queryset = self._exclude_paused_window_registrations(
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=TILL_OIL_FOR_LAMPS_NAME,
                donor__isnull=False,
            )
        )
        queryset = queryset.select_related("donor").order_by("start_date", "donor__name", "donor__id")

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": self._report_name_for_registration(registration),
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="nitya-neivedhyam-report")
    def nitya_neivedhyam_report(self, request):
        _ensure_report_download_access(request.user)

        queryset = self._exclude_paused_window_registrations(
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=NITYA_NEIVEDHYAM_NAME,
                donor__isnull=False,
            )
        )
        queryset = queryset.select_related("donor").order_by("start_date", "donor__name", "donor__id")

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": self._report_name_for_registration(registration),
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="gau-samrakshana-seva-report")
    def gau_samrakshana_seva_report(self, request):
        _ensure_report_download_access(request.user)

        queryset = self._exclude_paused_window_registrations(
            PoojaRegistration.objects.filter(
                pooja_option__name__iexact=GAU_SAMRAKHSHANA_SEVA_NAME,
                donor__isnull=False,
            )
        )
        queryset = queryset.select_related("donor").order_by("start_date", "donor__name", "donor__id")

        results = []
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            results.append(
                {
                    "donor_id": donor.id,
                    "name": self._report_name_for_registration(registration),
                    "phone_number": donor.phone_number or "",
                    "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
                }
            )

        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=["get"], url_path="post-prasadam-report")
    def post_prasadam_report(self, request):
        _ensure_report_download_access(request.user)

        queryset = self._exclude_paused_window_registrations(
            PoojaRegistration.objects.filter(
                post_prasadam=True,
                donor__isnull=False,
            )
        ).select_related("donor").order_by("donor__name", "donor_id", "-start_date")
        grouped: dict[int, dict[str, Any]] = {}
        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            if donor.id in grouped:
                continue
            grouped[donor.id] = {
                "donor_id": donor.id,
                "name": self._report_name_for_registration(registration),
                "phone_number": donor.phone_number or "",
                "pooja_date": registration.start_date.isoformat() if registration.start_date else "",
            }
        results = sorted(
            grouped.values(),
            key=lambda row: (row.get("name") or "").lower(),
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
        # Do not auto-backfill CHRT plans during regular profile loads.
        # This previously converted one-time CHRT registrations into
        # recurring monthly plans unintentionally.
        should_backfill = (
            request.user.role == UserRole.ADMIN
            and (request.query_params.get("backfill_chrt") or "").strip().lower() in {"1", "true", "yes"}
        )
        if should_backfill:
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
        paused_only_raw = (self.request.query_params.get("paused_only") or "").strip().lower()
        paused_only = paused_only_raw in {"1", "true", "yes"}
        recurring_only_raw = (self.request.query_params.get("recurring_only") or "").strip().lower()
        recurring_only = recurring_only_raw in {"1", "true", "yes"}
        if self.request.user.role == UserRole.ADMIN:
            # Allow admin to filter by donor if donor parameter is provided
            donor_id = self.request.query_params.get('donor')
            if donor_id:
                try:
                    qs = qs.filter(donor_id=int(donor_id))
                except (ValueError, TypeError):
                    pass
            if recurring_only:
                qs = qs.filter(recurrence_kind=RecurrenceKind.RECURRING)
            if paused_only:
                qs = qs.filter(Q(pause_from__isnull=False) | Q(pause_until__isnull=False))
            return qs.order_by("donor__name", "-next_occurrence", "-created_at")
        qs = qs.filter(donor=self.request.user)
        if recurring_only:
            qs = qs.filter(recurrence_kind=RecurrenceKind.RECURRING)
        if paused_only:
            qs = qs.filter(Q(pause_from__isnull=False) | Q(pause_until__isnull=False))
        return qs.order_by("-next_occurrence", "-created_at")

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

    def _clear_due_registration_in_pause_window(
        self,
        plan: RecurringPoojaPlan,
        *,
        pause_from: date,
        pause_until: date,
    ) -> None:
        registration = getattr(plan, "due_registration", None)
        if registration is None:
            return
        if registration.start_date is None:
            return
        if not (pause_from <= registration.start_date <= pause_until):
            return
        has_success = PaymentRecord.objects.filter(
            registration=registration,
            status=PaymentStatus.SUCCESS,
        ).exists()
        if has_success:
            return
        PaymentRecord.objects.filter(
            registration=registration,
            status=PaymentStatus.PENDING,
        ).delete()
        registration.delete()
        plan.due_registration = None
        plan.save(update_fields=["due_registration"])

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        plan = self.get_object()
        pause_from_value = request.data.get("pause_from")
        pause_until_value = request.data.get("pause_until")
        pause_reason_value = request.data.get("pause_reason")
        pause_reason = _canonicalize_pause_reason(pause_reason_value if isinstance(pause_reason_value, str) else None)
        if not pause_until_value:
            return Response({"detail": "Provide a pause_until date."}, status=status.HTTP_400_BAD_REQUEST)
        pause_until = parse_date(pause_until_value)
        if pause_until is None:
            return Response({"detail": "Invalid date provided for pause_until."}, status=status.HTTP_400_BAD_REQUEST)
        pause_from = parse_date(pause_from_value) if pause_from_value else timezone.localdate()
        if pause_from is None:
            return Response({"detail": "Invalid date provided for pause_from."}, status=status.HTTP_400_BAD_REQUEST)
        today = timezone.localdate()
        if pause_from < today and request.user.role != UserRole.ADMIN:
            return Response({"detail": "Pause start must be today or later."}, status=status.HTTP_400_BAD_REQUEST)
        if pause_until <= pause_from:
            return Response({"detail": "Pause end must be after the pause start."}, status=status.HTTP_400_BAD_REQUEST)
        was_paused = bool(plan.pause_from or plan.pause_until or not plan.is_active)
        metadata = dict(plan.metadata or {})
        due_registration = find_due_registration(plan, pause_from)
        paid_amount = sum_successful_payments(due_registration)
        if (
            pause_reason == PAUSE_REASON_NO_POJA_NO_PAYMENT
            and not was_paused
            and paid_amount > Decimal("0.00")
            and _is_registration_in_pause_window(due_registration, pause_from)
        ):
            _credit_custom_balance(plan.donor, paid_amount)
            metadata["pause_handling_amount"] = str(paid_amount)
        elif pause_reason == PAUSE_REASON_SAMY and paid_amount > Decimal("0.00"):
            metadata["handled_for_samy"] = True
        if pause_reason:
            metadata["pause_reason"] = pause_reason
        else:
            metadata.pop("pause_reason", None)
        plan.metadata = metadata
        plan.pause_from = pause_from
        plan.pause_until = pause_until
        plan.is_active = pause_reason in {PAUSE_REASON_USE_FOR_TEMPLE, PAUSE_REASON_SAMY}
        plan.save()
        if pause_reason == PAUSE_REASON_NO_POJA_NO_PAYMENT:
            self._clear_due_registration_in_pause_window(plan, pause_from=pause_from, pause_until=pause_until)
            recalculate_pending_dues_for_donor_window(
                donor_id=plan.donor_id,
                window_start=pause_from,
                window_end=pause_until,
                today=today,
            )
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
        was_canceled = (
            pause_until == date.max
            or isinstance(pause_metadata.get("cancel_effective_from"), str)
        )
        today = timezone.localdate()
        reactivated = self._reactivate_plan(
            plan,
            force=True,
            additional_metadata_keys=("canceled_at", "cancel_effective_from"),
        )
        if reactivated and was_paused:
            try:
                amount_to_reverse = Decimal(pause_handling_amount) if pause_handling_amount else Decimal("0.00")
            except (InvalidOperation, TypeError):
                amount_to_reverse = Decimal("0.00")
            if (
                pause_reason == PAUSE_REASON_NO_POJA_NO_PAYMENT
                and pause_until
                and pause_until > today
                and amount_to_reverse > Decimal("0.00")
            ):
                _debit_custom_balance(plan.donor, amount_to_reverse)
            if (
                pause_reason == PAUSE_REASON_USE_FOR_TEMPLE
                and pause_until
                and pause_until > today
                and amount_to_reverse > Decimal("0.00")
            ):
                _debit_monthly_donation(plan.donor, amount_to_reverse)
        if reactivated and was_canceled:
            earliest_month = (
                PaymentRecord.objects.filter(
                    donor_id=plan.donor_id,
                    payment_month__isnull=False,
                )
                .aggregate(first_month=Min("payment_month"))
                .get("first_month")
            )
            recalculate_pending_dues_for_donor_window(
                donor_id=plan.donor_id,
                window_start=earliest_month or today,
                window_end=today,
                today=today,
                skip_success_months=False,
            )
        serializer = self.get_serializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="rerun-due")
    def rerun_due(self, request, pk=None):
        plan = self.get_object()
        if plan.recurrence_kind != RecurrenceKind.RECURRING:
            return Response(
                {"detail": "Only recurring plans are eligible for due re-run."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = timezone.localdate()
        if plan.pause_until and plan.pause_until >= today:
            return Response(
                {"detail": "Pause is still active. Re-run is allowed only after pause end date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = rerun_due_payments_for_donor(plan.donor_id, today=today)
        # Refresh only this donor's passbook; avoid global due generation.
        from payments.services import regenerate_donor_passbook

        regenerate_donor_passbook(plan.donor_id, ensure_dues=False)
        return Response(
            {
                "detail": "Due re-run completed for donor.",
                **result,
            }
        )

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
        today = timezone.localdate()
        cancel_from_value = request.data.get("cancel_from")
        cancel_from = parse_date(cancel_from_value) if cancel_from_value else today
        if cancel_from is None:
            return Response({"detail": "Invalid date provided for cancel_from."}, status=status.HTTP_400_BAD_REQUEST)
        if cancel_from < today and request.user.role != UserRole.ADMIN:
            return Response({"detail": "Backdated cancellation is allowed only for admins."}, status=status.HTTP_400_BAD_REQUEST)

        # Treat cancel as an indefinite stop from the selected date.
        # This keeps month-wise calculations accurate for periods before cancel_from.
        indefinite_until = date.max
        plan.pause_from = cancel_from
        plan.pause_until = indefinite_until
        plan.is_active = False
        plan.next_occurrence = None
        metadata = dict(plan.metadata or {})
        metadata.pop("pause_reason", None)
        metadata.pop("pause_handling_amount", None)
        metadata.pop("handled_for_samy", None)
        metadata["canceled_at"] = timezone.localdate().isoformat()
        metadata["cancel_effective_from"] = cancel_from.isoformat()
        plan.metadata = metadata
        plan.save()
        if cancel_from <= today:
            self._clear_due_registration_in_pause_window(
                plan,
                pause_from=cancel_from,
                pause_until=today,
            )
            recalculate_pending_dues_for_donor_window(
                donor_id=plan.donor_id,
                window_start=cancel_from,
                window_end=today,
                today=today,
            )
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

_UBHAYAM_CANONICAL_DATE_OVERRIDES: dict[tuple[int, int, str], tuple[int, ...]] = {
    # May 2026: Sashti must align with temple-published calendar dates.
    (2026, 5, "sashti"): (7, 22),
    # June 2026: day-option corrections from temple calendar validation.
    (2026, 6, "pradosham"): (12, 27),
    (2026, 6, "amavasya"): (14,),
    (2026, 6, "second_ashtami"): (8, 22),
    # September 2026: second Ashtami should appear on 4th and 19th.
    (2026, 9, "second_ashtami"): (4, 19),
    # November 2026: second Ashtami should appear on 2nd.
    (2026, 11, "second_ashtami"): (2,),
    # December 2026: temple calendar corrections.
    (2026, 12, "sankata_chaturthi"): (27,),
    (2026, 12, "second_ashtami"): (31,),
}


def _canonical_override_dates(canonical: str, start: date) -> list[date] | None:
    day_numbers = _UBHAYAM_CANONICAL_DATE_OVERRIDES.get((start.year, start.month, canonical))
    if not day_numbers:
        return None
    return [date(start.year, start.month, day_num) for day_num in day_numbers]


def _collect_tithi_dates_in_range(service: TempleCalendarService, start: date, end: date, targets: tuple[int, ...]) -> list[date]:
    occurrences = service._collect_tithi_dates(start, end, targets)
    return service._compress_consecutive_dates(occurrences)


def _compress_consecutive_dates_keep_first(dates: list[date]) -> list[date]:
    if not dates:
        return []
    deduped: list[date] = []
    for day in dates:
        if deduped and (day - deduped[-1]).days <= 1:
            continue
        deduped.append(day)
    return deduped


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
    override_dates = _canonical_override_dates(canonical, start)
    if override_dates is not None:
        return override_dates

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
        # 2-Ashtami should use the first labeled day when Ashtami spans two dates.
        # Example: May 2026 should map to 9 and 23 (not 10 and 23).
        ashtami_occurrences = service._collect_tithi_dates(start, end, targets=(8, 23))
        return _compress_consecutive_dates_keep_first(ashtami_occurrences)
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
        # Ubhayam report should follow the day-level panchang labeling for Chaturthi.
        # Noon-based matching can drop valid days where Chaturthi ends before noon.
        return _collect_tithi_dates_at_hour(service, start, end, targets=(4,), hour=9)
    return []


@method_decorator(cache_page(60 * 60), name="dispatch")
class PoojaDayOptionCalendarView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

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
    permission_classes = (permissions.IsAuthenticated,)

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
    permission_classes = (permissions.IsAuthenticated,)

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
        is_admin_request = request.user.role == UserRole.ADMIN
        donor_scope_user_id = None if is_admin_request else request.user.id

        force_refresh = (request.query_params.get("refresh") or "").strip()
        cache_scope = "admin" if is_admin_request else f"donor:{donor_scope_user_id}"
        cache_key = f"pooja_donor_calendar:{cache_scope}:{year}:{month}"
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
        tamil_star_occurrences_cache: dict[int, list[date]] = {}
        debug_info: list[dict[str, Any]] = [] if debug_mode else []
        snapshot_option_counter = count(-1, -1)
        # Pre-fetch all PoojaDayOption records once to avoid N+1 queries in
        # build_snapshot_day_option_payload and any-day canonical-options loading.
        _all_day_options = list(PoojaDayOption.objects.order_by("display_order", "id"))
        all_day_options_by_id: dict[int, PoojaDayOption] = {opt.id: opt for opt in _all_day_options}
        all_day_options_by_code: dict[str, PoojaDayOption] = {opt.code: opt for opt in _all_day_options}
        any_day_option_record = next(
            (
                opt
                for opt in _all_day_options
                if _is_any_day_option(opt.code, opt.description)
            ),
            None,
        )
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

        registration_filters = (
            PoojaRegistration.objects.filter(
                donor__isnull=False,
                status__in=(PoojaStatus.PENDING, PoojaStatus.CONFIRMED, PoojaStatus.COMPLETED),
            )
            .exclude(pooja_option_id__in=excluded_option_ids)
            .filter(
                Q(start_date__range=(first_day, last_day))
                | Q(start_date__isnull=True, created_at__gte=month_start_dt, created_at__lt=month_end_dt)
            )
        )
        if donor_scope_user_id is not None:
            registration_filters = registration_filters.filter(donor_id=donor_scope_user_id)
        queryset = (
            registration_filters
            .annotate(
                is_paused_registration=Exists(
                    RecurringPoojaPlan.objects.filter(
                        donor_id=OuterRef("donor_id"),
                        pooja_option_id=OuterRef("pooja_option_id"),
                        recurrence_kind=RecurrenceKind.RECURRING,
                        pause_from__isnull=False,
                        pause_until__isnull=False,
                        pause_from__lte=OuterRef("start_date"),
                        pause_until__gte=OuterRef("start_date"),
                        metadata__pause_reason__in=NO_PAYMENT_PAUSE_REASON_VALUES,
                    ).filter(day_option_id=OuterRef("day_option_id"))
                )
            )
            .exclude(is_paused_registration=True)
            .select_related("donor", "donor__profile", "day_option", "pooja_option")
            .only(
                "id",
                "start_date",
                "created_at",
                "pooja_option_id",
                "additional_notes",
                "day_option_id",
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

        donors_by_date: dict[date, list[dict[str, Any]]] = defaultdict(list)
        seen_donor_ids: dict[date, set[int]] = defaultdict(set)
        day_options_by_date: dict[date, dict[int, dict[str, Any]]] = defaultdict(dict)
        unassigned_any_day_donors: list[dict[str, Any]] = []
        report_name_cache: dict[tuple[int, int, int | None, date], str] = {}

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

        any_day_payload_template = (
            build_day_option_payload(any_day_option_record)
            if any_day_option_record is not None
            else {
                "id": -1,
                "code": "AD",
                "description": "Any Day of Month",
                "category": DayOptionCategory.CODE,
                "display_order": 0,
            }
        )

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
                    "day_option_payload": (
                        any_day_payload_template
                        if is_any_day_payload(day_option_payload)
                        else (day_option_payload or any_day_payload_template)
                    ),
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

        def _collect_dates_for_tamil_star_index(index: int) -> list[date]:
            cached = tamil_star_occurrences_cache.get(index)
            if cached is not None:
                return cached
            occurrences: list[date] = []
            cursor = first_day
            while cursor <= last_day:
                if service.nakshatra_index_on(cursor) == index:
                    occurrences.append(cursor)
                cursor += timedelta(days=1)
            tamil_star_occurrences_cache[index] = occurrences
            return occurrences

        def _extract_tamil_star_labels_from_payload(payload: dict[str, Any] | None) -> list[str]:
            if not isinstance(payload, dict):
                return []

            labels: list[str] = []

            def append_label(raw: Any):
                if raw is None:
                    return
                if isinstance(raw, str):
                    trimmed = raw.strip()
                    if trimmed:
                        labels.append(trimmed)
                    if trimmed.isdigit():
                        try:
                            option = all_day_options_by_id.get(int(trimmed))
                        except (TypeError, ValueError):
                            option = None
                        if option and option.category == DayOptionCategory.TAMIL_STAR:
                            labels.append(option.description)
                            labels.append(option.code)
                    else:
                        option = (
                            all_day_options_by_code.get(trimmed)
                            or all_day_options_by_code.get(trimmed.upper())
                            or all_day_options_by_code.get(trimmed.lower())
                        )
                        if option and option.category == DayOptionCategory.TAMIL_STAR:
                            labels.append(option.description)
                            labels.append(option.code)
                    return
                if isinstance(raw, (int, float)):
                    int_value = int(raw)
                    labels.append(str(int_value))
                    option = all_day_options_by_id.get(int_value)
                    if option and option.category == DayOptionCategory.TAMIL_STAR:
                        labels.append(option.description)
                        labels.append(option.code)

            for key in (
                "selectedTamilStarLabel",
                "selected_tamil_star_label",
                "selectedTamilStarId",
                "selected_tamil_star_id",
                "selectedTamilStar",
                "selected_tamil_star",
            ):
                append_label(payload.get(key))

            members_payload = payload.get("members")
            if isinstance(members_payload, list):
                for member in members_payload:
                    if not isinstance(member, dict):
                        continue
                    append_label(member.get("tamilStar"))
                    append_label(member.get("tamil_star"))

            deduped: list[str] = []
            seen: set[str] = set()
            for label in labels:
                key = label.strip().lower()
                if not key or key in seen:
                    continue
                seen.add(key)
                deduped.append(label)
            return deduped

        def add_donor_for_date(
            donor_id: int,
            donor_payload: dict[str, Any],
            target_date: date | None,
            day_option_for_date: dict[str, Any] | None = None,
            chrt_detail: dict[str, str] | None = None,
        ) -> bool:
            if target_date is None or target_date < first_day or target_date > last_day:
                return False
            if donor_id in seen_donor_ids[target_date]:
                if chrt_detail:
                    for existing in donors_by_date[target_date]:
                        if existing.get("donor_id") == donor_payload.get("donor_id"):
                            details = existing.setdefault("chrt_poojas", [])
                            if chrt_detail not in details:
                                details.append(chrt_detail)
                            break
                return False
            seen_donor_ids[target_date].add(donor_id)
            payload = dict(donor_payload)
            if chrt_detail:
                payload["chrt_poojas"] = [chrt_detail]
            donors_by_date[target_date].append(payload)
            record_day_option_entry(target_date, day_option_for_date)
            return True

        for registration in queryset:
            donor = registration.donor
            if donor is None:
                continue
            registration_date = registration.start_date or (
                registration.created_at.date() if registration.created_at else None
            )
            display_name = donor.name or ""
            if registration_date is not None:
                cache_key = (
                    registration.donor_id,
                    registration.pooja_option_id,
                    registration.day_option_id,
                    registration_date,
                )
                cached_name = report_name_cache.get(cache_key)
                if cached_name is None:
                    pause_plan = (
                        RecurringPoojaPlan.objects.filter(
                            donor_id=registration.donor_id,
                            pooja_option_id=registration.pooja_option_id,
                            day_option_id=registration.day_option_id,
                            recurrence_kind=RecurrenceKind.RECURRING,
                            pause_from__isnull=False,
                            pause_until__isnull=False,
                            pause_from__lte=registration_date,
                            pause_until__gte=registration_date,
                        )
                        .order_by("-updated_at")
                        .first()
                    )
                    if pause_plan:
                        reason = (pause_plan.metadata or {}).get("pause_reason")
                        label = _pause_reason_report_label(reason if isinstance(reason, str) else None)
                        cached_name = label or display_name
                    else:
                        cached_name = display_name
                    report_name_cache[cache_key] = cached_name
                display_name = cached_name
            donor_payload = {
                "donor_id": _resolve_donor_identifier(donor),
                "name": display_name,
                "phone_number": donor.phone_number or "",
            }

            day_option = getattr(registration, "day_option", None)
            day_option_payload = build_day_option_payload(day_option)
            registration_canonical_code = (
                TempleCalendarService._canonicalize_code(day_option.code or "") if day_option else None
            )
            chrt_detail = None
            instructions = (registration.additional_notes or "").strip()
            if registration_canonical_code == "custom_date" and instructions:
                chrt_detail = {
                    "pooja_name": registration.pooja_option.name or "CHRT Pooja",
                    "instructions": instructions,
                }
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
                chrt_detail,
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
                    add_donor_for_date(donor.id, donor_payload, occurrence_date, day_option_payload, chrt_detail)
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

        cart_snapshot_filters = PoojaCartSnapshot.objects.all()
        if donor_scope_user_id is not None:
            cart_snapshot_filters = cart_snapshot_filters.filter(donor_id=donor_scope_user_id)
        cart_snapshots = (
            cart_snapshot_filters.select_related("donor", "donor__profile")
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

        recurring_plan_filters = (
            RecurringPoojaPlan.objects.filter(
                is_active=True,
                recurrence_kind=RecurrenceKind.RECURRING,
            )
            .filter(Q(start_date__isnull=True) | Q(start_date__lte=last_day))
            .exclude(pooja_option_id__in=excluded_option_ids)
        )
        if donor_scope_user_id is not None:
            recurring_plan_filters = recurring_plan_filters.filter(donor_id=donor_scope_user_id)
        recurring_plans = (
            recurring_plan_filters.select_related("donor", "donor__profile", "day_option", "pooja_option")
            .only(
                "id",
                "start_date",
                "next_occurrence",
                "one_time_date",
                "cart_payload",
                "metadata",
                "pooja_option__name",
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
            plan_metadata = getattr(plan, "metadata", {}) or {}
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
            payload_preferred_date = _parse_iso_date(
                payload.get("recurrenceOneTimeDate")
                or payload.get("recurrence_one_time_date")
                or payload.get("customDayDate")
                or payload.get("custom_day_date")
            )
            is_chrt_like_plan = canonical_code == "custom_date" or (
                canonical_code is None and getattr(plan, "one_time_date", None) is not None
            )
            if is_chrt_like_plan:
                preferred_date = getattr(plan, "one_time_date", None) or payload_preferred_date
                if preferred_date is None:
                    if debug_mode:
                        debug_info.append(
                            {
                                "recurring_chrt_missing_preferred_date": {
                                    "plan_id": plan.id,
                                    "day_option_code": getattr(plan.day_option, "code", None),
                                }
                            }
                        )
                    continue
                add_donor_for_date(
                    donor.id,
                    donor_payload,
                    preferred_date,
                    plan_day_option_payload,
                    (
                        {
                            "pooja_name": plan.pooja_option.name or "CHRT Pooja",
                            "instructions": instructions,
                        }
                        if (
                            instructions := str(
                                plan_metadata.get("additional_notes")
                                or plan_metadata.get("donor_instructions")
                                or payload.get("customDayNote")
                                or payload.get("additional_notes")
                                or ""
                            ).strip()
                        )
                        else None
                    ),
                )
                if debug_mode:
                    debug_info.append(
                        {
                            "recurring_chrt_preferred_date": {
                                "plan_id": plan.id,
                                "preferred_date": preferred_date.isoformat(),
                                "source": "one_time_date" if getattr(plan, "one_time_date", None) else "cart_payload",
                            }
                        }
                    )
                continue
            if canonical_code == "tamil_star":
                star_labels = _extract_tamil_star_labels_from_payload(payload)
                if not star_labels:
                    plan_metadata = getattr(plan, "metadata", None)
                    if isinstance(plan_metadata, dict):
                        for _member in (plan_metadata.get("members") or []):
                            if not isinstance(_member, dict):
                                continue
                            for _key in ("tamil_star", "tamilStar"):
                                _val = (_member.get(_key) or "").strip()
                                if _val:
                                    star_labels.append(_val)
                star_index = resolve_nakshatra_index(*star_labels) if star_labels else None
                if star_index is not None:
                    occurrences = _collect_dates_for_tamil_star_index(star_index)
                    anchor_date = plan.start_date or first_day
                    anchor_date = anchor_date if anchor_date >= first_day else first_day
                    selected_occurrence = None
                    for occurrence_date in occurrences:
                        if occurrence_date >= anchor_date:
                            selected_occurrence = occurrence_date
                            break
                    if selected_occurrence is not None:
                        add_donor_for_date(
                            donor.id,
                            donor_payload,
                            selected_occurrence,
                            plan_day_option_payload,
                        )
                    if debug_mode:
                        debug_info.append(
                            {
                                "recurring_tamil_star": {
                                    "plan_id": plan.id,
                                    "labels": star_labels,
                                    "resolved_index": star_index,
                                    "occurrences": [entry.isoformat() for entry in occurrences],
                                    "selected_occurrence": selected_occurrence.isoformat() if selected_occurrence else None,
                                    "anchor_date": anchor_date.isoformat(),
                                }
                            }
                        )
                    # For star-based recurring plans, do not trust stale
                    # cart_payload dayOptionOccurrences/next_occurrence.
                    continue
                if debug_mode:
                    debug_info.append(
                        {
                            "recurring_tamil_star_unresolved": {
                                "plan_id": plan.id,
                                "labels": star_labels,
                            }
                        }
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

        if unassigned_any_day_donors:
            # Stage allocation for Any Day donors:
            # Stage 5 -> add to 0-donor days, Stage 6 -> 1-donor days,
            # Stage 7 -> 2-donor days, then continue similarly if donors remain.
            # Use each donor at most once per month in this staged fill.
            unique_any_day_donors: dict[int, dict[str, Any]] = {}
            for entry in unassigned_any_day_donors:
                donor_pk = entry.get("donor_id")
                if not isinstance(donor_pk, int) or donor_pk in unique_any_day_donors:
                    continue
                unique_any_day_donors[donor_pk] = {
                    "donor_id": donor_pk,
                    "donor_payload": entry.get("donor_payload") or {},
                    "day_option_payload": any_day_payload_template,
                    "source": entry.get("source"),
                }

            def any_day_sort_key(entry: dict[str, Any]) -> tuple[int, int | str, int]:
                donor_payload = entry.get("donor_payload") or {}
                donor_label = str(donor_payload.get("donor_id") or "").strip()
                donor_pk = int(entry.get("donor_id") or 0)
                normalized = donor_label.upper()
                if normalized.startswith("D") and normalized[1:].isdigit():
                    return (0, int(normalized[1:]), donor_pk)
                if donor_label.isdigit():
                    return (1, int(donor_label), donor_pk)
                return (2, donor_label.casefold(), donor_pk)

            any_day_pool = sorted(unique_any_day_donors.values(), key=any_day_sort_key)
            month_dates: list[date] = []
            cursor = first_day
            while cursor <= last_day:
                month_dates.append(cursor)
                cursor += timedelta(days=1)

            target_existing_count = 0
            while any_day_pool:
                current_max = 0
                for day in month_dates:
                    day_count = len(donors_by_date.get(day, []))
                    if day_count > current_max:
                        current_max = day_count
                if target_existing_count > current_max:
                    break

                eligible_dates = [
                    day for day in month_dates if len(donors_by_date.get(day, [])) == target_existing_count
                ]
                allocated_in_stage = 0

                for target_date in eligible_dates:
                    if not any_day_pool:
                        break

                    selected_index = None
                    for index, donor_entry in enumerate(any_day_pool):
                        donor_pk = donor_entry.get("donor_id")
                        if donor_pk in seen_donor_ids[target_date]:
                            continue
                        selected_index = index
                        break

                    if selected_index is None:
                        continue

                    donor_entry = any_day_pool.pop(selected_index)
                    if add_donor_for_date(
                        donor_entry["donor_id"],
                        donor_entry["donor_payload"],
                        target_date,
                        donor_entry["day_option_payload"],
                    ):
                        allocated_in_stage += 1
                    else:
                        # Defensive: if allocation unexpectedly fails, keep donor in pool.
                        any_day_pool.insert(selected_index, donor_entry)

                if debug_mode:
                    debug_info.append(
                        {
                            "any_day_stage_allocation": {
                                "target_existing_count": target_existing_count,
                                "eligible_dates": len(eligible_dates),
                                "allocated": allocated_in_stage,
                                "remaining": len(any_day_pool),
                            }
                        }
                    )
                target_existing_count += 1

            if any_day_pool and debug_mode:
                debug_info.append(
                    {
                        "any_day_unallocated": {
                            "remaining": len(any_day_pool),
                            "donors": [
                                (entry.get("donor_payload") or {}).get("donor_id")
                                for entry in any_day_pool[:25]
                            ],
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


class UbhayamInputMonthView(APIView):
    permission_classes = (IsAdminRole,)

    def get(self, request):
        today = timezone.localdate()
        parsed = _parse_month_key(request.query_params.get("month"))
        if parsed is None:
            month_key = f"{today.year}-{today.month:02d}"
            year = today.year
            month = today.month
        else:
            month_key, year, month = parsed

        first_day, last_day = _month_range(year, month)
        overrides = {
            row.date: row
            for row in UbhayamDateOverride.objects.filter(date__gte=first_day, date__lte=last_day)
        }

        rows = []
        cursor = first_day
        while cursor <= last_day:
            override = overrides.get(cursor)
            raw_star_values = override.tamil_stars if override else []
            raw_option_values = override.pooja_day_option_ids if override else []
            tamil_stars = [
                str(value).strip()
                for value in (raw_star_values if isinstance(raw_star_values, list) else [])
                if str(value).strip()
            ]
            pooja_day_option_ids = []
            for value in (raw_option_values if isinstance(raw_option_values, list) else []):
                try:
                    pooja_day_option_ids.append(int(value))
                except (TypeError, ValueError):
                    continue

            rows.append(
                {
                    "date": cursor.isoformat(),
                    "day_of_month": cursor.strftime("%A"),
                    "tamil_stars": tamil_stars,
                    "pooja_day_option_ids": pooja_day_option_ids,
                }
            )
            cursor += timedelta(days=1)

        latest_run = (
            UbhayamAllocationRun.objects.filter(month=month_key, is_latest=True)
            .order_by("-run_number")
            .first()
        )
        return Response(
            {
                "month": month_key,
                "rows": rows,
                "latest_allocation": (
                    {
                        "run_number": latest_run.run_number,
                        "status": latest_run.status,
                        "row_count": latest_run.row_count,
                        "generated_at": latest_run.generated_at.isoformat() if latest_run.generated_at else None,
                    }
                    if latest_run
                    else None
                ),
            }
        )


class UbhayamInputSaveView(APIView):
    permission_classes = (IsAdminRole,)

    def post(self, request):
        parsed = _parse_month_key(request.data.get("month"))
        if parsed is None:
            return Response({"detail": "month must be in YYYY-MM format."}, status=status.HTTP_400_BAD_REQUEST)
        month_key, year, month = parsed
        first_day, last_day = _month_range(year, month)

        payload_rows = request.data.get("rows")
        if not isinstance(payload_rows, list):
            return Response({"detail": "rows must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        valid_day_option_ids = set(PoojaDayOption.objects.values_list("id", flat=True))

        saved_rows = 0
        processed_dates: set[date] = set()

        for entry in payload_rows:
            if not isinstance(entry, dict):
                continue
            row_date = _parse_iso_date(entry.get("date"))
            if row_date is None:
                continue
            if row_date < first_day or row_date > last_day:
                continue
            processed_dates.add(row_date)

            raw_stars = entry.get("tamil_stars")
            normalized_stars: list[str] = []
            seen_stars: set[str] = set()
            if isinstance(raw_stars, list):
                for value in raw_stars:
                    text = str(value).strip()
                    key = text.casefold()
                    if not text or key in seen_stars:
                        continue
                    seen_stars.add(key)
                    normalized_stars.append(text)

            raw_option_ids = entry.get("pooja_day_option_ids")
            normalized_option_ids: list[int] = []
            seen_option_ids: set[int] = set()
            if isinstance(raw_option_ids, list):
                for value in raw_option_ids:
                    try:
                        option_id = int(value)
                    except (TypeError, ValueError):
                        continue
                    if option_id in seen_option_ids or option_id not in valid_day_option_ids:
                        continue
                    seen_option_ids.add(option_id)
                    normalized_option_ids.append(option_id)

            if not normalized_stars and not normalized_option_ids:
                UbhayamDateOverride.objects.filter(date=row_date).delete()
                continue

            UbhayamDateOverride.objects.update_or_create(
                date=row_date,
                defaults={
                    "tamil_stars": normalized_stars,
                    "pooja_day_option_ids": normalized_option_ids,
                    "updated_by": request.user,
                },
            )
            saved_rows += 1

        return Response(
            {
                "month": month_key,
                "saved_rows": saved_rows,
                "processed_dates": len(processed_dates),
            }
        )


class UbhayamInputAllocateView(APIView):
    permission_classes = (IsAdminRole,)

    def post(self, request):
        parsed = _parse_month_key(request.data.get("month"))
        if parsed is None:
            return Response({"detail": "month must be in YYYY-MM format."}, status=status.HTTP_400_BAD_REQUEST)
        month_key, year, month = parsed
        first_day, last_day = _month_range(year, month)

        overrides = list(
            UbhayamDateOverride.objects.filter(date__gte=first_day, date__lte=last_day).order_by("date")
        )
        if len(overrides) == 0:
            return Response(
                {"detail": "No input rows found for this month. Save input first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        month_dates: list[date] = []
        cursor = first_day
        while cursor <= last_day:
            month_dates.append(cursor)
            cursor += timedelta(days=1)

        override_by_date = {row.date: row for row in overrides}
        missing_dates = [day.isoformat() for day in month_dates if day not in override_by_date]
        if missing_dates:
            preview = ", ".join(missing_dates[:5])
            suffix = "..." if len(missing_dates) > 5 else ""
            return Response(
                {
                    "detail": (
                        "Cannot allocate until all dates in the month are filled. "
                        f"Missing input for: {preview}{suffix}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        option_ids: set[int] = set()
        for override in overrides:
            raw_values = override.pooja_day_option_ids if isinstance(override.pooja_day_option_ids, list) else []
            for value in raw_values:
                try:
                    option_ids.add(int(value))
                except (TypeError, ValueError):
                    continue
        day_option_by_id = {
            option.id: option
            for option in PoojaDayOption.objects.filter(id__in=option_ids).only("id", "description")
        }

        def _normalize_option_ids(raw_values: list[Any] | Any) -> list[int]:
            normalized: list[int] = []
            seen: set[int] = set()
            values = raw_values if isinstance(raw_values, list) else []
            for value in values:
                try:
                    option_id = int(value)
                except (TypeError, ValueError):
                    continue
                if option_id in seen:
                    continue
                seen.add(option_id)
                normalized.append(option_id)
            return normalized

        def _normalize_tamil_stars(raw_values: list[Any] | Any) -> list[str]:
            normalized: list[str] = []
            seen: set[str] = set()
            values = raw_values if isinstance(raw_values, list) else []
            for value in values:
                text = str(value).strip()
                key = text.casefold()
                if not text or key in seen:
                    continue
                seen.add(key)
                normalized.append(text)
            return normalized

        normalized_by_date: dict[date, dict[str, Any]] = {}
        tamil_star_indexes_by_date: dict[date, set[int]] = {}
        invalid_dates: list[str] = []
        for day in month_dates:
            override = override_by_date.get(day)
            if override is None:
                continue
            tamil_stars = _normalize_tamil_stars(override.tamil_stars)
            option_ids_for_date = _normalize_option_ids(override.pooja_day_option_ids)
            option_labels = [
                (day_option_by_id[option_id].description or "").strip()
                for option_id in option_ids_for_date
                if option_id in day_option_by_id and (day_option_by_id[option_id].description or "").strip()
            ]
            # Keep option labels unique but stable.
            option_labels = list(dict.fromkeys(option_labels))

            if not tamil_stars or not option_labels:
                invalid_dates.append(day.isoformat())

            tamil_star_indexes_by_date[day] = {
                index
                for index in (resolve_nakshatra_index(value) for value in tamil_stars)
                if index is not None
            }

            normalized_by_date[day] = {
                "tamil_stars": tamil_stars,
                "option_labels": option_labels,
            }

        if invalid_dates:
            preview = ", ".join(invalid_dates[:5])
            suffix = "..." if len(invalid_dates) > 5 else ""
            return Response(
                {
                    "detail": (
                        "Cannot allocate until all dates have both Tamil star and Pooja day option. "
                        f"Incomplete dates: {preview}{suffix}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        def _donor_sort_key(entry: dict[str, str]) -> tuple[int, int | str]:
            donor_id = (entry.get("donor_id") or "").strip()
            normalized = donor_id.upper()
            if normalized.startswith("D") and normalized[1:].isdigit():
                return (0, int(normalized[1:]))
            if donor_id.isdigit():
                return (1, int(donor_id))
            return (2, donor_id.casefold())

        option_labels_by_date = {}
        for day in month_dates:
            option_labels_by_date[day] = list(normalized_by_date[day]["option_labels"])

        option_labels_for_month = sorted(
            {
                label
                for value in normalized_by_date.values()
                for label in value.get("option_labels", [])
                if isinstance(label, str) and label.strip()
            },
            key=lambda value: value.casefold(),
        )
        eligible_plan_labels_by_date: dict[date, dict[str, list[dict[str, str]]]] = {
            day: defaultdict(list) for day in month_dates
        }
        donors_by_option_label: dict[str, list[dict[str, str]]] = {}
        seen_plan_entries: set[tuple[str, str]] = set()

        active_plans = (
            RecurringPoojaPlan.objects.filter(
                recurrence_kind=RecurrenceKind.RECURRING,
            )
            .select_related(
                "donor",
                "donor__profile",
                "day_option",
                "origin_registration",
                "pooja_option",
                "pooja_option__parent",
            )
            .prefetch_related("origin_registration__members")
            .order_by("donor__id", "id")
        )

        for plan in active_plans:
            donor = getattr(plan, "donor", None)
            donor_identifier = _resolve_donor_identifier(donor)
            option_label = _resolve_plan_day_option_label(plan)
            if not donor_identifier or not option_label:
                continue

            target_date = _resolve_plan_specific_target_date(
                plan,
                first_day,
                tamil_star_indexes_by_date=tamil_star_indexes_by_date,
                option_labels_by_date=option_labels_by_date,
            )

            if _is_ubhayam_excluded_pooja_option(getattr(plan, "pooja_option", None)):
                continue

            day_option_code = (getattr(getattr(plan, "day_option", None), "code", None) or "").strip().upper()
            is_chrt_option = day_option_code == "CHRT"
            if is_chrt_option:
                if target_date is None or not _plan_is_assignable_for_ubhayam_target_date(plan, target_date):
                    continue
            else:
                if not _plan_contributes_amount_for_month(plan, first_day):
                    continue

            if option_label not in option_labels_for_month:
                continue
            if target_date is None:
                continue
            if target_date < first_day or target_date > last_day:
                continue
            if option_label not in option_labels_by_date.get(target_date, []):
                if is_chrt_option:
                    option_labels_by_date.setdefault(target_date, []).append(option_label)
                    normalized_by_date[target_date]["option_labels"] = list(dict.fromkeys(option_labels_by_date[target_date]))
                    if option_label not in option_labels_for_month:
                        option_labels_for_month.append(option_label)
                else:
                    continue

            plan_entry = {
                "donor_id": donor_identifier,
                "donor_name": ((getattr(donor, "name", None) or "").strip()),
                "donor_phone_number": ((getattr(donor, "phone_number", None) or "").strip()),
                "tamil_star_indexes": sorted(_extract_plan_tamil_star_indexes(plan)),
            }
            eligible_plan_labels_by_date[target_date][option_label].append(plan_entry)
            seen_plan_entries.add((donor_identifier, option_label))

        for day in month_dates:
            label_map = eligible_plan_labels_by_date[day]
            for label, entries in label_map.items():
                deduped_entries: dict[str, dict[str, str]] = {}
                for entry in entries:
                    deduped_entries.setdefault(entry["donor_id"], entry)
                label_map[label] = sorted(deduped_entries.values(), key=_donor_sort_key)
                if label not in donors_by_option_label:
                    donors_by_option_label[label] = []
                for entry in label_map[label]:
                    if all(existing["donor_id"] != entry["donor_id"] for existing in donors_by_option_label[label]):
                        donors_by_option_label[label].append(entry)

        if option_labels_for_month:
            donor_rows = list(
                UbhayamReport.objects.filter(pooja_day_option__in=option_labels_for_month)
                .order_by("pooja_day_option", "donor_id", "s_no")
                .values("pooja_day_option", "donor_id", "donor_name", "donor_phone_number")
            )
            grouped: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
            for donor in donor_rows:
                label = (donor.get("pooja_day_option") or "").strip()
                donor_identifier = (donor.get("donor_id") or "").strip()
                if not label or not donor_identifier or donor_identifier in grouped[label]:
                    continue
                if _is_plan_specific_ubhayam_option(None, label):
                    continue
                if (donor_identifier, label) in seen_plan_entries:
                    continue
                if not _ubhayam_donor_option_contributes_for_month(
                    donor_identifier,
                    label,
                    first_day,
                ):
                    continue
                grouped[label][donor_identifier] = {
                    "donor_id": donor_identifier,
                    "donor_name": (donor.get("donor_name") or "").strip(),
                    "donor_phone_number": (donor.get("donor_phone_number") or "").strip(),
                    "tamil_star_indexes": [],
                }
            for label, donor_map in grouped.items():
                fallback_entries = sorted(donor_map.values(), key=_donor_sort_key)
                if label not in donors_by_option_label:
                    donors_by_option_label[label] = []
                existing_ids = {entry["donor_id"] for entry in donors_by_option_label[label]}
                for entry in fallback_entries:
                    if entry["donor_id"] not in existing_ids:
                        donors_by_option_label[label].append(entry)
                        existing_ids.add(entry["donor_id"])

        allocated_donors_by_date: dict[date, list[dict[str, str]]] = {day: [] for day in month_dates}
        seen_donor_ids_by_date: dict[date, set[str]] = {day: set() for day in month_dates}

        # Distribute each option donor-pool across eligible dates.
        # "Any Day of Month" uses a balanced staged fill — each donor appears once.
        # "On 2 ashtami day of month" repeats the same donor pool on each eligible
        # occurrence in the month. All other labels retain the one-time pool behavior.
        for option_label in option_labels_for_month:
            eligible_dates = [day for day in month_dates if option_label in option_labels_by_date[day]]
            donor_pool = list(donors_by_option_label.get(option_label) or [])
            if not eligible_dates or not donor_pool:
                continue

            is_any_day_label = _normalize_text(option_label) in ANY_DAY_OPTION_DESCRIPTIONS
            is_second_ashtami_label = _normalize_text(option_label) == _normalize_text(
                "On 2 ashtami day of month"
            )

            targeted_entries_by_date = {
                day: list(eligible_plan_labels_by_date.get(day, {}).get(option_label, []))
                for day in eligible_dates
            }

            if not is_any_day_label and not is_second_ashtami_label:
                targeted_ids = {
                    entry["donor_id"]
                    for entries in targeted_entries_by_date.values()
                    for entry in entries
                }
                donor_pool = [entry for entry in donor_pool if entry["donor_id"] not in targeted_ids]
                for target_date in eligible_dates:
                    for donor_entry in targeted_entries_by_date.get(target_date, []):
                        donor_identifier = donor_entry["donor_id"]
                        if donor_identifier in seen_donor_ids_by_date[target_date]:
                            continue
                        allocated_donors_by_date[target_date].append(donor_entry)
                        seen_donor_ids_by_date[target_date].add(donor_identifier)

            if is_second_ashtami_label:
                # Second Ashtami should show the same donor pool on both eligible
                # dates in the month.
                for target_date in eligible_dates:
                    for donor_entry in donor_pool:
                        donor_identifier = donor_entry["donor_id"]
                        if donor_identifier in seen_donor_ids_by_date[target_date]:
                            continue
                        allocated_donors_by_date[target_date].append(donor_entry)
                        seen_donor_ids_by_date[target_date].add(donor_identifier)
                continue

            counts_by_date = {
                day: len(allocated_donors_by_date.get(day, []))
                for day in eligible_dates
            }
            target_existing_count = min(counts_by_date.values()) if counts_by_date else 0

            while donor_pool:
                current_max = max(counts_by_date.values()) if counts_by_date else 0
                if target_existing_count > current_max:
                    break

                dates_for_stage = [
                    day for day in eligible_dates if counts_by_date.get(day, 0) == target_existing_count
                ]
                allocated_in_stage = 0

                for target_date in dates_for_stage:
                    if not donor_pool:
                        break

                    selected_index = None
                    for index, donor_entry in enumerate(donor_pool):
                        donor_identifier = donor_entry["donor_id"]
                        if donor_identifier in seen_donor_ids_by_date[target_date]:
                            continue
                        donor_star_indexes = {
                            int(value)
                            for value in donor_entry.get("tamil_star_indexes", [])
                            if isinstance(value, int)
                        }
                        if donor_star_indexes and not (
                            donor_star_indexes & tamil_star_indexes_by_date.get(target_date, set())
                        ):
                            continue
                        selected_index = index
                        break

                    if selected_index is None:
                        continue

                    donor_entry = donor_pool.pop(selected_index)
                    allocated_donors_by_date[target_date].append(donor_entry)
                    seen_donor_ids_by_date[target_date].add(donor_entry["donor_id"])
                    counts_by_date[target_date] = counts_by_date.get(target_date, 0) + 1
                    allocated_in_stage += 1

                if allocated_in_stage == 0:
                    break
                target_existing_count += 1

        with transaction.atomic():
            existing_runs = (
                UbhayamAllocationRun.objects.select_for_update()
                .filter(month=month_key)
                .order_by("-run_number")
            )
            latest_for_month = existing_runs.filter(is_latest=True)
            current_max_run = existing_runs.first().run_number if existing_runs.exists() else 0
            next_run_number = current_max_run + 1

            run = UbhayamAllocationRun.objects.create(
                month=month_key,
                run_number=next_run_number,
                is_latest=False,
                status=UbhayamAllocationStatus.PENDING,
                generated_by=request.user,
            )

            rows_to_create: list[UbhayamAllocationRow] = []
            for day in month_dates:
                normalized = normalized_by_date[day]
                tamil_stars = normalized["tamil_stars"]
                option_labels = normalized["option_labels"]
                sorted_donors = sorted(allocated_donors_by_date[day], key=_donor_sort_key)
                rows_to_create.append(
                    UbhayamAllocationRow(
                        run=run,
                        date=day,
                        day_of_month=day.strftime("%A"),
                        tamil_star=", ".join(
                            [str(value).strip() for value in tamil_stars if str(value).strip()]
                        ),
                        pooja_day_option=", ".join(option_labels),
                        donor_id=", ".join([entry["donor_id"] for entry in sorted_donors]),
                        donor_name=", ".join([entry["donor_name"] for entry in sorted_donors if entry["donor_name"]]),
                        donor_mobile_number=", ".join(
                            [entry["donor_phone_number"] for entry in sorted_donors if entry["donor_phone_number"]]
                        ),
                    )
                )

            if rows_to_create:
                UbhayamAllocationRow.objects.bulk_create(rows_to_create, batch_size=500)
            latest_for_month.update(is_latest=False)
            run.is_latest = True
            run.status = UbhayamAllocationStatus.COMPLETED
            run.row_count = len(rows_to_create)
            run.save(update_fields=["is_latest", "status", "row_count", "updated_at"])

        return Response(
            {
                "month": month_key,
                "run_number": run.run_number,
                "row_count": run.row_count,
                "is_latest": run.is_latest,
                "status": run.status,
            }
        )


class UbhayamAllocationLatestView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        parsed = _parse_month_key(request.query_params.get("month"))
        if parsed is None:
            return Response({"detail": "month must be in YYYY-MM format."}, status=status.HTTP_400_BAD_REQUEST)
        month_key, _, _ = parsed
        if month_key < UBHAYAM_DB_CUTOVER_MONTH:
            return Response({"month": month_key, "rows": [], "latest_run": None})

        latest_run = (
            UbhayamAllocationRun.objects.filter(month=month_key, is_latest=True)
            .order_by("-run_number")
            .first()
        )
        if latest_run is None:
            return Response({"month": month_key, "rows": [], "latest_run": None})

        latest_rows = latest_run.rows.all().order_by("date", "id")
        if request.user.role == UserRole.DONOR:
            donor_identifier = None
            donor_profile = DonorProfile.objects.filter(user_id=request.user.id).only("donor_number").first()
            if donor_profile is not None:
                donor_identifier = donor_profile.donor_id
            rows = [
                serialized
                for serialized in (
                    _serialize_ubhayam_allocation_row_for_donor(row, donor_identifier)
                    for row in latest_rows
                )
                if serialized is not None
            ]
        else:
            rows = [_serialize_ubhayam_allocation_row(row) for row in latest_rows]
        return Response(
            {
                "month": month_key,
                "latest_run": {
                    "run_number": latest_run.run_number,
                    "status": latest_run.status,
                    "row_count": latest_run.row_count,
                    "generated_at": latest_run.generated_at.isoformat() if latest_run.generated_at else None,
                },
                "rows": rows,
            }
        )


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
