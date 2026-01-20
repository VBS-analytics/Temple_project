"""
Management command to regenerate passbook entries for all donors or a specific donor.

Usage:
    python manage.py regenerate_passbooks          # Regenerate for all donors
    python manage.py regenerate_passbooks 123      # Regenerate for donor ID 123
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from payments.services import regenerate_donor_passbook, regenerate_all_passbooks

User = get_user_model()


class Command(BaseCommand):
    help = 'Regenerate passbook entries for donors'

    def add_arguments(self, parser):
        parser.add_argument(
            'donor_id',
            nargs='?',
            type=int,
            help='Specific donor ID to regenerate. If not provided, regenerates for all donors.'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Verbose output'
        )

    def handle(self, *args, **options):
        donor_id = options.get('donor_id')
        verbose = options.get('verbose', False)

        if donor_id:
            # Regenerate for a specific donor
            try:
                donor = User.objects.get(id=donor_id)
                if verbose:
                    self.stdout.write(f'Regenerating passbook for donor: {donor.name} (ID: {donor_id})')
                regenerate_donor_passbook(donor_id)
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully regenerated passbook for donor ID {donor_id}')
                )
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'Donor with ID {donor_id} not found')
                )
        else:
            # Regenerate for all donors
            if verbose:
                self.stdout.write('Regenerating passbooks for all donors...')
            
            try:
                regenerate_all_passbooks()
                donor_count = User.objects.filter(role='donor').count()
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully regenerated passbooks for {donor_count} donors')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error regenerating passbooks: {str(e)}')
                )
