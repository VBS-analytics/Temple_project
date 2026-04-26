import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { utils as xlsxUtils, writeFile as writeXlsxFile } from 'xlsx';

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

type StatementDisplayRow = StatementRow & {
  balance: number;
};

type MonthData = {
  payments: PaymentRecordEntry[];
  expenses: ExpenseRecordEntry[];
  additionIncomes: AdditionIncomeRecordEntry[];
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

const getPaymentLedgerDate = (payment: PaymentRecordEntry) =>
  parseDateValue(payment.payment_month) ?? parseDateValue(payment.created_at);

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

const sanitizeFilename = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '_').trim();

const LEDGER_CARRY_FORWARD_START_MONTH = '2026-01';
const LEDGER_CARRY_FORWARD_START_OPENING_BALANCE = 225861;
const EMPTY_MONTH_DATA: MonthData = {
  payments: [],
  expenses: [],
  additionIncomes: [],
};

const parseMonthKeyDate = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return new Date(year, month - 1, 1);
};

const compareMonthKeys = (left: string, right: string) => {
  const leftDate = parseMonthKeyDate(left);
  const rightDate = parseMonthKeyDate(right);
  if (!leftDate || !rightDate) {
    return left.localeCompare(right);
  }
  if (leftDate.getFullYear() === rightDate.getFullYear()) {
    return leftDate.getMonth() - rightDate.getMonth();
  }
  return leftDate.getFullYear() - rightDate.getFullYear();
};

const listMonthKeysInclusive = (startMonth: string, endMonth: string): string[] => {
  const startDate = parseMonthKeyDate(startMonth);
  const endDate = parseMonthKeyDate(endMonth);
  if (!startDate || !endDate) {
    return [];
  }
  if (startDate.getTime() > endDate.getTime()) {
    return [];
  }

  const keys: string[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor.getTime() <= endDate.getTime()) {
    keys.push(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
};

const getRequiredMonthKeysForSelection = (selectedMonth: string) => {
  if (!selectedMonth) {
    return [];
  }
  if (compareMonthKeys(selectedMonth, LEDGER_CARRY_FORWARD_START_MONTH) < 0) {
    return [selectedMonth];
  }
  return listMonthKeysInclusive(LEDGER_CARRY_FORWARD_START_MONTH, selectedMonth);
};

const summarizeRows = (rows: StatementRow[]) => {
  let inflow = 0;
  let outflow = 0;
  let paymentCount = 0;
  let additionIncomeCount = 0;
  let expenseCount = 0;

  rows.forEach((row) => {
    inflow += row.inflow;
    outflow += row.outflow;
    if (row.type === 'payment') {
      paymentCount += 1;
    } else if (row.type === 'income') {
      additionIncomeCount += 1;
    } else if (row.type === 'expense') {
      expenseCount += 1;
    }
  });

  return {
    inflow,
    outflow,
    paymentCount,
    additionIncomeCount,
    expenseCount,
  };
};

const buildStatementRowsForMonth = (monthKey: string, monthData: MonthData): StatementRow[] => {
  const paymentRows: StatementRow[] = monthData.payments
    .filter((payment) => {
      const normalizedStatus = (payment.status ?? '').trim().toLowerCase();
      const amount = parseAmount(payment.amount);
      const hasReference = normalizeText(payment.transaction_reference).length > 0;
      const isFailedLike = normalizedStatus === 'failed' || normalizedStatus === 'refunded';
      const isPaidLike = normalizedStatus === 'success' || (hasReference && amount > 0);
      if (isFailedLike || !isPaidLike) {
        return false;
      }
      const paymentLedgerDate = getPaymentLedgerDate(payment);
      if (!paymentLedgerDate) {
        return false;
      }
      return toMonthKey(paymentLedgerDate) === monthKey;
    })
    .map((payment) => {
      const paymentDate = getPaymentLedgerDate(payment) ?? new Date(0);
      const donorName = normalizeText(payment.donor_name) || `Donor #${payment.donor}`;
      const poojaName = normalizeText(payment.pooja_option) || 'Pooja Payment';
      const mode = normalizeText(payment.mode).toUpperCase();
      const modeLabel = mode ? ` · ${mode}` : '';
      const details = `${poojaName} (${donorName})${modeLabel}`;
      const reference = normalizeText(payment.transaction_reference) || `Payment #${payment.id}`;

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

  const expenseRows: StatementRow[] = monthData.expenses
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

  const additionIncomeRows: StatementRow[] = monthData.additionIncomes
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
    monthKey === '2025-12' ? DECEMBER_2025_OPENING_BALANCE_ROWS : [];

  return [...manualOpeningBalanceRows, ...paymentRows, ...additionIncomeRows, ...expenseRows].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );
};

const AccountStatementPage = () => {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(() => monthOptions[0]?.value ?? '');
  const [monthDataByKey, setMonthDataByKey] = useState<Record<string, MonthData>>({});
  const [loading, setLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [error, setError] = useState('');
  const activeRequestIdRef = useRef(0);
  const monthDataByKeyRef = useRef<Record<string, MonthData>>({});

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

  const fetchAllDataForMonth = useCallback(
    async (month: string): Promise<MonthData> => {
      const [payments, expenses, additionIncomes] = await Promise.all([
        fetchPaymentsForMonth(month),
        fetchExpensesForMonth(month),
        fetchAdditionIncomesForMonth(month),
      ]);
      return {
        payments,
        expenses,
        additionIncomes,
      };
    },
    [fetchPaymentsForMonth, fetchExpensesForMonth, fetchAdditionIncomesForMonth],
  );

  const loadStatementData = useCallback(async () => {
    if (!selectedMonth) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      const requiredMonthKeys = getRequiredMonthKeysForSelection(selectedMonth);
      const cachedMonthData = monthDataByKeyRef.current;
      const missingMonthKeys = requiredMonthKeys.filter((monthKey) => !cachedMonthData[monthKey]);

      if (missingMonthKeys.length > 0) {
        const fetchedMonthEntries = await Promise.all(
          missingMonthKeys.map(async (monthKey) => [monthKey, await fetchAllDataForMonth(monthKey)] as const),
        );
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        const mergedMonthData = { ...cachedMonthData };
        fetchedMonthEntries.forEach(([monthKey, monthData]) => {
          mergedMonthData[monthKey] = monthData;
        });
        monthDataByKeyRef.current = mergedMonthData;
        setMonthDataByKey(mergedMonthData);
      }

      if (activeRequestIdRef.current !== requestId) {
        return;
      }
    } catch (loadError: any) {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }
      const detail =
        loadError?.response?.data?.detail ??
        loadError?.message ??
        'Unable to load account statement data.';
      setError(typeof detail === 'string' ? detail : 'Unable to load account statement data.');
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [selectedMonth, fetchAllDataForMonth]);

  useEffect(() => {
    void loadStatementData();
  }, [loadStatementData]);

  const selectedMonthData = monthDataByKey[selectedMonth] ?? EMPTY_MONTH_DATA;

  const statementRows = useMemo<StatementRow[]>(
    () => buildStatementRowsForMonth(selectedMonth, selectedMonthData),
    [selectedMonth, selectedMonthData],
  );

  const openingBalance = useMemo(() => {
    if (!selectedMonth) {
      return 0;
    }
    if (compareMonthKeys(selectedMonth, LEDGER_CARRY_FORWARD_START_MONTH) < 0) {
      return 0;
    }

    const previousMonthKeys = listMonthKeysInclusive(LEDGER_CARRY_FORWARD_START_MONTH, selectedMonth).slice(0, -1);
    let runningOpeningBalance = LEDGER_CARRY_FORWARD_START_OPENING_BALANCE;
    previousMonthKeys.forEach((monthKey) => {
      const previousMonthRows = buildStatementRowsForMonth(monthKey, monthDataByKey[monthKey] ?? EMPTY_MONTH_DATA);
      const previousMonthSummary = summarizeRows(previousMonthRows);
      runningOpeningBalance += previousMonthSummary.inflow - previousMonthSummary.outflow;
    });
    return runningOpeningBalance;
  }, [selectedMonth, monthDataByKey]);

  const statementRowsWithBalance = useMemo<StatementDisplayRow[]>(() => {
    let runningBalance = openingBalance;
    return statementRows.map((row) => {
      runningBalance += row.inflow - row.outflow;
      return {
        ...row,
        balance: runningBalance,
      };
    });
  }, [statementRows, openingBalance]);

  const totals = useMemo(() => {
    const summary = summarizeRows(statementRows);
    return {
      opening: openingBalance,
      inflow: summary.inflow,
      outflow: summary.outflow,
      net: openingBalance + summary.inflow - summary.outflow,
      paymentCount: summary.paymentCount,
      additionIncomeCount: summary.additionIncomeCount,
      expenseCount: summary.expenseCount,
    };
  }, [statementRows, openingBalance]);

  const selectedMonthLabel = useMemo(
    () => monthOptions.find((option) => option.value === selectedMonth)?.label ?? selectedMonth,
    [monthOptions, selectedMonth],
  );

  const openingBalanceLabel = useMemo(() => {
    if (!selectedMonth) {
      return '';
    }
    const monthComparison = compareMonthKeys(selectedMonth, LEDGER_CARRY_FORWARD_START_MONTH);
    if (monthComparison === 0) {
      return 'Manual carry-forward seed';
    }
    if (monthComparison > 0) {
      return 'Carry-forward from previous month';
    }
    return 'Manual setup pending';
  }, [selectedMonth]);

  const handleDownloadReport = useCallback(async () => {
    if (!selectedMonth || downloadingReport) {
      return;
    }

    setError('');
    setDownloadingReport(true);
    try {
      const workbook = xlsxUtils.book_new();

      const summaryRows = [
        ['Metric', 'Value'],
        ['Month', selectedMonthLabel],
        ['Opening Balance', Number(totals.opening.toFixed(2))],
        ['Inflow', Number(totals.inflow.toFixed(2))],
        ['Outflow', Number(totals.outflow.toFixed(2))],
        ['Net Balance', Number(totals.net.toFixed(2))],
      ];
      const summarySheet = xlsxUtils.aoa_to_sheet(summaryRows);
      xlsxUtils.book_append_sheet(workbook, summarySheet, 'Summary');

      const transactionsRows = [
        ['Date', 'Type', 'Details', 'Reference', 'Inflow', 'Outflow', 'Balance'],
        ...statementRowsWithBalance.map((row) => [
          row.dateLabel,
          row.type === 'payment'
            ? 'Donor Payment'
            : row.type === 'income'
              ? 'Addition Income'
              : row.type === 'expense'
                ? 'Admin Expense'
                : 'Opening Balance',
          row.details,
          row.reference,
          row.inflow > 0 ? Number(row.inflow.toFixed(2)) : '',
          row.outflow > 0 ? Number(row.outflow.toFixed(2)) : '',
          Number(row.balance.toFixed(2)),
        ]),
      ];
      const transactionsSheet = xlsxUtils.aoa_to_sheet(transactionsRows);
      xlsxUtils.book_append_sheet(workbook, transactionsSheet, 'Transactions');

      const fallbackFilename = `account-statement-${selectedMonth}.xlsx`;
      const downloadFilename = sanitizeFilename(fallbackFilename) || fallbackFilename;
      writeXlsxFile(workbook, downloadFilename);
    } catch (downloadError: any) {
      const detail =
        downloadError?.response?.data?.detail ??
        downloadError?.message ??
        'Unable to download account statement report.';
      setError(typeof detail === 'string' ? detail : 'Unable to download account statement report.');
    } finally {
      setDownloadingReport(false);
    }
  }, [
    selectedMonth,
    selectedMonthLabel,
    statementRowsWithBalance,
    totals.opening,
    totals.inflow,
    totals.outflow,
    totals.net,
    downloadingReport,
  ]);

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
            <button
              type="button"
              onClick={() => void handleDownloadReport()}
              disabled={downloadingReport || loading || !selectedMonth}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadingReport ? 'Preparing…' : 'Download Report'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-violet-700">Opening Balance</p>
            <p className="text-base font-semibold text-violet-900">{formatCurrency(totals.opening)}</p>
            <p className="text-xs text-violet-700">{openingBalanceLabel}</p>
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

        {!error && !loading && statementRowsWithBalance.length === 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No payment, addition income, or expense transactions found for {selectedMonthLabel}.
          </div>
        )}

        {!error && !loading && statementRowsWithBalance.length > 0 && (
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
                  {statementRowsWithBalance.map((row) => (
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
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                        {formatCurrency(row.balance)}
                      </td>
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
