# Complete Bug Analysis Summary: Duplicate Registrations in Both Sections

## Issue Statement
Donors registering multiple poojas are seeing them in **BOTH** "Recurring Plans" AND "One-time Registrations":
- **Amar Gopalakrishnan**: 5 poojas (₹600 total) showing as ₹700 (₹100 extra in one-time)
- **R Vaidhyanathan**: 5 poojas (₹600 total) showing as ₹1,100 (₹500 extra in one-time)

---

## Root Cause Identified

### The Core Problem: Automatic Registration Creation Without Recurrence Metadata

**When a donor registers recurring poojas:**

1. **Initial Registration Flow (working correctly)**:
   - Frontend sends: `{recurrence_kind: 'recurring', ...}`
   - Backend creates: `PoojaRegistration` object + `RecurringPoojaPlan` with `recurrence_kind='recurring'`
   - Plan stores: `origin_registration_id` (links back to the registration)
   - Display: Registration hidden from "one-time" tab ✅

2. **Automatic Subsequent Month Flow (THE BUG)**:
   - Every time `/api/pooja/registrations/` is called, `process_recurring_plans()` runs
   - Creates NEW `PoojaRegistration` for next month's occurrence
   - **But this new registration has NO recurrence metadata**
   - Frontend sees: No `recurrence_kind` field → not marked as recurring
   - Display: Registration appears in "one-time" section ❌

---

## Critical Code Locations

### 1. Where "one_time_extra" Registrations Are Created

**PRIMARY SOURCE**: [backend/pooja/services/recurrence.py:240-276]
```python
def create_registration_from_plan(plan: RecurringPoojaPlan, due_date: Optional[date] = None) -> PoojaRegistration:
    """Create a new registration from an existing plan."""
    
    registration = PoojaRegistration.objects.create(
        donor=plan.donor,
        pooja_option=plan.pooja_option,
        day_option=plan.day_option,
        start_date=scheduled_date,  # ← For NEXT OCCURRENCE
        total_amount=plan.amount,
        # ⚠️ NO recurrence_kind field exists in PoojaRegistration model
        # ⚠️ NO link back to the plan that created it
    )
    return registration
```

**CALLED BY**: [backend/pooja/services/recurrence.py:289-304]
```python
def prepare_recurring_registration(plan: RecurringPoojaPlan, *, reference_date: Optional[date] = None) -> Optional[PoojaRegistration]:
    if plan.recurrence_kind != RecurrenceKind.RECURRING or not plan.is_active:
        return None
    
    # ... checks ...
    
    registration = create_registration_from_plan(plan, due_date=target_date)
    _advance_plan(plan, processed_date)
    return registration
```

**TRIGGERED BY**: [backend/pooja/views.py:333-336]
```python
class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    def list(self, request, *args, **kwargs):
        process_recurring_plans()  # ← Called EVERY TIME this endpoint is hit
        return super().list(request, *args, **kwargs)
```

### 2. Where Frontend Filtering Fails

**FILE**: [frontend/src/pages/DonorProfile.tsx:499-533]
```typescript
const visibleRegistrations = useMemo(() => {
  const recurringRegistrationIds = new Set<number>();
  const recurringDueRegistrationIds = new Set<number>();
  
  // Collect IDs from RECURRING plans
  for (const plan of recurrencePlans) {
    if (plan.recurrence_kind === 'recurring') {
      if (typeof plan.origin_registration_id === 'number') {
        recurringRegistrationIds.add(plan.origin_registration_id);
      }
      if (plan.due_registration?.id) {
        recurringDueRegistrationIds.add(plan.due_registration.id);
      }
    }
  }

  return registrations.filter((registration) => {
    // Hide origin registrations of recurring plans
    if (recurringRegistrationIds.has(registration.id)) return false;
    if (recurringDueRegistrationIds.has(registration.id)) return false;

    const cartRecurrenceKind =
      registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
    const hasRecurrenceKind = Boolean(registration.recurrence_kind);

    // Hide explicitly marked recurring registrations
    if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
      return false;
    }
    if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
      return false;
    }

    return true; // ← Passes all other registrations through
  });
}, [registrations, recurrencePlans]);
```

**THE PROBLEM**: The filter relies on:
1. `plan.due_registration?.id` to know which registrations are "due" for recurring plans
2. But if the API response doesn't include the due_registration data, it won't filter them out

---

## Data Flow Diagram

```
SCENARIO: Donor registers 5 recurring poojas on 01/01/2026

┌─ JANUARY 2026 ─────────────────────────────┐
│ USER: Registers 5 poojas (recurring)        │
└──────────────────────────────────────────────┘
             ↓
┌─ BACKEND CREATES ───────────────────────────┐
│ PoojaRegistration #1,2,3,4,5                │
│ RecurringPoojaPlan #1,2,3,4,5               │
│  └─ recurrence_kind='recurring'             │
│  └─ origin_registration_id=1,2,3,4,5        │
│  └─ next_occurrence='2026-02-01'            │
└──────────────────────────────────────────────┘
             ↓
┌─ FRONTEND FETCH ────────────────────────────┐
│ GET /api/pooja/registrations/               │
│ → Triggers process_recurring_plans()        │
└──────────────────────────────────────────────┘
             ↓
┌─ FEBRUARY AUTO-CREATION ───────────────────┐
│ prepare_recurring_registration()            │
│  → create_registration_from_plan(plan#1)    │
│     Creates: NEW PoojaRegistration #6       │
│     (for Feb 1st occurrence of pooja #1)    │
│  → create_registration_from_plan(plan#2)    │
│     Creates: NEW PoojaRegistration #7       │
│     ... and so on ...                       │
│                                             │
│ Result:                                     │
│  - Registrations #6-10 created              │
│  - NO recurrence metadata                   │
│  - NO plan reference back                   │
└──────────────────────────────────────────────┘
             ↓
┌─ FRONTEND DISPLAY ──────────────────────────┐
│ Filter visibleRegistrations()               │
│  - Hides: #1,2,3,4,5 (origin of recurring)  │
│  - Shows: #6,7,8,9,10 (no metadata)         │
│                                             │
│ Tab 1 "Recurring Plans":                   │
│  - 5 plans → Total ₹600 ✅                  │
│                                             │
│ Tab 2 "One-time Registrations":            │
│  - Registrations #6-10 → Total ₹500 ❌      │
│  - Also shows #1 (if filtered wrong)        │
│  - TOTAL SHOWN: ₹1,100 ❌❌❌                 │
└──────────────────────────────────────────────┘
```

---

## The Complete Bug Chain

### Step 1: Initial Registration (CORRECT ✅)
```python
# serializers.py:245-260
registration = PoojaRegistration.objects.create(id=1, total_amount=100)
create_plan_from_registration(
    registration=registration,
    recurrence_kind='recurring',  # ← From frontend
)
# Result:
# - PoojaRegistration#1 exists
# - RecurringPoojaPlan#1 exists with origin_registration_id=1
```

### Step 2: Automatic Monthly Creation (PROBLEMATIC ❌)
```python
# services/recurrence.py:289-304
for plan in active_recurring_plans:
    registration = create_registration_from_plan(plan, due_date='2026-02-01')
    
# services/recurrence.py:240-276
PoojaRegistration.objects.create(
    donor_id=1,
    pooja_option_id=plan.pooja_option_id,
    start_date='2026-02-01',  # ← Next month
    total_amount=100,
    # ⚠️ recurrence_kind: not set (PoojaRegistration has no such field)
    # ⚠️ origin_registration_id: not set (only exists on plan)
)
# Result:
# - PoojaRegistration#6 created
# - NOT linked back to any plan
# - Has no recurrence metadata
```

### Step 3: Frontend Filtering (INCOMPLETE ❌)
```typescript
// DonorProfile.tsx:499-533

// Collect hidden IDs
const recurringRegistrationIds = {1,2,3,4,5}  // Origin registrations
const recurringDueRegistrationIds = {?}       // ← MISSING #6-10!

// Filter registrations
registrations.filter(r => {
    // r.id = 6: NOT in recurringRegistrationIds → PASS
    // r.id = 6: NOT in recurringDueRegistrationIds → PASS
    // r.recurrence_kind = undefined → Not marked recurring → PASS
    // RESULT: Shown in one-time section ❌
})
```

---

## Why Only Some Registrations Appear Duplicated

The duplication doesn't happen for ALL poojas because:

1. **Timing**: Duplication only occurs if `process_recurring_plans()` has already been called
2. **Plan State**: Only ACTIVE recurring plans create monthly registrations
3. **API Response**: Depends on whether `due_registration` is included in the API response

This explains why:
- Amar sees 1 of 5 poojas duplicated (only that month's auto-creation happened)
- R sees 4 of 5 poojas duplicated (multiple months have processed)

---

## Where "one_time_extra" Plans Are Properly Created

**CORRECT USAGE** (NOT the bug):

File: [backend/pooja/serializers.py:245-260]
```python
# When frontend sends: recurrence_kind='one_time_extra'
recurrence_kind = validated_data.pop("recurrence_kind", None)  # ← 'one_time_extra'

if recurrence_kind:
    create_plan_from_registration(
        registration=registration,
        recurrence_kind=recurrence_kind,  # ← 'one_time_extra'
        recurrence_one_time_date=recurrence_one_time_date,
    )
    # Creates: RecurringPoojaPlan with recurrence_kind='one_time_extra'
    #          and origin_registration_id pointing to this registration
```

This is correct and works as designed. The bug is NOT in how `one_time_extra` is created intentionally, but rather in how RECURRING registrations spawn automatic monthly registrations that lack proper metadata.

---

## Summary: Root Cause vs Symptoms

| Aspect | Details |
|--------|---------|
| **Root Cause** | Automatic registration creation from recurring plans has no recurrence metadata or plan linkage |
| **Affected Registrations** | Newly created registrations for next/future occurrences of recurring poojas |
| **Symptom 1** | These registrations appear in "One-time Registrations" section |
| **Symptom 2** | Both sections show amounts, doubling the total displayed |
| **Why It's Subtle** | Original registrations are correctly hidden, but their monthly duplicates are not |
| **Detection** | Appears only after `process_recurring_plans()` has created future month registrations |
| **Impact** | Donors see inflated amounts; financial records may double-count same poojas |

---

## Files Containing the Bug

### Backend
1. **[pooja/services/recurrence.py:240-276]** - `create_registration_from_plan()` creates registrations without metadata
2. **[pooja/services/recurrence.py:289-304]** - `prepare_recurring_registration()` calls above function
3. **[pooja/views.py:333-336]** - Triggers `process_recurring_plans()` on every list request

### Frontend  
4. **[DonorProfile.tsx:499-533]** - Filter assumes `due_registration` is always populated in API response

---

## Solution Approach (High Level)

**Option 1: Add Metadata to Auto-Created Registrations**
- Store recurrence info on `PoojaRegistration` model
- Update auto-creation to set `recurrence_kind='recurring'` and link to plan
- Frontend filter would then work correctly

**Option 2: Fix Frontend Filter**
- Don't rely on `due_registration` field alone
- Query the database directly for which registrations belong to recurring plans
- Use both `origin_registration_id` AND cycle back from plans

**Option 3: Disable Automatic Auto-Creation**
- Only create registrations when explicitly paid for
- Use `process_recurring_plans()` for payment generation, not registration generation
- Requires frontend to handle "pending next month" state differently

---

## Verification Steps

Run these queries on affected donor accounts:

```sql
-- How many registrations created for same pooja in Jan and Feb?
SELECT 
    p.pooja_option_id,
    po.name,
    r.start_date,
    COUNT(*) as count,
    SUM(r.total_amount) as total
FROM pooja_poojaregistration r
JOIN pooja_poojaoption po ON r.pooja_option_id = po.id
WHERE r.donor_id = ?
    AND r.start_date IN ('2026-01-01', '2026-02-01')
GROUP BY p.pooja_option_id, po.name, r.start_date;

-- Are there plans with origin registrations?
SELECT 
    rpp.recurrence_kind,
    COUNT(*) as count
FROM pooja_recurringpoojaplan rpp
WHERE rpp.donor_id = ?
GROUP BY rpp.recurrence_kind;

-- Cross check: Are auto-created registrations in the due_registration data?
SELECT 
    rpp.id,
    rpp.origin_registration_id,
    pr.id as due_registration_id,
    pr.start_date
FROM pooja_recurringpoojaplan rpp
LEFT JOIN pooja_poojaregistration pr 
    ON pr.donor_id = rpp.donor_id 
    AND pr.pooja_option_id = rpp.pooja_option_id
    AND pr.start_date = rpp.next_occurrence
WHERE rpp.donor_id = ?
ORDER BY rpp.id;
```

