import clsx from 'clsx';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { extractResults } from '../lib/api';
import { CartItem, createCartItem, useCartStore } from '../store/cart';
import { useAuthStore } from '../store/auth';
import { usePaymentStore } from '../store/payments';
import { RecurrenceSelection, RecurrenceFrequency } from '../types/recurrence';
import { useNavigate } from 'react-router-dom';

/* -------------------------------------------------------------------------- */
/*                               Reusable Select                              */
/* -------------------------------------------------------------------------- */

type SSOption = { value: string; label: string };

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  disabled = false,
}: {
  options: SSOption[];
  value: string; // '' or a valid value
  onChange: (next: string) => void; // pass '' to clear
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  // Keep input text in sync with external value
  useEffect(() => {
    setQuery(selected?.label ?? '');
  }, [selected?.label]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveIndex(-1);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const commit = (opt?: SSOption) => {
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  // Adjust dropdown position if it goes off-screen
  useEffect(() => {
    if (!open || !dropdownRef.current || !containerRef.current) return;
    
    const dropdown = dropdownRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    
    // Check if dropdown goes off the right side of the screen
    if (dropdownRect.right > window.innerWidth) {
      dropdown.style.left = 'auto';
      dropdown.style.right = '0';
      dropdown.style.width = `${Math.min(400, window.innerWidth - containerRect.left)}px`;
    }
    
    // Check if dropdown goes off the left side of the screen
    if (dropdownRect.left < 0) {
      dropdown.style.left = '0';
      dropdown.style.right = 'auto';
      dropdown.style.width = `${Math.min(400, containerRect.right)}px`;
    }
  }, [open, filtered]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onMouseDown={(event) => {
            if (disabled) return;
            if (open && query === (selected?.label ?? '')) {
              event.preventDefault();
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (!open) {
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (nextTarget && containerRef.current?.contains(nextTarget as Node)) {
              return;
            }
            setActiveIndex(-1);
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
              setOpen(true);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const target = filtered[activeIndex] ?? filtered[0];
              commit(target);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-sm transition-all"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
        />
        {value && (
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors flex-shrink-0"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
            onMouseDown={(event) => event.preventDefault()}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 text-xs transition-colors flex-shrink-0"
          onClick={() => setOpen((o) => !o)}
          onMouseDown={(event) => event.preventDefault()}
          aria-label="Toggle options"
        >
          ▾
        </button>
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-w-md max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          role="listbox"
          onMouseLeave={() => setActiveIndex(-1)}
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
          {filtered.map((opt, idx) => {
            const active = idx === activeIndex;
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                  active ? 'bg-orange-50' : ''
                } ${isSelected ? 'font-medium text-orange-900' : 'text-gray-700'}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => e.preventDefault()} // keep focus on input
                onClick={() => commit(opt)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Multi Select Dropdown                            */
/* -------------------------------------------------------------------------- */

interface MemberMultiSelectProps {
  label: string;
  options: SSOption[];
  selectedValues: string[];
  onToggleValue: (value: string) => void;
  disabled?: boolean;
}

function MemberMultiSelect({
  label,
  options,
  selectedValues,
  onToggleValue,
  disabled = false,
}: MemberMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedCount = selectedValues.length;

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

  // Adjust dropdown position if it goes off-screen
  useEffect(() => {
    if (!open || !dropdownRef.current || !containerRef.current) return;
    
    const dropdown = dropdownRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    
    // Check if dropdown goes off the right side of the screen
    if (dropdownRect.right > window.innerWidth) {
      dropdown.style.left = 'auto';
      dropdown.style.right = '0';
      dropdown.style.width = `${Math.min(400, window.innerWidth - containerRect.left)}px`;
    }
    
    // Check if dropdown goes off the left side of the screen
    if (dropdownRect.left < 0) {
      dropdown.style.left = '0';
      dropdown.style.right = 'auto';
      dropdown.style.width = `${Math.min(400, containerRect.right)}px`;
    }
  }, [open, options]);

  return (
    <div className="relative w-full max-w-[240px] min-w-0" ref={containerRef}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-1.5 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-50 shadow-sm overflow-hidden"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={label}
      >
        <span className="truncate">{label}</span>
        <span className="ml-2 text-gray-400 flex-shrink-0">▾</span>
      </button>
      <p className="mt-1 text-xs text-gray-500">
        Devotees selected: {selectedCount} {selectedCount === 1 ? 'devotee' : 'devotees'}
      </p>
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-w-md max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <ul className="py-1 text-sm">
            {options.map((option) => {
              const checked = selectedValues.includes(option.value);
              return (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="pr-2 truncate">{option.label}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 rounded flex-shrink-0"
                      checked={checked}
                      onChange={() => onToggleValue(option.value)}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface FeaturedPooja {
  id: number;
  name: string;
  image: string;
  image_url?: string;
  amount: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PoojaOption {
  id: number;
  code: string;
  name: string;
  description: string | null;
  min_amount: string | null;
  max_amount: string | null;
  default_amount: string | null;
  is_active: boolean;
  is_group_header: boolean;
  parent_id: number | null;
}

interface DayOption {
  id: number;
  code: string;
  description: string;
  category: string;
  display_order: number;
}

interface ProfileMember {
  id: number;
  name: string;
  gender?: string;
  relationship?: string;
  date_of_birth?: string | null;
  tamil_star?: string;
  gothra?: string;
  family_name?: string | null;
  rasi?: string | null;
}

interface ProfileDetails {
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  tamil_star?: string;
  gothra?: string;
  date_of_birth?: string | null;
  family_name?: string | null;
  rasi?: string | null;
}

interface ProfilePayload {
  user: {
    name?: string;
    email?: string;
    phone_number?: string;
    role?: string;
    id?: number;
  };
  profile?: ProfileDetails;
  members?: ProfileMember[];
}

interface DonorListUser {
  id: number;
  name: string;
  phone_number?: string;
  email?: string | null;
  role?: string;
}

type DonorProfile = ProfileDetails;

interface DonorListEntry {
  user: DonorListUser;
  profile?: DonorProfile;
  members?: ProfileMember[];
}

type MemberSource = 'self' | 'profile_member' | 'donor' | 'donor_member';

interface MemberDirectoryEntry {
  key: string;
  id: number | null;
  name: string;
  relationship?: string;
  gender?: string;
  tamilStar?: string;
  gothra?: string;
  rasi?: string | null;
  dob?: string | null;
  familyName?: string | null;
  source: MemberSource;
  donorId?: number | null;
  donorName?: string;
  donorPhone?: string;
}

interface ChartPreferredDateGroup {
  key: string;
  date: string;
  note: string;
  memberKeys: string[];
}

interface BookingPooja {
  id: number;
  code?: string;
  name: string;
  displayName?: string;
  amount: string | null;
  amountLabel: string;
  image?: string;
  image_url?: string | null;
  source: 'featured' | 'master';
  rateLabel?: string;
  parentName?: string | null;
}

interface MasterRow {
  pooja: PoojaOption;
  code: string;
  displayName: string;
  uiLabel: string;
  rateLabel: string;
  amountValue: string | null;
  minAmount?: string | null;
  maxAmount?: string | null;
  defaultAmount?: string | null;
  parentName?: string | null;
}

const CartAddIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    role="img"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 3h2.3l1.2 5.6c.2.9 1 1.5 1.9 1.5h9.5a1.8 1.8 0 001.8-1.4l1.3-5.2H5.7" />
    <circle cx="9" cy="19" r="1.2" />
    <circle cx="17" cy="19" r="1.2" />
    <path d="M15 9.5v4" />
    <path d="M13 11.5h4" />
  </svg>
);

const CartRemoveIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    role="img"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 3h2.3l1.2 5.6c.2.9 1 1.5 1.9 1.5h9.5a1.8 1.8 0 001.8-1.4l1.3-5.2H5.7" />
    <circle cx="9" cy="19" r="1.2" />
    <circle cx="17" cy="19" r="1.2" />
    <path d="M13 11.5h4" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/*                                Util helpers                                */
/* -------------------------------------------------------------------------- */

const buildAddress = (profile?: ProfilePayload['profile']) => {
  if (!profile) return '';
  const lines = [profile.address_line1, profile.address_line2, profile.address_line3];
  const cityLine = [profile.city, profile.state, profile.postal_code].filter(Boolean).join(', ');
  if (cityLine) {
    lines.push(cityLine);
  }
  return lines.filter(Boolean).join('\n');
};

const formatDisplayDate = (value?: string | null) => {
  if (!value) return '';
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value?: string | null) => {
  if (!value) return '';
  const amountNumber = Number(value);
  if (Number.isNaN(amountNumber)) {
    return value;
  }
  return amountNumber.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TAMIL_STAR_DESCRIPTION_MAP: Record<string, string> = {
  aswini: 'அசுவினி',
  bharani: 'பரணி',
  karthigai: 'கிருத்திகை',
  kartigai: 'கிருத்திகை',
  rohini: 'ரோகிணி',
  mrigsheersham: 'மிருகசீரிடம்',
  mrigsheersam: 'மிருகசீரிடம்',
  tiruvadarai: 'திருவாதிரை',
  thiruvadarai: 'திருவாதிரை',
  punarpoosam: 'புனர்பூசம்',
  poosam: 'பூசம்',
  aayilyam: 'ஆயில்யம்',
  ayilyam: 'ஆயில்யம்',
  magam: 'மகம்',
  pooram: 'பூரம்',
  uttiram: 'உத்தரம்',
  astham: 'அஸ்தம்',
  ashtam: 'அஸ்தம்',
  chitrai: 'சித்திரை',
  chithirai: 'சித்திரை',
  swathi: 'சுவாதி',
  visakam: 'விசாகம்',
  anusham: 'அனुषம்',
  kettai: 'கேட்டை',
  moolam: 'மூலம்',
  pooradam: 'பூராடம்',
  pooraadam: 'பூராடம்',
  uttiradam: 'உத்திராடம்',
  uttradam: 'உத்திராடம்',
  thiruvonam: 'திருவோணம்',
  thirivonam: 'திருவோணம்',
  avittam: 'அவிட்டம்',
  sadayam: 'சதயம்',
  poorattathi: 'பூரட்டாதி',
  poorattadhi: 'பூரட்டாதி',
  uttrattathi: 'உத்திரட்டாதி',
  uttirattathi: 'உத்திரட்டாதி',
  revathi: 'ரேவதி',
};

const getTamilStarLabel = (option: DayOption) => {
  const normalizedDescription = option.description.trim().toLowerCase();
  return TAMIL_STAR_DESCRIPTION_MAP[normalizedDescription] ?? option.description;
};

const formatDayOptionLabel = (option: DayOption) => {
  const baseLabel = option.category === 'tamil_star' ? getTamilStarLabel(option) : option.description;
  const code = option.code?.trim() ?? '';
  return code ? `${baseLabel} — ${code}` : baseLabel;
};

const toCurrencyLabel = (value?: string | null) => {
  const formatted = formatCurrency(value);
  return formatted ? `₹ ${formatted}` : '';
};

const CHART_DAY_OPTION_CODE = 'CHRT';
const VARIABLE_AMOUNT_STEP = 50;
const EXCLUSIVE_DAY_OPTION_CODES = new Set(['AST', 'PRD']);

const isChartDayOption = (option?: { code?: string | null } | null) => {
  if (!option?.code) return false;
  return option.code.toUpperCase() === CHART_DAY_OPTION_CODE;
};

const describePoojaRate = (pooja: PoojaOption) => {
  const defaultLabel = toCurrencyLabel(pooja.default_amount);
  if (defaultLabel) return defaultLabel;

  const minLabel = toCurrencyLabel(pooja.min_amount);
  const maxLabel = toCurrencyLabel(pooja.max_amount);
  if (minLabel && maxLabel) {
    return `${minLabel} – ${maxLabel}`;
  }
  if (minLabel) return `Min ${minLabel}`;
  if (maxLabel) return `Max ${maxLabel}`;
  if (pooja.description) return pooja.description;
  return '--';
};

const FIRST_DAY_ENGLISH_MONTH_POOJA_NAMES = [
  'gau samrakshana seva',
  'nitya neivedhyam',
  'til oil for lamps',
  'till oil for lamps',
];
const FOUR_SATURDAY_NAVAGRAHA_POOJA_NAME = '4 saturday navagraha pooja per month';
const FIRST_DAY_ENGLISH_MONTH_POOJAS = new Set(FIRST_DAY_ENGLISH_MONTH_POOJA_NAMES);
const DAY_OPTION_DISABLED_POOJAS = new Set([...FIRST_DAY_ENGLISH_MONTH_POOJA_NAMES, FOUR_SATURDAY_NAVAGRAHA_POOJA_NAME]);
const FIRST_DAY_NOTE_MESSAGE = 'First day of the English month';
const FOUR_SATURDAY_NAVAGRAHA_NOTE = 'Temple performs this pooja on every Saturday. Dates are automatically listed for the current month, or the next month if no Saturdays remain.';
const FOUR_SATURDAY_OCCURRENCE_KEY = 'special:navagraha-four-saturday';
const FOUR_SATURDAY_NOTE_DISPLAY = 'Every Saturday — auto-scheduled';

const createChartPreferredDateGroup = (): ChartPreferredDateGroup => ({
  key: `preferred-date-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  date: '',
  note: '',
  memberKeys: [],
});

const normalizePoojaName = (value?: string | null) => {
  if (!value) return '';
  const replaced = value.replace(/—|–/g, '-');
  const [primary] = replaced.split(' - ');
  return primary.trim().toLowerCase();
};

const DEFAULT_DAY_OPTION_CODES_BY_POOJA: Record<string, string> = {
  [normalizePoojaName('Kalabhairavar archana on 2 Ashtami')]: 'AST',
  [normalizePoojaName('2 Pradosha Pooja per month')]: 'PRD',
};

const RESTRICTED_DAY_OPTION_CODES_BY_POOJA: Record<string, string[]> = {
  [normalizePoojaName('Kalabhairavar archana on 2 Ashtami')]: ['AST'],
  [normalizePoojaName('2 Pradosha Pooja per month')]: ['PRD'],
};

const isFirstDayEnglishMonthPooja = (names: { name?: string | null; displayName?: string | null; uiLabel?: string | null }) => {
  return [names.name, names.displayName, names.uiLabel].some((entry) =>
    FIRST_DAY_ENGLISH_MONTH_POOJAS.has(normalizePoojaName(entry)),
  );
};

const isFourSaturdayNavagrahaPooja = (names: { name?: string | null; displayName?: string | null; uiLabel?: string | null }) => {
  return [names.name, names.displayName, names.uiLabel].some(
    (entry) => normalizePoojaName(entry) === FOUR_SATURDAY_NAVAGRAHA_POOJA_NAME,
  );
};

const isDayOptionDisabledPooja = (names: { name?: string | null; displayName?: string | null; uiLabel?: string | null }) => {
  return [names.name, names.displayName, names.uiLabel].some((entry) =>
    DAY_OPTION_DISABLED_POOJAS.has(normalizePoojaName(entry)),
  );
};

const resolveDefaultDayOptionCode = (names: { name?: string | null; displayName?: string | null; uiLabel?: string | null }) => {
  for (const entry of [names.name, names.displayName, names.uiLabel]) {
    const normalized = normalizePoojaName(entry);
    if (normalized && DEFAULT_DAY_OPTION_CODES_BY_POOJA[normalized]) {
      return DEFAULT_DAY_OPTION_CODES_BY_POOJA[normalized];
    }
  }
  return null;
};

const resolveRestrictedDayOptionCodes = (names: {
  name?: string | null;
  displayName?: string | null;
  uiLabel?: string | null;
}): Set<string> | null => {
  for (const entry of [names.name, names.displayName, names.uiLabel]) {
    const normalized = normalizePoojaName(entry);
    if (normalized && RESTRICTED_DAY_OPTION_CODES_BY_POOJA[normalized]) {
      const rawCodes = RESTRICTED_DAY_OPTION_CODES_BY_POOJA[normalized];
      const normalizedCodes = rawCodes
        .map((code) => code?.trim()?.toUpperCase())
        .filter((code): code is string => Boolean(code));
      if (normalizedCodes.length > 0) {
        return new Set(normalizedCodes);
      }
    }
  }
  return null;
};

const computeNextEnglishMonthFirstDay = (todayIso: string) => {
  const base = new Date(todayIso);
  if (Number.isNaN(base.getTime())) {
    return null;
  }
  const shouldUseCurrentMonth = base.getDate() <= 1;
  const target = new Date(base.getFullYear(), base.getMonth() + (shouldUseCurrentMonth ? 0 : 1), 1);
  const iso = toLocalIsoDate(target);
  return {
    date: iso,
    label: formatDisplayDate(iso),
  };
};

const computeUpcomingSaturdayOccurrences = (todayIso: string): UpcomingOccurrence[] => {
  const base = new Date(todayIso);
  if (Number.isNaN(base.getTime())) {
    return [];
  }

  const collectForMonth = (start: Date) => {
    if (Number.isNaN(start.getTime())) {
      return [];
    }
    const cursor = new Date(start);
    const targetMonth = cursor.getMonth();
    const occurrences: UpcomingOccurrence[] = [];
    while (cursor.getMonth() === targetMonth) {
      if (cursor.getDay() === 6) {
        occurrences.push({
          date: toLocalIsoDate(cursor),
          label: 'Saturday',
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return occurrences;
  };

  const currentMonthOccurrences = collectForMonth(new Date(base.getFullYear(), base.getMonth(), base.getDate()));
  if (currentMonthOccurrences.length > 0) {
    return currentMonthOccurrences;
  }

  const nextMonthStart = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return collectForMonth(nextMonthStart);
};

const getOccurrenceNotePresentation = (note: string) => {
  if (note === FOUR_SATURDAY_NAVAGRAHA_NOTE) {
    return {
      text: FOUR_SATURDAY_NOTE_DISPLAY,
      tooltip: FOUR_SATURDAY_NAVAGRAHA_NOTE,
    };
  }
  return { text: note, tooltip: null };
};

const renderOccurrenceNote = (note: string) => {
  const { text, tooltip } = getOccurrenceNotePresentation(note);
  return (
    <span className="block text-xs text-gray-500" title={tooltip ?? undefined}>
      {text}
    </span>
  );
};

const deriveAmountValue = (pooja: PoojaOption): string | null => {
  if (pooja.default_amount) {
    return pooja.default_amount;
  }
  if (pooja.min_amount && pooja.max_amount && pooja.min_amount === pooja.max_amount) {
    return pooja.min_amount;
  }
  return null;
};

const parseAmountFromLabel = (label?: string | null): string | null => {
  if (!label) return null;
  const match = label.match(/\d+(?:[.,]\d+)?/);
  if (!match) {
    return null;
  }
  const normalized = match[0].replace(/,/g, '');
  const value = Number(normalized);
  if (Number.isNaN(value)) {
    return null;
  }
  return value.toFixed(2);
};

type BookingMode = 'full' | 'memberOnly';

type UpcomingOccurrence = {
  date: string;
  label?: string;
};

type DayOccurrenceState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; date: string; label: string; note?: string | null; occurrences?: UpcomingOccurrence[] }
  | { status: 'error'; key: string; message: string }
  | { status: 'needsStar'; key: string; message: string }
  | { status: 'manual'; key: string; message: string };

const buildOccurrenceKey = (dayOptionId: number | null, tamilStarId: string | null | undefined) => {
  if (!dayOptionId) return 'none';
  const starPart = tamilStarId ? tamilStarId : 'na';
  return `${dayOptionId}:${starPart}`;
};

const areOccurrencesEqual = (a?: UpcomingOccurrence[], b?: UpcomingOccurrence[]) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return entry.date === other.date && (entry.label ?? '') === (other.label ?? '');
  });
};

const getOccurrenceMessage = (state?: DayOccurrenceState): string | undefined => {
  if (!state) return undefined;
  switch (state.status) {
    case 'error':
    case 'manual':
    case 'needsStar':
      return state.message;
    default:
      return undefined;
  }
};

const areRecurrenceSelectionsEqual = (
  a?: RecurrenceSelection,
  b?: RecurrenceSelection,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'recurring' && b.kind === 'recurring') {
    return a.frequency === b.frequency;
  }
  if (a.kind === 'one_time_extra' && b.kind === 'one_time_extra') {
    return (a.oneTimeDate ?? '') === (b.oneTimeDate ?? '');
  }
  return false;
};

const RECURRING_FREQUENCY_DESCRIPTIONS: Record<RecurrenceFrequency, string> = {
  monthly: 'Monthly (every 1 month)',
  quarterly: 'Quarterly (every 3 months)',
  annually: 'Annual (once per year)',
};

const FREQUENCY_TOOLTIP: Record<RecurrenceFrequency, string> = {
  monthly: 'This schedule runs once every month.',
  quarterly: 'This schedule runs once every three months.',
  annually: 'This schedule runs once per calendar year',
};

const buildRecurrenceFields = (
  selection?: RecurrenceSelection,
  fallbackDate?: string,
): {
  recurrenceKind?: RecurrenceSelection['kind'];
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceOneTimeDate?: string | undefined;
} => {
  if (!selection) {
    return {};
  }
  return {
    recurrenceKind: selection.kind,
    recurrenceFrequency: selection.kind === 'recurring' ? selection.frequency : undefined,
    recurrenceOneTimeDate:
      selection.kind === 'one_time_extra'
        ? selection.oneTimeDate ?? fallbackDate ?? undefined
        : undefined,
  };
};

const deriveRecurrenceSelectionFromCartItem = (item: CartItem): RecurrenceSelection | undefined => {
  if (item.recurrenceKind === 'recurring') {
    return { kind: 'recurring', frequency: item.recurrenceFrequency ?? 'monthly' };
  }
  if (item.recurrenceKind === 'one_time_extra') {
    return { kind: 'one_time_extra', oneTimeDate: item.recurrenceOneTimeDate ?? undefined };
  }
  return undefined;
};

/* -------------------------------------------------------------------------- */
/*                            Main Page Component                             */
/* -------------------------------------------------------------------------- */

const PoojaRegistrationPage = () => {
  const [featuredPoojas, setFeaturedPoojas] = useState<FeaturedPooja[]>([]);
  const [poojaOptions, setPoojaOptions] = useState<PoojaOption[]>([]);
  const [dayOptions, setDayOptions] = useState<DayOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPooja, setSelectedPooja] = useState<BookingPooja | null>(null);
  const [selectedDayOptionId, setSelectedDayOptionId] = useState<number | null>(null);
  const [selectedTamilStar, setSelectedTamilStar] = useState<string | null>(null);
  const [tamilStarSelectionMap, setTamilStarSelectionMap] = useState<Record<number, string | null>>({});
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [donorRecords, setDonorRecords] = useState<DonorListEntry[]>([]);
  const [dateValue, setDateValue] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const normalizedSelectedMemberIds = useMemo(
    () => Array.from(new Set(selectedMemberIds)),
    [selectedMemberIds],
  );
  const [contactDetails, setContactDetails] = useState({ phoneNumber: '', address: '' });
  const [daySelectionMap, setDaySelectionMap] = useState<Record<number, number | null>>({});
  const [memberSelectionMap, setMemberSelectionMap] = useState<Record<number, string[]>>({});
  const [prasadamSelectionMap, setPrasadamSelectionMap] = useState<Record<number, boolean>>({});
  const [chartPreferredDateGroupsMap, setChartPreferredDateGroupsMap] = useState<Record<number, ChartPreferredDateGroup[]>>({});
  const [amountSelectionMap, setAmountSelectionMap] = useState<Record<number, string>>({});
  const [recurrenceSelectionMap, setRecurrenceSelectionMap] = useState<Record<number, RecurrenceSelection>>({});
  const [dayOccurrenceMap, setDayOccurrenceMap] = useState<Record<number, DayOccurrenceState>>({});
  const [bookingMode, setBookingMode] = useState<BookingMode>('full');
  const [tableMessage, setTableMessage] = useState<{ status: 'info' | 'error'; text: string } | null>(null);
  const tableMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [warningPopup, setWarningPopup] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const addToCart = useCartStore((state) => state.addItem);
  const removeFromCart = useCartStore((state) => state.removeItem);
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const baseUserId = typeof profile?.user?.id === 'number' ? profile.user.id : null;
  const cartTotals = useMemo(() => {
    const count = cartItems.length;
    const amount = cartItems.reduce((total, item) => {
      const value = Number(item.amount);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
    return { count, amount };
  }, [cartItems]);
  const cartTotalAmount = cartTotals.amount;
  const formattedCartAmount = formatCurrency(cartTotalAmount.toString()) || '0';
  const cartAmountBreakdown = useMemo(() => {
    let recurringAmount = 0;
    let oneTimeAmount = 0;
    cartItems.forEach((item) => {
      const value = Number(item.amount);
      if (!Number.isFinite(value)) return;
      if (item.recurrenceKind === 'recurring') {
        recurringAmount += value;
      } else {
        oneTimeAmount += value;
      }
    });
    return { recurringAmount, oneTimeAmount };
  }, [cartItems]);
  const formattedRecurringAmount =
    formatCurrency(cartAmountBreakdown.recurringAmount.toString()) || '0';
  const formattedOneTimeAmount =
    formatCurrency(cartAmountBreakdown.oneTimeAmount.toString()) || '0';
  const setGeneralPayment = usePaymentStore((state) => state.setGeneralPayment);
  const navigate = useNavigate();
  const handleViewCart = useCallback(() => {
    setGeneralPayment({
      userKey: cartKey,
      items: cartItems,
      totalAmount: cartTotalAmount,
    });
    navigate('/profile?fromCart=1');
  }, [cartItems, cartKey, cartTotalAmount, navigate, setGeneralPayment]);
  const registrationDateLabel = useMemo(() => formatDisplayDate(toLocalIsoDate(new Date())), []);
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const nextFirstDayOccurrence = useMemo(() => computeNextEnglishMonthFirstDay(todayIso), [todayIso]);
  const isAdminUser = (profile?.user?.role ?? user?.role) === 'admin';
  const requiresMemberSelection = !isAdminUser;
  const fallbackMemberSelection = useMemo(() => [], []);
  const normalizeMemberSelection = useCallback(
    (members: string[]) => {
      const unique = Array.from(new Set(members));
      return unique.length > 0 ? unique : fallbackMemberSelection;
    },
    [fallbackMemberSelection],
  );

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWarningTimer = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);
  const showWarningPopup = useCallback(
    (message: string) => {
      setTableMessage(null);
      clearWarningTimer();
      setWarningPopup(message);
      const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
      warningTimerRef.current = schedule(() => {
        setWarningPopup(null);
        warningTimerRef.current = null;
      }, 4500);
    },
    [clearWarningTimer],
  );
  const hideWarningPopup = useCallback(() => {
    clearWarningTimer();
    setWarningPopup(null);
  }, [clearWarningTimer]);

  useEffect(() => {
    setDaySelectionMap((prev) => {
      let changed = false;
      const next = { ...prev };
      cartItems.forEach((item) => {
        if (!(item.poojaId in next)) {
          next[item.poojaId] = item.dayOptionId ?? null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [cartItems]);

  useEffect(() => {
    setPrasadamSelectionMap((prev) => {
      let changed = false;
      const next = { ...prev };
      cartItems.forEach((item) => {
        if (!(item.poojaId in next) && item.postPrasadam !== undefined) {
          next[item.poojaId] = Boolean(item.postPrasadam);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [cartItems]);

  useEffect(() => {
    setRecurrenceSelectionMap((prev) => {
      let changed = false;
      const next = { ...prev };
      cartItems.forEach((item) => {
        const incoming = deriveRecurrenceSelectionFromCartItem(item);
        if (!incoming) return;
        const existing = next[item.poojaId];
        if (!existing || !areRecurrenceSelectionsEqual(existing, incoming)) {
          next[item.poojaId] = incoming;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [cartItems]);

  const resolveRecurrenceSelection = (poojaId: number): RecurrenceSelection | undefined =>
    recurrenceSelectionMap[poojaId];

  const applyRecurrenceSelection = (poojaId: number, nextSelection?: RecurrenceSelection) => {
    setRecurrenceSelectionMap((prev) => {
      const existing = prev[poojaId];
      if (!nextSelection) {
        if (!existing) {
          return prev;
        }
        const next = { ...prev };
        delete next[poojaId];
        return next;
      }
      if (areRecurrenceSelectionsEqual(existing, nextSelection)) {
        return prev;
      }
      return {
        ...prev,
        [poojaId]: nextSelection,
      };
    });
    setTableMessage(null);
  };

  const showTemporaryTableMessage = useCallback((text: string) => {
    if (tableMessageTimerRef.current) {
      clearTimeout(tableMessageTimerRef.current);
    }
    setTableMessage({ status: 'info', text });
    const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    tableMessageTimerRef.current = schedule(() => {
      setTableMessage(null);
      tableMessageTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      hideWarningPopup();
      if (tableMessageTimerRef.current) {
        clearTimeout(tableMessageTimerRef.current);
        tableMessageTimerRef.current = null;
      }
    };
  }, [hideWarningPopup]);

  const memberDirectory = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const lookup = new Map<string, MemberDirectoryEntry>();
    const idLookup = new Map<number, string>();

    const register = (entry: MemberDirectoryEntry, label: string) => {
      if (lookup.has(entry.key)) {
        return;
      }
      if (isAdminUser && entry.source === 'self') {
        return;
      }
      options.push({ value: entry.key, label });
      lookup.set(entry.key, entry);
      if (typeof entry.id === 'number' && Number.isFinite(entry.id)) {
        idLookup.set(entry.id, entry.key);
      }
    };

    let fallbackKeyCounter = 0;

    const baseName = (profile?.user?.name ?? '').trim();
    const basePhone = (profile?.user?.phone_number ?? '').trim();

    const selfEntry: MemberDirectoryEntry = {
      key: 'self',
      id: baseUserId,
      name: baseName || 'Self',
      relationship: 'Self',
      gender: undefined,
      tamilStar: profile?.profile?.tamil_star,
      gothra: profile?.profile?.gothra,
      rasi: profile?.profile?.rasi,
      dob: profile?.profile?.date_of_birth ?? null,
      familyName: profile?.profile?.family_name ?? null,
      source: 'self',
      donorId: baseUserId,
      donorName: baseName || 'Self',
      donorPhone: basePhone || undefined,
    };
    if (!isAdminUser) {
      register(selfEntry, baseName ? `${baseName} (Self)` : 'Self');
    }

    (profile?.members ?? []).forEach((member) => {
      const key =
        typeof member.id === 'number'
          ? `profile-${member.id}`
          : `profile-fallback-${fallbackKeyCounter++}`;
      const name = (member.name ?? '').trim() || (member.id ? `Member #${member.id}` : 'Member');
      const relationship = (member.relationship ?? '').trim();
      const label = relationship ? `${name} (${relationship})` : name;
      const entry: MemberDirectoryEntry = {
        key,
        id: member.id ?? null,
        name,
        relationship: relationship || undefined,
        gender: member.gender,
        tamilStar: member.tamil_star,
        gothra: member.gothra,
        rasi: member.rasi,
        dob: member.date_of_birth ?? null,
        familyName: member.family_name ?? null,
        source: 'profile_member',
        donorId: baseUserId,
        donorName: baseName || 'Self',
        donorPhone: basePhone || undefined,
      };
      register(entry, label);
    });

    donorRecords.forEach((donor) => {
      if (!donor?.user) {
        return;
      }
      const donorId = typeof donor.user.id === 'number' ? donor.user.id : null;
      if (baseUserId !== null && donorId === baseUserId) {
        return;
      }
      const donorName = (donor.user.name ?? '').trim() || (donorId !== null ? `Donor #${donorId}` : 'Donor');
      const donorPhone = (donor.user.phone_number ?? '').trim();
      const donorKey =
        donorId !== null
          ? `donor-${donorId}`
          : `donor-fallback-${fallbackKeyCounter++}`;
      const donorLabel = donorPhone ? `${donorName} — ${donorPhone}` : donorName;
      const donorEntry: MemberDirectoryEntry = {
        key: donorKey,
        id: donorId,
        name: donorName,
        relationship: 'Donor',
        gender: undefined,
        tamilStar: donor.profile?.tamil_star,
        gothra: donor.profile?.gothra,
        rasi: donor.profile?.rasi,
        dob: donor.profile?.date_of_birth ?? null,
        familyName: donor.profile?.family_name ?? null,
        source: 'donor',
        donorId,
        donorName,
        donorPhone: donorPhone || undefined,
      };
      register(donorEntry, donorLabel);

      (donor.members ?? []).forEach((member) => {
        const memberId = typeof member.id === 'number' ? member.id : null;
        const memberName = (member.name ?? '').trim() || (memberId !== null ? `Member #${memberId}` : 'Member');
        const relationship = (member.relationship ?? '').trim();
        const baseLabel = relationship ? `${memberName} (${relationship})` : memberName;
        const memberKey =
          memberId !== null
            ? `donor-member-${memberId}`
            : `donor-member-fallback-${fallbackKeyCounter++}`;
        const memberLabel = donorName ? `${baseLabel} — ${donorName}` : baseLabel;
        const entry: MemberDirectoryEntry = {
          key: memberKey,
          id: memberId,
          name: memberName,
          relationship: relationship || undefined,
          gender: member.gender,
          tamilStar: member.tamil_star,
          gothra: member.gothra,
          rasi: member.rasi,
          dob: member.date_of_birth ?? null,
          familyName: member.family_name ?? null,
          source: 'donor_member',
          donorId,
          donorName,
          donorPhone: donorPhone || undefined,
        };
        register(entry, memberLabel);
      });
    });

    return { options, lookup, idLookup };
  }, [profile, donorRecords, isAdminUser]);

  const memberOptions = memberDirectory.options;
  const memberLookup = memberDirectory.lookup;
  const memberIdLookup = memberDirectory.idLookup;

  const primaryMemberKey: string | null = selectedMemberIds[0] ?? null;

  const primaryMember = useMemo(() => {
    if (!primaryMemberKey) {
      return null;
    }
    return memberLookup.get(primaryMemberKey) ?? null;
  }, [memberLookup, primaryMemberKey]);

  const selectedMemberEntries = useMemo<MemberDirectoryEntry[]>(() => {
    return selectedMemberIds
      .map((memberKey) => memberLookup.get(memberKey))
      .filter((entry): entry is MemberDirectoryEntry => Boolean(entry));
  }, [memberLookup, selectedMemberIds]);

  const formatDirectoryEntryForCart = (entry: MemberDirectoryEntry, fallbackName?: string) => ({
    id: entry.id ?? null,
    name: entry.name || fallbackName || 'Member',
    relationship:
      entry.relationship ??
      (entry.source === 'self'
        ? 'Self'
        : entry.source === 'donor'
          ? 'Donor'
          : undefined),
    gender: entry.gender,
    tamilStar: entry.tamilStar,
    gothra: entry.gothra,
    rasi: entry.rasi,
    dob: entry.dob ?? null,
    familyName: entry.familyName ?? null,
    selectionKey: entry.key,
    donorName: entry.donorName ?? null,
    donorPhone: entry.donorPhone ?? null,
    donorId: entry.donorId ?? null,
  });

  const buildMemberPayloadFromKey = useCallback(
    (memberKey: string, fallbackName?: string) => {
      const directEntry = memberLookup.get(memberKey);
      if (directEntry) {
        return formatDirectoryEntryForCart(directEntry, fallbackName);
      }
      if (memberKey === 'self') {
        const selfEntry = memberLookup.get('self');
        if (selfEntry) {
          return formatDirectoryEntryForCart(selfEntry, fallbackName);
        }
      }
      const numericId = Number(memberKey);
      if (!Number.isNaN(numericId)) {
        const mappedKey = memberIdLookup.get(numericId);
        if (mappedKey) {
          const mappedEntry = memberLookup.get(mappedKey);
          if (mappedEntry) {
            return formatDirectoryEntryForCart(mappedEntry, fallbackName);
          }
        }
        return {
          id: numericId,
          name: fallbackName || 'Member',
          relationship: undefined,
          gender: undefined,
          tamilStar: undefined,
          gothra: undefined,
          rasi: undefined,
          dob: null,
          familyName: null,
          selectionKey: memberKey,
          donorName: null,
          donorPhone: null,
          donorId: null,
        };
      }
      return {
        id: null,
        name: fallbackName || 'Member',
        relationship: memberKey === 'self' ? 'Self' : undefined,
        gender: undefined,
        tamilStar: undefined,
        gothra: undefined,
        rasi: undefined,
        dob: null,
        familyName: null,
        selectionKey: memberKey,
        donorName: null,
        donorPhone: null,
        donorId: null,
      };
    },
    [memberIdLookup, memberLookup],
  );

  const dayOptionMap = useMemo(() => {
    const map = new Map<number, DayOption>();
    dayOptions.forEach((option) => {
      map.set(option.id, option);
    });
    return map;
  }, [dayOptions]);

  const dayOptionCodeMap = useMemo(() => {
    const map = new Map<string, DayOption>();
    dayOptions.forEach((option) => {
      if (option.code) {
        map.set(option.code.trim().toUpperCase(), option);
      }
    });
    return map;
  }, [dayOptions]);

  const compareDayOptions = useCallback((a: DayOption, b: DayOption) => {
    const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    return a.description.localeCompare(b.description);
  }, []);

  const dayOptionChoices = useMemo(() => {
    return dayOptions
      .filter((option) => option.category !== 'tamil_star')
      .filter((option) => {
        const code = option.code?.trim()?.toUpperCase() ?? '';
        return !code || !EXCLUSIVE_DAY_OPTION_CODES.has(code);
      })
      .sort(compareDayOptions);
  }, [compareDayOptions, dayOptions]);

  const filterDayOptionsForNames = useCallback(
    (names: { name?: string | null; displayName?: string | null; uiLabel?: string | null }) => {
      const restriction = resolveRestrictedDayOptionCodes(names);
      if (!restriction) {
        return dayOptionChoices;
      }
      const restrictedOptions: DayOption[] = [];
      restriction.forEach((code) => {
        const option = dayOptionCodeMap.get(code);
        if (option && option.category !== 'tamil_star') {
          restrictedOptions.push(option);
        }
      });
      if (restrictedOptions.length > 0) {
        return restrictedOptions.sort(compareDayOptions);
      }
      return dayOptionChoices;
    },
    [compareDayOptions, dayOptionChoices, dayOptionCodeMap],
  );

  // Filter Tamil star options
  const tamilStarOptions = useMemo(() => {
    return dayOptions
      .filter(option => option.category === 'tamil_star')
      .sort((a, b) => a.description.localeCompare(b.description));
  }, [dayOptions]);

  const resolvePostPrasadam = (poojaId: number, matchingItem?: CartItem): boolean => {
    if (Object.prototype.hasOwnProperty.call(prasadamSelectionMap, poojaId)) {
      return prasadamSelectionMap[poojaId];
    }
    if (matchingItem?.postPrasadam !== undefined) {
      return Boolean(matchingItem.postPrasadam);
    }
    return false;
  };

  const masterRows = useMemo<MasterRow[]>(() => {
    if (poojaOptions.length === 0) return [];

    const optionMap = new Map<number, PoojaOption>();
    const childrenMap = new Map<number, PoojaOption[]>();

    poojaOptions.forEach((option) => {
      optionMap.set(option.id, option);
      if (option.parent_id) {
        const existing = childrenMap.get(option.parent_id) ?? [];
        existing.push(option);
        childrenMap.set(option.parent_id, existing);
      }
    });

    const compareByCode = (a: PoojaOption, b: PoojaOption) =>
      a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });

    const topLevel = poojaOptions
      .filter((option) => option.parent_id === null)
      .slice()
      .sort(compareByCode);

    const buildRow = (option: PoojaOption, parent?: PoojaOption): MasterRow | null => {
      if (!option.is_active || option.is_group_header) {
        return null;
      }
      const displayName = parent ? `${parent.name} — ${option.name}` : option.name;
      const uiLabel = parent ? `${option.name} — ${parent.name}` : option.name;
      return {
        pooja: option,
        code: option.code,
        displayName,
        uiLabel,
        rateLabel: describePoojaRate(option),
        amountValue: deriveAmountValue(option),
        minAmount: option.min_amount,
        maxAmount: option.max_amount,
        defaultAmount: option.default_amount,
        parentName: parent?.name ?? null,
      };
    };

    const rows: MasterRow[] = [];

    topLevel.forEach((option) => {
      if (!option.is_group_header) {
        const row = buildRow(option);
        if (row) {
          rows.push(row);
        }
      }

      const children = (childrenMap.get(option.id) ?? [])
        .slice()
        .sort(compareByCode);

      children.forEach((child) => {
        const parent = optionMap.get(child.parent_id ?? 0) ?? option;
        const row = buildRow(child, parent);
        if (row) {
          rows.push(row);
        }
      });
    });

    return rows;
  }, [poojaOptions]);

  useEffect(() => {
    if (masterRows.length === 0 || dayOptionCodeMap.size === 0) {
      return;
    }
    setDaySelectionMap((prev) => {
      let changed = false;
      const next = { ...prev };
      masterRows.forEach((row) => {
        const names = {
          name: row.pooja.name,
          displayName: row.displayName,
          uiLabel: row.uiLabel,
        };
        const restriction = resolveRestrictedDayOptionCodes(names);
        const prevHasValue = Object.prototype.hasOwnProperty.call(prev, row.pooja.id);
        const previousValue = prevHasValue ? prev[row.pooja.id] ?? null : null;
        let currentValue = prevHasValue ? prev[row.pooja.id] ?? null : null;

        if (restriction && currentValue) {
          const option = dayOptionMap.get(currentValue);
          const code = option?.code ? option.code.toUpperCase() : '';
          if (!code || !restriction.has(code)) {
            currentValue = null;
          }
        }

        if (!currentValue) {
          const defaultCode = resolveDefaultDayOptionCode(names);
          if (defaultCode) {
            const defaultOption = dayOptionCodeMap.get(defaultCode.trim().toUpperCase());
            if (defaultOption) {
              currentValue = defaultOption.id;
            }
          }
        }

        if (!currentValue && restriction) {
          for (const code of restriction.values()) {
            const option = dayOptionCodeMap.get(code);
            if (option) {
              currentValue = option.id;
              break;
            }
          }
        }

        if ((prevHasValue && currentValue !== previousValue) || (!prevHasValue && currentValue !== null && currentValue !== undefined)) {
          next[row.pooja.id] = currentValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [masterRows, dayOptionCodeMap, dayOptionMap]);

  const baseName = profile?.user?.name ?? '';
  const baseEmail = profile?.user?.email ?? '';
  const basePhone = profile?.user?.phone_number ?? '';
  const baseAddress = buildAddress(profile?.profile);
  const resolvedName = primaryMember?.name ?? baseName;
  const resolvedEmail = baseEmail;

  const fetchAllPages = useCallback(async <T,>(initialUrl: string): Promise<T[]> => {
    const records: T[] = [];
    let nextUrl: string | null = initialUrl;

    const normalizeNextUrl = (nextValue: unknown): string | null => {
      if (typeof nextValue !== 'string' || nextValue.length === 0) {
        return null;
      }
      let path = nextValue;
      if (path.startsWith('http')) {
        try {
          const url = new URL(path);
          path = `${url.pathname}${url.search}`;
        } catch (error) {
          console.warn('Unable to parse next url', path, error);
          return null;
        }
      }
      if (path.startsWith('/')) {
        path = path.slice(1);
      }
      if (path.startsWith('api/')) {
        path = path.slice(4);
      }
      return path;
    };

    while (nextUrl) {
      const response = await api.get(nextUrl);
      records.push(...extractResults<T>(response.data));
      nextUrl = normalizeNextUrl(response.data?.next);
    }

    return records;
  }, []);

  useEffect(() => {
    let isActive = true;
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [featuredRes, poojaList, dayListRaw] = await Promise.all([
          api.get('/pooja/featured-poojas/'),
          fetchAllPages<PoojaOption>('/pooja/options/?page_size=200'),
          fetchAllPages<DayOption>('/pooja/day-options/?page_size=200'),
        ]);
        if (!isActive) return;
        const featured = extractResults<FeaturedPooja>(featuredRes.data).filter((item) => item.is_active);
        const dayList = dayListRaw
          .slice()
          .sort((a, b) => {
            const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
            if (orderDiff !== 0) {
              return orderDiff;
            }
            return a.description.localeCompare(b.description);
          });
        setFeaturedPoojas(featured);
        setPoojaOptions(poojaList);
        setDayOptions(dayList);
        setError('');
      } catch (err) {
        if (!isActive) return;
        setError('Unable to load pooja details right now. Please try again later.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchAll();
    return () => {
      isActive = false;
    };
  }, [fetchAllPages]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/auth/profile/');
        setProfile(data);
      } catch (err) {
        // profile fetch failure should not block booking preview
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    if (profile?.user?.role !== 'admin') {
      setDonorRecords([]);
      return;
    }

    let isActive = true;
    const fetchDonors = async () => {
      try {
        const { data } = await api.get('auth/donors/');
        if (!isActive) {
          return;
        }
        const donors = Array.isArray(data) ? data : extractResults<DonorListEntry>(data);
        setDonorRecords(donors);
      } catch (err) {
        if (isActive) {
          setDonorRecords([]);
        }
      }
    };

    fetchDonors();
    return () => {
      isActive = false;
    };
  }, [profile?.user?.role]);

  useEffect(() => {
    if (!primaryMemberKey) {
      return;
    }
    if (!memberLookup.has(primaryMemberKey)) {
      setSelectedMemberIds(normalizeMemberSelection([]));
    }
  }, [memberLookup, primaryMemberKey, normalizeMemberSelection]);

  useEffect(() => {
    if (!selectedPooja || bookingMode !== 'full') return;
    setContactDetails({
      phoneNumber: basePhone,
      address: baseAddress,
    });
  }, [selectedPooja, basePhone, baseAddress, bookingMode]);

  useEffect(() => {
    const normalizedSet = new Set(normalizedSelectedMemberIds);
    setChartPreferredDateGroupsMap((prev) => {
      let changed = false;
      const next: Record<number, ChartPreferredDateGroup[]> = {};
      Object.entries(prev).forEach(([poojaId, groups]) => {
        const filteredGroups = groups.map((group) => {
          const filteredKeys = group.memberKeys.filter((key) => normalizedSet.has(key));
          if (filteredKeys.length !== group.memberKeys.length) {
            changed = true;
            return {
              ...group,
              memberKeys: filteredKeys,
            };
          }
          return group;
        });
        next[Number(poojaId)] = filteredGroups;
      });
      return changed ? next : prev;
    });
  }, [normalizedSelectedMemberIds]);

  const clearChartDetailsForPooja = useCallback((poojaId: number) => {
    setChartPreferredDateGroupsMap((prev) => {
      if (!(poojaId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[poojaId];
      return next;
    });
  }, []);

  const ensurePreferredDateGroups = useCallback(
    (poojaId: number, count = 1) => {
      const normalizedCount = Math.max(1, Math.floor(count));
      setChartPreferredDateGroupsMap((prev) => {
        const existing = prev[poojaId] ?? [];
        if (existing.length === normalizedCount) {
          return prev;
        }
        const nextGroups = existing.slice(0, normalizedCount);
        while (nextGroups.length < normalizedCount) {
          nextGroups.push(createChartPreferredDateGroup());
        }
        return {
          ...prev,
          [poojaId]: nextGroups,
        };
      });
    },
    [],
  );

  const ensureChartDetailState = useCallback(
    (poojaId: number, optionId: number | null) => {
      const option = optionId ? dayOptionMap.get(optionId) : undefined;
      if (!option || !isChartDayOption(option)) {
        clearChartDetailsForPooja(poojaId);
        return;
      }
      ensurePreferredDateGroups(poojaId, 1);
    },
    [clearChartDetailsForPooja, dayOptionMap, ensurePreferredDateGroups],
  );
  const updatePreferredDateGroupField = useCallback(
    (poojaId: number, groupKey: string, field: 'date' | 'note', value: string) => {
      setChartPreferredDateGroupsMap((prev) => {
        const groups = prev[poojaId];
        if (!groups) {
          return prev;
        }
        let changed = false;
        const next = groups.map((group) => {
          if (group.key !== groupKey) {
            return group;
          }
          if (group[field] === value) {
            return group;
          }
          changed = true;
          return {
            ...group,
            [field]: value,
          };
        });
        if (!changed) {
          return prev;
        }
        return {
          ...prev,
          [poojaId]: next,
        };
      });
    },
    [],
  );

  const togglePreferredDateGroupMember = useCallback(
    (poojaId: number, groupKey: string, memberKey: string) => {
      setChartPreferredDateGroupsMap((prev) => {
        const groups = prev[poojaId];
        if (!groups) {
          return prev;
        }
        let changed = false;
        const next = groups.map((group) => {
          if (group.key !== groupKey) {
            return group;
          }
          const existing = new Set(group.memberKeys);
          if (existing.has(memberKey)) {
            existing.delete(memberKey);
          } else {
            existing.add(memberKey);
          }
          const updatedKeys = Array.from(existing);
          if (
            updatedKeys.length === group.memberKeys.length &&
            updatedKeys.every((key) => group.memberKeys.includes(key))
          ) {
            return group;
          }
          changed = true;
          return {
            ...group,
            memberKeys: updatedKeys,
          };
        });
        if (!changed) {
          return prev;
        }
        const combinedKeys = Array.from(
          new Set(next.flatMap((group) => group.memberKeys)),
        );
        setMemberSelectionMap((state) => ({
          ...state,
          [poojaId]: combinedKeys,
        }));
        return {
          ...prev,
          [poojaId]: next,
        };
      });
    },
    [],
  );

  const fetchOccurrenceForRow = useCallback(
    async (poojaId: number, option: DayOption | undefined, options: { tamilStarId?: string | null } = {}) => {
      if (!option) {
        setDayOccurrenceMap((prev) => {
          if (!(poojaId in prev)) return prev;
          const next = { ...prev };
          delete next[poojaId];
          return next;
        });
        return;
      }

      const code = (option.code || '').toUpperCase();
      const requiresStar = code === 'CS';
      const tamilStarId = requiresStar ? options.tamilStarId ?? null : null;
      const stateKey = buildOccurrenceKey(option.id, tamilStarId);
      const existing = dayOccurrenceMap[poojaId];

      if (existing && existing.key === stateKey) {
        if (existing.status === 'loading') {
          return; // request already in flight
        }
        if (existing.status !== 'error') {
          return; // result already available
        }
      }

      if (code === 'CHRT') {
        setDayOccurrenceMap((prev) => {
          const current = prev[poojaId];
          if (current && current.key === stateKey && current.status === 'manual') {
            return prev;
          }
          return {
            ...prev,
            [poojaId]: { status: 'manual', key: stateKey, message: 'Donor will provide a preferred date for this option.' },
          };
        });
        return;
      }

      if (requiresStar && !tamilStarId) {
        setDayOccurrenceMap((prev) => {
          const current = prev[poojaId];
          if (current && current.key === stateKey && current.status === 'needsStar') {
            return prev;
          }
          return {
            ...prev,
            [poojaId]: { status: 'needsStar', key: stateKey, message: 'Select your Tamil star to view the next occurrence.' },
          };
        });
        return;
      }

      setDayOccurrenceMap((prev) => {
        const current = prev[poojaId];
        if (current && current.key === stateKey && current.status === 'loading') {
          return prev;
        }
        return {
          ...prev,
          [poojaId]: { status: 'loading', key: stateKey },
        };
      });

      try {
        const params: Record<string, string> = { start_date: todayIso };
        if (tamilStarId) {
          params.tamil_star_id = tamilStarId;
        }
        const { data } = await api.get(`/pooja/day-options/${option.id}/next-occurrence/`, { params });
        const upcomingOccurrences: UpcomingOccurrence[] = Array.isArray(data?.meta?.upcoming_occurrences)
          ? data.meta.upcoming_occurrences
              .map((entry: any) => {
                if (!entry || typeof entry !== 'object') return null;
                const occurrenceDate = typeof entry.date === 'string' ? entry.date : '';
                if (!occurrenceDate) return null;
                const occurrenceLabel = typeof entry.label === 'string' ? entry.label : '';
                return { date: occurrenceDate, label: occurrenceLabel };
              })
              .filter((entry): entry is UpcomingOccurrence => Boolean(entry))
          : [];
        setDayOccurrenceMap((prev) => {
          const nextState: DayOccurrenceState = {
            status: 'ready',
            key: stateKey,
            date: data?.occurrence_date ?? '',
            label: data?.occurrence_label ?? '',
            note: data?.meta?.note ?? null,
            occurrences: upcomingOccurrences.length > 0 ? upcomingOccurrences : undefined,
          };
          const current = prev[poojaId];
          if (current && current.key === stateKey && current.status === 'ready' && current.date === nextState.date && current.label === nextState.label && current.note === nextState.note) {
            return prev;
          }
          return {
            ...prev,
            [poojaId]: nextState,
          };
        });
      } catch (error: any) {
        const detail = error?.response?.data?.detail ?? 'Unable to fetch occurrence date.';
        setDayOccurrenceMap((prev) => {
          const current = prev[poojaId];
          const message = typeof detail === 'string' ? detail : 'Unable to fetch occurrence date.';
          if (current && current.key === stateKey && current.status === 'error' && current.message === message) {
            return prev;
          }
          return {
            ...prev,
            [poojaId]: { status: 'error', key: stateKey, message },
          };
        });
      }
    },
    [todayIso, dayOccurrenceMap],
  );

  useEffect(() => {
    Object.keys(daySelectionMap).forEach((poojaIdKey) => {
      const poojaId = Number(poojaIdKey);
      const optionIdValue = daySelectionMap[poojaId];
      const optionId = optionIdValue ?? null;
      ensureChartDetailState(poojaId, optionId);
    });
  }, [daySelectionMap, ensureChartDetailState]);

  const resolveSelectedDayId = useCallback(
    (poojaId: number): number | null => {
      if (Object.prototype.hasOwnProperty.call(daySelectionMap, poojaId)) {
        return daySelectionMap[poojaId] ?? null;
      }
      const existing = cartItems.find((item) => item.poojaId === poojaId);
      return existing?.dayOptionId ?? null;
    },
    [daySelectionMap, cartItems],
  );

  useEffect(() => {
    if (cartItems.length === 0) {
      return;
    }
    setTamilStarSelectionMap((prev) => {
      const next = { ...prev };
      cartItems.forEach((item) => {
        if (item.selectedTamilStarId) {
          next[item.poojaId] = item.selectedTamilStarId;
        }
      });
      return next;
    });
  }, [cartItems]);

  useEffect(() => {
    masterRows.forEach((row) => {
      const dayOptionDisabled = isDayOptionDisabledPooja({
        name: row.pooja.name,
        displayName: row.displayName,
        uiLabel: row.uiLabel,
      });
      if (dayOptionDisabled) {
        return;
      }
      const selectedDayId = resolveSelectedDayId(row.pooja.id);
      if (!selectedDayId) {
        return;
      }
      const option = dayOptionMap.get(selectedDayId);
      if (!option) {
        return;
      }
      const code = (option.code || '').toUpperCase();
      const tamilStarId = code === 'CS' ? (tamilStarSelectionMap[row.pooja.id] ?? null) : undefined;
      fetchOccurrenceForRow(row.pooja.id, option, { tamilStarId });
    });
  }, [masterRows, dayOptionMap, fetchOccurrenceForRow, tamilStarSelectionMap, resolveSelectedDayId]);

  useEffect(() => {
    const saturdayOccurrences = computeUpcomingSaturdayOccurrences(todayIso);
    setDayOccurrenceMap((prev) => {
      let changed = false;
      const next = { ...prev };
      const navagrahaIds = new Set<number>();

      masterRows.forEach((row) => {
        const isNavagraha = isFourSaturdayNavagrahaPooja({
          name: row.pooja.name,
          displayName: row.displayName,
          uiLabel: row.uiLabel,
        });
        if (!isNavagraha) {
          return;
        }
        navagrahaIds.add(row.pooja.id);
        const primaryOccurrence = saturdayOccurrences[0]?.date ?? '';
        const nextState: DayOccurrenceState = {
          status: 'ready',
          key: FOUR_SATURDAY_OCCURRENCE_KEY,
          date: primaryOccurrence,
          label: saturdayOccurrences[0]?.label ?? 'Saturday',
          note: FOUR_SATURDAY_NAVAGRAHA_NOTE,
          occurrences: saturdayOccurrences,
        };
        const current = next[row.pooja.id];
        if (
          !current ||
          current.key !== FOUR_SATURDAY_OCCURRENCE_KEY ||
          current.status !== 'ready' ||
          current.date !== nextState.date ||
          current.label !== nextState.label ||
          current.note !== nextState.note ||
          !areOccurrencesEqual(current.occurrences, nextState.occurrences)
        ) {
          next[row.pooja.id] = nextState;
          changed = true;
        }
      });

      Object.keys(next).forEach((idKey) => {
        const id = Number(idKey);
        if (Number.isNaN(id) || navagrahaIds.has(id)) {
          return;
        }
        const state = next[id];
        if (state && state.key === FOUR_SATURDAY_OCCURRENCE_KEY) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [masterRows, todayIso]);

  const handleDaySelectionChange = (poojaId: number, value: string) => {
    const optionId = value ? Number(value) : null;
    const selectedOption = optionId ? dayOptionMap.get(optionId) : undefined;
    const normalizedCode = selectedOption?.code ? selectedOption.code.toUpperCase() : '';

    // Reset Tamil star selection when changing day option
    setSelectedTamilStar(null);
    setTamilStarSelectionMap((prev) => {
      const next = { ...prev };
      if (normalizedCode === 'CS') {
        next[poojaId] = next[poojaId] ?? null;
      } else if (poojaId in next) {
        delete next[poojaId];
      }
      return next;
    });

    setDaySelectionMap((prev) => ({
      ...prev,
      [poojaId]: optionId,
    }));
    ensureChartDetailState(poojaId, optionId);
    setTableMessage(null);

    fetchOccurrenceForRow(poojaId, selectedOption, {
      tamilStarId: normalizedCode === 'CS' ? null : undefined,
    });
  };

  const handleTamilStarSelection = (poojaId: number, value: string) => {
    setSelectedTamilStar(value);
    setTamilStarSelectionMap((prev) => ({
      ...prev,
      [poojaId]: value || null,
    }));

    const optionIdValue = daySelectionMap[poojaId] ?? null;
    const option = optionIdValue ? dayOptionMap.get(optionIdValue) : undefined;
    if (!option) {
      return;
    }

    fetchOccurrenceForRow(poojaId, option, { tamilStarId: value || null });
  };

  const applySelectionToggle = (current: string[], value: string): string[] => {
    const next = new Set(current);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return Array.from(next);
  };

  const toggleMemberSelection = (value: string) => {
    setSelectedMemberIds((prev) => applySelectionToggle(prev, value));
  };

  const toggleMemberSelectionForRow = (row: MasterRow, value: string) => {
    setTableMessage(null);
    const selectedDayId = resolveSelectedDayId(row.pooja.id);
    const dayOptionDisabled = isDayOptionDisabledPooja({
      name: row.pooja.name,
      displayName: row.displayName,
      uiLabel: row.uiLabel,
    });
    const effectiveDayId = dayOptionDisabled ? null : selectedDayId;
    const matchingItems = findCartItemsForRow(row, effectiveDayId);
    const matchingItem = matchingItems[0];
    const currentKeys = resolveSelectedMemberKeys(row.pooja.id, matchingItem, matchingItems);
    const normalized = applySelectionToggle(currentKeys ?? fallbackMemberSelection, value);

    setMemberSelectionMap((prev) => ({
      ...prev,
      [row.pooja.id]: normalized,
    }));
  };

  const convertFeaturedToBooking = (pooja: FeaturedPooja): BookingPooja => ({
    id: pooja.id,
    name: pooja.name,
    displayName: pooja.name,
    amount: pooja.amount,
    amountLabel: pooja.amount ? toCurrencyLabel(pooja.amount) : '--',
    image: pooja.image,
    image_url: pooja.image_url ?? null,
    source: 'featured',
    rateLabel: pooja.amount ? toCurrencyLabel(pooja.amount) : 'Temple suggested amount',
  });

  const getDefaultAmountForRow = (row: MasterRow): string | null => {
    return row.defaultAmount ?? row.amountValue ?? row.minAmount ?? row.maxAmount ?? parseAmountFromLabel(row.rateLabel);
  };

  const getRowAmount = (row: MasterRow): string | null => {
    const explicit = amountSelectionMap[row.pooja.id];
    if (explicit && explicit.trim()) {
      return explicit.trim();
    }
    return getDefaultAmountForRow(row);
  };

  const validateRowAmount = (row: MasterRow, amount: string | null): string | null => {
    if (!amount) {
      return 'Please enter an amount for this pooja.';
    }
    const numericValue = Number(amount);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return 'Enter a valid amount.';
    }
    if (row.minAmount && numericValue < Number(row.minAmount)) {
      return `Amount cannot be less than ₹ ${formatCurrency(row.minAmount)}`;
    }
    if (row.maxAmount && numericValue > Number(row.maxAmount)) {
      return `Amount cannot be more than ₹ ${formatCurrency(row.maxAmount)}`;
    }
    const hasVariableRange = row.minAmount && row.maxAmount && row.minAmount !== row.maxAmount;
    if (hasVariableRange) {
      const base = Number(row.minAmount ?? 0);
      const scaledDiff = Math.round((numericValue - base) * 100);
      const scaledStep = VARIABLE_AMOUNT_STEP * 100;
      if (scaledDiff % scaledStep !== 0) {
        return `Amount must increase in ₹ ${VARIABLE_AMOUNT_STEP} steps.`;
      }
    }
    return null;
  };

  const convertMasterToBooking = (row: MasterRow): BookingPooja => ({
    id: row.pooja.id,
    code: row.code,
    name: row.pooja.name,
    displayName: row.uiLabel,
    amount: getRowAmount(row),
    amountLabel: row.rateLabel,
    image: '',
    image_url: null,
    source: 'master',
    rateLabel: row.rateLabel,
    parentName: row.parentName ?? null,
  });

  const handleAmountChange = (poojaId: number, value: string) => {
    setAmountSelectionMap((prev) => {
      const next = { ...prev };
      if (!value.trim()) {
        delete next[poojaId];
      } else {
        next[poojaId] = value;
      }
      return next;
    });
    setTableMessage(null);
  };

  const findCartItemsForRow = (row: MasterRow, dayId?: number | null): CartItem[] => {
    const dayOptionDisabled = isDayOptionDisabledPooja({
      name: row.pooja.name,
      displayName: row.displayName,
      uiLabel: row.uiLabel,
    });
    const baseDayId = dayId !== undefined ? dayId : resolveSelectedDayId(row.pooja.id);
    const effectiveDayId = dayOptionDisabled ? null : baseDayId;
    return cartItems.filter(
      (item) =>
        item.poojaId === row.pooja.id &&
        ((item.dayOptionId ?? null) === (effectiveDayId ?? null)),
    );
  };

  const findMatchingCartItem = (row: MasterRow, dayId?: number | null): CartItem | undefined => {
    const items = findCartItemsForRow(row, dayId);
    return items[0];
  };

  const resolveSelectedMemberKeys = (
    poojaId: number,
    matchingItem?: CartItem,
    matchingItems?: CartItem[],
  ): string[] | null => {
    const explicit = memberSelectionMap[poojaId];
    if (explicit !== undefined) {
      return Array.from(new Set(explicit));
    }

    const itemsToInspect =
      matchingItems && matchingItems.length > 0
        ? matchingItems
        : matchingItem
          ? [matchingItem]
          : [];
    const gatheredKeys: string[] = [];

    itemsToInspect.forEach((item) => {
      if (Array.isArray(item.members) && item.members.length > 0) {
        item.members.forEach((member) => {
          if (!member) return;
          if (member.selectionKey) {
            gatheredKeys.push(member.selectionKey);
            return;
          }
          if (member.id !== undefined && member.id !== null) {
            const mapped = memberIdLookup.get(member.id);
            if (mapped) {
              gatheredKeys.push(mapped);
            } else {
              gatheredKeys.push(String(member.id));
            }
            return;
          }
          gatheredKeys.push('self');
        });
      } else if (item.memberId !== undefined && item.memberId !== null) {
        const mapped = memberIdLookup.get(item.memberId);
        if (mapped) {
          gatheredKeys.push(mapped);
        } else {
          gatheredKeys.push(String(item.memberId));
        }
      } else if (item.fullName) {
        gatheredKeys.push('self');
      }
    });

    if (gatheredKeys.length > 0) {
      return Array.from(new Set(gatheredKeys));
    }

    if (matchingItem) {
      if (matchingItem.memberId !== undefined && matchingItem.memberId !== null) {
        const mapped = memberIdLookup.get(matchingItem.memberId);
        if (mapped) {
          return [mapped];
        }
        return [String(matchingItem.memberId)];
      }
      if (matchingItem.fullName) {
        return ['self'];
      }
    }

    return null;
  };

  const describeMemberKey = (memberKey: string, matchingItem?: CartItem): string => {
    const entry = memberLookup.get(memberKey) ?? (memberKey === 'self' ? memberLookup.get('self') : undefined);
    if (entry) {
      const relationshipLabel =
        entry.relationship ??
        (entry.source === 'self'
          ? 'Self'
          : entry.source === 'donor'
            ? 'Donor'
            : undefined);
      const relationshipText = relationshipLabel ? ` - ${relationshipLabel}` : '';
      const donorSuffix =
        entry.source === 'donor_member' && entry.donorName
          ? ` — ${entry.donorName}`
          : '';
      return `${entry.name}${relationshipText}${donorSuffix}`;
    }

    if (matchingItem?.members) {
      const fallback = matchingItem.members.find((member) => {
        if (member.selectionKey === memberKey) {
          return true;
        }
        if (member.id !== null && member.id !== undefined) {
          const mappedKey = memberIdLookup.get(member.id);
          return mappedKey === memberKey;
        }
        return false;
      });
      if (fallback) {
        const relationship = fallback.relationship ? ` - ${fallback.relationship}` : '';
        return `${fallback.name ?? 'Member'}${relationship}`;
      }
    }

    if (memberKey === 'self') {
      const fallbackName =
        matchingItem?.members?.find((entry) => entry.selectionKey === 'self')?.name || matchingItem?.fullName;
      const baseLabel = baseName || fallbackName || 'Self';
      return `${baseLabel} - Self`;
    }

    return 'Member';
  };

  const formatMemberLabel = (poojaId: number, memberKeys: string[], matchingItem?: CartItem): string => {
    const hasExplicit =
      (memberSelectionMap[poojaId]?.length ?? 0) > 0 ||
      (matchingItem?.members?.length ?? 0) > 0 ||
      Boolean(matchingItem && (matchingItem.memberId !== undefined || matchingItem.fullName));
    if (!hasExplicit) {
      return 'Select member';
    }
    const labels = memberKeys.map((key) => describeMemberKey(key, matchingItem)).filter(Boolean);
    if (labels.length === 0 && matchingItem?.fullName) {
      const relationship = matchingItem.memberRelationship ? ` (${matchingItem.memberRelationship})` : '';
      labels.push(`${matchingItem.fullName}${relationship}`);
    }
    return labels.length > 0 ? labels.join(', ') : 'Select member';
  };

  const openBookingModal = (
    pooja: BookingPooja,
    dayOptionId: number | null = null,
    mode: BookingMode = 'full',
    presetMemberIds?: string[],
  ) => {
    setFormError('');
    const explicit = memberSelectionMap[pooja.id];
    const defaultMembers = (presetMemberIds && presetMemberIds.length > 0
      ? presetMemberIds
      : explicit && explicit.length > 0
        ? explicit
        : []);
    setSelectedMemberIds(normalizeMemberSelection(defaultMembers));
    const disableDayOption = isDayOptionDisabledPooja({
      name: pooja.name,
      displayName: pooja.displayName,
      uiLabel: pooja.displayName,
    });
    const resolvedDayOptionId = disableDayOption ? null : dayOptionId ?? null;
    setSelectedPooja(pooja);
    setBookingMode(mode);
    setDateValue('');
    setSelectedTamilStar(disableDayOption ? null : tamilStarSelectionMap[pooja.id] ?? null);
    setSelectedDayOptionId(resolvedDayOptionId);
    ensureChartDetailState(pooja.id, resolvedDayOptionId);
  };

  const handleMasterRowAction = (row: MasterRow, mode: BookingMode) => {
    setTableMessage(null);
    const selectedDay = resolveSelectedDayId(row.pooja.id);
    const dayOptionDisabled = isDayOptionDisabledPooja({
      name: row.pooja.name,
      displayName: row.displayName,
      uiLabel: row.uiLabel,
    });
    const effectiveDay = dayOptionDisabled ? null : selectedDay;
    const matchingItems = findCartItemsForRow(row, effectiveDay);
    const matchingItem = matchingItems[0];
    const presetMembers = resolveSelectedMemberKeys(row.pooja.id, matchingItem, matchingItems) ?? [];
    const currentPrasadam = resolvePostPrasadam(row.pooja.id, matchingItem);
    setPrasadamSelectionMap((prev) => ({
      ...prev,
      [row.pooja.id]: currentPrasadam,
    }));
    openBookingModal(convertMasterToBooking(row), effectiveDay ?? null, mode, presetMembers);
  };

  const toggleCartItem = (row: MasterRow) => {
    const selectedDayId = resolveSelectedDayId(row.pooja.id);
    const dayOptionDisabled = isDayOptionDisabledPooja({
      name: row.pooja.name,
      displayName: row.displayName,
      uiLabel: row.uiLabel,
    });
    const availableDayOptions = filterDayOptionsForNames({
      name: row.pooja.name,
      displayName: row.displayName,
      uiLabel: row.uiLabel,
    });
    const effectiveDayId = dayOptionDisabled ? null : selectedDayId;
    const matchingItems = findCartItemsForRow(row, effectiveDayId);
    const matchingItem = matchingItems[0];
    const isFirstDayPooja = isFirstDayEnglishMonthPooja({
      name: row.pooja.name,
      displayName: row.displayName,
      uiLabel: row.uiLabel,
    });
    const defaultFirstDayDate =
      dayOptionDisabled && isFirstDayPooja && nextFirstDayOccurrence ? nextFirstDayOccurrence.date : null;

    if (matchingItems.length > 0) {
      matchingItems.forEach((item) => removeFromCart(cartKey, item.cartId));
      setTableMessage({ status: 'info', text: `${row.uiLabel} removed from cart.` });
      return;
    }

    if (!dayOptionDisabled && availableDayOptions.length > 0 && !selectedDayId) {
      showWarningPopup('Please select a day option before adding this pooja.');
      return;
    }

    const chosenDayOption = !dayOptionDisabled && selectedDayId ? dayOptionMap.get(selectedDayId) : undefined;
    const requiresChartDetails = !dayOptionDisabled && isChartDayOption(chosenDayOption);
    const selectedStarForRow = tamilStarSelectionMap[row.pooja.id] ?? selectedTamilStar;
    const selectedTamilStarOption =
      selectedStarForRow && chosenDayOption?.code === 'CS'
        ? dayOptionMap.get(Number(selectedStarForRow))
        : undefined;
    const postPrasadam = resolvePostPrasadam(row.pooja.id, matchingItem);
    const recurrenceSelection = resolveRecurrenceSelection(row.pooja.id);
    if (recurrenceSelection?.kind === 'one_time_extra' && !recurrenceSelection.oneTimeDate) {
      showWarningPopup('Please pick an English month date for the one-time extra before adding it to the cart.');
      return;
    }

    let resolvedBookingDate = '';
    if (!requiresChartDetails) {
      const occurrenceState = dayOccurrenceMap[row.pooja.id];
      if (defaultFirstDayDate) {
        resolvedBookingDate = defaultFirstDayDate;
      } else if (occurrenceState?.status === 'ready' && occurrenceState.date) {
        resolvedBookingDate = occurrenceState.date;
      } else {
        const fallbackMessage = dayOptionDisabled
          ? 'Next occurrence could not be determined for this pooja. Please contact the temple for assistance.'
          : occurrenceState?.status === 'loading'
            ? 'Fetching the next occurrence. Please try again in a moment.'
            : (getOccurrenceMessage(occurrenceState) ??
              'Select a day option and wait for the next occurrence before adding this pooja to the cart.');
        showWarningPopup(fallbackMessage);
        return;
      }

      if (!resolvedBookingDate) {
        showWarningPopup('Choose or confirm a pooja date before adding this item to the cart.');
        return;
      }
    }

    const amountForCart = getRowAmount(row);
    const amountValidationMessage = validateRowAmount(row, amountForCart);
    if (amountValidationMessage) {
      showWarningPopup(amountValidationMessage);
      return;
    }
    const mapSelection = memberSelectionMap[row.pooja.id];
    const selectedMemberKeysRaw =
      mapSelection && mapSelection.length > 0 ? mapSelection : selectedMemberIds;
    const selectedMemberKeys = Array.from(new Set(selectedMemberKeysRaw));
    if (selectedMemberKeys.length === 0) {
      showWarningPopup('Please select at least one devotee before adding this pooja.');
      return;
    }

    const membersPayload = selectedMemberKeys.map((memberKey, index) => {
      const fallbackName =
        matchingItem?.members?.[index]?.name ??
        (memberKey === 'self' ? baseName || matchingItem?.fullName || 'Self' : undefined);
      return { key: memberKey, payload: buildMemberPayloadFromKey(memberKey, fallbackName) };
    });

    const primarySelectionKey = selectedMemberKeys[0] ?? 'self';
    const primaryPayload =
      membersPayload[0]?.payload ??
      buildMemberPayloadFromKey(primarySelectionKey, baseName || matchingItem?.fullName || 'Self');
    const primaryDirectoryEntry =
      memberLookup.get(primaryPayload.selectionKey ?? primarySelectionKey) ??
      memberLookup.get(primarySelectionKey) ??
      null;

    if (requiresChartDetails) {
      const groups = chartPreferredDateGroupsMap[row.pooja.id] ?? [];
      if (groups.length === 0) {
        showWarningPopup('Please specify at least one preferred date.');
        return;
      }

      const selectedPayloadLookup = new Map(membersPayload.map((entry) => [entry.key, entry.payload]));
      const assignedMembers = new Set<string>();
      for (const group of groups) {
        if (!group.date) {
          showWarningPopup('Choose a preferred date for each entry.');
          return;
        }
        if (!group.note.trim()) {
          showWarningPopup('Add donor instructions for each preferred date.');
          return;
        }
        if (group.memberKeys.length === 0) {
          showWarningPopup('Assign at least one devotee to each preferred date.');
          return;
        }
        group.memberKeys.forEach((key) => assignedMembers.add(key));
      }

      const unassignedMembers = selectedMemberKeys.filter((key) => !assignedMembers.has(key));
      if (unassignedMembers.length > 0) {
        showWarningPopup('Please assign every selected devotee to a preferred date.');
        return;
      }

      const buildRecurrenceForDetails = (detailsDate: string | undefined) =>
        buildRecurrenceFields(recurrenceSelection, detailsDate);

      groups.forEach((group) => {
        const groupMemberKeys = Array.from(new Set(group.memberKeys));
        const membersPayloadForGroup = groupMemberKeys.map((key, index) => ({
          key,
          payload:
            selectedPayloadLookup.get(key) ?? buildMemberPayloadFromKey(key, index === 0 ? baseName : undefined),
        }));
        const primaryPayload =
          membersPayloadForGroup[0]?.payload ??
          buildMemberPayloadFromKey(groupMemberKeys[0] ?? 'self', baseName);

        const item = createCartItem({
          poojaId: row.pooja.id,
          poojaName: row.pooja.name,
          poojaCode: row.code,
          poojaImage: '',
          poojaImageUrl: null,
          amount: amountForCart,
          bookingDate: group.date,
          fullName: primaryPayload?.name ?? baseName,
          email: baseEmail,
          phoneNumber: basePhone,
          address: baseAddress,
          dayOptionId: chosenDayOption?.id ?? null,
          dayOptionCode: chosenDayOption?.code ?? null,
          dayOptionDescription: chosenDayOption?.description ?? null,
          dayOptionCategory: chosenDayOption?.category ?? null,
          selectedTamilStarId: chosenDayOption?.code === 'CS' ? selectedStarForRow ?? null : null,
          selectedTamilStarLabel:
            chosenDayOption?.code === 'CS' && selectedTamilStarOption
              ? formatDayOptionLabel(selectedTamilStarOption)
              : null,
          customDayDate: group.date ?? null,
          customDayNote: group.note.trim() ?? null,
          postPrasadam,
          memberId: primaryPayload?.id ?? null,
          memberRelationship: primaryPayload?.relationship ?? undefined,
          memberGender: primaryPayload?.gender,
          memberTamilStar: primaryPayload?.tamilStar,
          memberRasi: primaryPayload?.rasi,
          memberGothra: primaryPayload?.gothra,
          memberDob: primaryPayload?.dob ?? null,
          memberFamilyName: primaryPayload?.familyName ?? null,
          targetDonorId: primaryPayload?.donorId ?? baseUserId ?? null,
          members: membersPayloadForGroup.map((entry) => entry.payload),
          ...buildRecurrenceForDetails(group.date),
        });
        addToCart(cartKey, item);
      });

      setMemberSelectionMap((prev) => ({
        ...prev,
        [row.pooja.id]: selectedMemberKeys,
      }));

      setPrasadamSelectionMap((prev) => ({
        ...prev,
        [row.pooja.id]: postPrasadam,
      }));

      clearChartDetailsForPooja(row.pooja.id);
      showTemporaryTableMessage(`${row.uiLabel} added to cart.`);
      return;
    }

    const recurrenceFields = buildRecurrenceFields(recurrenceSelection, resolvedBookingDate);

    const item = createCartItem({
      poojaId: row.pooja.id,
      poojaName: row.pooja.name,
      poojaCode: row.code,
      poojaImage: '',
      poojaImageUrl: null,
      amount: amountForCart,
      bookingDate: resolvedBookingDate,
      fullName: primaryPayload?.name ?? baseName,
      email: baseEmail,
      phoneNumber: basePhone,
      address: baseAddress,
      dayOptionId: chosenDayOption?.id ?? null,
      dayOptionCode: chosenDayOption?.code ?? null,
      dayOptionDescription: chosenDayOption?.description ?? null,
      dayOptionCategory: chosenDayOption?.category ?? null,
      selectedTamilStarId: chosenDayOption?.code === 'CS' ? selectedStarForRow ?? null : null,
      selectedTamilStarLabel:
        chosenDayOption?.code === 'CS' && selectedTamilStarOption
          ? formatDayOptionLabel(selectedTamilStarOption)
          : null,
      customDayDate: null,
      customDayNote: null,
      postPrasadam,
      memberId: primaryDirectoryEntry?.id ?? null,
      memberRelationship: primaryPayload.relationship ?? undefined,
      memberGender: primaryPayload.gender,
      memberTamilStar: primaryPayload.tamilStar,
      memberRasi: primaryPayload.rasi,
      memberGothra: primaryPayload.gothra,
      memberDob: primaryPayload.dob ?? null,
      memberFamilyName: primaryPayload.familyName ?? null,
      targetDonorId:
        primaryPayload.donorId ??
        primaryDirectoryEntry?.donorId ??
        baseUserId ??
        null,
      members: membersPayload.map((entry) => entry.payload),
      ...recurrenceFields,
    });

    setMemberSelectionMap((prev) => ({
      ...prev,
      [row.pooja.id]: selectedMemberKeys,
    }));

    setPrasadamSelectionMap((prev) => ({
      ...prev,
      [row.pooja.id]: postPrasadam,
    }));

    addToCart(cartKey, item);
    showTemporaryTableMessage(`${row.uiLabel} added to cart.`);
  };

  const handleCloseModal = () => {
    if (selectedPooja) {
      clearChartDetailsForPooja(selectedPooja.id);
    }
    setSelectedPooja(null);
    setDateValue('');
    setFormError('');
    setSelectedDayOptionId(null);
    setBookingMode('full');
    setSelectedMemberIds(fallbackMemberSelection);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTableMessage(null);
    if (!selectedPooja) return;

    const normalizedSelectedMembers = Array.from(new Set(selectedMemberIds));
    if (normalizedSelectedMembers.length === 0) {
      setFormError('Please select at least one devotee to proceed.');
      return;
    }

    if (bookingMode === 'memberOnly') {
      setMemberSelectionMap((prev) => ({
        ...prev,
        [selectedPooja.id]: normalizedSelectedMembers,
      }));
      handleCloseModal();
      return;
    }

    if (!dateValue) {
      setFormError('Please choose a booking date to proceed.');
      return;
    }

    if (
      selectedPooja.source === 'master' &&
      selectedPoojaDayOptions.length > 0 &&
      !selectedPoojaDayOptionDisabled &&
      !selectedDayOptionId
    ) {
      setFormError('Please choose a day option to proceed.');
      return;
    }

    const chosenDayOption =
      !selectedPoojaDayOptionDisabled && selectedDayOptionId ? dayOptionMap.get(selectedDayOptionId) : undefined;
    const requiresChartDetails = isChartDayOption(chosenDayOption);
    const postPrasadam = prasadamSelectionMap[selectedPooja.id] ?? false;

    const memberKeys = normalizedSelectedMembers;
    const membersPayload = memberKeys.map((key, index) => ({
      key,
      payload: buildMemberPayloadFromKey(key, index === 0 ? resolvedName : undefined),
    }));

    const selectedStarForSelected =
      selectedPooja ? tamilStarSelectionMap[selectedPooja.id] ?? selectedTamilStar : selectedTamilStar;
    const selectedTamilStarOption =
      selectedStarForSelected && chosenDayOption?.code === 'CS'
        ? dayOptionMap.get(Number(selectedStarForSelected))
        : undefined;

    const primaryEntry =
      membersPayload[0]?.payload ?? buildMemberPayloadFromKey(memberKeys[0] ?? 'self', resolvedName);
    const selectedRecurrenceSelection = selectedPooja ? resolveRecurrenceSelection(selectedPooja.id) : undefined;

    if (requiresChartDetails) {
      const groups = chartPreferredDateGroupsMap[selectedPooja.id] ?? [];
      if (groups.length === 0) {
        setFormError('Please specify at least one preferred date.');
        return;
      }

      const assignedMembers = new Set<string>();
      for (const group of groups) {
        if (!group.date) {
          setFormError('Please choose a date for each preferred entry.');
          return;
        }
        if (!group.note.trim()) {
          setFormError('Please add donor instructions for each preferred date.');
          return;
        }
        if (group.memberKeys.length === 0) {
          setFormError('Assign at least one devotee to each preferred date.');
          return;
        }
        group.memberKeys.forEach((key) => assignedMembers.add(key));
      }

      const unassignedMembers = normalizedSelectedMembers.filter((key) => !assignedMembers.has(key));
      if (unassignedMembers.length > 0) {
        setFormError('Please assign every selected devotee to a preferred date.');
        return;
      }

      const buildRecurrenceForDetails = (detailsDate: string | undefined) =>
        buildRecurrenceFields(selectedRecurrenceSelection, detailsDate);

      groups.forEach((group) => {
        const groupMemberKeys = Array.from(new Set(group.memberKeys));
        const membersPayloadForGroup = groupMemberKeys.map((key, index) => ({
          key,
          payload: buildMemberPayloadFromKey(key, index === 0 ? resolvedName : undefined),
        }));
        const primaryPayload =
          membersPayloadForGroup[0]?.payload ??
          buildMemberPayloadFromKey(groupMemberKeys[0] ?? 'self', resolvedName);

        const item = createCartItem({
          poojaId: selectedPooja.id,
          poojaName: selectedPooja.name,
          poojaCode: selectedPooja.code ?? null,
          poojaImage: selectedPooja.image ?? '',
          poojaImageUrl: selectedPooja.image_url,
          amount: selectedPooja.amount,
          bookingDate: group.date,
          fullName: primaryPayload?.name ?? resolvedName,
          email: resolvedEmail,
          phoneNumber: contactDetails.phoneNumber,
          address: contactDetails.address,
          dayOptionId: chosenDayOption?.id ?? null,
          dayOptionCode: chosenDayOption?.code ?? null,
          dayOptionDescription: chosenDayOption?.description ?? null,
          dayOptionCategory: chosenDayOption?.category ?? null,
          selectedTamilStarId: chosenDayOption?.code === 'CS' ? selectedStarForSelected ?? null : null,
          selectedTamilStarLabel:
            chosenDayOption?.code === 'CS' && selectedTamilStarOption
              ? formatDayOptionLabel(selectedTamilStarOption)
              : null,
          customDayDate: group.date ?? null,
          customDayNote: group.note.trim() ?? null,
          postPrasadam,
          memberId: primaryPayload?.id ?? null,
          memberRelationship: primaryPayload?.relationship ?? undefined,
          memberGender: primaryPayload?.gender,
          memberTamilStar: primaryPayload?.tamilStar,
          memberRasi: primaryPayload?.rasi,
          memberGothra: primaryPayload?.gothra,
          memberDob: primaryPayload?.dob ?? null,
          memberFamilyName: primaryPayload?.familyName ?? null,
          targetDonorId: primaryPayload?.donorId ?? baseUserId ?? null,
          members: membersPayloadForGroup.map((entry) => entry.payload),
          ...buildRecurrenceForDetails(group.date),
        });
        addToCart(cartKey, item);
      });

      setMemberSelectionMap((prev) => ({
        ...prev,
        [selectedPooja.id]: memberKeys,
      }));

      setPrasadamSelectionMap((prev) => ({
        ...prev,
        [selectedPooja.id]: postPrasadam,
      }));

      handleCloseModal();
      return;
    }

    const recurrenceFields = buildRecurrenceFields(selectedRecurrenceSelection, dateValue);
    const item = createCartItem({
      poojaId: selectedPooja.id,
      poojaName: selectedPooja.name,
      poojaCode: selectedPooja.code ?? null,
      poojaImage: selectedPooja.image ?? '',
      poojaImageUrl: selectedPooja.image_url,
      amount: selectedPooja.amount,
      bookingDate: dateValue,
      fullName: primaryEntry?.name ?? resolvedName,
      email: resolvedEmail,
      phoneNumber: contactDetails.phoneNumber,
      address: contactDetails.address,
      dayOptionId: chosenDayOption?.id ?? null,
      dayOptionCode: chosenDayOption?.code ?? null,
      dayOptionDescription: chosenDayOption?.description ?? null,
      dayOptionCategory: chosenDayOption?.category ?? null,
      selectedTamilStarId: chosenDayOption?.code === 'CS' ? selectedStarForSelected ?? null : null,
      selectedTamilStarLabel:
        chosenDayOption?.code === 'CS' && selectedTamilStarOption
          ? formatDayOptionLabel(selectedTamilStarOption)
          : null,
      customDayDate: null,
      customDayNote: null,
      postPrasadam,
      memberId: primaryEntry?.id ?? null,
      memberRelationship: primaryEntry?.relationship ?? undefined,
      memberGender: primaryEntry?.gender,
      memberTamilStar: primaryEntry?.tamilStar,
      memberRasi: primaryEntry?.rasi,
      memberGothra: primaryEntry?.gothra,
      memberDob: primaryEntry?.dob ?? null,
      targetDonorId: primaryEntry?.donorId ?? baseUserId ?? null,
      members: membersPayload.map((entry) => entry.payload),
      ...recurrenceFields,
    });

    setMemberSelectionMap((prev) => ({
      ...prev,
      [selectedPooja.id]: memberKeys,
    }));

    setPrasadamSelectionMap((prev) => ({
      ...prev,
      [selectedPooja.id]: postPrasadam,
    }));

    addToCart(cartKey, item);
    handleCloseModal();
  };

  const selectedDayOption = selectedDayOptionId ? dayOptionMap.get(selectedDayOptionId) : undefined;

  const selectedPoojaDayOptionDisabled = selectedPooja
    ? isDayOptionDisabledPooja({
        name: selectedPooja.name,
        displayName: selectedPooja.displayName,
        uiLabel: selectedPooja.displayName ?? selectedPooja.name,
      })
    : false;

  const selectedPoojaDayOptions = selectedPooja
    ? filterDayOptionsForNames({
        name: selectedPooja.name,
        displayName: selectedPooja.displayName,
        uiLabel: selectedPooja.displayName ?? selectedPooja.name,
      })
    : dayOptionChoices;

  const modalRequiresChartDetails =
    Boolean(
      selectedPooja &&
        !selectedPoojaDayOptionDisabled &&
        selectedDayOption &&
        isChartDayOption(selectedDayOption),
    );

  useEffect(() => {
    if (!modalRequiresChartDetails || !selectedPooja) {
      return;
    }
    ensurePreferredDateGroups(selectedPooja.id, 1);
  }, [modalRequiresChartDetails, selectedPooja, ensurePreferredDateGroups]);

  const renderPreferredDateGroupsEditor = (poojaId: number, availableOptions: SSOption[]) => {
    const groups = chartPreferredDateGroupsMap[poojaId] ?? [];
    const handleCountChange = (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      const nextCount = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
      ensurePreferredDateGroups(poojaId, nextCount);
    };

    return (
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Number of preferred dates</label>
          <input
            type="number"
            min={1}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
            value={groups.length || 1}
            onChange={handleCountChange}
          />
        </div>
        {groups.length === 0 && (
          <p className="text-xs text-gray-500">
            Enter how many preferred dates you need to begin assigning devotees.
          </p>
        )}
        {groups.map((group, index) => (
          <div key={group.key} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold text-gray-600">
              Preferred date {index + 1}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">Preferred Date</label>
                <input
                  type="date"
                  min={todayIso}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  value={group.date}
                  onChange={(event) =>
                    updatePreferredDateGroupField(poojaId, group.key, 'date', event.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Devotees</label>
                {(() => {
                  const selectedNames = group.memberKeys
                    .map((key) => availableOptions.find((option) => option.value === key)?.label)
                    .filter(Boolean);
                  const label =
                    selectedNames.length > 0 ? selectedNames.join(', ') : 'Select devotees';
                  return (
                    <MemberMultiSelect
                      label={label}
                      options={availableOptions}
                      selectedValues={group.memberKeys}
                      onToggleValue={(value) => togglePreferredDateGroupMember(poojaId, group.key, value)}
                      disabled={availableOptions.length === 0}
                    />
                  );
                })()}
                {availableOptions.length === 0 && (
                  <p className="mt-1 text-[0.65rem] text-gray-500">
                    Select devotees from above to assign them to this date.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Donor Instructions</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                value={group.note}
                onChange={(event) =>
                  updatePreferredDateGroupField(poojaId, group.key, 'note', event.target.value)
                }
                placeholder="Add donor instructions"
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-white py-4 sm:py-6 md:py-8 px-3 sm:px-4 lg:px-6 xl:px-8">
      {warningPopup && (
        <div className="fixed bottom-6 right-6 z-50 flex pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm xl:max-w-md">
            <div
              role="alert"
              className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.9)] transition duration-200 hover:shadow-[0_25px_40px_-10px_rgba(15,23,42,0.8)]"
            >
              <span className="flex items-center justify-center rounded-full bg-white/20 p-2 text-base">
                ⚠️
              </span>
              <p className="flex-1 leading-snug">{warningPopup}</p>
              <button
                type="button"
                onClick={hideWarningPopup}
                className="text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Close warning"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="responsive-layout">
        <div className="mb-6 sm:mb-8 md:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Pooja Registration</h1>
          <p className="text-base sm:text-lg text-gray-700">
            Browse our complete pooja catalogue and select your preferred options to book a pooja ceremony
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6 sm:mb-8 border border-gray-200">
          <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Available Poojas</h2>
                <p className="text-sm sm:text-base text-gray-700 mt-1">
                  Select a pooja, choose your preferred day option, and add to cart
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <p className="text-orange-900 font-medium">
                  நாள் விருப்பம் - உங்கள் நட்சத்திரங்களின் அடிப்படையில், உங்கள் சொந்த தேதியை நீங்கள் தேர்வு செய்யலாம்.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="font-medium text-slate-700">
                  Added {cartTotals.count} {cartTotals.count === 1 ? 'pooja' : 'poojas'}
                </span>
                <div className="flex flex-col text-sm text-slate-600">
                  <span className="font-medium text-slate-700">
                    Amount ₹ {formattedCartAmount}
                  </span>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Recurring ₹ {formattedRecurringAmount}</span>
                    <span>One-time ₹ {formattedOneTimeAmount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleViewCart}
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 transition hover:bg-sky-100"
                >
                  View cart & Payment
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {isLoading && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {!isLoading && !error && masterRows.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 sm:p-8 text-center">
                <p className="text-gray-700">No pooja options available at the moment.</p>
              </div>
            )}

            {!isLoading && !error && masterRows.length > 0 && (
              <>
                {tableMessage && (
                  <div
                    className={`mb-4 rounded-lg p-3 text-sm font-medium ${
                      tableMessage.status === 'error'
                        ? 'border border-red-200 bg-red-50 text-red-700'
                        : 'border border-orange-200 bg-orange-50 text-orange-700'
                    }`}
                  >
                    {tableMessage.text}
                  </div>
                )}
                {/* Desktop Table View */}
                <div className="hidden lg:block rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 bg-white">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[8%] sticky top-0 bg-gray-50 z-20"
                        >
                          Code
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[15%] sticky top-0 bg-gray-50 z-20"
                        >
                          Pooja Name
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[20%] sticky top-0 bg-gray-50 z-20"
                        >
                          Day Option
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[12%] sticky top-0 bg-gray-50 z-20"
                        >
                          Devotees
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[12%] sticky top-0 bg-gray-50 z-20"
                        >
                          Next Occurrence
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[8%] sticky top-0 bg-gray-50 z-20"
                        >
                          Amount
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[7%] sticky top-0 bg-gray-50 z-20"
                        >
                          Prasadam
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-[7%] sticky top-0 bg-gray-50 z-20"
                        >
                          Add to Cart
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[8%] sticky top-0 bg-gray-50 z-20"
                        >
                          Registered By
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[8%] sticky top-0 bg-gray-50 z-20"
                        >
                          Registration Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {masterRows.map((row) => {
                        const selectedDayId = resolveSelectedDayId(row.pooja.id);
                        const dayOptionDisabled = isDayOptionDisabledPooja({
                          name: row.pooja.name,
                          displayName: row.displayName,
                          uiLabel: row.uiLabel,
                        });
                        const availableDayOptions = filterDayOptionsForNames({
                          name: row.pooja.name,
                          displayName: row.displayName,
                          uiLabel: row.uiLabel,
                        });
                        const effectiveDayId = dayOptionDisabled ? null : selectedDayId;
                        const matchingItems = findCartItemsForRow(row, effectiveDayId);
                        const matchingItem = matchingItems[0];
                        const inCart = matchingItems.length > 0;
                        const selectedDayOption = effectiveDayId ? dayOptionMap.get(effectiveDayId) : undefined;
                        const requiresChartDetails = isChartDayOption(selectedDayOption);
                        const hideDevoteesForRow =
                          !dayOptionDisabled && selectedDayOption ? isChartDayOption(selectedDayOption) : false;
                        const occurrenceState = dayOccurrenceMap[row.pooja.id];
                        const iconLabel = inCart
                          ? `Remove ${row.uiLabel} from cart`
                          : `Add ${row.uiLabel} to cart`;
                        const iconClasses = inCart
                          ? 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300'
                          : 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-white shadow hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300';
                          const resolvedMemberKeys = resolveSelectedMemberKeys(row.pooja.id, matchingItem, matchingItems);
                          const memberKeysForDisplay = resolvedMemberKeys ?? fallbackMemberSelection;
                          const memberButtonLabel = formatMemberLabel(
                            row.pooja.id,
                            memberKeysForDisplay,
                            matchingItem,
                          );
                        const postPrasadamSelected = resolvePostPrasadam(row.pooja.id, matchingItem);
                        const hasAdjustableAmount =
                          Boolean(row.minAmount && row.maxAmount && row.minAmount !== row.maxAmount);
                        const amountInputValue =
                          amountSelectionMap[row.pooja.id] ??
                          row.defaultAmount ??
                          row.amountValue ??
                          row.minAmount ??
                          row.maxAmount ??
                          '';
                        const amountInputError =
                          hasAdjustableAmount && amountInputValue ? validateRowAmount(row, amountInputValue) : null;
                        const isFirstDayPooja = isFirstDayEnglishMonthPooja({
                          name: row.pooja.name,
                          displayName: row.displayName,
                          uiLabel: row.uiLabel,
                        });
                        const showDefaultFirstDay =
                          Boolean(isFirstDayPooja && !effectiveDayId && nextFirstDayOccurrence);
                        const recurrenceSelection = resolveRecurrenceSelection(row.pooja.id);
                        
                        return (
                        <tr
                          key={row.pooja.id}
                        className={clsx(
                          'transition-colors',
                          inCart
                            ? 'bg-emerald-200 text-emerald-900 hover:bg-emerald-300 ring-1 ring-emerald-400 shadow-inner'
                            : 'hover:bg-gray-50',
                        )}
                        >
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {row.code}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {row.uiLabel}
                            </td>
                            <td className="px-4 py-3 text-sm overflow-visible">
                              {availableDayOptions.length > 0 ? (
                                dayOptionDisabled ? (
                                  <span className="text-xs text-gray-500">Day option not required for this pooja</span>
                                ) : (
                                  <div className="space-y-3">
                                    <SearchableSelect
                                      options={availableDayOptions.map((option) => ({
                                        value: String(option.id),
                                        label: formatDayOptionLabel(option),
                                      }))}
                                      value={effectiveDayId !== null ? String(effectiveDayId) : ''}
                                      onChange={(val) => handleDaySelectionChange(row.pooja.id, val)}
                                      placeholder="Select day option"
                                      className="w-64"
                                    />
                                    {selectedDayOption?.code === 'CS' && (
                                      <div className="mt-2">
                                        <select
                                          value={tamilStarSelectionMap[row.pooja.id] ?? ''}
                                          onChange={(event) =>
                                            handleTamilStarSelection(row.pooja.id, event.target.value)
                                          }
                                          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring focus:ring-orange-200 bg-white shadow-sm"
                                          aria-label="Select your star"
                                        >
                                          <option value="">Select your star</option>
                                          {tamilStarOptions.map((option) => (
                                            <option key={option.id} value={String(option.id)}>
                                              {formatDayOptionLabel(option)}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                    {requiresChartDetails && (
                                      <div className="mt-3">
                                        {renderPreferredDateGroupsEditor(row.pooja.id, memberOptions)}
                                      </div>
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="text-xs text-gray-500">Not configured</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm overflow-visible">
                              {!hideDevoteesForRow && (
                                <MemberMultiSelect
                                  label={memberButtonLabel}
                                  options={memberOptions}
                                  selectedValues={memberKeysForDisplay}
                                  onToggleValue={(value) => toggleMemberSelectionForRow(row, value)}
                                  disabled={memberOptions.length === 0}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {showDefaultFirstDay ? (
                                <div className="space-y-1">
                                  <span className="font-medium text-gray-900">
                                    {nextFirstDayOccurrence?.label}
                                  </span>
                                  <span className="block text-xs text-gray-600">{FIRST_DAY_NOTE_MESSAGE}</span>
                                </div>
                              ) : (!dayOptionDisabled && effectiveDayId === null) ? (
                                <span className="text-xs text-gray-500">Select a day option</span>
                              ) : !occurrenceState ? (
                                <span className="text-xs text-gray-500">Select a day option</span>
                              ) : occurrenceState.status === 'loading' ? (
                                <span className="text-xs text-gray-600">Fetching date…</span>
                              ) : occurrenceState.status === 'ready' ? (
                                <div className="space-y-2">
                                  {(occurrenceState.occurrences && occurrenceState.occurrences.length > 0
                                    ? occurrenceState.occurrences
                                    : [{ date: occurrenceState.date, label: occurrenceState.label }]
                                  ).map((entry, index) => (
                                    <div
                                      key={`${entry.date}-${index}`}
                                      className={index === 0 ? '' : 'pt-2 border-t border-gray-100'}
                                    >
                                      <span className="font-medium text-gray-900">
                                        {formatDisplayDate(entry.date)}
                                      </span>
                                      {entry.label && (
                                        <span className="block text-xs text-gray-600">{entry.label}</span>
                                      )}
                                    </div>
                                  ))}
                                  {occurrenceState.note && renderOccurrenceNote(occurrenceState.note)}
                                </div>
                              ) : occurrenceState.status === 'manual' ||
                                occurrenceState.status === 'needsStar' ||
                                occurrenceState.status === 'error' ? (
                                <span className="text-xs text-gray-600">
                                  {occurrenceState.message}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">Select a day option</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              <div className="space-y-4">
                                <div>
                                  {hasAdjustableAmount ? (
                                    <div className="space-y-2">
                                      <p className="text-xs text-gray-500">Range: {row.rateLabel}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">₹</span>
                                        <input
                                          type="number"
                                          min={row.minAmount ?? undefined}
                                          max={row.maxAmount ?? undefined}
                                          step={VARIABLE_AMOUNT_STEP}
                                          className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
                                          value={amountInputValue}
                                          onChange={(event) => handleAmountChange(row.pooja.id, event.target.value)}
                                        />
                                      </div>
                                      {amountInputError && (
                                        <p className="text-xs text-red-600">{amountInputError}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <span>{row.rateLabel}</span>
                                  )}
                                </div>
                                <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs">
                                  <p className="text-gray-500 font-semibold uppercase tracking-wide">Schedule</p>
                                  <div className="flex flex-wrap items-center gap-4 text-gray-700">
                                    <label className="inline-flex items-center">
                                      <input
                                        type="radio"
                                        className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                        checked={recurrenceSelection?.kind === 'recurring'}
                                        onChange={() =>
                                          applyRecurrenceSelection(row.pooja.id, {
                                            kind: 'recurring',
                                            frequency:
                                              recurrenceSelection?.kind === 'recurring'
                                                ? recurrenceSelection.frequency
                                                : 'monthly',
                                          })
                                        }
                                      />
                                      <span className="ml-2">Recurring</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                      <input
                                        type="radio"
                                        className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                        checked={recurrenceSelection?.kind === 'one_time_extra'}
                                        onChange={() =>
                                          applyRecurrenceSelection(row.pooja.id, {
                                            kind: 'one_time_extra',
                                            oneTimeDate:
                                              recurrenceSelection?.kind === 'one_time_extra'
                                                ? recurrenceSelection.oneTimeDate
                                                : undefined,
                                          })
                                        }
                                      />
                                      <span className="ml-2">One-time extra</span>
                                    </label>
                                  </div>
                                  <p className="mt-1 text-[0.65rem] text-gray-500">Leave both options unchecked for a one-time booking.</p>
                                  {recurrenceSelection ? (
                                    <>
                                      {recurrenceSelection.kind === 'recurring' ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 text-gray-600">
                                            <span className="text-xs font-medium">Frequency:</span>
                                            <div className="flex items-center gap-1">
                                              <select
                                                value={recurrenceSelection.frequency}
                                                onChange={(event) =>
                                                  applyRecurrenceSelection(row.pooja.id, {
                                                    kind: 'recurring',
                                                    frequency: event.target.value as RecurrenceFrequency,
                                                  })
                                                }
                                                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm focus:border-orange-500 focus:outline-none"
                                              >
                                                <option value="monthly">Monthly</option>
                                                <option value="quarterly">Quarterly</option>
                                                <option value="annually">Annually</option>
                                              </select>
                                              <span
                                                className="text-[0.65rem] font-semibold text-slate-500"
                                                title={FREQUENCY_TOOLTIP[recurrenceSelection.frequency]}
                                                aria-label={FREQUENCY_TOOLTIP[recurrenceSelection.frequency]}
                                              >
                                                ℹ
                                              </span>
                                            </div>
                                          </div>
                                          <p className="text-[0.65rem] text-gray-500">
                                            {RECURRING_FREQUENCY_DESCRIPTIONS[recurrenceSelection.frequency]}
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <label className="block text-xs font-medium text-gray-600">
                                            English month date
                                          </label>
                                          <input
                                            type="date"
                                            min={todayIso}
                                            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
                                            value={recurrenceSelection.oneTimeDate ?? ''}
                                            onChange={(event) =>
                                              applyRecurrenceSelection(row.pooja.id, {
                                                kind: 'one_time_extra',
                                                oneTimeDate: event.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        className="mt-2 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100"
                                        onClick={() => applyRecurrenceSelection(row.pooja.id)}
                                      >
                                        Clear schedule
                                      </button>
                                    </>
                                  ) : (
                                    <p className="text-xs text-gray-500">Choose a schedule to proceed.</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm">
                              <div className="flex items-center justify-center space-x-4">
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                    checked={postPrasadamSelected === true}
                                    onChange={() => {
                                      setPrasadamSelectionMap((prev) => ({
                                        ...prev,
                                        [row.pooja.id]: true,
                                      }));
                                      setTableMessage(null);
                                    }}
                                  />
                                  <span className="ml-2 text-gray-700">Yes</span>
                                </label>
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                    checked={postPrasadamSelected === false}
                                    onChange={() => {
                                      setPrasadamSelectionMap((prev) => ({
                                        ...prev,
                                        [row.pooja.id]: false,
                                      }));
                                      setTableMessage(null);
                                    }}
                                  />
                                  <span className="ml-2 text-gray-700">No</span>
                                </label>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm">
                              <button
                                type="button"
                                onClick={() => toggleCartItem(row)}
                                className={iconClasses}
                                aria-label={iconLabel}
                              >
                                {inCart ? <CartRemoveIcon className="h-5 w-5" /> : <CartAddIcon className="h-5 w-5" />}
                              </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {user?.name?.trim() || user?.phone_number || '--'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {registrationDateLabel}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {masterRows.map((row) => {
                    const selectedDayId = resolveSelectedDayId(row.pooja.id);
                    const dayOptionDisabled = isDayOptionDisabledPooja({
                      name: row.pooja.name,
                      displayName: row.displayName,
                      uiLabel: row.uiLabel,
                    });
                    const availableDayOptions = filterDayOptionsForNames({
                      name: row.pooja.name,
                      displayName: row.displayName,
                      uiLabel: row.uiLabel,
                    });
                    const effectiveDayId = dayOptionDisabled ? null : selectedDayId;
                    const matchingItems = findCartItemsForRow(row, effectiveDayId);
                    const matchingItem = matchingItems[0];
                    const inCart = matchingItems.length > 0;
                    const selectedDayOption = effectiveDayId ? dayOptionMap.get(effectiveDayId) : undefined;
                    const requiresChartDetails = isChartDayOption(selectedDayOption);
                    const hideDevoteesForRow = !dayOptionDisabled && isChartDayOption(selectedDayOption);
                    const occurrenceState = dayOccurrenceMap[row.pooja.id];
                    const iconLabel = inCart
                      ? `Remove ${row.uiLabel} from cart`
                      : `Add ${row.uiLabel} to cart`;
                    const iconClasses = inCart
                      ? 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300'
                      : 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-white shadow hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300';
                    const resolvedMemberKeys = resolveSelectedMemberKeys(row.pooja.id, matchingItem, matchingItems);
                    const memberKeysForDisplay = resolvedMemberKeys ?? fallbackMemberSelection;
                    const memberButtonLabel = formatMemberLabel(
                      row.pooja.id,
                      memberKeysForDisplay,
                      matchingItem,
                    );
                    const postPrasadamSelected = resolvePostPrasadam(row.pooja.id, matchingItem);
                    const hasAdjustableAmount =
                      Boolean(row.minAmount && row.maxAmount && row.minAmount !== row.maxAmount);
                    const amountInputValue =
                      amountSelectionMap[row.pooja.id] ??
                      row.defaultAmount ??
                      row.amountValue ??
                      row.minAmount ??
                      row.maxAmount ??
                      '';
                    const amountInputError =
                      hasAdjustableAmount && amountInputValue ? validateRowAmount(row, amountInputValue) : null;
                    const isFirstDayPooja = isFirstDayEnglishMonthPooja({
                      name: row.pooja.name,
                      displayName: row.displayName,
                      uiLabel: row.uiLabel,
                    });
                    const showDefaultFirstDay =
                      Boolean(isFirstDayPooja && !effectiveDayId && nextFirstDayOccurrence);
                    const recurrenceSelection = resolveRecurrenceSelection(row.pooja.id);

                    return (
                      <div
                        key={row.pooja.id}
                        className={clsx(
                          'overflow-hidden rounded-lg',
                          inCart
                            ? 'bg-emerald-200 border border-emerald-400 shadow-xl text-emerald-900'
                            : 'bg-white border border-gray-200 shadow-sm',
                        )}
                      >
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-900">{row.uiLabel}</h3>
                              <p className="text-sm text-gray-600">Code: {row.code}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleCartItem(row)}
                              className={iconClasses}
                              aria-label={iconLabel}
                            >
                              {inCart ? <CartRemoveIcon className="h-5 w-5" /> : <CartAddIcon className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>
                        
                        <div className="p-4 space-y-4">
                          {/* Day Option Section */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Day Option
                            </label>
                            {availableDayOptions.length > 0 ? (
                              dayOptionDisabled ? (
                                <span className="text-xs text-gray-500">Day option not required for this pooja</span>
                              ) : (
                              <div className="space-y-3">
                                <SearchableSelect
                                  options={availableDayOptions.map((option) => ({
                                    value: String(option.id),
                                    label: formatDayOptionLabel(option),
                                  }))}
                                  value={effectiveDayId !== null ? String(effectiveDayId) : ''}
                                  onChange={(val) => handleDaySelectionChange(row.pooja.id, val)}
                                  placeholder="Select day option"
                                  className="w-full"
                                />
                                {selectedDayOption?.code === 'CS' && (
                                  <div className="mt-2">
                                    <select
                                      value={tamilStarSelectionMap[row.pooja.id] ?? ''}
                                      onChange={(event) =>
                                        handleTamilStarSelection(row.pooja.id, event.target.value)
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring focus:ring-orange-200 bg-white shadow-sm"
                                      aria-label="Select your star"
                                    >
                                      <option value="">Select your star</option>
                                      {tamilStarOptions.map((option) => (
                                        <option key={option.id} value={String(option.id)}>
                                          {formatDayOptionLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                  {requiresChartDetails && (
                    <div className="mt-3">
                      {renderPreferredDateGroupsEditor(row.pooja.id, memberOptions)}
                    </div>
                  )}
                              </div>
                            )
                            ) : (
                              <span className="text-xs text-gray-500">Not configured</span>
                            )}
                          </div>

                          {/* Devotees Section */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Devotees
                            </label>
                            <MemberMultiSelect
                              label={memberButtonLabel}
                              options={memberOptions}
                              selectedValues={memberKeysForDisplay}
                              onToggleValue={(value) => toggleMemberSelectionForRow(row, value)}
                              disabled={memberOptions.length === 0}
                            />
                          </div>

                          {/* Next Occurrence Section */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Next Occurrence
                            </label>
                            {showDefaultFirstDay ? (
                              <div className="space-y-1">
                                <span className="font-medium text-gray-900">
                                  {nextFirstDayOccurrence?.label}
                                </span>
                                <span className="block text-xs text-gray-600">{FIRST_DAY_NOTE_MESSAGE}</span>
                              </div>
                            ) : (!dayOptionDisabled && effectiveDayId === null) ? (
                              <span className="text-xs text-gray-500">Select a day option</span>
                            ) : !occurrenceState ? (
                              <span className="text-xs text-gray-500">Select a day option</span>
                            ) : occurrenceState.status === 'loading' ? (
                              <span className="text-xs text-gray-600">Fetching date…</span>
                            ) : occurrenceState.status === 'ready' ? (
                              <div className="space-y-2">
                                {(occurrenceState.occurrences && occurrenceState.occurrences.length > 0
                                  ? occurrenceState.occurrences
                                  : [{ date: occurrenceState.date, label: occurrenceState.label }]
                                ).map((entry, index) => (
                                  <div
                                    key={`${entry.date}-${index}`}
                                    className={index === 0 ? '' : 'pt-2 border-t border-gray-100'}
                                  >
                                    <span className="font-medium text-gray-900">
                                      {formatDisplayDate(entry.date)}
                                    </span>
                                    {entry.label && (
                                      <span className="block text-xs text-gray-600">{entry.label}</span>
                                    )}
                                  </div>
                                ))}
                                {occurrenceState.note && renderOccurrenceNote(occurrenceState.note)}
                              </div>
                            ) : occurrenceState.status === 'manual' ||
                              occurrenceState.status === 'needsStar' ||
                              occurrenceState.status === 'error' ? (
                              <span className="text-xs text-gray-600">
                                {occurrenceState.message}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">Select a day option</span>
                            )}
                          </div>

                          {/* Amount Section */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Amount
                            </label>
                            {hasAdjustableAmount ? (
                              <div className="space-y-2">
                                <p className="text-xs text-gray-500">Range: {row.rateLabel}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500">₹</span>
                                  <input
                                    type="number"
                                    min={row.minAmount ?? undefined}
                                    max={row.maxAmount ?? undefined}
                                    step={VARIABLE_AMOUNT_STEP}
                                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={amountInputValue}
                                    onChange={(event) => handleAmountChange(row.pooja.id, event.target.value)}
                                  />
                                </div>
                                {amountInputError && (
                                  <p className="text-xs text-red-600">{amountInputError}</p>
                                )}
                              </div>
                            ) : (
                              <span>{row.rateLabel}</span>
                            )}
                          </div>

                          {/* Recurrence Section */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Schedule
                            </label>
                            <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
                              <div className="flex flex-wrap items-center gap-4 text-gray-700">
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                    checked={recurrenceSelection?.kind === 'recurring'}
                                    onChange={() =>
                                      applyRecurrenceSelection(row.pooja.id, {
                                        kind: 'recurring',
                                        frequency:
                                          recurrenceSelection?.kind === 'recurring'
                                            ? recurrenceSelection.frequency
                                            : 'monthly',
                                      })
                                    }
                                  />
                                  <span className="ml-2">Recurring</span>
                                </label>
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                    checked={recurrenceSelection?.kind === 'one_time_extra'}
                                    onChange={() =>
                                      applyRecurrenceSelection(row.pooja.id, {
                                        kind: 'one_time_extra',
                                        oneTimeDate:
                                          recurrenceSelection?.kind === 'one_time_extra'
                                            ? recurrenceSelection.oneTimeDate
                                            : undefined,
                                      })
                                    }
                                  />
                                  <span className="ml-2">One-time extra</span>
                                </label>
                              </div>
                              <p className="mt-1 text-[0.65rem] text-gray-500">Leave both options unchecked for a one-time booking.</p>
                              {recurrenceSelection ? (
                                <>
                                  {recurrenceSelection.kind === 'recurring' ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-gray-600">
                                        <span className="text-xs font-medium">Frequency:</span>
                                        <div className="flex items-center gap-1">
                                          <select
                                            value={recurrenceSelection.frequency}
                                            onChange={(event) =>
                                              applyRecurrenceSelection(row.pooja.id, {
                                                kind: 'recurring',
                                                frequency: event.target.value as RecurrenceFrequency,
                                              })
                                            }
                                            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm focus:border-orange-500 focus:outline-none"
                                          >
                                            <option value="monthly">Monthly</option>
                                            <option value="quarterly">Quarterly</option>
                                            <option value="annually">Annually</option>
                                          </select>
                                          <span
                                            className="text-[0.65rem] font-semibold text-slate-500"
                                            title={FREQUENCY_TOOLTIP[recurrenceSelection.frequency]}
                                            aria-label={FREQUENCY_TOOLTIP[recurrenceSelection.frequency]}
                                          >
                                            ℹ
                                          </span>
                                        </div>
                                      </div>
                                      <p className="text-[0.65rem] text-gray-500">
                                        {RECURRING_FREQUENCY_DESCRIPTIONS[recurrenceSelection.frequency]}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <label className="block text-xs font-medium text-gray-600">English month date</label>
                                      <input
                                        type="date"
                                        min={todayIso}
                                        className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        value={recurrenceSelection.oneTimeDate ?? ''}
                                        onChange={(event) =>
                                          applyRecurrenceSelection(row.pooja.id, {
                                            kind: 'one_time_extra',
                                            oneTimeDate: event.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    className="mt-2 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100"
                                    onClick={() => applyRecurrenceSelection(row.pooja.id)}
                                  >
                                    Clear schedule
                                  </button>
                                </>
                              ) : (
                                <p className="text-xs text-gray-500">Choose a schedule to proceed.</p>
                              )}
                            </div>
                          </div>

                          {/* Prasadam Section */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Post Prasadam
                            </label>
                            <div className="flex space-x-6">
                              <label className="inline-flex items-center">
                                <input
                                  type="radio"
                                  className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                  checked={postPrasadamSelected === true}
                                  onChange={() => {
                                    setPrasadamSelectionMap((prev) => ({
                                      ...prev,
                                      [row.pooja.id]: true,
                                    }));
                                    setTableMessage(null);
                                  }}
                                />
                                <span className="ml-2 text-gray-700">Yes</span>
                              </label>
                              <label className="inline-flex items-center">
                                <input
                                  type="radio"
                                  className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                  checked={postPrasadamSelected === false}
                                  onChange={() => {
                                    setPrasadamSelectionMap((prev) => ({
                                      ...prev,
                                      [row.pooja.id]: false,
                                    }));
                                    setTableMessage(null);
                                  }}
                                />
                                <span className="ml-2 text-gray-700">No</span>
                              </label>
                            </div>
                          </div>

                          {/* Registration Info */}
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                            <div>
                              <p className="text-xs text-gray-500">Registered By</p>
                              <p className="text-sm text-gray-700 truncate">
                                {user?.name?.trim() || user?.phone_number || '--'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Registration Date</p>
                              <p className="text-sm text-gray-700">{registrationDateLabel}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {selectedPooja && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 max-w-md mx-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Book {selectedPooja.displayName ?? selectedPooja.name}
                  </h3>
                  {selectedPooja.code && (
                    <p className="text-sm text-gray-600 mt-1">Code: {selectedPooja.code}</p>
                  )}
                  {selectedPooja.amountLabel && (
                    <p className="text-gray-700 font-medium mt-1">Offering: {selectedPooja.amountLabel}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  aria-label="Close booking form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {memberOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Devotees
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {memberOptions.map((option) => {
                        const checked = selectedMemberIds.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                              checked
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-orange-600 focus:ring-orange-500 rounded flex-shrink-0"
                              checked={checked}
                              onChange={() => toggleMemberSelection(option.value)}
                            />
                            <span className="ml-3 text-sm text-gray-900">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedMemberEntries.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Devotees</h4>
                    <div className="space-y-3">
                      {selectedMemberEntries.map((member, index) => {
                        const roleLabel = index === 0 ? 'Primary' : 'Devotee';
                        const relationshipLabel = member.relationship ? ` (${member.relationship})` : '';
                        const donorSuffix =
                          member.source === 'donor_member' && member.donorName
                            ? ` — ${member.donorName}`
                            : member.source === 'donor' && member.donorName
                              ? ` — ${member.donorName}`
                              : '';
                        return (
                          <div key={member.key} className="text-sm">
                            <p className="font-medium text-gray-900">
                              {roleLabel}: {member.name}
                              {relationshipLabel}
                              {donorSuffix}
                            </p>
                            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-700">
                              {member.donorPhone && (
                                <p>Contact: {member.donorPhone}</p>
                              )}
                              {member.gender && <p>Gender: {member.gender}</p>}
                              {member.dob && (
                                <p>Birth: {formatDisplayDate(member.dob)}</p>
                              )}
                              {member.tamilStar && <p>Star: {member.tamilStar}</p>}
                              {member.gothra && <p>Gothra: {member.gothra}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bookingMode === 'full' && selectedPoojaDayOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day Option
                    </label>
                    {selectedPoojaDayOptionDisabled ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        Day option selection is not required for this pooja.
                      </div>
                    ) : (
                      <>
                        <SearchableSelect
                          options={selectedPoojaDayOptions.map((option) => ({
                            value: String(option.id),
                            label: formatDayOptionLabel(option),
                          }))}
                          value={selectedDayOptionId ? String(selectedDayOptionId) : ''}
                          onChange={(val) => {
                            const valueNum = val ? Number(val) : null;
                            if (selectedPooja) {
                              handleDaySelectionChange(selectedPooja.id, val);
                            }
                            setSelectedDayOptionId(valueNum);
                            setFormError('');
                          }}
                          placeholder="Select day option"
                          className="w-full"
                        />
                        {modalRequiresChartDetails && (
                          <div className="mt-3">
                            {renderPreferredDateGroupsEditor(selectedPooja.id, memberOptions)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {bookingMode === 'full' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Post Prasadam for this day
                    </label>
                    <div className="flex space-x-6">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                          checked={(prasadamSelectionMap[selectedPooja.id] ?? false) === true}
                          onChange={() =>
                            setPrasadamSelectionMap((prev) => ({
                              ...prev,
                              [selectedPooja.id]: true,
                            }))
                          }
                        />
                        <span className="ml-2 text-gray-900">Yes</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                          checked={(prasadamSelectionMap[selectedPooja.id] ?? false) === false}
                          onChange={() =>
                            setPrasadamSelectionMap((prev) => ({
                              ...prev,
                              [selectedPooja.id]: false,
                            }))
                          }
                        />
                        <span className="ml-2 text-gray-900">No</span>
                      </label>
                    </div>
                  </div>
                )}

                {bookingMode === 'full' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mobile Number
                      </label>
                      <input
                        name="phoneNumber"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                        value={contactDetails.phoneNumber}
                        onChange={(event) => setContactDetails((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                        placeholder="91XXXXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address
                      </label>
                      <textarea
                        name="address"
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                        value={contactDetails.address}
                        onChange={(event) => setContactDetails((prev) => ({ ...prev, address: event.target.value }))}
                        placeholder="Address for correspondence"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Booking Date
                      </label>
                      <input
                        name="bookingDate"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                        value={dateValue}
                        onChange={(event) => setDateValue(event.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                {formError && bookingMode === 'full' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                >
                  {bookingMode === 'memberOnly'
                    ? 'Save selection'
                    : selectedPooja.amount
                      ? `Pay ₹${formatCurrency(selectedPooja.amount)}`
                      : 'Add to cart'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoojaRegistrationPage;
