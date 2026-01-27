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
import { useNavigate } from 'react-router-dom';
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

const normalizeIsoDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
};

const displayToIsoDate = (displayDate: string): string => {
  const parts = displayDate.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (!day || !month || !year || day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return '';
  }
  return `${year}-${month}-${day}`;
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

// Helper function to check if a CHRT pooja is in its scheduled month
const isCHRTInScheduledMonth = (item: CartItem): boolean => {
  // If it's not a CHRT pooja, include it
  if (item.dayOptionCode?.trim().toUpperCase() !== 'CHRT') {
    return true;
  }
  
  // For CHRT poojas, check if the booking date month matches current month
  if (!item.bookingDate) {
    return false;
  }
  
  try {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    
    const bookingDate = new Date(item.bookingDate);
    const bookingMonth = bookingDate.getMonth(); // 0-11
    const bookingYear = bookingDate.getFullYear();
    
    // Include CHRT pooja only if we're in the same month/year as the booking date
    return currentMonth === bookingMonth && currentYear === bookingYear;
  } catch (error) {
    console.error('Error checking CHRT month validity:', error);
    return true; // Include by default if there's an error
  }
};

interface ValidationError {
  field: 'reference' | 'amount' | 'date';
  message: string;
}

const PaymentPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const navigate = useNavigate();
  const clearCartItems = useCartStore((state) => state.clear);
  const paymentSnapshot = usePaymentStore((state) => state.lastGeneralPaymentByUser[cartKey] ?? null);
  const clearPaymentSnapshot = usePaymentStore((state) => state.clearGeneralPayment);
  const generalPaymentHistory = usePaymentStore((state) => state.generalPaymentHistory);
  const addGeneralPaymentHistory = usePaymentStore((state) => state.addGeneralPaymentHistory);
  const [activePaymentTab, setActivePaymentTab] = useState<'upi' | 'bank'>('upi');
  const [showCelebration, setShowCelebration] = useState(false);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [transactionReferenceError, setTransactionReferenceError] = useState<string | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [amountPaidError, setAmountPaidError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDateError, setPaymentDateError] = useState<string | null>(null);
  
  // Initialize paymentDate in dd/mm/yyyy format (Display format)
  const [paymentDate, setPaymentDate] = useState(() => formatDisplayDate(new Date().toISOString()));
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
  const combinedTo = useCombineAccessStore((state) => state.combinedTo);
  const combineLoading = useCombineAccessStore((state) => state.loading);
  const combineError = useCombineAccessStore((state) => state.error);
  const fetchCombineAccess = useCombineAccessStore((state) => state.fetchAccess);
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

  const latestPassbookMountedRef = useRef(true);
  const latestPaidPassbookMountedRef = useRef(true);

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
  
  // Filter cart items to exclude CHRT poojas outside their scheduled month
  const validCartItems = useMemo(() => {
    if (!paymentSnapshot) {
      return [];
    }
    return paymentSnapshot.items.filter(isCHRTInScheduledMonth);
  }, [paymentSnapshot]);
  
  // Calculate total for valid items only
  const filteredCartTotalAmount = useMemo(() => {
    return validCartItems.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  }, [validCartItems]);
  
  const cartTotalAmount = filteredCartTotalAmount;
  const dueTotalAmount = useMemo(
    () =>
      dueRecords.reduce((total, record) => total + parseAmount(record.due_amount), 0),
    [dueRecords],
  );
  const computedDueAmount = paymentSnapshot ? cartTotalAmount : dueTotalAmount;
  const initialBalance = currentBalance ?? openingBalance;
  const runningBalance = initialBalance ?? 0;
  const effectiveCartAmount = paymentSnapshot ? cartTotalAmount : dueTotalAmount;
  const needToPayForPooja = Math.max(0, runningBalance + effectiveCartAmount);
  const netPaymentAmount = needToPayForPooja;
  const openingBalanceDisplay = balanceLoading
    ? 'Loading…'
    : initialBalance != null
      ? `₹ ${formatCurrency(initialBalance)}`
      : 'Not set';
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
  const currentDueValue =
    computedDueAmount > 0
      ? computedDueAmount
      : currentMonthDue != null
        ? currentMonthDue
        : null;
  const monthlyDueAmount = monthlyDonation ?? currentBalance ?? null;
  const monthlyDueLabel = monthlyDueAmount !== null ? formatCurrency(monthlyDueAmount) : 'Not set';
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
      paidPassbookDueValue != null ? paidPassbookDueValue : passbookDueValue != null ? passbookDueValue : currentDueValue;
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
  const parentPhone = combinedTo?.phone ? combinedTo.phone : 'Phone not available';
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

  // Validation function
  const validatePaymentForm = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    const trimmedReference = transactionReference.trim();
    if (!trimmedReference) {
      errors.push({ field: 'reference', message: 'Transaction ID or UPI ID is required.' });
    }
    
    const trimmedAmount = amountPaid.trim();
    if (!trimmedAmount) {
      errors.push({ field: 'amount', message: 'Amount Paid is required.' });
    } else {
      const parsedAmount = Number(trimmedAmount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        errors.push({ field: 'amount', message: 'Enter a valid amount paid.' });
      }
    }
    
    const displayDate = paymentDate.trim();
    if (!displayDate) {
      errors.push({ field: 'date', message: 'Payment date is required.' });
    } else {
      const isoDate = displayToIsoDate(displayDate);
      if (!isoDate) {
        errors.push({ field: 'date', message: 'Invalid date format. Use dd/mm/yyyy' });
      } else {
        const parsedDate = new Date(isoDate);
        if (Number.isNaN(parsedDate.getTime())) {
          errors.push({ field: 'date', message: 'Enter a valid payment date.' });
        }
      }
    }
    
    return errors;
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
          <section className="space-y-4 rounded-2xl border border-rose-200 bg-white/80 p-6 shadow-sm">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-800">Combined payment handled elsewhere</h1>
              <p className="text-sm text-slate-600">
                All payments and history requests are managed by {parentName} ({parentPhone}). This account cannot be
                used to log payments.
              </p>
              {effectiveRange && (
                <p className="text-xs text-slate-500 mt-2">{effectiveRange}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }
  
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
      setPaymentDate(formatDisplayDate(new Date().toISOString()));
      setPaymentDateError(null);
    }
  }, [paymentSnapshot]);
  
  // Load backend payment records on component mount to show last payment
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
        
        // Add backend records to local payment history for display
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
    
    // Validate form
    const validationErrors = validatePaymentForm();
    if (validationErrors.length > 0) {
      validationErrors.forEach(({ field, message }) => {
        if (field === 'reference') setTransactionReferenceError(message);
        if (field === 'amount') setAmountPaidError(message);
        if (field === 'date') setPaymentDateError(message);
      });
      return;
    }
    
    // Clear all errors
    setAmountPaidError(null);
    setTransactionReferenceError(null);
    setPaymentDateError(null);
    setRegistrationError(null);
    
    const trimmedReference = transactionReference.trim();
    const parsedAmount = Number(amountPaid.trim());
    const displayDate = paymentDate.trim();
    const isoDate = displayToIsoDate(displayDate);
    
    setRegistrationInProgress(true);
    const isDuePayment = !paymentSnapshot;
    const dueNames = dueRecords
      .map((record) => record.pooja_option?.trim())
      .filter((name): name is string => !!name);
    const paymentMode = activePaymentTab === 'bank' ? 'bank' : 'upi';
    
    try {
      if (isDuePayment) {
        await api.post('payments/records/', {
          amount: parsedAmount,
          currency: 'INR',
          mode: paymentMode,
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
  
  return (
    <div className="min-h-screen bg-white p-4 sm:p-6">
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
            <div className="rounded-full bg-white/90 px-6 py-2 text-sm font-semibold text-orange-700 shadow-lg">
              Payment completed! Thank you.
            </div>
          </div>
        </div>
      )}
      
      {/* Error Notification */}
      {registrationError && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-lg bg-red-50 border-2 border-red-500 p-4 shadow-lg animate-slide-in">
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">💳 Payment Page</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your pooja payments securely and efficiently</p>
        </div>
        
        {/* Quick Stats - 4 Cards */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center hover:border-orange-600 hover:shadow-md transition">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Current Due</p>
            <p className="text-xl font-bold text-orange-600">{paymentPageCurrentDueLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center hover:border-orange-600 hover:shadow-md transition">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Last Payment</p>
            <p className="text-xl font-bold text-orange-600">{paymentPageLastPaymentLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center hover:border-orange-600 hover:shadow-md transition">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Payment Date</p>
            <p className="text-xl font-bold text-orange-600">{paymentPageDateLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center hover:border-orange-600 hover:shadow-md transition">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Closing Due</p>
            <p className="text-xl font-bold text-orange-600">{paymentPageClosingDueLabel}</p>
          </div>
        </div>
        
        {/* Main 2-Column Layout */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Payment Method (Tabs) */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-5 w-1 rounded bg-gradient-to-b from-orange-600 to-orange-700"></div>
              <h2 className="text-lg font-bold text-slate-900">Payment Method</h2>
            </div>
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 mb-6">
              <button
                onClick={() => setActivePaymentTab('upi')}
                className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  activePaymentTab === 'upi'
                    ? 'text-orange-600 border-orange-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                }`}
                aria-current={activePaymentTab === 'upi' ? 'page' : undefined}
              >
                UPI
              </button>
              <button
                onClick={() => setActivePaymentTab('bank')}
                className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  activePaymentTab === 'bank'
                    ? 'text-orange-600 border-orange-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                }`}
                aria-current={activePaymentTab === 'bank' ? 'page' : undefined}
              >
                Bank Transfer
              </button>
            </div>
            {/* Tab Content */}
            <div className="min-h-[300px]">
              {activePaymentTab === 'upi' ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={PAYMENT_QR_IMAGE_URL}
                    alt="Payment QR Code"
                    className="h-64 w-64 rounded-lg border border-slate-200 bg-white p-2 object-contain"
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
              ) : (
                <div className="space-y-3 rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 mb-1">Account Holder</p>
                    <p className="text-sm font-semibold text-slate-900">ALAMELU V</p>
                    <p className="text-sm font-semibold text-slate-900">SRIRAM RAJU</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 mb-1">Account Number</p>
                    <p className="text-sm font-mono font-semibold text-slate-900">007701028012</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 mb-1">IFSC Code</p>
                    <p className="text-sm font-mono font-semibold text-slate-900">ICIC0000077</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Complete Payment */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-5 w-1 rounded bg-gradient-to-b from-orange-600 to-orange-700"></div>
              <h2 className="text-lg font-bold text-slate-900">Complete Payment</h2>
            </div>
            {/* Payment Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePaymentCompleted();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="transaction-ref" className="text-xs font-semibold uppercase text-slate-600">
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
                  aria-required="true"
                  aria-invalid={!!transactionReferenceError}
                  aria-describedby={transactionReferenceError ? "transaction-ref-error" : undefined}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
                {transactionReferenceError && (
                  <p id="transaction-ref-error" role="alert" className="mt-1 text-xs text-red-600">
                    {transactionReferenceError}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="amount-paid" className="text-xs font-semibold uppercase text-slate-600">
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
                  aria-required="true"
                  aria-invalid={!!amountPaidError}
                  aria-describedby={amountPaidError ? "amount-paid-error" : undefined}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {amountPaidError && (
                  <p id="amount-paid-error" role="alert" className="mt-1 text-xs text-red-600">
                    {amountPaidError}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="payment-date" className="text-xs font-semibold uppercase text-slate-600">
                  Payment Date
                </label>
                <input
                  id="payment-date"
                  type="text"
                  value={paymentDate}
                  onChange={(e) => {
                    setPaymentDate(e.target.value);
                    if (paymentDateError) setPaymentDateError(null);
                  }}
                  placeholder="dd/mm/yyyy"
                  pattern="\d{2}/\d{2}/\d{4}"
                  maxLength={10}
                  aria-required="true"
                  aria-invalid={!!paymentDateError}
                  aria-describedby={paymentDateError ? "payment-date-error" : undefined}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
                {paymentDateError && (
                  <p id="payment-date-error" role="alert" className="mt-1 text-xs text-red-600">
                    {paymentDateError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={registrationInProgress || (!paymentSnapshot && dueRecords.length === 0)}
                className="w-full rounded-lg bg-gradient-to-r from-orange-600 to-orange-700 px-4 py-2 text-sm font-semibold text-white hover:from-orange-700 hover:to-orange-800 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  '✓ Payment Completed'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
