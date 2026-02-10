export const parsePassbookAmount = (value: unknown): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? 0 : value;
  }

  const normalized = String(value).replace(/,/g, '').replace(/₹/g, '').trim();
  const numeric = Number(normalized);
  return Number.isNaN(numeric) ? 0 : numeric;
};

type RawAmountFields = {
  due_amount?: unknown;
  paid_amount?: unknown;
  closing_due?: unknown;
};

export const normalizePassbookAmountEntry = <T extends RawAmountFields>(
  entry: T,
): Omit<T, 'due_amount' | 'paid_amount' | 'closing_due'> & {
  due_amount: number;
  paid_amount: number;
  closing_due: number;
} => ({
  ...entry,
  due_amount: parsePassbookAmount(entry.due_amount),
  paid_amount: parsePassbookAmount(entry.paid_amount),
  closing_due: parsePassbookAmount(entry.closing_due),
});

export const normalizePassbookAmountEntries = <T extends RawAmountFields>(entries: T[]) =>
  entries.map((entry) => normalizePassbookAmountEntry(entry));
