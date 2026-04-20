import os
import tempfile
from decimal import Decimal
from datetime import timedelta
from io import BytesIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from openpyxl import Workbook, load_workbook
from rest_framework import status
from rest_framework.test import APIClient

from payments.models import PaymentMode, PaymentRecord, PaymentStatus
from pooja.models import PoojaOption, PoojaRegistration

from .models import (
    DonorFeedback,
    DonorProfile,
    FamilyMember,
    OtpPurpose,
    OtpToken,
    User,
)
from .access import (
    can_download_reports,
    can_view_expense_tracker,
    can_view_payment_statement,
    is_read_only_admin,
    REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE,
)
from .serializers import DonorProfileSerializer, RegisterSerializer

SQLITE_DB_CONFIG = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class RegisterSerializerTests(TestCase):
    def setUp(self):
        self.phone_number = "9000000000"
        self.otp_code = "123456"
        OtpToken.objects.create(
            phone_number=self.phone_number,
            code=self.otp_code,
            purpose=OtpPurpose.REGISTRATION,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

    def _get_payload(self, gender_value: str | None = None) -> dict[str, str]:
        payload = {
            "phone_number": self.phone_number,
            "name": "Test Donor",
            "password": "strongPass9",
            "confirm_password": "strongPass9",
            "otp_code": self.otp_code,
        }
        if gender_value is not None:
            payload["gender"] = gender_value
        return payload

    def test_gender_is_persisted_when_provided(self):
        serializer = RegisterSerializer(data=self._get_payload("female"))
        self.assertTrue(serializer.is_valid(), serializer.errors)

        serializer.save()

        profile = DonorProfile.objects.get(user__phone_number=self.phone_number)
        self.assertEqual(profile.gender, "female")

    def test_gender_stays_blank_when_not_supplied(self):
        serializer = RegisterSerializer(data=self._get_payload())
        self.assertTrue(serializer.is_valid(), serializer.errors)

        serializer.save()

        profile = DonorProfile.objects.get(user__phone_number=self.phone_number)
        self.assertEqual(profile.gender, "")

# Create your tests here.


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class DashboardMetricsViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            phone_number="9000000000",
            name="Admin",
            password="adminpass",
        )
        self.client.force_authenticate(self.admin)

        donor_one = User.objects.create_user(
            phone_number="8000000001",
            name="Donor One",
            password="donorpass1",
        )
        donor_two = User.objects.create_user(
            phone_number="8000000002",
            name="Donor Two",
            password="donorpass2",
        )

        profile_one = DonorProfile.objects.get(user=donor_one)
        profile_one.monthly_donation_amount = Decimal("100.50")
        profile_one.save(update_fields=["monthly_donation_amount"])

        profile_two = DonorProfile.objects.get(user=donor_two)
        profile_two.monthly_donation_amount = Decimal("50.00")
        profile_two.save(update_fields=["monthly_donation_amount"])

        FamilyMember.objects.create(user=donor_one, name="Member A")
        FamilyMember.objects.create(user=donor_two, name="Member B")

    def test_dashboard_metrics_include_donation_total(self):
        response = self.client.get(reverse("dashboard-metrics"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["donor_count"], 2)
        self.assertEqual(data["family_member_count"], 2)
        self.assertEqual(data["donation_amount"], "150.50")

    def test_dashboard_metrics_forbidden_to_non_admins(self):
        donor_user = User.objects.create_user(
            phone_number="8000000003",
            name="Donor Three",
            password="donorpass3",
        )
        client = APIClient()
        client.force_authenticate(donor_user)
        response = client.get(reverse("dashboard-metrics"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class DonorProfileCurrentBalanceSerializerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            phone_number="8000000004",
            name="Balance Donor",
            password="donorpass4",
        )
        self.profile = DonorProfile.objects.get(user=self.user)
        self.profile.custom_number = Decimal("50.00")
        self.profile.save(update_fields=["custom_number"])

        self.option = PoojaOption.objects.create(
            code="TEST",
            name="Test Pooja",
            min_amount=Decimal("0.00"),
            max_amount=Decimal("1000.00"),
            default_amount=Decimal("0.00"),
        )

        today = timezone.localdate()
        PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.option,
            start_date=today,
            total_amount=Decimal("150.00"),
        )
        PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.option,
            start_date=today,
            total_amount=Decimal("200.00"),
        )

        PaymentRecord.objects.create(
            donor=self.user,
            amount=Decimal("100.00"),
            currency="INR",
            mode=PaymentMode.NEFT,
            status=PaymentStatus.SUCCESS,
            payment_month=today.replace(day=1),
        )

    def test_calculates_current_month_summary(self):
        serializer = DonorProfileSerializer(self.profile)
        data = serializer.data
        self.assertEqual(data["current_month_due"], "350.00")
        self.assertEqual(data["current_month_payments"], "100.00")
        self.assertEqual(data["calculated_current_balance"], "300.00")

    def test_includes_due_payment_records_in_summary(self):
        today = timezone.localdate()
        PaymentRecord.objects.create(
            donor=self.user,
            amount=Decimal("200.00"),
            currency="INR",
            mode=PaymentMode.CASH,
            status=PaymentStatus.PENDING,
            payment_month=today.replace(day=1),
        )
        serializer = DonorProfileSerializer(self.profile)
        data = serializer.data
        self.assertEqual(data["current_month_due"], "550.00")
        self.assertEqual(data["calculated_current_balance"], "450.00")


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class ImportOpeningBalancesCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone_number="+919000000000",
            name="Import Test",
            password="safepass123",
        )
        self.profile = DonorProfile.objects.get(user=self.user)

    def _create_workbook(self, rows: list[tuple[str, str, str | int]]) -> str:
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["Name", "Phone", "Opening Balance"])
        for row in rows:
            sheet.append(row)
        tmp_file = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        tmp_file.close()
        workbook.save(tmp_file.name)
        return tmp_file.name

    def test_updates_balance_for_matching_phone(self):
        workbook_path = self._create_workbook(
            [("Import Test", "9000000000", "-750")]
        )
        try:
            call_command("import_opening_balances", workbook_path)
            self.profile.refresh_from_db()
            self.assertEqual(self.profile.custom_number, -750)
        finally:
            os.unlink(workbook_path)

    def test_dry_run_does_not_persist_changes(self):
        workbook_path = self._create_workbook(
            [("Import Test", "9000000000", "250")]
        )
        try:
            call_command("import_opening_balances", workbook_path, "--dry-run")
            self.profile.refresh_from_db()
            self.assertIsNone(self.profile.custom_number)
        finally:
            os.unlink(workbook_path)


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class OpeningBalanceMutationGuardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.donor = User.objects.create_user(
            phone_number="8333333333",
            name="Guarded Donor",
            password="donorpass",
        )
        self.admin = User.objects.create_superuser(
            phone_number="9333333333",
            name="Guarded Admin",
            password="adminpass",
        )
        self.profile = DonorProfile.objects.get(user=self.donor)
        self.profile.custom_number = 50
        self.profile.save(update_fields=["custom_number"])

    def test_donor_profile_update_rejects_custom_number(self):
        self.client.force_authenticate(self.donor)
        response = self.client.put(
            reverse("profile"),
            {"custom_number": 999},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("custom_number", response.json())

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.custom_number, 50)

    def test_admin_donor_update_rejects_custom_number(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            reverse("donor-detail", args=[self.donor.id]),
            {"profile": {"custom_number": 888}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("custom_number", response.json())

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.custom_number, 50)


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class AdminAccessPolicyTests(TestCase):
    def test_read_only_admin_access_rules(self):
        read_only_admin = User.objects.create_superuser(
            phone_number="9999999998",
            name="Read Only Admin",
            password="adminpass1",
        )
        full_admin = User.objects.create_superuser(
            phone_number="9999999999",
            name="Full Admin",
            password="adminpass",
        )
        hidden_statement_admin = User.objects.create_superuser(
            phone_number="+91 9999999997",
            name="Hidden Statement Admin",
            password="adminpass2",
        )
        self.assertTrue(is_read_only_admin(read_only_admin))
        self.assertTrue(can_view_expense_tracker(read_only_admin))
        self.assertFalse(can_view_payment_statement(hidden_statement_admin))
        self.assertFalse(can_view_expense_tracker(hidden_statement_admin))
        self.assertFalse(can_download_reports(hidden_statement_admin))
        self.assertFalse(is_read_only_admin(full_admin))
        self.assertTrue(can_view_payment_statement(full_admin))
        self.assertTrue(can_view_expense_tracker(full_admin))
        self.assertTrue(can_download_reports(full_admin))


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class DonorFeedbackViewTests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(
            phone_number="8111111111",
            name="Donor Feedback User",
            password="donorpass",
        )
        self.admin = User.objects.create_superuser(
            phone_number="9111111111",
            name="Admin User",
            password="adminpass",
        )
        self.client = APIClient()

    def test_donor_can_submit_feedback(self):
        self.client.force_authenticate(self.donor)
        response = self.client.post(
            reverse("donor-feedback"),
            {"feedback": "Please add more monthly progress updates."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(DonorFeedback.objects.count(), 1)
        row = DonorFeedback.objects.first()
        self.assertEqual(row.donor_name, self.donor.name)
        self.assertEqual(row.donor_phone_number, self.donor.phone_number)
        self.assertEqual(row.feedback, "Please add more monthly progress updates.")

    def test_admin_cannot_submit_feedback(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("donor-feedback"),
            {"feedback": "This should be forbidden for admins."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_feedback_length_must_be_250_or_less(self):
        self.client.force_authenticate(self.donor)
        response = self.client.post(
            reverse("donor-feedback"),
            {"feedback": "a" * 251},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class DonorFeedbackExportViewTests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(
            phone_number="8222222222",
            name="Feedback Donor",
            password="donorpass",
        )
        self.admin = User.objects.create_superuser(
            phone_number="9222222222",
            name="Feedback Admin",
            password="adminpass",
        )
        self.restricted_admin = User.objects.create_superuser(
            phone_number="+91 9999999997",
            name="Restricted Feedback Admin",
            password="adminpass2",
        )
        self.client = APIClient()

    def test_admin_can_download_feedback_excel(self):
        first = DonorFeedback.objects.create(
            donor_name="Donor One",
            donor_phone_number="9000000001",
            feedback="First feedback",
        )
        second = DonorFeedback.objects.create(
            donor_name="Donor Two",
            donor_phone_number="9000000002",
            feedback="Second feedback",
        )

        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("donor-feedback-export"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn("attachment;", response.get("Content-Disposition", ""))

        payload = b"".join(response.streaming_content)
        workbook = load_workbook(filename=BytesIO(payload))
        sheet = workbook["Donor Feedback"]
        rows = list(sheet.iter_rows(values_only=True))

        self.assertEqual(
            rows[0],
            ("ID", "Donor Name", "Donor Phone Number", "Feedback", "Created At"),
        )
        self.assertEqual(rows[1][0], second.id)
        self.assertEqual(rows[1][1], "Donor Two")
        self.assertEqual(rows[2][0], first.id)
        self.assertEqual(rows[2][1], "Donor One")

    def test_donor_cannot_download_feedback_excel(self):
        self.client.force_authenticate(self.donor)
        response = self.client.get(reverse("donor-feedback-export"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_restricted_admin_cannot_download_feedback_excel(self):
        self.client.force_authenticate(self.restricted_admin)
        response = self.client.get(reverse("donor-feedback-export"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)
