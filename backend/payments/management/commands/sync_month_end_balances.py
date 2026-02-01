"""
Management command to sync closing balances to opening balances at month-end.

This command should be run at the end of each month to set each donor's opening_balance
(custom_number) to their previous month's closing balance.

Closing balance = opening_balance + current_month_due - current_month_payments
"""

from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q, Sum

from accounts.models import DonorProfile, User
from accounts.serializers import _compute_monthly_summary_for_user, _current_month_bounds
from payments.models import PaymentRecord


class Command(BaseCommand):
    help = 'Sync month-end closing balances to next month opening balances for all donors'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without making database changes',
        )
        parser.add_argument(
            '--month',
            type=str,
            help='Month to process (YYYY-MM format). Defaults to current month.',
        )
        parser.add_argument(
            '--donor-id',
            type=int,
            help='Only process a specific donor by ID',
        )

    def handle(self, *args, **options):
        is_dry_run = options.get('dry_run', False)
        month_str = options.get('month')
        donor_id = options.get('donor_id')

        # Parse the target month
        if month_str:
            try:
                year, month = map(int, month_str.split('-'))
                month_date = date(year, month, 1)
            except (ValueError, TypeError):
                self.stdout.write(
                    self.style.ERROR(f'Invalid month format: {month_str}. Use YYYY-MM')
                )
                return
        else:
            month_date = date.today()

        self.stdout.write(f'Processing month: {month_date.strftime("%B %Y")}')
        if is_dry_run:
            self.stdout.write(self.style.WARNING('[DRY RUN] No changes will be made'))

        # Get all donors or a specific one
        if donor_id:
            try:
                donor = User.objects.get(id=donor_id)
                donors = [donor]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Donor with ID {donor_id} not found'))
                return
        else:
            donors = User.objects.filter(role='donor').all()

        updated_count = 0
        for donor in donors:
            try:
                profile = donor.profile
            except DonorProfile.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'Donor {donor.id} ({donor.name}) has no profile, skipping')
                )
                continue

            # Get current opening balance
            opening_balance = Decimal(str(profile.custom_number or 0))

            # Get current month summary (using the target month)
            start, end = _current_month_bounds(month_date)
            
            # Calculate due: sum of all pooja registrations in this month
            from pooja.models import PoojaRegistration, RecurringPoojaPlan, RecurrenceKind
            current_month_due = Decimal("0.00")

            # Identify CHRT-linked registrations (legacy rows may have day_option null)
            chrt_registration_ids = RecurringPoojaPlan.objects.filter(
                donor=donor,
                recurrence_kind=RecurrenceKind.RECURRING,
            ).filter(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)).values_list(
                "origin_registration_id", flat=True
            )

            # Non-CHRT poojas: continue using start_date to decide the month
            non_chrt_totals = (
                PoojaRegistration.objects.filter(
                    donor=donor,
                    start_date__gte=start,
                    start_date__lt=end,
                )
                .exclude(day_option__code="CHRT")
                .exclude(id__in=chrt_registration_ids)
                .values_list("total_amount", flat=True)
            )
            for total_amount in non_chrt_totals:
                current_month_due += Decimal(str(total_amount or 0))

            # CHRT poojas: use the preferred date stored in RecurringPoojaPlan.one_time_date
            chrt_plans = RecurringPoojaPlan.objects.filter(
                donor=donor,
                is_active=True,
                one_time_date__gte=start,
                one_time_date__lt=end,
            ).filter(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))

            for plan in chrt_plans:
                current_month_due += plan.amount or Decimal("0.00")
            
            # Calculate payments: sum of all successful payments in this month
            current_month_payments = Decimal("0.00")
            from payments.models import PaymentStatus
            payment_result = PaymentRecord.objects.filter(
                donor=donor,
                payment_month__gte=start,
                payment_month__lt=end,
                status=PaymentStatus.SUCCESS,
            ).aggregate(total=Sum("amount"))
            if payment_result.get("total"):
                current_month_payments = Decimal(str(payment_result["total"]))

            # Calculate closing balance
            # closing_balance = opening_balance + current_month_due - current_month_payments
            closing_balance = opening_balance + current_month_due - current_month_payments

            self.stdout.write(
                f'Donor {donor.id} ({donor.name}): '
                f'Opening={opening_balance}, Due={current_month_due}, '
                f'Payments={current_month_payments}, Closing={closing_balance}'
            )

            if not is_dry_run:
                profile.custom_number = int(closing_balance)
                profile.save(update_fields=['custom_number'])
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(f'Updated {updated_count} donor(s) opening balance')
        )
