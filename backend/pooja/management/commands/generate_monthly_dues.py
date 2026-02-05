from django.core.management.base import BaseCommand

from ...services.recurrence import process_recurring_plans
from payments.services import regenerate_all_passbooks


class Command(BaseCommand):
    help = "Generate (or backfill) monthly pooja dues and refresh donor passbooks"

    def handle(self, *args, **options):
        # Only generate dues/cleanup; avoid creating registrations in monthly job
        result = process_recurring_plans(create_registrations=False)
        self.stdout.write(self.style.SUCCESS(
            f"Processed recurring plans: {result.get('processed', 0)}; "
            f"created recurring dues: {result.get('due_payments_created', 0)}; "
            f"created CHRT dues: {result.get('chrt_due_payments_created', 0)}; "
            f"cleaned stale CHRT dues: {result.get('stale_chrt_dues_cleaned', 0)}"
        ))

        regenerate_all_passbooks()
        self.stdout.write(self.style.SUCCESS("Regenerated passbooks for all donors."))
