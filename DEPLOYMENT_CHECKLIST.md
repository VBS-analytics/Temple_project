# Security Audit - Developer Checklist

## ✅ Pre-Deployment Verification

Use this checklist to verify all security fixes are in place before deploying to production.

---

## CRITICAL FIXES (Must Pass)

### ☐ CRITICAL-1: NULL total_amount Fixed
- [ ] Model: `total_amount` field has `null=False`
- [ ] Model: `total_amount` has default value (0 or validator)
- [ ] Serializer: `validate()` checks `total_amount > 0`
- [ ] Migration: Run `makemigrations` and `migrate`
- [ ] Test: POST registration without amount → 400 error
- [ ] Test: POST registration with amount=0 → 400 error
- [ ] Test: Query for NULL total_amount → returns 0 rows

**Status:** ⬜ NOT STARTED

---

### ☐ CRITICAL-2: Registration Number Race Condition Fixed
- [ ] Model: `save()` method uses atomic transaction correctly
- [ ] Model: `select_for_update()` called at start (before reading)
- [ ] Database: UNIQUE constraint on registration_number exists
- [ ] Test: Run 50 concurrent registrations → all have unique numbers
- [ ] Test: Check for gaps in registration_number sequence
- [ ] Monitoring: Alert set on registration_number gaps

**Status:** ⬜ NOT STARTED

---

### ☐ CRITICAL-3: Multiple due_registration Prevention
- [ ] Service: `create_registration_from_plan()` checks existing due_registration
- [ ] Service: Returns existing registration if already created
- [ ] Test: Call `create_registration_from_plan()` twice → same registration returned
- [ ] Test: Query shows only 1 registration linked to plan
- [ ] Test: `process_recurring_plans()` run twice → no duplicate registrations

**Status:** ⬜ NOT STARTED

---

### ☐ CRITICAL-4: Recurrence Validation Fixed
- [ ] Service: `create_plan_from_registration()` validates recurrence_kind
- [ ] Service: RECURRING requires recurrence_frequency
- [ ] Service: ONE_TIME_EXTRA requires one_time_date
- [ ] Serializer: Both fields have required validation
- [ ] Test: POST recurring without frequency → 400 error
- [ ] Test: POST one-time without date → 400 error
- [ ] Test: Unique constraint prevents duplicate plans

**Status:** ⬜ NOT STARTED

---

### ☐ CRITICAL-5: Payment Confirmation Flow Added
- [ ] New endpoint: `POST /api/registrations/{id}/confirm-payment/`
- [ ] Registration created with status=PENDING
- [ ] Confirmation updates status to CONFIRMED
- [ ] Test: Create registration → status=PENDING
- [ ] Test: Call confirm-payment → status=CONFIRMED
- [ ] Frontend: Disables submit button during payment
- [ ] Frontend: Implements idempotency key header

**Status:** ⬜ NOT STARTED

---

### ☐ CRITICAL-6: process_recurring_plans Idempotency
- [ ] Service: Checks `plan.due_registration_id` before creating
- [ ] Service: Skips if already has due_registration
- [ ] Test: Run process_recurring_plans() twice → no duplicates
- [ ] Monitoring: Count created vs processed registrations

**Status:** ⬜ NOT STARTED

---

### ☐ CRITICAL-7: Member Validation Added
- [ ] Serializer: `validate()` checks members list not empty
- [ ] Serializer: Each member has non-blank name
- [ ] Serializer: Member name max length validated
- [ ] Test: POST without members → 400 error
- [ ] Test: POST with empty member name → 400 error
- [ ] Test: POST with 1+ valid members → 201 created

**Status:** ⬜ NOT STARTED

---

## HIGH PRIORITY FIXES (Must Pass)

### ☐ HIGH-1: Foreign Key Constraints Changed
- [ ] PoojaRegistration.donor: `on_delete=PROTECT`
- [ ] RecurringPoojaPlan.donor: `on_delete=PROTECT`
- [ ] RecurringPoojaPlan.origin_registration: `on_delete=PROTECT`
- [ ] RecurringPoojaPlan.due_registration: `on_delete=PROTECT`
- [ ] PoojaRegistration.day_option: `on_delete=PROTECT`
- [ ] RecurringPoojaPlan.day_option: `on_delete=PROTECT`
- [ ] Migration: Run migrations
- [ ] Test: Try to delete user with registrations → ProtectError
- [ ] Test: Try to delete day_option with registrations → ProtectError

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-2: Paused Plan Clears due_registration
- [ ] Views: `pause()` action sets `due_registration=None`
- [ ] Test: Pause plan → due_registration becomes NULL
- [ ] Test: Resume plan → repopulates due_registration
- [ ] Test: Paused plan doesn't generate new payments

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-3: pooja_option Active Status Validated
- [ ] Serializer: `validate_pooja_option()` checks `is_active`
- [ ] Test: Register with inactive pooja → 400 error
- [ ] Test: Register with active pooja → 201 created

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-4: Start Date Validation
- [ ] Serializer: `validate()` rejects past dates
- [ ] Test: POST with past date → 400 error
- [ ] Test: POST with today's date → 201 created
- [ ] Test: POST with future date → 201 created

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-5: Payment Record Uniqueness
- [ ] Model: `unique_together = [('donor', 'registration', 'payment_month')]`
- [ ] Migration: Add constraint
- [ ] Test: Create 2 payment records same donor/month → 2nd fails
- [ ] Test: get_or_create handles duplicates gracefully

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-6: Database Indexes Added
- [ ] PaymentRecord: Index on (donor, status)
- [ ] PaymentRecord: Index on (donor, payment_month)
- [ ] PaymentRecord: Index on (status, payment_month)
- [ ] RecurringPoojaPlan: Index on (donor, is_active)
- [ ] Migration: Create indexes
- [ ] Verify: Run EXPLAIN PLAN to confirm indexes used

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-7: Recurring Processing Moved to Job
- [ ] Remove `process_recurring_plans()` call from `list()` view
- [ ] Create Celery task: `process_recurring_plans_scheduled()`
- [ ] Add beat schedule: run every hour
- [ ] Test: Recurring plans processed without view call
- [ ] Monitoring: Track task execution time

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-8: Frontend Idempotency
- [ ] Frontend: Generates `Idempotency-Key` header
- [ ] Frontend: Disables submit button during request
- [ ] Frontend: Shows loading spinner
- [ ] Frontend: Implements retry logic
- [ ] Test: Double-click submit → only 1 registration created
- [ ] Test: Network timeout and retry → same registration

**Status:** ⬜ NOT STARTED

---

### ☐ HIGH-9: Bulk Registration Limits
- [ ] API: Add rate limiter (10 registrations/hour per user)
- [ ] Frontend: Warning if > 10 items in cart
- [ ] Test: Try 100 registrations/hour → 429 rate limit error

**Status:** ⬜ NOT STARTED

---

## MEDIUM PRIORITY FIXES (Should Fix)

### ☐ MEDIUM-1: Quantity Validation
- [ ] Serializer: `validate_quantity()` checks > 0
- [ ] Test: quantity=0 → 400 error

**Status:** ⬜ NOT STARTED

---

### ☐ MEDIUM-2: Amount Validation for Plans
- [ ] Serializer: `validate_amount()` checks > 0
- [ ] Test: amount=0 → 400 error
- [ ] Test: amount=NULL → 400 error

**Status:** ⬜ NOT STARTED

---

### ☐ MEDIUM-3: Pause Duration Limit
- [ ] Views: `pause()` validates `pause_until - today <= 365 days`
- [ ] Test: pause_until > 1 year → 400 error

**Status:** ⬜ NOT STARTED

---

### ☐ MEDIUM-4: Member Data Normalized
- [ ] Create RecurringPoojaPlanMember model
- [ ] Migrate plan metadata members to new table
- [ ] Test: Members queryable and indexed

**Status:** ⬜ NOT STARTED

---

### ☐ MEDIUM-5: cart_payload Validation
- [ ] Serializer: Validate cart_payload structure
- [ ] Limit: Max 10KB payload size
- [ ] Test: Oversized payload → 400 error

**Status:** ⬜ NOT STARTED

---

## TESTING CHECKLIST

### Unit Tests
- [ ] Test NULL total_amount validation
- [ ] Test quantity validation
- [ ] Test member validation
- [ ] Test recurrence_kind validation
- [ ] Test date validation
- [ ] Test pause duration limit

### Integration Tests
- [ ] Create registration with all fields
- [ ] Create recurring plan and verify plan creation
- [ ] Process recurring plans and verify registration created
- [ ] Pause/resume plan and verify state
- [ ] Cancel plan and verify state

### Concurrency Tests
- [ ] 50 concurrent registrations → all unique numbers
- [ ] 10 concurrent process_recurring_plans → no duplicates
- [ ] 5 concurrent payment creations → no duplicates
- [ ] High load (100+ concurrent) → response time < 2s

### Data Integrity Tests
- [ ] Query for orphaned registrations → returns 0
- [ ] Query for duplicate registration_numbers → returns 0
- [ ] Query for duplicate payment records → returns 0
- [ ] Check foreign key constraints → all enforced

### Payment Flow Tests
- [ ] Create registration, confirm payment, check status
- [ ] Network timeout on payment → can retry
- [ ] Duplicate payment attempts → handled gracefully
- [ ] Double-click submit button → single registration

### Edge Case Tests
- [ ] Create 100+ registrations in one session
- [ ] Delete pooja_option (should fail)
- [ ] Delete user (should fail)
- [ ] Pause then immediately resume → consistent state
- [ ] Recurring plan spanning month boundary

---

## SECURITY REVIEW CHECKLIST

### Code Quality
- [ ] All inputs validated
- [ ] All external calls handled
- [ ] Error messages don't leak sensitive info
- [ ] SQL injection impossible (using ORM)
- [ ] XSS impossible (JSON API)
- [ ] CSRF tokens used (if applicable)

### Database Security
- [ ] Foreign key constraints enforced
- [ ] Unique constraints in place
- [ ] NOT NULL constraints on required fields
- [ ] Indexes on frequently queried fields
- [ ] Soft deletes for audit trail

### API Security
- [ ] Authentication required on all endpoints
- [ ] Authorization checked (only own data)
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Error handling consistent

### Frontend Security
- [ ] Idempotency keys implemented
- [ ] Submit button disabled during request
- [ ] No sensitive data in localStorage
- [ ] HTTPS enforced
- [ ] No SQL injection possible

---

## MONITORING SETUP

### Alerts to Configure

- [ ] Registration number gaps > 10
- [ ] Orphaned due_registration records
- [ ] Duplicate payment records in 1 hour window
- [ ] Failed payment creation attempts
- [ ] ProtectError on cascade delete attempt
- [ ] Pause duration > 365 days

### Dashboards to Create

- [ ] Registration creation rate
- [ ] Recurring plan processing success rate
- [ ] Payment collection rate
- [ ] Error rate by endpoint
- [ ] Database constraint violations

---

## DEPLOYMENT SIGN-OFF

### Ready to Deploy When:

- [ ] All 7 CRITICAL fixes verified
- [ ] All 9 HIGH fixes verified
- [ ] All MEDIUM fixes verified (at least most)
- [ ] All tests passing (> 95% pass rate)
- [ ] Concurrency tests passing under load
- [ ] No data integrity issues in staging
- [ ] Monitoring alerts configured
- [ ] Incident response plan documented

### Deployment Checklist

- [ ] Backup production database
- [ ] Run migrations in dry-run mode
- [ ] Deploy code to staging
- [ ] Run full test suite on staging
- [ ] Verify indexes created
- [ ] Check constraint enforcement
- [ ] Monitor for errors 24 hours
- [ ] Deploy to production with feature flag
- [ ] Gradually roll out (10% → 50% → 100%)
- [ ] Monitor production metrics closely

---

## Post-Deployment Verification

### Week 1 After Deployment
- [ ] Zero data integrity issues
- [ ] Zero duplicate payments
- [ ] Zero registration number collisions
- [ ] All recurring plans processed correctly
- [ ] Payment reconciliation accurate

### Week 2 After Deployment
- [ ] Generate audit report
- [ ] Review with business stakeholders
- [ ] Verify financial reconciliation
- [ ] Check error logs for warnings

### Month 1 After Deployment
- [ ] Performance stable
- [ ] No customer complaints
- [ ] Data integrity verified
- [ ] Financial accuracy confirmed

---

## Document Versions

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-30 | 1.0 | Initial audit report |

---

## Sign-Off

**Backend Lead:** ___________________ Date: _______

**QA Lead:** ___________________ Date: _______

**DevOps Lead:** ___________________ Date: _______

**Project Manager:** ___________________ Date: _______

---
