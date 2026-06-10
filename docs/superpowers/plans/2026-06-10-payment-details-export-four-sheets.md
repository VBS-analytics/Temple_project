# Payment Details Export Four Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the payment details export always include the `Combined Statement View` sheet while preserving the existing checkbox behavior for `Passbook Entries`.

**Architecture:** Keep the export contract centered in `PaymentDetailsExportView`. The backend will always create the combined sheet with headers, populate it whenever active combine mappings exist, and leave it header-only otherwise. Tests in `backend/payments/tests.py` will define the workbook shape and the data population rules.

**Tech Stack:** Django, Django REST Framework, openpyxl, Django test runner

---

### Task 1: Lock the workbook contract with tests

**Files:**
- Modify: `backend/payments/tests.py`
- Test: `backend/payments/tests.py`

- [ ] **Step 1: Write the failing tests**

Add tests that verify:

```python
def test_payment_details_export_always_includes_combined_sheet(self):
    ...

def test_payment_details_export_keeps_combined_sheet_header_only_without_active_mappings(self):
    ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python manage.py test payments.tests.PaymentDetailsExportContentTests -v 2`
Expected: FAIL because the default export does not yet always create/populate `Combined Statement View`.

- [ ] **Step 3: Implement the minimal backend change**

Update `PaymentDetailsExportView.get()` so it always creates `Combined Statement View`, always appends headers, and only appends data rows when active mappings exist.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python manage.py test payments.tests.PaymentDetailsExportContentTests -v 2`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/payments/tests.py backend/payments/views.py docs/superpowers/plans/2026-06-10-payment-details-export-four-sheets.md
git commit -m "fix: always include combined payment statement sheet"
```

### Task 2: Verify the focused regression surface

**Files:**
- Modify: `backend/payments/views.py`
- Test: `backend/payments/tests.py`

- [ ] **Step 1: Run a broader payment test slice**

Run: `cd backend && python manage.py test payments.tests.PaymentExportAccessTests payments.tests.PaymentDetailsExportContentTests -v 2`
Expected: PASS

- [ ] **Step 2: Review workbook behavior**

Confirm the export rules remain:

```text
Payment Records: subordinate donors excluded
Passbook Entries: subordinate donors included only when include_subordinates=true
Donor Statements: subordinate donors excluded
Combined Statement View: sheet always present; rows included when active combine mappings exist
```

- [ ] **Step 3: Commit if needed**

```bash
git add backend/payments/tests.py backend/payments/views.py
git commit -m "test: cover combined payment export workbook shape"
```
