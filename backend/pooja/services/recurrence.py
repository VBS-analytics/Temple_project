"""Recurring-plan helpers for pooja registrations."""

from __future__ import annotations

import calendar
import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from ..models import (
    PoojaRegistration,
    PoojaRegistrationMember,
    RecurrenceFrequency,
    RecurrenceKind,
    RecurringPoojaPlan,
)
from payments.models import PaymentRecord, PaymentStatus

LOGGER = logging.getLogger(__name__)

FREQUENCY_MONTHS: Dict[RecurrenceFrequency, int] = {
    RecurrenceFrequency.MONTHLY: 1,
    RecurrenceFrequency.QUARTERLY: 3,
    RecurrenceFrequency.ANNUALLY: 12,
}


def _month_range(start_month: date, end_month: date) -> Iterable[date]:
    """Yield first-of-month dates from start_month through end_month (inclusive)."""
    current = start_month.replace(day=1)
    end = end_month.replace(day=1)
    while current <= end:
        yield current
        current = _add_months(current, 1)


def _add_months(value: date, months: int) -> date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _calculate_next_occurrence(base_date: date, frequency: RecurrenceFrequency) -> date:
    months = FREQUENCY_MONTHS.get(frequency, 1)
    return _add_months(base_date, months)


def calculate_next_recurring_occurrence(plan: RecurringPoojaPlan, reference_date: Optional[date] = None) -> Optional[date]:
    if plan.recurrence_kind != RecurrenceKind.RECURRING:
        return None
    frequency_value = plan.recurrence_frequency or RecurrenceFrequency.MONTHLY
    try:
        frequency = RecurrenceFrequency(frequency_value)
    except (ValueError, TypeError):
        frequency = RecurrenceFrequency.MONTHLY
    reference = reference_date or timezone.localdate()
    if plan.next_occurrence and plan.next_occurrence > reference:
        return plan.next_occurrence
    base = plan.last_occurrence or plan.start_date or reference
    next_occurrence = _calculate_next_occurrence(base, frequency)
    while next_occurrence <= reference:
        next_occurrence = _calculate_next_occurrence(next_occurrence, frequency)
    return next_occurrence


def find_due_registration(plan: RecurringPoojaPlan, pause_start: Optional[date] = None) -> Optional[PoojaRegistration]:
    """Return the registration that should be paid next for the provided plan."""
    queryset = PoojaRegistration.objects.filter(
        donor=plan.donor,
        pooja_option=plan.pooja_option,
    )
    if plan.day_option_id is not None:
        queryset = queryset.filter(day_option_id=plan.day_option_id)

    next_date = plan.next_occurrence
    if next_date:
        registration = (
            queryset.filter(start_date=next_date)
            .order_by("-created_at")
            .first()
        )
        if registration:
            return registration

    if pause_start:
        nearby_registration = (
            queryset.filter(start_date__gte=pause_start)
            .order_by("start_date", "-created_at")
            .first()
        )
        if nearby_registration:
            return nearby_registration

    if plan.origin_registration_id:
        return plan.origin_registration
    return None


def sum_successful_payments(registration: PoojaRegistration | None) -> Decimal:
    if registration is None:
        return Decimal("0.00")
    aggregate = PaymentRecord.objects.filter(
        registration=registration,
        status=PaymentStatus.SUCCESS,
    ).aggregate(total=Sum("amount"))
    return aggregate["total"] or Decimal("0.00")


def get_plan_due_summary(
    plan: RecurringPoojaPlan,
    *,
    pause_start: Optional[date] = None,
) -> Optional[Dict[str, Any]]:
    registration = getattr(plan, "due_registration", None) or find_due_registration(plan, pause_start)
    if registration is None:
        return None
    total_amount = registration.total_amount or plan.amount or Decimal("0.00")
    paid_amount = sum_successful_payments(registration)
    due_amount = max(total_amount - paid_amount, Decimal("0.00"))
    return {
        "registration": registration,
        "total_amount": total_amount,
        "total_paid": paid_amount,
        "due_amount": due_amount,
    }



def _build_plan_metadata(registration: PoojaRegistration) -> Dict[str, Any]:
    members = [
        {
            "name": member.name or "",
            "relationship": member.relationship or "",
            "tamil_star": member.tamil_star or "",
            "rasi": member.rasi or "",
            "gothra": member.gothra or "",
            "family_name": member.family_name or "",
            "date_of_birth": member.date_of_birth.isoformat() if member.date_of_birth else None,
        }
        for member in registration.members.all()
    ]
    return {
        "members": members,
        "day_option_id": registration.day_option_id,
        "post_prasadam": registration.post_prasadam,
        "additional_notes": registration.additional_notes or "",
        "is_group_registration": registration.is_group_registration,
        "quantity": registration.quantity,
    }


def _find_existing_plan(
    registration: PoojaRegistration,
    recurrence_kind: RecurrenceKind,
    one_time_date: Optional[date],
) -> Optional[RecurringPoojaPlan]:
    is_chrt = registration.day_option and registration.day_option.code == "CHRT"
    filters = {
        "donor": registration.donor,
        "pooja_option": registration.pooja_option,
        "day_option": registration.day_option,
        "recurrence_kind": recurrence_kind,
    }
    # For CHRT recurring plans, treat each preferred date as a separate plan.
    # Without this, multiple CHRT entries with different preferred dates get collapsed
    # into a single plan, causing only one plan to be retained (the last one saved).
    qs = RecurringPoojaPlan.objects.filter(**filters)
    if recurrence_kind == RecurrenceKind.ONE_TIME_EXTRA:
        qs = qs.filter(one_time_date=one_time_date)
    elif recurrence_kind == RecurrenceKind.RECURRING and is_chrt and one_time_date:
        qs = qs.filter(one_time_date=one_time_date)
    return qs.first()


@transaction.atomic
def create_plan_from_registration(
    registration: PoojaRegistration,
    recurrence_kind: str,
    recurrence_frequency: Optional[str] = None,
    recurrence_one_time_date: Optional[date] = None,
    cart_item_payload: Optional[Dict[str, Any]] = None,
) -> RecurringPoojaPlan:
    if not recurrence_kind:
        raise ValueError("recurrence_kind is required to build a plan")

    kind = RecurrenceKind(recurrence_kind)
    frequency = RecurrenceFrequency(recurrence_frequency) if recurrence_frequency else RecurrenceFrequency.MONTHLY
    preferred_date = recurrence_one_time_date or getattr(registration, "recurrence_one_time_date", None)
    start_date = preferred_date or registration.start_date or timezone.localdate()
    one_time_date = preferred_date or start_date
    plan = _find_existing_plan(registration, kind, one_time_date)
    metadata = _build_plan_metadata(registration)

    if plan is None:
        plan = RecurringPoojaPlan(
            donor=registration.donor,
            pooja_option=registration.pooja_option,
        )
    plan.day_option = registration.day_option
    plan.recurrence_kind = kind
    plan.recurrence_frequency = frequency
    plan.start_date = start_date
    plan.last_occurrence = start_date
    plan.amount = registration.total_amount
    plan.metadata = metadata
    plan.cart_payload = cart_item_payload or plan.cart_payload or {}
    plan.origin_registration = registration
    
    # ✓ CRITICAL FIX: For CHRT poojas, ALWAYS store one_time_date (preferred date)
    # CHRT poojas use one_time_date to determine which month the due should appear in
    is_chrt = registration.day_option and registration.day_option.code == "CHRT"
    if kind == RecurrenceKind.ONE_TIME_EXTRA:
        plan.one_time_date = one_time_date
    elif kind == RecurrenceKind.RECURRING and is_chrt:
        # For RECURRING CHRT poojas, store the preferred date
        plan.one_time_date = one_time_date
    else:
        plan.one_time_date = None
    
    plan.is_active = kind == RecurrenceKind.RECURRING
    plan.pause_from = None
    plan.pause_until = None

    if kind == RecurrenceKind.RECURRING:
        plan.next_occurrence = _calculate_next_occurrence(start_date, frequency)
    else:
        plan.next_occurrence = None
    plan.save()
    return plan


def _build_members_for_registration(members: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for member in members:
        name = (member.get("name") or "").strip()
        if not name:
            continue
        entry = {
            "name": name,
            "relationship": (member.get("relationship") or "").strip(),
            "tamil_star": (member.get("tamil_star") or "").strip(),
            "rasi": (member.get("rasi") or "").strip(),
            "gothra": (member.get("gothra") or "").strip(),
            "family_name": (member.get("family_name") or "").strip(),
            "date_of_birth": member.get("date_of_birth"),
        }
        normalized.append(entry)
    return normalized


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


@transaction.atomic
def create_registration_from_plan(plan: RecurringPoojaPlan, due_date: Optional[date] = None) -> PoojaRegistration:
    today = timezone.localdate()
    scheduled_date = due_date or plan.next_occurrence or plan.start_date or today
    metadata = plan.metadata or {}
    existing_due = plan.due_registration
    if existing_due and scheduled_date and existing_due.start_date == scheduled_date:
        LOGGER.info(
            "Skipping duplicate due_registration creation for plan %s on %s",
            plan.pk,
            scheduled_date,
        )
        return existing_due
    members_payload = _build_members_for_registration(metadata.get("members", []))
    quantity = metadata.get("quantity") or max(len(members_payload), 1)
    registration = PoojaRegistration.objects.create(
        donor=plan.donor,
        pooja_option=plan.pooja_option,
        day_option=plan.day_option,
        start_date=scheduled_date,
        quantity=quantity,
        is_group_registration=bool(metadata.get("is_group_registration")) or len(members_payload) > 1,
        post_prasadam=bool(metadata.get("post_prasadam")),
        additional_notes=metadata.get("additional_notes") or "",
        total_amount=plan.amount,
    )

    for member in members_payload:
        date_of_birth = _parse_date(member.get("date_of_birth"))
        PoojaRegistrationMember.objects.create(
            registration=registration,
            name=member["name"],
            relationship=member.get("relationship", ""),
            tamil_star=member.get("tamil_star", ""),
            rasi=member.get("rasi", ""),
            gothra=member.get("gothra", ""),
            family_name=member.get("family_name", ""),
            date_of_birth=date_of_birth,
        )

    # Link this registration to the plan so the frontend can track it
    plan.due_registration = registration
    plan.save(update_fields=['due_registration'])

    return registration


def _advance_plan(plan: RecurringPoojaPlan, processed_date: date) -> None:
    plan.last_occurrence = processed_date
    if plan.recurrence_kind == RecurrenceKind.RECURRING:
        frequency = RecurrenceFrequency(plan.recurrence_frequency)
        plan.next_occurrence = _calculate_next_occurrence(processed_date, frequency)
        plan.is_active = True
    else:
        plan.next_occurrence = None
        plan.is_active = False
    plan.save()


def prepare_recurring_registration(plan: RecurringPoojaPlan, *, reference_date: Optional[date] = None) -> Optional[PoojaRegistration]:
    if plan.recurrence_kind != RecurrenceKind.RECURRING or not plan.is_active:
        return None
    target_date = plan.next_occurrence
    if target_date is None:
        return None
    if plan.pause_from and plan.pause_until and plan.pause_from <= target_date <= plan.pause_until:
        return None
    registration = create_registration_from_plan(plan, due_date=target_date)
    processed_date = reference_date or target_date
    _advance_plan(plan, processed_date)
    return registration


def _create_due_payment_record(
    donor_id: int,
    total_amount: Decimal,
    payment_month: date,
) -> Optional[PaymentRecord]:
    """Create a single pending payment record for a donor's total recurring contribution for the month.
    
    Uses get_or_create to prevent duplicates.
    """
    if total_amount <= 0:
        return None
    
    # Use get_or_create to atomically create or return existing due
    try:
        payment_record, created = PaymentRecord.objects.get_or_create(
            donor_id=donor_id,
            registration=None,
            payment_month=payment_month,
            defaults={
                'amount': total_amount,
                'currency': 'INR',
                'mode': 'pending',
                'status': PaymentStatus.PENDING,
                'notes': 'Monthly recurring pooja contribution due',
            }
        )
    except PaymentRecord.MultipleObjectsReturned:
        # Consolidate any duplicate pending dues for the same month into the earliest record
        existing = (
            PaymentRecord.objects
            .filter(donor_id=donor_id, registration=None, payment_month=payment_month, status=PaymentStatus.PENDING)
            .order_by("created_at")
            .first()
        )
        if existing:
            existing.amount = total_amount
            if not existing.notes:
                existing.notes = 'Monthly recurring pooja contribution due'
            existing.save(update_fields=["amount", "notes", "updated_at"])
        return None
    
    return payment_record if created else None


def _generate_due_payments_for_recurring_plans(today: Optional[date] = None) -> int:
    """Generate due payment records for the 1st of each month for all active recurring plans.
    
    Creates ONE combined due per donor per month for all their active recurring plans.
    Dues are generated for every month from the first unpaid month through the current month.
    
    NOTE: Excludes CHRT (Choose Your Preferred Date) poojas which are handled separately.
    """
    now = today or timezone.localdate()
    current_month = now.replace(day=1)
    
    # Find all active recurring plans (excluding CHRT poojas)
    active_plans = RecurringPoojaPlan.objects.filter(
        is_active=True,
        recurrence_kind=RecurrenceKind.RECURRING,
    ).select_related('day_option')
    
    # Exclude CHRT poojas (including legacy rows where day_option was null) -
    # they are handled separately in _generate_due_payments_for_chrt_poojas.
    active_plans = active_plans.exclude(_chrt_plan_filter())
    
    # Exclude paused plans
    paused_now = Q(pause_from__lte=current_month, pause_until__gte=current_month)
    active_plans = active_plans.exclude(paused_now)
    
    # Group plans by donor to create ONE due per donor per month
    donors_to_process = {}  # donor_id -> plans only (amount will be computed per-month)
    
    for plan in active_plans:
        donor_id = plan.donor_id
        
        if donor_id not in donors_to_process:
            donors_to_process[donor_id] = {
                'plans': [],
            }
        
        donors_to_process[donor_id]['plans'].append(plan)
    
    created_count = 0
    # Track which (donor, month) adjustments have been logged to avoid noisy repeats
    chrt_adjustment_logged = set()
    
    # Process each donor's combined due
    for donor_id, donor_data in donors_to_process.items():
        plans = donor_data['plans']

        # Find the last successful payment for this donor
        last_payment = (
            PaymentRecord.objects
            .filter(donor_id=donor_id, status=PaymentStatus.SUCCESS)
            .order_by('-payment_month', '-created_at')
            .first()
        )

        # Determine the first month that still needs a due
        first_due_month: Optional[date] = None
        if last_payment and last_payment.payment_month:
            first_due_month = _add_months(last_payment.payment_month.replace(day=1), 1)
        else:
            plan_months: List[date] = []
            for plan in plans:
                plan_date = plan.start_date or (plan.created_at.date() if plan.created_at else None)
                # If the registration was created earlier than the selected start date,
                # use the registration's created_at as the anchor so dues begin from registration month.
                if hasattr(plan, "origin_registration") and plan.origin_registration:
                    reg_created = plan.origin_registration.created_at
                    if reg_created:
                        reg_created_date = reg_created.date()
                        if plan_date is None or reg_created_date < plan_date:
                            plan_date = reg_created_date
                if plan_date:
                    plan_months.append(plan_date.replace(day=1))
            if plan_months:
                first_due_month = min(plan_months)

        if first_due_month is None or first_due_month > current_month:
            continue

        # CRITICAL: Before creating the due, check if this donor has CHRT poojas
        # and if so, ensure we're not including their amounts
        has_chrt = RecurringPoojaPlan.objects.filter(
            donor_id=donor_id,
            is_active=True,
            recurrence_kind=RecurrenceKind.RECURRING,
        ).filter(_chrt_plan_filter()).exists()

        for month_start in _month_range(first_due_month, current_month):
            # Calculate applicable total for this month based on plan start/created dates
            month_total = Decimal('0.00')
            for plan in plans:
                plan_date = plan.start_date or (plan.created_at.date() if plan.created_at else None)
                if hasattr(plan, "origin_registration") and plan.origin_registration:
                    reg_created = plan.origin_registration.created_at
                    if reg_created:
                        reg_created_date = reg_created.date()
                        if plan_date is None or reg_created_date < plan_date:
                            plan_date = reg_created_date
                if plan_date and plan_date.replace(day=1) <= month_start:
                    month_total += plan.amount or Decimal('0.00')

            if month_total <= 0:
                continue

            if has_chrt:
                # Calculate only non-CHRT recurring total
                non_chrt_total = RecurringPoojaPlan.objects.filter(
                    donor_id=donor_id,
                    is_active=True,
                    recurrence_kind=RecurrenceKind.RECURRING,
                ).exclude(_chrt_plan_filter()).aggregate(total=Sum("amount")).get("total") or Decimal("0.00")

                if non_chrt_total != month_total:
                    key = (donor_id, month_start)
                    if key not in chrt_adjustment_logged:
                        LOGGER.info(
                            "Donor %s has CHRT poojas - adjusted due for %s from ₹%.2f to ₹%.2f (non-CHRT only)",
                            donor_id,
                            month_start.isoformat(),
                            float(month_total),
                            float(non_chrt_total),
                        )
                        chrt_adjustment_logged.add(key)
                    month_total = non_chrt_total

            # Skip if a payment (success) already exists for this month
            if PaymentRecord.objects.filter(
                donor_id=donor_id,
                payment_month=month_start,
                status=PaymentStatus.SUCCESS,
            ).exists():
                continue

            # If a pending due already exists, update the amount to the latest total
            existing_pending = PaymentRecord.objects.filter(
                donor_id=donor_id,
                registration__isnull=True,
                payment_month=month_start,
                status=PaymentStatus.PENDING,
            ).first()
            if existing_pending:
                # IMPORTANT: never rewrite past-month dues when new plans are added later.
                # Only adjust the pending due for the current run month.
                if month_start == current_month and existing_pending.amount != month_total:
                    existing_pending.amount = month_total
                    if not existing_pending.notes:
                        existing_pending.notes = "Monthly recurring pooja contribution due"
                    existing_pending.save(update_fields=["amount", "notes", "updated_at"])
                    LOGGER.info(
                        "Updated existing current-month due for donor %s month %s to ₹%.2f",
                        donor_id,
                        month_start.isoformat(),
                        float(month_total),
                    )
                    created_count += 1
                continue

            try:
                due_record = _create_due_payment_record(donor_id, month_total, month_start)
                if due_record:
                    LOGGER.info(
                        "Created combined due payment record for donor %s (total ₹%.2f) for month %s",
                        donor_id,
                        float(month_total),
                        month_start.isoformat(),
                    )
                    created_count += 1
            except Exception as exc:  # pragma: no cover
                LOGGER.exception("Unable to create due payment record for donor %s", donor_id)
    
    return created_count


def _chrt_plan_filter() -> Q:
    """Identify CHRT (preferred-date) plans even if the day option was not saved."""
    # CHRT plans should have the CHRT day option, but some historical rows were
    # saved with a null day_option. All CHRT plans store the user-chosen date in
    # one_time_date, which normal recurring plans never use.
    return Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)


def _clean_stale_chrt_dues(today: Optional[date] = None) -> int:
    """Clean up incorrectly generated CHRT dues that are before their preferred month.
    
    This handles cases where CHRT dues were created in the wrong month due to bugs.
    For example, if a CHRT pooja with preferred date Feb 2026 has a due in Jan 2026,
    this function will delete the Jan 2026 due.
    """
    now = today or timezone.localdate()
    current_month = now.replace(day=1)
    
    # Find all active CHRT plans (including legacy rows without day_option)
    chrt_plans = RecurringPoojaPlan.objects.filter(
        is_active=True,
        recurrence_kind=RecurrenceKind.RECURRING,
    ).select_related('day_option').filter(_chrt_plan_filter())
    
    # Build a map of donor_id -> earliest_preferred_month
    donor_preferred_months = {}
    for plan in chrt_plans:
        preferred_date = plan.one_time_date or plan.start_date
        if not preferred_date:
            preferred_date = plan.created_at.date() if plan.created_at else None
        if not preferred_date:
            continue
        
        preferred_month = preferred_date.replace(day=1)
        donor_id = plan.donor_id
        
        if donor_id not in donor_preferred_months:
            donor_preferred_months[donor_id] = preferred_month
        else:
            # Keep track of earliest preferred month
            if preferred_month < donor_preferred_months[donor_id]:
                donor_preferred_months[donor_id] = preferred_month
    
    # Delete or correct any dues that appear before the preferred month
    deleted_count = 0
    adjusted_count = 0
    for donor_id, preferred_month in donor_preferred_months.items():
        # Remove explicitly labelled CHRT dues in earlier months
        deleted, _ = PaymentRecord.objects.filter(
            donor_id=donor_id,
            registration__isnull=True,
            status=PaymentStatus.PENDING,
            notes__icontains='CHRT',
            payment_month__lt=preferred_month,
        ).delete()
        deleted_count += deleted
        if deleted > 0:
            LOGGER.info(
                "Cleaned up %d stale CHRT dues for donor %s (preferred month: %s)",
                deleted,
                donor_id,
                preferred_month.isoformat(),
            )

        # Fix combined monthly dues that accidentally included CHRT amount
        incorrect_dues = PaymentRecord.objects.filter(
            donor_id=donor_id,
            registration__isnull=True,
            status=PaymentStatus.PENDING,
            payment_month__lt=preferred_month,
        )

        if incorrect_dues.exists():
            non_chrt_total = (
                RecurringPoojaPlan.objects.filter(
                    donor_id=donor_id,
                    is_active=True,
                    recurrence_kind=RecurrenceKind.RECURRING,
                )
                .exclude(_chrt_plan_filter())
                .aggregate(total=Sum("amount"))
                .get("total")
                or Decimal("0.00")
            )

            for due in incorrect_dues:
                if non_chrt_total <= 0:
                    removed, _ = due.delete()
                    deleted_count += removed
                    LOGGER.info(
                        "Removed stale mixed due %s for donor %s (no non-CHRT recurring amount)",
                        due.pk,
                        donor_id,
                    )
                    continue

                if due.amount != non_chrt_total or "CHRT" in (due.notes or ""):
                    due.amount = non_chrt_total
                    due.notes = "Monthly recurring pooja contribution due (corrected to exclude CHRT)"
                    due.save(update_fields=["amount", "notes", "updated_at"])
                    adjusted_count += 1
                    LOGGER.info(
                        "Adjusted mixed due %s for donor %s to ₹%.2f (preferred month: %s)",
                        due.pk,
                        donor_id,
                        float(non_chrt_total),
                        preferred_month.isoformat(),
                    )
    
    return deleted_count + adjusted_count


def _generate_due_payments_for_chrt_poojas(today: Optional[date] = None) -> int:
    """Generate due payment records for CHRT (Choose Your Preferred Date) poojas.
    
    CHRT poojas only generate dues for the month when their preferred date falls.
    For example, a CHRT pooja with preferred date Feb 5, 2026 and annual recurrence will:
    - Generate due in February 2026
    - Generate due in February 2027
    - NOT generate dues in other months
    
    Creates ONE combined due per donor per month for all their CHRT poojas due that month.
    
    CRITICAL: CHRT poojas with future preferred dates MUST NEVER generate dues in current/past months.
    """
    now = today or timezone.localtime().date()
    current_month = now.replace(day=1)
    
    # Find all active recurring CHRT plans (including legacy rows without day_option)
    chrt_plans = RecurringPoojaPlan.objects.filter(
        is_active=True,
        recurrence_kind=RecurrenceKind.RECURRING,
    ).select_related('day_option').filter(_chrt_plan_filter())
    
    # CRITICAL SAFETY CHECK: Delete ALL pending CHRT dues for ALL donors that are in wrong months
    # This is a safety net to catch any bugs in the logic below
    for plan in chrt_plans:
        preferred_date = plan.one_time_date or plan.start_date
        if not preferred_date:
            preferred_date = plan.created_at.date() if plan.created_at else None
        if not preferred_date:
            continue
        
        preferred_month = preferred_date.replace(day=1)
        
        # Delete any CHRT dues from months BEFORE the preferred month
        # These should never exist
        if preferred_month > current_month:
            stale_count, _ = PaymentRecord.objects.filter(
                donor_id=plan.donor_id,
                registration__isnull=True,
                status=PaymentStatus.PENDING,
                payment_month__lt=preferred_month,
                notes__icontains='CHRT',
            ).delete()
            if stale_count > 0:
                LOGGER.warning(
                    "Cleaned up %d stale CHRT dues for donor %s (preferred month: %s, current: %s)",
                    stale_count,
                    plan.donor_id,
                    preferred_month.isoformat(),
                    current_month.isoformat(),
                )
    
    # Group by (donor_id, payment_month) - a donor can have CHRT poojas in different months
    # Key: (donor_id, payment_month_str) to handle multiple preferred months per donor
    donors_to_process = {}  # (donor_id, payment_month_str) -> (plans, total_amount, payment_month)
    
    for plan in chrt_plans:
        # Resolve the preferred month; fall back cautiously to created_at to avoid None
        preferred_date = plan.one_time_date or plan.start_date
        if not preferred_date:
            preferred_date = plan.created_at.date() if plan.created_at else None
        if not preferred_date:
            continue

        preferred_month = preferred_date.replace(day=1)

        # CRITICAL: If the preferred month is in the future, NEVER create a due now
        # This prevents CHRT poojas from appearing in payment statements before their preferred month
        if current_month < preferred_month:
            # Delete any stale dues that might have been created incorrectly for this plan
            PaymentRecord.objects.filter(
                donor_id=plan.donor_id,
                registration__isnull=True,
                status=PaymentStatus.PENDING,
                payment_month__lt=preferred_month,
                notes__icontains='CHRT',
            ).delete()
            continue
        
        # For recurring CHRT poojas, check if current month matches the pooja's recurrence pattern
        # CRITICAL: CHRT poojas should only generate dues when their preferred month/quarter/year matches,
        # NOT every frequency_months interval (which would cause monthly dues every month, quarterly dues every month, etc.)
        frequency = RecurrenceFrequency(plan.recurrence_frequency or RecurrenceFrequency.MONTHLY)
        
        should_generate_due = False
        
        if frequency == RecurrenceFrequency.MONTHLY:
            # For monthly CHRT: generate due only when we're in the same month as the preferred month
            # This repeats each year (e.g., Oct every year if preferred month is October)
            should_generate_due = (
                current_month.month == preferred_month.month and 
                current_month.year >= preferred_month.year
            )
        
        elif frequency == RecurrenceFrequency.QUARTERLY:
            # For quarterly CHRT: generate due only when we're in the matching quarter
            # Quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
            current_quarter = (current_month.month - 1) // 3
            preferred_quarter = (preferred_month.month - 1) // 3
            should_generate_due = (
                current_quarter == preferred_quarter and 
                current_month.year >= preferred_month.year
            )
        
        elif frequency == RecurrenceFrequency.ANNUALLY:
            # For annual CHRT: generate due only when we're in the exact same month as preferred
            should_generate_due = (
                current_month.month == preferred_month.month and 
                current_month.year >= preferred_month.year
            )
        
        if not should_generate_due:
            continue
        
        donor_id = plan.donor_id
        # Use composite key (donor_id, payment_month) so the same donor gets only one CHRT due per run month
        # (even if multiple CHRT poojas share the same preferred month). Anchor the payment month to the
        # current run month/year so dues repeat in subsequent years (e.g., every March).
        composite_key = (donor_id, current_month.isoformat())
        
        if composite_key not in donors_to_process:
            donors_to_process[composite_key] = {
                'plans': [],
                'total_amount': Decimal('0.00'),
                'payment_month': current_month,  # Charge is due in the current run month/year
                'donor_id': donor_id,
            }
        
        donors_to_process[composite_key]['plans'].append(plan)
        donors_to_process[composite_key]['total_amount'] += plan.amount or Decimal('0.00')
    
    created_count = 0
    # Get current month once for use in all iterations
    current_month_for_check = now.replace(day=1)
    
    # Process each donor's combined CHRT due
    for composite_key, donor_data in donors_to_process.items():
        # Extract donor_id and payment_month from composite key
        donor_id, payment_month_iso = composite_key
        total_amount = donor_data['total_amount']
        payment_month = donor_data['payment_month']  # Due is scheduled in the current run month/year
        # Identify the earliest preferred month among this donor's CHRT plans to clean stale dues
        earliest_pref_month = None
        for plan in donor_data['plans']:
            pref_date = plan.one_time_date or plan.start_date or (plan.created_at.date() if plan.created_at else None)
            if pref_date:
                pref_month = pref_date.replace(day=1)
                if earliest_pref_month is None or pref_month < earliest_pref_month:
                    earliest_pref_month = pref_month

        # Remove any previously generated pending CHRT dues that are earlier than the preferred month
        if earliest_pref_month:
            PaymentRecord.objects.filter(
                donor_id=donor_id,
                registration__isnull=True,
                status=PaymentStatus.PENDING,
                notes__icontains='CHRT',
                payment_month__lt=earliest_pref_month,
            ).delete()

        if total_amount <= 0:
            continue

        try:
            # For CHRT poojas, ADD the amount to any existing due for this month
            # If the month matches an existing recurring due, combine them
            # Otherwise, create a separate CHRT due
            
            # Try to find an existing due for this month
            existing_due = PaymentRecord.objects.filter(
                donor_id=donor_id,
                registration=None,
                payment_month=payment_month,
                status=PaymentStatus.PENDING,
            ).first()
            
            if existing_due:
                # Idempotent combine: set amount = non-CHRT recurring for the month + CHRT total
                non_chrt_total = (
                    RecurringPoojaPlan.objects.filter(
                        donor_id=donor_id,
                        is_active=True,
                        recurrence_kind=RecurrenceKind.RECURRING,
                    )
                    .exclude(_chrt_plan_filter())
                    .aggregate(total=Sum("amount"))
                    .get("total")
                    or Decimal("0.00")
                )
                new_amount = non_chrt_total + total_amount
                if existing_due.amount != new_amount or "CHRT" not in (existing_due.notes or ""):
                    existing_due.amount = new_amount
                    notes = existing_due.notes or "Monthly recurring pooja contribution due"
                    if "CHRT" not in notes:
                        notes = f"{notes} + CHRT (Preferred Date) poojas"
                    existing_due.notes = notes
                    existing_due.save(update_fields=["amount", "notes", "updated_at"])
                    LOGGER.info(
                        "Combined CHRT pooja amount (₹%.2f) with existing due for donor %s for month %s (new total: ₹%.2f)",
                        float(total_amount),
                        donor_id,
                        payment_month.isoformat(),
                        float(existing_due.amount),
                    )
                    created_count += 1
            else:
                # Create a new separate CHRT due
                due_record, created = PaymentRecord.objects.get_or_create(
                    donor_id=donor_id,
                    registration=None,
                    payment_month=payment_month,
                    defaults={
                        'amount': total_amount,
                        'currency': 'INR',
                        'mode': 'pending',
                        'status': PaymentStatus.PENDING,
                        'notes': 'CHRT (Preferred Date) pooja contribution due',
                    }
                )
                
                if created:
                    LOGGER.info(
                        "Created CHRT pooja due payment record for donor %s (total ₹%.2f) for month %s",
                        donor_id,
                        float(total_amount),
                        payment_month.isoformat(),
                    )
                    created_count += 1
                    
        except Exception as exc:  # pragma: no cover
            LOGGER.exception("Unable to create due payment record for CHRT pooja for donor %s", donor_id)
    
    return created_count


def process_recurring_plans(today: Optional[date] = None) -> Dict[str, Any]:
    now = today or timezone.localdate()
    
    # Clean up any stale CHRT dues from previous months
    stale_chrt_dues_cleaned = _clean_stale_chrt_dues(now)
    
    # Generate due payment records for the current month for both recurring and CHRT poojas
    due_payments_created = _generate_due_payments_for_recurring_plans(now)
    chrt_due_payments_created = _generate_due_payments_for_chrt_poojas(now)
    
    expired_pause_query = RecurringPoojaPlan.objects.filter(
        pause_until__isnull=False,
        pause_until__lt=now,
    )
    if expired_pause_query.exists():
        expired_pause_query.update(pause_from=None, pause_until=None, is_active=True)

    paused_now = Q(pause_from__lte=now, pause_until__gte=now)

    pending = RecurringPoojaPlan.objects.filter(
        is_active=True,
        next_occurrence__isnull=False,
        next_occurrence__lte=now,
    ).exclude(paused_now)

    processed = 0
    failures: List[str] = []

    for plan in pending:
        try:
            registration = create_registration_from_plan(plan, plan.next_occurrence)
            _advance_plan(plan, plan.next_occurrence or now)
            LOGGER.info(
                "Created recurring registration %s from plan %s",
                registration.pk,
                plan.pk,
            )
            processed += 1
        except Exception as exc:  # pragma: no cover - best effort job
            LOGGER.exception("Unable to process recurring plan %s", plan.pk)
            failures.append(str(exc))

    return {
        "processed": processed,
        "failures": failures,
        "stale_chrt_dues_cleaned": stale_chrt_dues_cleaned,
        "due_payments_created": due_payments_created,
        "chrt_due_payments_created": chrt_due_payments_created,
    }
