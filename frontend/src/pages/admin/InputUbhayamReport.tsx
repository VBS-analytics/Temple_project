import { useEffect, useMemo, useRef, useState } from 'react';
import api, { extractResults } from '../../lib/api';

type MonthTab = {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
};

type InputRowValue = {
  tamilStarIds: string[];
  poojaDayOptionIds: string[];
};

type NakshatraOption = {
  id: number;
  name: string;
  display_order: number;
};

type DayOptionMaster = {
  id: number;
  code: string;
  description: string;
  category: string;
  display_order: number;
};

type DropdownOption = {
  id: string;
  label: string;
};

type InputMonthRowResponse = {
  date: string;
  day_of_month: string;
  tamil_stars: string[];
  pooja_day_option_ids: number[];
};

type InputMonthResponse = {
  month: string;
  rows: InputMonthRowResponse[];
  latest_allocation?: {
    run_number: number;
    status: string;
    row_count: number;
    generated_at: string | null;
  } | null;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const UBHAYAM_INPUT_START_MONTH = '2026-07';

const buildMonthTabs = (options?: { floorMonthKey?: string; startOffset?: number; totalMonths?: number }) => {
  const { floorMonthKey = UBHAYAM_INPUT_START_MONTH, startOffset = -1, totalMonths = 13 } = options ?? {};
  const parsed = /^(\d{4})-(\d{2})$/.exec(floorMonthKey.trim());
  const floorYear = parsed ? Number(parsed[1]) : 2026;
  const floorMonthIndex = parsed ? Math.max(0, Math.min(11, Number(parsed[2]) - 1)) : 6;
  const floorDate = new Date(floorYear, floorMonthIndex, 1);
  const rollingStart = new Date();
  rollingStart.setDate(1);
  rollingStart.setMonth(rollingStart.getMonth() + startOffset);
  const startDate = rollingStart < floorDate ? floorDate : rollingStart;
  return Array.from({ length: totalMonths }, (_, index): MonthTab => {
    const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
    return {
      key: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`,
      label: targetDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      year: targetDate.getFullYear(),
      monthIndex: targetDate.getMonth(),
    };
  });
};

const buildMonthDates = (year: number, monthIndex: number) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(year, monthIndex, index + 1));
};

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeNextUrl = (next: string | null | undefined) => {
  if (!next) {
    return null;
  }
  try {
    if (next.startsWith('http')) {
      const parsed = new URL(next);
      let path = `${parsed.pathname}${parsed.search}`;
      if (path.startsWith('/')) path = path.slice(1);
      if (path.startsWith('api/')) path = path.slice(4);
      return path;
    }
  } catch (error) {
    console.warn('Unable to parse next URL', next, error);
    return null;
  }
  return next.replace(/^\/+/, '').replace(/^api\//, '');
};

const fetchAllPages = async <T,>(initialPath: string): Promise<T[]> => {
  const rows: T[] = [];
  let nextUrl: string | null = initialPath;
  while (nextUrl) {
    const response = await api.get(nextUrl);
    rows.push(...extractResults<T>(response.data));
    nextUrl = normalizeNextUrl(response.data?.next);
  }
  return rows;
};

type MultiSelectDropdownProps = {
  options: DropdownOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
};

const MultiSelectDropdown = ({
  options,
  selectedValues,
  onChange,
  placeholder,
  searchPlaceholder,
}: MultiSelectDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  const selectedCount = selectedValues.length;
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.id))
    .map((option) => option.label);
  const label =
    selectedCount === 0
      ? placeholder
      : selectedLabels.join(', ');

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedSearch))
    : options;

  const handleToggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }
    onChange([...selectedValues, value]);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-orange-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-orange-300"
      >
        <span className="truncate" title={label}>{label}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-orange-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-orange-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-orange-400"
            />
          </div>
          <div className="max-h-44 overflow-auto border-t border-orange-100">
            {filteredOptions.map((option) => {
              const checked = selectedValues.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-orange-50"
                >
                  <span className="truncate pr-2">{option.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleValue(option.id)}
                    className="h-4 w-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                  />
                </label>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-500">No options found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InputUbhayamReport = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMonthSelector, setShowMobileMonthSelector] = useState(false);
  const [rowInputByDate, setRowInputByDate] = useState<Record<string, InputRowValue>>({});
  const [nakshatraOptions, setNakshatraOptions] = useState<NakshatraOption[]>([]);
  const [dayOptions, setDayOptions] = useState<DayOptionMaster[]>([]);
  const [isOptionLoading, setIsOptionLoading] = useState(false);
  const [isMonthDataLoading, setIsMonthDataLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [optionLoadError, setOptionLoadError] = useState('');
  const monthTabs = useMemo(() => buildMonthTabs(), []);
  const tamilStarDropdownOptions = useMemo<DropdownOption[]>(
    () => nakshatraOptions.map((option) => ({ id: String(option.id), label: option.name })),
    [nakshatraOptions],
  );
  const poojaDayDropdownOptions = useMemo<DropdownOption[]>(
    () => dayOptions.map((option) => ({ id: String(option.id), label: option.description })),
    [dayOptions],
  );

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    const today = new Date();
    const currentMonthIndex = monthTabs.findIndex(
      (tab) => tab.year === today.getFullYear() && tab.monthIndex === today.getMonth(),
    );
    return currentMonthIndex >= 0 ? currentMonthIndex : 0;
  });

  const selectedMonth = monthTabs[selectedMonthIndex] ?? monthTabs[0];
  const selectedMonthKey = selectedMonth
    ? `${selectedMonth.year}-${String(selectedMonth.monthIndex + 1).padStart(2, '0')}`
    : '';
  const selectedMonthDates = useMemo(() => {
    if (!selectedMonth) {
      return [];
    }
    return buildMonthDates(selectedMonth.year, selectedMonth.monthIndex);
  }, [selectedMonth]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!selectedMonthKey || nakshatraOptions.length === 0) {
      return;
    }
    let active = true;
    const loadMonthInputData = async () => {
      setIsMonthDataLoading(true);
      setActionMessage(null);
      try {
        const response = await api.get<InputMonthResponse>('pooja/ubhayam-input/', {
          params: { month: selectedMonthKey },
        });
        if (!active) {
          return;
        }
        const payload = response.data;
        const starIdByName = new Map(
          nakshatraOptions.map((option) => [option.name.trim().toLowerCase(), String(option.id)]),
        );
        const nextRows: Record<string, InputRowValue> = {};
        (payload.rows ?? []).forEach((row) => {
          const tamilStarIds = (row.tamil_stars ?? [])
            .map((label) => starIdByName.get((label ?? '').trim().toLowerCase()) ?? null)
            .filter((value): value is string => Boolean(value));
          const poojaDayOptionIds = (row.pooja_day_option_ids ?? [])
            .map((id) => String(id))
            .filter((value) => value.length > 0);
          if (tamilStarIds.length === 0 && poojaDayOptionIds.length === 0) {
            return;
          }
          nextRows[row.date] = {
            tamilStarIds: Array.from(new Set(tamilStarIds)),
            poojaDayOptionIds: Array.from(new Set(poojaDayOptionIds)),
          };
        });
        setRowInputByDate(nextRows);
      } catch (error) {
        if (!active) {
          return;
        }
        console.error('Failed to load Ubhayam input month data', error);
        setRowInputByDate({});
        setActionMessage({ type: 'error', text: 'Unable to load saved month input.' });
      } finally {
        if (active) {
          setIsMonthDataLoading(false);
        }
      }
    };
    loadMonthInputData();
    return () => {
      active = false;
    };
  }, [selectedMonthKey, nakshatraOptions]);

  useEffect(() => {
    let isActive = true;
    const loadMasterOptions = async () => {
      setIsOptionLoading(true);
      setOptionLoadError('');
      try {
        const [nakshatraRows, dayOptionRows] = await Promise.all([
          fetchAllPages<NakshatraOption>('auth/nakshatra-options/?page_size=200&ordering=display_order'),
          fetchAllPages<DayOptionMaster>('pooja/day-options/?page_size=200'),
        ]);
        if (!isActive) {
          return;
        }
        setNakshatraOptions(
          nakshatraRows.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name)),
        );
        setDayOptions(
          dayOptionRows
            .filter((item) => (item.category ?? '').toLowerCase() !== 'tamil_star')
            .slice()
            .sort(
              (a, b) =>
                (a.display_order ?? 0) - (b.display_order ?? 0)
                || a.description.localeCompare(b.description),
            ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }
        console.error('Failed to load master options for Ubhayam Report Input Form', error);
        setOptionLoadError('Unable to load dropdown options from master data.');
      } finally {
        if (isActive) {
          setIsOptionLoading(false);
        }
      }
    };
    loadMasterOptions();
    return () => {
      isActive = false;
    };
  }, []);

  const handleMultiSelectChange = (dateKey: string, field: keyof InputRowValue, values: string[]) => {
    setRowInputByDate((prev) => ({
      ...prev,
      [dateKey]: {
        tamilStarIds: prev[dateKey]?.tamilStarIds ?? [],
        poojaDayOptionIds: prev[dateKey]?.poojaDayOptionIds ?? [],
        [field]: values,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedMonth || !selectedMonthKey) {
      return;
    }
    setIsSaving(true);
    setActionMessage(null);
    try {
      const starNameById = new Map(nakshatraOptions.map((option) => [String(option.id), option.name]));
      const payloadRows = selectedMonthDates.map((date) => {
        const dateKey = formatDateKey(date);
        const rowValue = rowInputByDate[dateKey];
        const tamilStars = (rowValue?.tamilStarIds ?? [])
          .map((id) => starNameById.get(id) ?? '')
          .map((label) => label.trim())
          .filter((label) => label.length > 0);
        const poojaDayOptionIds = (rowValue?.poojaDayOptionIds ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0);
        return {
          date: dateKey,
          tamil_stars: tamilStars,
          pooja_day_option_ids: poojaDayOptionIds,
        };
      });

      const response = await api.post('pooja/ubhayam-input/save/', {
        month: selectedMonthKey,
        rows: payloadRows,
      });
      const savedRows = Number(response.data?.saved_rows ?? 0);
      setActionMessage({
        type: 'success',
        text: `Saved ${savedRows} date row${savedRows === 1 ? '' : 's'} for ${selectedMonthKey}.`,
      });
    } catch (error) {
      console.error('Failed to save Ubhayam month input', error);
      setActionMessage({ type: 'error', text: 'Unable to save input values.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAllocate = async () => {
    if (!selectedMonthKey) {
      return;
    }
    setIsAllocating(true);
    setActionMessage(null);
    try {
      const response = await api.post('pooja/ubhayam-input/allocate/', {
        month: selectedMonthKey,
      });
      const rowCount = Number(response.data?.row_count ?? 0);
      const runNumber = Number(response.data?.run_number ?? 0);
      setActionMessage({
        type: 'success',
        text: `Allocation completed for ${selectedMonthKey} (Run ${runNumber}, ${rowCount} rows).`,
      });
    } catch (error: any) {
      console.error('Failed to allocate Ubhayam report rows', error);
      const detail = error?.response?.data?.detail;
      setActionMessage({
        type: 'error',
        text: typeof detail === 'string' && detail.trim() ? detail : 'Unable to run allocation.',
      });
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-900">Ubhayam Report - Input Form</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isAllocating || isOptionLoading || isMonthDataLoading}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleAllocate}
              disabled={isAllocating || isSaving || isOptionLoading || isMonthDataLoading}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {isAllocating ? 'Allocating...' : 'Donor Allocation for Ubhayam Report'}
            </button>
          </div>
        </div>
      </section>

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

      {isMobile && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMobileMonthSelector(!showMobileMonthSelector)}
            className="flex w-full items-center justify-between rounded-lg border border-orange-200 bg-white px-4 py-3 text-left font-medium text-slate-700"
          >
            <span>{selectedMonth?.label}</span>
            <svg
              className={`h-5 w-5 text-slate-500 transition-transform ${showMobileMonthSelector ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMobileMonthSelector && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-orange-100 bg-white shadow-lg">
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
                    className={`w-full px-4 py-2 text-left text-sm font-medium transition ${
                      isActive
                        ? 'border-l-4 border-orange-600 bg-orange-50 text-orange-600'
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

      {(isOptionLoading || isMonthDataLoading || optionLoadError || actionMessage) && (
        <section className="rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm">
          {isOptionLoading ? (
            <p className="text-slate-600">Loading dropdown values from master data…</p>
          ) : isMonthDataLoading ? (
            <p className="text-slate-600">Loading saved input rows for {selectedMonthKey}…</p>
          ) : actionMessage ? (
            <p className={actionMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'}>
              {actionMessage.text}
            </p>
          ) : (
            <p className="text-red-600">{optionLoadError}</p>
          )}
        </section>
      )}

      <section>
        <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white/70 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-orange-100 text-sm">
              <thead className="bg-orange-50 text-xs uppercase tracking-wide text-orange-600">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Day Of Month</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Tamil Star</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Pooja Day Option</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100 bg-white text-slate-700">
                {selectedMonthDates.map((date) => {
                  const dateKey = formatDateKey(date);
                  const rowValue = rowInputByDate[dateKey];
                  return (
                    <tr key={dateKey}>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatDateLabel(date)}</td>
                      <td className="px-4 py-3">{DAY_NAMES[date.getDay()]}</td>
                      <td className="px-4 py-3">
                        <MultiSelectDropdown
                          options={tamilStarDropdownOptions}
                          selectedValues={rowValue?.tamilStarIds ?? []}
                          onChange={(values) => handleMultiSelectChange(dateKey, 'tamilStarIds', values)}
                          placeholder="Select Tamil star"
                          searchPlaceholder="Search Tamil star"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <MultiSelectDropdown
                          options={poojaDayDropdownOptions}
                          selectedValues={rowValue?.poojaDayOptionIds ?? []}
                          onChange={(values) => handleMultiSelectChange(dateKey, 'poojaDayOptionIds', values)}
                          placeholder="Select pooja day option"
                          searchPlaceholder="Search pooja day option"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InputUbhayamReport;
