# Security Audit - Quick Fix Reference

## CRITICAL FIXES (Do First - 22 hours)

### 1. Fix Registration Number Race Condition
**File:** `backend/pooja/models.py:126-134`
**Change:**
```python
# BEFORE
def save(self, *args, **kwargs):
    if self.registration_number is None:
        with transaction.atomic():
            if self.registration_number is None:  # Bad pattern
                last_number = self.__class__.objects.select_for_update()...

# AFTER
@transaction.atomic
def save(self, *args, **kwargs):
    if self.registration_number is None:
        last_obj = self.__class__.objects.select_for_update().order_by("-registration_number").first()
        self.registration_number = (last_obj.registration_number if last_obj else 0) + 1
    super().save(*args, **kwargs)
```

---

### 2. Add NOT NULL to total_amount
**Files:** 
- `backend/pooja/models.py:111` (model field)
- `backend/pooja/serializers.py:228-233` (validation)

**Changes:**
```python
# models.py
total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Remove null=True

# serializers.py - add validation
def validate(self, attrs):
    if attrs.get("start_date") is None:
        attrs["start_date"] = timezone.localdate()
    
    # NEW
    total_amount = attrs.get("total_amount")
    if not total_amount or total_amount <= 0:
        raise serializers.ValidationError("Total amount must be greater than 0.")
    
    return attrs
```

**Migration:**
```bash
python manage.py makemigrations pooja
python manage.py migrate pooja
```

---

### 3. Idempotency for due_registration
**File:** `backend/pooja/services/recurrence.py:219-225`

**Change:**
```python
# BEFORE
def create_registration_from_plan(plan: RecurringPoojaPlan, due_date: Optional[date] = None):
    registration = PoojaRegistration.objects.create(...)  # Creates new every time
    plan.due_registration = registration
    plan.save(update_fields=['due_registration'])

# AFTER
def create_registration_from_plan(plan: RecurringPoojaPlan, due_date: Optional[date] = None):
    # Check if already exists
    if plan.due_registration_id is not None:
        return plan.due_registration
    
    registration = PoojaRegistration.objects.create(...)
    plan.due_registration = registration
    plan.save(update_fields=['due_registration'])
    return registration
```

---

### 4. Validate recurrence_frequency for ONE_TIME_EXTRA
**File:** `backend/pooja/services/recurrence.py:170-199`

**Change:**
```python
def create_plan_from_registration(
    registration: PoojaRegistration,
    recurrence_kind: str,
    recurrence_frequency: Optional[str] = None,
    recurrence_one_time_date: Optional[date] = None,
    cart_item_payload: Optional[Dict[str, Any]] = None,
):
    kind = RecurrenceKind(recurrence_kind)
    
    # NEW - Validate based on kind
    if kind == RecurrenceKind.RECURRING:
        if not recurrence_frequency:
            raise ValueError("recurrence_frequency is required for RECURRING plans")
        frequency = RecurrenceFrequency(recurrence_frequency)
    elif kind == RecurrenceKind.ONE_TIME_EXTRA:
        if not recurrence_one_time_date:
            raise ValueError("one_time_date is required for ONE_TIME_EXTRA plans")
        frequency = RecurrenceFrequency.MONTHLY  # Unused for one-time
    
    # ... rest of code ...
```

---

### 5. Process Recurring Plans Idempotency
**File:** `backend/pooja/services/recurrence.py:322-350`

**Change:**
```python
# BEFORE
for plan in pending:
    try:
        registration = create_registration_from_plan(plan, plan.next_occurrence)
        _advance_plan(plan, plan.next_occurrence or now)

# AFTER
for plan in pending:
    # Skip if already processed this period
    if plan.due_registration_id is not None:
        # Already has a due registration, just advance if needed
        if plan.next_occurrence and plan.next_occurrence <= now:
            _advance_plan(plan, plan.next_occurrence or now)
        continue
    
    try:
        registration = create_registration_from_plan(plan, plan.next_occurrence)
        _advance_plan(plan, plan.next_occurrence or now)
```

---

### 6. Member Validation
**File:** `backend/pooja/serializers.py:228-233`

**Change:**
```python
def validate(self, attrs):
    from django.utils import timezone
    
    # ... existing start_date code ...
    
    # NEW - Validate members
    members = attrs.get("members", [])
    if not members:
        raise serializers.ValidationError({"members": "At least one member must be specified."})
    
    for i, member in enumerate(members):
        name = (member.get("name") or "").strip()
        if not name:
            raise serializers.ValidationError({"members": f"Member {i+1} must have a non-empty name."})
    
    return attrs
```

---

### 7. Add Payment Confirmation Flow
**File:** `backend/pooja/views.py` - Create new endpoint

**Change:**
```python
class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    # ... existing code ...
    
    @action(detail=True, methods=["post"], url_path="confirm-payment")
    def confirm_payment(self, request, pk=None):
        """Mark registration as CONFIRMED after successful payment."""
        registration = self.get_object()
        
        if registration.donor != request.user and request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Cannot confirm payment for other users.")
        
        if registration.status != PoojaStatus.PENDING:
            return Response(
                {"detail": "Registration is not pending confirmation."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        registration.status = PoojaStatus.CONFIRMED
        registration.save(update_fields=["status"])
        
        serializer = self.get_serializer(registration)
        return Response(serializer.data)
```

---

## HIGH PRIORITY FIXES (30 hours)

### 8. Add PROTECT to Foreign Keys
**File:** `backend/pooja/models.py`

**Changes for all these:**
```python
# Line 99 - Donor
donor = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.PROTECT,  # Changed from CASCADE
    related_name="pooja_registrations"
)

# Line 209 - origin_registration
origin_registration = models.ForeignKey(
    PoojaRegistration,
    on_delete=models.PROTECT,  # Changed from SET_NULL
    null=True,
    blank=True,
    related_name="originating_recurring_plans",
)

# Line 214 - due_registration
due_registration = models.ForeignKey(
    PoojaRegistration,
    on_delete=models.PROTECT,  # Changed from SET_NULL
    null=True,
    blank=True,
    related_name="due_recurring_plans",
)

# Line 185 - day_option in RecurringPoojaPlan
day_option = models.ForeignKey(
    PoojaDayOption,
    on_delete=models.PROTECT,  # Changed from SET_NULL
    null=True,
    blank=True,
)

# Line 101 - day_option in PoojaRegistration
day_option = models.ForeignKey(
    PoojaDayOption,
    null=True,
    blank=True,
    on_delete=models.PROTECT,  # Changed from SET_NULL
)
```

---

### 9. Clear due_registration on Pause
**File:** `backend/pooja/views.py:779-787`

**Change:**
```python
@action(detail=True, methods=["post"], url_path="pause")
def pause(self, request, pk=None):
    # ... existing validation code ...
    
    plan.due_registration = None  # NEW - Clear pending payment
    plan.is_active = False
    plan.save()
    
    # ... rest of code ...
```

---

### 10. Validate pooja_option is Active
**File:** `backend/pooja/serializers.py:228-233`

**Change:**
```python
def validate_pooja_option(self, value):
    if not value.is_active:
        raise serializers.ValidationError("This pooja option is no longer available.")
    return value
```

---

## MEDIUM PRIORITY FIXES (25 hours)

### 11. Prevent Past start_date
**File:** `backend/pooja/serializers.py:228-233`

**Change:**
```python
def validate(self, attrs):
    from django.utils import timezone
    
    if attrs.get("start_date") is None:
        attrs["start_date"] = timezone.localdate()
    elif attrs.get("start_date") < timezone.localdate():
        raise serializers.ValidationError({"start_date": "Pooja date cannot be in the past."})
    
    return attrs
```

---

### 12. Add Quantity Validation
**File:** `backend/pooja/serializers.py`

**Change:**
```python
def validate_quantity(self, value):
    if value is None or value < 1:
        raise serializers.ValidationError("Quantity must be at least 1.")
    return value
```

---

### 13. Add Amount Validation for Recurring Plans
**File:** `backend/pooja/serializers.py:503-505`

**Change:**
```python
def validate_amount(self, value):
    if value is None or value <= 0:
        raise serializers.ValidationError("Amount must be greater than 0.")
    return value
```

---

### 14. Add Database Indexes
**File:** `backend/payments/models.py:59-62`

**Change:**
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
        unique_together = [
            ('donor', 'registration', 'payment_month'),
        ]
```

---

### 15. Frontend Idempotency
**File:** `frontend/src/pages/PoojaRegistrationPage.tsx`

**Pattern to add:**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit(e: FormEvent) {
    if (isSubmitting) return;  // Prevent double-click
    
    setIsSubmitting(true);
    try {
        // Generate unique key for this submission
        const idempotencyKey = `${user.id}-${Date.now()}-${Math.random()}`;
        
        const response = await api.post("/registrations/", payload, {
            headers: { 'Idempotency-Key': idempotencyKey }
        });
        
        // Handle success
    } catch (error) {
        // Handle error
    } finally {
        setIsSubmitting(false);
    }
}
```

---

## Testing Checklist

After implementing fixes, test:

- [ ] Two simultaneous registration creates don't create duplicate registration_numbers
- [ ] Creating registration with NULL total_amount fails with clear error
- [ ] Creating ONE_TIME_EXTRA without one_time_date fails
- [ ] Creating RECURRING without recurrence_frequency fails
- [ ] process_recurring_plans() called twice doesn't create duplicate due_registrations
- [ ] Registration created with empty member list fails
- [ ] past start_date is rejected
- [ ] Deleting donor fails if registrations exist
- [ ] Deleting day_option fails if registrations exist
- [ ] Pausing plan clears due_registration
- [ ] Inactive pooja_option can't be registered
- [ ] Registering same pooja twice on same day creates one entry (or validates appropriately)
- [ ] Payment record uniqueness prevents duplicates per donor/month
- [ ] Recurring plan can't be paused indefinitely (max 1 year)
- [ ] Frontend doesn't allow double-click submissions

---

## Rollout Plan

1. **Phase 1 (Week 1):** Apply CRITICAL fixes 1-7
2. **Phase 2 (Week 2):** Apply HIGH fixes 8-10, run full test suite
3. **Phase 3 (Week 3):** Apply MEDIUM fixes 11-15, deploy with monitoring
4. **Phase 4 (Ongoing):** Apply LOW priority fixes in next release cycle

---

## Monitoring After Fixes

Add alerts for:
- Registration number gaps (duplicate prevention)
- Multiple due_registration per plan
- NULL total_amount values
- IntegrityError on cascading deletes
- Pause duration > 365 days
- Failed payment creation attempts

---

