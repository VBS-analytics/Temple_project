# CHRT POOJA LOGIC - VISUAL GUIDE

## Quick Reference Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                     CHRT POOJA PROCESSING                         │
│                                                                    │
│  Donor Registers CHRT Pooja                                       │
│  ├─ Registration Date: Jan 31, 2026                               │
│  ├─ Preferred Date: Feb 6, 2026  ← KEY DIFFERENCE                 │
│  └─ Amount: ₹500                                                   │
│                                                                    │
│                              ▼                                     │
│                   ┌──────────────────┐                             │
│                   │ Payment Due      │                             │
│                   │ Generation       │                             │
│                   │ Runs Daily       │                             │
│                   └────────┬─────────┘                             │
│                            │                                       │
│                  ┌─────────┴─────────┐                             │
│                  │                   │                             │
│        ┌─────────▼────────┐  ┌──────▼──────────┐                  │
│        │  Generate        │  │  Generate      │                   │
│        │  Recurring       │  │  CHRT Dues     │                   │
│        │  Dues            │  │  (Special)     │                   │
│        └──────────────────┘  └─────────────────┘                  │
│                  │                   │                             │
│        ❌ EXCLUDE │                   │ ✓ INCLUDE                  │
│           CHRT   │                   │   CHRT                      │
│                  │                   │                             │
│        ₹400 due  │                   │ Check:                      │
│        Jan 2026  │                   │ Preferred Month > Current?  │
│                  │                   │ (Feb > Jan? YES)            │
│                  │                   │ → Skip for now ✓             │
│                  │                   │                             │
│                  └───────────────────┘                             │
│                            │                                       │
│              ┌─────────────▼──────────────┐                        │
│              │  Payment Records for       │                        │
│              │  January 2026:             │                        │
│              │  • ₹400 (Recurring only)   │                        │
│              │  • NO CHRT due yet ✓        │                        │
│              └────────────────────────────┘                        │
│                                                                    │
│                   (February 1 arrives)                             │
│                                                                    │
│                   ┌──────────────────┐                             │
│                   │ Payment Due      │                             │
│                   │ Generation       │                             │
│                   │ Runs Again       │                             │
│                   └────────┬─────────┘                             │
│                            │                                       │
│                  ┌─────────┴─────────┐                             │
│                  │                   │                             │
│        ┌─────────▼────────┐  ┌──────▼──────────┐                  │
│        │  Generate        │  │  Generate      │                   │
│        │  Recurring       │  │  CHRT Dues     │                   │
│        │  Dues            │  │  (Special)     │                   │
│        └──────────────────┘  └─────────────────┘                  │
│                  │                   │                             │
│        ₹400 due  │                   │ Check:                      │
│        Feb 2026  │                   │ Preferred Month > Current?  │
│                  │                   │ (Feb > Feb? NO)             │
│                  │                   │ → Create due ✓              │
│                  │                   │                             │
│                  │                   │ ₹500 due created for        │
│                  │                   │ February 2026               │
│                  │                   │ (payment_month=Feb 1)       │
│                  │                   │                             │
│                  └───────────────────┘                             │
│                            │                                       │
│              ┌─────────────▼──────────────┐                        │
│              │  Payment Records for       │                        │
│              │  February 2026:            │                        │
│              │  • ₹400 (Recurring)        │                        │
│              │  • ₹500 (CHRT) ✓            │                        │
│              │  • Total: ₹900              │                        │
│              └────────────────────────────┘                        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Registration to Payment Due

```
DONOR REGISTRATION FORM
        ▼
    ┌───────────────────────────────────────┐
    │ Frontend: PoojaRegistrationPage.tsx   │
    │ • Select pooja                         │
    │ • Select day_option = "CHRT"           │
    │ • Fill in preferred dates              │
    │ • Submit registration                  │
    └───────────────────────────────────────┘
        ▼
    ┌───────────────────────────────────────┐
    │ Backend: REST API Endpoint            │
    │ POST /api/pooja/register/             │
    └───────────────────────────────────────┘
        ▼
    ┌───────────────────────────────────────────────────────┐
    │ Create Database Records:                              │
    │                                                       │
    │ 1. PoojaRegistration                                  │
    │    ├─ donor_id = 123                                  │
    │    ├─ pooja_option = "Shirdi Sai Baba"               │
    │    ├─ day_option = CHRT object                        │
    │    ├─ start_date = 2026-01-31 (registration date)    │
    │    ├─ total_amount = ₹500                             │
    │    └─ created_at = 2026-01-31 10:30 AM               │
    │                                                       │
    │ 2. RecurringPoojaPlan                                 │
    │    ├─ donor_id = 123                                  │
    │    ├─ pooja_option = "Shirdi Sai Baba"               │
    │    ├─ day_option = CHRT object                        │
    │    ├─ recurrence_kind = "recurring"                   │
    │    ├─ recurrence_frequency = "annually"               │
    │    ├─ start_date = 2026-01-31                         │
    │    ├─ one_time_date = 2026-02-06 ← PREFERRED DATE     │
    │    ├─ amount = ₹500                                   │
    │    ├─ origin_registration = PoojaRegistration #456    │
    │    └─ is_active = true                                │
    │                                                       │
    │ 3. PoojaRegistrationMember                            │
    │    ├─ registration = PoojaRegistration #456           │
    │    ├─ name, dob, family_name, etc.                    │
    │    └─ (repeated for each member)                      │
    └───────────────────────────────────────────────────────┘
        ▼
    ┌───────────────────────────────────────────────────────┐
    │ Signal Handler: Passbook Regeneration                 │
    │ django.db.models.signals.post_save on Registration   │
    └───────────────────────────────────────────────────────┘
        ▼
    ┌───────────────────────────────────────────────────────┐
    │ regenerate_donor_passbook(donor_id=123)               │
    │ • Fetch all payment records for donor                 │
    │ • Fetch all registrations for donor                   │
    │ • For CHRT registrations: use one_time_date           │
    │ • Sort by date and create PassbookEntry records       │
    └───────────────────────────────────────────────────────┘
        ▼
    ┌───────────────────────────────────────────────────────┐
    │ PaymentRecords Created (with payment dates):          │
    │ • Payment Month: 2026-01-01 (if due in Jan)           │
    │ • Payment Month: 2026-02-01 (if due in Feb) ← CHRT    │
    └───────────────────────────────────────────────────────┘
        ▼
    ┌───────────────────────────────────────────────────────┐
    │ Donor Profile Page / Payment Statement                │
    │ • Fetches all payment records grouped by month        │
    │ • CHRT poojas show in preferred month's statement     │
    │ • Separate CHRT Pooja tab shows registrations         │
    └───────────────────────────────────────────────────────┘
```

---

## Code Execution Timeline

```
EXECUTION TIMELINE: January 31, 2026 → February 1, 2026

┌─────────────────────────────────────────────────────────────┐
│ JAN 31, 2026 - 10:30 AM                                    │
│ Donor registers CHRT pooja (Feb 6 preferred date)          │
│                                                             │
│ Database state AFTER registration:                          │
│ • PoojaRegistration.start_date = 2026-01-31                │
│ • RecurringPoojaPlan.one_time_date = 2026-02-06            │
│ • RecurringPoojaPlan.is_active = TRUE                      │
│ • PaymentRecord: (None yet - waits for daily cron)          │
└─────────────────────────────────────────────────────────────┘
           │
           │ (Daily payment generation runs at 12:00 AM)
           ▼
┌─────────────────────────────────────────────────────────────┐
│ FEB 1, 2026 - 12:00 AM                                     │
│ process_recurring_plans() executes                          │
│                                                             │
│ Step 1: _clean_stale_chrt_dues()                           │
│ • Get all CHRT plans for donor 123                          │
│ • Check: preferred_month (Feb 1) > current_month (Feb 1)?  │
│ • NO → No stale dues to clean ✓                             │
│                                                             │
│ Step 2: _generate_due_payments_for_recurring_plans()       │
│ • Get all ACTIVE plans excluding CHRT                       │
│ • Filter: day_option.code != "CHRT" and one_time_date NULL │
│ • Only regular recurring plans included                     │
│ • Create PaymentRecord for Feb 2026: ₹400 ✓                │
│                                                             │
│ Step 3: _generate_due_payments_for_chrt_poojas()          │
│ • Get all CHRT plans for donor 123                          │
│ • CHRT plan found:                                          │
│   - preferred_month = 2026-02-01                            │
│   - current_month = 2026-02-01                              │
│ • Check: current_month (Feb 1) < preferred_month (Feb 1)?  │
│ • NO (they're equal) → Create CHRT due ✓                    │
│ • Check recurrence frequency: ANNUALLY                      │
│ • (Feb 2026 - Feb 2026) % 12 = 0 % 12 = 0 ✓ (valid month) │
│ • Create PaymentRecord for Feb 2026: ₹500                  │
│   - payment_month = 2026-02-01                              │
│   - notes = "CHRT (Preferred Date) pooja contribution due"  │
│   - Combined with other CHRT dues for this month            │
│                                                             │
│ Database state AFTER execution:                             │
│ • PaymentRecord: ₹400 (recurring) + ₹500 (CHRT) = ₹900     │
│ • payment_month = 2026-02-01 for both                       │
│ • Donor statement shows ₹900 due for February 2026 ✓        │
└─────────────────────────────────────────────────────────────┘
```

---

## Filtering & Identification

### How to Identify CHRT Poojas

**Database Query:**
```python
# Identify all CHRT plans
from pooja.models import RecurringPoojaPlan, PoojaDayOption

chrt_plans = RecurringPoojaPlan.objects.filter(
    day_option__code='CHRT'
)

# OR include legacy records without explicit day_option
from django.db.models import Q
chrt_plans = RecurringPoojaPlan.objects.filter(
    Q(day_option__code='CHRT') | Q(one_time_date__isnull=False)
)
```

**The Filter Function (recurrence.py, line 444):**
```python
def _chrt_plan_filter() -> Q:
    """Identify CHRT plans even if day option not saved."""
    return Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
```

**Usage:**
```python
# Include CHRT plans:
chrt_plans = RecurringPoojaPlan.objects.filter(_chrt_plan_filter())

# Exclude CHRT plans from regular processing:
regular_plans = RecurringPoojaPlan.objects.exclude(_chrt_plan_filter())
```

---

## Side-by-Side: Regular vs CHRT Poojas

```
┌──────────────────────────────────────────┬──────────────────────────────────────┐
│     REGULAR RECURRING POOJA              │      CHRT POOJA                      │
├──────────────────────────────────────────┼──────────────────────────────────────┤
│ Registration Date: Jan 31, 2026          │ Registration Date: Jan 31, 2026      │
│ (When donor signs up)                    │ (When donor signs up)                │
│                                          │                                      │
│ Day Option: "First Day of Month"         │ Day Option: "CHRT"                   │
│ (or any predefined day)                  │ (Choose Your Preferred Date)         │
│                                          │                                      │
│ Recurring: YES (Monthly)                 │ Recurring: YES (Annually)            │
│                                          │ (or other frequency)                 │
│                                          │                                      │
│ Start Date: Jan 31, 2026                 │ Start Date: Jan 31, 2026             │
│ (Used for due generation)                │ (NOT used for due generation)        │
│                                          │                                      │
│ One Time Date: NULL                      │ One Time Date: Feb 6, 2026           │
│                                          │ (Preferred date - KEY FIELD)         │
├──────────────────────────────────────────┼──────────────────────────────────────┤
│ DUE GENERATION (Jan, Feb, Mar, ...)      │ DUE GENERATION                       │
│                                          │                                      │
│ January 2026:                            │ January 2026:                        │
│ • Filter: Exclude CHRT ✓                 │ • Filter: Include CHRT               │
│ • Current Month: Jan 1                   │ • Current Month: Jan 1               │
│ • Preferred Month: Jan 1 (start_date)    │ • Preferred Month: Feb 1             │
│ • Check: Jan >= Jan? YES                 │ • Check: Jan < Feb? YES              │
│ • Result: ✓ Create due for Jan           │ • Result: ✗ SKIP (too early)         │
│ • Amount: ₹100 (monthly recurring)       │                                      │
│                                          │                                      │
│ February 2026:                           │ February 2026:                       │
│ • Filter: Exclude CHRT ✓                 │ • Filter: Include CHRT               │
│ • Current Month: Feb 1                   │ • Current Month: Feb 1               │
│ • Preferred Month: Feb 1 (start_date)    │ • Preferred Month: Feb 1             │
│ • Check: Feb >= Feb? YES                 │ • Check: Feb < Feb? NO               │
│ • Result: ✓ Create due for Feb           │ • Recurrence match? YES (first Feb)  │
│ • Amount: ₹100 (monthly recurring)       │ • Result: ✓ Create due for Feb       │
│                                          │ • Amount: ₹500 (CHRT preferred date) │
│                                          │                                      │
│ March 2026:                              │ March 2026:                          │
│ • Result: ✓ Create due for Mar           │ • Result: ✗ SKIP (frequency not met) │
│ • Amount: ₹100 (monthly recurring)       │ • (No due - not annual occurrence)    │
│                                          │                                      │
│ February 2027:                           │ February 2027:                       │
│ • Result: ✓ Create due for Feb 2027      │ • Result: ✓ Create due for Feb 2027  │
│ • Amount: ₹100 (continues monthly)       │ • Recurrence match? YES (2nd annual) │
│                                          │ • Amount: ₹500                       │
└──────────────────────────────────────────┴──────────────────────────────────────┘
```

---

## Key Code Sections

### Section 1: CHRT Identification (recurrence.py, line 444)
```python
def _chrt_plan_filter() -> Q:
    """Identify CHRT (preferred-date) plans even if the day option was not saved."""
    return Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
```
**Purpose:** Returns a filter that matches CHRT plans  
**Used in:** Excluding CHRT from regular processing, finding CHRT plans

---

### Section 2: Exclude CHRT from Regular Dues (recurrence.py, line 366)
```python
# Exclude CHRT poojas (including legacy rows where day_option was null) -
# they are handled separately in _generate_due_payments_for_chrt_poojas.
active_plans = active_plans.exclude(_chrt_plan_filter())
```
**Purpose:** Regular recurring poojas don't include CHRT  
**Effect:** Regular dues only have non-CHRT poojas

---

### Section 3: Future Date Check (recurrence.py, line 603-610)
```python
# CRITICAL: If the preferred month is in the future, NEVER create a due now
if current_month < preferred_month:
    # Delete any stale dues that might have been created incorrectly for this plan
    PaymentRecord.objects.filter(
        donor_id=plan.donor_id,
        registration__isnull=True,
        status=PaymentStatus.PENDING,
        payment_month__lt=preferred_month,
        notes__icontains='CHRT',
    ).delete()
    continue  # ← Skip creating due for future dates
```
**Purpose:** Prevent creating dues before the preferred date  
**Example:** Jan 2026 < Feb 2026 → SKIP

---

### Section 4: Create CHRT Due (recurrence.py, line 725-734)
```python
due_record, created = PaymentRecord.objects.get_or_create(
    donor_id=donor_id,
    registration=None,
    payment_month=payment_month,  # ← Use preferred_month for CHRT
    defaults={
        'amount': total_amount,
        'currency': 'INR',
        'mode': 'pending',
        'status': PaymentStatus.PENDING,
        'notes': 'CHRT (Preferred Date) pooja contribution due',
    }
)
```
**Purpose:** Create payment due in the preferred month  
**Key:** `payment_month = preferred_month` (NOT current_month)

---

### Section 5: Passbook Generation (payments/services.py, line 68-88)
```python
# Build CHRT plan lookup
chrt_plan_dates = {
    plan.origin_registration_id: plan.one_time_date
    for plan in RecurringPoojaPlan.objects.filter(...)
    if plan.origin_registration_id and plan.one_time_date
}

for rr in registration_records:
    # For CHRT poojas, use preferred date instead of start_date
    if rr.day_option and rr.day_option.code == "CHRT":
        preferred_date = chrt_plan_dates.get(rr.id)
    
    if preferred_date:
        date_val = preferred_date  # ← Use preferred date
    else:
        date_val = rr.start_date or rr.created_at.date()
```
**Purpose:** Show CHRT registrations with their preferred dates in passbook  
**Effect:** CHRT entries appear in the correct month

---

## Testing Scenarios

### ✓ Scenario 1: CHRT with Future Date
```
Setup:
- Donor has 4 recurring poojas @ ₹100 each = ₹400/month
- Donor registers CHRT for Feb 6, 2026 @ ₹500
- Current Date: Jan 31, 2026

Expected:
- January 2026: ₹400 (recurring only)
- February 2026: ₹900 (₹400 recurring + ₹500 CHRT)
```

### ✓ Scenario 2: CHRT with Current Month Date
```
Setup:
- Same as above, but CHRT preferred date is Jan 15, 2026
- Current Date: Jan 31, 2026

Expected:
- January 2026: ₹900 (₹400 recurring + ₹500 CHRT)
```

### ✓ Scenario 3: Multiple CHRT with Different Months
```
Setup:
- CHRT #1: Feb 6, 2026 @ ₹500
- CHRT #2: Apr 10, 2026 @ ₹300
- Recurring: ₹400/month
- Current Date: Jan 31, 2026

Expected:
- January 2026: ₹400
- February 2026: ₹900 (₹400 + ₹500 CHRT #1)
- March 2026: ₹400
- April 2026: ₹700 (₹400 + ₹300 CHRT #2)
```

### ✓ Scenario 4: Annual CHRT (Recurring)
```
Setup:
- CHRT: Feb 6 (annually) @ ₹500
- Current Date: Jan 31, 2026

Expected:
- January 2026: No CHRT due
- February 2026: ₹500 CHRT due (first year)
- March 2026: No CHRT due
- ...
- February 2027: ₹500 CHRT due (second year)
- February 2028: ₹500 CHRT due (third year)
```

---

## Debugging Checklist

When CHRT poojas are showing in the wrong month:

- [ ] **Check RecurringPoojaPlan.one_time_date**
  - Is it set to the correct preferred date?
  - Not NULL?
  
- [ ] **Check day_option.code**
  - Is it "CHRT"?
  - Or missing (legacy issue)?
  
- [ ] **Check PaymentRecord.payment_month**
  - Should equal the preferred month
  - NOT the registration month
  
- [ ] **Check PaymentRecord.registration**
  - Should be NULL for CHRT dues
  - NOT tied to individual registrations
  
- [ ] **Check PaymentRecord.notes**
  - Should contain "CHRT"
  - Helps identify CHRT dues
  
- [ ] **Check filtering logic**
  - Is `_chrt_plan_filter()` working?
  - Are CHRT poojas excluded from regular processing?
  
- [ ] **Check future date handling**
  - For future dates, is due generation skipped?
  - Are stale dues cleaned up?

---

## Troubleshooting

**Problem:** CHRT due showing in registration month instead of preferred month

**Check:**
```python
from payments.models import PaymentRecord

# Find CHRT dues for a donor
chrt_dues = PaymentRecord.objects.filter(
    donor_id=123,
    notes__icontains='CHRT'
)

for due in chrt_dues:
    print(f"Payment Month: {due.payment_month}")  # Should be preferred month
    print(f"Amount: {due.amount}")
    print(f"Notes: {due.notes}")
```

**Solution:**
1. Verify RecurringPoojaPlan.one_time_date is set correctly
2. Check that _chrt_plan_filter() is working
3. Regenerate payment records: `regenerate_donor_passbook(123)`
4. Clear and re-run payment due generation

---

## References

- [CHRT_LOGIC_EXPLANATION.md](CHRT_LOGIC_EXPLANATION.md) - Detailed explanation
- [backend/pooja/services/recurrence.py](backend/pooja/services/recurrence.py) - Implementation
- [backend/payments/services.py](backend/payments/services.py) - Passbook generation
- [CHRT_FUTURE_DUE_FIX.md](CHRT_FUTURE_DUE_FIX.md) - Bug fix details
