# Combined Payment Module - Visual Diagrams & Flowcharts

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEMPLE PAYMENT SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ADMIN DASHBOARD                            │  │
│  │  Combine Payment Donor Page                             │  │
│  │  ├─ Create Combine Mapping                             │  │
│  │  │  ├─ Main Donor Phone                               │  │
│  │  │  ├─ Parent Donor Phone(s)                          │  │
│  │  │  ├─ Effective Month                                │  │
│  │  │  └─ Uncombine Month                                │  │
│  │  ├─ Edit Existing Mapping                             │  │
│  │  └─ Delete Mapping (Uncombine)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ▲                                       │
│                          │                                       │
│                     Backend API                                 │
│         /payments/combine-mappings/                             │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           FRONTEND - USER INTERFACE                     │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ Navigation Menu (Conditional)                 │   │  │
│  │  ├─ Payment Page (always)                        │   │  │
│  │  ├─ Combine Payment (if canCombine=true)         │   │  │
│  │  └─ Payment Statement                            │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │           ▼                    ▼                        │  │
│  │     ┌──────────────────┐  ┌──────────────────┐        │  │
│  │     │ COMBINE PAYMENT  │  │ PAYMENT PAGE     │        │  │
│  │     │ PAGE             │  │ (Individual/Link)│        │  │
│  │     │                  │  │                  │        │  │
│  │     ├─ Your Items      │  ├─ Own Items      │        │  │
│  │     ├─ Parent Items    │  ├─ Or             │        │  │
│  │     ├─ Combined Total  │  ├─ Linked Msg     │        │  │
│  │     ├─ QR + Bank Info  │  ├─ No Options     │        │  │
│  │     ├─ Payment Form    │  └─ Contact Info   │        │  │
│  │     └─ Success Msg     │                    │        │  │
│  │     (Main Donor only)  │  (All Donors)      │        │  │
│  │     └──────────────────┘  └──────────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ▲                                       │
│                          │                                       │
│                   Frontend Store                                 │
│            useCombineAccessStore                                │
│    (role, canCombine, parentDonors)                             │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         BACKEND SERVICES                                │  │
│  │                                                          │  │
│  │  GET  /payments/combine-access/                        │  │
│  │  │  ├─ Check user role (main/subordinate)              │  │
│  │  │  ├─ Validate active mappings                        │  │
│  │  │  ├─ Return combine status & parent list             │  │
│  │  │  └─ Include date ranges                             │  │
│  │  │                                                      │  │
│  │  POST /payments/combine-mappings/                      │  │
│  │  │  ├─ Create new mapping                              │  │
│  │  │  ├─ Set effective dates                             │  │
│  │  │  └─ Persist in database                             │  │
│  │  │                                                      │  │
│  │  POST /payments/records/                               │  │
│  │  │  ├─ Record payment transaction                      │  │
│  │  │  ├─ Include attribution notes                       │  │
│  │  │  └─ Update donor balance                            │  │
│  │  │                                                      │  │
│  │  └─ And more endpoints...                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. User Role & Access Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   USER ROLE ACCESS MATRIX                                   │
├──────────────────────┬──────────┬──────────┬────────────────────────────────┤
│ Role                 │ route    │ Display  │ Actions                        │
├──────────────────────┼──────────┼──────────┼────────────────────────────────┤
│ Main Donor           │          │          │                               │
│ (role='main'         │          │          │                               │
│  ∧ canCombine=true)  │          │          │                               │
│                      │──────────┼──────────┼────────────────────────────────┤
│                      │ /payment/│ ✅ SHOW  │ • Make individual payment      │
│                      │ general  │          │ • View own poojas              │
│                      │──────────┼──────────┼────────────────────────────────┤
│                      │ /payment/│ ✅ SHOW  │ • See all family items         │
│                      │ combine  │          │ • Consolidated payment         │
│                      │          │          │ • Single transaction           │
│                      │          │          │ • Celebration animation        │
├──────────────────────┼──────────┼──────────┼────────────────────────────────┤
│ Parent Donor         │          │          │                               │
│ (role='subordinate') │          │          │                               │
│                      │──────────┼──────────┼────────────────────────────────┤
│                      │ /payment/│ ⚠️  SHOW │ • See linked account message   │
│                      │ general  │ LINKED   │ • Know main donor name         │
│                      │          │ MESSAGE  │ • See effective date range     │
│                      │          │          │ • Contact info for unlinking   │
│                      │          │          │ • NO payment options           │
│                      │──────────┼──────────┼────────────────────────────────┤
│                      │ /payment/│ ❌ BLOCK │ 🚫 Redirect to /payments/general│
│                      │ combine  │ REDIRECT │ (Cannot access)                │
├──────────────────────┼──────────┼──────────┼────────────────────────────────┤
│ Regular Donor        │          │          │                               │
│ (role='main'         │          │          │                               │
│  ∧ canCombine=false) │          │          │                               │
│                      │──────────┼──────────┼────────────────────────────────┤
│                      │ /payment/│ ✅ SHOW  │ • Normal payment form          │
│                      │ general  │ FORM     │ • Individual payment           │
│                      │          │          │ • View payment history         │
│                      │──────────┼──────────┼────────────────────────────────┤
│                      │ /payment/│ ❌ LINK  │ Link not visible in menu       │
│                      │ combine  │ HIDDEN   │ (Not eligible)                 │
└──────────────────────┴──────────┴──────────┴────────────────────────────────┘
```

---

## 3. State Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│          useCombineAccessStore STATE FLOW                        │
└──────────────────────────────────────────────────────────────────┘

Initial State:
  {
    loading: false,
    canCombine: null,
    role: null,
    parentDonors: [],
    combinedTo: null,
    error: null
  }

  │
  ├─ Call fetchAccess()
  │
  └─► GET /payments/combine-access/
      │
      ├─ SUCCESS Response:
      │
      ├─► MAIN DONOR WITH CHILDREN
      │   {
      │     loading: false,
      │     canCombine: true        ◄─── CombinePaymentPage ALLOWED
      │     role: 'main',
      │     parentDonors: [{...}, {...}],
      │     combinedTo: null,
      │     error: null
      │   }
      │
      ├─► PARENT DONOR (LINKED)
      │   {
      │     loading: false,
      │     canCombine: false,      ◄─── CombinePaymentPage BLOCKED
      │     role: 'subordinate',    ◄─── PaymentPage shows linked msg
      │     parentDonors: [],
      │     combinedTo: {id, name, phone, dates},
      │     error: null
      │   }
      │
      ├─► REGULAR DONOR (NO MAPPING)
      │   {
      │     loading: false,
      │     canCombine: false,      ◄─── CombinePaymentPage NOT ELIGIBLE
      │     role: 'main',           ◄─── PaymentPage shows normal form
      │     parentDonors: [],
      │     combinedTo: null,
      │     error: null
      │   }
      │
      └─ FAILURE Response:
         {
           loading: false,
           canCombine: null,
           role: null,
           parentDonors: [],
           combinedTo: null,
           error: 'Error message'   ◄─── Show retry button
         }
```

---

## 4. Payment Flow Sequence

```
Main Donor Payment Flow:
═══════════════════════════════════════════════════════════════════

1. Login
   └─► Check canCombine status
       ├─ TRUE  → Show "Combine Payment" in menu
       └─ FALSE → Hide "Combine Payment" in menu

2a. Click "Payment Page"
    └─► Load PaymentPage
        ├─ Show own poojas only
        ├─ Can make individual payment
        └─ Can navigate to CombinePaymentPage

2b. Click "Combine Payment"
    └─► Load CombinePaymentPage
        ├─ Verify: role='main' ∧ canCombine=true
        ├─ Show all family members' poojas
        ├─ Calculate combined total
        ├─ Fetch combined balance
        ├─ Show payment options (UPI/Bank)
        └─ Ready for consolidated payment

3. Enter Payment Details
   ├─ Transaction Reference
   ├─ Amount Paid
   └─ Payment Date

4. Submit Payment
   └─► POST /payments/records/
       ├─ Amount: sum(all items)
       ├─ Notes: "Combined donors (Member1: ₹X • Member2: ₹Y)"
       ├─ Status: 'success'
       └─ Update combined balance

5. Success
   ├─ Clear combined cart
   ├─ Show celebration animation
   ├─ Update opening balance
   └─ Redirect to profile

═══════════════════════════════════════════════════════════════════

Parent Donor Payment Flow:
═══════════════════════════════════════════════════════════════════

1. Login
   └─► Check canCombine status
       ├─ canCombine=false, role='subordinate'
       └─► Hide "Combine Payment" in menu

2. Click "Payment Page"
   └─► Load PaymentPage
       ├─ Check: role='subordinate'?
       ├─ YES ─► Show linked account message
       │         ├─ 🔗 Linked to [Main Donor]
       │         ├─ All payments through main donor
       │         ├─ Your poojas visible to them
       │         ├─ Effective date range
       │         └─ Contact info to unlink
       └─ NO ──► Show normal payment form

3. Try Direct URL: /payments/combine
   └─► Check access control
       ├─ role='subordinate'?
       ├─ YES ─► Redirect to /payments/general
       └─ canCombine=false?
           ├─ YES ─► Redirect to /payments/general

4. Result
   ├─ No payment form shown
   ├─ No payment options available
   ├─ Cannot make payments
   └─ Understands poojas managed by main donor

═══════════════════════════════════════════════════════════════════
```

---

## 5. Access Control Decision Tree

```
┌─ User Accesses /payments/* ─┐
│                              │
├──────────────────────────────┤
│                              │
│  Fetch combine access status │
│  GET /payments/combine-access│
│                              │
└──────────────────────────────┘
        │
        ├─ Response received
        │
        ├──────────────────────────────┬───────────────────────────────┐
        │                              │                               │
        ↓                              ↓                               ↓
    role='main'              role='subordinate'              role='main'
    canCombine=true          canCombine=false               canCombine=false
        │                           │                              │
        │                           │                              │
    ┌───┴──────────────────┐    ┌────┴────────────────────┐    ┌────┴─────────────┐
    │                      │    │                         │    │                  │
    ↓                      ↓    ↓                         ↓    ↓                  ↓
/payments/general   /payments/combine   /payments/general   /payments/combine   /payments/general
(PaymentPage)       (CombinePaymentPage) (Linked Message)   (Access Denied)      (PaymentPage)
    │                      │                 │               (Redirect)              │
    │                      │                 │                   │                  │
  ✅ SHOW              ✅ SHOW             ⚠️ SHOW              ❌ BLOCK            ✅ SHOW
  Individual          Combined             Linked Message    Redirect to         Individual
  payment form        cart + payment       No form            /payments/general   payment form
    │                      │                 │                   │                  │
    │                      │                 │                   │                  │
  ✅ Allowed            ✅ Allowed         ❌ No action       ❌ No action         ✅ Allowed
  Make payment          Make payment       Blocked            Redirected          Make payment
    │                      │                                                        │
    └──────────────┬───────┘                                                        │
                   │                                                                │
             ✅ Payment Success                                                     │
             - Record transaction                                                   │
             - Update balance                                                       │
             - Clear cart                                                           │
             - Show celebration                                                     │
             - Redirect to profile                                        ✅ Payment Success
                                                                          (Normal flow)
```

---

## 6. Component Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  COMPONENT RELATIONSHIPS                        │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────┐
│   AppLayout.tsx    │ (Main App Shell)
└────────┬───────────┘
         │
         ├─ Navigation Menu (conditional)
         │  ├─ Payment Page link (always)
         │  ├─ Combine Payment link (if canCombine=true)
         │  └─ Payment Statement link (always)
         │
         └─ Router
            │
            ├─ Route: /payments/general
            │  └─ PaymentPage.tsx
            │     │
            │     ├─ Check: combineRole='subordinate'?
            │     │  ├─ YES → Show linked message
            │     │  └─ NO  → Show normal/combine redirect
            │     │
            │     └─ Stores:
            │        ├─ useAuthStore (user info)
            │        ├─ useCombineAccessStore (role/status)
            │        ├─ useCartStore (cart items)
            │        ├─ usePaymentStore (history)
            │        └─ useCurrentBalance (balance)
            │
            ├─ Route: /payments/combine
            │  └─ CombinePaymentPage.tsx
            │     │
            │     ├─ Check: combineRole='subordinate'?
            │     │  ├─ YES → Redirect to /payments/general
            │     │  └─ NO  → Continue...
            │     │
            │     ├─ Check: role='main' ∧ canCombine=true?
            │     │  ├─ YES → Show combined cart
            │     │  └─ NO  → Redirect to /payments/general
            │     │
            │     └─ Stores:
            │        ├─ useAuthStore (user info)
            │        ├─ useCombineAccessStore (parentDonors/balance)
            │        ├─ useCartStore (cart items)
            │        ├─ usePaymentStore (history)
            │        └─ useCurrentBalance (combined balance)
            │
            └─ Route: /admin/combine-donor-payment
               └─ CombinePaymentDonorPage.tsx
                  │
                  ├─ Admin only
                  ├─ Create combine mapping
                  ├─ Edit mapping
                  ├─ Delete mapping
                  │
                  └─ API:
                     ├─ GET /auth/donors/ (load donor list)
                     ├─ GET /payments/combine-mappings/ (load existing)
                     ├─ POST /payments/combine-mappings/ (create/update)
                     └─ DELETE /payments/combine-mappings/ (remove)
```

---

## 7. Data Flow for Payment Recording

```
User Submits Payment
│
├─ Frontend Validation
│  ├─ Transaction Reference: required, non-empty
│  ├─ Amount Paid: required, positive number
│  └─ Payment Date: required, valid date
│
├─ Build Payment Payload
│  ├─ For Combined Payment:
│  │  {
│  │    "amount": sum(all_items),
│  │    "currency": "INR",
│  │    "mode": "upi",
│  │    "status": "success",
│  │    "transaction_reference": "REF123456",
│  │    "payment_month": "2025-01",
│  │    "notes": "Combined donors (Member1: ₹2000 • Member2: ₹3000)"
│  │  }
│  │
│  └─ For Individual Payment:
│     {
│       "amount": item_amount,
│       "currency": "INR",
│       "mode": "upi",
│       "status": "success",
│       "transaction_reference": "REF123456",
│       "payment_month": "2025-01",
│       "notes": "Member Name • Item Details"
│     }
│
├─ POST /payments/records/
│  │
│  └─ Backend Processing:
│     ├─ Authenticate user
│     ├─ Validate payment data
│     ├─ Record payment transaction
│     ├─ Create payment entry
│     ├─ Update opening balance
│     └─ Generate passbook entries
│
├─ Success Response
│  │
│  ├─ Frontend Updates:
│  │  ├─ Clear combined cart (clearCart)
│  │  ├─ Add to payment history (addCombinePaymentHistory)
│  │  ├─ Refresh opening balance (refreshBalance)
│  │  ├─ Show celebration animation
│  │  └─ Redirect to profile
│  │
│  └─ User Notification:
│     ├─ Success message
│     ├─ Flower petal animation
│     └─ Auto-redirect to profile
│
└─ Error Handling:
   ├─ Validation errors: show field-specific message
   ├─ Backend errors: show user-friendly message
   ├─ Network errors: show retry option
   └─ Keep form data for resubmission
```

---

## 8. Security & Access Control Layers

```
┌──────────────────────────────────────────────────────────────────┐
│           SECURITY & ACCESS CONTROL LAYERS                       │
└──────────────────────────────────────────────────────────────────┘

Layer 1: Authentication
┌─────────────────────────────────────────────────────────────┐
│ User must be logged in                                      │
│ ├─ useAuthStore checks user exists                         │
│ ├─ Invalid users redirected to login                       │
│ └─ Token validation on API calls                           │
└─────────────────────────────────────────────────────────────┘
         ↓
Layer 2: Frontend Role Check
┌─────────────────────────────────────────────────────────────┐
│ Check useCombineAccessStore role                           │
│ ├─ role='subordinate' → CombinePaymentPage blocked         │
│ ├─ role='main' ∧ !canCombine → Normal PaymentPage         │
│ └─ role='main' ∧ canCombine=true → Both pages allowed      │
└─────────────────────────────────────────────────────────────┘
         ↓
Layer 3: URL Access Prevention
┌─────────────────────────────────────────────────────────────┐
│ Direct /payments/combine access blocked                    │
│ ├─ Check before component renders                         │
│ ├─ Check access rules                                      │
│ └─ Redirect to /payments/general if invalid               │
└─────────────────────────────────────────────────────────────┘
         ↓
Layer 4: Backend Validation
┌─────────────────────────────────────────────────────────────┐
│ Server-side role & mapping validation                      │
│ ├─ GET /payments/combine-access/                          │
│ │  └─ Returns role: main/subordinate/null                 │
│ │                                                          │
│ ├─ Validate mapping exists                                │
│ ├─ Validate mapping is active (date range)                │
│ ├─ Validate user has payment permission                   │
│ └─ Return appropriate data                                │
│                                                            │
└─────────────────────────────────────────────────────────────┘
         ↓
Layer 5: Payment Authorization
┌─────────────────────────────────────────────────────────────┐
│ POST /payments/records/                                    │
│ ├─ Authenticate request                                    │
│ ├─ Validate payment data                                   │
│ ├─ Check user permission to record payment                │
│ ├─ Validate amount and transaction ref                    │
│ └─ Only then record in database                           │
└─────────────────────────────────────────────────────────────┘
         ↓
    ✅ SECURE
```

---

**Document Version:** 1.0  
**Date:** January 28, 2026  
**Status:** ✅ COMPLETE

