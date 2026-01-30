# Evidence: Proof of Bug Cause in Code

## Executive Evidence Chain

### Evidence 1: PoojaRegistration Model Has NO `recurrence_kind` Field

**File**: [backend/pooja/models.py:95-138]

```python
class PoojaRegistration(models.Model):
    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pooja_registrations")
    pooja_option = models.ForeignKey(PoojaOption, on_delete=models.CASCADE, related_name="registrations")
    day_option = models.ForeignKey(PoojaDayOption, null=True, blank=True, on_delete=models.SET_NULL)
    start_date = models.DateField(null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    is_group_registration = models.BooleanField(default=False)
    post_prasadam = models.BooleanField(default=False)
    additional_notes = models.TextField(blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=PoojaStatus.choices,
        default=PoojaStatus.PENDING,
    )
    registration_number = models.PositiveIntegerField(unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # ❌ NO recurrence_kind field here
    # ❌ NO origin_registration_id field here
```

**Contrast with RecurringPoojaPlan**:

```python
class RecurringPoojaPlan(models.Model):
    donor = models.ForeignKey(...)
    pooja_option = models.ForeignKey(...)
    day_option = models.ForeignKey(...)
    
    # ✅ HAS recurrence_kind field
    recurrence_kind = models.CharField(
        max_length=32,
        choices=RecurrenceKind.choices,
        default=RecurrenceKind.RECURRING,
    )
    # ✅ HAS origin_registration reference
    origin_registration = models.ForeignKey(
        PoojaRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="originating_recurring_plans",
    )
    # ... other fields ...
```

**Implication**: When `create_registration_from_plan()` creates a new `PoojaRegistration`, there's NO WAY to mark it as "this registration came from a recurring plan" unless it's added to the model.

---

### Evidence 2: Auto-Created Registrations Are Created Without Metadata

**File**: [backend/pooja/services/recurrence.py:240-276]

```python
@transaction.atomic
def create_registration_from_plan(plan: RecurringPoojaPlan, due_date: Optional[date] = None) -> PoojaRegistration:
    """Create a new registration from an existing plan."""
    today = timezone.localtime()
    scheduled_date = due_date or plan.next_occurrence or plan.start_date or today
    metadata = plan.metadata or {}
    members_payload = _build_members_for_registration(metadata.get("members", []))
    quantity = metadata.get("quantity") or max(len(members_payload), 1)
    
    # ⚠️ CREATING REGISTRATION WITHOUT RECURRENCE METADATA
    registration = PoojaRegistration.objects.create(
        donor=plan.donor,                              # From plan
        pooja_option=plan.pooja_option,               # From plan
        day_option=plan.day_option,                   # From plan
        start_date=scheduled_date,                    # FOR NEXT MONTH
        quantity=quantity,                            # From plan metadata
        is_group_registration=bool(metadata.get("is_group_registration")) or len(members_payload) > 1,
        post_prasadam=bool(metadata.get("post_prasadam")),
        additional_notes=metadata.get("additional_notes") or "",
        total_amount=plan.amount,                     # From plan
        # ❌ NOT SET: recurrence_kind (doesn't exist on model)
        # ❌ NOT SET: origin_registration_id (doesn't exist on model)
        # ❌ NOT SET: cart_item (not on model)
        # ❌ NO WAY TO TRACK this came from a plan
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

**Key Problem**: No field to indicate "I am a recurring registration for next month". The registration is created with ONLY `donor`, `pooja_option`, `day_option`, `start_date`, etc. - but NO recurrence metadata.

---

### Evidence 3: This Function is Called Automatically Every List Request

**File**: [backend/pooja/views.py:328-370]

```python
class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = PoojaRegistrationSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        # ⚠️ AUTOMATICALLY PROCESSES ALL RECURRING PLANS EVERY TIME THIS IS CALLED
        process_recurring_plans()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        # ... filtering ...
        return queryset.prefetch_related("members")

    # ... other methods ...
```

**The Flow**:
```
Frontend calls: GET /api/pooja/registrations/
    ↓
Django routes to: PoojaRegistrationViewSet.list()
    ↓
Executes: process_recurring_plans()
    ↓
Calls: prepare_recurring_registration() for each active plan
    ↓
Calls: create_registration_from_plan() for next month
    ↓
Creates: NEW PoojaRegistration records (without metadata!)
    ↓
Returns: Full list including the new auto-created registrations
```

**Impact**: EVERY TIME the frontend fetches registrations, new month registrations are created.

---

### Evidence 4: Frontend Filter Expects Data That Doesn't Exist

**File**: [frontend/src/pages/DonorProfile.tsx:499-533]

```typescript
const visibleRegistrations = useMemo(() => {
  const recurringRegistrationIds = new Set<number>();
  const recurringDueRegistrationIds = new Set<number>();
  
  for (const plan of recurrencePlans) {
    if (plan.recurrence_kind === 'recurring') {
      if (typeof plan.origin_registration_id === 'number') {
        recurringRegistrationIds.add(plan.origin_registration_id);  // ← Works for initial registration
      }
      if (plan.due_registration?.id) {
        recurringDueRegistrationIds.add(plan.due_registration.id);  // ← Assumes due_registration is populated
      }
    }
  }

  return registrations.filter((registration) => {
    // These conditions rely on metadata that auto-created registrations don't have
    if (recurringRegistrationIds.has(registration.id)) return false;
    if (recurringDueRegistrationIds.has(registration.id)) return false;

    const cartRecurrenceKind =
      registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
    const hasRecurrenceKind = Boolean(registration.recurrence_kind);  // ← NULL for auto-created!

    // Auto-created registrations have:
    // - hasRecurrenceKind = false (field doesn't exist)
    // - cartRecurrenceKind = undefined (field doesn't exist)
    // - registration.id NOT in recurringRegistrationIds (no origin_registration_id!)
    // - plan.due_registration might be undefined!

    if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
      return false;  // ← Doesn't reach here
    }
    if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
      return false;  // ← Doesn't reach here
    }

    return true;  // ← AUTO-CREATED REGISTRATIONS PASS THROUGH!
  });
}, [registrations, recurrencePlans]);
```

**The Problem**: The filter checks:
1. `plan.due_registration?.id` - Assumes API returns this data
2. `registration.recurrence_kind` - Field doesn't exist on auto-created registrations
3. `registration.cart_item?.recurrenceKind` - Field doesn't exist on auto-created registrations

Auto-created registrations don't match ANY of these conditions, so they're included in "one-time registrations".

---

### Evidence 5: The Backend-Frontend Contract Mismatch

**What Backend Creates**:

When initial registration happens (from serializer):
```python
# serializers.py:246
registration = PoojaRegistration.objects.create(**validated_data)  # Has only basic fields

# Then calls
create_plan_from_registration(
    registration=registration,
    recurrence_kind=recurrence_kind,  # ← Type stored in PLAN, not registration
)
# Creates: RecurringPoojaPlan with recurrence_kind='recurring'
```

**Result**: The TYPE of registration (recurring vs one-time) is stored in the PLAN, not the REGISTRATION.

---

When automatic monthly registration happens (from service):
```python
# services/recurrence.py:249
registration = PoojaRegistration.objects.create(
    donor=plan.donor,
    pooja_option=plan.pooja_option,
    start_date=scheduled_date,  # ← Next month
    # ❌ NO TYPE INFORMATION
)
# Note: NO plan is created for this registration!
# It's just a bare registration with no linkage
```

**What Frontend Expects**:

Frontend assumes:
1. All recurring registrations are either:
   - Linked to a plan via `origin_registration_id` in the plan, OR
   - Have `recurrence_kind` field, OR
   - Have `cart_item` payload

2. But auto-created registrations have NONE of these!

---

### Evidence 6: No Reverse Link from Registration to Plan

**PoojaRegistration model** doesn't have:
```python
# Missing field:
plan = models.ForeignKey(RecurringPoojaPlan, null=True, blank=True)
# OR
recurring_plan_id = models.IntegerField(null=True, blank=True)
```

**Only the Plan has a forward link**:
```python
# RecurringPoojaPlan HAS:
origin_registration = models.ForeignKey(PoojaRegistration, ...)
```

**Problem**: Only the INITIAL registration is linked. Subsequent month registrations have NO way to know which plan they belong to.

---

## Concrete Example Walkthrough

### Step 1: Donor Registers Recurring Pooja

```
REQUEST: POST /api/pooja/registrations/
BODY: {
  "pooja_option": 5,           # Abhisheka
  "start_date": "2026-01-01",
  "total_amount": "100.00",
  "recurrence_kind": "recurring",
  "recurrence_frequency": "monthly",
  "members": [...]
}

BACKEND EXECUTION:
  1. serializers.py:246 → PoojaRegistration.objects.create(...)
     Creates: PR#1 (id=1, pooja_option=5, start_date=2026-01-01, total_amount=100)
  
  2. serializers.py:249 → create_plan_from_registration(registration, 'recurring', ...)
     Creates: RecurringPoojaPlan#1 (
       recurrence_kind='recurring',
       origin_registration_id=1,    ← Links back to PR#1
       next_occurrence='2026-02-01',
       amount=100
     )

API RETURNS:
  {
    "id": 1,
    "total_amount": "100.00",
    "start_date": "2026-01-01",
    // ❌ No recurrence_kind field on registration itself
  }
```

### Step 2: Frontend Fetches Registration List

```
REQUEST: GET /api/pooja/registrations/

BACKEND EXECUTION:
  1. views.py:333 → process_recurring_plans()
  
  2. For RecurringPoojaPlan#1:
     - Is recurrence_kind='recurring'? YES
     - Is is_active=True? YES
     - Is next_occurrence='2026-02-01' due? Maybe (depends on current date)
     
     If due, services/recurrence.py:289 calls:
     prepare_recurring_registration(plan=RecurringPoojaPlan#1)
       ↓
       create_registration_from_plan(plan, due_date='2026-02-01')
       ↓
       PoojaRegistration.objects.create(
         donor_id=1,
         pooja_option_id=5,
         start_date='2026-02-01',     ← NEXT MONTH
         total_amount=100,
         // ❌ NO recurrence_kind
         // ❌ NO cart_item
         // ❌ NO origin_registration_id
       )
       
       Creates: PR#2 (the auto-created registration for Feb 1st)

API RETURNS:
  {
    "registrations": [
      {
        "id": 1,
        "total_amount": "100.00",
        "start_date": "2026-01-01",
        // No recurrence_kind
      },
      {
        "id": 2,  ← NEW AUTO-CREATED
        "total_amount": "100.00",
        "start_date": "2026-02-01",
        // No recurrence_kind, no plan info
      }
    ],
    "plans": [
      {
        "id": 1,
        "recurrence_kind": "recurring",
        "origin_registration_id": 1,   ← Hides PR#1
        "due_registration": { "id": 2 }  ← Should hide PR#2 too
      }
    ]
  }
```

### Step 3: Frontend Filtering

```typescript
registrations = [
  { id: 1, total_amount: 100, start_date: '2026-01-01' },  // Origin
  { id: 2, total_amount: 100, start_date: '2026-02-01' }   // Auto-created (Feb)
]

plans = [
  { id: 1, recurrence_kind: 'recurring', origin_registration_id: 1, due_registration: { id: 2 } }
]

visibleRegistrations = registrations.filter((r) => {
  if (recurringRegistrationIds.has(r.id)) return false;      // ← Hides PR#1 ✅
  if (recurringDueRegistrationIds.has(r.id)) return false;    // ← Hides PR#2 IF due_registration populated ✅
  
  const hasRecurrenceKind = Boolean(r.recurrence_kind);       // ← FALSE for both!
  
  if (hasRecurrenceKind && r.recurrence_kind === 'recurring') {
    return false;  // ← Never executes
  }
  
  return true;  // ← Both pass through IF due_registration not populated
})

RESULT:
- If API response includes due_registration: Both hidden ✅
- If API response doesn't include due_registration: PR#2 SHOWN ❌
- If due_registration is incorrectly computed: PR#2 SHOWN ❌
```

---

## The "one_time_extra" Confusion

**Note**: The bug title mentions "one_time_extra" but that's not the actual recurrence_kind being created incorrectly.

The auto-created registrations don't have `recurrence_kind` set to "one_time_extra" - they have NO `recurrence_kind` field at all because the field doesn't exist on the `PoojaRegistration` model.

They're appearing in the "One-time Registrations" section because:
1. They're not hidden by the filtering
2. They're not marked as recurring
3. So they default to showing as "one-time"

This is distinct from intentionally created "one_time_extra" registrations which are properly tracked via `RecurringPoojaPlan` records.

---

## Conclusion

**The Evidence Chain**:

1. ✅ PoojaRegistration model has NO recurrence_kind field
2. ✅ Auto-creation function creates registrations without ANY recurrence metadata
3. ✅ Frontend filter expects recurrence_kind field that doesn't exist
4. ✅ Auto-creation happens silently on every API call
5. ✅ Results: Same pooja appears in both tabs with doubled amounts

**Who's at Fault**:
- Backend: Should add recurrence metadata to auto-created registrations
- Frontend: Should not rely on fields that don't exist
- Architecture: Should have reverse link from registration to plan

**The Fix Requires**:
- Either: Add recurrence_kind field to PoojaRegistration model (database migration)
- Or: Change frontend filter to not rely on missing fields
- Or: Change auto-creation to not create registrations without metadata
