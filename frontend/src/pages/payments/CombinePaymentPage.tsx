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
  const [paymentDate, setPaymentDate] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

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

  const parentItemsCount = useMemo(
    () => parentDonors.reduce((sum, donor) => sum + donor.items.length, 0),
    [parentDonors],
  );

  const combinedTotal = yourTotalAmount + parentItemsTotal;
  const combinedAmountDue = Math.max(0, combinedTotal - (currentBalance ?? 0));
  const combinedPoojaCount = allOwnItems.length + parentItemsCount;

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
    if (combinedPoojaCount === 0) {
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
    }

    const amountToRecord = parsedAmount ?? combinedAmountDue;

    if (!Number.isFinite(amountToRecord) || amountToRecord <= 0) {
      setSubmissionError('Amount must be greater than zero before continuing.');
      return;
    }

    setProcessingPayment(true);

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
    if (parentNotes) {
      notesParts.push(`Combined donors (${parentNotes})`);
    }
    if (hasOwnItems) {
      notesParts.push(`Your poojas: ₹ ${formatCurrency(yourTotalAmount)}`);
    }

    const paymentPayload = {
      amount: amountToRecord,
      currency: 'INR',
      mode: 'upi',
      status: 'success',
      transaction_reference: trimmedReference,
      payment_month: paymentDate || undefined,
      notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined,
    };

    try {
      await api.post('payments/records/', paymentPayload);

      addCombinePaymentHistory({
        yourItems: allOwnItems,
        yourTotal: yourTotalAmount,
        donors: donorEntries,
        combinedTotal,
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
        navigate('/profile');
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
    combinedAmountDue,
    combinedPoojaCount,
    combinedTotal,
    currentBalance,
    hasOwnItems,
    navigate,
    parentDonors,
    refreshBalance,
    transactionReference,
    yourTotalAmount,
    paymentDate,
  ]);

  if (canCombine === false) {
    return <Navigate to="/dashboard" replace />;
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

  // Helper to get first name for display
  const firstName = user?.name ? user.name.split(' ')[0] : 'Your';

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Your Poojas */}
          <div className="bg-gradient-to-br from-white to-blue-50/30 border border-blue-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-blue-100 p-2 rounded-xl">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 border border-blue-200">
                Your Items
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{allOwnItems.length}</p>
            <p className="text-sm text-slate-600">₹ {formatCurrency(yourTotalAmount)}</p>
          </div>

          {/* Combined Total */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-2 border-orange-200 rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-orange-200 p-2 rounded-xl">
                <svg className="w-5 h-5 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-orange-200 text-orange-800 border border-orange-300">
                Combined
              </span>
            </div>
            <p className="text-3xl font-bold text-orange-700 mb-1">{combinedPoojaCount} items</p>
            <p className="text-sm text-orange-800 font-semibold">₹ {formatCurrency(combinedTotal)}</p>
          </div>

          {/* Parent Donors */}
          <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-slate-100 p-2 rounded-xl">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                Linked
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{parentDonors.length}</p>
            <p className="text-sm text-slate-600">Parent donor{parentDonors.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Amount Due */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-100/50 border-2 border-green-200 rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-green-200 p-2 rounded-xl">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-green-200 text-green-800 border border-green-300">
                Pay Now
              </span>
            </div>
            <p className="text-3xl font-bold text-green-700 mb-1">₹ {formatCurrency(combinedAmountDue)}</p>
            <p className="text-sm text-green-800">Amount to pay</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Donor Details */}
          <div className="lg:col-span-2 space-y-6">
            
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
                              {donor.updatedAt && (
                                <p className="text-xs text-slate-500 mt-1">Saved on {formatDateTime(donor.updatedAt)}</p>
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
                <p className="text-orange-100 text-sm">₹ {formatCurrency(combinedAmountDue)} • {combinedPoojaCount} items</p>
              </div>
              <div className="p-6 space-y-5">
                
                {/* PAYMENT BREAKDOWN SECTION */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">New Items Total</span>
                    <span className="font-bold text-slate-800">₹ {formatCurrency(combinedTotal)}</span>
                  </div>
                  
                  {/* Opening Balance Logic: If < 0, it is added (Debt). If > 0, it is deducted (Advance) */}
                  {currentBalance !== null && currentBalance !== 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 font-medium">
                        {currentBalance < 0 
                          ? `${firstName}'s Outstanding Balance` 
                          : `${firstName}'s Advance Balance`
                        }
                      </span>
                      <span className={`font-bold ${currentBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {currentBalance < 0 ? '+' : '-'} ₹ {formatCurrency(Math.abs(currentBalance))}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-300 my-2"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-900 font-bold text-base">Total Payable</span>
                    <span className="text-slate-900 font-bold text-lg">₹ {formatCurrency(combinedAmountDue)}</span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <img
                    src={PAYMENT_QR_IMAGE_URL}
                    alt="Payment QR Code"
                    className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2 object-contain shadow-sm"
                  />
                  <p className="mt-3 text-sm font-medium text-slate-700 text-center">
                    Scan & pay ₹ {formatCurrency(combinedAmountDue)}
                  </p>
                  {isAndroid && (
                    <button
                      type="button"
                      onClick={() => handleOpenUpiApp(combinedAmountDue)}
                      className="mt-2 px-4 py-2 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition"
                    >
                      📲 Open UPI Apps
                    </button>
                  )}
                  {isIos && (
                    <button
                      type="button"
                      onClick={() => handleSharePaymentQr(combinedAmountDue)}
                      className="mt-2 px-4 py-2 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition"
                    >
                      📤 Share QR
                    </button>
                  )}
                  {shareError && <p className="mt-2 text-xs text-red-600">{shareError}</p>}
                </div>

                {/* Account Details */}
                <RevealableAccountSection className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
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

                {/* Payment Form */}
                <div className="space-y-4 pt-2">
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
                      placeholder={`₹ ${formatCurrency(combinedAmountDue)}`}
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
                    disabled={processingPayment}
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