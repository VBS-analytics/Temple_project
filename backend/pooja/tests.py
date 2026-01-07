from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import DonorProfile, User, UserRole
from payments.models import PaymentMode, PaymentRecord, PaymentStatus
from .models import (
    DayOptionCategory,
    PoojaCartSnapshot,
    PoojaDayOption,
    PoojaOption,
    PoojaRegistration,
    PoojaStatus,
    RecurrenceFrequency,
    RecurrenceKind,
    RecurringPoojaPlan,
)
from .serializers import RecurringPoojaPlanSerializer
from .services.calendar import OccurrenceResult, TempleCalendarService
from .views import PAUSE_REASON_USE_FOR_TEMPLE


SQLITE_DB_CONFIG = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}


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

    def _create_registration(self, donor, tz_datetime, start_date_value=None, day_option=None):
        registration = PoojaRegistration.objects.create(
            donor=donor,
            pooja_option=self.pooja_option,
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

        mock_service_factory.return_value = DummyService()
        donor = User.objects.create_user(
            phone_number="9000000020",
            name="Multi Occurrence Donor",
            password="secret",
        )
        day_option = PoojaDayOption.objects.create(
            code="AST",
            description="Second Ashtami",
            category="code",
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


class PradoshamOccurrenceTests(SimpleTestCase):
    @patch.object(TempleCalendarService, "_upcoming_pradosham_occurrences")
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

        self.assertEqual(occurrences, [date(2025, 1, 15), date(2025, 2, 1)])


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
