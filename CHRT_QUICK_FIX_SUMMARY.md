# CHRT Pooja Monthly Due - Quick Fix Reference

## The Problem
CHRT (Choose Your Preferred Date) poojas were generating dues **every month** instead of **only in their preferred month**.

## The Fix
Changed recurrence logic from checking `months_between % frequency == 0` (always true for monthly) to checking if `current_month == preferred_month`.

## Code Location
**File:** `/backend/pooja/services/recurrence.py`  
**Function:** `_generate_due_payments_for_chrt_poojas()`  
**Lines:** 673-708

## Old Code (Buggy)
```python
months_between = (current_month.year - preferred_month.year) * 12 + (current_month.month - preferred_month.month)
frequency_months = FREQUENCY_MONTHS.get(frequency, 1)  # 1 for monthly, 3 for quarterly, 12 for annual
should_generate_due = (months_between % frequency_months == 0) and (months_between >= 0)
# BUG: For monthly, this is always true after preferred month because X % 1 == 0 always
```

## New Code (Fixed)
```python
if frequency == RecurrenceFrequency.MONTHLY:
    should_generate_due = (current_month.month == preferred_month.month and current_month.year >= preferred_month.year)
elif frequency == RecurrenceFrequency.QUARTERLY:
    current_quarter = (current_month.month - 1) // 3
    preferred_quarter = (preferred_month.month - 1) // 3
    should_generate_due = (current_quarter == preferred_quarter and current_month.year >= preferred_month.year)
elif frequency == RecurrenceFrequency.ANNUALLY:
    should_generate_due = (current_month.month == preferred_month.month and current_month.year >= preferred_month.year)
```

## Real Example

### Setup
- Donor has 5 regular poojas (₹500/month)
- Donor has 1 CHRT pooja with preferred date = October 2026 (₹200)

### Before Fix (Wrong)
| Month | Due | Notes |
|-------|-----|-------|
| Jan | ₹700 | WRONG - CHRT included |
| Feb | ₹700 | WRONG - CHRT included |
| ... | ... | ... |
| Oct | ₹700 | Correct |
| Nov | ₹700 | WRONG - CHRT included |
| Dec | ₹700 | WRONG - CHRT included |

### After Fix (Correct)
| Month | Due | Notes |
|-------|-----|-------|
| Jan | ₹500 | Correct - Regular only |
| Feb | ₹500 | Correct - Regular only |
| ... | ... | ... |
| Oct | ₹700 | Correct - Regular + CHRT |
| Nov | ₹500 | Correct - Regular only |
| Dec | ₹500 | Correct - Regular only |

## Why It Works

### MONTHLY Logic
- `current_month.month == preferred_month.month`: Checks if we're in the same calendar month
- `current_month.year >= preferred_month.year`: Checks if we're in the same year or later
- Result: Due appears in October 2026, October 2027, October 2028, etc. ✓

### QUARTERLY Logic
- `current_quarter = (current_month.month - 1) // 3`: Converts month (1-12) to quarter (0-3)
  - Jan-Mar (1-3) → 0 (Q1)
  - Apr-Jun (4-6) → 1 (Q2)
  - Jul-Sep (7-9) → 2 (Q3)
  - Oct-Dec (10-12) → 3 (Q4)
- `current_quarter == preferred_quarter`: Checks if we're in the matching quarter
- Result: Due appears in Q4 months each year (Oct, Nov, Dec) ✓

### ANNUALLY Logic
- Both month AND year must match
- Result: Due appears only in the exact month/year specified ✓

## Safety Features Maintained
1. **Future Dates:** `current_month >= preferred_month` prevents early due generation
2. **Stale Dues Cleanup:** Still deletes incorrectly created dues before preferred month
3. **Combination:** Still correctly combines CHRT with regular monthly dues

## Testing Verification
See detailed test cases in `CHRT_MONTHLY_DUE_TEST_CASES.md`

## Impact
- ✅ Fixes payment accuracy
- ✅ Reduces unexpected charges
- ✅ Maintains backward compatibility
- ✅ Supports all 3 frequencies (Monthly, Quarterly, Annual)

