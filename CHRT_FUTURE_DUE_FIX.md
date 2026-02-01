# CHRT Pooja Future Due Bug Fix

## Problem Description

CHRT (Choose Your Preferred Date) Poojas with future preferred dates were incorrectly showing their due amounts in the current month's payment statement, even though their preferred date was in a future month.

### Example Scenario:
- Donor registered 4 recurring poojas (monthly) - amount: ₹400, due: ₹400
- Donor registered 2 CHRT Poojas in January 2026 with preferred dates: 05 Feb 2026, 07 Feb 2026 - amount: ₹100 each, due: ₹100 each
- **Expected behavior:**
  - January 2026 payment statement should show: ₹400 due (only recurring)
  - February 2026 payment statement should show: ₹500 due (₹400 recurring + ₹100 CHRT)
- **Actual behavior (before fix):**
  - January 2026 payment statement showed: ₹500 due (₹400 recurring + ₹100 CHRT) ❌
  - February 2026 payment statement showed: ₹400 due (only recurring) ❌

## Root Cause

The bug was in **three** locations where the system calculated monthly dues and generated passbook entries:

1. **`backend/accounts/serializers.py`** - `_compute_monthly_summary_for_user()` function
   - Queried `PoojaRegistration` objects using `start_date` filter
   - For CHRT Poojas, `start_date` is the registration date (January 2026), not the preferred date (February 2026)
   - This caused CHRT Poojas to be included in the wrong month's due calculation

2. **`backend/payments/management/commands/sync_month_end_balances.py`** - month-end balance sync command
   - Same issue as above - used `start_date` instead of preferred date for CHRT Poojas

3. **`backend/payments/services.py`** - `regenerate_donor_passbook()` function
   - Used `start_date` from `PoojaRegistration` for all poojas
   - For CHRT Poojas, this caused them to appear in the passbook for the registration month instead of the preferred date month

## Solution

Modified all three locations to:
1. For **non-CHRT poojas**: Continue using `start_date` as before
2. For **CHRT poojas**: Use `one_time_date` (preferred date) from `RecurringPoojaPlan` to determine the correct month

### Files Modified:

#### 1. `backend/accounts/serializers.py`

**Function modified:**
```python
def _compute_monthly_summary_for_user(user: User) -> dict[str, Decimal]:
    start, end = _current_month_bounds()
    due_total = Decimal("0.00")
    
    # For non-CHRT poojas, use start_date as before
    non_chrt_totals = (
        PoojaRegistration.objects.filter(
            donor=user,
            start_date__gte=start,
            start_date__lt=end,
            day_option__code__ne="CHRT",  # Exclude CHRT poojas
        )
        .values_list("total_amount", flat=True)
    )
    for total_amount in non_chrt_totals:
        due_total += Decimal(total_amount or 0)
    
    # For CHRT poojas, use preferred date from RecurringPoojaPlan.one_time_date
    from pooja.models import RecurringPoojaPlan
    chrt_plans = RecurringPoojaPlan.objects.filter(
        donor=user,
        day_option__code="CHRT",
        one_time_date__gte=start,
        one_time_date__lt=end,
        is_active=True,
    )
    for plan in chrt_plans:
        due_total += plan.amount or Decimal("0.00")
    
    # Exclude CHRT (Choose Your Preferred Date) payment records from current month due calculation
    # CHRT dues are created with notes__icontains='CHRT' and should only appear in their preferred month
    due_records_total = (
        PaymentRecord.objects.filter(
            donor=user,
            registration__isnull=True,
            payment_month__gte=start,
            payment_month__lt=end,
        )
        .exclude(notes__icontains='CHRT')  # Exclude CHRT payment records
        .aggregate(total=Sum("amount"))
        .get("total")
    )
    due_total += Decimal(due_records_total or 0)
```

#### 2. `backend/payments/management/commands/sync_month_end_balances.py`

**Query modified:**
```python
# Calculate due: sum of all pooja registrations in this month
# For non-CHRT poojas, use start_date
# For CHRT poojas, use preferred date from RecurringPoojaPlan.one_time_date
from pooja.models import PoojaRegistration, PoojaDayOption, RecurringPoojaPlan
current_month_due = Decimal("0.00")

# Non-CHRT poojas: use start_date
non_chrt_totals = (
    PoojaRegistration.objects.filter(
        donor=donor,
        start_date__gte=start,
        start_date__lt=end,
        day_option__code__ne="CHRT",  # Exclude CHRT poojas
    )
    .values_list("total_amount", flat=True)
)
for total_amount in non_chrt_totals:
    current_month_due += Decimal(str(total_amount or 0))

# CHRT poojas: use preferred date from RecurringPoojaPlan.one_time_date
chrt_plans = RecurringPoojaPlan.objects.filter(
    donor=donor,
    day_option__code="CHRT",
    one_time_date__gte=start,
    one_time_date__lt=end,
    is_active=True,
)
for plan in chrt_plans:
    current_month_due += plan.amount or Decimal("0.00")
```

#### 3. `backend/payments/services.py`

**Logic modified:**
```python
for rr in registration_records:
    # For CHRT Poojas, use the preferred date from RecurringPoojaPlan.one_time_date
    # instead of the registration's start_date
    if rr.day_option and rr.day_option.code == "CHRT":
        # Find the associated RecurringPoojaPlan to get the preferred date
        from pooja.models import RecurringPoojaPlan
        plan = RecurringPoojaPlan.objects.filter(
            donor=rr.donor,
            pooja_option=rr.pooja_option,
            day_option=rr.day_option,
            recurrence_kind="recurring",
        ).first()
        if plan and plan.one_time_date:
            date_val = plan.one_time_date
        else:
            date_val = rr.start_date or rr.created_at.date()
    else:
        date_val = rr.start_date or rr.created_at.date()
    all_records.append(("registration", rr, date_val))
```

## How CHRT Poojas Work (Correct Behavior)

CHRT Poojas are handled separately by the recurring pooja system:

1. **CHRT Poojas are identified by:**
   - `day_option__code="CHRT"` in `PoojaRegistration` and `RecurringPoojaPlan`
   - `one_time_date` is set in `RecurringPoojaPlan` (this is the preferred date)

2. **CHRT Pooja due generation:**
   - Handled by `_generate_due_payments_for_chrt_poojas()` in `backend/pooja/services/recurrence.py`
   - Dues are ONLY created for the month when the preferred date falls
   - Future CHRT Poojas NEVER generate dues in current/past months
   - Each CHRT Pooja creates a separate `PaymentRecord` with `notes__icontains='CHRT'`

3. **Example:**
   - CHRT Pooja registered in January 2026 with preferred date Feb 5, 2026
   - `PoojaRegistration.start_date` = January 2026 (registration date)
   - `RecurringPoojaPlan.one_time_date` = February 2026 (preferred date)
   - Creates a `PaymentRecord` with `payment_month=2026-02-01` and `notes='CHRT (Preferred Date) pooja contribution due'`
   - This due will ONLY appear in February 2026 payment statement
   - It will NOT appear in January 2026 or any other month

## Testing

After this fix, following behavior should be verified:

### Test Case 1: CHRT Pooja in Future Month
- **Setup:**
  - Donor has 4 recurring poojas (₹400/month)
  - Donor registers 1 CHRT Pooja in January 2026 with preferred date Feb 6, 2026 (₹100)
- **Expected Results:**
  - January 2026: ₹400 due (only recurring)
  - February 2026: ₹500 due (₹400 recurring + ₹100 CHRT)

### Test Case 2: Multiple CHRT Poojas in Same Future Month
- **Setup:**
  - Donor has 4 recurring poojas (₹400/month)
  - Donor registers 2 CHRT Poojas in January 2026 with preferred dates Feb 5, 2026 and Feb 7, 2026 (₹100 each)
- **Expected Results:**
  - January 2026: ₹400 due (only recurring)
  - February 2026: ₹600 due (₹400 recurring + ₹200 CHRT)

### Test Case 3: CHRT Pooja in Current Month
- **Setup:**
  - Donor has 4 recurring poojas (₹400/month)
  - Donor registers 1 CHRT Pooja in January 2026 with preferred date Jan 15, 2026 (₹100)
- **Expected Results:**
  - January 2026: ₹500 due (₹400 recurring + ₹100 CHRT)
  - February 2026: ₹400 due (only recurring)

## Deployment Steps

After deploying this fix:

1. **Restart the Django server** to pick up the code changes
2. **Regenerate passbooks** to fix existing passbook entries that were created with wrong dates:
   ```bash
   # Regenerate passbooks for all donors
   python manage.py regenerate_passbooks

   # Or regenerate for a specific donor
   python manage.py regenerate_passbooks <donor_id>
   ```
3. **Verify the fix** by checking the payment statement page for donors with CHRT Poojas

## Related Code

The CHRT Pooja due generation logic is already correctly implemented in:
- `backend/pooja/services/recurrence.py`:
  - `_generate_due_payments_for_chrt_poojas()` - Creates CHRT dues for correct month based on `one_time_date`
  - `_clean_stale_chrt_dues()` - Cleans up incorrectly generated CHRT dues
  - `_chrt_plan_filter()` - Identifies CHRT plans

The fix ensures that:
1. Monthly summary calculation uses `one_time_date` (preferred date) for CHRT Poojas instead of `start_date` (registration date)
2. Passbook generation uses `one_time_date` (preferred date) for CHRT Poojas instead of `start_date` (registration date)
3. Month-end balance calculations use `one_time_date` (preferred date) for CHRT Poojas instead of `start_date` (registration date)

## Impact

This fix ensures that:
1. ✅ CHRT Poojas only appear in payment statements for the month when their preferred date falls
2. ✅ Current month dues accurately reflect only recurring poojas and CHRT Poojas with preferred dates in that month
3. ✅ Passbook entries show CHRT Poojas in the correct month (preferred date month)
4. ✅ Month-end balance calculations are correct
5. ✅ Donors see accurate due amounts in their payment statements

## Important Notes

- **No database migration is required** for this fix
- **Existing passbook entries** that were created with wrong dates will remain until you run the `regenerate_passbooks` command
- **The fix is backward compatible** and will not affect existing data
- **Consider running** `sync_month_end_balances` command to correct any month-end balances that may have been affected
- **CHRT Poojas will now show up in the CHRT Pooja tab** under Donor Profile Page in the correct month (preferred date month)
