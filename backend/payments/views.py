"""Payment API views."""

from datetime import date, datetime, time, timedelta
from calendar import monthrange
from collections import defaultdict
from decimal import Decimal, ROUND_CEILING
from io import BytesIO
from typing import Iterable

from django.http import FileResponse
from django.db import connection, transaction
from django.db.models import Max, Q, Sum
from django.utils import timezone
from django.db.models import Window, F
from django.db.models.functions import RowNumber
from django.core.cache import cache
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.access import (
    can_download_reports,
    can_view_expense_tracker,
    can_view_payment_statement,
    EXPENSE_TRACKER_ACCESS_DENIED_MESSAGE,
    REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE,
)
from accounts.models import DonorProfile, User, UserRole
from common.permissions import IsAdminRole
from pooja.models import PoojaCartSnapshot, RecurringPoojaPlan, RecurrenceKind
from .models import (
    AdditionIncomeRecord,
    CombinePaymentMapping,
    Donation,
    ExpenseCategory,
    ExpenseRecord,
    IncomeCategory,
    PaymentRecord,
    PassbookEntry,
    PaymentStatus,
)
from .serializers import (
    AdditionIncomeRecordSerializer,
    DonationSerializer,
    ExpenseCategorySerializer,
    ExpenseRecordSerializer,
    IncomeCategorySerializer,
    PassbookEntrySerializer,
    PaymentRecordSerializer,
)
from .services import (
    _plan_due_anchor_date,
    passbook_regeneration_guard,
    regenerate_all_passbooks,
    regenerate_donor_passbook,
)
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


_CHRT_CLEANUP_LOCK_KEY = 9_821_547_336_145
PAYMENT_RECORD_DELETE_ACCESS_DENIED_MESSAGE = "Please contact Admin for payment delete access."
PAYMENT_RECORD_DELETE_OWN_ONLY_MESSAGE = "You can delete only your own payment records."
PAYMENT_RECORD_DELETE_SUCCESS_ONLY_MESSAGE = "Only received payment records can be deleted."


def _try_acquire_chrt_cleanup_lock() -> bool:
    if connection.vendor != "postgresql":
        return True
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [_CHRT_CLEANUP_LOCK_KEY])
        row = cursor.fetchone()
    return bool(row and row[0])


def _release_chrt_cleanup_lock() -> None:
    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_unlock(%s)", [_CHRT_CLEANUP_LOCK_KEY])


def _maybe_clean_stale_chrt_dues(*, force: bool = False) -> None:
    """Throttle expensive CHRT cleanup during normal read requests."""
    cache_key = "payments:stale_chrt_cleanup:last_run"
    if not force and cache.get(cache_key):
        return

    if not _try_acquire_chrt_cleanup_lock():
        return

    try:
        # CHRT cleanup updates/deletes PaymentRecord rows; suppress signal-based
        # passbook regeneration during this maintenance pass to avoid lock churn.
        with passbook_regeneration_guard():
            _clean_stale_chrt_dues()
        cache.set(cache_key, True, timeout=300)
    finally:
        _release_chrt_cleanup_lock()


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
    earliest_expected_due_month = None
    plans = (
        RecurringPoojaPlan.objects.filter(
            donor_id=donor_id,
            is_active=True,
            recurrence_kind=RecurrenceKind.RECURRING,
        )
        .exclude(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))
        .select_related("origin_registration")
    )
    for plan in plans:
        anchor_date = _plan_due_anchor_date(plan)
        if not anchor_date:
            continue
        anchor_month = anchor_date.replace(day=1)
        if earliest_expected_due_month is None or anchor_month < earliest_expected_due_month:
            earliest_expected_due_month = anchor_month

    if earliest_expected_due_month:
        first_due_entry = (
            PassbookEntry.objects.filter(
                donor_id=donor_id,
                entry_type="due",
                registration__isnull=True,
            )
            .order_by("entry_date", "id")
            .only("entry_date")
            .first()
        )
        if first_due_entry is None:
            if earliest_expected_due_month <= current_month:
                return True
        else:
            first_due_month = first_due_entry.entry_date.replace(day=1)
            if first_due_month < earliest_expected_due_month:
                return True
            if (
                earliest_expected_due_month <= current_month
                and first_due_month > earliest_expected_due_month
            ):
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

        month_param = self.request.query_params.get("month")
        if month_param:
            month_start = _parse_month_key(month_param)
            if month_start is None:
                qs = qs.none()
            else:
                month_end = _shift_month(month_start, 1)
                month_start_dt = timezone.make_aware(datetime.combine(month_start, time.min))
                month_end_dt = timezone.make_aware(datetime.combine(month_end, time.min))
                month_basis = (self.request.query_params.get("month_basis") or "").strip().lower()
                if month_basis in {"created_at", "transaction_date", "transaction"}:
                    qs = qs.filter(created_at__gte=month_start_dt, created_at__lt=month_end_dt)
                else:
                    qs = qs.filter(
                        Q(payment_month__gte=month_start, payment_month__lt=month_end)
                        | (
                            Q(payment_month__isnull=True)
                            & Q(created_at__gte=month_start_dt, created_at__lt=month_end_dt)
                        )
                    )

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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        if user.role != UserRole.ADMIN:
            donor_profile, _ = DonorProfile.objects.get_or_create(user=user)
            if not donor_profile.payment_delete_access:
                raise PermissionDenied(PAYMENT_RECORD_DELETE_ACCESS_DENIED_MESSAGE)
            if instance.donor_id != user.id:
                raise PermissionDenied(PAYMENT_RECORD_DELETE_OWN_ONLY_MESSAGE)
            if instance.status != PaymentStatus.SUCCESS:
                raise PermissionDenied(PAYMENT_RECORD_DELETE_SUCCESS_ONLY_MESSAGE)

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DonationCreateView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = DonationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ExpenseRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseRecordSerializer
    permission_classes = (IsAdminRole,)
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not can_view_expense_tracker(request.user):
            raise PermissionDenied(EXPENSE_TRACKER_ACCESS_DENIED_MESSAGE)

    def get_queryset(self):
        queryset = ExpenseRecord.objects.all().order_by("-transaction_date", "-id")

        month_param = self.request.query_params.get("month")
        if month_param:
            try:
                year, month = map(int, month_param.split("-", 1))
                if month < 1 or month > 12:
                    raise ValueError
            except ValueError:
                queryset = queryset.none()
            else:
                queryset = queryset.filter(transaction_date__year=year, transaction_date__month=month)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AdditionIncomeRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AdditionIncomeRecordSerializer
    permission_classes = (IsAdminRole,)
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not can_view_expense_tracker(request.user):
            raise PermissionDenied(EXPENSE_TRACKER_ACCESS_DENIED_MESSAGE)

    def get_queryset(self):
        queryset = AdditionIncomeRecord.objects.all().order_by("-transaction_date", "-id")

        month_param = self.request.query_params.get("month")
        if month_param:
            try:
                year, month = map(int, month_param.split("-", 1))
                if month < 1 or month > 12:
                    raise ValueError
            except ValueError:
                queryset = queryset.none()
            else:
                queryset = queryset.filter(transaction_date__year=year, transaction_date__month=month)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseCategorySerializer
    permission_classes = (IsAdminRole,)
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not can_view_expense_tracker(request.user):
            raise PermissionDenied(EXPENSE_TRACKER_ACCESS_DENIED_MESSAGE)

    def get_queryset(self):
        queryset = ExpenseCategory.objects.all().order_by("group_key", "display_order", "name", "id")
        active_param = self.request.query_params.get("active")
        if active_param and active_param.strip().lower() in {"1", "true", "yes"}:
            queryset = queryset.filter(is_active=True)
        return queryset


class IncomeCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = IncomeCategorySerializer
    permission_classes = (IsAdminRole,)
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not can_view_expense_tracker(request.user):
            raise PermissionDenied(EXPENSE_TRACKER_ACCESS_DENIED_MESSAGE)

    def get_queryset(self):
        return IncomeCategory.objects.all().order_by("display_order", "name", "id")


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
    Export payment data to a single Excel workbook with base sheets:
    1) Payment Records
    2) Passbook Entries
    3) Donor Statements (donor-wise ordered passbook entries)
    4) Combined Statement View

    The Combined Statement View sheet is always present. It is populated only
    when active combined donor mappings exist for the current month. Donors
    participating in an active combined mapping are excluded from Passbook
    Entries and Donor Statements, while Payment Records continues to show the
    main donor payment rows.
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

    @staticmethod
    def _active_subordinate_donor_ids(reference_date: date) -> set[int]:
        month_start = reference_date.replace(day=1)
        return set(
            CombinePaymentMapping.objects.filter(effective_from__lte=month_start)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gt=month_start))
            .values_list("parent_donor_id", flat=True)
        )

    @staticmethod
    def _active_combined_donor_ids(reference_date: date) -> set[int]:
        month_start = reference_date.replace(day=1)
        mappings = CombinePaymentMapping.objects.filter(effective_from__lte=month_start).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gt=month_start)
        )
        donor_ids = set(mappings.values_list("main_donor_id", flat=True))
        donor_ids.update(mappings.values_list("parent_donor_id", flat=True))
        return donor_ids

    @staticmethod
    def _combined_statement_opening_date(entries: list[PassbookEntry], reference_date: date) -> date:
        balance_dates = [entry.entry_date for entry in entries if entry.entry_type == "balance" and entry.entry_date]
        if balance_dates:
            return min(balance_dates)
        return reference_date.replace(month=1, day=1) - timedelta(days=1)

    @staticmethod
    def _build_combined_statement_rows(
        *,
        reference_date: date,
        main_donor: User,
        parent_donor_ids: list[int],
        passbook_by_donor: dict[int, list[PassbookEntry]],
    ) -> list[list]:
        main_entries = [
            entry
            for entry in passbook_by_donor.get(main_donor.id, [])
            if entry.entry_type in {"due", "paid"}
        ]
        parent_entries = [
            entry
            for parent_id in parent_donor_ids
            for entry in passbook_by_donor.get(parent_id, [])
            if entry.entry_type in {"due", "paid"}
        ]
        opening_entries = [
            entry
            for donor_id in [main_donor.id, *parent_donor_ids]
            for entry in passbook_by_donor.get(donor_id, [])
            if entry.entry_type == "balance"
        ]
        opening_date = PaymentDetailsExportView._combined_statement_opening_date(opening_entries, reference_date)
        opening_amount = sum(float(entry.closing_due or 0) for entry in opening_entries)

        merged_main_paid: dict[str, dict] = {}
        main_events: list[dict] = []
        for entry in sorted(main_entries, key=lambda item: (item.entry_date, item.id)):
            if entry.entry_type != "paid":
                main_events.append(
                    {
                        "event_date": entry.entry_date,
                        "donor_name": getattr(entry.donor, "name", "") or "",
                        "transaction_details": entry.transaction_details or "",
                        "due_amount": float(entry.due_amount or 0),
                        "paid_amount": 0.0,
                        "sort_kind": 0,
                        "sort_id": f"main-due-{entry.id}",
                        "source_entry_type": entry.entry_type,
                        "source_donor_id": entry.donor_id,
                        "source_payment_record_id": entry.payment_record_id,
                    }
                )
                continue

            reference = (entry.transaction_details or "").strip()
            if not reference:
                main_events.append(
                    {
                        "event_date": entry.entry_date,
                        "donor_name": getattr(entry.donor, "name", "") or "",
                        "transaction_details": entry.transaction_details or "",
                        "due_amount": 0.0,
                        "paid_amount": float(entry.paid_amount or 0),
                        "sort_kind": 0,
                        "sort_id": f"main-paid-{entry.id}",
                        "source_entry_type": entry.entry_type,
                        "source_donor_id": entry.donor_id,
                        "source_payment_record_id": entry.payment_record_id,
                    }
                )
                continue

            merge_key = f"{entry.entry_date.isoformat()}|{reference}"
            existing = merged_main_paid.get(merge_key)
            if not existing:
                merged_main_paid[merge_key] = {
                    "event_date": entry.entry_date,
                    "donor_name": getattr(entry.donor, "name", "") or "",
                    "transaction_details": entry.transaction_details or "",
                    "due_amount": 0.0,
                    "paid_amount": float(entry.paid_amount or 0),
                    "sort_kind": 0,
                    "sort_id": f"main-paid-{entry.id}",
                    "source_entry_type": entry.entry_type,
                    "source_donor_id": entry.donor_id,
                    "source_payment_record_id": entry.payment_record_id,
                    "source_id": entry.id,
                }
                continue

            existing["paid_amount"] += float(entry.paid_amount or 0)
            if entry.id > existing.get("source_id", 0):
                existing["source_id"] = entry.id
                existing["sort_id"] = f"main-paid-{entry.id}"
                existing["source_payment_record_id"] = entry.payment_record_id

        main_events.extend(merged_main_paid.values())

        parent_month_totals: dict[str, dict] = {}
        for entry in parent_entries:
            month_key = entry.entry_date.strftime("%Y-%m")
            existing = parent_month_totals.get(month_key)
            if existing is None:
                existing = {
                    "event_date": entry.entry_date,
                    "due_total": 0.0,
                    "paid_total": 0.0,
                }
                parent_month_totals[month_key] = existing
            if entry.entry_date < existing["event_date"]:
                existing["event_date"] = entry.entry_date
            if entry.entry_type == "due":
                existing["due_total"] += float(entry.due_amount or 0)
            elif entry.entry_type == "paid":
                existing["paid_total"] += float(entry.paid_amount or 0)

        parent_events: list[dict] = []
        for month_total in sorted(parent_month_totals.values(), key=lambda item: item["event_date"]):
            if month_total["due_total"] == 0 and month_total["paid_total"] == 0:
                continue
            parent_events.append(
                {
                    "event_date": month_total["event_date"],
                    "donor_name": "Sub-ordinate Donors",
                    "transaction_details": "--- Pooja DUE ---",
                    "due_amount": month_total["due_total"],
                    "paid_amount": month_total["paid_total"],
                    "sort_kind": 1,
                    "sort_id": f"parent-{month_total['event_date'].isoformat()}",
                    "source_entry_type": "aggregate",
                    "source_donor_id": "",
                    "source_payment_record_id": "",
                }
            )

        combined_events = [
            {
                "event_date": opening_date,
                "donor_name": getattr(main_donor, "name", "") or "",
                "transaction_details": "-",
                "due_amount": 0.0,
                "paid_amount": 0.0,
                "opening_delta": opening_amount,
                "is_opening": True,
                "sort_kind": -1,
                "sort_id": "opening",
                "source_entry_type": "balance",
                "source_donor_id": main_donor.id,
                "source_payment_record_id": "",
            },
            *main_events,
            *parent_events,
        ]

        combined_events.sort(
            key=lambda item: (
                item["event_date"],
                item["sort_kind"],
                str(item["sort_id"]),
            )
        )

        running_balance = 0.0
        rows: list[list] = []
        for event in combined_events:
            if event.get("is_opening"):
                opening_balance = running_balance
                closing_due = opening_balance + float(event.get("opening_delta", 0))
            else:
                opening_balance = running_balance
                closing_due = opening_balance + float(event["due_amount"]) - float(event["paid_amount"])
            running_balance = closing_due
            rows.append(
                [
                    main_donor.id,
                    getattr(main_donor, "name", "") or "",
                    getattr(main_donor, "phone_number", "") or "",
                    PaymentDetailsExportView._format_date(event["event_date"]),
                    event["donor_name"],
                    event["transaction_details"],
                    float(event["due_amount"]),
                    float(event["paid_amount"]),
                    float(closing_due),
                    float(opening_balance),
                    event["source_entry_type"],
                    event["source_donor_id"],
                    event["source_payment_record_id"],
                ]
            )
        return rows

    def get(self, request):
        if not can_download_reports(request.user):
            return Response(
                {"detail": REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Refresh passbooks so donor-wise statements are up to date
        regenerate_all_passbooks()
        current_date = timezone.localdate()
        subordinate_donor_ids = self._active_subordinate_donor_ids(current_date)
        combined_donor_ids = self._active_combined_donor_ids(current_date)

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
        ]
        payment_sheet.append(payment_headers)

        payment_qs = (
            PaymentRecord.objects.select_related("donor", "registration", "registration__pooja_option")
            .exclude(donor__role=UserRole.ADMIN)
            .exclude(donor_id__in=subordinate_donor_ids)
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
            "Opening Balance",
            "Due Amount",
            "Paid Amount",
            "Closing Due",
        ]
        passbook_sheet.append(passbook_headers)

        passbook_qs = (
            PassbookEntry.objects.select_related("donor", "payment_record", "registration")
            .exclude(donor__role=UserRole.ADMIN)
            .exclude(donor_id__in=combined_donor_ids)
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
                    float(entry.opening_balance or 0),
                    float(entry.due_amount or 0),
                    float(entry.paid_amount or 0),
                    float(entry.closing_due or 0),
                ]
            )

        # Sheet 3: Donor Statements (latest passbook entry per donor)
        statement_sheet = workbook.create_sheet(title="Donor Statements")
        statement_headers = [
            "Donor ID",
            "Donor Name",
            "Donor Phone",
            "Entry Type",
            "Transaction Details",
            "Due Amount",
            "Paid Amount",
            "Closing Due",
            "Payment Record ID",
        ]
        statement_sheet.append(statement_headers)

        latest_statement_qs = (
            PassbookEntry.objects.select_related("donor", "payment_record", "registration")
            .exclude(donor__role=UserRole.ADMIN)
            .exclude(donor_id__in=combined_donor_ids)
            .annotate(
                donor_latest_rank=Window(
                    expression=RowNumber(),
                    partition_by=[F("donor_id")],
                    order_by=(F("entry_date").desc(), F("id").desc()),
                )
            )
            .filter(donor_latest_rank=1)
            .order_by("donor_id")
        )

        for entry in latest_statement_qs:
            statement_sheet.append(
                [
                    entry.donor_id,
                    getattr(entry.donor, "name", ""),
                    getattr(entry.donor, "phone_number", ""),
                    entry.entry_type,
                    entry.transaction_details,
                    float(entry.due_amount or 0),
                    float(entry.paid_amount or 0),
                    float(entry.closing_due or 0),
                    entry.payment_record_id,
                ]
            )

        # Sheet 4: Combined Statement View (matches donor payment statement style)
        combined_sheet = workbook.create_sheet(title="Combined Statement View")
        combined_headers = [
            "Main Donor ID",
            "Main Donor Name",
            "Main Donor Phone",
            "Date",
            "Donor Name",
            "Transaction Details",
            "Due For Current Month",
            "Amount Received",
            "Closing Due For Current Month",
            "Opening Balance",
            "Source Entry Type",
            "Source Donor ID",
            "Source Payment Record ID",
        ]
        combined_sheet.append(combined_headers)

        month_start = current_date.replace(day=1)
        active_mappings = list(
            CombinePaymentMapping.objects.select_related("main_donor", "parent_donor")
            .filter(effective_from__lte=month_start)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gt=month_start))
            .order_by("main_donor_id", "parent_donor_id")
        )
        if active_mappings:
            main_to_parents: dict[int, list[int]] = defaultdict(list)
            main_donor_lookup: dict[int, User] = {}
            relevant_donor_ids: set[int] = set()
            for mapping in active_mappings:
                main_to_parents[mapping.main_donor_id].append(mapping.parent_donor_id)
                main_donor_lookup[mapping.main_donor_id] = mapping.main_donor
                relevant_donor_ids.add(mapping.main_donor_id)
                relevant_donor_ids.add(mapping.parent_donor_id)

            passbook_for_combined = (
                PassbookEntry.objects.select_related("donor")
                .exclude(donor__role=UserRole.ADMIN)
                .filter(donor_id__in=relevant_donor_ids)
                .order_by("donor_id", "entry_date", "id")
            )
            passbook_by_donor: dict[int, list[PassbookEntry]] = defaultdict(list)
            for entry in passbook_for_combined:
                passbook_by_donor[entry.donor_id].append(entry)

            for main_donor_id in sorted(main_to_parents.keys()):
                main_donor = main_donor_lookup.get(main_donor_id)
                if not main_donor:
                    continue
                rows = self._build_combined_statement_rows(
                    reference_date=current_date,
                    main_donor=main_donor,
                    parent_donor_ids=main_to_parents[main_donor_id],
                    passbook_by_donor=passbook_by_donor,
                )
                for row in rows:
                    combined_sheet.append(row)

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


class GeneralDonationExportView(APIView):
    """Export all records from the donation table to a single Excel sheet."""

    permission_classes = (IsAdminRole,)

    @staticmethod
    def _format_date(value):
        if not value:
            return ""
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            return str(value)

    def get(self, request):
        if not can_download_reports(request.user):
            return Response(
                {"detail": REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE},
                status=status.HTTP_403_FORBIDDEN,
            )

        workbook = Workbook()
        donation_sheet = workbook.active
        donation_sheet.title = "General Donations"
        headers = [
            "ID",
            "Donor Name",
            "Donor Phone",
            "Transaction ID",
            "Amount Paid",
            "Donation Date",
            "Notes",
        ]
        donation_sheet.append(headers)

        donations = Donation.objects.all().order_by("-donation_date", "-id")
        for donation in donations:
            donation_sheet.append(
                [
                    donation.id,
                    donation.donor_name,
                    donation.donor_phone_no,
                    donation.transaction_id,
                    float(donation.amount_paid or 0),
                    self._format_date(donation.donation_date),
                    donation.notes,
                ]
            )

        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)

        filename = f"general-donation-{timezone.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


class AccountStatementExportView(APIView):
    """Export month-wise account statement data to Excel."""

    permission_classes = (IsAdminRole,)

    _DECEMBER_2025_OPENING_ROWS = (
        {
            "details": "Kumbabishekam SB account balance",
            "reference": "Manual Opening Balance",
            "inflow": Decimal("9091.00"),
        },
        {
            "details": "Normal account SB account balance",
            "reference": "Manual Opening Balance",
            "inflow": Decimal("216770.00"),
        },
    )

    @staticmethod
    def _format_date(value):
        if not value:
            return ""
        try:
            return value.strftime("%d %b %Y")
        except Exception:
            return str(value)

    @staticmethod
    def _normalize_text(value, fallback: str = ""):
        if value is None:
            return fallback
        text = str(value).strip()
        return text if text else fallback

    def get(self, request):
        if not can_view_payment_statement(request.user):
            return Response(
                {"detail": "You don't have access for Payment Statement, contact other admins."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not can_view_expense_tracker(request.user):
            return Response(
                {"detail": EXPENSE_TRACKER_ACCESS_DENIED_MESSAGE},
                status=status.HTTP_403_FORBIDDEN,
            )

        month_param = request.query_params.get("month")
        if month_param:
            month_start = _parse_month_key(month_param)
            if month_start is None:
                return Response(
                    {"detail": "Invalid month format. Use YYYY-MM."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            month_start = timezone.localdate().replace(day=1)
        month_end = _shift_month(month_start, 1)

        month_start_dt = timezone.make_aware(datetime.combine(month_start, time.min))
        month_end_dt = timezone.make_aware(datetime.combine(month_end, time.min))

        rows: list[dict] = []
        sequence = 0

        if month_start == date(2025, 12, 1):
            for opening_row in self._DECEMBER_2025_OPENING_ROWS:
                rows.append(
                    {
                        "sequence": sequence,
                        "date": month_start,
                        "type_label": "Opening Balance",
                        "details": opening_row["details"],
                        "reference": opening_row["reference"],
                        "inflow": Decimal(opening_row["inflow"]),
                        "outflow": Decimal("0.00"),
                    }
                )
                sequence += 1

        payments = (
            PaymentRecord.objects.select_related("donor", "registration", "registration__pooja_option")
            .filter(
                Q(payment_month__gte=month_start, payment_month__lt=month_end)
                | (
                    Q(payment_month__isnull=True)
                    & Q(created_at__gte=month_start_dt, created_at__lt=month_end_dt)
                )
            )
            .order_by("created_at", "id")
        )
        for payment in payments:
            status_value = self._normalize_text(payment.status).lower()
            paid_amount = Decimal(payment.amount or 0)
            has_reference = bool(self._normalize_text(payment.transaction_reference))
            is_failed_like = status_value in {PaymentStatus.FAILED, PaymentStatus.REFUNDED}
            is_paid_like = status_value == PaymentStatus.SUCCESS or (has_reference and paid_amount > 0)
            if is_failed_like or not is_paid_like:
                continue
            payment_created_at = payment.created_at
            payment_date = payment.payment_month or (
                timezone.localtime(payment_created_at).date() if payment_created_at else month_start
            )
            donor_name = self._normalize_text(getattr(payment.donor, "name", None), f"Donor #{payment.donor_id}")
            registration = getattr(payment, "registration", None)
            pooja_option = getattr(registration, "pooja_option", None) if registration else None
            pooja_name = self._normalize_text(getattr(pooja_option, "name", None), "Pooja Payment")
            mode = self._normalize_text(payment.mode).upper()
            mode_label = f" · {mode}" if mode else ""
            details = f"{pooja_name} ({donor_name}){mode_label}"
            reference = self._normalize_text(payment.transaction_reference, f"Payment #{payment.id}")

            rows.append(
                {
                    "sequence": sequence,
                    "date": payment_date,
                    "type_label": "Donor Payment",
                    "details": details,
                    "reference": reference,
                    "inflow": paid_amount,
                    "outflow": Decimal("0.00"),
                }
            )
            sequence += 1

        addition_incomes = (
            AdditionIncomeRecord.objects.select_related("created_by")
            .filter(transaction_date__year=month_start.year, transaction_date__month=month_start.month)
            .order_by("transaction_date", "id")
        )
        for income in addition_incomes:
            category = self._normalize_text(income.category, "Additional Income")
            created_by_name = self._normalize_text(getattr(income.created_by, "name", None))
            details = f"{category} ({created_by_name})" if created_by_name else f"{category} (Additional Income)"
            reference = self._normalize_text(income.transaction_no, f"Income #{income.id}")
            rows.append(
                {
                    "sequence": sequence,
                    "date": income.transaction_date,
                    "type_label": "Addition Income",
                    "details": details,
                    "reference": reference,
                    "inflow": Decimal(income.amount or 0),
                    "outflow": Decimal("0.00"),
                }
            )
            sequence += 1

        expenses = (
            ExpenseRecord.objects.select_related("created_by")
            .filter(transaction_date__year=month_start.year, transaction_date__month=month_start.month)
            .order_by("transaction_date", "id")
        )
        for expense in expenses:
            category = self._normalize_text(expense.category, "Expense")
            created_by_name = self._normalize_text(getattr(expense.created_by, "name", None))
            details = f"{category} ({created_by_name})" if created_by_name else category
            reference = self._normalize_text(expense.transaction_no, f"Expense #{expense.id}")
            rows.append(
                {
                    "sequence": sequence,
                    "date": expense.transaction_date,
                    "type_label": "Admin Expense",
                    "details": details,
                    "reference": reference,
                    "inflow": Decimal("0.00"),
                    "outflow": Decimal(expense.amount or 0),
                }
            )
            sequence += 1

        rows.sort(key=lambda row: (row["date"], row["sequence"]))

        opening_balance = Decimal("0.00")
        total_inflow = sum((row["inflow"] for row in rows), Decimal("0.00"))
        total_outflow = sum((row["outflow"] for row in rows), Decimal("0.00"))
        net_balance = total_inflow - total_outflow
        month_label = month_start.strftime("%B %Y")

        workbook = Workbook()
        summary_sheet = workbook.active
        summary_sheet.title = "Summary"
        summary_sheet.append(["Metric", "Value"])
        summary_sheet.append(["Month", month_label])
        summary_sheet.append(["Opening Balance", float(opening_balance)])
        summary_sheet.append(["Inflow", float(total_inflow)])
        summary_sheet.append(["Outflow", float(total_outflow)])
        summary_sheet.append(["Net Balance", float(net_balance)])

        transactions_sheet = workbook.create_sheet(title="Transactions")
        transactions_sheet.append(
            ["Date", "Type", "Details", "Reference", "Inflow", "Outflow", "Balance"]
        )
        for row in rows:
            transactions_sheet.append(
                [
                    self._format_date(row["date"]),
                    row["type_label"],
                    row["details"],
                    row["reference"],
                    float(row["inflow"]) if row["inflow"] > 0 else "",
                    float(row["outflow"]) if row["outflow"] > 0 else "",
                    "",
                ]
            )

        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)

        filename = f"account-statement-{month_start.strftime('%Y-%m')}-{timezone.now().strftime('%Y%m%d%H%M%S')}.xlsx"
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
