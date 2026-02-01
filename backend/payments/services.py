"""
Service for generating and managing passbook entries.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from django.contrib.auth import get_user_model
from django.db.models import Q, Sum
from django.utils import timezone

from pooja.models import PoojaRegistration
from .models import PassbookEntry, PaymentRecord

User = get_user_model()


def regenerate_donor_passbook(donor_id: int) -> None:
    """
    Regenerate all passbook entries for a specific donor.
    This should be called when:
    - A new payment is recorded
    - A new pooja registration is created
    - Opening balance is updated
    """
    try:
        donor = User.objects.get(id=donor_id)
    except User.DoesNotExist:
        return

    # Clear existing entries for this donor
    PassbookEntry.objects.filter(donor=donor).delete()

    # Get opening balance from donor profile
    opening_balance = Decimal("0.00")
    if hasattr(donor, 'profile') and donor.profile:
        opening_balance = Decimal(str(donor.profile.opening_balance or 0))

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

    # Combine and sort by date
    all_records = []
    for pr in payment_records:
        date_val = pr.payment_month or pr.created_at.date()
        # Skip future-dated payments (by month) so passbook shows up to the current month only
        if date_val and date_val.replace(day=1) > current_month:
            continue
        all_records.append(("payment", pr, date_val))

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
        if date_val and date_val.replace(day=1) > current_month:
            continue

        all_records.append(("registration", rr, date_val))

    all_records.sort(key=lambda x: x[2])

    # Calculate running balance and create entries
    running_balance = opening_balance

    for record_type, record, date_val in all_records:
        if record_type == "payment":
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
        else:
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


def regenerate_all_passbooks() -> None:
    """
    Regenerate passbook entries for all donors.
    This can be run as a management command when needed.
    """
    donors = User.objects.filter(role="donor")
    for donor in donors:
        regenerate_donor_passbook(donor.id)
