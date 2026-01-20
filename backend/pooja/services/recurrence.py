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
    registration = find_due_registration(plan, pause_start)
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
    filters = {
        "donor": registration.donor,
        "pooja_option": registration.pooja_option,
        "day_option": registration.day_option,
        "recurrence_kind": recurrence_kind,
    }
    qs = RecurringPoojaPlan.objects.filter(**filters)
    if recurrence_kind == RecurrenceKind.ONE_TIME_EXTRA:
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
    start_date = registration.start_date or timezone.localdate()
    one_time_date = recurrence_one_time_date or start_date
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
    plan.one_time_date = one_time_date if kind == RecurrenceKind.ONE_TIME_EXTRA else None
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
    
    return payment_record if created else None


def _generate_due_payments_for_recurring_plans(today: Optional[date] = None) -> int:
    """Generate due payment records for the 1st of each month for all active recurring plans.
    
    Creates ONE combined due per donor per month for all their active recurring plans.
    Dues are generated starting from the month AFTER the last successful payment's payment_month.
    """
    now = today or timezone.localdate()
    current_month = now.replace(day=1)
    
    # Find all active recurring plans
    active_plans = RecurringPoojaPlan.objects.filter(
        is_active=True,
        recurrence_kind=RecurrenceKind.RECURRING,
    )
    
    # Exclude paused plans
    paused_now = Q(pause_from__lte=current_month, pause_until__gte=current_month)
    active_plans = active_plans.exclude(paused_now)
    
    # Group plans by donor to create ONE due per donor per month
    donors_to_process = {}  # donor_id -> (plans, should_create_due)
    
    for plan in active_plans:
        donor_id = plan.donor_id
        
        if donor_id not in donors_to_process:
            donors_to_process[donor_id] = {
                'plans': [],
                'total_amount': Decimal('0.00'),
                'should_create_due': False
            }
        
        donors_to_process[donor_id]['plans'].append(plan)
        donors_to_process[donor_id]['total_amount'] += plan.amount or Decimal('0.00')
    
    created_count = 0
    
    # Process each donor's combined due
    for donor_id, donor_data in donors_to_process.items():
        plans = donor_data['plans']
        total_amount = donor_data['total_amount']
        
        # Find the last successful payment for this donor
        last_payment = (
            PaymentRecord.objects
            .filter(donor_id=donor_id, status=PaymentStatus.SUCCESS)
            .order_by('-payment_month', '-created_at')
            .first()
        )
        
        # Determine if we should create a due for this month
        should_create_due = False
        
        if last_payment and last_payment.payment_month:
            # Use the month after the last successful payment
            last_payment_month = last_payment.payment_month.replace(day=1)
            # Calculate next month after last payment
            next_month_after_payment = _add_months(last_payment_month, 1)
            
            # Create due if current month is at or after the next month after last payment
            if current_month >= next_month_after_payment:
                should_create_due = True
        else:
            # No previous payment found, check plan start dates
            earliest_plan_date = None
            for plan in plans:
                plan_date = plan.start_date or (plan.created_at.date() if plan.created_at else None)
                if plan_date:
                    if earliest_plan_date is None or plan_date < earliest_plan_date:
                        earliest_plan_date = plan_date
            
            if earliest_plan_date:
                plan_start_month = earliest_plan_date.replace(day=1)
                # Generate dues from the SECOND month onwards (after plan creation month)
                if current_month > plan_start_month:
                    should_create_due = True
        
        # Create a single combined due for this donor
        if should_create_due:
            try:
                due_record = _create_due_payment_record(donor_id, total_amount, current_month)
                if due_record:
                    LOGGER.info(
                        "Created combined due payment record for donor %s (total ₹%.2f) for month %s",
                        donor_id,
                        float(total_amount),
                        current_month.isoformat(),
                    )
                    created_count += 1
            except Exception as exc:  # pragma: no cover
                LOGGER.exception("Unable to create due payment record for donor %s", donor_id)
    
    return created_count


def process_recurring_plans(today: Optional[date] = None) -> Dict[str, Any]:
    now = today or timezone.localdate()
    
    # Generate due payment records for the current month
    due_payments_created = _generate_due_payments_for_recurring_plans(now)
    
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
        "due_payments_created": due_payments_created,
    }
