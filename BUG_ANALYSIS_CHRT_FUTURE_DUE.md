# BUG ANALYSIS: CHRT Pooja Due Appearing in Wrong Month

## Problem Statement
A donor registers:
- 4 recurring poojas @ ₹400/month each (total ₹400 for the month)
- 1 CHRT (Choose Your Preferred Date) pooja with preferred date **Feb 6, 2026** @ ₹500

**Expected behavior:** 
- January 2026 statement should show: ₹400 due (only recurring poojas)
- February 2026 statement should show: ₹900 due (₹400 recurring + ₹500 CHRT)

**Actual behavior:**
- January 2026 statement shows: ₹900 due (both recurring AND CHRT)
- CHRT amount is appearing in the current month instead of the future month

---

## Root Cause

### Location
**File:** `backend/pooja/services/recurrence.py`  
**Function:** `_generate_due_payments_for_chrt_poojas()` (lines 558-680)

### The Logic Flaw

#### Correct Part (Lines 595-605)
```python
preferred_date = plan.one_time_date or plan.start_date
if not preferred_date:
    preferred_date = plan.created_at.date() if plan.created_at else None
if not preferred_date:
    continue

preferred_month = preferred_date.replace(day=1)

# If the preferred month is in the future, skip creating a due now
if current_month < preferred_month:  # 2026-01-01 < 2026-02-01 = TRUE
    continue  # ✓ Should skip CHRT poojas with future dates
```

This logic is **correct** and SHOULD prevent creating a due for CHRT poojas with future dates.

#### The Actual Problem - Mixed Dues

Looking at the code flow, the issue appears to be in how **combined monthly dues** are created. The problem is that:

1. When `process_recurring_plans()` is called at lines 686-687:
   ```python
   due_payments_created = _generate_due_payments_for_recurring_plans(now)
   chrt_due_payments_created = _generate_due_payments_for_chrt_poojas(now)
   ```

2. The **first function** `_generate_due_payments_for_recurring_plans()` (lines 345-441) creates a **combined due** for the current month with ALL active recurring plans excluding CHRT.

3. The **second function** `_generate_due_payments_for_chrt_poojas()` (lines 558-680) should create a separate due for CHRT poojas.

#### The Confusion Point

When both functions execute:
- **Function 1** creates: `₹400` due for Jan 2026 (recurring plans)
- **Function 2** SHOULD NOT create anything for Jan 2026 (CHRT is Feb)

However, if a CHRT plan is NOT properly identified or if there's a filter issue, it might be:
1. Getting included in the "recurring" due calculation, OR
2. Creating its own separate due for the current month instead of the preferred month

### Hypothesis: The _chrt_plan_filter() Issue

**Lines 444-448:**
```python
def _chrt_plan_filter() -> Q:
    """Identify CHRT (preferred-date) plans even if the day option was not saved."""
    return Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
```

**Issue:** The filter `Q(one_time_date__isnull=False)` is too broad!

- `one_time_date` is set for ANY CHRT pooja
- Regular recurring poojas should NOT have `one_time_date` set
- BUT if it's set for ALL CHRT poojas, the filter should work

#### But Wait - There's Another Issue

Looking at line 366 in `_generate_due_payments_for_recurring_plans()`:
```python
# Exclude CHRT poojas (including legacy rows where day_option was null) -
# they are handled separately in _generate_due_payments_for_chrt_poojas.
active_plans = active_plans.exclude(_chrt_plan_filter())
```

This **should** exclude CHRT poojas from the recurring calculation. If it doesn't, we have a filter bug.

---

## The Real Issue - Payment Record Query Logic

After deeper analysis, the problem likely lies in how **PaymentRecord objects** are being created and queried.

Looking at the Payment Statement page (lines 673-700 in PaymentStatementPage.tsx), the system fetches payment records for display. The issue is that:

1. A **combined PaymentRecord** might be created for Jan 2026 with amount ₹900
2. This single record includes BOTH recurring (₹400) AND CHRT (₹500)
3. Instead of keeping them separate until the correct month

### The Smoking Gun - Lines 649-677

```python
def _generate_due_payments_for_chrt_poojas(today: Optional[date] = None) -> int:
    # ...
    for composite_key, donor_data in donors_to_process.items():
        # ...
        due_record, created = PaymentRecord.objects.get_or_create(
            donor_id=donor_id,
            registration=None,
            payment_month=payment_month,  # ← Uses preferred_month (Feb for CHRT)
            defaults={
                'amount': total_amount,
                'currency': 'INR',
                'mode': 'pending',
                'status': PaymentStatus.PENDING,
                'notes': 'CHRT (Preferred Date) pooja contribution due',
            }
        )
```

**This looks correct!** It's using `payment_month=payment_month` where `payment_month` is set to `preferred_month`.

---

## Investigation Needed

The bug could be happening at multiple levels:

### Level 1: Due Generation (Backend)
- Is `_chrt_plan_filter()` correctly identifying CHRT plans?
- Are CHRT dues being created for the current month instead of preferred month?

### Level 2: Recurring + CHRT Combination
- Are recurring and CHRT dues being combined into a single record?
- Is there a query that's summing both types together?

### Level 3: Frontend Display
- Are multiple payment records being summed together for display?
- Is the payment_month filter working correctly?

---

## Solution Strategy

The fix needs to ensure:

1. **CHRT poojas with future preferred dates should NOT generate any due in current month**
   - Add explicit validation in `_generate_due_payments_for_chrt_poojas()`
   
2. **Separate tracking of CHRT and recurring dues**
   - Keep them in separate PaymentRecord entries
   - Don't mix amounts in a single record

3. **Frontend filtering**
   - Ensure payment statements only show dues for the correct month

4. **Add comprehensive tests**
   - Test case: CHRT pooja with future date (Feb 6) registered in Jan
   - Verify Jan statement shows ₹400
   - Verify Feb statement shows ₹900

---

## Key Code Sections to Review

1. `_generate_due_payments_for_recurring_plans()` - lines 345-441
2. `_generate_due_payments_for_chrt_poojas()` - lines 558-680
3. `_chrt_plan_filter()` - lines 444-448
4. `PaymentStatementPage.tsx` - Payment record filtering and display logic

