# Complete Code Location Reference

## Primary Bug: Auto-Created Registrations Without Metadata

### 1. WHERE BUG IS CREATED - Auto-Registration Creation

**File**: `backend/pooja/services/recurrence.py`  
**Function**: `create_registration_from_plan()`  
**Lines**: 240-276

```
🔴 CRITICAL: Creates PoojaRegistration without:
   - recurrence_kind field (doesn't exist on model)
   - cart_item metadata  
   - origin_registration_id link
   - ANY way to identify as recurring
```

**Related**: `_parse_date()` helper (lines 220-229)

---

### 2. WHERE BUG IS TRIGGERED - Auto-Execution

**File**: `backend/pooja/services/recurrence.py`  
**Function**: `prepare_recurring_registration()`  
**Lines**: 289-304

```
🔴 CRITICAL: Calls create_registration_from_plan() for next month
   - Triggered automatically
   - No user action
   - Creates new DB rows invisibly
```

---

### 3. WHERE BUG IS ACTIVATED - API Call Trigger

**File**: `backend/pooja/views.py`  
**Class**: `PoojaRegistrationViewSet`  
**Method**: `list()`  
**Lines**: 333-336

```python
def list(self, request, *args, **kwargs):
    process_recurring_plans()  # ← TRIGGERED ON EVERY FETCH
    return super().list(request, *args, **kwargs)
```

🔴 **CRITICAL**: Calls process_recurring_plans() on EVERY request

---

## Secondary Bug: Filter Fails to Hide Auto-Created Registrations

### 4. WHERE FILTER FAILS - Frontend Display Logic

**File**: `frontend/src/pages/DonorProfile.tsx`  
**Hook**: `visibleRegistrations` useMemo  
**Lines**: 499-533

```typescript
const visibleRegistrations = useMemo(() => {
  // Lines 500-514: Collect hidden registration IDs from plans
  const recurringRegistrationIds = new Set<number>();
  const recurringDueRegistrationIds = new Set<number>();
  for (const plan of recurrencePlans) {
    if (plan.recurrence_kind === 'recurring') {
      if (typeof plan.origin_registration_id === 'number') {
        recurringRegistrationIds.add(plan.origin_registration_id);
      }
      if (plan.due_registration?.id) {
        recurringDueRegistrationIds.add(plan.due_registration.id);
      }
    }
  }

  // Lines 516-533: Filter out hidden registrations
  return registrations.filter((registration) => {
    if (recurringRegistrationIds.has(registration.id)) return false;
    if (recurringDueRegistrationIds.has(registration.id)) return false;

    const cartRecurrenceKind =
      registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
    const hasRecurrenceKind = Boolean(registration.recurrence_kind);

    if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
      return false;
    }
    if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
      return false;
    }

    return true;  // ← AUTO-CREATED REGISTRATIONS PASS THROUGH
  });
}, [registrations, recurrencePlans]);
```

🟡 **PROBLEM**: Assumes fields that don't exist on auto-created registrations

---

## Data Model Issues

### 5. MISSING FIELD - PoojaRegistration Model

**File**: `backend/pooja/models.py`  
**Class**: `PoojaRegistration`  
**Lines**: 95-138

```python
class PoojaRegistration(models.Model):
    donor = models.ForeignKey(...)
    pooja_option = models.ForeignKey(...)
    day_option = models.ForeignKey(...)
    start_date = models.DateField(...)
    quantity = models.PositiveIntegerField(...)
    is_group_registration = models.BooleanField(...)
    post_prasadam = models.BooleanField(...)
    additional_notes = models.TextField(...)
    total_amount = models.DecimalField(...)
    status = models.CharField(...)
    registration_number = models.PositiveIntegerField(...)
    created_at = models.DateTimeField(...)
    updated_at = models.DateTimeField(...)
    
    # ❌ MISSING: recurrence_kind field
    # ❌ MISSING: link to recurring plan
```

🔴 **CRITICAL**: No way to identify registrations as recurring

---

### 6. RECURRENCE DATA STRUCTURE - RecurringPoojaPlan Model

**File**: `backend/pooja/models.py`  
**Class**: `RecurringPoojaPlan`  
**Lines**: 164-235

```python
class RecurringPoojaPlan(models.Model):
    donor = models.ForeignKey(...)
    pooja_option = models.ForeignKey(...)
    day_option = models.ForeignKey(...)
    
    # ✅ DOES HAVE recurrence type
    recurrence_kind = models.CharField(
        max_length=32,
        choices=RecurrenceKind.choices,
        default=RecurrenceKind.RECURRING,
    )
    
    # ✅ DOES HAVE forward link to registration
    origin_registration = models.ForeignKey(
        PoojaRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="originating_recurring_plans",
    )
    
    # ✅ DOES HAVE one-time tracking
    one_time_date = models.DateField(null=True, blank=True)
    
    # ... other fields ...
```

✅ **CORRECT**: Plan model has all necessary fields  
❌ **PROBLEM**: Registration model can't link back

---

## Initial Registration Creation (CORRECT)

### 7. INITIAL REGISTRATION CREATION - API Endpoint

**File**: `backend/pooja/serializers.py`  
**Class**: `PoojaRegistrationSerializer`  
**Method**: `create()`  
**Lines**: 238-260

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
        create_plan_from_registration(  # ← CALLS PLAN CREATION
            registration=registration,
            recurrence_kind=recurrence_kind,
            recurrence_frequency=recurrence_frequency,
            recurrence_one_time_date=recurrence_one_time_date,
            cart_item_payload=cart_item_payload,
        )
    
    if created_at_override:
        PoojaRegistration.objects.filter(pk=registration.pk).update(created_at=created_at_override)
    
    return registration
```

✅ **CORRECT**: Plan is created with type information

---

### 8. PLAN CREATION FROM REGISTRATION

**File**: `backend/pooja/services/recurrence.py`  
**Function**: `create_plan_from_registration()`  
**Lines**: 168-209

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

    kind = RecurrenceKind(recurrence_kind)
    frequency = RecurrenceFrequency(recurrence_frequency) if recurrence_frequency else RecurrenceFrequency.MONTHLY
    start_date = registration.start_date or timezone.localdate()
    one_time_date = recurrence_one_time_date or start_date
    plan = _find_existing_plan(registration, kind, one_time_date)
    metadata = _build_plan_metadata(registration)

    if plan is None:
        plan = RecurringPoojaPlan(
            donor=registration.donor,
            pooja_option=registration.pooja_option,
        )
    plan.day_option = registration.day_option
    plan.recurrence_kind = kind  # ✅ SETS TYPE
    plan.recurrence_frequency = frequency
    plan.start_date = start_date
    plan.last_occurrence = start_date
    plan.amount = registration.total_amount
    plan.metadata = metadata
    plan.cart_payload = cart_item_payload or plan.cart_payload or {}
    plan.origin_registration = registration  # ✅ LINKS BACK
    plan.one_time_date = one_time_date if kind == RecurrenceKind.ONE_TIME_EXTRA else None
    plan.is_active = kind == RecurrenceKind.RECURRING
    plan.pause_from = None
    plan.pause_until = None

    if kind == RecurrenceKind.RECURRING:
        plan.next_occurrence = _calculate_next_occurrence(start_date, frequency)
    else:
        plan.next_occurrence = None
    plan.save()
    return plan
```

✅ **CORRECT**: Sets all necessary metadata on plan

---

## Helper Functions & Related Code

### 9. FIND EXISTING PLAN - Idempotence Check

**File**: `backend/pooja/services/recurrence.py`  
**Function**: `_find_existing_plan()`  
**Lines**: 150-162

```python
def _find_existing_plan(
    registration: PoojaRegistration,
    recurrence_kind: RecurrenceKind,
    one_time_date: Optional[date],
) -> Optional[RecurringPoojaPlan]:
    filters = {
        "donor": registration.donor,
        "pooja_option": registration.pooja_option,
        "day_option": registration.day_option,
        "recurrence_kind": recurrence_kind,
    }
    qs = RecurringPoojaPlan.objects.filter(**filters)
    if recurrence_kind == RecurrenceKind.ONE_TIME_EXTRA:
        qs = qs.filter(one_time_date=one_time_date)
    return qs.first()
```

✅ **CORRECT**: Prevents duplicate plans

---

### 10. BUILD PLAN METADATA - Captures Registration Details

**File**: `backend/pooja/services/recurrence.py`  
**Function**: `_build_plan_metadata()`  
**Lines**: 123-137

```python
def _build_plan_metadata(registration: PoojaRegistration) -> Dict[str, Any]:
    members = [
        {
            "name": member.name or "",
            "relationship": member.relationship or "",
            "tamil_star": member.tamil_star or "",
            "rasi": member.rasi or "",
            "gothra": member.gothra or "",
            "family_name": member.family_name or "",
            "date_of_birth": member.date_of_birth.isoformat() if member.date_of_birth else None,
        }
        for member in registration.members.all()
    ]
    return {
        "members": members,
        "day_option_id": registration.day_option_id,
        "post_prasadam": registration.post_prasadam,
        "additional_notes": registration.additional_notes or "",
        "is_group_registration": registration.is_group_registration,
        "quantity": registration.quantity,
    }
```

✅ **CORRECT**: Stores needed data for future registration creation

---

## Enum Definitions

### 11. RECURRENCE KIND CHOICES

**File**: `backend/pooja/models.py`  
**Class**: `RecurrenceKind`  
**Lines**: 160-163

```python
class RecurrenceKind(models.TextChoices):
    RECURRING = "recurring", "Recurring"
    ONE_TIME_EXTRA = "one_time_extra", "One-time extra"
```

✅ **CORRECT**: Proper enum for type

---

## Frontend Related Files

### 12. REGISTRATION CART ITEM TYPE

**File**: `frontend/src/pages/DonorProfile.tsx`  
**Interface**: `RegistrationCartItem`  
**Lines**: 87-99

```typescript
interface RegistrationCartItem {
  recurrenceKind?: RecurrenceKind | null;
  recurrenceFrequency?: string | null;
  recurrenceOneTimeDate?: string | null;
  recurrence_kind?: RecurrenceKind | null;
  // ... other fields ...
}
```

❌ **PROBLEM**: Assumes cart_item exists on registration

---

### 13. POOJA REGISTRATION INTERFACE

**File**: `frontend/src/pages/DonorProfile.tsx`  
**Interface**: `PoojaRegistration`  
**Lines**: 101-110

```typescript
interface PoojaRegistration {
  id: number;
  recurrence_kind?: RecurrenceKind | null;  // ❌ DOESN'T EXIST on registration model
  recurrence_frequency?: string | null;
  recurrence_one_time_date?: string | null;
  // ... other fields ...
}
```

❌ **PROBLEM**: Type assumes fields that don't exist on model

---

## Related Processes

### 14. PROCESS RECURRING PLANS - Orchestrator

**File**: `backend/pooja/services/recurrence.py`  
**Function**: `process_recurring_plans()`  
**Lines**: Somewhere in the file (search for "def process_recurring_plans")

```
🔴 CRITICAL: Main orchestrator that:
   - Finds all active recurring plans
   - Calls prepare_recurring_registration() for each
   - Which calls create_registration_from_plan()
```

---

## Signals & Hooks

### 15. PAYMENT SIGNALS - May Trigger Processing

**File**: `backend/payments/signals.py`  
**Function**: `update_passbook_on_registration()`  
**Lines**: 29-31

```python
@receiver(post_save, sender=PoojaRegistration)
def update_passbook_on_registration(sender, instance, created, **kwargs):
    """Regenerate passbook when a pooja registration is made."""
    if instance.donor_id:
        regenerate_donor_passbook(instance.donor_id)
```

⚠️ **NOTE**: Auto-created registrations trigger this signal, updating passbook

---

## Recurrence Enum Types

### 16. RECURRENCE FREQUENCY CHOICES

**File**: `backend/pooja/models.py`  
**Class**: `RecurrenceFrequency`  
**Lines**: 166-171

```python
class RecurrenceFrequency(models.TextChoices):
    MONTHLY = "monthly", "Monthly"
    QUARTERLY = "quarterly", "Quarterly"
    ANNUALLY = "annually", "Annually"
```

---

## Summary Table

| Location | File | Lines | Purpose | Status |
|----------|------|-------|---------|--------|
| **Bug Creation** | services/recurrence.py | 240-276 | Auto-create without metadata | 🔴 BUGGY |
| **Bug Trigger** | services/recurrence.py | 289-304 | Calls creation function | 🔴 BUGGY |
| **Bug Activation** | views.py | 333-336 | Calls on every API request | 🔴 BUGGY |
| **Filter Failure** | DonorProfile.tsx | 499-533 | Assumes missing fields | 🟡 INCOMPLETE |
| **Model Problem** | models.py | 95-138 | Missing recurrence field | 🔴 INSUFFICIENT |
| **Plan Model** | models.py | 164-235 | Has all needed fields | ✅ CORRECT |
| **Initial Creation** | serializers.py | 238-260 | Creates with plan | ✅ CORRECT |
| **Plan Creation** | services/recurrence.py | 168-209 | Sets all metadata | ✅ CORRECT |

---

## Files by Responsibility

### Files Causing the Bug
1. `backend/pooja/services/recurrence.py` - Auto-creation logic
2. `backend/pooja/views.py` - Trigger logic

### Files Failing to Prevent Bug
1. `backend/pooja/models.py` - Missing metadata fields
2. `frontend/src/pages/DonorProfile.tsx` - Incomplete filtering

### Files Working Correctly
1. `backend/pooja/serializers.py` - Initial registration
2. `backend/pooja/services/recurrence.py` - Plan creation
3. `frontend/src/pages/PoojaRegistrationPage.tsx` - Frontend registration form

---

**Use this reference to locate exact code for debugging and fixing.**
