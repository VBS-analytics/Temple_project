import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import * as XLSX from 'xlsx';
import { loadPdfMake, PDF_TAMIL_FONT_NAME, verifyTamilFont } from '../../lib/pdfMakeLoader';
import api, { extractResults } from '../../lib/api';
import { FALLBACK_DAILY_HEADERS } from '../../data/dailyHeaderText';
import { POOJA_DATA_UPDATED_EVENT } from '../../constants/events';
import { isAdmin, useAuthStore } from '../../store/auth';

const TABLE_COLUMNS = [
  'Date',
  'Day of Month',
  'Tamil Star',
  'Pooja Day Option',
  'Daily Message Header',
  'Donor ID',
  'Donor Name',
  'Donor Mobile Number',
] as const;

type ReportRow = Record<(typeof TABLE_COLUMNS)[number], string>;

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const SATURDAY_NAVAGRAHA_LABEL = 'Saturday Navagraha Pooja';
const DAY_OPTION_FALLBACK_LABEL = 'Any Day of Month';
const ANY_DAY_OPTION_CODES = new Set(['AD', 'ANYDAY']);
const ANY_DAY_OPTION_DESCRIPTIONS = new Set(['any day of month', 'any day of the month']);
const DAY_OPTION_BADGE_CLASS =
  'rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-orange-600';

const normalizeAnyDayDescription = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isAnyDayOption = (option?: { code?: string | null; description?: string | null } | null) => {
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
    const key = `${option.code ?? ''}::${option.description ?? ''}`;
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
    return DAY_OPTION_FALLBACK_LABEL;
  }
  const description = option.description?.trim();
  return description || DAY_OPTION_FALLBACK_LABEL;
};

const buildMonthTabs = (options?: { startOffset?: number; totalMonths?: number }) => {
  const { startOffset = -1, totalMonths = 13 } = options ?? {};
  const reference = new Date();
  const tabs = Array.from({ length: totalMonths }, (_, index) => {
    const targetDate = new Date(reference.getFullYear(), reference.getMonth() + startOffset + index, 1);
    return {
      key: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`,
      label: targetDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      shortLabel: targetDate.toLocaleDateString('en-GB', { month: 'short' }),
      year: targetDate.getFullYear(),
      monthIndex: targetDate.getMonth(),
    };
  });
  return tabs;
};

const buildMonthDates = (year: number, monthIndex: number) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(year, monthIndex, index + 1));
};

const formatFilenameDate = (value: Date) =>
  value.toISOString().replace(/[:.]/g, '').replace(/-/g, '').slice(0, 15);

type TamilNakshatraDay = {
  date: string;
  tamil_star: string;
  tamil_star_native?: string;
  index: number;
};

type DayOptionCalendarEntry = {
  id: number;
  code: string;
  description: string;
  display_order: number;
  category: string;
};

type DayOptionCalendarResponse = {
  year: number;
  month: number;
  dates: {
    date: string;
    day_options: DayOptionCalendarEntry[];
  }[];
};

type DonorCalendarDonor = {
  donor_id: string | null;
  name: string | null;
  phone_number: string | null;
};

type DonorCalendarDate = {
  date: string;
  donors: DonorCalendarDonor[];
  donor_ids?: string | null;
  donor_names?: string | null;
  donor_phones?: string | null;
  day_options?: DayOptionCalendarEntry[];
};

type DonorCalendarResponse = {
  year: number;
  month: number;
  dates: DonorCalendarDate[];
};

type DonorCalendarSummary = {
  ids: string | null;
  names: string | null;
  phones: string | null;
  dayOptions: DayOptionCalendarEntry[];
};

const hasAssignedDonorSummary = (summary?: DonorCalendarSummary) => {
  if (!summary) return false;
  return Boolean(
    summary.ids?.trim()
      || summary.names?.trim()
      || summary.phones?.trim(),
  );
};

type DailyMessageEntry = {
  id: number;
  label: string;
  header_text: string;
  footer_text: string;
};

type SpecialAnnouncementEntry = {
  id: number;
  label: string;
  description: string;
};

// Per-date computed data shared between report rows and table render.
type PerDateData = {
  date: Date;
  dateKey: string;
  tamilStar: string;
  donorInfo: DonorCalendarSummary | undefined;
  dayOptionInfo: { combined: DayOptionCalendarEntry[]; showSaturdayLabel: boolean };
  dayOptionValue: string;
  dayName: (typeof DAY_NAMES)[number];
  dailyHeader: string;
};

// Defined outside the component so it is never recreated on each render.
type MobileDayCardProps = {
  data: PerDateData;
};

const MobileDayCard = ({ data }: MobileDayCardProps) => {
  const { date, tamilStar, donorInfo, dayOptionInfo, dailyHeader } = data;
  const { combined: combinedDayOptions, showSaturdayLabel } = dayOptionInfo;
  const shouldRenderDayOptions = combinedDayOptions.length > 0 || showSaturdayLabel;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-slate-900">{formatDateLabel(date)}</h3>
        <span className="text-sm text-slate-600">{DAY_NAMES[date.getDay()]}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm font-medium text-slate-500">Tamil Star:</span>
          <span className="text-sm text-slate-700">{tamilStar}</span>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-500">Pooja Day Option:</span>
          <div className="mt-1">
            {shouldRenderDayOptions ? (
              <div className="flex flex-wrap gap-1">
                {combinedDayOptions.map((option) => (
                  <span key={`${option.id}-${option.code}`} className={DAY_OPTION_BADGE_CLASS}>
                    {normalizeDayOptionLabel(option)}
                  </span>
                ))}
                {showSaturdayLabel && (
                  <span className={DAY_OPTION_BADGE_CLASS}>{SATURDAY_NAVAGRAHA_LABEL}</span>
                )}
              </div>
            ) : (
              <span className={DAY_OPTION_BADGE_CLASS}>{DAY_OPTION_FALLBACK_LABEL}</span>
            )}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-500">Daily Message Header:</span>
          <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{dailyHeader}</p>
        </div>

        <div className="flex justify-between">
          <span className="text-sm font-medium text-slate-500">Donor ID:</span>
          <span className="text-sm text-slate-700">{donorInfo?.ids ?? '—'}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-sm font-medium text-slate-500">Donor Name:</span>
          <span className="text-sm text-slate-700">{donorInfo?.names ?? '—'}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-sm font-medium text-slate-500">Donor Mobile:</span>
          <span className="text-sm text-slate-700">{donorInfo?.phones ?? '—'}</span>
        </div>
      </div>
    </div>
  );
};

const PoojaDetailsPage = () => {
  const user = useAuthStore((state) => state.user);
  const isAdminUser = Boolean(user && isAdmin(user.role));
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMonthSelector, setShowMobileMonthSelector] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const monthTabs = useMemo(() => {
    const tabs = buildMonthTabs();
    if (isAdminUser) {
      return tabs;
    }
    const today = new Date();
    return tabs.filter(
      (tab) =>
        tab.year < today.getFullYear()
        || (tab.year === today.getFullYear() && tab.monthIndex <= today.getMonth()),
    );
  }, [isAdminUser]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    const today = new Date();
    const currentMonthIndex = monthTabs.findIndex(
      (tab) => tab.year === today.getFullYear() && tab.monthIndex === today.getMonth(),
    );
    return currentMonthIndex >= 0 ? currentMonthIndex : 0;
  });
  const selectedMonth = monthTabs[selectedMonthIndex] ?? monthTabs[0];
  const selectedMonthDates = useMemo(() => {
    if (!selectedMonth) return [];
    return buildMonthDates(selectedMonth.year, selectedMonth.monthIndex);
  }, [selectedMonth]);

  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  const [tamilStars, setTamilStars] = useState<Record<string, string>>({});
  const [dayOptionsByDate, setDayOptionsByDate] = useState<Record<string, DayOptionCalendarEntry[]>>({});
  const [donorCalendarByDate, setDonorCalendarByDate] = useState<Record<string, DonorCalendarSummary>>({});
  const [dailyMessageHeaders, setDailyMessageHeaders] = useState<Record<string, string>>({});
  const [specialAnnouncements, setSpecialAnnouncements] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleEvent = () => setCalendarRefreshToken((prev) => prev + 1);
    window.addEventListener(POOJA_DATA_UPDATED_EVENT, handleEvent);
    return () => window.removeEventListener(POOJA_DATA_UPDATED_EVENT, handleEvent);
  }, []);

  // Merge the 3 calendar API calls into one parallel fetch → single state update → one re-render.
  useEffect(() => {
    if (!selectedMonth) return;
    let active = true;
    const params = {
      year: selectedMonth.year,
      month: selectedMonth.monthIndex + 1,
      refresh: calendarRefreshToken,
    };

    Promise.all([
      api.get<TamilNakshatraDay[]>('pooja/calendar/tamil-nakshatras/', { params }),
      api.get<DayOptionCalendarResponse>('pooja/calendar/day-options/', { params }),
      api.get<DonorCalendarResponse>('pooja/calendar/donor-registrations/', { params }),
    ])
      .then(([nakshatraRes, dayOptionRes, donorRes]) => {
        if (!active) return;

        const starsMap: Record<string, string> = {};
        nakshatraRes.data.forEach((entry) => {
          starsMap[entry.date] = entry.tamil_star_native ?? entry.tamil_star;
        });

        const optionsMap: Record<string, DayOptionCalendarEntry[]> = {};
        dayOptionRes.data.dates.forEach((entry) => {
          optionsMap[entry.date] = entry.day_options ?? [];
        });

        const donorMap: Record<string, DonorCalendarSummary> = {};
        donorRes.data.dates.forEach((entry) => {
          const ids = entry.donors
            .map((d) => d.donor_id?.trim() ?? '')
            .filter((v) => v.length > 0);
          const names = entry.donors
            .map((d) => d.name?.trim() ?? '')
            .filter((v) => v.length > 0);
          const phones = entry.donors
            .map((d) => d.phone_number?.trim() ?? '')
            .filter((v) => v.length > 0);
          const donorIdsLabel =
            entry.donor_ids?.trim() || (ids.length > 0 ? ids.join(', ') : '');
          const donorNamesLabel =
            entry.donor_names?.trim() || (names.length > 0 ? names.join(', ') : '');
          const donorPhonesLabel =
            entry.donor_phones?.trim() || (phones.length > 0 ? phones.join(', ') : '');
          donorMap[entry.date] = {
            ids: donorIdsLabel || null,
            names: donorNamesLabel || null,
            phones: donorPhonesLabel || null,
            dayOptions: entry.day_options ?? [],
          };
        });

        // Batch all three updates so React triggers only one re-render.
        setTamilStars(starsMap);
        setDayOptionsByDate(optionsMap);
        setDonorCalendarByDate(donorMap);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to load calendar data for Ubhayam report', error);
        setTamilStars({});
        setDayOptionsByDate({});
        setDonorCalendarByDate({});
      });

    return () => {
      active = false;
    };
  }, [selectedMonth, calendarRefreshToken]);

  // Daily messages and special announcements are month-independent — fetch once on mount.
  useEffect(() => {
    let active = true;

    Promise.all([
      api.get<DailyMessageEntry[]>('pooja/daily-messages/', {
        params: { page_size: 200, ordering: 'label' },
      }),
      api.get<SpecialAnnouncementEntry[]>('pooja/special-announcements/', {
        params: { page_size: 200, ordering: 'label' },
      }),
    ])
      .then(([messagesRes, announcementsRes]) => {
        if (!active) return;

        const headersMap: Record<string, string> = {};
        extractResults<DailyMessageEntry>(messagesRes.data).forEach((entry) => {
          if (entry.label) headersMap[entry.label] = entry.header_text;
        });

        const announcementsMap: Record<string, string> = {};
        extractResults<SpecialAnnouncementEntry>(announcementsRes.data).forEach((entry) => {
          if (entry.label) announcementsMap[entry.label] = entry.description;
        });

        setDailyMessageHeaders(headersMap);
        setSpecialAnnouncements(announcementsMap);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to load daily messages / special announcements', error);
        setDailyMessageHeaders({});
        setSpecialAnnouncements({});
      });

    return () => {
      active = false;
    };
  }, []);

  const resolveDayOptionInfo = useCallback(
    (date: Date, dateKey: string) => {
      const calendarOptions = (dayOptionsByDate[dateKey] ?? []).filter(
        (option) => option.category !== 'tamil_star',
      );
      // Also filter out tamil_star category from donor options so Tamil-star registrations
      // don't pollute the "Pooja Day Option" column.
      const donorOptions = (donorCalendarByDate[dateKey]?.dayOptions ?? []).filter(
        (option) => option.category !== 'tamil_star',
      );
      const merged = mergeDayOptions([...calendarOptions, ...donorOptions]);
      const normalizedEntries = merged.map((option) => ({
        option,
        label: normalizeDayOptionLabel(option),
      }));
      const hasActualOption = normalizedEntries.some(
        (entry) => entry.label !== DAY_OPTION_FALLBACK_LABEL,
      );
      const filteredEntries = hasActualOption
        ? normalizedEntries.filter((entry) => entry.label !== DAY_OPTION_FALLBACK_LABEL)
        : normalizedEntries;
      const seenLabels = new Set<string>();
      const dedupedOptions: DayOptionCalendarEntry[] = [];
      filteredEntries.forEach((entry) => {
        if (seenLabels.has(entry.label)) return;
        seenLabels.add(entry.label);
        dedupedOptions.push(entry.option);
      });
      return {
        combined: dedupedOptions,
        showSaturdayLabel: date.getDay() === 6,
      };
    },
    [dayOptionsByDate, donorCalendarByDate],
  );

  const buildDayOptionText = useCallback(
    (info: { combined: DayOptionCalendarEntry[]; showSaturdayLabel: boolean }) => {
      if (info.combined.length === 0 && !info.showSaturdayLabel) {
        return DAY_OPTION_FALLBACK_LABEL;
      }
      const rawLabels = info.combined.map((option) => normalizeDayOptionLabel(option));
      const hasNonFallback = rawLabels.some((label) => label !== DAY_OPTION_FALLBACK_LABEL);
      const filteredLabels = hasNonFallback
        ? rawLabels.filter((label) => label !== DAY_OPTION_FALLBACK_LABEL)
        : rawLabels;
      // Use Set for O(n) deduplication instead of indexOf (O(n²)).
      const labels: string[] = Array.from(new Set(filteredLabels));
      if (info.showSaturdayLabel) {
        labels.push(SATURDAY_NAVAGRAHA_LABEL);
      }
      if (labels.length === 0) {
        return DAY_OPTION_FALLBACK_LABEL;
      }
      return labels.join(', ');
    },
    [],
  );

  const formatDailyHeader = useCallback(
    (dayName: string, dayOptionValue: string) => {
      const baseHeader = dailyMessageHeaders[dayName] ?? FALLBACK_DAILY_HEADERS[dayName];
      const specialForSunday = dayName === 'Sunday' ? specialAnnouncements['ADMSG6'] : undefined;
      const normalizedDayOptionValue = (dayOptionValue ?? '').toLowerCase();
      const hasPradosham = normalizedDayOptionValue.includes('pradosham (trayodashi)');
      const containsSankatachaturti = normalizedDayOptionValue.includes('on sankatachaturti day of month');
      const containsSecondAshtami = normalizedDayOptionValue.includes('2 ashtami');
      const containsFirstTuesday = normalizedDayOptionValue.includes('1st tuesday');
      const containsLastSaturday = normalizedDayOptionValue.includes('last sat day of month');
      const specialForPradosham = hasPradosham ? specialAnnouncements['ADMSG3'] : undefined;
      const specialForSankatachaturti = containsSankatachaturti ? specialAnnouncements['ADMSG1'] : undefined;
      const specialForSecondAshtami = containsSecondAshtami ? specialAnnouncements['ADMSG2'] : undefined;
      const specialForFirstTuesday = containsFirstTuesday ? specialAnnouncements['ADMSG5'] : undefined;
      const specialForLastSaturday = containsLastSaturday ? specialAnnouncements['ADMSG4'] : undefined;
      const headerSegments = [
        baseHeader,
        specialForSunday,
        specialForPradosham,
        specialForSankatachaturti,
        specialForSecondAshtami,
        specialForFirstTuesday,
        specialForLastSaturday,
      ].filter(Boolean);
      return headerSegments.length > 0 ? headerSegments.join('\n') : undefined;
    },
    [dailyMessageHeaders, specialAnnouncements],
  );

  // Compute all per-date values ONCE. Both the report rows and the table render consume
  // this memo — eliminating the previous double-computation of resolveDayOptionInfo etc.
  const perDateData = useMemo<PerDateData[]>(() => {
    const allRows = selectedMonthDates.map((date) => {
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`;
      const tamilStar = tamilStars[dateKey] ?? '—';
      const donorInfo = donorCalendarByDate[dateKey];
      const dayOptionInfo = resolveDayOptionInfo(date, dateKey);
      const dayOptionValue = buildDayOptionText(dayOptionInfo);
      const dayName = DAY_NAMES[date.getDay()];
      const dailyHeader = formatDailyHeader(dayName, dayOptionValue) ?? '—';
      return { date, dateKey, tamilStar, donorInfo, dayOptionInfo, dayOptionValue, dayName, dailyHeader };
    });

    if (isAdminUser) {
      return allRows;
    }

    return allRows.filter((row) => hasAssignedDonorSummary(row.donorInfo));
  }, [
    selectedMonthDates,
    tamilStars,
    donorCalendarByDate,
    resolveDayOptionInfo,
    buildDayOptionText,
    formatDailyHeader,
    isAdminUser,
  ]);

  const reportRows = useMemo<ReportRow[]>(() => {
    return perDateData.map(({ date, tamilStar, donorInfo, dayOptionValue, dailyHeader }) => ({
      Date: formatDateLabel(date),
      'Day of Month': DAY_NAMES[date.getDay()],
      'Tamil Star': tamilStar,
      'Pooja Day Option': dayOptionValue,
      'Daily Message Header': dailyHeader,
      'Donor ID': donorInfo?.ids ?? '—',
      'Donor Name': donorInfo?.names ?? '—',
      'Donor Mobile Number': donorInfo?.phones ?? '—',
    }));
  }, [perDateData]);

  const downloadFilenameBase = useMemo(() => {
    const label =
      selectedMonth?.label?.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() ??
      'ubhayam-report';
    return `ubhayam-report-${label}-${formatFilenameDate(new Date())}`;
  }, [selectedMonth]);

  const triggerBlobDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (reportRows.length === 0) return;
    try {
      const pdfMakeInstance = await loadPdfMake();
      const ok = verifyTamilFont();
      if (!ok) {
        console.error('Tamil font registration failed for Ubhayam report PDF');
        return;
      }
      const headerRow: TableCell[] = TABLE_COLUMNS.map((column) => ({
        text: column,
        style: 'tableHeader',
        font: PDF_TAMIL_FONT_NAME,
      }));
      const tableBodyRows: TableCell[][] = reportRows.map((row) =>
        TABLE_COLUMNS.map((column) => ({
          text: row[column] ?? '—',
          fillColor: '#fff',
          font: PDF_TAMIL_FONT_NAME,
        })),
      );
      const tableBody: TableCell[][] = [headerRow, ...tableBodyRows];
      const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageOrientation: 'landscape' as const,
        pageMargins: [24, 24, 24, 24],
        defaultStyle: { font: PDF_TAMIL_FONT_NAME, fontSize: 10 },
        content: [
          { text: 'Ubhayam Report', style: 'header' },
          {
            text: `${selectedMonth?.label ?? ''} • ${reportRows.length} row${reportRows.length === 1 ? '' : 's'}`,
            style: 'subheader',
          },
          {
            table: {
              headerRows: 1,
              widths: ['11%', '10%', '10%', '19%', '22%', '8%', '10%', '10%'],
              body: tableBody,
            },
            layout: {
              fillColor: (_rowIndex: number) => (_rowIndex === 0 ? '#fff7ef' : '#ffffff'),
            },
          },
        ],
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 6] },
          subheader: { fontSize: 12, margin: [0, 0, 0, 8], color: '#475467' },
          tableHeader: { bold: true, fontSize: 10, color: '#1f2937' },
        },
      };
      const pdfDoc: any = pdfMakeInstance.createPdf(docDefinition);
      if (typeof pdfDoc.download === 'function') {
        pdfDoc.download(`${downloadFilenameBase}.pdf`);
        return;
      }
      if (typeof pdfDoc.getBlob === 'function') {
        pdfDoc.getBlob((blob: Blob) => triggerBlobDownload(blob, `${downloadFilenameBase}.pdf`));
        return;
      }
      if (typeof pdfDoc.getBuffer === 'function') {
        if (typeof globalThis === 'undefined' || typeof (globalThis as any).Blob === 'undefined') {
          console.error('Browser Blob API unavailable for PDF download');
          return;
        }
        pdfDoc.getBuffer((buffer: Uint8Array | ArrayBuffer) => {
          const array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
          const blob = new (globalThis as any).Blob([array], { type: 'application/pdf' });
          triggerBlobDownload(blob, `${downloadFilenameBase}.pdf`);
        });
        return;
      }
      console.error('PDF download method unavailable');
    } catch (error) {
      console.error('Failed to generate Ubhayam report PDF', error);
    }
  }, [reportRows, downloadFilenameBase, selectedMonth, triggerBlobDownload]);

  const handleDownloadExcel = useCallback(() => {
    if (reportRows.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(reportRows, {
      header: TABLE_COLUMNS.map((column) => column),
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ubhayam Report');
    XLSX.writeFile(workbook, `${downloadFilenameBase}.xlsx`);
  }, [reportRows, downloadFilenameBase]);

  return (
    <div className="space-y-6">
      <header>
        <div className="rounded-2xl border border-orange-200 bg-white/80 p-4 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-medium uppercase tracking-wide text-orange-600">
                Ubhayam Report
              </div>
              <p className="mt-1 text-base font-semibold text-slate-700">
                View the template columns for the Ubhayam report.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-slate-600">
                {selectedMonth?.label ?? ''} • {reportRows.length} row{reportRows.length === 1 ? '' : 's'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={reportRows.length === 0}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    reportRows.length === 0
                      ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-300'
                      : 'border border-slate-900 bg-slate-900 text-white'
                  }`}
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={reportRows.length === 0}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    reportRows.length === 0
                      ? 'cursor-not-allowed border-slate-200 text-slate-300'
                      : 'border-slate-200 text-slate-600 hover:border-orange-200 hover:text-orange-600'
                  }`}
                >
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Month Navigation - Desktop View */}
      {!isMobile && (
        <div className="flex flex-wrap gap-2">
          {monthTabs.map((tab, index) => {
            const isActive = index === selectedMonthIndex;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedMonthIndex(index)}
                className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${
                  isActive
                    ? 'border-orange-600 bg-orange-600 text-white'
                    : 'border-orange-100 bg-white text-slate-600 hover:border-orange-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Month Navigation - Mobile View */}
      {isMobile && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMobileMonthSelector(!showMobileMonthSelector)}
            className="w-full rounded-lg border border-orange-200 bg-white px-4 py-3 text-left font-medium text-slate-700 flex justify-between items-center"
          >
            <span>{selectedMonth?.label}</span>
            <svg
              className={`w-5 h-5 text-slate-500 transition-transform ${showMobileMonthSelector ? 'transform rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMobileMonthSelector && (
            <div className="absolute z-10 mt-1 w-full rounded-lg bg-white shadow-lg border border-orange-100 max-h-60 overflow-y-auto">
              {monthTabs.map((tab, index) => {
                const isActive = index === selectedMonthIndex;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSelectedMonthIndex(index);
                      setShowMobileMonthSelector(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-600'
                        : 'text-slate-700 hover:bg-orange-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Desktop Table View */}
      {!isMobile && (
        <section>
          <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-orange-100 text-sm">
                <thead className="bg-orange-50 text-xs uppercase tracking-wide text-orange-600">
                  <tr>
                    {TABLE_COLUMNS.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="px-4 py-3 text-left font-semibold leading-5"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100 bg-white text-slate-700">
                  {perDateData.map((row) => {
                    const { combined: combinedDayOptions, showSaturdayLabel } = row.dayOptionInfo;
                    const shouldRenderDayOptions = combinedDayOptions.length > 0 || showSaturdayLabel;
                    return (
                      <tr key={row.dateKey}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {formatDateLabel(row.date)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.dayName}</td>
                        <td className="px-4 py-3 text-slate-700">{row.tamilStar}</td>
                        <td className="px-4 py-3">
                          {shouldRenderDayOptions ? (
                            <div className="flex flex-wrap gap-1">
                              {combinedDayOptions.map((option) => (
                                <span
                                  key={`${option.id}-${option.code}`}
                                  className={DAY_OPTION_BADGE_CLASS}
                                >
                                  {normalizeDayOptionLabel(option)}
                                </span>
                              ))}
                              {showSaturdayLabel && (
                                <span className={DAY_OPTION_BADGE_CLASS}>
                                  {SATURDAY_NAVAGRAHA_LABEL}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={DAY_OPTION_BADGE_CLASS}>{DAY_OPTION_FALLBACK_LABEL}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-pre-line">
                          {row.dailyHeader}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.donorInfo?.ids ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{row.donorInfo?.names ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{row.donorInfo?.phones ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Mobile Card View */}
      {isMobile && (
        <section className="px-1">
          {perDateData.map((row) => (
            <MobileDayCard key={row.dateKey} data={row} />
          ))}
        </section>
      )}
    </div>
  );
};

export default PoojaDetailsPage;
