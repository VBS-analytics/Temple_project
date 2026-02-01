# CHRT Monthly Due Generation - Visual Explanation

## Problem Visualization

### Scenario: Donor with 5 Regular + 1 CHRT (October Preferred)

```
TIMELINE: January 2026 → December 2026

OLD CODE (BUGGY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│  │  │  │  │  │  │  │  │  │  │  │  │
700 700 700 700 700 700 700 700 700 700 700 700  ← WRONG! CHRT in EVERY month
(5+C)(5+C)(5+C)(5+C)(5+C)(5+C)(5+C)(5+C)(5+C)(5+C)(5+C)(5+C)
│  │  │  │  │  │  │  │  │  │✗ │✗ │✗ │
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
                                   ↑
                            Oct = Preferred month
                            (Correct here, but wrong everywhere else!)

KEY ISSUE:
months_between = (Oct - Oct) % 1 = 0 ✓  (Correct)
months_between = (Nov - Oct) % 1 = 0 ✓  (BUG! Should be X)
months_between = (Dec - Oct) % 1 = 0 ✓  (BUG! Should be X)
  ^--- ANY number % 1 = 0 always!


NEW CODE (FIXED):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│  │  │  │  │  │  │  │  │  │  │  │  │
500 500 500 500 500 500 500 500 500 700 500 500  ← CORRECT! CHRT only in Oct
(5) (5) (5) (5) (5) (5) (5) (5) (5)(5+C)(5) (5)
│  │  │  │  │  │  │  │  │  │✓ │  │  │
├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
                                   ↑
                            Oct = Preferred month
                            (Correct here, and ONLY here!)

KEY FIX:
current_month.month (10) == preferred_month.month (10) ✓  (Oct matches)
current_month.month (11) == preferred_month.month (10) ✗  (Nov doesn't match)
current_month.month (12) == preferred_month.month (10) ✗  (Dec doesn't match)
  ^--- Precise month matching!
```

---

## Logic Comparison

### MONTHLY CHRT POOJA (Preferred: October)

```
┌─────────────────────────────────────────────────────────────┐
│ OLD CODE (BUGGY)                                            │
├─────────────────────────────────────────────────────────────┤
│ months_between = (current_month.year - pref.year)*12        │
│                + (current_month.month - pref.month)         │
│ should_generate = (months_between % 1 == 0) AND (>= 0)      │
│                                                             │
│ Jan: (0-0)*12 + (1-10) = -9  % 1 = 0 ✓ AND (-9>=0) ✗ = NO  │
│ Feb: (0-0)*12 + (2-10) = -8  % 1 = 0 ✓ AND (-8>=0) ✗ = NO  │
│ ...                                                         │
│ Oct: (0-0)*12 + (10-10)= 0   % 1 = 0 ✓ AND (0>=0) ✓ = YES  │
│ Nov: (0-0)*12 + (11-10)= 1   % 1 = 0 ✓ AND (1>=0) ✓ = YES  │ ← BUG!
│ Dec: (0-0)*12 + (12-10)= 2   % 1 = 0 ✓ AND (2>=0) ✓ = YES  │ ← BUG!
│     (Every month after Oct gets YES!)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NEW CODE (FIXED)                                            │
├─────────────────────────────────────────────────────────────┤
│ should_generate = (current_month.month == pref.month) AND   │
│                   (current_month.year >= pref.year)         │
│                                                             │
│ Jan: (1 == 10) AND (2026 >= 2026) = FALSE AND TRUE = NO ✓  │
│ Feb: (2 == 10) AND (2026 >= 2026) = FALSE AND TRUE = NO ✓  │
│ ...                                                         │
│ Oct: (10 == 10) AND (2026 >= 2026) = TRUE AND TRUE = YES ✓ │
│ Nov: (11 == 10) AND (2026 >= 2026) = FALSE AND TRUE = NO ✓ │
│ Dec: (12 == 10) AND (2026 >= 2026) = FALSE AND TRUE = NO ✓ │
│     (Only Oct gets YES!)                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Recurrence Frequencies

### MONTHLY: October Every Year

```
2026: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
      ─── ─── ─── ─── ─── ─── ─── ─── ─── ✓✓✓ ─── ───
                                         Oct (CHRT appears)

2027: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
      ─── ─── ─── ─── ─── ─── ─── ─── ─── ✓✓✓ ─── ───
                                         Oct (CHRT appears)

2028: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
      ─── ─── ─── ─── ─── ─── ─── ─── ─── ✓✓✓ ─── ───
                                         Oct (CHRT appears)

Pattern: month == 10 (regardless of year)
```

### QUARTERLY: Q4 (Oct-Nov-Dec) Every Year

```
2026: Q1        Q2        Q3        Q4
      Jan Feb   Apr May   Jul Aug   Oct Nov Dec
      Mar       Jun       Sep       ✓✓✓ ✓✓✓ ✓✓✓
      ─ ─ ─     ─ ─ ─     ─ ─ ─     (All Q4 months have CHRT)

2027: Q1        Q2        Q3        Q4
      Jan Feb   Apr May   Jul Aug   Oct Nov Dec
      Mar       Jun       Sep       ✓✓✓ ✓✓✓ ✓✓✓
      ─ ─ ─     ─ ─ ─     ─ ─ ─     (All Q4 months have CHRT)

Pattern: quarter == 3 (Oct-Nov-Dec = quarter 3)
Quarter calculation: (month - 1) // 3
  Jan-Mar (1-3):   (0,1,2) // 3 = 0 (Q1)
  Apr-Jun (4-6):   (3,4,5) // 3 = 1 (Q2)
  Jul-Sep (7-9):   (6,7,8) // 3 = 2 (Q3)
  Oct-Dec (10-12): (9,10,11) // 3 = 3 (Q4)
```

### ANNUALLY: March Only

```
2026: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
      ─── ─── ✓✓✓ ─── ─── ─── ─── ─── ─── ─── ─── ───
              Mar (CHRT appears)

2027: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
      ─── ─── ✓✓✓ ─── ─── ─── ─── ─── ─── ─── ─── ───
              Mar (CHRT appears)

2028: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
      ─── ─── ✓✓✓ ─── ─── ─── ─── ─── ─── ─── ─── ───
              Mar (CHRT appears)

Pattern: month == 3 AND year >= 2026
```

---

## Payment Amount Calculation

```
MONTHLY CHRT POOJA (Oct preferred):

═════════════════════════════════════════════════════════════════
Month         Regular Poojas    CHRT Pooja    Total Amount
═════════════════════════════════════════════════════════════════
January       ₹500              —             ₹500
              (5 × ₹100)        (Not in month)
February      ₹500              —             ₹500
              (5 × ₹100)        (Not in month)
...
October       ₹500              ₹200          ₹700
              (5 × ₹100)        (In month!)
November      ₹500              —             ₹500
              (5 × ₹100)        (Not in month)
December      ₹500              —             ₹500
              (5 × ₹100)        (Not in month)
═════════════════════════════════════════════════════════════════
```

---

## Decision Tree

```
CHRT MONTHLY POOJA (Oct 2026):

                          Is October?
                              |
                    ┌─────────┴─────────┐
                   YES                  NO
                    |                   |
              Generate Due          Continue
              (₹700 total)          (₹500 only)
              

CHRT QUARTERLY POOJA (Nov/Q4):

                      Is Q4 Month?
                    (Oct/Nov/Dec)
                         |
              ┌──────────┴──────────┐
             YES                   NO
              |                     |
        Generate Due          Continue
        (₹800 total)          (₹500 only)


CHRT ANNUAL POOJA (Mar):

                      Is March?
                         |
            ┌────────────┴────────────┐
           YES                       NO
            |                         |
      Generate Due              Continue
      (₹900 total)              (₹500 only)
```

---

## Data Flow

```
BEFORE:
┌──────────────────────┐
│ process_recurring_   │
│ plans()              │
└──────────┬───────────┘
           │
           ├─→ _generate_due_payments_for_recurring_plans()
           │   └─→ [5 poojas] = ₹500 monthly
           │
           └─→ _generate_due_payments_for_chrt_poojas()
               └─→ OLD BUG: months_between % 1 == 0 (always true)
                   └─→ Generates ₹200 EVERY MONTH
                       ✗ Jan: ₹700 (Wrong)
                       ✗ Feb: ₹700 (Wrong)
                       ...
                       ✓ Oct: ₹700 (Correct)
                       ✗ Nov: ₹700 (Wrong)


AFTER:
┌──────────────────────┐
│ process_recurring_   │
│ plans()              │
└──────────┬───────────┘
           │
           ├─→ _generate_due_payments_for_recurring_plans()
           │   └─→ [5 poojas] = ₹500 monthly
           │
           └─→ _generate_due_payments_for_chrt_poojas()
               └─→ NEW FIX: current_month.month == preferred_month.month
                   └─→ Generates ₹200 ONLY IN OCTOBER
                       ✓ Jan: ₹500 (Correct)
                       ✓ Feb: ₹500 (Correct)
                       ...
                       ✓ Oct: ₹700 (Correct)
                       ✓ Nov: ₹500 (Correct)
```

---

## Summary Table

| Aspect | Old Code | New Code | Impact |
|--------|----------|----------|--------|
| **Logic** | `months_between % freq == 0` | `month == month` | ✅ Precise |
| **Monthly** | Generates every month | Generates once/year | ✅ Fixed |
| **Quarterly** | Generates every month | Generates in Q only | ✅ Fixed |
| **Annually** | Generates every month | Generates yearly | ✅ Fixed |
| **Payment** | Overcharges | Correct amount | ✅ Accurate |
| **Safety** | Still unsafe | Still prevents future | ✅ Safe |

