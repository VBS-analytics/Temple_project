from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient

from accounts.access import REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE
from accounts.models import User
from pooja.models import UbhayamReport

SQLITE_DB_CONFIG = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class DatabaseDownloadAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.restricted_admin = User.objects.create_superuser(
            phone_number="+91 9999999997",
            name="Restricted Admin",
            password="adminpass2",
        )
        self.full_admin = User.objects.create_superuser(
            phone_number="+91 9999999996",
            name="Full Admin",
            password="adminpass3",
        )
        UbhayamReport.objects.create(
            donor_id="D100",
            donor_name="Sample Donor",
            donor_phone_number="9876543210",
            pooja_day_option="Any day of the month",
        )

    def test_restricted_admin_cannot_download_database_backup(self):
        self.client.force_authenticate(self.restricted_admin)
        response = self.client.get(reverse("database-download"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)

    def test_restricted_admin_cannot_download_ubhayam_master_report(self):
        self.client.force_authenticate(self.restricted_admin)
        response = self.client.get(reverse("ubhayam-master-report-download"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)

    def test_full_admin_can_download_ubhayam_master_report(self):
        self.client.force_authenticate(self.full_admin)
        response = self.client.get(reverse("ubhayam-master-report-download"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            response["Content-Type"],
        )
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertIn("ubhayam-maste-report-", response["Content-Disposition"])
        payload = b"".join(response.streaming_content)
        self.assertGreater(len(payload), 0)
