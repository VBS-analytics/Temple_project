# Tamil Star Timing Logic (Full Month Example)

Last updated: 18 May 2026

## Purpose
This note explains, in simple language, how Tamil star is fetched for every day in a month.

## Short answer
Tamil star is **calculated**, not typed manually.

For each date:
1. System checks moon position for that date.
2. Finds which nakshatra (star) is active.
3. Converts it to Tamil star name.
4. Sends it to Ubhayam Report.

---

## Where it is used
In Ubhayam Report, this value appears in the column:
- `Tamil Star`

---

## Monthly flow (how one whole month is generated)

When you open a month (example: **May 2026**):

1. Frontend requests month data:
- `year=2026`
- `month=5`

2. Backend loops day-by-day:
- 1 May 2026
- 2 May 2026
- 3 May 2026
- ...
- 31 May 2026

3. For each day, backend calculates star:
- Gets star index (0 to 26)
- Maps index to star name (English + Tamil/native)

4. API returns a list like:
- `date: 2026-05-01, tamil_star_native: சுவாதி`
- `date: 2026-05-02, tamil_star_native: விசாகம்`
- ...

5. Frontend fills the report’s Tamil Star column using:
- `tamil_star_native` first (Tamil text)
- fallback to `tamil_star` if native text not present

---

## Full example style (May 2026)

This is the exact style of how system handles each date:

1. `2026-05-01`  
- calculate star -> map result -> store for that date

2. `2026-05-02`  
- calculate star -> map result -> store for that date

3. `2026-05-03`  
- calculate star -> map result -> store for that date

...

31. `2026-05-31`  
- calculate star -> map result -> store for that date

Then all 31 day results are shown in report.

---

## Important clarification about “timing”

For Tamil star in Ubhayam:
- There is **no single visible fixed time rule** like “9 AM” in report text.
- It uses astronomy-based date calculation from the calendar service for each day.

So Tamil star is date-wise computed output, not a manual/static table.

---

## How resource person can verify quickly

For any selected month:

1. Pick 3-5 sample dates from Ubhayam Report.
2. Compare Tamil star for those dates with trusted Tamil calendar source.
3. If all sample dates match, month star mapping is likely correct.
4. If mismatch appears, report the exact:
- Date
- Star shown in app
- Star expected from reference calendar

---

## Related note
Tamil star logic is separate from day-option timing rules (Sashti/Ashtami/Pradosham etc.).
Those options have their own time-check logic; Tamil star column is its own astronomy-based daily computation.

