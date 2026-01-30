# Pooja Registration Endpoints Research

## Summary
This document outlines the backend endpoints available for retrieving pooja registrations, with a focus on finding where to get pooja data for the combine payment page.

---

## Key Findings

### 1. **CombinePaymentAccessView** (Main Entry Point)
**Location:** [backend/payments/views.py](backend/payments/views.py#L448-L500)

This endpoint is the PRIMARY source for combine payment page data. It:
- **URL Endpoint:** `GET /api/payments/combine-payment-access/`
- **Purpose:** Returns data about the main donor's combine payment setup, including parent donors and their pooja cart snapshots
- **Returns:**
  ```json
  {
    "role": "main",
    "can_combine": true,
    "main_donor": {
      "id": 123,
      "name": "Main Donor",
      "phone": "9876543210"
    },
    "parent_donors": [
      {
        "id": 456,
        "name": "Parent 1",
        "phone": "9876543211",
        "effective_from": "2026-01-01",
        "effective_to": null,
        "active": true,
        "items": [...],  // ← Pooja cart items for this parent
        "updated_at": "2026-01-15T10:30:00Z"
      }
    ]
  }
  ```

**Key Logic:**
- Gets parent donor mappings for the current user (main donor)
- Fetches `PoojaCartSnapshot` objects for each active parent donor
- Includes cart items (pooja selections) for each parent

### 2. **PoojaRegistrationViewSet** (Main Registry of Registrations)
**Location:** [backend/pooja/views.py](backend/pooja/views.py#L327-L390)

**Base Endpoint:** `GET /api/pooja-registrations/`

**Features:**
- Returns all pooja registrations for the current user (non-admins) or all donors (admins)
- **Filtering Parameters:**
  - `donor_id`: Filter by specific donor ID
  - `donor_phone`: Filter by donor phone number
  - `donor` or `donor_search`: Search by phone number or donor ID
  
**Important:** Currently does NOT have a built-in status filter parameter, though the model supports `status` field with choices:
- `pending` (default)
- `confirmed`
- `completed`

**Related Actions:**
- `@action summary`: Returns registrations for admin's own donors (filtered)

### 3. **PoojaCartSnapshotView & PoojaCartSnapshotLookupView**
**Location:** [backend/pooja/views.py](backend/pooja/views.py#L798-L885)

**PoojaCartSnapshotView:**
- `GET /api/pooja-cart-snapshot/`: Get current user's cart snapshot
- `PUT /api/pooja-cart-snapshot/`: Update cart selections

**CombinePaymentLookupView:**
- `GET /api/pooja-cart-snapshot-lookup/`
- **Parameters:**
  - `donor_id`: Fetch cart for specific donor ID
  - `phone`: Fetch cart for donor by phone number
- **Returns:**
  ```json
  {
    "donor_id": 456,
    "donor_name": "Parent Donor",
    "donor_phone": "9876543211",
    "items": [...]  // Cart items (pooja selections)
  }
  ```

---

## Data Model - PoojaCartSnapshot

**Location:** [backend/pooja/models.py](backend/pooja/models.py)

The `PoojaCartSnapshot` model stores:
- `donor`: ForeignKey to User
- `items`: JSON array of pooja selections (structure depends on frontend)
- `updated_at`: Timestamp of last modification

This is what's used to show parent donor's "pending" selections before combining payment.

---

## Related Endpoints

### Payment Records
**Location:** [backend/payments/views.py](backend/payments/views.py#L40-L107)

`GET /api/payment-records/`
- Returns payment records for current user or active parent donors
- **Filtering:**
  - `donor_id`
  - `donor_phone`
  - `donor` (search)

**Key Logic:** When user is subordinate (has parent donor), they cannot view their own payment records. When user is main donor with parent mappings, they can view:
- Their own payment records
- Payment records of all active parent donors

---

## Pending/Unpaid Registrations

Currently, there is **NO explicit endpoint** that returns "unpaid" or "pending payment" registrations.

However:
1. **PoojaRegistrationViewSet** returns registrations with `status = "pending"` (but this is pooja status, not payment status)
2. **Payment records** are tracked separately in the `PaymentRecord` model
3. To determine if a registration is unpaid, you would need to:
   - Query registrations for the donor(s)
   - Check the `payments` related field on each registration
   - Compare total amount with paid amount

### Public Read-Only Endpoints
- `GET /api/pooja-registrations/recent-poojas/`: Returns 5 most recent confirmed/completed registrations
- `GET /api/pooja-registrations/today-poojas/`: Returns today's poojas (public view)

---

## Recommended Approach for Combine Payment Page

### Step 1: Get Main Donor's Setup
```
GET /api/payments/combine-payment-access/
```
This gives you:
- Main donor info
- Active parent donors
- Parent donors' cart snapshots (pooja selections)

### Step 2: Get Registrations for All Relevant Donors
For the main donor and each parent donor:
```
GET /api/pooja-registrations/?donor_id=<donor_id>
```

Optionally filter by status if needed (would require adding status parameter to ViewSet).

### Step 3: Correlate Data
- Match registrations with payment records to determine which are unpaid
- Use the cart snapshots to show pending selections
- Group by donor for display

---

## What's Missing

1. **No Endpoint for Unpaid Registrations:** Consider creating:
   ```
   GET /api/pooja-registrations/unpaid/
   ```
   This would filter registrations where `total_amount > sum of payments`

2. **Status Filter Not in QueryString:** Could add:
   ```
   GET /api/pooja-registrations/?status=pending
   ```
   to filter by registration status

3. **Combine Payment Page Specific Endpoint:** Could optimize with a dedicated endpoint that returns:
   - Main donor registrations
   - Parent donor registrations
   - Cart snapshots
   - Payment status summary
   All in one request

---

## Files to Reference

- [backend/payments/views.py](backend/payments/views.py#L448) - `CombinePaymentAccessView`
- [backend/pooja/views.py](backend/pooja/views.py#L327) - `PoojaRegistrationViewSet`
- [backend/pooja/views.py](backend/pooja/views.py#L798) - `PoojaCartSnapshotView` & `CombinePaymentLookupView`
- [backend/pooja/models.py](backend/pooja/models.py) - PoojaRegistration and PoojaCartSnapshot models
- [backend/payments/models.py](backend/payments/models.py) - CombinePaymentMapping, PaymentRecord models
