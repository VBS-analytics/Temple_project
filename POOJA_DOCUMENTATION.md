# Temple Management System - Pooja Module Documentation

## Overview
This document provides comprehensive documentation for the Pooja (Religious Services) module. It covers all tables, relationships, and workflows related to pooja registrations, recurring poojas, and cart management.

**Module Name:** Pooja Management System  
**Generated:** January 22, 2026  
**Related Tables:** 12 core tables

---

## Module Overview

The Pooja module manages:
- **Pooja Catalog** - Available religious services and their pricing
- **Scheduling Options** - Day/date preferences for poojas
- **Registrations** - Donor bookings for specific poojas
- **Recurring Plans** - Automated monthly/quarterly/annual poojas
- **Cart Management** - Shopping cart snapshots and exports
- **Messaging** - Daily messages and announcements

---

# POOJA MODULE TABLES

## Table 1: pooja_poojaoption (PoojaOption)

**Purpose:**  
Master catalog of all available poojas (religious services) that donors can register for. Supports hierarchical organization where poojas can have parent categories and child options. Each option can have minimum, maximum, and default donation amounts.

**Database Table Name:** `pooja_poojaoption`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| code | VARCHAR(16) | UNIQUE, NOT NULL | Unique code for pooja (e.g., ABHISHEKA, HAVAN) |
| name | VARCHAR(255) | NOT NULL | Display name of pooja |
| description | TEXT | NULL | Detailed description of pooja |
| min_amount | DECIMAL(10,2) | NULL | Minimum donation amount |
| max_amount | DECIMAL(10,2) | NULL | Maximum donation amount |
| default_amount | DECIMAL(10,2) | NULL | Suggested/default donation amount |
| is_active | BOOLEAN | DEFAULT=TRUE | Whether pooja is currently offered |
| parent_id | INTEGER | FOREIGN KEY (self), NULL | Parent pooja for hierarchical grouping |
| is_group_header | BOOLEAN | DEFAULT=FALSE | Whether this is a header/category |
| display_order | INTEGER | DEFAULT=0 | Sort order for UI display (indexed) |

**Key Features:**
- ✅ Hierarchical structure (parent-child relationships)
- ✅ Price range enforcement (min, max, default amounts)
- ✅ Category headers via is_group_header flag
- ✅ Database indexed by display_order for efficient sorting
- ✅ Active/inactive status control

**Relationships:**
- Referenced by: PoojaRegistration (1:N), RecurringPoojaPlan (1:N)
- Self-referencing: parent_id allows hierarchical categories

**Example Data:**
```
Parent Categories:
- Abhisheka Group (is_group_header=true)
  - Jalabhisheka (parent_id=1)
  - Chandanabhisheka (parent_id=1)
  
- Havan Services (is_group_header=true)
  - Sundara Havan (parent_id=2)
  - Rudrabhisheka (parent_id=2)
```

**Ordering:** By parent_id, display_order, code

**Indexes:**
- UNIQUE: code
- display_order (for UI sorting)

---

## Table 2: pooja_poojadayoption (PoojaDayOption)

**Purpose:**  
Stores different day options for scheduling poojas. Categories include weekday selections, template codes, and Tamil astrological days. Provides flexibility in when poojas can be scheduled.

**Database Table Name:** `pooja_poojadayoption`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| code | VARCHAR(16) | UNIQUE, NOT NULL | Code for day option (e.g., MONDAY, POURNAMI) |
| description | VARCHAR(255) | NOT NULL | Human-readable description |
| category | VARCHAR(32) | NOT NULL | Category type (weekday/code/tamil_star) |
| display_order | INTEGER | DEFAULT=0 | Sort order for UI display (indexed) |

**Categories:**

1. **weekday** - Standard weekdays
   - MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
   
2. **code** - Template codes for special days
   - POURNAMI (Full Moon)
   - AMAVASYA (New Moon)
   - THAI_PONGAL (Harvest Festival)
   - etc.
   
3. **tamil_star** - Tamil astrological days/nakshatras
   - ASHWINI, BHARANI, KRITTIKA, ROHINI
   - MRIGASHIRA, ARADRA, PUNARVASU, etc.

**Relationships:**
- Referenced by: PoojaRegistration (1:N), RecurringPoojaPlan (1:N), DonorMessageTemplate (1:N)

**Ordering:** By display_order, then by id

**Indexes:**
- UNIQUE: code
- display_order

---

## Table 3: pooja_poojaregistration (PoojaRegistration)

**Purpose:**  
Core table for pooja registrations. Records when a donor registers for a specific pooja with all relevant details including date, quantity, amount, and status tracking. Each registration gets a unique registration number (PR format).

**Database Table Name:** `pooja_poojaregistration`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor registering |
| pooja_option_id | INTEGER | FOREIGN KEY (PoojaOption) | Selected pooja type |
| day_option_id | INTEGER | FOREIGN KEY (PoojaDayOption), NULL | Selected day preference |
| start_date | DATE | NULL | Start date for pooja performance |
| quantity | INTEGER | DEFAULT=1 | Number of repetitions/instances |
| is_group_registration | BOOLEAN | DEFAULT=FALSE | Whether this is for a group |
| post_prasadam | BOOLEAN | DEFAULT=FALSE | Whether prasadam (blessed offering) included |
| additional_notes | TEXT | NULL | Special requests or specific notes |
| total_amount | DECIMAL(10,2) | NULL | Total amount paid for registration |
| status | VARCHAR(16) | NOT NULL, DEFAULT='pending' | Current registration status |
| registration_number | INTEGER | UNIQUE, NULL | Auto-generated sequential ID (PR{number}) |
| created_at | DATETIME | AUTO_NOW_ADD | Registration creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last modification timestamp |

**Registration Statuses:**
- **pending** - Awaiting confirmation from temple
- **confirmed** - Pooja confirmed and scheduled
- **completed** - Pooja has been performed

**Key Features:**
- ✅ Automatic registration_number generation (PR1, PR2, PR3...)
- ✅ Supports both individual and group registrations
- ✅ Optional prasadam tracking
- ✅ Flexible scheduling with day options
- ✅ Links to payment records for billing
- ✅ Notes field for special requirements

**Relationships:**
- Foreign Key: donor (User), pooja_option (PoojaOption), day_option (PoojaDayOption)
- Referenced by: PoojaRegistrationMember (1:N), PaymentRecord (1:N), PassbookEntry (1:N), RecurringPoojaPlan (1:N)

**Example Workflow:**
```
1. Donor selects pooja → creates PoojaRegistration
2. If group → creates PoojaRegistrationMember entries
3. Amount determined from PoojaOption default_amount
4. Status: pending → confirmed → completed
5. Linked to PaymentRecord for billing
```

**Ordering:** By created_at (descending - newest first)

**Indexes:**
- UNIQUE: registration_number

---

## Table 4: pooja_poojaregistrationmember (PoojaRegistrationMember)

**Purpose:**  
Stores individual members included in a group pooja registration. When a donor registers poojas for family members or group participants, this table tracks member-specific details for each registration.

**Database Table Name:** `pooja_poojaregistrationmember`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| registration_id | INTEGER | FOREIGN KEY (PoojaRegistration) | Reference to parent registration |
| name | VARCHAR(255) | NOT NULL | Member's full name |
| phone_number | VARCHAR(15) | NULL | Member's contact phone |
| relationship | VARCHAR(128) | NULL | Relationship to primary donor (spouse/child/parent/etc) |
| date_of_birth | DATE | NULL | Date of birth for personalization |
| family_name | VARCHAR(255) | NULL, DEFAULT='' | Family surname |
| tamil_star | VARCHAR(128) | NULL | Tamil star/nakshatra for astrological matching |
| gothra | VARCHAR(128) | NULL | Gothra (ancestral lineage) for rituals |
| rasi | VARCHAR(128) | NULL, DEFAULT='' | Zodiac sign/rasi for matching |

**Key Features:**
- ✅ Supports multiple members per registration
- ✅ Captures astrological details (star, gothra, rasi)
- ✅ Relationship tracking for personalized service
- ✅ Stores family name for ceremonial purposes

**Relationships:**
- Foreign Key: registration (PoojaRegistration)

**Use Cases:**
- Family pooja for multiple family members
- Group ceremonies with specific requirements
- Personalized service based on astrological details

**Ordering:** By registration, then by name

---

## Table 5: pooja_recurringpoojaplan (RecurringPoojaPlan)

**Purpose:**  
Manages recurring pooja registrations with flexible scheduling. Supports monthly, quarterly, and annual recurrences, as well as one-time extra poojas. Tracks recurrence status, pause periods, and next occurrence dates.

**Database Table Name:** `pooja_recurringpoojaplan`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor |
| pooja_option_id | INTEGER | FOREIGN KEY (PoojaOption) | Selected pooja type |
| day_option_id | INTEGER | FOREIGN KEY (PoojaDayOption), NULL | Day preference |
| recurrence_kind | VARCHAR(32) | DEFAULT='recurring' | Kind: recurring or one_time_extra |
| recurrence_frequency | VARCHAR(32) | DEFAULT='monthly' | Frequency: monthly/quarterly/annually |
| start_date | DATE | NULL | When recurrence begins |
| next_occurrence | DATE | NULL | Next scheduled date |
| last_occurrence | DATE | NULL | Last performed date |
| one_time_date | DATE | NULL | Date for one-time extra poojas |
| amount | DECIMAL(10,2) | NULL | Amount per occurrence |
| is_active | BOOLEAN | DEFAULT=TRUE | Whether plan is currently active |
| pause_from | DATE | NULL | Start date of pause period |
| pause_until | DATE | NULL | End date of pause period |
| origin_registration_id | INTEGER | FOREIGN KEY (PoojaRegistration), NULL | Original registration creating this plan |
| metadata | JSON | DEFAULT={} | Additional flexible data (extensible) |
| cart_payload | JSON | DEFAULT={} | Cart-related payload data |
| created_at | DATETIME | AUTO_NOW_ADD | Plan creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last modification timestamp |

**Recurrence Types:**
1. **Recurring** - Ongoing poojas at set frequency (default)
2. **One-time Extra** - Single additional pooja instance

**Recurrence Frequencies:**
- **Monthly** - Performed every month
- **Quarterly** - Performed every 3 months (Jan, Apr, Jul, Oct)
- **Annually** - Performed once per year

**Key Features:**
- ✅ Pause/Resume functionality for temporary stops
- ✅ Tracks both next and last occurrence dates
- ✅ Supports one-time extras alongside recurring
- ✅ Flexible metadata for extensibility
- ✅ JSON cart payload for shopping integration

**Example Scenarios:**

```
Scenario 1: Monthly recurring pooja
- start_date: 2026-01-15
- recurrence_kind: recurring
- recurrence_frequency: monthly
- next_occurrence: 2026-02-15
- is_active: true

Scenario 2: Paused recurring pooja
- start_date: 2026-01-01
- pause_from: 2026-05-01
- pause_until: 2026-06-30
- next_occurrence: 2026-07-01

Scenario 3: One-time extra pooja
- recurrence_kind: one_time_extra
- one_time_date: 2026-02-14
- (Creates single PoojaRegistration)
```

**Automation Workflow:**
```
1. Recurring plan created → sets next_occurrence
2. Scheduler runs periodically (daily/weekly)
3. When next_occurrence <= today:
   a. Create PoojaRegistration
   b. Create PaymentRecord (if auto-pay enabled)
   c. Update last_occurrence, next_occurrence
   d. Send notification to donor
```

**Ordering:** By created_at desc, then by id

**Constraints:**
- UNIQUE: (donor, pooja_option, day_option, recurrence_kind) when kind='recurring'
- UNIQUE: (donor, pooja_option, day_option, one_time_date) when kind='one_time_extra'

---

## Table 6: pooja_donormessagetemplate (DonorMessageTemplate)

**Purpose:**  
Stores customized message templates for individual donors. Allows donors to set preferred dates, day options, and personalized text for their daily reminders about poojas and donations.

**Database Table Name:** `pooja_donormessagetemplate`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User) | Reference to donor |
| preferred_date | DATE | NULL | Preferred date for messages |
| day_option_id | INTEGER | FOREIGN KEY (PoojaDayOption), NULL | Selected day option |
| summary_text | TEXT | NOT NULL | Summary/main message text |
| tamil_text | TEXT | NULL | Message in Tamil script |
| gothra_details | VARCHAR(255) | NULL | Gothra-specific personalization |

**Key Features:**
- ✅ Multi-language support (English & Tamil)
- ✅ Personalization by gothra
- ✅ Flexible messaging for each donor
- ✅ Links to day options for scheduled messages

**Ordering:** By donor, then by preferred_date

---

## Table 7: pooja_dailymessage (DailyMessage)

**Purpose:**  
Stores daily messages and announcements that appear on the temple management dashboard. Contains header and footer text for each labeled message.

**Database Table Name:** `pooja_dailymessage`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| label | VARCHAR(64) | UNIQUE, NOT NULL | Unique label for message (e.g., DAILY_GREETING) |
| header_text | TEXT | NOT NULL | Header/title text |
| footer_text | TEXT | NULL | Footer/closing text |

**Key Features:**
- ✅ Unique labels for identification
- ✅ Flexible text formatting
- ✅ Dashboard integration

**Ordering:** By label

---

## Table 8: pooja_specialannouncement (SpecialAnnouncement)

**Purpose:**  
Manages special announcements and notifications for specific events or important temple information. Time-sensitive content that can be displayed to donors.

**Database Table Name:** `pooja_specialannouncement`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| label | VARCHAR(64) | NOT NULL | Title/label of announcement |
| description | TEXT | NOT NULL | Full announcement text |
| created_at | DATETIME | AUTO_NOW_ADD | When announcement was created |

**Key Features:**
- ✅ Event-based announcements
- ✅ Time-sensitive content
- ✅ Chronological ordering

**Example Announcements:**
- Festival closures
- Special pooja offerings
- Maintenance schedules
- Important notices

**Ordering:** By created_at, then by id

---

## Table 9: pooja_featuredpooja (FeaturedPooja)

**Purpose:**  
Lightweight content blocks for the landing page pooja showcase section. Displays featured poojas with images and amounts to promote popular or seasonal services.

**Database Table Name:** `pooja_featuredpooja`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Name of featured pooja |
| image | IMAGE | NOT NULL | Uploaded image file path |
| amount | DECIMAL(10,2) | NULL | Suggested donation amount |
| is_active | BOOLEAN | DEFAULT=TRUE | Whether currently featured |
| created_at | DATETIME | AUTO_NOW_ADD | Creation timestamp |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Key Features:**
- ✅ Landing page showcase
- ✅ Image support with upload storage
- ✅ Active/inactive control for seasonal poojas
- ✅ Price suggestion display

**Ordering:** By created_at desc, then by id

---

## Table 10: pooja_poojacartsnapshot (PoojaCartSnapshot)

**Purpose:**  
Stores the current shopping cart state for each donor. Captures donor's selected poojas and quantities for processing payments and registrations.

**Database Table Name:** `pooja_poojacartsnapshot`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| donor_id | INTEGER | FOREIGN KEY (User), UNIQUE | Reference to donor (one-to-one) |
| items | JSON | DEFAULT=[] | List of cart items (JSON array) |
| updated_at | DATETIME | AUTO_NOW | Last update timestamp |

**Cart Item Structure (JSON):**
```json
{
  "items": [
    {
      "pooja_id": 1,
      "pooja_name": "Jalabhisheka",
      "quantity": 2,
      "unit_price": 500.00,
      "total_price": 1000.00,
      "day_option_id": 5,
      "notes": "Special request"
    }
  ]
}
```

**Key Features:**
- ✅ One cart per donor (OneToOne relationship)
- ✅ JSON format for flexible item storage
- ✅ Real-time cart updates
- ✅ Maintains current shopping state

**Ordering:** By updated_at desc

**Indexes:**
- UNIQUE: donor_id

---

## Table 11: pooja_poojacartsnapshotexportbatch (PoojaCartSnapshotExportBatch)

**Purpose:**  
Manages batch exports of donor cart snapshots. Tracks who initiated exports and when they occurred for audit purposes and data synchronization.

**Database Table Name:** `pooja_poojacartsnapshotexportbatch`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| created_by_id | INTEGER | FOREIGN KEY (User), NULL | Admin who initiated export |
| created_at | DATETIME | AUTO_NOW_ADD | Export timestamp |

**Key Features:**
- ✅ Audit trail of exports
- ✅ User tracking for accountability
- ✅ Chronological record

**Ordering:** By created_at desc

---

## Table 12: pooja_poojacartsnapshotexportentry (PoojaCartSnapshotExportEntry)

**Purpose:**  
Individual entries within a cart snapshot export batch. Each entry represents one donor's cart state at the time of export.

**Database Table Name:** `pooja_poojacartsnapshotexportentry`

**Table Structure:**

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique identifier |
| batch_id | INTEGER | FOREIGN KEY (PoojaCartSnapshotExportBatch) | Reference to parent batch |
| donor_id | INTEGER | NULL | Donor's ID (cached for archive) |
| donor_name | VARCHAR(255) | NULL | Donor's name (cached snapshot) |
| donor_phone | VARCHAR(32) | NULL | Donor's phone (cached snapshot) |
| items | JSON | DEFAULT=[] | Cart items at time of export |

**Key Features:**
- ✅ Historical archive of carts
- ✅ Cached donor info for audit trail
- ✅ Item snapshots for analysis

---

# POOJA WORKFLOWS

## Workflow 1: Simple Pooja Registration

```
1. Donor selects pooja from PoojaOption catalog
2. Chooses day_option (optional)
3. Enters quantity and notes
4. System creates PoojaRegistration
   - status = 'pending'
   - registration_number auto-generated (PR123)
   - total_amount = quantity * pooja_option.default_amount
5. Creates PaymentRecord linked to registration
6. Status progression:
   pending → confirmed (temple confirms) → completed (after performance)
```

## Workflow 2: Group Pooja Registration

```
1. Donor registers for group pooja
   - is_group_registration = true
   - quantity = number of family members
2. For each member:
   - Create PoojaRegistrationMember entry
   - Include astrological details (gothra, rasi, tamil_star)
3. System calculates total_amount based on quantity
4. Payment processed and linked
5. All members included in single registration record
```

## Workflow 3: Recurring Pooja Setup

```
1. Donor selects pooja and frequency (monthly/quarterly/annual)
2. System creates RecurringPoojaPlan
   - start_date = chosen date
   - next_occurrence = calculated from frequency
   - is_active = true
3. Automated scheduler:
   - Checks daily for next_occurrence <= today
   - Creates PoojaRegistration when due
   - Creates PaymentRecord if auto-pay enabled
   - Updates next_occurrence for next cycle
4. Donor can:
   - Pause (set pause_from and pause_until)
   - Resume (clear pause dates)
   - Add one-time extras
```

## Workflow 4: Cart Management

```
1. Donor adds poojas to cart
   - Updates PoojaCartSnapshot.items (JSON)
2. Reviews and modifies cart
3. Checkout process:
   - Reads items from PoojaCartSnapshot
   - Creates PoojaRegistration for each item
   - Calculates total_amount across all items
   - Creates PaymentRecord
   - Clears cart (empty items array)
4. Export/Archive:
   - Admin initiates export
   - Creates PoojaCartSnapshotExportBatch
   - Snapshots all donor carts in PoojaCartSnapshotExportEntry
   - Useful for data analysis and backup
```

---

# DATA RELATIONSHIPS

```
PoojaOption (Catalog)
    ├── Self-referencing: parent_id (hierarchical categories)
    └── Referenced by:
        ├── PoojaRegistration (1:N)
        └── RecurringPoojaPlan (1:N)

PoojaDayOption (Day Selection)
    └── Referenced by:
        ├── PoojaRegistration (1:N)
        ├── RecurringPoojaPlan (1:N)
        └── DonorMessageTemplate (1:N)

PoojaRegistration (Booking)
    ├── Foreign Keys to: User, PoojaOption, PoojaDayOption
    └── Referenced by:
        ├── PoojaRegistrationMember (1:N)
        ├── PaymentRecord (1:N)
        ├── PassbookEntry (1:N)
        └── RecurringPoojaPlan (1:N as origin)

PoojaRegistrationMember (Group Members)
    └── Foreign Key to: PoojaRegistration

RecurringPoojaPlan (Automation)
    ├── Foreign Keys to: User, PoojaOption, PoojaDayOption
    └── References: origin_registration (PoojaRegistration)

DonorMessageTemplate (Personalization)
    ├── Foreign Keys to: User, PoojaDayOption
    └── For: Daily reminders and personalized messages

FeaturedPooja (Marketing)
    └── Landing page showcase

PoojaCartSnapshot (Shopping)
    ├── OneToOne with User
    └── JSON items for flexible storage

Export Tables (Audit)
    ├── PoojaCartSnapshotExportBatch
    └── PoojaCartSnapshotExportEntry (1:N)
```

---

# KEY INDEXES FOR PERFORMANCE

| Table | Indexed Columns | Type | Purpose |
|-------|-----------------|------|---------|
| PoojaOption | code | UNIQUE | Fast pooja lookup |
| PoojaOption | display_order | Simple | UI sorting |
| PoojaDayOption | code | UNIQUE | Fast day option lookup |
| PoojaDayOption | display_order | Simple | UI sorting |
| PoojaRegistration | registration_number | UNIQUE | Unique ID generation |
| PoojaCartSnapshot | donor_id | UNIQUE | OneToOne relationship |

---

# IMPORTANT NOTES

1. **Auto-ID Generation**: registration_number uses custom logic to ensure unique PR{number} format
2. **JSON Storage**: items field in cart allows flexible item structure
3. **Astrological Details**: tamil_star, gothra, rasi used for personalized service
4. **Time-based Activation**: RecurringPoojaPlan uses pause dates for flexible scheduling
5. **Multi-language**: DonorMessageTemplate supports Tamil and English
6. **Audit Trail**: Export tables maintain historical snapshots of cart states

---

# DEEP DIVE: THE THREE CRITICAL TABLES

## Overview
Tables 3, 4, and 5 form the **backbone of the entire Pooja module**. These three tables handle:
- **Table 3**: Core pooja bookings and registrations
- **Table 4**: Family/group member details for registrations
- **Table 5**: Automated recurring pooja scheduling

Together, they enable all pooja functionality from one-time bookings to subscription-based recurring poojas.

---

## CRITICAL TABLE 1: pooja_poojaregistration (PoojaRegistration)

### Complete Attribute Reference

| Attribute | Type | Constraints | Purpose | Example |
|-----------|------|-------------|---------|---------|
| **id** | INTEGER | PK, AUTO INCREMENT | Unique identifier | 1, 2, 3... |
| **donor_id** | INTEGER | FK (User), NOT NULL | Which donor is registering | 5 |
| **pooja_option_id** | INTEGER | FK (PoojaOption), NOT NULL | Which pooja service selected | 12 (Abhisheka) |
| **day_option_id** | INTEGER | FK (PoojaDayOption), NULL | Optional day preference | 3 (MONDAY) or NULL |
| **start_date** | DATE | NULL | When pooja should be performed | 2026-02-15 |
| **quantity** | INTEGER | DEFAULT=1 | Number of repetitions/people | 1, 2, 5... |
| **is_group_registration** | BOOLEAN | DEFAULT=FALSE | Is this for multiple people? | false, true |
| **post_prasadam** | BOOLEAN | DEFAULT=FALSE | Include blessed offering? | false, true |
| **additional_notes** | TEXT | NULL | Special requests | "Early morning preferred" |
| **total_amount** | DECIMAL(10,2) | NULL | Total cost calculated | 1000.00, 5000.00 |
| **status** | VARCHAR(16) | DEFAULT='pending' | Current registration state | "pending", "confirmed", "completed" |
| **registration_number** | INTEGER | UNIQUE, NULL | Auto-generated PR ID | 101, 102... (PR101) |
| **created_at** | DATETIME | AUTO_NOW_ADD | When registered | 2026-01-22 10:30:45 |
| **updated_at** | DATETIME | AUTO_NOW | Last modified | 2026-01-22 15:45:30 |

### Key Functionality

**1. Booking Entry Point**
```
Every pooja booking starts here
Donor selects:
  - Pooja type (pooja_option_id)
  - Preferred day (day_option_id)
  - Number of instances (quantity)
  - Special requests (additional_notes)
→ System creates PoojaRegistration record
```

**2. Automatic ID Generation**
```
registration_number auto-generates unique sequential ID:
- Registration 1 → PR1
- Registration 2 → PR2
- Registration 101 → PR101

Format: PR{sequential_number}
Used in receipts, passbooks, and correspondence
```

**3. Amount Calculation**
```
Formula: total_amount = quantity × pooja_option.default_amount

Example 1 (Individual):
- Pooja: Abhisheka (default_amount = 500)
- Quantity: 1
- total_amount = 1 × 500 = 500

Example 2 (Group):
- Pooja: Abhisheka (default_amount = 500)
- Quantity: 5 (5 family members)
- total_amount = 5 × 500 = 2500
```

**4. Status Lifecycle**
```
Status progression for every registration:

pending (initial state)
   ↓
   [Temple reviews & confirms]
   ↓
confirmed (pooja scheduled)
   ↓
   [Pooja ceremony performed]
   ↓
completed (final state)

Alternative: pending → failed/cancelled
```

**5. Group Registration Flag**
```
When is_group_registration = true:
- Multiple PoojaRegistrationMember entries created
- Each member has own astrological details
- Single total_amount for entire group
- All members included in one ceremony

When is_group_registration = false:
- Single individual booking
- No member records needed
- Direct donor performs pooja
```

**6. Links to Payment System**
```
Every PoojaRegistration links to:

PaymentRecord (1:N relationship)
- Can have multiple payments for same registration
- Tracks: amount, mode, status, transaction_ref

PassbookEntry (1:N relationship)
- Creates "due" entry when registered
- Creates "paid" entry when payment received
- Shows in donor's financial statement
```

**7. Optional Day Preference**
```
day_option_id can be NULL or selected:

NULL → Temple chooses auspicious day
Value → Specific day preferred:
  - 1 = MONDAY
  - 2 = TUESDAY
  - 5 = POURNAMI (Full Moon)
  - 10 = ASHWINI (Nakshatra)
```

### Real-World Scenarios

**Scenario 1: Individual Pooja**
```sql
INSERT INTO pooja_poojaregistration (
  donor_id: 5,
  pooja_option_id: 12,      -- Abhisheka
  day_option_id: 3,          -- Monday
  start_date: '2026-02-15',
  quantity: 1,
  is_group_registration: false,
  post_prasadam: true,
  additional_notes: 'For health recovery',
  total_amount: 500.00,
  status: 'pending'
)
RESULT: PR501 (auto-generated registration number)
```

**Scenario 2: Family Group Pooja**
```sql
INSERT INTO pooja_poojaregistration (
  donor_id: 5,
  pooja_option_id: 12,       -- Abhisheka
  day_option_id: NULL,        -- Temple chooses
  quantity: 4,               -- 4 family members
  is_group_registration: true,
  post_prasadam: true,
  total_amount: 2000.00,     -- 4 × 500
  status: 'pending'
)
RESULT: PR502
→ Then creates 4 PoojaRegistrationMember entries
```

---

## CRITICAL TABLE 2: pooja_poojaregistrationmember (PoojaRegistrationMember)

### Complete Attribute Reference

| Attribute | Type | Constraints | Purpose | Example |
|-----------|------|-------------|---------|---------|
| **id** | INTEGER | PK, AUTO INCREMENT | Unique member record | 1, 2, 3... |
| **registration_id** | INTEGER | FK (PoojaRegistration), NOT NULL | Parent registration | 502 |
| **name** | VARCHAR(255) | NOT NULL | Member's full name | "Rajesh Kumar" |
| **phone_number** | VARCHAR(15) | NULL | Contact number | "9876543210" |
| **relationship** | VARCHAR(128) | NULL | Relation to donor | "spouse", "child", "parent" |
| **date_of_birth** | DATE | NULL | Birth date for personalization | "1985-06-15" |
| **family_name** | VARCHAR(255) | DEFAULT='' | Family surname | "Kumar" |
| **tamil_star** | VARCHAR(128) | NULL | Nakshatra/birth star | "ASHWINI", "BHARANI" |
| **gothra** | VARCHAR(128) | NULL | Ancestral lineage | "Vasishta", "Atri" |
| **rasi** | VARCHAR(128) | DEFAULT='' | Zodiac sign | "Aries", "Taurus" |

### Key Functionality

**1. Group Member Storage**
```
One PoojaRegistration → Multiple Members (1:N)

Example: Family of 4 registers for pooja
- PoojaRegistration: PR502 (single record)
  - quantity: 4
  - total_amount: 2000.00
  
- PoojaRegistrationMember: 4 records
  Member 1: Rajesh Kumar (father) - Ashwini - Vasishta
  Member 2: Divya Kumar (mother) - Bharani - Atri
  Member 3: Arjun Kumar (son) - Krittika - Vasishta
  Member 4: Pooja Kumar (daughter) - Rohini - Atri
```

**2. Astrological Personalization**
```
Each member's astrological details captured:

tamil_star (Nakshatra):
- Determines which day pooja should be performed
- Used for personalized rituals
- Examples: ASHWINI, BHARANI, KRITTIKA, ROHINI

gothra (Ancestral lineage):
- Important for Hindu ceremonies
- Determines ritual specifics
- Examples: Vasishta, Atri, Kashyapa, Agastya

rasi (Zodiac):
- Secondary astrological info
- Used for additional personalization
```

**3. Relationship Tracking**
```
Relationship field captures:
- spouse: For marital ceremonies
- child: For children's ceremonies
- parent: For parent-related poojas
- sibling: For family ceremonies
- grandchild: Multi-generational support

Enables temple to:
- Personalize service
- Suggest appropriate poojas
- Send targeted messages
```

**4. Contact Information**
```
Phone number stored for:
- Sending individual SMS/notifications
- Contacting member directly
- Emergency contact purposes
- Alternate communication channel
```

**5. Birth Details**
```
date_of_birth used for:
- Age calculation for specific poojas
- Upcoming birthday reminders
- Personalized messages
- Astrological calculations
```

### Real-World Scenarios

**Scenario: Creating Members for Family Pooja**
```sql
-- First, create the registration (PR502)
PoojaRegistration: {
  quantity: 4,
  is_group_registration: true,
  total_amount: 2000.00
}

-- Then create member records
INSERT INTO pooja_poojaregistrationmember VALUES:

Member 1:
  registration_id: 502,
  name: 'Rajesh Kumar',
  phone_number: '9876543210',
  relationship: 'father',
  date_of_birth: '1960-03-20',
  tamil_star: 'ASHWINI',
  gothra: 'Vasishta',
  rasi: 'Aries'

Member 2:
  registration_id: 502,
  name: 'Divya Kumar',
  phone_number: '9876543211',
  relationship: 'mother',
  date_of_birth: '1962-07-15',
  tamil_star: 'BHARANI',
  gothra: 'Atri',
  rasi: 'Cancer'

Member 3:
  registration_id: 502,
  name: 'Arjun Kumar',
  phone_number: '9876543212',
  relationship: 'son',
  date_of_birth: '1988-11-10',
  tamil_star: 'KRITTIKA',
  gothra: 'Vasishta',
  rasi: 'Scorpio'

Member 4:
  registration_id: 502,
  name: 'Pooja Kumar',
  phone_number: '9876543213',
  relationship: 'daughter',
  date_of_birth: '1990-05-22',
  tamil_star: 'ROHINI',
  gothra: 'Vasishta',
  rasi: 'Gemini'
```

---

## CRITICAL TABLE 3: pooja_recurringpoojaplan (RecurringPoojaPlan)

### Complete Attribute Reference

| Attribute | Type | Constraints | Purpose | Example |
|-----------|------|-------------|---------|---------|
| **id** | INTEGER | PK, AUTO INCREMENT | Unique plan ID | 1, 2, 3... |
| **donor_id** | INTEGER | FK (User), NOT NULL | Donor with recurring plan | 5 |
| **pooja_option_id** | INTEGER | FK (PoojaOption), NOT NULL | Which pooja recurs | 12 (Abhisheka) |
| **day_option_id** | INTEGER | FK (PoojaDayOption), NULL | Preferred day (if any) | 3, NULL |
| **recurrence_kind** | VARCHAR(32) | DEFAULT='recurring' | Type of recurrence | "recurring", "one_time_extra" |
| **recurrence_frequency** | VARCHAR(32) | DEFAULT='monthly' | How often it repeats | "monthly", "quarterly", "annually" |
| **start_date** | DATE | NULL | When recurrence starts | '2026-01-15' |
| **next_occurrence** | DATE | NULL | Next scheduled date | '2026-02-15' |
| **last_occurrence** | DATE | NULL | Last performed date | '2026-01-15' |
| **one_time_date** | DATE | NULL | For one-time extras | '2026-03-10' |
| **amount** | DECIMAL(10,2) | NULL | Cost per occurrence | 500.00 |
| **is_active** | BOOLEAN | DEFAULT=TRUE | Is plan currently active? | true, false |
| **pause_from** | DATE | NULL | Pause start date | '2026-05-01' |
| **pause_until** | DATE | NULL | Pause end date | '2026-06-30' |
| **origin_registration_id** | INTEGER | FK (PoojaRegistration), NULL | Original registration creating plan | 500, NULL |
| **metadata** | JSON | DEFAULT={} | Flexible additional data | {"notes": "..."} |
| **cart_payload** | JSON | DEFAULT={} | Shopping cart data | {...} |
| **created_at** | DATETIME | AUTO_NOW_ADD | Plan creation timestamp | '2026-01-22 10:30:45' |
| **updated_at** | DATETIME | AUTO_NOW | Last modification | '2026-01-22 15:45:30' |

### Key Functionality

**1. Subscription Management**
```
RecurringPoojaPlan enables recurring revenue model:

Monthly Plan:
- start_date: 2026-01-15
- recurrence_frequency: monthly
- amount: 500
- is_active: true

System automatically:
- On 2026-02-15: Creates PoojaRegistration
- On 2026-03-15: Creates PoojaRegistration
- On 2026-04-15: Creates PoojaRegistration
- ... continues until paused or deactivated
```

**2. Recurrence Frequencies**
```
Three frequency options:

MONTHLY (every month):
- start_date: 2026-01-15
- next_occurrence: 2026-02-15 (+ 1 month)
- then: 2026-03-15, 2026-04-15...

QUARTERLY (every 3 months):
- start_date: 2026-01-15
- next_occurrence: 2026-04-15 (+ 3 months)
- then: 2026-07-15, 2026-10-15...

ANNUALLY (once per year):
- start_date: 2026-01-15
- next_occurrence: 2027-01-15 (+ 1 year)
- then: 2028-01-15, 2029-01-15...
```

**3. Pause/Resume Functionality**
```
Temporarily stop without canceling:

Normal active state:
- is_active: true
- pause_from: NULL
- pause_until: NULL
- next_occurrence: calculated

Paused state:
- is_active: true
- pause_from: '2026-05-01'
- pause_until: '2026-06-30'
- next_occurrence: > pause_until date

Automated logic:
- If today is between pause_from and pause_until:
  → Skip creating PoojaRegistration
- When pause_until date passes:
  → Resume automatically
  → Set next_occurrence after pause_until
```

**4. Recurrence Types**
```
Two types of recurrences:

RECURRING (default):
- Ongoing poojas at set frequency
- recurrence_kind: 'recurring'
- next_occurrence continuously updated
- quantity: 1 per recurrence
- Unique constraint: (donor, pooja, day, kind)

ONE_TIME_EXTRA:
- Single additional pooja instance
- recurrence_kind: 'one_time_extra'
- one_time_date: specific date
- Creates single PoojaRegistration
- Does not repeat
- Unique constraint: (donor, pooja, day, one_time_date)
```

**5. Automated Scheduler Workflow**
```
System scheduler runs periodically (daily/weekly):

1. Query all RecurringPoojaPlan where:
   - is_active = true
   - next_occurrence <= TODAY
   - NOT in pause period

2. For each matching plan:
   a. Create PoojaRegistration:
      - donor_id from plan
      - pooja_option_id from plan
      - day_option_id from plan
      - status: 'pending'
      - total_amount: plan.amount
   
   b. Create PaymentRecord (if auto-pay enabled):
      - donor_id from plan
      - registration_id from created registration
      - amount: plan.amount
      - status: 'pending' or 'success'
   
   c. Update RecurringPoojaPlan:
      - last_occurrence = today
      - next_occurrence = calculate next date
   
   d. Send notification to donor:
      - "Your monthly Abhisheka has been scheduled"
      - Include: date, amount, PR number

3. Repeat daily/weekly automatically
```

**6. Linking to Original Registration**
```
origin_registration_id (optional):
- Tracks which initial registration started the plan
- Provides audit trail
- Used for historical reference

Example:
- Donor makes one-time Abhisheka (PR500)
- Decides to convert to monthly recurring
- New RecurringPoojaPlan created
- origin_registration_id = 500
- Subsequent registrations: PR501, PR502, PR503...
```

**7. JSON Flexibility**
```
metadata field (JSON):
- Stores flexible additional data
- Not predefined schema
- Examples:
  {
    "temple_notes": "Early morning preferred",
    "special_prayers": ["Health", "Prosperity"],
    "custom_flag": "VIP"
  }

cart_payload field (JSON):
- Shopping cart integration data
- Stores item details
- Examples:
  {
    "items": [...],
    "total": 5000,
    "last_modified": "2026-01-22"
  }
```

### Real-World Scenarios

**Scenario 1: Monthly Recurring Pooja**
```sql
INSERT INTO pooja_recurringpoojaplan VALUES:
  donor_id: 5,
  pooja_option_id: 12,           -- Abhisheka
  day_option_id: 3,              -- Monday preferred
  recurrence_kind: 'recurring',
  recurrence_frequency: 'monthly',
  start_date: '2026-01-15',
  next_occurrence: '2026-02-15',
  amount: 500.00,
  is_active: true,
  pause_from: NULL,
  pause_until: NULL

Automation:
2026-02-15 → Create PR501, PaymentRecord
2026-03-15 → Create PR502, PaymentRecord
2026-04-15 → Create PR503, PaymentRecord
... continues indefinitely
```

**Scenario 2: Quarterly Recurring with Pause**
```sql
INSERT INTO pooja_recurringpoojaplan VALUES:
  donor_id: 7,
  pooja_option_id: 15,           -- Rudrabhisheka
  day_option_id: NULL,
  recurrence_kind: 'recurring',
  recurrence_frequency: 'quarterly',
  start_date: '2026-01-01',
  next_occurrence: '2026-04-01',
  amount: 1500.00,
  is_active: true,
  pause_from: '2026-05-01',
  pause_until: '2026-08-31'

Automation:
2026-04-01 → Create PR504, PaymentRecord
2026-05-01 to 2026-08-31 → PAUSED, no registrations created
2026-09-01 → Resume, Create PR505, PaymentRecord
2026-12-01 → Create PR506, PaymentRecord
... continues with pause logic
```

**Scenario 3: One-Time Extra Pooja**
```sql
INSERT INTO pooja_recurringpoojaplan VALUES:
  donor_id: 5,
  pooja_option_id: 12,           -- Abhisheka
  recurrence_kind: 'one_time_extra',
  one_time_date: '2026-03-10',
  amount: 500.00,
  is_active: true

Automation:
On 2026-03-10 → Create PR507 (single registration)
                No further registrations for this plan
                Plan completes
```

---

## Integration Between The Three Tables

### Complete Flow Diagram

```
User Interface
     ↓
1. Donor selects pooja
     ↓
   PoojaRegistration created
     ├─ Auto-generates PR ID
     ├─ Calculates total_amount
     └─ Sets status = 'pending'
     ↓
2. Is it a group pooja?
     ├─ YES → Create PoojaRegistrationMember entries
     │         (one for each family member)
     └─ NO → Skip member creation
     ↓
3. Donor wants it recurring?
     ├─ YES → Create RecurringPoojaPlan
     │         ├─ Set frequency (monthly/quarterly/annual)
     │         ├─ Calculate next_occurrence
     │         └─ Scheduler auto-creates future registrations
     └─ NO → One-time registration only
     ↓
4. Link to payment system
     ├─ Create PaymentRecord
     ├─ Create PassbookEntry (due)
     └─ Notify donor
     ↓
Temple processes → Status: pending → confirmed → completed
```

### Data Relationships

```
PoojaRegistration (Core)
    ├── Links to: User (donor), PoojaOption, PoojaDayOption
    ├── Can have: Many PoojaRegistrationMembers (if group=true)
    ├── Can have: Multiple PaymentRecords
    └── Can be: Origin of RecurringPoojaPlan
    
PoojaRegistrationMember (Members)
    └── Belongs to: Single PoojaRegistration
    
RecurringPoojaPlan (Automation)
    ├── References: Same donor, pooja_option, day_option as registrations
    ├── Creates: Many PoojaRegistrations over time
    └── References (optional): origin_registration (initial booking)
```

### Unique Constraints (Prevent Duplicates)

```
PoojaRegistration:
- No specific unique constraint
- Multiple registrations allowed for same donor/pooja

RecurringPoojaPlan:
- UNIQUE(donor, pooja_option, day_option, recurrence_kind)
  when recurrence_kind = 'recurring'
  → Prevents duplicate monthly/quarterly/annual plans
  
- UNIQUE(donor, pooja_option, day_option, one_time_date)
  when recurrence_kind = 'one_time_extra'
  → Prevents duplicate one-time extras for same date
```

---

## Summary Table: Features by Table

| Feature | Table 3 (Registration) | Table 4 (Member) | Table 5 (Recurring) |
|---------|----------------------|------------------|-------------------|
| Booking entry point | ✅ | - | - |
| Generate registration ID | ✅ | - | - |
| Track individual bookings | ✅ | - | - |
| Support group poojas | ✅ (via flag) | ✅ (stores members) | - |
| Calculate total amount | ✅ | - | - |
| Store astrological details | - | ✅ (per member) | - |
| Enable recurring revenue | - | - | ✅ |
| Auto-generate future bookings | - | - | ✅ |
| Pause/resume functionality | - | - | ✅ |
| Link to payments | ✅ | - | - |
| Create financial statements | ✅ | - | - |

---


Relationship Flow (Why They Work Together):

Donor wants to register for a Pooja
         ↓
    PoojaRegistration created
         ↓
    Is it a group registration?
    ├─ YES → Create PoojaRegistrationMember entries for each person
    └─ NO → Single person registration
         ↓
    Is it recurring?
    ├─ YES → Create RecurringPoojaPlan
    │         (Auto-generates PoojaRegistration monthly/quarterly/yearly)
    └─ NO → One-time registration only
         ↓
    Create PaymentRecord (linked to PoojaRegistration)
    ↓
    Create PassbookEntry (financial statement)


**End of Pooja Module Documentation**



