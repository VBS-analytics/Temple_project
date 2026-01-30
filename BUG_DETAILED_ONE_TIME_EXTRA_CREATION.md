# Technical Findings: Where "one_time_extra" Registrations Are Created

## Summary of Code Paths

### Path 1: Initial Registration Creation → Plan Creation

**When a donor registers a pooja, the flow is:**

```
API Request (PoojaRegistrationViewSet.create)
    ↓
PoojaRegistrationSerializer.create() [serializers.py:245-260]
    ├─ Creates: PoojaRegistration object
    └─ If recurrence_kind provided:
        ├─ Calls: create_plan_from_registration()
        │           [services/recurrence.py:168-209]
        │   ├─ Input: recurrence_kind (from request)
        │   ├─ Creates: RecurringPoojaPlan with recurrence_kind
        │   └─ Sets: origin_registration_id to link back
        └─ Returns: registration
```

**Code Reference:**

File: [backend/pooja/serializers.py:238-260]
```python
@transaction.atomic
def create(self, validated_data):
    members = validated_data.pop("members", [])
    recurrence_kind = validated_data.pop("recurrence_kind", None)  # ← From request
    recurrence_frequency = validated_data.pop("recurrence_frequency", None)
    recurrence_one_time_date = validated_data.pop("recurrence_one_time_date", None)
    cart_item_payload = validated_data.pop("cart_item", None)
    created_at_override = validated_data.pop("created_at_override", None)
    
    registration = PoojaRegistration.objects.create(**validated_data)
    self._sync_members(registration, members)
    
    if recurrence_kind:
        create_plan_from_registration(
            registration=registration,
            recurrence_kind=recurrence_kind,  # ← KEY: What's in the request?
            recurrence_frequency=recurrence_frequency,
            recurrence_one_time_date=recurrence_one_time_date,
            cart_item_payload=cart_item_payload,
        )
    
    if created_at_override:
        PoojaRegistration.objects.filter(pk=registration.pk).update(created_at=created_at_override)
    
    return registration
```

**The Function Being Called:**

File: [backend/pooja/services/recurrence.py:168-209]
```python
@transaction.atomic
def create_plan_from_registration(
    registration: PoojaRegistration,
    recurrence_kind: str,  # ← 'recurring' or 'one_time_extra'
    recurrence_frequency: Optional[str] = None,
    recurrence_one_time_date: Optional[date] = None,
    cart_item_payload: Optional[Dict[str, Any]] = None,
) -> RecurringPoojaPlan:
    if not recurrence_kind:
        raise ValueError("recurrence_kind is required to build a plan")

    kind = RecurrenceKind(recurrence_kind)  # Validates enum
    frequency = RecurrenceFrequency(recurrence_frequency) if recurrence_frequency else RecurrenceFrequency.MONTHLY
    start_date = registration.start_date or timezone.localdate()
    one_time_date = recurrence_one_time_date or start_date
    
    # Check if plan already exists (for idempotence)
    plan = _find_existing_plan(registration, kind, one_time_date)
    metadata = _build_plan_metadata(registration)

    if plan is None:
        plan = RecurringPoojaPlan(
            donor=registration.donor,
            pooja_option=registration.pooja_option,
        )
    
    # Set plan properties based on kind
    plan.day_option = registration.day_option
    plan.recurrence_kind = kind  # ← 'recurring' or 'one_time_extra'
    plan.recurrence_frequency = frequency
    plan.start_date = start_date
    plan.last_occurrence = start_date
    plan.amount = registration.total_amount
    plan.metadata = metadata
    plan.cart_payload = cart_item_payload or plan.cart_payload or {}
    plan.origin_registration = registration  # ← LINKS BACK TO REGISTRATION
    plan.one_time_date = one_time_date if kind == RecurrenceKind.ONE_TIME_EXTRA else None
    plan.is_active = kind == RecurrenceKind.RECURRING  # ← Active only if recurring
    plan.pause_from = None
    plan.pause_until = None

    # Set next_occurrence based on kind
    if kind == RecurrenceKind.RECURRING:
        plan.next_occurrence = _calculate_next_occurrence(start_date, frequency)
    else:
        plan.next_occurrence = None  # ← One-time extras have no next occurrence
    
    plan.save()
    return plan
```

**Key Insight:** The `recurrence_kind` comes DIRECTLY from the API request, which comes from the FRONTEND's PoojaRegistrationPage.tsx.

---

### Path 2: Automatic Registration Creation from Recurring Plans

When `process_recurring_plans()` is called, it can create NEW registrations for upcoming occurrences:

**File:** [backend/pooja/services/recurrence.py:289-304]
```python
def prepare_recurring_registration(plan: RecurringPoojaPlan, *, reference_date: Optional[date] = None) -> Optional[PoojaRegistration]:
    """Create a new registration for a plan's next_occurrence if it's due."""
    
    if plan.recurrence_kind != RecurrenceKind.RECURRING or not plan.is_active:
        return None
    
    target_date = plan.next_occurrence
    if target_date is None:
        return None
    
    if plan.pause_from and plan.pause_until and plan.pause_from <= target_date <= plan.pause_until:
        return None
    
    # CREATE NEW REGISTRATION FROM PLAN
    registration = create_registration_from_plan(plan, due_date=target_date)
    processed_date = reference_date or target_date
    _advance_plan(plan, processed_date)  # Updates plan's next_occurrence
    
    return registration
```

**The Registration Creation Function:**

File: [backend/pooja/services/recurrence.py:240-276]
```python
@transaction.atomic
def create_registration_from_plan(plan: RecurringPoojaPlan, due_date: Optional[date] = None) -> PoojaRegistration:
    """Create a new registration from an existing plan."""
    
    today = timezone.localdate()
    scheduled_date = due_date or plan.next_occurrence or plan.start_date or today
    metadata = plan.metadata or {}
    members_payload = _build_members_for_registration(metadata.get("members", []))
    quantity = metadata.get("quantity") or max(len(members_payload), 1)
    
    # ⚠️ CREATE NEW REGISTRATION (not linked to origin_registration via foreign key)
    registration = PoojaRegistration.objects.create(
        donor=plan.donor,
        pooja_option=plan.pooja_option,
        day_option=plan.day_option,
        start_date=scheduled_date,
        quantity=quantity,
        is_group_registration=bool(metadata.get("is_group_registration")) or len(members_payload) > 1,
        post_prasadam=bool(metadata.get("post_prasadam")),
        additional_notes=metadata.get("additional_notes") or "",
        total_amount=plan.amount,
    )

    for member in members_payload:
        date_of_birth = _parse_date(member.get("date_of_birth"))
        PoojaRegistrationMember.objects.create(
            registration=registration,
            name=member["name"],
            relationship=member.get("relationship", ""),
            tamil_star=member.get("tamil_star", ""),
            rasi=member.get("rasi", ""),
            gothra=member.get("gothra", ""),
            family_name=member.get("family_name", ""),
            date_of_birth=date_of_birth,
        )

    return registration
```

**⚠️ CRITICAL ISSUE HERE:** The newly created registration has NO LINK back to the plan that created it. This is different from the initial registration which has `origin_registration_id` in the plan.

---

### Path 3: Where `process_recurring_plans()` is Called

**File:** [backend/pooja/views.py:333-336]
```python
def list(self, request, *args, **kwargs):
    process_recurring_plans()  # ← Called every time registrations are listed!
    return super().list(request, *args, **kwargs)
```

This function is called in the `PoojaRegistrationViewSet.list()` action, which means EVERY TIME the frontend fetches the list of registrations, new registrations may be created for upcoming occurrences.

---

## The Root Cause - Three Scenarios

### Scenario A: Multiple Registrations Created from Same Plan

**What happens:**
1. Donor registers a pooja with `recurrence_kind='recurring'` on 2026-01-01
2. `RecurringPoojaPlan` created with `next_occurrence='2026-02-01'`
3. Frontend calls `/api/pooja/registrations/` → triggers `process_recurring_plans()`
4. `prepare_recurring_registration()` creates NEW `PoojaRegistration` for 2026-02-01
5. This new registration has NO `recurrence_kind` field set (it's only in the plan, not the registration)
6. Frontend filter checks: `registration.recurrence_kind` → null/undefined
7. Registration is NOT filtered out → **Appears in one-time section!**

**Evidence:** [backend/pooja/services/recurrence.py:249]
```python
registration = PoojaRegistration.objects.create(
    donor=plan.donor,
    pooja_option=plan.pooja_option,
    # ... other fields ...
    # ⚠️ NO recurrence_kind PARAMETER - uses model default (None)
)
```

The `PoojaRegistration` model doesn't have a `recurrence_kind` field in the base model. The recurrence data is stored in the `RecurringPoojaPlan` model.

### Scenario B: Frontend Sending Wrong recurrence_kind

**What happens:**
1. Frontend submits registration with `recurrence_kind='one_time_extra'` instead of `'recurring'`
2. Backend creates BOTH:
   - `PoojaRegistration` object
   - `RecurringPoojaPlan` with `recurrence_kind='one_time_extra'`
3. The plan won't have `origin_registration_id` hidden in recurring filter
4. **Registration appears in one-time section incorrectly**

This would explain why the amounts are partially appearing in both sections.

### Scenario C: Cart Item Payload Corruption

**What happens:**
1. Multiple registrations submitted together
2. Some have `cart_item` payload with `recurrenceKind` set
3. Frontend filter checks both `registration.recurrence_kind` AND `registration.cart_item?.recurrenceKind`
4. If cart_item has conflicting data, filtering fails

**Code:** [frontend/src/pages/DonorProfile.tsx:518-533]
```tsx
const cartRecurrenceKind =
  registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
const hasRecurrenceKind = Boolean(registration.recurrence_kind);

if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
  return false;
}
if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
  return false;
}
```

---

## Database Model Structure

**PoojaRegistration** (Base registration record):
```
├─ id: integer
├─ donor_id: foreign key
├─ pooja_option_id: foreign key
├─ start_date: date
├─ total_amount: decimal
├─ status: 'pending' | 'confirmed' | 'completed'
├─ created_at: datetime
└─ [NO recurrence_kind field]  ← This is the key insight!
```

**RecurringPoojaPlan** (Recurrence metadata):
```
├─ id: integer
├─ donor_id: foreign key
├─ pooja_option_id: foreign key
├─ recurrence_kind: 'recurring' | 'one_time_extra'  ← Here it is!
├─ origin_registration_id: foreign key (optional)
├─ one_time_date: date
├─ next_occurrence: date
├─ is_active: boolean
├─ created_at: datetime
└─ metadata: json
```

---

## Confirming the Bug: Database Query

To confirm which scenario is happening, run:

```sql
-- Find Amar Gopalakrishnan's registrations from 01/01/2026
SELECT 
  r.id,
  r.pooja_option_id,
  r.start_date,
  r.total_amount,
  r.created_at,
  'Registration' as type
FROM pooja_poojaregistration r
WHERE r.donor_id = (SELECT id FROM accounts_user WHERE name = 'Amar Gopalakrishnan')
  AND r.start_date = '2026-01-01'
ORDER BY r.id;

-- Find Amar's recurring plans
SELECT 
  p.id,
  p.recurrence_kind,
  p.origin_registration_id,
  p.one_time_date,
  p.next_occurrence,
  p.amount,
  p.created_at,
  'Plan' as type
FROM pooja_recurringpoojaplan p
WHERE p.donor_id = (SELECT id FROM accounts_user WHERE name = 'Amar Gopalakrishnan')
ORDER BY p.created_at;

-- Cross-join to see which registrations are origin of which plans
SELECT 
  DISTINCT r.id as registration_id,
  r.total_amount,
  p.recurrence_kind,
  p.id as plan_id,
  CASE WHEN p.id IS NOT NULL THEN 'Has Plan' ELSE 'No Plan' END as plan_status
FROM pooja_poojaregistration r
LEFT JOIN pooja_recurringpoojaplan p ON p.origin_registration_id = r.id
WHERE r.donor_id = (SELECT id FROM accounts_user WHERE name = 'Amar Gopalakrishnan')
  AND r.start_date = '2026-01-01'
ORDER BY r.id;
```

---

## Final Summary Table

| Location | Code | Issue |
|----------|------|-------|
| **serializers.py:245-260** | `PoojaRegistrationSerializer.create()` | Takes `recurrence_kind` from request and creates plan |
| **services/recurrence.py:168** | `create_plan_from_registration()` | Creates plan with type from request - NO VALIDATION |
| **services/recurrence.py:249** | `create_registration_from_plan()` | Creates NEW registrations with NO recurrence metadata |
| **services/recurrence.py:289** | `prepare_recurring_registration()` | Called automatically, creates registrations missing plan linkage |
| **views.py:333** | `PoojaRegistrationViewSet.list()` | Calls `process_recurring_plans()` every time |
| **DonorProfile.tsx:499** | `visibleRegistrations` filter | Assumes all registrations have proper recurrence metadata |

---

## Conclusion

**The "one_time_extra" registrations showing up incorrectly are likely:**

1. **NEW registrations created by `prepare_recurring_registration()`** for upcoming monthly occurrences
2. These registrations have:
   - NO `recurrence_kind` field (doesn't exist on PoojaRegistration model)
   - NO `origin_registration_id` (not a field on PoojaRegistration)
   - NO cart_item data
3. Frontend filter sees them as "not recurring" and includes them in "one-time" section
4. But they're actually tied to a recurring plan through the plan's `origin_registration_id`
5. Result: **Same pooja appears in both tabs with doubled amounts**

This is a **frontend-backend contract mismatch**: The backend creates registrations that the frontend can't properly classify.
