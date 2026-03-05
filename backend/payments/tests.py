from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APIClient

from accounts.access import REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE
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
from payments.models import Donation, ExpenseRecord, PaymentRecord, PaymentStatus
from payments.services import regenerate_donor_passbook
from payments.views import _donor_passbook_needs_refresh


class DonationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.create_url = reverse("donation-create")

    def test_anyone_can_create_donation_without_login(self):
        response = self.client.post(
            self.create_url,
            {
                "donor_name": "Lakshmi V",
                "donor_phone_no": "+919876543210",
                "transaction_id": "DON-1001",
                "amount_paid": "750.00",
                "donation_date": "2026-02-03",
                "notes": "Monthly donation",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        created = Donation.objects.get(id=response.json()["id"])
        self.assertEqual(created.donor_name, "Lakshmi V")
        self.assertEqual(created.donor_phone_no, "+919876543210")
        self.assertEqual(created.transaction_id, "DON-1001")
        self.assertEqual(created.amount_paid, Decimal("750.00"))

    def test_missing_required_fields_returns_400(self):
        response = self.client.post(
            self.create_url,
            {
                "donor_name": "Lakshmi V",
                "amount_paid": "750.00",
                "donation_date": "2026-02-03",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class PaymentExportAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.full_admin = User.objects.create_superuser(
            phone_number="9999999999",
            name="Full Admin",
            password="adminpass",
        )
        self.restricted_admin = User.objects.create_superuser(
            phone_number="+91 9999999997",
            name="Restricted Admin",
            password="adminpass2",
        )

    def test_restricted_admin_cannot_download_payment_details_export(self):
        self.client.force_authenticate(self.restricted_admin)
        response = self.client.get(reverse("payment-details-export"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)

    def test_restricted_admin_cannot_download_general_donation_export(self):
        self.client.force_authenticate(self.restricted_admin)
        response = self.client.get(reverse("general-donation-export"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)

    def test_full_admin_can_download_payment_details_export(self):
        self.client.force_authenticate(self.full_admin)
        response = self.client.get(reverse("payment-details-export"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)


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

    def test_needs_refresh_when_earliest_due_month_is_missing(self):
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

        # Simulate stale passbook generated with old logic: Jan due missing, Feb due present.
        PassbookEntry.objects.create(
            donor=self.donor,
            entry_date=date(2025, 12, 31),
            entry_type="balance",
            transaction_details="-",
            opening_balance=Decimal("0.00"),
            due_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            closing_due=Decimal("0.00"),
        )
        PassbookEntry.objects.create(
            donor=self.donor,
            entry_date=date(2026, 2, 1),
            entry_type="due",
            transaction_details="--- Pooja DUE ---",
            opening_balance=Decimal("0.00"),
            due_amount=Decimal("500.00"),
            paid_amount=Decimal("0.00"),
            closing_due=Decimal("500.00"),
        )

        current_month = date(2026, 2, 1)
        self.assertTrue(_donor_passbook_needs_refresh(self.donor.id, current_month))

    def test_needs_refresh_when_monthly_due_exists_before_anchor_month(self):
        RecurringPoojaPlan.objects.create(
            donor=self.donor,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 3, 1),
            next_occurrence=date(2026, 3, 1),
            amount=Decimal("500.00"),
            is_active=True,
        )

        # Simulate stale passbook generated with old logic: Feb due exists
        # even though recurring anchor starts in Mar.
        PassbookEntry.objects.create(
            donor=self.donor,
            entry_date=date(2025, 12, 31),
            entry_type="balance",
            transaction_details="-",
            opening_balance=Decimal("0.00"),
            due_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            closing_due=Decimal("0.00"),
        )
        PassbookEntry.objects.create(
            donor=self.donor,
            entry_date=date(2026, 2, 1),
            entry_type="due",
            transaction_details="--- Pooja DUE ---",
            opening_balance=Decimal("0.00"),
            due_amount=Decimal("500.00"),
            paid_amount=Decimal("0.00"),
            closing_due=Decimal("500.00"),
        )

        current_month = date(2026, 2, 1)
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

    def test_dedup_keeps_distinct_paid_rows_on_same_date(self):
        donor = User.objects.create_user(
            phone_number="+919000000003",
            name="Paid Dedup Donor",
            password="secret",
        )

        first_payment = PaymentRecord.objects.create(
            donor=donor,
            amount=Decimal("500.00"),
            mode="upi",
            status=PaymentStatus.SUCCESS,
            transaction_reference="TXN-A",
            payment_month=date(2026, 2, 1),
        )
        second_payment = PaymentRecord.objects.create(
            donor=donor,
            amount=Decimal("600.00"),
            mode="upi",
            status=PaymentStatus.SUCCESS,
            transaction_reference="TXN-B",
            payment_month=date(2026, 2, 1),
        )

        PassbookEntry.objects.create(
            donor=donor,
            entry_date=date(2026, 2, 1),
            entry_type="paid",
            transaction_details="TXN-A",
            payment_record=first_payment,
            opening_balance=Decimal("1000.00"),
            due_amount=Decimal("0.00"),
            paid_amount=Decimal("500.00"),
            closing_due=Decimal("500.00"),
        )
        PassbookEntry.objects.create(
            donor=donor,
            entry_date=date(2026, 2, 1),
            entry_type="paid",
            transaction_details="TXN-B",
            payment_record=second_payment,
            opening_balance=Decimal("500.00"),
            due_amount=Decimal("0.00"),
            paid_amount=Decimal("600.00"),
            closing_due=Decimal("-100.00"),
        )

        rows = (
            PassbookEntry.objects.filter(donor=donor)
            .annotate(
                rn=Window(
                    expression=RowNumber(),
                    partition_by=[
                        F("donor_id"),
                        F("entry_date"),
                        F("entry_type"),
                        F("payment_record_id"),
                        F("registration_id"),
                        F("transaction_details"),
                        F("due_amount"),
                        F("paid_amount"),
                    ],
                    order_by=F("created_at").desc(),
                )
            )
            .filter(rn=1)
        )

        self.assertEqual(rows.count(), 2)


class PassbookOrderingTests(TestCase):
    def test_same_day_due_and_paid_apply_due_before_paid(self):
        donor = User.objects.create_user(
            phone_number="+919000000004",
            name="Ordering Donor",
            password="secret",
        )
        pooja_option = PoojaOption.objects.create(code="R3", name="Recurring 3")
        day_option = PoojaDayOption.objects.create(
            code="REGULAR_ORDER_TEST",
            description="Regular",
            category=DayOptionCategory.CODE,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 1, 1),
            amount=Decimal("1000.00"),
            is_active=True,
        )
        PaymentRecord.objects.create(
            donor=donor,
            amount=Decimal("1000.00"),
            mode="upi",
            status=PaymentStatus.SUCCESS,
            transaction_reference="FA19147194",
            payment_month=date(2026, 1, 1),
        )

        with patch("payments.services.timezone.localdate", return_value=date(2026, 2, 11)):
            regenerate_donor_passbook(donor.id)

        jan_entries = list(
            PassbookEntry.objects.filter(donor=donor, entry_date=date(2026, 1, 1))
            .exclude(entry_type="balance")
            .order_by("id")
        )
        self.assertEqual(len(jan_entries), 2)
        self.assertEqual(jan_entries[0].entry_type, "due")
        self.assertEqual(jan_entries[0].closing_due, Decimal("1000.00"))
        self.assertEqual(jan_entries[1].entry_type, "paid")
        self.assertEqual(jan_entries[1].closing_due, Decimal("0.00"))


class ExpenseRecordApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("expense-records-list")
        self.admin = User.objects.create_user(
            phone_number="+919100000001",
            name="Expense Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.donor = User.objects.create_user(
            phone_number="+919100000002",
            name="Expense Donor",
            password="secret",
        )

    def test_admin_can_create_expense_record(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url,
            {
                "transaction_date": "2026-01-15",
                "category": "Maintenance",
                "amount": "1250.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = ExpenseRecord.objects.get(pk=response.json()["id"])
        self.assertEqual(created.created_by_id, self.admin.id)
        self.assertEqual(created.amount, Decimal("1250.00"))

    def test_non_admin_cannot_list_or_create_expenses(self):
        self.client.force_authenticate(self.donor)
        list_response = self.client.get(self.url)
        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)

        create_response = self.client.post(
            self.url,
            {
                "transaction_date": "2026-01-15",
                "category": "Maintenance",
                "amount": "1250.00",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_monthly_list_returns_full_unpaginated_payload(self):
        ExpenseRecord.objects.bulk_create(
            [
                ExpenseRecord(
                    transaction_date=date(2026, 1, 15),
                    category=f"Category {idx}",
                    amount=Decimal("10.00"),
                    created_by=self.admin,
                )
                for idx in range(25)
            ]
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"month": "2026-01"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIsInstance(payload, list)
        self.assertEqual(len(payload), 25)
