import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';

import api from '../../lib/api';
import { useCartStore } from '../../store/cart';
import { usePaymentStore } from '../../store/payments';
import { useAuthStore } from '../../store/auth';
import { useCurrentBalance } from '../../hooks/useCurrentBalance';
import { launchUpiLink } from '../../utils/upiLink';
import { shareImageFile } from '../../utils/shareImageFile';
import { PAYMENT_QR_IMAGE_URL } from '../../constants/paymentQr';
import { POOJA_DATA_UPDATED_EVENT } from '../../constants/events';
import type { CartItem } from '../../store/cart';
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

const formatDisplayDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const DAY_CATEGORY_LABELS: Record<string, string> = {
  weekday: '',
  tamil_star: '',
  code: 'Template Code',
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

type RegistrationMemberPayload = {
  name: string;
  relationship?: string;
  phone_number?: string;
  tamil_star?: string;
  rasi?: string;
  gothra?: string;
  family_name?: string;
  date_of_birth?: string;
};

const buildRegistrationMembers = (members?: CartItem['members']) => {
  if (!Array.isArray(members) || members.length === 0) {
    return [];
  }
  return members.map((member) => {
    const payload: RegistrationMemberPayload = {
      name: member?.name?.trim() || 'Member',
    };
    const relationship = member?.relationship?.trim();
    if (relationship) {
      payload.relationship = relationship;
    }
    const phone = member?.donorPhone?.trim();
    if (phone) {
      payload.phone_number = phone;
    }
    const tamilStar = member?.tamilStar?.trim();
    if (tamilStar) {
      payload.tamil_star = tamilStar;
    }
    const rasi = member?.rasi?.trim();
    if (rasi) {
      payload.rasi = rasi;
    }
    const gothra = member?.gothra?.trim();
    if (gothra) {
      payload.gothra = gothra;
    }
    const familyName = member?.familyName?.trim();
    if (familyName) {
      payload.family_name = familyName;
    }
    if (member?.dob) {
      payload.date_of_birth = member.dob;
    }
    return payload;
  });
};

const sanitizeCartItemForPlan = (item: CartItem) => {
  const { cartId, ...rest } = item;
  return rest;
};

interface RegistrationPayload {
  additional_notes?: string;
  [key: string]: unknown;
}

const buildRegistrationPayload = (item: CartItem): RegistrationPayload => {
  const members = buildRegistrationMembers(item.members);
  if (members.length === 0) {
    const fallbackName = item.fullName?.trim() || 'Member';
    const fallback: RegistrationMemberPayload = {
      name: fallbackName,
    };
    if (item.memberRelationship) {
      fallback.relationship = item.memberRelationship.trim();
    }
    if (item.memberTamilStar) {
      fallback.tamil_star = item.memberTamilStar.trim();
    }
    if (item.memberRasi) {
      fallback.rasi = item.memberRasi.trim();
    }
    if (item.memberGothra) {
      fallback.gothra = item.memberGothra.trim();
    }
    if (item.memberFamilyName) {
      fallback.family_name = item.memberFamilyName.trim();
    }
    if (item.memberDob) {
      fallback.date_of_birth = item.memberDob;
    }
    members.push(fallback);
  }

  const quantity = Math.max(members.length, 1);
  const numericAmount = Number(item.amount);
  const payload: Record<string, unknown> = {
    pooja_option: item.poojaId,
    day_option: item.dayOptionId ?? undefined,
    start_date: item.bookingDate,
    quantity,
    is_group_registration: quantity > 1,
    post_prasadam: Boolean(item.postPrasadam),
    additional_notes: item.customDayNote?.trim() ?? '',
    members,
    cart_item: sanitizeCartItemForPlan(item),
  };

  if (Number.isFinite(numericAmount)) {
    payload.total_amount = numericAmount;
  }
  if (item.recurrenceKind) {
    payload.recurrence_kind = item.recurrenceKind;
  }
  if (item.recurrenceFrequency) {
    payload.recurrence_frequency = item.recurrenceFrequency;
  }
  if (item.recurrenceOneTimeDate) {
    payload.recurrence_one_time_date = item.recurrenceOneTimeDate;
  }

  return payload;
};

const recordRegistrations = async (
  items: CartItem[],
  transactionReference: string,
  amountPaid?: number,
  paymentDate?: string,
) => {
  for (const item of items) {
    const payload = buildRegistrationPayload(item);
    const response = await api.post('pooja/registrations/', payload);
    const registrationId = response.data?.id;
    const amountNote =
      typeof amountPaid === 'number' && Number.isFinite(amountPaid)
        ? `Amount Paid: ₹ ${formatCurrency(amountPaid)}`
        : null;
    const noteParts: string[] = [];
    if (payload.additional_notes) {
      noteParts.push(payload.additional_notes);
    }
    if (amountNote) {
      noteParts.push(amountNote);
    }
    await api.post('payments/records/', {
      registration: typeof registrationId === 'number' ? registrationId : undefined,
      amount: Number(item.amount) || 0,
      mode: 'upi',
      status: 'success',
      transaction_reference: transactionReference,
      payment_month: paymentDate || undefined,
      notes: noteParts.join(' • '),
    });
  }
};

const emitPoojaDataUpdatedEvent = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  const event = new CustomEvent(POOJA_DATA_UPDATED_EVENT);
  window.dispatchEvent(event);
};

const buildRegistrationErrorMessage = (error: unknown) => {
  if (!error) {
    return 'Unable to register the poojas right now.';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as { response?: { data?: any }; message?: string };
    if (typeof err.response?.data?.detail === 'string' && err.response.data.detail) {
      return err.response.data.detail;
    }
    if (typeof err.message === 'string' && err.message) {
      return err.message;
    }
  }
  return 'Unable to register the poojas right now.';
};

const PaymentPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const navigate = useNavigate();

  const setItemsForUser = useCartStore((state) => state.setItemsForUser);
  const removeCartItem = useCartStore((state) => state.removeItem);
  const clearCartItems = useCartStore((state) => state.clear);
  const paymentSnapshot = usePaymentStore((state) => state.lastGeneralPaymentByUser[cartKey] ?? null);
  const clearPaymentSnapshot = usePaymentStore((state) => state.clearGeneralPayment);
  const generalPaymentHistory = usePaymentStore((state) => state.generalPaymentHistory);
  const addGeneralPaymentHistory = usePaymentStore((state) => state.addGeneralPaymentHistory);
  const setGeneralPayment = usePaymentStore((state) => state.setGeneralPayment);

  const userHistory = useMemo(
    () => generalPaymentHistory.filter((entry) => entry.userKey === cartKey),
    [generalPaymentHistory, cartKey],
  );

  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [transactionReferenceError, setTransactionReferenceError] = useState<string | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [amountPaidError, setAmountPaidError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDateError, setPaymentDateError] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shareError, setShareError] = useState<string | null>(null);
  const [petalSeed, setPetalSeed] = useState(0);
  const { balance: currentBalance, loading: balanceLoading, error: balanceError, refresh: refreshBalance } =
    useCurrentBalance();
  const lastPaymentEntry = useMemo(
    () => (userHistory.length > 0 ? userHistory[0] : null),
    [userHistory],
  );

  const netPaymentAmount = Math.max(0, (paymentSnapshot?.totalAmount ?? 0) - (currentBalance ?? 0));
  const lastPaymentAmountLabel = lastPaymentEntry
    ? `₹ ${formatCurrency(lastPaymentEntry.totalAmount)}`
    : '—';
  const lastPaymentDateLabel = lastPaymentEntry?.completedAt
    ? formatDate(lastPaymentEntry.completedAt)
    : '—';
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

  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (!paymentSnapshot) {
      setShowPaymentDetails(false);
    }
  }, [paymentSnapshot]);

  useEffect(() => {
    if (!paymentSnapshot) {
      setRegistrationError(null);
      setTransactionReference('');
      setAmountPaid('');
      setAmountPaidError(null);
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentDateError(null);
    }
  }, [paymentSnapshot]);

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
        setShareError('Sharing is unavailable on this device; please use your bank/UPI app to scan the QR displayed above.');
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
        setShareError('Sharing is unavailable on this device; please use your bank/UPI app to scan the QR displayed above.');
      }
    },
    [isIos],
  );

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  const scrollToCartSection = () => {
    const element = document.getElementById('payment-cart-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleClearSummary = () => {
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    setShowCelebration(false);
    setShowPaymentDetails(false);
    clearCartItems(cartKey);
    clearPaymentSnapshot(cartKey);
  };

  const triggerPaymentDetails = () => {
    const defaultAmount = netPaymentAmount > 0 ? netPaymentAmount.toFixed(2) : '0.00';
    setAmountPaid(defaultAmount);
    setAmountPaidError(null);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentDateError(null);
    setShowPaymentDetails(true);
  };

  const restoreCartFromSnapshot = () => {
    if (!paymentSnapshot) {
      return;
    }
    setItemsForUser(cartKey, paymentSnapshot.items);
    setShowPaymentDetails(false);
    scrollToCartSection();
  };

  const handlePaymentCompleted = async () => {
    if (!paymentSnapshot || registrationInProgress) return;
    const trimmedReference = transactionReference.trim();
    if (!trimmedReference) {
      setTransactionReferenceError('Transaction ID or UPI ID is required.');
      return;
    }
    const trimmedAmount = amountPaid.trim();
    if (!trimmedAmount) {
      setAmountPaidError('Amount Paid is required.');
      return;
    }
    const parsedAmount = Number(trimmedAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountPaidError('Enter a valid amount paid.');
      return;
    }
    const trimmedDate = paymentDate.trim();
    if (!trimmedDate) {
      setPaymentDateError('Payment date is required.');
      return;
    }
    const parsedDate = new Date(trimmedDate);
    if (Number.isNaN(parsedDate.getTime())) {
      setPaymentDateError('Enter a valid payment date.');
      return;
    }

    setAmountPaidError(null);
    setTransactionReferenceError(null);
    setRegistrationError(null);
    setRegistrationInProgress(true);
    try {
      await recordRegistrations(paymentSnapshot.items, trimmedReference, parsedAmount, trimmedDate);
      emitPoojaDataUpdatedEvent();
    } catch (error) {
      setRegistrationError(buildRegistrationErrorMessage(error));
      return;
    } finally {
      setRegistrationInProgress(false);
    }

    addGeneralPaymentHistory(paymentSnapshot);
    if (typeof currentBalance === 'number' && paymentSnapshot.totalAmount > 0) {
      const updatedBalance = Math.max(0, currentBalance - paymentSnapshot.totalAmount);
      try {
        await api.put('auth/profile/', { custom_number: updatedBalance });
        refreshBalance();
      } catch (balanceError) {
        console.error('Unable to refresh current balance after payment', balanceError);
        setRegistrationError('Payment recorded but unable to refresh current balance. Please reload.');
      }
    }
    setPetalSeed((seed) => seed + 1);
    setShowCelebration(true);
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
    }
    celebrationTimeoutRef.current = setTimeout(() => {
      handleClearSummary();
      navigate('/profile');
    }, 1800);
  };

  const handleRemoveFromSummary = useCallback(
    (cartId: string) => {
      if (!paymentSnapshot) {
        return;
      }
      removeCartItem(cartKey, cartId);
      const remainingItems = paymentSnapshot.items.filter((item) => item.cartId !== cartId);
      if (remainingItems.length === 0) {
        clearPaymentSnapshot(cartKey);
        return;
      }
      const nextTotal = remainingItems.reduce((sum, item) => sum + parseAmount(item.amount), 0);
      setGeneralPayment({
        userKey: cartKey,
        items: remainingItems,
        totalAmount: nextTotal,
      });
    },
    [cartKey, clearPaymentSnapshot, paymentSnapshot, removeCartItem, setGeneralPayment],
  );

  const renderSummaryContent = () => {
    if (!paymentSnapshot) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-600">
            There are no saved payment details yet. Add poojas to your cart, click Save, and you will be redirected
            here with the payment summary.
          </p>
          <Link
            to="/pooja/register"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
          >
            Go to Pooja Registration page
          </Link>
        </div>
      );
    }

    const { items: snapshotItems, totalAmount: snapshotTotal } = paymentSnapshot;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="font-medium">
            <p>
              {snapshotItems.length} {snapshotItems.length === 1 ? 'pooja' : 'poojas'} saved
            </p>
            <p className="text-xs text-slate-500">Review and confirm before recording payment</p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-right text-base font-semibold text-orange-600 shadow-sm">
            ₹ {formatCurrency(snapshotTotal)}
          </div>
        </div>

        <div className="space-y-3">
          {snapshotItems.map((item) => {
            const amountLabel = item.amount ? `₹ ${formatCurrency(item.amount)}` : '₹ 0.00';
            const membersLabel = buildMembersLabel(item.members);
            const quantity = item.members?.length && item.members.length > 0 ? item.members.length : 1;
            const memberSummary = membersLabel ?? `${quantity} devotee${quantity === 1 ? '' : 's'}`;
            const selectedDate = formatDate(item.customDayDate || item.bookingDate);
            const notes = item.customDayNote?.trim();

            return (
              <div
                key={`${paymentSnapshot.id}-${item.cartId}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                    {item.poojaCode ?? 'Pooja'}
                  </p>
                  <p className="text-base font-semibold text-slate-900">{item.poojaName}</p>
                  <p className="text-xs text-slate-500">Date: {selectedDate}</p>
                  <p className="text-xs text-slate-500">Members: {memberSummary}</p>
                  {notes && <p className="text-xs text-slate-500">Notes: {notes}</p>}
                </div>

                <div className="text-right">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Amount</p>
                  <p className="text-lg font-semibold text-orange-600">{amountLabel}</p>
                  <p className="text-[0.65rem] text-slate-500">Qty {quantity}</p>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromSummary(item.cartId)}
                    className="mt-2 text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {showPaymentDetails && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Balance</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {balanceLoading
                      ? 'Loading…'
                      : currentBalance !== null
                        ? `₹ ${formatCurrency(currentBalance)}`
                        : 'Not set'}
                  </p>
                  {balanceError && <p className="mt-1 text-xs text-rose-600">{balanceError}</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Payment Amount</p>
                  <p className="text-xl font-semibold text-slate-900">{lastPaymentAmountLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Payment Date</p>
                  <p className="text-xl font-semibold text-slate-900">{lastPaymentDateLabel}</p>
                </div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Complete Your Payment</h3>
            <p className="text-sm text-slate-600">Scan the QR code or use the account details to transfer the total amount.</p>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
                <img
                  src={PAYMENT_QR_IMAGE_URL}
                  alt="Temple payment QR code"
                  className="h-72 w-72 rounded-lg border border-slate-200 bg-white p-3 object-contain"
                />
                <p className="mt-3 text-sm font-medium text-slate-700">Scan & pay ₹ {formatCurrency(netPaymentAmount)}</p>
                {isAndroid && (
                  <>
                    <p className="mt-1 text-xs text-center text-slate-500">
                      Tap "Open UPI apps" to launch whichever handler you already installed; only UPI apps will be shown.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenUpiApp(netPaymentAmount)}
                      className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Open UPI apps
                    </button>
                  </>
                )}
                {isIos && (
                  <>
                    <p className="mt-1 text-xs text-center text-slate-500">
                      Tap "Open UPI apps" to launch whichever handler you already installed; only UPI apps will be shown.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSharePaymentQr(netPaymentAmount)}
                      className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Share QR with UPI app
                    </button>
                  </>
                )}
                {!isAndroid && !isIos && (
                  <p className="mt-1 text-xs text-center text-slate-500">
                    This option requires a mobile browser; scan the QR from your phone’s banking/UPI app if you’re on a desktop.
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
                {/*<div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</p>
                  <p className="text-lg font-semibold text-slate-900">Mylapore, Chennai</p>
                </div>*/}
              </RevealableAccountSection>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="transaction-reference">
                  Transaction ID or UPI ID
                </label>
                <input
                  id="transaction-reference"
                  type="text"
                  value={transactionReference}
                  onChange={(event) => {
                    setTransactionReference(event.target.value);
                    if (transactionReferenceError) {
                      setTransactionReferenceError(null);
                    }
                  }}
                  placeholder="Enter the transaction reference or UPI ID used"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
                {transactionReferenceError && (
                  <p className="mt-2 text-sm text-rose-600">{transactionReferenceError}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="amount-paid">
                  Amount Paid
                </label>
                <input
                  id="amount-paid"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={(event) => {
                    setAmountPaid(event.target.value);
                    if (amountPaidError) {
                      setAmountPaidError(null);
                    }
                  }}
                  placeholder="Enter the amount paid"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
                {amountPaidError && (
                  <p className="mt-2 text-sm text-rose-600">{amountPaidError}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="payment-date">
                  Payment Date
                </label>
                <input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => {
                    setPaymentDate(event.target.value);
                    if (paymentDateError) {
                      setPaymentDateError(null);
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
                {paymentDateError && (
                  <p className="mt-2 text-sm text-rose-600">{paymentDateError}</p>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last payment amount</p>
                <p className="text-lg font-semibold text-slate-900">{lastPaymentAmountLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last payment date</p>
                <p className="text-lg font-semibold text-slate-900">{lastPaymentDateLabel}</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            <p>
              Click Payment to reveal the bank transfer details. Once the transfer is complete, click Payment Completed
              to clear the record.
            </p>
          </div>
          {!showPaymentDetails ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={triggerPaymentDetails}
                className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
              >
                Payment
              </button>
              <button
                type="button"
                onClick={handleClearSummary}
                className="inline-flex items-center justify-center rounded-full border border-transparent bg-slate-800 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
              >
                Clear Summary
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={handlePaymentCompleted}
                disabled={registrationInProgress}
                className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
              >
                {registrationInProgress ? 'Saving...' : 'Payment Completed'}
              </button>
              {registrationError && (
                <p className="mt-2 text-sm text-rose-600">{registrationError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const summarySection = (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Payment Page</h2>
          <p className="text-sm text-slate-600">
            Review the pooja registrations you saved from the cart to log a single consolidated payment.
          </p>
        </div>
      </div>
      <div>{renderSummaryContent()}</div>
    </div>
  );

  return (
    <div className="space-y-6">
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
              Payment completed! Thank you.
            </div>
          </div>
        </div>
      )}
      <section id="payment-cart-section" className="rounded-lg bg-white p-6 shadow-sm space-y-8">
        <div className="divide-y divide-slate-100">
          {summarySection}
        </div>
      </section>
    </div>
  );
};

export default PaymentPage;
