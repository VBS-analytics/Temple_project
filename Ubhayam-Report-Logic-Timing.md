# Ubhayam Report - Simple Overview (Non-Technical)

Last updated: 18 May 2026

## What this report is
Ubhayam Report is a **monthly calendar view**.

For each day, it shows:
- Date
- Day name
- Tamil star
- Pooja day option(s)
- Daily message text
- Donor ID, donor name, donor mobile number

## How the report is prepared (simple flow)
Think of it in 3 steps:

1. **Calendar details are prepared**
- Date, day, Tamil star
- Special day options like Sashti, Ashtami, Pradosham, etc.

2. **Donor details are added**
- From registration records
- From recurring plans
- From saved cart/snapshot records

3. **Daily message is built**
- Base message depends on weekday
- Extra lines are added when special day options apply

## Important point: Not everything is time-based
Only some special day options depend on a specific time check.
Other fields are simple calendar or donor data.

## Special day options and their time rules
These are the business rules currently used:

- **Sashti**: checked at **12:00 noon**
- **2 Ashtami**:
  - Uses Ashtami dates in the month
  - If Ashtami spans 2 days, report uses the **first day**
- **Pradosham**: checked at **6:00 PM**
- **Pournami**: checked at **12:00 noon**
- **Amavasya**: checked at **12:00 noon**
- **Sankatachaturti**: checked at **9:00 PM**
- **Chaturthi**: checked at **9:00 AM**

## Weekly / monthly options (no special time check)
- 1st day of English month
- 1st day of Tamil month
- 1st Tuesday
- Last Saturday
- Every Sunday

## Recent corrections (for your reference)
Two important corrections were applied:

1. **Chaturthi fix**
- Earlier, Chaturthi used noon logic in this report.
- Now it uses morning logic, so valid Chaturthi day appears correctly.

2. **2 Ashtami fix**
- Earlier, in two-day Ashtami spans, second day could appear.
- Now report uses first Ashtami day (example pattern like 9 and 23).

## Why production and local may differ sometimes
If report output is different between environments, common reasons are:
- Different donor/plan data in DB
- Different paused/cancelled records
- Different saved snapshots
- Cache not refreshed

## What resource person should validate each month
Please verify these points:

1. All dates and day names are correct.
2. Tamil stars are correct.
3. Special day options appear on expected dates:
   - Sashti, 2 Ashtami, Pradosham, Pournami, Amavasya, Sankatachaturti, Chaturthi.
4. Donor names/IDs/mobile numbers appear on the right dates.
5. Daily message includes proper extra lines for special days.

## In one line
Ubhayam Report is a monthly day-by-day sheet where some pooja options are decided by fixed time rules, and donor/message details are then attached to those dates.

