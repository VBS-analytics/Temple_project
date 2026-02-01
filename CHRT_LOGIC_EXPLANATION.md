# CHRT POOJA LOGIC - COMPREHENSIVE EXPLANATION

## Overview

The CHRT (Choose Your Preferred Date) pooja is a special pooja registration type where donors can specify a custom date when they want their pooja to be performed. The key requirement is:

**CHRT poojas must display dues in the preferred date month, not the registration month.**

---

## How CHRT Poojas Work

### 1. Registration Phase

When a donor registers a CHRT pooja:

```
Scenario:
- Current Date: January 31, 2026
- Donor registers pooja with day_option code = "CHRT"
- Preferred Date: February 6, 2026
- Amount: ₹500
```

**Data Created:**
- `PoojaRegistration` record created with:
  - `start_date` = January 31, 2026 (registration date)
  - `day_option.code` = "CHRT"
  
- `RecurringPoojaPlan` record created with:
  - `one_time_date` = February 6, 2026 (preferred date)
  - `recurrence_kind` = "recurring"
  - `day_option.code` = "CHRT"
  - `origin_registration` = reference to PoojaRegistration

### 2. Due Payment Generation

The system generates payment dues using a two-step process:

#### Step 1: Generate Recurring Poojas (Regular Poojas)
**Function:** `_generate_due_payments_for_recurring_plans()` in [backend/pooja/services/recurrence.py](backend/pooja/services/recurrence.py#L345-L441)

```python
# Lines 366-367: CRITICAL - Exclude CHRT poojas from recurring calculation
active_plans = active_plans.exclude(_chrt_plan_filter())
```

- Creates dues for the **current month** (January 2026)
- EXCLUDES CHRT poojas using the `_chrt_plan_filter()`
- One combined due per donor per month

**For our scenario:**
- Regular poojas generate ₹400 due for January 2026

#### Step 2: Generate CHRT Poojas Due
**Function:** `_generate_due_payments_for_chrt_poojas()` in [backend/pooja/services/recurrence.py](backend/pooja/services/recurrence.py#L585-L750)

```python
# Lines 603-610: Future date check - the critical logic
if current_month < preferred_month:
    # Delete any stale dues from earlier months
    PaymentRecord.objects.filter(
        donor_id=plan.donor_id,
        registration__isnull=True,
        status=PaymentStatus.PENDING,
        payment_month__lt=preferred_month,
        notes__icontains='CHRT',
    ).delete()
    continue  # Skip - preferred month is in the future
```

**Key Logic:**
- If `current_month < preferred_month` → SKIP creating due now
  - Example: January 2026 < February 2026 → Skip
  - The CHRT due will NOT be created for January
  
- If `current_month >= preferred_month` → CREATE due in preferred month
  - Uses `payment_month = preferred_month` (NOT current_month)
  - This ensures the due appears in February 2026, not January

**For our scenario:**
- January 2026 < February 2026? YES
- Action: Skip creating due for January
- Result: No CHRT due appears in January ✓

---

## The CHRT Plan Filter

**Function:** `_chrt_plan_filter()` in [backend/pooja/services/recurrence.py](backend/pooja/services/recurrence.py#L444-L448)

```python
def _chrt_plan_filter() -> Q:
    """Identify CHRT (preferred-date) plans even if the day option was not saved."""
    return Q(day_option__code="CHRT") | Q(one_time_date__isnull=False)
```

This identifies CHRT plans by checking:
1. `day_option.code == "CHRT"` → Explicit CHRT marking
2. `one_time_date is not NULL` → Fallback for legacy records

When a plan matches this filter:
- It's EXCLUDED from regular recurring due generation
- It's INCLUDED in CHRT-specific due generation
- Dues are placed in the preferred date month

---

## Payment Record Creation

When creating a CHRT due, the system creates a `PaymentRecord` with specific fields:

```python
# Lines 725-734 in recurrence.py
PaymentRecord.objects.get_or_create(
    donor_id=donor_id,
    registration=None,  # CHRT dues are NOT tied to individual registrations
    payment_month=payment_month,  # Use preferred_month for CHRT
    defaults={
        'amount': total_amount,
        'currency': 'INR',
        'mode': 'pending',
        'status': PaymentStatus.PENDING,
        'notes': 'CHRT (Preferred Date) pooja contribution due',  # Identifies as CHRT
    }
)
```

**Key Points:**
- `registration=None` → CHRT dues are separate from individual registrations
- `payment_month=preferred_month` → Due appears in preferred month
- `notes` contains "CHRT" → Used for filtering and identification
- Composite key: `(donor_id, registration, payment_month)` ensures uniqueness

---

## Passbook Entry Generation

The passbook (Donor's payment statement) shows dues using:
**Function:** `regenerate_donor_passbook()` in [backend/payments/services.py](backend/payments/services.py#L17-L100)

```python
# Lines 68-73: Build CHRT plan lookup
chrt_plan_dates = {
    plan.origin_registration_id: plan.one_time_date
    for plan in RecurringPoojaPlan.objects.filter(
        recurrence_kind=RecurrenceKind.RECURRING,
    ).filter(Q(day_option__code="CHRT") | Q(one_time_date__isnull=False))
    if plan.origin_registration_id and plan.one_time_date
}

# Lines 75-88: Use preferred date for CHRT registrations
for rr in registration_records:
    preferred_date = None
    if rr.day_option and rr.day_option.code == "CHRT":
        preferred_date = chrt_plan_dates.get(rr.id)
    elif rr.id in chrt_plan_dates:
        preferred_date = chrt_plan_dates[rr.id]

    if preferred_date:
        date_val = preferred_date  # Use preferred date for CHRT
    else:
        date_val = rr.start_date or rr.created_at.date()
```

**Effect:**
- CHRT registrations use `one_time_date` instead of `start_date`
- Entries appear in the preferred month on the passbook

---

## Complete Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ DONOR REGISTERS CHRT POOJA (Jan 31, 2026)                  │
│ Preferred Date: Feb 6, 2026                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ PAYMENT DUE GENERATION PROCESS RUNS (daily)                │
│ Current Date: January 31, 2026                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌────────────┐      ┌──────────────────┐
   │ Step 1:    │      │ Step 2:          │
   │ Generate   │      │ Generate CHRT    │
   │ Recurring  │      │ Due              │
   │ Dues       │      │                  │
   └────────────┘      └────────┬─────────┘
        │                       │
        │ Create ₹400           │ Check: Jan < Feb?
        │ due for Jan           │ YES → Skip ✓
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
        ┌──────────────────────────┐
        │ JANUARY PAYMENT RECORD   │
        │ ₹400 due (recurring only)│
        └──────────────────────────┘

Later (February 1, 2026):

┌─────────────────────────────────────────────────────────────┐
│ PAYMENT DUE GENERATION PROCESS RUNS                        │
│ Current Date: February 1, 2026                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌────────────┐      ┌──────────────────┐
   │ Step 1:    │      │ Step 2:          │
   │ Generate   │      │ Generate CHRT    │
   │ Recurring  │      │ Due              │
   │ Dues       │      │                  │
   └────────────┘      └────────┬─────────┘
        │                       │
        │ Create ₹400           │ Check: Feb < Feb?
        │ due for Feb           │ NO → Create due ✓
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
        ┌──────────────────────────┐
        │ FEBRUARY PAYMENT RECORD  │
        │ ₹900 due (₹400 recurring │
        │       + ₹500 CHRT)       │
        └──────────────────────────┘
```

---

## Recurring CHRT Poojas

CHRT poojas can also be recurring (e.g., "every February 6th"):

```
Scenario:
- Donor registers CHRT pooja
- Preferred Date: Feb 6, 2026
- Recurrence Frequency: ANNUALLY
```

**Processing:**
- February 2026: Create ₹500 due
- February 2027: Check (Feb 2027 >= Feb 2027)? YES → Create ₹500 due
- February 2028: Check (Feb 2028 >= Feb 2028)? YES → Create ₹500 due

Each year, when current month equals the preferred month, a due is generated.

---

## Stale Due Cleanup

**Function:** `_clean_stale_chrt_dues()` in [backend/pooja/services/recurrence.py](backend/pooja/services/recurrence.py#L481-L575)

This cleanup runs before CHRT due generation to remove incorrectly created dues:

```python
# Lines 510-528: Delete stale CHRT dues
for plan in chrt_plans:
    preferred_month = plan.one_time_date.replace(day=1)
    
    # If preferred month is in future, delete any existing CHRT dues
    # before that month (they shouldn't exist)
    if preferred_month > current_month:
        stale_count, _ = PaymentRecord.objects.filter(
            donor_id=plan.donor_id,
            registration__isnull=True,
            status=PaymentStatus.PENDING,
            payment_month__lt=preferred_month,
            notes__icontains='CHRT',
        ).delete()
```

**Purpose:**
- Catches any bugs that might have created CHRT dues in wrong months
- Ensures clean state before generating new dues

---

## Displaying CHRT Poojas in Donor Profile

**File:** [frontend/src/pages/DonorProfile.tsx](frontend/src/pages/DonorProfile.tsx#L1344-L1520)

The Donor Profile Page shows CHRT poojas in a separate tab:

```tsx
{/* CHRT POOJA TAB */}
{activeTab === 'chrt_pooja' && (
  <div>
    <h2>Choose Your Preferred Date - CHRT Pooja</h2>
    {/* Lists all CHRT registrations */}
    {chrtRegistrations.map(registration => (
      <div key={registration.id}>
        <h3>{registration.pooja_option_name}</h3>
        <p>Preferred Date: {preferredDate}</p>
        <p>Amount: ₹{amount}</p>
      </div>
    ))}
  </div>
)}
```

CHRT registrations are identified using:
```typescript
const isCHRTRegistration = (registration: PoojaRegistration) => {
  const code = getPayloadDayOptionCode(registration.cart_item ?? undefined);
  return code === 'CHRT' || 
         registration.day_option_description?.toLowerCase().includes('preferred date');
};
```

---

## Key Takeaways

### The Core Logic
1. **Identify CHRT:** Use `day_option.code == "CHRT"` or `one_time_date IS NOT NULL`
2. **Exclude from Recurring:** Filter out CHRT when generating regular monthly dues
3. **Check Future Date:** If preferred month > current month, skip due generation
4. **Create in Preferred Month:** Use `payment_month = preferred_month` when creating CHRT dues
5. **Cleanup Stale:** Remove incorrectly placed CHRT dues before generation

### Common Mistakes to Avoid
- ❌ Using `start_date` instead of `one_time_date` for CHRT poojas
- ❌ Not excluding CHRT from regular recurring due generation
- ❌ Creating CHRT dues for current month instead of preferred month
- ❌ Not handling future-dated CHRT poojas (skipping them)
- ❌ Forgetting to cleanup stale dues

### Validation Queries
To verify CHRT logic is working:

```python
# Check if a CHRT plan was created correctly
from pooja.models import RecurringPoojaPlan
plan = RecurringPoojaPlan.objects.filter(
    donor_id=donor_id,
    day_option__code='CHRT'
).first()
print(f"Preferred date: {plan.one_time_date}")
print(f"Recurrence kind: {plan.recurrence_kind}")

# Check payment records
from payments.models import PaymentRecord
chrt_dues = PaymentRecord.objects.filter(
    donor_id=donor_id,
    notes__icontains='CHRT'
)
for due in chrt_dues:
    print(f"Month: {due.payment_month}, Amount: {due.amount}")
```

---

## Related Files

### Backend
- [backend/pooja/services/recurrence.py](backend/pooja/services/recurrence.py) - Main logic
- [backend/pooja/models.py](backend/pooja/models.py) - Data models
- [backend/payments/services.py](backend/payments/services.py) - Passbook generation
- [backend/payments/models.py](backend/payments/models.py) - Payment records

### Frontend
- [frontend/src/pages/DonorProfile.tsx](frontend/src/pages/DonorProfile.tsx) - CHRT display
- [frontend/src/pages/PoojaRegistrationPage.tsx](frontend/src/pages/PoojaRegistrationPage.tsx) - Registration form
- [frontend/src/pages/payments/PaymentPage.tsx](frontend/src/pages/payments/PaymentPage.tsx) - Payment validation

---

## Tests

See [backend/pooja/tests.py](backend/pooja/tests.py) for test cases covering:
- CHRT pooja in future month (lines 712-805)
- CHRT pooja in current month
- Multiple CHRT poojas with different preferred dates
- Recurring CHRT poojas
- Stale due cleanup
