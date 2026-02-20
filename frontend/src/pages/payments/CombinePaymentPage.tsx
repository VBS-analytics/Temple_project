/**
 * ============================================================================
 * COMBINED PAYMENT PAGE MODULE
 * ============================================================================
 * 
 * Purpose:
 *   Handles combined payment processing for related donor accounts.
 *   Enables group or family accounts to make unified payments.
 * 
 * Key Features:
 *   - Combined Donor View: Show cart items from multiple linked donors
 *   - Aggregated Payment: Single payment for entire combined account
 *   - Member Display: Show all members in combined account with details
 *   - Payment Processing: Record payment for combined account
 *   - Access Control: Verify permissions to pay for combined accounts
 * 
 * Layout Design:
 *   Compact single-screen layout with no page scrolling.
 *   Left panel: Donor/item summary with internal scroll
 *   Right panel: Payment section always visible
 * 
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { isAxiosError } from 'axios';
import api from '../../lib/api';
import { useCurrentBalance } from '../../hooks/useCurrentBalance';
import { useCartStore, type CartItem } from '../../store/cart';
import { useAuthStore } from '../../store/auth';
import { usePaymentStore } from '../../store/payments';
import { useCombineAccessStore } from '../../store/combineAccess';
import { launchUpiLink } from '../../utils/upiLink';
import { shareImageFile } from '../../utils/shareImageFile';
import { PAYMENT_QR_IMAGE_URL } from '../../constants/paymentQr';
import RevealableAccountSection from '../../components/RevealableAccountSection';

// --- Helpers ---
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

const parseAmount = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
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

const sumCartItems = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + parseAmount(item.amount), 0);

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

const buildSubmissionErrorMessage = (error: unknown) => {
  if (!error) {
    return 'Unable to record payment right now; please try again.';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (isAxiosError(error)) {
    return error.response?.data?.detail ?? error.message ?? 'Unable to record payment right now; please try again.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to record payment right now; please try again.';
};

interface ApiPassbookEntry {
  id: number | string;
  donor: number;
  entry_date: string;
  entry_type?: 'balance' | 'due' | 'paid' | string;
  due_amount?: number | string | null;
  paid_amount?: number | string | null;
  closing_due: number | string | null;
}

// --- Component ---
const CombinePaymentPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const clearCart = useCartStore((state) => state.clear);
  const addCombinePaymentHistory = usePaymentStore((state) => state.addCombinePaymentHistory);
  const { balance: currentBalance, loading: balanceLoading, error: balanceError, refresh: refreshBalance } =
    useCurrentBalance();
  const canCombine = useCombineAccessStore((state) => state.canCombine);
  const combineRole = useCombineAccessStore((state) => state.role);
  const combineLoading = useCombineAccessStore((state) => state.loading);
  const combineError = useCombineAccessStore((state) => state.error);
  const fetchCombineAccess = useCombineAccessStore((state) => state.fetchAccess);
  const mainDonorItems = useCombineAccessStore((state) => state.mainDonorItems);
  const parentDonors = useCombineAccessStore((state) => state.parentDonors);

  // State
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionReferenceError, setTransactionReferenceError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [successToastMessage, setSuccessToastMessage] = useState('');
  const [petalSeed, setPetalSeed] = useState(0);
  const [shareError, setShareError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentScope, setPaymentScope] = useState<'main' | 'parents'>('main');
  const [paymentMethodTab, setPaymentMethodTab] = useState<'upi' | 'bank'>('upi');
  const [statementClosingDue, setStatementClosingDue] = useState<number | null>(null);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const combineHistory = usePaymentStore((state) => state.combinePaymentHistory);
  const lastCombineEntry = useMemo(() => (combineHistory.length > 0 ? combineHistory[0] : null), [combineHistory]);
  const lastCombineAmountLabel = lastCombineEntry ? `₹ ${formatCurrency(lastCombineEntry.combinedTotal)}` : '—';
  const lastCombineDateLabel = lastCombineEntry?.completedAt ? formatDate(lastCombineEntry.completedAt) : '—';

  // Merge cart items with main donor items from backend
  const allOwnItems = useMemo(() => {
    const merged = [...cartItems, ...mainDonorItems];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.cartId)) {
        return false;
      }
      seen.add(item.cartId);
      return true;
    });
  }, [cartItems, mainDonorItems]);

  const yourTotalAmount = useMemo(() => sumCartItems(allOwnItems), [allOwnItems]);

  const parentItemsTotal = useMemo(
    () => parentDonors.reduce((sum, donor) => sum + sumCartItems(donor.items), 0),
    [parentDonors],
  );

  const fallbackAmountDue =
    paymentScope === 'main'
      ? yourTotalAmount
      : Math.max(parentItemsTotal, 0);

  const selectedAmountDue = statementClosingDue ?? fallbackAmountDue;
  const totalDueAmount = selectedAmountDue;

  const canPayParents = yourTotalAmount <= 0;
  const parentScopeDisabled = !canPayParents || parentDonors.length === 0;

  const paymentBlocked =
    processingPayment || (paymentScope === 'parents' && !canPayParents);

  useEffect(() => {
    if (parentScopeDisabled && paymentScope === 'parents') {
      setPaymentScope('main');
      return;
    }
    if (!parentScopeDisabled && paymentScope === 'main' && yourTotalAmount <= 0 && parentItemsTotal > 0) {
      setPaymentScope('parents');
    }
  }, [parentScopeDisabled, paymentScope, yourTotalAmount, parentItemsTotal]);

  const loadStatementClosingDue = useCallback(async () => {
    if (!user?.id) {
      setStatementClosingDue(null);
      return;
    }
    const mainDonorId = user.id;
    const parentDonorIds = parentDonors
      .map((donor) => donor.id)
      .filter((id): id is number => typeof id === 'number');
    const donorIds = new Set<number>([mainDonorId, ...parentDonorIds]);

    try {
      const allEntries: ApiPassbookEntry[] = [];
      let nextUrl: string | null = 'payments/passbook-entries/?ordering=entry_date&page_size=500';
      while (nextUrl) {
        const response = await api.get(nextUrl);
        const rows: ApiPassbookEntry[] = Array.isArray(response.data?.results)
          ? response.data.results
          : Array.isArray(response.data)
            ? response.data
            : [];
        allEntries.push(
          ...rows.filter((entry) => donorIds.has(entry.donor) && Boolean(entry.entry_date)),
        );
        nextUrl = response.data?.next ?? null;
      }
      if (allEntries.length === 0) {
        setStatementClosingDue(0);
        return;
      }

      const mainEntries = allEntries.filter(
        (entry) =>
          entry.donor === mainDonorId &&
          (entry.entry_type === 'due' || entry.entry_type === 'paid'),
      );

      const parentEntries = allEntries.filter(
        (entry) =>
          parentDonorIds.includes(entry.donor) &&
          (entry.entry_type === 'due' || entry.entry_type === 'paid'),
      );

      const parentMonthTotals = new Map<string, { monthDate: string; dueTotal: number; paidTotal: number }>();
      parentEntries.forEach((entry) => {
        const monthKey = entry.entry_date.slice(0, 7);
        const existing = parentMonthTotals.get(monthKey) ?? {
          monthDate: entry.entry_date,
          dueTotal: 0,
          paidTotal: 0,
        };
        if (entry.entry_type === 'due') {
          existing.dueTotal += parseAmount(entry.due_amount);
        } else if (entry.entry_type === 'paid') {
          existing.paidTotal += parseAmount(entry.paid_amount);
        }
        if (new Date(entry.entry_date).getTime() < new Date(existing.monthDate).getTime()) {
          existing.monthDate = entry.entry_date;
        }
        parentMonthTotals.set(monthKey, existing);
      });

      const timeline: Array<{ id: string; date: string; due: number; paid: number; isParentAggregate: boolean }> = [];
      mainEntries.forEach((entry) => {
        timeline.push({
          id: `main-${entry.id}`,
          date: entry.entry_date,
          due: entry.entry_type === 'due' ? parseAmount(entry.due_amount) : 0,
          paid: entry.entry_type === 'paid' ? parseAmount(entry.paid_amount) : 0,
          isParentAggregate: false,
        });
      });
      Array.from(parentMonthTotals.values()).forEach((group) => {
        if (group.dueTotal === 0 && group.paidTotal === 0) {
          return;
        }
        timeline.push({
          id: `parent-${group.monthDate}`,
          date: group.monthDate,
          due: group.dueTotal,
          paid: group.paidTotal,
          isParentAggregate: true,
        });
      });

      timeline.sort((a, b) => {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (diff !== 0) return diff;
        if (a.isParentAggregate !== b.isParentAggregate) {
          return a.isParentAggregate ? 1 : -1;
        }
        return a.id.localeCompare(b.id);
      });

      let running = 0;
      timeline.forEach((entry) => {
        running = running + entry.due - entry.paid;
      });
      setStatementClosingDue(Math.max(running, 0));
    } catch (error) {
      console.error('Unable to fetch latest closing due from passbook entries', error);
      setStatementClosingDue(null);
    }
  }, [user?.id, parentDonors]);

  const hasOwnItems = allOwnItems.length > 0;

  const isAndroid = useMemo(
    () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent),
    [],
  );
  const isIos = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /iPhone|iPad|iPod/i.test(navigator.userAgent),
    [],
  );

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

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchCombineAccess();
  }, [fetchCombineAccess]);

  useEffect(() => {
    if (combineRole === 'main') {
      loadStatementClosingDue();
    }
  }, [combineRole, loadStatementClosingDue]);

  const handleOpenUpiApp = useCallback(
    (amount?: number) => {
      if (!isAndroid && !isIos) {
        return;
      }
      launchUpiLink({ amount });
    },
    [isAndroid, isIos],
  );

  const handleSharePaymentQr = useCallback(
    async (amount?: number) => {
      if (!isIos || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
        setShareError(
          'Sharing is unavailable on this device; please use your bank/UPI app to scan the QR on this page.',
        );
        return;
      }
      setShareError(null);
      try {
        const shareText = amount
          ? `Pay ₹ ${formatCurrency(amount)} using this QR. Choose your UPI app from the share panel.`
          : 'Pay via the temple QR. Choose your UPI app from the share panel.';
        await shareImageFile({
          url: PAYMENT_QR_IMAGE_URL,
          filename: 'temple-payment-qr-code.jpg',
          title: 'Temple payment QR',
          text: shareText,
        });
      } catch (error) {
        console.error('Failed to share payment QR', error);
        setShareError(
          'Sharing is unavailable on this device; please use your bank/UPI app to scan the QR on this page.',
        );
      }
    },
    [isIos],
  );

  const handleCopyUpi = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('alamelu7@icici');
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 1200);
    } catch (err) {
      console.error('Unable to copy UPI ID', err);
    }
  }, []);

  const handleClearSummary = () => {
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    clearCart(cartKey);
    setTransactionReference('');
    setTransactionReferenceError(null);
    setAmountPaid('');
    setPaymentDate('');
    setSubmissionError(null);
    setShareError(null);
  };

  const handlePaymentCompleted = useCallback(async () => {
    const trimmedReference = transactionReference.trim();
    if (!trimmedReference) {
      setTransactionReferenceError('Transaction ID or UPI ID is required.');
      return;
    }
    if (paymentScope === 'parents' && yourTotalAmount > 0) {
      setSubmissionError('Please clear the main donor due before paying for parent donors.');
      return;
    }
    setTransactionReferenceError(null);
    setSubmissionError(null);

    const amountInput = amountPaid.trim();
    let parsedAmount: number | undefined;
    if (amountInput) {
      const numericValue = Number(amountInput);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        setSubmissionError('Enter a valid amount greater than zero.');
        return;
      }
      parsedAmount = numericValue;
    } else if (paymentScope === 'parents') {
      parsedAmount = selectedAmountDue;
    }

    const payableAmount = selectedAmountDue;
    const amountToRecord = parsedAmount ?? payableAmount;

    if (!Number.isFinite(amountToRecord) || amountToRecord <= 0) {
      setSubmissionError('Amount must be greater than zero before continuing.');
      return;
    }

    setProcessingPayment(true);

    const donorEntries = parentDonors
      .map((donor) => ({
        id: donor.id ?? null,
        name: donor.name ?? null,
        phone: donor.phone ?? null,
        totalAmount: sumCartItems(donor.items),
        items: donor.items,
      }));

    const parentNotes = donorEntries
      .map((entry) => {
        const label = entry.name || entry.phone || 'Unnamed donor';
        return `${label}: ₹ ${formatCurrency(entry.totalAmount)}`;
      })
      .join(' • ');

    const notesParts: string[] = [];
    if (paymentScope === 'parents' && parentNotes) {
      notesParts.push(`Parent donors (${parentNotes})`);
    }
    if (paymentScope === 'main' && hasOwnItems) {
      notesParts.push(`Main donor poojas: ₹ ${formatCurrency(yourTotalAmount)}`);
    }

    try {
      const payments: Array<{
        donorId: number | null;
        amount: number;
        notes?: string;
      }> = [];

      if (paymentScope === 'main') {
        if (user?.id) {
          payments.push({
            donorId: user.id,
            amount: amountToRecord,
            notes: hasOwnItems
              ? `Main donor payment: ₹ ${formatCurrency(amountToRecord)}`
              : `Manual main donor payment entry: ₹ ${formatCurrency(amountToRecord)}`,
          });
        }
      } else {
        let remainingAmount = amountToRecord;
        donorEntries.forEach((entry) => {
          if (remainingAmount <= 0) return;
          const allocatedAmount = Math.min(entry.totalAmount, remainingAmount);
          if (allocatedAmount > 0) {
            payments.push({
              donorId: entry.id,
              amount: allocatedAmount,
              notes: `${entry.name || entry.phone || 'Parent donor'} payment allocation: ₹ ${formatCurrency(allocatedAmount)}`,
            });
            remainingAmount -= allocatedAmount;
          }
        });

        if (remainingAmount > 0) {
          const fallbackDonor = donorEntries[0];
          if (!fallbackDonor) {
            setSubmissionError('No parent donor found to record this payment.');
            setProcessingPayment(false);
            return;
          }
          payments.push({
            donorId: fallbackDonor.id,
            amount: remainingAmount,
            notes: `${fallbackDonor.name || fallbackDonor.phone || 'Parent donor'} excess payment allocation: ₹ ${formatCurrency(remainingAmount)}`,
          });
        }
      }

      const splitTotal = payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(splitTotal - amountToRecord) > 0.01) {
        throw new Error('Split total does not match payable amount. Please reload and try again.');
      }

      for (const payment of payments) {
        await api.post('payments/records/', {
          donor_id: payment.donorId ?? undefined,
          amount: payment.amount,
          currency: 'INR',
          mode: paymentMethodTab === 'upi' ? 'upi' : 'neft',
          status: 'success',
          transaction_reference: trimmedReference,
          payment_month: paymentDate || undefined,
          notes: [payment.notes, notesParts.join(' | ')].filter(Boolean).join(' | ') || undefined,
        });
      }

      addCombinePaymentHistory({
        yourItems: paymentScope === 'main' ? allOwnItems : [],
        yourTotal: paymentScope === 'main' ? amountToRecord : 0,
        donors: paymentScope === 'parents' ? donorEntries : [],
        combinedTotal: amountToRecord,
      });

      // Clear form inputs as soon as payment recording succeeds.
      setTransactionReference('');
      setAmountPaid('');
      setPaymentDate('');
      setShareError(null);

      if (typeof currentBalance === 'number') {
        const updatedBalance = Math.max(0, currentBalance - amountToRecord);
        try {
          await api.put('auth/profile/', { custom_number: updatedBalance });
          refreshBalance();
        } catch (balanceError) {
          console.error('Unable to refresh opening balance after combined payment', balanceError);
          setSubmissionError(
            'Payment recorded but unable to refresh opening balance. Please reload page.',
          );
        }
      }

      clearCart(cartKey);
      try {
        await fetchCombineAccess();
        await loadStatementClosingDue();
      } catch (refreshError) {
        console.error('Unable to refresh combined payment page after payment', refreshError);
      }

      const paidScopeLabel = paymentScope === 'parents' ? 'parent donor dues' : 'main donor due';
      setSuccessToastMessage(
        `Temple payment of ₹ ${formatCurrency(amountToRecord)} received successfully for ${paidScopeLabel}.`,
      );
      setPetalSeed((seed) => seed + 1);
      setShowCelebration(true);

      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
      celebrationTimeoutRef.current = setTimeout(() => {
        setShowCelebration(false);
      }, 5000);
    } catch (error) {
      console.error('Unable to record combined payment', error);
      setSubmissionError(buildSubmissionErrorMessage(error));
    } finally {
      setProcessingPayment(false);
    }
  }, [
    addCombinePaymentHistory,
    amountPaid,
    allOwnItems,
    cartKey,
    clearCart,
    currentBalance,
    hasOwnItems,
    parentItemsTotal,
    parentDonors,
    paymentScope,
    refreshBalance,
    fetchCombineAccess,
    loadStatementClosingDue,
    transactionReference,
    selectedAmountDue,
    yourTotalAmount,
    paymentMethodTab,
    paymentDate,
    user,
  ]);

  // Access control redirects
  if (canCombine === false) {
    return <Navigate to="/profile" replace />;
  }
  if (combineRole === 'subordinate') {
    return <Navigate to="/payments/general" replace />;
  }
  if (combineRole === 'main' && !canCombine) {
    return <Navigate to="/payments/general" replace />;
  }

  if (canCombine === null) {
    return (
      <section className="h-full flex items-center justify-center bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Verifying combine payment access...</p>
          {combineError && (
            <>
              <p className="text-sm text-rose-600">{combineError}</p>
              <button
                type="button"
                onClick={fetchCombineAccess}
                disabled={combineLoading}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {combineLoading ? 'Retrying...' : 'Retry'}
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="h-full min-h-0 bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex flex-col overflow-hidden">
      {/* Compact Header */}
      <header className="flex-shrink-0 px-3 pt-3 pb-2 sm:px-4">
        <div className="max-w-7xl mx-auto w-full px-1 py-2 sm:px-2">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-100 to-orange-200 p-2 rounded-xl">
              <svg className="w-5 h-5 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Combine Payment</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Due</p>
            <p className="text-lg font-bold text-orange-600">₹ {formatCurrency(totalDueAmount)}</p>
          </div>
        </div>
        </div>
      </header>

      {/* Guidance Note */}
      {parentDonors.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2 sm:px-4">
          <div className="max-w-7xl mx-auto">
            <div className="inline-flex max-w-full items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-xs text-slate-700">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
              <div>
                <p>Please clear total due, to unlock the Sub-ordinate, if required</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Split Layout */}
      <main className="flex-1 min-h-0 overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="h-full max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(20rem,0.95fr)_minmax(24rem,1.25fr)] gap-4 xl:gap-5">
          
          {/* Left Panel - Donor Summary */}
          <div className="w-full max-w-2xl mx-auto xl:max-w-none xl:w-full xl:mx-0 bg-white rounded-2xl shadow-[0_8px_30px_-22px_rgba(15,23,42,0.5)] border border-slate-200/90 overflow-hidden flex flex-col min-h-0 xl:self-start">
            {/* Main Donor Section */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100/90 px-4 py-2.5 border-b border-blue-200/80 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-bold text-slate-800">Main Donor</span>
                  <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">1</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-b border-blue-100 flex-shrink-0">
              <div className="bg-gradient-to-r from-blue-50/70 to-white rounded-xl border border-blue-100 p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-200 to-blue-300 rounded-full flex items-center justify-center text-xs font-bold text-blue-800 flex-shrink-0">
                      {user?.name
                        ? user.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : 'MD'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{user?.name || 'Main donor'}</p>
                      {user?.phone_number && (
                        <p className="text-xs text-slate-500">{user.phone_number}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Parent Donors Section */}
            {parentDonors.length > 0 && (
              <>
                <div className="bg-gradient-to-r from-orange-50 to-orange-100/90 px-4 py-2.5 border-t border-b border-orange-200/90 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span className="text-sm font-bold text-slate-800">Sub-ordinate Donors</span>
                      <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">{parentDonors.length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                  {parentDonors.map((donor, donorIndex) => {
                    const donorKey = `parent-${donor.id ?? donor.phone ?? donorIndex}`;
                    const initials = donor.name
                      ? donor.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      : 'PD';
                    
                    return (
                      <div
                        key={donorKey}
                        className="bg-gradient-to-r from-orange-50/50 to-white rounded-xl border border-orange-100 p-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-200 to-orange-300 rounded-full flex items-center justify-center text-xs font-bold text-orange-800 flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{donor.name || donor.phone || 'Unnamed donor'}</p>
                              {donor.phone && (
                                <p className="text-xs text-slate-500">{donor.phone}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right Panel - Payment */}
          <div className="w-full max-w-2xl mx-auto xl:max-w-none xl:w-full xl:mx-0 bg-white rounded-2xl shadow-[0_10px_34px_-22px_rgba(15,23,42,0.55)] border border-slate-200/90 overflow-hidden flex flex-col min-h-0 xl:self-start">
            {/* Payment Header */}
            <div className="bg-gradient-to-r from-orange-600 via-orange-600 to-amber-600 px-4 py-3 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="text-lg font-bold">Payment</span>
                </div>
              </div>
            </div>

            {/* Payment Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 min-h-0">
              {/* Payment Method Tabs */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodTab('upi')}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      paymentMethodTab === 'upi'
                        ? 'bg-white text-orange-700 shadow-sm border border-orange-200'
                        : 'text-slate-600 hover:bg-white/70'
                    }`}
                  >
                    UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodTab('bank')}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      paymentMethodTab === 'bank'
                        ? 'bg-white text-orange-700 shadow-sm border border-orange-200'
                        : 'text-slate-600 hover:bg-white/70'
                    }`}
                  >
                    Bank Transfer
                  </button>
                </div>
              </div>

              {paymentMethodTab === 'upi' ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="flex-shrink-0">
                    <img
                      src={PAYMENT_QR_IMAGE_URL}
                      alt="Payment QR Code"
                      className="w-24 h-24 rounded-lg border border-slate-200 bg-white p-1.5 object-contain shadow-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">UPI ID</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-bold text-slate-800">alamelu7@icici</p>
                      <button
                        onClick={handleCopyUpi}
                        className={`flex-shrink-0 px-2 py-1 text-xs font-bold rounded transition ${
                          copiedUpi
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                        }`}
                      >
                        {copiedUpi ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Scan QR with any UPI app</p>
                    {isAndroid && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpiApp(selectedAmountDue)}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition"
                      >
                        Open UPI Apps
                      </button>
                    )}
                    {isIos && (
                      <button
                        type="button"
                        onClick={() => handleSharePaymentQr(selectedAmountDue)}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition"
                      >
                        Share QR
                      </button>
                    )}
                    {shareError && <p className="mt-1 text-xs text-red-600">{shareError}</p>}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-700 mb-1">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    <span className="text-sm font-semibold">Bank Transfer Details</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Holder</span>
                    <span className="font-semibold text-slate-800 text-right">ALAMELU V / SRIRAM RAJU</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account No.</span>
                    <span className="font-mono font-semibold text-slate-800">007701028012</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">IFSC Code</span>
                    <span className="font-mono font-semibold text-slate-800">ICIC0000077</span>
                  </div>
                </div>
              )}

              {/* Payment Form */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="transaction-ref" className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-1">
                    Transaction ID / UPI ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="transaction-ref"
                    type="text"
                    value={transactionReference}
                    onChange={(e) => {
                      setTransactionReference(e.target.value);
                      if (transactionReferenceError) setTransactionReferenceError(null);
                      if (submissionError) setSubmissionError(null);
                    }}
                    placeholder="Enter reference or UPI ID"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  {transactionReferenceError && (
                    <p className="mt-1 text-xs text-red-600">{transactionReferenceError}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="amount-paid" className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-1">
                      Amount Paid
                    </label>
                    <input
                      id="amount-paid"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountPaid}
                      onChange={(e) => {
                        setAmountPaid(e.target.value);
                        if (submissionError) setSubmissionError(null);
                      }}
                      placeholder="Enter amount"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="payment-date" className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-1">
                      Payment Date
                    </label>
                    <input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      onFocus={(e) => {
                        const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                        input.showPicker?.();
                      }}
                      onClick={(e) => {
                        const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                        input.showPicker?.();
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Tab') {
                          e.preventDefault();
                        }
                      }}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>

                <button
                  onClick={handlePaymentCompleted}
                  disabled={paymentBlocked}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold shadow-lg hover:from-green-700 hover:to-green-800 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingPayment ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      Pay
                    </>
                  )}
                </button>

                {submissionError && (
                  <p className="text-xs text-red-600 text-center">{submissionError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Celebration Animation */}
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
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-slate-700 bg-slate-900/95 px-6 py-3 text-base font-semibold text-slate-100 shadow-xl backdrop-blur-sm">
              Payment success, thanks.
            </div>
          </div>
        </div>
      )}

      {/* CSS for flower petal animation */}
      <style>{`
        @keyframes fall-petal {
          0% {
            transform: translateY(-10vh) translateX(0) scale(var(--petal-scale)) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(var(--petal-horizontal)) scale(var(--petal-scale)) rotate(720deg);
            opacity: 0;
          }
        }
        .flower-petal {
          position: absolute;
          top: 0;
          width: 12px;
          height: 12px;
          background: hsl(var(--petal-hue), 80%, 65%);
          border-radius: 50% 0 50% 50%;
          animation: fall-petal linear forwards;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default CombinePaymentPage;
