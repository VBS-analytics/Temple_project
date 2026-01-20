"""
Service for generating and managing passbook entries.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from django.contrib.auth import get_user_model
from django.db.models import Q, Sum

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

    # Get all payment and registration records for this donor
    payment_records = PaymentRecord.objects.filter(donor=donor).order_by("created_at")
    registration_records = PoojaRegistration.objects.filter(donor__id=donor_id).order_by("created_at")

    # Combine and sort by date
    all_records = []
    for pr in payment_records:
        date_val = pr.payment_month or pr.created_at.date()
        all_records.append(("payment", pr, date_val))

    for rr in registration_records:
        date_val = rr.start_date or rr.created_at.date()
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
