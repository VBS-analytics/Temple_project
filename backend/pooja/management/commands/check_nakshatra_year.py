"""
Annual nakshatra boundary audit command.

Usage:
  python manage.py check_nakshatra_year --year=2027

Run this ONCE at the start of each year (or end of previous year).
It identifies every date where the nakshatra transition falls within
3 hours of sunrise — the only dates that can ever disagree with the
printed calendar. You verify just those dates against mahacalendar.com
and enter corrections once. Done for the whole year.

Output: ready-to-paste override lines for nakshatra_overrides.py
"""

from __future__ import annotations

import sys
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError

from pooja.services.calendar import TempleCalendarService

# Dates within this many hours of the next transition are flagged as risky.
_RISK_WINDOW_HOURS = 3.0


class Command(BaseCommand):
    help = "Annual nakshatra boundary audit — find all dates that need manual verification."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, required=True, help="4-digit year to audit")
        parser.add_argument(
            "--window",
            type=float,
            default=_RISK_WINDOW_HOURS,
            help=f"Hours after sunrise to consider risky (default: {_RISK_WINDOW_HOURS})",
        )
        parser.add_argument(
            "--correct",
            action="store_true",
            default=False,
            help="Interactive mode: enter correct star for each risky date",
        )

    def handle(self, *args, **options):
        year   = options["year"]
        window = options["window"]

        svc = TempleCalendarService()

        start = date(year, 1, 1)
        end   = date(year, 12, 31)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\nNakshatra annual audit — {year}  (risk window: {window}h after sunrise)\n"
        ))

        risk_dates = self._find_risk_dates(svc, start, end, window)

        if not risk_dates:
            self.stdout.write(self.style.SUCCESS("No boundary-risk dates found."))
            return

        self.stdout.write(
            f"Found {len(risk_dates)} boundary-risk dates "
            f"(transition within {window}h of sunrise):\n"
        )
        self.stdout.write(
            f"{'DATE':<13} {'DAY':<5} {'SYSTEM STAR':<22} {'SUNRISE':<9} {'HRS TO TRANSITION'}"
        )
        self.stdout.write("-" * 70)

        for day, name, sunrise_h, sunrise_m, hrs in risk_dates:
            already = " [override]" if day in svc._NAKSHATRA_DATE_OVERRIDES else ""
            self.stdout.write(
                f"{str(day):<13} {day.strftime('%a'):<5} {name:<22} "
                f"{sunrise_h:02d}:{sunrise_m:02d}    ~{hrs:.1f}h{already}"
            )

        self.stdout.write(
            self.style.WARNING(
                f"\n→ Cross-check these {len(risk_dates)} dates against mahacalendar.com.\n"
                f"→ Run with --correct to enter corrections interactively.\n"
            )
        )

        if options["correct"]:
            self._collect_corrections(svc, risk_dates)

    # ------------------------------------------------------------------ #

    def _find_risk_dates(self, svc, start, end, window):
        risk = []
        day = start
        while day <= end:
            hrs = self._hours_to_next_transition(svc, day)
            if hrs <= window:
                h, m = svc._sunrise_time_on(day)
                name = svc.nakshatra_native_name_on(day)
                risk.append((day, name, h, m, hrs))
            day += timedelta(days=1)
        return risk

    def _hours_to_next_transition(self, svc, day):
        h, m = svc._sunrise_time_on(day)
        idx_at_sunrise = svc._nakshatra_index_at(day, hour=h, minute=m)
        for delta_min in range(0, int(_RISK_WINDOW_HOURS * 60) + 30, 5):
            total_min = h * 60 + m + delta_min
            hh, mm = total_min // 60, total_min % 60
            if hh >= 24:
                break
            idx = svc._nakshatra_index_at(day, hour=hh, minute=mm)
            if idx != idx_at_sunrise:
                return delta_min / 60
        return 99

    def _collect_corrections(self, svc, risk_dates):
        self.stdout.write(self.style.MIGRATE_HEADING(
            "\n\nEnter correct star index for each date (Enter = keep system value).\n"
        ))
        self.stdout.write(
            "Index reference:\n"
            "  0=அசுவினி  1=பரணி  2=கிருத்திகை  3=ரோகிணி  4=மிருகசீரிடம்\n"
            "  5=திருவாதிரை  6=புனர்பூசம்  7=பூசம்  8=ஆயில்யம்  9=மகம்\n"
            " 10=பூரம்  11=உத்தரம்  12=அஸ்தம்  13=சித்திரை  14=சுவாதி\n"
            " 15=விசாகம்  16=அனுஷம்  17=கேட்டை  18=மூலம்  19=பூராடம்\n"
            " 20=உத்திராடம்  21=திருவோணம்  22=அவிட்டம்  23=சதயம்  24=பூரட்டாதி\n"
            " 25=உத்திரட்டாதி  26=ரேவதி\n"
        )

        corrections: list[tuple[date, int, str]] = []
        current_month = None

        for day, system_name, sunrise_h, sunrise_m, hrs in risk_dates:
            if day.month != current_month:
                current_month = day.month
                self.stdout.write(f"\n  ── {day.strftime('%B %Y')} ──")

            try:
                raw = input(
                    f"  {day} {day.strftime('%a')}  [{system_name}]  "
                    f"correct index (Enter=keep): "
                ).strip()
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
                self.stdout.write(self.style.ERROR(f"  Invalid '{raw}', skipping."))
                continue

            correct_name = svc._nakshatra_native_name(correct_idx)
            corrections.append((day, correct_idx, correct_name))

        if not corrections:
            self.stdout.write(self.style.SUCCESS("\nNo corrections entered. System output accepted for all dates."))
            return

        # Group by month for clean output
        self.stdout.write(self.style.SUCCESS(
            f"\n\n# ── {risk_dates[0][0].year} nakshatra overrides "
            f"— paste into nakshatra_overrides.py ──────────────"
        ))
        current_month = None
        for day, idx, name in corrections:
            if day.month != current_month:
                current_month = day.month
                self.stdout.write(f"\n    # ── {day.strftime('%B %Y')} ──")
            self.stdout.write(
                f"    date({day.year}, {day.month:>2}, {day.day:>2}): {idx:>2},"
                f"   # {name}"
            )

        self.stdout.write(
            self.style.WARNING(
                f"\n\nTotal corrections: {len(corrections)}. "
                f"Paste the lines above into nakshatra_overrides.py."
            )
        )
