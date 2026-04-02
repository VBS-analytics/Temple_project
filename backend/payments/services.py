"""
Service for generating and managing passbook entries.
"""

from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from typing import Optional
import threading

from django.contrib.auth import get_user_model
from django.db.models import Q, Sum
from django.utils import timezone
from django.db import transaction

from pooja.models import PoojaRegistration, RecurringPoojaPlan, RecurrenceKind
from payments.models import PaymentStatus
from .models import PassbookEntry, PaymentRecord
from pooja.services.recurrence import _calculate_recurring_month_total_for_donor

User = get_user_model()
_thread_local = threading.local()
_passbook_lock = threading.Lock()


def _plan_due_anchor_date(plan: RecurringPoojaPlan) -> Optional[date]:
    """
    Compute the recurring-due anchor date for passbook generation.

    Business rule: recurring dues are anchored to registration creation date
    (origin registration when available), not scheduled start_date.
    """
    origin_registration = getattr(plan, "origin_registration", None)
    if origin_registration and origin_registration.created_at:
        return timezone.localtime(origin_registration.created_at).date()
    if plan.created_at:
        return timezone.localtime(plan.created_at).date()
    return plan.start_date


def _parse_iso_date(value: str | None) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value.split("T", 1)[0].strip())
    except ValueError:
        return None


def _plan_cancel_effective_month(plan: RecurringPoojaPlan) -> Optional[date]:
    """
    Return the first month from which a plan cancellation is effective.

    For canceled plans we freeze passbook backfill before this month so
    historical rows are not rewritten during regeneration.
    """
    metadata = plan.metadata if isinstance(plan.metadata, dict) else {}
    cancel_effective_from = metadata.get("cancel_effective_from")
    if isinstance(cancel_effective_from, str):
        parsed = _parse_iso_date(cancel_effective_from)
        if parsed:
            return parsed.replace(day=1)

    if plan.pause_from and plan.pause_until == date.max:
        return plan.pause_from.replace(day=1)
    return None


def passbook_guard_active() -> bool:
    """Expose whether passbook regeneration is already running (used by signals to prevent recursion)."""
    return getattr(_thread_local, "passbook_in_progress", False)


@contextmanager
def passbook_regeneration_guard():
    """
    Temporarily mark passbook regeneration as active for the current thread.

    Useful around bulk payment-record cleanups where post_save/post_delete signals
    would otherwise trigger nested regeneration and increase lock contention.
    """
    previous = getattr(_thread_local, "passbook_in_progress", False)
    _thread_local.passbook_in_progress = True
    try:
        yield
    finally:
        _thread_local.passbook_in_progress = previous


def regenerate_donor_passbook(donor_id: int, ensure_dues: bool = True) -> None:
    """
    Regenerate all passbook entries for a specific donor.
    This should be called when:
    - A new payment is recorded
    - A new pooja registration is created
    - Opening balance is updated
    """
    # Prevent recursive calls and concurrent regeneration for the same process
    if getattr(_thread_local, "passbook_in_progress", False):
        return

    acquired = _passbook_lock.acquire(timeout=5)
    if not acquired:
        return

    _thread_local.passbook_in_progress = True
    try:
        # Proactively ensure monthly dues are generated (covers cases where the background job wasn't run)
        if ensure_dues:
            from pooja.services.recurrence import process_recurring_plans

            today = timezone.localdate()
            # Only generate dues/cleanups during passbook regen; skip auto registration creation
            process_recurring_plans(today=today, create_registrations=False)

        try:
            with transaction.atomic():
                # Lock donor row to avoid concurrent regen across workers
                donor = (
                    User.objects.select_for_update()
                    .get(id=donor_id)
                )
                # Clear existing entries for this donor
                PassbookEntry.objects.filter(donor=donor).delete()
        except User.DoesNotExist:
            return

        # Get opening balance from donor profile
        # Prefer custom_number (imported from opening-balance-december.xlsx); fallback to opening_balance field
        opening_balance = Decimal("0.00")
        if hasattr(donor, 'profile') and donor.profile:
            profile = donor.profile
            source_balance = (
                profile.custom_number
                if profile.custom_number is not None
                else profile.opening_balance
            )
            opening_balance = Decimal(str(source_balance or 0))

        # Create opening balance entry (31/12/2025)
        anchor_date = date(2025, 12, 31)
        balance_entry_date = anchor_date
        PassbookEntry.objects.create(
            donor=donor,
            entry_date=balance_entry_date,
            entry_type="balance",
            transaction_details="-",
            opening_balance=opening_balance,
            due_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            closing_due=opening_balance,
        )

        today = timezone.localdate()
        current_month = today.replace(day=1)

        # Get all payment and registration records for this donor
        payment_records = PaymentRecord.objects.filter(donor=donor).order_by("created_at")
        registration_records = list(
            PoojaRegistration.objects.filter(donor__id=donor_id).order_by("created_at")
        )

        # Track which months already have registrations to avoid double-counting
        registration_months = set()
        for rr in registration_records:
            date_val = rr.start_date or rr.created_at.date()
            if not date_val:
                continue
            registration_months.add(date_val.replace(day=1))

        # Consolidate monthly dues (pending PaymentRecords without a registration)
        monthly_dues_by_month = {}
        for pr in payment_records.filter(registration__isnull=True, status=PaymentStatus.PENDING):
            date_val = pr.payment_month or pr.created_at.date()
            if date_val is None:
                continue
            month_start = date_val.replace(day=1)
            # Skip future-dated dues
            if month_start > current_month:
                continue
            if month_start not in monthly_dues_by_month:
                monthly_dues_by_month[month_start] = {
                    "record": pr,
                    "amount": pr.amount or Decimal("0.00"),
                    "date": date_val,
                }
            else:
                monthly_dues_by_month[month_start]["amount"] += pr.amount or Decimal("0.00")

        months_with_monthly_due = set(monthly_dues_by_month.keys())

        # ------------------------------------------------------------------
        # Ensure monthly dues reflect the full recurring-plan total for every month
        # from the earliest active plan start up to the current month. If an existing
        # pending PaymentRecord has a lower amount, bump it up to the plan total.
        # ------------------------------------------------------------------
        def _next_month(value: date) -> date:
            if value.month == 12:
                return value.replace(year=value.year + 1, month=1, day=1)
            return value.replace(month=value.month + 1, day=1)

        earliest_plan_month = None
        historical_freeze_month = None
        for plan in RecurringPoojaPlan.objects.filter(
            donor_id=donor_id,
            recurrence_kind=RecurrenceKind.RECURRING,
        ).filter(
            Q(is_active=True) | Q(pause_from__isnull=False) | Q(pause_until__isnull=False)
        ):
            cancel_effective_month = _plan_cancel_effective_month(plan)
            if cancel_effective_month and (
                historical_freeze_month is None
                or cancel_effective_month < historical_freeze_month
            ):
                historical_freeze_month = cancel_effective_month

            # Skip CHRT and one-time/dated plans; they are handled elsewhere.
            if plan.one_time_date:
                continue
            if plan.day_option and plan.day_option.code == "CHRT":
                continue

            anchor_date_for_plan = _plan_due_anchor_date(plan)
            if not anchor_date_for_plan:
                continue

            month_start = anchor_date_for_plan.replace(day=1)
            if earliest_plan_month is None or month_start < earliest_plan_month:
                earliest_plan_month = month_start

        if earliest_plan_month:
            cursor = max(earliest_plan_month, anchor_date.replace(day=1))
            while cursor <= current_month:
                if historical_freeze_month and cursor < historical_freeze_month:
                    cursor = _next_month(cursor)
                    continue
                existing = monthly_dues_by_month.get(cursor)
                existing_amount = existing["amount"] if existing else Decimal("0.00")
                target_amount = _calculate_recurring_month_total_for_donor(donor_id, cursor)
                if target_amount <= 0:
                    cursor = _next_month(cursor)
                    continue
                if existing_amount < target_amount:
                    monthly_dues_by_month[cursor] = {
                        "record": existing["record"] if existing else None,
                        "amount": target_amount,
                        "date": cursor,
                    }
                months_with_monthly_due.add(cursor)
                cursor = _next_month(cursor)

        # ------------------------------------------------------------------
        # Backfill CHRT month dues into the consolidated monthly due map.
        #
        # Why:
        # CHRT due records are generated by a monthly job. If a donor has CHRT
        # preferred months in the past (e.g., January) and regeneration runs in
        # a later month (e.g., February), the pending PaymentRecord for that
        # past CHRT month may be missing. In that case, passbook should still
        # reflect the correct monthly due for that month.
        #
        # Rule:
        # For each preferred month <= current month, target due amount is:
        #   non-CHRT monthly recurring total + sum(CHRT plan amounts in that month)
        # and we only bump when current consolidated amount is lower.
        # ------------------------------------------------------------------
        chrt_amounts_by_month: dict[date, Decimal] = {}
        chrt_plans = RecurringPoojaPlan.objects.filter(
            donor_id=donor_id,
            is_active=True,
            recurrence_kind=RecurrenceKind.RECURRING,
        ).filter(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))

        for plan in chrt_plans:
            preferred_date = plan.one_time_date or plan.start_date or (plan.created_at.date() if plan.created_at else None)
            if not preferred_date:
                continue
            preferred_month = preferred_date.replace(day=1)
            if preferred_month < anchor_date.replace(day=1) or preferred_month > current_month:
                continue
            plan_amount = Decimal(str(plan.amount or "0.00"))
            if plan_amount <= 0:
                continue
            chrt_amounts_by_month[preferred_month] = (
                chrt_amounts_by_month.get(preferred_month, Decimal("0.00")) + plan_amount
            )

        for month_start, chrt_total_for_month in chrt_amounts_by_month.items():
            if historical_freeze_month and month_start < historical_freeze_month:
                continue
            base_non_chrt = _calculate_recurring_month_total_for_donor(donor_id, month_start)
            target_amount = base_non_chrt + chrt_total_for_month
            existing = monthly_dues_by_month.get(month_start)
            existing_amount = existing["amount"] if existing else Decimal("0.00")
            if existing_amount < target_amount:
                monthly_dues_by_month[month_start] = {
                    "record": existing["record"] if existing else None,
                    "amount": target_amount,
                    "date": month_start,
                }
            months_with_monthly_due.add(month_start)

        # Combine and sort by date
        all_records = []
        # Only successful payments are treated as received amounts
        for pr in payment_records.filter(status=PaymentStatus.SUCCESS):
            date_val = pr.payment_month or pr.created_at.date()
            # Skip records before anchor or future-dated (by month)
            if not date_val:
                continue
            if date_val < anchor_date:
                continue
            if date_val.replace(day=1) > current_month:
                continue
            all_records.append(("payment", pr, date_val))

        # Add consolidated monthly dues as due entries
        for month_start, data in monthly_dues_by_month.items():
            if month_start < anchor_date:
                continue
            all_records.append(("monthly_due", data["record"], data["date"], data["amount"]))

        # Build a quick lookup of registration_id -> preferred_date for CHRT plans (handles day_option null)
        chrt_plan_dates = {
            plan.origin_registration_id: plan.one_time_date
            for plan in RecurringPoojaPlan.objects.filter(
                donor_id=donor_id,
                recurrence_kind=RecurrenceKind.RECURRING,
            ).filter(
                Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
            )
            if plan.origin_registration_id and plan.one_time_date
        }
        recurring_plan_anchor_dates = {
            plan.origin_registration_id: _plan_due_anchor_date(plan)
            for plan in RecurringPoojaPlan.objects.filter(
                donor_id=donor_id,
                recurrence_kind=RecurrenceKind.RECURRING,
            ).exclude(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))
            if plan.origin_registration_id
        }

        for rr in registration_records:
            # For CHRT Poojas, use the preferred date from RecurringPoojaPlan.one_time_date
            # instead of the registration's start_date. Covers legacy rows with missing day_option.
            preferred_date = None
            recurring_anchor_date = recurring_plan_anchor_dates.get(rr.id)
            if rr.day_option and rr.day_option.code == "CHRT":
                preferred_date = chrt_plan_dates.get(rr.id)
            elif rr.id in chrt_plan_dates:
                preferred_date = chrt_plan_dates[rr.id]

            if preferred_date:
                date_val = preferred_date
            elif recurring_anchor_date:
                date_val = recurring_anchor_date
            else:
                date_val = rr.start_date or rr.created_at.date()

            if not date_val:
                continue
            # Skip records before anchor and future-dated (by month)
            if date_val < anchor_date:
                continue
            month_start = date_val.replace(day=1)
            if month_start > current_month:
                continue

            # Avoid double-counting registrations for months that already have monthly dues
            if month_start and month_start in months_with_monthly_due:
                continue

            all_records.append(("registration", rr, date_val))

        def _record_sort_key(entry):
            # Keep deterministic ordering on the same day:
            # 1) opening/due rows first, 2) paid rows after dues.
            # This prevents transient negative balances when both due and
            # payment exist for the same date.
            entry_kind = entry[0]
            date_val = entry[2]
            if entry_kind == "payment":
                record = entry[1]
                created_at = getattr(record, "created_at", None)
                created_ts = created_at.timestamp() if created_at else 0
                return (date_val, 1, created_ts, getattr(record, "id", 0) or 0)
            record = entry[1]
            created_at = getattr(record, "created_at", None) if record is not None else None
            created_ts = created_at.timestamp() if created_at else 0
            return (date_val, 0, created_ts, getattr(record, "id", 0) or 0)

        all_records.sort(key=_record_sort_key)

        # Calculate running balance and create entries
        running_balance = opening_balance

        for entry in all_records:
            if entry[0] == "payment":
                _, record, date_val = entry
                # Payment records
                paid_amount = record.amount or Decimal("0.00")
                running_balance = running_balance - paid_amount
                
                PassbookEntry.objects.create(
                    donor=donor,
                    entry_date=date_val,
                    entry_type="paid",
                    transaction_details=record.transaction_reference or "Payment recorded",
                    payment_record=record,
                    opening_balance=running_balance + paid_amount,  # Balance before this payment
                    due_amount=Decimal("0.00"),
                    paid_amount=paid_amount,
                    closing_due=running_balance,
                )
            elif entry[0] == "monthly_due":
                _, record, date_val, consolidated_amount = entry
                due_amount = consolidated_amount
                running_balance = running_balance + due_amount

                PassbookEntry.objects.create(
                    donor=donor,
                    entry_date=date_val,
                    entry_type="due",
                    transaction_details="--- Pooja DUE ---",
                    payment_record=record,
                    opening_balance=running_balance - due_amount,
                    due_amount=due_amount,
                    paid_amount=Decimal("0.00"),
                    closing_due=running_balance,
                )
            else:
                _, record, date_val = entry
                # Registration records (due amounts)
                due_amount = record.total_amount or Decimal("0.00")
                running_balance = running_balance + due_amount
                
                PassbookEntry.objects.create(
                    donor=donor,
                    entry_date=date_val,
                    entry_type="due",
                    transaction_details="--- Pooja DUE ---",
                    registration=record,
                    opening_balance=running_balance - due_amount,  # Balance before this due
                    due_amount=due_amount,
                    paid_amount=Decimal("0.00"),
                    closing_due=running_balance,
            )
    finally:
        _thread_local.passbook_in_progress = False
        _passbook_lock.release()


def regenerate_all_passbooks() -> None:
    """
    Regenerate passbook entries for all donors.
    This can be run as a management command when needed.
    """
    # Run once for all donors to ensure dues are up to date before bulk regeneration
    from pooja.services.recurrence import process_recurring_plans

    # Only generate dues/cleanups; avoid creating registrations in this bulk run
    process_recurring_plans(today=timezone.localdate(), create_registrations=False)

    donors = User.objects.filter(role="donor")
    for donor in donors:
        # Avoid re-running due generation per donor during bulk run
        regenerate_donor_passbook(donor.id, ensure_dues=False)
