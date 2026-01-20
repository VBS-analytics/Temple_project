'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { TDocumentDefinitions } from 'pdfmake/interfaces';

import api, { extractResults } from '../../lib/api';
import { loadPdfMake } from '../../lib/pdfMakeLoader';
import { useCurrentBalance } from '../../hooks/useCurrentBalance';
import { useCartStore } from '../../store/cart';
import type { CartItem } from '../../store/cart';
import { isAdmin, useAuthStore } from '../../store/auth';
import { useCombineAccessStore } from '../../store/combineAccess';
import * as XLSX from 'xlsx';
import { POOJA_CART_SNAPSHOT_UPDATED_EVENT } from '../../constants/events';

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
  payment_month?: string | null;
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

interface CartSnapshotItem {
  cartId?: string | null;
  poojaName?: string | null;
  poojaCode?: string | null;
  amount?: string | number | null;
  bookingDate?: string | null;
  customDayDate?: string | null;
  dayOptionOccurrences?: { date?: string | null; label?: string | null }[];
  recurrenceKind?: unknown;
}

type CartLikeItem = CartItem | CartSnapshotItem;

interface CartSnapshotRecord {
  donor_id?: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  items?: CartSnapshotItem[] | null;
  updated_at?: string | null;
}

interface DonorListEntry {
  user: {
    id: number;
    name?: string | null;
    phone_number?: string | null;
  };
}

interface DonorNameOption {
  id: number;
  label: string;
}

interface DonorNameMultiSelectProps {
  options: DonorNameOption[];
  selectedIds: number[];
  onToggleId: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
}

function DonorNameMultiSelect({
  options,
  selectedIds,
  onToggleId,
  disabled = false,
  placeholder = 'Select donor names',
}: DonorNameMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const hasOptions = options.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!hasOptions) {
      setOpen(false);
      setSearchTerm('');
    }
  }, [hasOptions]);

  const toggleDropdown = () => {
    if (disabled || !hasOptions) {
      return;
    }
    setOpen((prev) => !prev);
  };

  const selectedCount = selectedIds.length;
  const label =
    selectedCount > 0
      ? `${selectedCount} donor${selectedCount === 1 ? '' : 's'} selected`
      : placeholder;

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedSearchTerm) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearchTerm),
    );
  }, [options, normalizedSearchTerm]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-600 transition hover:border-orange-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        onClick={toggleDropdown}
        disabled={disabled || !hasOptions}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="px-3 py-2">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search donor"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
          </div>
          <div className="max-h-48 overflow-auto">
            {filteredOptions.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {filteredOptions.map((option) => {
                  const checked = selectedIds.includes(option.id);
                  return (
                    <li key={`donor-option-${option.id}`}>
                      <label className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <span className="truncate">{option.label}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                          checked={checked}
                          onChange={() => onToggleId(option.id)}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-2 text-xs text-slate-500">No donors match your search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface MonthOption {
  value: string;
  label: string;
}

interface MonthRangeSelectProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

function MonthRangeSelect({ value, onChange, onClear }: MonthRangeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const monthOptions = useMemo(() => {
    const options: MonthOption[] = [];
    const startDate = new Date(2025, 11); // December 2025
    const endDate = new Date(2030, 11); // December 2030

    for (let date = new Date(startDate); date <= endDate; date.setMonth(date.getMonth() + 1)) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthValue = `${year}-${month}`;
      const label = date.toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      });
      options.push({ value: monthValue, label });
    }
    return options;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const selectedLabel = useMemo(() => {
    const selected = monthOptions.find((option) => option.value === value);
    return selected ? selected.label : 'Select month';
  }, [value, monthOptions]);

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-600 transition hover:border-orange-400 hover:text-slate-800"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-auto">
            <ul className="divide-y divide-slate-100">
              {monthOptions.map((option) => {
                const isSelected = value === option.value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? 'bg-orange-100 font-semibold text-orange-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL_PAYMENT_RECEIVED = 'Payment Received';
const STATUS_LABEL_PAYMENT_NOT_RECEIVED = 'Payment Not Received';

type PaymentStatusFilter = 'all' | 'due' | 'paid';

const PAYMENT_STATUS_FILTERS: { id: PaymentStatusFilter; label: string }[] = [
  { id: 'all', label: 'All payments' },
  { id: 'due', label: 'Due for current month (Not paid)' },
  { id: 'paid', label: 'Amount received (Paid)' },
];


const CURRENT_BALANCE_ENTRY_ID = 'current-balance-entry';
const CURRENT_BALANCE_ENTRY_DATE = '2025-12-31';
const CURRENT_BALANCE_ENTRY_DISPLAY_DATE = '31/12/2025';

type PassbookEntry = {
  record: PaymentRecordEntry;
  dueAmount: number;
  paidAmount: number;
  closingDue: number;
  openingBalance: number;
  displayDate?: string;
  isCurrentBalanceEntry?: boolean;
  entryType?: 'due' | 'paid';
};

type AdminDonorPassbookGroup = {
  id: string;
  donorId: number | null;
  label: string;
  entries: PassbookEntry[];
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
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getRecordDateValue = (record: PaymentRecordEntry) =>
  record.payment_month ?? record.created_at ?? record.registration_start_date ?? null;

const formatMonthYearFromDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('en-IN', {
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

const formatYearMonthLabel = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  const [yearPart, monthPart] = normalized.split('-');
  if (!yearPart || !monthPart) {
    return null;
  }
  const parsedYear = Number(yearPart);
  const parsedMonth = Number(monthPart);
  if (
    Number.isNaN(parsedYear) ||
    Number.isNaN(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12
  ) {
    return null;
  }
  const parsed = new Date(parsedYear, parsedMonth - 1, 1);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};

const getRecordMonthKey = (record: PaymentRecordEntry) => {
  const dateValue = getRecordDateValue(record);
  if (!dateValue) {
    return null;
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatFilenameDate = (value: Date) =>
  value.toISOString().replace(/[:.]/g, '').replace(/-/g, '').slice(0, 15);

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

  const preferredDate = getRecordDateValue(record);
  if (preferredDate) {
    const preferredTimestamp = parseTimestamp(preferredDate);
    if (!Number.isNaN(preferredTimestamp)) {
      return preferredTimestamp;
    }
  }

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

const computeCartAggregate = (items: CartLikeItem[]) => {
  const totalDue = items.reduce((sum, item) => sum + parseNumeric(item.amount), 0);
  const dateCandidates = items
    .map((item) => item.customDayDate ?? item.bookingDate)
    .filter((value): value is string => Boolean(value));
  const earliestDate =
    dateCandidates
      .slice()
      .sort()
      .shift() ?? new Date().toISOString();
  const names = items
    .map((item) => item.poojaName ?? item.poojaCode ?? null)
    .filter((value): value is string => Boolean(value));
  const occurrences = items.flatMap((item) =>
    Array.isArray(item.dayOptionOccurrences)
      ? item.dayOptionOccurrences
          .filter((entry): entry is { date: string; label?: string | null } =>
            entry !== null && entry !== undefined && typeof entry.date === 'string' && entry.date !== ''
          )
          .map((entry) => ({ date: entry.date, label: entry.label ?? null }))
      : [],
  );
  const hasRecurrence = items.some((item) => Boolean(item.recurrenceKind));
  return { totalDue, earliestDate, names, occurrences, hasRecurrence };
};

const convertSnapshotToRecords = (snapshot: CartSnapshotRecord): PaymentRecordEntry[] => {
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  if (!items.length) {
    return [];
  }
  const { totalDue, earliestDate, names, occurrences, hasRecurrence } = computeCartAggregate(items);
  const snapshotLabel = (snapshot.donor_name ?? '').trim() || 'Cart snapshot';
  const idSuffix = snapshot.updated_at ?? earliestDate ?? new Date().toISOString();
  const snapshotId = `cart-snapshot-${snapshot.donor_id ?? 'unknown'}-${idSuffix}`;
  const poojaLabel =
    names.length > 0
      ? names.join(', ')
      : `Cart snapshot — ${items.length} item${items.length === 1 ? '' : 's'}`;
  return [
    {
      id: snapshotId,
      donor: snapshot.donor_id ?? null,
      donor_name: snapshot.donor_name ?? null,
      pooja_option: poojaLabel,
      registration: null,
      registration_start_date: earliestDate,
      registration_total_amount: totalDue,
      pooja_due_amount: totalDue,
      amount: 0,
      transaction_reference: null,
      status: 'pending',
      registration_status: 'pending',
      registration_donor_name: snapshot.donor_name ?? null,
      registration_is_group_registration: hasRecurrence,
      created_at: snapshot.updated_at ?? earliestDate ?? null,
      payment_month: earliestDate,
      upcoming_occurrences: occurrences,
    },
  ];
};

const convertCartItemToRecord = (
  item: CartItem,
  donorId?: number | null,
  donorName?: string | null,
): PaymentRecordEntry => {
  const startDate = item.customDayDate ?? item.bookingDate ?? null;
  const dueAmount = parseNumeric(item.amount);
  const uniqueId = `cart-local-${item.cartId}`;
  const displayName = (donorName ?? item.fullName ?? '').trim() || null;
  const occurrences = Array.isArray(item.dayOptionOccurrences)
    ? item.dayOptionOccurrences
        .filter((entry): entry is { date: string; label?: string | null } =>
          entry !== null && entry !== undefined && typeof entry.date === 'string' && entry.date !== ''
        )
        .map((entry) => ({ date: entry.date, label: entry.label ?? null }))
    : undefined;
  return {
    id: uniqueId,
    donor: donorId ?? null,
    donor_name: displayName,
    pooja_option: item.poojaName ?? item.poojaCode ?? 'Cart item',
    registration: null,
    registration_start_date: startDate,
    registration_total_amount: dueAmount,
    pooja_due_amount: dueAmount,
    amount: 0,
    transaction_reference: null,
    status: 'pending',
    registration_status: 'pending',
    registration_donor_name: displayName,
    registration_is_group_registration: Boolean(item.recurrenceKind),
    created_at: startDate ?? new Date().toISOString(),
    payment_month: startDate ?? undefined,
    upcoming_occurrences: occurrences,
  };
};

const buildLocalCartRecord = (
  items: CartItem[],
  donorId?: number | null,
  donorName?: string | null,
): PaymentRecordEntry | null => {
  if (!items.length) {
    return null;
  }
  const { totalDue, earliestDate, names, occurrences, hasRecurrence } = computeCartAggregate(items);
  return {
    id: `cart-local-${items.map((item) => item.cartId).join('-')}`,
    donor: donorId ?? null,
    donor_name: (donorName ?? '').trim() || 'Cart payment',
    pooja_option:
      names.length > 0 ? names.join(', ') : `Cart payment — ${items.length} item${items.length === 1 ? '' : 's'}`,
    registration: null,
    registration_start_date: earliestDate,
    registration_total_amount: totalDue,
    pooja_due_amount: totalDue,
    amount: 0,
    transaction_reference: null,
    status: 'pending',
    registration_status: 'pending',
    registration_donor_name: donorName ?? null,
    registration_is_group_registration: hasRecurrence,
    created_at: earliestDate,
    payment_month: earliestDate,
    upcoming_occurrences: occurrences,
  };
};

const resolveRegisteredByLabel = (record: PaymentRecordEntry) =>
  record.registration_donor_name || '—';

const resolveBookedByLabel = (record: PaymentRecordEntry) => record.donor_name || '—';

const PaymentStatementPage = () => {
  const [records, setRecords] = useState<PaymentRecordEntry[]>([]);
  const [registrations, setRegistrations] = useState<PoojaRegistrationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = useAuthStore((state) => state.user);
  const isAdminUser = Boolean(user && isAdmin(user.role));
  const showDonorFilter = isAdminUser;
  const [donorOptions, setDonorOptions] = useState<DonorNameOption[]>([]);
  const [selectedDonorIds, setSelectedDonorIds] = useState<number[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all');
  const [cartSnapshots, setCartSnapshots] = useState<CartSnapshotRecord[]>([]);
  const [cartSnapshotsVersion, setCartSnapshotsVersion] = useState(0);
  const [donorOpeningBalances, setDonorOpeningBalances] = useState<Record<number, number>>({});
  const combineRole = useCombineAccessStore((state) => state.role);
  const combinedTo = useCombineAccessStore((state) => state.combinedTo);
  const combineLoading = useCombineAccessStore((state) => state.loading);
  const combineError = useCombineAccessStore((state) => state.error);
  const fetchCombineAccess = useCombineAccessStore((state) => state.fetchAccess);
  const { balance: currentBalance, openingBalance } = useCurrentBalance();
  const cartKey = user ? String(user.id) : 'guest';
  const localCartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);

  // Auto-select current user's records on initial load (for non-admin users)
  // Admin users see all donors by default without auto-selecting
  useEffect(() => {
    if (user?.id && selectedDonorIds.length === 0 && !isAdminUser) {
      setSelectedDonorIds([user.id]);
    }
  }, [user?.id, selectedDonorIds.length, isAdminUser]);

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
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadRegistrations = async () => {
      try {
        const params: Record<string, string | number> = {
          page_size: 250,
          ordering: '-created_at',
        };
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
  }, []);

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
        const response = await api.get<CartSnapshotRecord[]>('pooja/cart-snapshots/report/');
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
  }, [cartSnapshotsVersion, isAdminUser]);

  useEffect(() => {
    if (!isAdminUser) {
      setDonorOptions([]);
      setSelectedDonorIds([]);
      return;
    }

    let isMounted = true;
    const loadDonors = async () => {
      try {
        const response = await api.get('auth/donors/', {
          params: { page_size: 500 },
        });
        if (!isMounted) {
          return;
        }
        const donors = Array.isArray(response.data)
          ? response.data
          : extractResults<DonorListEntry>(response.data);
        const nextOptions: DonorNameOption[] = donors
          .map((donor) => {
            const rawName = (donor.user.name ?? '').trim();
            const fallbackName = rawName || `Donor #${donor.user.id}`;
            const phone = (donor.user.phone_number ?? '').trim();
            const label = phone ? `${fallbackName} — ${phone}` : fallbackName;
            return { id: donor.user.id, label };
          })
          .sort((a, b) => a.label.localeCompare(b.label));
        if (!isMounted) {
          return;
        }
        setDonorOptions(nextOptions);
        setSelectedDonorIds((prev) =>
          prev.filter((id) => nextOptions.some((option) => option.id === id)),
        );
      } catch (err) {
        if (isMounted) {
          console.error('Unable to load donors for payment statement', err);
          setDonorOptions([]);
          setSelectedDonorIds([]);
        }
      }
    };

    loadDonors();
    return () => {
      isMounted = false;
    };
  }, [isAdminUser]);

  // Fetch opening balances for all donors for admin passbook view
  useEffect(() => {
    if (!isAdminUser || donorOptions.length === 0) {
      setDonorOpeningBalances({});
      return;
    }

    let isMounted = true;
    const loadOpeningBalances = async () => {
      try {
        const response = await api.get('auth/donors/', {
          params: { page_size: 500 },
        });
        if (!isMounted) {
          return;
        }
        const donors = Array.isArray(response.data)
          ? response.data
          : extractResults<DonorListEntry>(response.data);
        
        const balances: Record<number, number> = {};
        donors.forEach((donor) => {
          const profile = (donor as any).profile;
          if (profile && profile.opening_balance) {
            balances[donor.user.id] = parseNumeric(profile.opening_balance);
          } else {
            balances[donor.user.id] = 0;
          }
        });
        
        if (isMounted) {
          setDonorOpeningBalances(balances);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Unable to load donor opening balances', err);
          setDonorOpeningBalances({});
        }
      }
    };

    loadOpeningBalances();
    return () => {
      isMounted = false;
    };
  }, [isAdminUser, donorOptions.length]);

  const selectedDonorLabels = useMemo(() => {
    if (selectedDonorIds.length === 0 || donorOptions.length === 0) {
      return [];
    }
    const lookup = new Map(donorOptions.map((option) => [option.id, option.label]));
    return selectedDonorIds
      .map((id) => lookup.get(id))
      .filter((label): label is string => typeof label === 'string');
  }, [selectedDonorIds, donorOptions]);

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
    if (
      !records.length &&
      !registrations.length &&
      !cartSnapshots.length &&
      !localCartItems.length
    ) {
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
    const cartRecords = cartSnapshots.flatMap((snapshot) =>
      convertSnapshotToRecords(snapshot),
    );
    const localCartRecord = buildLocalCartRecord(
      localCartItems,
      user?.id ?? null,
      user?.name ?? null,
    );
    return [
      ...records,
      ...registrationRecords,
      ...cartRecords,
      ...(localCartRecord ? [localCartRecord] : []),
    ];
  }, [records, registrations, cartSnapshots, localCartItems, user?.id, user?.name]);

  const filteredRecords = useMemo(() => {
    let nextRecords = mergedRecords;

    if (selectedDonorIds.length > 0) {
      const selectedSet = new Set(selectedDonorIds);
      nextRecords = nextRecords.filter((record) => {
        const donorId = record.donor;
        return typeof donorId === 'number' && selectedSet.has(donorId);
      });
    }

    if (selectedMonthKey) {
      nextRecords = nextRecords.filter(
        (record) => getRecordMonthKey(record) === selectedMonthKey,
      );
    }

    if (paymentStatusFilter === 'due') {
      nextRecords = nextRecords.filter(
        (record) => resolveStatusLabel(record) === STATUS_LABEL_PAYMENT_NOT_RECEIVED,
      );
    } else if (paymentStatusFilter === 'paid') {
      nextRecords = nextRecords.filter(
        (record) => resolveStatusLabel(record) === STATUS_LABEL_PAYMENT_RECEIVED,
      );
    }

    return nextRecords;
  }, [mergedRecords, selectedDonorIds, selectedMonthKey, paymentStatusFilter]);

  const selectedMonthLabel = useMemo(
    () =>
      selectedMonthKey ? formatYearMonthLabel(selectedMonthKey) ?? selectedMonthKey : null,
    [selectedMonthKey],
  );

  const summaryLabel = useMemo(() => {
    const statusLabel =
      paymentStatusFilter === 'due'
        ? 'Due payments'
        : paymentStatusFilter === 'paid'
        ? 'Amount received'
        : 'All payments';
    return selectedMonthLabel ? `${statusLabel} • ${selectedMonthLabel}` : statusLabel;
  }, [paymentStatusFilter, selectedMonthLabel]);

  const downloadFilenameBase = useMemo(() => {
    const parts = ['payment-statement'];
    if (paymentStatusFilter !== 'all') {
      parts.push(paymentStatusFilter);
    }
    if (selectedMonthKey) {
      parts.push(selectedMonthKey);
    }
    parts.push(formatFilenameDate(new Date()));
    return parts.join('-');
  }, [paymentStatusFilter, selectedMonthKey]);

  const getDisplayedDueAmountValue = (record: PaymentRecordEntry) => {
    const statusLabel = resolveStatusLabel(record);
    if (statusLabel === STATUS_LABEL_PAYMENT_NOT_RECEIVED) {
      const pendingAmount = parseNumeric(record.amount);
      if (pendingAmount > 0) {
        return pendingAmount;
      }
    }
    return parseNumeric(record.pooja_due_amount ?? record.registration_total_amount);
  };

  const getDisplayedPaidAmountValue = (record: PaymentRecordEntry) => {
    const statusLabel = resolveStatusLabel(record);
    if (statusLabel === STATUS_LABEL_PAYMENT_NOT_RECEIVED) {
      return 0;
    }
    return parseNumeric(record.amount);
  };

  const buildPassbookEntriesFromRecords = (
    records: PaymentRecordEntry[],
    initialBalance: number,
    includeBalanceEntry: boolean,
  ) => {
    const sorted =
      records.length > 0
        ? [...records].sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b))
        : [];

    const entries: PassbookEntry[] = [];
    if (includeBalanceEntry) {
      entries.push({
        record: {
          id: CURRENT_BALANCE_ENTRY_ID,
          donor: null,
          donor_name: null,
          created_at: CURRENT_BALANCE_ENTRY_DATE,
          registration_start_date: CURRENT_BALANCE_ENTRY_DATE,
        },
        dueAmount: 0,
        paidAmount: 0,
        closingDue: initialBalance,
        openingBalance: initialBalance,
        displayDate: CURRENT_BALANCE_ENTRY_DISPLAY_DATE,
        isCurrentBalanceEntry: true,
      });
    }

    let runningBalance = initialBalance;

    const dueRecords = sorted.filter((record) => {
      const hasRegistration = record.registration && record.registration > 0;
      const isCartOrPending =
        record.registration === null && parseNumeric(record.registration_total_amount ?? 0) > 0;
      return hasRegistration || isCartOrPending;
    });

    const paidRecords = sorted.filter((record) => {
      const hasTransRef = record.transaction_reference?.trim().length > 0;
      const hasPaidAmount = parseNumeric(record.amount) > 0;
      const isPaidStatus = (record.status ?? '').toLowerCase() === 'success';
      return hasTransRef && (hasPaidAmount || isPaidStatus);
    });

    if (dueRecords.length > 0) {
      const totalDueAmount = dueRecords.reduce(
        (sum, record) => sum + parseNumeric(record.registration_total_amount ?? 0),
        0,
      );
      if (totalDueAmount > 0) {
        const dueEntry: PassbookEntry = {
          record: dueRecords[0],
          dueAmount: totalDueAmount,
          paidAmount: 0,
          openingBalance: runningBalance,
          closingDue: runningBalance + totalDueAmount,
          entryType: 'due',
        };
        entries.push(dueEntry);
        runningBalance = dueEntry.closingDue;
      }
    }

    const groupedPaidRecords = new Map<string, PaymentRecordEntry[]>();
    paidRecords.forEach((record) => {
      const groupKey = record.transaction_reference?.trim() || `record-${record.id}`;
      if (!groupedPaidRecords.has(groupKey)) {
        groupedPaidRecords.set(groupKey, []);
      }
      groupedPaidRecords.get(groupKey)!.push(record);
    });

    Array.from(groupedPaidRecords.values()).forEach((paymentGroup) => {
      const totalPaidAmount = paymentGroup.reduce(
        (sum, record) => sum + getDisplayedPaidAmountValue(record),
        0,
      );
      if (totalPaidAmount > 0) {
        const paidEntry: PassbookEntry = {
          record: paymentGroup[0],
          dueAmount: 0,
          paidAmount: totalPaidAmount,
          openingBalance: runningBalance,
          closingDue: runningBalance - totalPaidAmount,
          entryType: 'paid',
        };
        entries.push(paidEntry);
        runningBalance = paidEntry.closingDue;
      }
    });

    return entries;
  };

  const resolveDonorDisplayLabel = (
    record?: Partial<PaymentRecordEntry> | null,
    fallbackDonorId?: number | null,
  ) => {
    if (!record) {
      if (fallbackDonorId != null) {
        return `Donor #${fallbackDonorId}`;
      }
      return 'Donor';
    }
    const trimmedName = (record.donor_name ?? record.registration_donor_name ?? '').trim();
    if (trimmedName) {
      return trimmedName;
    }
    if (fallbackDonorId != null) {
      return `Donor #${fallbackDonorId}`;
    }
    if (record.donor != null) {
      return `Donor #${record.donor}`;
    }
    return 'Donor';
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
      'Pooja Date': formatDisplayDate(getRecordDateValue(record)),
      'Pooja Due Amount': formatCurrency(getDisplayedDueAmountValue(record)),
      'Paid Amount': formatCurrency(getDisplayedPaidAmountValue(record)),
      'Transaction ID': record.transaction_reference || '—',
      'Pooja Registered by': record.registration_donor_name ?? '—',
      'Pooja Booked by': record.donor_name ?? '—',
      'Club Payment': record.registration_is_group_registration ? 'Yes' : 'No',
      Status: resolveStatusLabel(record),
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
          { text: summaryLabel, style: 'subheader', margin: [0, 0, 0, 8] },
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

  const cachedOpeningBalanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (openingBalance !== null && openingBalance !== undefined && cachedOpeningBalanceRef.current === null) {
      cachedOpeningBalanceRef.current = openingBalance;
    }
  }, [openingBalance]);

  // Calculate the opening balance for the selected month by looking at records from previous months
  const monthOpeningBalance = useMemo(() => {
    if (!selectedMonthKey) {
      // No month filter, use the current opening balance
      return null; // Will use cachedOpeningBalance or openingBalance
    }

    // Get all records (not just filtered ones) to calculate cumulative balance
    const allRecords = mergedRecords;
    
    // Separate records into "before selected month" and "selected month"
    const beforeSelectedMonth: PaymentRecordEntry[] = [];
    
    allRecords.forEach((record) => {
      const recordMonthKey = getRecordMonthKey(record);
      if (!recordMonthKey) {
        return;
      }
      
      // Compare month keys as strings (format: "YYYY-MM")
      if (recordMonthKey < selectedMonthKey) {
        beforeSelectedMonth.push(record);
      }
    });

    // Calculate cumulative balance from all records before the selected month
    let calculatedBalance = 0;
    beforeSelectedMonth
      .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b))
      .forEach((record) => {
        const paidAmount = getDisplayedPaidAmountValue(record);
        const dueAmount = getDisplayedDueAmountValue(record);
        calculatedBalance = calculatedBalance + paidAmount - dueAmount;
      });

    return calculatedBalance;
  }, [selectedMonthKey, mergedRecords]);

  const passbookEntries = useMemo(() => {
    const hasBalanceEntry = currentBalance !== null && currentBalance !== undefined && !isAdminUser;
    const cachedOpeningBalance = cachedOpeningBalanceRef.current;
    const initialBalance =
      monthOpeningBalance !== null ? monthOpeningBalance : cachedOpeningBalance ?? openingBalance ?? 0;
    return buildPassbookEntriesFromRecords(filteredRecords, initialBalance, hasBalanceEntry);
  }, [filteredRecords, currentBalance, openingBalance, monthOpeningBalance, isAdminUser]);

  const getEntryDateLabel = (entry: PassbookEntry) => {
    if (entry.displayDate) {
      return entry.displayDate;
    }
    const sourceDate = getRecordDateValue(entry.record);
    return formatDisplayDate(sourceDate);
  };

  const getEntryDonorNameLabel = (entry: PassbookEntry) => {
    if (entry.isCurrentBalanceEntry) {
      return '-';
    }
    return resolveDonorDisplayLabel(entry.record, entry.record.donor ?? null);
  };

  const getEntryTransactionDetailsLabel = (entry: PassbookEntry, allRecords: PaymentRecordEntry[]) => {
    if (entry.isCurrentBalanceEntry) {
      return '-';
    }
    
    if (entry.entryType === 'due') {
      return '--- Pooja DUE ---';
    }
    
    const reference = entry.record.transaction_reference?.trim();
    if (reference) {
      return reference;
    }
    return 'Payment recorded';
  };

  const getRecordTransactionDetailsLabel = (record: PaymentRecordEntry) => {
    const statusLabel = resolveStatusLabel(record);
    if (statusLabel === STATUS_LABEL_PAYMENT_NOT_RECEIVED) {
      return '--- Pooja DUE ---';
    }
    const reference = record.transaction_reference?.trim();
    if (reference) {
      return reference;
    }
    return 'Payment recorded';
  };

  const getEntryAmountLabel = (entry: PassbookEntry, amount: number) =>
    entry.isCurrentBalanceEntry ? '-' : formatCurrency(amount);

  const adminPassbookGroups = useMemo<AdminDonorPassbookGroup[]>(() => {
    if (!isAdminUser || mergedRecords.length === 0) {
      return [];
    }
    const groupsByKey = new Map<
      string,
      { id: string; donorId: number | null; label: string; records: PaymentRecordEntry[] }
    >();
    // Use mergedRecords (ALL records) instead of filteredRecords to show complete donor history
    mergedRecords.forEach((record) => {
      const donorId = typeof record.donor === 'number' ? record.donor : null;
      const donorLabel = resolveDonorDisplayLabel(record, donorId);
      const groupKey = donorId !== null ? `donor-${donorId}` : `label-${donorLabel}`;
      if (!groupsByKey.has(groupKey)) {
        groupsByKey.set(groupKey, {
          id: groupKey,
          donorId,
          label: donorLabel,
          records: [],
        });
      }
      groupsByKey.get(groupKey)!.records.push(record);
    });
    const groups = Array.from(groupsByKey.values())
      .map((group) => {
        const sortedRecords = [...group.records].sort(
          (a, b) => getRecordTimestamp(a) - getRecordTimestamp(b),
        );
        
        // Use the specific donor's opening balance from the API
        // This ensures admin sees the exact same values as each individual donor
        let donorBalance = openingBalance ?? 0;
        if (group.donorId !== null && donorOpeningBalances[group.donorId] !== undefined) {
          donorBalance = donorOpeningBalances[group.donorId];
        }
        
        const entries = buildPassbookEntriesFromRecords(sortedRecords, donorBalance, true);
        
        return { id: group.id, donorId: group.donorId, label: group.label, entries };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    return groups;
  }, [mergedRecords, isAdminUser, resolveDonorDisplayLabel, donorOpeningBalances, openingBalance]);

  const adminPassbookRecordCount = adminPassbookGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );

  const passbookSummaryText = isAdminUser
    ? adminPassbookGroups.length
      ? `${adminPassbookRecordCount} record${
          adminPassbookRecordCount === 1 ? '' : 's'
        } • ${adminPassbookGroups.length} donor${
          adminPassbookGroups.length === 1 ? '' : 's'
        }`
      : 'No payment records'
    : `${passbookEntries.length} record${passbookEntries.length === 1 ? '' : 's'}`;

  const totalPaid = useMemo(
    () => filteredRecords.reduce((sum, record) => sum + getDisplayedPaidAmountValue(record), 0),
    [filteredRecords],
  );

  const totalDue = useMemo(
    () =>
      filteredRecords.reduce((sum, record) => sum + getDisplayedDueAmountValue(record), 0),
    [filteredRecords],
  );

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
            <h1 className="text-2xl font-semibold text-slate-800">Payment History managed by another donor</h1>
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
            {summaryLabel} • {filteredRecords.length} record
            {filteredRecords.length === 1 ? '' : 's'}
          </p>
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

      <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap gap-6">
          {showDonorFilter && (
            <div className="flex-1 min-w-[260px] space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filter by donor name
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <DonorNameMultiSelect
                  options={donorOptions}
                  selectedIds={selectedDonorIds}
                  onToggleId={(value) =>
                    setSelectedDonorIds((prev) =>
                      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
                    )
                  }
                  disabled={donorOptions.length === 0}
                />
                <button
                  type="button"
                  onClick={() => setSelectedDonorIds([])}
                  disabled={selectedDonorIds.length === 0}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Clear
                </button>
              </div>
              {selectedDonorIds.length > 0 && (
                <p className="text-xs text-slate-500">
                  Showing records for {selectedDonorIds.length} donor
                  {selectedDonorIds.length === 1 ? '' : 's'}
                  {selectedDonorLabels.length > 0 ? `: ${selectedDonorLabels.join(', ')}` : ''}.
                </p>
              )}
            </div>
          )}

          <div className="flex-1 min-w-[220px] space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filter by month
            </p>
            <div className="flex items-center gap-2">
              <MonthRangeSelect
                value={selectedMonthKey}
                onChange={(value) => setSelectedMonthKey(value)}
                onClear={() => setSelectedMonthKey('')}
              />
              <button
                type="button"
                onClick={() => setSelectedMonthKey('')}
                disabled={!selectedMonthKey}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-[220px] space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filter by payment status
            </p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_STATUS_FILTERS.map((option) => {
                const isActive = paymentStatusFilter === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => setPaymentStatusFilter(option.id)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      isActive
                        ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-500/90'
                        : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passbook</p>
            <p className="text-lg font-semibold text-slate-800">Payment history</p>
          </div>
          <p className="text-xs text-slate-500">{passbookSummaryText}</p>
        </div>
        {loading ? (
          <div className="px-4 py-5 text-sm text-slate-500">Loading payment records…</div>
        ) : error ? (
          <div className="px-4 py-5 text-sm text-rose-600">{error}</div>
        ) : isAdminUser ? (
          adminPassbookGroups.length ? (
            <div className="px-4 py-3 space-y-6">
                      {adminPassbookGroups.map((group) => (
                        <div
                          key={group.id}
                          className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm"
                        >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Donor passbook
                      </p>
                      <p className="text-lg font-semibold text-slate-800">{group.label}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {group.entries.length} record{group.entries.length === 1 ? '' : 's'}
For Admin, In the Payment Statement Passbook View,                     </p>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="hidden md:block">
                      <div className="max-h-[520px] overflow-auto rounded-2xl">
                        <table className="w-full min-w-full divide-y divide-slate-100 text-sm">
                          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">S.no</th>
                              <th className="px-4 py-3 text-left font-semibold">Date</th>
                              <th className="px-4 py-3 text-left font-semibold">Transaction Details</th>
                              <th className="px-4 py-3 text-right font-semibold">
                                Due for current month
                              </th>
                              <th className="px-4 py-3 text-right font-semibold">Amount received</th>
                              <th className="px-4 py-3 text-right font-semibold">Closing due</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.entries.map((entry, idx) => (
                              <tr key={`${group.id}-entry-${entry.record.id ?? idx}`}>
                                <td className="px-4 py-3 font-medium text-slate-600">{idx + 1}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  {getEntryDateLabel(entry)}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {getEntryTransactionDetailsLabel(entry, filteredRecords)}
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
                    <div className="flex flex-col space-y-3 md:hidden">
                      {group.entries.map((entry, idx) => (
                        <div
                          key={`${group.id}-mobile-entry-${entry.record.id ?? idx}`}
                          className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-700">
                              #{idx + 1} •{' '}
                              <span className="font-normal text-slate-500">
                                {getEntryDateLabel(entry)}
                              </span>
                            </p>
                          </div>
                          <div className="mt-2 space-y-2 text-xs text-slate-500">
                            <div>
                              <p className="font-semibold text-slate-600">Transaction Details</p>
                              <p className="text-slate-700">
                                {getEntryTransactionDetailsLabel(entry, filteredRecords)}
                              </p>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-600">
                                Due for current month
                              </span>
                              <span>{formatCurrency(entry.dueAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-600">Amount received</span>
                              <span>{formatCurrency(entry.paidAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-600">Closing due</span>
                              <span>{formatCurrency(entry.closingDue)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-5 text-sm text-slate-500">No payments found.</div>
          )
        ) : passbookEntries.length ? (
          <div className="px-4 py-3">
            <div className="hidden rounded-t-2xl md:block">
              <div className="max-h-[720px] overflow-auto">
                <table className="w-full min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">S.no</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Donor Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Transaction Details</th>
                      <th className="px-4 py-3 text-right font-semibold">Due for current month</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount received</th>
                      <th className="px-4 py-3 text-right font-semibold">Closing due for current month</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {passbookEntries.map((entry, idx) => (
                      <tr key={`${entry.record.id}-${idx}`}>
                        <td className="px-4 py-3 font-medium text-slate-600">{idx + 1}</td>
                        <td className="px-4 py-3 text-slate-600">{getEntryDateLabel(entry)}</td>
                        <td className="px-4 py-3 text-slate-600">{getEntryDonorNameLabel(entry)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {getEntryTransactionDetailsLabel(entry, filteredRecords)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {getEntryAmountLabel(entry, entry.dueAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {getEntryAmountLabel(entry, entry.paidAmount)}
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
                  key={`${entry.record.id}-mobile-${idx}`}
                  className="border-b border-slate-100 px-4 py-4 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">
                      #{idx + 1} •{' '}
                      <span className="font-normal text-slate-500">{getEntryDateLabel(entry)}</span>
                    </p>
                  </div>
                  <div className="mt-2 space-y-2 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-600">Donor Name</p>
                      <p className="text-slate-700">{getEntryDonorNameLabel(entry)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-600">Transaction Details</p>
                      <p className="text-slate-700">
                        {getEntryTransactionDetailsLabel(entry, filteredRecords)}
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Due for current month</span>
                      <span>{getEntryAmountLabel(entry, entry.dueAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Amount received</span>
                      <span>{getEntryAmountLabel(entry, entry.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Closing due for current month</span>
                      <span>{formatCurrency(entry.closingDue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-5 text-sm text-slate-500">No payments found.</div>
        )}
      </div>
    </div>
  );
};

export default PaymentStatementPage;
