import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';

import api from '../../lib/api';
import { useCartStore } from '../../store/cart';
import { usePaymentStore } from '../../store/payments';
import { useAuthStore } from '../../store/auth';
import { useCurrentBalance } from '../../hooks/useCurrentBalance';
import { useCombineAccessStore } from '../../store/combineAccess';
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
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDayOptionLabel = (description?: string | null, code?: string | null) => {
  const trimmedDescription = description?.trim();
  const trimmedCode = code?.trim();
  if (trimmedDescription && trimmedCode) {
    return `${trimmedDescription} — ${trimmedCode}`;
  }
  if (trimmedDescription) {
    return trimmedDescription;
  }
  if (trimmedCode) {
    return trimmedCode;
  }
  return null;
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

const buildRegistrationPayload = (item: CartItem, paymentDate?: string): RegistrationPayload => {
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
  // Use customDayDate if available, otherwise use bookingDate, otherwise use paymentDate
  // Default to today's date if no date is provided to ensure start_date is never NULL
  const registrationDate = item.customDayDate ?? item.bookingDate ?? paymentDate ?? new Date().toISOString();
  const normalizedStartDate = normalizeIsoDate(registrationDate);
  
  console.log('🎯 buildRegistrationPayload DEBUG:');
  console.log('  item.customDayDate:', item.customDayDate);
  console.log('  item.bookingDate:', item.bookingDate);
  console.log('  paymentDate param:', paymentDate);
  console.log('  registrationDate (resolved):', registrationDate);
  console.log('  normalizedStartDate:', normalizedStartDate);
  
  const payload: Record<string, unknown> = {
    pooja_option: item.poojaId,
    day_option: item.dayOptionId ?? undefined,
    start_date: normalizedStartDate,
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

const allocatePaymentAmounts = (items: CartItem[], totalAmount: number) => {
  const toPaise = (value: number) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.round(value * 100));
  };

  let remainingPaise = Math.max(0, toPaise(totalAmount));
  const allocations = items.map((item, idx) => {
    if (remainingPaise <= 0) {
      return 0;
    }
    const itemPaise = toPaise(parseAmount(item.amount));
    const allocationPaise = Math.min(itemPaise, remainingPaise);
    remainingPaise = Math.max(remainingPaise - allocationPaise, 0);
    const allocation = allocationPaise / 100;
    console.log(`  Item ${idx}: itemAmount=${parseAmount(item.amount)}, allocated=${allocation}, remainingPaise=${remainingPaise}`);
    return allocation;
  });
  
  const totalAllocated = allocations.reduce((sum, a) => sum + a, 0);
  console.log('  Total allocated:', totalAllocated, 'Expected:', totalAmount);
  
  return allocations;
};

const recordRegistrations = async (
  items: CartItem[],
  transactionReference: string,
  amountPaid?: number,
  paymentDate?: string,
) => {
  const totalCartAmount = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
  const totalPaymentAmount =
    typeof amountPaid === 'number' && Number.isFinite(amountPaid) ? amountPaid : totalCartAmount;
  
  // DEBUG: Log all amounts and items
  console.log('🔍 recordRegistrations DEBUG:');
  console.log('  Items:', items.map((item, idx) => ({ idx, amount: item.amount })));
  console.log('  totalCartAmount:', totalCartAmount);
  console.log('  amountPaid parameter:', amountPaid);
  console.log('  totalPaymentAmount:', totalPaymentAmount);
  
  // Safety check: ensure totalPaymentAmount doesn't exceed totalCartAmount
  const safePaymentAmount = Math.min(totalPaymentAmount, totalCartAmount);
  
  console.log('  safePaymentAmount:', safePaymentAmount);
  
  const paymentAllocations = allocatePaymentAmounts(items, safePaymentAmount);
  
  console.log('  paymentAllocations:', paymentAllocations);

  // Collect all registration IDs before creating payment records
  const registrationIds: (number | undefined)[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const payload = buildRegistrationPayload(item, paymentDate);
    console.log(`  📦 Sending registration ${index} payload:`, payload);
    const response = await api.post('pooja/registrations/', payload);
    const registrationId = response.data?.id;
    registrationIds.push(typeof registrationId === 'number' ? registrationId : undefined);
    console.log(`  Registration ${index} created with ID:`, registrationId, 'Response:', response.data);
  }

  // Now create payment records with the allocated amounts
  for (let index = 0; index < items.length; index += 1) {
    const registrationId = registrationIds[index];
    const paymentAmount = paymentAllocations[index] ?? 0;

    // Only create payment records for amounts > 0
    if (paymentAmount <= 0) {
      console.log(`  Skipping payment record for index ${index}: amount is ${paymentAmount}`);
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
    
    console.log(`  Creating payment record ${index}:`, paymentPayload);

    await api.post('payments/records/', paymentPayload);
  }
  
  console.log('✅ recordRegistrations completed');
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
  const [paymentDate, setPaymentDate] = useState(() => formatDisplayDate(new Date().toISOString()));
  const [shareError, setShareError] = useState<string | null>(null);
  const [petalSeed, setPetalSeed] = useState(0);
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
  const lastPaymentEntry = useMemo(
    () => (userHistory.length > 0 ? userHistory[0] : null),
    [userHistory],
  );

  const cartTotalAmount = paymentSnapshot?.totalAmount ?? 0;
  const initialBalance = currentBalance ?? openingBalance;
  const runningBalance = initialBalance ?? 0;
  const needToPayForPooja = Math.max(0, runningBalance + cartTotalAmount);
  const netPaymentAmount = needToPayForPooja;
  const updatedOpeningBalanceValue = runningBalance + cartTotalAmount - netPaymentAmount;
  const updatedOpeningBalanceLabel = `₹ ${formatCurrency(updatedOpeningBalanceValue)}`;
  const lastPaymentAmountLabel = lastPaymentEntry
    ? `₹ ${formatCurrency(lastPaymentEntry.amountPaid ?? lastPaymentEntry.amount ?? lastPaymentEntry.totalAmount)}`
    : '—';
  const lastPaymentDateLabel = lastPaymentEntry
    ? formatDate(lastPaymentEntry.paymentDate ?? lastPaymentEntry.created_at ?? lastPaymentEntry.completedAt)
    : '—';
  const openingBalanceDisplay = balanceLoading
    ? 'Loading…'
    : initialBalance != null
      ? `₹ ${formatCurrency(initialBalance)}`
      : 'Not set';
  const cartDueAmount = paymentSnapshot?.totalAmount ?? null;
  const currentMonthDueLabel =
    cartDueAmount !== null
      ? formatCurrency(cartDueAmount)
      : currentMonthDue != null
        ? formatCurrency(currentMonthDue)
        : '—';
  const currentMonthPaymentsLabel = currentMonthPayments != null ? formatCurrency(currentMonthPayments) : '—';
  const monthlyDueAmount = monthlyDonation ?? currentBalance ?? null;
  const monthlyDueLabel = monthlyDueAmount !== null ? formatCurrency(monthlyDueAmount) : 'Not set';
  const parentName = combinedTo?.name ?? 'Parent donor';
  const parentPhone = combinedTo?.phone ? combinedTo.phone : 'Phone not available';
  const effectiveFromLabel = formatCombineMonthLabel(combinedTo?.effectiveFrom);
  const uncombineFromLabel = formatCombineMonthLabel(combinedTo?.effectiveTo);
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

  if (combineRole === 'subordinate') {
    const effectiveRange = [
      effectiveFromLabel ? `Effective from ${effectiveFromLabel}` : null,
      uncombineFromLabel ? `Uncombine from ${uncombineFromLabel}` : null,
    ]
      .filter(Boolean)
      .join(' • ');

    return (
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-rose-200 bg-white/80 p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-800">Combined payment handled elsewhere</h1>
            <p className="text-sm text-slate-600">
              All payments and history requests are managed by {parentName} ({parentPhone}). This account
              cannot be used to log payments.
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
              Payments &amp; history are disabled for this profile.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Monthly dues</p>
              <p className="text-xl font-semibold text-slate-900">{monthlyDueLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Parent donor</p>
              <p className="text-lg font-semibold text-slate-900">{parentName}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Phone</p>
              <p className="text-lg font-semibold text-slate-900">{parentPhone}</p>
            </div>
          </div>
          {effectiveRange && (
            <p className="text-xs text-slate-500">{effectiveRange}</p>
          )}
        </section>
      </div>
    );
  }

  useEffect(() => {
    if (!paymentSnapshot) {
      setShowPaymentDetails(false);
    }
  }, [paymentSnapshot]);

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
    setPaymentDate(formatDisplayDate(new Date().toISOString()));
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
    const requiredPayment = netPaymentAmount;
    
    // DEBUG: Log form submission values
    console.log('🎯 Payment Form Submission:');
    console.log('  amountPaid (from state):', amountPaid);
    console.log('  trimmedAmount:', trimmedAmount);
    console.log('  parsedAmount:', parsedAmount);
    console.log('  typeof parsedAmount:', typeof parsedAmount);
    console.log('  Number.isNaN(parsedAmount):', Number.isNaN(parsedAmount));
    console.log('  netPaymentAmount:', netPaymentAmount);
    console.log('  requiredPayment:', requiredPayment);
    
    if (
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setAmountPaidError('Enter a valid amount paid.');
      return;
    }
    const paymentExcess = Number((parsedAmount - requiredPayment).toFixed(2));
    const donationCreditAmount =
      paymentExcess > 0 && paymentExcess <= 5 ? paymentExcess : 0;
    const displayDate = paymentDate.trim();
    if (!displayDate) {
      setPaymentDateError('Payment date is required.');
      return;
    }
    const isoDate = displayToIsoDate(displayDate);
    if (!isoDate) {
      setPaymentDateError('Enter a valid payment date (dd/mm/yyyy).');
      return;
    }
    const parsedDate = new Date(isoDate);
    if (Number.isNaN(parsedDate.getTime())) {
      setPaymentDateError('Enter a valid payment date (dd/mm/yyyy).');
      return;
    }

    setAmountPaidError(null);
    setTransactionReferenceError(null);
    setRegistrationError(null);
    setRegistrationInProgress(true);
    try {
      console.log('🚀 Calling recordRegistrations with:', {
        itemsCount: paymentSnapshot.items.length,
        items: paymentSnapshot.items.map((item) => ({ amount: item.amount })),
        transactionReference: trimmedReference,
        amountPaid: parsedAmount,
        isoDate,
      });
      await recordRegistrations(paymentSnapshot.items, trimmedReference, parsedAmount, isoDate);
      emitPoojaDataUpdatedEvent();
    } catch (error) {
      setRegistrationError(buildRegistrationErrorMessage(error));
      return;
    } finally {
      setRegistrationInProgress(false);
    }

    addGeneralPaymentHistory(paymentSnapshot, isoDate, parsedAmount);
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
            const dayOptionLabel = formatDayOptionLabel(item.dayOptionDescription, item.dayOptionCode);

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
                  {dayOptionLabel && (
                    <p className="text-xs text-slate-500">Day option: {dayOptionLabel}</p>
                  )}
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
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  type="text"
                  value={paymentDate}
                  placeholder="dd/mm/yyyy"
                  onChange={(event) => {
                    const displayValue = event.target.value;
                    setPaymentDate(displayValue);
                    if (paymentDateError && displayValue.length > 0) {
                      setPaymentDateError(null);
                    }
                  }}
                  onBlur={(event) => {
                    const displayValue = event.target.value;
                    if (displayValue && displayValue.length === 10) {
                      const isoDate = displayToIsoDate(displayValue);
                      if (!isoDate) {
                        setPaymentDateError('Invalid date format. Use dd/mm/yyyy');
                      }
                    }
                  }}
                  maxLength={10}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                  style={{ textAlign: 'center' }}
                />
                {paymentDateError && (
                  <p className="mt-2 text-sm text-rose-600">{paymentDateError}</p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {!showPaymentDetails ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={triggerPaymentDetails}
                className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
              >
                Payment
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
        </div>
      </div>
      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-700 shadow-sm">
        Click Payment to view the bank details, then tap Payment Completed after transferring funds.
      </div>
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Payment Amount</p>
            <p className="text-xl font-semibold text-slate-900">{lastPaymentAmountLabel}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Payment Date</p>
            <p className="text-xl font-semibold text-slate-900">{lastPaymentDateLabel}</p>
          </div>
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
