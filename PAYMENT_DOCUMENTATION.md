# Temple Management System - Payment Module Documentation

## Overview
This document provides comprehensive documentation for the Payment module. It covers all tables related to financial management, payment tracking, expense records, and donor financial statements.

**Module Name:** Payment & Financial Management System  
**Generated:** January 22, 2026  
**Related Tables:** 4 core tables

---

## Module Overview

The Payment module manages:
- **Payment Records** - All donations and transactions
- **Passbook Entries** - Donor financial statements
- **Combined Payments** - Group donor billing
- **Expense Tracking** - Temple operational costs

---

# PAYMENT MODULE TABLES

## Table 1: payments_paymentrecord (PaymentRecord)

**Purpose:**  
Records all donations and payments made by donors. Each payment can be linked to a specific pooja registration or be a general donation. Tracks payment method, status, and transaction reference for complete financial audit trail.

**Database Table Name:** `payments_paymentrecord`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier for payment |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor making payment |
| registration_id | INTEGER | FOREIGN KEY (PoojaRegistration), NULL | Associated pooja registration (optional) |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount in rupees |
| currency | VARCHAR(8) | DEFAULT='INR' | Currency code (typically INR) |
| mode | VARCHAR(32) | NOT NULL | Payment method used |
| status | VARCHAR(32) | DEFAULT='pending' | Current payment status |
| transaction_reference | VARCHAR(255) | NULL | Reference ID from gateway/bank |
| payment_month | DATE | NULL | Month the payment covers (for recurring) |
| notes | TEXT | NULL | Additional notes about payment |
| created_at | DATETIME | AUTO_NOW_ADD | When payment was recorded |
| updated_at | DATETIME | AUTO_NOW | Last modification timestamp |

**Payment Modes:**
- **cash** - Direct cash payment
- **card** - Credit/Debit card payment
- **neft** - NEFT bank transfer
- **upi** - UPI payment (Google Pay, PhonePe, etc.)
- **auto_debit** - Auto-debit from donor's account
- **other** - Other payment methods

**Payment Statuses:**
- **pending** - Payment initiated, awaiting confirmation
- **success** - Payment successfully received
- **failed** - Payment failed/rejected
- **refunded** - Payment refunded to donor

**Key Features:**
- ✅ Flexible payment method support
- ✅ Optional link to pooja registration
- ✅ Generic donations without registration
- ✅ Multi-currency support (default INR)
- ✅ Complete audit trail with timestamps
- ✅ Transaction reference tracking for reconciliation

**Relationships:**
- Foreign Key: donor (User), registration (PoojaRegistration - optional)
- Referenced by: PassbookEntry (1:N)

**Example Scenarios:**

```
Scenario 1: Payment for Pooja Registration
- donor_id: 5
- registration_id: 123 (linked PoojaRegistration)
- amount: 1000.00
- mode: upi
- status: success
- transaction_reference: UPI123456789

Scenario 2: General Donation (no registration)
- donor_id: 7
- registration_id: NULL
- amount: 5000.00
- mode: cash
- status: success
- notes: Monthly general donation

Scenario 3: Recurring Monthly Payment
- donor_id: 3
- registration_id: NULL
- amount: 2000.00
- mode: auto_debit
- payment_month: 2026-01-01
- status: pending (awaiting processing)
```

**Ordering:** By created_at (descending - newest first)

**Indexes:**
- donor_id (for fast donor lookup)
- created_at (for chronological queries)
- status (for payment reconciliation)

**Payment Processing Workflow:**

```
1. Donor initiates payment
   status = pending
   
2. Payment gateway processes
   - Success → status = success
   - Failure → status = failed
   - Refund request → status = refunded
   
3. PassbookEntry created for success status
4. Manual reconciliation for failed/pending
```

---

## Table 2: payments_passbookentry (PassbookEntry)

**Purpose:**  
Pre-calculated passbook entries showing the financial statement for each donor. Maintains a record of opening balance, dues, payments received, and closing balance for transparency and audit purposes. This is the final calculated view presented to donors in passbooks.

**Database Table Name:** `payments_passbookentry`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor |
| entry_date | DATE | NOT NULL | Transaction/entry date (e.g., 31/12/2025 for opening balance) |
| entry_type | VARCHAR(10) | NOT NULL | Type of entry (balance/due/paid) |
| transaction_details | VARCHAR(255) | NULL | Details like transaction ID or 'Pooja DUE' |
| payment_record_id | INTEGER | FOREIGN KEY (PaymentRecord), NULL | Link to payment if applicable |
| registration_id | INTEGER | FOREIGN KEY (PoojaRegistration), NULL | Link to registration if applicable |
| opening_balance | DECIMAL(12,2) | DEFAULT=0 | Opening balance amount at start of period |
| due_amount | DECIMAL(12,2) | DEFAULT=0 | Due amount for current month/period |
| paid_amount | DECIMAL(12,2) | DEFAULT=0 | Amount paid/received |
| closing_due | DECIMAL(12,2) | DEFAULT=0 | Closing due for current month/period |
| created_at | DATETIME | AUTO_NOW_ADD | Record creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last modification timestamp |

**Entry Types:**
1. **balance** - Opening Balance entry (month start)
2. **due** - Pooja Due entry (charge for upcoming pooja)
3. **paid** - Payment Received entry (actual payment)

**Key Features:**
- ✅ Pre-calculated for fast retrieval
- ✅ Monthly statement generation
- ✅ Opening and closing balance tracking
- ✅ Links to source transactions
- ✅ Audit trail with timestamps

**Example Passbook Entry Sequence (Monthly):**

```
Date: 31/12/2025, Entry: Opening Balance
- entry_type: balance
- opening_balance: 5000.00
- Result: Starting balance of INR 5000

Date: 05/01/2026, Entry: Pooja Due (Abhisheka)
- entry_type: due
- registration_id: 150
- due_amount: 2000.00
- opening_balance: 5000.00
- closing_due: 2000.00
- Result: Due amount added

Date: 10/01/2026, Entry: Payment Received
- entry_type: paid
- payment_record_id: 890
- paid_amount: 3000.00
- opening_balance: 5000.00
- closing_due: -1000.00 (credit)
- Result: Payment adjusted against dues

Date: 31/01/2026, Entry: Opening Balance (Next Month)
- entry_type: balance
- opening_balance: -1000.00 (credit from previous)
```

**Relationships:**
- Foreign Keys: donor (User), payment_record (PaymentRecord - optional), registration (PoojaRegistration - optional)

**Ordering:** By donor, then by entry_date

**Indexes:**
- (donor_id, entry_date) - Compound index for statement retrieval
- (donor_id, -entry_date) - Compound index for reverse chronological (newest first)

**Passbook Generation Workflow:**

```
1. Month starts → Create opening balance entry
2. Throughout month:
   - Pooja registered → Create due entry
   - Payment received → Create paid entry
3. Month ends → Closing balance calculated
4. Monthly statement generated from PassbookEntry records
5. Donor views their financial statement
```

**Financial Calculations:**
```
Opening Balance (from previous closing)
+ Due Amount (new poojas this month)
- Paid Amount (payments received this month)
= Closing Due (for next month's opening)
```

---

## Table 3: payments_combinepaymentmapping (CombinePaymentMapping)

**Purpose:**  
Maps child donors to parent donors for combined payment tracking. This allows organizations to group multiple donor accounts (e.g., family members) for consolidated billing and financial reporting purposes.

**Database Table Name:** `payments_combinepaymentmapping`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| main_donor_id | INTEGER | FOREIGN KEY (User) | Child/main donor being mapped |
| parent_donor_id | INTEGER | FOREIGN KEY (User) | Parent donor for payment aggregation |
| main_donor_phone | VARCHAR(15) | NULL | Cached phone of main donor |
| main_donor_name | VARCHAR(255) | NULL | Cached name of main donor |
| parent_donor_phone | VARCHAR(15) | NULL | Cached phone of parent donor |
| parent_donor_name | VARCHAR(255) | NULL | Cached name of parent donor |
| effective_from | DATE | NOT NULL | First month (inclusive) when mapping is active |
| effective_to | DATE | NULL | First month (exclusive) when mapping ends |
| created_at | DATETIME | AUTO_NOW_ADD | Mapping creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last modification timestamp |

**Key Features:**
- ✅ Time-based activation (effective dates)
- ✅ Cached donor info for audit trail
- ✅ Historical tracking of mappings
- ✅ Flexible start/end date control
- ✅ Supports mapping changes over time

**Use Cases:**

```
Use Case 1: Family Payment Consolidation
- Child 1 (main) → mapped to Parent (guardian)
- Child 2 (main) → mapped to Parent (guardian)
- All payments consolidated under Parent's account
- Useful for family groups

Use Case 2: Temporary Combined Billing
- main_donor: Employee
- parent_donor: Organization
- effective_from: 2026-01-01
- effective_to: 2026-12-31
- After Dec 31, separate billing resumes

Use Case 3: Organizational Mapping
- main_donor: Individual branch donor
- parent_donor: Main organization/branch
- Consolidates regional donations
```

**Example Data:**

```
Mapping 1:
- main_donor_id: 10, phone: 9876543210, name: "John"
- parent_donor_id: 5, phone: 9999999999, name: "Parent John"
- effective_from: 2026-01-01
- effective_to: NULL (ongoing)
- Status: Active mapping

Mapping 2:
- main_donor_id: 15, phone: 9111111111, name: "Jane"
- parent_donor_id: 5, phone: 9999999999, name: "Parent John"
- effective_from: 2026-01-01
- effective_to: NULL
- Status: Active mapping
- Result: Both John and Jane payments consolidated under Parent
```

**Financial Impact:**

```
Scenario: Monthly Statement for Parent Donor
- Own registrations: 2000 (dues) → -1000 (paid) = -1000 (due)
- Child 1 mappings: 1500 (dues) → -500 (paid) = +1000 (due)
- Child 2 mappings: 1000 (dues) → 0 (paid) = +1000 (due)
- Combined total due: 3000

Payment against combined due:
- Parent pays 5000 → applied against combined 3000 due
- Result: 2000 credit balance
```

**Relationships:**
- Foreign Keys: main_donor (User), parent_donor (User)

**Ordering:** By updated_at desc, then by created_at desc

**Constraints:**
- UNIQUE: (main_donor_id, parent_donor_id)
- Prevents duplicate mappings between same donor pair

**Important Notes:**

```
1. Mapping Activation:
   - Effective at the first day of month (effective_from normalized)
   - Payment calculations include mapped donors during active period
   
2. Audit Trail:
   - Cached phone and name for historical reference
   - If donor details change, mapping stores historical snapshot
   
3. Transition Handling:
   - When effective_to reached, mapping deactivates
   - Separate billing resumes automatically
   - No manual intervention needed
```

---

## Table 4: payments_expenserecord (ExpenseRecord)

**Purpose:**  
Records all temple expenses and operational costs. Tracks spending by category, date, and amount for financial analysis, budget management, and operational insights.

**Database Table Name:** `payments_expenserecord`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| transaction_date | DATE | NOT NULL | Date of expense transaction |
| category | VARCHAR(128) | NOT NULL | Category of expense |
| amount | DECIMAL(10,2) | NOT NULL | Expense amount in rupees |
| notes | TEXT | NULL | Additional notes/description |
| created_by_id | INTEGER | FOREIGN KEY (User), NULL | Admin who recorded the expense |
| created_at | DATETIME | AUTO_NOW_ADD | Record creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last modification timestamp |

**Common Expense Categories:**
- **Maintenance** - Building/temple maintenance
- **Staff** - Employee salaries, wages
- **Supplies** - Pooja supplies, flowers, oils
- **Utilities** - Electricity, water, gas
- **Materials** - Rituals materials
- **Contractor** - External contractor payments
- **Admin** - Administrative expenses
- **Marketing** - Promotion and advertising
- **Miscellaneous** - Other expenses

**Key Features:**
- ✅ Category-based organization
- ✅ Admin audit trail (created_by)
- ✅ Flexible date-based tracking
- ✅ Detailed notes support
- ✅ Historical expense tracking

**Example Expense Records:**

```
Record 1:
- transaction_date: 2026-01-15
- category: Maintenance
- amount: 5000.00
- notes: Regular temple maintenance
- created_by_id: 2 (admin user)

Record 2:
- transaction_date: 2026-01-20
- category: Supplies
- amount: 1500.00
- notes: Monthly flower and oil supplies

Record 3:
- transaction_date: 2026-01-28
- category: Staff
- amount: 25000.00
- notes: Monthly staff salary payment
```

**Relationships:**
- Foreign Key: created_by (User - optional)

**Ordering:** By transaction_date desc, then by created_at desc

**Financial Reporting:**

```
Monthly Expense Report:
SELECT category, SUM(amount) as total
FROM payments_expenserecord
WHERE MONTH(transaction_date) = 1 AND YEAR(transaction_date) = 2026
GROUP BY category
ORDER BY total DESC;

Result:
Staff: 25000
Maintenance: 5000
Supplies: 1500
Total: 31500
```

**Budget Analysis:**
```
1. Categorize all donations (payments_paymentrecord)
2. Categorize all expenses (payments_expenserecord)
3. Calculate net position:
   Total Income - Total Expenses = Net Surplus/Deficit
4. Generate reports by category and time period
```

---

# PAYMENT WORKFLOWS

## Workflow 1: Simple Donation Payment

```
1. Donor initiates payment (without pooja registration)
2. Selects payment method (cash/card/UPI/NEFT)
3. System creates PaymentRecord
   - donor_id: selected
   - registration_id: NULL (no linked registration)
   - amount: entered amount
   - mode: selected method
   - status: pending
4. Payment processed by gateway
5. Status updated: pending → success
6. PassbookEntry created for passbook
7. Donor notified of successful payment
```

## Workflow 2: Pooja Registration Payment

```
1. Donor registers for pooja
   - Creates PoojaRegistration
   - status: pending, registration_number: auto-generated
2. Amount calculated: quantity * default_amount
3. Payment initiated
4. System creates PaymentRecord
   - registration_id: linked to PoojaRegistration
   - amount: calculated from registration
   - status: pending
5. Payment processed
6. On success:
   - PaymentRecord.status = success
   - PoojaRegistration.status = confirmed
   - PassbookEntry created for "paid" entry
7. PassbookEntry linked to both payment and registration
```

## Workflow 3: Combined Donor Payment

```
1. CombinePaymentMapping active for Donor A → Parent B
2. Donor A has dues: 2000
3. Parent B has dues: 3000
4. Combined total due: 5000

5. Parent pays 5500:
   - PaymentRecord created: parent_id=B, amount=5500
   - PassbookEntry for Parent: paid_amount=5500
   - Mapping applies: 3000 to Parent, 2000 to Child
   - Result: 500 credit balance

6. Next cycle:
   - Opening balance for Parent: -500 (credit)
   - Opening balance for Child: 0 (cleared)
```

## Workflow 4: Monthly Expense Recording

```
1. Admin logs into expense management
2. Records expense:
   - Date: transaction date
   - Category: selected category
   - Amount: expense amount
   - Notes: description
   - created_by: current admin
3. System creates ExpenseRecord
4. Report generation queries this data
5. Budget analysis uses aggregated expenses
```

## Workflow 5: Passbook Statement Generation

```
1. Month starts (1st of month)
   - Create PassbookEntry (entry_type=balance)
   - opening_balance = previous month's closing
   
2. Throughout month:
   - Pooja registered
     - Create PassbookEntry (entry_type=due)
     - due_amount = pooja cost
   
   - Payment received
     - Create PassbookEntry (entry_type=paid)
     - paid_amount = payment amount
     - Linked to PaymentRecord
   
3. Closing balance calculated:
   - Sum of all entries for month
   - closing_due = opening + due - paid
   
4. Generate passbook for donor:
   - Retrieve all PassbookEntry for donor, current month
   - Display chronologically
   - Show running balance
```

---

# FINANCIAL DATA RELATIONSHIPS

```
PaymentRecord (All Transactions)
    ├── Foreign Keys to: User (donor), PoojaRegistration (optional)
    └── Referenced by: PassbookEntry (1:N)

PassbookEntry (Financial Statements)
    ├── Foreign Keys to: User (donor), PaymentRecord, PoojaRegistration
    └── Calculated from: PaymentRecord + PoojaRegistration

CombinePaymentMapping (Donor Grouping)
    ├── Foreign Keys to: User (main_donor), User (parent_donor)
    └── Modifies: Payment aggregation logic

ExpenseRecord (Cost Tracking)
    ├── Foreign Key to: User (created_by - admin)
    └── Used for: Budget analysis and reporting
```

---

# KEY QUERIES & REPORTS

## Query 1: Monthly Income by Category

```sql
SELECT 
    CASE 
        WHEN registration_id IS NULL THEN 'General Donation'
        ELSE 'Pooja Payment'
    END as payment_type,
    mode as payment_method,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM payments_paymentrecord
WHERE status = 'success' 
  AND MONTH(created_at) = 1 
  AND YEAR(created_at) = 2026
GROUP BY payment_type, payment_method;
```

## Query 2: Donor Account Statement

```sql
SELECT 
    entry_date,
    entry_type,
    transaction_details,
    opening_balance,
    due_amount,
    paid_amount,
    closing_due
FROM payments_passbookentry
WHERE donor_id = ? 
  AND MONTH(entry_date) = ? 
  AND YEAR(entry_date) = ?
ORDER BY entry_date;
```

## Query 3: Combined Donor Consolidation

```sql
SELECT 
    pd.phone_number,
    pd.user.name,
    SUM(pr.amount) as total_due,
    SUM(COALESCE(payment.amount, 0)) as total_paid
FROM payments_paymentrecord pr
JOIN payments_combinepaymentmapping m 
    ON m.effective_from <= CURDATE() 
    AND (m.effective_to IS NULL OR m.effective_to > CURDATE())
JOIN accounts_donorprofile pd ON pr.donor_id = m.parent_donor_id
WHERE pr.status = 'success'
GROUP BY m.parent_donor_id;
```

## Query 4: Monthly Expense Summary

```sql
SELECT 
    category,
    COUNT(*) as transaction_count,
    SUM(amount) as total_expense,
    AVG(amount) as average_expense
FROM payments_expenserecord
WHERE MONTH(transaction_date) = 1 
  AND YEAR(transaction_date) = 2026
GROUP BY category
ORDER BY total_expense DESC;
```

---

# INDEXES FOR PERFORMANCE

| Table | Indexed Columns | Type | Purpose |
|-------|-----------------|------|---------|
| PaymentRecord | donor_id | Simple | Fast donor payment lookup |
| PaymentRecord | status | Simple | Payment reconciliation |
| PaymentRecord | created_at | Simple | Chronological queries |
| PassbookEntry | (donor_id, entry_date) | Compound | Statement retrieval |
| PassbookEntry | (donor_id, -entry_date) | Compound | Reverse chronological |
| CombinePaymentMapping | (main_donor, parent_donor) | Compound | Unique mapping constraint |
| CombinePaymentMapping | effective_from, effective_to | Compound | Active mapping lookup |
| ExpenseRecord | transaction_date | Simple | Date-based reports |
| ExpenseRecord | category | Simple | Category-based analysis |

---

# IMPORTANT NOTES

1. **Payment Status Flow:**
   - pending → success (normal flow)
   - pending → failed (payment rejected)
   - success → refunded (refund issued)

2. **PassbookEntry Calculations:**
   - Pre-calculated for fast retrieval
   - Updated when PaymentRecord status changes
   - Historical audit trail maintained

3. **Combined Payment Logic:**
   - Effective dates control mapping activation
   - Payments automatically aggregated during active period
   - Deactivation automatic on effective_to date

4. **Expense Tracking:**
   - Admin audit trail (created_by field)
   - Categories standardized for reporting
   - Budget variance analysis possible

5. **Currency Handling:**
   - Primarily INR (default)
   - Other currencies supported via currency field
   - No automatic conversion; manual rate application needed

6. **Reconciliation:**
   - transaction_reference links to external systems
   - Failed payments tracked for manual follow-up
   - Audit log complete with timestamps

---

**End of Payment Module Documentation**
