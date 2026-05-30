"""
Monthly nakshatra validation command.

Usage:
  python manage.py check_nakshatra --month=6 --year=2026

Compare the system's computed nakshatra for every day in the given month
against admin-entered correct values. Mismatches are printed as a table
and optionally written to nakshatra_overrides.py as ready-to-paste lines.

Workflow (run on the 25th of each month):
  1. Run this command for the upcoming month.
  2. Cross-check the printed output against mahacalendar.com.
  3. For any mismatch, note the correct star index (0-26).
  4. Re-run with --correct flag to enter corrections interactively.
  5. Paste the generated override lines into nakshatra_overrides.py.
"""

from __future__ import annotations

import sys
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError

from pooja.services.calendar import TempleCalendarService


class Command(BaseCommand):
    help = "Validate system nakshatra output for a month against the printed calendar."

    def add_arguments(self, parser):
        parser.add_argument("--month", type=int, required=True, help="Month number (1-12)")
        parser.add_argument("--year",  type=int, required=True, help="4-digit year")
        parser.add_argument(
            "--correct",
            action="store_true",
            default=False,
            help="Interactive mode: enter correct star for each date",
        )

    def handle(self, *args, **options):
        month = options["month"]
        year  = options["year"]

        if not (1 <= month <= 12):
            raise CommandError("--month must be between 1 and 12")

        svc = TempleCalendarService()

        # Build date range for the month
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)

        days = []
        d = start
        while d <= end:
            days.append(d)
            d += timedelta(days=1)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\nNakshatra check — {start.strftime('%B %Y')} ({len(days)} days)\n"
        ))

        # Header
        self.stdout.write(
            f"{'DATE':<13} {'DAY':<5} {'SYSTEM OUTPUT':<22} {'OVERRIDE?'}"
        )
        self.stdout.write("-" * 60)

        override_entries: list[tuple[date, int, str]] = []

        for day in days:
            idx  = svc.nakshatra_index_on(day)
            name = svc.nakshatra_native_name_on(day)
            is_override = day in svc._NAKSHATRA_DATE_OVERRIDES
            override_flag = " [override]" if is_override else ""
            self.stdout.write(
                f"{str(day):<13} {day.strftime('%a'):<5} {name:<22}{override_flag}"
            )

        if options["correct"]:
            self.stdout.write(
                self.style.WARNING(
                    "\n\nEnter corrections. Press Enter to skip (keep system value).\n"
                    "Star index reference:\n"
                    "  0=அசுவினி 1=பரணி 2=கிருத்திகை 3=ரோகிணி 4=மிருகசீரிடம்\n"
                    "  5=திருவாதிரை 6=புனர்பூசம் 7=பூசம் 8=ஆயில்யம் 9=மகம்\n"
                    " 10=பூரம் 11=உத்தரம் 12=அஸ்தம் 13=சித்திரை 14=சுவாதி\n"
                    " 15=விசாகம் 16=அனுஷம் 17=கேட்டை 18=மூலம் 19=பூராடம்\n"
                    " 20=உத்திராடம் 21=திருவோணம் 22=அவிட்டம் 23=சதயம் 24=பூரட்டாதி\n"
                    " 25=உத்திரட்டாதி 26=ரேவதி\n"
                )
            )
            for day in days:
                current_idx  = svc.nakshatra_index_on(day)
                current_name = svc.nakshatra_native_name_on(day)
                try:
                    raw = input(f"  {day} {day.strftime('%a')}  [{current_name}]  correct index (Enter=skip): ").strip()
                except (EOFError, KeyboardInterrupt):
                    self.stdout.write("\nAborted.")
                    sys.exit(0)
                if not raw:
                    continue
                try:
                    correct_idx = int(raw)
                    if not (0 <= correct_idx <= 26):
                        raise ValueError
                except ValueError:
                    self.stdout.write(self.style.ERROR(f"  Invalid index '{raw}', skipping."))
                    continue
                correct_name = svc._nakshatra_native_name(correct_idx)
                override_entries.append((day, correct_idx, correct_name))

            if override_entries:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\n\n# ── {start.strftime('%B %Y')} overrides "
                        f"— paste into nakshatra_overrides.py ──"
                    )
                )
                for day, idx, name in override_entries:
                    self.stdout.write(
                        f"    date({day.year}, {day.month}, {day.day}): {idx},"
                        f"   # {name}"
                    )
            else:
                self.stdout.write(self.style.SUCCESS("\nNo corrections entered."))
        else:
            self.stdout.write(
                self.style.WARNING(
                    "\nTip: run with --correct to interactively enter corrections\n"
                    "and get ready-to-paste override lines.\n"
                )
            )
