from datetime import date
from unittest.mock import Mock, patch

from django.urls import reverse
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from .models import PoojaDayOption
from .services.calendar import OccurrenceResult, TempleCalendarService


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
