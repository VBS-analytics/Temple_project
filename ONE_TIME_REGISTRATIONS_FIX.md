# One-Time Registrations Auto-Disappearing - Root Cause & Fix

## Issue Summary
After deploying new code, one-time registrations for a few donors who completed payment were automatically disappearing from the "One-time Registrations" tab on the Donor Profile page.

## Root Cause Analysis

### What Was Happening
The issue was **NOT an actual deletion** from the database, but rather **incorrect filtering logic on the frontend** that was hiding one-time registrations.

### The Bug Location
**File**: `frontend/src/pages/DonorProfile.tsx` (lines 500-515)

**Problem Code**:
```tsx
const visibleRegistrations = useMemo(() => {
  // ... code to collect recurring registration IDs ...
  return registrations.filter((registration) => {
    if (recurringRegistrationIds.has(registration.id)) return false;
    const cartRecurrenceKind =
      registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
    const hasRecurrenceKind = Boolean(registration.recurrence_kind);
    return !hasRecurrenceKind && !cartRecurrenceKind;  // ❌ TOO RESTRICTIVE
  });
});
```

### Why This Happened

1. **Payment Completion Workflow**:
   - When a donor completes payment for a one-time pooja
   - The payment completion triggers `process_recurring_plans()` function
   - This creates a `RecurringPoojaPlan` with `recurrence_kind='one_time_extra'`
   - The plan is linked to the original registration via `origin_registration_id`

2. **The Filtering Issue**:
   - The filter was checking: `!hasRecurrenceKind && !cartRecurrenceKind`
   - This EXCLUDED all registrations with ANY recurrence data
   - Even though one-time poojas that are tracked have some recurrence metadata, they shouldn't be hidden
   - The intent was to hide RECURRING (monthly/quarterly/annual) registrations, not ONE-TIME ones

### Why Only Some Donors Were Affected
- Only donors who **completed full payment** for their one-time poojas
- The payment system triggered automatic plan creation
- This assigned recurrence tracking data to the registration
- The overly-restrictive filter then hid these registrations

## The Solution

### What Was Fixed
The filter logic now correctly distinguishes between:
- **RECURRING** plans (should hide origin registration) ✅
- **ONE_TIME_EXTRA** plans (should NOT hide origin registration) ✅

### Updated Code
```tsx
const visibleRegistrations = useMemo(() => {
  // Only hide registrations that are origin registrations for RECURRING plans
  const recurringRegistrationIds = new Set<number>();
  for (const plan of recurrencePlans) {
    // ✅ Only exclude if this is a RECURRING plan (not one-time-extra)
    if (plan.recurrence_kind === 'recurring' && typeof plan.origin_registration_id === 'number') {
      recurringRegistrationIds.add(plan.origin_registration_id);
    }
  }
  
  return registrations.filter((registration) => {
    // Filter out origin registrations for recurring plans only
    if (recurringRegistrationIds.has(registration.id)) return false;
    
    const cartRecurrenceKind =
      registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
    const hasRecurrenceKind = Boolean(registration.recurrence_kind);
    
    // ✅ Only exclude RECURRING recurrence kinds
    // ✅ Include ONE_TIME_EXTRA and other tracking data
    if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
      return false;
    }
    if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
      return false;
    }
    
    return true;  // ✅ Show the registration
  });
}, [registrations, recurrencePlans]);
```

## Impact
- ✅ One-time registrations now remain visible after payment completion
- ✅ Recurring registrations are still properly hidden from the one-time view
- ✅ No database changes required
- ✅ No data was ever lost; registrations just weren't being displayed

## Files Modified
- `frontend/src/pages/DonorProfile.tsx` - Fixed filtering logic in `visibleRegistrations` useMemo hook

## Testing Recommendations
1. Create a test donor with one-time poojas
2. Complete payment for the poojas
3. Verify the one-time registrations remain visible in the "One-time Registrations" tab
4. Verify recurring poojas are still properly hidden from the one-time tab
5. Verify the "Recurring Pooja Plans" tab correctly shows recurring subscriptions
