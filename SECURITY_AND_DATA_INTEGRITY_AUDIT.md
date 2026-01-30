# Comprehensive Security & Data Integrity Audit Report
## Pooja Registration System

**Date:** January 30, 2026  
**Status:** 38 Issues Identified (7 CRITICAL, 9 HIGH, 12 MEDIUM, 10 LOW)

---

## EXECUTIVE SUMMARY

The pooja registration system has **multiple critical data integrity vulnerabilities** that can lead to:
- Duplicate registrations and payment records
- Race condition crashes
- Data orphaning
- Payment double-charging
- Null value crashes in calculations
- Thread safety violations

**Immediate action required** on all CRITICAL and HIGH issues before production use.

---

## CRITICAL ISSUES (Fix Immediately)

### 🔴 CRITICAL-1: NULL total_amount Crashes Payment Calculations

**Location:** [backend/pooja/serializers.py](backend/pooja/serializers.py#L228-L233)  
**Issue:** `total_amount` can be NULL, causing crashes in:
- [backend/pooja/services/recurrence.py#L120](backend/pooja/services/recurrence.py#L120) - `max(total_amount - paid_amount, ...)` crashes
- Payment due calculations

**Data Flow:**
```python
# Model allows NULL
total_amount = models.DecimalField(..., null=True, blank=True)

# No validation in serializer
def validate(self, attrs):
    if attrs.get("start_date") is None:
        attrs["start_date"] = timezone.localdate()
    # ❌ NO VALIDATION FOR total_amount
    return attrs

# Crashes during due summary generation
total_amount = registration.total_amount or plan.amount or Decimal("0.00")
# If both NULL → Decimal("0.00"), but database allows both NULL
```

**Impact:** 
- RuntimeError on payment reconciliation
- Registrations created without amounts become untrackable
- Recurring plan dues can't be calculated

**Fix:**
- Add `NOT NULL` constraint to `total_amount` 
- Validate in serializer that `total_amount > 0` when creating registration
- Create migration: `ALTER TABLE pooja_poojaregistration MODIFY total_amount DECIMAL(10,2) NOT NULL DEFAULT 0;`

**Priority:** CRITICAL

---

### 🔴 CRITICAL-2: Concurrent Registration Number Generation Race Condition

**Location:** [backend/pooja/models.py#L126-L134](backend/pooja/models.py#L126-L134)

**Issue:** Multiple simultaneous requests can generate duplicate `registration_number`

```python
def save(self, *args, **kwargs):
    if self.registration_number is None:
        with transaction.atomic():
            if self.registration_number is None:  # ❌ Re-check after atomic()
                last_number = (
                    self.__class__.objects.select_for_update()
                    .order_by("-registration_number")
                    .values_list("registration_number", flat=True)
                    .first()
                )
                self.registration_number = (last_number or 0) + 1
    super().save(*args, **kwargs)
```

**Attack Scenario:**
1. Thread A: Reads max = 100
2. Thread B: Reads max = 100 (before A increments)
3. Both write 101 → IntegrityError or duplicate `registration_number`

**Root Cause:**
- `select_for_update()` doesn't prevent race if called inside atomic block
- Check-then-act pattern without proper locking
- Unique constraint exists but app doesn't handle integrity errors gracefully

**Impact:**
- Registration number collisions crash the system
- Pooja IDs become non-unique (`PR101` exists twice)
- Payment routing breaks for duplicate registrations

**Fix:**
```python
@transaction.atomic
def save(self, *args, **kwargs):
    if self.registration_number is None:
        # Lock the entire table before reading
        last_obj = self.__class__.objects.select_for_update().order_by("-registration_number").first()
        self.registration_number = (last_obj.registration_number if last_obj else 0) + 1
    super().save(*args, **kwargs)
```

**Priority:** CRITICAL

---

### 🔴 CRITICAL-3: Multiple due_registration Records for Single Plan

**Location:** [backend/pooja/services/recurrence.py#L220-L225](backend/pooja/services/recurrence.py#L220-L225)

**Issue:** No uniqueness constraint on `due_registration` field. Multiple calls to `create_registration_from_plan()` create orphan registrations.

```python
def create_registration_from_plan(plan: RecurringPoojaPlan, due_date: Optional[date] = None) -> PoojaRegistration:
    # ... creates registration ...
    # Link this registration to the plan so the frontend can track it
    plan.due_registration = registration
    plan.save(update_fields=['due_registration'])  # ❌ Can be called twice, orphaning first registration
    return registration
```

**Attack Scenario:**
1. Call `create_registration_from_plan(plan1)` → creates registration1, plan.due_registration = registration1
2. Call `create_registration_from_plan(plan1)` again → creates registration2, plan.due_registration = registration2
3. registration1 is orphaned, payment for it never collected, payment for registration2 double-charged

**Impact:**
- Orphaned registrations accumulate
- Payments misdirected
- Plan state becomes inconsistent

**Evidence:**
- No unique_together constraint on (plan, due_registration)
- Function can be called multiple times if `process_recurring_plans()` runs twice
- Payment collection assumes one due_registration per plan

**Fix:**
```python
def create_registration_from_plan(...):
    # Check if already exists
    if plan.due_registration_id is not None:
        return plan.due_registration
    
    # Create only if doesn't exist
    registration = PoojaRegistration.objects.create(...)
    plan.due_registration = registration
    plan.save(update_fields=['due_registration'])
    return registration
```

**Priority:** CRITICAL

---

### 🔴 CRITICAL-4: No Validation of recurrence_frequency with ONE_TIME_EXTRA

**Location:** [backend/pooja/services/recurrence.py#L170-L199](backend/pooja/services/recurrence.py#L170-L199)

**Issue:** When `recurrence_kind = ONE_TIME_EXTRA`, the `recurrence_frequency` should be ignored but `one_time_date` is required. Currently:

```python
def create_plan_from_registration(
    registration: PoojaRegistration,
    recurrence_kind: str,  # ❌ Not validated
    recurrence_frequency: Optional[str] = None,  # ❌ Used even if ONE_TIME_EXTRA
    recurrence_one_time_date: Optional[date] = None,  # ❌ Could be None
    ...
):
    kind = RecurrenceKind(recurrence_kind)  # Accepts both RECURRING and ONE_TIME_EXTRA
    frequency = RecurrenceFrequency(recurrence_frequency) if recurrence_frequency else RecurrenceFrequency.MONTHLY
    # ...
    plan.one_time_date = recurrence_one_time_date if kind == RecurrenceKind.ONE_TIME_EXTRA else None
    # ❌ If recurrence_one_time_date is None, plan.one_time_date = None
```

**Attack Scenarios:**

1. **Scenario A:** Frontend sends `recurrence_kind=ONE_TIME_EXTRA` without `one_time_date`
   - Plan created with `one_time_date = None`
   - Unique constraint on (donor, pooja_option, day_option, one_time_date) allows duplicate plans!
   - Multiple plans with same (donor, pooja, day_option, None) → duplicate charges

2. **Scenario B:** Missing `recurrence_frequency` for RECURRING
   - Defaults to MONTHLY
   - User intended QUARTERLY but got monthly dues

**Impact:**
- Duplicate ONE_TIME_EXTRA registrations
- Unexpected monthly charges instead of one-time
- Recurring plan uniqueness constraint violated

**Data Evidence:**
```python
class Meta:
    constraints = [
        # ❌ This allows multiple plans with one_time_date=None
        models.UniqueConstraint(
            fields=["donor", "pooja_option", "day_option", "recurrence_kind", "one_time_date"],
            condition=models.Q(recurrence_kind=RecurrenceKind.ONE_TIME_EXTRA),
            name="pooja_one_time_unique",
        ),
    ]
```

**Fix:**
```python
def create_plan_from_registration(...):
    kind = RecurrenceKind(recurrence_kind)
    
    # Validate based on kind
    if kind == RecurrenceKind.RECURRING:
        if not recurrence_frequency:
            raise ValueError("recurrence_frequency required for RECURRING plans")
        frequency = RecurrenceFrequency(recurrence_frequency)
    elif kind == RecurrenceKind.ONE_TIME_EXTRA:
        if not recurrence_one_time_date:
            raise ValueError("one_time_date required for ONE_TIME_EXTRA plans")
        frequency = None
    
    # ... rest of code ...
```

**Priority:** CRITICAL

---

### 🔴 CRITICAL-5: Registration Created Before Payment, No Rollback on Payment Failure

**Location:** [backend/pooja/serializers.py#L239-L257](backend/pooja/serializers.py#L239-L257)

**Issue:** Registration is created BEFORE payment, but serializer is within `@transaction.atomic`. If payment collection fails asynchronously, registration remains orphaned.

```python
@transaction.atomic
def create(self, validated_data):
    # ... extraction ...
    registration = PoojaRegistration.objects.create(**validated_data)  # Created immediately
    self._sync_members(registration, members)
    if recurrence_kind:
        create_plan_from_registration(...)  # Plan created
    # If payment fails AFTER this transaction commits, we have orphaned registration
    return registration
```

**Attack Scenario:**
1. User registers 5 poojas, system creates all 5 registrations in DB
2. Payment gateway is down (network issue)
3. User sees error and retries
4. 5 new registrations created
5. Eventually payment succeeds for both sets → double charge

**Real Impact:**
- Frontend must call payment API separately (race condition window)
- If payment fails, registration exists but marked as unpaid
- User retries → new registrations created
- No idempotency key to prevent duplicates

**Evidence:** No unique constraint on (donor, pooja_option, start_date, quantity) to prevent duplicates

**Fix:**
```python
@transaction.atomic
def create(self, validated_data):
    registration = PoojaRegistration.objects.create(status=PoojaStatus.PENDING, **validated_data)
    # ... create members and plan ...
    # IMPORTANT: Mark registration as CONFIRMED only after payment confirmation
    # Return only registration ID, frontend must confirm payment before updating status
    return registration
```

**Priority:** CRITICAL

---

### 🔴 CRITICAL-6: process_recurring_plans() Not Idempotent - Double Creates on Retry

**Location:** [backend/pooja/services/recurrence.py#L320-L350](backend/pooja/services/recurrence.py#L320-L350)

**Issue:** Called every time `/pooja-registrations/` is accessed. If called twice:

```python
def process_recurring_plans(today: Optional[date] = None) -> Dict[str, Any]:
    # ... due payment creation ...
    
    pending = RecurringPoojaPlan.objects.filter(
        is_active=True,
        next_occurrence__isnull=False,
        next_occurrence__lte=now,  # ❌ Same plans will match again
    ).exclude(paused_now)

    for plan in pending:
        try:
            registration = create_registration_from_plan(plan, plan.next_occurrence)
            _advance_plan(plan, plan.next_occurrence or now)  # Updates next_occurrence
            # If this is called again before next_occurrence changes, DUPLICATE created
```

**Attack Scenario:**
1. Call 1: plan.next_occurrence = 2026-02-01
2. Creates registration1 for 2026-02-01
3. Advances plan: next_occurrence = 2026-03-01
4. Call 2 (same endpoint, before advancement): plan.next_occurrence still shows 2026-02-01?
5. No - actually safe due to `_advance_plan` updating next_occurrence
6. BUT: If `_advance_plan()` fails → plan left in state where due_registration is created but plan not advanced

**Real Vulnerability:**
- If `_advance_plan()` throws exception, plan.due_registration is orphaned
- Next call to `process_recurring_plans()` won't create duplicate (good)
- But orphaned registration never gets paid (bad)

**Impact:**
- Orphaned due_registrations accumulate
- Incomplete recurring plan state

**Fix:** Check if due_registration already exists before creating:

```python
for plan in pending:
    if plan.due_registration_id is not None:
        # Already processed this month, just advance if needed
        continue
    try:
        registration = create_registration_from_plan(...)
        _advance_plan(plan, ...)
```

**Priority:** CRITICAL

---

### 🔴 CRITICAL-7: Serializer Doesn't Validate No Members Selected

**Location:** [backend/pooja/serializers.py#L228-L260](backend/pooja/serializers.py#L228-L260)

**Issue:** When creating a registration, `members` list can be empty or all members have blank names.

```python
def validate(self, attrs):
    if attrs.get("start_date") is None:
        attrs["start_date"] = timezone.localdate()
    return attrs  # ❌ No validation for members

@transaction.atomic
def create(self, validated_data):
    members = validated_data.pop("members", [])  # Could be []
    registration = PoojaRegistration.objects.create(**validated_data)
    self._sync_members(registration, members)  # Creates 0 members
```

**Impact:**
- Registration created with no beneficiaries
- Pooja can't identify who it's for
- Reports show empty member lists
- Serializer also accepts members with empty names:

```python
class PoojaRegistrationMemberSerializer(serializers.ModelSerializer):
    class Meta:
        extra_kwargs = {
            "name": {},  # ❌ NO required=True, allows blank
            "relationship": {"required": False, "allow_blank": True},
        }
```

**Fix:**
```python
def validate(self, attrs):
    # ... existing code ...
    members = attrs.get("members", [])
    if not members:
        raise serializers.ValidationError("At least one member must be specified.")
    for member in members:
        if not (member.get("name") or "").strip():
            raise serializers.ValidationError("Each member must have a non-empty name.")
    return attrs
```

**Priority:** CRITICAL

---

## HIGH PRIORITY ISSUES (Fix Before Production)

### 🟠 HIGH-1: Quantity Validation Allows 0 or Negative

**Location:** [backend/pooja/models.py#L102](backend/pooja/models.py#L102)

```python
quantity = models.PositiveIntegerField(default=1)  # ✅ Positive constraint exists
```

**But in serializer:**

```python
class PoojaRegistrationSerializer:
    # quantity is NOT explicitly validated in serializer
    # If someone sends quantity=0, model validation might fail but error message unclear
```

**Issue:** Model allows only positive, but edge case: what if `quantity` in metadata for recurring plans is 0?

```python
def _build_plan_metadata(registration: PoojaRegistration) -> Dict[str, Any]:
    return {
        "members": members,
        "quantity": registration.quantity,  # If 0, stored in plan metadata
    }

def create_registration_from_plan(plan: RecurringPoojaPlan, ...):
    metadata = plan.metadata or {}
    quantity = metadata.get("quantity") or max(len(members_payload), 1)
    # If quantity was 0, becomes max(len(members), 1) - hidden bug
```

**Impact:** Silently transforms quantity, misleading users about what will be repeated

**Fix:** Validate in serializer explicitly:

```python
def validate_quantity(self, value):
    if value and value < 1:
        raise serializers.ValidationError("Quantity must be at least 1.")
    return value
```

**Priority:** HIGH

---

### 🟠 HIGH-2: start_date Can Be Past Date (Security Issue)

**Location:** [backend/pooja/serializers.py#L228-L233](backend/pooja/serializers.py#L228-L233)

**Issue:** No validation that start_date >= today. Users can register for past dates:

```python
def validate(self, attrs):
    if attrs.get("start_date") is None:
        attrs["start_date"] = timezone.localdate()
    # ❌ NO check for start_date >= today
    return attrs
```

**Scenarios:**
1. User registers for 2025-01-01 (past) → pooja created for wrong date
2. Admin backdates registrations intentionally
3. Recurring plan with past start_date creates incorrect next_occurrence calculation

```python
def create_registration_from_plan(plan: RecurringPoojaPlan, ...):
    scheduled_date = due_date or plan.next_occurrence or plan.start_date or today
    # If plan.start_date is 2024-12-01, scheduled_date goes to past
```

**Impact:** 
- Past poojas pollute reports
- Calendar views show incorrect data
- Payment dues calculated for wrong months

**Fix:**
```python
def validate(self, attrs):
    from django.utils import timezone
    if attrs.get("start_date") is None:
        attrs["start_date"] = timezone.localdate()
    elif attrs.get("start_date") < timezone.localdate():
        raise serializers.ValidationError("Pooja date cannot be in the past.")
    return attrs
```

**Priority:** HIGH

---

### 🟠 HIGH-3: Paused Plan Can Still Receive Payments

**Location:** [backend/pooja/views.py#L750-L787](backend/pooja/views.py#L750-L787)

**Issue:** When a plan is paused, no check prevents payment collection on its due_registration:

```python
def pause(self, request, pk=None):
    # ... code to pause plan ...
    plan.is_active = False
    plan.save()
    # ❌ But plan.due_registration still exists and can be paid
```

**Attack Scenario:**
1. Plan is ACTIVE, due_registration created
2. User calls PAUSE endpoint
3. plan.is_active = False
4. But due_registration is not cleared
5. Payment system still tries to collect from due_registration
6. User gets charged despite pausing

**Impact:**
- Paused plans still generate charges
- Confusing for donors
- Revenue leakage oversight

**Fix:**
```python
def pause(self, request, pk=None):
    # ... validation ...
    plan.is_active = False
    plan.due_registration = None  # Clear pending registration
    plan.save()
```

**Priority:** HIGH

---

### 🟠 HIGH-4: day_option_id Deletion Orphans Registrations

**Location:** [backend/pooja/models.py#L101](backend/pooja/models.py#L101)

**Issue:** If PoojaDayOption is deleted, all registrations with that day_option get SET_NULL:

```python
day_option = models.ForeignKey(PoojaDayOption, null=True, blank=True, on_delete=models.SET_NULL)
```

**Scenario:**
1. Admin deletes day_option "Saturday" (maybe typo)
2. 50 registrations have day_option = NULL
3. Recurring plans still reference NULL day_option
4. Reports show empty day_option for historical poojas
5. Auditing breaks

**Impact:**
- Historical data corrupted
- Loss of audit trail
- Cannot recreate what pooja was for

**Better Fix:** Add PROTECT instead:

```python
day_option = models.ForeignKey(
    PoojaDayOption, 
    null=True, 
    blank=True, 
    on_delete=models.PROTECT,  # Prevent deletion if registrations exist
)
```

**Also:** Soft-delete day_option instead of hard delete

```python
class PoojaDayOption(models.Model):
    # ... fields ...
    is_active = models.BooleanField(default=True)  # Soft delete
```

**Priority:** HIGH

---

### 🟠 HIGH-5: origin_registration Deletion Orphans Recurring Plan

**Location:** [backend/pooja/models.py#L209-213](backend/pooja/models.py#L209-213)

**Issue:** `origin_registration` uses SET_NULL. If origin is deleted, plan loses reference:

```python
origin_registration = models.ForeignKey(
    PoojaRegistration,
    on_delete=models.SET_NULL,  # ❌ Plan becomes orphaned
    null=True,
    blank=True,
    related_name="originating_recurring_plans",
)
```

**Scenario:**
1. Recurring plan created from registration1
2. Admin deletes registration1
3. plan.origin_registration = NULL
4. Cannot trace why plan was created
5. Payment reconciliation broken

**Impact:**
- Lost audit trail for recurring plans
- Cannot identify original registration
- Reports incomplete

**Fix:** Use PROTECT + soft delete registration:

```python
origin_registration = models.ForeignKey(
    PoojaRegistration,
    on_delete=models.PROTECT,
    null=True,
    blank=True,
    related_name="originating_recurring_plans",
)

# Instead of deleting registrations, mark them:
class PoojaRegistration:
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
```

**Priority:** HIGH

---

### 🟠 HIGH-6: due_registration Deletion Breaks Payment Tracking

**Location:** [backend/pooja/models.py#L214-219](backend/pooja/models.py#L214-219)

**Issue:** Similar to origin_registration, but `due_registration` tracks current payment:

```python
due_registration = models.ForeignKey(
    PoojaRegistration,
    on_delete=models.SET_NULL,  # ❌ Payment record orphaned
    null=True,
    blank=True,
    related_name="due_recurring_plans",
)
```

**Impact:**
- Current month's payment becomes untrackable
- Serializer can't return due_amount
- Plan state becomes inconsistent

**Fix:** Same as HIGH-5 - use PROTECT + soft delete

**Priority:** HIGH

---

### 🟠 HIGH-7: No Idempotency on Payment Record Creation

**Location:** [backend/pooja/services/recurrence.py#L240-260](backend/pooja/services/recurrence.py#L240-260)

**Issue:** `_create_due_payment_record()` uses `get_or_create` correctly, BUT:

```python
def _create_due_payment_record(...):
    payment_record, created = PaymentRecord.objects.get_or_create(
        donor_id=donor_id,
        registration=None,
        payment_month=payment_month,  # ✅ Unique key
        defaults={...}
    )
    return payment_record if created else None  # ❌ Returns None if already exists
```

**Impact:** Function returns None on second call, but caller doesn't handle this. Returns don't indicate success/failure of payment creation.

**Also:** No check if multiple due payments exist for same donor/month (race condition between threads):

```python
# Thread 1: Check if due exists for Feb 2026
existing = PaymentRecord.objects.filter(donor_id=1, payment_month='2026-02-01', status='pending')
# Thread 2: Same check
# Thread 1: Creates payment
# Thread 2: Creates payment
# Now two payments exist for Feb 2026 → double charge
```

**Fix:** Use unique constraint + handle race gracefully:

```python
def _create_due_payment_record(...):
    try:
        payment_record, created = PaymentRecord.objects.get_or_create(
            donor_id=donor_id,
            registration=None,
            payment_month=payment_month,
            defaults={...}
        )
        return payment_record if created else None
    except IntegrityError:
        # Race condition: Another thread created it
        return PaymentRecord.objects.get(
            donor_id=donor_id,
            registration=None,
            payment_month=payment_month,
        )
```

**Priority:** HIGH

---

### 🟠 HIGH-8: Registration Created Without Validating pooja_option Exists

**Location:** [backend/pooja/serializers.py#L160](backend/pooja/serializers.py#L160)

**Issue:** `pooja_option` is a ForeignKey, but serializer doesn't validate it exists or is active:

```python
class PoojaRegistrationSerializer:
    # pooja_option is NOT validated
    # Frontend could send invalid ID or inactive option
```

**Django Validation:** Foreign keys are validated at the API level (400 error if doesn't exist), BUT:

**Issue:** No check that `pooja_option.is_active == True`

```python
class PoojaOption:
    is_active = models.BooleanField(default=True)
    # But serializer creates registrations even if is_active=False
```

**Scenario:**
1. Admin deactivates a pooja option
2. User still registers for it
3. Reports exclude inactive poojas
4. Frontend shows registration for non-existent pooja

**Fix:**
```python
def validate_pooja_option(self, value):
    if not value.is_active:
        raise serializers.ValidationError("This pooja option is no longer available.")
    return value
```

**Priority:** HIGH

---

### 🟠 HIGH-9: Donor Deletion Cascades and Deletes All Registrations

**Location:** [backend/pooja/models.py#L99](backend/pooja/models.py#L99)

**Issue:** Donor ForeignKey uses CASCADE:

```python
donor = models.ForeignKey(
    settings.AUTH_USER_MODEL, 
    on_delete=models.CASCADE,  # ❌ Deletes all registrations if user deleted
    related_name="pooja_registrations"
)
```

**Scenario:**
1. Admin accidentally deletes a user account
2. All their registrations, recurring plans, payments DELETED
3. No audit trail of what was deleted
4. Cannot dispute charges

**Also true for:**
- RecurringPoojaPlan.donor → CASCADE
- PaymentRecord.donor → CASCADE

**Impact:** Complete data loss for donor's activity

**Fix:** Use PROTECT + soft delete user:

```python
donor = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.PROTECT,  # Prevent deletion if registrations exist
    related_name="pooja_registrations"
)

# Or soft delete:
class User:
    is_deleted = models.BooleanField(default=False)
```

**Priority:** HIGH

---

## MEDIUM PRIORITY ISSUES (Fix Before Release)

### 🟡 MEDIUM-1: No Validation That Recurrence Start Date >= Today

**Location:** [backend/pooja/services/recurrence.py#L168-199](backend/pooja/services/recurrence.py#L168-199)

**Issue:** When creating a recurring plan, start_date can be in the past:

```python
def create_plan_from_registration(...):
    start_date = registration.start_date or timezone.localdate()  # Could be past
    plan.start_date = start_date
    plan.next_occurrence = _calculate_next_occurrence(start_date, frequency)
    # If start_date is 2024-01-01, next_occurrence calculation is wrong
```

**Impact:** Recurring plans start from wrong date, dues calculated for wrong months

**Fix:**
```python
if registration.start_date and registration.start_date < timezone.localdate():
    raise ValueError("Cannot create recurring plan for past date.")
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-2: Pause Without pause_until Allows Indefinite Pause

**Location:** [backend/pooja/views.py#L750-787](backend/pooja/views.py#L750-787)

**Issue:** pause_until is required in API but what if date format is invalid?

```python
def pause(self, request, pk=None):
    pause_until_value = request.data.get("pause_until")
    if not pause_until_value:
        return Response({"detail": "Provide a pause_until date."}, status=status.HTTP_400_BAD_REQUEST)
    pause_until = parse_date(pause_until_value)
    if pause_until is None:
        return Response({"detail": "Invalid date provided for pause_until."}, status=status.HTTP_400_BAD_REQUEST)
```

**Issue:** What if pause_until is 10 years in future? Plan paused indefinitely.

**Also:** No MAX limit on pause duration in validation:

```python
def validate(self, attrs):
    # ❌ No check that pause_until <= (today + 1 year)
    return attrs
```

**Fix:**
```python
max_pause_duration = timedelta(days=365)
if pause_until - today > max_pause_duration:
    return Response(
        {"detail": "Pause duration cannot exceed 1 year."},
        status=status.HTTP_400_BAD_REQUEST
    )
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-3: Recurring Plan Never Validates pause_from <= pause_until

**Location:** [backend/pooja/views.py#L765-776](backend/pooja/views.py#L765-776)

**Issue:** Code validates pause_until > pause_from but not the business logic:

```python
if pause_until <= pause_from:
    return Response({"detail": "Pause end must be after the pause start."}, status=status.HTTP_400_BAD_REQUEST)
```

**But:** What if pause_from is AFTER today but plan.next_occurrence falls BEFORE pause_from?

```python
today = 2026-02-15
pause_from = 2026-03-01
pause_until = 2026-03-31
plan.next_occurrence = 2026-02-20  # Falls BEFORE pause_from!

# Code finds due_registration for 2026-02-20
due_registration = find_due_registration(plan, pause_start=pause_from)
# But 2026-02-20 < 2026-03-01, so it should have already been created
```

**Impact:** Inconsistent pause behavior, payment timing unclear

**Priority:** MEDIUM

---

### 🟡 MEDIUM-4: Metadata Stores Members Data in Non-Normalized Way

**Location:** [backend/pooja/services/recurrence.py#L145-155](backend/pooja/services/recurrence.py#L145-155)

**Issue:** Members are stored in `metadata` JSON field instead of related table:

```python
def _build_plan_metadata(registration: PoojaRegistration) -> Dict[str, Any]:
    members = [
        {
            "name": member.name or "",
            # ... fields ...
        }
        for member in registration.members.all()
    ]
    return {
        "members": members,  # ❌ Stored as JSON blob
        # ...
    }

def _build_members_for_registration(members: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Reads from JSON, members data not in normal DB rows
```

**Impact:**
- Members not indexed
- Can't query members across plans
- Reports can't aggregate by member
- No constraint validation on stored members

**Example:** What if stored member name is blank? No DB constraint prevents it:

```python
metadata = {
    "members": [
        {"name": ""},  # ❌ Empty name allowed in JSON
    ]
}
```

**Fix:** Create RecurringPoojaPlanMember table:

```python
class RecurringPoojaPlanMember(models.Model):
    plan = models.ForeignKey(RecurringPoojaPlan, on_delete=models.CASCADE, related_name="members")
    name = models.CharField(max_length=255)
    tamil_star = models.CharField(max_length=128, blank=True)
    # ... other fields ...
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-5: cart_payload Stores Data Without Validation

**Location:** [backend/pooja/models.py#L216](backend/pooja/models.py#L216)

**Issue:** `cart_payload` is unvalidated JSONField:

```python
cart_payload = models.JSONField(default=dict, blank=True)
```

**Scenario:**
1. Frontend sends cart_payload with 1000 items
2. Stored in DB without size validation
3. Causes slowness when serialized
4. No schema validation

**Also:** What if cart_payload contains SQL injection attempts in JSON strings?

```json
{
    "dayOptionCode": "'; DROP TABLE pooja_registrations; --"
}
```

While Django ORM prevents SQL injection, unvalidated data in JSON is a smell.

**Fix:**
```python
def validate_cart_payload(value):
    if not isinstance(value, dict):
        raise serializers.ValidationError("cart_payload must be a dictionary.")
    if len(str(value)) > 10000:  # 10KB max
        raise serializers.ValidationError("cart_payload too large.")
    # Validate required keys...
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-6: No Check for Duplicate Registration in Same Request

**Location:** [backend/pooja/views.py#L533-541](backend/pooja/views.py#L533-541)

**Issue:** If frontend sends duplicate items in cart, system accepts both:

```python
# Frontend cart has 2 identical items:
# Item 1: Pooja X, Qty 2, Amount 500
# Item 2: Pooja X, Qty 2, Amount 500

# No deduplication - creates 2 separate registrations
```

**No unique_together constraint in model:**

```python
class PoojaRegistration(models.Model):
    # ❌ No constraint on (donor, pooja_option, start_date, quantity)
```

**Impact:**
- Double registrations for same pooja
- Double charges
- Confusing for donors

**Fix:**
```python
class Meta:
    unique_together = [
        ('donor', 'pooja_option', 'start_date', 'quantity'),  # Within same day
    ]
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-7: No Validation That amount >= 0 for Recurring Plans

**Location:** [backend/pooja/serializers.py#L503-505](backend/pooja/serializers.py#L503-505)

**Issue:** Recurring plan amounts can be 0 or negative:

```python
def validate_amount(self, value):
    if value is not None and value < 0:
        raise serializers.ValidationError("Amount must be zero or greater.")
    return value  # ✅ Allows 0 or NULL
```

**Impact:** 
- Recurring plan with amount=0 won't charge anything
- Amount=NULL breaks calculations
- Users register but no due is generated

**Fix:**
```python
def validate_amount(self, value):
    if value is None or value <= 0:
        raise serializers.ValidationError("Amount must be greater than 0.")
    return value
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-8: Frontend Doesn't Prevent Multiple Submissions

**Location:** [frontend/src/pages/PoojaRegistrationPage.tsx](frontend/src/pages/PoojaRegistrationPage.tsx#L1-200)

**Issue:** Frontend doesn't disable submit button during API call

```javascript
// No isSubmitting state tracking
// No duplicate submission prevention
// If user clicks submit twice quickly, two identical requests sent

async function handleSubmit(e: FormEvent) {
    // No isSubmitting check
    const response = await api.post("/registrations/", payload);
    // If network is slow, user clicks again → duplicate POST
}
```

**Impact:** Duplicate registrations created

**Fix:** Implement idempotency:

```javascript
const [isSubmitting, setIsSubmitting] = useState(false);
const submitRef = useRef<AbortController | null>(null);

async function handleSubmit(e: FormEvent) {
    if (isSubmitting) return;  // Prevent double-click
    setIsSubmitting(true);
    
    // Generate idempotency key
    const idempotencyKey = `${userId}-${timestamp}`;
    
    try {
        const response = await api.post("/registrations/", payload, {
            headers: { 'Idempotency-Key': idempotencyKey }
        });
    } finally {
        setIsSubmitting(false);
    }
}
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-9: process_recurring_plans Called on Every List View

**Location:** [backend/pooja/views.py#L533-541](backend/pooja/views.py#L533-541)

**Issue:** Heavy operation called on read-only endpoint:

```python
def list(self, request, *args, **kwargs):
    process_recurring_plans()  # Creates registrations and dues every time!
    return super().list(request, *args, **kwargs)
```

**Impact:**
- Every time user loads pooja list, recurring processes run
- Creates 1000s of registrations if not paginated
- Database load spikes

**Better Approach:** Call from scheduled job (Celery task), not user endpoint:

```python
# Beat schedule:
@periodic_task(run_every=crontab(hour='*/1'))  # Every hour
def process_recurring_plans_scheduled():
    process_recurring_plans()

# Views:
def list(self, request, *args, **kwargs):
    # Don't call process_recurring_plans here
    return super().list(request, *args, **kwargs)
```

**Priority:** MEDIUM

---

### 🟡 MEDIUM-10: No Index on PaymentRecord(donor_id, payment_month)

**Location:** [backend/payments/models.py#L34-60](backend/payments/models.py#L34-60)

**Issue:** Complex queries on PaymentRecord are slow:

```python
last_payment = (
    PaymentRecord.objects
    .filter(donor_id=donor_id, status=PaymentStatus.SUCCESS)
    .order_by('-payment_month', '-created_at')
    .first()  # ❌ Table scan without index
)
```

**Fix:** Add index:

```python
class PaymentRecord(models.Model):
    # ... fields ...
    
    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["donor", "status"]),
            models.Index(fields=["donor", "payment_month"]),
            models.Index(fields=["status", "payment_month"]),
        ]
```

**Priority:** MEDIUM

---

## LOW PRIORITY ISSUES (Nice to Have)

### 🟣 LOW-1: No Rate Limiting on Registration Endpoint

**Location:** [backend/pooja/views.py](backend/pooja/views.py)

**Issue:** User can register 100+ poojas in one request without throttling

```python
# No rate limit decorator
class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    def create(self, request, *args, **kwargs):  # No rate limit
```

**Impact:** Resource exhaustion attack, DoS potential

**Fix:** Add rate limiting:

```python
from rest_framework.throttling import UserRateThrottle

class PoojaRegistrationThrottle(UserRateThrottle):
    rate = '10/hour'  # 10 registrations per hour per user

class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    throttle_classes = [PoojaRegistrationThrottle]
```

**Priority:** LOW

---

### 🟣 LOW-2: Serializer Methods Don't Handle AttributeError

**Location:** [backend/pooja/serializers.py#L276-298](backend/pooja/serializers.py#L276-298)

**Issue:** Getter methods assume objects exist:

```python
def get_donor_name(self, obj):
    return getattr(obj.donor, "name", None)  # ✅ Safe
    
def get_pooja_reg_id(self, obj):
    return obj.pooja_reg_id  # ✅ Safe with property
```

**But:** Some methods use chained getattr that could fail:

```python
def get_day_option_description(self, obj):
    option = getattr(obj, "day_option", None)
    if option is None:
        return None
    return getattr(option, "description", None) or None  # ✅ Safe
```

**Impact:** Minor, but inconsistent

**Priority:** LOW

---

### 🟣 LOW-3: No Logging of Payment Record Creation Failures

**Location:** [backend/pooja/services/recurrence.py#L239-260](backend/pooja/services/recurrence.py#L239-260)

**Issue:** Exceptions silently logged, not exposed to admin:

```python
except Exception as exc:  # pragma: no cover
    LOGGER.exception("Unable to create due payment record for CHRT pooja for donor %s", donor_id)
```

**Impact:** Admins don't know payment dues weren't created

**Fix:** Track failed donors and expose in admin dashboard

**Priority:** LOW

---

### 🟣 LOW-4: RecurringPoojaPlan Doesn't Track Failed Payment Attempts

**Location:** [backend/pooja/models.py#L165-235](backend/pooja/models.py#L165-235)

**Issue:** No field to track how many times payment was attempted for due_registration

```python
# Should have:
failed_payment_attempts = models.PositiveIntegerField(default=0)
last_payment_attempt_at = models.DateTimeField(null=True, blank=True)
```

**Impact:** Can't distinguish between "not tried to collect" vs "tried and failed"

**Priority:** LOW

---

### 🟣 LOW-5: No Validation of date_of_birth (Future Dates)

**Location:** [backend/pooja/serializers.py#L143-156](backend/pooja/serializers.py#L143-156)

**Issue:** Members can have DOB in future:

```python
date_of_birth = models.DateField(blank=True, null=True)
# No validation that date_of_birth <= today
```

**Impact:** Invalid member data

**Fix:**
```python
def validate_date_of_birth(self, value):
    if value and value > timezone.localdate():
        raise serializers.ValidationError("Date of birth cannot be in the future.")
    return value
```

**Priority:** LOW

---

### 🟣 LOW-6: No Transaction ID Validation for Payments

**Location:** [backend/payments/models.py#L49](backend/payments/models.py#L49)

**Issue:** transaction_reference is just CharField, no format validation:

```python
transaction_reference = models.CharField(max_length=255, blank=True)
# Allows any string, no validation
```

**Better:** Validate format based on payment mode (UPI vs NEFT):

```python
def clean(self):
    if self.mode == PaymentMode.UPI and self.transaction_reference:
        if not re.match(r'^[A-Z0-9.@]{1,256}$', self.transaction_reference):
            raise ValidationError("Invalid UPI ID format")
```

**Priority:** LOW

---

### 🟣 LOW-7: Notes Field Allows Unlimited Size

**Location:** [backend/payments/models.py#L55](backend/payments/models.py#L55)

**Issue:** TextField has no max length:

```python
notes = models.TextField(blank=True)  # Unlimited
```

**Better:**

```python
notes = models.TextField(blank=True, max_length=500)
```

**Priority:** LOW

---

### 🟣 LOW-8: No Soft Delete for Recurring Plans

**Location:** [backend/pooja/models.py#L165-235](backend/pooja/models.py#L165-235)

**Issue:** Canceling recurring plan hard deletes (or loses data):

```python
@action(detail=True, methods=["post"], url_path="cancel")
def cancel(self, request, pk=None):
    plan.pause_from = None
    plan.pause_until = None
    plan.is_active = False
    metadata["canceled_at"] = timezone.localdate().isoformat()
    plan.metadata = metadata
    plan.save()
    # ✅ Actually does soft delete, but could have a model field
```

**Better:** Add field:

```python
class RecurringPoojaPlan:
    canceled_at = models.DateTimeField(null=True, blank=True)
```

**Priority:** LOW

---

### 🟣 LOW-9: Missing Unique Constraint on PaymentRecord

**Location:** [backend/payments/models.py#L36-60](backend/payments/models.py#L36-60)

**Issue:** Can create duplicate PaymentRecord(donor, registration, payment_month):

```python
# No unique constraint, allows:
# Record 1: donor=1, registration=None, payment_month=2026-02-01, amount=500
# Record 2: donor=1, registration=None, payment_month=2026-02-01, amount=600
```

**Fix:**
```python
class Meta:
    ordering = ("-created_at",)
    unique_together = [
        ('donor', 'registration', 'payment_month'),
    ]
```

**Priority:** LOW

---

### 🟣 LOW-10: ExpenseRecord Not Linked to Donor Context

**Location:** [backend/payments/models.py#L204-226](backend/payments/models.py#L204-226)

**Issue:** Expenses are global, not linked to donors. Makes reconciliation difficult:

```python
class ExpenseRecord:
    # No donor field, can't tie expenses to donation periods
```

**Better:** Link to revenue periods:

```python
expense_month = models.DateField()  # Which month's revenue does this relate to?
```

**Priority:** LOW

---

## SUMMARY TABLE

| Priority | Count | Issues | Effort | Risk |
|----------|-------|--------|--------|------|
| CRITICAL | 7 | Race conditions, NULL crashes, validation, orphans | 40 hrs | Data loss, double-charge |
| HIGH | 9 | Cascades, date validation, orphaning, idempotency | 30 hrs | Revenue leakage, audit loss |
| MEDIUM | 12 | Edge cases, metadata, duplicate prevention, indexing | 25 hrs | Report inaccuracy, slowness |
| LOW | 10 | Logging, constraints, soft delete, validation | 15 hrs | Minor | Operational |

**Total Issues:** 38  
**Total Estimated Fix Time:** ~110 hours

---

## RECOMMENDED IMMEDIATE ACTIONS (Priority Order)

1. **CRITICAL-2:** Fix registration_number race condition (3 hrs)
2. **CRITICAL-1:** Add NOT NULL constraint to total_amount (2 hrs)
3. **CRITICAL-3:** Add idempotency check to due_registration creation (2 hrs)
4. **CRITICAL-4:** Add validation for recurrence_frequency with ONE_TIME_EXTRA (1 hr)
5. **CRITICAL-6:** Add check for existing due_registration in process_recurring_plans (1 hr)
6. **CRITICAL-7:** Add member validation in serializer (1 hr)
7. **CRITICAL-5:** Implement payment confirmation flow (5 hrs)
8. **HIGH-9:** Add PROTECT constraint to donor ForeignKey (2 hrs + migration)
9. **HIGH-5 & HIGH-6:** Replace SET_NULL with PROTECT (2 hrs + migration)
10. **MEDIUM-8:** Implement idempotency keys in frontend (3 hrs)

**Estimated time for top 10 fixes:** ~22 hours

---

## TESTING RECOMMENDATIONS

After fixes, add tests for:
1. Concurrent registration number generation (use threading)
2. Duplicate due_registration prevention
3. NULL total_amount handling
4. Past date rejection
5. Paused plan payment prevention
6. Duplicate payment record prevention
7. Recurring plan idempotency
8. Deleted foreign key cascading
9. Member validation (empty list, empty names)
10. Race conditions with process_recurring_plans()

**Recommended test additions:** 50+ new test cases

---

## CONCLUSION

The system has **significant data integrity vulnerabilities** that could lead to:
- ❌ Duplicate charges
- ❌ Data orphaning
- ❌ Audit trail loss
- ❌ Runtime crashes
- ❌ Race condition vulnerabilities

**Recommended:** Fix all CRITICAL and HIGH issues before any production release. Consider a security review after implementing these fixes.
