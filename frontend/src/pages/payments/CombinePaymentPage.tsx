import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';

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

const CombinePaymentPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const navigate = useNavigate();
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const clearCart = useCartStore((state) => state.clear);
  const addCombinePaymentHistory = usePaymentStore((state) => state.addCombinePaymentHistory);
  const { balance: currentBalance, loading: balanceLoading, error: balanceError, refresh: refreshBalance } =
    useCurrentBalance();
  const canCombine = useCombineAccessStore((state) => state.canCombine);
  const combineLoading = useCombineAccessStore((state) => state.loading);
  const combineError = useCombineAccessStore((state) => state.error);
  const fetchCombineAccess = useCombineAccessStore((state) => state.fetchAccess);
  const parentDonors = useCombineAccessStore((state) => state.parentDonors);

  const [transactionReference, setTransactionReference] = useState('');
  const [transactionReferenceError, setTransactionReferenceError] = useState<string | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
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

  const yourTotalAmount = useMemo(() => sumCartItems(cartItems), [cartItems]);
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
  const combinedPoojaCount = cartItems.length + parentItemsCount;
  const hasOwnItems = cartItems.length > 0;
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

  const triggerPaymentDetails = () => {
    setSubmissionError(null);
    setTransactionReferenceError(null);
    setShareError(null);
    setShowPaymentDetails(true);
  };

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
    if (cartItems.length === 0) {
      return;
    }
    setTransactionReferenceError(null);
    setSubmissionError(null);
    setProcessingPayment(true);
    try {
      const donorEntries = parentDonors
        .filter((donor) => donor.items.length > 0)
        .map((donor) => ({
          id: donor.id ?? null,
          name: donor.name ?? null,
          phone: donor.phone ?? null,
          totalAmount: sumCartItems(donor.items),
          items: donor.items,
        }));
      addCombinePaymentHistory({
        yourItems: cartItems,
        yourTotal: yourTotalAmount,
        donors: donorEntries,
        combinedTotal,
      });
      if (typeof currentBalance === 'number' && combinedTotal > 0) {
        const updatedBalance = Math.max(0, currentBalance - combinedTotal);
        try {
          await api.put('auth/profile/', { custom_number: updatedBalance });
          refreshBalance();
        } catch (balanceError) {
          console.error('Unable to refresh opening balance after combined payment', balanceError);
          setSubmissionError(
            'Payment recorded but unable to refresh opening balance. Please reload the page.',
          );
        }
      }
      clearCart(cartKey);
      setShowPaymentDetails(false);
      setTransactionReference('');
      setAmountPaid('');
      setPaymentDate('');
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
      console.error('Unable to record the combined payment', error);
      setSubmissionError('Unable to record the payment right now; please try again.');
    } finally {
      setProcessingPayment(false);
    }
  }, [
    addCombinePaymentHistory,
    cartItems,
    cartKey,
    clearCart,
    combinedTotal,
    currentBalance,
    navigate,
    parentDonors,
    refreshBalance,
    transactionReference,
    yourTotalAmount,
  ]);

  const renderCurrentView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Poojas</p>
          <p className="text-lg font-bold text-slate-800">{cartItems.length}</p>
          <p className="text-sm font-semibold text-slate-700">₹ {formatCurrency(yourTotalAmount)}</p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Combined Total</p>
          <p className="text-lg font-bold text-orange-700">{combinedPoojaCount} items</p>
          <p className="text-sm font-semibold text-orange-700">₹ {formatCurrency(combinedTotal)}</p>
        </div>
      </div>

      {parentDonors.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-600">Parent donor selections</p>
              <p className="text-xs text-slate-500">
                Items saved by linked donors are aggregated so you can complete a single transfer.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent total</p>
              <p className="text-lg font-semibold text-orange-700">₹ {formatCurrency(parentItemsTotal)}</p>
            </div>
          </div>
          <div className="space-y-4">
            {parentDonors.map((donor, donorIndex) => {
              const donorKey = `parent-${donor.id ?? donor.phone ?? donorIndex}`;
              const donorTotal = sumCartItems(donor.items);
              return (
                <article
                  key={donorKey}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Parent donor</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {donor.name || donor.phone || 'Unnamed donor'}
                      </p>
                      <p className="text-xs text-slate-500">{donor.phone || '—'}</p>
                      {donor.updatedAt && (
                        <p className="text-xs text-slate-400">Saved {formatDateTime(donor.updatedAt)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                      <p className="text-lg font-semibold text-orange-700">₹ {formatCurrency(donorTotal)}</p>
                      <p className="text-xs text-slate-500">{donor.items.length} pooja(s)</p>
                    </div>
                  </div>
                  {donor.items.length === 0 ? (
                    <p className="text-sm text-slate-500">No poojas in the cart yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {donor.items.map((item, index) => (
                        <li
                          key={`${donorKey}-${item.cartId ?? `idx-${index}`}`}
                          className="grid gap-2 px-4 py-3 sm:grid-cols-5 sm:items-center"
                        >
                          <div className="sm:col-span-2">
                            <p className="font-medium text-slate-800">{item.poojaName}</p>
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              {item.poojaCode ?? 'POOJA'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Date</p>
                            <p className="font-medium text-slate-800">
                              {formatDate(item.customDayDate || item.bookingDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Notes</p>
                            <p className="font-medium text-slate-800">{item.customDayNote?.trim() || '—'}</p>
                            {(() => {
                              const memberLabel = buildMembersLabel(item.members);
                              return memberLabel ? (
                                <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-slate-400">
                                  {memberLabel}
                                </p>
                              ) : null;
                            })()}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Amount</p>
                            <p className="font-semibold text-slate-900">
                              ₹ {formatCurrency(item.amount)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Your Cart Items</h3>
        </div>
        {cartItems.length === 0 ? (
          hasParentItems ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              You haven’t added any poojas yet. The linked parent donors have {parentItemsCount}{' '}
              pooja{parentItemsCount === 1 ? '' : 's'} waiting to be paid for on this screen.
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              You have not added any poojas yet. Visit the Pooja cart to select offerings before combining payments.
            </div>
          )
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {cartItems.map((item) => {
              const memberLabel = buildMembersLabel(item.members);
              return (
                <li
                  key={item.cartId}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-5 sm:items-center"
                >
                  <div className="sm:col-span-2">
                    <p className="font-medium text-slate-800">{item.poojaName}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {item.poojaCode ?? 'POOJA'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="font-medium text-slate-800">{formatDate(item.customDayDate || item.bookingDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Notes</p>
                    <p className="font-medium text-slate-800">{item.customDayNote?.trim() || '—'}</p>
                    {memberLabel && (
                      <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-slate-400">
                        {memberLabel}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="font-semibold text-slate-900">₹ {formatCurrency(item.amount)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

            <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                <p>
                  Click Payment to reveal the bank transfer details. Once the transfer is complete, click Payment Completed to clear the record.
                </p>
              </div>
              {!showPaymentDetails ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={triggerPaymentDetails}
                    className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
                    disabled={combinedPoojaCount === 0}
                  >
                    Payment
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSummary}
                    className="inline-flex items-center justify-center rounded-full border border-transparent bg-slate-800 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
                    disabled={combinedPoojaCount === 0}
                  >
                    Clear Summary
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
              onClick={handlePaymentCompleted}
              disabled={processingPayment}
              className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
            >
              {processingPayment ? 'Saving...' : 'Payment Completed'}
            </button>
            {submissionError && (
              <p className="mt-2 text-sm text-rose-600">{submissionError}</p>
            )}
          </div>
        )}
      </div>

      {showPaymentDetails && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-orange-100">
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opening Balance</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {balanceLoading
                    ? 'Loading...'
                    : currentBalance !== null
                      ? `₹ ${formatCurrency(currentBalance)}`
                      : 'Not set'}
                </p>
                {balanceError && <p className="mt-1 text-xs text-rose-600">{balanceError}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Amount</p>
                <p className="text-2xl font-semibold text-orange-700">₹ {formatCurrency(combinedTotal)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount Due</p>
                <p className="text-2xl font-semibold text-slate-900">₹ {formatCurrency(combinedAmountDue)}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600">Scan the QR or use the account details to transfer the total amount.</p>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
              <img
                src={PAYMENT_QR_IMAGE_URL}
                alt="Temple payment QR code"
                className="h-72 w-72 rounded-lg border border-slate-200 bg-white p-3 object-contain"
              />
              <p className="mt-3 text-sm font-medium text-slate-700">Scan & pay ₹ {formatCurrency(combinedAmountDue)}</p>
              {isAndroid && (
                <>
                  <p className="mt-1 text-xs text-center text-slate-500">
                    Tap "Open UPI apps" to launch whichever handler you already installed; only UPI apps will be shown on this device.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenUpiApp(combinedAmountDue)}
                    className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Open UPI apps
                  </button>
                </>
              )}
              {isIos && (
                <>
                  <p className="mt-1 text-xs text-center text-slate-500">
                    Share the QR with an iOS UPI-compatible app for faster checkout.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSharePaymentQr(combinedAmountDue)}
                    className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Share QR with UPI app
                  </button>
                </>
              )}
              {!isAndroid && !isIos && (
                  <p className="mt-1 text-xs text-center text-slate-500">
                    This option requires a mobile browser; scan the QR from your phone's banking or UPI app.
                  </p>
              )}
              {shareError && (
                <p className="mt-2 text-xs text-rose-600">{shareError}</p>
              )}
            </div>
            <RevealableAccountSection className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Holder</p>
                <p className="text-lg font-semibold text-slate-900">ALAMELU V</p>
                <p className="text-lg font-semibold text-slate-900">SRIRAM RAJU</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Number</p>
                <p className="text-lg font-semibold text-slate-900">007701028012</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">IFSC Code</p>
                <p className="text-lg font-semibold text-slate-900">ICIC0000077</p>
              </div>
            </RevealableAccountSection>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-[1.6fr,1fr,1fr]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Transaction ID or UPI ID
              <input
                id="club-transaction-reference"
                type="text"
                value={transactionReference}
                onChange={(event) => {
                  setTransactionReference(event.target.value);
                  if (transactionReferenceError) {
                    setTransactionReferenceError(null);
                  }
                  if (submissionError) {
                    setSubmissionError(null);
                  }
                }}
                placeholder="Enter the transaction reference or UPI ID used"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
              {transactionReferenceError && (
                <p className="mt-2 text-sm text-rose-600">{transactionReferenceError}</p>
              )}
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount Paid
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(event) => {
                  setAmountPaid(event.target.value);
                  if (submissionError) {
                    setSubmissionError(null);
                  }
                }}
                placeholder="0.00"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment Date
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => {
                  setPaymentDate(event.target.value);
                  if (submissionError) {
                    setSubmissionError(null);
                  }
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last payment amount</p>
              <p className="text-lg font-semibold text-slate-900">{lastCombineAmountLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last payment date</p>
              <p className="text-lg font-semibold text-slate-900">{lastCombineDateLabel}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            After the transfer, inform the temple office with your cart details for faster reconciliation.
          </p>
        </div>
      )}
    </div>
  );

  if (canCombine === false) {
    return <Navigate to="/dashboard" replace />;
  }

  if (canCombine === null) {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">Verifying combine payment access…</p>
        {combineError && (
          <>
            <p className="text-sm text-rose-600">{combineError}</p>
            <button
              type="button"
              onClick={fetchCombineAccess}
              disabled={combineLoading}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {combineLoading ? 'Retrying…' : 'Retry'}
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Combine Payment</h1>
            <p className="text-sm text-slate-600">
              Review your pooja selections and complete a consolidated transfer for yourself and select donors.
            </p>
          </div>
        </div>
        <div className="mt-6">{renderCurrentView()}</div>
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
