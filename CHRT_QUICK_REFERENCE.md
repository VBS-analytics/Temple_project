# CHRT POOJA LOGIC - IMPLEMENTATION QUICK REFERENCE

## One-Page Summary

**CHRT (Choose Your Preferred Date) Poojas must show dues in the preferred date month, not the registration month.**

```
REGISTRATION MONTH (Jan 2026)  ≠  PREFERRED MONTH (Feb 2026)
                                     ↓ DUE SHOULD APPEAR HERE
```

---

## Critical Code Sections

### 1. Identify CHRT Plans

**File:** `backend/pooja/services/recurrence.py`  
**Lines:** 444-448

```python
def _chrt_plan_filter() -> Q:
    """Identify CHRT (preferred-date) plans."""
    return Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
```

**Usage:**
```python
# Find all CHRT plans
chrt_plans = RecurringPoojaPlan.objects.filter(_chrt_plan_filter())

# Exclude CHRT from regular processing
regular_plans = active_plans.exclude(_chrt_plan_filter())
```

---

### 2. Prevent CHRT from Regular Monthly Dues

**File:** `backend/pooja/services/recurrence.py`  
**Lines:** 345-370

```python
def _generate_due_payments_for_recurring_plans(today: Optional[date] = None) -> int:
    """Generate regular monthly dues - CHRT EXCLUDED."""
    
    # Get active plans
    active_plans = RecurringPoojaPlan.objects.filter(
        is_active=True,
        recurrence_kind=RecurrenceKind.RECURRING,
    )
    
    # ✓ CRITICAL: Exclude CHRT - they are handled separately
    active_plans = active_plans.exclude(_chrt_plan_filter())
    
    # Rest of the function creates dues for regular poojas only...
```

**Effect:** Regular monthly dues do NOT include CHRT amounts

---

### 3. Handle CHRT Future Dates

**File:** `backend/pooja/services/recurrence.py`  
**Lines:** 585-620

```python
def _generate_due_payments_for_chrt_poojas(today: Optional[date] = None) -> int:
    """Generate CHRT dues ONLY in their preferred month."""
    
    # Get current month
    current_month = today.replace(day=1)  # e.g., 2026-02-01
    
    # Find all CHRT plans
    chrt_plans = RecurringPoojaPlan.objects.filter(
        is_active=True,
        recurrence_kind=RecurrenceKind.RECURRING,
    ).filter(_chrt_plan_filter())
    
    for plan in chrt_plans:
        # Get the preferred month (when the pooja should be due)
        preferred_date = plan.one_time_date or plan.start_date
        preferred_month = preferred_date.replace(day=1)  # e.g., 2026-02-01
        
        # ✓ CRITICAL: If preferred month is in the future, SKIP
        if current_month < preferred_month:
            # Clean up any incorrectly-created dues
            PaymentRecord.objects.filter(
                donor_id=plan.donor_id,
                registration__isnull=True,
                status=PaymentStatus.PENDING,
                payment_month__lt=preferred_month,
                notes__icontains='CHRT',
            ).delete()
            continue  # ← SKIP - don't create due yet
        
        # If we reach here: current_month >= preferred_month
        # Create the due in the PREFERRED month
        # ...
```

**Key Logic:**
- If `current_month < preferred_month`: SKIP (too early)
- If `current_month >= preferred_month`: CREATE due in preferred_month

---

### 4. Create CHRT Due in Preferred Month

**File:** `backend/pooja/services/recurrence.py`  
**Lines:** 725-740

```python
# ✓ CRITICAL: Use preferred_month for CHRT, NOT current_month
due_record, created = PaymentRecord.objects.get_or_create(
    donor_id=donor_id,
    registration=None,  # CHRT dues are not tied to individual registrations
    payment_month=payment_month,  # ← Use PREFERRED month here
    defaults={
        'amount': total_amount,
        'currency': 'INR',
        'mode': 'pending',
        'status': PaymentStatus.PENDING,
        'notes': 'CHRT (Preferred Date) pooja contribution due',  # ← Identifies as CHRT
    }
)
```

**Key Points:**
- `payment_month` = `preferred_month` (the month when CHRT should be due)
- `registration=None` (not tied to individual registration record)
- `notes` contains "CHRT" (for identification and filtering)

---

### 5. Use Preferred Date in Passbook

**File:** `backend/payments/services.py`  
**Lines:** 68-88

```python
# Build lookup: registration_id → preferred_date
chrt_plan_dates = {
    plan.origin_registration_id: plan.one_time_date
    for plan in RecurringPoojaPlan.objects.filter(...)
    if plan.origin_registration_id and plan.one_time_date
}

for rr in registration_records:
    # ✓ CRITICAL: For CHRT, use preferred date instead of start_date
    if rr.day_option and rr.day_option.code == "CHRT":
        preferred_date = chrt_plan_dates.get(rr.id)
    
    if preferred_date:
        date_val = preferred_date  # ← Use preferred date for CHRT
    else:
        date_val = rr.start_date or rr.created_at.date()
    
    all_records.append(("registration", rr, date_val))
```

**Effect:** CHRT registrations show with their preferred date in the passbook

---

## Data Model Mapping

```
PoojaRegistration:
├─ donor_id = 123
├─ day_option.code = "CHRT"
├─ start_date = 2026-01-31          ← Registration date (NOT used for due month)
├─ total_amount = ₹500
└─ created_at = 2026-01-31 10:30 AM

RecurringPoojaPlan:
├─ donor_id = 123
├─ day_option.code = "CHRT"
├─ start_date = 2026-01-31
├─ one_time_date = 2026-02-06       ← ✓ PREFERRED date (used for due month)
├─ recurrence_kind = "recurring"
├─ recurrence_frequency = "annually"
├─ amount = ₹500
└─ origin_registration_id = (PoojaRegistration.id)

PaymentRecord (created in February):
├─ donor_id = 123
├─ registration = NULL              ← CHRT dues not tied to registration
├─ payment_month = 2026-02-01       ← ✓ Preferred month (Feb)
├─ amount = ₹500
├─ status = PENDING
├─ notes = "CHRT (Preferred Date) pooja contribution due"
└─ created_at = 2026-02-01 12:00 AM
```

---

## Processing Timeline

```
JAN 31, 2026 (10:30 AM)
Donor registers CHRT pooja with preferred date Feb 6, 2026
└─ PaymentRecord: Not created yet (future date)

FEB 1, 2026 (12:00 AM - Daily cron runs)
process_recurring_plans() executes:
├─ _clean_stale_chrt_dues()
│  └─ Check Feb 1 > Feb 1? NO → No cleanup needed
├─ _generate_due_payments_for_recurring_plans()
│  └─ Exclude CHRT → Create ₹400 for Feb (regular poojas only)
└─ _generate_due_payments_for_chrt_poojas()
   ├─ Check Feb 1 < Feb 1? NO → Don't skip
   ├─ Check recurrence frequency: YES, valid month
   └─ Create ₹500 in Feb for CHRT (preferred month)

RESULT: Feb 2026 statement shows ₹900 total (₹400 regular + ₹500 CHRT)
```

---

## Common Mistakes & Fixes

### ❌ Mistake 1: Using start_date instead of one_time_date

```python
# WRONG:
date_val = rr.start_date  # Shows due in registration month

# ✓ CORRECT:
if rr.day_option and rr.day_option.code == "CHRT":
    preferred_date = chrt_plan_dates.get(rr.id)  # From one_time_date
    date_val = preferred_date  # Shows due in preferred month
```

### ❌ Mistake 2: Including CHRT in regular recurring dues

```python
# WRONG:
all_active_plans = active_plans  # Includes CHRT

# ✓ CORRECT:
all_active_plans = active_plans.exclude(_chrt_plan_filter())  # Excludes CHRT
```

### ❌ Mistake 3: Not checking future dates

```python
# WRONG:
# Always create CHRT dues immediately

# ✓ CORRECT:
if current_month < preferred_month:
    continue  # Skip future-dated CHRT poojas
```

### ❌ Mistake 4: Creating CHRT dues in current_month instead of preferred_month

```python
# WRONG:
payment_month = current_month  # Due shows in wrong month

# ✓ CORRECT:
payment_month = preferred_month  # Due shows in correct month
```

### ❌ Mistake 5: Tying CHRT dues to registration records

```python
# WRONG:
PaymentRecord.objects.create(
    registration=pooja_registration,  # Links to registration
    ...
)

# ✓ CORRECT:
PaymentRecord.objects.create(
    registration=None,  # CHRT dues are separate
    ...
)
```

---

## Verification Queries

### Check if CHRT plan was created correctly
```python
from pooja.models import RecurringPoojaPlan

plan = RecurringPoojaPlan.objects.filter(
    donor_id=123,
    day_option__code='CHRT'
).first()

print(f"✓ Preferred date: {plan.one_time_date}")
print(f"✓ One time date set: {plan.one_time_date is not None}")
print(f"✓ Is active: {plan.is_active}")
print(f"✓ Recurrence: {plan.recurrence_frequency}")
```

### Check if CHRT dues were created in correct month
```python
from payments.models import PaymentRecord

chrt_dues = PaymentRecord.objects.filter(
    donor_id=123,
    notes__icontains='CHRT'
).order_by('payment_month')

for due in chrt_dues:
    print(f"✓ Month: {due.payment_month}, Amount: {due.amount}")
    # Should show Feb 2026, not Jan 2026
```

### Check if CHRT was excluded from regular dues
```python
from payments.models import PaymentRecord
from pooja.models import RecurringPoojaPlan

# Get a regular (non-CHRT) due
regular_due = PaymentRecord.objects.filter(
    donor_id=123,
    registration__isnull=False  # Tied to registration
).first()

# Verify it's not CHRT
if regular_due:
    is_chrt = 'CHRT' in (regular_due.notes or '')
    print(f"✓ Is regular (not CHRT): {not is_chrt}")
```

### Check passbook shows correct dates
```python
from payments.models import PassbookEntry

entries = PassbookEntry.objects.filter(
    donor_id=123
).order_by('entry_date')

for entry in entries:
    print(f"Date: {entry.entry_date}, Type: {entry.entry_type}, Due: {entry.due_amount}")
```

---

## Testing Checklist

When implementing or fixing CHRT logic:

- [ ] **Create CHRT plan with future date**
  ```python
  today = date(2026, 1, 31)
  preferred = date(2026, 2, 6)
  assert today < preferred  # Verify future
  ```

- [ ] **Verify due NOT created in registration month**
  ```python
  jan_dues = PaymentRecord.objects.filter(
      donor_id=donor_id,
      payment_month__month=1,
      notes__icontains='CHRT'
  )
  assert not jan_dues.exists()  # No CHRT in Jan
  ```

- [ ] **Verify due IS created in preferred month**
  ```python
  feb_dues = PaymentRecord.objects.filter(
      donor_id=donor_id,
      payment_month__month=2,
      notes__icontains='CHRT'
  )
  assert feb_dues.exists()  # CHRT created in Feb
  assert feb_dues.first().amount == Decimal('500')
  ```

- [ ] **Verify registration uses preferred date in passbook**
  ```python
  registration = PoojaRegistration.objects.get(id=reg_id)
  plan = RecurringPoojaPlan.objects.get(origin_registration_id=reg_id)
  
  # Registration's start_date is Jan, but preferred is Feb
  assert registration.start_date.month == 1
  assert plan.one_time_date.month == 2
  
  # Passbook should use plan.one_time_date
  entries = PassbookEntry.objects.filter(donor_id=123)
  feb_entries = [e for e in entries if e.entry_date.month == 2]
  assert len(feb_entries) > 0  # Entry in Feb
  ```

---

## Debugging Commands

### Find all CHRT plans
```python
from pooja.models import RecurringPoojaPlan
from django.db.models import Q

chrt_plans = RecurringPoojaPlan.objects.filter(
    Q(day_option__code='CHRT') | Q(one_time_date__isnull=False)
)

for plan in chrt_plans:
    print(f"Donor: {plan.donor_id}, Preferred: {plan.one_time_date}")
```

### Regenerate passbook for a donor
```python
from payments.services import regenerate_donor_passbook

regenerate_donor_passbook(donor_id=123)
print("✓ Passbook regenerated")
```

### Clear and regenerate payment records
```python
from payments.models import PaymentRecord, PassbookEntry

# Clear existing records
PaymentRecord.objects.filter(donor_id=123).delete()
PassbookEntry.objects.filter(donor_id=123).delete()

# Regenerate
from pooja.services.recurrence import process_recurring_plans
from datetime import date
process_recurring_plans(today=date(2026, 2, 1))

# Check results
from payments.services import regenerate_donor_passbook
regenerate_donor_passbook(123)
```

### Find stale CHRT dues (debugging)
```python
from payments.models import PaymentRecord

# Find CHRT dues that might be in wrong months
all_chrt_dues = PaymentRecord.objects.filter(
    notes__icontains='CHRT'
)

for due in all_chrt_dues:
    print(f"Donor: {due.donor_id}, Month: {due.payment_month}, Amount: {due.amount}")
```

---

## File References

| File | Key Functions | Purpose |
|------|---------------|---------|
| [backend/pooja/services/recurrence.py](backend/pooja/services/recurrence.py) | `_chrt_plan_filter()`, `_generate_due_payments_for_chrt_poojas()`, `_clean_stale_chrt_dues()` | CHRT due generation logic |
| [backend/pooja/models.py](backend/pooja/models.py) | `RecurringPoojaPlan`, `PoojaRegistration` | Data models |
| [backend/payments/services.py](backend/payments/services.py) | `regenerate_donor_passbook()` | Passbook generation using preferred dates |
| [backend/payments/models.py](backend/payments/models.py) | `PaymentRecord`, `PassbookEntry` | Payment records and passbook entries |
| [frontend/src/pages/DonorProfile.tsx](frontend/src/pages/DonorProfile.tsx) | CHRT Pooja Tab | Display CHRT poojas and preferred dates |

---

## Summary: The 5 Golden Rules

1. **Identify CHRT:** Use `day_option__code="CHRT"` or `one_time_date__isnull=False`
2. **Exclude from Regular:** Filter out CHRT when generating regular monthly dues
3. **Check Future Dates:** Skip creating dues if `current_month < preferred_month`
4. **Use Preferred Month:** Create dues in `preferred_month`, NOT `current_month`
5. **Use Preferred Date:** Show CHRT registrations with `one_time_date`, NOT `start_date`

---

## Need More Info?

- Detailed logic explanation: [CHRT_LOGIC_EXPLANATION.md](CHRT_LOGIC_EXPLANATION.md)
- Visual diagrams: [CHRT_LOGIC_VISUAL_GUIDE.md](CHRT_LOGIC_VISUAL_GUIDE.md)
- Bug analysis: [BUG_ANALYSIS_CHRT_FUTURE_DUE.md](BUG_ANALYSIS_CHRT_FUTURE_DUE.md)
- Test examples: [backend/pooja/tests.py](backend/pooja/tests.py) (Lines 712-805)
