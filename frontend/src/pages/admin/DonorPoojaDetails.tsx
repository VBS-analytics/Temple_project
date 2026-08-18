import { useEffect, useMemo, useState } from 'react';

import { FALLBACK_DAILY_HEADERS } from '../../data/dailyHeaderText';
import api, { extractResults } from '../../lib/api';

interface DonorPoojaProfile {
  donor_id?: string | null;
  notes?: string | null;
  tamil_name?: string | null;
  gothra?: string | null;
  rasi?: string | null;
  tamil_star?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

interface DonorPoojaMember {
  id?: number;
  name?: string | null;
  rasi?: string | null;
  tamil_star?: string | null;
  is_active?: boolean;
}

interface DonorPoojaRecord {
  user: {
    id: number;
    name?: string | null;
    phone_number?: string | null;
  };
  profile?: DonorPoojaProfile;
  members?: DonorPoojaMember[];
}

interface DonorPoojaDetailRow {
  id: number;
  donorId: string;
  donorPhoneNumber: string;
  donorName: string;
  donorSarman: string;
  donorHeaderText: string;
  gothram: string;
  rasi: string;
  tamilStar: string;
  familyMembers: string;
  familyMemberDisplay: FamilyMemberDisplay[];
  familyMemberDetails: DonorPoojaMember[];
  address: string;
}

interface FamilyMemberDisplay {
  id?: number;
  name: string;
  details: string;
}

interface DayOptionCalendarEntry {
  id: number;
  code?: string | null;
  description?: string | null;
  display_order?: number;
  category?: string | null;
}

interface DayOptionCalendarResponse {
  dates?: Array<{
    date: string;
    day_options?: DayOptionCalendarEntry[];
  }>;
}

interface DonorCalendarDonor {
  donor_id?: string | null;
  name?: string | null;
  phone_number?: string | null;
  chrt_poojas?: Array<{
    pooja_name?: string | null;
    instructions?: string | null;
  }>;
}

interface DonorCalendarDate {
  date: string;
  donors?: DonorCalendarDonor[];
  day_options?: DayOptionCalendarEntry[];
}

interface DonorCalendarResponse {
  dates?: DonorCalendarDate[];
}

interface DailyMessageEntry {
  label?: string | null;
  header_text?: string | null;
}

interface SpecialAnnouncementEntry {
  label?: string | null;
  description?: string | null;
}

const EMPTY_VALUE = '—';
const ANY_DAY_OPTION_CODES = new Set(['AD', 'ANYDAY']);
const ANY_DAY_OPTION_DESCRIPTIONS = new Set(['any day of month', 'any day of the month']);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const normalizeAnyDayDescription = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isAnyDayOption = (option?: DayOptionCalendarEntry | null) => {
  if (!option) return false;
  const code = option.code?.trim().toUpperCase() ?? '';
  if (ANY_DAY_OPTION_CODES.has(code)) return true;
  const normalizedDescription = normalizeAnyDayDescription(option.description);
  return ANY_DAY_OPTION_DESCRIPTIONS.has(normalizedDescription);
};

const mergeDayOptions = (options: DayOptionCalendarEntry[]) => {
  const seen = new Set<string>();
  const merged: DayOptionCalendarEntry[] = [];
  options.forEach((option) => {
    const key = `${option.id}::${option.code ?? ''}::${option.description ?? ''}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(option);
  });
  return merged;
};

const normalizeDayOptionLabel = (option: DayOptionCalendarEntry) => {
  if (isAnyDayOption(option)) {
    return 'Any Day of Month';
  }
  const description = option.description?.trim();
  return description || 'Any Day of Month';
};

const buildDayOptionText = (options: DayOptionCalendarEntry[]) => {
  if (options.length === 0) {
    return 'Any Day of Month';
  }
  const rawLabels = options.map((option) => normalizeDayOptionLabel(option));
  const hasNonFallback = rawLabels.some((label) => label !== 'Any Day of Month');
  const filteredLabels = hasNonFallback
    ? rawLabels.filter((label) => label !== 'Any Day of Month')
    : rawLabels;
  const labels: string[] = Array.from(new Set(filteredLabels));
  return labels.length > 0 ? labels.join(', ') : 'Any Day of Month';
};

const formatDailyHeaderForCopy = (
  dayName: string,
  dayOptionValue: string,
  dailyMessageHeaders: Record<string, string>,
  specialAnnouncements: Record<string, string>,
) => {
  const baseHeader = dailyMessageHeaders[dayName] ?? FALLBACK_DAILY_HEADERS[dayName] ?? '';
  const specialForSunday = dayName === 'Sunday' ? specialAnnouncements.ADMSG6 : undefined;
  const normalizedDayOptionValue = (dayOptionValue ?? '').toLowerCase();
  const hasPradosham = normalizedDayOptionValue.includes('pradosham (trayodashi)');
  const containsSankatachaturti = normalizedDayOptionValue.includes('on sankatachaturti day of month');
  const containsSecondAshtami = normalizedDayOptionValue.includes('2 ashtami');
  const containsFirstTuesday = normalizedDayOptionValue.includes('1st tuesday');
  const containsLastSaturday = normalizedDayOptionValue.includes('last sat day of month');
  const specialForPradosham = hasPradosham ? specialAnnouncements.ADMSG3 : undefined;
  const specialForSankatachaturti = containsSankatachaturti ? specialAnnouncements.ADMSG1 : undefined;
  const specialForSecondAshtami = containsSecondAshtami ? specialAnnouncements.ADMSG2 : undefined;
  const specialForFirstTuesday = containsFirstTuesday ? specialAnnouncements.ADMSG5 : undefined;
  const specialForLastSaturday = containsLastSaturday ? specialAnnouncements.ADMSG4 : undefined;
  const headerSegments = [
    baseHeader,
    specialForSunday,
    specialForPradosham,
    specialForSankatachaturti,
    specialForSecondAshtami,
    specialForFirstTuesday,
    specialForLastSaturday,
  ].filter(Boolean);
  return headerSegments.length > 0 ? headerSegments.join('\n') : EMPTY_VALUE;
};

const toDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string) => {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const toDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMessageDateLabel = (value: Date) =>
  value.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

const splitAddressForCopy = (address: string) => {
  if (address === EMPTY_VALUE) {
    return [EMPTY_VALUE];
  }
  const parts = address
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (parts.length === 0) {
    return [EMPTY_VALUE];
  }
  return parts.map((part, index) => (index < parts.length - 1 ? `${part},` : part));
};

const normalizeDonorIdLookup = (value?: string | null) => {
  const normalized = normalizeOptionalText(value);
  return normalized.toUpperCase();
};

const normalizePhoneDigits = (value?: string | null) => (value ?? '').replace(/\D/g, '');

const normalizeOptionalText = (value?: string | null) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed.toLowerCase();
  if (
    normalized === 'null' ||
    normalized === 'none' ||
    normalized === 'na' ||
    normalized === 'n/a' ||
    normalized === 'nan' ||
    normalized === '-'
  ) {
    return '';
  }
  return trimmed;
};

const normalizeText = (value?: string | null) => {
  const trimmed = normalizeOptionalText(value);
  return trimmed.length > 0 ? trimmed : EMPTY_VALUE;
};

const normalizeAddress = (profile?: DonorPoojaProfile) => {
  if (!profile) {
    return EMPTY_VALUE;
  }

  const lineParts = [
    normalizeOptionalText(profile.address_line1),
    normalizeOptionalText(profile.address_line2),
    normalizeOptionalText(profile.address_line3),
  ].filter(Boolean);
  const locationParts = [
    normalizeOptionalText(profile.city),
    normalizeOptionalText(profile.state),
  ].filter(Boolean);
  const postalCode = normalizeOptionalText(profile.postal_code);

  // If only postal code is present, treat address as missing/incomplete.
  if (lineParts.length === 0 && locationParts.length === 0) {
    return EMPTY_VALUE;
  }

  const formattedLocation =
    locationParts.length > 0 && postalCode
      ? `${locationParts.join(', ')} - ${postalCode}`
      : locationParts.length > 0
        ? locationParts.join(', ')
        : postalCode;

  const fullAddress = [...lineParts, formattedLocation].filter(Boolean).join(', ');
  return fullAddress || EMPTY_VALUE;
};

const normalizeFamilyMembers = (members?: DonorPoojaMember[]) => {
  if (!Array.isArray(members) || members.length === 0) {
    return EMPTY_VALUE;
  }
  const formattedMembers = members
    .map((member) => {
      const name = normalizeOptionalText(member?.name);
      const rasi = normalizeOptionalText(member?.rasi);
      const tamilStar = normalizeOptionalText(member?.tamil_star);

      const attributes: string[] = [];
      if (rasi) {
        attributes.push(`Rasi: ${rasi}`);
      }
      if (tamilStar) {
        attributes.push(`Star: ${tamilStar}`);
      }

      if (!name && attributes.length === 0) {
        return '';
      }
      if (!name) {
        return attributes.join(', ');
      }
      if (attributes.length === 0) {
        return name;
      }
      return `${name} (${attributes.join(', ')})`;
    })
    .filter((value) => value.length > 0);

  return formattedMembers.length > 0 ? formattedMembers.join('; ') : EMPTY_VALUE;
};

const getActiveMembers = (members?: DonorPoojaMember[]) => {
  if (!Array.isArray(members)) {
    return [];
  }
  return members.filter((member) => member?.is_active !== false);
};

const normalizeFamilyMemberDisplay = (members?: DonorPoojaMember[]): FamilyMemberDisplay[] => {
  if (!Array.isArray(members) || members.length === 0) {
    return [];
  }

  return members
    .map((member) => {
      const name = normalizeText(member?.name);
      const rasi = normalizeText(member?.rasi);
      const tamilStar = normalizeText(member?.tamil_star);

      if (name === EMPTY_VALUE && rasi === EMPTY_VALUE && tamilStar === EMPTY_VALUE) {
        return null;
      }

      const details: string[] = [];
      if (rasi !== EMPTY_VALUE) {
        details.push(`Rasi: ${rasi}`);
      }
      if (tamilStar !== EMPTY_VALUE) {
        details.push(`Star: ${tamilStar}`);
      }

      const formattedMember: FamilyMemberDisplay = {
        name: name === EMPTY_VALUE ? 'Family Member' : name,
        details: details.join(' • '),
      };

      if (typeof member.id === 'number') {
        formattedMember.id = member.id;
      }

      return formattedMember;
    })
    .filter((member): member is FamilyMemberDisplay => member !== null);
};

const compareDonorIdAscending = (left: string, right: string) => {
  const leftMissing = left === EMPTY_VALUE;
  const rightMissing = right === EMPTY_VALUE;
  if (leftMissing && rightMissing) {
    return 0;
  }
  if (leftMissing) {
    return 1;
  }
  if (rightMissing) {
    return -1;
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
};

const formatStarRasiNameLine = (name: string, tamilStar: string, rasi: string) => {
  const cleanName = name !== EMPTY_VALUE ? name : '';
  const cleanStar = tamilStar !== EMPTY_VALUE ? tamilStar : '';
  const cleanRasi = rasi !== EMPTY_VALUE ? `${rasi} ராசி` : '';
  const parts = [cleanStar, cleanRasi, cleanName].filter((part) => part.length > 0);
  return parts.join(' - ');
};

const formatDonorHeadingForMessageCopy = (row: DonorPoojaDetailRow) => {
  const donorId = row.donorId !== EMPTY_VALUE ? row.donorId : '';
  const donorName = row.donorName !== EMPTY_VALUE ? row.donorName : '';

  if (donorId && donorName) {
    return `${donorId}, ${donorName}`;
  }
  if (donorId) {
    return donorId;
  }
  if (donorName) {
    return donorName;
  }
  return EMPTY_VALUE;
};

const formatDonorRowForCopy = (row: DonorPoojaDetailRow) => {
  const lines: string[] = [];

  lines.push(row.donorId);
  lines.push(row.donorHeaderText);
  lines.push(row.gothram !== EMPTY_VALUE ? `${row.gothram} கோத்திரம்` : EMPTY_VALUE);

  const donorLine = formatStarRasiNameLine(row.donorName, row.tamilStar, row.rasi);
  if (donorLine) {
    lines.push(`* ${donorLine}`);
  }

  row.familyMemberDetails.forEach((member) => {
    const memberName = normalizeText(member.name);
    const memberStar = normalizeText(member.tamil_star);
    const memberRasi = normalizeText(member.rasi);
    const memberLine = formatStarRasiNameLine(memberName, memberStar, memberRasi);
    if (memberLine) {
      lines.push(`* ${memberLine}`);
    }
  });

  return lines.join('\n');
};

const formatDonorDetailsForMessageCopy = (row: DonorPoojaDetailRow) => {
  const lines: string[] = [];

  if (row.donorId !== EMPTY_VALUE) {
    lines.push(row.donorId);
  }

  if (row.gothram !== EMPTY_VALUE) {
    lines.push(`${row.gothram} கோத்திரம்`);
  }

  const donorNameWithSarman =
    row.donorName !== EMPTY_VALUE && row.donorSarman !== EMPTY_VALUE
      ? `${row.donorName}(${row.donorSarman})`
      : row.donorName;
  const donorLine = formatStarRasiNameLine(donorNameWithSarman, row.tamilStar, row.rasi);
  if (donorLine) {
    lines.push(`* ${donorLine}`);
  }

  row.familyMemberDetails.forEach((member) => {
    const memberName = normalizeText(member.name);
    const memberStar = normalizeText(member.tamil_star);
    const memberRasi = normalizeText(member.rasi);
    const memberLine = formatStarRasiNameLine(memberName, memberStar, memberRasi);
    if (memberLine) {
      lines.push(`* ${memberLine}`);
    }
  });

  return lines.join('\n');
};

const copyToClipboard = async (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

const DonorPoojaDetails = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<DonorPoojaRecord[]>([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [lastCopiedRowId, setLastCopiedRowId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'records' | 'messageCopy'>('messageCopy');
  const [messageDate, setMessageDate] = useState(() => toDateInputValue(new Date()));
  const [dailyMessageHeaders, setDailyMessageHeaders] = useState<Record<string, string>>({});
  const [specialAnnouncements, setSpecialAnnouncements] = useState<Record<string, string>>({});
  const [calendarDayOptionsByDate, setCalendarDayOptionsByDate] = useState<
    Record<string, DayOptionCalendarEntry[]>
  >({});
  const [donorCalendarByDate, setDonorCalendarByDate] = useState<
    Record<string, { donors: DonorCalendarDonor[]; dayOptions: DayOptionCalendarEntry[] }>
  >({});
  const [messageTemplateLoading, setMessageTemplateLoading] = useState(false);
  const [messageTemplateError, setMessageTemplateError] = useState('');
  const [messageCalendarLoading, setMessageCalendarLoading] = useState(false);
  const [messageCalendarError, setMessageCalendarError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('auth/donors/');
        if (!mounted) {
          return;
        }
        const payload = Array.isArray(response.data) ? response.data : [];
        setRecords(payload as DonorPoojaRecord[]);
      } catch (loadError: any) {
        if (!mounted) {
          return;
        }
        const detail =
          loadError?.response?.data?.detail ??
          loadError?.message ??
          'Unable to load donor family details';
        setError(typeof detail === 'string' ? detail : 'Unable to load donor family details');
        setRecords([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!copyStatus) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCopyStatus(''), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  useEffect(() => {
    let mounted = true;

    const loadMessageTemplates = async () => {
      setMessageTemplateLoading(true);
      setMessageTemplateError('');
      try {
        const [messagesRes, announcementsRes] = await Promise.all([
          api.get<DailyMessageEntry[]>('pooja/daily-messages/'),
          api.get<SpecialAnnouncementEntry[]>('pooja/special-announcements/'),
        ]);
        if (!mounted) {
          return;
        }

        const headersMap: Record<string, string> = {};
        const messagesPayload = extractResults<DailyMessageEntry>(messagesRes.data);
        messagesPayload.forEach((entry) => {
          const label = normalizeOptionalText(entry?.label);
          const headerText = normalizeOptionalText(entry?.header_text);
          if (label && headerText) {
            headersMap[label] = headerText;
          }
        });

        const announcementsMap: Record<string, string> = {};
        const announcementPayload = extractResults<SpecialAnnouncementEntry>(announcementsRes.data);
        announcementPayload.forEach((entry) => {
          const label = normalizeOptionalText(entry?.label);
          const description = normalizeOptionalText(entry?.description);
          if (label && description) {
            announcementsMap[label] = description;
          }
        });

        setDailyMessageHeaders(headersMap);
        setSpecialAnnouncements(announcementsMap);
      } catch (templateError: any) {
        if (!mounted) {
          return;
        }
        const detail =
          templateError?.response?.data?.detail ??
          templateError?.message ??
          'Unable to load daily schedule templates';
        setMessageTemplateError(
          typeof detail === 'string' ? detail : 'Unable to load daily schedule templates',
        );
        setDailyMessageHeaders({});
        setSpecialAnnouncements({});
      } finally {
        if (mounted) {
          setMessageTemplateLoading(false);
        }
      }
    };

    loadMessageTemplates();

    return () => {
      mounted = false;
    };
  }, []);

  const parsedMessageDate = useMemo(
    () => parseDateInputValue(messageDate) ?? new Date(),
    [messageDate],
  );

  const messageYear = parsedMessageDate.getFullYear();
  const messageMonth = parsedMessageDate.getMonth() + 1;
  const messageDateKey = toDateKey(parsedMessageDate);

  useEffect(() => {
    let mounted = true;

    const loadMessageCalendar = async () => {
      setMessageCalendarLoading(true);
      setMessageCalendarError('');
      try {
        const monthKey = `${messageYear}-${String(messageMonth).padStart(2, '0')}`;
        const useAllocationMode = monthKey >= '2026-07';

        if (useAllocationMode) {
          const [allocationRes, detailCalendarRes] = await Promise.all([
            api.get<{ month: string; rows: Array<{
            date: string;
            tamil_star: string;
            pooja_day_option: string;
            donor_id: string;
            donor_name: string;
            donor_mobile_number: string;
            }> }>('pooja/ubhayam-allocation/latest/', { params: { month: monthKey } }),
            api.get<DonorCalendarResponse>('pooja/calendar/donor-registrations/', { params: { year: messageYear, month: messageMonth } }),
          ]);
          if (!mounted) return;

          const dayOptionsMap: Record<string, DayOptionCalendarEntry[]> = {};
          const donorMap: Record<string, { donors: DonorCalendarDonor[]; dayOptions: DayOptionCalendarEntry[] }> = {};
          const detailDates = detailCalendarRes.data?.dates ?? [];
          const detailDonorsByDate = new Map(
            detailDates.map((entry) => [entry.date, entry.donors ?? []]),
          );

          const rows = Array.isArray(allocationRes.data?.rows) ? allocationRes.data.rows : [];
          rows.forEach((entry, _idx) => {
            const dateKey = (entry.date ?? '').trim();
            if (!dateKey) return;

            const optionLabels = (entry.pooja_day_option ?? '')
              .split(',')
              .map((label) => label.trim())
              .filter((label) => label.length > 0);
            const dayOptions: DayOptionCalendarEntry[] = optionLabels.map((label, index) => ({
              id: index + 1,
              code: `alloc-${index + 1}`,
              description: label,
              display_order: index + 1,
              category: 'code',
            }));
            dayOptionsMap[dateKey] = dayOptions;

            const detailDonors = detailDonorsByDate.get(dateKey) ?? [];
            const donors: DonorCalendarDonor[] = (entry.donor_id ?? '')
              .split(',')
              .map((id, i) => {
                const names = (entry.donor_name ?? '').split(',');
                const phones = (entry.donor_mobile_number ?? '').split(',');
                const detail = detailDonors.find((candidate) =>
                  normalizeDonorIdLookup(candidate.donor_id) === normalizeDonorIdLookup(id),
                );
                return {
                  donor_id: id.trim() || null,
                  name: (names[i] ?? '').trim() || null,
                  phone_number: (phones[i] ?? '').trim() || null,
                  chrt_poojas: detail?.chrt_poojas,
                };
              })
              .filter((d) => d.donor_id);
            donorMap[dateKey] = { donors, dayOptions };
          });

          setCalendarDayOptionsByDate(dayOptionsMap);
          setDonorCalendarByDate(donorMap);
        } else {
          const params = { year: messageYear, month: messageMonth };
          const [dayOptionsRes, donorRes] = await Promise.all([
            api.get<DayOptionCalendarResponse>('pooja/calendar/day-options/', { params }),
            api.get<DonorCalendarResponse>('pooja/calendar/donor-registrations/', { params }),
          ]);
          if (!mounted) return;

          const dayOptionsMap: Record<string, DayOptionCalendarEntry[]> = {};
          const dayOptionDates = Array.isArray(dayOptionsRes.data?.dates) ? dayOptionsRes.data.dates : [];
          dayOptionDates.forEach((entry) => {
            if (!entry?.date) return;
            dayOptionsMap[entry.date] = Array.isArray(entry.day_options) ? entry.day_options : [];
          });

          const donorMap: Record<string, { donors: DonorCalendarDonor[]; dayOptions: DayOptionCalendarEntry[] }> = {};
          const donorDates = Array.isArray(donorRes.data?.dates) ? donorRes.data.dates : [];
          donorDates.forEach((entry) => {
            if (!entry?.date) return;
            donorMap[entry.date] = {
              donors: Array.isArray(entry.donors) ? entry.donors : [],
              dayOptions: Array.isArray(entry.day_options) ? entry.day_options : [],
            };
          });

          setCalendarDayOptionsByDate(dayOptionsMap);
          setDonorCalendarByDate(donorMap);
        }
      } catch (calendarError: any) {
        if (!mounted) {
          return;
        }
        const detail =
          calendarError?.response?.data?.detail ??
          calendarError?.message ??
          'Unable to load donor calendar for message copy';
        setMessageCalendarError(
          typeof detail === 'string' ? detail : 'Unable to load donor calendar for message copy',
        );
        setCalendarDayOptionsByDate({});
        setDonorCalendarByDate({});
      } finally {
        if (mounted) {
          setMessageCalendarLoading(false);
        }
      }
    };

    loadMessageCalendar();

    return () => {
      mounted = false;
    };
  }, [messageYear, messageMonth]);

  const rows = useMemo<DonorPoojaDetailRow[]>(() => {
    return records
      .map((record) => {
        const profile = record.profile;
        const donorId = normalizeText(profile?.donor_id);
        const donorPhoneNumber = normalizeText(record.user?.phone_number);
        const donorName = normalizeText(record.user?.name);
        const donorSarman = normalizeText(profile?.tamil_name);
        const donorHeaderText = normalizeText(profile?.notes);
        const gothram = normalizeText(profile?.gothra);
        const rasi = normalizeText(profile?.rasi);
        const tamilStar = normalizeText(profile?.tamil_star);
        const activeMembers = getActiveMembers(record.members);
        const familyMembers = normalizeFamilyMembers(activeMembers);
        const familyMemberDisplay = normalizeFamilyMemberDisplay(activeMembers);
        const address = normalizeAddress(profile);

        return {
          id: record.user.id,
          donorId,
          donorPhoneNumber,
          donorName,
          donorSarman,
          donorHeaderText,
          gothram,
          rasi,
          tamilStar,
          familyMembers,
          familyMemberDisplay,
          familyMemberDetails: activeMembers,
          address,
        };
      })
      .sort((first, second) => {
        const donorIdOrder = compareDonorIdAscending(first.donorId, second.donorId);
        if (donorIdOrder !== 0) {
          return donorIdOrder;
        }
        return first.id - second.id;
      });
  }, [records]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => {
      const searchable = [
        row.donorId,
        row.donorPhoneNumber,
        row.donorName,
        row.donorHeaderText,
        row.gothram,
        row.rasi,
        row.tamilStar,
        row.familyMembers,
        row.address,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [rows, searchQuery]);

  const handleCopyRow = async (row: DonorPoojaDetailRow) => {
    try {
      await copyToClipboard(formatDonorRowForCopy(row));
      setCopyStatus(`Copied record for ${row.donorName}`);
      setLastCopiedRowId(row.id);
      window.setTimeout(() => {
        setLastCopiedRowId((current) => (current === row.id ? null : current));
      }, 1600);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy row');
      setLastCopiedRowId(null);
    }
  };

  const handleCopyAll = async () => {
    try {
      const content = filteredRows.map((row) => formatDonorRowForCopy(row)).join('\n\n');
      await copyToClipboard(content);
      setCopyStatus(`Copied ${filteredRows.length} donor record${filteredRows.length > 1 ? 's' : ''}`);
      setLastCopiedRowId(null);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy donor records');
    }
  };

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRowIds.includes(row.id)),
    [rows, selectedRowIds],
  );

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedRowIds.includes(row.id));

  const toggleRowSelection = (id: number) => {
    setSelectedRowIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedRowIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !filteredRows.some((row) => row.id === id));
      }
      const next = [...current];
      filteredRows.forEach((row) => {
        if (!next.includes(row.id)) {
          next.push(row.id);
        }
      });
      return next;
    });
  };

  const handleCopySelected = async () => {
    try {
      const content = selectedRows.map((row) => formatDonorRowForCopy(row)).join('\n\n');
      await copyToClipboard(content);
      setCopyStatus(`Copied ${selectedRows.length} selected donor record${selectedRows.length > 1 ? 's' : ''}`);
      setLastCopiedRowId(null);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy selected donor records');
    }
  };

  const selectedDayName = DAY_NAMES[parsedMessageDate.getDay()];
  const donorCalendarEntry = donorCalendarByDate[messageDateKey];
  const donorsOnSelectedDate = useMemo(
    () => donorCalendarEntry?.donors ?? [],
    [donorCalendarEntry],
  );
  const mergedDayOptionsForMessage = useMemo(
    () =>
      mergeDayOptions([
        ...(calendarDayOptionsByDate[messageDateKey] ?? []),
        ...(donorCalendarEntry?.dayOptions ?? []),
      ]),
    [calendarDayOptionsByDate, donorCalendarEntry?.dayOptions, messageDateKey],
  );

  const dayOptionValueForMessage = useMemo(
    () => buildDayOptionText(mergedDayOptionsForMessage),
    [mergedDayOptionsForMessage],
  );

  const dailyHeaderForMessage = useMemo(
    () =>
      formatDailyHeaderForCopy(
        selectedDayName,
        dayOptionValueForMessage,
        dailyMessageHeaders,
        specialAnnouncements,
      ),
    [selectedDayName, dayOptionValueForMessage, dailyMessageHeaders, specialAnnouncements],
  );

  const donorRowsForMessageDate = useMemo(() => {
    if (donorsOnSelectedDate.length === 0 || rows.length === 0) {
      return [];
    }

    const rowsByDonorId = new Map<string, DonorPoojaDetailRow>();
    const rowsByPhone = new Map<string, DonorPoojaDetailRow>();
    const rowsByName = new Map<string, DonorPoojaDetailRow>();

    rows.forEach((row) => {
      const donorIdKey = normalizeDonorIdLookup(row.donorId);
      if (donorIdKey && !rowsByDonorId.has(donorIdKey)) {
        rowsByDonorId.set(donorIdKey, row);
      }

      const phoneDigits = normalizePhoneDigits(row.donorPhoneNumber);
      if (phoneDigits && !rowsByPhone.has(phoneDigits)) {
        rowsByPhone.set(phoneDigits, row);
      }

      const nameKey = normalizeOptionalText(row.donorName).toLowerCase();
      if (nameKey && !rowsByName.has(nameKey)) {
        rowsByName.set(nameKey, row);
      }
    });

    const matchedRows: DonorPoojaDetailRow[] = [];
    const seenRowIds = new Set<number>();
    donorsOnSelectedDate.forEach((donor) => {
      let matchedRow: DonorPoojaDetailRow | undefined;

      const donorIdKey = normalizeDonorIdLookup(donor?.donor_id);
      if (donorIdKey) {
        matchedRow = rowsByDonorId.get(donorIdKey);
      }

      if (!matchedRow) {
        const phoneDigits = normalizePhoneDigits(donor?.phone_number);
        if (phoneDigits) {
          matchedRow = rowsByPhone.get(phoneDigits);
        }
      }

      if (!matchedRow) {
        const nameKey = normalizeOptionalText(donor?.name).toLowerCase();
        if (nameKey) {
          matchedRow = rowsByName.get(nameKey);
        }
      }

      if (matchedRow && !seenRowIds.has(matchedRow.id)) {
        seenRowIds.add(matchedRow.id);
        matchedRows.push(matchedRow);
      }
    });

    return matchedRows;
  }, [donorsOnSelectedDate, rows]);

  const messageTargetRows = useMemo(() => {
    if (donorRowsForMessageDate.length > 0) {
      return donorRowsForMessageDate;
    }
    if (selectedRows.length > 0) {
      return selectedRows;
    }
    return [];
  }, [donorRowsForMessageDate, selectedRows]);

  const messageDateLabel = useMemo(() => formatMessageDateLabel(parsedMessageDate), [parsedMessageDate]);
  const messageDateHeadline = messageDateLabel;

  const scheduleCopyPreview = useMemo(() => {
    const scheduleBaseLines = [messageDateHeadline];
    if (dailyHeaderForMessage !== EMPTY_VALUE) {
      scheduleBaseLines.push(dailyHeaderForMessage);
    }

    if (messageTargetRows.length === 0) {
      return scheduleBaseLines.join('\n');
    }

    const donorLines = messageTargetRows
      .map((row) => {
        const lines: string[] = [];
        const donorHeading = formatDonorHeadingForMessageCopy(row);
        lines.push(donorHeading);
        if (row.donorHeaderText !== EMPTY_VALUE) {
          lines.push(row.donorHeaderText);
        }
        const donor = donorsOnSelectedDate.find(
          (entry) => normalizeDonorIdLookup(entry.donor_id) === normalizeDonorIdLookup(row.donorId),
        );
        const chrtInstructions = donor?.chrt_poojas
          ?.map((pooja) => pooja.instructions?.trim())
          .find((instructions): instructions is string => Boolean(instructions));
        if (chrtInstructions) {
          lines.push(chrtInstructions);
        }
        return lines.join('\n');
      })
      .join('\n\n');

    return `${scheduleBaseLines.join('\n')}\n${donorLines}`;
  }, [messageTargetRows, messageDateHeadline, dailyHeaderForMessage, donorsOnSelectedDate]);

  const addressCopyPreview = useMemo(() => {
    if (messageTargetRows.length === 0) {
      return '';
    }

    return messageTargetRows
      .map((row) => {
        const lines: string[] = [];
        if (row.donorId !== EMPTY_VALUE) {
          lines.push(row.donorId);
        }
        if (row.donorName !== EMPTY_VALUE) {
          lines.push(row.donorName);
        }
        if (lines.length === 0) {
          lines.push(EMPTY_VALUE);
        }
        lines.push(...splitAddressForCopy(row.address));
        return lines.join('\n');
      })
      .join('\n\n');
  }, [messageTargetRows]);

  const donorDetailsCopyPreview = useMemo(() => {
    if (messageTargetRows.length === 0) {
      return '';
    }

    return messageTargetRows
      .map((row) => formatDonorDetailsForMessageCopy(row))
      .filter((block) => block.trim().length > 0)
      .join('\n\n');
  }, [messageTargetRows]);

  const handleCopyScheduleMessage = async () => {
    if (!scheduleCopyPreview) {
      return;
    }
    try {
      await copyToClipboard(scheduleCopyPreview);
      setCopyStatus(`Copied schedule message for ${messageTargetRows.length} donor${messageTargetRows.length > 1 ? 's' : ''}`);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy schedule message');
    }
  };

  const handleCopyAddressMessage = async () => {
    if (!addressCopyPreview) {
      return;
    }
    try {
      await copyToClipboard(addressCopyPreview);
      setCopyStatus(`Copied donor name and address for ${messageTargetRows.length} donor${messageTargetRows.length > 1 ? 's' : ''}`);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy donor address block');
    }
  };

  const handleCopyDonorDetailsMessage = async () => {
    if (!donorDetailsCopyPreview) {
      return;
    }
    try {
      await copyToClipboard(donorDetailsCopyPreview);
      setCopyStatus(`Copied donor details for ${messageTargetRows.length} donor${messageTargetRows.length > 1 ? 's' : ''}`);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy donor details');
    }
  };

  const renderFamilyMemberList = (row: DonorPoojaDetailRow, expanded = false) => {
    if (row.familyMemberDisplay.length === 0) {
      return <span className="text-sm text-slate-500">{EMPTY_VALUE}</span>;
    }

    const listClassName = expanded
      ? 'max-h-48 space-y-2 overflow-y-auto pr-1'
      : 'max-h-28 space-y-2 overflow-y-auto pr-1';

    return (
      <ul className={listClassName}>
        {row.familyMemberDisplay.map((member, index) => (
          <li key={member.id ?? `${row.id}-member-${index}`}>
            <p className="text-sm font-medium text-slate-800">{member.name}</p>
            {member.details && <p className="text-xs text-slate-600">{member.details}</p>}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Ubhayam Message Records</h2>
              <p className="mt-1 text-sm text-slate-600">
                Search, select, and copy donor family details in a readable layout.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    activeTab === 'records'
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Donor &amp; Family Records
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('messageCopy')}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    activeTab === 'messageCopy'
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Message Copy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 min-[470px]:grid-cols-3 lg:min-w-[22rem]">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-blue-700">
                  Total Records
                </p>
                <p className="text-base font-semibold text-blue-900">{rows.length}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
                  Visible
                </p>
                <p className="text-base font-semibold text-amber-900">{filteredRows.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700">
                  Selected
                </p>
                <p className="text-base font-semibold text-emerald-900">{selectedRows.length}</p>
              </div>
            </div>
          </div>

          {activeTab === 'records' && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by donor ID, phone, name, gothram, star, family, or address"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 lg:max-w-lg"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    disabled={loading || !!error || filteredRows.length === 0}
                    className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySelected}
                    disabled={loading || !!error || selectedRows.length === 0}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy Selected ({selectedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    disabled={loading || !!error || filteredRows.length === 0}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy All ({filteredRows.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'records' && (
          <>
            {loading && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                Loading donor family details...
              </div>
            )}

            {!loading && error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                {error}
              </div>
            )}

            {!loading && !error && filteredRows.length === 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                No donor records match your search.
              </div>
            )}

            {!loading && !error && filteredRows.length > 0 && (
              <div className="mt-4 space-y-4">
                <div className="hidden overflow-hidden rounded-xl border border-amber-200 lg:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-[82rem] w-full table-fixed divide-y divide-amber-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="w-12 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            <label className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleSelectAllVisible}
                                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-200"
                              />
                            </label>
                          </th>
                          <th className="w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Donor
                          </th>
                          <th className="w-52 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Gothram / Rasi / Star
                          </th>
                          <th className="w-80 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Donor Header Text
                          </th>
                          <th className="w-80 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Family Members
                          </th>
                          <th className="w-72 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Address
                          </th>
                          <th className="w-24 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Copy
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 bg-white">
                        {filteredRows.map((row) => (
                          <tr key={row.id} className="align-top odd:bg-white even:bg-amber-50/20">
                            <td className="px-4 py-3 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedRowIds.includes(row.id)}
                                onChange={() => toggleRowSelection(row.id)}
                                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-200"
                                aria-label={`Select donor row ${row.donorId}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                  {row.donorId}
                                </span>
                                <p className="text-sm font-semibold text-slate-900">{row.donorName}</p>
                                <p className="text-xs text-slate-600">{row.donorPhoneNumber}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1 text-sm text-slate-700">
                                <p>
                                  <span className="font-semibold text-slate-600">Gothram:</span>{' '}
                                  {row.gothram}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-600">Rasi:</span> {row.rasi}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-600">Star:</span> {row.tamilStar}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-relaxed text-slate-700"
                                title={row.donorHeaderText !== EMPTY_VALUE ? row.donorHeaderText : undefined}
                              >
                                {row.donorHeaderText}
                              </div>
                            </td>
                            <td className="px-4 py-3">{renderFamilyMemberList(row)}</td>
                            <td className="px-4 py-3">
                              <div
                                className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-relaxed text-slate-700"
                                title={row.address !== EMPTY_VALUE ? row.address : undefined}
                              >
                                {row.address}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              <button
                                type="button"
                                onClick={() => handleCopyRow(row)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                              >
                                {lastCopiedRowId === row.id ? 'Copied' : 'Copy'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3 lg:hidden">
                  {filteredRows.map((row) => (
                    <article
                      key={row.id}
                      className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(row.id)}
                            onChange={() => toggleRowSelection(row.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-200"
                            aria-label={`Select donor row ${row.donorId}`}
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                {row.donorId}
                              </span>
                              <h3 className="text-sm font-semibold text-slate-900">{row.donorName}</h3>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">{row.donorPhoneNumber}</p>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleCopyRow(row)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          {lastCopiedRowId === row.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Gothram / Rasi / Star
                          </p>
                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <p>
                              <span className="font-semibold text-slate-600">Gothram:</span> {row.gothram}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-600">Rasi:</span> {row.rasi}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-600">Star:</span> {row.tamilStar}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Donor Header Text
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                            {row.donorHeaderText}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Family Members
                          </p>
                          <div className="mt-2">{renderFamilyMemberList(row, true)}</div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Address
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                            {row.address}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'messageCopy' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Select Date
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={messageDate}
                      onChange={(event) => setMessageDate(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyScheduleMessage}
                    disabled={!scheduleCopyPreview}
                    className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy Group Msg
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAddressMessage}
                    disabled={!addressCopyPreview}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy Co-ordinator Msg
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyDonorDetailsMessage}
                    disabled={!donorDetailsCopyPreview}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy Donor Details
                  </button>
                </div>
              </div>
            </div>

            {(messageTemplateLoading || messageCalendarLoading) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading message copy data...
              </div>
            )}

            {(messageTemplateError || messageCalendarError) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {[messageTemplateError, messageCalendarError].filter(Boolean).join(' • ')}
              </div>
            )}

            {!messageTemplateLoading && !messageCalendarLoading && !messageTemplateError && !messageCalendarError && (
              <>
                <div className="grid gap-4 xl:grid-cols-3">
                  <article className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                    <h3 className="text-sm font-semibold text-blue-900">Group Message</h3>
                    <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-blue-100 bg-white p-3 text-sm leading-relaxed text-slate-800">
                      {scheduleCopyPreview || 'No message preview available for selected date and donor.'}
                    </pre>
                  </article>

                  <article className="rounded-xl border border-amber-100 bg-amber-50/30 p-4">
                    <h3 className="text-sm font-semibold text-amber-900">Co-ordinator Message</h3>
                    <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-amber-100 bg-white p-3 text-sm leading-relaxed text-slate-800">
                      {addressCopyPreview || 'No donor address preview available.'}
                    </pre>
                  </article>

                  <article className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                    <h3 className="text-sm font-semibold text-emerald-900">Donor Details</h3>
                    <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-emerald-100 bg-white p-3 text-sm leading-relaxed text-slate-800">
                      {donorDetailsCopyPreview || 'No donor details preview available.'}
                    </pre>
                  </article>
                </div>
              </>
            )}
          </div>
        )}
      </section>
      {copyStatus && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 shadow-md">
          {copyStatus}
        </div>
      )}
    </div>
  );
};

export default DonorPoojaDetails;
