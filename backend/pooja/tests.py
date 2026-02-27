from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.access import REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE
from accounts.models import DonorProfile, User, UserRole
from payments.models import PaymentMode, PaymentRecord, PaymentStatus
from payments.services import regenerate_donor_passbook
from .models import (
    DayOptionCategory,
    PoojaCartSnapshot,
    PoojaCartSnapshotExportBatch,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    PoojaStatus,
    RecurrenceFrequency,
    RecurrenceKind,
    RecurringPoojaPlan,
    UbhayamReport,
)
from .serializers import RecurringPoojaPlanSerializer
from .services.calendar import OccurrenceResult, TempleCalendarService
from .services.recurrence import create_registration_from_plan, process_recurring_plans
from .views import PAUSE_REASON_USE_FOR_TEMPLE


SQLITE_DB_CONFIG = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class PoojaPostPrasadamReportTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            phone_number="9000000100",
            name="Report Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.restricted_admin = User.objects.create_user(
            phone_number="+91 9999999997",
            name="Restricted Report Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.pooja_option = PoojaOption.objects.create(code="PPR", name="Post Prasadam Test Pooja")

    def test_post_prasadam_report_returns_only_yes_registrations(self):
        donor_yes = User.objects.create_user(phone_number="9000000101", name="Donor Yes", password="secret")
        donor_no = User.objects.create_user(phone_number="9000000102", name="Donor No", password="secret")

        PoojaRegistration.objects.create(
            donor=donor_yes,
            pooja_option=self.pooja_option,
            start_date=date(2026, 2, 17),
            post_prasadam=True,
        )
        PoojaRegistration.objects.create(
            donor=donor_no,
            pooja_option=self.pooja_option,
            start_date=date(2026, 2, 18),
            post_prasadam=False,
        )

        response = self.client.get(reverse("pooja-registrations-post-prasadam-report"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(len(payload["results"]), 1)
        self.assertEqual(payload["results"][0]["donor_id"], donor_yes.id)
        self.assertEqual(payload["results"][0]["name"], donor_yes.name)
        self.assertEqual(payload["results"][0]["phone_number"], donor_yes.phone_number)
        self.assertEqual(payload["results"][0]["pooja_date"], "2026-02-17")

    def test_post_prasadam_report_is_admin_only(self):
        donor = User.objects.create_user(phone_number="9000000103", name="Donor", password="secret")
        PoojaRegistration.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            start_date=date(2026, 2, 20),
            post_prasadam=True,
        )

        self.client.force_authenticate(user=donor)
        response = self.client.get(reverse("pooja-registrations-post-prasadam-report"))
        self.assertEqual(response.status_code, 403)

    def test_restricted_admin_cannot_download_post_prasadam_report(self):
        donor_yes = User.objects.create_user(phone_number="9000000104", name="Donor Yes", password="secret")
        PoojaRegistration.objects.create(
            donor=donor_yes,
            pooja_option=self.pooja_option,
            start_date=date(2026, 2, 21),
            post_prasadam=True,
        )

        self.client.force_authenticate(user=self.restricted_admin)
        response = self.client.get(reverse("pooja-registrations-post-prasadam-report"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class PoojaRegistrationAccessControlTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.donor = User.objects.create_user(
            phone_number="9000000200",
            name="Access Donor",
            password="secret",
        )
        self.admin = User.objects.create_user(
            phone_number="9000000201",
            name="Access Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.option = PoojaOption.objects.create(code="ACC", name="Access Test Pooja")
        self.any_day_option = PoojaDayOption.objects.create(
            code="AD",
            description="Any Day of Month",
            category=DayOptionCategory.CODE,
        )
        self.first_day_option = PoojaDayOption.objects.create(
            code="FE",
            description="1st day of English month",
            category=DayOptionCategory.CODE,
        )
        self.url = reverse("pooja-registrations-list")

    def _payload(self) -> dict[str, object]:
        return {
            "pooja_option": self.option.id,
            "start_date": "2026-02-22",
            "total_amount": "150.00",
        }

    def test_default_profile_without_access_is_blocked(self):
        self.client.force_authenticate(user=self.donor)

        response = self.client.post(self.url, self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["detail"], "Please contact Admin for the pooja registration")
        self.assertEqual(PoojaRegistration.objects.filter(donor=self.donor).count(), 0)

    def test_donor_with_access_can_register(self):
        donor_profile = DonorProfile.objects.get(user=self.donor)
        donor_profile.pooja_registration_access = True
        donor_profile.save(update_fields=["pooja_registration_access"])
        self.client.force_authenticate(user=self.donor)

        response = self.client.post(self.url, self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PoojaRegistration.objects.filter(donor=self.donor).count(), 1)

    def test_admin_bypasses_access_flag(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(self.url, self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PoojaRegistration.objects.filter(donor=self.admin).count(), 1)

    def test_any_day_option_keeps_start_date_null_when_not_provided(self):
        donor_profile = DonorProfile.objects.get(user=self.donor)
        donor_profile.pooja_registration_access = True
        donor_profile.save(update_fields=["pooja_registration_access"])
        self.client.force_authenticate(user=self.donor)

        payload = {
            "pooja_option": self.option.id,
            "day_option": self.any_day_option.id,
            "total_amount": "150.00",
        }
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        registration = PoojaRegistration.objects.get(donor=self.donor)
        self.assertIsNone(registration.start_date)

    def test_non_any_day_option_defaults_start_date_to_today_when_missing(self):
        donor_profile = DonorProfile.objects.get(user=self.donor)
        donor_profile.pooja_registration_access = True
        donor_profile.save(update_fields=["pooja_registration_access"])
        self.client.force_authenticate(user=self.donor)

        payload = {
            "pooja_option": self.option.id,
            "day_option": self.first_day_option.id,
            "total_amount": "150.00",
        }
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        registration = PoojaRegistration.objects.get(donor=self.donor)
        self.assertEqual(registration.start_date, timezone.localdate())


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class UbhayamReportSyncTests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(
            phone_number="9000000300",
            name="Ubhayam Donor",
            password="secret",
        )
        self.day_option, _ = PoojaDayOption.objects.get_or_create(
            code="FE",
            defaults={
                "description": "1st day of English Month",
                "category": DayOptionCategory.CODE,
            },
        )
        self.included_option, _ = PoojaOption.objects.get_or_create(
            code="AR99",
            defaults={"name": "Regular Archana"},
        )
        self.excluded_options = [
            PoojaOption.objects.get_or_create(
                code="GP1",
                defaults={"name": "Till Oil for Lamps"},
            )[0],
            PoojaOption.objects.get_or_create(
                code="GP2",
                defaults={"name": "2 Pradosha Pooja per month"},
            )[0],
            PoojaOption.objects.get_or_create(
                code="GP3",
                defaults={"name": "4 Saturday Navagraha Pooja per month"},
            )[0],
            PoojaOption.objects.get_or_create(
                code="GP4",
                defaults={"name": "Gau Samrakshana Seva"},
            )[0],
            PoojaOption.objects.get_or_create(
                code="GP6",
                defaults={"name": "Nitya Neivedhyam"},
            )[0],
        ]

    def test_excluded_special_poojas_are_not_mapped_to_ubhayam_report(self):
        for index, option in enumerate(self.excluded_options, start=1):
            PoojaRegistration.objects.create(
                donor=self.donor,
                pooja_option=option,
                day_option=self.day_option,
                start_date=date(2026, 2, min(25 + index, 28)),
            )

        self.assertEqual(UbhayamReport.objects.count(), 0)

    def test_included_pooja_creates_ubhayam_report_row(self):
        PoojaRegistration.objects.create(
            donor=self.donor,
            pooja_option=self.included_option,
            day_option=self.day_option,
            start_date=date(2026, 2, 25),
        )

        rows = list(UbhayamReport.objects.all())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].donor_name, self.donor.name)
        self.assertEqual(rows[0].pooja_day_option, "1st day of English Month")

    def test_row_is_removed_when_only_excluded_registrations_remain(self):
        included = PoojaRegistration.objects.create(
            donor=self.donor,
            pooja_option=self.included_option,
            day_option=self.day_option,
            start_date=date(2026, 2, 25),
        )
        PoojaRegistration.objects.create(
            donor=self.donor,
            pooja_option=self.excluded_options[0],
            day_option=self.day_option,
            start_date=date(2026, 2, 26),
        )

        self.assertEqual(UbhayamReport.objects.count(), 1)

        included.delete()
        self.assertEqual(UbhayamReport.objects.count(), 0)


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class DayOptionOccurrenceViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number="9000000000", name="Test Donor", password="secret")
        self.option = PoojaDayOption.objects.create(code="FE", description="1st day of English Month", category="code")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("pooja.views.get_calendar_service")
    def test_occurrence_endpoint_calls_service(self, mock_service_factory):
        mock_service = Mock()
        mock_service.next_occurrence.return_value = OccurrenceResult(
            date=date(2025, 11, 1),
            description="Saturday, 01 Nov 2025",
            meta={"note": "1st day of English month"},
        )
        mock_service_factory.return_value = mock_service

        url = reverse("pooja-day-options-next-occurrence", kwargs={"pk": self.option.id})
        response = self.client.get(url, {"start_date": "2025-10-16"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["occurrence_date"], "2025-11-01")
        self.assertEqual(payload["day_option_code"], "FE")

        mock_service.next_occurrence.assert_called_once_with("FE", date(2025, 10, 16), tamil_star_labels=None)

    def test_occurrence_endpoint_validates_date(self):
        url = reverse("pooja-day-options-next-occurrence", kwargs={"pk": self.option.id})
        response = self.client.get(url, {"start_date": "16-10-2025"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("start_date", response.data["detail"])

    @patch("pooja.views.get_calendar_service")
    def test_occurrence_endpoint_accepts_tamil_star_label(self, mock_service_factory):
        mock_service = Mock()
        mock_service.next_occurrence.return_value = OccurrenceResult(
            date=date(2025, 11, 3),
            description="Monday, 03 Nov 2025",
            meta={"note": "Tamil star booking"},
        )
        mock_service_factory.return_value = mock_service

        star_option = PoojaDayOption.objects.create(code="CS", description="Choose Your Star", category="code")
        url = reverse("pooja-day-options-next-occurrence", kwargs={"pk": star_option.id})
        response = self.client.get(url, {"tamil_star": "அசுவினி"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["day_option_code"], "CS")
        mock_service.next_occurrence.assert_called_once_with("CS", date(2025, 10, 16), tamil_star_labels=["அசுவினி"])


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class PoojaDayOptionCalendarViewTests(TestCase):
    class DummyCalendarService:
        def _month_end(self, start):
            return date(start.year, start.month, 31)

        def _collect_tithi_dates(self, start, end, targets):
            data = {
                (15,): [date(2025, 1, 25)],
            }
            return data.get(tuple(targets), [])

        def _compress_consecutive_dates(self, occurrences):
            return occurrences

        def _tithi_on(self, day, hour=6, minute=0):
            if day == date(2025, 1, 25) and hour == 12:
                return 15
            return 14

        def _is_tamil_month_start(self, day):
            return day.day == 15

        def _first_weekday_of_month(self, start, *, weekday):
            if weekday == 1:
                return date(start.year, start.month, 7)
            return start

        def _last_weekday_of_month(self, start, *, weekday):
            if weekday == 5:
                return date(start.year, start.month, 25)
            return start

        def _weekday_window(self, window_start, window_end, weekday):
            occurrences = []
            cursor = window_start
            while cursor <= window_end:
                if cursor.weekday() == weekday:
                    occurrences.append(cursor)
                cursor += timedelta(days=1)
            return occurrences

    def setUp(self):
        self.user = User.objects.create_user(
            phone_number="9000000005",
            name="Calendar Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("pooja.views.get_calendar_service")
    def test_calendar_view_maps_day_options(self, mock_service_factory):
        mock_service_factory.return_value = self.DummyCalendarService()
        option_fe, _ = PoojaDayOption.objects.get_or_create(
            code="FE",
            defaults={"description": "1st day of English Month", "category": "code", "display_order": 1},
        )
        option_tu, _ = PoojaDayOption.objects.get_or_create(
            code="1TU",
            defaults={"description": "1st Tuesday of the month", "category": "code", "display_order": 2},
        )
        option_sun, _ = PoojaDayOption.objects.get_or_create(
            code="SUN",
            defaults={"description": "Every Sunday", "category": "code", "display_order": 3},
        )
        option_prm, _ = PoojaDayOption.objects.get_or_create(
            code="PRM",
            defaults={"description": "On Pournami day of month", "category": "code", "display_order": 4},
        )

        response = self.client.get(reverse("pooja-calendar-day-options"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["year"], 2025)
        self.assertEqual(payload["month"], 1)

        mapping = {entry["date"]: entry["day_options"] for entry in payload["dates"]}
        self.assertTrue(any(option["code"] == option_fe.code for option in mapping["2025-01-01"]))
        self.assertTrue(any(option["code"] == option_tu.code for option in mapping["2025-01-07"]))
        sunday_codes = [option["code"] for option in mapping["2025-01-05"]]
        self.assertIn(option_sun.code, sunday_codes)
        self.assertTrue(any(option["code"] == option_prm.code for option in mapping["2025-01-25"]))


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class PoojaDonorCalendarViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            phone_number="9000000010",
            name="Calendar Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.pooja_option = PoojaOption.objects.create(code="CA", name="Calendar Activity")

    def _create_registration(self, donor, tz_datetime, start_date_value=None, day_option=None, pooja_option=None):
        registration = PoojaRegistration.objects.create(
            donor=donor,
            pooja_option=pooja_option or self.pooja_option,
            status=PoojaStatus.PENDING,
            start_date=start_date_value,
            day_option=day_option,
        )
        PoojaRegistration.objects.filter(pk=registration.pk).update(
            start_date=start_date_value,
            created_at=tz_datetime,
            updated_at=tz_datetime,
        )
        registration.refresh_from_db()
        return registration

    def test_donors_grouped_by_registration_date(self):
        donor_one = User.objects.create_user(phone_number="9000000011", name="Donor One", password="secret")
        donor_two = User.objects.create_user(phone_number="9000000012", name="Donor Two", password="secret")
        second_day_donor = User.objects.create_user(phone_number="9000000013", name="Other Donor", password="secret")

        registration_date = timezone.make_aware(datetime(2025, 1, 10, 9, 0))
        self._create_registration(donor_one, registration_date, start_date_value=date(2025, 1, 10))
        self._create_registration(
            donor_two,
            timezone.make_aware(datetime(2025, 1, 10, 12, 0)),
            start_date_value=date(2025, 1, 10),
        )
        self._create_registration(
            second_day_donor,
            timezone.make_aware(datetime(2025, 1, 11, 8, 0)),
            start_date_value=date(2025, 1, 11),
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["year"], 2025)
        self.assertEqual(payload["month"], 1)

        january_tenth = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-10")
        self.assertEqual(len(january_tenth["donors"]), 2)
        self.assertCountEqual(
            [donor["name"] for donor in january_tenth["donors"]],
            ["Donor One", "Donor Two"],
        )
        self.assertCountEqual(
            [donor["phone_number"] for donor in january_tenth["donors"]],
            ["9000000011", "9000000012"],
        )
        self.assertEqual(january_tenth["donor_names"], "Donor One, Donor Two")
        self.assertEqual(january_tenth["donor_phones"], "9000000011, 9000000012")

        january_eleventh = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-11")
        self.assertEqual(len(january_eleventh["donors"]), 1)
        self.assertEqual(january_eleventh["donors"][0]["phone_number"], "9000000013")
        self.assertEqual(january_eleventh["donor_names"], "Other Donor")
        self.assertEqual(january_eleventh["donor_phones"], "9000000013")

    def test_registration_day_option_is_exposed(self):
        donor = User.objects.create_user(
            phone_number="9000000021",
            name="Day Option Donor",
            password="secret",
        )
        day_option = PoojaDayOption.objects.create(
            code="CYD",
            description="Choose Your Date For Pooja",
            category=DayOptionCategory.CODE,
        )
        registration_date = date(2025, 2, 14)
        tz_datetime = timezone.make_aware(datetime(2025, 2, 10, 9, 0))
        self._create_registration(
            donor,
            tz_datetime,
            start_date_value=registration_date,
            day_option=day_option,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "2"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        feb_entry = next(entry for entry in payload["dates"] if entry["date"] == "2025-02-14")
        self.assertTrue(feb_entry["day_options"])
        self.assertTrue(any(option["code"] == day_option.code for option in feb_entry["day_options"]))
        self.assertTrue(any(option["description"] == day_option.description for option in feb_entry["day_options"]))

    def test_any_day_without_date_distributes_donors_across_any_day_rows(self):
        any_day_option = PoojaDayOption.objects.create(
            code="AD",
            description="Any Day of Month",
            category=DayOptionCategory.CODE,
        )
        expected_phones: set[str] = set()
        base_created_at = timezone.make_aware(datetime(2025, 1, 10, 9, 0))

        for index in range(5):
            donor_phone = f"90000003{index + 10}"
            donor = User.objects.create_user(
                phone_number=donor_phone,
                name=f"Any Day Donor {index + 1}",
                password="secret",
            )
            expected_phones.add(donor_phone)
            self._create_registration(
                donor,
                base_created_at + timedelta(minutes=index),
                start_date_value=None,
                day_option=any_day_option,
            )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        date_to_count: dict[str, int] = {}
        observed_phones: set[str] = set()

        for entry in payload["dates"]:
            matching_phones = [
                donor["phone_number"]
                for donor in entry["donors"]
                if donor.get("phone_number") in expected_phones
            ]
            if not matching_phones:
                continue
            observed_phones.update(matching_phones)
            date_to_count[entry["date"]] = len(matching_phones)
            self.assertTrue(any(option.get("code") == "AD" for option in entry["day_options"]))

        self.assertEqual(observed_phones, expected_phones)
        self.assertGreater(len(date_to_count), 1)
        self.assertLessEqual(max(date_to_count.values()) - min(date_to_count.values()), 1)

    def test_cart_snapshot_donors_are_included(self):
        snapshot_donor = User.objects.create_user(
            phone_number="9000000014",
            name="Snapshot Donor",
            password="secret",
        )
        PoojaCartSnapshot.objects.create(
            donor=snapshot_donor,
            items=[
                {
                    "cartId": "snapshot-1",
                    "bookingDate": "2025-01-12",
                    "poojaId": 99,
                    "poojaName": "Snapshot Pooja",
                }
            ],
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        snapshot_entry = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-12")
        self.assertEqual(snapshot_entry["donor_names"], "Snapshot Donor")
        self.assertEqual(snapshot_entry["donor_phones"], "9000000014")

    def test_ubhayam_calendar_excludes_first_day_special_poojas(self):
        excluded_option = PoojaOption.objects.create(code="GP1", name="Till Oil for Lamps")
        included_donor = User.objects.create_user(
            phone_number="9000000016",
            name="Included Donor",
            password="secret",
        )
        excluded_donor = User.objects.create_user(
            phone_number="9000000017",
            name="Excluded Donor",
            password="secret",
        )

        self._create_registration(
            included_donor,
            timezone.make_aware(datetime(2025, 1, 1, 9, 0)),
            start_date_value=date(2025, 1, 1),
            pooja_option=self.pooja_option,
        )
        self._create_registration(
            excluded_donor,
            timezone.make_aware(datetime(2025, 1, 1, 10, 0)),
            start_date_value=date(2025, 1, 1),
            pooja_option=excluded_option,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        january_first = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-01")
        self.assertEqual(january_first["donor_names"], "Included Donor")
        self.assertNotIn("Excluded Donor", january_first["donor_names"])

    def test_ubhayam_calendar_excludes_first_day_special_snapshot_items(self):
        included_snapshot_donor = User.objects.create_user(
            phone_number="9000000018",
            name="Included Snapshot Donor",
            password="secret",
        )
        excluded_snapshot_donor = User.objects.create_user(
            phone_number="9000000019",
            name="Excluded Snapshot Donor",
            password="secret",
        )
        PoojaCartSnapshot.objects.create(
            donor=included_snapshot_donor,
            items=[
                {
                    "cartId": "snapshot-included",
                    "bookingDate": "2025-01-01",
                    "poojaCode": "CA",
                    "poojaName": "Calendar Activity",
                }
            ],
        )
        PoojaCartSnapshot.objects.create(
            donor=excluded_snapshot_donor,
            items=[
                {
                    "cartId": "snapshot-excluded",
                    "bookingDate": "2025-01-01",
                    "poojaCode": "GP6",
                    "poojaName": "Nitya Neivedhyam",
                }
            ],
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        january_first = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-01")
        self.assertIn("Included Snapshot Donor", january_first["donor_names"])
        self.assertNotIn("Excluded Snapshot Donor", january_first["donor_names"])

    def test_ubhayam_calendar_excludes_first_day_special_recurring_plans(self):
        day_option = PoojaDayOption.objects.create(
            code="REG",
            description="Regular Day",
            category=DayOptionCategory.CODE,
        )
        excluded_option = PoojaOption.objects.create(code="GP4", name="Gau Samrakshana Seva")
        included_donor = User.objects.create_user(
            phone_number="9000000022",
            name="Included Plan Donor",
            password="secret",
        )
        excluded_donor = User.objects.create_user(
            phone_number="9000000023",
            name="Excluded Plan Donor",
            password="secret",
        )

        RecurringPoojaPlan.objects.create(
            donor=included_donor,
            pooja_option=self.pooja_option,
            day_option=day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2025, 1, 1),
            next_occurrence=date(2025, 1, 1),
            amount=Decimal("100.00"),
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=excluded_donor,
            pooja_option=excluded_option,
            day_option=day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2025, 1, 1),
            next_occurrence=date(2025, 1, 1),
            amount=Decimal("100.00"),
            is_active=True,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        january_first = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-01")
        self.assertIn("Included Plan Donor", january_first["donor_names"])
        self.assertNotIn("Excluded Plan Donor", january_first["donor_names"])

    def test_cart_snapshot_day_option_is_exposed(self):
        snapshot_donor = User.objects.create_user(
            phone_number="9000000015",
            name="Snapshot Option Donor",
            password="secret",
        )
        day_option = PoojaDayOption.objects.create(
            code="CYD",
            description="Choose Your Date For Pooja",
            category=DayOptionCategory.CODE,
        )
        PoojaCartSnapshot.objects.create(
            donor=snapshot_donor,
            items=[
                {
                    "cartId": "snapshot-2",
                    "bookingDate": "2025-01-13",
                    "poojaId": 101,
                    "poojaName": "Snapshot Pooja",
                    "dayOptionId": day_option.id,
                    "dayOptionCode": day_option.code,
                    "dayOptionDescription": day_option.description,
                    "dayOptionCategory": day_option.category,
                }
            ],
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        entry = next(item for item in payload["dates"] if item["date"] == "2025-01-13")
        self.assertTrue(entry["day_options"])
        self.assertTrue(any(option["description"] == day_option.description for option in entry["day_options"]))

    @patch("pooja.views.get_calendar_service")
    def test_multi_occurrence_day_option_shows_all_dates(self, mock_service_factory):
        class DummyService:
            def _collect_tithi_dates(self, start, end, targets):
                if tuple(targets) == (8, 23):
                    return [date(2026, 1, 10), date(2026, 1, 25)]
                return []

            def _compress_consecutive_dates(self, occurrences):
                return occurrences

            def _tithi_on(self, day, hour=6, minute=0):
                if hour == 9 and day in (date(2026, 1, 10), date(2026, 1, 25)):
                    return 23
                return 22

        mock_service_factory.return_value = DummyService()
        donor = User.objects.create_user(
            phone_number="9000000020",
            name="Multi Occurrence Donor",
            password="secret",
        )
        day_option, _ = PoojaDayOption.objects.get_or_create(
            code="AST",
            defaults={
                "description": "Second Ashtami",
                "category": "code",
            },
        )
        registration_date = date(2026, 1, 10)
        tz_datetime = timezone.make_aware(datetime(2026, 1, 6, 9, 0))
        self._create_registration(
            donor,
            tz_datetime,
            start_date_value=registration_date,
            day_option=day_option,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2026", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        tenth_entry = next(entry for entry in payload["dates"] if entry["date"] == "2026-01-10")
        self.assertEqual(tenth_entry["donor_names"], "Multi Occurrence Donor")
        self.assertEqual(tenth_entry["donor_phones"], "9000000020")
        twentyfifth_entry = next(entry for entry in payload["dates"] if entry["date"] == "2026-01-25")
        self.assertEqual(twentyfifth_entry["donor_names"], "Multi Occurrence Donor")
        self.assertEqual(twentyfifth_entry["donor_phones"], "9000000020")

    @patch("pooja.views.get_calendar_service")
    def test_canonical_recurring_plan_ignores_stale_payload_occurrences(self, mock_service_factory):
        class DummyService:
            def _tithi_on(self, day, hour=6, minute=0):
                if day == date(2026, 2, 14) and hour == 18:
                    return 28
                return 29

        mock_service_factory.return_value = DummyService()
        donor = User.objects.create_user(
            phone_number="9000000024",
            name="Canonical Plan Donor",
            password="secret",
        )
        day_option, _ = PoojaDayOption.objects.get_or_create(
            code="PRD",
            defaults={
                "description": "Pradosham (Trayodashi)",
                "category": "code",
            },
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            day_option=day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 2, 14),
            next_occurrence=date(2026, 2, 15),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "dayOptionOccurrences": [
                    {"date": "2026-02-14", "label": "Saturday, 14 Feb 2026"},
                    {"date": "2026-02-28", "label": "Saturday, 28 Feb 2026"},
                ]
            },
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2026", "month": "2"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        feb_14 = next(entry for entry in payload["dates"] if entry["date"] == "2026-02-14")
        feb_28 = next(entry for entry in payload["dates"] if entry["date"] == "2026-02-28")

        self.assertIn("Canonical Plan Donor", feb_14["donor_names"])
        self.assertNotIn("Canonical Plan Donor", feb_28["donor_names"])
        self.assertTrue(any(option.get("code") == "PRD" for option in feb_14["day_options"]))
        self.assertFalse(any(option.get("code") == "PRD" for option in feb_28["day_options"]))


class CalendarCodeAliasTests(SimpleTestCase):
    def test_alias_codes_map_to_canonical_values(self):
        canonicalize = TempleCalendarService._canonicalize_code
        cases = {
            "SH": "sashti",
            "AST": "second_ashtami",
            "P": "pournami",
            "SC": "sankata_chaturthi",
            "C": "chaturthi",
            "S": "weekly_sunday",
        }
        for alias, expected in cases.items():
            self.assertEqual(canonicalize(alias), expected)


class AnyDayOccurrenceTests(SimpleTestCase):
    def test_any_day_occurrence_is_two_days_after_start(self):
        service = TempleCalendarService.__new__(TempleCalendarService)
        result = TempleCalendarService.next_occurrence(service, "AD", date(2025, 1, 27))
        self.assertEqual(result.date, date(2025, 1, 29))
        self.assertEqual(result.meta.get("note"), "Scheduled two days after donor's requested day.")

    def test_any_day_handles_month_rollover(self):
        service = TempleCalendarService.__new__(TempleCalendarService)
        result = TempleCalendarService.next_occurrence(service, "AD", date(2025, 1, 30))
        self.assertEqual(result.date, date(2025, 2, 1))


class WeeklySundayOccurrenceTests(SimpleTestCase):
    def test_weekly_sunday_lists_remaining_month(self):
        service = TempleCalendarService.__new__(TempleCalendarService)
        result = TempleCalendarService.next_occurrence(service, "S", date(2025, 11, 14))
        self.assertEqual(result.date, date(2025, 11, 16))
        self.assertEqual(
            [entry["date"] for entry in result.meta["upcoming_occurrences"]],
            ["2025-11-16", "2025-11-23", "2025-11-30"],
        )

    def test_weekly_sunday_rolls_to_next_month_when_needed(self):
        service = TempleCalendarService.__new__(TempleCalendarService)
        result = TempleCalendarService.next_occurrence(service, "S", date(2025, 11, 30))
        self.assertEqual(result.date, date(2025, 12, 7))
        self.assertEqual(
            [entry["date"] for entry in result.meta["upcoming_occurrences"]],
            ["2025-12-07", "2025-12-14", "2025-12-21", "2025-12-28"],
        )


class TithiSearchBehaviourTests(SimpleTestCase):
    @patch.object(TempleCalendarService, "_tithi_on")
    def test_next_tithi_detects_late_day_occurrence(self, mock_tithi_on):
        service = TempleCalendarService.__new__(TempleCalendarService)

        def fake_tithi(day, hour=6, minute=0):
            if day == date(2025, 11, 8):
                if hour > 18 or (hour == 18 and minute >= 0):
                    return 19
            if day == date(2025, 12, 8):
                return 19
            return 18

        mock_tithi_on.side_effect = fake_tithi

        result = TempleCalendarService._next_tithi(service, date(2025, 10, 17), (19,))
        self.assertEqual(result, date(2025, 11, 8))

    @patch.object(TempleCalendarService, "_tithi_on")
    def test_next_tithi_prefers_later_day_for_adjacent_day_span(self, mock_tithi_on):
        service = TempleCalendarService.__new__(TempleCalendarService)

        def fake_tithi(day, hour=6, minute=0):
            if day == date(2026, 2, 16):
                return 30 if hour == 18 else 29
            if day == date(2026, 2, 17):
                return 30 if hour in (6, 9, 12) else 29
            return 29

        mock_tithi_on.side_effect = fake_tithi

        result = TempleCalendarService._next_tithi(service, date(2026, 2, 1), (30,))
        self.assertEqual(result, date(2026, 2, 17))

    def test_compress_consecutive_dates_keeps_later_day(self):
        dates = [
            date(2026, 2, 16),
            date(2026, 2, 17),
            date(2026, 2, 20),
            date(2026, 2, 21),
        ]
        result = TempleCalendarService._compress_consecutive_dates(dates)
        self.assertEqual(result, [date(2026, 2, 17), date(2026, 2, 21)])


class NakshatraAssignmentTests(SimpleTestCase):
    @patch.object(TempleCalendarService, "_sunrise_time_on")
    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_nakshatra_on_uses_sunrise_time(self, mock_nakshatra_index_at, mock_sunrise_time):
        service = TempleCalendarService.__new__(TempleCalendarService)
        target_day = date(2026, 3, 1)
        mock_sunrise_time.return_value = (7, 33)
        mock_nakshatra_index_at.return_value = 7

        result = TempleCalendarService._nakshatra_on(service, target_day)

        self.assertEqual(result, 7)
        mock_sunrise_time.assert_called_once_with(target_day)
        mock_nakshatra_index_at.assert_called_once_with(target_day, hour=7, minute=33)

    @patch.object(TempleCalendarService, "_moon_sidereal_longitude")
    def test_nakshatra_index_applies_alignment_offset(self, mock_moon_sidereal_longitude):
        service = TempleCalendarService.__new__(TempleCalendarService)
        service._NAKSHATRA_ALIGNMENT_OFFSET_DEGREES = 0.43
        # Without offset this remains in Kettai (index 17); with offset it moves to Moolam (index 18).
        mock_moon_sidereal_longitude.return_value = 239.69

        result = TempleCalendarService._nakshatra_index_at(service, date(2026, 4, 8), hour=6, minute=0)

        self.assertEqual(result, 18)
        mock_moon_sidereal_longitude.assert_called_once_with(date(2026, 4, 8), hour=6, minute=0)


class PradoshamOccurrenceTests(SimpleTestCase):
    @patch.object(TempleCalendarService, "_upcoming_tithi_series_at_reference_time")
    def test_pradosham_branch_returns_upcoming_dates(self, mock_helper):
        service = TempleCalendarService.__new__(TempleCalendarService)
        mock_helper.return_value = [date(2025, 1, 2), date(2025, 1, 17)]

        result = TempleCalendarService.next_occurrence(service, "PRD", date(2024, 12, 31))

        self.assertEqual(result.date, date(2025, 1, 2))
        self.assertEqual(result.meta.get("note"), "Pradosham (Trayodashi) schedule")
        self.assertEqual(
            result.meta.get("upcoming_occurrences"),
            [
                {"date": "2025-01-02", "label": "Thursday, 02 Jan 2025"},
                {"date": "2025-01-17", "label": "Friday, 17 Jan 2025"},
            ],
        )


class CanonicalReferenceTimeTests(SimpleTestCase):
    @patch.object(TempleCalendarService, "_upcoming_tithi_series_at_reference_time")
    def test_ashtami_uses_morning_reference_time(self, mock_helper):
        service = TempleCalendarService.__new__(TempleCalendarService)
        mock_helper.return_value = [date(2026, 3, 11), date(2026, 3, 26)]

        result = TempleCalendarService.next_occurrence(service, "AST", date(2026, 3, 1))

        self.assertEqual(result.date, date(2026, 3, 11))
        mock_helper.assert_called_once_with(date(2026, 3, 1), targets=(8, 23), hour=9, count=2)

    @patch.object(TempleCalendarService, "_next_tithi_at_reference_time")
    def test_sankata_chaturthi_uses_evening_reference_time(self, mock_next):
        service = TempleCalendarService.__new__(TempleCalendarService)
        mock_next.return_value = date(2026, 3, 6)

        result = TempleCalendarService.next_occurrence(service, "SC", date(2026, 3, 1))

        self.assertEqual(result.date, date(2026, 3, 6))
        mock_next.assert_called_once_with(date(2026, 3, 1), targets=(19,), hour=21)


class PradoshamHelperTests(SimpleTestCase):
    def test_helper_skips_duplicate_days(self):
        service = TempleCalendarService.__new__(TempleCalendarService)
        sequence = iter([date(2025, 1, 15), date(2025, 1, 16), date(2025, 2, 1)])

        def fake_next_tithi(self, start, targets):
            try:
                return next(sequence)
            except StopIteration:
                self.fail("Unexpected extra call to _next_tithi")

        with patch.object(TempleCalendarService, "_next_tithi", fake_next_tithi):
            occurrences = TempleCalendarService._upcoming_pradosham_occurrences(service, date(2025, 1, 10))

        self.assertEqual(occurrences, [date(2025, 1, 16), date(2025, 2, 1)])


class RecurringPoojaPlanPauseTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number="9000000001", name="Pause Donor", password="secret")
        DonorProfile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.pooja_option = PoojaOption.objects.create(code="RP1", name="Recurring Pooja")
        self.day_option = PoojaDayOption.objects.create(
            code="RDAY",
            description="Recurring day",
            category=DayOptionCategory.CODE,
        )

    def _create_plan(self) -> RecurringPoojaPlan:
        plan = RecurringPoojaPlan.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=timezone.localdate(),
            next_occurrence=timezone.localdate() + timedelta(days=3),
            amount=Decimal("250.00"),
            is_active=True,
        )
        return plan

    def _create_due_registration(self, plan: RecurringPoojaPlan) -> PoojaRegistration:
        registration = PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=plan.next_occurrence,
            total_amount=plan.amount,
        )
        plan.origin_registration = registration
        plan.save(update_fields=["origin_registration"])
        return registration

    def _pause_plan(self, plan: RecurringPoojaPlan, reason: str):
        pause_from = timezone.localdate()
        pause_until = pause_from + timedelta(days=30)
        url = reverse("pooja-recurrence-plans-pause", kwargs={"pk": plan.id})
        return self.client.post(
            url,
            {
                "pause_from": pause_from.isoformat(),
                "pause_until": pause_until.isoformat(),
                "pause_reason": reason,
                "pause_months": 1,
            },
            format="json",
        )

    def test_pause_use_for_temple_credits_monthly_donation_when_paid(self):
        plan = self._create_plan()
        registration = self._create_due_registration(plan)
        PaymentRecord.objects.create(
            donor=self.user,
            registration=registration,
            amount=Decimal("300.00"),
            mode=PaymentMode.UPI,
            status=PaymentStatus.SUCCESS,
        )

        response = self._pause_plan(plan, PAUSE_REASON_USE_FOR_TEMPLE)

        self.assertEqual(response.status_code, 200)
        profile = DonorProfile.objects.get(user=self.user)
        self.assertEqual(profile.monthly_donation_amount, Decimal("300.00"))

    def test_pause_use_for_temple_does_not_credit_monthly_donation_when_unpaid(self):
        plan = self._create_plan()
        self._create_due_registration(plan)

        response = self._pause_plan(plan, PAUSE_REASON_USE_FOR_TEMPLE)

        self.assertEqual(response.status_code, 200)
        profile = DonorProfile.objects.get(user=self.user)
        self.assertEqual(profile.monthly_donation_amount, Decimal("0.00"))


class RecurringPoojaPlanDueInfoTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number="9000000002", name="Due Donor", password="secret")
        DonorProfile.objects.create(user=self.user)
        self.pooja_option = PoojaOption.objects.create(code="RP2", name="Recurring Pooja Due")
        self.day_option = PoojaDayOption.objects.create(
            code="RDAY2",
            description="Recurring day",
            category=DayOptionCategory.CODE,
        )

    def test_due_registration_summary_includes_amounts_and_status(self):
        plan = RecurringPoojaPlan.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=timezone.localdate(),
            next_occurrence=timezone.localdate() + timedelta(days=5),
            amount=Decimal("250.00"),
            is_active=True,
        )
        registration = PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=plan.next_occurrence,
            total_amount=Decimal("250.00"),
        )
        PaymentRecord.objects.create(
            donor=self.user,
            registration=registration,
            amount=Decimal("150.00"),
            mode=PaymentMode.UPI,
            status=PaymentStatus.SUCCESS,
        )

        serialized = RecurringPoojaPlanSerializer(plan)
        due_data = serialized.data.get("due_registration")
        self.assertIsNotNone(due_data)
        self.assertEqual(due_data["id"], registration.id)
        self.assertEqual(due_data["paid_amount"], "150.00")
        self.assertEqual(due_data["due_amount"], "100.00")
        self.assertFalse(due_data["is_paid"])


class CreateRegistrationFromPlanTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone_number="9000000026",
            name="Recurring Plan User",
            password="secret",
        )
        DonorProfile.objects.create(user=self.user)
        self.pooja_option = PoojaOption.objects.create(code="RPC", name="Recurring Clips")
        self.day_option = PoojaDayOption.objects.create(
            code="RPCD",
            description="Recurring Plan Day",
            category=DayOptionCategory.CODE,
        )

    def _build_plan(self) -> RecurringPoojaPlan:
        next_occurrence = timezone.localdate() + timedelta(days=7)
        return RecurringPoojaPlan.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=timezone.localdate(),
            next_occurrence=next_occurrence,
            amount=Decimal("200.00"),
            is_active=True,
        )

    def test_idempotent_for_same_due_date(self):
        plan = self._build_plan()
        due_date = plan.next_occurrence
        first_registration = create_registration_from_plan(plan, due_date=due_date)
        second_registration = create_registration_from_plan(plan, due_date=due_date)

        self.assertEqual(first_registration.id, second_registration.id)
        registrations = PoojaRegistration.objects.filter(donor=self.user)
        self.assertEqual(registrations.count(), 1)


class PoojaCartSnapshotReportViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            phone_number="9000000016",
            name="Export Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.restricted_admin = User.objects.create_user(
            phone_number="+91 9999999997",
            name="Restricted Export Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )

    def _create_snapshot(self, donor, items):
        return PoojaCartSnapshot.objects.create(donor=donor, items=items)

    def test_export_creates_batch_and_returns_snapshots(self):
        donor = User.objects.create_user(phone_number="9000000025", name="Snapshot Donor", password="secret")
        items = [{"cartId": "snapshot-1"}]
        self._create_snapshot(donor, items)

        url = reverse("pooja-cart-snapshots-report")
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["donor_id"], donor.id)
        self.assertEqual(payload[0]["items"], items)

        batch = PoojaCartSnapshotExportBatch.objects.first()
        self.assertIsNotNone(batch)
        self.assertEqual(batch.entries.count(), 1)

    def test_batch_id_reuses_saved_export(self):
        donor = User.objects.create_user(phone_number="9000000030", name="Batch Donor", password="secret")
        snapshot = self._create_snapshot(donor, [{"cartId": "initial"}])

        first_response = self.client.get(reverse("pooja-cart-snapshots-report"))
        self.assertEqual(first_response.status_code, 200)
        batch = PoojaCartSnapshotExportBatch.objects.first()
        self.assertIsNotNone(batch)
        original_items = first_response.json()[0]["items"]

        snapshot.items = [{"cartId": "updated"}]
        snapshot.save()

        batch_url = f"{reverse('pooja-cart-snapshots-report')}?batch_id={batch.id}"
        second_response = self.client.get(batch_url)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(second_response.json()[0]["items"], original_items)
        self.assertEqual(PoojaCartSnapshotExportBatch.objects.count(), 1)

    def test_restricted_admin_cannot_download_snapshot_report(self):
        donor = User.objects.create_user(phone_number="9000000032", name="Snapshot Donor", password="secret")
        self._create_snapshot(donor, [{"cartId": "restricted"}])

        self.client.force_authenticate(user=self.restricted_admin)
        response = self.client.get(reverse("pooja-cart-snapshots-report"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["detail"], REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE)


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class CHRTPoojaDueFutureMonthTests(TestCase):
    """Test for bug: CHRT Poojas with future preferred dates should not generate dues in current month."""
    
    def setUp(self):
        """Set up test environment with recurring and CHRT poojas."""
        self.donor = User.objects.create_user(phone_number="9000000031", name="CHRT Donor", password="secret")
        DonorProfile.objects.create(user=self.donor)
        
        # Create recurring pooja option
        self.recurring_pooja = PoojaOption.objects.create(code="RPOOJA", name="Recurring Pooja")
        # Create CHRT day option
        self.chrt_day_option = PoojaDayOption.objects.create(
            code="CHRT",
            description="Choose Your Preferred Date",
            category=DayOptionCategory.CODE,
        )
        # Create regular day option for recurring poojas
        self.regular_day_option = PoojaDayOption.objects.create(
            code="REGULAR",
            description="Regular Day",
            category=DayOptionCategory.CODE,
        )

    def test_chrt_pooja_future_month_should_not_appear_in_current_month_due(self):
        """
        Scenario:
        - Donor registers 4 recurring poojas in January 2026 (₹400 total)
        - Donor registers 1 CHRT pooja with preferred date Feb 6, 2026 (₹500)
        
        Expected:
        - January 2026 payment statement should show: ₹400 due (only recurring)
        - February 2026 payment statement should show: ₹900 due (₹400 recurring + ₹500 CHRT)
        """
        # Set the current date to January 31, 2026
        current_date = date(2026, 1, 31)
        
        # Create 4 recurring poojas for the donor (monthly, ₹100 each)
        for i in range(4):
            RecurringPoojaPlan.objects.create(
                donor=self.donor,
                pooja_option=self.recurring_pooja,
                day_option=self.regular_day_option,
                recurrence_kind=RecurrenceKind.RECURRING,
                recurrence_frequency=RecurrenceFrequency.MONTHLY,
                start_date=date(2026, 1, 1),
                next_occurrence=date(2026, 1, 15),
                amount=Decimal("100.00"),
                is_active=True,
            )
        
        # Create CHRT pooja with preferred date in February (future month)
        chrt_plan = RecurringPoojaPlan.objects.create(
            donor=self.donor,
            pooja_option=self.recurring_pooja,
            day_option=self.chrt_day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.ANNUALLY,
            start_date=date(2026, 2, 6),  # Future date in February
            one_time_date=date(2026, 2, 6),  # CHRT poojas set this
            next_occurrence=date(2026, 2, 6),
            amount=Decimal("500.00"),
            is_active=True,
        )
        
        # Simulate running process_recurring_plans for January 31, 2026
        from .services.recurrence import process_recurring_plans
        result = process_recurring_plans(today=current_date)
        
        # Check January payment records (current month)
        january_payments = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 1, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,  # Due payments (not linked to registrations)
        )
        
        # January should only have ₹400 due (recurring poojas), NOT ₹900
        self.assertEqual(january_payments.count(), 1, "Should have exactly 1 payment record for January")
        january_due = january_payments.first()
        self.assertEqual(
            january_due.amount,
            Decimal("400.00"),
            f"January due should be ₹400 (recurring only), but got ₹{january_due.amount}"
        )
        
        # Check February payment records
        february_payments = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 2, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,
        )
        
        # February should have both recurring (₹400) and CHRT (₹500) = ₹900
        # This should be split into 2 records or combined depending on implementation
        february_total = sum(p.amount for p in february_payments)
        self.assertEqual(
            february_total,
            Decimal("900.00"),
            f"February due should be ₹900 (₹400 recurring + ₹500 CHRT), but got ₹{february_total}"
        )


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class RecurringMonthlyDueBackfillTests(TestCase):
    """Ensure monthly recurring dues generate from registration month through current month."""

    def setUp(self):
        self.donor = User.objects.create_user(phone_number="9000000040", name="Monthly Donor", password="secret")
        DonorProfile.objects.get_or_create(user=self.donor)
        self.pooja_option = PoojaOption.objects.create(code="RPOOJA", name="Recurring Pooja")
        self.day_option = PoojaDayOption.objects.create(
            code="REGULAR",
            description="Regular Day",
            category=DayOptionCategory.CODE,
        )

    def test_backfills_monthly_dues_up_to_current_month(self):
        """
        If a donor registers on Jan 1, 2026 and today is Feb 3, 2026,
        the system should show dues for Jan 2026 and Feb 2026.
        """
        current_date = date(2026, 2, 3)

        RecurringPoojaPlan.objects.create(
            donor=self.donor,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 1, 1),
            amount=Decimal("200.00"),
            is_active=True,
        )

        process_recurring_plans(today=current_date)

        january_due = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 1, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,
        )
        february_due = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 2, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,
        )

        self.assertEqual(january_due.count(), 1, "January due should be generated")
        self.assertEqual(february_due.count(), 1, "February due should be generated")

        # Passbook should display both dues (plus opening balance)
        with patch("payments.services.timezone.localdate", return_value=current_date):
            regenerate_donor_passbook(self.donor.id)

        entries = list(self.donor.passbook_entries.order_by("entry_date"))
        self.assertEqual(len(entries), 3)
        self.assertEqual([e.entry_date for e in entries], [date(2025, 12, 31), date(2026, 1, 1), date(2026, 2, 1)])
        self.assertEqual(entries[1].due_amount, Decimal("200.00"))
        self.assertEqual(entries[2].due_amount, Decimal("200.00"))
        self.assertEqual(entries[-1].closing_due, Decimal("400.00"))

    def test_future_start_date_does_not_create_due_in_registration_created_month(self):
        """
        If a recurring plan starts in a future month, dues must start from the plan's
        start month, even when the originating registration was created earlier.
        """
        february_run_date = date(2026, 2, 20)
        march_start = date(2026, 3, 1)

        origin_registration = PoojaRegistration.objects.create(
            donor=self.donor,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=march_start,
            total_amount=Decimal("200.00"),
        )
        PoojaRegistration.objects.filter(pk=origin_registration.pk).update(
            created_at=timezone.make_aware(datetime(2026, 2, 2, 10, 30)),
        )

        RecurringPoojaPlan.objects.create(
            donor=self.donor,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=march_start,
            next_occurrence=march_start,
            amount=Decimal("200.00"),
            is_active=True,
            origin_registration=origin_registration,
        )

        process_recurring_plans(today=february_run_date)

        february_due = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 2, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,
        )
        self.assertFalse(february_due.exists(), "February due must not be created before March start_date.")

        process_recurring_plans(today=date(2026, 3, 20))

        march_due = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 3, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,
        )
        self.assertEqual(march_due.count(), 1, "March due should be created once start month is reached.")

    def test_plan_starting_end_of_previous_month_is_anchored_to_registration_month(self):
        """
        If the computed start_date falls in the previous month but the registration date
        is in the current month, due generation must start from registration month.
        """
        february_run_date = date(2026, 2, 21)
        registration_date = timezone.make_aware(datetime(2026, 3, 1, 0, 0))

        origin_registration = PoojaRegistration.objects.create(
            donor=self.donor,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=date(2026, 2, 28),
            total_amount=Decimal("100.00"),
        )
        PoojaRegistration.objects.filter(pk=origin_registration.pk).update(created_at=registration_date)

        RecurringPoojaPlan.objects.create(
            donor=self.donor,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 2, 28),
            next_occurrence=date(2026, 3, 28),
            amount=Decimal("100.00"),
            is_active=True,
            origin_registration=origin_registration,
        )

        process_recurring_plans(today=february_run_date)

        february_due = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 2, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,
        )
        self.assertFalse(february_due.exists(), "February due must not exist before registration month.")

        process_recurring_plans(today=date(2026, 3, 21))

        march_due = PaymentRecord.objects.filter(
            donor=self.donor,
            payment_month=date(2026, 3, 1),
            status=PaymentStatus.PENDING,
            registration__isnull=True,
        )
        self.assertEqual(march_due.count(), 1, "March due should be created once registration month begins.")
