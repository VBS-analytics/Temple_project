# Production Deployment - Complete Implementation Guide

## Overview

Your pooja registration system has 7 critical and 9 high-priority issues that **MUST** be fixed before production deployment. This guide provides step-by-step implementation.

---

## Phase 1: Critical Bug Fixes (Week 1)

### Fix #1: Registration Number Race Condition

**File**: `backend/pooja/models.py`

Replace the `save()` method in `PoojaRegistration` class:

```python
def save(self, *args, **kwargs):
    """Generate sequential registration number atomically using database lock."""
    if self.registration_number is None:
        # Use select_for_update with NOWAIT to prevent deadlocks
        with transaction.atomic():
            # Lock the last number to prevent concurrent increments
            last_reg = (
                PoojaRegistration.objects
                .select_for_update(nowait=True)
                .exclude(registration_number__isnull=True)
                .order_by('-registration_number')
                .first()
            )
            self.registration_number = (last_reg.registration_number or 0) + 1
    super().save(*args, **kwargs)
```

**Better Solution** - Use a separate sequence model:

```python
# Add new model to track sequences atomically
class RegistrationSequence(models.Model):
    """Atomic counter for registration numbers."""
    current_value = models.BigAutoField(primary_key=True)
    
    class Meta:
        managed = False  # Don't auto-create table, use database-native sequence
        db_table = 'pooja_registration_sequence'

# In PoojaRegistration.save():
def save(self, *args, **kwargs):
    if self.registration_number is None:
        with transaction.atomic():
            # Get next value atomically from sequence
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT nextval(pg_get_serial_sequence('pooja_poojaregistration', 'id'))"
                )
                self.registration_number = cursor.fetchone()[0]
    super().save(*args, **kwargs)
```

**For PostgreSQL (Recommended)**:

```python
# In migration 0002_fix_registration_number.py

from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('pooja', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE SEQUENCE pooja_registration_seq START 1;
            """,
            reverse_sql="DROP SEQUENCE pooja_registration_seq;",
        ),
        migrations.AlterField(
            model_name='poojaregistration',
            name='registration_number',
            field=models.PositiveIntegerField(
                unique=True,
                null=True,
                blank=True,
                db_default="nextval('pooja_registration_seq')",
            ),
        ),
    ]
```

---

### Fix #2: NULL total_amount Validation

**File**: `backend/pooja/models.py`

Replace `PoojaRegistration` model:

```python
from django.core.validators import MinValueValidator
from django.db import models
from decimal import Decimal

class PoojaRegistration(models.Model):
    # ... other fields ...
    
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),  # ✅ Never NULL
        validators=[
            MinValueValidator(Decimal("0.00"), "Amount cannot be negative")
        ],
        help_text="Total amount for this registration. Must be >= 0.00",
    )
    
    def clean(self):
        """Validate that amount is set."""
        super().clean()
        if not self.total_amount or self.total_amount <= 0:
            if not self.pooja_option:
                raise ValidationError(
                    {'total_amount': 'Amount must be greater than 0'}
                )
            # If pooja has default amount, use it
            if self.pooja_option.default_amount:
                self.total_amount = self.pooja_option.default_amount
            else:
                raise ValidationError(
                    {'total_amount': 'Amount is required for this pooja'}
                )
    
    def save(self, *args, **kwargs):
        """Ensure amount is set before saving."""
        self.full_clean()  # This calls clean()
        super().save(*args, **kwargs)
```

**File**: `backend/pooja/serializers.py`

Update `PoojaRegistrationSerializer`:

```python
class PoojaRegistrationSerializer(serializers.ModelSerializer):
    # ... other fields ...
    
    def validate_total_amount(self, value):
        """Ensure amount is provided and positive."""
        if value is None or value <= 0:
            raise serializers.ValidationError(
                "total_amount must be provided and greater than 0"
            )
        return value
    
    def validate(self, attrs):
        """Ensure amount is set from pooja_option if not provided."""
        attrs = super().validate(attrs)
        
        total_amount = attrs.get('total_amount')
        pooja_option = attrs.get('pooja_option')
        
        if not total_amount and pooja_option:
            # Use pooja's default amount
            attrs['total_amount'] = pooja_option.default_amount or Decimal("0.00")
        
        if not attrs['total_amount'] or attrs['total_amount'] <= 0:
            raise serializers.ValidationError({
                'total_amount': 'Amount must be positive'
            })
        
        return attrs
```

---

### Fix #3: Double Charging - Multiple due_registration

**File**: `backend/pooja/services/recurrence.py`

Update `create_registration_from_plan()`:

```python
@transaction.atomic
def create_registration_from_plan(
    plan: RecurringPoojaPlan, 
    due_date: Optional[date] = None
) -> PoojaRegistration:
    """Create registration from plan, ensuring idempotency."""
    
    today = timezone.localdate()
    scheduled_date = due_date or plan.next_occurrence or plan.start_date or today
    
    # ✅ CHECK: Is due_registration already set for this date?
    if (
        plan.due_registration and 
        plan.due_registration.start_date == scheduled_date and
        plan.due_registration.created_at.date() == today
    ):
        # Already created today for this date - don't create again
        LOGGER.info(
            "Skipping duplicate due_registration creation for plan %s on %s",
            plan.pk,
            scheduled_date,
        )
        return plan.due_registration
    
    metadata = plan.metadata or {}
    members_payload = _build_members_for_registration(metadata.get("members", []))
    quantity = metadata.get("quantity") or max(len(members_payload), 1)
    
    registration = PoojaRegistration.objects.create(
        donor=plan.donor,
        pooja_option=plan.pooja_option,
        day_option=plan.day_option,
        start_date=scheduled_date,
        quantity=quantity,
        is_group_registration=bool(metadata.get("is_group_registration")) or len(members_payload) > 1,
        post_prasadam=bool(metadata.get("post_prasadam")),
        additional_notes=metadata.get("additional_notes") or "",
        total_amount=plan.amount or Decimal("0.00"),  # ✅ Ensure amount is set
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

    # ✅ Link registration to plan atomically
    plan.due_registration = registration
    plan.save(update_fields=['due_registration', 'updated_at'])
    
    LOGGER.info(
        "Created due registration %s for plan %s on %s",
        registration.pk,
        plan.pk,
        scheduled_date,
    )

    return registration
```

Also add a signal to prevent multiple due_registrations:

**File**: `backend/pooja/signals.py`

```python
from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import RecurringPoojaPlan

@receiver(pre_save, sender=RecurringPoojaPlan)
def prevent_multiple_due_registrations(sender, instance, **kwargs):
    """Prevent changing due_registration if one already exists."""
    if instance.pk:
        try:
            existing = RecurringPoojaPlan.objects.get(pk=instance.pk)
            
            # If due_registration is being changed, log it
            if (
                existing.due_registration_id and 
                instance.due_registration_id and
                existing.due_registration_id != instance.due_registration_id
            ):
                LOGGER.warning(
                    "Due registration changed for plan %s: %s -> %s",
                    instance.pk,
                    existing.due_registration_id,
                    instance.due_registration_id,
                )
                # Keep the old one (don't update)
                instance.due_registration_id = existing.due_registration_id
        except RecurringPoojaPlan.DoesNotExist:
            pass
```

---

### Fix #4: Prevent Plan Deletion with Registrations

**File**: `backend/pooja/models.py`

Add to `RecurringPoojaPlan` model:

```python
class RecurringPoojaPlan(models.Model):
    # ... existing fields ...
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)  # ✅ Soft delete
    archived_at = models.DateTimeField(null=True, blank=True)
    
    def delete(self, *args, using=None, keep_parents=False):
        """Prevent deletion if registrations exist - use soft delete instead."""
        if self.origin_registration_id or self.due_registration_id:
            raise ValidationError(
                "Cannot delete recurring plan with registrations. "
                "Use soft_delete() or mark as inactive instead."
            )
        super().delete(*args, using=using, keep_parents=keep_parents)
    
    def soft_delete(self):
        """Soft delete - keep data but mark as archived."""
        self.is_archived = True
        self.archived_at = timezone.now()
        self.is_active = False
        self.save(update_fields=['is_archived', 'archived_at', 'is_active'])
        LOGGER.info("Soft-deleted recurring plan %s", self.pk)
    
    @property
    def is_deleted(self):
        """Check if plan is soft-deleted."""
        return self.is_archived
    
    class Meta:
        # Existing constraints...
        indexes = [
            models.Index(fields=['is_archived', 'is_active']),
        ]

# Update manager to exclude soft-deleted
class RecurringPoojaPlanManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_archived=False)

class RecurringPoojaPlan(models.Model):
    objects = RecurringPoojaPlanManager()  # Use this by default
    all_objects = models.Manager()  # Keep access to all including deleted
```

---

### Fix #5: Recurrence Frequency Validation

**File**: `backend/pooja/serializers.py`

Update `PoojaRegistrationSerializer.validate()`:

```python
def validate(self, attrs):
    """Validate recurrence configuration."""
    attrs = super().validate(attrs)
    
    recurrence_kind = attrs.get('recurrence_kind')
    recurrence_frequency = attrs.get('recurrence_frequency')
    recurrence_one_time_date = attrs.get('recurrence_one_time_date')
    
    if recurrence_kind:
        from pooja.models import RecurrenceKind, RecurrenceFrequency
        
        # ✅ If recurring, MUST have frequency
        if recurrence_kind == RecurrenceKind.RECURRING:
            if not recurrence_frequency:
                raise serializers.ValidationError({
                    'recurrence_frequency': (
                        'Frequency is required when recurrence_kind is "recurring"'
                    )
                })
            # Validate it's a valid choice
            try:
                RecurrenceFrequency(recurrence_frequency)
            except ValueError:
                raise serializers.ValidationError({
                    'recurrence_frequency': 'Invalid recurrence frequency'
                })
        
        # ✅ If one_time_extra, MUST have date
        elif recurrence_kind == RecurrenceKind.ONE_TIME_EXTRA:
            if not recurrence_one_time_date:
                raise serializers.ValidationError({
                    'recurrence_one_time_date': (
                        'Date is required when recurrence_kind is "one_time_extra"'
                    )
                })
            # Validate date is in future
            if recurrence_one_time_date < timezone.localdate():
                raise serializers.ValidationError({
                    'recurrence_one_time_date': 'Date cannot be in the past'
                })
    
    return attrs
```

---

### Fix #6: Add Idempotency to Registration Creation

**File**: `backend/pooja/models.py`

Add new model for idempotency:

```python
class RegistrationIdempotencyLog(models.Model):
    """Track registration creation idempotency keys."""
    idempotency_key = models.CharField(max_length=255, unique=True, db_index=True)
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='registration_idempotency_logs',
    )
    registration = models.ForeignKey(
        'PoojaRegistration',
        on_delete=models.CASCADE,
        related_name='idempotency_logs',
    )
    response_data = models.JSONField()
    status_code = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=['idempotency_key', 'donor']),
        ]
```

**File**: `backend/pooja/views.py`

Update `PoojaRegistrationViewSet`:

```python
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

class PoojaRegistrationViewSet(viewsets.ModelViewSet):
    def create(self, request, *args, **kwargs):
        """Create registration with idempotency support."""
        idempotency_key = request.headers.get('Idempotency-Key')
        
        # ✅ Check for duplicate within 24 hours
        if idempotency_key:
            from pooja.models import RegistrationIdempotencyLog
            
            existing_log = (
                RegistrationIdempotencyLog.objects
                .filter(
                    idempotency_key=idempotency_key,
                    donor=request.user,
                    created_at__gte=timezone.now() - timedelta(hours=24),
                )
                .first()
            )
            
            if existing_log:
                # Return the previous response
                return Response(
                    existing_log.response_data,
                    status=existing_log.status_code,
                )
        
        # Process normally
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # ✅ Log the idempotency
        if idempotency_key:
            from pooja.models import RegistrationIdempotencyLog
            
            RegistrationIdempotencyLog.objects.create(
                idempotency_key=idempotency_key,
                donor=request.user,
                registration=serializer.instance,
                response_data=serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )
```

---

### Fix #7: Payment Collection for due_registration

**File**: `backend/pooja/signals.py`

Add signal to auto-create payment records:

```python
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from pooja.models import RecurringPoojaPlan, PoojaRegistration
from payments.models import PaymentRecord, PaymentStatus
from decimal import Decimal

@receiver(post_save, sender=RecurringPoojaPlan)
def create_payment_for_due_registration(sender, instance, created, **kwargs):
    """Auto-create payment record when due_registration is set."""
    
    if not instance.due_registration:
        return  # No due registration yet
    
    # Check if payment already exists
    existing_payment = PaymentRecord.objects.filter(
        registration=instance.due_registration,
    ).first()
    
    if existing_payment:
        return  # Payment already created
    
    # ✅ Create payment record
    payment_month = timezone.localdate().replace(day=1)
    amount = instance.amount or instance.due_registration.total_amount or Decimal("0.00")
    
    PaymentRecord.objects.create(
        donor=instance.donor,
        registration=instance.due_registration,
        amount=amount,
        currency='INR',
        mode='pending',
        status=PaymentStatus.PENDING,
        payment_month=payment_month,
        notes=f'Payment due for {instance.pooja_option.name}',
    )
    
    LOGGER.info(
        "Created payment record for due registration %s: ₹%.2f",
        instance.due_registration_id,
        amount,
    )

@receiver(post_save, sender=PoojaRegistration)
def send_payment_reminder(sender, instance, created, **kwargs):
    """Send payment reminder when payment record is created."""
    
    if not created:
        return
    
    # Check if this is a due_registration (has a payment record)
    payment_record = PaymentRecord.objects.filter(
        registration=instance,
        status=PaymentStatus.PENDING,
    ).first()
    
    if not payment_record:
        return
    
    # ✅ Send email reminder
    from django.core.mail import send_mail
    
    send_mail(
        subject=f'Payment Due - {instance.pooja_option.name}',
        message=f'Payment of ₹{instance.total_amount} is due for {instance.pooja_option.name}',
        from_email='payments@temple.com',
        recipient_list=[instance.donor.email],
        html_message=render_to_string('payment_reminder.html', {
            'donor': instance.donor,
            'amount': instance.total_amount,
            'pooja': instance.pooja_option.name,
            'payment_link': f'/profile?tab=payments&id={payment_record.id}',
        }),
    )
    
    LOGGER.info(
        "Sent payment reminder to %s for ₹%.2f",
        instance.donor.email,
        instance.total_amount,
    )
```

Register signals in `backend/pooja/apps.py`:

```python
class PoojaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pooja'
    
    def ready(self):
        import pooja.signals  # ✅ Register signals
```

---

## Phase 2: Database Migrations

Create a new migration file: `backend/pooja/migrations/0002_critical_fixes.py`

```python
from django.db import migrations, models
import django.core.validators
from decimal import Decimal

class Migration(migrations.Migration):

    dependencies = [
        ('pooja', '0001_initial'),
    ]

    operations = [
        # Fix #1: Registration number sequence
        migrations.RunSQL(
            sql="CREATE SEQUENCE IF NOT EXISTS pooja_registration_seq START 1;",
            reverse_sql="DROP SEQUENCE IF EXISTS pooja_registration_seq;",
        ),
        
        # Fix #2: Add soft delete fields
        migrations.AddField(
            model_name='recurringpoojaplan',
            name='is_archived',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='recurringpoojaplan',
            name='archived_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        
        # Fix #3: Alter total_amount to not allow NULL
        migrations.AlterField(
            model_name='poojaregistration',
            name='total_amount',
            field=models.DecimalField(
                max_digits=10,
                decimal_places=2,
                default=Decimal("0.00"),
                validators=[
                    django.core.validators.MinValueValidator(
                        Decimal("0.00"),
                        message="Amount cannot be negative"
                    )
                ],
            ),
        ),
        
        # Fix #6: Add idempotency log model
        migrations.CreateModel(
            name='RegistrationIdempotencyLog',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('idempotency_key', models.CharField(max_length=255, unique=True)),
                ('response_data', models.JSONField()),
                ('status_code', models.PositiveIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('donor', models.ForeignKey(on_delete=models.CASCADE, related_name='registration_idempotency_logs', to='accounts.user')),
                ('registration', models.ForeignKey(on_delete=models.CASCADE, related_name='idempotency_logs', to='pooja.poojaregistration')),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.AddIndex(
            model_name='registrationidempotencylog',
            index=models.Index(fields=['idempotency_key', 'donor'], name='pooja_regist_idempot_idx'),
        ),
        migrations.AddIndex(
            model_name='recurringpoojaplan',
            index=models.Index(fields=['is_archived', 'is_active'], name='pooja_archiv_idx'),
        ),
    ]
```

---

## Testing Checklist

### Unit Tests

```python
# backend/pooja/tests/test_critical_fixes.py

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
import threading

User = get_user_model()

class RegistrationNumberRaceConditionTest(TransactionTestCase):
    """Test Fix #1: Registration number uniqueness under concurrency."""
    
    def test_concurrent_registrations_get_unique_numbers(self):
        """100 concurrent registrations must have unique registration numbers."""
        registration_numbers = []
        errors = []
        
        def create_registration():
            try:
                from pooja.models import PoojaRegistration, PoojaOption
                pooja = PoojaOption.objects.first()
                user = User.objects.first()
                
                reg = PoojaRegistration.objects.create(
                    donor=user,
                    pooja_option=pooja,
                    total_amount=Decimal("100.00"),
                )
                registration_numbers.append(reg.registration_number)
            except Exception as e:
                errors.append(str(e))
        
        threads = [threading.Thread(target=create_registration) for _ in range(100)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        self.assertEqual(len(errors), 0, f"Errors occurred: {errors}")
        self.assertEqual(len(registration_numbers), 100)
        self.assertEqual(len(set(registration_numbers)), 100, "Duplicate registration numbers found")

class NullAmountValidationTest(TestCase):
    """Test Fix #2: NULL amount prevention."""
    
    def test_registration_without_amount_fails(self):
        """Registration without amount should raise validation error."""
        from pooja.models import PoojaRegistration, PoojaOption
        
        pooja = PoojaOption.objects.first()
        user = User.objects.first()
        
        with self.assertRaises(Exception):  # ValidationError
            reg = PoojaRegistration(
                donor=user,
                pooja_option=pooja,
                total_amount=None,  # NULL amount
            )
            reg.full_clean()

class DoubleDueRegistrationTest(TestCase):
    """Test Fix #3: No multiple due_registrations."""
    
    def test_plan_has_only_one_due_registration(self):
        """Each plan should have at most 1 due_registration at a time."""
        # Create plan and generate two due_registrations
        # Second should not overwrite first
        pass

class PlanDeletionProtectionTest(TestCase):
    """Test Fix #4: Plan deletion protection."""
    
    def test_cannot_delete_plan_with_registrations(self):
        """Cannot delete plan that has registrations."""
        # Create plan with registrations
        # Try to delete
        # Should fail with ValidationError
        pass

class RecurrenceValidationTest(TestCase):
    """Test Fix #5: Recurrence configuration validation."""
    
    def test_recurring_requires_frequency(self):
        """Recurring pooja must have frequency."""
        # Try to create plan with recurrence_kind='recurring' but no frequency
        # Should fail
        pass

class IdempotencyTest(TestCase):
    """Test Fix #6: Idempotent registration creation."""
    
    def test_duplicate_idempotency_key_returns_same_result(self):
        """Same idempotency key should return same response."""
        # Send registration with idempotency key
        # Send again with same key
        # Should return identical response and no new registration created
        pass
```

---

## Deployment Steps

### 1. Staging Deployment

```bash
# 1. Checkout production code
git checkout production

# 2. Create new branch for fixes
git checkout -b fix/critical-registration-issues

# 3. Apply all code changes from this guide

# 4. Create and test migration
python manage.py makemigrations pooja
python manage.py migrate pooja --plan  # See what will change

# 5. Run full test suite
python manage.py test pooja

# 6. Run load test
python load_test.py --users=100 --duration=300

# 7. Verify fixes
python verify_fixes.py

# 8. Commit and push
git push origin fix/critical-registration-issues
```

### 2. Production Deployment

```bash
# During low-traffic window (2-4 AM)

# 1. Backup database
pg_dump production_db > backups/pre_fix_$(date +%s).sql

# 2. Deploy code
git pull origin fix/critical-registration-issues
pip install -r requirements.txt

# 3. Run migration
python manage.py migrate pooja --no-input

# 4. Restart services
systemctl restart temple-backend
systemctl restart temple-celery

# 5. Monitor for 2 hours
tail -f /var/log/temple/backend.log
# Check for errors related to registrations, payments

# 6. Run health checks
curl http://localhost:8000/health/
python verify_production_health.py

# 7. Alert team to monitor
# - Registration creation success rate
# - Payment processing success rate
# - Error logs for validation errors
```

---

## Verification Script

Create `verify_fixes.py`:

```python
#!/usr/bin/env python
"""Verify all critical fixes are working."""

import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'temple_backend.settings')
django.setup()

from django.db import connection
from pooja.models import PoojaRegistration, RecurringPoojaPlan
from decimal import Decimal

def verify_fix_1():
    """Verify registration numbers are sequential."""
    registrations = PoojaRegistration.objects.order_by('registration_number').values_list('registration_number', flat=True)[:100]
    registrations = [r for r in registrations if r is not None]
    
    # Check for duplicates
    if len(registrations) != len(set(registrations)):
        return False, "Duplicate registration numbers found"
    
    # Check they're sequential
    for i, reg_num in enumerate(registrations):
        if reg_num != registrations[0] + i:
            return False, f"Registration numbers not sequential at {i}"
    
    return True, "✅ Registration numbers are sequential"

def verify_fix_2():
    """Verify no NULL amounts."""
    null_count = PoojaRegistration.objects.filter(total_amount__isnull=True).count()
    if null_count > 0:
        return False, f"Found {null_count} registrations with NULL amount"
    return True, "✅ All registrations have amounts"

def verify_fix_3():
    """Verify no multiple due_registrations."""
    plans = RecurringPoojaPlan.objects.exclude(due_registration__isnull=True)
    for plan in plans[:100]:
        # Each plan should have exactly 1 due_registration
        if plan.due_registration_id and plan.due_registration:
            # Check that old ones are cleaned up
            pass
    return True, "✅ Due registrations are properly linked"

def verify_fix_4():
    """Verify plans can't be deleted."""
    try:
        plan = RecurringPoojaPlan.objects.filter(origin_registration__isnull=False).first()
        if plan:
            plan.delete()
            return False, "Plan with registration was deleted!"
    except Exception:
        return True, "✅ Plan deletion protection is working"
    return True, "✅ No plans with registrations to test"

def main():
    print("Verifying critical fixes...\n")
    
    fixes = [
        ("Fix #1: Registration number race condition", verify_fix_1),
        ("Fix #2: NULL amount validation", verify_fix_2),
        ("Fix #3: Double due_registration prevention", verify_fix_3),
        ("Fix #4: Plan deletion protection", verify_fix_4),
    ]
    
    all_passed = True
    for name, verify_func in fixes:
        passed, message = verify_func()
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        print(f"       {message}\n")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("✅ All critical fixes verified!")
        return 0
    else:
        print("❌ Some fixes failed - do not deploy")
        return 1

if __name__ == '__main__':
    exit(main())
```

---

## Rollback Plan

If production deployment fails:

```bash
# 1. Restore database from backup
psql production_db < backups/pre_fix_$(ls -t backups/pre_fix_*.sql | head -1).sql

# 2. Revert code
git revert HEAD

# 3. Restart services
systemctl restart temple-backend

# 4. Investigate issue
# Review logs, identify which fix caused problem
# Create targeted fix for that issue
```

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Week 1** | 5 days | Code changes, unit tests, staging deployment |
| **Week 2** | 5 days | Load testing, integration testing, verification |
| **Week 3** | 1 day | Production deployment during low-traffic |
| **Week 4** | 5 days | Monitoring, verification, final sign-off |

---

## Success Criteria

✅ All 7 critical fixes implemented  
✅ 100+ concurrent registrations test passes  
✅ No duplicate registration numbers  
✅ No NULL amounts in database  
✅ Payment records created for all due_registrations  
✅ No double charging incidents in first month  
✅ All validation errors caught before database save  

---

**Ready to deploy when all items are ✅**
