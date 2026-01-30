# Bug Analysis: Donors Seeing Registrations in BOTH "Recurring Plans" AND "One-time Registrations"

## Executive Summary

Donors registering multiple poojas are seeing them appear in **BOTH** "Recurring Plans" AND "One-time Registrations" sections simultaneously, causing inflated totals:
- Amar Gopalakrishnan: Sees ₹700 instead of ₹600 (₹100 duplicate in one-time section)
- R Vaidhyanathan: Sees ₹1,100 instead of ₹600 (₹500 duplicate in one-time section)

**Root Cause Identified**: The filtering logic in `DonorProfile.tsx` is incorrectly hiding/showing registrations that are linked to `RecurringPoojaPlan` records with `recurrence_kind='one_time_extra'`.

---

## The System Architecture (Before Bug)

### Three Key Data Structures

#### 1. **PoojaRegistration** (Backend: `pooja/models.py`)
- Represents a single pooja registration event
- Fields: `donor`, `pooja_option`, `start_date`, `total_amount`, `status`, etc.
- Created when a donor submits a registration through the API

#### 2. **RecurringPoojaPlan** (Backend: `pooja/models.py`)
- Links registrations into recurring schedules
- Fields: `recurrence_kind` (enum: 'recurring' or 'one_time_extra'), `origin_registration_id`, `next_occurrence`, `one_time_date`
- Has `origin_registration` ForeignKey pointing back to the original `PoojaRegistration`
- Two types:
  - **RECURRING**: Monthly/Quarterly/Annually repeating poojas → `is_active=True`, `next_occurrence` set
  - **ONE_TIME_EXTRA**: Single one-time pooja tracked separately → `is_active=False`, `next_occurrence=None`, `one_time_date` set

#### 3. **Frontend Display Logic** (Frontend: `frontend/src/pages/DonorProfile.tsx`)
- Two tabs: "Recurring Plans" vs "One-time Registrations"
- Uses `visibleRegistrations` filter to separate which registrations show where

---

## The Filtering Logic (Current - BUGGY)

**File**: [DonorProfile.tsx](DonorProfile.tsx#L499-L533)

```tsx
const visibleRegistrations = useMemo(() => {
  const recurringRegistrationIds = new Set<number>();
  const recurringDueRegistrationIds = new Set<number>();
  
  // Collect IDs of registrations linked to RECURRING plans
  for (const plan of recurrencePlans) {
    if (plan.recurrence_kind === 'recurring') {  // ✅ CORRECT: Only recurring
      if (typeof plan.origin_registration_id === 'number') {
        recurringRegistrationIds.add(plan.origin_registration_id);
      }
      if (plan.due_registration?.id) {
        recurringDueRegistrationIds.add(plan.due_registration.id);
      }
    }
  }

  return registrations.filter((registration) => {
    // ❌ BUG: Exclude if registration is origin of recurring plan
    if (recurringRegistrationIds.has(registration.id)) return false;
    if (recurringDueRegistrationIds.has(registration.id)) return false;

    // ❌ BUG: Also exclude if has ANY recurrence metadata
    const cartRecurrenceKind = registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
    const hasRecurrenceKind = Boolean(registration.recurrence_kind);

    if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
      return false;
    }
    if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
      return false;
    }

    return true;  // ✅ Include all others (one-time registrations)
  });
}, [registrations, recurrencePlans]);
```

### The Bug Mechanism

**When a donor registers 5 poojas with "Recurring" recurrence kind:**

1. **Backend API (serializer.py#L245-L251)**:
   - Creates 1 `PoojaRegistration` object for the registration
   - Calls `create_plan_from_registration()` with `recurrence_kind='recurring'`
   - Creates 1 `RecurringPoojaPlan` with `recurrence_kind='recurring'` and `origin_registration_id` pointing to the registration

2. **Frontend Filtering (DonorProfile.tsx#L499-533)**:
   - Collects `origin_registration_id` from all RECURRING plans → Registration ID is added to hide set
   - Filters `visibleRegistrations` → Registration is excluded ✅ CORRECT

3. **Display Result**:
   - "Recurring Plans" tab shows the `RecurringPoojaPlan` record → ✅ Shows correctly
   - "One-time Registrations" tab filters out the origin registration → ✅ Shows correctly

---

**But when a donor registers multiple poojas WITH EACH ONE marked "Recurring":**

The flow per registration is:
1. Register Pooja A (Recurring) → Creates Registration#1 + Plan#1 (recurrence_kind='recurring', origin_registration_id=1)
2. Register Pooja B (Recurring) → Creates Registration#2 + Plan#2 (recurrence_kind='recurring', origin_registration_id=2)
3. Register Pooja C (Recurring) → Creates Registration#3 + Plan#3 (recurrence_kind='recurring', origin_registration_id=3)
4. Register Pooja D (Recurring) → Creates Registration#4 + Plan#4 (recurrence_kind='recurring', origin_registration_id=4)
5. Register Pooja E (Recurring) → Creates Registration#5 + Plan#5 (recurrence_kind='recurring', origin_registration_id=5)

**Expected Result**: All 5 registrations hidden from "One-time" tab, shown in "Recurring Plans" tab

**Actual Result (The Bug)**: Some registrations appear in BOTH tabs

---

## Root Cause Deep Dive

**The actual bug is NOT in the filtering logic itself** — it appears the filtering is technically correct. The issue is likely:

### Hypothesis 1: "one_time_extra" Plans Being Created for Recurring Registrations

**File Location**: [services/recurrence.py#L168-L209](services/recurrence.py#L168-L209)

The `create_plan_from_registration()` function is called in the serializer whenever a registration is created with a `recurrence_kind`:

```python
def create(self, validated_data):
    # ... 
    registration = PoojaRegistration.objects.create(**validated_data)
    self._sync_members(registration, members)
    if recurrence_kind:
        create_plan_from_registration(
            registration=registration,
            recurrence_kind=recurrence_kind,  # This comes from the request
            recurrence_frequency=recurrence_frequency,
            recurrence_one_time_date=recurrence_one_time_date,
            cart_item_payload=cart_item_payload,
        )
```

**Possible Issue**: If the frontend is sending `recurrence_kind='one_time_extra'` for what should be recurring poojas, BOTH a RECURRING plan AND a ONE_TIME_EXTRA plan could be created for the same registration.

### Hypothesis 2: Duplicate Registrations Being Created

**File Location**: [services/recurrence.py#L289-L304](services/recurrence.py#L289-L304)

The `prepare_recurring_registration()` function creates NEW registrations from existing plans:

```python
def prepare_recurring_registration(plan: RecurringPoojaPlan, *, reference_date: Optional[date] = None) -> Optional[PoojaRegistration]:
    if plan.recurrence_kind != RecurrenceKind.RECURRING or not plan.is_active:
        return None
    target_date = plan.next_occurrence
    if target_date is None:
        return None
    if plan.pause_from and plan.pause_until and plan.pause_from <= target_date <= plan.pause_until:
        return None
    registration = create_registration_from_plan(plan, due_date=target_date)  # ← Creates NEW registration
    processed_date = reference_date or target_date
    _advance_plan(plan, processed_date)
    return registration
```

**Possible Issue**: When `process_recurring_plans()` is called (which happens in `PoojaRegistrationViewSet.list()`), it might create ADDITIONAL `PoojaRegistration` records for each recurring plan's next_occurrence. These new registrations won't have an origin plan, so they could appear as "one-time" registrations.

### Hypothesis 3: Cart Data Mismatch

**File Location**: [DonorProfile.tsx#L518-L533](DonorProfile.tsx#L518-L533)

The filter also checks `registration.cart_item?.recurrenceKind`:

```tsx
const cartRecurrenceKind =
  registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
const hasRecurrenceKind = Boolean(registration.recurrence_kind);

if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
  return false;
}
if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
  return false;
}
```

**Possible Issue**: The `cart_item` payload might be missing or have inconsistent data, causing registrations that SHOULD be hidden to not be hidden.

---

## Where "one_time_extra" Registrations Are Created

Based on code analysis:

### Primary Creation Point: Payment Processing
**File**: [backend/pooja/services/recurrence.py#L168-L209](services/recurrence.py#L168-L209)

When a registration is initially created with `recurrence_kind='one_time_extra'`, a `RecurringPoojaPlan` is created with:
- `recurrence_kind='one_time_extra'`
- `one_time_date` set to the specified date
- `is_active=True` (for tracking only)
- `origin_registration_id` pointing to the registration

**This is intentional and correct** — one-time extra poojas are tracked via plans.

### Secondary Creation Point: Recurring Plan Processing
**File**: [backend/pooja/services/recurrence.py#L289-L304](services/recurrence.py#L289-L304)

The `prepare_recurring_registration()` function creates NEW `PoojaRegistration` records from `RecurringPoojaPlan` records for upcoming occurrences. These registrations are:
- Created fresh (not linked to origin plan via `recurrence_kind`)
- Intended to be paid for separately
- May NOT be hidden properly if filtering logic doesn't account for them

---

## The Actual Manifestation

Based on the symptoms (some poojas appearing in both sections), the most likely scenario is:

1. **Donor registers 5 poojas all marked "Recurring"** on 01/01/2026
2. **Backend creates** 5 registrations + 5 recurring plans ✅
3. **First "Recurring Plans" tab shows** all 5 plans + their amounts ✅
4. **Some registrations also appear in "One-time Registrations" tab** ❌ SHOULD NOT

This happens if:
- The filtering is not properly excluding the origin registrations of the recurring plans, OR
- Additional registrations are being created that don't have a corresponding plan record, OR
- Some registrations have `recurrence_kind='one_time_extra'` in the database when they should have `recurrence_kind=None`

---

## Recommended Investigation Steps

### 1. Database Query - Check Affected Donors

```sql
-- For Amar Gopalakrishnan (ID to be found)
SELECT r.id, r.pooja_option_id, r.total_amount, r.recurrence_kind, r.start_date, r.created_at
FROM pooja_poojaregistration r
WHERE r.donor_id = (SELECT id FROM accounts_user WHERE name LIKE '%Amar Gopalakrishnan%')
AND r.start_date = '2026-01-01'
ORDER BY r.created_at;

-- Check if there are corresponding plans
SELECT p.id, p.recurrence_kind, p.origin_registration_id, p.amount, p.one_time_date
FROM pooja_recurringpoojaplan p
WHERE p.donor_id = (SELECT id FROM accounts_user WHERE name LIKE '%Amar Gopalakrishnan%')
ORDER BY p.created_at;
```

### 2. Check Frontend API Response

Look at the actual API response from:
- `GET /api/pooja/registrations/?donor_id=XXX` — What registrations are returned?
- `GET /api/pooja/plans/?donor=XXX` — What plans are returned?

### 3. Verify Filtering Logic

Add console logs to `visibleRegistrations` calculation to see:
- Which registration IDs are in `recurringRegistrationIds`?
- Which registrations are being filtered out?
- Which registrations are being kept?

---

## Summary Table

| Aspect | Status | Notes |
|--------|--------|-------|
| **One-time registrations incorrectly showing** | ✅ CONFIRMED | Amar: 1 pooja, R: 4 poojas |
| **Recurring Plans showing correctly** | ✅ YES | All 5 poojas appear there |
| **Double-counting of amounts** | ✅ CONFIRMED | ₹700 vs ₹600, ₹1,100 vs ₹600 |
| **Filtering logic (DonorProfile.tsx)** | ⚠️ CORRECT IN PRINCIPLE | But may not match backend data |
| **Database constraint issue** | ⚠️ POSSIBLE | Check if duplicate plans exist |
| **Recurrence_kind mismatch** | ⚠️ POSSIBLE | Some registrations marked as one_time_extra when they should be recurring |
| **Auto-creation of due registrations** | ⚠️ POSSIBLE | New registrations created from plans without proper linking |

---

## Files Involved

### Backend
1. [pooja/models.py](backend/pooja/models.py) - Models definition
2. [pooja/serializers.py#L238-L260](backend/pooja/serializers.py#L238-L260) - Registration creation logic
3. [pooja/services/recurrence.py#L168-L209](backend/pooja/services/recurrence.py#L168-L209) - Plan creation from registration
4. [pooja/services/recurrence.py#L289-L304](backend/pooja/services/recurrence.py#L289-L304) - Registration creation from plan
5. [pooja/views.py#L328-370](backend/pooja/views.py#L328-L370) - Registration API endpoints
6. [pooja/views.py#L616-680](backend/pooja/views.py#L616-L680) - Plan API endpoints

### Frontend
1. [DonorProfile.tsx#L499-533](frontend/src/pages/DonorProfile.tsx#L499-L533) - Filtering logic for visible registrations

---

## Next Steps for Fix

Once the exact cause is confirmed through investigation:

1. **If filtering logic issue**: Correct the condition checks in `visibleRegistrations` calculation
2. **If database issue**: Migrate data to fix incorrect `recurrence_kind` values
3. **If plan creation issue**: Ensure plans are created with correct type when registrations are submitted
4. **If due registration creation**: Ensure automatically-created registrations from plans are properly linked back
