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
  const [, setLatestPassbookEntry] = useState<PassbookSummaryEntry | null>(null);
  const [, setLatestPaidPassbookEntry] = useState<PassbookSummaryEntry | null>(null);
  const [, setPassbookSummaryLoading] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'upi' | 'bank'>('upi');
  
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
  
  const initialBalance = currentBalance ?? openingBalance;
  const runningBalance = initialBalance ?? 0;
  const effectiveCartAmount = paymentSnapshot ? cartTotalAmount : dueTotalAmount;
  const needToPayForPooja = Math.max(0, runningBalance + effectiveCartAmount);
  const netPaymentAmount = needToPayForPooja;
  
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
    }, 5000);
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
  
  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
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
            <div className="rounded-full border border-violet-200 bg-white/90 px-6 py-3 text-base font-semibold text-violet-700 shadow-lg backdrop-blur-sm">
              🙏 Temple seva received successfully. Thank you.
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
      
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6 px-1">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <svg className="h-5 w-5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Payment Page</h1>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900">
              <span className="inline-block h-6 w-1 rounded-full bg-indigo-600" aria-hidden="true" />
              Payment Method
            </h2>

            <div className="mb-5 flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveMethod('upi')}
                className={`min-w-0 flex-1 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                  activeMethod === 'upi'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                UPI
              </button>
              <button
                type="button"
                onClick={() => setActiveMethod('bank')}
                className={`min-w-0 flex-1 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                  activeMethod === 'bank'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Bank Transfer
              </button>
            </div>

            {activeMethod === 'upi' ? (
              <div className="space-y-5">
                <div className="mx-auto w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-4">
                  <img
                    src={PAYMENT_QR_IMAGE_URL}
                    alt="Payment QR Code"
                    className="mx-auto h-44 w-44 object-contain sm:h-52 sm:w-52"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">UPI ID</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="truncate text-base font-bold text-slate-900 sm:text-lg">alamelu7@icici</p>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      title={copiedUpi ? 'Copied!' : 'Copy UPI ID'}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      aria-label="Copy UPI ID"
                    >
                      {copiedUpi ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <p className="text-center text-sm text-slate-500">Scan with any UPI app to pay instantly</p>

                {(isAndroid || isIos) && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {isAndroid && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpiApp(netPaymentAmount)}
                        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open UPI
                      </button>
                    )}
                    {isIos && (
                      <button
                        type="button"
                        onClick={() => handleSharePaymentQr(netPaymentAmount)}
                        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Share QR
                      </button>
                    )}
                  </div>
                )}

                {shareError && <p className="text-xs text-red-600" role="alert">{shareError}</p>}
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Account Holder</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">ALAMELU V</p>
                  <p className="text-sm font-semibold text-slate-900">SRIRAM RAJU</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Account Number</p>
                  <p className="mt-1 text-sm font-mono font-bold text-slate-900">007701028012</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">IFSC Code</p>
                  <p className="mt-1 text-sm font-mono font-bold text-slate-900">ICIC0000077</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-slate-900">
              <span className="inline-block h-6 w-1 rounded-full bg-indigo-600" aria-hidden="true" />
              Complete Payment
            </h2>
            <p className="mb-5 text-sm text-slate-500">
              Submit your payment reference after completing the transfer.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePaymentCompleted();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="transaction-ref" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                />
                {transactionReferenceError && (
                  <p className="mt-1 text-xs text-red-600">{transactionReferenceError}</p>
                )}
              </div>

              <div>
                <label htmlFor="amount-paid" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                  placeholder="Enter amount paid"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                />
                {amountPaidError && (
                  <p className="mt-1 text-xs text-red-600">{amountPaidError}</p>
                )}
              </div>

              <div>
                <label htmlFor="payment-date" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                />
                {paymentDateError && (
                  <p className="mt-1 text-xs text-red-600">{paymentDateError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={registrationInProgress}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300 disabled:opacity-70"
              >
                {registrationInProgress ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    Pay
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
