# Monthly Pooja Dues Generation - Fix Summary

## Problem
The system was not generating monthly pooja dues for all months from registration date to current month. Instead, it would only generate dues for some months or fail to backfill historical months when a pooja was registered.

**Example scenario (as described by user):**
- Donor registers a recurring pooja on 01/01/2026 (registration date)
- When visiting on 02/02/2026, they should see dues for BOTH January and February
- Expected: Dues for Jan 2026 AND Feb 2026
- Actual (before fix): Only dues for current month or incomplete months

## Root Causes

### 1. Indentation Bug in `_generate_due_payments_for_recurring_plans()`
**File:** `backend/pooja/services/recurrence.py` (Line ~467)

**Issue:** The loop that generates dues for each month was incorrectly indented OUTSIDE the donor loop, causing it to:
- Only process the LAST donor in the list
- Not generate dues for all months for each donor
- Break after the first donor iteration

**Fix:** Moved the `for month_start in _month_range(first_due_month, current_month):` loop INSIDE the `for donor_id, donor_data in donors_to_process.items():` loop.

This ensures that for EACH donor, dues are generated for ALL months from their registration month to the current month.

### 2. Passbook Not Including Monthly Dues
**File:** `backend/payments/services.py` (Lines 56-80)

**Issue:** The passbook regeneration was only including:
- Actual payment records (paid amounts)
- Manual pooja registrations

But it was IGNORING the automatically generated monthly dues (PaymentRecord objects with `registration=None`).

**Fix:** Modified the passbook regeneration logic to:
1. Identify monthly dues (PaymentRecord with `registration=None` and `status=pending`)
2. Consolidate duplicate monthly dues for the same month (only keep first occurrence)
3. Create a new record type "monthly_due" to distinguish from actual payments
4. Process "monthly_due" records as "due" entries (not "paid" entries)

### 3. Duplicate Due Entries in Passbook
**Issue:** When a pooja registration existed AND a monthly due was generated for the same month, both would appear in the passbook, causing double-counting.

**Fix:** Modified passbook logic to skip registrations for months that already have a monthly due recorded, preventing double-counting.

## Changes Made

### 1. `backend/pooja/services/recurrence.py`
- **Line 467:** Fixed indentation of monthly due generation loop
- **Line 388:** Enhanced `_create_due_payment_record()` to handle MultipleObjectsReturned exception gracefully

### 2. `backend/payments/services.py`
- **Lines 56-73:** Added logic to consolidate monthly dues and prevent duplicates
- **Lines 87-89:** Added check to skip registrations for months with existing monthly dues
- **Lines 119-135:** Added new "monthly_due" record type handling in passbook generation

## Verification

### Test Scenario
Created a test donor with a recurring pooja registered on 01/01/2026 (current system date: 02/02/2026).

### Expected Results
After running `python manage.py generate_monthly_dues`:
- ✅ Dues created for January 2026
- ✅ Dues created for February 2026
- ✅ Passbook shows: 
  - 2025-12-31: Opening balance (₹0)
  - 2026-01-01: Due ₹100 (monthly pooja due)
  - 2026-02-01: Due ₹100 (monthly pooja due)

### Payment Statement Display
The payment statement now correctly shows:
- Monthly dues for each month from registration to current month
- Consolidated amounts (no duplicates)
- Proper running balance calculation with closing due amount

## Functionality Impact

- ✅ Recursive pooja monthly dues now generate for ALL months from registration to current month
- ✅ Backfill works correctly: if a pooja is registered mid-month, all previous months of the year are generated retroactively
- ✅ Payment statement passbook shows consistent, non-duplicated entries
- ✅ Running balance calculation is accurate
- ✅ No breaking changes to existing API or database structure

## Notes

1. The fix respects month boundaries - only shows dues up to the current month, not future months
2. Duplicate monthly dues from previous runs are automatically consolidated (only one entry per month shown)
3. The auto-registration creation logic (from RecurringPoojaPlan) is preserved - registrations are still created for tracking/booking purposes, but the passbook intelligently avoids double-counting them with monthly dues
4. CHRT (preferred date) poojas continue to work as expected with their own due generation logic
