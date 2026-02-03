from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from pooja.models import PoojaRegistration, RecurrenceKind
from pooja.services.recurrence import create_plan_from_registration


class Command(BaseCommand):
    help = "Backfill missing CHRT recurring plans for existing CHRT registrations (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--donor-phone",
            dest="donor_phones",
            action="append",
            help="Restrict to donor phone numbers (can be repeated). If omitted, processes all donors.",
        )

    def handle(self, *args, **options):
        donor_phones = options.get("donor_phones") or []
        phone_filter = Q()
        if donor_phones:
            phone_filter = Q(donor__phone_number__in=donor_phones)

        # Identify registrations that are CHRT by day option, including those with null day_option
        chrt_qs = (
            PoojaRegistration.objects.filter(phone_filter, day_option__code="CHRT")
            .select_related("day_option", "pooja_option", "donor")
        )

        created = 0
        skipped = 0

        for reg in chrt_qs:
            has_plan = reg.originating_recurring_plans.filter(recurrence_kind=RecurrenceKind.RECURRING).exists()
            if has_plan:
                skipped += 1
                continue

            preferred_date = reg.start_date
            if preferred_date is None and getattr(reg, "created_at", None):
                preferred_date = reg.created_at.date()

            if preferred_date is None:
                # Fallback: use today's date to avoid null constraints
                preferred_date = date.today()

            with transaction.atomic():
                create_plan_from_registration(
                    reg,
                    recurrence_kind=RecurrenceKind.RECURRING,
                    recurrence_one_time_date=preferred_date,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created} CHRT plans; skipped {skipped} existing."))
