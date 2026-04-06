import { useCallback, useEffect, useMemo, useState } from 'react';

import api, { extractResults } from '../../lib/api';

type PaymentRecordEntry = {
  id: number;
  donor: number;
  donor_name?: string | null;
  pooja_option?: string | null;
  amount: string | number;
  status?: string | null;
  mode?: string | null;
  transaction_reference?: string | null;
  payment_month?: string | null;
  created_at?: string | null;
  notes?: string | null;
};

type ExpenseRecordEntry = {
  id: number;
  transaction_date?: string | null;
  category?: string | null;
  amount: string | number;
  transaction_no?: string | null;
  created_by_name?: string | null;
  comments?: string | null;
  remarks?: string | null;
};

type AdditionIncomeRecordEntry = {
  id: number;
  transaction_date?: string | null;
  category?: string | null;
  amount: string | number;
  transaction_no?: string | null;
  created_by_name?: string | null;
  comments?: string | null;
  remarks?: string | null;
};

type StatementRow = {
  key: string;
  date: Date;
  dateLabel: string;
  type: 'payment' | 'income' | 'expense' | 'opening_balance';
  details: string;
  reference: string;
  inflow: number;
  outflow: number;
};

type MonthOption = {
  value: string;
  label: string;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const MONEY_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) => MONEY_FORMATTER.format(value);

const normalizeText = (value?: string | null) => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : '';
};

const parseAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMonthKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

const formatDateLabel = (value: Date) =>
  value.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const DECEMBER_2025_OPENING_BALANCE_ROWS: StatementRow[] = [
  {
    key: 'opening-balance-kumbabishekam-2025-12',
    date: new Date(2025, 11, 1),
    dateLabel: formatDateLabel(new Date(2025, 11, 1)),
    type: 'opening_balance',
    details: 'Kumbabishekam SB account balance',
    reference: 'Manual Opening Balance',
    inflow: 9091,
    outflow: 0,
  },
  {
    key: 'opening-balance-normal-2025-12',
    date: new Date(2025, 11, 1),
    dateLabel: formatDateLabel(new Date(2025, 11, 1)),
    type: 'opening_balance',
    details: 'Normal account SB account balance',
    reference: 'Manual Opening Balance',
    inflow: 216770,
    outflow: 0,
  },
];

const parseDateValue = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const parsedDateOnly = new Date(year, month - 1, day);
    if (Number.isNaN(parsedDateOnly.getTime())) {
      return null;
    }
    return parsedDateOnly;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const getPaymentLedgerMonthDate = (payment: PaymentRecordEntry) =>
  parseDateValue(payment.payment_month) ?? parseDateValue(payment.created_at);

const getPaymentDisplayDate = (payment: PaymentRecordEntry) =>
  parseDateValue(payment.created_at) ?? getPaymentLedgerMonthDate(payment);

const buildMonthOptions = (): MonthOption[] => {
  const start = new Date(2025, 11, 1);
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const options: MonthOption[] = [];
  const cursor = new Date(currentMonthStart);

  while (cursor >= start) {
    options.push({
      value: toMonthKey(cursor),
      label: MONTH_FORMATTER.format(cursor),
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return options;
};

const normalizeNextUrl = (nextValue: unknown): string | null => {
  if (typeof nextValue !== 'string' || nextValue.length === 0) {
    return null;
  }
  let path = nextValue;
  if (path.startsWith('http')) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  if (path.startsWith('api/')) {
    path = path.slice(4);
  }
  return path;
};

const AccountStatementPage = () => {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(() => monthOptions[0]?.value ?? '');
  const [monthPayments, setMonthPayments] = useState<PaymentRecordEntry[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<ExpenseRecordEntry[]>([]);
  const [monthAdditionIncomes, setMonthAdditionIncomes] = useState<AdditionIncomeRecordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPaymentsForMonth = useCallback(async (month: string): Promise<PaymentRecordEntry[]> => {
    const results: PaymentRecordEntry[] = [];
    const firstResponse = await api.get('payments/records/', { params: { month } });
    results.push(...extractResults<PaymentRecordEntry>(firstResponse.data));
    let nextUrl: string | null = normalizeNextUrl(firstResponse.data?.next);

    while (nextUrl) {
      const response = await api.get(nextUrl);
      results.push(...extractResults<PaymentRecordEntry>(response.data));
      nextUrl = normalizeNextUrl(response.data?.next);
    }

    return results;
  }, []);

  const fetchExpensesForMonth = useCallback(async (month: string): Promise<ExpenseRecordEntry[]> => {
    const response = await api.get('payments/expenses/', { params: { month } });
    return extractResults<ExpenseRecordEntry>(response.data);
  }, []);

  const fetchAdditionIncomesForMonth = useCallback(async (month: string): Promise<AdditionIncomeRecordEntry[]> => {
    const response = await api.get('payments/addition-incomes/', { params: { month } });
    return extractResults<AdditionIncomeRecordEntry>(response.data);
  }, []);

  const loadStatementData = useCallback(async () => {
    if (!selectedMonth) {
      setMonthPayments([]);
      setMonthExpenses([]);
      setMonthAdditionIncomes([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [payments, expenses, additionIncomes] = await Promise.all([
        fetchPaymentsForMonth(selectedMonth),
        fetchExpensesForMonth(selectedMonth),
        fetchAdditionIncomesForMonth(selectedMonth),
      ]);
      setMonthPayments(payments);
      setMonthExpenses(expenses);
      setMonthAdditionIncomes(additionIncomes);
    } catch (loadError: any) {
      const detail =
        loadError?.response?.data?.detail ??
        loadError?.message ??
        'Unable to load account statement data.';
      setError(typeof detail === 'string' ? detail : 'Unable to load account statement data.');
      setMonthPayments([]);
      setMonthExpenses([]);
      setMonthAdditionIncomes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, fetchPaymentsForMonth, fetchExpensesForMonth, fetchAdditionIncomesForMonth]);

  useEffect(() => {
    void loadStatementData();
  }, [loadStatementData]);

  const statementRows = useMemo<StatementRow[]>(() => {
    const paymentRows: StatementRow[] = monthPayments
      .filter((payment) => {
        if ((payment.status ?? '').trim().toLowerCase() !== 'success') {
          return false;
        }
        const paymentLedgerMonthDate = getPaymentLedgerMonthDate(payment);
        if (!paymentLedgerMonthDate) {
          return false;
        }
        if (toMonthKey(paymentLedgerMonthDate) !== selectedMonth) {
          return false;
        }
        const paymentDisplayDate = getPaymentDisplayDate(payment);
        return paymentDisplayDate !== null;
      })
      .map((payment) => {
        const paymentDate = getPaymentDisplayDate(payment) ?? new Date(0);
        const donorName = normalizeText(payment.donor_name) || `Donor #${payment.donor}`;
        const poojaName = normalizeText(payment.pooja_option) || 'Pooja Payment';
        const mode = normalizeText(payment.mode).toUpperCase();
        const modeLabel = mode ? ` · ${mode}` : '';
        const details = `${poojaName} (${donorName})${modeLabel}`;
        const reference =
          normalizeText(payment.transaction_reference) ||
          `Payment #${payment.id}`;

        return {
          key: `payment-${payment.id}`,
          date: paymentDate,
          dateLabel: formatDateLabel(paymentDate),
          type: 'payment',
          details,
          reference,
          inflow: parseAmount(payment.amount),
          outflow: 0,
        };
      });

    const expenseRows: StatementRow[] = monthExpenses
      .map<StatementRow | null>((expense) => {
        const expenseDate = parseDateValue(expense.transaction_date);
        if (!expenseDate) {
          return null;
        }
        const category = normalizeText(expense.category) || 'Expense';
        const createdBy = normalizeText(expense.created_by_name);
        const details = createdBy ? `${category} (${createdBy})` : category;
        const reference = normalizeText(expense.transaction_no) || `Expense #${expense.id}`;

        return {
          key: `expense-${expense.id}`,
          date: expenseDate,
          dateLabel: formatDateLabel(expenseDate),
          type: 'expense',
          details,
          reference,
          inflow: 0,
          outflow: parseAmount(expense.amount),
        };
      })
      .filter((row): row is StatementRow => row !== null);

    const additionIncomeRows: StatementRow[] = monthAdditionIncomes
      .map<StatementRow | null>((income) => {
        const incomeDate = parseDateValue(income.transaction_date);
        if (!incomeDate) {
          return null;
        }
        const category = normalizeText(income.category) || 'Additional Income';
        const createdBy = normalizeText(income.created_by_name);
        const details = createdBy ? `${category} (${createdBy})` : `${category} (Additional Income)`;
        const reference = normalizeText(income.transaction_no) || `Income #${income.id}`;

        return {
          key: `income-${income.id}`,
          date: incomeDate,
          dateLabel: formatDateLabel(incomeDate),
          type: 'income',
          details,
          reference,
          inflow: parseAmount(income.amount),
          outflow: 0,
        };
      })
      .filter((row): row is StatementRow => row !== null);

    const manualOpeningBalanceRows =
      selectedMonth === '2025-12' ? DECEMBER_2025_OPENING_BALANCE_ROWS : [];

    return [...manualOpeningBalanceRows, ...paymentRows, ...additionIncomeRows, ...expenseRows].sort(
      (left, right) => left.date.getTime() - right.date.getTime(),
    );
  }, [monthPayments, monthAdditionIncomes, monthExpenses, selectedMonth]);

  const totals = useMemo(() => {
    const inflow = statementRows.reduce((sum, row) => sum + row.inflow, 0);
    const outflow = statementRows.reduce((sum, row) => sum + row.outflow, 0);
    const paymentCount = statementRows.filter((row) => row.type === 'payment').length;
    const additionIncomeCount = statementRows.filter((row) => row.type === 'income').length;
    const expenseCount = statementRows.filter((row) => row.type === 'expense').length;
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      paymentCount,
      additionIncomeCount,
      expenseCount,
    };
  }, [statementRows]);

  const selectedMonthLabel = useMemo(
    () => monthOptions.find((option) => option.value === selectedMonth)?.label ?? selectedMonth,
    [monthOptions, selectedMonth],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Account Statement</h1>
            <p className="mt-1 text-sm text-slate-600">
              Month-wise ledger of donor pooja payments, addition income, and admin expense entries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="account-statement-month">
              Month
            </label>
            <select
              id="account-statement-month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadStatementData()}
              disabled={loading}
              className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-violet-700">Opening Balance</p>
            <p className="text-base font-semibold text-violet-900">{formatCurrency(0)}</p>
            <p className="text-xs text-violet-700">Manual setup pending</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700">Inflow</p>
            <p className="text-base font-semibold text-emerald-900">{formatCurrency(totals.inflow)}</p>
            <p className="text-xs text-emerald-700">
              {totals.paymentCount} donor payment{totals.paymentCount === 1 ? '' : 's'} + {totals.additionIncomeCount} addition income entr{totals.additionIncomeCount === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-rose-700">Outflow</p>
            <p className="text-base font-semibold text-rose-900">{formatCurrency(totals.outflow)}</p>
            <p className="text-xs text-rose-700">{totals.expenseCount} expense entr{totals.expenseCount === 1 ? 'y' : 'ies'}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-700">Net Balance</p>
            <p className="text-base font-semibold text-indigo-900">{formatCurrency(totals.net)}</p>
            <p className="text-xs text-indigo-700">{selectedMonthLabel}</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        {!error && loading && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading account statement...
          </div>
        )}

        {!error && !loading && statementRows.length === 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No payment, addition income, or expense transactions found for {selectedMonthLabel}.
          </div>
        )}

        {!error && !loading && statementRows.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-amber-200">
            <div className="overflow-x-auto">
              <table className="min-w-[80rem] w-full table-fixed divide-y divide-amber-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                    <th className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Details</th>
                    <th className="w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Reference</th>
                    <th className="w-40 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Inflow</th>
                    <th className="w-40 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Outflow</th>
                    <th className="w-40 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white">
                  {statementRows.map((row) => (
                    <tr key={row.key} className="odd:bg-white even:bg-amber-50/20">
                      <td className="px-4 py-3 text-sm text-slate-700">{row.dateLabel}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            row.type === 'payment'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : row.type === 'income'
                                ? 'border-sky-200 bg-sky-50 text-sky-800'
                              : row.type === 'expense'
                                ? 'border-rose-200 bg-rose-50 text-rose-800'
                                : 'border-violet-200 bg-violet-50 text-violet-800'
                          }`}
                        >
                          {row.type === 'payment'
                            ? 'Donor Payment'
                            : row.type === 'income'
                              ? 'Addition Income'
                              : row.type === 'expense'
                                ? 'Admin Expense'
                                : 'Opening Balance'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{row.details}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.reference}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-800">
                        {row.inflow > 0 ? formatCurrency(row.inflow) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-rose-800">
                        {row.outflow > 0 ? formatCurrency(row.outflow) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccountStatementPage;
