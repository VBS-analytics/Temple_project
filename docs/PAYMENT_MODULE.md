# Payment Module Documentation

## Overview
The Payment Module handles all payment-related functionality including payment statements, payment page processing, and combined donor payment management.

## Core Components

### 1. PaymentStatementPage.tsx
**Location:** `frontend/src/pages/payments/PaymentStatementPage.tsx`

**Purpose:** Displays comprehensive payment history and passbook for donors and admins.

**Key Features:**
- **Passbook View:** Shows payment history with opening balance, due amounts, paid amounts, and closing balance
- **Recurring Pooja Due Dates:** Automatically generates monthly due dates (1st of each month) for recurring poojas
- **One-time Registration Dates:** Shows current date for one-time pooja registrations
- **Admin Passbook:** Admins can view payment history for all donors with their phone numbers
- **Filters:** Filter by donor name, month, and payment status (All, Due, Paid)
- **Download Options:** Export payment statements as PDF or Excel

**Major Functions:**
- `transformOccurrencesForDisplay()`: Transforms upcoming pooja dates to 1st of month for recurring poojas
- `getEntryDateLabel()`: Returns pooja due date from upcoming_occurrences for due entries
- `buildPassbookEntriesFromRecords()`: Builds passbook entries from payment records with balance calculations
- `resolveDonorDisplayLabel()`: Formats donor name with phone number
- `computeCartAggregate()`: Aggregates cart items for computing totals and dates

**Data Flow:**
1. Fetches payment records, registrations, cart snapshots, and local cart items
2. Merges all records into a unified list
3. Applies filters (donor, month, status)
4. Builds passbook entries with running balance calculation
5. Displays in table format with download options

### 2. PaymentPage.tsx
**Location:** `frontend/src/pages/payments/PaymentPage.tsx`

**Purpose:** Handles payment processing, cart management, and payment initiation for donors.

**Key Features:**
- **Cart Management:** Display poojas added to cart with amounts and dates
- **Payment Tracking:** Track payment status and payment history
- **UPI Payment Integration:** Generate UPI links for quick payment
- **Bank Account Display:** Show temple's bank details for manual transfer
- **Current Balance:** Display donor's current account balance
- **Payment Recording:** Record payment details (reference, date, amount)

**Major Functions:**
- `sumCartItems()`: Calculate total amount from cart items
- `formatCurrency()`: Format amounts in Indian currency
- `launchUpiLink()`: Generate and launch UPI payment link
- `shareImageFile()`: Share payment QR code
- `recordPayment()`: Submit payment details to backend

**Data Flow:**
1. Fetch cart items for current user
2. Fetch payment history to display last payment info
3. Fetch current balance
4. Allow user to initiate payment via UPI or manual transfer
5. Record payment details and update cart/balance

### 3. CombinePaymentPage.tsx
**Location:** `frontend/src/pages/payments/CombinePaymentPage.tsx`

**Purpose:** Handles combined payment processing for related donor accounts (group/family accounts).

**Key Features:**
- **Combined Donor View:** Show cart items from multiple combined donors
- **Aggregated Payment:** Single payment for combined account balance
- **Member Display:** Show all members in combined account
- **Payment Processing:** Record payment for combined account
- **Access Control:** Verify donor has permission to pay for combined account

**Major Functions:**
- `sumCartItems()`: Calculate total from combined cart
- `buildMembersLabel()`: Format list of members in combined account
- `recordCombinePayment()`: Submit combined payment to backend
- `formatDateTime()`: Format date and time of transactions

**Data Flow:**
1. Verify user has combine access permissions
2. Fetch cart items from combined account
3. Fetch combined account balance
4. Display payment details for all combined members
5. Process payment and clear combined cart

## Key Data Structures

### PaymentRecordEntry
```typescript
interface PaymentRecordEntry {
  id: number | string;
  donor: number | null;
  donor_name?: string | null;
  pooja_option?: string | null;
  registration?: number | null;
  registration_start_date?: string | null;
  registration_total_amount?: string | number | null;
  pooja_due_amount?: string | number | null;
  amount?: string | number | null;
  transaction_reference?: string | null;
  status?: string | null;
  created_at?: string | null;
  payment_month?: string | null;
  registration_status?: string | null;
  registration_donor_name?: string | null;
  registration_is_group_registration?: boolean | null;
  upcoming_occurrences?: { date: string; label?: string | null }[];
}
```

### PassbookEntry
```typescript
type PassbookEntry = {
  record: PaymentRecordEntry;
  dueAmount: number;
  paidAmount: number;
  closingDue: number;
  openingBalance: number;
  displayDate?: string;
  isCurrentBalanceEntry?: boolean;
  entryType?: 'due' | 'paid';
};
```

### CartItem
```typescript
type CartItem = {
  cartId: string;
  poojaName?: string | null;
  poojaCode?: string | null;
  amount?: string | number | null;
  bookingDate?: string | null;
  customDayDate?: string | null;
  dayOptionOccurrences?: { date?: string | null; label?: string | null }[];
  recurrenceKind?: unknown;
  fullName?: string | null;
};
```

## Pooja Date Logic

### Recurring Poojas
- **Rule:** Show 1st of each month for 12 months
- **Example:** January 2026 recurring pooja shows as: 01/01/2026, 01/02/2026, 01/03/2026, etc.
- **Implementation:** `transformOccurrencesForDisplay()` generates 12 future months
- **Use Case:** Monthly ritual poojas

### One-time Registrations
- **Rule:** Show current date
- **Example:** One-time pooja shows as: Today's date
- **Implementation:** Returns today's date in ISO format
- **Use Case:** Special occasion poojas

## Payment Statement Passbook

### Column Descriptions

| Column | Description | Example |
|--------|-------------|---------|
| S.NO | Sequential row number | 1, 2, 3... |
| DATE | Pooja due date (1st of month for recurring) | 01/01/2026 |
| DONOR NAME | Donor name with phone number | User-test - 9876543210 |
| TRANSACTION DETAILS | Payment reference or "--- Pooja DUE ---" | UPI-REF-12345 |
| DUE FOR CURRENT MONTH | Amount due | ₹1,000.00 |
| AMOUNT RECEIVED | Payment received | ₹500.00 |
| CLOSING DUE | Running balance (opening + due - paid) | ₹500.00 |

### Admin Features

**Donor Passbook View:**
- Filter by donor name (searchable)
- Phone number displayed with donor name
- View complete payment history for each donor
- Running balance calculation per donor

**Summary:**
- Total records and total donors
- Overall payment statistics

## Filters and Features

### Filter by Donor Name
- Multi-select dropdown
- Search functionality
- Shows donor name and phone number
- Admin-only feature

### Filter by Month
- Month range selector
- Format: MM/YYYY (e.g., 01/2026)
- Filters records created in selected month
- Calculates opening balance for selected month

### Filter by Payment Status
- **All Payments:** Shows all records
- **Due for Current Month (Not Paid):** Shows pending payments
- **Amount Received (Paid):** Shows completed payments

### Download Options
- **Download PDF:** Landscape A4 format with complete table
- **Download Excel:** XLSX format with all columns

## Opening Balance

**Definition:** Starting balance for a donor from previous financial period

**Usage:**
- Displayed as first entry in passbook
- Shown as 31/12/2025 (last day of previous month)
- Accumulates with due amounts and reduces with payments
- Updated per donor in admin view

**Calculation:**
- Initial: Opening balance from database
- Formula: Closing Due = Previous Balance + Due Amount - Paid Amount

## Payment Status Labels

- **"Payment Not Received":** No transaction reference or status is 'pending'
- **"Payment Received":** Has transaction reference and/or positive payment amount

## Error Handling

- **Network Errors:** Display "Unable to fetch payment records" message
- **Invalid Dates:** Format to ISO string with fallback to original value
- **Missing Data:** Display "—" (em dash) for null/undefined values

## Related Services

- **API Endpoints:**
  - `GET /payments/records/` - Fetch payment records
  - `POST /payments/records/` - Create payment record
  - `GET /pooja/registrations/` - Fetch pooja registrations
  - `GET /pooja/cart-snapshots/report/` - Fetch cart snapshots
  - `GET /auth/donors/` - Fetch donor list with phone numbers

- **Store Management:**
  - `useAuthStore` - Authentication and user info
  - `useCartStore` - Local cart management
  - `usePaymentStore` - Payment history
  - `useCombineAccessStore` - Combined donor access control

## Best Practices

1. **Always use `transformOccurrencesForDisplay()`** when building cart records to ensure consistent date handling
2. **Check `entry.entryType`** before accessing transaction details
3. **Use `isCurrentBalanceEntry`** to identify and format opening balance rows
4. **Validate date formats** before displaying in passbook
5. **Handle null values** gracefully with "—" display
6. **Use phone number** when displaying donor names in admin view

## Troubleshooting

### Dates Not Showing Correctly
- Check if `upcoming_occurrences` is populated
- Verify `isRecurring` flag is correct
- Ensure `transformOccurrencesForDisplay()` is called

### Balance Calculation Off
- Verify opening balance is fetched correctly
- Check record sorting by timestamp
- Ensure all payment amounts are numeric

### Donor Name Not Showing
- Verify `donor_name` or `registration_donor_name` exists
- Check phone number mapping in `donorPhones` state
- Confirm `resolveDonorDisplayLabel()` is called with phone number

