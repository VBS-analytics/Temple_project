"""
Nakshatra date overrides — manually verified against the temple's reference
calendar (mahacalendar.com).

When to add an entry here:
  Run: python manage.py check_nakshatra --month=M --year=YYYY
  If the system output differs from the printed calendar, add the date here.

Format:
  date(YYYY, MM, DD): index,  # star name — reason

Nakshatra index reference (0-26):
  0  அசுவினி   1  பரணி       2  கிருத்திகை  3  ரோகிணி     4  மிருகசீரிடம்
  5  திருவாதிரை 6  புனர்பூசம் 7  பூசம்      8  ஆயில்யம்  9  மகம்
  10 பூரம்      11 உத்தரம்    12 அஸ்தம்     13 சித்திரை  14 சுவாதி
  15 விசாகம்    16 அனுஷம்    17 கேட்டை    18 மூலம்     19 பூராடம்
  20 உத்திராடம் 21 திருவோணம் 22 அவிட்டம்  23 சதயம்    24 பூரட்டாதி
  25 உத்திரட்டாதி 26 ரேவதி
"""

from datetime import date

NAKSHATRA_DATE_OVERRIDES: dict[date, int] = {

    # ── May 2026 ──────────────────────────────────────────────────────────────
    # Star transitions happen before sunrise; algorithm picks previous star.
    date(2026, 5, 21): 6,   # புனர்பூசம் (Punarvasu)
    date(2026, 5, 22): 7,   # பூசம் (Pushya)
    date(2026, 5, 23): 8,   # ஆயில்யம் (Ashlesha)
    date(2026, 5, 24): 9,   # மகம் (Magha)
    date(2026, 5, 25): 10,  # பூரம் (Purva Phalguni)
    date(2026, 5, 26): 11,  # உத்தரம் (Uttara Phalguni)

    # ── June 2026 ─────────────────────────────────────────────────────────────
    # Star transitions between 3–5 AM (before sunrise ~5:48 AM).
    date(2026, 6, 6): 22,   # அவிட்டம் (Dhanishta)       — திருவோணம் ends 3:43 AM
    date(2026, 6, 7): 23,   # சதயம் (Shatabhisha)         — அவிட்டம் ends ~4:47 AM
    date(2026, 6, 8): 24,   # பூரட்டாதி (Purva Bhadrapada) — சதயம் ends ~5:21 AM
    date(2026, 6, 9): 25,   # உத்திரட்டாதி (Uttara Bhadrapada) — பூரட்டாதி ends ~5:25 AM
    date(2026, 6, 10): 26,  # ரேவதி (Revati)
    date(2026, 6, 11): 0,   # அசுவினி (Ashwini)
    date(2026, 6, 12): 1,   # பரணி (Bharani)              — அசுவினி ends ~3:08 AM

    # ── July 2026 ─────────────────────────────────────────────────────────────
    date(2026, 7, 25): 16,  # அனுஷம் (Anuradha)

    # ── August 2026 ───────────────────────────────────────────────────────────
    date(2026, 8, 14): 9,   # மகம் (Magha)
    date(2026, 8, 15): 10,  # பூரம் (Purva Phalguni)
    date(2026, 8, 16): 11,  # உத்தரம் (Uttara Phalguni)
    date(2026, 8, 17): 12,  # அஸ்தம் (Hasta)
    date(2026, 8, 18): 13,  # சித்திரை (Chitra)

    # ── October 2026 ──────────────────────────────────────────────────────────
    date(2026, 10, 2): 3,   # ரோகிணி (Rohini)

    # ── November 2026 ─────────────────────────────────────────────────────────
    date(2026, 11, 2): 7,   # பூசம் (Pushya)
    date(2026, 11, 3): 8,   # ஆயில்யம் (Ashlesha)
    date(2026, 11, 4): 9,   # மகம் (Magha)
    date(2026, 11, 5): 10,  # பூரம் (Purva Phalguni)
    date(2026, 11, 7): 12,  # அஸ்தம் (Hasta)
    date(2026, 11, 19): 24, # பூரட்டாதி (Purva Bhadrapada)

    # ── December 2026 ─────────────────────────────────────────────────────────
    date(2026, 12, 13): 21, # திருவோணம் (Shravana) — full day per calendar (60 ghatikas)
    date(2026, 11, 20): 25, # உத்திரட்டாதி (Uttara Bhadrapada)
    date(2026, 11, 21): 26, # ரேவதி (Revati)
    date(2026, 11, 22): 0,  # அசுவினி (Ashwini)
}
