# Combined Payment Module Flow - Implementation Guide

## Overview
The payment module has been updated to support **Combined Payment** functionality, allowing a Main Donor to consolidate payments for multiple linked Family/Group donors.

## Operational Notes

- Rebuilding/restarting containers does not alter historical payment ownership. It only reruns code and passbook regeneration.
- `regenerate_passbooks` recalculates statements from existing `PaymentRecord` rows; it does not reassign wrongly attributed historical records.
- Use `Payment Statement -> Refresh statement` to force a fresh passbook pull in UI after backend updates.

---

## Payment Module Architecture

### Two Main Payment Types

#### 1. **PaymentPage** (Single Donor Payment)
- **File:** `frontend/src/pages/payments/PaymentPage.tsx`
- **Audience:** All individual donors (default)
- **Purpose:** Handle individual payment processing for single donor accounts
- **Payment Methods:** UPI links, manual bank transfer, QR code
- **Features:**
  - Display individual pooja cart items
  - Show opening balance and amount due
  - Record individual payment transactions
  - Payment history tracking

**When Displayed:**
- Always available for all users by default
- For linked donors (subordinate role), shows special "Linked Account" message
- For Main Donors without active child donors, displays normal payment interface

---

#### 2. **CombinePaymentPage** (Multi-Donor Consolidated Payment)
- **File:** `frontend/src/pages/payments/CombinePaymentPage.tsx`
- **Audience:** Main Donors only (who have linked Family/Group members)
- **Purpose:** Handle consolidated payment for multiple linked donors
- **Features:**
  - Show aggregated cart items from all linked donors
  - Display total combined amount due
  - Process single consolidated payment
  - Record payment allocation across all members
  - Show celebration animation on successful payment

**When Displayed:**
- Only accessible when:
  - User role = 'main' (Main Donor)
  - canCombine = true (has active linked donors)
  - Has active combine mappings for current month

---

## Admin Setup: Combine Payment Donor Page

### Location
`frontend/src/pages/admin/CombinePaymentDonorPage.tsx`

### Admin Responsibilities
1. **Create Combine Mapping:**
   - Select a **Main Donor** (primary account owner)
   - Add one or more **Parent Donors** (linked family/group members)
   - Set **effective_month** (when combining starts)
   - Set **uncombine_month** (optional - when combining ends)

2. **Data Stored:**
   - Main donor phone number and profile
   - List of linked parent donor phone numbers
   - Effective date range for the combination
   - All mappings persist in backend database

3. **Mapping Features:**
   - View all active and historical mappings
   - Edit existing mappings
   - Delete mappings (decombine donors)
   - Time-based activation (effective_from/effective_to)

---

## User Journey & Access Control

### For Main Donor (role = 'main', canCombine = true)

```
User Login
    ↓
App checks combine access status
    ↓
Backend returns: role='main', canCombine=true, parentDonors=[...]
    ↓
Navigation menu shows "Combine Payment" link
    ↓
User clicks "Payment Page" or "Combine Payment"
    ↓
Both routes are available:
  - CombinePaymentPage → Shows combined view with all parent donor items
  - PaymentPage → Shows only main donor's own items
```

**CombinePaymentPage Access:**
- ✅ Can access if: `role='main' && canCombine=true`
- ❌ Redirects to PaymentPage if: `role='main' && canCombine=false`
- ❌ Redirects to PaymentPage if: `role='subordinate'`
- ❌ Redirects to Dashboard if: `canCombine=false`

**Display Details:**
1. Your Cart Summary: Show main donor's own pooja items
2. Parent Donor Items: Show aggregated items from all linked donors
3. Combined Total: Sum of all items (main + all parents)
4. Amount Due: Max(0, Combined Total - Current Balance)
5. Payment Methods: UPI QR and bank account details
6. Payment Recording: Transaction reference, amount, date
7. Success: Celebration animation + redirect to profile

---

### For Parent Donor (role = 'subordinate', canCombine = false)

```
User Login
    ↓
App checks combine access status
    ↓
Backend returns: role='subordinate', canCombine=false, combinedTo={mainDonor}
    ↓
Navigation menu does NOT show "Combine Payment" link
    ↓
Only "Payment Page" is available
    ↓
Click "Payment Page"
    ↓
"Linked Account" message displayed (instead of payment form)
```

**PaymentPage Access:**
- ✅ Can access always
- Shows special "Linked Account" information:
  - Icon: 🔗
  - Message explaining account is linked to Main Donor
  - Main donor name and phone
  - Explanation that poojas will be in combined payment view
  - Effective date range
  - Instructions to contact temple office for unlinking

**Key Features:**
- No payment form displayed
- No payment details input fields
- No bank account details shown
- Clear message that payment is handled by main donor
- Contact information for requesting to unlink

---

### For Regular Donor (No Combine Mapping)

```
User Login
    ↓
App checks combine access status
    ↓
Backend returns: role='main', canCombine=false, parentDonors=[]
    ↓
Navigation menu does NOT show "Combine Payment" link
    ↓
Only "Payment Page" is available with normal payment flow
```

---

## Backend API Endpoints

### 1. **Combine Access Status** (GET)
```
Endpoint: /payments/combine-access/
Method: GET
Auth: Required

Response (Main Donor with active children):
{
  "role": "main",
  "can_combine": true,
  "main_donor": {
    "id": 1,
    "name": "John Doe",
    "phone": "+91XXXXX"
  },
  "parent_donors": [
    {
      "id": 2,
      "name": "Jane Doe",
      "phone": "+91XXXXX",
      "items": [...cart items...],
      "effective_from": "2025-01-15",
      "effective_to": null,
      "active": true
    }
  ]
}

Response (Parent Donor):
{
  "role": "subordinate",
  "can_combine": false,
  "combined_to": {
    "id": 1,
    "name": "John Doe",
    "phone": "+91XXXXX",
    "effective_from": "2025-01-15",
    "effective_to": null
  },
  "parent_donors": []
}

Response (Regular Donor):
{
  "role": "main",
  "can_combine": false,
  "main_donor": {...},
  "parent_donors": []
}
```

### 2. **Combine Mappings Management** (POST/DELETE)
```
Endpoint: /payments/combine-mappings/
Method: POST (Create), DELETE (Remove)

POST Request:
{
  "main_phone": "+91XXXXX",
  "parent_phones": ["+91YYYYY", "+91ZZZZZ"],
  "effective_month": "2025-01",
  "uncombine_month": "2025-03"
}

DELETE Request:
{
  "main_phone": "+91XXXXX"
}
```

### 3. **Payment Recording** (POST)
```
Endpoint: /payments/records/
Method: POST

For Combined Payment:
{
  "amount": 5000,
  "currency": "INR",
  "mode": "upi",
  "status": "success",
  "transaction_reference": "REF123456",
  "payment_month": "2025-01",
  "notes": "Combined donors (Jane Doe: ₹2000 • John Doe: ₹3000)"
}
```

---

## Frontend Store Management

### useCombineAccessStore
**Location:** `frontend/src/store/combineAccess.ts`

**State Properties:**
- `loading`: boolean - Loading status
- `canCombine`: boolean | null - Whether user has active child donors
- `role`: 'main' | 'subordinate' | null - User's role in combine relationship
- `parentDonors`: CombineAccessParent[] - Array of linked donors with their items
- `combinedTo`: CombinedToInfo | null - If subordinate, who they're linked to
- `error`: string | null - Any error messages

**Methods:**
- `fetchAccess()`: Fetch combine status from backend
- `resetAccess()`: Clear combine status (on logout)

**Usage:**
```typescript
const { 
  canCombine, 
  role, 
  parentDonors, 
  combinedTo, 
  fetchAccess 
} = useCombineAccessStore((state) => ({...}));
```

---

## Frontend Navigation

### Navigation Menu Items
**File:** `frontend/src/components/AppLayout.tsx`

```typescript
donorNavItems = [
  { to: '/dashboard', label: 'Dashboard', show: true },
  { to: '/profile', label: 'Donor Profile', show: Boolean(user && !isAdmin(user.role)) },
  { to: '/pooja/register', label: 'Pooja Registration', show: !isAdminUser },
  { to: '/payments/general', label: 'Payment Page', show: !isAdminUser },
  {
    to: '/payments/combine',
    label: 'Combine Payment',
    show: !isAdminUser && canCombine === true  // Only for Main Donors with active children
  },
  { to: '/payments/statement', label: 'Payment Statement', show: Boolean(user) }
];
```

**Conditional Display:**
- "Payment Page" → Always visible
- "Combine Payment" → Only visible when `canCombine === true`

---

## Complete User Flow Diagram

```
┌─────────────────┐
│    User Login   │
└────────┬────────┘
         │
         ↓
┌──────────────────────────────┐
│ Fetch Combine Access Status  │
│ GET /payments/combine-access/│
└────────┬─────────────────────┘
         │
    ┌────┴──────────┬──────────────────┐
    │               │                  │
    ↓               ↓                  ↓
┌─────────┐  ┌──────────────┐  ┌──────────────┐
│  MAIN   │  │ SUBORDINATE  │  │   REGULAR    │
│ COMBINE │  │   (LINKED)   │  │   DONOR      │
└────┬────┘  └──────┬───────┘  └──────┬───────┘
     │              │                 │
     ↓              ↓                 ↓
┌─────────────────┐ ┌───────────────┐ ┌──────────────┐
│ Show Nav Items: │ │ Show Nav:     │ │ Show Nav:    │
│ - Payment Page  │ │ - Payment Pg  │ │ - Payment Pg │
│ - Combine Pmnt  │ │ (only option) │ │ (only opt)   │
└────────┬────────┘ └───────┬───────┘ └──────┬───────┘
         │                  │                │
    ┌────┴──────┐      ┌────┴────┐      ┌────┴────┐
    │            │      │         │      │         │
    ↓            ↓      ↓         ↓      ↓         ↓
┌────────┐  ┌────────┐ ┌───────┐ ┌───────┐ ┌──────┐
│Combine │  │Payment │ │Linked │ │Payment│ │Paymt │
│Payment │  │ Page   │ │  Acc  │ │ Page  │ │ Page │
│ Page   │  │(own    │ │  Msg  │ │ (own  │ │(own  │
│ (All   │  │items)  │ │ 🔗    │ │items) │ │items)│
│ items) │  │        │ │       │ │       │ │      │
└────┬───┘  └────────┘ └───────┘ └───────┘ └──────┘
     │
     ↓
┌─────────────────────┐
│ User Makes Payment  │
│ - Provides Ref ID   │
│ - Amount, Date      │
└────────┬────────────┘
         │
         ↓
┌──────────────────────────────┐
│ POST /payments/records/      │
│ (Consolidated payment record)│
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────┐
│ Success Message  │
│ + Celebration    │
│ Redirect Profile │
└──────────────────┘
```

---

## Implementation Checklist

- ✅ **CombinePaymentDonorPage**: Admin can create/manage combine mappings
- ✅ **Backend API**: `CombinePaymentAccessView` determines user role
- ✅ **Frontend Store**: `useCombineAccessStore` manages combine status
- ✅ **CombinePaymentPage**: 
  - ✅ Added `combineRole` to store access
  - ✅ Redirect `role='subordinate'` to PaymentPage
  - ✅ Redirect `role='main' && !canCombine` to PaymentPage
  - ✅ Allow only `role='main' && canCombine=true` to display page
- ✅ **PaymentPage**: 
  - ✅ Enhanced subordinate role message with emoji and clear explanation
  - ✅ Show linked account information
  - ✅ Hide payment details for linked donors
  - ✅ Show main donor name and contact info
- ✅ **Navigation**: Conditionally show "Combine Payment" link only for Main Donors
- ✅ **Payment Flow**: Combined payment recording with aggregated totals

---

## Key Features

### For Main Donor
1. ✅ See combined cart from all linked donors
2. ✅ View aggregated payment totals
3. ✅ Make single consolidated payment
4. ✅ Payment details recorded with attribution notes
5. ✅ Opening balance updated after payment

### For Parent Donor (Linked)
1. ✅ Clear explanation of linked status
2. ✅ Know who their payments are managed by
3. ✅ See effective date range of link
4. ✅ Know how to request unlinking
5. ✅ Pooja items automatically visible in main donor's view

### For Admin
1. ✅ Create combine mappings via dedicated page
2. ✅ Set effective date ranges
3. ✅ View all active mappings
4. ✅ Edit existing mappings
5. ✅ Delete/uncombine mappings

---

## Security & Validation

1. **Access Control**: Only Main Donors can access CombinePaymentPage
2. **Role Verification**: Backend validates user role before returning combine data
3. **Date Range Validation**: Combine mappings are only active within effective_from/effective_to
4. **Payment Attribution**: Notes include all donor names for transparency
5. **Balance Tracking**: Each donor's opening balance properly managed

---

## Testing Scenarios

### Scenario 1: Main Donor with Children
- Login as Main Donor
- Navigate to Payment Page → see normal flow
- Navigate to Combine Payment → see all combined items
- Make payment → success, redirected to profile

### Scenario 2: Parent Donor (Linked)
- Login as Parent Donor
- Navigate to Payment Page → see linked account message
- Try to access Combine Payment directly → redirected to Payment Page
- See main donor info and cannot make payment

### Scenario 3: Regular Donor (No Mapping)
- Login as Regular Donor
- Navigate to Payment Page → see normal flow
- Combine Payment link not visible in menu
- Make individual payment normally

---

## Future Enhancements

1. Bulk uncombine from admin panel
2. Combine payment history view for all linked members
3. Notifications when main donor makes consolidated payment
4. Balance distribution logic among combined members
5. Combine payment approval workflow for admins
6. Export combined payment reports

---

## Support & Troubleshooting

### Issue: Combine Payment link not showing
- **Cause**: User's role is not 'main' or `canCombine` is false
- **Solution**: Admin should create a combine mapping for the user

### Issue: Parent Donor sees payment form
- **Cause**: Role not properly set in backend response
- **Solution**: Verify combine mapping exists and is within effective date range

### Issue: CombinePaymentPage shows nothing
- **Cause**: No parent donors with active mappings
- **Solution**: Admin should add parent donors to the combine mapping

---

## Code References

- **Store**: [useCombineAccessStore](frontend/src/store/combineAccess.ts)
- **Main Page**: [CombinePaymentPage](frontend/src/pages/payments/CombinePaymentPage.tsx)
- **Payment Page**: [PaymentPage](frontend/src/pages/payments/PaymentPage.tsx)
- **Admin Page**: [CombinePaymentDonorPage](frontend/src/pages/admin/CombinePaymentDonorPage.tsx)
- **Backend View**: [payments/views.py - CombinePaymentAccessView](backend/payments/views.py)

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Status:** ✅ Implementation Complete
