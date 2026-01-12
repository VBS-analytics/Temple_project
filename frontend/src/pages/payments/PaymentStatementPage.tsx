'use client';

import { useEffect, useMemo, useState } from 'react';

import type { TDocumentDefinitions } from 'pdfmake/interfaces';

import api, { extractResults } from '../../lib/api';
import { loadPdfMake } from '../../lib/pdfMakeLoader';
import type { CartItem } from '../../store/cart';
import { isAdmin, useAuthStore } from '../../store/auth';
import { useCombineAccessStore } from '../../store/combineAccess';
import * as XLSX from 'xlsx';
import { POOJA_CART_SNAPSHOT_UPDATED_EVENT } from '../../constants/events';

type TimeframeOption = 'day' | 'week' | 'month' | 'year';

interface PaymentRecordEntry {
  id: number | string;
  donor: number | null;
  donor_name?: string | null;
  pooja_option?: string | null;
  registration?: number | null;
  registration_start_date?: string | null;
  registration_total_amount?: string | number | null;
  pooja_due_amount?: string | number | null;
  amount?: string | number | null;
  transaction_reference?: string | null;
  status?: string | null;
  created_at?: string | null;
  registration_status?: string | null;
  registration_donor_name?: string | null;
  registration_is_group_registration?: boolean | null;
  upcoming_occurrences?: { date: string; label?: string | null }[];
}

interface PoojaRegistrationEntry {
  id: number;
  donor?: number | null;
  donor_name?: string | null;
  pooja_option_name?: string | null;
  start_date?: string | null;
  total_amount?: string | number | null;
  created_at?: string | null;
  status?: string | null;
  is_group_registration?: boolean | null;
}

interface CartSnapshotRecord {
  donor_id?: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  items?: CartItem[] | null;
  updated_at?: string | null;
}

const TIMEFRAME_FILTERS: { label: string; value: TimeframeOption }[] = [
  { label: 'Day Wise', value: 'day' },
  { label: 'Weekly Wise', value: 'week' },
  { label: 'Month Wise', value: 'month' },
  { label: 'Year Wise', value: 'year' },
];

const STATUS_LABEL_PAYMENT_RECEIVED = 'Payment Received';
const STATUS_LABEL_PAYMENT_NOT_RECEIVED = 'Payment Not Received';

const STATUS_STYLES: Record<string, string> = {
  [STATUS_LABEL_PAYMENT_NOT_RECEIVED]: 'bg-rose-100 text-rose-800',
  [STATUS_LABEL_PAYMENT_RECEIVED]: 'bg-emerald-100 text-emerald-800',
};
const CLUB_STYLES: Record<string, string> = {
  Yes: 'bg-emerald-100 text-emerald-800',
  No: 'bg-rose-100 text-rose-800',
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') {
    return '₹ 0.00';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '₹ 0.00';
  }
  return numeric.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDisplayDate = (value?: string | null) => {
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

const formatUpcomingOccurrenceLabel = (occurrence: PaymentRecordEntry['upcoming_occurrences'][number]) => {
  const labelParts = [formatDisplayDate(occurrence.date)];
  if (occurrence.label) {
    labelParts.push(occurrence.label);
  }
  return labelParts.join(' • ');
};

const renderUpcomingOccurrenceList = (occurrences?: PaymentRecordEntry['upcoming_occurrences']) => {
  if (!occurrences || occurrences.length === 0) {
    return null;
  }
  return (
    <div className="mt-1 space-y-0.5 text-[0.7rem] text-slate-500">
      {occurrences.map((entry) => (
        <p key={`${entry.date}-${entry.label ?? ''}`} className="text-slate-600">
          {formatUpcomingOccurrenceLabel(entry)}
        </p>
      ))}
    </div>
  );
};

const parseNumeric = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const normalizeStatusLabel = (value?: string | null) => {
  if (!value) {
    return STATUS_LABEL_PAYMENT_NOT_RECEIVED;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return STATUS_LABEL_PAYMENT_NOT_RECEIVED;
  }
  const normalized = trimmed.toLowerCase();
  if (
    normalized === STATUS_LABEL_PAYMENT_RECEIVED.toLowerCase() ||
    normalized === 'pooja completed' ||
    normalized === 'admin action is pending'
  ) {
    return STATUS_LABEL_PAYMENT_RECEIVED;
  }
  if (normalized === 'payment not received') {
    return STATUS_LABEL_PAYMENT_NOT_RECEIVED;
  }
  return STATUS_LABEL_PAYMENT_NOT_RECEIVED;
};

const getRecordTimestamp = (record: PaymentRecordEntry) => {
  const parseTimestamp = (value?: string | null) => {
    if (!value) {
      return NaN;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? NaN : parsed;
  };

  const createdAt = parseTimestamp(record.created_at);
  if (!Number.isNaN(createdAt)) {
    return createdAt;
  }

  const startDate = parseTimestamp(record.registration_start_date);
  if (!Number.isNaN(startDate)) {
    return startDate;
  }

  return 0;
};

const convertSnapshotToRecords = (snapshot: CartSnapshotRecord): PaymentRecordEntry[] => {
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  return items.map((item) => {
    const startDate = item.customDayDate ?? item.bookingDate ?? null;
    const dueValue = Number(item.amount);
    const numericDue = Number.isFinite(dueValue) ? dueValue : 0;
    const uniqueId = `cart-${snapshot.donor_id ?? 'unknown'}-${item.cartId}`;
    return {
      id: uniqueId,
      donor: snapshot.donor_id ?? null,
      donor_name: snapshot.donor_name ?? null,
      pooja_option: item.poojaName ?? item.poojaCode ?? 'Cart item',
      registration: null,
      registration_start_date: startDate,
      registration_total_amount: numericDue,
      pooja_due_amount: numericDue,
      amount: 0,
      transaction_reference: null,
      status: 'pending',
      registration_status: 'pending',
      registration_donor_name: snapshot.donor_name ?? null,
      registration_is_group_registration: Boolean(item.recurrenceKind),
      created_at: snapshot.updated_at ?? startDate ?? null,
    };
  });
};

const resolveRegisteredByLabel = (record: PaymentRecordEntry) =>
  record.registration_donor_name || '—';

const resolveBookedByLabel = (record: PaymentRecordEntry) => record.donor_name || '—';

const getClubBadgeClasses = (label: string) =>
  CLUB_STYLES[label] ?? 'bg-slate-100 text-slate-700';

const getTimeframeRange = (reference: Date, timeframe: TimeframeOption) => {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  switch (timeframe) {
    case 'day': {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case 'week': {
      const dayIndex = start.getDay();
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() - dayIndex);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      return { start: weekStart, end: weekEnd };
    }
    case 'month': {
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { start: monthStart, end: monthEnd };
    }
    case 'year': {
      const yearStart = new Date(start.getFullYear(), 0, 1);
      const yearEnd = new Date(start.getFullYear() + 1, 0, 1);
      return { start: yearStart, end: yearEnd };
    }
  }
};

const buildRangeLabel = (reference: Date, timeframe: TimeframeOption) => {
  const start = getTimeframeRange(reference, timeframe).start;
  switch (timeframe) {
    case 'day':
      return `Day of ${formatDisplayDate(start.toISOString())}`;
    case 'week': {
      const weekEnd = new Date(start);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `Week of ${formatDisplayDate(start.toISOString())} – ${formatDisplayDate(
        weekEnd.toISOString(),
      )}`;
    }
    case 'month':
      return `Month of ${start.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      })}`;
    case 'year':
      return `Year ${start.getFullYear()}`;
  }
};

const STATUS_OPTIONS = [
  STATUS_LABEL_PAYMENT_NOT_RECEIVED,
  STATUS_LABEL_PAYMENT_RECEIVED,
];

const CLUB_OPTIONS = ['Yes', 'No'] as const;

const STATUS_OVERRIDES_STORAGE_KEY = 'payment-statement-status-overrides';
const CLUB_OVERRIDES_STORAGE_KEY = 'payment-statement-club-overrides';

const PaymentStatementPage = () => {
  const [records, setRecords] = useState<PaymentRecordEntry[]>([]);
  const [registrations, setRegistrations] = useState<PoojaRegistrationEntry[]>([]);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [registrationsVersion, setRegistrationsVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('month');
  const referenceDateValue = useMemo(() => new Date(), []);
  const [donorSearchTerm, setDonorSearchTerm] = useState('');
  const [appliedDonorFilter, setAppliedDonorFilter] = useState('');
  const normalizedDonorSearchTerm = donorSearchTerm.trim();
  const canApplyDonorFilter =
    normalizedDonorSearchTerm.length > 0 && normalizedDonorSearchTerm !== appliedDonorFilter;
  const user = useAuthStore((state) => state.user);
  const isAdminUser = Boolean(user && isAdmin(user.role));
  const showDonorFilter = isAdminUser;
  const [statusOverrideMap, setStatusOverrideMap] = useState<Record<string, string>>({});
  const [clubOverrideMap, setClubOverrideMap] = useState<Record<string, string>>({});
  const [cartSnapshots, setCartSnapshots] = useState<CartSnapshotRecord[]>([]);
  const [cartSnapshotsVersion, setCartSnapshotsVersion] = useState(0);
  const combineRole = useCombineAccessStore((state) => state.role);
  const combinedTo = useCombineAccessStore((state) => state.combinedTo);
  const combineLoading = useCombineAccessStore((state) => state.loading);
  const combineError = useCombineAccessStore((state) => state.error);
  const fetchCombineAccess = useCombineAccessStore((state) => state.fetchAccess);

  const applyOverrides = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    setStatusOverrideMap((prev) => {
      const next = updater(prev);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STATUS_OVERRIDES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  };

  const applyClubOverrides = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    setClubOverrideMap((prev) => {
      const next = updater(prev);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(CLUB_OVERRIDES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STATUS_OVERRIDES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          const entries = Object.entries(parsed);
          if (entries.length > 0) {
            const normalized: Record<string, string> = {};
            entries.forEach(([key, value]) => {
              if (typeof value === 'string') {
                normalized[key] = normalizeStatusLabel(value);
              }
            });
            setStatusOverrideMap(normalized);
            try {
              window.localStorage.setItem(
                STATUS_OVERRIDES_STORAGE_KEY,
                JSON.stringify(normalized),
              );
            } catch {
              // ignore storage errors
            }
          }
        }
      }
      const clubStored = window.localStorage.getItem(CLUB_OVERRIDES_STORAGE_KEY);
      if (clubStored) {
        const parsedClub = JSON.parse(clubStored);
        if (typeof parsedClub === 'object' && parsedClub !== null) {
          setClubOverrideMap(parsedClub as Record<string, string>);
        }
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (combineRole === null && !combineLoading && !combineError) {
      fetchCombineAccess();
    }
  }, [combineRole, combineLoading, combineError, fetchCombineAccess]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleSnapshotUpdated = () => {
      setCartSnapshotsVersion((prev) => prev + 1);
    };
    window.addEventListener(POOJA_CART_SNAPSHOT_UPDATED_EVENT, handleSnapshotUpdated);
    return () => {
      window.removeEventListener(POOJA_CART_SNAPSHOT_UPDATED_EVENT, handleSnapshotUpdated);
    };
  }, []);

  const updateStatus = async (record: PaymentRecordEntry, label: string) => {
    const paymentId = typeof record.id === 'number' ? record.id : null;
    const registrationId = record.registration ?? null;
    const transitionMap: Record<string, { payment?: string; registration?: string }> = {
      [STATUS_LABEL_PAYMENT_RECEIVED]: { payment: 'success', registration: 'pending' },
      [STATUS_LABEL_PAYMENT_NOT_RECEIVED]: { payment: 'pending', registration: 'pending' },
    };
    const transition = transitionMap[label];
    if (!transition) {
      return;
    }
    const operations: Promise<any>[] = [];
    if (paymentId !== null && transition.payment) {
      operations.push(api.patch(`payments/records/${paymentId}/`, { status: transition.payment }));
    }
    if (registrationId !== null && transition.registration) {
      operations.push(
        api.patch(`pooja/registrations/${registrationId}/`, { status: transition.registration }),
      );
    }
    if (operations.length === 0) {
      return;
    }
    await Promise.all(operations);
  };

  const handleStatusChange = async (record: PaymentRecordEntry, label: string) => {
    const key = recordKey(record);
    applyOverrides((prev) => ({ ...prev, [key]: label }));
    try {
      await updateStatus(record, label);
      setRecordsVersion((prev) => prev + 1);
      setRegistrationsVersion((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to update status', err);
      applyOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadRecords = async () => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, string | number> = {
          page_size: 250,
          ordering: '-created_at',
        };
        if (appliedDonorFilter) {
          params.donor = appliedDonorFilter;
        }
        const response = await api.get('payments/records/', {
          params,
        });
        if (!isMounted) {
          return;
        }
        const payload = extractResults<PaymentRecordEntry>(response.data);
        setRecords(payload);
      } catch (exc) {
        if (!isMounted) {
          return;
        }
        setError('Unable to fetch payment records. Please try again.');
        console.error(exc);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadRecords();
    return () => {
      isMounted = false;
    };
  }, [appliedDonorFilter, recordsVersion]);

  useEffect(() => {
    let isMounted = true;
    const loadRegistrations = async () => {
      try {
        const params: Record<string, string | number> = {
          page_size: 250,
          ordering: '-created_at',
        };
        if (appliedDonorFilter) {
          params.donor = appliedDonorFilter;
        }
        const response = await api.get('pooja/registrations/', {
          params,
        });
        if (!isMounted) {
          return;
        }
        const payload = extractResults<PoojaRegistrationEntry>(response.data);
        setRegistrations(payload);
      } catch (exc) {
        if (!isMounted) {
          return;
        }
        console.error('Unable to fetch registrations for donor filter', exc);
      }
    };
    loadRegistrations();
    return () => {
      isMounted = false;
    };
  }, [appliedDonorFilter, registrationsVersion]);

  useEffect(() => {
    let isMounted = true;

    if (!isAdminUser) {
      setCartSnapshots([]);
      return () => {
        isMounted = false;
      };
    }

    const loadCartSnapshots = async () => {
      try {
        const params: Record<string, string> = {};
        if (appliedDonorFilter) {
          params.phone = appliedDonorFilter;
        }
        const response = await api.get<CartSnapshotRecord[]>('pooja/cart-snapshots/report/', {
          params: Object.keys(params).length ? params : undefined,
        });
        if (!isMounted) {
          return;
        }
        const payload: CartSnapshotRecord[] = Array.isArray(response.data) ? response.data : [];
        setCartSnapshots(payload);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        console.error('Unable to load cart snapshots', err);
        setCartSnapshots([]);
      }
    };
    loadCartSnapshots();
    return () => {
      isMounted = false;
    };
  }, [appliedDonorFilter, cartSnapshotsVersion, isAdminUser]);

  const handleApplyDonorFilter = () => {
    if (!isAdminUser || !canApplyDonorFilter) {
      return;
    }
    setAppliedDonorFilter(normalizedDonorSearchTerm);
  };

  const handleClearDonorFilter = () => {
    if (!isAdminUser) {
      return;
    }
    setDonorSearchTerm('');
    setAppliedDonorFilter('');
  };

  const resolveStatusLabel = (record: PaymentRecordEntry) => {
    const status = (record.status ?? '').toLowerCase();
    const paidAmount = parseNumeric(record.amount);
    const hasTransactionReference = Boolean(
      typeof record.transaction_reference === 'string' &&
        record.transaction_reference.trim().length > 0,
    );

    if (status === 'success' || paidAmount > 0 || hasTransactionReference) {
      return STATUS_LABEL_PAYMENT_RECEIVED;
    }
    return STATUS_LABEL_PAYMENT_NOT_RECEIVED;
  };

  const mergedRecords = useMemo(() => {
    if (!records.length && !registrations.length && !cartSnapshots.length) {
      return [];
    }
    const paidRegistrationIds = new Set<number>();
    records.forEach((record) => {
      if (typeof record.registration === 'number') {
        paidRegistrationIds.add(record.registration);
      }
    });
    const remainingRegistrations = registrations.filter(
      (registration) => !paidRegistrationIds.has(registration.id),
    );
    const registrationRecords: PaymentRecordEntry[] = remainingRegistrations.map(
        (registration) => ({
          id: `registration-${registration.id}`,
          donor: registration.donor ?? null,
          donor_name: registration.donor_name ?? null,
          pooja_option: registration.pooja_option_name ?? null,
          registration: registration.id,
          registration_start_date: registration.start_date ?? null,
          registration_total_amount: registration.total_amount ?? null,
          pooja_due_amount: registration.total_amount ?? null,
          amount: 0,
          transaction_reference: null,
          status: 'pending',
          registration_status: registration.status ?? null,
          created_at: registration.created_at ?? null,
          registration_donor_name: registration.donor_name ?? null,
          registration_is_group_registration: registration.is_group_registration ?? false,
        }),
      );
    const cartRecords = cartSnapshots.flatMap((snapshot) => convertSnapshotToRecords(snapshot));
    return [...records, ...registrationRecords, ...cartRecords];
  }, [records, registrations, cartSnapshots]);

  const range = useMemo(
    () => getTimeframeRange(referenceDateValue, timeframe),
    [referenceDateValue, timeframe],
  );

  const filteredRecords = useMemo(() => {
    if (!mergedRecords.length) {
      return [];
    }
    if (!range) {
      return mergedRecords;
    }
    const isInRange = (value?: string | null) => {
      if (!value) {
        return false;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return false;
      }
      return parsed >= range.start && parsed < range.end;
    };
    return mergedRecords.filter(
      (record) => isInRange(record.registration_start_date) || isInRange(record.created_at),
    );
  }, [mergedRecords, range]);

  const recordKey = (record: PaymentRecordEntry) => record.id.toString();
  const getStatusLabel = (record: PaymentRecordEntry) =>
    statusOverrideMap[recordKey(record)] ?? resolveStatusLabel(record);
  const getClubSelectionLabel = (record: PaymentRecordEntry) => {
    const override = clubOverrideMap[recordKey(record)];
    if (override) {
      return override;
    }
    return record.registration_is_group_registration ? 'Yes' : 'No';
  };

const getDisplayedDueAmountValue = (record: PaymentRecordEntry) => {
  const statusLabel = getStatusLabel(record);
  if (statusLabel === STATUS_LABEL_PAYMENT_NOT_RECEIVED) {
    const pendingAmount = parseNumeric(record.amount);
    if (pendingAmount > 0) {
      return pendingAmount;
    }
  }
  return parseNumeric(record.pooja_due_amount ?? record.registration_total_amount);
};

const getDisplayedPaidAmountValue = (record: PaymentRecordEntry) => {
  const statusLabel = getStatusLabel(record);
  if (statusLabel === STATUS_LABEL_PAYMENT_NOT_RECEIVED) {
    return 0;
  }
  return parseNumeric(record.amount);
};

const buildTransactionDetails = (record: PaymentRecordEntry) => {
  const pieces = [];
  if (record.pooja_option) {
    pieces.push(record.pooja_option);
  }
  if (record.transaction_reference) {
    pieces.push(`Tx: ${record.transaction_reference}`);
  }
  if (record.registration_donor_name) {
    pieces.push(`Booked by ${record.registration_donor_name}`);
  }
  return pieces.join(' • ') || '—';
};

  const formatFilenameDate = (value: Date) =>
    value.toISOString().replace(/[:.]/g, '').replace(/-/g, '').slice(0, 15);

  const clubValueToBool = (label: string) => label === 'Yes';

  const handleClubChange = async (record: PaymentRecordEntry, label: string) => {
    if (typeof record.registration !== 'number') {
      return;
    }
    const key = recordKey(record);
    applyClubOverrides((prev) => ({ ...prev, [key]: label }));
    try {
      await api.patch(`pooja/registrations/${record.registration}/`, {
        is_group_registration: clubValueToBool(label),
      });
      setRecordsVersion((prev) => prev + 1);
      setRegistrationsVersion((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to update club payment flag', err);
      applyClubOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const buildDownloadRows = (rows: PaymentRecordEntry[]) =>
    rows.map((record, idx) => ({
      'S.no': idx + 1,
      'Donor ID': record.donor ?? '—',
      'Donor Name': record.donor_name ?? '—',
      Pooja: record.pooja_option ?? '—',
      'Upcoming Dates': record.upcoming_occurrences
        ? record.upcoming_occurrences.map((entry) => formatUpcomingOccurrenceLabel(entry)).join('; ')
        : '—',
      'Pooja Date': record.registration_start_date
        ? formatDisplayDate(record.registration_start_date)
        : formatDisplayDate(record.created_at ?? ''),
      'Pooja Due Amount': formatCurrency(getDisplayedDueAmountValue(record)),
      'Paid Amount': formatCurrency(getDisplayedPaidAmountValue(record)),
      'Transaction ID': record.transaction_reference || '—',
      'Pooja Registered by': record.registration_donor_name ?? '—',
      'Pooja Booked by': record.donor_name ?? '—',
      'Club Payment': getClubSelectionLabel(record),
      Status: getStatusLabel(record),
    }));

  const handleDownloadPdf = async () => {
    // Ensure this only runs in a browser
    if (typeof window === 'undefined' || typeof globalThis === 'undefined') {
      console.error('PDF download is only available in the browser');
      return;
    }

    try {
      const rows = buildDownloadRows(filteredRecords);
      const pdfMakeInstance = await loadPdfMake();
      const docDefinition: TDocumentDefinitions = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        content: [
          { text: 'Payment Statement', style: 'header' },
          { text: rangeLabel, style: 'subheader', margin: [0, 0, 0, 8] },
          { text: `Records: ${filteredRecords.length}`, style: 'subheader' },
          {
              table: {
                headerRows: 1,
                widths: [
                  'auto',
                  'auto',
                  '*',
                  '*',
                  'auto',
                  'auto',
                  'auto',
                  '*',
                  '*',
                  '*',
                  'auto',
                  'auto',
                ],
                body: [
                  [
                    'S.no',
                    'Donor ID',
                  'Donor Name',
                  'Pooja',
                  'Pooja Date',
                  'Due Amount',
                    'Paid Amount',
                    'Transaction ID',
                    'Pooja Registered by',
                    'Pooja Booked by',
                    'Club Payment',
                    'Status',
                  ],
                ...rows.map((row) => Object.values(row)),
              ],
            },
            layout: 'lightHorizontalLines',
          },
        ],
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
          subheader: { fontSize: 12, margin: [0, 0, 0, 2] },
        },
      };

      const triggerBlobDownload = (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${downloadFilenameBase}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      };

      const pdfDoc: any = pdfMakeInstance.createPdf(docDefinition);

      if (typeof pdfDoc.download === 'function') {
        pdfDoc.download(`${downloadFilenameBase}.pdf`);
        return;
      }

      if (typeof pdfDoc.getBlob === 'function') {
        pdfDoc.getBlob((blob: Blob) => {
          triggerBlobDownload(blob);
        });
        return;
      }

      if (typeof pdfDoc.getBuffer === 'function') {
        // Extra guard for Blob in browser
        if (
          typeof globalThis === 'undefined' ||
          typeof (globalThis as any).Blob === 'undefined'
        ) {
          console.error('Browser Blob API unavailable for PDF download');
          return;
        }

        pdfDoc.getBuffer((buffer: Uint8Array | ArrayBuffer) => {
          const array =
            buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
          const blob = new (globalThis as any).Blob([array], {
            type: 'application/pdf',
          });
          triggerBlobDownload(blob);
        });
        return;
      }

      console.error('PDF download method unavailable');
    } catch (error) {
      console.error('Failed to generate payment statement PDF', error);
    }
  };

  const handleDownloadExcel = () => {
    const rows = buildDownloadRows(filteredRecords);
    const headerKeys =
      rows.length > 0
        ? Object.keys(rows[0])
        : [
            'S.no',
            'Donor ID',
            'Donor Name',
            'Pooja',
            'Pooja Date',
            'Pooja Due Amount',
            'Paid Amount',
            'Transaction ID',
            'Pooja Registered by',
            'Pooja Booked by',
            'Club Payment',
            'Status',
          ];
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headerKeys });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');
    XLSX.writeFile(workbook, `${downloadFilenameBase}.xlsx`);
  };

  const orderedRecords = useMemo(() => {
    if (!filteredRecords.length) {
      return filteredRecords;
    }

    const compareByTimestampDesc = (a: PaymentRecordEntry, b: PaymentRecordEntry) =>
      getRecordTimestamp(b) - getRecordTimestamp(a);

    return [...filteredRecords].sort(compareByTimestampDesc);
  }, [filteredRecords]);

  const passbookEntries = useMemo(() => {
    if (!filteredRecords.length) {
      return [];
    }
    const sorted = [...filteredRecords].sort(
      (a, b) => getRecordTimestamp(a) - getRecordTimestamp(b),
    );
    let runningBalance = 0;
    return sorted.map((record) => {
      const dueAmount = getDisplayedDueAmountValue(record);
      const paidAmount = getDisplayedPaidAmountValue(record);
      runningBalance += dueAmount - paidAmount;
      return {
        record,
        dueAmount,
        paidAmount,
        closingDue: Math.max(0, runningBalance),
      };
    });
  }, [filteredRecords, statusOverrideMap]);

  const totalPaid = useMemo(
    () => filteredRecords.reduce((sum, record) => sum + getDisplayedPaidAmountValue(record), 0),
    [filteredRecords, statusOverrideMap],
  );

  const totalDue = useMemo(
    () =>
      filteredRecords.reduce((sum, record) => sum + getDisplayedDueAmountValue(record), 0),
    [filteredRecords, statusOverrideMap],
  );

  const rangeLabel = useMemo(
    () => buildRangeLabel(referenceDateValue, timeframe),
    [referenceDateValue, timeframe],
  );

  const downloadFilenameBase = useMemo(() => {
    const label = rangeLabel.replace(/\W+/g, '-').replace(/-+/g, '-').toLowerCase();
    return `payment-statement-${label}-${formatFilenameDate(new Date())}`;
  }, [rangeLabel]);
  const parentName = combinedTo?.name ?? 'Parent donor';
  const parentPhone = combinedTo?.phone ?? 'Phone not available';
  const effectiveFromLabel = formatCombineMonthLabel(combinedTo?.effectiveFrom);
  const uncombineFromLabel = formatCombineMonthLabel(combinedTo?.effectiveTo);
  const effectiveRange = [
    effectiveFromLabel ? `Effective from ${effectiveFromLabel}` : null,
    uncombineFromLabel ? `Uncombine from ${uncombineFromLabel}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  if (combineRole === 'subordinate') {
    return (
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-rose-200 bg-white/80 p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-800">Payment history managed by another donor</h1>
            <p className="text-sm text-slate-600">
              Your payment records are overseen by {parentName} ({parentPhone}). Connect with them to access history.
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
              Payment history is unavailable for this profile.
            </p>
          </div>
          {effectiveRange && (
            <p className="text-xs text-slate-500">{effectiveRange}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-semibold text-slate-800">Payment Statement</h1>
          <p className="text-sm text-slate-500">
            {rangeLabel} • {filteredRecords.length} record
            {filteredRecords.length === 1 ? '' : 's'}
          </p>
          {appliedDonorFilter && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Filtering for donor <span className="text-slate-700">{appliedDonorFilter}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading || filteredRecords.length === 0}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={loading || filteredRecords.length === 0}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Download Excel
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {TIMEFRAME_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setTimeframe(filter.value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                timeframe === filter.value
                  ? 'border-orange-600 bg-orange-600 text-white shadow-[0_10px_20px_-12px_rgba(234,88,12,0.95)]'
                  : 'border-slate-200 text-slate-600 hover:border-orange-200 hover:text-orange-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {showDonorFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="donor-filter" className="text-sm font-semibold text-slate-600">
              Search By Donor Phone Number
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="donor-filter"
                type="search"
                value={donorSearchTerm}
                onChange={(event) => setDonorSearchTerm(event.target.value)}
                placeholder="e.g. 7894561231"
                className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={handleApplyDonorFilter}
                disabled={!canApplyDonorFilter}
                className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-orange-200"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleClearDonorFilter}
                disabled={!appliedDonorFilter}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Donor view is read-only; admins can filter by other donors.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">No of Pooja</p>
          <p className="text-2xl font-semibold text-slate-800">{filteredRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Paid Amount</p>
          <p className="text-2xl font-semibold text-slate-800">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Due Amount</p>
          <p className="text-2xl font-semibold text-slate-800">{formatCurrency(totalDue)}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        {isAdminUser ? (
          <>
            <div className="hidden rounded-t-2xl md:block">
              <div className="max-h-[720px] overflow-auto">
                <table className="w-full min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">S.no</th>
                      <th className="px-4 py-3 text-left font-semibold">Donor Id</th>
                      <th className="px-4 py-3 text-left font-semibold">Donor Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Pooja</th>
                      <th className="px-4 py-3 text-left font-semibold">Pooja Date</th>
                      <th className="px-4 py-3 text-right font-semibold">Pooja Due Amount</th>
                      <th className="px-4 py-3 text-right font-semibold">Paid Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Transaction Id</th>
                      <th className="px-4 py-3 text-left font-semibold">Pooja Registered by</th>
                      <th className="px-4 py-3 text-left font-semibold">Pooja Booked by</th>
                      <th className="px-4 py-3 text-center font-semibold">Club Payment</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderedRecords.map((record, idx) => {
                      const statusKey = getStatusLabel(record);
                      const statusClasses =
                        STATUS_STYLES[statusKey] ?? 'bg-slate-100 text-slate-700';
                      const clubLabel = getClubSelectionLabel(record);
                      const clubClasses = getClubBadgeClasses(clubLabel);
                      const displayedDueAmount = getDisplayedDueAmountValue(record);
                      return (
                        <tr key={record.id}>
                          <td className="px-4 py-3 font-medium text-slate-600">{idx + 1}</td>
                          <td className="px-4 py-3 text-slate-600">{record.donor ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{record.donor_name || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <div>{record.pooja_option || '—'}</div>
                            {renderUpcomingOccurrenceList(record.upcoming_occurrences)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDisplayDate(record.registration_start_date)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatCurrency(displayedDueAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatCurrency(getDisplayedPaidAmountValue(record))}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {record.transaction_reference || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {resolveRegisteredByLabel(record)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {resolveBookedByLabel(record)}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-800">
                            {isAdminUser && typeof record.registration === 'number' ? (
                              <select
                                value={clubLabel}
                                onChange={(event) => handleClubChange(record, event.target.value)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide focus:outline-none ${clubClasses}`}
                              >
                                {CLUB_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${clubClasses}`}
                              >
                                {clubLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isAdminUser ? (
                              <select
                                value={statusKey}
                                onChange={(event) =>
                                  handleStatusChange(record, event.target.value)
                                }
                                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses} focus:outline-none`}
                              >
                                {STATUS_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses}`}
                              >
                                {statusKey}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-col md:hidden">
              {orderedRecords.map((record, idx) => {
                const statusKey = getStatusLabel(record);
                const statusClasses =
                  STATUS_STYLES[statusKey] ?? 'bg-slate-100 text-slate-700';
                const clubLabel = getClubSelectionLabel(record);
                const clubClasses = getClubBadgeClasses(clubLabel);
                return (
                  <div
                    key={record.id}
                    className="border-b border-slate-100 px-4 py-4 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">
                        #{idx + 1} •{' '}
                        <span className="font-normal text-slate-500">
                          {record.donor_name || '—'}
                        </span>
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses}`}
                      >
                        {statusKey}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Donor ID</span>
                        <span>{record.donor ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Pooja</span>
                        <span>{record.pooja_option || '—'}</span>
                      </div>
                      {renderUpcomingOccurrenceList(record.upcoming_occurrences)}
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Pooja Date</span>
                        <span>{formatDisplayDate(record.registration_start_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Due Amount</span>
                        <span>{formatCurrency(getDisplayedDueAmountValue(record))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Paid Amount</span>
                        <span>{formatCurrency(getDisplayedPaidAmountValue(record))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Transaction ID</span>
                        <span className="text-slate-400">
                          {record.transaction_reference || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Pooja Registered by</span>
                        <span className="text-slate-600">{resolveRegisteredByLabel(record)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Pooja Booked by</span>
                        <span className="text-slate-600">{resolveBookedByLabel(record)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Club Payment</span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wide ${clubClasses}`}
                        >
                          {clubLabel}
                        </span>
                      </div>
                      {isAdminUser && (
                        <div className="mt-2">
                          <select
                            value={statusKey}
                            onChange={(event) => handleStatusChange(record, event.target.value)}
                            className={`w-full rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses} focus:outline-none`}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {isAdminUser && typeof record.registration === 'number' && (
                        <div className="mt-2">
                          <select
                            value={getClubSelectionLabel(record)}
                            onChange={(event) => handleClubChange(record, event.target.value)}
                            className="w-full rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 focus:outline-none"
                          >
                            {CLUB_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="hidden rounded-t-2xl md:block">
              <div className="max-h-[720px] overflow-auto">
                <table className="w-full min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">S.no</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Transaction Details</th>
                      <th className="px-4 py-3 text-right font-semibold">Due for current month</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount received</th>
                      <th className="px-4 py-3 text-right font-semibold">Closing balance due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {passbookEntries.map((entry, idx) => (
                      <tr key={entry.record.id}>
                        <td className="px-4 py-3 font-medium text-slate-600">{idx + 1}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDisplayDate(entry.record.created_at ?? entry.record.registration_start_date)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {buildTransactionDetails(entry.record)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatCurrency(entry.dueAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatCurrency(entry.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatCurrency(entry.closingDue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-col md:hidden">
              {passbookEntries.map((entry, idx) => (
                <div
                  key={`${entry.record.id}-mobile`}
                  className="border-b border-slate-100 px-4 py-4 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">
                      #{idx + 1} •{' '}
                      <span className="font-normal text-slate-500">
                        {formatDisplayDate(entry.record.created_at ?? entry.record.registration_start_date)}
                      </span>
                    </p>
                  </div>
                  <div className="mt-2 space-y-2 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-600">Transaction Details</p>
                      <p className="text-slate-700">{buildTransactionDetails(entry.record)}</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Due for current month</span>
                      <span>{formatCurrency(entry.dueAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Amount received</span>
                      <span>{formatCurrency(entry.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Closing balance due</span>
                      <span>{formatCurrency(entry.closingDue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {loading && (
          <div className="px-4 py-5 text-sm text-slate-500">
            Loading based on selected timeframe…
          </div>
        )}
        {!loading && !filteredRecords.length && !error && (
          <div className="px-4 py-5 text-sm text-slate-500">
            No payments found for this range.
          </div>
        )}
        {error && (
          <div className="px-4 py-5 text-sm text-rose-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentStatementPage;
