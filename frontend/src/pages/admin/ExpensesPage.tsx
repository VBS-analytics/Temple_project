import { FormEvent, useState, useCallback, useEffect, useMemo } from 'react';
import api, { extractResults } from '../../lib/api';

// Types
type ExpenseRecordResponse = {
  id: number;
  transaction_date: string;
  category: string;
  amount: string | number;
  notes?: string;
};

type ExpenseRecord = Omit<ExpenseRecordResponse, 'amount'> & {
  amount: number;
};

type MonthOption = {
  label: string;
  value: string;
};

type ExpenseFormPayload = {
  transaction_date: string;
  category: string;
  amount: number;
};

// Constants
const EXPENSE_CATEGORY_GROUPS = [
  {
    title: 'We pay to poojari for',
    items: [
      'Archana & Abishekam',
      'For Til oil',
      'For Neivedhyam',
      'For Navagraha pooja',
      'For Pradosham',
      'For spl pooja',
    ],
    color: 'purple',
    icon: '🙏',
  },
  {
    title: 'We pay to co ordinator',
    items: ['Post expenses', 'Salary for 2 ladies', 'Repair & maintenance work in temple'],
    color: 'blue',
    icon: '👥',
  },
  {
    title: 'We remit to bank',
    items: ['For FD'],
    color: 'green',
    icon: '🏦',
  },
];

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

// Utility Functions
const buildMonthOptions = (): MonthOption[] => {
  const today = new Date();
  return Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(today);
    date.setMonth(today.getMonth() - index);
    return {
      label: MONTH_FORMATTER.format(date),
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    };
  });
};

const normalizeExpenseRecords = (records: ExpenseRecordResponse[]): ExpenseRecord[] =>
  records.map((record) => ({
    ...record,
    amount: Number(record.amount),
  }));

const getCategoryGroup = (category: string) => {
  for (const group of EXPENSE_CATEGORY_GROUPS) {
    if (group.items.includes(category)) {
      return group;
    }
  }
  return null;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Custom Hook
const useExpenses = () => {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(() => monthOptions[0]?.value ?? '');
  const [recordedExpenses, setRecordedExpenses] = useState<ExpenseRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [monthlyExpenses, setMonthlyExpenses] = useState<ExpenseRecord[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyStatus, setMonthlyStatus] = useState('');
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  const fetchRecordedExpenses = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const { data } = await api.get('/payments/expenses/');
      const records = normalizeExpenseRecords(extractResults<ExpenseRecordResponse>(data));
      setRecordedExpenses(records);
    } catch {
      setRecordedExpenses([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const fetchMonthlyExpenses = useCallback(
    async (month: string) => {
      if (!month) {
        setMonthlyExpenses([]);
        setMonthlyStatus('Pick a month to load totals.');
        return;
      }
      setMonthlyLoading(true);
      try {
        const { data } = await api.get('/payments/expenses/', { params: { month } });
        const records = normalizeExpenseRecords(extractResults<ExpenseRecordResponse>(data));
        setMonthlyExpenses(records);
        const monthLabel = monthOptions.find((option) => option.value === month)?.label ?? month;
        const total = records.reduce((sum, record) => sum + record.amount, 0);
        setMonthlyStatus(
          records.length
            ? `Found ${records.length} expense${records.length === 1 ? '' : 's'} totaling ${formatCurrency(total)} for ${monthLabel}.`
            : `No expenses recorded yet for ${monthLabel}.`,
        );
      } catch {
        setMonthlyExpenses([]);
        setMonthlyStatus('Unable to load monthly expense data.');
      } finally {
        setMonthlyLoading(false);
      }
    },
    [monthOptions],
  );

  const saveExpense = useCallback(
    async (payload: ExpenseFormPayload) => {
      setIsSavingExpense(true);
      try {
        await api.post('/payments/expenses/', payload);
        await fetchRecordedExpenses();
        await fetchMonthlyExpenses(selectedMonth);
        return true;
      } catch {
        return false;
      } finally {
        setIsSavingExpense(false);
      }
    },
    [fetchRecordedExpenses, fetchMonthlyExpenses, selectedMonth],
  );

  useEffect(() => {
    fetchRecordedExpenses();
  }, [fetchRecordedExpenses]);

  useEffect(() => {
    fetchMonthlyExpenses(selectedMonth);
  }, [selectedMonth, fetchMonthlyExpenses]);

  return {
    monthOptions,
    selectedMonth,
    setSelectedMonth,
    recordedExpenses,
    recordsLoading,
    monthlyExpenses,
    monthlyLoading,
    monthlyStatus,
    isSavingExpense,
    fetchMonthlyExpenses,
    saveExpense,
  };
};

// Components
const ExpenseForm = ({ onSave, isSaving }: { onSave: (payload: ExpenseFormPayload) => Promise<boolean>; isSaving: boolean }) => {
  const [formValues, setFormValues] = useState({
    transactionDate: '',
    category: '',
    amount: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
  const [focusedField, setFocusedField] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formValues.transactionDate || !formValues.category || !formValues.amount) {
      setStatusMessage('Please complete every field before saving the expense.');
      setStatusType('error');
      return;
    }

    const payload: ExpenseFormPayload = {
      transaction_date: formValues.transactionDate,
      category: formValues.category,
      amount: Number(formValues.amount),
    };

    const success = await onSave(payload);
    
    if (success) {
      setStatusMessage(
        `Recorded ${formatCurrency(payload.amount)} for ${payload.category} on ${payload.transaction_date}.`,
      );
      setStatusType('success');
      setFormValues({ transactionDate: '', category: '', amount: '' });
    } else {
      setStatusMessage('Unable to save the expense. Please try again.');
      setStatusType('error');
    }
  };

  const handleChange = (field: keyof typeof formValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const selectedCategoryGroup = formValues.category ? getCategoryGroup(formValues.category) : null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-xl p-6 border border-indigo-100">
      <div className="flex items-center mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">Add New Expense</h3>
          <p className="text-sm text-gray-600">Track your temple expenses efficiently</p>
        </div>
      </div>
      
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`relative transition-all duration-200 ${focusedField === 'transactionDate' ? 'transform -translate-y-1' : ''}`}>
            <label htmlFor="transactionDate" className="block text-sm font-semibold text-gray-700 mb-2">
              Transaction Date
            </label>
            <div className="relative">
              <input
                id="transactionDate"
                type="date"
                value={formValues.transactionDate}
                onChange={(event) => handleChange('transactionDate', event.target.value)}
                onFocus={() => setFocusedField('transactionDate')}
                onBlur={() => setFocusedField('')}
                disabled={isSaving}
                className={`w-full rounded-xl border-2 ${focusedField === 'transactionDate' ? 'border-indigo-500 shadow-lg' : 'border-gray-200'} bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              />
            </div>
          </div>

          <div className={`relative transition-all duration-200 ${focusedField === 'category' ? 'transform -translate-y-1' : ''}`}>
            <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
              Expense Category
            </label>
            <div className="relative">
              <select
                id="category"
                value={formValues.category}
                onChange={(event) => handleChange('category', event.target.value)}
                onFocus={() => setFocusedField('category')}
                onBlur={() => setFocusedField('')}
                disabled={isSaving}
                className={`w-full rounded-xl border-2 ${focusedField === 'category' ? 'border-indigo-500 shadow-lg' : 'border-gray-200'} bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none appearance-none transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              >
                <option value="">Select a category</option>
                {EXPENSE_CATEGORY_GROUPS.flatMap((group) =>
                  group.items.map((item) => (
                    <option key={`${group.title}-${item}`} value={item}>
                      {item}
                    </option>
                  )),
                )}
              </select>
            </div>
            {selectedCategoryGroup && (
              <div className="mt-2 flex items-center text-xs text-gray-500">
                <span className="mr-1">{selectedCategoryGroup.icon}</span>
                <span>{selectedCategoryGroup.title}</span>
              </div>
            )}
          </div>

          <div className={`relative transition-all duration-200 ${focusedField === 'amount' ? 'transform -translate-y-1' : ''}`}>
            <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-2">
              Expense Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm font-medium">₹</span>
              </div>
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formValues.amount}
                onChange={(event) => handleChange('amount', event.target.value)}
                onFocus={() => setFocusedField('amount')}
                onBlur={() => setFocusedField('')}
                disabled={isSaving}
                placeholder="0.00"
                className={`w-full rounded-xl border-2 ${focusedField === 'amount' ? 'border-indigo-500 shadow-lg' : 'border-gray-200'} bg-white pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                </svg>
                Save Expense
              </>
            )}
          </button>
          
          {statusMessage && (
            <div className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
              statusType === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {statusType === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {statusMessage}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

const ExpenseCard = ({ expense }: { expense: ExpenseRecord }) => {
  const categoryGroup = getCategoryGroup(expense.category);
  const categoryColor = categoryGroup?.color || 'gray';
  
  const colorClasses = {
    purple: 'from-purple-500 to-indigo-600',
    blue: 'from-blue-500 to-cyan-600',
    green: 'from-green-500 to-emerald-600',
    gray: 'from-gray-500 to-gray-600',
  };
  
  const bgClasses = {
    purple: 'bg-purple-50 border-purple-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    gray: 'bg-gray-50 border-gray-200',
  };

  return (
    <div className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden border-2 ${bgClasses[categoryColor as keyof typeof bgClasses]}`}>
      <div className={`h-2 bg-gradient-to-r ${colorClasses[categoryColor as keyof typeof colorClasses]}`}></div>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[categoryColor as keyof typeof colorClasses]} flex items-center justify-center text-white mr-3`}>
              <span className="text-lg">{categoryGroup?.icon || '💰'}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Category</p>
              <p className="text-base font-semibold text-gray-900">{expense.category}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">Amount</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(expense.amount)}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center text-sm text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {expense.transaction_date}
          </div>
        </div>
      </div>
    </div>
  );
};

const RecordedExpensesList = ({
  expenses,
  loading,
}: {
  expenses: ExpenseRecord[];
  loading: boolean;
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Loading expenses</h3>
          <p className="mt-1 text-sm text-gray-500">Please wait while we fetch your expense records</p>
        </div>
      </div>
    );
  }

  if (!expenses.length) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-xl p-8 border border-gray-200">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No expenses recorded yet</h3>
          <p className="text-gray-500 text-center max-w-md">
            Start tracking your temple expenses by adding your first expense entry. Once saved, they will appear here for verification.
          </p>
          <div className="mt-6 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">
            Tip: Regular expense tracking helps maintain financial transparency
          </div>
        </div>
      </div>
    );
  }

  // Group expenses by category for visualization
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const categoryGroup = getCategoryGroup(expense.category);
    const groupTitle = categoryGroup?.title || 'Other';
    
    if (!acc[groupTitle]) {
      acc[groupTitle] = {
        title: groupTitle,
        icon: categoryGroup?.icon || '💰',
        color: categoryGroup?.color || 'gray',
        total: 0,
        expenses: []
      };
    }
    
    acc[groupTitle].total += expense.amount;
    acc[groupTitle].expenses.push(expense);
    
    return acc;
  }, {} as Record<string, {
    title: string;
    icon: string;
    color: string;
    total: number;
    expenses: ExpenseRecord[];
  }>);

  const categoryGroups = Object.values(expensesByCategory);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Transactions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {expenses.slice(0, 6).map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} />
          ))}
        </div>
        
        {expenses.length > 6 && (
          <div className="mt-6 text-center">
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
              View All Expenses ({expenses.length - 6} more)
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MonthlyExpensesTracker = ({
  expenses,
  monthOptions,
  selectedMonth,
  onMonthChange,
  onRefresh,
  statusMessage,
  isLoading,
}: {
  expenses: ExpenseRecord[];
  monthOptions: MonthOption[];
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  onRefresh: () => void;
  statusMessage: string;
  isLoading: boolean;
}) => {
  const monthlyTotal = useMemo(() => expenses.reduce((sum, record) => sum + record.amount, 0), [expenses]);
  
  // Group expenses by category for visualization
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const categoryGroup = getCategoryGroup(expense.category);
    const groupTitle = categoryGroup?.title || 'Other';
    
    if (!acc[groupTitle]) {
      acc[groupTitle] = {
        title: groupTitle,
        icon: categoryGroup?.icon || '💰',
        color: categoryGroup?.color || 'gray',
        total: 0,
        expenses: []
      };
    }
    
    acc[groupTitle].total += expense.amount;
    acc[groupTitle].expenses.push(expense);
    
    return acc;
  }, {} as Record<string, {
    title: string;
    icon: string;
    color: string;
    total: number;
    expenses: ExpenseRecord[];
  }>);

  const categoryGroups = Object.values(expensesByCategory);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">Monthly Expense Tracker</h2>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-white/20 backdrop-blur-sm text-sm font-medium rounded-lg text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Data
              </>
            )}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="month" className="block text-sm font-medium text-indigo-100 mb-2">
              Select Month
            </label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(event) => onMonthChange(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-3 text-sm text-white focus:border-white focus:outline-none focus:ring-2 focus:ring-white/50 appearance-none transition-all duration-200"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-indigo-100 text-sm font-medium">Monthly Total</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(monthlyTotal)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Monthly Status</h3>
        
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          {isLoading ? (
            <div className="flex items-center">
              <div className="relative mr-3">
                <div className="w-8 h-8 border-2 border-indigo-200 rounded-full"></div>
                <div className="w-8 h-8 border-2 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              </div>
              <span className="text-sm text-gray-600">Loading monthly expenses…</span>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              {statusMessage || 'Pick a month and refresh totals to see the breakdown here.'}
            </p>
          )}
        </div>

        {expenses.length > 0 && (
          <>
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryGroups.map((group) => {
                  const percentage = monthlyTotal > 0 ? (group.total / monthlyTotal) * 100 : 0;
                  const colorClasses = {
                    purple: 'from-purple-500 to-indigo-600',
                    blue: 'from-blue-500 to-cyan-600',
                    green: 'from-green-500 to-emerald-600',
                    gray: 'from-gray-500 to-gray-600',
                  };
                  
                  return (
                    <div key={group.title} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[group.color as keyof typeof colorClasses]} flex items-center justify-center text-white mr-3`}>
                            <span className="text-lg">{group.icon}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{group.title}</p>
                            <p className="text-sm text-gray-500">{group.expenses.length} transaction{group.expenses.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">{formatCurrency(group.total)}</p>
                          <p className="text-sm text-gray-500">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full bg-gradient-to-r ${colorClasses[group.color as keyof typeof colorClasses]}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h4>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.map((expense) => {
                      const categoryGroup = getCategoryGroup(expense.category);
                      const categoryColor = categoryGroup?.color || 'gray';
                      
                      const badgeColorClasses = {
                        purple: 'bg-purple-100 text-purple-800',
                        blue: 'bg-blue-100 text-blue-800',
                        green: 'bg-green-100 text-green-800',
                        gray: 'bg-gray-100 text-gray-800',
                      };
                      
                      return (
                        <tr key={expense.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {expense.transaction_date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColorClasses[categoryColor as keyof typeof badgeColorClasses]}`}>
                              <span className="mr-1">{categoryGroup?.icon || '💰'}</span>
                              {expense.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatCurrency(expense.amount)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900" colSpan={2}>
                        Monthly Total
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {formatCurrency(monthlyTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Main Component
const ExpensesPage = () => {
  const [activeTab, setActiveTab] = useState<'data' | 'tracking'>('data');
  
  const {
    monthOptions,
    selectedMonth,
    setSelectedMonth,
    recordedExpenses,
    recordsLoading,
    monthlyExpenses,
    monthlyLoading,
    monthlyStatus,
    isSavingExpense,
    fetchMonthlyExpenses,
    saveExpense,
  } = useExpenses();

  const handleSave = async (payload: ExpenseFormPayload) => {
    const success = await saveExpense(payload);
    if (success) {
      setActiveTab('data');
    }
    return success;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Expense Management</h1>
          <p className="text-gray-600">Track and manage all temple expenses efficiently</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex space-x-1">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === 'data'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  onClick={() => setActiveTab('data')}
                >
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Data Entry
                  </div>
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === 'tracking'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  onClick={() => setActiveTab('tracking')}
                >
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Tracking
                  </div>
                </button>
              </div>
              
              <div className="flex items-center text-white">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm font-medium">System Active</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'data' && <ExpenseForm onSave={handleSave} isSaving={isSavingExpense} />}
            {activeTab === 'tracking' && (
              <MonthlyExpensesTracker
                expenses={monthlyExpenses}
                monthOptions={monthOptions}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                onRefresh={() => fetchMonthlyExpenses(selectedMonth)}
                statusMessage={monthlyStatus}
                isLoading={monthlyLoading}
              />
            )}
          </div>
        </div>

        {activeTab === 'data' && (
          <RecordedExpensesList expenses={recordedExpenses} loading={recordsLoading} />
        )}
      </div>
    </div>
  );
};

export default ExpensesPage;
