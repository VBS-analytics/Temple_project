import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { loadPdfMake, PDF_TAMIL_FONT_NAME } from '../../lib/pdfMakeLoader';
import type { CartItem } from '../../store/cart';
import api, { extractResults } from '../../lib/api';

const DAY_BUCKETS = [{ key: 'all', label: 'All Registrations' }] as const;

type DayBucketKey = (typeof DAY_BUCKETS)[number]['key'];

interface RegistrationMember {
  id?: number;
  name?: string | null;
  date_of_birth?: string | null;
  dateOfBirth?: string | null;
  dob?: string | null;
  family_name?: string | null;
  familyName?: string | null;
  tamil_star?: string | null;
  tamilStar?: string | null;
  rasi?: string | null;
  gothra?: string | null;
  gothram?: string | null;
}

interface RegistrationRecord {
  id: number;
  pooja_reg_id?: string | null;
  start_date?: string | null;
  pooja_option_name?: string | null;
  day_option_description?: string | null;
  donor_name?: string | null;
  post_prasadam?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  members?: RegistrationMember[] | null;
  isRecurringPlan?: boolean;
  recurringPlanId?: number | null;
}

interface RecurringPlanRecord {
  id: number;
  pooja_option_name?: string | null;
  pooja_option_code?: string | null;
  day_option_description?: string | null;
  recurrence_kind?: 'recurring' | 'one_time_extra';
  recurrence_frequency?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_occurrence?: string | null;
  one_time_date?: string | null;
  amount?: string | null;
  is_active?: boolean;
  pause_from?: string | null;
  pause_until?: string | null;
  metadata?: {
    members?: Array<RegistrationMember | null | undefined> | null;
  } | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  donor_email?: string | null;
}

interface CartSnapshotRecord {
  donor_id?: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  items?: CartItem[] | null;
  updated_at?: string | null;
}

interface PendingCartRow {
  cartId: string;
  poojaDate?: string | null;
  tamilStar: string;
  dayOption: string;
  donorName: string;
  postPrasadam: boolean;
}

type RegistrationBuckets = Record<DayBucketKey, RegistrationRecord[]>;

const POOJA_STATUS_META = {
  upcoming: {
    label: 'Upcoming',
    description: 'Scheduled after today',
    badgeClass: 'border border-orange-200 bg-orange-50 text-orange-700',
    legendClass: 'border border-orange-100 bg-orange-50/80 text-orange-900',
    dotClass: 'bg-orange-500',
    rowAccentClass: 'border-orange-400',
    rowHoverClass: 'hover:bg-orange-50/60',
  },
  today: {
    label: 'Today',
    description: 'Services happening today',
    badgeClass: 'border border-amber-200 bg-amber-50 text-amber-700',
    legendClass: 'border border-amber-100 bg-amber-50/80 text-amber-900',
    dotClass: 'bg-amber-500',
    rowAccentClass: 'border-amber-400',
    rowHoverClass: 'hover:bg-amber-50/50',
  },
  completed: {
    label: 'Completed',
    description: 'Dates prior to today',
    badgeClass: 'border border-slate-200 bg-slate-50 text-slate-700',
    legendClass: 'border border-slate-200 bg-slate-50 text-slate-600',
    dotClass: 'bg-slate-400',
    rowAccentClass: 'border-slate-200',
    rowHoverClass: 'hover:bg-slate-50',
  },
  pending: {
    label: 'Needs date',
    description: 'Awaiting schedule assignment',
    badgeClass: 'border border-rose-200 bg-rose-50 text-rose-700',
    legendClass: 'border border-rose-100 bg-rose-50/80 text-rose-900',
    dotClass: 'bg-rose-500',
    rowAccentClass: 'border-rose-400',
    rowHoverClass: 'hover:bg-rose-50/70',
  },
} as const;

type PoojaStatusKey = keyof typeof POOJA_STATUS_META;
type StatusBreakdown = Record<PoojaStatusKey, number>;

// Storage key for localStorage
const UPDATED_POOJA_DATES_KEY = 'temple_pooja_updated_dates';
const DAY_OPTION_PLACEHOLDER = 'Choose Your Date For Pooja';

const buildEmptyBuckets = (): RegistrationBuckets => ({
  all: [],
});

const buildEmptyStatusBreakdown = (): StatusBreakdown => ({
  upcoming: 0,
  today: 0,
  completed: 0,
  pending: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const extractErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (typeof responseData === 'string') {
      const trimmed = responseData.trim();
      if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        if (error.response?.status === 404) {
          return 'Requested resource was not found.';
        }
        return 'Unexpected server response.';
      }
      return trimmed;
    }
    if (isRecord(responseData)) {
      if ('detail' in responseData && typeof responseData.detail === 'string') {
        return responseData.detail;
      }
      const values = Object.values(responseData);
      if (values.length > 0) {
        const messageValue = values[0];
        if (Array.isArray(messageValue)) {
          return messageValue.join(', ');
        }
        if (typeof messageValue === 'string') {
          return messageValue;
        }
      }
    }
    return error.message || 'Unexpected error';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
};

const toLocalDateIso = (date: Date) => {
  const offsetMillis = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(offsetMillis).toISOString().split('T')[0];
};

const formatDateDisplay = (value?: string | null) => {
  if (!value) return 'N/A';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    if (year && month && day) {
      const monthLabel = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleString('en-IN', {
        month: 'short',
      });
      return `${day}-${monthLabel}-${year}`;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTimeDisplay = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDateDisplay(value);
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateForInput = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (isoMatch) {
    return isoMatch[1];
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateInput = (value?: string | null) => {
  const normalized = formatDateForInput(value);
  return normalized || null;
};

const resolvePoojaStatus = (value?: string | null): PoojaStatusKey => {
  const isoDate = formatDateForInput(value);
  if (!isoDate) {
    return 'pending';
  }
  const todayIso = toLocalDateIso(new Date());
  if (isoDate === todayIso) {
    return 'today';
  }
  if (isoDate > todayIso) {
    return 'upcoming';
  }
  return 'completed';
};

const resolveRegistrationTimestamp = (record: RegistrationRecord) => record.updated_at ?? record.created_at;

const formatDobDisplay = (value?: string | null) => {
  if (!value) return 'N/A';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    if (year && month && day) return `${day}-${month}-${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatBooleanLabel = (value?: boolean | null) => (value ? 'Yes' : 'No');

const formatNumber = (value: number) => value.toLocaleString('en-IN');

const EXPORT_HEADERS = ['Pooja Date', 'Tamil Star', 'Day Option', 'Donor Name'] as const;

type ExportHeader = (typeof EXPORT_HEADERS)[number];
type ExportRow = Record<ExportHeader, string>;

// Interface for stored updated pooja dates
interface UpdatedPoojaDate {
  id: number;
  poojaDate: string;
  updatedAt: string;
}

const MEMBER_FIELD_ALIASES = {
  dateOfBirth: ['date_of_birth', 'dateOfBirth', 'dob', 'birth_date', 'birthDate'],
  familyName: ['family_name', 'familyName', 'family', 'familyname'],
  tamilStar: ['tamil_star', 'tamilStar', 'star'],
  rasi: ['rasi', 'member_rasi', 'memberRasi'],
  gothra: ['gothra', 'gothram', 'gothram_name', 'gothramName', 'gothram'],
} as const;

const normalizeMemberValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asString = value.toString().trim();
    return asString.length > 0 ? asString : null;
  }
  if (value && typeof value === 'object') {
    const maybeLabel = (value as Record<string, unknown>).label ?? (value as Record<string, unknown>).name;
    if (typeof maybeLabel === 'string') {
      const trimmed = maybeLabel.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
};

const readMemberField = (member: RegistrationMember | null | undefined, keys: readonly string[]) => {
  if (!member) return null;
  const record = member as Record<string, unknown>;
  for (const key of keys) {
    const raw = normalizeMemberValue(record[key]);
    if (raw) return raw;
  }
  return null;
};

const resolveMemberDob = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.dateOfBirth);

const resolveMemberFamilyName = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.familyName);

const resolveMemberTamilStar = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.tamilStar);

const resolveMemberRasi = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.rasi);

const resolveMemberGothra = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.gothra);

const titleCaseLabel = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((segment) => (segment ? `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}` : ''))
    .join(' ');

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'string' ? Number(value) : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numeric);
};

const buildCartMemberNames = (members?: CartItem['members']) => {
  if (!members || members.length === 0) {
    return '—';
  }
  const names = members
    .map((member) => member?.name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 0));
  return names.length > 0 ? names.join(', ') : '—';
};

const resolveCartItemServiceDate = (item: CartItem) => item.customDayDate ?? item.bookingDate ?? '';

const resolveCartItemTamilStar = (item: CartItem) => {
  const members = Array.isArray(item.members) ? item.members : [];
  for (const member of members) {
    const star = member?.tamilStar?.trim() || member?.tamil_star?.trim();
    if (star) {
      return star;
    }
  }
  if (item.memberTamilStar) {
    return item.memberTamilStar;
  }
  return '—';
};

const resolveRecurringFrequencyLabel = (plan: RecurringPlanRecord) => {
  const frequency = plan.recurrence_frequency?.trim();
  if (frequency && plan.recurrence_kind === 'recurring') {
    return `${titleCaseLabel(frequency.replace(/_/g, ' '))} recurring`;
  }
  if (plan.recurrence_kind === 'one_time_extra') {
    return 'One-time extra';
  }
  if (frequency) {
    return titleCaseLabel(frequency.replace(/_/g, ' '));
  }
  return 'Recurring plan';
};

const resolveRecurringPlanScheduleLabel = (plan: RecurringPlanRecord) => {
  const dateValue = plan.next_occurrence ?? plan.one_time_date ?? plan.start_date;
  return dateValue ? formatDateDisplay(dateValue) : 'Schedule pending';
};

const resolveCartItemDayOption = (item: CartItem) => {
  const candidates = [
    item.dayOptionDescription,
    item.dayOptionCategory,
    item.dayOptionCode,
  ];
  for (const rawValue of candidates) {
    const trimmed = rawValue?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return DAY_OPTION_PLACEHOLDER;
};

const resolveRecurringPlanMemberNames = (plan: RecurringPlanRecord) => {
  const members = plan.metadata?.members ?? [];
  const names = members
    .map((member) => (member?.name ?? '').trim())
    .filter((memberName) => memberName.length > 0);

  if (names.length === 0) {
    return 'Devotee details unavailable';
  }

  return names.join(', ');
};

const convertRecurringPlanToRegistration = (plan: RecurringPlanRecord): RegistrationRecord => {
  const planDate = plan.next_occurrence ?? plan.one_time_date ?? plan.start_date ?? '';
  const formattedDate = planDate || undefined;
  const members =
    plan.metadata?.members?.map((member, index) => ({
      id: index + 1,
      name: member?.name ?? undefined,
      family_name: member?.family_name ?? undefined,
      tamil_star: member?.tamil_star ?? undefined,
      rasi: member?.rasi ?? undefined,
      gothra: member?.gothra ?? undefined,
      date_of_birth: member?.date_of_birth ?? undefined,
    })) ?? undefined;

  return {
    id: plan.id * -1,
    pooja_reg_id: `RP-${plan.id}`,
    start_date: formattedDate,
    pooja_option_name: plan.pooja_option_name,
    day_option_description: plan.day_option_description,
    donor_name: plan.donor_name,
    created_at: plan.start_date ?? planDate ?? new Date().toISOString(),
    updated_at: plan.next_occurrence ?? formattedDate,
    members,
    isRecurringPlan: true,
    recurringPlanId: plan.id,
  };
};

const formatDevoteesForExport = (members?: RegistrationMember[] | null) => {
  const validMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  if (validMembers.length === 0) return 'No devotee details available';

  return validMembers
    .map((member) => {
      const name = (member?.name ?? '').trim() || 'N/A';
      const familyName = resolveMemberFamilyName(member) ?? 'N/A';
      const tamilStar = resolveMemberTamilStar(member) ?? 'N/A';
      const gothra = resolveMemberGothra(member) ?? 'N/A';
      const rasi = resolveMemberRasi(member) ?? 'N/A';
      const dob = formatDobDisplay(resolveMemberDob(member));
      return `${name} (DOB: ${dob}, Family: ${familyName}, Rasi: ${rasi}, Tamil Star: ${tamilStar}, Gothram: ${gothra})`;
    })
    .join('\n');
};

const resolvePoojaId = (record: RegistrationRecord) => {
  const trimmed = (record.pooja_reg_id ?? '').trim();
  return trimmed || `#${record.id}`;
};

const resolveDonorName = (value?: string | null) => {
  const trimmed = (value ?? '').trim();
  return trimmed || 'Temple Admin';
};

const resolveRegistrationTamilStar = (registration: RegistrationRecord) => {
  const members = Array.isArray(registration.members) ? registration.members : [];
  for (const member of members) {
    const star = resolveMemberTamilStar(member);
    if (star) {
      return star;
    }
  }
  return '—';
};

const parseCreatedAt = (record: RegistrationRecord) => {
  if (!record.created_at) return Number.NaN;
  const timestamp = new Date(record.created_at).getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
};

const sortRegistrations = (records: RegistrationRecord[]) =>
  [...records].sort((a, b) => {
    const aTime = parseCreatedAt(a);
    const bTime = parseCreatedAt(b);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
    if (!Number.isNaN(aTime)) return -1;
    if (!Number.isNaN(bTime)) return 1;
    return b.id - a.id;
  });

const categorizeRegistrationsByDay = (records: RegistrationRecord[]): RegistrationBuckets => ({
  all: sortRegistrations(records),
});

const PoojaDetailsPage = () => {
  const [buckets, setBuckets] = useState<RegistrationBuckets>(() => buildEmptyBuckets());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [rawRegistrations, setRawRegistrations] = useState<RegistrationRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [postPrasadamOnly, setPostPrasadamOnly] = useState(false);
  const [editingRegistrationId, setEditingRegistrationId] = useState<number | null>(null);
  const [editDateValue, setEditDateValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [updatedPoojaDates, setUpdatedPoojaDates] = useState<Map<number, UpdatedPoojaDate>>(new Map());
  const [recurringPlans, setRecurringPlans] = useState<RecurringPlanRecord[]>([]);
  const [recurringPlansLoading, setRecurringPlansLoading] = useState(false);
  const [recurringPlansError, setRecurringPlansError] = useState<string | null>(null);
  const [cartSnapshots, setCartSnapshots] = useState<CartSnapshotRecord[]>([]);
  const [cartSnapshotsLoading, setCartSnapshotsLoading] = useState(false);
  const [cartSnapshotsError, setCartSnapshotsError] = useState<string | null>(null);

  const recordMatchesFilters = useCallback(
    (record: RegistrationRecord, normalizedQuery: string) => {
      if (postPrasadamOnly && !record.post_prasadam) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const poojaName = record.pooja_option_name?.toLowerCase() ?? '';
      const donorName = record.donor_name?.toLowerCase() ?? '';
      const poojaId = resolvePoojaId(record).toLowerCase();
      const dayOption = record.day_option_description?.toLowerCase() ?? '';
      const members = Array.isArray(record.members) ? record.members : [];
      const memberMatch = members.some((member) => {
        const name = typeof member?.name === 'string' ? member.name.toLowerCase() : '';
        return name.includes(normalizedQuery);
      });

      return (
        poojaName.includes(normalizedQuery) ||
        donorName.includes(normalizedQuery) ||
        poojaId.includes(normalizedQuery) ||
        dayOption.includes(normalizedQuery) ||
        memberMatch
      );
    },
    [postPrasadamOnly],
  );

  // Load updated pooja dates from localStorage on component mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(UPDATED_POOJA_DATES_KEY);
      if (stored) {
        const parsedData: UpdatedPoojaDate[] = JSON.parse(stored);
        const today = toLocalDateIso(new Date());
        
        // Filter out expired entries (pooja dates in the past)
        const validEntries = parsedData.filter(item => item.poojaDate >= today);
        
        // Update state with valid entries
        const validMap = new Map<number, UpdatedPoojaDate>();
        validEntries.forEach(item => {
          validMap.set(item.id, item);
        });
        
        setUpdatedPoojaDates(validMap);
        
        // Update localStorage with only valid entries
        localStorage.setItem(UPDATED_POOJA_DATES_KEY, JSON.stringify(validEntries));
      }
    } catch (error) {
      console.error('Error loading updated pooja dates from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem(UPDATED_POOJA_DATES_KEY);
    }
  }, []);

  // Save updated pooja dates to localStorage whenever they change
  useEffect(() => {
    if (updatedPoojaDates.size > 0) {
      const data: UpdatedPoojaDate[] = Array.from(updatedPoojaDates.values()).map((item) => ({
        ...item,
        updatedAt: item.updatedAt ?? new Date().toISOString(),
      }));
      localStorage.setItem(UPDATED_POOJA_DATES_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(UPDATED_POOJA_DATES_KEY);
    }
  }, [updatedPoojaDates]);

  // Check if a pooja date is still valid (not in the past)
  const isPoojaDateValid = useCallback((poojaDate: string | null | undefined) => {
    if (!poojaDate) return false;
    const today = toLocalDateIso(new Date());
    return poojaDate >= today;
  }, []);

  // Clean up expired entries periodically (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const today = toLocalDateIso(new Date());
      setUpdatedPoojaDates(prev => {
        const cleaned = new Map<number, UpdatedPoojaDate>();
        prev.forEach((entry, id) => {
          if (entry.poojaDate >= today) {
            cleaned.set(id, entry);
          }
        });
        return cleaned;
      });
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (updatedPoojaDates.size === 0 || rawRegistrations.length === 0) {
      return;
    }

    const registrationsById = new Map(rawRegistrations.map((record) => [record.id, record]));

    setUpdatedPoojaDates((prev) => {
      let mutated = false;
      const next = new Map(prev);

      prev.forEach((entry, id) => {
        const record = registrationsById.get(id);
        if (!record) {
          next.delete(id);
          mutated = true;
          return;
        }

        const normalizedStartDate = normalizeDateInput(record.start_date);
        if (normalizedStartDate === entry.poojaDate) {
          return;
        }

        const recordTimestampSource = resolveRegistrationTimestamp(record);
        const recordTimestamp = recordTimestampSource ? Date.parse(recordTimestampSource) : Number.NaN;
        const overrideTimestamp = entry.updatedAt ? Date.parse(entry.updatedAt) : Number.NaN;

        if (
          !Number.isNaN(recordTimestamp) &&
          !Number.isNaN(overrideTimestamp) &&
          recordTimestamp > overrideTimestamp
        ) {
          next.delete(id);
          mutated = true;
        }
      });

      return mutated ? next : prev;
    });
  }, [rawRegistrations, updatedPoojaDates]);

  const applyPoojaDateOverride = useCallback(
    (record: RegistrationRecord): RegistrationRecord => {
      const overrideEntry = updatedPoojaDates.get(record.id);
      if (!overrideEntry) {
        return record;
      }

      if (!isPoojaDateValid(overrideEntry.poojaDate)) {
        return record;
      }

      const normalizedStartDate = normalizeDateInput(record.start_date);
      if (normalizedStartDate === overrideEntry.poojaDate) {
        return record;
      }

      const recordTimestampSource = resolveRegistrationTimestamp(record);
      const recordTimestamp = recordTimestampSource ? Date.parse(recordTimestampSource) : Number.NaN;
      const overrideTimestamp = overrideEntry.updatedAt ? Date.parse(overrideEntry.updatedAt) : Number.NaN;

      if (
        !Number.isNaN(recordTimestamp) &&
        !Number.isNaN(overrideTimestamp) &&
        recordTimestamp >= overrideTimestamp
      ) {
        return record;
      }

      return { ...record, start_date: overrideEntry.poojaDate };
    },
    [isPoojaDateValid, updatedPoojaDates],
  );

  const filteredRecurringPlans = useMemo(() => {
    if (recurringPlans.length === 0) {
      return [];
    }
    if (!selectedDate) {
      return recurringPlans;
    }
    return recurringPlans.filter((plan) => {
      const planDate = plan.next_occurrence ?? plan.one_time_date ?? plan.start_date;
      if (!planDate) {
        return false;
      }
      return planDate.slice(0, 10) === selectedDate;
    });
  }, [recurringPlans, selectedDate]);

  const filteredBuckets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const nextBuckets = buildEmptyBuckets();

    (Object.keys(buckets) as DayBucketKey[]).forEach((key) => {
      const decoratedRecords = buckets[key].map(applyPoojaDateOverride);
      nextBuckets[key] = decoratedRecords.filter((record) => recordMatchesFilters(record, query));
    });

    const recurringRegistrations = filteredRecurringPlans
      .map(convertRecurringPlanToRegistration)
      .filter((record) => recordMatchesFilters(record, query));

    if (recurringRegistrations.length > 0) {
      nextBuckets.all = sortRegistrations([...nextBuckets.all, ...recurringRegistrations]);
    }

    return nextBuckets;
  }, [
    applyPoojaDateOverride,
    buckets,
    filteredRecurringPlans,
    recordMatchesFilters,
    searchQuery,
  ]);

  const flattenedFilteredRegistrations = useMemo(
    () =>
      (Object.keys(filteredBuckets) as DayBucketKey[]).reduce<RegistrationRecord[]>(
        (acc, key) => acc.concat(filteredBuckets[key]),
        [],
      ),
    [filteredBuckets],
  );

  const pendingCartRows = useMemo<PendingCartRow[]>(() => {
    return cartSnapshots.flatMap((snapshot) => {
      const donorName = snapshot.donor_name?.trim() || 'Donor';
      return (Array.isArray(snapshot.items) ? snapshot.items : []).map((item) => ({
        cartId: item.cartId,
        poojaDate: resolveCartItemServiceDate(item),
        tamilStar: resolveCartItemTamilStar(item),
        dayOption: resolveCartItemDayOption(item),
        donorName,
        postPrasadam: Boolean(item.postPrasadam),
      }));
    });
  }, [cartSnapshots]);

  const filteredPendingCartRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return pendingCartRows.filter((row) => {
      if (selectedDate) {
        const dateIso = formatDateForInput(row.poojaDate || '');
        if (!dateIso || dateIso !== selectedDate) {
          return false;
        }
      }
      if (postPrasadamOnly && !row.postPrasadam) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = `${row.poojaDate ?? ''} ${row.dayOption ?? ''} ${row.tamilStar ?? ''} ${
        row.donorName ?? ''
      }`.toLowerCase();
      return haystack.includes(query);
    });
  }, [pendingCartRows, postPrasadamOnly, searchQuery, selectedDate]);

  const pendingCartDonorCount = useMemo(() => {
    const donors = new Set<string>();
    filteredPendingCartRows.forEach((row) => {
      if (row.donorName) {
        donors.add(row.donorName);
      }
    });
    return donors.size;
  }, [filteredPendingCartRows]);

  const pendingCartSummaryLabel = useMemo(() => {
    if (cartSnapshotsLoading) {
      return 'Refreshing…';
    }
    const count = filteredPendingCartRows.length;
    const donors = pendingCartDonorCount;
    return `${count} pending item${count === 1 ? '' : 's'} from ${donors} donor${donors === 1 ? '' : 's'}`;
  }, [cartSnapshotsLoading, filteredPendingCartRows.length, pendingCartDonorCount]);

  const buildExportRows = useCallback(() => {
    if (filteredPendingCartRows.length === 0) {
      return null;
    }

    const rows: ExportRow[] = filteredPendingCartRows.map((row) => ({
      'Pooja Date': formatDateDisplay(row.poojaDate),
      'Tamil Star': row.tamilStar,
      'Day Option': row.dayOption,
      'Donor Name': row.donorName,
    }));

    const filenameDate = selectedDate || toLocalDateIso(new Date());
    const selectionDetails = [
      selectedDate ? `Selected Date: ${formatDateDisplay(selectedDate)}` : 'Selected Date: All Dates',
      searchQuery.trim() ? `Search: "${searchQuery.trim()}"` : null,
      postPrasadamOnly ? 'Filter: Post Prasadam only' : null,
    ].filter(Boolean);
    const selectionLabel = selectionDetails.join(' | ') || 'All records';

    return { rows, filenameDate, selectionLabel };
  }, [filteredPendingCartRows, postPrasadamOnly, searchQuery, selectedDate]);

  const handleExcelDownload = useCallback(() => {
    const exportData = buildExportRows();
    if (!exportData) {
      window.alert('No registrations available to download for the selected criteria.');
      return;
    }

    const { rows, filenameDate } = exportData;
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pooja Details');
    XLSX.writeFile(workbook, `pooja-details-${filenameDate}.xlsx`);
  }, [buildExportRows]);

  const handlePdfDownload = useCallback(async () => {
    const exportData = buildExportRows();
    if (!exportData) {
      window.alert('No registrations available to download for the selected criteria.');
      return;
    }

    const { rows, filenameDate, selectionLabel } = exportData;

    try {
      const pdfMakeInstance = await loadPdfMake();
      if (!pdfMakeInstance?.createPdf) {
        throw new Error('pdfMake is unavailable');
      }

      const tableBody = [
        EXPORT_HEADERS.map((header) => ({
          text: header,
          style: 'tableHeader',
          font: PDF_TAMIL_FONT_NAME,
        })),
        ...rows.map((row) =>
          EXPORT_HEADERS.map((header) => ({
            text: row[header] ?? '',
            font: PDF_TAMIL_FONT_NAME,
          })),
        ),
      ];

      const generatedOn = formatDateTimeDisplay(new Date().toISOString());

      const docDefinition: TDocumentDefinitions = {
        info: {
          title: `Pooja Details - ${filenameDate}`,
        },
        pageOrientation: 'landscape',
        pageSize: 'A4',
        pageMargins: [24, 24, 24, 24],
        defaultStyle: {
          font: PDF_TAMIL_FONT_NAME,
          fontSize: 9,
        },
        styles: {
          header: {
            font: PDF_TAMIL_FONT_NAME,
            fontSize: 16,
            bold: true,
          },
          subheader: {
            font: PDF_TAMIL_FONT_NAME,
            fontSize: 10,
            color: '#475569',
            margin: [0, 2, 0, 8],
          },
          tableHeader: {
            font: PDF_TAMIL_FONT_NAME,
            bold: true,
            fillColor: '#f1f5f9',
          },
        },
        content: [
          { text: 'Registered Pooja Details', style: 'header', margin: [0, 0, 0, 4] },
          { text: selectionLabel, style: 'subheader' },
          { text: `Generated on: ${generatedOn}`, style: 'subheader' },
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', 'auto', '*'],
              body: tableBody,
            },
            layout: 'lightHorizontalLines',
          },
        ],
      };

      pdfMakeInstance.createPdf(docDefinition).download(`pooja-details-${filenameDate}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      window.alert('Unable to generate PDF right now. Please try again later.');
    }
  }, [buildExportRows]);

  const pendingRegistrationFallback = useMemo<RegistrationRecord[]>(() => {
    return filteredPendingCartRows.map((row, index) => ({
      id: -(index + 1),
      start_date: row.poojaDate ?? null,
      donor_name: row.donorName,
      post_prasadam: row.postPrasadam,
    }));
  }, [filteredPendingCartRows]);

  const registrationStatsSource = useMemo<RegistrationRecord[]>(() => {
    return flattenedFilteredRegistrations.length > 0
      ? flattenedFilteredRegistrations
      : pendingRegistrationFallback;
  }, [flattenedFilteredRegistrations, pendingRegistrationFallback]);

  const summaryStats = useMemo(() => {
    const total = registrationStatsSource.length;
    const donors = new Set<string>();
    let postPrasadamCount = 0;
    const baseToday = new Date();
    baseToday.setHours(0, 0, 0, 0);
    const todayIso = toLocalDateIso(baseToday);
    const todayStart = baseToday.getTime();
    let todayCount = 0;
    let upcomingTimestamp = Number.POSITIVE_INFINITY;
    let upcomingIso: string | null = null;

    registrationStatsSource.forEach((record) => {
      donors.add(resolveDonorName(record.donor_name));
      if (record.post_prasadam) {
        postPrasadamCount += 1;
      }

      const startDateIso = typeof record.start_date === 'string' ? record.start_date.slice(0, 10) : null;
      if (!startDateIso) {
        return;
      }

      if (startDateIso === todayIso) {
        todayCount += 1;
      }

      const startTime = Date.parse(`${startDateIso}T00:00:00`);
      if (!Number.isNaN(startTime) && startTime >= todayStart && startTime < upcomingTimestamp) {
        upcomingTimestamp = startTime;
        upcomingIso = startDateIso;
      }
    });

    return {
      total,
      uniqueDonors: donors.size,
      postPrasadam: postPrasadamCount,
      postPrasadamRatio: total > 0 ? Math.round((postPrasadamCount / total) * 100) : 0,
      upcomingLabel: upcomingIso ? formatDateDisplay(upcomingIso) : 'Not scheduled',
      todayCount,
    };
  }, [registrationStatsSource]);

  const statusBreakdown = useMemo(() => {
    const breakdown = buildEmptyStatusBreakdown();
    registrationStatsSource.forEach((record) => {
      const statusKey = resolvePoojaStatus(record.start_date);
      breakdown[statusKey] += 1;
    });
    return breakdown;
  }, [registrationStatsSource]);

  const filtersActive = Boolean(selectedDate || searchQuery.trim() || postPrasadamOnly);

  useEffect(() => {
    let active = true;

    const fetchRegistrations = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = {
          page_size: 250,
          ...(selectedDate && { date: selectedDate }),
        } as Record<string, string | number>;

        const collected: RegistrationRecord[] = [];

        let requestUrl: string | null = 'pooja/registrations/';
        let isFirstRequest = true;
        let safetyCounter = 0;

        while (requestUrl && safetyCounter < 25) {
          const response = await api.get(requestUrl, isFirstRequest ? { params } : undefined);
          if (!active) {
            return;
          }

          collected.push(...extractResults<RegistrationRecord>(response.data));

          const nextUrl =
            typeof response.data?.next === 'string' && response.data.next.trim().length > 0
              ? response.data.next
              : null;

          requestUrl = nextUrl;
          isFirstRequest = false;
          safetyCounter += 1;
        }

        const matchingRecords = selectedDate
          ? collected.filter((record) => record.start_date?.slice(0, 10) === selectedDate)
          : collected;

        const nextBuckets = categorizeRegistrationsByDay(matchingRecords);

        const flattenedBase = (Object.keys(nextBuckets) as DayBucketKey[]).reduce<RegistrationRecord[]>(
          (acc, key) => acc.concat(nextBuckets[key]),
          [],
        );

        setBuckets(nextBuckets);
        setRawRegistrations(flattenedBase);
        setLastUpdated(new Date().toISOString());
      } catch (err) {
        console.error('Failed to load pooja registrations', err);
        if (active) {
          setError('Unable to load pooja details right now. Please try again later.');
          setBuckets(buildEmptyBuckets());
          setRawRegistrations([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchRegistrations();

    return () => {
      active = false;
    };
  }, [selectedDate]);

  useEffect(() => {
    let active = true;

    const loadRecurringPlans = async () => {
      try {
        setRecurringPlansLoading(true);
        setRecurringPlansError(null);
        const response = await api.get('pooja/recurrence/plans/', {
          params: { page_size: 250 },
        });
        if (!active) return;
        const plans = extractResults<RecurringPlanRecord>(response.data);
        setRecurringPlans(plans);
      } catch (err) {
        if (active) {
          setRecurringPlans([]);
          setRecurringPlansError(extractErrorMessage(err));
        }
      } finally {
        if (active) {
          setRecurringPlansLoading(false);
        }
      }
    };

    loadRecurringPlans();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadCartSnapshots = async () => {
      try {
        setCartSnapshotsLoading(true);
        setCartSnapshotsError(null);
        const response = await api.get<CartSnapshotRecord[]>('pooja/cart-snapshots/report/');
        if (!active) {
          return;
        }
        const payload: CartSnapshotRecord[] = Array.isArray(response.data) ? response.data : [];
        setCartSnapshots(payload);
      } catch (err) {
        console.error('Failed to load cart snapshots', err);
        if (!active) {
          return;
        }
        setCartSnapshots([]);
        setCartSnapshotsError(extractErrorMessage(err));
      } finally {
        if (active) {
          setCartSnapshotsLoading(false);
        }
      }
    };

    loadCartSnapshots();

    return () => {
      active = false;
    };
  }, []);


  const applyRegistrationUpdate = useCallback(
    (updatedRecord: RegistrationRecord) => {
      const matchesSelectedDate = (record: RegistrationRecord) => {
        if (!selectedDate) {
          return true;
        }
        const iso = typeof record.start_date === 'string' ? record.start_date.slice(0, 10) : null;
        return iso === selectedDate;
      };

      setRawRegistrations((prev) => {
        let nextList: RegistrationRecord[];
        if (prev.some((record) => record.id === updatedRecord.id)) {
          nextList = prev.map((record) => (record.id === updatedRecord.id ? { ...record, ...updatedRecord } : record));
        } else {
          nextList = [...prev, updatedRecord];
        }
        nextList = nextList.filter(matchesSelectedDate);
        setBuckets(categorizeRegistrationsByDay(nextList));
        return nextList;
      });
    },
    [selectedDate],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Registrations',
        value: summaryStats.total > 0 ? formatNumber(summaryStats.total) : '0',
        helper: selectedDate
          ? `For ${formatDateDisplay(selectedDate)}`
          : 'Across all loaded dates',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 5a2 2 0 012-2h14a2 2 0 012 2v3H3V5z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h2m4 0h2M8 17h8" />
          </svg>
        ),
        color: 'from-orange-500 to-rose-600',
      },
      {
        label: 'Unique Donors',
        value: summaryStats.uniqueDonors > 0 ? formatNumber(summaryStats.uniqueDonors) : '0',
        helper: 'Distinct donor names in view',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.5a2.75 2.75 0 11-5.5 0 2.75 2.75 0 015.5 0zM17.5 9.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 18.75a4.75 4.75 0 019.5 0M14.5 18.75a4.25 4.25 0 018.5 0"
            />
          </svg>
        ),
        color: 'from-rose-500 to-rose-600',
      },
      {
        label: 'Post Prasadam',
        value: summaryStats.postPrasadam > 0 ? formatNumber(summaryStats.postPrasadam) : '0',
        helper:
          summaryStats.total > 0
            ? `${summaryStats.postPrasadamRatio}% of registrations`
            : 'No requests in current view',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7 3.582 7 8 7z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.5 10.5L12 13l5-5"
            />
          </svg>
        ),
        color: 'from-amber-500 to-orange-600',
      },
      {
        label: 'Next Service Date',
        value: summaryStats.total > 0 ? summaryStats.upcomingLabel : '—',
        helper:
          summaryStats.todayCount > 0
            ? `${formatNumber(summaryStats.todayCount)} scheduled today`
            : 'Monitor upcoming schedules',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m4 0H4m16 0v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7m8 4v4l3 1"
            />
          </svg>
        ),
        color: 'from-rose-500 to-pink-600',
      },
    ],
    [selectedDate, summaryStats],
  );

  const heroHighlights = useMemo(
    () => [
      {
        label: 'Services Today',
        value: summaryStats.todayCount > 0 ? formatNumber(summaryStats.todayCount) : '—',
        helper: 'Poojas scheduled for the current day',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l3 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
      },
      {
        label: 'Awaiting Schedule',
        value: statusBreakdown.pending > 0 ? formatNumber(statusBreakdown.pending) : '—',
        helper: 'Registrations without an assigned date',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
      },
      {
        label: 'Post Prasadam',
        value: summaryStats.postPrasadam > 0 ? formatNumber(summaryStats.postPrasadam) : '—',
        helper: 'Deliveries that need coordination',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7h16M4 11h16M4 15h10"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l2 2 4-4"
            />
          </svg>
        ),
      },
    ],
    [statusBreakdown.pending, summaryStats.postPrasadam, summaryStats.todayCount],
  );


  const todayIso = toLocalDateIso(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowIso = toLocalDateIso(tomorrowDate);

  const quickDateFilters = [
    {
      label: 'All dates',
      value: '',
      helper: 'Every loaded registration',
    },
    {
      label: 'Today',
      value: todayIso,
      helper: formatDateDisplay(todayIso),
    },
    {
      label: 'Tomorrow',
      value: tomorrowIso,
      helper: formatDateDisplay(tomorrowIso),
    },
  ] as const;

  const totalLoaded = rawRegistrations.length;
  const showingLabel =
    totalLoaded > 0
      ? `Showing ${formatNumber(summaryStats.total)} of ${formatNumber(totalLoaded)} registrations`
      : 'No registrations loaded yet';

  const startEditingRegistrationDate = (record: RegistrationRecord) => {
    if (editSubmitting) {
      return;
    }
    setEditingRegistrationId(record.id);
    setEditDateValue(formatDateForInput(record.start_date));
    setEditError(null);
  };

  const cancelEditingRegistrationDate = () => {
    if (editSubmitting) {
      return;
    }
    setEditingRegistrationId(null);
    setEditDateValue('');
    setEditError(null);
  };

  const submitRegistrationDateUpdate = async () => {
    if (!editingRegistrationId) {
      return;
    }
    if (!editDateValue) {
      setEditError('Pooja date is required');
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const response = await api.patch<RegistrationRecord>(`pooja/registrations/${editingRegistrationId}/`, {
        start_date: editDateValue,
      });
      const updatedRecord = response.data;
      const serverUpdatedAt =
        updatedRecord.updated_at ?? updatedRecord.created_at ?? new Date().toISOString();
      applyRegistrationUpdate(updatedRecord);

      setUpdatedPoojaDates((prev) => {
        const next = new Map(prev);
        next.set(editingRegistrationId, {
          id: editingRegistrationId,
          poojaDate: editDateValue,
          updatedAt: serverUpdatedAt,
        });
        return next;
      });

      setEditingRegistrationId(null);
      setEditDateValue('');
      setLastUpdated(serverUpdatedAt);
    } catch (err) {
      setEditError(extractErrorMessage(err));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedDate('');
    setSearchQuery('');
    setPostPrasadamOnly(false);
  };

  const renderRecurringPlanBanner = () => {
    if (recurringPlansLoading) {
      return (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-500"></span>
          Loading recurring plans…
        </div>
      );
    }

    if (recurringPlansError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
          Unable to load recurring plans. {recurringPlansError}
        </div>
      );
    }

    if (filteredRecurringPlans.length === 0) {
      return null;
    }

    const headingLabel = selectedDate
      ? `Recurring plans on ${formatDateDisplay(selectedDate)}`
      : 'Recurring plans';

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-800">{headingLabel}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {formatNumber(filteredRecurringPlans.length)} plan
            {filteredRecurringPlans.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="mt-3 space-y-3">
          {filteredRecurringPlans.map((plan) => {
            const planDateLabel = resolveRecurringPlanScheduleLabel(plan);
            return (
              <div
                key={plan.id}
                className="grid gap-2 rounded-xl border border-slate-100 bg-white/80 p-3 shadow-sm sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div className="space-y-1 text-sm text-slate-600">
                  <p className="text-sm font-semibold text-slate-900">
                    {plan.pooja_option_name?.trim() || 'Unnamed plan'}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {resolveRecurringFrequencyLabel(plan)}
                  </p>
                  <p className="text-xs text-slate-500">Next occurrence: {planDateLabel}</p>
                  <p className="text-xs text-slate-500">Amount: {formatCurrency(plan.amount)}</p>
                  <p className="text-xs text-slate-500">
                    Donor: {resolveDonorName(plan.donor_name)} {plan.donor_phone ? `• ${plan.donor_phone}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    Devotees: {resolveRecurringPlanMemberNames(plan)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right text-xs">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${
                      plan.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[11px] text-slate-400">Plan ID #{plan.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleQuickDateSelect = useCallback(
    (value: string) => {
      setSelectedDate(value);
    },
    [setSelectedDate],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-white py-4 sm:py-6 md:py-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-6 px-4 sm:px-6 lg:px-8 xl:px-10">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-700 via-rose-700 to-slate-900 p-4 sm:p-6 md:p-8 shadow-2xl ring-1 ring-black/5">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="pointer-events-none absolute -right-20 top-10 h-48 w-48 rounded-full bg-white/20 blur-3xl"></div>
          <div className="relative z-10 flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2 sm:space-y-3 text-white">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold uppercase tracking-[0.2em]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.75a3 3 0 110 6 3 3 0 010-6z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 18a5.25 5.25 0 0110.5 0M3 5.25h18"
                    />
                  </svg>
                  Admin overview
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pooja registrations</h1>
                  <p className="mt-1 sm:mt-2 text-sm sm:text-base max-w-2xl text-orange-100/90">
                    Monitor daily seva bookings, respond to prasadam requests, and export schedules for the temple teams.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 text-sm text-orange-100 sm:items-end">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 sm:px-4 py-1 sm:py-1.5 text-sm font-medium text-white shadow-sm backdrop-blur">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6l3 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {lastUpdated ? `Last synced ${formatDateTimeDisplay(lastUpdated)}` : 'Syncing latest data…'}
                </span>
                <span className="text-xs uppercase tracking-wide text-orange-200">{showingLabel}</span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {heroHighlights.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-2xl bg-white/15 px-4 py-3 text-white shadow-inner ring-1 ring-white/30 backdrop-blur"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                    {item.icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-orange-100">{item.label}</span>
                    <span className="text-xl sm:text-2xl font-semibold">{item.value}</span>
                    <span className="text-[11px] text-orange-100/80">{item.helper}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-slate-50 p-1 shadow-lg ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="absolute inset-x-6 top-6 h-32 rounded-full bg-slate-100 blur-3xl opacity-70" />
              <div className={`h-1 rounded-full bg-gradient-to-r ${card.color}`}></div>
              <div className="relative z-10 p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                    <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">{card.value}</p>
                    <p className="mt-1 text-sm text-slate-500">{card.helper}</p>
                  </div>
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${card.color} text-white shadow-md ring-2 ring-white/60`}>
                    {card.icon}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pending cart snapshots */}
        <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pending cart registrations</h2>
              <p className="text-sm text-slate-500">
                Monitor donors who started registrations but haven’t recorded a payment yet.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {pendingCartSummaryLabel}
            </span>
          </div>
          {/* Pending cart filters & exports */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white px-4 sm:px-6 py-5 sm:py-7 shadow-xl ring-1 ring-slate-100">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-orange-50 to-transparent opacity-70" />
            <div
              className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-orange-200/30 blur-3xl"
              aria-hidden
            />
            <div className="relative z-10 space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Filters &amp; exports</p>
                  <p className="text-sm text-slate-500">
                    Narrow pending carts, focus on a date, and share snapshots with the operations team.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${filtersActive ? 'bg-orange-500' : 'bg-slate-300'}`} />
                  {filtersActive ? 'Filters active' : 'Showing all records'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                {quickDateFilters.map((chip) => {
                  const isActive = selectedDate === chip.value || (!selectedDate && chip.value === '');
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleQuickDateSelect(chip.value)}
                      className={`group inline-flex items-center gap-2 rounded-2xl px-3 sm:px-4 py-2 text-left text-sm transition ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                          : 'bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide">{chip.label}</span>
                      <span className={`text-[11px] ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                        {chip.helper}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="md:col-span-2">
                  <label htmlFor="pooja-search" className="block text-sm font-semibold text-slate-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.65 5.65a7.5 7.5 0 0010.998 10.999z"
                        />
                      </svg>
                    </span>
                    <input
                      id="pooja-search"
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by pooja name, donor, day option, or devotee"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-700 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Tip: Start typing a devotee name to instantly filter matching families.
                  </p>
                </div>
                <div>
                  <label htmlFor="pooja-date" className="block text-sm font-semibold text-slate-700 mb-2">
                    Filter by date
                  </label>
                  <input
                    id="pooja-date"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Showing: {selectedDate ? formatDateDisplay(selectedDate) : 'all loaded dates'}
                  </p>
                </div>
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      checked={postPrasadamOnly}
                      onChange={(event) => setPostPrasadamOnly(event.target.checked)}
                    />
                    Post Prasadam only
                  </label>
                  <p className="text-xs text-slate-500">Prioritize devotees who expect postal delivery.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <span className="text-sm font-medium text-slate-600">
                  {filtersActive ? 'Active filters applied' : 'Showing all loaded records'}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {filtersActive && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        className="h-4 w-4"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear filters
                    </button>
                  )}
                  <button
                    onClick={handleExcelDownload}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:shadow-lg hover:from-rose-600 hover:to-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                      />
                    </svg>
                    Download Excel
                  </button>
                  <button
                    onClick={handlePdfDownload}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:shadow-lg hover:from-rose-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 5a2 2 0 012-2h6a2 2 0 012 2v14a2 2 0 01-2 2H9l-4-4V7a2 2 0 012-2z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 11h6M11 15h4" />
                    </svg>
                    Download PDF
                  </button>
                </div>
              </div>
              {renderRecurringPlanBanner()}
            </div>
          </div>
          {cartSnapshotsLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="h-3 w-3 animate-spin rounded-full border border-slate-200 border-t-orange-500"></span>
              Loading cart snapshots…
            </div>
          ) : cartSnapshotsError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-800">
              Unable to load cart snapshots. {cartSnapshotsError}
            </div>
          ) : filteredPendingCartRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No donors currently have pending cart items.
            </div>
          ) : (
            <div className="overflow-auto rounded-2xl border border-slate-100 bg-slate-50/60">
              <table className="min-w-full table-fixed text-sm">
                <thead className="bg-white/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Pooja Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Tamil Star</th>
                    <th className="px-4 py-3 text-left font-semibold">Day Option</th>
                    <th className="px-4 py-3 text-left font-semibold">Donor Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Post Prasadam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPendingCartRows.map((row, idx) => (
                    <tr key={`${row.cartId}-${idx}`}>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateDisplay(row.poojaDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.tamilStar}</td>
                      <td className="px-4 py-3 text-slate-700">{row.dayOption}</td>
                      <td className="px-4 py-3 text-slate-700">{row.donorName}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.postPrasadam ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PoojaDetailsPage;
