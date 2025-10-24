"""Utilities to compute temple calendar occurrences for day options."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
import math
from typing import Iterable, Optional, Sequence
from zoneinfo import ZoneInfo

from django.conf import settings

try:
    from skyfield.api import Loader
except ModuleNotFoundError as exc:  # pragma: no cover - protective fallback for optional dependency
    Loader = None  # type: ignore[assignment]
    _SKYFIELD_IMPORT_ERROR = exc
else:
    _SKYFIELD_IMPORT_ERROR = None

# --------------------------------------------------------------------------- #
# Configuration helpers
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class TempleLocation:
    latitude: float
    longitude: float
    tz_name: str

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.tz_name)


def get_temple_location() -> TempleLocation:
    """Return the configured temple location."""
    latitude = float(getattr(settings, "TEMPLE_LATITUDE", 13.0827))
    longitude = float(getattr(settings, "TEMPLE_LONGITUDE", 80.2707))
    tz_name = getattr(settings, "TEMPLE_TIME_ZONE", getattr(settings, "TIME_ZONE", "Asia/Kolkata"))
    return TempleLocation(latitude=latitude, longitude=longitude, tz_name=tz_name)


def _astro_data_dir() -> Path:
    path = Path(getattr(settings, "ASTRO_DATA_DIR", Path(settings.BASE_DIR) / "data" / "skyfield"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def _require_skyfield() -> None:
    if Loader is None:
        raise RuntimeError(
            "Skyfield is required for temple calendar calculations. Install the 'skyfield' package."
        ) from _SKYFIELD_IMPORT_ERROR


@lru_cache(maxsize=1)
def _get_loader() -> Loader:
    _require_skyfield()
    return Loader(str(_astro_data_dir()))


@lru_cache(maxsize=1)
def _get_ephemeris():
    loader = _get_loader()
    # de421 is compact (~21MB) and covers 1900-2050 which is adequate for temple bookings.
    return loader("de421.bsp")


@lru_cache(maxsize=1)
def _utc_zone() -> ZoneInfo:
    return ZoneInfo("UTC")


# --------------------------------------------------------------------------- #
# Nakshatra metadata
# --------------------------------------------------------------------------- #

NAKSHATRA_ALIASES = {
    0: {"aswini", "ashwini", "aswathi", "aswini"},
    1: {"bharani"},
    2: {"krittika", "krithigai", "karthigai", "krittika"},
    3: {"rohini"},
    4: {"mrigashirsha", "mrigasira", "mirugaseeridam", "mrigaseera"},
    5: {"ardra", "aarudra", "thiruvathirai"},
    6: {"punarvasu", "punarpoosam", "punarphalguni"},
    7: {"pushya", "poosam", "pushyam"},
    8: {"ashlesha", "ayilyam", "aayilyam", "ashlesham"},
    9: {"magha", "magam", "makam"},
    10: {"purva phalguni", "puram", "poorvapalguni", "poorva-phalguni"},
    11: {"uttara phalguni", "uthiram", "uttara-phalguni"},
    12: {"hasta"},
    13: {"chitra", "chithirai"},
    14: {"swati", "swathi"},
    15: {"visakha", "visakam", "vishaka", "vishakam"},
    16: {"anuradha", "anusham", "anuradha"},
    17: {"jyeshtha", "ketai", "kettai", "jyeshta"},
    18: {"mula", "moolam", "moola"},
    19: {"purva ashadha", "pooradam", "poorvashada"},
    20: {"uttara ashadha", "uthradam", "uttarashada"},
    21: {"shravana", "thiruvonam", "tiruvonam"},
    22: {"dhanishta", "avittam", "dhanista"},
    23: {"shatabhisha", "sadayam", "satabhisha"},
    24: {"purva bhadrapada", "purattathi", "poorvabhadra"},
    25: {"uttara bhadrapada", "uthirattathi", "uttarabhadra"},
    26: {"revati", "revathi"},
}


def _normalize_star_label(label: str) -> str:
    return "".join(ch for ch in label.lower() if "a" <= ch <= "z" or ch == " ")


def resolve_nakshatra_index(*labels: Optional[str]) -> Optional[int]:
    """Resolve a nakshatra index (0-26) from candidate labels."""
    for raw in labels:
        if not raw:
            continue
        normalized = _normalize_star_label(raw)
        for index, aliases in NAKSHATRA_ALIASES.items():
            if any(normalized.startswith(alias) or alias in normalized for alias in aliases):
                return index
    return None


# --------------------------------------------------------------------------- #
# Core astronomical service
# --------------------------------------------------------------------------- #

TITHI_NAME_MAP = {
    1: "Prathamai",
    2: "Dwitiya",
    3: "Tritiya",
    4: "Chaturthi",
    5: "Panchami",
    6: "Shashti",
    7: "Saptami",
    8: "Ashtami",
    9: "Navami",
    10: "Dashami",
    11: "Ekadashi",
    12: "Dwadashi",
    13: "Trayodashi",
    14: "Chaturdashi",
    15: "Pournami",
    16: "Prathamai (Krishna)",
    17: "Dwitiya (Krishna)",
    18: "Tritiya (Krishna)",
    19: "Sankata Chaturthi",
    20: "Panchami (Krishna)",
    21: "Shashti (Krishna)",
    22: "Saptami (Krishna)",
    23: "Ashtami (Krishna)",
    24: "Navami (Krishna)",
    25: "Dashami (Krishna)",
    26: "Ekadashi (Krishna)",
    27: "Dwadashi (Krishna)",
    28: "Trayodashi (Krishna)",
    29: "Chaturdashi (Krishna)",
    30: "Amavasya",
}


@dataclass
class OccurrenceResult:
    date: date
    description: str
    meta: dict


class TempleCalendarService:
    """Computes next occurrences for configured day options."""

    def __init__(self, location: Optional[TempleLocation] = None):
        self.location = location or get_temple_location()
        self._loader = _get_loader()
        self._timescale = self._loader.timescale()
        eph = _get_ephemeris()
        self._earth = eph["earth"]
        self._sun = eph["sun"]
        self._moon = eph["moon"]

    # ------------------------------- Public API ---------------------------- #

    def next_occurrence(
        self,
        day_code: str,
        start: date,
        tamil_star_labels: Optional[Sequence[str]] = None,
    ) -> OccurrenceResult:
        code = self._canonicalize_code(day_code)
        if code == "custom_date":
            return OccurrenceResult(
                date=start,
                description="Please specify your preferred date for this option.",
                meta={"code": day_code, "strategy": "manual"},
            )
        if code == "any_day":
            shifted = start + timedelta(days=2)
            return self._format_result(shifted, "Scheduled two days after donor's requested day.")
        if code == "gregorian_1st":
            return self._format_result(self._next_gregorian_first(start), "1st day of English month")
        if code == "tamil_1st":
            tamil_date = self._next_tamil_month_start(start)
            return self._format_result(tamil_date, "Tamil month transition day")
        if code == "first_tuesday":
            return self._format_result(self._first_weekday_of_month(start, weekday=1), "1st Tuesday of month")
        if code == "last_saturday":
            return self._format_result(self._last_weekday_of_month(start, weekday=5), "Last Saturday of month")
        if code == "weekly_sunday":
            return self._format_result(self._next_weekday(start, weekday=6), "Sunday service day")
        if code == "sashti":
            target = self._next_tithi(start, targets=(6, 21))
            return self._format_result(target, f"   Sashti Tithi – {TITHI_NAME_MAP.get(self._tithi_on(target), '')}")
        if code == "second_ashtami":
            target = self._next_tithi(start, targets=(23,))
            return self._format_result(target, "   Krishna Paksha Ashtami")
        if code == "pournami":
            target = self._next_tithi(start, targets=(15,))
            return self._format_result(target, "Pournami (Full moon)")
        if code == "amavasya":
            target = self._next_tithi(start, targets=(30,))
            return self._format_result(target, "Amavasya (New moon)")
        if code == "sankata_chaturthi":
            target = self._next_tithi(start, targets=(19,))
            return self._format_result(target, "Sankatahara Chaturthi")
        if code == "chaturthi":
            target = self._next_tithi(start, targets=(4,))
            return self._format_result(target, "Shukla Chaturthi")
        if code == "tamil_star":
            index = resolve_nakshatra_index(*(tamil_star_labels or []))
            if index is None:
                raise ValueError("Tamil star option is required for this day code.")
            target = self._next_nakshatra(start, index)
            star_name = self._nakshatra_name(index)
            return self._format_result(target, f"{star_name} nakshatra day")
        raise ValueError(f"Unsupported day option code: {day_code}")

    # --------------------------- Formatting helpers ------------------------ #

    def _format_result(self, when: date, description: str) -> OccurrenceResult:
        display = when.strftime("%A, %d %b %Y")
        return OccurrenceResult(date=when, description=display, meta={"note": description})

    # --------------------------- Day-code helpers -------------------------- #

    @staticmethod
    def _canonicalize_code(code: str) -> str:
        raw = (code or "").strip().upper()
        mapping = {
            "AD": "any_day",
            "ANYDAY": "any_day",
            "FE": "gregorian_1st",
            "FENG": "gregorian_1st",
            "FT": "tamil_1st",
            "FTAM": "tamil_1st",
            "1TU": "first_tuesday",
            "FTU": "first_tuesday",
            "LST": "last_saturday",
            "LSA": "last_saturday",
            "LSAT": "last_saturday",
            "SUN": "weekly_sunday",
            "SUNY": "weekly_sunday",
            "SAS": "sashti",
            "SHT": "sashti",
            "2AS": "second_ashtami",
            "KAS": "second_ashtami",
            "PRM": "pournami",
            "POURNAMI": "pournami",
            "AMV": "amavasya",
            "AMAVASI": "amavasya",
            "AMAVASAI": "amavasya",
            "SKT": "sankata_chaturthi",
            "SNC": "sankata_chaturthi",
            "CTR": "chaturthi",
            "CHT": "chaturthi",
            "SH": "sashti",
            "AST": "second_ashtami",
            "P": "pournami",
            "SC": "sankata_chaturthi",
            "C": "chaturthi",
            "CS": "tamil_star",
            "STAR": "tamil_star",
            "CHRT": "custom_date",
        }
        return mapping.get(raw, raw.lower())

    # --------------------------- Gregorian helpers ------------------------- #

    def _next_weekday(self, start: date, weekday: int) -> date:
        """Return the next occurrence of weekday (0=Monday...6=Sunday)."""
        delta = (weekday - start.weekday()) % 7
        return start + timedelta(days=delta)

    def _first_weekday_of_month(self, start: date, weekday: int) -> date:
        """Return first given weekday on/after start, moving to next month if needed."""
        first_of_month = start.replace(day=1)
        candidate = self._next_weekday(first_of_month, weekday)
        if candidate >= start:
            return candidate
        # move to next month
        year, month = first_of_month.year, first_of_month.month
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
        next_month_first = date(year, month, 1)
        return self._next_weekday(next_month_first, weekday)

    def _last_weekday_of_month(self, start: date, weekday: int) -> date:
        """Return last given weekday of current or next month."""
        year, month = start.year, start.month
        candidate = self._last_weekday_in_month(year, month, weekday)
        if candidate >= start:
            return candidate
        # advance to next month
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
        return self._last_weekday_in_month(year, month, weekday)

    @staticmethod
    def _last_weekday_in_month(year: int, month: int, weekday: int) -> date:
        next_month = month + 1 if month < 12 else 1
        next_year = year + 1 if month == 12 else year
        first_of_next = date(next_year, next_month, 1)
        last_day = first_of_next - timedelta(days=1)
        delta = (last_day.weekday() - weekday) % 7
        return last_day - timedelta(days=delta)

    @staticmethod
    def _next_gregorian_first(start: date) -> date:
        if start.day == 1:
            return start
        year, month = start.year, start.month
        if month == 12:
            return date(year + 1, 1, 1)
        return date(year, month + 1, 1)

    # --------------------------- Tamil solar months ------------------------ #

    def _next_tamil_month_start(self, start: date) -> date:
        if self._is_tamil_month_start(start):
            return start
        probe = start + timedelta(days=1)
        # Tamil month transitions occur roughly every 30 days
        for _ in range(0, 40):
            if self._is_tamil_month_start(probe):
                return probe
            probe += timedelta(days=1)
        raise RuntimeError("Tamil month transition not found within 40 days. Check ephemeris range.")

    def _is_tamil_month_start(self, current: date) -> bool:
        today_idx = self._tamil_month_index(current)
        yesterday_idx = self._tamil_month_index(current - timedelta(days=1))
        return today_idx != yesterday_idx

    def _tamil_month_index(self, day: date) -> int:
        sidereal_lon = self._sun_sidereal_longitude(day)
        return int(math.floor(sidereal_lon / 30.0)) % 12

    # --------------------------- Tithi helpers ----------------------------- #

    def _next_tithi(self, start: date, targets: Iterable[int]) -> date:
        wanted = set(targets)
        probe = start
        for _ in range(0, 65):
            if self._tithi_occurs_on_day(probe, wanted):
                return probe
            probe += timedelta(days=1)
        raise RuntimeError("Tithi not found within search horizon.")

    def _tithi_occurs_on_day(self, day: date, wanted: set[int]) -> bool:
        for minute_offset in range(0, 24 * 60, 30):
            hour, minute = divmod(minute_offset, 60)
            if self._tithi_on(day, hour=hour, minute=minute) in wanted:
                return True
        if self._tithi_on(day, hour=23, minute=59) in wanted:
            return True
        return False

    def _tithi_on(self, day: date, hour: int = 6, minute: int = 0) -> int:
        sun_lon, moon_lon = self._sun_moon_longitudes(day, hour=hour, minute=minute)
        diff = (moon_lon - sun_lon) % 360.0
        return int(diff // 12.0) + 1

    # --------------------------- Nakshatra helpers ------------------------ #

    def _next_nakshatra(self, start: date, index: int) -> date:
        probe = start
        for _ in range(0, 65):
            if self._nakshatra_on(probe) == index:
                return probe
            probe += timedelta(days=1)
        raise RuntimeError("Nakshatra not found within search horizon.")

    def _nakshatra_on(self, day: date) -> int:
        sidereal_lon = self._moon_sidereal_longitude(day)
        return int(math.floor(sidereal_lon / (360.0 / 27.0))) % 27

    def _nakshatra_name(self, index: int) -> str:
        tamil_names = [
            "Ashwini",
            "Bharani",
            "Krittika",
            "Rohini",
            "Mrigashirsha",
            "Ardra",
            "Punarvasu",
            "Pushya",
            "Ashlesha",
            "Magha",
            "Purva Phalguni",
            "Uttara Phalguni",
            "Hasta",
            "Chitra",
            "Swati",
            "Vishakha",
            "Anuradha",
            "Jyeshtha",
            "Mula",
            "Purva Ashadha",
            "Uttara Ashadha",
            "Shravana",
            "Dhanishta",
            "Shatabhisha",
            "Purva Bhadrapada",
            "Uttara Bhadrapada",
            "Revati",
        ]
        if 0 <= index < len(tamil_names):
            return tamil_names[index]
        return f"Nakshatra #{index + 1}"

    # ------------------------- Astronomical helpers ------------------------ #

    def _sun_sidereal_longitude(self, day: date) -> float:
        sun_lon, _ = self._sidereal_longitudes(day)
        return sun_lon

    def _moon_sidereal_longitude(self, day: date) -> float:
        _, moon_lon = self._sidereal_longitudes(day)
        return moon_lon

    def _sidereal_longitudes(self, day: date, hour: int = 6, minute: int = 0) -> tuple[float, float]:
        sun_lon, moon_lon = self._sun_moon_longitudes(day, hour=hour, minute=minute)
        ayanamsa = self._ayanamsa(day)
        return (sun_lon - ayanamsa) % 360.0, (moon_lon - ayanamsa) % 360.0

    def _sun_moon_longitudes(self, day: date, hour: int = 6, minute: int = 0) -> tuple[float, float]:
        instant = datetime.combine(day, time(hour=hour, minute=minute), tzinfo=self.location.tz)
        ts = self._timescale
        utc_dt = instant.astimezone(_utc_zone())
        t = ts.utc(
            utc_dt.year,
            utc_dt.month,
            utc_dt.day,
            utc_dt.hour,
            utc_dt.minute,
            utc_dt.second + utc_dt.microsecond / 1_000_000,
        )
        obs = self._earth.at(t)
        sun_lon = obs.observe(self._sun).apparent().ecliptic_latlon()[1].degrees % 360.0
        moon_lon = obs.observe(self._moon).apparent().ecliptic_latlon()[1].degrees % 360.0
        return sun_lon, moon_lon

    def _ayanamsa(self, day: date) -> float:
        """Approximate Lahiri ayanamsa in degrees."""
        instant = datetime.combine(day, time(6, 0), tzinfo=self.location.tz).astimezone(_utc_zone())
        base = datetime(2000, 1, 1, 12, 0, tzinfo=_utc_zone())
        delta_days = (instant - base).total_seconds() / 86400.0
        years = delta_days / 365.2425
        return (23.85 + years * 0.013968) % 360.0


@lru_cache(maxsize=1)
def get_calendar_service() -> TempleCalendarService:
    return TempleCalendarService()
