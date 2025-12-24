from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from pooja.models import PoojaRegistration, RecurringPoojaPlan


class Command(BaseCommand):
    help = "Delete all pooja registrations (and optionally recurring plans) for the named donor."

    def add_arguments(self, parser):
        parser.add_argument(
            "--phone",
            default="7777777777",
            help="Phone number of the donor whose registrations should be removed.",
        )
        parser.add_argument(
            "--include-recurring",
            action="store_true",
            help="Also delete any recurring plans owned by the matching donor(s).",
        )

    def handle(self, *args, **options):
        phone = (options["phone"] or "").strip()
        if not phone:
            self.stdout.write(self.style.ERROR("Provide a non-empty phone number."))
            return

        donors = User.objects.filter(phone_number=phone)
        if not donors.exists():
            self.stdout.write(f"No donors found with phone number {phone!r}; nothing deleted.")
            return

        donor_ids = list(donors.values_list("id", flat=True))
        include_recurring = options["include_recurring"]
        with transaction.atomic():
            if include_recurring:
                recurring_deleted, _ = RecurringPoojaPlan.objects.filter(donor_id__in=donor_ids).delete()
            else:
                recurring_deleted = 0

            registrations_deleted, _ = PoojaRegistration.objects.filter(donor_id__in=donor_ids).delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Removed {registrations_deleted} pooja registration(s) for donors {donor_ids}."
            )
        )
        if include_recurring:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Removed {recurring_deleted} recurring plan(s) for donors {donor_ids}."
                )
            )
