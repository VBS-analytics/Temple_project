from django.core.management.base import BaseCommand

from ...services.recurrence import process_recurring_plans


class Command(BaseCommand):
    help = "Process recurring pooja plans that are due for this month."

    def handle(self, *args, **options):
        result = process_recurring_plans()
        processed = result.get("processed", 0)
        failures = result.get("failures", [])
        self.stdout.write(self.style.SUCCESS(f"Processed {processed} recurring plans."))
        if failures:
            self.stdout.write(self.style.WARNING("Encountered failures while processing recurring plans:"))
            for failure in failures:
                self.stdout.write(self.style.ERROR(f"- {failure}"))
