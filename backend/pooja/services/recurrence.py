"""Recurring-plan helpers for pooja registrations."""

from __future__ import annotations

import calendar
import logging
from datetime import date
from typing import Any, Dict, Iterable, List, Optional

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..models import (
    PoojaRegistration,
    PoojaRegistrationMember,
    RecurrenceFrequency,
    RecurrenceKind,
    RecurringPoojaPlan,
)

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


def process_recurring_plans(today: Optional[date] = None) -> Dict[str, Any]:
    now = today or timezone.localdate()
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

    return {"processed": processed, "failures": failures}
