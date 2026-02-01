# Test Script for CHRT Pooja Monthly Due Generation Fix

## Testing the Fix

The following test cases verify that CHRT poojas now generate dues **only in their preferred month/quarter/year**, not every month.

### Test Case 1: Monthly CHRT Pooja

**Setup:**
```python
from datetime import date
from decimal import Decimal
from django.utils import timezone
from pooja.models import RecurringPoojaPlan, RecurrenceKind, RecurrenceFrequency, PoojaDayOption
from payments.models import PaymentRecord, PaymentStatus
from pooja.services.recurrence import process_recurring_plans

# Create test donor (assuming donor_id = 123)
donor_id = 123

# Create 5 regular monthly poojas (₹100 each)
# (Assume these already exist)

# Create CHRT pooja with preferred date October 15, 2026
day_option = PoojaDayOption.objects.get(code='CHRT')
chrt_plan = RecurringPoojaPlan.objects.create(
    donor_id=donor_id,
    pooja_option_id=1,  # Your pooja option
    day_option=day_option,
    recurrence_kind=RecurrenceKind.RECURRING,
    recurrence_frequency=RecurrenceFrequency.MONTHLY,
    start_date=date(2026, 10, 15),  # October 2026
    amount=Decimal('200.00'),
    is_active=True,
)
```

**Test Execution:**
```python
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'temple_backend.settings')
import django
django.setup()

# Test for each month from January to December 2026
test_dates = [
    date(2026, 1, 1),   # January
    date(2026, 2, 1),   # February
    date(2026, 3, 1),   # March
    date(2026, 4, 1),   # April
    date(2026, 5, 1),   # May
    date(2026, 6, 1),   # June
    date(2026, 7, 1),   # July
    date(2026, 8, 1),   # August
    date(2026, 9, 1),   # September
    date(2026, 10, 1),  # October (CHRT preferred month)
    date(2026, 11, 1),  # November
    date(2026, 12, 1),  # December
]

expected_dues = {
    1: 500,      # January: 5 poojas only
    2: 500,      # February: 5 poojas only
    3: 500,      # March: 5 poojas only
    4: 500,      # April: 5 poojas only
    5: 500,      # May: 5 poojas only
    6: 500,      # June: 5 poojas only
    7: 500,      # July: 5 poojas only
    8: 500,      # August: 5 poojas only
    9: 500,      # September: 5 poojas only
    10: 700,     # October: 5 + CHRT (200)
    11: 500,     # November: 5 poojas only
    12: 500,     # December: 5 poojas only
}

# Clear previous dues for clean testing
PaymentRecord.objects.filter(donor_id=donor_id, registration__isnull=True).delete()

results = []
for test_date in test_dates:
    # Clear previous due for this test
    PaymentRecord.objects.filter(
        donor_id=donor_id,
        registration__isnull=True,
        payment_month=test_date
    ).delete()
    
    # Process recurring plans for this date
    result = process_recurring_plans(test_date)
    
    # Get the due for this month
    due_record = PaymentRecord.objects.filter(
        donor_id=donor_id,
        registration__isnull=True,
        payment_month=test_date,
        status=PaymentStatus.PENDING
    ).first()
    
    actual_amount = float(due_record.amount) if due_record else 0
    expected_amount = expected_dues.get(test_date.month, 0)
    
    status = "✓ PASS" if actual_amount == expected_amount else "✗ FAIL"
    results.append({
        'month': test_date.strftime('%B %Y'),
        'expected': expected_amount,
        'actual': actual_amount,
        'status': status,
        'notes': due_record.notes if due_record else "No due created"
    })

# Print results
print("\n" + "="*80)
print("TEST CASE 1: MONTHLY CHRT POOJA")
print("="*80)
for r in results:
    print(f"{r['month']:<20} Expected: ₹{r['expected']:<6} Actual: ₹{r['actual']:<6} {r['status']}")
    print(f"  Notes: {r['notes']}")

print("\n" + "="*80)
pass_count = sum(1 for r in results if "PASS" in r['status'])
fail_count = sum(1 for r in results if "FAIL" in r['status'])
print(f"Results: {pass_count} Passed, {fail_count} Failed")
print("="*80)
```

**Expected Output:**
```
================================================================================
TEST CASE 1: MONTHLY CHRT POOJA
================================================================================
January 2026         Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
February 2026        Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
March 2026           Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
April 2026           Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
May 2026             Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
June 2026            Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
July 2026            Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
August 2026          Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
September 2026       Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
October 2026         Expected: ₹700   Actual: ₹700    ✓ PASS
  Notes: Monthly recurring pooja contribution due + CHRT (Preferred Date) poojas
November 2026        Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due
December 2026        Expected: ₹500   Actual: ₹500    ✓ PASS
  Notes: Monthly recurring pooja contribution due

================================================================================
Results: 12 Passed, 0 Failed
================================================================================
```

---

### Test Case 2: Quarterly CHRT Pooja

**Setup:**
```python
# Create CHRT pooja with preferred date November 15, 2026 (Q4)
chrt_plan = RecurringPoojaPlan.objects.create(
    donor_id=donor_id,
    pooja_option_id=1,
    day_option=day_option,
    recurrence_kind=RecurrenceKind.RECURRING,
    recurrence_frequency=RecurrenceFrequency.QUARTERLY,
    start_date=date(2026, 11, 15),  # November 2026 (Q4)
    amount=Decimal('300.00'),
    is_active=True,
)
```

**Expected Monthly Dues:**
```
Month           Due Amount    Notes
January 2026    ₹500         5 poojas only
February 2026   ₹500         5 poojas only
March 2026      ₹500         5 poojas only
April 2026      ₹500         5 poojas only
May 2026        ₹500         5 poojas only
June 2026       ₹500         5 poojas only
July 2026       ₹500         5 poojas only
August 2026     ₹500         5 poojas only
September 2026  ₹500         5 poojas only
October 2026    ₹800         5 + CHRT (Q4 starts)
November 2026   ₹800         5 + CHRT (Q4)
December 2026   ₹800         5 + CHRT (Q4)
January 2027    ₹500         5 poojas only (Q4 ends)
```

---

### Test Case 3: Annual CHRT Pooja

**Setup:**
```python
# Create CHRT pooja with preferred date March 1, 2026 (Annual)
chrt_plan = RecurringPoojaPlan.objects.create(
    donor_id=donor_id,
    pooja_option_id=1,
    day_option=day_option,
    recurrence_kind=RecurrenceKind.RECURRING,
    recurrence_frequency=RecurrenceFrequency.ANNUALLY,
    start_date=date(2026, 3, 1),  # March 2026
    amount=Decimal('400.00'),
    is_active=True,
)
```

**Expected Monthly Dues:**
```
Month           Due Amount    Notes
January 2026    ₹500         5 poojas only
February 2026   ₹500         5 poojas only
March 2026      ₹900         5 + CHRT (Annual preferred month)
April 2026      ₹500         5 poojas only
May 2026        ₹500         5 poojas only
June 2026       ₹500         5 poojas only
July 2026       ₹500         5 poojas only
August 2026     ₹500         5 poojas only
September 2026  ₹500         5 poojas only
October 2026    ₹500         5 poojas only
November 2026   ₹500         5 poojas only
December 2026   ₹500         5 poojas only
January 2027    ₹500         5 poojas only
February 2027   ₹500         5 poojas only
March 2027      ₹900         5 + CHRT (Annual preferred month repeats)
```

---

## Validation Criteria

All tests pass when:

1. **Monthly CHRT:** Due appears only in October, December, February, etc. (same month each year)
2. **Quarterly CHRT:** Due appears only in Q4 months (Oct, Nov, Dec), Q1 months, etc. (same quarter each year)
3. **Annual CHRT:** Due appears only in March (exact same month and year)
4. **Combined Dues:** CHRT amount is correctly added to existing regular monthly dues
5. **Future Prevention:** No CHRT due is created before the preferred month arrives
6. **Backward Compatibility:** Regular (non-CHRT) poojas continue to generate monthly dues as before

## Summary

The fix changes the CHRT due generation logic from:
```
Old (Wrong): months_between % frequency_months == 0 (generates every month for MONTHLY)
New (Correct): current_month.month == preferred_month.month (generates only in matching month)
```

This ensures CHRT poojas contribute to dues **only in their designated month/quarter/year**, not every month.
