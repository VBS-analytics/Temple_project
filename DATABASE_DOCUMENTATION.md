# Temple Management System - Database Documentation

## Overview
This document provides a comprehensive overview of the Temple Management System database structure, including all tables, their columns, data types, and their purposes within the application.

**Database Name:** Django ORM (supports SQLite, PostgreSQL, MySQL)  
**Generated:** January 22, 2026

---

## Database Structure Summary

The database consists of **three main applications** with multiple interconnected tables, plus Django framework tables:

1. **accounts** - User authentication and donor profiles
2. **payments** - Payment tracking and financial records
3. **pooja** - Pooja registrations and religious service management
4. **django** - Django framework tables (permissions, sessions, migrations)
5. **auth** - Django authentication groups and permissions

**Total Tables: 30** (21 custom application tables + 9 Django framework tables)

---

# TABLE STRUCTURE AND DOCUMENTATION

## APPLICATION 1: ACCOUNTS (User Management & Authentication)

### Table 1: auth_user (User)

**Purpose:**  
Core user table that handles authentication and user management. This table stores all user credentials, roles, and basic profile information. Users can be either donors or administrators of the temple management system.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier for each user |
| password | VARCHAR(128) | NOT NULL | Encrypted password hash |
| phone_number | VARCHAR(15) | UNIQUE, NOT NULL | Primary login credential - unique phone number |
| name | VARCHAR(255) | NOT NULL | Full name of the user |
| email | VARCHAR(254) | NULL | Email address (optional) |
| role | VARCHAR(20) | NOT NULL, DEFAULT='donor' | User role (donor/admin) |
| is_active | BOOLEAN | DEFAULT=TRUE | Whether the user account is active |
| is_staff | BOOLEAN | DEFAULT=FALSE | Whether user can access admin panel |
| is_superuser | BOOLEAN | DEFAULT=FALSE | Whether user has all permissions |
| date_joined | DATETIME | AUTO_NOW_ADD | Timestamp when user registered |
| last_login | DATETIME | NULL | Timestamp of last login |

**Key Relationships:**
- Referenced by: DonorProfile (OneToOne), FamilyMember (OneToMany), PoojaRegistration (OneToMany), PaymentRecord (OneToMany)

**Indexes:**
- phone_number (UNIQUE)
- date_joined

---

### Table 2: accounts_otptoken (OtpToken)

**Purpose:**  
Stores One-Time Passwords (OTP) for user verification during registration, login, and password reset operations. Each OTP has an expiration time and can only be used once for security.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier for OTP record |
| phone_number | VARCHAR(15) | NOT NULL | Phone number associated with OTP |
| code | VARCHAR(6) | NOT NULL | 6-digit OTP code |
| purpose | VARCHAR(32) | NOT NULL | Purpose of OTP (registration/login/reset_password) |
| is_used | BOOLEAN | DEFAULT=FALSE | Whether OTP has been used |
| created_at | DATETIME | AUTO_NOW_ADD | When OTP was created |
| expires_at | DATETIME | NOT NULL | When OTP expires (typically 10 minutes) |

**Key Features:**
- OTP codes are 6 digits (000000 to 999999)
- Default TTL: 10 minutes
- Can only be used once
- Automatically marked as used after validation

**Indexes:**
- (phone_number, purpose) - Composite index for quick lookups
- expires_at - For cleanup operations

---

### Table 3: accounts_donorprofile (DonorProfile)

**Purpose:**  
Stores comprehensive donor information and personal details. Each user can have only one donor profile (OneToOne relationship). Contains address, astrological details, donation preferences, and financial tracking information.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier for donor profile |
| user_id | INTEGER | FOREIGN KEY (User), UNIQUE | Reference to User (one-to-one relationship) |
| address_line1 | VARCHAR(255) | NULL | First line of address |
| address_line2 | VARCHAR(255) | NULL | Second line of address |
| address_line3 | VARCHAR(255) | NULL | Third line of address |
| city | VARCHAR(128) | NULL | City name |
| state | VARCHAR(128) | NULL | State name |
| postal_code | VARCHAR(12) | NULL | Postal/ZIP code |
| gothra | VARCHAR(128) | NULL | Donor's Gothra (ancestral lineage) |
| tamil_star | VARCHAR(128) | NULL | Tamil star/nakshatra of birth |
| rasi | VARCHAR(128) | NULL | Zodiac sign/rasi |
| gender | VARCHAR(32) | NULL, DEFAULT='' | Gender (M/F/Other) |
| tamil_name | VARCHAR(255) | NULL, DEFAULT='' | Name in Tamil script |
| date_of_birth | DATE | NULL | Date of birth |
| family_name | VARCHAR(255) | NULL, DEFAULT='' | Family surname |
| notes | TEXT | NULL | Additional notes about donor |
| custom_number | INTEGER | NULL | Custom reference number |
| monthly_donation_amount | DECIMAL(12,2) | DEFAULT=0.00 | Regular monthly donation amount |
| opening_balance | DECIMAL(12,2) | DEFAULT=0.00 | Opening balance for current month/year |
| donor_number | INTEGER | UNIQUE, NULL | Unique sequential donor ID (auto-generated as D{number}) |
| created_at | DATETIME | AUTO_NOW_ADD | Profile creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last profile update timestamp |

**Key Features:**
- Automatic donor_number generation in format: D1, D2, D3...
- Supports multi-language (Tamil and English)
- Tracks astrological information (gothra, rasi, tamil_star)
- Linked to monthly donation tracking

**Ordering:** By user name

---

### Table 4: accounts_familymember (FamilyMember)

**Purpose:**  
Stores information about family members associated with a donor. Allows recording details of spouse, children, and other family members for personalized pooja registrations and temple records.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| user_id | INTEGER | FOREIGN KEY (User) | Reference to parent donor |
| name | VARCHAR(255) | NOT NULL | Family member's name |
| gender | VARCHAR(32) | NULL | Gender of family member |
| relationship | VARCHAR(64) | NULL | Relationship to donor (spouse/child/parent/etc) |
| date_of_birth | DATE | NULL | Date of birth |
| tamil_star | VARCHAR(128) | NULL | Tamil star/nakshatra |
| gothra | VARCHAR(128) | NULL | Family gothra |
| rasi | VARCHAR(128) | NULL | Zodiac sign |
| family_name | VARCHAR(255) | NULL, DEFAULT='' | Family surname |
| created_at | DATETIME | AUTO_NOW_ADD | Record creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Key Relationships:**
- Foreign Key to User (Many to One)

**Ordering:** By name, then by ID

---

### Table 5: accounts_gothraoption (GothraOption)

**Purpose:**  
Maintains a master list of valid Gothra (ancestral lineage) options for donors and family members. Prevents data inconsistency by storing standardized gothra names.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| name | VARCHAR(128) | UNIQUE, NOT NULL | Name of gothra |

**Key Features:**
- Reference data for dropdown lists
- Unique constraint on gothra name
- Used for data consistency across donor profiles

**Ordering:** By name

---

## APPLICATION 2: PAYMENTS (Financial Management)

### Table 6: payments_paymentrecord (PaymentRecord)

**Purpose:**  
Records all donations and payments made by donors. Each payment can be linked to a specific pooja registration or be a general donation. Tracks payment method, status, and transaction reference for complete financial audit trail.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier for payment |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor making payment |
| registration_id | INTEGER | FOREIGN KEY (PoojaRegistration), NULL | Associated pooja registration (optional) |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount |
| currency | VARCHAR(8) | DEFAULT='INR' | Currency code (typically INR) |
| mode | VARCHAR(32) | NOT NULL | Payment method (cash/card/neft/upi/auto_debit/other) |
| status | VARCHAR(32) | DEFAULT='pending' | Payment status (pending/success/failed/refunded) |
| transaction_reference | VARCHAR(255) | NULL | Reference ID from payment gateway or bank |
| payment_month | DATE | NULL | Month the payment covers (for recurring donations) |
| notes | TEXT | NULL | Additional notes about payment |
| created_at | DATETIME | AUTO_NOW_ADD | When payment was recorded |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Payment Modes:** NEFT, UPI, Cash, Credit/Debit Card, Auto Debit, Other

**Payment Statuses:** Pending, Success, Failed, Refunded

**Ordering:** By created_at (descending)

---

### Table 7: payments_passbookentry (PassbookEntry)

**Purpose:**  
Pre-calculated passbook entries showing the financial statement for each donor. Maintains a record of opening balance, dues, payments received, and closing balance for transparency and audit purposes. This is the final calculated view presented to donors.

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
| opening_balance | DECIMAL(12,2) | DEFAULT=0 | Opening balance amount |
| due_amount | DECIMAL(12,2) | DEFAULT=0 | Due amount for current month |
| paid_amount | DECIMAL(12,2) | DEFAULT=0 | Amount received/paid |
| closing_due | DECIMAL(12,2) | DEFAULT=0 | Closing due for current month |
| created_at | DATETIME | AUTO_NOW_ADD | Record creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Entry Types:**
- **balance**: Opening Balance
- **due**: Pooja Due
- **paid**: Payment Received

**Ordering:** By donor, then by entry_date

**Indexes:**
- (donor_id, entry_date)
- (donor_id, -entry_date)

---

### Table 8: payments_combinepaymentmapping (CombinePaymentMapping)

**Purpose:**  
Maps child donors to parent donors for combined payment tracking. This allows organizations to group multiple donor accounts for consolidated billing and financial reporting purposes.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| main_donor_id | INTEGER | FOREIGN KEY (User) | Child/main donor |
| parent_donor_id | INTEGER | FOREIGN KEY (User) | Parent donor for combining payments |
| main_donor_phone | VARCHAR(15) | NULL | Cached phone of main donor |
| main_donor_name | VARCHAR(255) | NULL | Cached name of main donor |
| parent_donor_phone | VARCHAR(15) | NULL | Cached phone of parent donor |
| parent_donor_name | VARCHAR(255) | NULL | Cached name of parent donor |
| effective_from | DATE | NOT NULL | First month (inclusive) when mapping is active |
| effective_to | DATE | NULL | First month (exclusive) when mapping ends |
| created_at | DATETIME | AUTO_NOW_ADD | Mapping creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Key Features:**
- Time-based activation (effective_from, effective_to)
- Caches donor information for audit trail
- Unique constraint on (main_donor, parent_donor) pair

**Ordering:** By updated_at desc, then by created_at desc

---

### Table 9: payments_expenserecord (ExpenseRecord)

**Purpose:**  
Records all temple expenses and operational costs. Tracks spending by category, date, and amount for financial analysis and budget management.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| transaction_date | DATE | NOT NULL | Date of expense |
| category | VARCHAR(128) | NOT NULL | Category of expense (e.g., Maintenance, Staff, Supplies) |
| amount | DECIMAL(10,2) | NOT NULL | Expense amount |
| notes | TEXT | NULL | Additional notes about expense |
| created_by_id | INTEGER | FOREIGN KEY (User), NULL | Admin who recorded the expense |
| created_at | DATETIME | AUTO_NOW_ADD | Record creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Ordering:** By transaction_date desc, then by created_at desc

---

## APPLICATION 3: POOJA (Religious Services Management)

### Table 10: pooja_poojaoption (PoojaOption)

**Purpose:**  
Master catalog of all available poojas (religious services) that donors can register for. Supports hierarchical organization where poojas can have parent categories and child options. Each option can have minimum, maximum, and default donation amounts.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| code | VARCHAR(16) | UNIQUE, NOT NULL | Unique code for pooja (e.g., ABHISHEKA, HAVAN) |
| name | VARCHAR(255) | NOT NULL | Display name of pooja |
| description | TEXT | NULL | Detailed description |
| min_amount | DECIMAL(10,2) | NULL | Minimum donation amount |
| max_amount | DECIMAL(10,2) | NULL | Maximum donation amount |
| default_amount | DECIMAL(10,2) | NULL | Suggested donation amount |
| is_active | BOOLEAN | DEFAULT=TRUE | Whether pooja is currently offered |
| parent_id | INTEGER | FOREIGN KEY (self), NULL | Parent pooja (for hierarchies) |
| is_group_header | BOOLEAN | DEFAULT=FALSE | Whether this is a header/category |
| display_order | INTEGER | DEFAULT=0 | Sort order for UI display |

**Key Features:**
- Hierarchical structure (parent-child relationships)
- Price range enforcement
- Category headers with group_header flag
- Database indexed by display_order for efficient sorting

**Ordering:** By parent_id, display_order, code

---

### Table 11: pooja_poojadayoption (PoojaDayOption)

**Purpose:**  
Stores different day options for scheduling poojas. Categories include weekday selections, template codes, and Tamil astrological days. Provides flexibility in when poojas can be scheduled.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| code | VARCHAR(16) | UNIQUE, NOT NULL | Code for day option (e.g., MONDAY, POURNAMI) |
| description | VARCHAR(255) | NOT NULL | Human-readable description |
| category | VARCHAR(32) | NOT NULL | Category (weekday/code/tamil_star) |
| display_order | INTEGER | DEFAULT=0 | Sort order for display |

**Categories:**
- **weekday**: Standard weekdays (Monday, Tuesday, etc.)
- **code**: Template codes
- **tamil_star**: Tamil astrological days/nakshatras

**Ordering:** By display_order, then by id

---

### Table 12: pooja_poojadayoption (DailyMessage)

**Purpose:**  
Stores daily messages and announcements that appear on the temple management dashboard. Contains header and footer text for each labeled message.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| label | VARCHAR(64) | UNIQUE, NOT NULL | Unique label for message (e.g., DAILY_GREETING) |
| header_text | TEXT | NOT NULL | Header/title text |
| footer_text | TEXT | NULL | Footer/closing text |

**Ordering:** By label

---

### Table 13: pooja_specialannouncement (SpecialAnnouncement)

**Purpose:**  
Manages special announcements and notifications for specific events or important temple information. Time-sensitive content that can be displayed to donors.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| label | VARCHAR(64) | NOT NULL | Title/label of announcement |
| description | TEXT | NOT NULL | Full announcement text |
| created_at | DATETIME | AUTO_NOW_ADD | When announcement was created |

**Ordering:** By created_at, then by id

---

### Table 14: pooja_donormessagetemplate (DonorMessageTemplate)

**Purpose:**  
Stores customized message templates for individual donors. Allows donors to set preferred dates, day options, and personalized text for their daily reminders about poojas and donations.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor |
| preferred_date | DATE | NULL | Preferred date for messages |
| day_option_id | INTEGER | FOREIGN KEY (PoojaDayOption), NULL | Selected day option |
| summary_text | TEXT | NOT NULL | Summary/main message text |
| tamil_text | TEXT | NULL | Message in Tamil |
| gothra_details | VARCHAR(255) | NULL | Gothra-specific details |

**Ordering:** By donor, then by preferred_date

---

### Table 15: pooja_poojaregistration (PoojaRegistration)

**Purpose:**  
Core table for pooja registrations. Records when a donor registers for a specific pooja with all relevant details including date, quantity, amount, and status tracking. Each registration gets a unique registration number.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor registering |
| pooja_option_id | INTEGER | FOREIGN KEY (PoojaOption) | Selected pooja type |
| day_option_id | INTEGER | FOREIGN KEY (PoojaDayOption), NULL | Selected day preference |
| start_date | DATE | NULL | Start date for pooja |
| quantity | INTEGER | DEFAULT=1 | Number of repetitions |
| is_group_registration | BOOLEAN | DEFAULT=FALSE | Whether this is for a group |
| post_prasadam | BOOLEAN | DEFAULT=FALSE | Whether prasadam (blessed offering) included |
| additional_notes | TEXT | NULL | Special requests or notes |
| total_amount | DECIMAL(10,2) | NULL | Total amount paid for registration |
| status | VARCHAR(16) | NOT NULL, DEFAULT='pending' | Registration status |
| registration_number | INTEGER | UNIQUE, NULL | Auto-generated sequential registration ID (PR{number}) |
| created_at | DATETIME | AUTO_NOW_ADD | Registration creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Statuses:**
- **pending**: Awaiting confirmation
- **confirmed**: Pooja confirmed
- **completed**: Pooja has been performed

**Key Features:**
- Automatic registration_number generation
- Supports group registrations
- Tracks prasadam inclusion
- Linked to payment records for billing

**Ordering:** By created_at (descending)

---

### Table 16: pooja_poojaregistrationmember (PoojaRegistrationMember)

**Purpose:**  
Stores members included in a group pooja registration. When a donor registers poojas for family members or group participants, this table tracks individual member details for each registration.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| registration_id | INTEGER | FOREIGN KEY (PoojaRegistration) | Reference to parent registration |
| name | VARCHAR(255) | NOT NULL | Member's name |
| phone_number | VARCHAR(15) | NULL | Member's phone number |
| relationship | VARCHAR(128) | NULL | Relationship to primary donor |
| date_of_birth | DATE | NULL | Date of birth |
| family_name | VARCHAR(255) | NULL, DEFAULT='' | Family surname |
| tamil_star | VARCHAR(128) | NULL | Tamil star/nakshatra |
| gothra | VARCHAR(128) | NULL | Gothra (ancestral lineage) |
| rasi | VARCHAR(128) | NULL, DEFAULT='' | Zodiac sign |

**Ordering:** By registration, then by name

---

### Table 17: pooja_recurringpoojaplan (RecurringPoojaPlan)

**Purpose:**  
Manages recurring pooja registrations with flexible scheduling. Supports monthly, quarterly, and annual recurrences, as well as one-time extra poojas. Tracks recurrence status, pause periods, and next occurrence dates.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor |
| pooja_option_id | INTEGER | FOREIGN KEY (PoojaOption) | Selected pooja |
| day_option_id | INTEGER | FOREIGN KEY (PoojaDayOption), NULL | Day preference |
| recurrence_kind | VARCHAR(32) | DEFAULT='recurring' | Kind: recurring or one_time_extra |
| recurrence_frequency | VARCHAR(32) | DEFAULT='monthly' | Frequency: monthly/quarterly/annually |
| start_date | DATE | NULL | When recurrence starts |
| next_occurrence | DATE | NULL | Next scheduled date |
| last_occurrence | DATE | NULL | Last occurrence date |
| one_time_date | DATE | NULL | Date for one-time extra poojas |
| amount | DECIMAL(10,2) | NULL | Amount per occurrence |
| is_active | BOOLEAN | DEFAULT=TRUE | Whether plan is currently active |
| pause_from | DATE | NULL | Start date of pause period |
| pause_until | DATE | NULL | End date of pause period |
| origin_registration_id | INTEGER | FOREIGN KEY (PoojaRegistration), NULL | Original registration creating this plan |
| metadata | JSON | DEFAULT={} | Additional flexible data |
| cart_payload | JSON | DEFAULT={} | Cart-related payload data |
| created_at | DATETIME | AUTO_NOW_ADD | Plan creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Recurrence Types:**
- **Recurring**: Ongoing poojas at set frequency
- **One-time Extra**: Single additional pooja

**Frequencies:**
- **Monthly**: Every month
- **Quarterly**: Every 3 months
- **Annually**: Every year

**Key Features:**
- Pause functionality for temporary stops
- Tracks both next and last occurrence
- Supports metadata for extensibility
- Unique constraints prevent duplicate recurring poojas

**Ordering:** By created_at desc, then by id

---

### Table 18: pooja_featuredpooja (FeaturedPooja)

**Purpose:**  
Lightweight content blocks for the landing page pooja showcase section. Displays featured poojas with images and amounts to promote popular or seasonal services.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Name of featured pooja |
| image | IMAGE | NOT NULL | Uploaded image file |
| amount | DECIMAL(10,2) | NULL | Suggested donation amount |
| is_active | BOOLEAN | DEFAULT=TRUE | Whether currently featured |
| created_at | DATETIME | AUTO_NOW_ADD | Creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Ordering:** By created_at desc, then by id

---

### Table 19: pooja_poojacartsnapshot (PoojaCartSnapshot)

**Purpose:**  
Stores the current shopping cart state for each donor. Captures donor's selected poojas and quantities for processing payments and registrations.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User), UNIQUE | Reference to donor (one-to-one) |
| items | JSON | DEFAULT=[] | List of cart items (poojas, quantities, amounts) |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Key Features:**
- One cart per donor (OneToOne)
- JSON format for flexible item storage

**Ordering:** By updated_at desc

---

### Table 20: pooja_poojacartsnaphotexportbatch (PoojaCartSnapshotExportBatch)

**Purpose:**  
Manages batch exports of donor cart snapshots. Tracks who initiated exports and when they occurred for audit purposes.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| created_by_id | INTEGER | FOREIGN KEY (User), NULL | Admin who initiated export |
| created_at | DATETIME | AUTO_NOW_ADD | Export timestamp |

**Ordering:** By created_at desc

---

### Table 21: pooja_poojacartsnaphotexportentry (PoojaCartSnapshotExportEntry)

**Purpose:**  
Individual entries within a cart snapshot export batch. Each entry represents one donor's cart state at the time of export.

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| batch_id | INTEGER | FOREIGN KEY (PoojaCartSnapshotExportBatch) | Reference to batch |
| donor_id | INTEGER | NULL | Donor's ID (cached for archive) |
| donor_name | VARCHAR(255) | NULL | Donor's name (cached) |
| donor_phone | VARCHAR(32) | NULL | Donor's phone (cached) |
| items | JSON | DEFAULT=[] | Cart items at time of export |

---

## DATABASE RELATIONSHIPS SUMMARY

### Key Foreign Key Relationships:

```
User (auth_user)
  ├── 1:1 DonorProfile (accounts_donorprofile)
  ├── 1:N FamilyMember (accounts_familymember)
  ├── 1:N PaymentRecord (payments_paymentrecord)
  ├── 1:N PassbookEntry (payments_passbook_entry)
  ├── 1:N PoojaRegistration (pooja_poojaregistration)
  ├── 1:N RecurringPoojaPlan (pooja_recurringpoojaplan)
  ├── 1:N DonorMessageTemplate (pooja_donormessagetemplate)
  ├── 1:1 PoojaCartSnapshot (pooja_poojacartsnapshot)
  └── 1:N ExpenseRecord (payments_expenserecord) [as created_by]

PoojaOption (pooja_poojaoption)
  ├── 1:N PoojaRegistration
  ├── 1:N RecurringPoojaPlan
  └── Self-referencing: parent category relationships

PoojaDayOption (pooja_poojadayoption)
  ├── 1:N PoojaRegistration
  ├── 1:N RecurringPoojaPlan
  └── 1:N DonorMessageTemplate

PoojaRegistration (pooja_poojaregistration)
  ├── 1:N PoojaRegistrationMember
  ├── 1:N PaymentRecord
  ├── 1:N PassbookEntry
  ├── 1:N RecurringPoojaPlan [as origin_registration]
  └── 1:N PassbookEntry

PaymentRecord (payments_paymentrecord)
  ├── N:1 User [donor]
  ├── N:1 PoojaRegistration
  └── 1:N PassbookEntry
```

---

## Data Integrity Constraints

### Unique Constraints:
1. **User**: phone_number (unique login)
2. **DonorProfile**: user_id (one profile per user), donor_number (sequential ID)
3. **PoojaOption**: code (unique pooja code)
4. **PoojaDayOption**: code (unique day option)
5. **DailyMessage**: label (unique message identifier)
6. **PoojaRegistration**: registration_number (auto-incremented PR ID)
7. **RecurringPoojaPlan**: Composite constraints on (donor, pooja, day, kind)
8. **PoojaCartSnapshot**: donor_id (one cart per donor)
9. **CombinePaymentMapping**: (main_donor, parent_donor) pair

### Check Constraints:
- Amounts: Cannot be negative
- Date fields: Future dates where applicable

---

## Indexes for Performance

Key indexes to optimize query performance:

| Table | Indexed Columns | Type | Purpose |
|-------|-----------------|------|---------|
| OtpToken | (phone_number, purpose) | Compound | Fast OTP lookup by phone and purpose |
| OtpToken | expires_at | Simple | Cleanup of expired OTPs |
| PassbookEntry | (donor_id, entry_date) | Compound | Statement retrieval |
| PassbookEntry | (donor_id, -entry_date) | Compound | Reverse chronological statements |
| PoojaDayOption | display_order | Simple | UI sorting |
| PoojaOption | display_order | Simple | UI sorting |

---

## Data Flow Diagrams

### 1. Donation Payment Flow:
```
Donor (User) → PaymentRecord → PassbookEntry
                    ↓
            PoojaRegistration (optional link)
```

### 2. Pooja Registration Flow:
```
Donor (User) → PoojaRegistration → PoojaRegistrationMember
        ↓
    PoojaOption
    PoojaDayOption
    PaymentRecord
```

### 3. Recurring Pooja Flow:
```
Donor (User) → RecurringPoojaPlan
                    ↓
            (Monthly/Quarterly/Annually)
                    ↓
            Auto-generate PoojaRegistration
                    ↓
            Auto-generate PaymentRecord
```

### 4. Combined Donor Payment:
```
MainDonor ← CombinePaymentMapping → ParentDonor
    ↓
PaymentRecord calculated at ParentDonor level
```

---

## DJANGO FRAMEWORK TABLES (Auto-Generated)

These tables are automatically created by Django framework for system management:

### accounts_user_groups
**Purpose:** Many-to-many junction table linking users to groups. Manages group membership for each user.

| Column | Description |
|--------|-------------|
| user_id | FK to User |
| group_id | FK to auth_group |

---

### accounts_user_user_permissions
**Purpose:** Many-to-many junction table linking users to permissions. Manages individual permission assignments.

| Column | Description |
|--------|-------------|
| user_id | FK to User |
| permission_id | FK to auth_permission |

---

### auth_group
**Purpose:** Stores permission groups for role-based access control. Allows grouping of users with same permission sets.

| Column | Description |
|--------|-------------|
| id | Primary Key |
| name | Group name (e.g., 'Donors', 'Admins') |

---

### auth_group_permissions
**Purpose:** Many-to-many junction table linking groups to permissions.

| Column | Description |
|--------|-------------|
| group_id | FK to auth_group |
| permission_id | FK to auth_permission |

---

### auth_permission
**Purpose:** Stores all available permissions in the system. Django auto-generates permissions for model operations (add, change, delete, view).

| Column | Description |
|--------|-------------|
| id | Primary Key |
| content_type_id | FK to django_content_type |
| codename | Permission code (e.g., 'add_donorprofile') |
| name | Human-readable permission name |

---

### django_content_type
**Purpose:** Registry of all Django models in the application. Maps model names to their database representations.

| Column | Description |
|--------|-------------|
| id | Primary Key |
| app_label | Application name (e.g., 'accounts', 'payments') |
| model | Model class name (lowercase) |

---

### django_migrations
**Purpose:** Tracks all database migration history. Records which migrations have been applied and when.

| Column | Description |
|--------|-------------|
| id | Primary Key |
| app | App name |
| name | Migration file name |
| applied | Timestamp of migration application |

---

### django_admin_log
**Purpose:** Audit log of all admin panel changes. Tracks who changed what and when.

| Column | Description |
|--------|-------------|
| id | Primary Key |
| user_id | FK to User (admin making change) |
| content_type_id | FK to django_content_type |
| object_id | ID of changed record |
| object_repr | String representation of object |
| action_flag | Action type (1=add, 2=change, 3=delete) |
| change_message | JSON details of changes |
| action_time | Timestamp of change |

---

### django_session
**Purpose:** Stores user session data for maintaining login state. Sessions are cleared after expiration.

| Column | Description |
|--------|-------------|
| session_key | Primary Key (session ID) |
| session_data | Encrypted session data |
| expire_date | When session expires |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total Tables** | 30 |
| **Custom Application Tables** | 21 |
| **Django Framework Tables** | 9 |
| **Authentication Tables** | 5 (custom) |
| **Payment Tables** | 4 (custom) |
| **Pooja Tables** | 12 (custom) |
| **Total Foreign Keys** | 30+ |
| **Composite Indexes** | 6 |
| **Self-Referencing Tables** | 1 (PoojaOption) |
| **M2M Junction Tables** | 4 |

---

## Important Notes

1. **Date Handling**: All dates are stored as DATE fields; timestamps use DATETIME
2. **JSON Fields**: metadata and cart_payload fields support flexible data storage
3. **Soft Deletes**: Not implemented; consider for future audit requirements
4. **Caching Fields**: CombinePaymentMapping stores cached phone/name for audit trail
5. **Auto-Increment IDs**: donor_number and registration_number use custom logic to ensure unique prefixes
6. **Currency**: Primarily INR but supports other currencies via currency field
7. **Timezone**: Uses Django's timezone awareness for all timestamps

---

**End of Database Documentation**
