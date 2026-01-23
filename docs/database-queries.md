# Temple Management System - Essential Database Queries

**Generated:** January 23, 2026  
**Purpose:** Comprehensive guide for querying and analyzing the Temple Management System database

---

## Table of Contents

1. [Database & Table Information](#database--table-information)
2. [User/Donor Queries](#userdonor-queries)
3. [Pooja Registration Queries](#pooja-registration-queries)
4. [Payment Queries](#payment-queries)
5. [Passbook Entry Queries](#passbook-entry-queries)
6. [Expense Record Queries](#expense-record-queries)
7. [Recurring Plan Queries](#recurring-plan-queries)
8. [Combined Payment Mapping Queries](#combined-payment-mapping-queries)
9. [Data Validation & Integrity Queries](#data-validation--integrity-queries)
10. [Reporting & Analysis Queries](#reporting--analysis-queries)
11. [Deletion & Cleanup Queries](#deletion--cleanup-queries)

---

## Database & Table Information

### List all tables in database
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```

### Show table structure
```sql
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'TABLE_NAME' ORDER BY ordinal_position;
```

### Count rows in all tables
```sql
SELECT table_name, (SELECT count(*) FROM information_schema.tables t2 WHERE t2.table_name=t1.table_name) as row_count FROM information_schema.tables t1 WHERE table_schema='public' ORDER BY table_name;
```

### Show foreign key constraints
```sql
SELECT constraint_name, table_name, column_name, foreign_table_name, foreign_column_name FROM information_schema.key_column_usage WHERE table_schema = 'public' AND foreign_table_name IS NOT NULL;
```

---

## User/Donor Queries

### List all donors
```sql
SELECT id, phone_number, name, email, role, is_active, date_joined FROM accounts_user WHERE role = 'donor' ORDER BY date_joined DESC;
```

### Search donor by phone number
```sql
SELECT id, phone_number, name, email FROM accounts_user WHERE phone_number = '7894561232';
```
**Example:** Returns Donor with phone 7894561232

### Search donor by name
```sql
SELECT id, phone_number, name, email FROM accounts_user WHERE name ILIKE '%donor_name%';
```

### Count total donors
```sql
SELECT COUNT(*) as total_donors FROM accounts_user WHERE role = 'donor';
```

### Donors with registrations count
```sql
SELECT u.id, u.name, u.phone_number, COUNT(pr.id) as registration_count FROM accounts_user u LEFT JOIN pooja_poojaregistration pr ON u.id = pr.donor_id WHERE u.role = 'donor' GROUP BY u.id ORDER BY registration_count DESC;
```

### Donors with payment count
```sql
SELECT u.id, u.name, u.phone_number, COUNT(p.id) as payment_count, SUM(p.amount) as total_paid FROM accounts_user u LEFT JOIN payments_paymentrecord p ON u.id = p.donor_id WHERE p.status = 'success' GROUP BY u.id ORDER BY total_paid DESC NULLS LAST;
```

### List admin users
```sql
SELECT id, phone_number, name, email FROM accounts_user WHERE is_staff = true;
```

---

## Pooja Registration Queries

### All pooja registrations
```sql
SELECT pr.id, pr.registration_number, po.name as pooja_name, u.name as donor_name, u.phone_number, pr.quantity, pr.start_date, pr.created_at, pr.status FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id JOIN accounts_user u ON pr.donor_id = u.id ORDER BY pr.created_at DESC;
```

### One-time pooja registrations only
```sql
SELECT po.name as pooja_name, pr.donor_id, u.phone_number, u.name FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id JOIN accounts_user u ON pr.donor_id = u.id WHERE pr.id NOT IN (SELECT origin_registration_id FROM pooja_recurringpoojaplan WHERE origin_registration_id IS NOT NULL) ORDER BY pr.created_at DESC;
```

### Count unique users with one-time registrations
```sql
SELECT COUNT(DISTINCT pr.donor_id) as unique_user_count FROM pooja_poojaregistration pr WHERE pr.id NOT IN (SELECT origin_registration_id FROM pooja_recurringpoojaplan WHERE origin_registration_id IS NOT NULL);
```

### Registrations by status
```sql
SELECT status, COUNT(*) as count FROM pooja_poojaregistration GROUP BY status ORDER BY count DESC;
```

### Registrations by pooja type
```sql
SELECT po.name, COUNT(*) as count FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id GROUP BY po.name ORDER BY count DESC;
```

### Registrations in specific date range
```sql
SELECT pr.id, pr.registration_number, po.name, u.name, pr.start_date FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id JOIN accounts_user u ON pr.donor_id = u.id WHERE pr.created_at >= '2026-01-01' AND pr.created_at < '2026-02-01' ORDER BY pr.created_at DESC;
```

### Registrations for specific donor
```sql
SELECT pr.id, pr.registration_number, po.name as pooja_name, pr.quantity, pr.start_date, pr.created_at, pr.status FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id WHERE pr.donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') ORDER BY pr.created_at DESC;
```
**Example:** Shows all registrations for Donor (7894561232)

### Group registrations
```sql
SELECT pr.id, pr.registration_number, po.name, u.name as donor, pr.quantity, pr.created_at FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id JOIN accounts_user u ON pr.donor_id = u.id WHERE pr.is_group_registration = true ORDER BY pr.created_at DESC;
```

### Registrations with pending status
```sql
SELECT pr.id, pr.registration_number, po.name, u.name, pr.created_at FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id JOIN accounts_user u ON pr.donor_id = u.id WHERE pr.status = 'pending' ORDER BY pr.created_at DESC;
```

### Registrations with post prasadam
```sql
SELECT pr.id, pr.registration_number, po.name, u.name, pr.created_at FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id JOIN accounts_user u ON pr.donor_id = u.id WHERE pr.post_prasadam = true ORDER BY pr.created_at DESC;
```

### Registrations for specific date range (by start_date)
```sql
SELECT pr.id, pr.registration_number, po.name, u.name, pr.start_date FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id JOIN accounts_user u ON pr.donor_id = u.id WHERE pr.start_date >= '2026-02-01' AND pr.start_date <= '2026-02-28' ORDER BY pr.start_date;
```

---

## Payment Queries

### All payments
```sql
SELECT id, donor_id, registration_id, amount, mode, status, transaction_reference, created_at FROM payments_paymentrecord ORDER BY created_at DESC;
```

### Successful payments only
```sql
SELECT p.id, u.name, u.phone_number, p.amount, p.mode, p.created_at FROM payments_paymentrecord p JOIN accounts_user u ON p.donor_id = u.id WHERE p.status = 'success' ORDER BY p.created_at DESC;
```

### Payments by method
```sql
SELECT mode, COUNT(*) as count, SUM(amount) as total FROM payments_paymentrecord WHERE status = 'success' GROUP BY mode ORDER BY total DESC;
```

### Pending payments
```sql
SELECT p.id, u.name, u.phone_number, p.amount, p.mode, p.created_at FROM payments_paymentrecord p JOIN accounts_user u ON p.donor_id = u.id WHERE p.status = 'pending' ORDER BY p.created_at DESC;
```

### Failed payments
```sql
SELECT p.id, u.name, u.phone_number, p.amount, p.mode, p.transaction_reference, p.created_at FROM payments_paymentrecord p JOIN accounts_user u ON p.donor_id = u.id WHERE p.status = 'failed' ORDER BY p.created_at DESC;
```

### Payments for specific donor
```sql
SELECT id, amount, mode, status, transaction_reference, created_at FROM payments_paymentrecord WHERE donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') ORDER BY created_at DESC;
```
**Example:** Shows all payments for Donor (7894561232)

### Payments linked to registrations
```sql
SELECT p.id, u.name, po.name as pooja_name, p.amount, p.mode, p.status, p.created_at FROM payments_paymentrecord p JOIN accounts_user u ON p.donor_id = u.id JOIN pooja_poojaregistration pr ON p.registration_id = pr.id JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id WHERE p.status = 'success' ORDER BY p.created_at DESC;
```

### General donations (no registration link)
```sql
SELECT p.id, u.name, u.phone_number, p.amount, p.mode, p.notes, p.created_at FROM payments_paymentrecord p JOIN accounts_user u ON p.donor_id = u.id WHERE p.registration_id IS NULL AND p.status = 'success' ORDER BY p.created_at DESC;
```

### Monthly income report
```sql
SELECT DATE_TRUNC('month', created_at) as month, mode, COUNT(*) as count, SUM(amount) as total FROM payments_paymentrecord WHERE status = 'success' GROUP BY DATE_TRUNC('month', created_at), mode ORDER BY month DESC, total DESC;
```

### Donor payment summary
```sql
SELECT u.id, u.name, u.phone_number, COUNT(p.id) as payment_count, SUM(p.amount) as total_paid FROM accounts_user u LEFT JOIN payments_paymentrecord p ON u.id = p.donor_id AND p.status = 'success' GROUP BY u.id ORDER BY total_paid DESC NULLS LAST;
```

### Payment status distribution
```sql
SELECT status, COUNT(*) as count, SUM(amount) as total FROM payments_paymentrecord GROUP BY status;
```

---

## Passbook Entry Queries

### All passbook entries
```sql
SELECT id, donor_id, entry_date, entry_type, transaction_details, opening_balance, due_amount, paid_amount, closing_due, created_at FROM payments_passbookentry ORDER BY donor_id, entry_date DESC;
```

### Passbook for specific donor
```sql
SELECT entry_date, entry_type, transaction_details, opening_balance, due_amount, paid_amount, closing_due FROM payments_passbookentry WHERE donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') ORDER BY entry_date DESC;
```
**Example:** Shows complete financial statement for Donor (7894561232)

### Opening balance entries
```sql
SELECT donor_id, entry_date, opening_balance FROM payments_passbookentry WHERE entry_type = 'balance' ORDER BY donor_id, entry_date DESC;
```

### Due entries
```sql
SELECT pd.id, pbe.entry_date, pbe.due_amount, pbe.transaction_details FROM payments_passbookentry pbe JOIN accounts_user pd ON pbe.donor_id = pd.id WHERE pbe.entry_type = 'due' ORDER BY pbe.entry_date DESC;
```

### Payment entries
```sql
SELECT pd.id, pd.name, pbe.entry_date, pbe.paid_amount, pbe.transaction_details FROM payments_passbookentry pbe JOIN accounts_user pd ON pbe.donor_id = pd.id WHERE pbe.entry_type = 'paid' ORDER BY pbe.entry_date DESC;
```

### Passbook for month
```sql
SELECT u.name, pbe.entry_date, pbe.entry_type, pbe.opening_balance, pbe.due_amount, pbe.paid_amount, pbe.closing_due FROM payments_passbookentry pbe JOIN accounts_user u ON pbe.donor_id = u.id WHERE EXTRACT(MONTH FROM pbe.entry_date) = 1 AND EXTRACT(YEAR FROM pbe.entry_date) = 2026 ORDER BY pbe.donor_id, pbe.entry_date;
```

### Current due balance for each donor
```sql
SELECT u.name, u.phone_number, MAX(closing_due) as current_due FROM payments_passbookentry pbe JOIN accounts_user u ON pbe.donor_id = u.id WHERE pbe.entry_type IN ('balance', 'due', 'paid') GROUP BY u.id, u.name, u.phone_number HAVING MAX(closing_due) > 0 ORDER BY current_due DESC;
```

---

## Expense Record Queries

### All expenses
```sql
SELECT id, transaction_date, category, amount, notes, created_by_id, created_at FROM payments_expenserecord ORDER BY transaction_date DESC;
```

### Expenses by category
```sql
SELECT category, COUNT(*) as count, SUM(amount) as total, AVG(amount) as average FROM payments_expenserecord GROUP BY category ORDER BY total DESC;
```

### Monthly expense report
```sql
SELECT DATE_TRUNC('month', transaction_date) as month, category, COUNT(*) as count, SUM(amount) as total FROM payments_expenserecord GROUP BY DATE_TRUNC('month', transaction_date), category ORDER BY month DESC, total DESC;
```

### Expenses in date range
```sql
SELECT transaction_date, category, amount, notes FROM payments_expenserecord WHERE transaction_date >= '2026-01-01' AND transaction_date <= '2026-01-31' ORDER BY transaction_date DESC;
```

### Expenses for specific category
```sql
SELECT transaction_date, amount, notes, created_by_id, created_at FROM payments_expenserecord WHERE category = 'Maintenance' ORDER BY transaction_date DESC;
```

### High value expenses
```sql
SELECT transaction_date, category, amount, notes FROM payments_expenserecord WHERE amount > 10000 ORDER BY amount DESC;
```

### Expense records by admin
```sql
SELECT u.name as admin, COUNT(*) as count, SUM(e.amount) as total FROM payments_expenserecord e LEFT JOIN accounts_user u ON e.created_by_id = u.id GROUP BY e.created_by_id, u.name ORDER BY total DESC;
```

---

## Recurring Plan Queries

### All recurring plans
```sql
SELECT id, donor_id, pooja_option_id, recurrence_kind, recurrence_frequency, start_date, next_occurrence, is_active, created_at FROM pooja_recurringpoojaplan ORDER BY created_at DESC;
```

### Active recurring plans
```sql
SELECT rp.id, u.name, u.phone_number, po.name as pooja_name, rp.recurrence_frequency, rp.start_date, rp.next_occurrence FROM pooja_recurringpoojaplan rp JOIN accounts_user u ON rp.donor_id = u.id JOIN pooja_poojaoption po ON rp.pooja_option_id = po.id WHERE rp.is_active = true ORDER BY rp.next_occurrence;
```

### Inactive/paused plans
```sql
SELECT rp.id, u.name, po.name, rp.pause_from, rp.pause_until FROM pooja_recurringpoojaplan rp JOIN accounts_user u ON rp.donor_id = u.id JOIN pooja_poojaoption po ON rp.pooja_option_id = po.id WHERE rp.is_active = false OR (rp.pause_from IS NOT NULL AND rp.pause_until IS NOT NULL);
```

### Recurring plans by frequency
```sql
SELECT recurrence_frequency, COUNT(*) as count FROM pooja_recurringpoojaplan WHERE is_active = true GROUP BY recurrence_frequency;
```

### Donor recurring plans
```sql
SELECT rp.id, po.name, rp.recurrence_frequency, rp.start_date, rp.next_occurrence, rp.is_active FROM pooja_recurringpoojaplan rp JOIN pooja_poojaoption po ON rp.pooja_option_id = po.id WHERE rp.donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') ORDER BY rp.next_occurrence;
```
**Example:** Shows all recurring plans for Donor (7894561232)

### One-time extra plans
```sql
SELECT rp.id, u.name, po.name, rp.one_time_date, rp.amount FROM pooja_recurringpoojaplan rp JOIN accounts_user u ON rp.donor_id = u.id JOIN pooja_poojaoption po ON rp.pooja_option_id = po.id WHERE rp.recurrence_kind = 'one_time_extra' ORDER BY rp.one_time_date DESC;
```

### Plans with origin registration
```sql
SELECT rp.id, u.name, po.name, pr.registration_number, rp.recurrence_kind FROM pooja_recurringpoojaplan rp JOIN accounts_user u ON rp.donor_id = u.id JOIN pooja_poojaoption po ON rp.pooja_option_id = po.id LEFT JOIN pooja_poojaregistration pr ON rp.origin_registration_id = pr.id WHERE rp.origin_registration_id IS NOT NULL;
```

---

## Combined Payment Mapping Queries

### All active mappings
```sql
SELECT id, main_donor_id, parent_donor_id, main_donor_name, parent_donor_name, effective_from, effective_to FROM payments_combinepaymentmapping WHERE effective_from <= CURDATE() AND (effective_to IS NULL OR effective_to > CURDATE()) ORDER BY effective_from DESC;
```

### All mappings (including inactive)
```sql
SELECT id, main_donor_id, parent_donor_id, main_donor_name, parent_donor_name, effective_from, effective_to FROM payments_combinepaymentmapping ORDER BY effective_from DESC;
```

### Children mapped to specific parent
```sql
SELECT m.main_donor_name, m.main_donor_phone, m.effective_from FROM payments_combinepaymentmapping m WHERE m.parent_donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') AND m.effective_from <= CURDATE() AND (m.effective_to IS NULL OR m.effective_to > CURDATE());
```
**Example:** Shows all child donors mapped to Donor (7894561232)

### Parent mapping for specific child
```sql
SELECT m.parent_donor_name, m.parent_donor_phone, m.effective_from FROM payments_combinepaymentmapping m WHERE m.main_donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232');
```
**Example:** Shows if Donor (7894561232) is mapped to a parent account

---

## Data Validation & Integrity Queries

### Registrations without linked pooja option
```sql
SELECT pr.id, pr.donor_id FROM pooja_poojaregistration pr WHERE pr.pooja_option_id IS NULL OR pr.pooja_option_id NOT IN (SELECT id FROM pooja_poojaoption);
```

### Payments without linked donor
```sql
SELECT p.id FROM payments_paymentrecord p WHERE p.donor_id NOT IN (SELECT id FROM accounts_user);
```

### Orphaned passbook entries (no donor)
```sql
SELECT pbe.id FROM payments_passbookentry pbe WHERE pbe.donor_id NOT IN (SELECT id FROM accounts_user);
```

### Registrations with invalid status
```sql
SELECT pr.id, pr.status FROM pooja_poojaregistration pr WHERE pr.status NOT IN ('pending', 'confirmed', 'completed', 'cancelled');
```

### Duplicate registrations by donor and pooja
```sql
SELECT pr.donor_id, pr.pooja_option_id, pr.start_date, COUNT(*) as count FROM pooja_poojaregistration pr GROUP BY pr.donor_id, pr.pooja_option_id, pr.start_date HAVING COUNT(*) > 1;
```

### Payments with amount = 0
```sql
SELECT id, donor_id, mode, status, created_at FROM payments_paymentrecord WHERE amount = 0;
```

### Registration numbers with gaps
```sql
SELECT r1.registration_number + 1 as gap_start FROM pooja_poojaregistration r1 WHERE NOT EXISTS (SELECT 1 FROM pooja_poojaregistration r2 WHERE r2.registration_number = r1.registration_number + 1) ORDER BY gap_start;
```

---

## Reporting & Analysis Queries

### Revenue report by month
```sql
SELECT DATE_TRUNC('month', p.created_at) as month, SUM(p.amount) as revenue, COUNT(p.id) as transactions FROM payments_paymentrecord p WHERE p.status = 'success' GROUP BY DATE_TRUNC('month', p.created_at) ORDER BY month DESC;
```

### Income vs Expense by month
```sql
SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as income FROM payments_paymentrecord WHERE status = 'success' GROUP BY DATE_TRUNC('month', created_at) UNION ALL SELECT DATE_TRUNC('month', transaction_date) as month, -SUM(amount) as income FROM payments_expenserecord GROUP BY DATE_TRUNC('month', transaction_date) ORDER BY month DESC;
```

### Top poojas by registration count
```sql
SELECT po.name, COUNT(pr.id) as registrations FROM pooja_poojaregistration pr JOIN pooja_poojaoption po ON pr.pooja_option_id = po.id GROUP BY po.name ORDER BY registrations DESC LIMIT 10;
```

### Top donors by registration count
```sql
SELECT u.name, u.phone_number, COUNT(pr.id) as registration_count FROM accounts_user u LEFT JOIN pooja_poojaregistration pr ON u.id = pr.donor_id GROUP BY u.id ORDER BY registration_count DESC LIMIT 10;
```

### Top donors by total payment
```sql
SELECT u.name, u.phone_number, SUM(p.amount) as total_paid FROM accounts_user u LEFT JOIN payments_paymentrecord p ON u.id = p.donor_id AND p.status = 'success' GROUP BY u.id ORDER BY total_paid DESC NULLS LAST LIMIT 10;
```

### Payment success rate by method
```sql
SELECT mode, COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count, COUNT(*) as total, ROUND(100.0 * COUNT(CASE WHEN status = 'success' THEN 1 END) / COUNT(*), 2) as success_rate FROM payments_paymentrecord GROUP BY mode ORDER BY success_rate DESC;
```

### Average transaction value by method
```sql
SELECT mode, COUNT(*) as count, AVG(amount) as avg_amount, MIN(amount) as min_amount, MAX(amount) as max_amount FROM payments_paymentrecord WHERE status = 'success' GROUP BY mode ORDER BY avg_amount DESC;
```

### Monthly trend (registrations vs payments)
```sql
SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as registrations FROM pooja_poojaregistration GROUP BY DATE_TRUNC('month', created_at) ORDER BY month DESC;
```

---

## Deletion & Cleanup Queries

### Delete one-time registrations for specific donor
```sql
DELETE FROM payments_passbookentry pbe WHERE pbe.payment_record_id IN (SELECT id FROM payments_paymentrecord ppr WHERE ppr.registration_id IN (SELECT pr.id FROM pooja_poojaregistration pr WHERE pr.donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') AND pr.id NOT IN (SELECT origin_registration_id FROM pooja_recurringpoojaplan WHERE origin_registration_id IS NOT NULL)));

DELETE FROM payments_paymentrecord ppr WHERE ppr.registration_id IN (SELECT pr.id FROM pooja_poojaregistration pr WHERE pr.donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') AND pr.id NOT IN (SELECT origin_registration_id FROM pooja_recurringpoojaplan WHERE origin_registration_id IS NOT NULL));

DELETE FROM payments_passbookentry pbe WHERE pbe.registration_id IN (SELECT pr.id FROM pooja_poojaregistration pr WHERE pr.donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') AND pr.id NOT IN (SELECT origin_registration_id FROM pooja_recurringpoojaplan WHERE origin_registration_id IS NOT NULL));

DELETE FROM pooja_poojaregistration pr WHERE pr.donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232') AND pr.id NOT IN (SELECT origin_registration_id FROM pooja_recurringpoojaplan WHERE origin_registration_id IS NOT NULL);
```
**Example:** Deletes all one-time registrations for Donor (7894561232)

### Delete failed payments older than 30 days
```sql
DELETE FROM payments_paymentrecord WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';
```

### Delete pending payments older than 90 days
```sql
DELETE FROM payments_paymentrecord WHERE status = 'pending' AND created_at < NOW() - INTERVAL '90 days';
```

### Verify deletion count before deleting
```sql
SELECT COUNT(*) FROM pooja_poojaregistration pr WHERE pr.donor_id = (SELECT id FROM accounts_user WHERE phone_number = 'PHONE_NUMBER') AND pr.id NOT IN (SELECT origin_registration_id FROM pooja_recurringpoojaplan WHERE origin_registration_id IS NOT NULL);
```

### Update registration status
```sql
UPDATE pooja_poojaregistration SET status = 'completed' WHERE id = REGISTRATION_ID;
```

### Update payment status
```sql
UPDATE payments_paymentrecord SET status = 'success' WHERE id = PAYMENT_ID;
```

### Update created_at timestamp for registration
```sql
UPDATE pooja_poojaregistration SET created_at = '2026-01-01 00:00:00' WHERE donor_id = (SELECT id FROM accounts_user WHERE phone_number = '7894561232');
```
**Example:** Updates all registration dates for Donor (7894561232) to Jan 1, 2026

---

## Quick Reference

### Common Parameters
- **PHONE_NUMBER**: Use format like '7894561232' or '+917894561232' (Example donor: Donor with phone 7894561232)
- **REGISTRATION_ID**: Use the numeric ID from pooja_poojaregistration
- **PAYMENT_ID**: Use the numeric ID from payments_paymentrecord
- **YYYY-MM-DD**: Use ISO date format (2026-01-23)

### Example Donor
- **Name:** Donor
- **Phone:** 7894561232
- **Used throughout queries for practical examples**

### Most Used Tables
1. `accounts_user` - User/Donor information
2. `pooja_poojaregistration` - Pooja bookings
3. `pooja_poojaoption` - Pooja types
4. `payments_paymentrecord` - Payment transactions
5. `payments_passbookentry` - Donor financial statements
6. `pooja_recurringpoojaplan` - Recurring/subscription plans
7. `payments_expenserecord` - Temple expenses
8. `payments_combinepaymentmapping` - Group payment mappings

### Key Foreign Keys
- `pooja_poojaregistration.donor_id` → `accounts_user.id`
- `pooja_poojaregistration.pooja_option_id` → `pooja_poojaoption.id`
- `payments_paymentrecord.donor_id` → `accounts_user.id`
- `payments_paymentrecord.registration_id` → `pooja_poojaregistration.id`
- `payments_passbookentry.donor_id` → `accounts_user.id`

---

**End of Database Queries Guide**
