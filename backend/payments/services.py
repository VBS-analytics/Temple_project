"""
Service for generating and managing passbook entries.
"""

from datetime import date
from decimal import Decimal
from typing import Optional
import threading

from django.contrib.auth import get_user_model
from django.db.models import Q, Sum
from django.utils import timezone
from django.db import transaction

from pooja.models import PoojaRegistration
from payments.models import PaymentStatus
from .models import PassbookEntry, PaymentRecord

User = get_user_model()
_thread_local = threading.local()
_passbook_lock = threading.Lock()


def passbook_guard_active() -> bool:
    """Expose whether passbook regeneration is already running (used by signals to prevent recursion)."""
    return getattr(_thread_local, "passbook_in_progress", False)


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
            # Idempotent: will only create missing dues and clean stale ones
            process_recurring_plans(today=today)

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
        balance_entry_date = date(2025, 12, 31)
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
        registration_records = PoojaRegistration.objects.filter(donor__id=donor_id).order_by("created_at")

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

        # Combine and sort by date
        all_records = []
        # Only successful payments are treated as received amounts
        for pr in payment_records.filter(status=PaymentStatus.SUCCESS):
            date_val = pr.payment_month or pr.created_at.date()
            # Skip future-dated payments (by month) so passbook shows up to the current month only
            if date_val and date_val.replace(day=1) > current_month:
                continue
            all_records.append(("payment", pr, date_val))

        # Add consolidated monthly dues as due entries
        for month_start, data in monthly_dues_by_month.items():
            all_records.append(("monthly_due", data["record"], data["date"], data["amount"]))

        # Build a quick lookup of registration_id -> preferred_date for CHRT plans (handles day_option null)
        from pooja.models import RecurringPoojaPlan
        chrt_plan_dates = {
            plan.origin_registration_id: plan.one_time_date
            for plan in RecurringPoojaPlan.objects.filter(
                Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
            )
            if plan.origin_registration_id and plan.one_time_date
        }

        for rr in registration_records:
            # For CHRT Poojas, use the preferred date from RecurringPoojaPlan.one_time_date
            # instead of the registration's start_date. Covers legacy rows with missing day_option.
            preferred_date = None
            if rr.day_option and rr.day_option.code == "CHRT":
                preferred_date = chrt_plan_dates.get(rr.id)
            elif rr.id in chrt_plan_dates:
                preferred_date = chrt_plan_dates[rr.id]

            if preferred_date:
                date_val = preferred_date
            else:
                date_val = rr.start_date or rr.created_at.date()

            # Skip future-dated dues (by month); they should appear only when their preferred month arrives
            month_start = date_val.replace(day=1) if date_val else None
            if month_start and month_start > current_month:
                continue

            # Avoid double-counting registrations for months that already have monthly dues
            if month_start and month_start in months_with_monthly_due:
                continue

            all_records.append(("registration", rr, date_val))

        all_records.sort(key=lambda x: x[2])

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

    process_recurring_plans(today=timezone.localdate())

    donors = User.objects.filter(role="donor")
    for donor in donors:
        # Avoid re-running due generation per donor during bulk run
        regenerate_donor_passbook(donor.id, ensure_dues=False)
