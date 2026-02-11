from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from pooja.models import (
    DayOptionCategory,
    PoojaDayOption,
    PoojaOption,
    RecurrenceFrequency,
    RecurrenceKind,
    RecurringPoojaPlan,
)
from payments.models import PassbookEntry
from payments.services import regenerate_donor_passbook
from payments.views import _donor_passbook_needs_refresh


class PassbookRefreshDetectionTests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(
            phone_number="+919000000001",
            name="Refresh Donor",
            password="secret",
        )
        self.pooja_option = PoojaOption.objects.create(code="R1", name="Recurring 1")
        self.day_option = PoojaDayOption.objects.create(
            code="REGULAR_TEST",
            description="Regular",
            category=DayOptionCategory.CODE,
        )

    def test_needs_refresh_when_plan_changes_after_passbook_generation(self):
        RecurringPoojaPlan.objects.create(
            donor=self.donor,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 1, 1),
            amount=Decimal("500.00"),
            is_active=True,
        )

        with patch("payments.services.timezone.localdate", return_value=date(2026, 2, 11)):
            regenerate_donor_passbook(self.donor.id)

        current_month = date(2026, 2, 1)
        self.assertFalse(_donor_passbook_needs_refresh(self.donor.id, current_month))

        RecurringPoojaPlan.objects.create(
            donor=self.donor,
            pooja_option=PoojaOption.objects.create(code="R2", name="Recurring 2"),
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 1, 1),
            amount=Decimal("100.00"),
            is_active=True,
        )

        self.assertTrue(_donor_passbook_needs_refresh(self.donor.id, current_month))


class PassbookDeduplicationTests(TestCase):
    def test_dedup_prefers_latest_created_entry(self):
        donor = User.objects.create_user(
            phone_number="+919000000002",
            name="Dedup Donor",
            password="secret",
        )

        older = PassbookEntry.objects.create(
            donor=donor,
            entry_date=date(2026, 2, 1),
            entry_type="due",
            transaction_details="--- Pooja DUE ---",
            opening_balance=Decimal("1800.00"),
            due_amount=Decimal("500.00"),
            paid_amount=Decimal("0.00"),
            closing_due=Decimal("2300.00"),
        )
        newer = PassbookEntry.objects.create(
            donor=donor,
            entry_date=date(2026, 2, 1),
            entry_type="due",
            transaction_details="--- Pooja DUE ---",
            opening_balance=Decimal("1800.00"),
            due_amount=Decimal("600.00"),
            paid_amount=Decimal("0.00"),
            closing_due=Decimal("2400.00"),
        )

        now = timezone.now()
        PassbookEntry.objects.filter(pk=older.pk).update(created_at=now - timedelta(minutes=5))
        PassbookEntry.objects.filter(pk=newer.pk).update(created_at=now)

        row = (
            PassbookEntry.objects.filter(donor=donor)
            .annotate(
                rn=Window(
                    expression=RowNumber(),
                    partition_by=[F("donor_id"), F("entry_date"), F("entry_type")],
                    order_by=F("created_at").desc(),
                )
            )
            .filter(rn=1)
            .get()
        )
        self.assertEqual(row.due_amount, Decimal("600.00"))
