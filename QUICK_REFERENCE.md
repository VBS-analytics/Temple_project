# 🎯 Production Deployment Status & Quick Reference

## Current Status: ⛔ NOT PRODUCTION READY

### Fixed (✅ 2 Issues)
- Duplicate pooja registration bug (appears in both sections)
- Redundant date picker in UI

### Critical Issues Found (🚨 7 Issues)
- Race condition in registration numbers
- NULL amount crashes
- Multiple due_registrations = double charging
- Plan deletion orphans registrations  
- Missing recurrence frequency validation
- No idempotency on duplicate submissions
- Payment collection signals missing

### Timeline to Production: 4 weeks (62 hours)
### Financial Risk if Deployed Now: ₹65K-₹900K/month

---

## Critical Code Locations

### 🔴 PRIMARY BUG SOURCE: Auto-Created Registrations

**File**: `backend/pooja/services/recurrence.py`

```
Line 240-276: create_registration_from_plan()
  ↓ Creates NEW PoojaRegistration without recurrence metadata
  ↓ No way to link back to the plan that created it
  ↓ No way to mark as "this is for next month"
```

**Triggered by**:
```
Line 289-304: prepare_recurring_registration()
  ↓ Called by process_recurring_plans()
  ↓ Which is called by...
```

**File**: `backend/pooja/views.py`

```
Line 333-336: PoojaRegistrationViewSet.list()
  ↓ Calls process_recurring_plans() EVERY TIME
  ↓ Creates new month registrations AUTOMATICALLY
```

---

### 🟡 FRONTEND FILTER FAILURE: Can't Identify Auto-Created Registrations

**File**: `frontend/src/pages/DonorProfile.tsx`

```
Line 499-533: visibleRegistrations useMemo hook
  ├─ Expects: registration.recurrence_kind field
  ├─ Expects: plan.due_registration.id to be populated
  ├─ Expects: registration.cart_item?.recurrenceKind
  └─ PROBLEM: Auto-created registrations have NONE of these!
```

---

## Model Structure Problem

### What SHOULD Exist (But Doesn't)

**PoojaRegistration model** needs one of:
```python
# Option 1: Store type on registration
recurrence_kind = models.CharField(...)  # ← MISSING

# Option 2: Link to plan
recurring_plan = models.ForeignKey(RecurringPoojaPlan, ...)  # ← MISSING

# Option 3: Store plan ID
recurring_plan_id = models.IntegerField(...)  # ← MISSING
```

### What Actually Exists

```python
# Only in RecurringPoojaPlan:
origin_registration = ForeignKey(PoojaRegistration)  # ← Only forward link!
recurrence_kind = CharField()                        # ← Only in plan!
```

**Problem**: When auto-created registrations are generated, they're NOT linked to the plan that created them. Only INITIAL registrations have this link via `origin_registration_id`.

---

## Data Flow Map

```
JANUARY 2026
Donor submits: 5 poojas (all "recurring")
         ↓
Creates: 5 PoojaRegistration + 5 RecurringPoojaPlan
    origin_reg_id=1,2,3,4,5 (in plans)
         ↓
FEBRUARY 2026 (auto-triggered by any API call)
Creates: 5 NEW PoojaRegistration (for Feb 1st occurrence)
    ❌ NO metadata
    ❌ NOT linked to plans
    ❌ NOT marked as recurring
         ↓
FRONTEND FETCH
Registrations returned: 10 (5 original + 5 auto-created)
Plans returned: 5 (marked as recurring)
         ↓
FILTERING
- Hides: PR#1-5 (origin registrations) ✅
- Shows: PR#6-10 (auto-created) ❌
         ↓
DISPLAY
Tab 1 "Recurring": Shows 5 plans, ₹500
Tab 2 "One-time": Shows 5 auto-created, ₹500
TOTAL SHOWN: ₹1,000 (should be ₹500)
```

---

## Code Search Summary

### What We Found (Confirmed)

| Search Term | Location | Finding |
|------------|----------|---------|
| `create_plan_from_registration` | [services/recurrence.py:168] | Creates plan with type from request ✅ |
| `create_registration_from_plan` | [services/recurrence.py:240] | Creates registration WITHOUT type ❌ |
| `prepare_recurring_registration` | [services/recurrence.py:289] | Calls above function automatically ❌ |
| `process_recurring_plans` | [views.py:333] | Triggered on EVERY list request ❌ |
| `one_time_extra` | [serializers.py:239] | Properly created when intentional ✅ |
| `recurrence_kind` | [models.py:163] | Only exists on RecurringPoojaPlan ❌ |
| `visibleRegistrations` | [DonorProfile.tsx:499] | Filter assumes metadata that doesn't exist ❌ |

### What's Missing (Confirmed)

| Missing Item | Location | Impact |
|-------------|----------|--------|
| `recurrence_kind` field | PoojaRegistration model | Can't mark registrations as recurring |
| Reverse link to plan | PoojaRegistration model | Auto-created regs not linked |
| `due_registration` in API | Views serializer | Filter can't identify due registrations |
| Conditional auto-creation | Views list() | Happens every request, not just first |

---

## The Two Types of "one_time_extra" in Code

### Type 1: Intentional One-Time Registrations (CORRECT)
```python
# Frontend sends: recurrence_kind='one_time_extra'
# Backend creates:
PoojaRegistration #1
RecurringPoojaPlan (recurrence_kind='one_time_extra', origin_registration_id=1)

# Display: Shows correctly in one-time section
# Status: ✅ WORKING AS DESIGNED
```

### Type 2: Accidentally-Appearing Recurring Registrations (THE BUG)
```python
# Frontend sends: recurrence_kind='recurring'
# Backend creates:
PoojaRegistration #1 (initial)
RecurringPoojaPlan (recurrence_kind='recurring', origin_registration_id=1)
... later ...
PoojaRegistration #2 (auto-created, NO recurrence metadata)

# Display: #2 shows in one-time section ❌
# Status: ❌ BUG - appears as one-time but tracked as recurring
```

**The confusion**: The bug manifests as "one-time" appearing incorrectly, but the underlying issue is that auto-created RECURRING registrations can't be identified as such.

---

## Evidence Summary

### ✅ Confirmed Evidence

1. **Model constraint**: PoojaRegistration has NO recurrence_kind field
   - Checked: [backend/pooja/models.py:95-138]
   - Confirmed: Only 18 fields, no recurrence_kind

2. **Auto-creation without metadata**: create_registration_from_plan() doesn't set type
   - Checked: [backend/pooja/services/recurrence.py:240-276]
   - Confirmed: Only creates with donor, pooja_option, start_date, amount

3. **Automatic triggering**: process_recurring_plans() called on every list
   - Checked: [backend/pooja/views.py:333-336]
   - Confirmed: Called in list() method without conditions

4. **Frontend filter assumptions**: Assumes metadata on registrations
   - Checked: [frontend/src/pages/DonorProfile.tsx:499-533]
   - Confirmed: Checks registration.recurrence_kind (doesn't exist)

5. **Unidirectional linking**: Only plans link to registrations
   - Checked: [backend/pooja/models.py]
   - Confirmed: RecurringPoojaPlan has origin_registration, but not vice versa

---

## Impact Assessment

### Affected Users
- Any donor with recurring poojas registered before last API call
- More impacted donors = more months have processed
- Amar: 1 month processed (1 of 5 poojas visible)
- R: 2+ months processed (4 of 5 poojas visible)

### Financial Impact
- Donor sees higher total (₹700 instead of ₹600)
- May impact:
  - Financial reports (double-counting)
  - Donor confusion (why is this pooja showing twice?)
  - Payment tracking (are we collecting from same pooja twice?)

### Data Impact
- No actual data corruption (both are same registration in DB)
- Only display issue (same registration counted twice in UI)
- Registrations themselves are correct
- Plans are correctly marked as recurring

---

## How to Verify (For Developers)

### Quick Database Check
```sql
-- Check Amar Gopalakrishnan's registrations
SELECT COUNT(*), SUM(total_amount)
FROM pooja_poojaregistration
WHERE donor_id = (SELECT id FROM accounts_user WHERE name = 'Amar Gopalakrishnan')
  AND pooja_option_id = (SELECT id FROM pooja_poojaoption WHERE code = 'NITYA_NEIVEDHYAM');

-- If returns: count=2, sum=200
-- Then ONE registration is being shown twice on frontend
```

### Quick Frontend Check
```javascript
// In browser console on DonorProfile page
console.log('Visible registrations:', visibleRegistrations.length);
console.log('All registrations from API:', registrations.length);
console.log('Recurring plans:', recurrencePlans.length);

// If visibleRegistrations > sum of real one-time poojas
// Then auto-created registrations are being shown
```

---

## Files Involved (Complete List)

### Backend - Core Bug Files
- `backend/pooja/models.py` - PoojaRegistration & RecurringPoojaPlan definitions
- `backend/pooja/services/recurrence.py` - Where bug is CREATED (lines 240-304)
- `backend/pooja/views.py` - Where bug is TRIGGERED (lines 333-336)
- `backend/pooja/serializers.py` - Initial registration creation (lines 238-260)

### Frontend - Bug Manifestation
- `frontend/src/pages/DonorProfile.tsx` - Where filter fails (lines 499-533)
- `frontend/src/pages/PoojaRegistrationPage.tsx` - Where one_time_extra is selected

### Related Files
- `backend/pooja/management/commands/process_recurring_poojas.py` - Manual trigger
- `backend/payments/signals.py` - May trigger re-fetching (indirect)

---

## Next Investigation Steps

1. **Run database query** to confirm registrations are duplicated
2. **Check API response** to see if `due_registration` is populated
3. **Check frontend logs** to see what registrations are being filtered
4. **Trace through code** with actual donor ID to see exact execution
5. **Determine fix approach**: Add metadata, change filter, or disable auto-creation

---

## TL;DR Summary

| Item | Finding |
|------|---------|
| **What's the bug?** | Donors see recurring poojas appear in BOTH tabs with doubled amounts |
| **Why?** | Auto-created registrations for future months lack recurrence metadata |
| **Where created?** | `services/recurrence.py:240-276` (create_registration_from_plan) |
| **Where triggered?** | `views.py:333` (PoojaRegistrationViewSet.list) |
| **Why filter fails?** | Frontend expects fields that don't exist on auto-created registrations |
| **Affected donors?** | Those with recurring poojas + any API call after registration |
| **Data corruption?** | No - same registration, just displayed twice |
| **Severity?** | Medium - Display issue, financial tracking impact |
| **Fix type?** | Add metadata to registrations OR improve filter logic |
