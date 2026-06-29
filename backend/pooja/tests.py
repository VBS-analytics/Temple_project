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
    UbhayamAllocationRow,
    UbhayamAllocationRun,
    UbhayamDateOverride,
    UbhayamReport,
)
from .serializers import RecurringPoojaPlanSerializer
from .services.calendar import OccurrenceResult, TempleCalendarService
from .services.recurrence import create_registration_from_plan, process_recurring_plans
from .views import (
    PAUSE_REASON_NO_POJA_NO_PAYMENT,
    PAUSE_REASON_USE_FOR_TEMPLE,
    _collect_dates_for_canonical,
)


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

    def test_post_prasadam_report_returns_unique_donor_with_latest_pooja_date(self):
        donor = User.objects.create_user(phone_number="9000000105", name="Duplicate Donor", password="secret")

        PoojaRegistration.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            start_date=date(2026, 2, 17),
            post_prasadam=True,
        )
        PoojaRegistration.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            start_date=date(2026, 3, 5),
            post_prasadam=True,
        )

        response = self.client.get(reverse("pooja-registrations-post-prasadam-report"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(len(payload["results"]), 1)
        self.assertEqual(payload["results"][0]["donor_id"], donor.id)
        self.assertEqual(payload["results"][0]["name"], donor.name)
        self.assertEqual(payload["results"][0]["phone_number"], donor.phone_number)
        self.assertEqual(payload["results"][0]["pooja_date"], "2026-03-05")

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
        self.special_header, _ = PoojaOption.objects.get_or_create(
            code="SPECIAL",
            defaults={"name": "Special Pooja", "is_group_header": True},
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
            PoojaOption.objects.get_or_create(
                code="SP1",
                defaults={"name": "Sivan Koil Kumbabishekam", "parent": self.special_header},
            )[0],
            PoojaOption.objects.get_or_create(
                code="SP2",
                defaults={"name": "Aarudhra Darsanam Pooja", "parent": self.special_header},
            )[0],
            PoojaOption.objects.get_or_create(
                code="SP3",
                defaults={"name": "Gen Donation", "parent": self.special_header},
            )[0],
            PoojaOption.objects.get_or_create(
                code="mahashiv-boh2",
                defaults={"name": "Mahashivrathri", "parent": self.special_header},
            )[0],
            PoojaOption.objects.get_or_create(
                code="navarath-0fg1",
                defaults={"name": "Navarathri for 1 day pooja", "parent": self.special_header},
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
class UbhayamInputAllocationBehaviorTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            phone_number="9000099991",
            name="Ubhayam Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.any_day_option, _ = PoojaDayOption.objects.get_or_create(
            code="AD",
            defaults={
                "description": "Any day of the month",
                "category": DayOptionCategory.CODE,
                "display_order": 1,
            },
        )
        self.english_first_option, _ = PoojaDayOption.objects.get_or_create(
            code="FE",
            defaults={
                "description": "1st day of English Month",
                "category": DayOptionCategory.CODE,
                "display_order": 2,
            },
        )
        self.second_ashtami_option, _ = PoojaDayOption.objects.get_or_create(
            code="AST",
            defaults={
                "description": "On 2 ashtami day of month",
                "category": DayOptionCategory.CODE,
                "display_order": 3,
            },
        )
        self.allocate_url = reverse("pooja-ubhayam-input-allocate")

    def _month_dates(self, year: int, month: int) -> list[date]:
        first_day = date(year, month, 1)
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        last_day = next_month - timedelta(days=1)
        result = []
        cursor = first_day
        while cursor <= last_day:
            result.append(cursor)
            cursor += timedelta(days=1)
        return result

    def _seed_full_month_overrides(self, year: int, month: int, option_id: int):
        for month_day in self._month_dates(year, month):
            UbhayamDateOverride.objects.create(
                date=month_day,
                tamil_stars=["அசுவினி"],
                pooja_day_option_ids=[option_id],
                updated_by=self.admin,
            )

    def _collect_allocated_donor_counts(self, month: str) -> dict[str, int]:
        latest_run = (
            UbhayamAllocationRun.objects.filter(month=month, is_latest=True)
            .order_by("-run_number")
            .first()
        )
        self.assertIsNotNone(latest_run)
        counts: dict[str, int] = {}
        rows = UbhayamAllocationRow.objects.filter(run=latest_run).order_by("date")
        for row in rows:
            donor_ids = [entry.strip() for entry in (row.donor_id or "").split(",") if entry.strip()]
            for donor_id in donor_ids:
                counts[donor_id] = counts.get(donor_id, 0) + 1
        return counts

    def test_allocate_rejects_when_month_input_is_missing_dates(self):
        UbhayamDateOverride.objects.create(
            date=date(2026, 6, 1),
            tamil_stars=["அசுவினி"],
            pooja_day_option_ids=[self.any_day_option.id],
            updated_by=self.admin,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-06"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot allocate until all dates in the month are filled", response.data["detail"])

    def test_allocate_rejects_when_any_day_is_missing_star_or_day_option(self):
        self._seed_full_month_overrides(2026, 6, self.any_day_option.id)
        incomplete = UbhayamDateOverride.objects.get(date=date(2026, 6, 15))
        incomplete.tamil_stars = []
        incomplete.save(update_fields=["tamil_stars", "updated_at"])

        response = self.client.post(self.allocate_url, {"month": "2026-06"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("both Tamil star and Pooja day option", response.data["detail"])

    def test_allocate_distributes_any_day_donors_without_repeating_same_donor_across_month(self):
        self._seed_full_month_overrides(2026, 6, self.any_day_option.id)
        for index in range(1, 5):
            UbhayamReport.objects.create(
                donor_id=f"D{index}",
                donor_name=f"Donor {index}",
                donor_phone_number=f"90000001{index:02d}",
                pooja_day_option=self.any_day_option.description,
            )

        response = self.client.post(self.allocate_url, {"month": "2026-06"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        counts = self._collect_allocated_donor_counts("2026-06")
        self.assertEqual(counts, {"D1": 1, "D2": 1, "D3": 1, "D4": 1})

    def test_allocate_distributes_non_any_day_option_donors_too(self):
        self._seed_full_month_overrides(2026, 6, self.english_first_option.id)
        for donor_id in ("D11", "D12", "D13"):
            UbhayamReport.objects.create(
                donor_id=donor_id,
                donor_name=f"Donor {donor_id}",
                donor_phone_number="9000009999",
                pooja_day_option=self.english_first_option.description,
            )

        response = self.client.post(self.allocate_url, {"month": "2026-06"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        counts = self._collect_allocated_donor_counts("2026-06")
        self.assertEqual(counts, {"D11": 1, "D12": 1, "D13": 1})

    def test_allocate_repeats_second_ashtami_donor_across_both_month_occurrences_only(self):
        self._seed_full_month_overrides(2026, 6, self.english_first_option.id)
        for ashtami_date in (date(2026, 6, 8), date(2026, 6, 22)):
            override = UbhayamDateOverride.objects.get(date=ashtami_date)
            override.pooja_day_option_ids = [self.second_ashtami_option.id]
            override.save(update_fields=["pooja_day_option_ids", "updated_at"])

        UbhayamReport.objects.create(
            donor_id="D21",
            donor_name="Ashtami Donor",
            donor_phone_number="9000000021",
            pooja_day_option=self.second_ashtami_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-06"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        counts = self._collect_allocated_donor_counts("2026-06")
        self.assertEqual(counts, {"D21": 2})
        latest_run = UbhayamAllocationRun.objects.get(month="2026-06", is_latest=True)
        allocated_rows = list(
            UbhayamAllocationRow.objects.filter(
                run=latest_run,
                pooja_day_option=self.second_ashtami_option.description,
            )
            .order_by("date")
            .values_list("date", "donor_id")
        )
        self.assertEqual(
            allocated_rows,
            [
                (date(2026, 6, 8), "D21"),
                (date(2026, 6, 22), "D21"),
            ],
        )

    def test_allocate_excludes_no_payment_paused_recurring_donor_for_month(self):
        self._seed_full_month_overrides(2026, 6, self.english_first_option.id)
        paused_donor = User.objects.create_user(
            phone_number="9000000044",
            name="Paused Ubhayam Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=paused_donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-T1",
            name="Paused Test Pooja",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=paused_donor,
            pooja_option=pooja_option,
            day_option=self.english_first_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 6, 1),
            amount=Decimal("100.00"),
            is_active=False,
            pause_from=date(2026, 2, 1),
            pause_until=date(2027, 2, 28),
            metadata={"pause_reason": PAUSE_REASON_NO_POJA_NO_PAYMENT},
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=paused_donor.name,
            donor_phone_number=paused_donor.phone_number,
            pooja_day_option=self.english_first_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-06"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-06", is_latest=True)
        first_day_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 6, 1))
        self.assertEqual(first_day_row.donor_id, "")

    def test_allocate_matches_choose_your_star_donor_to_saved_star_date(self):
        self._seed_full_month_overrides(2026, 7, self.english_first_option.id)
        choose_star_option, _ = PoojaDayOption.objects.get_or_create(
            code="CS",
            defaults={
                "description": "Choose Your Star",
                "category": DayOptionCategory.CODE,
                "display_order": 4,
            },
        )

        for target_date, star_name in (
            (date(2026, 7, 5), "சதயம்"),
            (date(2026, 7, 7), "உத்திரட்டாதி"),
        ):
            override = UbhayamDateOverride.objects.get(date=target_date)
            override.tamil_stars = [star_name]
            override.pooja_day_option_ids = [choose_star_option.id]
            override.save(update_fields=["tamil_stars", "pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000045",
            name="Tamil Star Ubhayam Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-CS-1",
            name="Choose Star Test Pooja",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=choose_star_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 7, 7),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "selectedTamilStarLabel": "உத்திரட்டாதி — STR26",
                "selectedTamilStarId": "STR26",
            },
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=choose_star_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        july_5_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 5))
        july_7_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 7))
        self.assertEqual(july_5_row.donor_id, "")
        self.assertEqual(july_7_row.donor_id, donor_identifier)

    def test_allocate_maps_english_first_day_plan_to_computed_date(self):
        self._seed_full_month_overrides(2026, 7, self.any_day_option.id)
        july_first = UbhayamDateOverride.objects.get(date=date(2026, 7, 1))
        july_first.pooja_day_option_ids = [self.english_first_option.id]
        july_first.save(update_fields=["pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000046",
            name="English First Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-FE-1",
            name="English First Test Pooja",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=self.english_first_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 7, 1),
            amount=Decimal("100.00"),
            is_active=True,
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=self.english_first_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        july_1_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 1))
        self.assertEqual(july_1_row.donor_id, donor_identifier)

    def test_allocate_maps_chrt_plan_to_preferred_date(self):
        self._seed_full_month_overrides(2026, 7, self.any_day_option.id)
        chrt_option, _ = PoojaDayOption.objects.get_or_create(
            code="CHRT",
            defaults={
                "description": "Choose your preferred date",
                "category": DayOptionCategory.CODE,
                "display_order": 5,
            },
        )
        preferred_date = date(2026, 7, 17)
        preferred_override = UbhayamDateOverride.objects.get(date=preferred_date)
        preferred_override.pooja_day_option_ids = [chrt_option.id]
        preferred_override.save(update_fields=["pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000047",
            name="CHRT Allocator Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-CHRT-1",
            name="CHRT Test Pooja",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=chrt_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            one_time_date=preferred_date,
            next_occurrence=date(2026, 7, 28),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "dayOptionCode": "CHRT",
                "dayOptionDescription": "Choose your preferred date",
                "recurrenceOneTimeDate": preferred_date.isoformat(),
            },
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=chrt_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        preferred_row = UbhayamAllocationRow.objects.get(run=latest_run, date=preferred_date)
        self.assertEqual(preferred_row.donor_id, donor_identifier)

    def test_allocate_maps_choose_star_plan_to_previous_day_when_override_row_contains_second_star(self):
        self._seed_full_month_overrides(2026, 7, self.english_first_option.id)
        choose_star_option, _ = PoojaDayOption.objects.get_or_create(
            code="CS",
            defaults={
                "description": "Choose Your Star",
                "category": DayOptionCategory.CODE,
                "display_order": 4,
            },
        )

        july_12 = UbhayamDateOverride.objects.get(date=date(2026, 7, 12))
        july_12.tamil_stars = ["ரோகிணி", "மிருகசீரிடம்"]
        july_12.pooja_day_option_ids = [choose_star_option.id]
        july_12.save(update_fields=["tamil_stars", "pooja_day_option_ids", "updated_at"])

        july_13 = UbhayamDateOverride.objects.get(date=date(2026, 7, 13))
        july_13.tamil_stars = ["திருவாதிரை"]
        july_13.pooja_day_option_ids = [choose_star_option.id]
        july_13.save(update_fields=["tamil_stars", "pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000050",
            name="Mirugaseeridam Boundary Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-CS-3",
            name="Choose Star Boundary Test Pooja",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=choose_star_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 7, 13),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "selectedTamilStarLabel": "மிருகசீரிடம் — STR5",
                "selectedTamilStarId": "STR5",
            },
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=choose_star_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        july_12_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 12))
        july_13_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 13))
        self.assertIn(donor_identifier, july_12_row.donor_id)
        self.assertNotIn(donor_identifier, july_13_row.donor_id)

    def test_allocate_maps_choose_star_plan_to_previous_day_for_kettai_boundary_row(self):
        self._seed_full_month_overrides(2026, 7, self.english_first_option.id)
        choose_star_option, _ = PoojaDayOption.objects.get_or_create(
            code="CS",
            defaults={
                "description": "Choose Your Star",
                "category": DayOptionCategory.CODE,
                "display_order": 4,
            },
        )

        july_25 = UbhayamDateOverride.objects.get(date=date(2026, 7, 25))
        july_25.tamil_stars = ["கேட்டை", "அனுஷம்"]
        july_25.pooja_day_option_ids = [choose_star_option.id]
        july_25.save(update_fields=["tamil_stars", "pooja_day_option_ids", "updated_at"])

        july_26 = UbhayamDateOverride.objects.get(date=date(2026, 7, 26))
        july_26.tamil_stars = ["கேட்டை"]
        july_26.pooja_day_option_ids = [self.any_day_option.id]
        july_26.save(update_fields=["tamil_stars", "pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000051",
            name="Kettai Boundary Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-CS-4",
            name="Choose Star Kettai Boundary Test Pooja",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=choose_star_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 7, 26),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "selectedTamilStarLabel": "கேட்டை — STR18",
                "selectedTamilStarId": "STR18",
            },
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=choose_star_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        july_25_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 25))
        july_26_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 26))
        self.assertIn(donor_identifier, july_25_row.donor_id)
        self.assertNotIn(donor_identifier, july_26_row.donor_id)

    def test_allocate_maps_choose_star_plan_to_only_matching_override_row_in_month(self):
        self._seed_full_month_overrides(2026, 7, self.english_first_option.id)
        choose_star_option, _ = PoojaDayOption.objects.get_or_create(
            code="CS",
            defaults={
                "description": "Choose Your Star",
                "category": DayOptionCategory.CODE,
                "display_order": 4,
            },
        )

        july_13 = UbhayamDateOverride.objects.get(date=date(2026, 7, 13))
        july_13.tamil_stars = ["திருவாதிரை"]
        july_13.pooja_day_option_ids = [choose_star_option.id]
        july_13.save(update_fields=["tamil_stars", "pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000052",
            name="Thiruvathirai Month Match Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-CS-5",
            name="Choose Star Thiruvathirai Test Pooja",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=choose_star_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 3, 27),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "selectedTamilStarLabel": "திருவாதிரை — STR6",
                "selectedTamilStarId": "STR6",
            },
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=choose_star_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        july_13_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 13))
        self.assertIn(donor_identifier, july_13_row.donor_id)

    def test_allocate_does_not_use_legacy_choose_star_rows_without_plan_specific_metadata(self):
        self._seed_full_month_overrides(2026, 7, self.english_first_option.id)
        choose_star_option, _ = PoojaDayOption.objects.get_or_create(
            code="CS",
            defaults={
                "description": "Choose Your Star",
                "category": DayOptionCategory.CODE,
                "display_order": 4,
            },
        )

        for target_date, star_name in (
            (date(2026, 7, 5), "சதயம்"),
            (date(2026, 7, 7), "உத்திரட்டாதி"),
        ):
            override = UbhayamDateOverride.objects.get(date=target_date)
            override.tamil_stars = [star_name]
            override.pooja_day_option_ids = [choose_star_option.id]
            override.save(update_fields=["tamil_stars", "pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000048",
            name="Plan Based Choose Star Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-CS-2",
            name="Choose Star Test Pooja 2",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=choose_star_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 7, 7),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "selectedTamilStarLabel": "உத்திரட்டாதி — STR26",
                "selectedTamilStarId": "STR26",
            },
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=choose_star_option.description,
        )
        UbhayamReport.objects.create(
            donor_id="D999",
            donor_name="Legacy Star Row Donor",
            donor_phone_number="9000099999",
            pooja_day_option=choose_star_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        july_5_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 5))
        july_7_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 7))
        self.assertEqual(july_5_row.donor_id, "")
        self.assertEqual(july_7_row.donor_id, donor_identifier)
        self.assertFalse(
            UbhayamAllocationRow.objects.filter(run=latest_run, donor_id__icontains="D999").exists()
        )

    def test_allocate_does_not_use_legacy_choose_date_rows_without_plan_specific_date(self):
        self._seed_full_month_overrides(2026, 7, self.any_day_option.id)
        chrt_option, _ = PoojaDayOption.objects.get_or_create(
            code="CHRT",
            defaults={
                "description": "Choose your preferred date",
                "category": DayOptionCategory.CODE,
                "display_order": 5,
            },
        )
        preferred_date = date(2026, 7, 26)
        preferred_override = UbhayamDateOverride.objects.get(date=preferred_date)
        preferred_override.pooja_day_option_ids = [chrt_option.id]
        preferred_override.save(update_fields=["pooja_day_option_ids", "updated_at"])

        donor = User.objects.create_user(
            phone_number="9000000049",
            name="Plan Based CHRT Donor",
            password="secret",
        )
        donor_identifier = DonorProfile.objects.get(user=donor).donor_id
        pooja_option = PoojaOption.objects.create(
            code="UBH-CHRT-2",
            name="CHRT Test Pooja 2",
            is_active=True,
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=pooja_option,
            day_option=chrt_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            one_time_date=preferred_date,
            next_occurrence=date(2026, 7, 28),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "dayOptionCode": "CHRT",
                "dayOptionDescription": "Choose your preferred date",
                "recurrenceOneTimeDate": preferred_date.isoformat(),
            },
        )
        UbhayamReport.objects.create(
            donor_id=donor_identifier,
            donor_name=donor.name,
            donor_phone_number=donor.phone_number,
            pooja_day_option=chrt_option.description,
        )
        UbhayamReport.objects.create(
            donor_id="D998",
            donor_name="Legacy CHRT Row Donor",
            donor_phone_number="9000099998",
            pooja_day_option=chrt_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        preferred_row = UbhayamAllocationRow.objects.get(run=latest_run, date=preferred_date)
        self.assertEqual(preferred_row.donor_id, donor_identifier)
        self.assertFalse(
            UbhayamAllocationRow.objects.filter(run=latest_run, donor_id__icontains="D998").exists()
        )

    def test_allocate_any_day_balances_against_existing_day_load(self):
        self._seed_full_month_overrides(2026, 7, self.any_day_option.id)
        chrt_option, _ = PoojaDayOption.objects.get_or_create(
            code="CHRT",
            defaults={
                "description": "Choose your preferred date",
                "category": DayOptionCategory.CODE,
                "display_order": 5,
            },
        )
        july_first_override = UbhayamDateOverride.objects.get(date=date(2026, 7, 1))
        july_first_override.pooja_day_option_ids = [self.any_day_option.id, chrt_option.id]
        july_first_override.save(update_fields=["pooja_day_option_ids", "updated_at"])

        for index in range(2):
            donor = User.objects.create_user(
                phone_number=f"900000005{index}",
                name=f"Heavy Day Donor {index + 1}",
                password="secret",
            )
            pooja_option = PoojaOption.objects.create(
                code=f"UBH-LOAD-{index}",
                name=f"Load Test Pooja {index + 1}",
                is_active=True,
            )
            RecurringPoojaPlan.objects.create(
                donor=donor,
                pooja_option=pooja_option,
                day_option=chrt_option,
                recurrence_kind=RecurrenceKind.RECURRING,
                recurrence_frequency=RecurrenceFrequency.MONTHLY,
                start_date=date(2026, 1, 1),
                one_time_date=date(2026, 7, 1),
                next_occurrence=date(2026, 7, 1),
                amount=Decimal("100.00"),
                is_active=True,
                cart_payload={
                    "dayOptionCode": "CHRT",
                    "dayOptionDescription": "Choose your preferred date",
                    "recurrenceOneTimeDate": "2026-07-01",
                },
            )
            UbhayamReport.objects.create(
                donor_id=DonorProfile.objects.get(user=donor).donor_id,
                donor_name=donor.name,
                donor_phone_number=donor.phone_number,
                pooja_day_option=chrt_option.description,
            )

        UbhayamReport.objects.create(
            donor_id="D700",
            donor_name="Any Day Balanced Donor",
            donor_phone_number="9000000700",
            pooja_day_option=self.any_day_option.description,
        )

        response = self.client.post(self.allocate_url, {"month": "2026-07"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        latest_run = UbhayamAllocationRun.objects.get(month="2026-07", is_latest=True)
        july_1_row = UbhayamAllocationRow.objects.get(run=latest_run, date=date(2026, 7, 1))
        self.assertNotIn("D700", july_1_row.donor_id)
        self.assertTrue(
            UbhayamAllocationRow.objects.filter(run=latest_run, donor_id__icontains="D700").exclude(date=date(2026, 7, 1)).exists()
        )


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class UbhayamAllocationLatestViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            phone_number="9000099991",
            name="Ubhayam Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.donor = User.objects.create_user(
            phone_number="9000099992",
            name="Ubhayam Donor",
            password="secret",
            role=UserRole.DONOR,
        )
        self.other_donor = User.objects.create_user(
            phone_number="9000099993",
            name="Other Ubhayam Donor",
            password="secret",
            role=UserRole.DONOR,
        )
        self.latest_url = reverse("pooja-ubhayam-allocation-latest")
        self.donor_identifier = DonorProfile.objects.get(user=self.donor).donor_id
        self.other_donor_identifier = DonorProfile.objects.get(user=self.other_donor).donor_id

    def _create_run_with_rows(
        self,
        *,
        month: str,
        run_number: int,
        is_latest: bool,
        rows: list[dict[str, str]],
    ) -> UbhayamAllocationRun:
        run = UbhayamAllocationRun.objects.create(
            month=month,
            run_number=run_number,
            is_latest=is_latest,
            status=UbhayamAllocationStatus.COMPLETED,
            generated_by=self.admin,
            row_count=len(rows),
        )
        for row in rows:
            UbhayamAllocationRow.objects.create(
                run=run,
                date=row["date"],
                day_of_month=row["day_of_month"],
                tamil_star=row.get("tamil_star", ""),
                pooja_day_option=row.get("pooja_day_option", ""),
                donor_id=row.get("donor_id", ""),
                donor_name=row.get("donor_name", ""),
                donor_mobile_number=row.get("donor_mobile_number", ""),
            )
        return run

    def test_admin_receives_full_latest_allocation_rows(self):
        self._create_run_with_rows(
            month="2026-07",
            run_number=1,
            is_latest=True,
            rows=[
                {
                    "date": date(2026, 7, 1),
                    "day_of_month": "Wednesday",
                    "tamil_star": "பூராடம்",
                    "pooja_day_option": "Any day of the month",
                    "donor_id": f"{self.donor_identifier}, {self.other_donor_identifier}",
                    "donor_name": "First Donor, Second Donor",
                    "donor_mobile_number": "1111111111, 2222222222",
                },
            ],
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.latest_url, {"month": "2026-07"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["rows"]), 1)
        self.assertEqual(
            response.data["rows"][0]["donor_id"],
            f"{self.donor_identifier}, {self.other_donor_identifier}",
        )
        self.assertEqual(response.data["latest_run"]["run_number"], 1)

    def test_donor_receives_only_matching_rows_from_latest_run_with_trimmed_columns(self):
        self._create_run_with_rows(
            month="2026-07",
            run_number=1,
            is_latest=False,
            rows=[
                {
                    "date": date(2026, 7, 1),
                    "day_of_month": "Wednesday",
                    "tamil_star": "OLD",
                    "pooja_day_option": "Any day of the month",
                    "donor_id": self.other_donor_identifier,
                    "donor_name": "Old Donor",
                    "donor_mobile_number": "9999999999",
                },
            ],
        )
        self._create_run_with_rows(
            month="2026-07",
            run_number=2,
            is_latest=True,
            rows=[
                {
                    "date": date(2026, 7, 1),
                    "day_of_month": "Wednesday",
                    "tamil_star": "பூராடம்",
                    "pooja_day_option": "Any day of the month",
                    "donor_id": f"{self.donor_identifier}, {self.other_donor_identifier}",
                    "donor_name": "First Donor, Second Donor",
                    "donor_mobile_number": "1111111111, 2222222222",
                },
                {
                    "date": date(2026, 7, 2),
                    "day_of_month": "Thursday",
                    "tamil_star": "உத்திராடாதி",
                    "pooja_day_option": "On sashti day of month",
                    "donor_id": self.other_donor_identifier,
                    "donor_name": "Other Donor",
                    "donor_mobile_number": "3333333333",
                },
            ],
        )

        self.client.force_authenticate(user=self.donor)
        response = self.client.get(self.latest_url, {"month": "2026-07"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["latest_run"]["run_number"], 2)
        self.assertEqual(response.data["month"], "2026-07")
        self.assertEqual(response.data["rows"], [
            {
                "date": "2026-07-01",
                "day_of_month": "Wednesday",
                "tamil_star": "பூராடம்",
                "pooja_day_option": "Any day of the month",
                "donor_id": self.donor_identifier,
                "donor_name": "First Donor",
                "donor_mobile_number": "1111111111",
            }
        ])


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

    @patch("pooja.views.get_calendar_service")
    def test_calendar_view_allows_authenticated_donor(self, mock_service_factory):
        mock_service_factory.return_value = self.DummyCalendarService()
        donor = User.objects.create_user(
            phone_number="9000000006",
            name="Calendar Donor",
            password="secret",
        )
        donor_client = APIClient()
        donor_client.force_authenticate(user=donor)

        response = donor_client.get(reverse("pooja-calendar-day-options"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["year"], 2025)
        self.assertEqual(payload["month"], 1)


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
        self.assertTrue(all((donor.get("donor_id") or "").startswith("D") for donor in january_tenth["donors"]))
        self.assertEqual(january_tenth["donor_names"], "Donor One, Donor Two")
        self.assertEqual(january_tenth["donor_phones"], "9000000011, 9000000012")
        self.assertTrue((january_tenth["donor_ids"] or "").startswith("D"))

        january_eleventh = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-11")
        self.assertEqual(len(january_eleventh["donors"]), 1)
        self.assertEqual(january_eleventh["donors"][0]["phone_number"], "9000000013")
        self.assertEqual(january_eleventh["donor_names"], "Other Donor")
        self.assertEqual(january_eleventh["donor_phones"], "9000000013")

    def test_donor_scope_returns_only_authenticated_donor_rows(self):
        donor_self = User.objects.create_user(
            phone_number="9000000014",
            name="Self Donor",
            password="secret",
        )
        donor_other = User.objects.create_user(
            phone_number="9000000015",
            name="Other Donor",
            password="secret",
        )
        self._create_registration(
            donor_self,
            timezone.make_aware(datetime(2025, 1, 10, 9, 0)),
            start_date_value=date(2025, 1, 10),
        )
        self._create_registration(
            donor_other,
            timezone.make_aware(datetime(2025, 1, 10, 12, 0)),
            start_date_value=date(2025, 1, 10),
        )
        donor_client = APIClient()
        donor_client.force_authenticate(user=donor_self)

        response = donor_client.get(
            reverse("pooja-calendar-donor-registrations"),
            {"year": "2025", "month": "1", "refresh": "1"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        january_tenth = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-10")

        donor_names = [donor["name"] for donor in january_tenth["donors"]]
        self.assertIn("Self Donor", donor_names)
        self.assertNotIn("Other Donor", donor_names)

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

    def test_any_day_without_date_is_allocated_to_dated_rows(self):
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

        observed_phones: set[str] = set()
        for entry in payload["dates"]:
            for donor in entry["donors"]:
                phone = donor.get("phone_number")
                if phone in expected_phones:
                    observed_phones.add(phone)

        self.assertEqual(observed_phones, expected_phones)

    def test_any_day_with_explicit_start_date_uses_stage_allocation(self):
        any_day_option = PoojaDayOption.objects.create(
            code="AD",
            description="Any Day of Month",
            category=DayOptionCategory.CODE,
        )
        donor = User.objects.create_user(
            phone_number="9000000026",
            name="Any Day Explicit Date Donor",
            password="secret",
        )
        self._create_registration(
            donor,
            timezone.make_aware(datetime(2025, 1, 3, 9, 0)),
            start_date_value=date(2025, 1, 15),
            day_option=any_day_option,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        assigned_dates: list[str] = []
        for entry in payload["dates"]:
            for donor_entry in entry["donors"]:
                phone = donor_entry.get("phone_number")
                if phone == donor.phone_number:
                    assigned_dates.append(entry["date"])

        self.assertEqual(len(assigned_dates), 1)
        self.assertEqual(assigned_dates[0], "2025-01-01")

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
        special_header, _ = PoojaOption.objects.get_or_create(
            code="SPECIAL",
            defaults={"name": "Special Pooja", "is_group_header": True},
        )
        excluded_option, _ = PoojaOption.objects.get_or_create(
            code="mahashiv-boh2",
            defaults={"name": "Mahashivrathri", "parent": special_header},
        )
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
        special_header, _ = PoojaOption.objects.get_or_create(
            code="SPECIAL",
            defaults={"name": "Special Pooja", "is_group_header": True},
        )
        excluded_option, _ = PoojaOption.objects.get_or_create(
            code="navarath-0fg1",
            defaults={"name": "Navarathri for 1 day pooja", "parent": special_header},
        )
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
                    "poojaCode": excluded_option.code,
                    "poojaName": excluded_option.name,
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
        special_header, _ = PoojaOption.objects.get_or_create(
            code="SPECIAL",
            defaults={"name": "Special Pooja", "is_group_header": True},
        )
        excluded_option, _ = PoojaOption.objects.get_or_create(
            code="SP2",
            defaults={"name": "Aarudhra Darsanam Pooja", "parent": special_header},
        )
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

    @patch("pooja.views.get_calendar_service")
    def test_tamil_star_recurring_plan_uses_selected_star_instead_of_stale_payload_occurrences(
        self,
        mock_service_factory,
    ):
        class DummyService:
            def nakshatra_index_on(self, day):
                if day == date(2026, 3, 2):
                    return 8  # ஆயில்யம்
                if day == date(2026, 3, 7):
                    return 4  # மிருகசீரிடம்
                return 0

        mock_service_factory.return_value = DummyService()
        donor = User.objects.create_user(
            phone_number="9000000027",
            name="Tamil Star Plan Donor",
            password="secret",
        )
        day_option, _ = PoojaDayOption.objects.get_or_create(
            code="CS",
            defaults={
                "description": "Choose Your Star",
                "category": "code",
            },
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            day_option=day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 3, 2),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "selectedTamilStarLabel": "மிருகசீரிடம் — STR5",
                "selectedTamilStarId": "STR5",
                "dayOptionOccurrences": [
                    {"date": "2026-03-02", "label": "Monday, 02 Mar 2026"},
                ],
            },
            metadata={
                "members": [
                    {"name": "Self", "tamil_star": "ஆயில்யம்"},
                    {"name": "Selected Member", "tamil_star": "மிருகசீரிடம்"},
                ]
            },
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2026", "month": "3"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        march_2 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-02")
        march_7 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-07")

        self.assertNotIn("Tamil Star Plan Donor", march_2["donor_names"])
        self.assertIn("Tamil Star Plan Donor", march_7["donor_names"])
        self.assertTrue(any(option.get("code") == "CS" for option in march_7["day_options"]))

    @patch("pooja.views.get_calendar_service")
    def test_tamil_star_recurring_plan_uses_only_first_star_occurrence_in_month(
        self,
        mock_service_factory,
    ):
        class DummyService:
            def nakshatra_index_on(self, day):
                if day in (date(2026, 3, 4), date(2026, 3, 31)):
                    return 10  # பூரம்
                return 0

        mock_service_factory.return_value = DummyService()
        donor = User.objects.create_user(
            phone_number="9000000028",
            name="Repeated Star Donor",
            password="secret",
        )
        day_option, _ = PoojaDayOption.objects.get_or_create(
            code="CS",
            defaults={
                "description": "Choose Your Star",
                "category": "code",
            },
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            day_option=day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 3, 4),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "selectedTamilStarLabel": "பூரம் — STR11",
                "selectedTamilStarId": "STR11",
            },
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2026", "month": "3"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        march_4 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-04")
        march_31 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-31")

        self.assertIn("Repeated Star Donor", march_4["donor_names"])
        self.assertNotIn("Repeated Star Donor", march_31["donor_names"])
        self.assertTrue(any(option.get("code") == "CS" for option in march_4["day_options"]))
        self.assertFalse(any(option.get("code") == "CS" for option in march_31["day_options"]))

    def test_chrt_recurring_plan_uses_preferred_date_only(self):
        donor = User.objects.create_user(
            phone_number="9000000029",
            name="CHRT Preferred Donor",
            password="secret",
        )
        chrt_option, _ = PoojaDayOption.objects.get_or_create(
            code="CHRT",
            defaults={
                "description": "Choose your preferred date",
                "category": "code",
            },
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            day_option=chrt_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            one_time_date=date(2026, 3, 2),
            next_occurrence=date(2026, 3, 28),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "recurrenceOneTimeDate": "2026-03-02",
                "dayOptionOccurrences": [
                    {"date": "2026-03-15", "label": "Sunday, 15 Mar 2026"},
                    {"date": "2026-03-21", "label": "Saturday, 21 Mar 2026"},
                ],
            },
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2026", "month": "3"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        march_2 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-02")
        march_15 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-15")
        march_21 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-21")
        march_28 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-28")

        self.assertIn("CHRT Preferred Donor", march_2["donor_names"])
        self.assertNotIn("CHRT Preferred Donor", march_15["donor_names"])
        self.assertNotIn("CHRT Preferred Donor", march_21["donor_names"])
        self.assertNotIn("CHRT Preferred Donor", march_28["donor_names"])
        self.assertTrue(any(option.get("code") == "CHRT" for option in march_2["day_options"]))

    def test_legacy_chrt_like_recurring_plan_uses_one_time_date(self):
        donor = User.objects.create_user(
            phone_number="9000000030",
            name="Legacy CHRT Donor",
            password="secret",
        )
        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            day_option=None,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
            one_time_date=date(2026, 3, 5),
            next_occurrence=date(2026, 3, 25),
            amount=Decimal("100.00"),
            is_active=True,
            cart_payload={
                "dayOptionCode": "CHRT",
                "dayOptionDescription": "Choose your preferred date",
                "recurrenceOneTimeDate": "2026-03-05",
                "dayOptionOccurrences": [
                    {"date": "2026-03-20", "label": "Friday, 20 Mar 2026"},
                ],
            },
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2026", "month": "3"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        march_5 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-05")
        march_20 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-20")
        march_25 = next(entry for entry in payload["dates"] if entry["date"] == "2026-03-25")

        self.assertIn("Legacy CHRT Donor", march_5["donor_names"])
        self.assertNotIn("Legacy CHRT Donor", march_20["donor_names"])
        self.assertNotIn("Legacy CHRT Donor", march_25["donor_names"])

    def test_any_day_recurring_plan_with_next_occurrence_is_stage_allocated(self):
        any_day_option = PoojaDayOption.objects.create(
            code="AD",
            description="Any Day of Month",
            category=DayOptionCategory.CODE,
        )
        donor = User.objects.create_user(
            phone_number="9000000025",
            name="Unassigned Recurring Donor",
            password="secret",
        )

        RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
            day_option=any_day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=date(2026, 1, 21),
            next_occurrence=date(2026, 3, 1),
            amount=Decimal("100.00"),
            is_active=True,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2026", "month": "3"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        assigned_dates: list[str] = []
        for entry in payload["dates"]:
            for donor_entry in entry["donors"]:
                phone = donor_entry.get("phone_number")
                if phone == donor.phone_number:
                    assigned_dates.append(entry["date"])

        self.assertEqual(len(assigned_dates), 1)
        self.assertEqual(assigned_dates[0], "2026-03-01")

    def test_any_day_allocator_moves_to_stage_two_when_no_blank_days(self):
        regular_day_option = PoojaDayOption.objects.create(
            code="REG",
            description="Regular Day",
            category=DayOptionCategory.CODE,
        )
        any_day_option = PoojaDayOption.objects.create(
            code="AD",
            description="Any Day of Month",
            category=DayOptionCategory.CODE,
        )

        for day in range(1, 32):
            donor = User.objects.create_user(
                phone_number=f"90000006{day:02d}",
                name=f"Seed Donor {day}",
                password="secret",
            )
            self._create_registration(
                donor,
                timezone.make_aware(datetime(2025, 1, day, 8, 0)),
                start_date_value=date(2025, 1, day),
                day_option=regular_day_option,
            )

        any_day_donor = User.objects.create_user(
            phone_number="9000000700",
            name="Any Day Stage 2 Donor",
            password="secret",
        )
        self._create_registration(
            any_day_donor,
            timezone.make_aware(datetime(2025, 1, 1, 18, 0)),
            start_date_value=None,
            day_option=any_day_option,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        jan_first = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-01")
        self.assertIn("Any Day Stage 2 Donor", jan_first["donor_names"])

    def test_any_day_allocator_moves_to_stage_three_when_day_counts_are_two(self):
        regular_day_option = PoojaDayOption.objects.create(
            code="REG2",
            description="Regular Day 2",
            category=DayOptionCategory.CODE,
        )
        any_day_option = PoojaDayOption.objects.create(
            code="AD",
            description="Any Day of Month",
            category=DayOptionCategory.CODE,
        )

        for day in range(1, 32):
            for donor_index in range(2):
                donor = User.objects.create_user(
                    phone_number=f"90000008{day:02d}{donor_index}",
                    name=f"Seed Two Donor {day}-{donor_index}",
                    password="secret",
                )
                self._create_registration(
                    donor,
                    timezone.make_aware(datetime(2025, 1, day, 9 + donor_index, 0)),
                    start_date_value=date(2025, 1, day),
                    day_option=regular_day_option,
                )

        any_day_donor = User.objects.create_user(
            phone_number="9000000900",
            name="Any Day Stage 3 Donor",
            password="secret",
        )
        self._create_registration(
            any_day_donor,
            timezone.make_aware(datetime(2025, 1, 2, 18, 0)),
            start_date_value=None,
            day_option=any_day_option,
        )

        response = self.client.get(reverse("pooja-calendar-donor-registrations"), {"year": "2025", "month": "1"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        jan_first = next(entry for entry in payload["dates"] if entry["date"] == "2025-01-01")
        self.assertIn("Any Day Stage 3 Donor", jan_first["donor_names"])


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
    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_nakshatra_on_uses_fixed_9am_reference(self, mock_nakshatra_index_at):
        service = TempleCalendarService.__new__(TempleCalendarService)
        target_day = date(2026, 3, 1)
        mock_nakshatra_index_at.return_value = 7

        result = TempleCalendarService._nakshatra_on(service, target_day)

        self.assertEqual(result, 7)
        mock_nakshatra_index_at.assert_called_once_with(target_day, hour=9, minute=0)

    @patch.object(TempleCalendarService, "_moon_sidereal_longitude")
    def test_nakshatra_index_applies_alignment_offset(self, mock_moon_sidereal_longitude):
        service = TempleCalendarService.__new__(TempleCalendarService)
        service._NAKSHATRA_ALIGNMENT_OFFSET_DEGREES = 0.43
        # Without offset this remains in Kettai (index 17); with offset it moves to Moolam (index 18).
        mock_moon_sidereal_longitude.return_value = 239.69

        result = TempleCalendarService._nakshatra_index_at(service, date(2026, 4, 8), hour=6, minute=0)

        self.assertEqual(result, 18)
        mock_moon_sidereal_longitude.assert_called_once_with(date(2026, 4, 8), hour=6, minute=0)

    @patch.object(TempleCalendarService, "_sunrise_time_on")
    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_nakshatra_date_overrides_apply_for_may_2026_hotfix(self, mock_nakshatra_index_at, mock_sunrise_time):
        service = TempleCalendarService.__new__(TempleCalendarService)
        mock_sunrise_time.return_value = (6, 0)
        mock_nakshatra_index_at.return_value = 0

        expected = {
            date(2026, 5, 21): 6,
            date(2026, 5, 22): 7,
            date(2026, 5, 23): 8,
            date(2026, 5, 24): 9,
            date(2026, 5, 25): 10,
            date(2026, 5, 26): 11,
            date(2026, 5, 27): 12,
        }
        for day, index in expected.items():
            self.assertEqual(TempleCalendarService._nakshatra_on(service, day), index)

        # Override dates should not call runtime astronomical calculation.
        mock_sunrise_time.assert_not_called()
        mock_nakshatra_index_at.assert_not_called()

    @patch.object(TempleCalendarService, "_sunrise_time_on")
    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_nakshatra_date_overrides_apply_for_oct_nov_2026_hotfix(self, mock_nakshatra_index_at, mock_sunrise_time):
        service = TempleCalendarService.__new__(TempleCalendarService)
        mock_sunrise_time.return_value = (6, 0)
        mock_nakshatra_index_at.return_value = 0

        expected = {
            date(2026, 10, 1): 2,
            date(2026, 10, 2): 3,
            date(2026, 11, 1): 6,
            date(2026, 11, 2): 7,
            date(2026, 11, 3): 8,
            date(2026, 11, 4): 9,
            date(2026, 11, 5): 10,
            date(2026, 11, 7): 12,
            date(2026, 11, 8): 13,
            date(2026, 11, 20): 25,
            date(2026, 11, 21): 26,
        }
        for day, index in expected.items():
            self.assertEqual(TempleCalendarService._nakshatra_on(service, day), index)

        # Override dates should not call runtime astronomical calculation.
        mock_sunrise_time.assert_not_called()
        mock_nakshatra_index_at.assert_not_called()

    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_june_2026_dates_use_runtime_astronomical_calculation(self, mock_nakshatra_index_at):
        service = TempleCalendarService.__new__(TempleCalendarService)
        target_day = date(2026, 6, 6)

        def fake_index(_day, *, hour, minute):
            return 21 if (hour, minute) < (9, 0) else 22

        mock_nakshatra_index_at.side_effect = fake_index

        result = TempleCalendarService._nakshatra_on(service, target_day)

        self.assertEqual(result, 22)

    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_june_2026_date_after_morning_transition_uses_new_star(self, mock_nakshatra_index_at):
        service = TempleCalendarService.__new__(TempleCalendarService)
        target_day = date(2026, 6, 7)

        def fake_index(_day, *, hour, minute):
            return 22 if (hour, minute) < (9, 0) else 23

        mock_nakshatra_index_at.side_effect = fake_index

        result = TempleCalendarService._nakshatra_on(service, target_day)

        self.assertEqual(result, 23)

    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_june_15_2026_resolves_to_mrigashirsha_at_9am(self, mock_nakshatra_index_at):
        service = TempleCalendarService.__new__(TempleCalendarService)
        target_day = date(2026, 6, 15)

        def fake_index(_day, *, hour, minute):
            return 4 if (hour, minute) == (9, 0) else 5

        mock_nakshatra_index_at.side_effect = fake_index

        result = TempleCalendarService._nakshatra_on(service, target_day)

        self.assertEqual(result, 4)

    @patch.object(TempleCalendarService, "_sunrise_time_on")
    @patch.object(TempleCalendarService, "_nakshatra_index_at")
    def test_june_1_and_2_2026_use_explicit_alignment_overrides(self, mock_nakshatra_index_at, mock_sunrise_time):
        service = TempleCalendarService.__new__(TempleCalendarService)
        mock_sunrise_time.return_value = (6, 0)
        mock_nakshatra_index_at.return_value = 0

        self.assertEqual(TempleCalendarService._nakshatra_on(service, date(2026, 6, 1)), 17)
        self.assertEqual(TempleCalendarService._nakshatra_on(service, date(2026, 6, 2)), 18)
        mock_sunrise_time.assert_not_called()
        mock_nakshatra_index_at.assert_not_called()


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

    def test_ubhayam_chaturthi_uses_morning_reference_time(self):
        service = Mock()

        def fake_tithi_on(target_date, *, hour, minute=0):
            if target_date == date(2026, 5, 20) and hour == 9 and minute == 0:
                return 4
            return 5

        service._tithi_on = Mock(side_effect=fake_tithi_on)

        occurrences = _collect_dates_for_canonical(
            service,
            "chaturthi",
            date(2026, 5, 1),
            date(2026, 5, 31),
        )

        self.assertEqual(occurrences, [date(2026, 5, 20)])

    def test_ubhayam_second_ashtami_prefers_first_day_of_two_day_span(self):
        service = Mock()
        service._collect_tithi_dates.return_value = [
            date(2026, 5, 9),
            date(2026, 5, 10),
            date(2026, 5, 23),
        ]

        occurrences = _collect_dates_for_canonical(
            service,
            "second_ashtami",
            date(2026, 5, 1),
            date(2026, 5, 31),
        )

        self.assertEqual(occurrences, [date(2026, 5, 9), date(2026, 5, 23)])

    def test_ubhayam_sankata_chaturthi_uses_dec_2026_override_date(self):
        service = Mock()
        occurrences = _collect_dates_for_canonical(
            service,
            "sankata_chaturthi",
            date(2026, 12, 1),
            date(2026, 12, 31),
        )
        self.assertEqual(occurrences, [date(2026, 12, 27)])

    def test_ubhayam_second_ashtami_uses_nov_2026_override_date(self):
        service = Mock()
        occurrences = _collect_dates_for_canonical(
            service,
            "second_ashtami",
            date(2026, 11, 1),
            date(2026, 11, 30),
        )
        self.assertEqual(occurrences, [date(2026, 11, 2)])

    def test_ubhayam_second_ashtami_uses_dec_2026_override_date(self):
        service = Mock()
        occurrences = _collect_dates_for_canonical(
            service,
            "second_ashtami",
            date(2026, 12, 1),
            date(2026, 12, 31),
        )
        self.assertEqual(occurrences, [date(2026, 12, 31)])


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
        self.admin = User.objects.create_user(
            phone_number="9000000099",
            name="Pause Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        DonorProfile.objects.get_or_create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)
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

    def _pause_plan_as_admin(self, plan: RecurringPoojaPlan, *, pause_from: date, pause_until: date, reason: str):
        url = reverse("pooja-recurrence-plans-pause", kwargs={"pk": plan.id})
        return self.admin_client.post(
            url,
            {
                "pause_from": pause_from.isoformat(),
                "pause_until": pause_until.isoformat(),
                "pause_reason": reason,
            },
            format="json",
        )

    def test_pause_use_for_temple_does_not_credit_monthly_donation_when_paid(self):
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
        self.assertEqual(profile.monthly_donation_amount, Decimal("0.00"))

    def test_pause_use_for_temple_does_not_credit_monthly_donation_when_unpaid(self):
        plan = self._create_plan()
        self._create_due_registration(plan)

        response = self._pause_plan(plan, PAUSE_REASON_USE_FOR_TEMPLE)

        self.assertEqual(response.status_code, 200)
        profile = DonorProfile.objects.get(user=self.user)
        self.assertEqual(profile.monthly_donation_amount, Decimal("0.00"))

    def test_pause_no_pooja_no_payment_credits_custom_balance_when_paid(self):
        plan = self._create_plan()
        registration = self._create_due_registration(plan)
        PaymentRecord.objects.create(
            donor=self.user,
            registration=registration,
            amount=Decimal("300.00"),
            mode=PaymentMode.UPI,
            status=PaymentStatus.SUCCESS,
        )

        response = self._pause_plan(plan, PAUSE_REASON_NO_POJA_NO_PAYMENT)

        self.assertEqual(response.status_code, 200)
        profile = DonorProfile.objects.get(user=self.user)
        self.assertEqual(profile.custom_number, 300)

    def test_pause_no_pooja_no_payment_is_idempotent_on_pause_update(self):
        plan = self._create_plan()
        registration = self._create_due_registration(plan)
        PaymentRecord.objects.create(
            donor=self.user,
            registration=registration,
            amount=Decimal("300.00"),
            mode=PaymentMode.UPI,
            status=PaymentStatus.SUCCESS,
        )

        first_response = self._pause_plan(plan, PAUSE_REASON_NO_POJA_NO_PAYMENT)
        second_response = self._pause_plan(plan, PAUSE_REASON_NO_POJA_NO_PAYMENT)

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        profile = DonorProfile.objects.get(user=self.user)
        self.assertEqual(profile.custom_number, 300)

    def test_resume_no_pooja_no_payment_reverses_credit_when_resumed_early(self):
        plan = self._create_plan()
        registration = self._create_due_registration(plan)
        PaymentRecord.objects.create(
            donor=self.user,
            registration=registration,
            amount=Decimal("300.00"),
            mode=PaymentMode.UPI,
            status=PaymentStatus.SUCCESS,
        )
        pause_response = self._pause_plan(plan, PAUSE_REASON_NO_POJA_NO_PAYMENT)
        self.assertEqual(pause_response.status_code, 200)

        resume_url = reverse("pooja-recurrence-plans-resume", kwargs={"pk": plan.id})
        resume_response = self.client.post(resume_url, {}, format="json")

        self.assertEqual(resume_response.status_code, 200)
        profile = DonorProfile.objects.get(user=self.user)
        self.assertEqual(profile.custom_number, 0)

    def test_resume_then_cancel_keeps_pre_cancel_month_dues_unchanged(self):
        today = date(2026, 4, 3)
        month_jan = date(2026, 1, 1)
        month_feb = date(2026, 2, 1)
        month_mar = date(2026, 3, 1)
        month_apr = date(2026, 4, 1)
        created_at_jan = timezone.make_aware(datetime(2026, 1, 5, 9, 0, 0))

        canceled_plan = RecurringPoojaPlan.objects.create(
            donor=self.user,
            pooja_option=PoojaOption.objects.create(code="RP2", name="Recurring Cancelled"),
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=month_jan,
            next_occurrence=None,
            amount=Decimal("1000.00"),
            is_active=False,
            pause_from=month_apr,
            pause_until=date.max,
            metadata={
                "canceled_at": "2026-04-03",
                "cancel_effective_from": "2026-04-01",
            },
        )
        RecurringPoojaPlan.objects.filter(pk=canceled_plan.pk).update(created_at=created_at_jan)
        canceled_plan.refresh_from_db()
        # Existing active plan contributes another ₹1000/month.
        active_plan = RecurringPoojaPlan.objects.create(
            donor=self.user,
            pooja_option=PoojaOption.objects.create(code="RP3", name="Recurring Active"),
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=month_jan,
            next_occurrence=month_apr,
            amount=Decimal("1000.00"),
            is_active=True,
        )
        RecurringPoojaPlan.objects.filter(pk=active_plan.pk).update(created_at=created_at_jan)

        for month_start in (month_jan, month_feb, month_mar, month_apr):
            PaymentRecord.objects.create(
                donor=self.user,
                amount=Decimal("1000.00"),
                mode="pending",
                status=PaymentStatus.PENDING,
                payment_month=month_start,
                notes="Monthly recurring pooja contribution due",
                registration=None,
            )

        for month_start, txn_ref in (
            (month_jan, "TXN-JAN"),
            (month_feb, "TXN-FEB"),
            (month_mar, "TXN-MAR"),
        ):
            PaymentRecord.objects.create(
                donor=self.user,
                amount=Decimal("2000.00"),
                mode=PaymentMode.UPI,
                status=PaymentStatus.SUCCESS,
                payment_month=month_start,
                transaction_reference=txn_ref,
                registration=None,
            )

        resume_url = reverse("pooja-recurrence-plans-resume", kwargs={"pk": canceled_plan.id})
        cancel_url = reverse("pooja-recurrence-plans-cancel", kwargs={"pk": canceled_plan.id})

        with patch("pooja.views.timezone.localdate", return_value=today):
            resume_response = self.admin_client.post(resume_url, {}, format="json")
            self.assertEqual(resume_response.status_code, 200)

            cancel_response = self.admin_client.post(
                cancel_url,
                {"cancel_from": month_apr.isoformat()},
                format="json",
            )
            self.assertEqual(cancel_response.status_code, 200)

        pending_amounts = list(
            PaymentRecord.objects.filter(
                donor=self.user,
                registration__isnull=True,
                status=PaymentStatus.PENDING,
            )
            .order_by("payment_month")
            .values_list("payment_month", "amount")
        )
        self.assertEqual(
            pending_amounts,
            [
                (month_jan, Decimal("2000.00")),
                (month_feb, Decimal("2000.00")),
                (month_mar, Decimal("2000.00")),
                (month_apr, Decimal("1000.00")),
            ],
        )

    def test_rerun_due_rejects_when_pause_is_still_active(self):
        plan = self._create_plan()
        self._pause_plan(plan, PAUSE_REASON_NO_POJA_NO_PAYMENT)

        rerun_url = reverse("pooja-recurrence-plans-rerun-due", kwargs={"pk": plan.id})
        response = self.client.post(rerun_url, {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Pause is still active", response.data.get("detail", ""))

    def test_rerun_due_generates_pending_due_for_single_donor_after_pause_end(self):
        plan = self._create_plan()
        pause_from = timezone.localdate() - timedelta(days=40)
        pause_until = timezone.localdate() - timedelta(days=5)
        plan.pause_from = pause_from
        plan.pause_until = pause_until
        plan.is_active = False
        plan.start_date = timezone.localdate() - timedelta(days=70)
        plan.save(update_fields=["pause_from", "pause_until", "is_active", "start_date"])

        rerun_url = reverse("pooja-recurrence-plans-rerun-due", kwargs={"pk": plan.id})
        response = self.client.post(rerun_url, {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            PaymentRecord.objects.filter(
                donor=self.user,
                registration__isnull=True,
                status=PaymentStatus.PENDING,
            ).exists()
        )

    def test_admin_can_backdate_pause(self):
        plan = self._create_plan()
        backdated_from = timezone.localdate() - timedelta(days=20)
        backdated_to = timezone.localdate() + timedelta(days=20)

        response = self._pause_plan_as_admin(
            plan,
            pause_from=backdated_from,
            pause_until=backdated_to,
            reason=PAUSE_REASON_NO_POJA_NO_PAYMENT,
        )

        self.assertEqual(response.status_code, 200)
        plan.refresh_from_db()
        self.assertEqual(plan.pause_from, backdated_from)
        self.assertEqual(plan.pause_until, backdated_to)

    def test_backdated_pause_recalculates_pending_due_for_partial_month(self):
        plan_day_one = RecurringPoojaPlan.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=timezone.localdate().replace(day=1),
            amount=Decimal("100.00"),
            is_active=True,
        )
        day_15_option = PoojaDayOption.objects.create(
            code="MIDM",
            description="15th day",
            category=DayOptionCategory.CODE,
        )
        plan_day_fifteen = RecurringPoojaPlan.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=day_15_option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=timezone.localdate().replace(day=15),
            amount=Decimal("100.00"),
            is_active=True,
        )
        month_start = timezone.localdate().replace(day=1)
        pending_due = PaymentRecord.objects.create(
            donor=self.user,
            registration=None,
            amount=Decimal("200.00"),
            currency="INR",
            mode="pending",
            status=PaymentStatus.PENDING,
            payment_month=month_start,
            notes="Monthly recurring pooja contribution due",
        )
        pause_from = month_start.replace(day=10)
        pause_until = month_start + timedelta(days=40)

        response = self._pause_plan_as_admin(
            plan_day_fifteen,
            pause_from=pause_from,
            pause_until=pause_until,
            reason=PAUSE_REASON_NO_POJA_NO_PAYMENT,
        )

        self.assertEqual(response.status_code, 200)
        pending_due.refresh_from_db()
        self.assertEqual(pending_due.amount, Decimal("100.00"))
        plan_day_one.refresh_from_db()
        plan_day_fifteen.refresh_from_db()
        self.assertTrue(plan_day_one.is_active)
        self.assertFalse(plan_day_fifteen.is_active)

    def test_backdated_pause_removes_pending_due_for_fully_paused_month(self):
        plan = self._create_plan()
        month_start = timezone.localdate().replace(day=1)
        due = PaymentRecord.objects.create(
            donor=self.user,
            registration=None,
            amount=Decimal("250.00"),
            currency="INR",
            mode="pending",
            status=PaymentStatus.PENDING,
            payment_month=month_start,
            notes="Monthly recurring pooja contribution due",
        )
        pause_from = month_start
        pause_until = month_start + timedelta(days=60)

        response = self._pause_plan_as_admin(
            plan,
            pause_from=pause_from,
            pause_until=pause_until,
            reason=PAUSE_REASON_NO_POJA_NO_PAYMENT,
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(PaymentRecord.objects.filter(pk=due.pk).exists())

    def test_pause_clears_due_registration_within_pause_window_when_unpaid(self):
        plan = self._create_plan()
        due_registration = PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=timezone.localdate() + timedelta(days=5),
            total_amount=plan.amount,
        )
        plan.due_registration = due_registration
        plan.save(update_fields=["due_registration"])

        response = self._pause_plan(plan, PAUSE_REASON_NO_POJA_NO_PAYMENT)

        self.assertEqual(response.status_code, 200)
        plan.refresh_from_db()
        self.assertIsNone(plan.due_registration)
        self.assertFalse(PoojaRegistration.objects.filter(pk=due_registration.pk).exists())

    def test_registration_list_excludes_entries_inside_paused_window(self):
        plan = self._create_plan()
        month_start = timezone.localdate().replace(day=1)
        pause_from = month_start.replace(day=10)
        pause_until = month_start + timedelta(days=40)
        self._pause_plan_as_admin(
            plan,
            pause_from=pause_from,
            pause_until=pause_until,
            reason=PAUSE_REASON_NO_POJA_NO_PAYMENT,
        )
        paused_registration = PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=month_start.replace(day=15),
            total_amount=Decimal("250.00"),
        )

        response = self.admin_client.get(
            reverse("pooja-registrations-list"),
            {"donor_id": self.user.id},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        results = payload.get("results", payload if isinstance(payload, list) else [])
        returned_ids = {row.get("id") for row in results if isinstance(row, dict)}
        self.assertNotIn(paused_registration.id, returned_ids)

    def test_use_for_temple_keeps_registration_visible_with_replaced_name(self):
        plan = self._create_plan()
        month_start = timezone.localdate().replace(day=1)
        pause_from = month_start
        pause_until = month_start + timedelta(days=30)
        response = self._pause_plan_as_admin(
            plan,
            pause_from=pause_from,
            pause_until=pause_until,
            reason="No Pooja and use money for temple purpose",
        )
        self.assertEqual(response.status_code, 200)

        paused_registration = PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=month_start + timedelta(days=5),
            total_amount=Decimal("250.00"),
        )
        list_response = self.admin_client.get(reverse("pooja-registrations-list"), {"donor_id": self.user.id})
        self.assertEqual(list_response.status_code, 200)
        payload = list_response.json()
        results = payload.get("results", payload if isinstance(payload, list) else [])
        matching = [row for row in results if row.get("id") == paused_registration.id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0].get("donor_name"), "temple purpose")

    def test_samy_reason_keeps_registration_visible_with_replaced_name(self):
        plan = self._create_plan()
        month_start = timezone.localdate().replace(day=1)
        pause_from = month_start
        pause_until = month_start + timedelta(days=30)
        response = self._pause_plan_as_admin(
            plan,
            pause_from=pause_from,
            pause_until=pause_until,
            reason="Continue the pooja with Samy's names",
        )
        self.assertEqual(response.status_code, 200)

        paused_registration = PoojaRegistration.objects.create(
            donor=self.user,
            pooja_option=self.pooja_option,
            day_option=self.day_option,
            start_date=month_start + timedelta(days=6),
            total_amount=Decimal("250.00"),
        )
        list_response = self.admin_client.get(reverse("pooja-registrations-list"), {"donor_id": self.user.id})
        self.assertEqual(list_response.status_code, 200)
        payload = list_response.json()
        results = payload.get("results", payload if isinstance(payload, list) else [])
        matching = [row for row in results if row.get("id") == paused_registration.id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0].get("donor_name"), "Samy's names")

    def test_use_for_temple_does_not_remove_existing_pending_due(self):
        plan = self._create_plan()
        month_start = timezone.localdate().replace(day=1)
        pending_due = PaymentRecord.objects.create(
            donor=self.user,
            registration=None,
            amount=Decimal("250.00"),
            currency="INR",
            mode="pending",
            status=PaymentStatus.PENDING,
            payment_month=month_start,
            notes="Monthly recurring pooja contribution due",
        )
        response = self._pause_plan_as_admin(
            plan,
            pause_from=month_start,
            pause_until=month_start + timedelta(days=30),
            reason="No Pooja and use money for temple purpose",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(PaymentRecord.objects.filter(pk=pending_due.pk).exists())


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

        plan = RecurringPoojaPlan.objects.create(
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
        RecurringPoojaPlan.objects.filter(pk=plan.pk).update(
            created_at=timezone.make_aware(datetime(2026, 1, 1, 9, 0)),
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

    def test_future_start_date_still_creates_due_from_registration_created_month(self):
        """
        If a recurring plan has a future start_date, dues should still start from the
        registration created month.
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
        self.assertEqual(
            february_due.count(),
            1,
            "February due should be created from registration created month.",
        )

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


@override_settings(DATABASES=SQLITE_DB_CONFIG)
class PoojaOptionTotalsMonthFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            phone_number="9000000990",
            name="Totals Admin",
            password="secret",
            role=UserRole.ADMIN,
            is_staff=True,
        )
        self.donor = User.objects.create_user(
            phone_number="9000000991",
            name="Totals Donor",
            password="secret",
        )
        self.other_donor = User.objects.create_user(
            phone_number="9000000992",
            name="Totals Donor 2",
            password="secret",
        )
        self.parent = PoojaOption.objects.create(code="SPECIAL", name="Special Pooja", is_group_header=True)
        self.option = PoojaOption.objects.create(code="GP_NAV", name="Navagraha Pooja", parent=self.parent)
        self.option_totals_url = reverse("pooja-registrations-option-totals")
        self.donors_by_option_url = reverse("pooja-registrations-donors-by-option")
        self.paid_totals_url = reverse("pooja-registrations-paid-totals-by-option")

    def _create_recurring_plan(
        self,
        *,
        donor: User,
        amount: Decimal,
        registered_at: datetime,
        start_date: date | None,
    ) -> RecurringPoojaPlan:
        origin = PoojaRegistration.objects.create(
            donor=donor,
            pooja_option=self.option,
            start_date=start_date,
            total_amount=amount,
        )
        PoojaRegistration.objects.filter(pk=origin.pk).update(created_at=timezone.make_aware(registered_at))
        origin.refresh_from_db()
        return RecurringPoojaPlan.objects.create(
            donor=donor,
            pooja_option=self.option,
            recurrence_kind=RecurrenceKind.RECURRING,
            recurrence_frequency=RecurrenceFrequency.MONTHLY,
            start_date=start_date,
            amount=amount,
            is_active=True,
            origin_registration=origin,
        )

    def test_option_totals_and_donor_rows_align_for_selected_month(self):
        jan_plan_one = self._create_recurring_plan(
            donor=self.donor,
            amount=Decimal("100.00"),
            registered_at=datetime(2026, 1, 5, 10, 0),
            start_date=None,
        )
        self._create_recurring_plan(
            donor=self.other_donor,
            amount=Decimal("200.00"),
            registered_at=datetime(2026, 1, 14, 10, 0),
            start_date=date(2026, 1, 14),
        )
        self._create_recurring_plan(
            donor=self.donor,
            amount=Decimal("300.00"),
            registered_at=datetime(2026, 2, 10, 10, 0),
            start_date=date(2026, 2, 10),
        )
        self._create_recurring_plan(
            donor=self.donor,
            amount=Decimal("50.00"),
            registered_at=datetime(2026, 1, 20, 10, 0),
            start_date=None,
        )

        # Non-plan registration rows (including generated dues) must not affect option totals.
        create_registration_from_plan(jan_plan_one, due_date=date(2026, 2, 5))
        standalone = PoojaRegistration.objects.create(
            donor=self.donor,
            pooja_option=self.option,
            start_date=date(2026, 1, 25),
            total_amount=Decimal("999.00"),
        )
        PoojaRegistration.objects.filter(pk=standalone.pk).update(created_at=timezone.make_aware(datetime(2026, 1, 25, 10, 0)))

        self.client.force_authenticate(self.admin)

        totals_response = self.client.get(self.option_totals_url, {"month": "2026-01"})
        self.assertEqual(totals_response.status_code, status.HTTP_200_OK)
        totals_payload = totals_response.json()
        navagraha_row = next((row for row in totals_payload if row["option_code"] == "GP_NAV"), None)
        self.assertIsNotNone(navagraha_row)
        self.assertEqual(navagraha_row["registration_count"], 3)
        self.assertEqual(Decimal(navagraha_row["total_amount"]), Decimal("350.00"))

        donors_response = self.client.get(
            self.donors_by_option_url,
            {"month": "2026-01", "codes": "GP_NAV"},
        )
        self.assertEqual(donors_response.status_code, status.HTTP_200_OK)
        donors_payload = donors_response.json()
        self.assertEqual(donors_payload["registration_count"], 3)
        self.assertEqual(donors_payload["count"], 2)
        self.assertEqual(len(donors_payload["results"]), 2)
        self.assertEqual(
            sum(Decimal(entry["total_amount"]) for entry in donors_payload["results"]),
            Decimal("350.00"),
        )
        self.assertTrue(all(entry["pooja_option_name"] == "" for entry in donors_payload["results"]))

        donors_with_names_response = self.client.get(
            self.donors_by_option_url,
            {"month": "2026-01", "codes": "GP_NAV", "include_pooja_names": "1"},
        )
        self.assertEqual(donors_with_names_response.status_code, status.HTTP_200_OK)
        donors_with_names_payload = donors_with_names_response.json()
        self.assertTrue(
            all(
                "Navagraha Pooja" in (entry["pooja_option_name"] or "")
                for entry in donors_with_names_payload["results"]
            )
        )

        march_totals_response = self.client.get(self.option_totals_url, {"month": "2026-03"})
        self.assertEqual(march_totals_response.status_code, status.HTTP_200_OK)
        march_payload = march_totals_response.json()
        march_row = next((row for row in march_payload if row["option_code"] == "GP_NAV"), None)
        self.assertIsNotNone(march_row)
        self.assertEqual(march_row["registration_count"], 4)
        self.assertEqual(Decimal(march_row["total_amount"]), Decimal("650.00"))

    def test_option_totals_is_admin_only(self):
        self.client.force_authenticate(self.donor)
        response = self.client.get(self.option_totals_url, {"month": "2026-01"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_paid_totals_by_option_uses_successful_month_payments(self):
        jan_plan_one = self._create_recurring_plan(
            donor=self.donor,
            amount=Decimal("100.00"),
            registered_at=datetime(2026, 1, 5, 10, 0),
            start_date=date(2026, 1, 5),
        )
        jan_plan_two = self._create_recurring_plan(
            donor=self.other_donor,
            amount=Decimal("200.00"),
            registered_at=datetime(2026, 1, 6, 10, 0),
            start_date=date(2026, 1, 6),
        )

        PaymentRecord.objects.create(
            donor=self.donor,
            registration=jan_plan_one.origin_registration,
            amount=Decimal("70.00"),
            currency="INR",
            mode=PaymentMode.UPI,
            status=PaymentStatus.SUCCESS,
            payment_month=date(2026, 1, 1),
        )
        PaymentRecord.objects.create(
            donor=self.donor,
            registration=jan_plan_one.origin_registration,
            amount=Decimal("30.00"),
            currency="INR",
            mode=PaymentMode.CASH,
            status=PaymentStatus.SUCCESS,
            payment_month=date(2026, 1, 1),
        )
        PaymentRecord.objects.create(
            donor=self.other_donor,
            registration=jan_plan_two.origin_registration,
            amount=Decimal("150.00"),
            currency="INR",
            mode=PaymentMode.NEFT,
            status=PaymentStatus.SUCCESS,
            payment_month=date(2026, 1, 1),
        )
        PaymentRecord.objects.create(
            donor=self.other_donor,
            registration=jan_plan_two.origin_registration,
            amount=Decimal("999.00"),
            currency="INR",
            mode=PaymentMode.NEFT,
            status=PaymentStatus.FAILED,
            payment_month=date(2026, 1, 1),
        )
        PaymentRecord.objects.create(
            donor=self.donor,
            registration=jan_plan_one.origin_registration,
            amount=Decimal("500.00"),
            currency="INR",
            mode=PaymentMode.UPI,
            status=PaymentStatus.SUCCESS,
            payment_month=date(2026, 2, 1),
        )
        no_month_payment = PaymentRecord.objects.create(
            donor=self.donor,
            registration=jan_plan_one.origin_registration,
            amount=Decimal("25.00"),
            currency="INR",
            mode=PaymentMode.OTHER,
            status=PaymentStatus.SUCCESS,
            payment_month=None,
        )
        PaymentRecord.objects.filter(pk=no_month_payment.pk).update(
            created_at=timezone.make_aware(datetime(2026, 1, 22, 11, 30)),
        )

        self.client.force_authenticate(self.admin)
        response = self.client.get(self.paid_totals_url, {"month": "2026-01"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payload = response.json()
        navagraha_row = next((row for row in payload if row["option_code"] == "GP_NAV"), None)
        self.assertIsNotNone(navagraha_row)
        self.assertEqual(Decimal(navagraha_row["paid_amount"]), Decimal("100.00"))
        self.assertEqual(navagraha_row["paid_donor_count"], 1)
        self.assertEqual(navagraha_row["payment_count"], 1)

    def test_paid_totals_is_admin_only(self):
        self.client.force_authenticate(self.donor)
        response = self.client.get(self.paid_totals_url, {"month": "2026-01"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# Nakshatra calendar regression tests
# Verified against mahacalendar.com (temple's reference printed calendar).
# These tests lock known boundary windows so any code change that breaks
# the nakshatra output is caught immediately.
# ---------------------------------------------------------------------------

from pooja.services.calendar import TempleCalendarService  # noqa: E402


class NakshatraRegressionTests(SimpleTestCase):
    """Regression tests for nakshatra calculation — admin-verified dates."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.svc = TempleCalendarService()

    def _check(self, day: date, expected_index: int, expected_tamil: str):
        result_idx  = self.svc.nakshatra_index_on(day)
        result_name = self.svc.nakshatra_native_name_on(day)
        self.assertEqual(
            result_idx,
            expected_index,
            f"{day}: expected {expected_tamil} (idx {expected_index}), "
            f"got {result_name} (idx {result_idx})",
        )

    # ── May 2026 ─────────────────────────────────────────────────────────────
    def test_may_2026_star_transition_window(self):
        cases = [
            (date(2026, 5, 21),  6, "புனர்பூசம்"),
            (date(2026, 5, 22),  7, "பூசம்"),
            (date(2026, 5, 23),  8, "ஆயில்யம்"),
            (date(2026, 5, 24),  9, "மகம்"),
            (date(2026, 5, 25), 10, "பூரம்"),
            (date(2026, 5, 26), 11, "உத்தரம்"),
            (date(2026, 5, 27), 12, "அஸ்தம்"),
        ]
        for day, idx, name in cases:
            with self.subTest(date=day):
                self._check(day, idx, name)

    # ── June 2026 ────────────────────────────────────────────────────────────
    def test_jun_2026_non_boundary_dates_correct(self):
        """Dates with no override must also be correct."""
        cases = [
            (date(2026, 6, 1),  17, "கேட்டை"),
            (date(2026, 6, 5),  21, "திருவோணம்"),
            (date(2026, 6, 13),  2, "கிருத்திகை"),
        ]
        for day, idx, name in cases:
            with self.subTest(date=day):
                self._check(day, idx, name)

    def test_jun_2026_pre_sunrise_transition_window(self):
        """Jun 6-12: star changes before sunrise — overrides must give correct star."""
        cases = [
            (date(2026, 6, 6),  22, "அவிட்டம்"),
            (date(2026, 6, 7),  23, "சதயம்"),
            (date(2026, 6, 8),  24, "பூரட்டாதி"),
            (date(2026, 6, 9),  25, "உத்திரட்டாதி"),
            (date(2026, 6, 10), 26, "ரேவதி"),
            (date(2026, 6, 11),  0, "அசுவினி"),
            (date(2026, 6, 12),  1, "பரணி"),
        ]
        for day, idx, name in cases:
            with self.subTest(date=day):
                self._check(day, idx, name)

    # ── July 2026 ────────────────────────────────────────────────────────────
    def test_jul_2026_boundary(self):
        self._check(date(2026, 7, 25), 16, "அனுஷம்")

    # ── August 2026 ──────────────────────────────────────────────────────────
    def test_aug_2026_transition_window(self):
        cases = [
            (date(2026, 8, 13),  8, "ஆயில்யம்"),
            (date(2026, 8, 14),  9, "மகம்"),
            (date(2026, 8, 15), 10, "பூரம்"),
            (date(2026, 8, 16), 11, "உத்தரம்"),
            (date(2026, 8, 17), 12, "அஸ்தம்"),
            (date(2026, 8, 18), 13, "சித்திரை"),
        ]
        for day, idx, name in cases:
            with self.subTest(date=day):
                self._check(day, idx, name)

    # ── October 2026 ─────────────────────────────────────────────────────────
    def test_oct_2026_boundary(self):
        cases = [
            (date(2026, 10, 1),  2, "கிருத்திகை"),
            (date(2026, 10, 2),  3, "ரோகிணி"),
        ]
        for day, idx, name in cases:
            with self.subTest(date=day):
                self._check(day, idx, name)

    # ── November 2026 ────────────────────────────────────────────────────────
    def test_nov_2026_transition_window(self):
        cases = [
            (date(2026, 11, 1),   6, "புனர்பூசம்"),
            (date(2026, 11, 2),   7, "பூசம்"),
            (date(2026, 11, 3),   8, "ஆயில்யம்"),
            (date(2026, 11, 4),   9, "மகம்"),
            (date(2026, 11, 5),  10, "பூரம்"),
            (date(2026, 11, 7),  12, "அஸ்தம்"),
            (date(2026, 11, 8),  13, "சித்திரை"),
            (date(2026, 11, 18), 23, "சதயம்"),
            (date(2026, 11, 19), 24, "பூரட்டாதி"),
            (date(2026, 11, 20), 25, "உத்திரட்டாதி"),
            (date(2026, 11, 21), 26, "ரேவதி"),
            (date(2026, 11, 22),  0, "அசுவினி"),
            (date(2026, 11, 23),  1, "பரணி"),
        ]
        for day, idx, name in cases:
            with self.subTest(date=day):
                self._check(day, idx, name)

    # ── December 2026 ────────────────────────────────────────────────────────
    def test_dec_2026_boundary(self):
        cases = [
            (date(2026, 12, 12), 20, "உத்திராடம்"),
            (date(2026, 12, 13), 21, "திருவோணம்"),
            (date(2026, 12, 14), 21, "திருவோணம்"),
        ]
        for day, idx, name in cases:
            with self.subTest(date=day):
                self._check(day, idx, name)
