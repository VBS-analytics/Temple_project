from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient

from accounts.access import REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE
from accounts.models import User

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

    def test_restricted_admin_cannot_download_database_backup(self):
        self.client.force_authenticate(self.restricted_admin)
        response = self.client.get(reverse("database-download"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)
