import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import api from '../../lib/api';
import { useCartStore, type CartItem } from '../../store/cart';
import { useAuthStore } from '../../store/auth';
import { usePaymentStore } from '../../store/payments';

interface DonorDirectoryEntry {
  id: number;
  name: string;
  phone_number?: string | null;
}

interface CombineLookupPayload {
  donor_id: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  items: CartItem[];
}

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return '0.00';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '0.00';
  }
  return numeric.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMonthKey = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }
  const parsed = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (key: string) => {
  const [yearPart, monthPart] = key.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return key;
  }
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const buildHistoryMonthOptions = <T,>(
  entries: T[],
  resolveDate: (entry: T) => string | Date | null | undefined,
) => {
  const keys = new Set<string>();
  const currentKey = formatMonthKey(new Date());
  if (currentKey) {
    keys.add(currentKey);
  }
  entries.forEach((entry) => {
    const key = formatMonthKey(resolveDate(entry));
    if (key) {
      keys.add(key);
    }
  });
  const sortedKeys = Array.from(keys).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  return sortedKeys.map((key) => ({ key, label: formatMonthLabel(key) }));
};

const parseAmount = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const CombinePaymentPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const combinePaymentHistory = usePaymentStore((state) => state.combinePaymentHistory);
  const addCombinePaymentHistory = usePaymentStore((state) => state.addCombinePaymentHistory);
  const clearCombinePaymentHistory = usePaymentStore((state) => state.clearCombinePaymentHistory);

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [historyMonth, setHistoryMonth] = useState<string>(() => formatMonthKey(new Date()) ?? '');
  const [isClubExpanded, setIsClubExpanded] = useState(false);
  const [donorDirectory, setDonorDirectory] = useState<DonorDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [selectedDonorId, setSelectedDonorId] = useState<number | ''>('');
  const [selectedDonor, setSelectedDonor] = useState<CombineLookupPayload | null>(null);
  const [selectedDonorLoading, setSelectedDonorLoading] = useState(false);
  const [selectedDonorError, setSelectedDonorError] = useState('');
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [petalSeed, setPetalSeed] = useState(0);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yourTotalAmount = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        return sum + parseAmount(item.amount);
      }, 0),
    [cartItems],
  );

  const clubTotals = useMemo(() => {
    if (!selectedDonor) {
      return { count: 0, total: 0 };
    }
    const total = selectedDonor.items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
    return { count: selectedDonor.items.length, total };
  }, [selectedDonor]);

  const combinedTotal = yourTotalAmount + clubTotals.total;
  const combinedPoojaCount = cartItems.length + clubTotals.count;
  const petals = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        left: Math.random() * 100,
        delay: index * 0.07,
        duration: 1.4 + Math.random() * 0.8,
        hue: 18 + Math.random() * 32,
        scale: 0.8 + Math.random() * 0.6,
        horizontal: (Math.random() - 0.5) * 120,
      })),
    [petalSeed],
  );
  const historyMonthOptions = useMemo(
    () => buildHistoryMonthOptions(combinePaymentHistory, (entry) => entry.completedAt),
    [combinePaymentHistory],
  );

  const resolveDevoteesLabel = (item: CartItem) => {
    if (Array.isArray(item.members) && item.members.length > 0) {
      const names = item.members
        .map((member) => member?.name?.toString().trim())
        .filter((name): name is string => Boolean(name && name.length > 0));
      if (names.length > 0) {
        return names.join(', ');
      }
    }
    return item.fullName?.trim() || '—';
  };

  useEffect(() => {
    if (!isClubExpanded || donorDirectory.length > 0) {
      return;
    }
    let isActive = true;
    const fetchDirectory = async () => {
      setDirectoryLoading(true);
      setDirectoryError('');
      try {
        const { data } = await api.get<DonorDirectoryEntry[]>('pooja/registrations/donor-directory/');
        if (!isActive) {
          return;
        }
        setDonorDirectory(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (isActive) {
          const detail = err?.response?.data?.detail ?? err?.message ?? 'Unable to load donors.';
          setDirectoryError(typeof detail === 'string' ? detail : 'Unable to load donors.');
        }
      } finally {
        if (isActive) {
          setDirectoryLoading(false);
        }
      }
    };
    fetchDirectory();
    return () => {
      isActive = false;
    };
  }, [isClubExpanded, donorDirectory.length]);

  useEffect(() => {
    if (selectedDonorId === '') {
      setSelectedDonor(null);
      setSelectedDonorError('');
      setSelectedDonorLoading(false);
      return;
    }
    let isActive = true;
    const fetchDonorRegistrations = async () => {
      setSelectedDonorLoading(true);
      setSelectedDonorError('');
      try {
        const { data } = await api.get<CombineLookupPayload>('pooja/registrations/combine-lookup/', {
          params: { donor_id: selectedDonorId },
        });
        if (!isActive) {
          return;
        }
        setSelectedDonor(data);
      } catch (err: any) {
        if (isActive) {
          const detail =
            err?.response?.data?.detail ?? err?.message ?? 'Unable to load the selected donor commitments.';
          setSelectedDonorError(
            typeof detail === 'string' ? detail : 'Unable to load the selected donor commitments.',
          );
          setSelectedDonor(null);
        }
      } finally {
        if (isActive) {
          setSelectedDonorLoading(false);
        }
      }
    };
    fetchDonorRegistrations();
    return () => {
      isActive = false;
    };
  }, [selectedDonorId]);

  useEffect(() => {
    if (!selectedDonor) {
      setShowPaymentDetails(false);
    }
  }, [selectedDonor]);

  useEffect(() => {
    if (historyMonthOptions.length === 0) {
      return;
    }
    if (!historyMonth || !historyMonthOptions.some((option) => option.key === historyMonth)) {
      setHistoryMonth(historyMonthOptions[0].key);
    }
  }, [historyMonth, historyMonthOptions]);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  const handleClearClubbedDonor = () => {
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    setShowCelebration(false);
    setSelectedDonorId('');
    setSelectedDonor(null);
    setSelectedDonorError('');
    setShowPaymentDetails(false);
  };

  const handleProceedToPayment = () => {
    setShowPaymentDetails(true);
  };

  const handlePaymentCompleted = () => {
    if (!selectedDonor) {
      return;
    }
    addCombinePaymentHistory({
      yourItems: cartItems,
      yourTotal: yourTotalAmount,
      donor: {
        id: selectedDonor.donor_id,
        name: selectedDonor.donor_name,
        phone: selectedDonor.donor_phone,
        items: selectedDonor.items,
        totalAmount: clubTotals.total,
      },
      combinedTotal,
    });
    setPetalSeed((seed) => seed + 1);
    setShowCelebration(true);
    setShowPaymentDetails(false);
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
    }
    celebrationTimeoutRef.current = setTimeout(() => {
      setShowCelebration(false);
      handleClearClubbedDonor();
    }, 1800);
  };

  const renderCurrentView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Poojas</p>
          <p className="text-lg font-bold text-slate-800">{cartItems.length}</p>
          <p className="text-sm font-semibold text-slate-700">₹ {formatCurrency(yourTotalAmount)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clubbed Donor</p>
          <p className="text-lg font-bold text-slate-800">{clubTotals.count}</p>
          <p className="text-sm font-semibold text-slate-700">₹ {formatCurrency(clubTotals.total)}</p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Combined Total</p>
          <p className="text-lg font-bold text-orange-700">{combinedPoojaCount} items</p>
          <p className="text-sm font-semibold text-orange-700">₹ {formatCurrency(combinedTotal)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Your Cart Items</h3>
        </div>
        {cartItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            You have not added any poojas yet. Visit the Pooja cart to add offerings before combining payments.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {cartItems.map((item) => (
              <li key={item.cartId} className="grid gap-2 px-4 py-3 sm:grid-cols-5 sm:items-center">
                <div className="sm:col-span-2">
                  <p className="font-medium text-slate-800">{item.poojaName}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.poojaCode ?? 'POOJA'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="font-medium text-slate-800">{formatDate(item.customDayDate || item.bookingDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="font-medium text-slate-800">{item.customDayNote?.trim() || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-semibold text-slate-900">₹ {formatCurrency(item.amount)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 pt-6">
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
          onClick={() => setIsClubExpanded((prev) => !prev)}
        >
          {isClubExpanded ? 'Hide' : 'Club More Members For Group Payment'}
        </button>

        {isClubExpanded && (
          <div className="mt-4 space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <label htmlFor="donor-selector" className="text-sm font-semibold text-slate-700">
                Pick donor by name & phone
              </label>
              <select
                id="donor-selector"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                value={selectedDonorId}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    setSelectedDonorId('');
                    return;
                  }
                  const numeric = Number(value);
                  setSelectedDonorId(Number.isFinite(numeric) ? numeric : '');
                }}
                disabled={directoryLoading || donorDirectory.length === 0}
              >
                <option value="">Select donor to club</option>
                {donorDirectory.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name || `Donor #${entry.id}`} — {entry.phone_number || 'No phone'}
                  </option>
                ))}
              </select>
              {directoryLoading && (
                <p className="mt-2 text-xs font-medium text-slate-500">Loading donor directory…</p>
              )}
              {directoryError && (
                <p className="mt-2 text-xs font-medium text-red-600">{directoryError}</p>
              )}
            </div>

            {selectedDonorError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                {selectedDonorError}
              </div>
            )}

            {selectedDonorLoading && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                Fetching the donor&apos;s pooja selections…
              </div>
            )}

            {!selectedDonorLoading && selectedDonor && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{selectedDonor.donor_name || 'Donor'}</p>
                  <p className="text-xs text-slate-500">
                    Contact: {selectedDonor.donor_phone || 'Phone unavailable'}
                  </p>
                </div>
                {selectedDonor.items.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    This donor does not have any poojas in their cart yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                    {selectedDonor.items.map((item) => (
                      <li key={item.cartId} className="grid gap-2 px-4 py-3 sm:grid-cols-4 sm:items-center">
                        <div className="sm:col-span-2">
                          <p className="font-semibold text-slate-900">
                            {item.poojaName || 'Pooja'}{' '}
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              {item.poojaCode ?? ''}
                            </span>
                          </p>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {item.dayOptionDescription || 'No day option'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Date</p>
                          <p className="font-medium text-slate-800">
                            {formatDate(item.customDayDate || item.bookingDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Devotees</p>
                          <p className="font-medium text-slate-800">{resolveDevoteesLabel(item)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Amount</p>
                          <p className="font-semibold text-slate-900">₹ {formatCurrency(item.amount)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!selectedDonorLoading && !selectedDonor && selectedDonorId === '' && (
              <p className="text-sm text-slate-600">
                Choose a donor from the dropdown to preview their pooja commitments for clubbed payment.
              </p>
            )}

            {selectedDonor && (
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  <p>
                    Ready to combine the payment with <span className="font-semibold">{selectedDonor.donor_name}</span>?{' '}
                    Click Proceed to view the payment instructions or clear to pick someone else.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleClearClubbedDonor}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Clear All
                  </button>
                  {!showPaymentDetails && (
                    <button
                      type="button"
                      onClick={handleProceedToPayment}
                      className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
                    >
                      Proceed for Payment
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedDonor && showPaymentDetails && (
        <div className="space-y-4 rounded-2xl border border-orange-100 bg-white p-5 shadow-inner">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
              <img
                src="/images/payment_qrcode.png"
                alt="Temple payment QR code"
                className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-3 object-contain"
              />
              <p className="mt-3 text-sm font-medium text-slate-700">Scan & pay ₹ {formatCurrency(combinedTotal)}</p>
            </div>
            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Holder</p>
                <p className="text-lg font-semibold text-slate-900">Sri Temple Trust</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Number</p>
                <p className="text-lg font-semibold text-slate-900">123456789012</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">IFSC Code</p>
                <p className="text-lg font-semibold text-slate-900">SBIN0000123</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</p>
                <p className="text-lg font-semibold text-slate-900">Mylapore, Chennai</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            After the transfer, inform the temple office with both sets of cart details for quicker reconciliation.
          </p>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handlePaymentCompleted}
              className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              Payment Completed
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryContent = () => {
    const renderPreviewList = (items: CartItem[]) => {
      const preview = items.slice(0, 2);
      const remaining = items.length - preview.length;
      return (
        <>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {preview.map((item, index) => (
              <li key={`${item.cartId ?? index}`}>
                {(item.poojaName || 'Pooja') + ' — ₹ ' + formatCurrency(item.amount)}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">+{remaining} more</p>
          )}
        </>
      );
    };

    const selectedMonthLabel = historyMonth ? formatMonthLabel(historyMonth) : 'Selected month';
    const filteredHistory = combinePaymentHistory.filter(
      (entry) => formatMonthKey(entry.completedAt) === historyMonth,
    );

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Latest confirmations are stored locally so you can recall which donor you clubbed with.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label
              htmlFor="combine-history-month"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Month
            </label>
            <select
              id="combine-history-month"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={historyMonth}
              onChange={(event) => setHistoryMonth(event.target.value)}
            >
              {historyMonthOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={clearCombinePaymentHistory}
              disabled={combinePaymentHistory.length === 0}
              className={`inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                combinePaymentHistory.length === 0
                  ? 'border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Clear History
            </button>
          </div>
        </div>

        {combinePaymentHistory.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            Combined payments you complete will be listed here for local reference.
          </div>
        )}

        {combinePaymentHistory.length > 0 && filteredHistory.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-sm text-slate-600">
            No combined payments recorded for {selectedMonthLabel}.
          </div>
        )}

        {filteredHistory.map((entry) => {
          const totalCount = entry.yourCount + (entry.donor?.count ?? 0);
          return (
            <article
              key={`${entry.id}-${entry.completedAt}`}
              className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Completed</p>
                  <p className="text-base font-semibold text-slate-900">{formatDateTime(entry.completedAt)}</p>
                  <p className="text-sm text-slate-600">
                    {totalCount} pooja{totalCount === 1 ? '' : 's'} combined • Your share:{' '}
                    {entry.yourCount} item{entry.yourCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Combined Total</p>
                  <p className="text-2xl font-semibold text-orange-700">₹ {formatCurrency(entry.combinedTotal)}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Poojas</p>
                  <p className="text-sm font-medium text-slate-800">
                    {entry.yourCount} item{entry.yourCount === 1 ? '' : 's'} • ₹ {formatCurrency(entry.yourTotal)}
                  </p>
                  {entry.yourItems.length > 0 && renderPreviewList(entry.yourItems)}
                </div>
                {entry.donor && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clubbed Donor</p>
                    <p className="text-sm font-medium text-slate-800">
                      {(entry.donor.name || 'Donor')}{' '}
                      <span className="text-xs text-slate-500">
                        ({entry.donor.count} item{entry.donor.count === 1 ? '' : 's'})
                      </span>
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      ₹ {formatCurrency(entry.donor.totalAmount)}
                    </p>
                    {entry.donor.phone && (
                      <p className="text-xs text-slate-500">Phone: {entry.donor.phone}</p>
                    )}
                    {entry.donor.items.length > 0 && renderPreviewList(entry.donor.items)}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const tabButtonClasses = (tab: 'current' | 'history') =>
    `flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
      activeTab === tab ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Combine Payment</h1>
            <p className="text-sm text-slate-600">
              Club your selections with another donor, follow the payment instructions, and revisit previous combined
              payments when needed.
            </p>
          </div>
          <div className="flex w-full max-w-md rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-semibold text-slate-600 md:w-auto">
            <button type="button" className={tabButtonClasses('current')} onClick={() => setActiveTab('current')}>
              Current Payment
            </button>
            <button type="button" className={tabButtonClasses('history')} onClick={() => setActiveTab('history')}>
              Payment History
            </button>
          </div>
        </div>
        <div className="mt-6">{activeTab === 'current' ? renderCurrentView() : renderHistoryContent()}</div>
      </section>
      {showCelebration && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0">
            {petals.map((petal, index) => (
              <span
                key={`${petalSeed}-${index}`}
                className="flower-petal"
                style={
                  {
                    left: `${petal.left}%`,
                    animationDelay: `${petal.delay}s`,
                    animationDuration: `${petal.duration}s`,
                    '--petal-scale': petal.scale,
                    '--petal-hue': petal.hue,
                    '--petal-horizontal': `${petal.horizontal}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className="absolute inset-x-0 top-24 flex justify-center">
            <div className="rounded-full bg-white/90 px-6 py-2 text-sm font-semibold text-orange-700 shadow-lg">
              Combined payment recorded! Thank you.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinePaymentPage;
