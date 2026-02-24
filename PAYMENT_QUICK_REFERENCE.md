# Combined Payment Module - Quick Reference

## 🎯 Payment Module Architecture

### Two Payment Types

| Type | Access | Audience | Purpose |
|------|--------|----------|---------|
| **PaymentPage** | Always visible | All donors | Individual payment processing |
| **CombinePaymentPage** | Conditional | Main donors only | Consolidated payment for linked donors |

---

## 🔄 Payment Statement Refresh

- Page: `frontend/src/pages/payments/PaymentStatementPage.tsx`
- Button: `Refresh statement`
- Behavior: Triggers a forced refetch of passbook data by calling passbook API with `refresh=true`.
- Use this when latest passbook rows are not visible immediately after recent changes.

---

## 🔑 User Roles & Access

### 1. MAIN DONOR (role='main' ∧ canCombine=true)
- **Can Access:** Both PaymentPage & CombinePaymentPage
- **Sees:** Combined cart from all linked family members
- **Actions:** Makes single consolidated payment
- **Navigation:** "Combine Payment" link visible

### 2. PARENT DONOR (role='subordinate')
- **Can Access:** PaymentPage only (shows linked message)
- **Cannot Access:** CombinePaymentPage (redirects to PaymentPage)
- **Sees:** "Linked to Combined Account" message with main donor info
- **Actions:** No payment options (handled by main donor)
- **Navigation:** "Combine Payment" link NOT visible

### 3. REGULAR DONOR (role='main' ∧ canCombine=false)
- **Can Access:** PaymentPage only
- **Cannot Access:** CombinePaymentPage (not eligible)
- **Sees:** Normal individual payment form
- **Actions:** Makes individual payment
- **Navigation:** "Combine Payment" link NOT visible

---

## 🛠️ Implementation Changes

### CombinePaymentPage.tsx (Line 156)
```typescript
// Added combineRole to store access
const combineRole = useCombineAccessStore((state) => state.role);
```

### CombinePaymentPage.tsx (Lines 772-783)
```typescript
// New access control logic
if (combineRole === 'subordinate') {
  return <Navigate to="/payments/general" replace />;
}
if (combineRole === 'main' && !canCombine) {
  return <Navigate to="/payments/general" replace />;
}
```

### PaymentPage.tsx (Lines 628-672)
```typescript
// Enhanced subordinate message
if (combineRole === 'subordinate') {
  return (
    <div>
      <h1>Linked to Combined Account</h1>
      <p>Your account is linked to {parentName}</p>
      <p>All payments are processed through the main donor account</p>
      <p>Your poojas are visible in their combined payment view</p>
    </div>
  );
}
```

---

## 📊 Access Control Flow

```
┌─────────────────────────────┐
│   User Visits /payments/*   │
└────────────┬────────────────┘
             │
             ↓
    ┌────────────────────┐
    │ Fetch Combine      │
    │ Access Status      │
    └────────┬───────────┘
             │
    ┌────────┴────────────┬──────────────────┐
    │                     │                  │
    ↓                     ↓                  ↓
SUBORDINATE         MAIN+COMBINE      MAIN+NO-COMBINE
    │                     │                  │
    ↓                     ↓                  ↓
PaymentPage→        ✓ Both pages       PaymentPage→
Linked Msg          available         Normal Form
                    (CombinePayment
                    recommended)
```

---

## 🔄 User Journey Maps

### Main Donor Journey
```
Login → Dashboard → "Combine Payment" visible → Click
    ↓
Combine Payment Page loads
    ├─ Your cart (own poojas)
    ├─ Parent donors cart (family members' poojas)
    ├─ Combined total
    ↓
Provide payment details (ref, amount, date)
    ↓
POST /payments/records/ with notes
    ↓
Success → Celebration → Profile
```

### Parent Donor Journey
```
Login → Dashboard → "Combine Payment" NOT visible
    ↓
Click "Payment Page"
    ↓
Page shows: "🔗 Linked to Combined Account"
    ├─ Linked to: {Main Donor Name}
    ├─ Phone: {Main Donor Phone}
    ├─ Effective: {Date Range}
    ├─ Message: Your poojas visible to main donor
    └─ Help: Contact office to unlink
    ↓
NO payment form displayed
    ↓
User understands their role
```

---

## 🔐 Security Checks

| Check | Location | Purpose |
|-------|----------|---------|
| role='subordinate' redirect | CombinePaymentPage line 776-778 | Prevent parent donors from accessing combine page |
| role='main' && !canCombine redirect | CombinePaymentPage line 780-782 | Redirect main without children to PaymentPage |
| canCombine=true check | Navigation (AppLayout.tsx) | Only show link to eligible donors |
| Backend validation | payments/combine-access/ | Validate role and mappings server-side |
| Date range validation | Backend CombinePaymentMapping.is_active_on() | Only active within effective dates |

---

## 📱 Navigation Menu

### For All Users
```
Dashboard
Payment Page          ← Always visible
Payment Statement
↓
(Donor-only menu)
Pooja Registration
Donor Profile
```

### Additional for Main Donors (if canCombine=true)
```
Dashboard
Payment Page          ← Always visible
Combine Payment       ← ADDED: Only if canCombine=true
Payment Statement
↓
(Donor-only menu)
Pooja Registration
Donor Profile
```

### For Parent Donors
```
Dashboard
Payment Page          ← Always visible, shows linked message
Payment Statement
↓
(Donor-only menu)
Pooja Registration
Donor Profile
```

---

## 🚀 API Endpoints

### Get Combine Status
```
GET /payments/combine-access/
Response: {
  "role": "main" | "subordinate" | null,
  "can_combine": boolean,
  "combined_to": {...},    // only for subordinates
  "parent_donors": [{...}] // only for mains
}
```

### Create Payment Record
```
POST /payments/records/
Body: {
  "amount": number,
  "currency": "INR",
  "mode": "upi",
  "status": "success",
  "transaction_reference": string,
  "payment_month": string,
  "notes": string  // attributes to all donors
}
```

### Manage Combine Mappings
```
POST /payments/combine-mappings/
Body: {
  "main_phone": string,
  "parent_phones": [string],
  "effective_month": string,
  "uncombine_month": string
}

DELETE /payments/combine-mappings/
Body: { "main_phone": string }
```

---

## 🧪 Quick Test Cases

### ✅ Test 1: Main Donor with Children
1. Login as Main Donor
2. Verify: "Combine Payment" link visible ✓
3. Click "Combine Payment" ✓
4. See all combined items ✓
5. Make payment ✓

### ✅ Test 2: Parent Donor
1. Login as Parent Donor
2. Verify: "Combine Payment" link NOT visible ✓
3. Click "Payment Page" ✓
4. See linked message (🔗) ✓
5. No payment form ✓

### ✅ Test 3: URL Bypass Prevention
1. Login as Parent Donor
2. Try: Navigate to /payments/combine directly
3. Verify: Redirected to /payments/general ✓

### ✅ Test 4: Date Range Validation
1. Create combine mapping with past uncombine date
2. Login as Parent Donor
3. Verify: Shows normal payment page (link expired) ✓

---

## 🎯 Key Decision Points

| Decision | Implementation |
|----------|-----------------|
| **Subordinate role handling** | Show friendly "linked account" message, NOT error |
| **Payment form for linked** | Hide completely, don't show disabled inputs |
| **Access redirection** | Redirect to PaymentPage, not Dashboard |
| **User awareness** | Large emoji icon (🔗) + clear message |
| **Unlinking process** | Manual admin action, contact temple office |

---

## 📝 Documentation Files

1. **PAYMENT_MODULE_FLOW.md** - Comprehensive flow documentation
   - 400+ lines of detailed documentation
   - User journeys, API specs, implementation checklist

2. **COMBINED_PAYMENT_IMPLEMENTATION.md** - Implementation summary
   - Code changes overview
   - Testing scenarios
   - Features list

3. **This file** - Quick reference guide
   - Role definitions
   - Quick test cases
   - At-a-glance access control

---

## ✅ Implementation Checklist

- ✅ CombinePaymentPage access control added
- ✅ PaymentPage subordinate message enhanced
- ✅ Navigation menu conditional logic correct
- ✅ Backend API returns proper role/status
- ✅ Redirect logic for invalid access
- ✅ Date range validation (backend)
- ✅ Admin can create/manage mappings
- ✅ Documentation complete
- ✅ No breaking changes
- ✅ Security validated

---

## 🆘 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Combine Payment" link not showing | canCombine ≠ true | Admin create mapping for user |
| Parent sees payment form | role not set correctly | Check backend response |
| Can access /payments/combine as subordinate | Access control missing | Verify code at line 776-778 |
| Linked message not showing | role ≠ 'subordinate' | Verify backend mapping status |
| Mapping not active | Outside date range | Admin check effective_from/effective_to |

---

**Version:** 1.0  
**Status:** ✅ COMPLETE  
**Date:** January 28, 2026
