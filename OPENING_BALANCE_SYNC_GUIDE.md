# Opening Balance Synchronization Guide

## Overview

The Opening Balance (shown on Admin Donor Details page) and Closing Due for Current Month (shown on Payment Statement Passbook) are now synchronized. Each month:

1. **Opening Balance** = Start of month balance (should equal previous month's closing balance)
2. **Closing Due** = Opening Balance + Current Month Due - Current Month Payments
3. **Next Month's Opening Balance** = Current Month's Closing Due (at month-end)

## How It Works

### During the Month
- Opening Balance (`custom_number` field in `DonorProfile`) remains constant
- Closing Due is calculated dynamically from:
  - Opening Balance
  - All pooja registrations created this month
  - All payments received this month
- No database updates occur when payments are recorded

### At Month-End
Use the management command to sync closing balances to opening balances:

```bash
# Preview changes without making updates
python manage.py sync_month_end_balances --dry-run

# Process current month for all donors
python manage.py sync_month_end_balances

# Process specific month
python manage.py sync_month_end_balances --month 2026-01

# Process specific donor
python manage.py sync_month_end_balances --donor-id 12
```

## Example Flow

**November 2025 → December 2025 → January 2026**

### November End (Dec 1, 2025)
- Opening Balance: ₹1,000
- November Due: ₹2,000
- November Payments: ₹1,500
- **Closing Due: 1,000 + 2,000 - 1,500 = ₹1,500**

Run sync command at month-end:
```bash
python manage.py sync_month_end_balances --month 2025-11
```

### January 2026
- **Opening Balance: ₹1,500** (November's closing due)
- Admin Donor Details Page displays: **Opening Balance: ₹1,500**
- January Due: ₹1,000
- January Payments: ₹800
- **Closing Due: 1,500 + 1,000 - 800 = ₹1,700**
- Payment Statement shows: **Closing balance due: ₹1,700**

At January month-end:
```bash
python manage.py sync_month_end_balances --month 2026-01
```
- **Opening Balance becomes: ₹1,700** (for February)

## Backend Implementation

### Key Files

1. **`backend/payments/views.py`** - `PaymentRecordViewSet.perform_create()`
   - Does NOT update opening_balance when payments are recorded
   - Closing due is calculated dynamically

2. **`backend/accounts/serializers.py`**
   - `_compute_opening_balance_for_user()` - Gets opening balance from custom_number
   - `_compute_monthly_summary_for_user()` - Calculates current month due and payments
   - `DonorProfileSerializer.get_calculated_current_balance()` - Returns closing due

3. **`backend/payments/management/commands/sync_month_end_balances.py`**
   - Management command to sync balances at month-end
   - Dry-run mode for preview

### Frontend Implementation

1. **`frontend/src/hooks/useCurrentBalance.ts`**
   - Fetches `opening_balance` and `calculated_current_balance` from API
   - `opening_balance` from `custom_number` field
   - `calculated_current_balance` is the closing due

2. **`frontend/src/pages/payments/PaymentStatementPage.tsx`**
   - Renders Passbook table with:
     - Opening Balance (from current balance entry)
     - Due Amount (pooja registrations)
     - Paid Amount (payments)
     - Closing balance due (calculated dynamically)

3. **`frontend/src/pages/admin/DonorDetailsPage.tsx`**
   - Displays Opening Balance from `profile.custom_number`

## Database Fields

### `DonorProfile` Model
- **`custom_number`** (IntegerField) - Opening Balance for the current month
- This is updated at month-end via the sync command

### `PaymentRecord` Model
- **`payment_month`** (DateField) - Month the payment applies to
- Used to filter current month transactions

## Scheduling Month-End Sync

### Option 1: Cron Job (Linux/Unix)
```bash
# Add to crontab (runs on the 1st of each month at 2 AM)
0 2 1 * * cd /path/to/temple_project && python backend/manage.py sync_month_end_balances
```

### Option 2: Celery Beat (Recommended for production)
Add to `celery_beat_schedule`:
```python
from celery.schedules import crontab

app.conf.beat_schedule = {
    'sync-month-end-balances': {
        'task': 'payments.tasks.sync_month_end_balances_task',
        'schedule': crontab(hour=2, minute=0, day_of_month=1),  # 2 AM on 1st of month
    },
}
```

### Option 3: Manual Admin Action
Admins can run the command manually whenever needed:
```bash
python manage.py sync_month_end_balances
```

## Troubleshooting

### Opening Balance Not Syncing
1. Check if command was run: `python manage.py sync_month_end_balances --dry-run`
2. Verify donor has transactions this month
3. Check database: `SELECT custom_number FROM accounts_donorprofile WHERE user_id = <id>`

### Closing Due Calculation Wrong
1. Verify `opening_balance` is correct in database
2. Check `current_month_due` in Payment Statement filters
3. Verify `current_month_payments` with status='success'

### Historical Data Issues
To reset a specific month's balance:
```bash
python manage.py sync_month_end_balances --month 2026-01 --donor-id 12 --dry-run
```

## Testing

```python
# Test script
from datetime import date
from accounts.models import User
from accounts.serializers import _compute_monthly_summary_for_user, _compute_opening_balance_for_user

donor = User.objects.get(id=12)
opening = _compute_opening_balance_for_user(donor)
summary = _compute_monthly_summary_for_user(donor)
closing = opening + summary["due"] - summary["payments"]

print(f"Opening: {opening}")
print(f"Due: {summary['due']}")
print(f"Payments: {summary['payments']}")
print(f"Closing: {closing}")
```
