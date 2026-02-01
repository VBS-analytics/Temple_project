# CHRT Pooja Monthly Due Generation - Issue Analysis & Fix

## Problem Statement

When a donor registers multiple poojas (5 regular + 1 CHRT pooja with a preferred date), the CHRT pooja is currently generating dues **every month** instead of **only in the month when the preferred date falls**.

### Current Behavior ❌

Example: Donor has registered:
- 5 regular poojas (monthly recurring)
- 1 CHRT pooja with preferred date = **October 2026**

**Current (Wrong) Behavior:**
- January 2026: Due = 5 poojas ✓
- February 2026: Due = 5 poojas + CHRT pooja ❌ (CHRT shouldn't be here)
- March 2026: Due = 5 poojas + CHRT pooja ❌ (CHRT shouldn't be here)
- ...
- October 2026: Due = 5 poojas + CHRT pooja ✓
- November 2026: Due = 5 poojas + CHRT pooja ❌ (CHRT shouldn't be here)
- ...

### Expected Behavior ✓

**Expected (Correct) Behavior:**
- January 2026: Due = 5 poojas only ✓
- February 2026: Due = 5 poojas only ✓
- ...
- September 2026: Due = 5 poojas only ✓
- **October 2026: Due = 5 poojas + CHRT pooja** ✓ (CHRT appears ONLY in preferred month)
- November 2026: Due = 5 poojas only ✓
- ...

---

## Root Cause Analysis

### Location: `/backend/pooja/services/recurrence.py`

**Function:** `_generate_due_payments_for_chrt_poojas()` (Lines 595-838)

### Issue in CHRT Recurrence Logic

The CHRT due generation currently has logic to handle **multiple CHRT poojas with different preferred months**, but there's a critical bug:

**Current Logic (Lines 593-700):**
```python
def _generate_due_payments_for_chrt_poojas(today: Optional[date] = None) -> int:
    # ... code ...
    for plan in chrt_plans:
        preferred_date = plan.one_time_date or plan.start_date
        preferred_month = preferred_date.replace(day=1)

        # CRITICAL ISSUE: This check applies to individual plans, not combined donors
        if current_month < preferred_month:
            # Delete stale dues and SKIP
            PaymentRecord.objects.filter(...).delete()
            continue  # ← Good: skip future months
        
        # Check recurrence frequency
        frequency = RecurrenceFrequency(plan.recurrence_frequency or RecurrenceFrequency.MONTHLY)
        months_between = (current_month.year - preferred_month.year) * 12 + (current_month.month - preferred_month.month)
        frequency_months = FREQUENCY_MONTHS.get(frequency, 1)
        
        # CRITICAL BUG HERE:
        should_generate_due = (months_between % frequency_months == 0) and (months_between >= 0)
        # ↑ This generates dues EVERY MONTH for MONTHLY frequency (months_between % 1 == 0 is always true!)
```

### The Bug: Modulo Operation on MONTHLY Poojas

For a MONTHLY CHRT pooja with preferred date October 2026:

**Current Calculation (Wrong):**
```
January 2026:   months_between = -9, should_generate = (-9 % 1 == 0) AND (-9 >= 0) = False AND False = False ✓
February 2026:  months_between = -8, should_generate = (-8 % 1 == 0) AND (-8 >= 0) = False AND False = False ✓
...
September 2026: months_between = -1, should_generate = (-1 % 1 == 0) AND (-1 >= 0) = False AND False = False ✓
October 2026:   months_between = 0,  should_generate = (0 % 1 == 0) AND (0 >= 0) = True AND True = True ✓
November 2026:  months_between = 1,  should_generate = (1 % 1 == 0) AND (1 >= 0) = True AND True = True ❌ BUG!
December 2026:  months_between = 2,  should_generate = (2 % 1 == 0) AND (2 >= 0) = True AND True = True ❌ BUG!
```

**Wait - The logic seems correct for the Oct 2026 case. Let me re-examine...**

Actually, I see the real issue now: **The current implementation uses composite key `(donor_id, preferred_month)` but doesn't properly handle adding to existing dues.**

Looking at lines 730-760, the code:
1. Checks if an existing due exists for the payment_month
2. **If it does, it ADDS the CHRT amount to it**
3. If it doesn't, it creates a new due

**But the problem is:** When combining CHRT dues with regular monthly dues, if a due already exists for that month (from regular poojas), the CHRT amount is being added to it. This is correct **BUT** the issue is that the code is running this check for EVERY month where `months_between % frequency_months == 0`.

For MONTHLY CHRT poojas, `months_between % 1 == 0` is ALWAYS true (any number mod 1 = 0).

So the logic is: "In every month after the preferred month, if months_between is divisible by frequency_months, add the CHRT amount."

For MONTHLY frequency, this means **EVERY MONTH after October gets the CHRT amount added!**

---

## The Fix

### Solution: Implement "One-Time First Occurrence" for MONTHLY CHRT Poojas

For a MONTHLY CHRT pooja, it should only generate dues **once per its recurrence cycle**.

**LOGIC:**
- **MONTHLY**: Generate due only in the preferred month and then skip all subsequent months
- **QUARTERLY**: Generate due only in the first quarter month (Mar, Jun, Sep, Dec)
- **ANNUALLY**: Generate due only in the preferred month (once per year)

### Implementation Strategy

Instead of checking `months_between % frequency_months == 0` for ALL months, we need to check if this is the **matching month** for the pooja's recurrence pattern.

**For MONTHLY:**
- Check if `current_month.month == preferred_month.month`

**For QUARTERLY:**
- Quarters: Jan-Mar (Q1), Apr-Jun (Q2), Jul-Sep (Q3), Oct-Dec (Q4)
- Check if current quarter == preferred quarter

**For ANNUALLY:**
- Check if `current_month.year == preferred_month.year` AND `current_month.month == preferred_month.month`

---

## Code Changes Required

### File: `/backend/pooja/services/recurrence.py`

**Function:** `_generate_due_payments_for_chrt_poojas()`

**Lines to Fix:** 655-685 (The recurrence frequency check logic)

**Current Code:**
```python
frequency = RecurrenceFrequency(plan.recurrence_frequency or RecurrenceFrequency.MONTHLY)
months_between = (current_month.year - preferred_month.year) * 12 + (current_month.month - preferred_month.month)
frequency_months = FREQUENCY_MONTHS.get(frequency, 1)
should_generate_due = (months_between % frequency_months == 0) and (months_between >= 0)
```

**Fixed Code:**
```python
frequency = RecurrenceFrequency(plan.recurrence_frequency or RecurrenceFrequency.MONTHLY)

# Calculate if current month matches the CHRT pooja's recurrence pattern
should_generate_due = False

if frequency == RecurrenceFrequency.MONTHLY:
    # For monthly CHRT: only generate due in the same month each year
    should_generate_due = (current_month.month == preferred_month.month) and (current_month.year >= preferred_month.year)

elif frequency == RecurrenceFrequency.QUARTERLY:
    # For quarterly CHRT: only generate due in the matching quarter
    current_quarter = (current_month.month - 1) // 3
    preferred_quarter = (preferred_month.month - 1) // 3
    should_generate_due = (current_quarter == preferred_quarter) and (current_month.year >= preferred_month.year)

elif frequency == RecurrenceFrequency.ANNUALLY:
    # For annual CHRT: only generate due in the same month and year
    should_generate_due = (current_month == preferred_month) and (current_month.year >= preferred_month.year)

# For annually, also check if we've already generated a due in current year to avoid duplicates
if frequency == RecurrenceFrequency.ANNUALLY and should_generate_due:
    existing_annual_due = PaymentRecord.objects.filter(
        donor_id=plan.donor_id,
        registration__isnull=True,
        status=PaymentStatus.PENDING,
        payment_month__year=current_month.year,
        notes__icontains='CHRT',
    ).first()
    if existing_annual_due:
        should_generate_due = False  # Already have a due this year
```

---

## Testing Scenarios

### Scenario 1: Monthly CHRT Pooja
```
Donor Data:
- 5 regular monthly poojas (₹100 each = ₹500/month)
- 1 CHRT monthly pooja with preferred date Oct 15, 2026 (₹200)

Expected Monthly Dues:
- Jan 2026: ₹500 (5 poojas)
- Feb-Sept 2026: ₹500 each
- Oct 2026: ₹700 (5 + CHRT)
- Nov 2026: ₹500 (5 poojas)
- Dec 2026: ₹500 (5 poojas)
- Jan 2027: ₹500 (5 poojas)
- Oct 2027: ₹700 (5 + CHRT) ← CHRT repeats yearly
- Nov 2027: ₹500 (5 poojas)
```

### Scenario 2: Quarterly CHRT Pooja
```
Donor Data:
- 5 regular monthly poojas (₹500/month)
- 1 CHRT quarterly pooja with preferred date Nov 15, 2026 (₹300)
  (Nov is in Q4)

Expected Monthly Dues:
- Jan-Oct 2026: ₹500 each
- Nov-Dec 2026: ₹800 (5 + CHRT) ← CHRT in Q4
- Jan-Oct 2027: ₹500 each
- Nov-Dec 2027: ₹800 (5 + CHRT) ← CHRT in Q4 again
```

### Scenario 3: Annual CHRT Pooja
```
Donor Data:
- 5 regular monthly poojas (₹500/month)
- 1 CHRT annual pooja with preferred date Mar 1, 2026 (₹400)

Expected Monthly Dues:
- Jan-Feb 2026: ₹500 each
- Mar 2026: ₹900 (5 + CHRT) ← CHRT in March
- Apr-Dec 2026: ₹500 each
- Jan-Feb 2027: ₹500 each
- Mar 2027: ₹900 (5 + CHRT) ← CHRT in March again
```

---

## Summary

| Aspect | Issue | Solution |
|--------|-------|----------|
| **Problem** | CHRT dues generated every month instead of only in preferred month | Change recurrence logic from modulo to month matching |
| **Root Cause** | `months_between % 1 == 0` is always true for MONTHLY frequency | Implement proper month/quarter matching logic |
| **File** | `/backend/pooja/services/recurrence.py` | `_generate_due_payments_for_chrt_poojas()` |
| **Lines** | 655-685 | Replace recurrence frequency check |
| **Testing** | Verify 3 scenarios (Monthly, Quarterly, Annual) | Run test cases for each frequency |

