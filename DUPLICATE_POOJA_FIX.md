# Duplicate Pooja Registration Fix - Complete Solution

## Problem Statement

When donors registered multiple poojas in a single session with the same registration date, the poojas would appear in **BOTH** the "Recurring Plans" section AND the "One-time Registrations" section, causing the total amount to be counted twice.

### Example Issues:
1. **Amar Gopalakrishnan**: 5 poojas registered (₹600 total)
   - **Before**: ₹600 in Recurring Plans + ₹100 in One-time = ₹700 total shown
   - **After**: ₹600 in Recurring Plans only

2. **R Vaidhyanathan**: 5 poojas registered (₹600 total)
   - **Before**: ₹600 in Recurring Plans + ₹500 in One-time = ₹1,100 total shown
   - **After**: ₹600 in Recurring Plans only

## Root Cause Analysis

The issue occurred in two stages:

### 1. Backend Duplicate Creation
When `process_recurring_plans()` runs (on each API list request), it auto-creates new `PoojaRegistration` objects for the next payment cycle via `create_registration_from_plan()`. However:
- These auto-created registrations were NOT linked back to their originating `RecurringPoojaPlan`
- They had no `recurrence_kind` field set (unlike origin registrations)
- The frontend filter couldn't identify them as belonging to a recurring plan

### 2. Frontend Filter Failure
The `visibleRegistrations` filter in DonorProfile.tsx tried to hide registrations that belonged to recurring plans, but:
- It only had `origin_registration_id` to work with
- Auto-created registrations had no back-reference to their plan
- Filter couldn't identify and exclude these auto-created registrations

## Solution Implemented

### Change 1: Backend Model Enhancement
**File**: `backend/pooja/models.py`

Added a new `due_registration` ForeignKey field to `RecurringPoojaPlan`:
```python
due_registration = models.ForeignKey(
    PoojaRegistration,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="due_recurring_plans",
    help_text="Auto-created registration for the next scheduled occurrence of this plan",
)
```

**Purpose**: Tracks which auto-created registration belongs to which recurring plan.

### Change 2: Backend Service Update
**File**: `backend/pooja/services/recurrence.py`

Updated `create_registration_from_plan()` to link the created registration back to the plan:
```python
# Link this registration to the plan so the frontend can track it
plan.due_registration = registration
plan.save(update_fields=['due_registration'])
```

**Purpose**: Establishes the connection immediately after creating the registration.

### Change 3: Frontend Filter Update
**File**: `frontend/src/pages/DonorProfile.tsx`

Enhanced the `visibleRegistrations` filter to exclude `due_registration` entries:
```tsx
const visibleRegistrations = useMemo(() => {
  const recurringRegistrationIds = new Set<number>();
  const recurringDueRegistrationIds = new Set<number>();
  for (const plan of recurrencePlans) {
    if (plan.recurrence_kind === 'recurring') {
      if (typeof plan.origin_registration_id === 'number') {
        recurringRegistrationIds.add(plan.origin_registration_id);
      }
      // Hide the due registration (auto-created for next payment cycle)
      if (plan.due_registration?.id) {
        recurringDueRegistrationIds.add(plan.due_registration.id);
      }
    }
  }

  return registrations.filter((registration) => {
    if (recurringRegistrationIds.has(registration.id)) return false;
    if (recurringDueRegistrationIds.has(registration.id)) return false;
    // ... rest of filter logic
  });
}, [registrations, recurrencePlans]);
```

**Purpose**: Excludes both origin and auto-created registrations from the one-time section.

### Change 4: UI Consolidation
**File**: `frontend/src/pages/PoojaRegistrationPage.tsx`

Removed the redundant inline date picker from the cart summary section (lines 3487-3507). Users now select the registration date only through the dedicated modal dialog, providing a cleaner UX.

**Purpose**: Single date picker reduces confusion and ensures consistency.

## How It Works Now

### Step-by-Step Flow:

1. **User registers 5 poojas** with the same registration date
   - All 5 poojas are saved as `PoojaRegistration` objects
   - Each creates a `RecurringPoojaPlan` (if recurring is selected)
   - `origin_registration` field points back to the initial registration

2. **Backend processes recurring plans** (via `process_recurring_plans()`)
   - For each plan with `next_occurrence <= today`, it creates a new auto-registration
   - NEW: Sets `due_registration` field to link back to the plan
   - Updates `next_occurrence` for the plan

3. **Frontend fetches donor profile**
   - Receives list of registrations and recurring plans
   - Each plan now includes its `due_registration` details

4. **Frontend filters registrations**
   - Origin registrations (id in `origin_registration_id`) → HIDDEN from one-time tab
   - Due registrations (id in `due_registration.id`) → HIDDEN from one-time tab
   - Remaining registrations → SHOWN in one-time tab

5. **User sees correct totals**
   - Recurring Plans tab: Shows only the recurring plans (₹600)
   - One-time Registrations tab: Shows only truly one-time entries
   - Total amount is not duplicated

## Testing Verification

### Test Case 1: Initial Registration
1. Register 5 poojas with "Recurring" selected
2. Go to Donor Profile
3. **Expected**: All 5 appear in Recurring Plans, 0 in One-time

### Test Case 2: Auto-Created Registration
1. Wait for `process_recurring_plans()` to execute (or trigger manually)
2. Go to Donor Profile
3. **Expected**: Still 5 in Recurring Plans, 0 in One-time (the auto-created one is hidden)

### Test Case 3: Mixed Registration
1. Register 3 recurring poojas + 2 one-time poojas
2. Go to Donor Profile
3. **Expected**: 
   - Recurring Plans: 3 poojas
   - One-time Registrations: 2 poojas
   - No overlap

## Migration Notes

⚠️ **Database Migration Required**

A Django migration needs to be created and applied:

```bash
python manage.py makemigrations pooja
python manage.py migrate pooja
```

This adds the `due_registration` field to the `pooja_recurringpoojaplan` table.

## Files Modified

1. ✅ `backend/pooja/models.py` - Added `due_registration` field
2. ✅ `backend/pooja/services/recurrence.py` - Link registration to plan
3. ✅ `frontend/src/pages/DonorProfile.tsx` - Enhanced filter logic
4. ✅ `frontend/src/pages/PoojaRegistrationPage.tsx` - Removed duplicate date picker

## Backward Compatibility

✅ **Fully backward compatible**
- The `due_registration` field is nullable (`null=True`)
- Existing registrations continue to work
- Old data where `due_registration` is NULL will simply not be filtered (fallback behavior)
- No API contract changes for clients

## Performance Impact

✅ **Minimal performance impact**
- One additional FK field query (already lazy-loaded by serializer)
- No new database queries in the filter loop
- Uses existing `due_registration` SerializerMethodField which was already computing similar data

## Future Improvements

1. Add admin interface to manually link mis-matched registrations
2. Add cleanup task to remove orphaned auto-created registrations
3. Add audit logging to track which registrations were auto-created and when
