import { describe, expect, it } from 'vitest';

import {
  normalizePassbookAmountEntries,
  parsePassbookAmount,
} from './passbookAmountUtils';

describe('passbookAmountUtils', () => {
  it('parses passbook amount strings with commas and currency symbol', () => {
    expect(parsePassbookAmount('2,000.00')).toBe(2000);
    expect(parsePassbookAmount('₹ 3,000.00')).toBe(3000);
    expect(parsePassbookAmount('')).toBe(0);
    expect(parsePassbookAmount(null)).toBe(0);
  });

  it('keeps combined donor due totals and closing due correct for Jan/Feb 2026 scenario', () => {
    const rawEntries = [
      { donor: 101, entry_date: '2026-01-01', entry_type: 'due', due_amount: '3,000.00', paid_amount: '0.00', closing_due: '3,000.00' },
      { donor: 201, entry_date: '2026-01-01', entry_type: 'due', due_amount: '2,000.00', paid_amount: '0.00', closing_due: '2,000.00' },
      { donor: 101, entry_date: '2026-02-01', entry_type: 'due', due_amount: '₹3,000.00', paid_amount: '0.00', closing_due: '6,000.00' },
      { donor: 201, entry_date: '2026-02-01', entry_type: 'due', due_amount: '₹2,000.00', paid_amount: '0.00', closing_due: '4,000.00' },
    ] as const;

    const normalized = normalizePassbookAmountEntries([...rawEntries]);

    const parentTotalsByMonth = normalized.reduce<Record<string, number>>((acc, entry) => {
      if (entry.donor !== 201 || entry.entry_type !== 'due') {
        return acc;
      }
      const key = entry.entry_date.slice(0, 7);
      acc[key] = (acc[key] ?? 0) + entry.due_amount;
      return acc;
    }, {});

    expect(parentTotalsByMonth['2026-01']).toBe(2000);
    expect(parentTotalsByMonth['2026-02']).toBe(2000);

    const timeline = [
      { donor: -9999, date: '2025-12-31', due: 0, paid: 0 },
      { donor: 101, date: '2026-01-01', due: 3000, paid: 0 },
      { donor: -9999, date: '2026-01-01', due: parentTotalsByMonth['2026-01'], paid: 0 },
      { donor: 101, date: '2026-02-01', due: 3000, paid: 0 },
      { donor: -9999, date: '2026-02-01', due: parentTotalsByMonth['2026-02'], paid: 0 },
    ];

    let running = 0;
    const closingByRow = timeline.map((row) => {
      running = running + row.due - row.paid;
      return running;
    });

    expect(closingByRow).toEqual([0, 3000, 5000, 8000, 10000]);
  });
});
