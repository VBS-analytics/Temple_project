from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from .models import DonorProfile, OtpPurpose, OtpToken
from .serializers import RegisterSerializer

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
