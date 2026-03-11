'use client';

/**
 * ============================================================================
 * PAYMENT STATEMENT PAGE MODULE
 * ============================================================================
 * 
 * Purpose:
 *   Displays comprehensive payment history and passbook for donors and admins.
 *   Provides detailed tracking of pooja dues, payments, and account balance.
 * 
 * Key Features:
 *   - Passbook View: Shows payment history with running balance calculations
 *   - Recurring Pooja Dates: Auto-generates monthly due dates (1st of each month)
 *   - One-time Registrations: Shows current date for single-occurrence poojas
 *   - Admin Passbook: Multi-donor view with phone numbers and balance tracking
 *   - Filters: By donor, month, and payment status
 *   - Downloads: Export as PDF or Excel
 * 
 * Data Flow:
 *   1. Fetch payment records, registrations, and cart snapshots
 *   2. Merge and transform records (apply date logic)
 *   3. Apply user filters (donor, month, status)
 *   4. Build passbook entries with running balance
 *   5. Display in table format with download options
 * 
 * Main Components:
 *   - DonorNameMultiSelect: Multi-select dropdown for donor filtering
 *   - MonthRangeSelect: Month selector for filtering by month
 *   - Passbook Table: Main display for payment history
 * 
 * Admin Features:
 *   - View all donors' latest passbook snapshot (one row per donor)
 *   - See donor phone numbers
 *   - Access donor-wise current due state quickly
 *   - Download reports by donor
 * 
 * ============================================================================
 */
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
import {
  normalizePassbookAmountEntries,
  parsePassbookAmount,
} from './passbookAmountUtils';

interface PaymentRecordEntry {
  id: number | string;
  donor: number | null;
  donor_name?: string | null;
  payment_record_id?: number | null;
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

interface CombineMappingParentEntry {
  id?: number | null;
  active?: boolean | null;
}

interface CombineMappingMainEntry {
  id?: number | null;
}

interface CombineMappingEntry {
  main_donor?: CombineMappingMainEntry | null;
  parent_donors?: CombineMappingParentEntry[] | null;
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
  { id: 'due', label: 'Not Paid' },
  { id: 'paid', label: 'Paid' },
];


const CURRENT_BALANCE_ENTRY_ID = 'current-balance-entry';
const CURRENT_BALANCE_ENTRY_DATE = '2025-12-31';
const CURRENT_BALANCE_ENTRY_DISPLAY_DATE = '31/12/2025';
const PARENT_AGGREGATE_DONOR_ID = -9999;
const ALL_PARENT_DONORS_LABEL = 'Sub-ordinate Donors';

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

type ApiPassbookEntryRaw = {
  id: number;
  donor: number;
  donor_name: string;
  payment_record?: number | null;
  entry_date: string;
  entry_type: 'balance' | 'due' | 'paid';
  opening_balance?: number | string | null;
  due_amount: number | string | null;
  paid_amount: number | string | null;
  closing_due: number | string | null;
  transaction_details?: string | null;
};

type ApiPassbookEntry = {
  id: number;
  donor: number;
  donor_name: string;
  payment_record?: number | null;
  entry_date: string;
  entry_type: 'balance' | 'due' | 'paid';
  opening_balance?: number | string | null;
  due_amount: number;
  paid_amount: number;
  closing_due: number;
  transaction_details?: string | null;
};

type AdminDonorPassbookGroup = {
  id: string;
  donorId: number | null;
  label: string;
  entries: PassbookEntry[];
};

type ProfileAccessPayload = {
  profile?: {
    payment_delete_access?: boolean | null;
  };
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
  return parsePassbookAmount(value);
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

const getApiPassbookEntryTimestamp = (entry: Pick<ApiPassbookEntry, 'entry_date'>) => {
  const parsed = Date.parse(entry.entry_date);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizePaginatedNextUrl = (nextUrl: string | null): string | null => {
  if (!nextUrl) {
    return null;
  }

  try {
    // Relative "next" paths are already safe for axios(baseURL)
    if (!/^https?:\/\//i.test(nextUrl)) {
      return nextUrl;
    }

    if (typeof window === 'undefined') {
      return nextUrl;
    }

    const parsed = new URL(nextUrl);
    const apiBase = api.defaults.baseURL ? String(api.defaults.baseURL) : '';
    const appOrigin = window.location.origin;

    // Prevent mixed-content blocks when app is served over HTTPS but API next-link is HTTP.
    if (window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }

    // Convert same-origin absolute API links to relative links so axios(baseURL) can handle them.
    if (apiBase) {
      const apiBaseUrl = new URL(apiBase, appOrigin);
      const normalizedBasePath = apiBaseUrl.pathname.endsWith('/')
        ? apiBaseUrl.pathname
        : `${apiBaseUrl.pathname}/`;

      if (parsed.origin === apiBaseUrl.origin && parsed.pathname.startsWith(normalizedBasePath)) {
        const relativeApiPath = parsed.pathname.slice(normalizedBasePath.length);
        return `${relativeApiPath}${parsed.search}${parsed.hash}`;
      }
    }

    return parsed.toString();
  } catch {
    return nextUrl;
  }
};

const isApiPassbookEntryMoreRecent = (
  candidate: Pick<ApiPassbookEntry, 'entry_date' | 'id'>,
  current: Pick<ApiPassbookEntry, 'entry_date' | 'id'>,
) => {
  const candidateTimestamp = getApiPassbookEntryTimestamp(candidate);
  const currentTimestamp = getApiPassbookEntryTimestamp(current);
  if (candidateTimestamp !== currentTimestamp) {
    return candidateTimestamp > currentTimestamp;
  }
  return candidate.id > current.id;
};

// ============================================================================
// DATE TRANSFORMATION UTILITY
// ============================================================================
// Purpose: Transform pooja occurrence dates based on registration type
// - Recurring Poojas: Generate 1st of each month for 12 months
// - One-time Registrations: Use current date
// 
// This ensures proper display of pooja due dates in payment statements
// ============================================================================
const transformOccurrencesForDisplay = (
  occurrences: { date: string; label?: string | null }[] | undefined,
  isRecurring: boolean,
): { date: string; label?: string | null }[] | undefined => {
  if (isRecurring) {
    // For recurring poojas, generate dates for the 1st of each month
    const uniqueMonths = new Set<string>();
    const transformedOccurrences: { date: string; label?: string | null }[] = [];
    const baseLabel = occurrences?.[0]?.label ?? null;

    // First, add any existing occurrences transformed to 1st of month
    if (occurrences && occurrences.length > 0) {
      occurrences.forEach((occurrence) => {
        try {
          const date = new Date(occurrence.date);
          if (!Number.isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const monthKey = `${year}-${month}`;

            if (!uniqueMonths.has(monthKey)) {
              uniqueMonths.add(monthKey);
              const firstOfMonth = new Date(year, date.getMonth(), 1).toISOString();
              transformedOccurrences.push({
                date: firstOfMonth,
                label: occurrence.label ?? baseLabel,
              });
            }
          }
        } catch (err) {
          // If date parsing fails, skip
        }
      });
    }

    // Generate future months starting from the next month
    // (12 months ahead to show a full year of recurring dues)
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    for (let i = 0; i < 12; i++) {
      const monthOffset = currentMonth + i;
      const year = currentYear + Math.floor(monthOffset / 12);
      const month = (monthOffset % 12) + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      if (!uniqueMonths.has(monthKey)) {
        uniqueMonths.add(monthKey);
        const firstOfMonth = new Date(year, month - 1, 1).toISOString();
        transformedOccurrences.push({
          date: firstOfMonth,
          label: baseLabel,
        });
      }
    }

    // Sort by date
    transformedOccurrences.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return transformedOccurrences.length > 0 ? transformedOccurrences : undefined;
  } else {
    // For one-time registrations, use the current date
    if (!occurrences || occurrences.length === 0) {
      return undefined;
    }
    const today = new Date().toISOString();
    return [
      {
        date: today,
        label: occurrences[0]?.label ?? null,
      },
    ];
  }
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
  const transformedOccurrences = transformOccurrencesForDisplay(occurrences, hasRecurrence);
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
      upcoming_occurrences: transformedOccurrences,
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
  const isRecurring = Boolean(item.recurrenceKind);
  const transformedOccurrences = transformOccurrencesForDisplay(occurrences, isRecurring);
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
    registration_is_group_registration: isRecurring,
    created_at: startDate ?? new Date().toISOString(),
    payment_month: startDate ?? undefined,
    upcoming_occurrences: transformedOccurrences,
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
  const transformedOccurrences = transformOccurrencesForDisplay(occurrences, hasRecurrence);
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
    upcoming_occurrences: transformedOccurrences,
  };
};

const resolveRegisteredByLabel = (record: PaymentRecordEntry) =>
  record.registration_donor_name || '—';

const resolveBookedByLabel = (record: PaymentRecordEntry) => record.donor_name || '—';

// ============================================================================
// PAYMENT STATEMENT PAGE COMPONENT
// ============================================================================
// Main component that renders the payment statement/passbook interface
//
// State Management:
//   - records: Payment records fetched from API
//   - registrations: Pending pooja registrations
//   - donorOptions: List of all donors (for filtering)
//   - selectedDonorIds: Currently filtered donors
//   - selectedMonthKey: Currently filtered month (YYYY-MM)
//   - paymentStatusFilter: Filter by payment status (all/due/paid)
//   - donorOpeningBalances: Opening balance per donor (admin use)
//   - donorPhones: Phone number mapping for donor names
//
// Data Fetching:
//   1. loadRecords: Fetch payment records from API
//   2. loadRegistrations: Fetch pending registrations
//   3. loadCartSnapshots: Fetch cart snapshots (admin only)
//   4. loadDonors: Fetch donor list for filtering
//   5. loadOpeningBalances: Fetch opening balance per donor
//   6. loadDonorPhones: Fetch phone numbers for donors
//
// Key Features:
//   - Automatic user selection for non-admin users
//   - Combine access checking for group account views
//   - Cart snapshot monitoring for real-time updates
//   - Opening balance calculation for selected month
// ============================================================================
const PaymentStatementPage = () => {
  const [records, setRecords] = useState<PaymentRecordEntry[]>([]);
  const [recordsRefreshToken, setRecordsRefreshToken] = useState(0);
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
  const [apiPassbookEntries, setApiPassbookEntries] = useState<ApiPassbookEntry[]>([]);
  const [apiPassbookLoading, setApiPassbookLoading] = useState(true);
  const [passbookRefreshToken, setPassbookRefreshToken] = useState(0);
  const [canDeletePaymentRecords, setCanDeletePaymentRecords] = useState(false);
  const [deletingPaymentRecordIds, setDeletingPaymentRecordIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [paymentDeleteError, setPaymentDeleteError] = useState('');
  const [donorOpeningBalances, setDonorOpeningBalances] = useState<Record<number, number>>({});
  const [donorPhones, setDonorPhones] = useState<Record<number, string>>({});
  const [activeParentDonorIdsByMain, setActiveParentDonorIdsByMain] = useState<
    Record<number, number[]>
  >({});
  const combineRole = useCombineAccessStore((state) => state.role);
  const combinedTo = useCombineAccessStore((state) => state.combinedTo);
  const combineLoading = useCombineAccessStore((state) => state.loading);
  const combineError = useCombineAccessStore((state) => state.error);
  const fetchCombineAccess = useCombineAccessStore((state) => state.fetchAccess);
  const parentDonors = useCombineAccessStore((state) => state.parentDonors);
  const { balance: currentBalance, openingBalance } = useCurrentBalance();
  const cartKey = user ? String(user.id) : 'guest';
  const localCartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const [activeDonorId, setActiveDonorId] = useState<number | null>(user?.id ?? null);
  const [parentDonorOpeningBalance, setParentDonorOpeningBalance] = useState<number | null>(null);
  const parentDonorIds = useMemo(
    () =>
      parentDonors
        .map((donor) => (typeof donor.id === 'number' ? donor.id : null))
        .filter((id): id is number => id !== null),
    [parentDonors],
  );
  const parentDonorNames = useMemo(() => {
    return parentDonors
      .map((donor) => (donor.name ?? '').trim().toLowerCase())
      .filter((name) => name.length > 0);
  }, [parentDonors]);

  // Auto-select current user's records on initial load (for non-admin users)
  // Admin users see all donors by default without auto-selecting
  useEffect(() => {
    if (typeof user?.id !== 'number') {
      setActiveDonorId(null);
      return;
    }
    setActiveDonorId((prev) => {
      if (prev === user.id) {
        return prev;
      }
      const matchesExistingParent = prev !== null && parentDonorIds.includes(prev);
      if (matchesExistingParent) {
        return prev;
      }
      return user.id;
    });
  }, [user?.id, parentDonorIds]);

  // Fetch combine access permissions for linked accounts
  useEffect(() => {
    if (combineRole === null && !combineLoading && !combineError) {
      fetchCombineAccess();
    }
  }, [combineRole, combineLoading, combineError, fetchCombineAccess]);

  useEffect(() => {
    let isMounted = true;

    if (isAdminUser) {
      setCanDeletePaymentRecords(false);
      return () => {
        isMounted = false;
      };
    }

    const loadPaymentDeleteAccess = async () => {
      try {
        const response = await api.get<ProfileAccessPayload>('auth/profile/');
        if (!isMounted) {
          return;
        }
        setCanDeletePaymentRecords(
          Boolean(response.data?.profile?.payment_delete_access),
        );
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setCanDeletePaymentRecords(false);
        console.error('Unable to load payment delete access', err);
      }
    };

    loadPaymentDeleteAccess();
    return () => {
      isMounted = false;
    };
  }, [isAdminUser, user?.id]);

  // Fetch parent donor's opening balance when activeDonorId changes to a parent donor
  useEffect(() => {
    if (
      typeof user?.id !== 'number' ||
      activeDonorId === null ||
      activeDonorId === PARENT_AGGREGATE_DONOR_ID
    ) {
      setParentDonorOpeningBalance(null);
      return;
    }

    // If viewing current user's records, clear parent balance
    if (activeDonorId === user.id) {
      setParentDonorOpeningBalance(null);
      return;
    }

    if (!parentDonorIds.includes(activeDonorId)) {
      setParentDonorOpeningBalance(null);
      return;
    }

    // If viewing a parent donor's records, fetch their opening balance
    let isMounted = true;
    const loadParentDonorBalance = async () => {
      try {
        const response = await api.get(`auth/donors/${activeDonorId}/`, {
          params: { minimal: 'false' },
        });
        if (!isMounted) {
          return;
        }
        
        const donorData = response.data;
        const profile = donorData?.profile || donorData?.user?.profile;
        let balance = 0;
        
        if (profile && profile.opening_balance !== null && profile.opening_balance !== undefined) {
          const numValue = typeof profile.opening_balance === 'string' 
            ? parseFloat(profile.opening_balance) 
            : profile.opening_balance;
          balance = Number.isFinite(numValue) ? numValue : 0;
        }
        
        if (isMounted) {
          // Always set a numeric value (0 if not found), not null
          setParentDonorOpeningBalance(balance);
        }
      } catch (err) {
        if (isMounted) {
          console.error(`Unable to load opening balance for parent donor ${activeDonorId}`, err);
          // Default to 0 instead of null so that parent donor records can still be displayed
          setParentDonorOpeningBalance(0);
        }
      }
    };

    loadParentDonorBalance();
    return () => {
      isMounted = false;
    };
  }, [activeDonorId, user?.id, parentDonorIds]);

  // Monitor cart snapshot updates for real-time passbook refresh
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

  // Fetch payment records (transaction history and pending dues)
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
  }, [recordsRefreshToken]);

  // Fetch passbook entries directly (authoritative combined view)
  useEffect(() => {
    let isMounted = true;
    const loadPassbookEntries = async () => {
      setApiPassbookLoading(true);
      try {
        const allResults: ApiPassbookEntry[] = [];

        const basePath = 'payments/passbook-entries/';
        const params = new URLSearchParams();
        params.set('ordering', 'entry_date');
        params.set('page_size', '500');
        // Always paginate because non-admin combined views can span multiple pages.
        const paginate = true;
        // Keep admin fetch donor-unfiltered so combined main-donor totals can
        // include active parent donors even when only the main donor is selected.
        // If user filtered by month, pass month filter
        if (selectedMonthKey) {
          params.set('month', selectedMonthKey);
        }
        if (passbookRefreshToken > 0) {
          params.set('refresh', 'true');
        }

        let nextUrl: string | null = `${basePath}?${params.toString()}`;
        let pageCount = 0;

        while (nextUrl) {
          const response = await api.get(nextUrl);
          if (!isMounted) return;
          const payload = normalizePassbookAmountEntries(
            extractResults<ApiPassbookEntryRaw>(response.data),
          );
          allResults.push(...payload);
          pageCount += 1;
          nextUrl = paginate
            ? normalizePaginatedNextUrl(response.data?.next ?? null)
            : null;
          // Safety cap to avoid accidental infinite loops
          if (allResults.length > 2000 || pageCount > 200) {
            console.warn('[PaymentStatement] passbook pagination aborted after limit', {
              total: allResults.length,
              pages: pageCount,
            });
            break;
          }
        }

        setApiPassbookEntries(allResults);
        console.log('[PaymentStatement] passbook entries fetched', allResults.length);
      } catch (err) {
        console.error('Unable to fetch passbook entries', err);
      }
      if (isMounted) {
        setApiPassbookLoading(false);
      }
    };
    loadPassbookEntries();
    return () => {
      isMounted = false;
    };
  }, [isAdminUser, passbookRefreshToken, selectedMonthKey]);

  useEffect(() => {
    if (!isAdminUser) {
      setActiveParentDonorIdsByMain({});
      return;
    }

    let isMounted = true;
    const loadCombineMappings = async () => {
      try {
        const response = await api.get<CombineMappingEntry[]>('payments/combine-mappings/');
        if (!isMounted) {
          return;
        }

        const payload: CombineMappingEntry[] = Array.isArray(response.data) ? response.data : [];
        const mapping: Record<number, number[]> = {};

        payload.forEach((entry) => {
          const mainDonorId = entry.main_donor?.id;
          if (typeof mainDonorId !== 'number') {
            return;
          }
          const parentIds = (Array.isArray(entry.parent_donors) ? entry.parent_donors : [])
            .filter((parent) => parent?.active === true && typeof parent.id === 'number')
            .map((parent) => parent.id as number);

          if (parentIds.length === 0) {
            return;
          }
          mapping[mainDonorId] = Array.from(new Set(parentIds));
        });

        setActiveParentDonorIdsByMain(mapping);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        console.error('Unable to load combine mappings for admin payment statement', err);
        setActiveParentDonorIdsByMain({});
      }
    };

    loadCombineMappings();
    return () => {
      isMounted = false;
    };
  }, [isAdminUser]);

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

  // Fetch phone numbers for all donors for admin passbook view
  useEffect(() => {
    if (!isAdminUser || donorOptions.length === 0) {
      setDonorPhones({});
      return;
    }

    let isMounted = true;
    const loadDonorPhones = async () => {
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
        
        const phones: Record<number, string> = {};
        donors.forEach((donor) => {
          const phone = (donor.user.phone_number ?? '').trim();
          if (phone) {
            phones[donor.user.id] = phone;
          }
        });
        
        if (isMounted) {
          setDonorPhones(phones);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Unable to load donor phone numbers', err);
          setDonorPhones({});
        }
      }
    };

    loadDonorPhones();
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

  const donorViewTabs = useMemo(() => {
    if (typeof user?.id !== 'number') {
      return [];
    }
    const tabs: { key: string; donorId: number; label: string }[] = [];
    const userLabel = (user.name ?? '').trim() || 'My payment statement';
    tabs.push({ key: 'self', donorId: user.id, label: userLabel });

    return tabs;
  }, [user?.id, user?.name, parentDonorIds]);

  const showParentDonorTabs = donorViewTabs.length > 1;

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
    const remainingRegistrations = registrations.filter((registration) => {
      if (paidRegistrationIds.has(registration.id)) {
        return false;
      }
      // Exclude CHRT registrations (one-time or recurring); dues appear via payment records
      const dayCode =
        (registration as any).day_option_code?.toUpperCase?.() ||
        ((registration as any).day_option_description || '').toUpperCase();
      return dayCode !== 'CHRT';
    });
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

    // For admin users: if no donors are selected, show all donors
    // For non-admin users: if no donors are selected, show only their own records
    if (selectedDonorIds.length > 0) {
      const selectedSet = new Set(selectedDonorIds);
      nextRecords = nextRecords.filter((record) => {
        const donorId = record.donor;
        return typeof donorId === 'number' && selectedSet.has(donorId);
      });
    } else if (!isAdminUser) {
      if (activeDonorId === PARENT_AGGREGATE_DONOR_ID) {
        const parentSet = new Set(parentDonorIds);
        nextRecords = nextRecords.filter((record) => {
          const donorId = record.donor;
          const donorMatch = typeof donorId === 'number' && parentSet.has(donorId);
          const registrationName = (record.registration_donor_name ?? '').trim().toLowerCase();
          const registrationMatch =
            registrationName.length > 0 && parentDonorNames.includes(registrationName);
          return donorMatch || registrationMatch;
        });
      } else if (activeDonorId != null) {
        nextRecords = nextRecords.filter((record) => record.donor === activeDonorId);
      } else {
        nextRecords = [];
      }
    }
    // For admin users with no selection: show all records (nextRecords = mergedRecords)

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
  }, [
    mergedRecords,
    selectedDonorIds,
    selectedMonthKey,
    paymentStatusFilter,
    isAdminUser,
    activeDonorId,
    parentDonorIds,
    parentDonorNames,
  ]);

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

  // ============================================================================
  // BUILD PASSBOOK ENTRIES - Core Balance Calculation Logic
  // ============================================================================
  // Purpose: Transform payment records into passbook entries with running balance
  // 
  // Process:
  //   1. Sort records chronologically
  //   2. Add opening balance entry (if requested)
  //   3. Aggregate due amounts from registrations/pending items
  //   4. Group paid records by transaction reference
  //   5. Calculate closing due after each transaction
  //
  // Balance Formula: Closing Due = Previous Balance + Due Amount - Paid Amount
  // 
  // Inputs:
  //   - records: Array of payment records to process
  //   - initialBalance: Starting balance for the period
  //   - includeBalanceEntry: Whether to show opening balance row
  //
  // Output: Array of PassbookEntry objects ready for display in UI
  // ============================================================================
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
      let openingDonorId: number | null = null;
      let openingDonorName: string | null = null;

      if (!isAdminUser) {
        if (activeDonorId === PARENT_AGGREGATE_DONOR_ID) {
          openingDonorId = PARENT_AGGREGATE_DONOR_ID;
          openingDonorName = ALL_PARENT_DONORS_LABEL;
        } else if (typeof activeDonorId === 'number') {
          openingDonorId = activeDonorId;
          if (typeof user?.id === 'number' && activeDonorId === user.id) {
            openingDonorName = (user.name ?? '').trim() || null;
          } else {
            const parentDonor = parentDonors.find((donor) => donor.id === activeDonorId);
            openingDonorName = (parentDonor?.name ?? '').trim() || null;
          }
        } else if (typeof user?.id === 'number') {
          openingDonorId = user.id;
          openingDonorName = (user.name ?? '').trim() || null;
        }
      }

      entries.push({
        record: {
          id: CURRENT_BALANCE_ENTRY_ID,
          donor: openingDonorId,
          donor_name: openingDonorName,
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
      const isPending = resolveStatusLabel(record) === STATUS_LABEL_PAYMENT_NOT_RECEIVED;
      if (!isPending) return false;

      const hasRegistration = record.registration && record.registration > 0;
      const isCartOrPending =
        record.registration === null && parseNumeric(record.registration_total_amount ?? 0) > 0;

      // Include monthly dues (PaymentRecords with no registration and no cart total)
      const isMonthlyDue = record.registration === null && !isCartOrPending;

      return hasRegistration || isCartOrPending || isMonthlyDue;
    });

    const paidRecords = sorted.filter((record) => {
      const hasTransRef = record.transaction_reference?.trim().length > 0;
      const hasPaidAmount = parseNumeric(record.amount) > 0;
      const isPaidStatus = (record.status ?? '').toLowerCase() === 'success';
      return hasTransRef && (hasPaidAmount || isPaidStatus);
    });

    if (dueRecords.length > 0) {
      dueRecords
        .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b))
        .forEach((record) => {
          const dueAmount = getDisplayedDueAmountValue(record);
          if (dueAmount <= 0) {
            return;
          }
          const dueEntry: PassbookEntry = {
            record,
            dueAmount,
            paidAmount: 0,
            openingBalance: runningBalance,
            closingDue: runningBalance + dueAmount,
            entryType: 'due',
          };
          entries.push(dueEntry);
          runningBalance = dueEntry.closingDue;
        });
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
    phoneNumber?: string | null,
  ) => {
    if (!record) {
      if (fallbackDonorId != null) {
        const baseLabel = `Donor #${fallbackDonorId}`;
        if (phoneNumber) {
          return `${baseLabel} - ${phoneNumber}`;
        }
        return baseLabel;
      }
      return 'Donor';
    }
    const trimmedName = (record.donor_name ?? record.registration_donor_name ?? '').trim();
    if (trimmedName) {
      if (phoneNumber) {
        return `${trimmedName} - ${phoneNumber}`;
      }
      return trimmedName;
    }
    if (fallbackDonorId != null) {
      const baseLabel = `Donor #${fallbackDonorId}`;
      if (phoneNumber) {
        return `${baseLabel} - ${phoneNumber}`;
      }
      return baseLabel;
    }
    if (record.donor != null) {
      const baseLabel = `Donor #${record.donor}`;
      if (phoneNumber) {
        return `${baseLabel} - ${phoneNumber}`;
      }
      return baseLabel;
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
    if (!isAdminUser) {
      console.warn('PDF download is restricted to admin users');
      return;
    }

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
    if (!isAdminUser) {
      console.warn('Excel download is restricted to admin users');
      return;
    }

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
    // But filter by activeDonorId to show correct balance for that donor
    let allRecords = mergedRecords;
    
    // Filter by activeDonorId if not admin user
    if (!isAdminUser && activeDonorId === PARENT_AGGREGATE_DONOR_ID) {
      const parentSet = new Set(parentDonorIds);
      allRecords = allRecords.filter(
        (record) => typeof record.donor === 'number' && parentSet.has(record.donor),
      );
    } else if (!isAdminUser && typeof activeDonorId === 'number') {
      allRecords = allRecords.filter((record) => record.donor === activeDonorId);
    }
    
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
  }, [selectedMonthKey, mergedRecords, activeDonorId, isAdminUser, parentDonorIds]);

  const buildAggregateParentPassbookEntries = (
    parentEntries: typeof apiPassbookEntries,
  ): PassbookEntry[] => {
    if (!parentEntries.length) {
      return [];
    }

    // Group all parent entries by month so only one record shows per month
    const monthGroups = new Map<
      string,
      { monthDate: string; dueTotal: number; paidTotal: number }
    >();

    parentEntries.forEach((entry) => {
      const monthKey = entry.entry_date.slice(0, 7); // YYYY-MM
      const existing = monthGroups.get(monthKey) ?? {
        monthDate: entry.entry_date,
        dueTotal: 0,
        paidTotal: 0,
      };

      // Track the earliest date within the month for display
      if (new Date(entry.entry_date).getTime() < new Date(existing.monthDate).getTime()) {
        existing.monthDate = entry.entry_date;
      }

      if (entry.entry_type === 'due') {
        existing.dueTotal += entry.due_amount;
      } else if (entry.entry_type === 'paid') {
        existing.paidTotal += entry.paid_amount;
      }

      monthGroups.set(monthKey, existing);
    });

    const combined: PassbookEntry[] = [];
    let runningBalance = 0;

    // Opening balance row once (label it clearly for aggregate view)
    combined.push({
      record: {
        id: `${CURRENT_BALANCE_ENTRY_ID}-aggregate-parent`,
        donor: PARENT_AGGREGATE_DONOR_ID,
        donor_name: ALL_PARENT_DONORS_LABEL,
        created_at: CURRENT_BALANCE_ENTRY_DATE,
        payment_month: CURRENT_BALANCE_ENTRY_DATE,
      },
      dueAmount: 0,
      paidAmount: 0,
      openingBalance: runningBalance,
      closingDue: runningBalance,
      displayDate: CURRENT_BALANCE_ENTRY_DISPLAY_DATE,
      isCurrentBalanceEntry: true,
    });

    const sortedMonths = Array.from(monthGroups.values()).sort(
      (a, b) => new Date(a.monthDate).getTime() - new Date(b.monthDate).getTime(),
    );

    sortedMonths.forEach((group) => {
      // Skip empty months to avoid duplicate 31/12 rows with zero values
      if (group.dueTotal === 0 && group.paidTotal === 0) {
        return;
      }

      const openingBalance = runningBalance;
      runningBalance = openingBalance + group.dueTotal - group.paidTotal;

      const hasDue = group.dueTotal > 0;
      const hasPaid = group.paidTotal > 0;

      combined.push({
        record: {
          id: `aggregate-parent-${group.monthDate}`,
          donor: PARENT_AGGREGATE_DONOR_ID,
          donor_name: ALL_PARENT_DONORS_LABEL,
          created_at: group.monthDate,
          payment_month: group.monthDate,
        },
        dueAmount: group.dueTotal,
        paidAmount: group.paidTotal,
        openingBalance,
        closingDue: runningBalance,
        displayDate: formatDisplayDate(group.monthDate),
        entryType: hasDue && !hasPaid ? 'due' : hasPaid && !hasDue ? 'paid' : undefined,
      });
    });

    return combined;
  };

  const buildAggregateParentPassbookFromRecords = (
    parentRecords: PaymentRecordEntry[],
  ): PassbookEntry[] => {
    if (!parentRecords.length) {
      return [
        {
          record: {
            id: `${CURRENT_BALANCE_ENTRY_ID}-aggregate-parent-empty`,
            donor: PARENT_AGGREGATE_DONOR_ID,
            donor_name: ALL_PARENT_DONORS_LABEL,
            created_at: CURRENT_BALANCE_ENTRY_DATE,
            payment_month: CURRENT_BALANCE_ENTRY_DATE,
          },
          dueAmount: 0,
          paidAmount: 0,
          openingBalance: 0,
          closingDue: 0,
          displayDate: CURRENT_BALANCE_ENTRY_DISPLAY_DATE,
          isCurrentBalanceEntry: true,
        },
      ];
    }

    const monthTotals = new Map<
      string,
      { monthKey: string; monthDate: string; dueTotal: number; paidTotal: number }
    >();

    parentRecords.forEach((record) => {
      const monthKey = getRecordMonthKey(record);
      if (!monthKey) return;

      // For aggregate view, treat entries as due unless explicitly marked paid (status === 'success').
      const rawStatus = (record.status ?? '').toLowerCase();
      const isPaid = rawStatus === 'success';
      const dueValue = getDisplayedDueAmountValue(record);
      const paidValue = getDisplayedPaidAmountValue(record);

      const existing = monthTotals.get(monthKey) ?? {
        monthKey,
        monthDate: `${monthKey}-01`,
        dueTotal: 0,
        paidTotal: 0,
      };

      if (!isPaid) {
        existing.dueTotal += dueValue;
      } else {
        existing.paidTotal += paidValue;
      }

      // Keep earliest date in the month for display consistency
      const currentTs = new Date(existing.monthDate).getTime();
      const nextTs = new Date(record.created_at ?? existing.monthDate).getTime();
      if (!Number.isNaN(nextTs) && nextTs < currentTs) {
        existing.monthDate = record.created_at ?? existing.monthDate;
      }

      monthTotals.set(monthKey, existing);
    });

    const combined: PassbookEntry[] = [];
    let runningBalance = 0;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Opening balance row
    combined.push({
      record: {
        id: `${CURRENT_BALANCE_ENTRY_ID}-aggregate-parent`,
        donor: PARENT_AGGREGATE_DONOR_ID,
        donor_name: ALL_PARENT_DONORS_LABEL,
        created_at: CURRENT_BALANCE_ENTRY_DATE,
        payment_month: CURRENT_BALANCE_ENTRY_DATE,
      },
      dueAmount: 0,
      paidAmount: 0,
      openingBalance: runningBalance,
      closingDue: runningBalance,
      displayDate: CURRENT_BALANCE_ENTRY_DISPLAY_DATE,
      isCurrentBalanceEntry: true,
    });

    const sortedMonths = Array.from(monthTotals.values())
      // drop future months (only show up to current calendar month)
      .filter((group) => group.monthKey <= currentMonthKey)
      .sort((a, b) => new Date(a.monthDate).getTime() - new Date(b.monthDate).getTime());

    sortedMonths.forEach((group) => {
      const hasActivity = group.dueTotal !== 0 || group.paidTotal !== 0;
      if (!hasActivity) {
        return;
      }

      const openingBalance = runningBalance;
      runningBalance = openingBalance + group.dueTotal - group.paidTotal;

      combined.push({
        record: {
          id: `aggregate-parent-${group.monthDate}`,
          donor: PARENT_AGGREGATE_DONOR_ID,
          donor_name: ALL_PARENT_DONORS_LABEL,
          created_at: group.monthDate,
          payment_month: group.monthDate,
        },
        dueAmount: group.dueTotal,
        paidAmount: group.paidTotal,
        openingBalance,
        closingDue: runningBalance,
        displayDate: formatDisplayDate(group.monthDate),
        entryType: group.dueTotal > 0 && group.paidTotal === 0 ? 'due' : undefined,
      });
    });

    return combined;
  };

  const passbookEntries = useMemo(() => {
    const isCombinedMainDonor = !isAdminUser && combineRole === 'main' && parentDonorIds.length > 0;

    // Special handling for combined main donors: build a unified timeline from API passbook entries
    if (isCombinedMainDonor) {
      if (apiPassbookLoading) {
        return [];
      }

      const mainDonorId = typeof user?.id === 'number' ? user.id : null;

      const applyFilters = (entries: typeof apiPassbookEntries) => {
        let next = entries;
        if (selectedMonthKey) {
          next = next.filter((entry) => entry.entry_date.slice(0, 7) === selectedMonthKey);
        }
        if (paymentStatusFilter === 'due') {
          next = next.filter((entry) => entry.entry_type === 'due');
        } else if (paymentStatusFilter === 'paid') {
          next = next.filter((entry) => entry.entry_type === 'paid');
        }
        return next;
      };

      const mainEntries = applyFilters(
        apiPassbookEntries.filter(
          (entry) =>
            entry.donor === mainDonorId &&
            (entry.entry_type === 'due' || entry.entry_type === 'paid'),
        ),
      );

      const parentEntries = applyFilters(
        apiPassbookEntries.filter(
          (entry) =>
            parentDonorIds.includes(entry.donor) &&
            (entry.entry_type === 'due' || entry.entry_type === 'paid'),
        ),
      );

      const mainOpeningBalance = apiPassbookEntries
        .filter((entry) => entry.donor === mainDonorId && entry.entry_type === 'balance')
        .reduce((sum, entry) => sum + parseNumeric(entry.closing_due), 0);

      const parentOpeningBalanceTotal = apiPassbookEntries
        .filter((entry) => parentDonorIds.includes(entry.donor) && entry.entry_type === 'balance')
        .reduce((sum, entry) => sum + parseNumeric(entry.closing_due), 0);

      // Aggregate parent dues and paid amounts by month
      const parentMonthTotals = new Map<
        string,
        { monthDate: string; dueTotal: number; paidTotal: number }
      >();

      parentEntries.forEach((entry) => {
        const monthKey = entry.entry_date.slice(0, 7);
        const existing = parentMonthTotals.get(monthKey) ?? {
          monthDate: entry.entry_date,
          dueTotal: 0,
          paidTotal: 0,
        };
        if (entry.entry_type === 'due') {
          existing.dueTotal += entry.due_amount;
        } else if (entry.entry_type === 'paid') {
          existing.paidTotal += entry.paid_amount;
        }
        if (new Date(entry.entry_date).getTime() < new Date(existing.monthDate).getTime()) {
          existing.monthDate = entry.entry_date;
        }
        parentMonthTotals.set(monthKey, existing);
      });

      const parentAggregateEntries: PassbookEntry[] = [];

      const mainOpeningEntry: PassbookEntry = {
        record: {
          id: `${CURRENT_BALANCE_ENTRY_ID}-main-donor`,
          donor: mainDonorId,
          donor_name: user?.name ?? null,
          created_at: CURRENT_BALANCE_ENTRY_DATE,
          payment_month: CURRENT_BALANCE_ENTRY_DATE,
        },
        dueAmount: 0,
        paidAmount: 0,
        // Show one opening-balance row for combined main donor view:
        // main donor opening + subordinate donor openings.
        openingBalance: mainOpeningBalance + parentOpeningBalanceTotal,
        closingDue: mainOpeningBalance + parentOpeningBalanceTotal,
        displayDate: CURRENT_BALANCE_ENTRY_DISPLAY_DATE,
        isCurrentBalanceEntry: true,
      };

      Array.from(parentMonthTotals.values())
        .sort((a, b) => new Date(a.monthDate).getTime() - new Date(b.monthDate).getTime())
        .forEach((group) => {
          if (group.dueTotal === 0 && group.paidTotal === 0) {
            return;
          }
          parentAggregateEntries.push({
            record: {
              id: `aggregate-parent-${group.monthDate}`,
              donor: PARENT_AGGREGATE_DONOR_ID,
              donor_name: ALL_PARENT_DONORS_LABEL,
              created_at: group.monthDate,
              payment_month: group.monthDate,
            },
            dueAmount: group.dueTotal,
            paidAmount: group.paidTotal,
            openingBalance: 0,
            closingDue: 0,
            displayDate: formatDisplayDate(group.monthDate),
            entryType: group.paidTotal > 0 && group.dueTotal === 0 ? 'paid' : 'due',
          });
        });

      const mainPassbookEntries: PassbookEntry[] = mainEntries.map((entry) => ({
        record: {
          id: `passbook-${entry.id}`,
          donor: entry.donor,
          donor_name: entry.donor_name,
          payment_record_id: entry.payment_record ?? null,
          created_at: entry.entry_date,
          payment_month: entry.entry_date,
          transaction_reference: entry.transaction_details ?? undefined,
          registration: null,
          registration_start_date: entry.entry_date,
          registration_total_amount: entry.due_amount,
          amount: entry.paid_amount,
          status: entry.entry_type === 'paid' ? 'success' : 'pending',
        } as PaymentRecordEntry,
        dueAmount: entry.entry_type === 'due' ? entry.due_amount : 0,
        paidAmount: entry.entry_type === 'paid' ? entry.paid_amount : 0,
        openingBalance: 0,
        closingDue: 0,
        displayDate: formatDisplayDate(entry.entry_date),
        entryType: entry.entry_type === 'paid' ? 'paid' : 'due',
      }));

      // Merge and recompute running balance across main + parent aggregate streams
      const combinedEntries = [mainOpeningEntry, ...parentAggregateEntries, ...mainPassbookEntries].sort((a, b) => {
        const dateA =
          a.record.payment_month ?? a.record.created_at ?? CURRENT_BALANCE_ENTRY_DATE;
        const dateB =
          b.record.payment_month ?? b.record.created_at ?? CURRENT_BALANCE_ENTRY_DATE;
        const diff = new Date(dateA).getTime() - new Date(dateB).getTime();
        if (diff !== 0) return diff;
        const aIsParent = a.record.donor === PARENT_AGGREGATE_DONOR_ID;
        const bIsParent = b.record.donor === PARENT_AGGREGATE_DONOR_ID;
        if (aIsParent !== bIsParent) {
          return aIsParent ? 1 : -1; // main first on same date
        }
        return String(a.record.id).localeCompare(String(b.record.id));
      });

      let runningBalance = 0;
      const recomputed = combinedEntries.map((entry) => {
        if (entry.isCurrentBalanceEntry) {
          // Opening rows carry starting balances (main + aggregate parent balances).
          const openingBalance = runningBalance;
          const closingDue = Math.max(0, openingBalance + parseNumeric(entry.closingDue));
          runningBalance = closingDue;
          return { ...entry, openingBalance, closingDue };
        }
        const openingBalance = runningBalance;
        const closingDue = Math.max(0, openingBalance + entry.dueAmount - entry.paidAmount);
        runningBalance = closingDue;
        return { ...entry, openingBalance, closingDue };
      });

      return recomputed;
    }

    // Non-combined donor view should rely on backend passbook entries
    // so monthly dues remain consolidated (e.g., Jan ₹600 instead of split rows).
    if (!isAdminUser) {
      if (apiPassbookLoading) {
        return [];
      }

      let entries = apiPassbookEntries;
      if (typeof activeDonorId === 'number') {
        entries = entries.filter((entry) => entry.donor === activeDonorId);
      }
      if (selectedMonthKey) {
        entries = entries.filter((entry) => entry.entry_date.slice(0, 7) === selectedMonthKey);
      }
      if (paymentStatusFilter === 'due') {
        entries = entries.filter((entry) => entry.entry_type === 'due');
      } else if (paymentStatusFilter === 'paid') {
        entries = entries.filter((entry) => entry.entry_type === 'paid');
      }

      return entries
        .map(
          (entry): PassbookEntry => ({
            record: {
              id: entry.id,
              donor: entry.donor,
              donor_name: entry.donor_name,
              payment_record_id: entry.payment_record ?? null,
              created_at: entry.entry_date,
              payment_month: entry.entry_date,
              transaction_reference: entry.transaction_details ?? undefined,
              registration: null,
              registration_start_date: entry.entry_date,
              registration_total_amount: entry.due_amount,
              amount: entry.paid_amount,
              status: entry.entry_type === 'paid' ? 'success' : 'pending',
            } as PaymentRecordEntry,
            dueAmount: entry.entry_type === 'due' ? entry.due_amount : 0,
            paidAmount: entry.entry_type === 'paid' ? entry.paid_amount : 0,
            openingBalance: parseNumeric(entry.opening_balance),
            closingDue: entry.closing_due,
            displayDate: formatDisplayDate(entry.entry_date),
            entryType:
              entry.entry_type === 'paid'
                ? 'paid'
                : entry.entry_type === 'due'
                ? 'due'
                : undefined,
            isCurrentBalanceEntry: entry.entry_type === 'balance',
          }),
        )
        .sort((a, b) => getRecordTimestamp(a.record) - getRecordTimestamp(b.record));
    }

    // Default path (admin or non-combined user): keep existing behavior
    const monthlyDueMonths = new Set(
      filteredRecords
        .filter(
          (record) =>
            record.registration === null &&
            resolveStatusLabel(record) === STATUS_LABEL_PAYMENT_NOT_RECEIVED &&
            getRecordMonthKey(record),
        )
        .map((record) => getRecordMonthKey(record) as string),
    );

    const cleanedRecords =
      monthlyDueMonths.size === 0
        ? filteredRecords
        : filteredRecords.filter((record) => {
            if (record.registration && resolveStatusLabel(record) === STATUS_LABEL_PAYMENT_NOT_RECEIVED) {
              const monthKey = getRecordMonthKey(record);
              if (monthKey && monthlyDueMonths.has(monthKey)) {
                return false;
              }
            }
            return true;
          });

    return buildPassbookEntriesFromRecords(cleanedRecords, openingBalance ?? 0, true);
  }, [
    isAdminUser,
    combineRole,
    parentDonorIds,
    activeDonorId,
    apiPassbookEntries,
    apiPassbookLoading,
    selectedMonthKey,
    paymentStatusFilter,
    user?.id,
    filteredRecords,
    openingBalance,
  ]);

  // ============================================================================
  // GET ENTRY DATE LABEL - Display Date Resolution
  // ============================================================================
  // Purpose: Return the appropriate date to display in passbook DATE column
  // 
  // Logic:
  //   - displayDate: Use if explicitly set (e.g., current balance entry)
  //   - DUE entry: Show pooja due date (1st of month for recurring)
  //   - PAID entry: Show payment transaction date
  //
  // Example:
  //   - Due entry for recurring pooja: 01/01/2026 (from upcoming_occurrences)
  //   - Paid entry: 15/01/2026 (when payment was received)
  //   - Opening balance: 31/12/2025 (CURRENT_BALANCE_ENTRY_DISPLAY_DATE)
  // ============================================================================
  const getEntryDateLabel = (entry: PassbookEntry) => {
    if (entry.displayDate) {
      return entry.displayDate;
    }
    // For due entries, show the pooja due date from upcoming_occurrences (1st of month)
    if (entry.entryType === 'due' && entry.record.upcoming_occurrences && entry.record.upcoming_occurrences.length > 0) {
      const firstOccurrence = entry.record.upcoming_occurrences[0];
      return formatDisplayDate(firstOccurrence.date);
    }
    // For paid entries, show the transaction date
    const sourceDate = getRecordDateValue(entry.record);
    return formatDisplayDate(sourceDate);
  };

  const getEntryDonorNameLabel = (entry: PassbookEntry) => {
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

  const canRenderDeleteActions = !isAdminUser && canDeletePaymentRecords;

  const getEntryPaymentRecordId = (entry: PassbookEntry): number | null => {
    const value = entry.record.payment_record_id;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    return value;
  };

  const canDeletePassbookEntry = (entry: PassbookEntry): boolean => {
    if (!canRenderDeleteActions) {
      return false;
    }
    if (entry.isCurrentBalanceEntry) {
      return false;
    }
    if (entry.entryType !== 'paid') {
      return false;
    }
    if (entry.record.donor !== user?.id) {
      return false;
    }
    return getEntryPaymentRecordId(entry) !== null;
  };

  const isDeletingPaymentRecord = (entry: PassbookEntry): boolean => {
    const paymentRecordId = getEntryPaymentRecordId(entry);
    return paymentRecordId !== null && deletingPaymentRecordIds.has(paymentRecordId);
  };

  const handleDeletePaymentRecord = async (entry: PassbookEntry) => {
    const paymentRecordId = getEntryPaymentRecordId(entry);
    if (paymentRecordId === null || deletingPaymentRecordIds.has(paymentRecordId)) {
      return;
    }

    const transactionLabel = getEntryTransactionDetailsLabel(entry, filteredRecords);
    const confirmed = window.confirm(
      `Delete this payment record (${transactionLabel})? This will recalculate the statement.`,
    );
    if (!confirmed) {
      return;
    }

    setPaymentDeleteError('');
    setDeletingPaymentRecordIds((prev) => {
      const next = new Set(prev);
      next.add(paymentRecordId);
      return next;
    });

    try {
      await api.delete(`payments/records/${paymentRecordId}/`);
      setRecordsRefreshToken((prev) => prev + 1);
      setPassbookRefreshToken((prev) => prev + 1);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        'Unable to delete payment record.';
      setPaymentDeleteError(
        typeof detail === 'string' ? detail : 'Unable to delete payment record.',
      );
    } finally {
      setDeletingPaymentRecordIds((prev) => {
        const next = new Set(prev);
        next.delete(paymentRecordId);
        return next;
      });
    }
  };

  const adminPassbookGroups = useMemo<AdminDonorPassbookGroup[]>(() => {
    if (!isAdminUser || apiPassbookLoading || apiPassbookEntries.length === 0) {
      return [];
    }

    const parentToMainDonorId = new Map<number, number>();
    Object.entries(activeParentDonorIdsByMain).forEach(([mainDonorId, parentDonorIds]) => {
      const parsedMainDonorId = Number(mainDonorId);
      if (!Number.isFinite(parsedMainDonorId)) {
        return;
      }
      parentDonorIds.forEach((parentDonorId) => {
        parentToMainDonorId.set(parentDonorId, parsedMainDonorId);
      });
    });
    const activeCombinedParentDonorIds = new Set(parentToMainDonorId.keys());

    const selectedMainDonorIds = new Set<number>();
    selectedDonorIds.forEach((selectedId) => {
      const mainDonorId = parentToMainDonorId.get(selectedId);
      if (typeof mainDonorId === 'number') {
        selectedMainDonorIds.add(mainDonorId);
        return;
      }
      selectedMainDonorIds.add(selectedId);
    });

    const matchesFilters = (
      entry: typeof apiPassbookEntries[number],
      options?: { applyDonorFilter?: boolean },
    ) => {
      const applyDonorFilter = options?.applyDonorFilter ?? true;
      if (
        applyDonorFilter &&
        selectedMainDonorIds.size > 0 &&
        !selectedMainDonorIds.has(entry.donor)
      ) {
        return false;
      }
      if (selectedMonthKey) {
        const monthKey = entry.entry_date.slice(0, 7);
        if (monthKey !== selectedMonthKey) {
          return false;
        }
      }
      if (paymentStatusFilter === 'due' && entry.entry_type !== 'due') {
        return false;
      }
      if (paymentStatusFilter === 'paid' && entry.entry_type !== 'paid') {
        return false;
      }
      return true;
    };

    const latestEntriesByDonor = new Map<number, ApiPassbookEntry>();
    const latestAggregateEntriesByDonor = new Map<number, ApiPassbookEntry>();
    let matchedCount = 0;

    apiPassbookEntries.forEach((entry) => {
      if (matchesFilters(entry, { applyDonorFilter: false })) {
        const currentAggregateLatest = latestAggregateEntriesByDonor.get(entry.donor);
        if (!currentAggregateLatest || isApiPassbookEntryMoreRecent(entry, currentAggregateLatest)) {
          latestAggregateEntriesByDonor.set(entry.donor, entry);
        }
      }
      if (!matchesFilters(entry)) {
        return;
      }
      if (activeCombinedParentDonorIds.has(entry.donor)) {
        return;
      }
      matchedCount += 1;
      const currentLatest = latestEntriesByDonor.get(entry.donor);
      if (!currentLatest || isApiPassbookEntryMoreRecent(entry, currentLatest)) {
        latestEntriesByDonor.set(entry.donor, entry);
      }
    });

    const groups = Array.from(latestEntriesByDonor.entries()).map(([donorId, entry]) => {
      const donorPhone = donorPhones[donorId] ?? '';
      const donorLabel =
        entry.donor_name ||
        donorOptions.find((d) => d.id === donorId)?.label ||
        `Donor #${donorId}`;
      const activeParentDonorIds = activeParentDonorIdsByMain[donorId] ?? [];
      const parentClosingDueTotal = activeParentDonorIds.reduce((sum, parentDonorId) => {
        const parentLatestEntry = latestAggregateEntriesByDonor.get(parentDonorId);
        if (!parentLatestEntry) {
          return sum;
        }
        return sum + parseNumeric(parentLatestEntry.closing_due);
      }, 0);
      const computedClosingDue =
        parseNumeric(entry.closing_due) +
        (activeParentDonorIds.length > 0 ? parentClosingDueTotal : 0);
      const passbookEntry: PassbookEntry = {
        record: {
          id: entry.id,
          donor: donorId,
          donor_name: entry.donor_name,
          payment_record_id: entry.payment_record ?? null,
          created_at: entry.entry_date,
          payment_month: entry.entry_date,
          transaction_reference: entry.transaction_details ?? undefined,
          registration: null,
          registration_start_date: entry.entry_date,
          registration_total_amount: entry.due_amount,
          amount: entry.paid_amount,
          status: entry.entry_type === 'paid' ? 'success' : 'pending',
        } as PaymentRecordEntry,
        dueAmount: entry.entry_type === 'due' ? entry.due_amount : 0,
        paidAmount: entry.entry_type === 'paid' ? entry.paid_amount : 0,
        openingBalance: 0,
        closingDue: computedClosingDue,
        displayDate: formatDisplayDate(entry.entry_date),
        entryType: entry.entry_type === 'paid' ? 'paid' : entry.entry_type === 'due' ? 'due' : undefined,
        isCurrentBalanceEntry: entry.entry_type === 'balance',
      };

      return {
        id: `donor-${donorId}`,
        donorId,
        label: `${donorLabel} - ${donorPhone || 'phone N/A'}`,
        entries: [passbookEntry],
      };
    });

    if (matchedCount === 0) {
      console.warn('[PaymentStatement] No passbook entries matched filters for admin view');
    } else {
      console.log(
        '[PaymentStatement] Admin passbook groups',
        groups.length,
        'latest rows from',
        matchedCount,
        'matched entries',
      );
    }

    return groups.sort((a, b) => a.label.localeCompare(b.label));
  }, [
    apiPassbookEntries,
    apiPassbookLoading,
    donorOptions,
    donorPhones,
    isAdminUser,
    paymentStatusFilter,
    selectedDonorIds,
    selectedMonthKey,
    activeParentDonorIdsByMain,
  ]);

  const adminFallbackPassbookGroups = useMemo<AdminDonorPassbookGroup[]>(() => {
    if (!isAdminUser || apiPassbookLoading || adminPassbookGroups.length > 0 || filteredRecords.length === 0) {
      return [];
    }

    const activeCombinedParentDonorIds = new Set<number>();
    Object.values(activeParentDonorIdsByMain).forEach((parentDonorIds) => {
      parentDonorIds.forEach((parentDonorId) => activeCombinedParentDonorIds.add(parentDonorId));
    });

    const groupedByDonor = new Map<number, PaymentRecordEntry[]>();
    filteredRecords.forEach((record) => {
      if (typeof record.donor !== 'number') return;
      if (activeCombinedParentDonorIds.has(record.donor)) return;
      const donorId = record.donor;
      const rows = groupedByDonor.get(donorId) ?? [];
      rows.push(record);
      groupedByDonor.set(donorId, rows);
    });

    return Array.from(groupedByDonor.entries())
      .map(([donorId, donorRecords]) => {
        const donorPhone = donorPhones[donorId] ?? '';
        const donorLabel =
          donorRecords.find((r) => (r.donor_name ?? '').trim().length > 0)?.donor_name ||
          donorOptions.find((d) => d.id === donorId)?.label ||
          `Donor #${donorId}`;
        const entries = buildPassbookEntriesFromRecords(
          donorRecords,
          donorOpeningBalances[donorId] ?? 0,
          true,
        );
        const nonBalanceEntries = entries.filter((entry) => !entry.isCurrentBalanceEntry);
        const sortableEntries = nonBalanceEntries.length > 0 ? nonBalanceEntries : entries;
        const sortedEntries = sortableEntries
          .slice()
          .sort((a, b) => getRecordTimestamp(a.record) - getRecordTimestamp(b.record));
        const latestEntry =
          sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null;
        return {
          id: `fallback-donor-${donorId}`,
          donorId,
          label: `${donorLabel} - ${donorPhone || 'phone N/A'}`,
          entries: latestEntry ? [latestEntry] : [],
        };
      })
      .filter((group) => group.entries.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    adminPassbookGroups.length,
    apiPassbookLoading,
    donorOpeningBalances,
    donorOptions,
    donorPhones,
    filteredRecords,
    isAdminUser,
    activeParentDonorIdsByMain,
  ]);

  const adminGroupsToRender =
    adminPassbookGroups.length > 0 ? adminPassbookGroups : adminFallbackPassbookGroups;
  const adminGroupsRecordCount = adminGroupsToRender.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );
  const isStatementLoading = loading;
  const isPassbookRefreshing = apiPassbookLoading;

  const passbookSummaryText = isPassbookRefreshing
    ? 'Refreshing statement...'
    : isAdminUser
    ? adminGroupsToRender.length
      ? `${adminGroupsRecordCount} record${
          adminGroupsRecordCount === 1 ? '' : 's'
        } • ${adminGroupsToRender.length} donor${
          adminGroupsToRender.length === 1 ? '' : 's'
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
      <div className="p-1">
        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-1 min-w-0 basis-full sm:basis-[260px]">
            <h1 className="text-2xl font-semibold text-slate-800">Payment Statement</h1>
            <p className="text-sm text-slate-500">
              {summaryLabel} • {filteredRecords.length} record
              {filteredRecords.length === 1 ? '' : 's'}
            </p>
          </div>
          {showDonorFilter && (
            <div className="space-y-2 min-w-0 basis-full sm:basis-[260px] sm:max-w-[320px] grow-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-0">
                  Filter by donor name
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedDonorIds([])}
                  disabled={selectedDonorIds.length === 0}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Clear
                </button>
              </div>
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

          <div className="space-y-2 min-w-0 basis-full sm:basis-[200px] sm:max-w-[240px] grow-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-0">
                Filter by month
              </p>
              <button
                type="button"
                onClick={() => setSelectedMonthKey('')}
                disabled={!selectedMonthKey}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <MonthRangeSelect
                value={selectedMonthKey}
                onChange={(value) => setSelectedMonthKey(value)}
                onClear={() => setSelectedMonthKey('')}
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setPassbookRefreshToken((prev) => prev + 1)}
              disabled={isPassbookRefreshing}
              className="rounded-full border border-[#90CAF9] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#1565C0] transition hover:bg-[#E3F2FD] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {isPassbookRefreshing ? 'Refreshing…' : 'Refresh statement'}
            </button>
          </div>

          {isAdminUser && (
            <div className="flex-1 min-w-0 space-y-2">
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
          )}

          {isAdminUser && (
            <div className="flex items-center gap-2 ml-auto shrink-0">
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
          )}
        </div>
      </div>

      {showParentDonorTabs && (
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {donorViewTabs.map((tab) => {
              const isActive = tab.donorId === activeDonorId;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => setActiveDonorId(tab.donorId)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    isActive
                      ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-500/90'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passbook</p>
            <p className="text-lg font-semibold text-slate-800">Payment history</p>
          </div>
          <p className="text-xs text-slate-500">{passbookSummaryText}</p>
        </div>
        {paymentDeleteError && (
          <div className="px-4 py-3 text-sm text-rose-600">{paymentDeleteError}</div>
        )}
        {isStatementLoading ? (
          <div className="px-4 py-5 text-sm text-slate-500">Loading payment records…</div>
        ) : isPassbookRefreshing ? (
          <div className="px-4 py-5 text-sm text-slate-500">
            Refreshing statement… latest due values will appear shortly.
          </div>
        ) : error ? (
          <div className="px-4 py-5 text-sm text-rose-600">{error}</div>
        ) : isAdminUser ? (
          adminGroupsToRender.length ? (
            <div className="px-4 py-3 space-y-6">
                      {adminGroupsToRender.map((group) => (
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
                    </p>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="hidden md:block">
                      <div className="max-h-[520px] overflow-auto rounded-2xl">
                        <table className="w-full min-w-[640px] divide-y divide-slate-100 text-sm">
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
                      {canRenderDeleteActions && (
                        <th className="px-4 py-3 text-center font-semibold">Action</th>
                      )}
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
                        {canRenderDeleteActions && (
                          <td className="px-4 py-3 text-center">
                            {canDeletePassbookEntry(entry) ? (
                              <button
                                type="button"
                                onClick={() => handleDeletePaymentRecord(entry)}
                                disabled={isDeletingPaymentRecord(entry)}
                                className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                              >
                                {isDeletingPaymentRecord(entry) ? 'Deleting...' : 'Delete'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                        )}
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
                    {canRenderDeleteActions && (
                      <div className="pt-1">
                        {canDeletePassbookEntry(entry) ? (
                          <button
                            type="button"
                            onClick={() => handleDeletePaymentRecord(entry)}
                            disabled={isDeletingPaymentRecord(entry)}
                            className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                          >
                            {isDeletingPaymentRecord(entry) ? 'Deleting...' : 'Delete payment'}
                          </button>
                        ) : (
                          <p className="text-xs text-slate-400">Delete not available for this row.</p>
                        )}
                      </div>
                    )}
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
