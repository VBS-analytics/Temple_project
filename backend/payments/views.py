"""Payment API views."""

from datetime import date
from calendar import monthrange
from decimal import Decimal, ROUND_CEILING
from io import BytesIO
from typing import Iterable

from django.http import FileResponse
from django.db import transaction
from django.db.models import Max, Q, Sum
from django.utils import timezone
from django.db.models import Window, F
from django.db.models.functions import RowNumber
from django.core.cache import cache
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.access import can_view_payment_statement
from accounts.models import User, UserRole
from common.permissions import IsAdminRole
from pooja.models import PoojaCartSnapshot, RecurringPoojaPlan, RecurrenceKind
from .models import (
    CombinePaymentMapping,
    ExpenseRecord,
    PaymentRecord,
    PassbookEntry,
    PaymentStatus,
)
from .serializers import ExpenseRecordSerializer, PaymentRecordSerializer, PassbookEntrySerializer
from .services import regenerate_all_passbooks, regenerate_donor_passbook
from pooja.services.recurrence import _clean_stale_chrt_dues
from openpyxl import Workbook


def _parse_month_key(value):
    if value is None:
        return None
    raw = value.strip() if isinstance(value, str) else str(value).strip()
    if not raw:
        return None
    parts = raw.split("-", 1)
    if len(parts) != 2:
        return None
    try:
        year = int(parts[0])
        month = int(parts[1])
    except ValueError:
        return None
    if month < 1 or month > 12:
        return None
    return date(year, month, 1)


def _shift_month(dt: date, delta_months: int) -> date:
    """Return dt shifted by delta_months months, keeping day=1."""
    year = dt.year + (dt.month - 1 + delta_months) // 12
    month = (dt.month - 1 + delta_months) % 12 + 1
    day = min(dt.day, monthrange(year, month)[1])
    return date(year, month, day)


def _maybe_clean_stale_chrt_dues(*, force: bool = False) -> None:
    """Throttle expensive CHRT cleanup during normal read requests."""
    cache_key = "payments:stale_chrt_cleanup:last_run"
    if not force and cache.get(cache_key):
        return
    _clean_stale_chrt_dues()
    cache.set(cache_key, True, timeout=300)


def _donor_passbook_needs_refresh(donor_id: int, current_month: date) -> bool:
    latest_entry = (
        PassbookEntry.objects.filter(donor_id=donor_id)
        .order_by("-entry_date", "-created_at", "-id")
        .only("entry_date", "created_at")
        .first()
    )
    if not latest_entry:
        return True
    latest_month = latest_entry.entry_date.replace(day=1)
    if latest_month < current_month:
        return True

    latest_passbook_ts = latest_entry.created_at
    latest_payment_ts = (
        PaymentRecord.objects.filter(donor_id=donor_id)
        .aggregate(last_ts=Max("updated_at"))
        .get("last_ts")
    )
    latest_plan_ts = (
        RecurringPoojaPlan.objects.filter(donor_id=donor_id)
        .aggregate(last_ts=Max("updated_at"))
        .get("last_ts")
    )

    latest_source_ts = latest_payment_ts
    if latest_plan_ts and (latest_source_ts is None or latest_plan_ts > latest_source_ts):
        latest_source_ts = latest_plan_ts

    if latest_source_ts and latest_passbook_ts and latest_source_ts > latest_passbook_ts:
        return True

    # Detect stale passbooks that missed earlier recurring due months.
    # This can happen when a passbook was generated with old logic and no
    # later source updates occurred to trigger timestamp-based refresh.
    earliest_expected_due_month = (
        RecurringPoojaPlan.objects.filter(
            donor_id=donor_id,
            is_active=True,
            recurrence_kind=RecurrenceKind.RECURRING,
        )
        .exclude(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))
        .order_by("start_date", "created_at")
        .values_list("start_date", "created_at")
        .first()
    )
    if earliest_expected_due_month:
        start_date, created_at = earliest_expected_due_month
        seed_date = start_date or (created_at.date() if created_at else None)
        if seed_date:
            expected_month = seed_date.replace(day=1)
            if expected_month <= current_month:
                first_due_entry = (
                    PassbookEntry.objects.filter(donor_id=donor_id, entry_type="due")
                    .order_by("entry_date", "id")
                    .only("entry_date")
                    .first()
                )
                if first_due_entry is None:
                    return True
                if first_due_entry.entry_date.replace(day=1) > expected_month:
                    return True
    return False


def _refresh_passbooks_if_needed(
    donor_ids: Iterable[int],
    *,
    force: bool,
    current_month: date,
) -> None:
    for donor_id in donor_ids:
        if force or _donor_passbook_needs_refresh(donor_id, current_month):
            regenerate_donor_passbook(donor_id)


def _closing_due_for_donor(donor_id: int):
    """Best-effort helper to fetch the latest closing due for a donor."""
    try:
        regenerate_donor_passbook(donor_id, ensure_dues=False)
    except Exception:
        # Do not block payment creation if regeneration fails.
        pass

    latest_entry = (
        PassbookEntry.objects.filter(donor_id=donor_id)
        .order_by("-entry_date", "-id")
        .first()
    )

    if latest_entry is None:
        return None

    try:
        return Decimal(latest_entry.closing_due)
    except Exception:
        return None


def _closing_due_for_donor(donor_id: int):
    """Best-effort helper to fetch the latest closing due for a donor."""
    try:
        regenerate_donor_passbook(donor_id, ensure_dues=False)
    except Exception:
        # Do not block payment creation if regeneration fails.
        pass

    latest_entry = (
        PassbookEntry.objects.filter(donor_id=donor_id)
        .order_by("-entry_date", "-id")
        .first()
    )

    if latest_entry is None:
        return None

    try:
        return Decimal(latest_entry.closing_due)
    except Exception:
        return None


class PaymentRecordViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRecordSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        # Ensure stale CHRT dues are cleaned before returning any records.
        # Throttled to avoid expensive work on each list call.
        _maybe_clean_stale_chrt_dues()

        qs = (
            PaymentRecord.objects.select_related("donor", "registration", "registration__pooja_option")
            .prefetch_related("registration__payments")
        )

        # Safety net: correct current-month combined dues to exclude CHRT amounts
        current_month = timezone.localdate().replace(day=1)
        try:
            pending_dues = qs.filter(
                registration__isnull=True,
                status=PaymentStatus.PENDING,
                payment_month=current_month,
            )
            for due in pending_dues:
                non_chrt_total = (
                    RecurringPoojaPlan.objects.filter(
                        donor_id=due.donor_id,
                        is_active=True,
                        recurrence_kind=RecurrenceKind.RECURRING,
                    )
                    .exclude(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))
                    .aggregate(total=Sum("amount"))
                    .get("total")
                    or Decimal("0.00")
                )
                if non_chrt_total <= 0:
                    due.delete()
                    continue
                if due.amount != non_chrt_total:
                    due.amount = non_chrt_total
                    due.notes = "Monthly recurring pooja contribution due (auto-corrected to exclude CHRT)"
                    due.save(update_fields=["amount", "notes", "updated_at"])
        except Exception:
            # Best-effort fix; don't block API
            pass

        donor_id_param = self.request.query_params.get("donor_id")
        donor_phone_param = self.request.query_params.get("donor_phone")
        donor_search = self.request.query_params.get("donor")
        filters = Q()
        has_filters = False

        if donor_id_param:
            donor_id_param = donor_id_param.strip()
            if donor_id_param:
                try:
                    donor_id_value = int(donor_id_param)
                except ValueError:
                    donor_id_value = None
                if donor_id_value is not None:
                    filters &= Q(donor__id=donor_id_value)
                    has_filters = True

        if donor_phone_param:
            donor_phone_param = donor_phone_param.strip()
            if donor_phone_param:
                filters &= Q(donor__phone_number__icontains=donor_phone_param)
                has_filters = True

        if donor_search:
            donor_search = donor_search.strip()
            if donor_search:
                search_filters = Q(donor__phone_number__icontains=donor_search)
                if donor_search.isdigit():
                    search_filters |= Q(donor__id=int(donor_search))
                filters &= search_filters
                has_filters = True

        if has_filters:
            qs = qs.filter(filters)

        if self.request.user.role == UserRole.ADMIN:
            return qs

        current_month = timezone.localdate().replace(day=1)
        subordinate_mappings = CombinePaymentMapping.objects.filter(parent_donor=self.request.user)
        for mapping in subordinate_mappings:
            if mapping.is_active_on(current_month):
                return qs.none()

        active_parent_ids = {
            mapping.parent_donor_id
            for mapping in CombinePaymentMapping.objects.filter(main_donor=self.request.user)
            if mapping.is_active_on(current_month) and mapping.parent_donor_id is not None
        }
        if active_parent_ids:
            return qs.filter(Q(donor=self.request.user) | Q(donor_id__in=active_parent_ids))
        return qs.filter(donor=self.request.user)

    def perform_create(self, serializer):
        """
        Allow main donors to record payments on behalf of active parent donors.
        - If donor_id is provided and is an active parent mapping for the current month,
          attribute the payment to that parent donor.
        - Otherwise, default to the authenticated user.
        """
        user = self.request.user
        target_donor = user
        target_is_parent = False

        donor_id_raw = self.request.data.get("donor_id")
        if donor_id_raw:
            try:
                donor_id = int(donor_id_raw)
            except (TypeError, ValueError):
                donor_id = None
            if donor_id:
                current_month = timezone.localdate().replace(day=1)
                # Is this donor one of the active parents?
                mapping = (
                    CombinePaymentMapping.objects.filter(main_donor=user, parent_donor_id=donor_id)
                    .first()
                )
                if mapping and mapping.is_active_on(current_month):
                    target_donor = mapping.parent_donor
                    target_is_parent = True
                elif donor_id == user.id:
                    target_donor = user
                    target_is_parent = False

        if target_is_parent:
            main_closing_due = _closing_due_for_donor(user.id) or Decimal("0")
            if main_closing_due > 0:
                raise ValidationError(
                    {
                        "detail": (
                            "Please clear the main donor's outstanding due before paying for parent donors."
                        )
                    }
                )

        payment = serializer.save(donor=target_donor)
        
        # Note: We do NOT update the opening_balance during the month.
        # The opening_balance (custom_number) should remain constant for the entire month.
        # It will be updated to the closing balance only at month-end or via admin action.
        # 
        # The closing due for the current month is calculated as:
        # closing_balance = opening_balance + current_month_due - current_month_payments
        # This is computed dynamically in the serializer and on the Payment Statement page.


class ExpenseRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseRecordSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        queryset = ExpenseRecord.objects.all()
        if self.request.user.role != UserRole.ADMIN:
            queryset = queryset.filter(created_by=self.request.user)

        month_param = self.request.query_params.get("month")
        if month_param:
            try:
                year, month = map(int, month_param.split("-", 1))
            except ValueError:
                pass
            else:
                queryset = queryset.filter(transaction_date__year=year, transaction_date__month=month)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CombinePaymentMappingView(APIView):
    permission_classes = (IsAdminRole,)

    def _group_timestamps(self, first, second):
        if first is None:
            return second
        if second is None:
            return first
        return second if second > first else first

    def _entry_payload(self, main_user, parent_mappings, saved_at):
        saved_at_value = saved_at or timezone.now()
        return {
            "main_donor": {
                "id": main_user.id,
                "name": main_user.name,
                "phone": main_user.phone_number,
            },
            "parent_donors": [
                {
                    "id": mapping.parent_donor.id,
                    "name": mapping.parent_donor.name,
                    "phone": mapping.parent_donor.phone_number,
                    "effective_from": mapping.effective_from.isoformat() if mapping.effective_from else None,
                    "effective_to": mapping.effective_to.isoformat() if mapping.effective_to else None,
                    "active": mapping.is_active_on(),
                }
                for mapping in parent_mappings
            ],
            "saved_at": saved_at_value.isoformat(),
        }

    def _validate_main_due_is_zero(self, main_user: User):
        main_closing_due = _closing_due_for_donor(main_user.id) or Decimal("0.00")
        if main_closing_due > 0:
            raise ValidationError(
                {
                    "detail": (
                        f"Main donor {main_user.phone_number} has outstanding due ₹{main_closing_due:.2f}. "
                        "Clear dues before uncombining/removing parent donors."
                    )
                }
            )

    def get(self, request):
        mappings = (
            CombinePaymentMapping.objects.select_related("main_donor", "parent_donor")
            .order_by("-updated_at", "-created_at")
            .all()
        )
        grouped: dict[int, dict] = {}
        for mapping in mappings:
            saved_at = mapping.updated_at or mapping.created_at
            entry = grouped.get(mapping.main_donor_id)
            if entry is None:
                entry = {
                    "main_user": mapping.main_donor,
                    "parent_mappings": [],
                    "saved_at": saved_at,
                }
                grouped[mapping.main_donor_id] = entry
            entry["parent_mappings"].append(mapping)
            entry["saved_at"] = self._group_timestamps(entry["saved_at"], saved_at)

        payload = [
            self._entry_payload(group["main_user"], group["parent_mappings"], group["saved_at"])
            for group in grouped.values()
        ]
        return Response(payload)

    def post(self, request):
        main_phone = (request.data.get("main_phone") or "").strip()
        parent_phones = request.data.get("parent_phones") or []

        if not main_phone:
            return Response(
                {"detail": "Main donor phone number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(parent_phones, list):
            return Response(
                {"detail": "parent_phones must be a list of phone numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cleaned_parents = [phone.strip() for phone in parent_phones if phone and phone.strip()]
        cleaned_parents = list(dict.fromkeys(cleaned_parents))
        if not cleaned_parents:
            return Response(
                {"detail": "Provide at least one parent donor phone number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        main_user = User.objects.filter(phone_number__iexact=main_phone).first()
        if main_user is None:
            return Response({"detail": "Main donor not found."}, status=status.HTTP_400_BAD_REQUEST)

        parent_users = []
        for parent_phone in cleaned_parents:
            if parent_phone.casefold() == main_user.phone_number.casefold():
                continue
            parent_user = User.objects.filter(phone_number__iexact=parent_phone).first()
            if parent_user is None:
                return Response(
                    {"detail": f"Parent donor not found: {parent_phone}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            parent_users.append(parent_user)

        if not parent_users:
            return Response(
                {"detail": "Valid parent donor phone numbers are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        effective_month_raw = request.data.get("effective_month")
        effective_month = None
        if effective_month_raw not in (None, ''):
            effective_month = _parse_month_key(effective_month_raw)
            if effective_month is None:
                return Response(
                    {"detail": "Provide a valid effective_month in YYYY-MM format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        uncombine_present = "uncombine_month" in request.data
        uncombine_month_raw = request.data.get("uncombine_month")
        uncombine_month = None
        if uncombine_present and uncombine_month_raw not in (None, ''):
            uncombine_month = _parse_month_key(uncombine_month_raw)
            if uncombine_month is None:
                return Response(
                    {"detail": "Provide a valid uncombine_month in YYYY-MM format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if effective_month and uncombine_month and uncombine_month <= effective_month:
            return Response(
                {"detail": "Uncombine month must be after the effective month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_parent_ids = set(
            CombinePaymentMapping.objects.filter(main_donor=main_user).values_list("parent_donor_id", flat=True)
        )
        next_parent_ids = {parent.id for parent in parent_users}
        removed_parent_ids = existing_parent_ids - next_parent_ids

        # Enforce due-clear rule before any uncombine/removal action.
        if removed_parent_ids or (uncombine_present and uncombine_month is not None):
            try:
                self._validate_main_due_is_zero(main_user)
            except ValidationError as exc:
                return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            CombinePaymentMapping.objects.filter(main_donor=main_user).exclude(
                parent_donor__in=parent_users
            ).delete()

            for parent_user in parent_users:
                mapping, _ = CombinePaymentMapping.objects.get_or_create(
                    main_donor=main_user,
                    parent_donor=parent_user,
                )
                if effective_month:
                    mapping.effective_from = effective_month
                if uncombine_present:
                    mapping.effective_to = uncombine_month
                mapping.save()

        mapping_list = list(
            CombinePaymentMapping.objects.filter(main_donor=main_user).select_related("parent_donor")
        )
        if mapping_list:
            timestamp_candidates = [
                mapping.updated_at or mapping.created_at or timezone.now() for mapping in mapping_list
            ]
            saved_at = max(timestamp_candidates)
        else:
            saved_at = timezone.now()
        payload = self._entry_payload(main_user, mapping_list, saved_at)
        return Response(payload, status=status.HTTP_201_CREATED)

    def delete(self, request):
        main_phone = (request.data.get("main_phone") or request.query_params.get("main_phone") or "").strip()
        parent_phones = request.data.get("parent_phones") or []

        if not main_phone:
            return Response(
                {"detail": "Main donor phone number is required for deletion."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        main_user = User.objects.filter(phone_number__iexact=main_phone).first()
        if main_user is None:
            return Response({"detail": "Main donor not found."}, status=status.HTTP_400_BAD_REQUEST)

        cleaned_parents = []
        if isinstance(parent_phones, list):
            cleaned_parents = [phone.strip() for phone in parent_phones if phone and phone.strip()]
        parent_users = []
        for parent_phone in cleaned_parents:
            user = User.objects.filter(phone_number__iexact=parent_phone).first()
            if user:
                parent_users.append(user)

        queryset = CombinePaymentMapping.objects.filter(main_donor=main_user)
        if parent_users:
            queryset = queryset.filter(parent_donor__in=parent_users)
        uncombine_present = "uncombine_month" in request.data or "uncombine_month" in request.query_params
        uncombine_raw = (
            request.data.get("uncombine_month")
            if "uncombine_month" in request.data
            else request.query_params.get("uncombine_month")
        )
        target_uncombine = None
        if uncombine_present and uncombine_raw not in (None, ''):
            target_uncombine = _parse_month_key(uncombine_raw)
            if target_uncombine is None:
                return Response(
                    {"detail": "Provide a valid uncombine_month in YYYY-MM format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not uncombine_present:
            # Hard delete acts as immediate uncombine, so enforce due-clear rule.
            try:
                self._validate_main_due_is_zero(main_user)
            except ValidationError as exc:
                return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

            deleted, _ = queryset.delete()
            if deleted == 0:
                return Response(
                    {"detail": "No matching mappings found to delete."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(status=status.HTTP_204_NO_CONTENT)

        mappings = list(queryset.select_related("parent_donor"))
        if not mappings:
            return Response(
                {"detail": "No matching mappings found to uncombine."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Scheduled uncombine, enforce due-clear rule.
        try:
            self._validate_main_due_is_zero(main_user)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        for mapping in mappings:
            if target_uncombine and target_uncombine <= mapping.effective_from:
                return Response(
                    {
                        "detail": (
                            f"Uncombine month must be after "
                            f"{mapping.effective_from.strftime('%Y-%m')} for parent donor "
                            f"{mapping.parent_donor.phone_number}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            mapping.effective_to = target_uncombine
            mapping.save()
        return Response(status=status.HTTP_200_OK)


class CombinePaymentAccessView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def _closing_due_for_donor(self, donor_id: int) -> Decimal | None:
        """
        Fetch the latest closing due from passbook entries for the given donor.

        We regenerate the donor's passbook (without re-running due generation) to
        make sure any recent payments are reflected before returning a snapshot
        to the Combine Payment page.
        """
        try:
            regenerate_donor_passbook(donor_id, ensure_dues=False)
        except Exception:
            # If regeneration fails, fall back to existing entries without
            # blocking the combine access response.
            pass

        latest_entry = (
            PassbookEntry.objects.filter(donor_id=donor_id)
            .order_by("-entry_date", "-id")
            .first()
        )

        if latest_entry is None:
            return None

        try:
            return Decimal(latest_entry.closing_due)
        except Exception:
            return None

    def _parse_amount(self, value) -> Decimal:
        try:
            return Decimal(str(value or "0"))
        except Exception:
            return Decimal("0")

    def _monthly_total(self, donor) -> Decimal:
        plans = RecurringPoojaPlan.objects.filter(
            donor=donor,
            is_active=True,
            recurrence_kind=RecurrenceKind.RECURRING,
        ).exclude(
            Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
        )
        return sum((plan.amount or Decimal("0.00")) for plan in plans)

    def _due_months(self, donor, closing_due: Decimal | None) -> list[str]:
        if closing_due is None or closing_due <= 0:
            return []
        monthly_total = self._monthly_total(donor)
        if monthly_total <= 0:
            return []
        months_needed = int((closing_due / monthly_total).to_integral_value(rounding=ROUND_CEILING))
        if months_needed <= 0:
            return []
        base_month = timezone.localdate().replace(day=1)
        months: list[str] = []
        for month_index in range(months_needed):
            month_offset = months_needed - 1 - month_index
            target_month = _shift_month(base_month, -month_offset)
            months.append(target_month.strftime("%Y-%m"))
        return months

    def _single_due_item(self, donor, amount: Decimal):
        """Return a single synthetic cart-style item that represents the exact outstanding due."""
        today = timezone.localdate().isoformat()
        return [
            {
                "cartId": f"due-{donor.id}-{today}",
                "poojaId": -1,
                "poojaName": "Outstanding Due",
                "poojaCode": "DUE",
                "amount": str(amount),
                "bookingDate": today,
                "fullName": donor.name or "",
                "phoneNumber": donor.phone_number or "",
                "address": "",
                "poojaImage": "",
                "members": [],
            }
        ]

    def _normalize_items_to_due(self, donor, items, closing_due: Decimal):
        """
        Adjust an item list so its summed amount matches the closing due while preserving
        month-level granularity where possible.
        """
        if closing_due <= 0:
            return []

        # Keep only simple numeric amounts
        clean_items = [
            item for item in items if item and self._parse_amount(item.get("amount")) > 0
        ]
        total = sum(self._parse_amount(item.get("amount")) for item in clean_items)

        if total == closing_due:
            return clean_items

        if total < closing_due:
            # Add synthetic recurring items to reach the target; caller will add extras.
            return clean_items

        # Trim items until we reach the target, preserving earlier items first.
        normalized = []
        running = Decimal("0.00")
        for item in clean_items:
            amount = self._parse_amount(item.get("amount"))
            if running + amount <= closing_due:
                normalized.append(item)
                running += amount
            if running >= closing_due:
                break

        if running == closing_due:
            return normalized

        # If we couldn't match exactly (e.g., item amount > closing_due),
        # fall back to a single synthetic item for accuracy.
        return self._single_due_item(donor, closing_due)

    def _synthetic_recurring_items(self, donor, outstanding_amount: Decimal | None):
        """
        Build synthetic cart items for outstanding recurring months so that
        pooja counts on the Combine Payment page match total outstanding months.
        """
        if outstanding_amount is None or outstanding_amount <= 0:
            return []

        plans = RecurringPoojaPlan.objects.filter(
            donor=donor,
            is_active=True,
            recurrence_kind=RecurrenceKind.RECURRING,
        ).exclude(
            Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
        )

        monthly_total = sum((plan.amount or Decimal("0.00")) for plan in plans)
        if monthly_total <= 0:
            return []

        # Number of months to represent (ceil to cover partial remainder)
        months_needed = int((outstanding_amount / monthly_total).to_integral_value(rounding=ROUND_CEILING))
        if months_needed <= 0:
            return []

        synthetic_items = []
        base_month = timezone.localdate().replace(day=1)
        # Oldest month first: for N months, generate months from N-1 months ago up to current month
        for month_index in range(months_needed):
            month_offset = months_needed - 1 - month_index
            target_month = _shift_month(base_month, -month_offset)
            for plan in plans:
                amount = plan.amount or Decimal("0.00")
                # Skip zero-amount plans to avoid inflating counts
                if amount <= 0:
                    continue
                synthetic_items.append(
                    {
                        "cartId": f"rec-plan-{plan.id}-m{month_index}",
                        "poojaId": plan.pooja_option_id or -1,
                        "poojaName": getattr(plan.pooja_option, "name", None) or "Pooja",
                        "poojaCode": getattr(plan.pooja_option, "code", None),
                        "amount": str(amount),
                        "bookingDate": target_month.isoformat(),
                        "fullName": donor.name or "",
                        "phoneNumber": donor.phone_number or "",
                        "address": "",
                        "poojaImage": "",
                        "members": [],
                    }
                )

        return synthetic_items

    def _fallback_items_from_plans(self, donor):
        """
        Build lightweight cart-style entries from the donor's active recurring plans.
        This is used when no cart snapshot exists so that combined payment UI can
        still show pooja counts and dues.
        """
        plans = (
            RecurringPoojaPlan.objects.filter(donor=donor, is_active=True)
            .select_related("pooja_option", "day_option")
            .order_by("id")
        )
        items = []
        for plan in plans:
            payload = (getattr(plan, "cart_payload", None) or {}).copy()
            # Ensure required fields exist for frontend calculations/display
            payload["cartId"] = payload.get("cartId") or f"plan-{plan.id}"
            payload["poojaId"] = payload.get("poojaId") or plan.pooja_option_id
            payload["poojaName"] = payload.get("poojaName") or getattr(plan.pooja_option, "name", "") or "Pooja"
            payload["poojaCode"] = payload.get("poojaCode") or getattr(plan.pooja_option, "code", None)
            payload["amount"] = payload.get("amount") or str(plan.amount or Decimal("0.00"))
            payload["bookingDate"] = payload.get("bookingDate") or timezone.localdate().isoformat()
            payload["fullName"] = payload.get("fullName") or (donor.name or "")
            payload["phoneNumber"] = payload.get("phoneNumber") or (donor.phone_number or "")
            payload["members"] = payload.get("members") or []
            items.append(payload)
        return items

    def get(self, request):
        user = request.user
        current_month = timezone.localdate().replace(day=1)

        subordinate_mappings = (
            CombinePaymentMapping.objects.filter(parent_donor=user)
            .select_related("main_donor")
            .order_by("-effective_from")
        )
        for mapping in subordinate_mappings:
            if mapping.is_active_on(current_month):
                main_donor = mapping.main_donor
                return Response(
                    {
                        "role": "subordinate",
                        "can_combine": False,
                        "main_donor": {
                            "id": user.id,
                            "name": user.name,
                            "phone": user.phone_number,
                        },
                        "combined_to": {
                            "id": main_donor.id,
                            "name": main_donor.name,
                            "phone": main_donor.phone_number,
                            "effective_from": mapping.effective_from.isoformat()
                            if mapping.effective_from
                            else None,
                            "effective_to": mapping.effective_to.isoformat()
                            if mapping.effective_to
                            else None,
                        },
                        "parent_donors": [],
                    }
                )

        parent_mappings = (
            CombinePaymentMapping.objects.filter(main_donor=user)
            .select_related("parent_donor")
            .order_by("parent_donor_id")
        )
        if not parent_mappings.exists():
            return Response(
                {
                    "role": "main",
                    "can_combine": False,
                    "main_donor": {
                        "id": user.id,
                        "name": user.name,
                        "phone": user.phone_number,
                    },
                    "parent_donors": [],
                }
            )

        active_parent_mappings = [m for m in parent_mappings if m.is_active_on(current_month)]
        parent_ids = [mapping.parent_donor_id for mapping in active_parent_mappings if mapping.parent_donor_id]

        # Compute closing due for main donor + parents so we can hide stale dues
        # on the Combine Payment page once payments are completed.
        closing_due_map: dict[int, Decimal | None] = {}
        for donor_id in parent_ids + [user.id]:
            if donor_id is None:
                continue
            closing_due_map[donor_id] = self._closing_due_for_donor(donor_id)
        
        # Get cart snapshots for parent donors AND main donor
        snapshot_ids = parent_ids + [user.id]
        snapshots = {
            snapshot.donor_id: snapshot
            for snapshot in PoojaCartSnapshot.objects.filter(donor_id__in=snapshot_ids)
        }

        parent_donors = []
        for mapping in active_parent_mappings:
            snapshot = snapshots.get(mapping.parent_donor_id)
            snapshot_items = snapshot.items if snapshot else []

            closing_due = closing_due_map.get(mapping.parent_donor_id)

            # If the closing due is zero/negative, clear stale snapshot items so
            # they don't appear as unpaid on the Combine Payment page.
            if closing_due is not None and closing_due <= 0:
                if snapshot and snapshot.items:
                    snapshot.items = []
                    snapshot.save(update_fields=["items", "updated_at"])
                snapshot_items = []

            # Only fall back to recurring plan items when there is an outstanding due.
            if not snapshot_items and (closing_due is None or closing_due > 0):
                snapshot_items = self._fallback_items_from_plans(mapping.parent_donor)

            # Reconcile snapshot items with closing due so UI shows current outstanding
            existing_total = sum(self._parse_amount(item.get("amount")) for item in snapshot_items)
            if closing_due is not None:
                if closing_due <= 0:
                    snapshot_items = []
                    if snapshot and snapshot.items:
                        snapshot.items = []
                        snapshot.save(update_fields=["items", "updated_at"])
                elif existing_total > closing_due:
                    snapshot_items = self._normalize_items_to_due(mapping.parent_donor, snapshot_items, closing_due)
                else:
                    outstanding = closing_due - existing_total
                    if outstanding > 0:
                        snapshot_items = snapshot_items + self._synthetic_recurring_items(
                            mapping.parent_donor, outstanding
                        )
            else:
                outstanding = Decimal("0.00")

            parent_donors.append(
                {
                    "id": mapping.parent_donor.id,
                    "name": mapping.parent_donor.name,
                    "phone": mapping.parent_donor.phone_number,
                    "effective_from": mapping.effective_from.isoformat() if mapping.effective_from else None,
                    "effective_to": mapping.effective_to.isoformat() if mapping.effective_to else None,
                    "active": mapping.is_active_on(current_month),
                    "items": snapshot_items,
                    "updated_at": snapshot.updated_at.isoformat() if snapshot else None,
                    "due_months": self._due_months(mapping.parent_donor, closing_due),
                }
            )

        # Get main donor's cart snapshot
        main_snapshot = snapshots.get(user.id)
        main_snapshot_items = main_snapshot.items if main_snapshot else []
        main_closing_due = closing_due_map.get(user.id)

        if main_closing_due is not None and main_closing_due <= 0:
            if main_snapshot and main_snapshot.items:
                main_snapshot.items = []
                main_snapshot.save(update_fields=["items", "updated_at"])
            main_snapshot_items = []

        if not main_snapshot_items and (main_closing_due is None or main_closing_due > 0):
            main_snapshot_items = self._fallback_items_from_plans(user)

        existing_total_main = sum(self._parse_amount(item.get("amount")) for item in main_snapshot_items)
        if main_closing_due is not None:
            if main_closing_due <= 0:
                main_snapshot_items = []
                if main_snapshot and main_snapshot.items:
                    main_snapshot.items = []
                    main_snapshot.save(update_fields=["items", "updated_at"])
            elif existing_total_main > main_closing_due:
                main_snapshot_items = self._normalize_items_to_due(user, main_snapshot_items, main_closing_due)
            else:
                outstanding_main = main_closing_due - existing_total_main
                if outstanding_main > 0:
                    main_snapshot_items = main_snapshot_items + self._synthetic_recurring_items(user, outstanding_main)

        return Response(
            {
                "role": "main",
                "can_combine": bool(parent_donors),
                "main_donor": {
                    "id": user.id,
                    "name": user.name,
                    "phone": user.phone_number,
                    "items": main_snapshot_items,
                    "due_months": self._due_months(user, main_closing_due),
                },
                "parent_donors": parent_donors,
            }
        )


class PaymentDetailsExportView(APIView):
    """
    Export payment data to a single Excel workbook with three sheets:
    1) Payment Records
    2) Passbook Entries
    3) Donor Statements (donor-wise ordered passbook entries)
    """

    permission_classes = (IsAdminRole,)

    @staticmethod
    def _format_datetime(value):
        if not value:
            return ""
        try:
            return timezone.localtime(value).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return str(value)

    @staticmethod
    def _format_date(value):
        if not value:
            return ""
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            return str(value)

    def get(self, request):
        # Refresh passbooks so donor-wise statements are up to date
        regenerate_all_passbooks()

        workbook = Workbook()
        # Remove the default auto-created sheet for a clean slate
        default_sheet = workbook.active
        workbook.remove(default_sheet)

        # Sheet 1: Payment Records
        payment_sheet = workbook.create_sheet(title="Payment Records")
        payment_headers = [
            "ID",
            "Donor ID",
            "Donor Name",
            "Donor Phone",
            "Amount",
            "Currency",
            "Mode",
            "Status",
            "Transaction Reference",
            "Payment Month",
            "Notes",
            "Registration ID",
            "Registration Pooja",
            "Created At",
            "Updated At",
        ]
        payment_sheet.append(payment_headers)

        payment_qs = (
            PaymentRecord.objects.select_related("donor", "registration", "registration__pooja_option")
            .exclude(donor__role=UserRole.ADMIN)
            .filter(status=PaymentStatus.SUCCESS)
            .order_by("-created_at")
        )
        for record in payment_qs:
            payment_sheet.append(
                [
                    record.id,
                    record.donor_id,
                    getattr(record.donor, "name", ""),
                    getattr(record.donor, "phone_number", ""),
                    float(record.amount or 0),
                    record.currency,
                    record.mode,
                    record.status,
                    record.transaction_reference,
                    self._format_date(record.payment_month),
                    record.notes,
                    record.registration_id,
                    getattr(record.registration.pooja_option, "name", "") if record.registration else "",
                    self._format_datetime(record.created_at),
                    self._format_datetime(record.updated_at),
                ]
            )

        # Sheet 2: Passbook Entries
        passbook_sheet = workbook.create_sheet(title="Passbook Entries")
        passbook_headers = [
            "ID",
            "Donor ID",
            "Donor Name",
            "Donor Phone",
            "Entry Date",
            "Entry Type",
            "Transaction Details",
            "Payment Record ID",
            "Registration ID",
            "Opening Balance",
            "Due Amount",
            "Paid Amount",
            "Closing Due",
            "Created At",
            "Updated At",
        ]
        passbook_sheet.append(passbook_headers)

        passbook_qs = (
            PassbookEntry.objects.select_related("donor", "payment_record", "registration")
            .exclude(donor__role=UserRole.ADMIN)
            .order_by("donor_id", "entry_date")
        )
        for entry in passbook_qs:
            passbook_sheet.append(
                [
                    entry.id,
                    entry.donor_id,
                    getattr(entry.donor, "name", ""),
                    getattr(entry.donor, "phone_number", ""),
                    self._format_date(entry.entry_date),
                    entry.entry_type,
                    entry.transaction_details,
                    entry.payment_record_id,
                    entry.registration_id,
                    float(entry.opening_balance or 0),
                    float(entry.due_amount or 0),
                    float(entry.paid_amount or 0),
                    float(entry.closing_due or 0),
                    self._format_datetime(entry.created_at),
                    self._format_datetime(entry.updated_at),
                ]
            )

        # Sheet 3: Donor Statements (ordered passbook entries per donor)
        statement_sheet = workbook.create_sheet(title="Donor Statements")
        statement_headers = [
            "Donor ID",
            "Donor Name",
            "Donor Phone",
            "Entry #",
            "Entry Date",
            "Entry Type",
            "Transaction Details",
            "Opening Balance",
            "Due Amount",
            "Paid Amount",
            "Closing Due",
            "Payment Record ID",
            "Registration ID",
        ]
        statement_sheet.append(statement_headers)

        current_donor = None
        entry_counter = 0
        for entry in passbook_qs:
            if entry.donor_id != current_donor:
                current_donor = entry.donor_id
                entry_counter = 0
            entry_counter += 1
            statement_sheet.append(
                [
                    entry.donor_id,
                    getattr(entry.donor, "name", ""),
                    getattr(entry.donor, "phone_number", ""),
                    entry_counter,
                    self._format_date(entry.entry_date),
                    entry.entry_type,
                    entry.transaction_details,
                    float(entry.opening_balance or 0),
                    float(entry.due_amount or 0),
                    float(entry.paid_amount or 0),
                    float(entry.closing_due or 0),
                    entry.payment_record_id,
                    entry.registration_id,
                ]
            )

        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)

        filename = f"payment-details-{timezone.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


class PassbookEntryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for pre-calculated passbook entries.
    Returns stored passbook values for donors instead of calculating dynamically.
    """
    serializer_class = PassbookEntrySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        """Get passbook entries for current user or all donors if admin."""
        user = self.request.user
        if not can_view_payment_statement(user):
            return PassbookEntry.objects.none()

        # Avoid expensive regeneration on every request; only refresh when missing
        # data or when the caller explicitly asks for it.
        should_refresh = self.request.query_params.get('refresh', 'false').lower() == 'true'
        _maybe_clean_stale_chrt_dues(force=should_refresh)

        if user.role == UserRole.ADMIN:
            donor_id_param = self.request.query_params.get('donor_id')
            if donor_id_param and donor_id_param.isdigit():
                # For admin filtered view, refresh just that donor if requested or empty.
                donor_id_int = int(donor_id_param)
                qs_probe = PassbookEntry.objects.filter(donor_id=donor_id_int)
                current_month = timezone.localdate().replace(day=1)
                if should_refresh or not qs_probe.exists() or _donor_passbook_needs_refresh(donor_id_int, current_month):
                    regenerate_donor_passbook(donor_id_int)
            else:
                # Admin without donor filter: regenerate only if explicitly requested.
                if should_refresh:
                    regenerate_all_passbooks()
        else:
            # For non-admin users: include self + any active parent donors
            current_month = timezone.localdate().replace(day=1)
            donor_ids_to_refresh = [user.id]
            
            # Check if this user is a main donor with linked parent donors
            parent_mappings = CombinePaymentMapping.objects.filter(main_donor=user)
            for mapping in parent_mappings:
                if mapping.is_active_on(current_month):
                    donor_ids_to_refresh.append(mapping.parent_donor_id)

            # Refresh only when explicitly requested or stale/missing.
            _refresh_passbooks_if_needed(
                set(donor_ids_to_refresh),
                force=should_refresh,
                current_month=current_month,
            )
        
        if user.role == UserRole.ADMIN:
            # Admins can see all passbook entries
            # Exclude platform/admin users so they never appear in Payment Statement
            qs = PassbookEntry.objects.exclude(donor__role=UserRole.ADMIN)
        else:
            # Non-admin users see their own entries + active parent donor entries
            current_month = timezone.localdate().replace(day=1)
            donor_ids = [user.id]
            
            # Include active parent donors
            parent_mappings = CombinePaymentMapping.objects.filter(main_donor=user)
            for mapping in parent_mappings:
                if mapping.is_active_on(current_month):
                    donor_ids.append(mapping.parent_donor_id)
            
            qs = PassbookEntry.objects.filter(donor_id__in=donor_ids)
        
        # Filter by donor_id if provided
        donor_id = self.request.query_params.get('donor_id')
        if donor_id:
            try:
                donor_id_int = int(donor_id)
                if user.role == UserRole.ADMIN:
                    qs = qs.filter(donor_id=donor_id_int)
                elif user.id == donor_id_int:
                    # User viewing their own passbook
                    qs = qs.filter(donor_id=donor_id_int)
                else:
                    # Check if the requested donor_id is one of their linked parent donors
                    current_month = timezone.localdate().replace(day=1)
                    parent_mappings = CombinePaymentMapping.objects.filter(
                        main_donor=user, parent_donor_id=donor_id_int
                    )
                    if any(m.is_active_on(current_month) for m in parent_mappings):
                        qs = qs.filter(donor_id=donor_id_int)
                    else:
                        qs = qs.none()
            except ValueError:
                qs = qs.none()
        
        # Filter by month if provided (format: YYYY-MM)
        month_param = self.request.query_params.get('month')
        if month_param:
            month_date = _parse_month_key(month_param)
            if month_date:
                qs = qs.filter(
                    entry_date__year=month_date.year,
                    entry_date__month=month_date.month
                )
        
        # Filter by entry type if provided
        entry_type = self.request.query_params.get('entry_type')
        if entry_type:
            entry_type = entry_type.strip().lower()
            if entry_type in {"balance", "due", "paid"}:
                qs = qs.filter(entry_type=entry_type)

        # Deduplicate only true duplicates produced by regeneration/races
        # Keep distinct paid rows on same day when they come from different
        # payment records (or different references).
        qs = (
            qs.annotate(
                rn=Window(
                    expression=RowNumber(),
                    partition_by=[
                        F("donor_id"),
                        F("entry_date"),
                        F("entry_type"),
                        F("payment_record_id"),
                        F("registration_id"),
                        F("transaction_details"),
                        F("due_amount"),
                        F("paid_amount"),
                    ],
                    order_by=F("created_at").desc(),
                )
            )
            .filter(rn=1)
        )
        
        ordering_param = self.request.query_params.get('ordering')
        if ordering_param in ('entry_date', '-entry_date'):
            return qs.order_by(ordering_param)
        return qs.order_by('donor', 'entry_date')
