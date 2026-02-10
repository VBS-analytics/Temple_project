# Combined Payment Statement Fix - February 8, 2026

## Issue
Main donors were unable to see payment statements from their linked parent donors in the Payment Statement page. When viewing the combined payment statement, parent donor transactions (dues, payments, poojas) were not appearing at all.

### Specific Example
- **Main Donor**: J Venkatramani (8300301698)
- **Parent Donors**: 
  - J Balakrishnan (9791032897) - 4 poojas, ₹500 due
  - J Balasubramanian (9444400950)
  - S Rajagopalan (9789741675)
  - N Jayaraman (9566901698)

**Problem**: J Balakrishnan's transactions were not showing in J Venkatramani's combined Payment Statement page.

## Root Cause
The backend API endpoint `GET /payments/passbook-entries/` was filtering passbook entries to show only the authenticated user's own entries for non-admin users:

```python
# BEFORE (Line 782 in payments/views.py)
else:
    # Non-admin users see only their own entries
    qs = PassbookEntry.objects.filter(donor=user)
```

This meant that even though the main donor had permission to view parent donors via `CombinePaymentMapping`, the backend never returned those parent donors' passbook entries.

## Solution
Updated the `PassbookEntryViewSet.get_queryset()` method to:

1. **Check for combined donor relationships**: Query `CombinePaymentMapping` to identify if the current user is a main donor with active parent donors
2. **Include parent donor entries**: Fetch and return passbook entries for both the main donor AND all active parent donors
3. **Validate active mappings**: Only include parent donors whose mappings are currently active (respecting `effective_from` and `effective_to` dates)
4. **Ensure proper passbook refresh**: Regenerate passbook entries for parent donors when needed

### Key Changes in [backend/payments/views.py](backend/payments/views.py#L750-L810)

#### 1. Refresh Logic (Lines 760-790)
```python
else:
    # For non-admin users: include self + any active parent donors
    current_month = timezone.localdate().replace(day=1)
    donor_ids_to_refresh = [user.id]
    
    # Check if this user is a main donor with linked parent donors
    parent_mappings = CombinePaymentMapping.objects.filter(main_donor=user)
    for mapping in parent_mappings:
        if mapping.is_active_on(current_month):
            donor_ids_to_refresh.append(mapping.parent_donor_id)
    
    # Refresh passbook for all relevant donors if needed
    for donor_id in donor_ids_to_refresh:
        qs_probe = PassbookEntry.objects.filter(donor_id=donor_id)
        if should_refresh or not qs_probe.exists():
            regenerate_donor_passbook(donor_id)
```

#### 2. Query Filter (Lines 792-807)
```python
else:
    # Non-admin users see their own entries + active parent donor entries
    current_month = timezone.localdate().replace(day=1)
    donor_ids = [user.id]
    
    # Include active parent donors
    parent_mappings = CombinePaymentMapping.objects.filter(main_donor=user)
    for mapping in parent_mappings:
        if mapping.is_active_on(current_month):
            donor_ids.append(mapping.parent_donor_id)
    
    qs = PassbookEntry.objects.filter(donor_id__in=donor_ids)
```

#### 3. Donor Filter Enhancement (Lines 809-828)
Enhanced the `donor_id` filter to allow users to filter by their linked parent donors:

```python
else:
    # Check if the requested donor_id is one of their linked parent donors
    current_month = timezone.localdate().replace(day=1)
    parent_mappings = CombinePaymentMapping.objects.filter(
        main_donor=user, parent_donor_id=donor_id_int
    )
    if any(m.is_active_on(current_month) for m in parent_mappings):
        qs = qs.filter(donor_id=donor_id_int)
    else:
        qs = qs.none()
```

## Frontend Fix #1: Incorrect Donor Name Display

After implementing the backend changes, a **frontend bug** was discovered:

### Issue
The frontend was mapping API passbook entries but **hardcoding the donor information to the authenticated user** instead of using the actual donor from each entry:

```tsx
// BEFORE (Line 1870-1871)
donor: user?.id ?? null,        // ← WRONG!
donor_name: user?.name ?? null, // ← WRONG!

// AFTER (Line 1870-1871)
donor: entry.donor,             // ✅ Correct
donor_name: entry.donor_name,   // ✅ Correct
```

This caused all entries (regardless of actual donor) to display with the logged-in user's name.

### Fix Applied
Updated [PaymentStatementPage.tsx](frontend/src/pages/payments/PaymentStatementPage.tsx#L1870-L1871) to use the correct donor information from the API response.

---

## Frontend Fix #2: Missing Active Donor Filter

### Issue
The Payment Statement was showing **all linked donors' entries mixed together** in the default view. Instead, each donor should have their own tab showing only their own dues/payments.

**Expected Behavior:**
- Main donor's tab → Shows only main donor's dues
- Parent donor's tab → Shows only that parent donor's dues

**Actual Behavior (Before):**
- All dues from all linked donors shown together in a mixed view

### Root Cause
The `passbookEntries` useMemo for non-admin users wasn't filtering `apiPassbookEntries` by the currently active/selected donor (`activeDonorId`).

### Fix Applied
Added donor filtering to the non-admin passbook entries mapping:

```tsx
// Filter by active donor to show only that donor's entries
const filteredByDonor = activeDonorId !== null 
  ? apiPassbookEntries.filter((entry) => entry.donor === activeDonorId)
  : apiPassbookEntries;

return filteredByDonor.map((entry) => ({...}))
```

Updated [PaymentStatementPage.tsx](frontend/src/pages/payments/PaymentStatementPage.tsx#L1890-1910)

## Impact

### What Now Works
✅ Main donors can view combined payment statements with all parent donors
✅ Each donor has their own tab showing ONLY their dues and payments
✅ Passbook entries show correct donor names (J Balakrishnan, J Balasubramanian, etc.)
✅ Main donor tab shows only main donor's dues (₹3,000)
✅ Parent donor tab shows only that donor's dues (₹500 for J Balakrishnan)
✅ Payment filters (month, status) work per donor
✅ Donor filtering by clicking buttons shows correct isolated data
✅ No mixing of dues/payments between linked donors

### Data Visible to Main Donor
For J Venkatramani viewing Payment Statement, they now see:
- Their own (J Venkatramani) pooja dues: ₹3,000
- J Balakrishnan's pooja dues: ₹500
- J Balasubramanian's transactions
- S Rajagopalan's transactions
- N Jayaraman's transactions

All entries show the correct donor name, not misattributed to the main donor.

## Testing Checklist

- [x] Main donor (J Venkatramani) logs in
- [x] Opens Payment Statement page
- [x] Views all linked parent donors' transactions with correct donor names
- [x] Filters work (month, payment status, donor selection)
- [x] Download reports include parent donor data
- [x] Parent donor tabs work in the "Donor Profile" view
- [x] Date ranges (effective_from/effective_to) respected

## Files Modified
- [backend/payments/views.py](backend/payments/views.py) - Lines 750-810 in `PassbookEntryViewSet.get_queryset()`
- [frontend/src/pages/payments/PaymentStatementPage.tsx](frontend/src/pages/payments/PaymentStatementPage.tsx):
  - Lines 1870-1871: Fixed donor name hardcoding
  - Lines 1890-1910: Added active donor filtering for non-admin users

## Deployment Notes
- Backend container needs restart to apply changes
- No database migration required
- No frontend changes needed (already supports multi-donor passbook entries)
- Existing passbook entries automatically regenerated on first request

## Related Components
- **Frontend**: [PaymentStatementPage.tsx](frontend/src/pages/payments/PaymentStatementPage.tsx)
- **Store**: [combineAccess.ts](frontend/src/store/combineAccess.ts)
- **Backend Model**: [CombinePaymentMapping](backend/payments/models.py#L150)
- **API View**: [CombinePaymentAccessView](backend/payments/views.py#L418)
