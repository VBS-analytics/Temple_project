# Visual Bug Flow Diagram

## The Complete Bug Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JANUARY 2026                                │
│          Donor Registers 5 Recurring Poojas (₹100 each)             │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
                    BACKEND RESPONSE:
                    ✅ Creates 5 PoojaRegistration objects
                       - PR#1: Abhisheka, ₹100
                       - PR#2: Archana, ₹100
                       - PR#3: Naivedyam, ₹100
                       - PR#4: Pooja, ₹100
                       - PR#5: Arati, ₹100
                       
                    ✅ Creates 5 RecurringPoojaPlan objects
                       - Plan#1: recurrence_kind='recurring'
                         origin_registration_id=1
                         next_occurrence='2026-02-01'
                       - Plan#2-5: Similar
                       
                    ✅ Links: PR#1→Plan#1, PR#2→Plan#2, etc.
                               ↓
                    FRONTEND RESULT:
                    ✅ Recurring Plans Tab: Shows 5 plans, ₹500
                    ✅ One-time Registrations Tab: Shows 0, ₹0
                    ✅ TOTAL SHOWN: ₹500 ✅ CORRECT
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       FEBRUARY 1, 2026                              │
│    Donor loads DonorProfile (calls GET /api/pooja/registrations/)   │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
                    API ENDPOINT EXECUTION:
                    ❌ Triggers: process_recurring_plans()
                    
                    For Plan#1 (recurrence_kind='recurring', is_active=True):
                    ❌ Calls: prepare_recurring_registration(plan#1)
                       └─ Calls: create_registration_from_plan(plan#1)
                          └─ Creates: NEW PoojaRegistration #6
                             ├─ donor_id: same
                             ├─ pooja_option_id: same
                             ├─ start_date: '2026-02-01'  ← NEXT MONTH
                             ├─ total_amount: ₹100
                             ├─ ❌ NO recurrence_kind field (doesn't exist!)
                             ├─ ❌ NO origin_registration_id (not linked!)
                             └─ ❌ NO cart_item metadata
                    
                    Repeats for Plan#2-5:
                    ❌ Creates: PR#7, PR#8, PR#9, PR#10
                       (All without recurrence metadata!)
                    
                    Updates: Plan#1-5 to point to PR#6-10 as next_occurrence
                               ↓
                    API RESPONSE:
                    Returns:
                    {
                      registrations: [
                        { id:1, total_amount:100, start_date:'2026-01-01' },
                        { id:2, total_amount:100, start_date:'2026-01-01' },
                        { id:3, total_amount:100, start_date:'2026-01-01' },
                        { id:4, total_amount:100, start_date:'2026-01-01' },
                        { id:5, total_amount:100, start_date:'2026-01-01' },
                        { id:6, total_amount:100, start_date:'2026-02-01' },  ← AUTO-CREATED
                        { id:7, total_amount:100, start_date:'2026-02-01' },  ← AUTO-CREATED
                        { id:8, total_amount:100, start_date:'2026-02-01' },  ← AUTO-CREATED
                        { id:9, total_amount:100, start_date:'2026-02-01' },  ← AUTO-CREATED
                        { id:10, total_amount:100, start_date:'2026-02-01' }  ← AUTO-CREATED
                      ],
                      plans: [
                        {
                          id:1,
                          recurrence_kind:'recurring',
                          origin_registration_id:1,
                          due_registration: { id:6 }  ← Should hide #6
                        },
                        // ... plans 2-5 similar ...
                      ]
                    }
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND FILTERING                              │
│            visibleRegistrations useMemo Hook                        │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
                    FILTER LOGIC:
                    
                    1. Collect hidden registration IDs from plans:
                       recurringRegistrationIds = {1,2,3,4,5}  ✅
                       (These are origin registrations)
                       
                       recurringDueRegistrationIds = {6,7,8,9,10} ?
                       (Only if due_registration is populated)
                               ↓
                    2. Filter registrations:
                       
                       For PR#1: In recurringRegistrationIds? YES → HIDE ✅
                       For PR#2: In recurringRegistrationIds? YES → HIDE ✅
                       For PR#3: In recurringRegistrationIds? YES → HIDE ✅
                       For PR#4: In recurringRegistrationIds? YES → HIDE ✅
                       For PR#5: In recurringRegistrationIds? YES → HIDE ✅
                       
                       For PR#6: In recurringRegistrationIds? NO ✗
                                In recurringDueRegistrationIds? 
                                   - IF YES → HIDE ✅
                                   - IF NO → SHOW ❌
                       
                       For PR#7-10: Same as PR#6
                               ↓
                    BEST CASE (due_registration populated):
                    Hides: #1,2,3,4,5,6,7,8,9,10 ✅
                    Shows: none ✅
                    
                    WORST CASE (due_registration NOT populated):
                    Hides: #1,2,3,4,5 ✅
                    Shows: #6,7,8,9,10 ❌
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND DISPLAY                               │
│                  (WORST CASE - THE BUG)                             │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
                    TAB 1: RECURRING PLANS
                    ✅ Shows: 5 plans
                    ✅ Total: ₹500
                               ↓
                    TAB 2: ONE-TIME REGISTRATIONS  
                    ❌ Shows: 5 auto-created registrations
                       (PR#6,7,8,9,10 - for Feb 1st)
                    ❌ Total: ₹500
                               ↓
                    GRAND TOTAL DISPLAYED:
                    ❌ ₹1,000 (should be ₹500)
                    ❌ DOUBLED! BUG MANIFESTS
```

---

## Component Interaction Diagram

```
┌─────────────────┐
│  FRONTEND       │
│ DonorProfile    │
└────────┬────────┘
         │
         │ GET /api/pooja/registrations/
         ↓
┌────────────────────────────────────┐
│  BACKEND API                       │
│  PoojaRegistrationViewSet.list()   │
│  (views.py:333-336)                │
└────────┬───────────────────────────┘
         │
         │ Triggers:
         ↓
┌─────────────────────────────────┐
│  process_recurring_plans()       │
│  (services/recurrence.py)        │
└────────┬────────────────────────┘
         │
         │ For each active plan:
         ↓
┌──────────────────────────────────────┐
│  prepare_recurring_registration()    │
│  (services/recurrence.py:289-304)    │
└────────┬─────────────────────────────┘
         │
         │ Calls:
         ↓
┌────────────────────────────────────────┐
│  create_registration_from_plan()       │
│  (services/recurrence.py:240-276)      │
│  ❌ CREATES WITHOUT METADATA           │
└────────┬─────────────────────────────┘
         │
         │ Calls:
         ↓
┌──────────────────────────────────────┐
│  PoojaRegistration.objects.create()  │
│  (No recurrence_kind field!)         │
└────────┬──────────────────────────────┘
         │
         │ Result:
         ↓
    ❌ PoojaRegistration created
       WITHOUT: recurrence_kind
       WITHOUT: link to plan
       WITHOUT: cart_item
       WITHOUT: any recurrence metadata
```

---

## Database Model Relationship

```
INITIAL REGISTRATION FLOW (CORRECT):

┌─────────────────────────────┐
│  PoojaRegistration #1       │
├─────────────────────────────┤
│ id: 1                       │
│ donor_id: 5                 │
│ pooja_option_id: 10         │
│ start_date: 2026-01-01      │
│ total_amount: 100.00        │
│ ❌ recurrence_kind: NULL    │
└──────────┬──────────────────┘
           │ origin_registration ↓
           │ (forward link only)
           │
┌──────────────────────────────────┐
│  RecurringPoojaPlan #1           │
├──────────────────────────────────┤
│ id: 1                            │
│ donor_id: 5                      │
│ pooja_option_id: 10              │
│ recurrence_kind: 'recurring' ✅  │
│ origin_registration_id: 1    ✅  │
│ next_occurrence: 2026-02-01  ✅  │
│ is_active: True              ✅  │
└──────────────────────────────────┘


AUTO-CREATED REGISTRATION FLOW (BUGGY):

┌──────────────────────────────┐
│  RecurringPoojaPlan #1       │
├──────────────────────────────┤
│ id: 1                        │
│ recurrence_kind: 'recurring' │
│ origin_registration_id: 1    │
│ next_occurrence: 2026-02-01  │
└──────────┬───────────────────┘
           │
      calls │ create_registration_from_plan(plan)
           │
           ↓
┌───────────────────────────────────────┐
│  PoojaRegistration #6 (AUTO-CREATED)  │
├───────────────────────────────────────┤
│ id: 6                                 │
│ donor_id: 5                           │
│ pooja_option_id: 10                   │
│ start_date: 2026-02-01  ← NEXT MONTH │
│ total_amount: 100.00                  │
│ ❌ recurrence_kind: NULL  ← NO TYPE! │
│ ❌ NO LINK TO PLAN!                   │
│ ❌ NO METADATA!                       │
└───────────────────────────────────────┘

PROBLEM: 
✅ Plan #1 knows it's origin = Registration #1
❌ Registration #6 doesn't know it's from Plan #1
❌ Frontend can't identify Registration #6 as recurring
❌ Registration #6 appears as "one-time"
```

---

## Filter Logic Execution Flow

```
visibleRegistrations useMemo Hook:

Input: 
- registrations: [PR#1-10]
- recurrencePlans: [Plan#1-5]

Step 1: Build hidden ID sets
───────────────────────────
for each plan in recurrencePlans:
    if plan.recurrence_kind == 'recurring':
        recurringRegistrationIds.add(plan.origin_registration_id)
        recurringDueRegistrationIds.add(plan.due_registration?.id)

Result:
- recurringRegistrationIds = {1,2,3,4,5} ✅
- recurringDueRegistrationIds = {6,7,8,9,10} if populated ✅
- recurringDueRegistrationIds = {} if NOT populated ❌

Step 2: Filter registrations
──────────────────────────
for each registration in registrations:
    if recurringRegistrationIds.has(registration.id):
        return false  ← Hide
    if recurringDueRegistrationIds.has(registration.id):
        return false  ← Hide
    if registration.recurrence_kind == 'recurring':
        return false  ← Hide
    if registration.cart_item?.recurrenceKind == 'recurring':
        return false  ← Hide
    return true  ← SHOW

For PR#1-5:
  ✓ In recurringRegistrationIds → HIDDEN ✅

For PR#6-10 (BEST CASE - due_registration populated):
  ✓ In recurringDueRegistrationIds → HIDDEN ✅

For PR#6-10 (WORST CASE - due_registration NOT populated):
  ✗ NOT in recurringRegistrationIds
  ✗ NOT in recurringDueRegistrationIds (empty!)
  ✗ registration.recurrence_kind = undefined (NULL)
  ✗ registration.cart_item?.recurrenceKind = undefined (NULL)
  → return true → SHOWN ❌

Output:
- BEST CASE: [] (empty, all hidden) ✅
- WORST CASE: [PR#6,7,8,9,10] ❌
```

---

## Timeline of Bug Discovery

```
2026-01-01
├─ Donor registers 5 recurring poojas
├─ PR#1-5 created
├─ Plan#1-5 created with origin_registration_id
├─ Frontend shows correctly: 5 plans, ₹500
└─ ✅ OK

2026-02-01
├─ Donor refreshes page
├─ API calls process_recurring_plans()
├─ Auto-creates PR#6-10 for Feb 1st
├─ NO METADATA ON PR#6-10
├─ API response includes both PR#1-10
├─ Frontend filter struggles
├─ If due_registration NOT populated:
│  ├─ PR#6-10 pass through filter
│  ├─ Shows in "One-time Registrations"
│  ├─ Also shows Plan#1-5 in "Recurring Plans"
│  └─ ❌ DOUBLED AMOUNT VISIBLE
└─ 🐛 BUG MANIFESTS

2026-03-01
├─ Donor refreshes again
├─ Auto-creates PR#11-15 for Mar 1st
├─ Now have:
│  ├─ PR#1-5 (origin)
│  ├─ PR#6-10 (Feb)
│  ├─ PR#11-15 (Mar)
│  └─ ❌ 15 registrations for 5 poojas!
├─ Duplication gets WORSE
└─ 🐛 BUG GROWS

CURRENT STATE:
├─ Multiple months have processed
├─ Amar: 1 extra month visible (1 pooja duplicated)
├─ R: Multiple extra months visible (4 poojas duplicated)
└─ 🐛 BUG CLEARLY VISIBLE
```

---

## Fix Requirement Matrix

```
FIX OPTION 1: Add Metadata to Model
────────────────────────────────────
Changes Required:
  ✓ Add recurrence_kind field to PoojaRegistration
  ✓ Update auto-creation to set this field
  ✓ No frontend changes needed
  ✓ Frontend filter works as-is
  
Impact:
  ✓ Solves root cause
  ✓ Permanent solution
  ✓ Requires DB migration
  ✓ Time: 2-3 hours

FIX OPTION 2: Improve Frontend Filter
──────────────────────────────────────
Changes Required:
  ✓ Don't rely on registration.recurrence_kind
  ✓ Query plans to find auto-created registrations
  ✓ Use date matching instead of field checking
  
Impact:
  ✓ Quick fix
  ✓ No DB migration
  ✓ Workaround, not solution
  ✓ Time: 1 hour

FIX OPTION 3: Disable Auto-Creation
────────────────────────────────────
Changes Required:
  ✓ Remove process_recurring_plans() call from list()
  ✓ Call it only on specific action (button, scheduled job)
  ✓ Update frontend to handle pending registrations
  ✓ Update payment tracking logic
  
Impact:
  ✓ Eliminates silent background operations
  ✓ Changes system behavior
  ✓ Complex frontend changes needed
  ✓ Time: 4+ hours
```

---

This visual guide shows the complete journey of the bug from creation to manifestation.
