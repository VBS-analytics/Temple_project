import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

import api from '../../lib/api';
import { loadPdfMake } from '../../lib/pdfMakeLoader';
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

const normalizeMemberValue = (value?: string | null) =>
  typeof value === 'string' ? value.trim() : value ?? '';

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

const buildRegistrationPayload = (item: CartItem) => {
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
  paymentDate?: string,
) => {
  for (const item of items) {
    const payload = buildRegistrationPayload(item);
    const response = await api.post('pooja/registrations/', payload);
    const registrationId = response.data?.id;
    await api.post('payments/records/', {
      registration: typeof registrationId === 'number' ? registrationId : undefined,
      amount: Number(item.amount) || 0,
      mode: 'upi',
      status: 'success',
      transaction_reference: transactionReference,
      payment_month: paymentDate || undefined,
      notes: payload.additional_notes ?? '',
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

const buildMemberSummaries = (item: CartItem): string[] => {
  const normalizedMembers = Array.isArray(item.members) && item.members.length > 0
    ? item.members
    : [
        {
          id: null,
          name: item.fullName?.trim() || 'Member',
          relationship: item.memberRelationship ?? 'Self',
          gender: item.memberGender ?? undefined,
          tamilStar: item.memberTamilStar ?? undefined,
          gothra: item.memberGothra ?? undefined,
          rasi: item.memberRasi ?? undefined,
          dob: item.memberDob ?? undefined,
          familyName: item.memberFamilyName ?? undefined,
        },
      ];

  return normalizedMembers.map((member) => {
    const name = normalizeMemberValue(member?.name ?? '') || 'Member';
    const attributes = [
      normalizeMemberValue(member?.gender ?? ''),
      normalizeMemberValue(member?.rasi ?? ''),
      normalizeMemberValue(member?.tamilStar ?? ''),
      normalizeMemberValue(member?.gothra ?? ''),
      normalizeMemberValue(member?.familyName ?? ''),
    ].filter(Boolean);
    return attributes.length > 0 ? `${name} — ${attributes.join(' • ')}` : name;
  });
};

const renderUpcomingOccurrenceList = (occurrences?: CartItem['dayOptionOccurrences']) => {
  if (!occurrences || occurrences.length === 0) {
    return null;
  }
  return (
    <div className="mt-4 text-xs uppercase tracking-wide text-slate-500">
      <p className="text-[0.6rem] tracking-[0.3em] text-slate-500">UPCOMING DATES</p>
      <div className="mt-1 space-y-1 text-sm font-semibold text-slate-700">
        {occurrences.map((entry) => (
          <p key={`${entry.date}-${entry.label ?? ''}`}>
            {formatDate(entry.date)}
            {entry.label ? ` • ${entry.label}` : ''}
          </p>
        ))}
      </div>
    </div>
  );
};

const PaymentPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const location = useLocation();
  const navigate = useNavigate();
  const queryTab = useMemo<'summary' | 'history' | null>(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'history') return 'history';
    if (tab === 'summary') return 'summary';
    return null;
  }, [location.search]);

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

  const [activeTab, setActiveTab] = useState<'summary' | 'history'>(() => {
    if (queryTab) {
      return queryTab;
    }
    return 'summary';
  });
  const [historyMonth, setHistoryMonth] = useState<string>(() => formatMonthKey(new Date()) ?? '');
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [transactionReferenceError, setTransactionReferenceError] = useState<string | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shareError, setShareError] = useState<string | null>(null);
  const [petalSeed, setPetalSeed] = useState(0);
  const { balance: currentBalance, loading: balanceLoading, error: balanceError, refresh: refreshBalance } =
    useCurrentBalance();
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

  const historyMonthOptions = useMemo(
    () => buildHistoryMonthOptions(userHistory, (entry) => entry.completedAt || entry.createdAt),
    [userHistory],
  );

  const filteredHistory = useMemo(
    () =>
      historyMonth
        ? userHistory.filter((entry) => formatMonthKey(entry.completedAt || entry.createdAt) === historyMonth)
        : [],
    [historyMonth, userHistory],
  );

  useEffect(() => {
    if (paymentSnapshot) {
      setActiveTab('summary');
    }
  }, [paymentSnapshot]);

  useEffect(() => {
    if (!paymentSnapshot) {
      setShowPaymentDetails(false);
    }
  }, [paymentSnapshot]);

  useEffect(() => {
    if (!paymentSnapshot) {
      setRegistrationError(null);
      setTransactionReference('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
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
    if (historyMonthOptions.length === 0) {
      return;
    }
    if (!historyMonth || !historyMonthOptions.some((option) => option.key === historyMonth)) {
      if (historyMonthOptions.length > 0) {
        setHistoryMonth(historyMonthOptions[0].key);
      } else {
        setHistoryMonth('');
      }
    }
  }, [historyMonth, historyMonthOptions]);

  useEffect(() => {
    if (queryTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

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
    setShowPaymentDetails(true);
  };

  const restoreCartFromSnapshot = () => {
    if (!paymentSnapshot) {
      return;
    }
    setItemsForUser(cartKey, paymentSnapshot.items);
    setShowPaymentDetails(false);
    setActiveTab('summary');
    scrollToCartSection();
  };

  const handlePaymentCompleted = async () => {
    if (!paymentSnapshot || registrationInProgress) return;
    const trimmedReference = transactionReference.trim();
    if (!trimmedReference) {
      setTransactionReferenceError('Transaction ID or UPI ID is required.');
      return;
    }
    setTransactionReferenceError(null);
    setRegistrationError(null);
    setRegistrationInProgress(true);
    const normalizedPaymentDate = paymentDate.trim();
    try {
      await recordRegistrations(
        paymentSnapshot.items,
        trimmedReference,
        normalizedPaymentDate || undefined,
      );
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

  const handleDownloadPaymentHistory = async () => {
    if (!historyMonth || filteredHistory.length === 0) {
      return;
    }

    const selectedMonthLabel = formatMonthLabel(historyMonth);
    const generatedOnLabel = formatDateTime(new Date().toISOString());
    const content: TDocumentDefinitions['content'] = [
      { text: 'General Payment History', style: 'pdfTitle' },
      { text: selectedMonthLabel, style: 'pdfSubtitle' },
      { text: `Generated on ${generatedOnLabel}`, style: 'pdfMeta' },
    ];

    filteredHistory.forEach((entry, index) => {
      const completionLabel = formatDateTime(entry.completedAt || entry.createdAt);
      content.push(
        {
          text: `Payment ${index + 1} • ₹ ${formatCurrency(entry.totalAmount)} • ${completionLabel}`,
          style: 'pdfEntryTitle',
        },
        {
          text: `Saved on ${formatDate(entry.createdAt)}`,
          style: 'pdfEntryMeta',
        },
      );

      if (entry.items.length > 0) {
        const tableBody = [
          [
            { text: 'Pooja', style: 'pdfTableHeader' },
            { text: 'Service Date', style: 'pdfTableHeader' },
            { text: 'Qty', style: 'pdfTableHeader' },
            { text: 'Amount', style: 'pdfTableHeader' },
            { text: 'Members', style: 'pdfTableHeader' },
          ],
          ...entry.items.map((item) => {
            const selectedDate = item.customDayDate || item.bookingDate;
            const quantity =
              item.members && item.members.length > 0 ? item.members.length : 1;
            const membersLabel = buildMembersLabel(item.members) ?? '—';
            return [
              item.poojaName || 'Pooja',
              formatDate(selectedDate),
              quantity.toString(),
              `₹ ${formatCurrency(item.amount)}`,
              membersLabel,
            ];
          }),
        ];

        content.push({
          margin: [0, 0, 0, 8],
          table: {
            widths: ['*', 90, 40, 70, '*'],
            body: tableBody,
          },
          layout: 'lightHorizontalLines',
        });
      } else {
        content.push({
          text: 'No pooja details recorded for this payment.',
          italics: true,
          margin: [0, 0, 0, 8],
        });
      }
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      info: {
        title: `General Payment History • ${selectedMonthLabel}`,
      },
      content,
      styles: {
        pdfTitle: { fontSize: 20, bold: true },
        pdfSubtitle: { fontSize: 12, color: '#475569', margin: [0, 0, 0, 6] },
        pdfMeta: { fontSize: 10, color: '#6b7280', margin: [0, 0, 0, 12] },
        pdfEntryTitle: { fontSize: 14, bold: true, margin: [0, 12, 0, 4] },
        pdfEntryMeta: { fontSize: 10, color: '#475569', margin: [0, 0, 0, 6] },
        pdfTableHeader: { bold: true, fillColor: '#f3f4f6' },
      },
      defaultStyle: {
        fontSize: 11,
      },
    };

    try {
      const pdfMakeInstance = await loadPdfMake();
      pdfMakeInstance.createPdf(docDefinition).download(`general-payment-history-${historyMonth}.pdf`);
    } catch (error) {
      console.error('Failed to generate payment history PDF', error);
    }
  };

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

    const { items: snapshotItems, totalAmount: snapshotTotal, createdAt } = paymentSnapshot;
    const netPaymentAmount = Math.max(0, snapshotTotal - (currentBalance ?? 0));

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
          </div>

        <div className="rounded-2xl bg-orange-50 px-5 py-3 text-center sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-orange-600">Total Amount</p>
          <p className="text-2xl font-semibold text-orange-700">₹ {formatCurrency(snapshotTotal)}</p>
        </div>
        </div>

        <div className="space-y-4">
          {snapshotItems.map((item) => {
            const amountLabel = item.amount ? `₹ ${formatCurrency(item.amount)}` : '—';
            const membersLabel = buildMembersLabel(item.members);
            const selectedDate = item.customDayDate || item.bookingDate;

            return (
              <article
                key={`${paymentSnapshot.id}-${item.cartId}`}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {item.poojaCode ?? 'Pooja'}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">{item.poojaName}</h3>
                    {item.dayOptionDescription && (
                      <p className="text-sm text-slate-500">{item.dayOptionDescription}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pooja Amount</p>
                    <p className="text-xl font-semibold text-slate-900">{amountLabel}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromSummary(item.cartId)}
                      className="mt-2 block text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Date</dt>
                    <dd className="text-sm font-medium text-slate-800">{formatDate(selectedDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</dt>
                    <dd className="text-sm font-medium text-slate-800">
                      {item.members?.length && item.members.length > 0 ? item.members.length : 1}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</dt>
                    <dd className="text-sm font-medium text-slate-800">{item.customDayNote?.trim() || '—'}</dd>
                  </div>
                </dl>

                {renderUpcomingOccurrenceList(item.dayOptionOccurrences)}

                {(() => {
                  const memberLines = buildMemberSummaries(item);
                  if (memberLines.length === 0) {
                    return null;
                  }
                  return (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered Members</p>
                      <div className="space-y-1 text-sm font-medium text-slate-800">
                        {memberLines.map((line, index) => (
                          <p key={`${snapshotTotal}-${item.cartId}-${index}`}>{line}</p>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </article>
            );
          })}
        </div>

        {showPaymentDetails && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="payment-date">
                  Payment date
                </label>
                <input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            <p>Click Payment to reveal the bank transfer details. Once the transfer is complete, click Payment Completed to clear the record.</p>
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

  const renderHistoryContent = () => {
    const selectedMonthLabel = historyMonth ? formatMonthLabel(historyMonth) : 'Selected month';

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Stored on this device. Use it as a quick reminder of the payments you already informed the temple about.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label
              htmlFor="general-history-month"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Month
            </label>
            <select
              id="general-history-month"
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
              onClick={handleDownloadPaymentHistory}
              disabled={filteredHistory.length === 0}
              className={`inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                filteredHistory.length === 0
                  ? 'border-slate-200 text-slate-400'
                  : 'border-orange-300 text-orange-700 hover:bg-orange-50'
              }`}
            >
              Download Payment History
            </button>
          </div>
        </div>

        {userHistory.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            Once you mark payments as completed, the most recent confirmations will appear here for quick reference.
          </div>
        )}

        {userHistory.length > 0 && filteredHistory.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-sm text-slate-600">
            No payments recorded for {selectedMonthLabel}.
          </div>
        )}

        {filteredHistory.map((entry) => {
          const previewItems = entry.items.slice(0, 3);
          const remainingItems = entry.items.length - previewItems.length;
          return (
            <article
              key={`${entry.id}-${entry.completedAt}`}
              className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Completed</p>
                  <p className="text-base font-semibold text-slate-900">{formatDateTime(entry.completedAt)}</p>
                  <p className="text-sm text-slate-600">
                    {entry.items.length} pooja{entry.items.length === 1 ? '' : 's'} • Saved on{' '}
                    {formatDate(entry.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                  <p className="text-2xl font-semibold text-orange-700">₹ {formatCurrency(entry.totalAmount)}</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50">
                {previewItems.map((item) => {
                  const membersLabel = buildMembersLabel(item.members);
                  return (
                    <li
                      key={`${entry.id}-${item.cartId}`}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.poojaName || 'Pooja'}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {item.poojaCode ?? 'POOJA'} · {formatDate(item.customDayDate || item.bookingDate)}
                        </p>
                        {membersLabel && (
                          <p className="text-xs text-slate-500">Members: {membersLabel}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Amount</p>
                        <p className="text-sm font-semibold text-slate-900">₹ {formatCurrency(item.amount)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {remainingItems > 0 && (
                <p className="text-xs text-slate-500">
                  +{remainingItems} more pooja{remainingItems === 1 ? '' : 's'} recorded in this payment.
                </p>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  const tabButtonClasses = (tab: 'summary' | 'history') =>
    `flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
      activeTab === tab ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
    }`;

  const historySection = (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Payment Page</h2>
          <p className="text-sm text-slate-600">
            Review the pooja registrations you saved from the cart to log a single consolidated payment, or revisit past
            completions saved on this device.
          </p>
        </div>
        <div className="flex w-full max-w-md rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-semibold text-slate-600 md:w-auto">
          <button
            type="button"
            className={tabButtonClasses('summary')}
            onClick={() => setActiveTab('summary')}
          >
            Current Summary
          </button>
          <button
            type="button"
            className={tabButtonClasses('history')}
            onClick={() => setActiveTab('history')}
          >
            Payment History
          </button>
        </div>
      </div>
      <div>
        {activeTab === 'summary' ? renderSummaryContent() : renderHistoryContent()}
      </div>
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
          {historySection}
        </div>
      </section>
    </div>
  );
};

export default PaymentPage;
