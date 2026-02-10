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
 * Combined Account Concept:
 *   Multiple donors can be "combined" under a primary account.
 *   All payments are tracked together.
 *   A single payment covers all combined members' dues.
 * 
 * Payment Flow:
 *   1. Verify user has combine access permissions
 *   2. Load cart items from combined account
 *   3. Fetch combined account balance
 *   4. Display aggregated payment details for all members
 *   5. Show payment methods (UPI, manual transfer)
 *   6. Record combined payment in backend
 *   7. Clear combined cart and refresh balance
 * 
 * Main Components:
 *   - Members List: Display all members in combined account
 *   - Cart Summary: Aggregated items from all members
 *   - Payment Section: Handle payment for entire combined account
 *   - Bank Account Section: Reveal sensitive account details
 * 
 * Access Control:
 *   - Only primary donor or authorized users can access
 *   - Checked via useCombineAccessStore
 *   - Redirects to main page if no access
 * 
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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

const sumBy = <T,>(items: T[], fn: (item: T) => number) =>
  items.reduce((sum, item) => sum + fn(item), 0);

const monthKeyFromDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

const buildMembersLabel = (members?: CartItem['members']) => {
  if (!members || members.length === 0) {
    return null;
  }
  const names = members
    .map((member) => member?.name?.toString().trim())
    .filter((name): name is string => Boolean(name && name.length > 0));

  if (names.length === 0) {
    return null;
  }
  return names.join(', ');
};

// --- Component ---

const CombinePaymentPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const navigate = useNavigate();

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

  const [transactionReference, setTransactionReference] = useState('');
  const [transactionReferenceError, setTransactionReferenceError] = useState<string | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [petalSeed, setPetalSeed] = useState(0);
  const [shareError, setShareError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentScope, setPaymentScope] = useState<'main' | 'parents'>('main');
  const [parentMonths, setParentMonths] = useState(1);
  const [parentMonthSelection, setParentMonthSelection] = useState('');

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

  // Extract due months from backend-provided list; fall back to bookingDate months
  const parentDueMonths = useMemo(() => {
    const months = new Set<string>();
    parentDonors.forEach((donor) => {
      if (donor.dueMonths && donor.dueMonths.length) {
        donor.dueMonths.forEach((m) => months.add(m));
        return;
      }
      donor.items.forEach((item) => {
        const key = monthKeyFromDate(item?.bookingDate);
        if (key) months.add(key);
      });
    });
    return Array.from(months).sort();
  }, [parentDonors]);

  // Per-parent single-month amount: sum items in the earliest due month for that parent
  const perParentMonthAmount = useMemo(() => {
    return parentDonors.map((donor) => {
      const monthKey =
        (donor.dueMonths && donor.dueMonths.length && donor.dueMonths[0]) ||
        donor.items
          .map((item) => monthKeyFromDate(item?.bookingDate))
          .filter(Boolean)
          .sort()[0] ||
        null;
      let amountForMonth = 0;
      if (monthKey) {
        amountForMonth = donor.items
          .filter((item) => monthKeyFromDate(item?.bookingDate) === monthKey)
          .reduce((sum, item) => sum + parseAmount((item as any).amount), 0);
      }
      if (amountForMonth <= 0 && donor.dueMonths && donor.dueMonths.length > 0) {
        const total = donor.items.reduce((sum, item) => sum + parseAmount((item as any).amount), 0);
        amountForMonth = total / donor.dueMonths.length;
      }
      return amountForMonth;
    });
  }, [parentDonors]);

  const parentDueOptions = useMemo(() => {
    const formatKey = (key: string) => {
      const [y, m] = key.split('-');
      const date = new Date(Number(y), Number(m) - 1, 1);
      return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    };
    const singles = parentDueMonths.map((m) => ({
      value: m,
      count: 1,
      label: formatKey(m),
    }));
    const combined =
      parentDueMonths.length > 1
        ? [
            {
              value: 'all',
              count: parentDueMonths.length,
              label: `All due months (${parentDueMonths.map(formatKey).join(', ')})`,
            },
          ]
        : [];
    return [...singles, ...combined];
  }, [parentDueMonths]);

  const parentMonthlyBundle = useMemo(() => {
    if (!parentDonors.length) return 0;
    return perParentMonthAmount.reduce((sum, amt) => sum + amt, 0);
  }, [parentDonors.length, perParentMonthAmount]);

  const effectiveParentMonthlyBundle = useMemo(() => {
    if (parentMonthlyBundle > 0) return parentMonthlyBundle;
    if (parentDueMonths.length > 0) {
      return parentItemsTotal / parentDueMonths.length;
    }
    return 0;
  }, [parentMonthlyBundle, parentDueMonths.length, parentItemsTotal]);

  const parentMaxMonths = useMemo(() => parentDueMonths.length || (parentMonthlyBundle > 0 ? Math.floor(parentItemsTotal / parentMonthlyBundle) : 0), [parentDueMonths.length, parentItemsTotal, parentMonthlyBundle]);
  const selectedParentMonths = useMemo(() => {
    const selected = parentDueOptions.find((opt) => opt.value === (parentMonthSelection || parentDueOptions[0]?.value));
    return selected?.count ?? parentMonths;
  }, [parentDueOptions, parentMonthSelection, parentMonths]);

  // Adjust parent month selection when data changes
  useEffect(() => {
    const max = Math.max(1, parentMaxMonths || 1);
    const defaultOption = parentDueOptions[0];
    setParentMonths((prev) => Math.min(Math.max(1, prev), max));
    if (defaultOption) {
      setParentMonthSelection((prev) => (prev ? prev : defaultOption.value));
      setParentMonths(defaultOption.count);
    }
  }, [parentMaxMonths, parentDueOptions]);

  const parentItemsCount = useMemo(
    () => parentDonors.reduce((sum, donor) => sum + donor.items.length, 0),
    [parentDonors],
  );

  const selectedAmountDue =
    paymentScope === 'main'
      ? yourTotalAmount
      : Math.max(effectiveParentMonthlyBundle * selectedParentMonths, 0);
  const selectedPoojaCount = paymentScope === 'main' ? allOwnItems.length : parentItemsCount;
  const canPayParents = yourTotalAmount <= 0;
  const parentScopeDisabled = !canPayParents || parentItemsTotal <= 0;
  const paymentBlocked =
    processingPayment || selectedAmountDue <= 0 || (paymentScope === 'parents' && !canPayParents);

  useEffect(() => {
    if (parentScopeDisabled && paymentScope === 'parents') {
      setPaymentScope('main');
    }
  }, [parentScopeDisabled, paymentScope]);

  // Auto-suggest amount for parent scope based on selected months
  useEffect(() => {
    if (paymentScope !== 'parents') {
      return;
    }
    if (effectiveParentMonthlyBundle > 0) {
      const suggested = effectiveParentMonthlyBundle * parentMonths;
      setAmountPaid(String(suggested));
    }
  }, [paymentScope, effectiveParentMonthlyBundle, parentMonths]);

  const hasOwnItems = allOwnItems.length > 0;
  const hasParentItems = parentItemsCount > 0;

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
    if (canCombine === null && !combineLoading && !combineError) {
      fetchCombineAccess();
    }
  }, [canCombine, combineLoading, combineError, fetchCombineAccess]);

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
    setShowPaymentDetails(false);
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
    if (selectedPoojaCount === 0) {
      setSubmissionError('No payable items in the selected scope.');
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

    // Parents: require exact amount for selected months; Main: allow partial but not overpay
    if (paymentScope === 'parents') {
      if (effectiveParentMonthlyBundle <= 0) {
        setSubmissionError('Unable to determine monthly total for parent donors.');
        return;
      }
      const expectedAmount = effectiveParentMonthlyBundle * selectedParentMonths;
      if (Math.abs(amountToRecord - expectedAmount) > 0.01) {
        setSubmissionError(`Please pay ₹ ${formatCurrency(expectedAmount)} for the selected months.`);
        return;
      }
      if (selectedParentMonths > parentMaxMonths) {
        setSubmissionError(
          `You can pay up to ${parentMaxMonths} month${parentMaxMonths !== 1 ? 's' : ''} now (₹ ${formatCurrency(
            parentItemsTotal,
          )}).`,
        );
        return;
      }
    } else if (paymentScope === 'main' && amountToRecord - payableAmount > 0.01) {
      setSubmissionError(`Amount exceeds your current due of ₹ ${formatCurrency(payableAmount)}.`);
      return;
    }

    setProcessingPayment(true);

    const monthlyByDonorId = new Map<number | null, number>();
    parentDonors.forEach((donor, idx) => {
      monthlyByDonorId.set(donor.id ?? null, perParentMonthAmount[idx] || 0);
    });

    const donorEntries = parentDonors
      .filter((donor) => donor.items.length > 0)
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
        if (hasOwnItems && user?.id) {
          payments.push({
            donorId: user.id,
            amount: amountToRecord,
            notes: `Main donor payment: ₹ ${formatCurrency(amountToRecord)}`,
          });
        }
      } else {
        const monthsRequested = selectedParentMonths;
        donorEntries.forEach((entry) => {
          if (entry.totalAmount <= 0) return;
          const monthlyAmount =
            monthlyByDonorId.get(entry.id ?? null) && monthlyByDonorId.get(entry.id ?? null)! > 0
              ? monthlyByDonorId.get(entry.id ?? null)!
              : entry.items.length > 0
                ? parseAmount(entry.items[0]?.amount)
                : entry.totalAmount / Math.max(1, selectedParentMonths);
          const payableForDonor = monthlyAmount * monthsRequested;
          const cappedAmount = Math.min(entry.totalAmount, payableForDonor);
          if (cappedAmount > 0) {
            payments.push({
              donorId: entry.id,
              amount: cappedAmount,
              notes: `${entry.name || entry.phone || 'Parent donor'} payment (${monthsRequested} month${monthsRequested !== 1 ? 's' : ''}): ₹ ${formatCurrency(cappedAmount)}`,
            });
          }
        });
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
          mode: 'upi',
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
      setShowPaymentDetails(false);
      setTransactionReference('');
      setAmountPaid('');
      setPaymentDate('');
      setShareError(null);
      setPetalSeed((seed) => seed + 1);
      setShowCelebration(true);

      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
      celebrationTimeoutRef.current = setTimeout(() => {
        setShowCelebration(false);
      }, 1800);
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
    navigate,
    parentItemsTotal,
    parentDonors,
    paymentScope,
    refreshBalance,
    transactionReference,
    selectedAmountDue,
    selectedPoojaCount,
    yourTotalAmount,
    paymentDate,
    user,
  ]);

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
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-orange-100 to-orange-200 p-3 rounded-2xl shadow-sm">
              <svg className="w-8 h-8 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Combine Payment</h1>
              <p className="text-sm text-slate-600 mt-1">Consolidated payment for you and linked donors</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Donor Details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Guidance Note */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
              <div className="mt-0.5 text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="leading-relaxed">
                  Please clear your own due first, then proceed to pay the parent donors’ dues. Parent payments stay locked until the main donor due is zero.
                </p>
                {!canPayParents && parentItemsTotal > 0 && (
                  <p className="text-xs text-rose-600 font-semibold">
                    Main donor due pending — pay ₹ {formatCurrency(yourTotalAmount)} to unlock parent donor payments.
                  </p>
                )}
              </div>
            </div>

            {/* Payment Scope Toggle */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-800">Choose whose due to pay now</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentScope('main');
                    setSubmissionError(null);
                  }}
                  className={`relative flex flex-col gap-2 rounded-xl border px-4 py-3 text-left transition hover:border-blue-300 ${
                    paymentScope === 'main'
                      ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/60'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-4 w-4 rounded-full border-2 ${
                        paymentScope === 'main' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                      }`}
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      Main Donor Due {user?.name ? `(${user.name})` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <span className="font-semibold text-blue-700">₹ {formatCurrency(yourTotalAmount)}</span>
                    <span className="text-slate-400">•</span>
                    {allOwnItems.length} item{allOwnItems.length !== 1 ? 's' : ''}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (parentScopeDisabled) return;
                    setPaymentScope('parents');
                    setSubmissionError(null);
                    if (parentMonthlyBundle > 0) {
                      setAmountPaid(String(parentMonthlyBundle * parentMonths));
                    }
                  }}
                  disabled={parentScopeDisabled}
                  className={`relative flex flex-col gap-2 rounded-xl border px-4 py-3 text-left transition ${
                    paymentScope === 'parents'
                      ? 'border-orange-500 ring-2 ring-orange-100 bg-orange-50/60'
                      : 'border-slate-200 bg-slate-50'
                  } ${parentScopeDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-orange-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-4 w-4 rounded-full border-2 ${
                        paymentScope === 'parents' ? 'border-orange-500 bg-orange-500' : 'border-slate-300'
                      }`}
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      Parent Donor Due ({parentDonors.length} linked)
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <span className="font-semibold text-orange-700">₹ {formatCurrency(parentItemsTotal)}</span>
                    <span className="text-slate-400">•</span>
                    {parentItemsCount} item{parentItemsCount !== 1 ? 's' : ''}
                  </p>
                  {!canPayParents && (
                    <p className="text-[11px] text-rose-600 font-semibold">Unlock after clearing main donor due.</p>
                  )}
                  {parentItemsTotal <= 0 && (
                    <p className="text-[11px] text-slate-500">No pending parent dues.</p>
                  )}
                </button>
              </div>
            </div>
            
            {/* Your Cart Items - MOVED TO TOP */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Your Cart Items</h2>
                      <p className="text-xs text-slate-600">Your personal pooja selections</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Total</p>
                    <p className="text-xl font-bold text-blue-600">₹ {formatCurrency(yourTotalAmount)}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                {allOwnItems.length === 0 ? (
                  hasParentItems ? (
                    <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                      <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <p className="text-sm text-slate-600 mb-1 font-medium">No personal items yet</p>
                      <p className="text-xs text-slate-500">
                        The linked parent donors have {parentItemsCount} pooja{parentItemsCount === 1 ? '' : 's'} waiting to be paid.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                      <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <p className="text-sm text-slate-600 mb-1 font-medium">Your cart is empty</p>
                      <p className="text-xs text-slate-500">Visit the Pooja cart to select offerings before combining payments.</p>
                    </div>
                  )
                ) : (
                  <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-blue-900/60 tracking-wider mb-0.5">Your Current Due</p>
                        <p className="text-xl font-bold text-blue-700 leading-tight">₹ {formatCurrency(yourTotalAmount)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-slate-800 leading-none">{allOwnItems.length}</p>
                      <p className="text-[10px] text-slate-500 font-medium uppercase mt-1">
                          Item{allOwnItems.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Parent Donor Section - MOVED TO BOTTOM */}
            {parentDonors.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b border-orange-200">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Parent Donor Selections</h2>
                        <p className="text-xs text-slate-600">Items from linked donors</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-600 uppercase">Total</p>
                      <p className="text-xl font-bold text-orange-600">₹ {formatCurrency(parentItemsTotal)}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {parentDonors.map((donor, donorIndex) => {
                    const donorKey = `parent-${donor.id ?? donor.phone ?? donorIndex}`;
                    const donorTotal = sumCartItems(donor.items);
                    const initials = donor.name
                      ? donor.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      : 'D';

                    return (
                      <div
                        key={donorKey}
                        className="bg-gradient-to-br from-white to-orange-50/20 rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between flex-wrap gap-4">
                          <div className="flex items-start gap-3">
                            <div className="bg-gradient-to-br from-orange-200 to-orange-300 p-3 rounded-xl shadow-sm">
                              <span className="text-xl font-bold text-orange-800">{initials}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="text-lg font-bold text-slate-900">
                                  {donor.name || donor.phone || 'Unnamed donor'}
                                </h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-orange-100 text-orange-700 border border-orange-200">
                                  Parent
                                </span>
                              </div>
                              {donor.phone && (
                                <p className="text-sm text-slate-600 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  {donor.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-600 uppercase">Current Due</p>
                            <p className="text-2xl font-bold text-orange-600">₹ {formatCurrency(donorTotal)}</p>
                            <p className="text-xs text-slate-500 mt-1">{donor.items.length} pooja{donor.items.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Payment Section */}
          <div className="space-y-6">
            {/* Payment Details Card - Always Visible */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden sticky top-6">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <h3 className="text-xl font-bold">Complete Payment</h3>
                </div>
                <p className="text-orange-100 text-sm">
                  ₹ {formatCurrency(selectedAmountDue)} • {selectedPoojaCount} item{selectedPoojaCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="p-6 space-y-5">
                
                {/* PAYMENT BREAKDOWN SECTION */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">
                      {paymentScope === 'main' ? 'Main Donor Due' : 'Parent Donor Due'}
                    </span>
                    <span className="font-bold text-slate-800">₹ {formatCurrency(selectedAmountDue)}</span>
                  </div>
                  
                  <div className="border-t border-slate-300 my-2"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-900 font-bold text-base">Total Payable</span>
                    <span className="text-slate-900 font-bold text-lg">₹ {formatCurrency(selectedAmountDue)}</span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <img
                    src={PAYMENT_QR_IMAGE_URL}
                    alt="Payment QR Code"
                    className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2 object-contain shadow-sm"
                  />
                  <div className="w-full bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm mt-3">
                    <div className="flex flex-col">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">UPI ID</p>
                      <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">alamelu7@icici</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      title={copiedUpi ? 'Copied!' : 'Copy UPI ID'}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 transition active:scale-95"
                    >
                      {copiedUpi ? (
                        <span className="text-green-600 font-bold flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </span>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Scan with any UPI app to pay instantly</p>
                  {isAndroid && (
                    <button
                      type="button"
                      onClick={() => handleOpenUpiApp(selectedAmountDue)}
                      className="mt-2 px-4 py-2 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition"
                    >
                      📲 Open UPI Apps
                    </button>
                  )}
                  {isIos && (
                    <button
                      type="button"
                      onClick={() => handleSharePaymentQr(selectedAmountDue)}
                      className="mt-2 px-4 py-2 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition"
                    >
                      📤 Share QR
                    </button>
                  )}
                  {shareError && <p className="mt-2 text-xs text-red-600">{shareError}</p>}
                </div>

                {/* Bank Transfer */}
                <div className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    <p className="text-sm font-bold text-slate-700">Bank Transfer</p>
                  </div>
                  <RevealableAccountSection className="space-y-3 rounded-lg bg-white p-4 border border-slate-200">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Account Holder</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">ALAMELU V</p>
                      <p className="text-sm font-semibold text-slate-900">SRIRAM RAJU</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Account Number</p>
                      <p className="text-sm font-mono font-semibold text-slate-900 mt-1">007701028012</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">IFSC Code</p>
                      <p className="text-sm font-mono font-semibold text-slate-900 mt-1">ICIC0000077</p>
                    </div>
                  </RevealableAccountSection>
                </div>

                {/* Payment Form */}
                <div className="space-y-4 pt-2">
                  {paymentScope === 'parents' && (effectiveParentMonthlyBundle > 0 || parentDueOptions.length > 0) && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Select due months to clear</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={parentMonthSelection || (parentDueOptions[0]?.value ?? '')}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setParentMonthSelection(nextValue);
                            const selected = parentDueOptions.find((opt) => opt.value === nextValue);
                            setParentMonths(selected?.count ?? 1);
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        >
                          {(parentDueOptions.length
                            ? parentDueOptions
                            : [{ value: 'default', count: 1, label: '1 month' }]
                          ).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-[11px] text-slate-600">
                          Paying months:&nbsp;
                          {parentDueOptions.length === 0
                            ? 'Not available'
                            : parentDueOptions.find((opt) => opt.value === (parentMonthSelection || parentDueOptions[0]?.value))?.label ||
                              ''}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Amount auto-set for selected months: ₹ {formatCurrency(effectiveParentMonthlyBundle * parentMonths)}.
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label htmlFor="transaction-ref" className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-2">
                      Transaction ID / UPI ID
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
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    {transactionReferenceError && (
                      <p className="mt-1 text-xs text-red-600">{transactionReferenceError}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="amount-paid" className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-2">
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
                    placeholder={`₹ ${formatCurrency(selectedAmountDue)}`}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                  <div>
                    <label htmlFor="payment-date" className="text-xs font-semibold uppercase tracking-wide text-slate-600 block mb-2">
                      Payment Date
                    </label>
                    <input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => {
                        setPaymentDate(e.target.value);
                        if (submissionError) setSubmissionError(null);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Payment Completed
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
        </div>
      </div>

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
          <div className="absolute inset-x-0 top-24 flex justify-center">
            <div className="rounded-full bg-white/90 px-6 py-3 text-base font-semibold text-orange-700 shadow-lg backdrop-blur-sm border border-orange-200">
              ✨ Combined payment recorded! Thank you.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinePaymentPage;
