import axios from 'axios';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import api, { extractResults } from '../../lib/api';

declare global {
  interface Window {
    pdfMake?: {
      createPdf: (documentDefinition: TDocumentDefinitions) => {
        download: (fileName: string) => void;
      };
    };
  }
}

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
}

type RegistrationBuckets = Record<DayBucketKey, RegistrationRecord[]>;

const POOJA_STATUS_META = {
  upcoming: {
    label: 'Upcoming',
    description: 'Scheduled after today',
    badgeClass: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    legendClass: 'border border-emerald-100 bg-emerald-50/80 text-emerald-900',
    dotClass: 'bg-emerald-500',
    rowAccentClass: 'border-emerald-400',
    rowHoverClass: 'hover:bg-emerald-50/60',
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

const EXPORT_HEADERS = [
  'Pooja ID',
  'Pooja Date',
  'Pooja Name',
  'Day Option',
  'Devotees',
  'Post Prasadam',
  'Registered By',
  'Registration Date',
] as const;

type ExportHeader = (typeof EXPORT_HEADERS)[number];
type ExportRow = Record<ExportHeader, string>;

// Interface for stored updated pooja dates
interface UpdatedPoojaDate {
  id: number;
  poojaDate: string;
  updatedAt: string;
}

let pdfMakeLoaded = false;

const loadPdfMake = async () => {
  if (!pdfMakeLoaded) {
    const script1 = document.createElement('script');
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
    script1.async = true;
    
    const script2 = document.createElement('script');
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js';
    script2.async = true;

    await new Promise<void>((resolve) => {
      script1.onload = () => {
        document.head.appendChild(script2);
        script2.onload = () => {
          pdfMakeLoaded = true;
          resolve();
        };
      };
      document.head.appendChild(script1);
    });
  }

  if (!window.pdfMake) {
    throw new Error('PDFMake failed to load');
  }

  return window.pdfMake;
};

const MEMBER_FIELD_ALIASES = {
  dateOfBirth: ['date_of_birth', 'dateOfBirth', 'dob', 'birth_date', 'birthDate'],
  familyName: ['family_name', 'familyName', 'family', 'familyname'],
  tamilStar: ['tamil_star', 'tamilStar', 'star'],
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

const resolveMemberGothra = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.gothra);

                      
const formatDevoteesForExport = (members?: RegistrationMember[] | null) => {
  const validMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  if (validMembers.length === 0) return 'No devotee details available';

  return validMembers
    .map((member) => {
      const name = (member?.name ?? '').trim() || 'N/A';
      const familyName = resolveMemberFamilyName(member) ?? 'N/A';
      const tamilStar = resolveMemberTamilStar(member) ?? 'N/A';
      const gothra = resolveMemberGothra(member) ?? 'N/A';
      const dob = formatDobDisplay(resolveMemberDob(member));
      return `${name} (DOB: ${dob}, Family: ${familyName}, Tamil Star: ${tamilStar}, Gothram: ${gothra})`;
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

  const filteredBuckets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const nextBuckets = buildEmptyBuckets();

    (Object.keys(buckets) as DayBucketKey[]).forEach((key) => {
      const decoratedRecords = buckets[key].map(applyPoojaDateOverride);
      nextBuckets[key] = decoratedRecords.filter((record) => {
        if (postPrasadamOnly && !record.post_prasadam) {
          return false;
        }

        if (!query) {
          return true;
        }

        const poojaName = record.pooja_option_name?.toLowerCase() ?? '';
        const donorName = record.donor_name?.toLowerCase() ?? '';
        const poojaId = resolvePoojaId(record).toLowerCase();
        const dayOption = record.day_option_description?.toLowerCase() ?? '';
        const members = Array.isArray(record.members) ? record.members : [];
        const memberMatch = members.some((member) => {
          const name = typeof member?.name === 'string' ? member.name.toLowerCase() : '';
          return name.includes(query);
        });

        return (
          poojaName.includes(query) ||
          donorName.includes(query) ||
          poojaId.includes(query) ||
          dayOption.includes(query) ||
          memberMatch
        );
      });
    });

    return nextBuckets;
  }, [applyPoojaDateOverride, buckets, postPrasadamOnly, searchQuery]);

  const flattenedFilteredRegistrations = useMemo(
    () =>
      (Object.keys(filteredBuckets) as DayBucketKey[]).reduce<RegistrationRecord[]>(
        (acc, key) => acc.concat(filteredBuckets[key]),
        [],
      ),
    [filteredBuckets],
  );

  const summaryStats = useMemo(() => {
    const total = flattenedFilteredRegistrations.length;
    const donors = new Set<string>();
    let postPrasadamCount = 0;
    const baseToday = new Date();
    baseToday.setHours(0, 0, 0, 0);
    const todayIso = toLocalDateIso(baseToday);
    const todayStart = baseToday.getTime();
    let todayCount = 0;
    let upcomingTimestamp = Number.POSITIVE_INFINITY;
    let upcomingIso: string | null = null;

    flattenedFilteredRegistrations.forEach((record) => {
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
  }, [flattenedFilteredRegistrations]);

  const statusBreakdown = useMemo(() => {
    const breakdown = buildEmptyStatusBreakdown();
    flattenedFilteredRegistrations.forEach((record) => {
      const statusKey = resolvePoojaStatus(record.start_date);
      breakdown[statusKey] += 1;
    });
    return breakdown;
  }, [flattenedFilteredRegistrations]);

  const statusLegendEntries = useMemo(
    () =>
      (Object.keys(POOJA_STATUS_META) as PoojaStatusKey[]).map((statusKey) => {
        const count = statusBreakdown[statusKey];
        const share = summaryStats.total > 0 ? Math.round((count / summaryStats.total) * 100) : 0;
        return {
          key: statusKey,
          count,
          share,
          ...POOJA_STATUS_META[statusKey],
        };
      }),
    [statusBreakdown, summaryStats.total],
  );

  const filtersActive = Boolean(selectedDate || searchQuery.trim() || postPrasadamOnly);

  const buildExportRows = useCallback(() => {
    if (flattenedFilteredRegistrations.length === 0) {
      return null;
    }

    const rows: ExportRow[] = flattenedFilteredRegistrations.map((record) => ({
      'Pooja ID': resolvePoojaId(record),
      'Pooja Date': formatDateDisplay(record.start_date),
      'Pooja Name': record.pooja_option_name?.trim() || 'N/A',
      'Day Option': record.day_option_description?.trim() || 'N/A',
      Devotees: formatDevoteesForExport(record.members),
      'Post Prasadam': formatBooleanLabel(record.post_prasadam),
      'Registered By': resolveDonorName(record.donor_name),
      'Registration Date': formatDateTimeDisplay(record.created_at),
    }));

    const filenameDate = selectedDate || toLocalDateIso(new Date());
    const selectionDetails = [
      selectedDate ? `Selected Date: ${formatDateDisplay(selectedDate)}` : 'Selected Date: All Dates',
      searchQuery.trim() ? `Search: "${searchQuery.trim()}"` : null,
      postPrasadamOnly ? 'Filter: Post Prasadam only' : null,
    ].filter(Boolean);
    const selectionLabel = selectionDetails.join(' | ') || 'All records';

    return { rows, filenameDate, selectionLabel };
  }, [flattenedFilteredRegistrations, postPrasadamOnly, searchQuery, selectedDate]);

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
        EXPORT_HEADERS.map((header) => ({ text: header, style: 'tableHeader' })),
        ...rows.map((row) => EXPORT_HEADERS.map((header) => row[header] ?? '')),
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
          fontSize: 9,
        },
        styles: {
          header: {
            fontSize: 16,
            bold: true,
          },
          subheader: {
            fontSize: 10,
            color: '#475569',
            margin: [0, 2, 0, 8],
          },
          tableHeader: {
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
              widths: ['auto', 'auto', 'auto', 'auto', '*', 'auto', 'auto', 'auto'],
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
        color: 'from-green-500 to-emerald-600',
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
        color: 'from-emerald-500 to-teal-600',
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
  const hasData = flattenedFilteredRegistrations.length > 0;

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

  const handleQuickDateSelect = useCallback(
    (value: string) => {
      setSelectedDate(value);
    },
    [setSelectedDate],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-10">
      <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-8 px-4 sm:px-6 lg:px-10">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-700 via-emerald-700 to-slate-900 p-8 shadow-2xl ring-1 ring-black/5">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="pointer-events-none absolute -right-20 top-10 h-48 w-48 rounded-full bg-white/20 blur-3xl"></div>
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3 text-white">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]">
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
                  <h1 className="text-3xl font-bold tracking-tight">Pooja registrations</h1>
                  <p className="mt-2 max-w-2xl text-green-100/90">
                    Monitor daily seva bookings, respond to prasadam requests, and export schedules for the temple teams.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 text-sm text-green-100 sm:items-end">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-medium text-white shadow-sm backdrop-blur">
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
                      d="M12 6v6l3 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {lastUpdated ? `Last synced ${formatDateTimeDisplay(lastUpdated)}` : 'Syncing latest data…'}
                </span>
                <span className="text-xs uppercase tracking-wide text-green-200">{showingLabel}</span>
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
                    <span className="text-xs uppercase tracking-wide text-green-100">{item.label}</span>
                    <span className="text-2xl font-semibold">{item.value}</span>
                    <span className="text-[11px] text-green-100/80">{item.helper}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-slate-50 p-1 shadow-lg ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="absolute inset-x-6 top-6 h-32 rounded-full bg-slate-100 blur-3xl opacity-70" />
              <div className={`h-1 rounded-full bg-gradient-to-r ${card.color}`}></div>
              <div className="relative z-10 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
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

        {/* Filters Section */}
        <div className="relative overflow-hidden rounded-3xl bg-white px-6 py-7 shadow-xl ring-1 ring-slate-100">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-green-50 to-transparent opacity-70" />
          <div
            className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-green-200/30 blur-3xl"
            aria-hidden
          />
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Filters &amp; exports</p>
                <p className="text-sm text-slate-500">
                  Focus on a date, narrow results, and share schedules with the operations team.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span className={`h-2 w-2 rounded-full ${filtersActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {filtersActive ? 'Filters active' : 'Showing all records'}
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {quickDateFilters.map((chip) => {
                const isActive = selectedDate === chip.value || (!selectedDate && chip.value === '');
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleQuickDateSelect(chip.value)}
                    className={`group inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-left text-sm transition ${
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

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
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
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-700 transition focus:border-green-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-100"
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
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition focus:border-green-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Showing: {selectedDate ? formatDateDisplay(selectedDate) : 'all loaded dates'}
                </p>
              </div>
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
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
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-100"
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:shadow-lg hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
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
          </div>
        </div>

        {/* Table Section */}
        <div className="relative overflow-hidden rounded-3xl bg-white/95 shadow-2xl ring-1 ring-slate-100">
          <div
            className="absolute inset-0 bg-gradient-to-br from-white via-white to-green-50 opacity-80"
            aria-hidden
          />
          <div className="relative z-10 w-full px-6 py-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-green-200 border-t-green-600"></div>
                <p className="text-lg font-medium text-slate-700">Loading pooja registrations...</p>
                <p className="text-sm text-slate-500">Fetching the latest data from the temple admin API.</p>
                <div className="w-full max-w-lg space-y-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="h-3 rounded-full bg-slate-200/80 animate-pulse"></div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm12-3.75a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V8.25zm0 6.75a.75.75 0 10-1.5 0v.75a.75.75 0 001.5 0v-.75z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-800">{error}</p>
                    <p className="text-xs text-red-600 mt-1">Please retry in a moment or refresh the page.</p>
                  </div>
                </div>
              </div>
            ) : hasData ? (
              <div className="w-full space-y-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Schedule status</p>
                      <p className="text-xs text-slate-500">
                        Live records grouped by when the pooja takes place.
                      </p>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-3">
                      {statusLegendEntries.map((entry) => (
                        <div
                          key={entry.key}
                          className={`flex min-w-[13rem] flex-1 flex-col gap-2 rounded-2xl px-4 py-3 text-left ${entry.legendClass}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className={`h-3 w-3 rounded-full ${entry.dotClass}`}></span>
                              <div className="text-sm font-semibold text-slate-900">{entry.label}</div>
                            </div>
                            <span className="text-base font-bold text-slate-900">{formatNumber(entry.count)}</span>
                          </div>
                          <p className="text-[11px] text-slate-600">{entry.description}</p>
                          <div className="h-1.5 rounded-full bg-white/60">
                            <span
                              className={`block h-full rounded-full ${entry.dotClass}`}
                              style={{ width: `${entry.share}%` }}
                            ></span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-500">
                            {entry.share}% of view
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-inner">
                  <table className="min-w-[1200px] w-full table-fixed divide-y divide-slate-200">
                    <colgroup>
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '17%' }} />
                      <col style={{ width: '17%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%', minWidth: '500px' }} />
                    </colgroup>
                    <thead className="bg-slate-100/80 backdrop-blur">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Pooja ID
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Pooja Date
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Pooja Name
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Day Option
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Devotees
                          <span className="block text-[11px] font-normal normal-case text-slate-400 mt-1">
                            Name, DOB, Family, Tamil Star, Gothram
                          </span>
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Post Prasadam
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Registered By
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Registration Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {DAY_BUCKETS.map(({ key, label }) => {
                        const registrations = filteredBuckets[key];
                        if (registrations.length === 0) {
                          return null;
                        }
                        const sectionLabel = selectedDate
                          ? `Registrations for ${formatDateDisplay(selectedDate)}`
                          : label;
                        return (
                          <Fragment key={key}>
                            <tr className="bg-green-50/80">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-green-800">{sectionLabel}</span>
                                  <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={1.5}
                                      className="h-3.5 w-3.5"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 6v6l3 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    {formatNumber(registrations.length)} record(s)
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {registrations.map((registration) => {
                          const members = Array.isArray(registration.members)
                            ? registration.members.filter(Boolean)
                            : [];
                          const prasadamBadgeClass = registration.post_prasadam
                            ? 'inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600'
                            : 'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600';
                          const registrationTimestamp = resolveRegistrationTimestamp(registration);
                          const poojaStatus = resolvePoojaStatus(registration.start_date);
                          const statusMeta = POOJA_STATUS_META[poojaStatus];

                          // Check if this registration has an updated pooja date and if it's still valid
                          const updatedPoojaDate = updatedPoojaDates.get(registration.id);
                          const shouldShowUpdatedBadge = updatedPoojaDate?.poojaDate
                            ? isPoojaDateValid(updatedPoojaDate.poojaDate)
                            : false;

                          const isEditing = editingRegistrationId === registration.id;

                          return (
                            <tr
                              key={registration.id}
                              className={`bg-white transition-colors duration-150 ${statusMeta.rowHoverClass} ${isEditing ? 'ring-2 ring-green-400 ring-inset' : ''}`}
                            >
                              <td className={`px-4 py-3 whitespace-nowrap border-l-4 ${statusMeta.rowAccentClass}`}>
                                <div className="text-sm font-bold text-slate-900">{resolvePoojaId(registration)}</div>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="space-y-2">
                                  {/* Always show the original content */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm text-slate-700">{formatDateDisplay(registration.start_date)}</span>
                                    <span
                                      className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold leading-none ${statusMeta.badgeClass}`}
                                    >
                                      {statusMeta.label}
                                    </span>
                                  </div>
                                  
                                  {/* Edit controls appear below when editing */}
                                  {isEditing && (
                                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="date"
                                          value={editDateValue}
                                          onChange={(e) => setEditDateValue(e.target.value)}
                                          className="flex-1 rounded-md border-green-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                                          disabled={editSubmitting}
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={submitRegistrationDateUpdate}
                                          disabled={editSubmitting || !editDateValue}
                                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {editSubmitting ? (
                                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                          ) : (
                                            'Save'
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEditingRegistrationDate}
                                          disabled={editSubmitting}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                      {editError && (
                                        <p className="text-xs font-medium text-red-600">{editError}</p>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Edit button when not editing */}
                                  {!isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => startEditingRegistrationDate(registration)}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                        className="h-3.5 w-3.5"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.75 20.902 3 21.75l.848-3.75L16.862 4.487z"
                                        />
                                      </svg>
                                      Edit date
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div
                                  className="truncate text-sm font-medium text-slate-700"
                                  title={registration.pooja_option_name ?? ''}
                                >
                                  {registration.pooja_option_name?.trim() || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div
                                  className="truncate text-sm text-slate-700"
                                  title={registration.day_option_description ?? ''}
                                >
                                  {registration.day_option_description?.trim() || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  {members.length === 0 ? (
                                    <span className="text-xs text-slate-400 italic">No devotee details available</span>
                                  ) : (
                                    members.map((member, index) => {
                                      const name = (member?.name ?? '').trim() || 'N/A';
                                      const familyName = resolveMemberFamilyName(member) ?? 'N/A';
                                      const tamilStar = resolveMemberTamilStar(member) ?? 'N/A';
                                      const gothra = resolveMemberGothra(member) ?? 'N/A';
                                      const dob = formatDobDisplay(resolveMemberDob(member));
                                      
                                      return (
                                        <div key={member?.id ?? index} className="text-sm">
                                          <div className="font-medium text-slate-800">{name}</div>
                                          <div className="mt-1 space-y-1 text-xs text-slate-600">
                                            <div className="flex flex-wrap gap-x-6 gap-y-1">
                                              <span className="inline-flex items-baseline gap-1">
                                                <span className="font-medium">DOB:</span>
                                                <span>{dob}</span>
                                              </span>
                                              <span className="inline-flex items-baseline gap-1">
                                                <span className="font-medium">Family:</span>
                                                <span>{familyName}</span>
                                              </span>
                                            </div>
                                            <div className="flex flex-wrap gap-x-6 gap-y-1">
                                              <span className="inline-flex items-baseline gap-1">
                                                <span className="font-medium">Tamil Star:</span>
                                                <span>{tamilStar}</span>
                                              </span>
                                              <span className="inline-flex items-baseline gap-1">
                                                <span className="font-medium">Gothram:</span>
                                                <span>{gothra}</span>
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={prasadamBadgeClass}>
                                  {formatBooleanLabel(registration.post_prasadam)}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="flex flex-col gap-1 text-sm text-slate-700">
                                  <span className="font-medium" title={registration.donor_name ?? ''}>
                                    {resolveDonorName(registration.donor_name)}
                                  </span>
                                  {registration.post_prasadam && (
                                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 leading-snug">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3.5 w-3.5 shrink-0"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="break-words">Ensure prasadam delivery</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm text-slate-700">
                                    {formatDateTimeDisplay(registrationTimestamp)}
                                  </span>
                                  {shouldShowUpdatedBadge && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="h-3.5 w-3.5"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      Pooja date updated
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center">
                <div className="bg-gradient-to-br from-green-100 to-emerald-200 h-24 w-24 rounded-full flex items-center justify-center shadow-inner">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-12 w-12 text-green-600"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-semibold text-slate-800 mb-2">No registrations match your filters</p>
                  <p className="max-w-md text-slate-500 mx-auto">
                    {filtersActive
                      ? 'Try adjusting the date or removing filters to see more records.'
                      : 'We surface registrations for the previous day, today, and tomorrow as bookings are created.'}
                  </p>
                </div>
                {filtersActive && (
                  <button
                    onClick={handleClearFilters}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:shadow-lg hover:from-green-700 hover:to-emerald-800 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
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
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoojaDetailsPage;
