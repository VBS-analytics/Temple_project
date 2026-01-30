/**
 * ============================================================================
 * PAYMENT PAGE MODULE
 * ============================================================================
 * 
 * Purpose:
 *   Handles payment processing, cart management, and payment initiation for donors.
 *   Displays poojas in cart, payment history, and provides multiple payment methods.
 * 
 * Key Features:
 *   - Cart Management: Display and manage poojas added to cart
 *   - Payment Methods: UPI links, manual transfer via bank account
 *   - Current Balance: Display donor's account balance
 *   - Payment History: Show last payment amount and date
 *   - Payment Recording: Submit payment details (reference, date, amount)
 *   - QR Code Sharing: Share payment QR code via various channels
 * 
 * Payment Flow:
 *   1. Load cart items for current user
 *   2. Calculate total amount from cart
 *   3. Fetch payment history and current balance
 *   4. Display payment details and bank account
 *   5. User initiates payment (UPI or manual)
 *   6. Record payment details in backend
 *   7. Clear cart and show confirmation
 * 
 * Main Components:
 *   - Cart Summary: Show poojas with amounts and dates
 *   - Payment Methods: UPI link generation and manual transfer details
 *   - Bank Account Section: Reveal sensitive account details
 *   - Payment History: Last payment information
 * 
 * Payment Methods:
 *   - UPI: Generate UPI link for instant payment
 *   - Manual Transfer: Show bank account details for manual transfer
 *   - QR Code: Share QR code for mobile scanning
 * 
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import api, { extractResults } from '../../lib/api';
import { useCartStore } from '../../store/cart';
import { usePaymentStore } from '../../store/payments';
import { useAuthStore } from '../../store/auth';
import { useCurrentBalance } from '../../hooks/useCurrentBalance';
import { useCombineAccessStore } from '../../store/combineAccess';
import { launchUpiLink } from '../../utils/upiLink';
import { shareImageFile } from '../../utils/shareImageFile';
import { PAYMENT_QR_IMAGE_URL } from '../../constants/paymentQr';
import type { CartItem } from '../../store/cart';
import { buildRegistrationPayload, emitPoojaDataUpdatedEvent } from '../../lib/registrationPayload';
import { POOJA_DATA_UPDATED_EVENT } from '../../constants/events';

// Helper functions
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

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface PassbookSummaryEntry {
  id: number | string;
  entry_date?: string | null;
  due_amount?: string | number | null;
  paid_amount?: string | number | null;
  closing_due?: string | number | null;
}

const parsePassbookAmount = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const allocatePaymentAmounts = (items: CartItem[], totalAmount: number) => {
  const toPaise = (value: number) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.round(value * 100));
  };
  let remainingPaise = Math.max(0, toPaise(totalAmount));
  const allocations = items.map((item) => {
    if (remainingPaise <= 0) {
      return 0;
    }
    const itemPaise = toPaise(parseAmount(item.amount));
    const allocationPaise = Math.min(itemPaise, remainingPaise);
    remainingPaise = Math.max(remainingPaise - allocationPaise, 0);
    return allocationPaise / 100;
  });
  return allocations;
};

const recordRegistrations = async (
  items: CartItem[],
  transactionReference: string,
  amountPaid?: number,
  paymentDate?: string,
  createdAtOverride?: string,
) => {
  const totalCartAmount = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
  const totalPaymentAmount =
    typeof amountPaid === 'number' && Number.isFinite(amountPaid) ? amountPaid : totalCartAmount;
  const safePaymentAmount = Math.min(totalPaymentAmount, totalCartAmount);
  const paymentAllocations = allocatePaymentAmounts(items, safePaymentAmount);
  const registrationIds: (number | undefined)[] = [];
  
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const payload = buildRegistrationPayload(item, paymentDate, createdAtOverride);
    const response = await api.post('pooja/registrations/', payload);
    const registrationId = response.data?.id;
    registrationIds.push(typeof registrationId === 'number' ? registrationId : undefined);
  }
  
  for (let index = 0; index < items.length; index += 1) {
    const registrationId = registrationIds[index];
    const paymentAmount = paymentAllocations[index] ?? 0;
    if (paymentAmount <= 0) {
      continue;
    }
    const item = items[index];
    const amountNote =
      typeof amountPaid === 'number' && Number.isFinite(amountPaid)
        ? `Amount Paid: ₹ ${formatCurrency(amountPaid)}`
        : null;
    const noteParts: string[] = [];
    if (item.customDayNote?.trim()) {
      noteParts.push(item.customDayNote.trim());
    }
    if (amountNote) {
      noteParts.push(amountNote);
    }
    const paymentPayload = {
      registration: registrationId,
      amount: paymentAmount,
      mode: 'upi',
      status: 'success',
      transaction_reference: transactionReference,
      payment_month: paymentDate || undefined,
      notes: noteParts.length > 0 ? noteParts.join(' • ') : undefined,
    };
    await api.post('payments/records/', paymentPayload);
  }
};

interface PassbookDueEntry {
  id: number | string;
  transaction_details?: string | null;
  due_amount?: string | number | null;
  entry_date?: string | null;
  created_at?: string | null;
  payment_month?: string | null;
  pooja_option?: string | null;
  notes?: string | null;
  due_amount_name?: string | null;
  entry_type?: string | null;
}

const buildRegistrationErrorMessage = (error: unknown) => {
  if (!error) {
    return 'Unable to register poojas right now.';
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
  return 'Unable to register poojas right now.';
};

const isCHRTInScheduledMonth = (item: CartItem): boolean => {
  if (item.dayOptionCode?.trim().toUpperCase() !== 'CHRT') {
    return true;
  }
  
  if (!item.bookingDate) {
    return false;
  }
  
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const bookingDate = new Date(item.bookingDate);
    const bookingMonth = bookingDate.getMonth();
    const bookingYear = bookingDate.getFullYear();
    
    return currentMonth === bookingMonth && currentYear === bookingYear;
  } catch (error) {
    console.error('Error checking CHRT month validity:', error);
    return true;
  }
};

const formatCombineMonthLabel = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4}-\d{2})/);
  if (!match) {
    return null;
  }
  const [year, month] = match[1].split('-');
  const parsed = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};

const PaymentPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const navigate = useNavigate();
  const clearCartItems = useCartStore((state) => state.clear);
  const paymentSnapshot = usePaymentStore((state) => state.lastGeneralPaymentByUser[cartKey] ?? null);
  const clearPaymentSnapshot = usePaymentStore((state) => state.clearGeneralPayment);
  const generalPaymentHistory = usePaymentStore((state) => state.generalPaymentHistory);
  const addGeneralPaymentHistory = usePaymentStore((state) => state.addGeneralPaymentHistory);
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [transactionReferenceError, setTransactionReferenceError] = useState<string | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [amountPaidError, setAmountPaidError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDateError, setPaymentDateError] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState('');
  
  const [dueRecords, setDueRecords] = useState<PassbookDueEntry[]>([]);
  const [dueLoading, setDueLoading] = useState(false);
  const [dueError, setDueError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [petalSeed, setPetalSeed] = useState(0);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [latestPassbookEntry, setLatestPassbookEntry] = useState<PassbookSummaryEntry | null>(null);
  const [latestPaidPassbookEntry, setLatestPaidPassbookEntry] = useState<PassbookSummaryEntry | null>(null);
  const [passbookSummaryLoading, setPassbookSummaryLoading] = useState(false);
  
  const {
    balance: currentBalance,
    openingBalance,
    currentMonthDue,
    currentMonthPayments,
    monthlyDonation,
    loading: balanceLoading,
    error: balanceError,
    refresh: refreshBalance,
  } = useCurrentBalance();
  
  const combineRole = useCombineAccessStore((state) => state.role);
  const canCombine = useCombineAccessStore((state) => state.canCombine);
  const combinedTo = useCombineAccessStore((state) => state.combinedTo);
  const combineLoading = useCombineAccessStore((state) => state.loading);
  const combineError = useCombineAccessStore((state) => state.error);
  const fetchCombineAccess = useCombineAccessStore((state) => state.fetchAccess);
  
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPassbookMountedRef = useRef(true);
  const latestPaidPassbookMountedRef = useRef(true);
  
  const loadDueRecords = useCallback(async () => {
    setDueLoading(true);
    setDueError(null);
    try {
      const response = await api.get('payments/passbook-entries/', {
        params: {
          entry_type: 'due',
          ordering: '-entry_date',
        },
      });
      const payload = extractResults<PassbookDueEntry>(response.data);
      setDueRecords(payload);
    } catch (error) {
      console.error('Unable to load pending dues', error);
      setDueError('Unable to load pending dues right now.');
      setDueRecords([]);
    } finally {
      setDueLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadDueRecords();
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleEvent = () => {
      loadDueRecords();
    };
    window.addEventListener(POOJA_DATA_UPDATED_EVENT, handleEvent);
    return () => {
      window.removeEventListener(POOJA_DATA_UPDATED_EVENT, handleEvent);
    };
  }, [loadDueRecords]);
  
  const loadLatestPassbookEntry = useCallback(async () => {
    setPassbookSummaryLoading(true);
    try {
      const response = await api.get('payments/passbook-entries/', {
        params: {
          page_size: 1,
          ordering: '-entry_date',
        },
      });
      if (!latestPassbookMountedRef.current) {
        return;
      }
      const payload = extractResults<PassbookSummaryEntry>(response.data);
      setLatestPassbookEntry(payload.length > 0 ? payload[0] : null);
    } catch (error) {
      console.error('Unable to load latest passbook entry', error);
      if (latestPassbookMountedRef.current) {
        setLatestPassbookEntry(null);
      }
    } finally {
      if (latestPassbookMountedRef.current) {
        setPassbookSummaryLoading(false);
      }
    }
  }, []);
  
  const loadLatestPaidPassbookEntry = useCallback(async () => {
    setPassbookSummaryLoading(true);
    try {
      const response = await api.get('payments/passbook-entries/', {
        params: {
          page_size: 1,
          ordering: '-entry_date',
          entry_type: 'paid',
        },
      });
      if (!latestPaidPassbookMountedRef.current) {
        return;
      }
      const payload = extractResults<PassbookSummaryEntry>(response.data);
      setLatestPaidPassbookEntry(payload.length > 0 ? payload[0] : null);
    } catch (error) {
      console.error('Unable to load latest paid passbook entry', error);
      if (latestPaidPassbookMountedRef.current) {
        setLatestPaidPassbookEntry(null);
      }
    } finally {
      if (latestPaidPassbookMountedRef.current) {
        setPassbookSummaryLoading(false);
      }
    }
  }, []);
  
  useEffect(() => {
    latestPassbookMountedRef.current = true;
    loadLatestPassbookEntry();
    return () => {
      latestPassbookMountedRef.current = false;
    };
  }, [loadLatestPassbookEntry]);
  
  useEffect(() => {
    latestPaidPassbookMountedRef.current = true;
    loadLatestPaidPassbookEntry();
    return () => {
      latestPaidPassbookMountedRef.current = false;
    };
  }, [loadLatestPaidPassbookEntry]);
  
  const validCartItems = useMemo(() => {
    if (!paymentSnapshot) {
      return [];
    }
    return paymentSnapshot.items.filter(isCHRTInScheduledMonth);
  }, [paymentSnapshot]);
  
  const filteredCartTotalAmount = useMemo(() => {
    return validCartItems.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  }, [validCartItems]);
  
  const cartTotalAmount = filteredCartTotalAmount;
  const dueTotalAmount = useMemo(
    () => dueRecords.reduce((total, record) => total + parseAmount(record.due_amount), 0),
    [dueRecords],
  );
  
  const computedDueAmount = paymentSnapshot ? cartTotalAmount : dueTotalAmount;
  const initialBalance = currentBalance ?? openingBalance;
  const runningBalance = initialBalance ?? 0;
  const effectiveCartAmount = paymentSnapshot ? cartTotalAmount : dueTotalAmount;
  const needToPayForPooja = Math.max(0, runningBalance + effectiveCartAmount);
  const netPaymentAmount = needToPayForPooja;
  
  const lastPaymentEntry = useMemo(
    () => {
      const history = generalPaymentHistory.filter((entry) => entry.userKey === cartKey);
      return history.length > 0 ? history[0] : null;
    },
    [generalPaymentHistory, cartKey],
  );
  
  const lastPaymentAmountLabel = lastPaymentEntry
    ? `₹ ${formatCurrency(lastPaymentEntry.amountPaid ?? lastPaymentEntry.amount ?? lastPaymentEntry.totalAmount)}`
    : '—';
  const lastPaymentDateLabel = lastPaymentEntry
    ? formatDate(
        lastPaymentEntry.paymentDate ??
          lastPaymentEntry.created_at ??
          lastPaymentEntry.completedAt ??
          lastPaymentEntry.createdAt,
      )
    : '—';
  
  const passbookDueValue = parsePassbookAmount(latestPassbookEntry?.due_amount);
  const passbookClosingValue = parsePassbookAmount(latestPassbookEntry?.closing_due);
  const paidPassbookEntry = latestPaidPassbookEntry ?? latestPassbookEntry;
  const paidPassbookDueValue = parsePassbookAmount(paidPassbookEntry?.due_amount);
  const paidPassbookPaidValue = parsePassbookAmount(paidPassbookEntry?.paid_amount);
  const paidPassbookDateLabel = paidPassbookEntry?.entry_date
    ? formatDate(paidPassbookEntry.entry_date)
    : null;
  
  const paymentPageCurrentDueLabel = (() => {
    if (paymentSnapshot) {
      return `₹ ${formatCurrency(cartTotalAmount)}`;
    }
    const sourceValue =
      paidPassbookDueValue != null ? paidPassbookDueValue : passbookDueValue != null ? passbookDueValue : computedDueAmount;
    if (sourceValue != null) {
      return `₹ ${formatCurrency(sourceValue)}`;
    }
    return '—';
  })();
  
  const paymentPageLastPaymentLabel =
    paidPassbookPaidValue != null ? `₹ ${formatCurrency(paidPassbookPaidValue)}` : lastPaymentAmountLabel;
  const paymentPageDateLabel = paidPassbookDateLabel ?? lastPaymentDateLabel;
  
  const paymentPageClosingDueLabel = (() => {
    if (paymentSnapshot) {
      return `₹ ${formatCurrency(computedDueAmount)}`;
    }
    if (passbookClosingValue != null) {
      return `₹ ${formatCurrency(passbookClosingValue)}`;
    }
    return '—';
  })();
  
  const parentName = combinedTo?.name ?? 'Parent donor';
  const effectiveFromLabel = formatCombineMonthLabel(combinedTo?.effectiveFrom);
  const uncombineFromLabel = formatCombineMonthLabel(combinedTo?.effectiveTo);
  
  const isAndroid = useMemo(
    () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent),
    [],
  );
  const isIos = useMemo(
    () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent),
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
    if (combineRole === null && !combineLoading && !combineError) {
      fetchCombineAccess();
    }
  }, [combineRole, combineLoading, combineError, fetchCombineAccess]);
  
  useEffect(() => {
    if (!paymentSnapshot) {
      setRegistrationError(null);
      setTransactionReference('');
      setAmountPaid('');
      setAmountPaidError(null);
      setPaymentDate('');
      setPaymentDateError(null);
    }
  }, [paymentSnapshot]);
  
  useEffect(() => {
    let isMounted = true;
    
    const loadPaymentRecords = async () => {
      try {
        const response = await api.get('payments/records/', {
          params: { page_size: 10, ordering: '-created_at' },
        });
        
        if (!isMounted) return;
        
        const records = Array.isArray(response.data) 
          ? response.data 
          : response.data?.results || [];
        
        records.forEach((record: any) => {
          if (record.amount && record.created_at) {
            addGeneralPaymentHistory(
              {
                id: `backend-${record.id}`,
                createdAt: record.created_at,
                totalAmount: Number(record.amount) || 0,
                items: [],
                userKey: cartKey,
              },
              record.payment_month || record.created_at,
              Number(record.amount) || 0
            );
          }
        });
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load payment records for last payment display', error);
      }
    };
    
    loadPaymentRecords();
    
    return () => {
      isMounted = false;
    };
  }, [cartKey, addGeneralPaymentHistory]);
  
  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);
  
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
        setShareError('Sharing is unavailable on this device.');
        return;
      }
      setShareError(null);
      try {
        const shareText = amount
          ? `Pay ₹ ${formatCurrency(amount)} using this QR.`
          : 'Pay via temple QR.';
        await shareImageFile({
          url: PAYMENT_QR_IMAGE_URL,
          filename: 'temple-payment-qr-code.jpg',
          title: 'Temple payment QR',
          text: shareText,
        });
      } catch (error) {
        console.error('Failed to share payment QR', error);
        setShareError('Sharing is unavailable on this device.');
      }
    },
    [isIos],
  );
  
  const handleCopyUpi = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('alamelu7@icici');
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch (err) {
      console.error('Failed to copy UPI ID', err);
    }
  }, []);
  
  const handlePaymentCompleted = async () => {
    if (registrationInProgress) return;
    
    // Validation
    const errors: string[] = [];
    
    const trimmedReference = transactionReference.trim();
    if (!trimmedReference) {
      setTransactionReferenceError('Transaction ID or UPI ID is required.');
      errors.push('reference');
    }
    
    const trimmedAmount = amountPaid.trim();
    if (!trimmedAmount) {
      setAmountPaidError('Amount Paid is required.');
      errors.push('amount');
    } else {
      const parsedAmount = Number(trimmedAmount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setAmountPaidError('Enter a valid amount paid.');
        errors.push('amount');
      }
    }
    
    const dateValue = paymentDate.trim();
    if (!dateValue) {
      setPaymentDateError('Payment date is required.');
      errors.push('date');
    } else {
      const parsedDate = new Date(dateValue);
      if (Number.isNaN(parsedDate.getTime())) {
        setPaymentDateError('Enter a valid payment date.');
        errors.push('date');
      }
    }
    
    if (errors.length > 0) {
      return;
    }
    
    // Clear all errors
    setAmountPaidError(null);
    setTransactionReferenceError(null);
    setPaymentDateError(null);
    setRegistrationError(null);
    
    const parsedAmount = Number(trimmedAmount);
    const isoDate = dateValue; // Already in ISO format from date picker
    
    setRegistrationInProgress(true);
    const isDuePayment = !paymentSnapshot;
    const dueNames = dueRecords
      .map((record) => record.pooja_option?.trim())
      .filter((name): name is string => !!name);
    
    try {
      if (isDuePayment) {
        await api.post('payments/records/', {
          amount: parsedAmount,
          currency: 'INR',
          mode: 'upi',
          status: 'success',
          transaction_reference: trimmedReference,
          payment_month: isoDate,
          notes: dueNames.length > 0 ? dueNames.join(' • ') : undefined,
        });
      } else {
        const registrationCreatedAt = paymentSnapshot?.createdAt;
        await recordRegistrations(
          paymentSnapshot.items,
          trimmedReference,
          parsedAmount,
          isoDate,
          registrationCreatedAt,
        );
      }
      emitPoojaDataUpdatedEvent();
      await loadDueRecords();
      await loadLatestPassbookEntry();
    } catch (error) {
      setRegistrationError(buildRegistrationErrorMessage(error));
      return;
    } finally {
      setRegistrationInProgress(false);
    }
    
    if (paymentSnapshot) {
      addGeneralPaymentHistory(paymentSnapshot, isoDate, parsedAmount);
    }
    
    try {
      await api.get('auth/profile/');
      refreshBalance();
    } catch (balanceError) {
      console.error('Unable to refresh opening balance after payment', balanceError);
      setRegistrationError('Payment recorded but unable to refresh opening balance. Please reload.');
    }
    
    setPetalSeed((seed) => seed + 1);
    setShowCelebration(true);
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
    }
    celebrationTimeoutRef.current = setTimeout(() => {
      clearCartItems(cartKey);
      clearPaymentSnapshot(cartKey);
      setShowCelebration(false);
      navigate('/profile');
    }, 1800);
  };
  
  // Combined Role Check
  if (combineRole === 'subordinate') {
    const effectiveRange = [
      effectiveFromLabel ? `Effective from ${effectiveFromLabel}` : null,
      uncombineFromLabel ? `Uncombine from ${uncombineFromLabel}` : null,
    ]
      .filter(Boolean)
      .join(' • ');
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <section className="space-y-4 rounded-2xl border border-orange-200 bg-white/80 p-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔗</div>
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold text-slate-800">Linked to Combined Account</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Your account is linked to a combined donor account managed by <span className="font-semibold">{parentName}</span>. All payments for your poojas are processed together through the main donor's account.
                  </p>
                  <p className="text-sm text-slate-600 mt-2">
                    Your pooja selections will be visible to the main donor in their combine payment view, where they can make a single consolidated payment for all linked members.
                  </p>
                  {effectiveRange && (
                    <p className="text-xs text-orange-600 mt-2 font-medium">{effectiveRange}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    If you need to unlink from this combined account, please contact the temple office.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }
  
  if (combineRole === 'main' && canCombine && !combineLoading) {
    return <Navigate to="/payments/combine" replace />;
  }
  
  // Helper to get first name
  const firstName = user?.name ? user.name.split(' ')[0] : 'Your';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20 p-4 sm:p-6 lg:p-8">
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
              ✨ Payment completed! Thank you.
            </div>
          </div>
        </div>
      )}
      
      {/* Error Notification */}
      {registrationError && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-lg bg-red-50 border-2 border-red-500 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 text-sm">Payment Error</h3>
              <p className="text-xs text-red-700 mt-1">{registrationError}</p>
            </div>
            <button 
              onClick={() => setRegistrationError(null)} 
              className="text-red-600 hover:text-red-800 text-xl leading-none"
              aria-label="Close error notification"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-orange-100 to-orange-200 p-3 rounded-2xl shadow-sm">
              <svg className="w-8 h-8 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Payment Page</h1>
              <p className="text-sm text-slate-600 mt-1">Manage your pooja payments securely and efficiently</p>
            </div>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white to-orange-50/30 border border-orange-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-orange-100 p-2 rounded-xl">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-orange-100 text-orange-700 border border-orange-200">
                Current
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{paymentPageCurrentDueLabel}</p>
            <p className="text-sm text-slate-600">Current Due</p>
          </div>
          
          <div className="bg-gradient-to-br from-white to-green-50/30 border border-green-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-green-100 p-2 rounded-xl">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-green-100 text-green-700 border border-green-200">
                Last
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{paymentPageLastPaymentLabel}</p>
            <p className="text-sm text-slate-600">Last Payment</p>
          </div>
          
          <div className="bg-gradient-to-br from-white to-blue-50/30 border border-blue-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-blue-100 p-2 rounded-xl">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 border border-blue-200">
                Date
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{paymentPageDateLabel}</p>
            <p className="text-sm text-slate-600">Payment Date</p>
          </div>
          
          <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-slate-100 p-2 rounded-xl">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                Closing
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{paymentPageClosingDueLabel}</p>
            <p className="text-sm text-slate-600">Closing Due</p>
          </div>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Payment Method */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl shadow-sm">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Payment Methods</h2>
                    <p className="text-xs text-slate-600">Choose UPI or Bank Transfer</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {/* UPI Section */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    UPI Payment
                  </h3>
                  <div className="flex flex-col items-center gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <img
                      src={PAYMENT_QR_IMAGE_URL}
                      alt="Payment QR Code"
                      className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2 object-contain shadow-sm"
                    />
                    
                    {/* UPI ID Section */}
                    <div className="w-full bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm hover:border-orange-300 transition">
                      <div className="flex flex-col">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">UPI ID</p>
                        <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">alamelu7@icici</p>
                      </div>
                      <button
                        onClick={handleCopyUpi}
                        title={copiedUpi ? "Copied!" : "Copy UPI ID"}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 transition active:scale-95"
                        aria-label="Copy UPI ID"
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
                    
                    <p className="text-center text-sm text-slate-600">Scan with any UPI app to pay instantly</p>
                    <div className="flex w-full gap-2">
                      {isAndroid && (
                        <button
                          onClick={() => handleOpenUpiApp(netPaymentAmount)}
                          className="flex-1 rounded-lg border-2 border-orange-600 bg-white px-3 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 transition"
                        >
                          📲 Open UPI
                        </button>
                      )}
                      {isIos && (
                        <button
                          onClick={() => handleSharePaymentQr(netPaymentAmount)}
                          className="flex-1 rounded-lg border-2 border-orange-600 bg-white px-3 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 transition"
                        >
                          📤 Share
                        </button>
                      )}
                    </div>
                    {shareError && <p className="text-xs text-red-600" role="alert">{shareError}</p>}
                  </div>
                </div>
                
                {/* Bank Transfer Section */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    Bank Transfer
                  </h3>
                  <div className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
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
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Complete Payment */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden sticky top-6">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-xl font-bold">Complete Payment</h3>
                </div>
                <p className="text-orange-100 text-sm">Enter payment details to confirm</p>
              </div>
              
              <div className="p-6 space-y-5">              
                {/* Payment Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handlePaymentCompleted();
                  }}
                  className="space-y-4"
                >
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
                      inputMode="decimal"
                      value={amountPaid}
                      onChange={(e) => {
                        setAmountPaid(e.target.value);
                        if (amountPaidError) setAmountPaidError(null);
                      }}
                      placeholder={`₹ ${formatCurrency(netPaymentAmount)}`}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    {amountPaidError && (
                      <p className="mt-1 text-xs text-red-600">{amountPaidError}</p>
                    )}
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
                        if (paymentDateError) setPaymentDateError(null);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    {paymentDateError && (
                      <p className="mt-1 text-xs text-red-600">{paymentDateError}</p>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={registrationInProgress || (!paymentSnapshot && dueRecords.length === 0)}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold shadow-lg hover:from-green-700 hover:to-green-800 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {registrationInProgress ? (
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
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;