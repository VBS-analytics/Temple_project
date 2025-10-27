import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { extractResults } from '../lib/api';
import { CartItem, createCartItem, useCartStore } from '../store/cart';
import { useAuthStore } from '../store/auth';

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

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  // Keep input text in sync with external value
  useEffect(() => {
    setQuery(selected?.label ?? '');
  }, [selected?.label]);

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

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm transition-all"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
        />
        {value && (
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle options"
        >
          ▾
        </button>
      </div>

      {open && (
        <div
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
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
                  active ? 'bg-blue-50' : ''
                } ${isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`}
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

  return (
    <div className="relative w-full min-w-[13rem] max-w-sm" ref={containerRef}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-1.5 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-50 shadow-sm"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <span className="ml-2 text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <ul className="max-h-60 overflow-auto py-1 text-sm">
            {options.map((option) => {
              const checked = selectedValues.includes(option.value);
              return (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                    <span>{option.label}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
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
  dob?: string | null;
  familyName?: string | null;
  source: MemberSource;
  donorId?: number | null;
  donorName?: string;
  donorPhone?: string;
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCurrency = (value?: string | null) => {
  if (!value) return '';
  const amountNumber = Number(value);
  if (Number.isNaN(amountNumber)) {
    return value;
  }
  return amountNumber.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDayOptionLabel = (option: DayOption) => {
  return option.code ? `${option.description} — ${option.code}` : option.description;
};

const toCurrencyLabel = (value?: string | null) => {
  const formatted = formatCurrency(value);
  return formatted ? `₹ ${formatted}` : '';
};

const CHART_DAY_OPTION_CODE = 'CHRT';

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

type DayOccurrenceState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; date: string; label: string; note?: string | null }
  | { status: 'error'; key: string; message: string }
  | { status: 'needsStar'; key: string; message: string }
  | { status: 'manual'; key: string; message: string };

const buildOccurrenceKey = (dayOptionId: number | null, tamilStarId: string | null | undefined) => {
  if (!dayOptionId) return 'none';
  const starPart = tamilStarId ? tamilStarId : 'na';
  return `${dayOptionId}:${starPart}`;
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
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(['self']);
  const [contactDetails, setContactDetails] = useState({ phoneNumber: '', address: '' });
  const [daySelectionMap, setDaySelectionMap] = useState<Record<number, number | null>>({});
  const [memberSelectionMap, setMemberSelectionMap] = useState<Record<number, string[]>>({});
  const [prasadamSelectionMap, setPrasadamSelectionMap] = useState<Record<number, boolean>>({});
  const [chartDetailsMap, setChartDetailsMap] = useState<Record<number, { date: string; note: string }>>({});
  const [dayOccurrenceMap, setDayOccurrenceMap] = useState<Record<number, DayOccurrenceState>>({});
  const [bookingMode, setBookingMode] = useState<BookingMode>('full');
  const [tableMessage, setTableMessage] = useState<{ status: 'info' | 'error'; text: string } | null>(null);
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const addToCart = useCartStore((state) => state.addItem);
  const removeFromCart = useCartStore((state) => state.removeItem);
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const registrationDateLabel = useMemo(() => formatDisplayDate(new Date().toISOString()), []);
  const todayIso = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

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
    setChartDetailsMap((prev) => {
      let changed = false;
      const next = { ...prev };
      cartItems.forEach((item) => {
        if (isChartDayOption({ code: item.dayOptionCode })) {
          const current = next[item.poojaId] ?? { date: '', note: '' };
          const incoming = {
            date: item.customDayDate ?? '',
            note: item.customDayNote ?? '',
          };
          if (current.date !== incoming.date || current.note !== incoming.note) {
            next[item.poojaId] = incoming;
            changed = true;
          }
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

  const memberDirectory = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const lookup = new Map<string, MemberDirectoryEntry>();
    const idLookup = new Map<number, string>();

    const register = (entry: MemberDirectoryEntry, label: string) => {
      if (lookup.has(entry.key)) {
        return;
      }
      // Skip Temple Admin (Self) if the user is an admin
      if (profile?.user?.role === 'admin' && entry.source === 'self') {
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
    const baseUserId = typeof profile?.user?.id === 'number' ? profile.user.id : null;

    const selfEntry: MemberDirectoryEntry = {
      key: 'self',
      id: baseUserId,
      name: baseName || 'Self',
      relationship: 'Self',
      gender: undefined,
      tamilStar: profile?.profile?.tamil_star,
      gothra: profile?.profile?.gothra,
      dob: profile?.profile?.date_of_birth ?? null,
      familyName: profile?.profile?.family_name ?? null,
      source: 'self',
      donorId: baseUserId,
      donorName: baseName || 'Self',
      donorPhone: basePhone || undefined,
    };
    // Register self entry only if user is not an admin
    if (profile?.user?.role !== 'admin') {
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
  }, [profile, donorRecords]);

  const memberOptions = memberDirectory.options;
  const memberLookup = memberDirectory.lookup;
  const memberIdLookup = memberDirectory.idLookup;

  const primaryMemberKey = selectedMemberIds[0] ?? 'self';

  const primaryMember = useMemo(() => {
    return memberLookup.get(primaryMemberKey);
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
    dob: entry.dob ?? null,
    familyName: entry.familyName ?? null,
    selectionKey: entry.key,
    donorName: entry.donorName ?? null,
    donorPhone: entry.donorPhone ?? null,
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
          dob: null,
          familyName: null,
          selectionKey: memberKey,
          donorName: null,
          donorPhone: null,
        };
      }
      return {
        id: null,
        name: fallbackName || 'Member',
        relationship: memberKey === 'self' ? 'Self' : undefined,
        gender: undefined,
        tamilStar: undefined,
        gothra: undefined,
        dob: null,
        familyName: null,
        selectionKey: memberKey,
        donorName: null,
        donorPhone: null,
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

  const dayOptionChoices = useMemo(() => {
    return dayOptions
      .filter((option) => option.category !== 'tamil_star')
      .sort((a, b) => {
        const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.description.localeCompare(b.description);
      });
  }, [dayOptions]);

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

  const baseName = profile?.user?.name ?? '';
  const baseEmail = profile?.user?.email ?? '';
  const basePhone = profile?.user?.phone_number ?? '';
  const baseAddress = buildAddress(profile?.profile);
  const resolvedName = primaryMember?.name ?? baseName;
  const resolvedEmail = baseEmail;

  useEffect(() => {
    let isActive = true;
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [featuredRes, poojaRes, dayRes] = await Promise.all([
          api.get('/pooja/featured-poojas/'),
          api.get('/pooja/options/'),
          api.get('/pooja/day-options/'),
        ]);
        if (!isActive) return;
        const featured = extractResults<FeaturedPooja>(featuredRes.data).filter((item) => item.is_active);
        const poojaList = extractResults<PoojaOption>(poojaRes.data);
        const dayList = extractResults<DayOption>(dayRes.data)
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
  }, []);

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
    if (!memberLookup.has(primaryMemberKey)) {
      setSelectedMemberIds(['self']);
    }
  }, [memberLookup, primaryMemberKey]);

  useEffect(() => {
    if (!selectedPooja || bookingMode !== 'full') return;
    setContactDetails({
      phoneNumber: basePhone,
      address: baseAddress,
    });
  }, [selectedPooja, basePhone, baseAddress, bookingMode]);

  const ensureChartDetailState = useCallback(
    (poojaId: number, optionId: number | null) => {
      const option = optionId ? dayOptionMap.get(optionId) : undefined;
      if (option && isChartDayOption(option)) {
        setChartDetailsMap((prev) => {
          if (prev[poojaId]) {
            return prev;
          }
          return {
            ...prev,
            [poojaId]: { date: '', note: '' },
          };
        });
      } else {
        setChartDetailsMap((prev) => {
          if (!(poojaId in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[poojaId];
          return next;
        });
      }
    },
    [dayOptionMap],
  );

  const updateChartDetails = useCallback((poojaId: number, field: 'date' | 'note', value: string) => {
    setChartDetailsMap((prev) => {
      const existing = prev[poojaId] ?? { date: '', note: '' };
      if (existing[field] === value) {
        return prev;
      }
      return {
        ...prev,
        [poojaId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  }, []);

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
        setDayOccurrenceMap((prev) => {
          const nextState: DayOccurrenceState = {
            status: 'ready',
            key: stateKey,
            date: data?.occurrence_date ?? '',
            label: data?.occurrence_label ?? '',
            note: data?.meta?.note ?? null,
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

  const toggleMemberSelection = (value: string) => {
    setSelectedMemberIds((prev) => {
      let next = [...prev];
      const hasValue = next.includes(value);

      if (value === 'self') {
        if (hasValue) {
          next = next.filter((id) => id !== 'self');
          if (next.length === 0) {
            next = ['self'];
          }
        } else {
          next = ['self', ...next.filter((id) => id !== 'self')];
        }
      } else {
        if (hasValue) {
          next = next.filter((id) => id !== value);
          if (next.length === 0) {
            next = ['self'];
          }
        } else {
          next = [...next.filter((id) => id !== value), value];
          if (next.length > 1 && next.includes('self')) {
            next = next.filter((id) => id !== 'self');
          }
        }
      }

      return Array.from(new Set(next.length > 0 ? next : ['self']));
    });
  };
  const toggleMemberSelectionForRow = (row: MasterRow, value: string) => {
    setTableMessage(null);
    const selectedDayId = resolveSelectedDayId(row.pooja.id);
    const matchingItem = findMatchingCartItem(row, selectedDayId);
    const currentKeys = resolveSelectedMemberKeys(row.pooja.id, matchingItem);
    let next = [...currentKeys];
    const hasValue = next.includes(value);

    if (value === 'self') {
      if (hasValue) {
        next = next.filter((id) => id !== 'self');
        if (next.length === 0) {
          next = ['self'];
        }
      } else {
        next = ['self', ...next.filter((id) => id !== 'self')];
      }
    } else {
      if (hasValue) {
        next = next.filter((id) => id !== value);
        if (next.length === 0) {
          next = ['self'];
        }
      } else {
        next = [...next.filter((id) => id !== value), value];
        if (next.length > 1 && next.includes('self')) {
          next = next.filter((id) => id !== 'self');
        }
      }
    }

    const normalized = Array.from(new Set(next.length > 0 ? next : ['self']));

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

  const getRowAmount = (row: MasterRow): string | null => {
    return row.amountValue ?? parseAmountFromLabel(row.rateLabel);
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

  const findMatchingCartItem = (row: MasterRow, dayId?: number | null): CartItem | undefined => {
    const effectiveDayId = dayId !== undefined ? dayId : resolveSelectedDayId(row.pooja.id);
    return cartItems.find(
      (item) =>
        item.poojaId === row.pooja.id &&
        ((item.dayOptionId ?? null) === (effectiveDayId ?? null)),
    );
  };

  const resolveSelectedMemberKeys = (poojaId: number, matchingItem?: CartItem): string[] => {
    const explicit = memberSelectionMap[poojaId];
    if (explicit && explicit.length > 0) {
      return Array.from(new Set(explicit));
    }

    if (matchingItem?.members && matchingItem.members.length > 0) {
      return Array.from(
        new Set(
          matchingItem.members.map((member) => {
            if (member.selectionKey) {
              return member.selectionKey;
            }
            if (member.id !== undefined && member.id !== null) {
              const mapped = memberIdLookup.get(member.id);
              if (mapped) {
                return mapped;
              }
              return String(member.id);
            }
            return 'self';
          }),
        ),
      );
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

    return [];
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
    setSelectedMemberIds(defaultMembers.length > 0 ? Array.from(new Set(defaultMembers)) : ['self']);
    setSelectedPooja(pooja);
    setBookingMode(mode);
    setDateValue('');
    setSelectedTamilStar(tamilStarSelectionMap[pooja.id] ?? null);
    setSelectedDayOptionId(dayOptionId ?? null);
    ensureChartDetailState(pooja.id, dayOptionId ?? null);
  };

  const handleMasterRowAction = (row: MasterRow, mode: BookingMode) => {
    setTableMessage(null);
    const selectedDay = resolveSelectedDayId(row.pooja.id);
    const matchingItem = findMatchingCartItem(row, selectedDay);
    const presetMembers = resolveSelectedMemberKeys(row.pooja.id, matchingItem);
    const currentPrasadam = resolvePostPrasadam(row.pooja.id, matchingItem);
    setPrasadamSelectionMap((prev) => ({
      ...prev,
      [row.pooja.id]: currentPrasadam,
    }));
    openBookingModal(convertMasterToBooking(row), selectedDay ?? null, mode, presetMembers);
  };

  const toggleCartItem = (row: MasterRow) => {
    const selectedDayId = resolveSelectedDayId(row.pooja.id);
    const matchingItem = findMatchingCartItem(row, selectedDayId);

    if (matchingItem) {
      removeFromCart(cartKey, matchingItem.cartId);
      setTableMessage({ status: 'info', text: `${row.uiLabel} removed from cart.` });
      return;
    }

    if (dayOptionChoices.length > 0 && !selectedDayId) {
      setTableMessage({ status: 'error', text: 'Please select a day option before adding this pooja.' });
      return;
    }

    const chosenDayOption = selectedDayId ? dayOptionMap.get(selectedDayId) : undefined;
    const requiresChartDetails = isChartDayOption(chosenDayOption);
    const chartDetails = chartDetailsMap[row.pooja.id];
    const selectedStarForRow = tamilStarSelectionMap[row.pooja.id] ?? selectedTamilStar;
    const selectedTamilStarOption =
      selectedStarForRow && chosenDayOption?.code === 'CS'
        ? dayOptionMap.get(Number(selectedStarForRow))
        : undefined;
    const postPrasadam = resolvePostPrasadam(row.pooja.id, matchingItem);

    if (requiresChartDetails) {
      if (!chartDetails?.date) {
        setTableMessage({ status: 'error', text: 'Please pick a date for the donor chart option before adding to the cart.' });
        return;
      }
      if (!chartDetails?.note?.trim()) {
        setTableMessage({ status: 'error', text: 'Please provide notes for the donor chart option before adding to the cart.' });
        return;
      }
    }

    const occurrenceState = dayOccurrenceMap[row.pooja.id];
    let resolvedBookingDate = '';
    if (requiresChartDetails) {
      resolvedBookingDate = chartDetails?.date ?? '';
    } else if (occurrenceState?.status === 'ready' && occurrenceState.date) {
      resolvedBookingDate = occurrenceState.date;
    } else {
      const fallbackMessage =
        occurrenceState?.status === 'loading'
          ? 'Fetching the next occurrence. Please try again in a moment.'
          : (getOccurrenceMessage(occurrenceState) ??
            'Select a day option and wait for the next occurrence before adding this pooja to the cart.');
      setTableMessage({ status: 'error', text: fallbackMessage });
      return;
    }

    if (!resolvedBookingDate) {
      setTableMessage({ status: 'error', text: 'Choose or confirm a pooja date before adding this item to the cart.' });
      return;
    }
    const amountForCart = getRowAmount(row);
    const mapSelection = memberSelectionMap[row.pooja.id];
    const selectedMemberKeysRaw = mapSelection && mapSelection.length > 0
      ? mapSelection
      : selectedMemberIds.length > 0
        ? selectedMemberIds
        : ['self'];
    const selectedMemberKeys = Array.from(new Set(selectedMemberKeysRaw));

    const membersPayload = selectedMemberKeys.map((memberKey, index) => {
      const fallbackName =
        matchingItem?.members?.[index]?.name ??
        (memberKey === 'self' ? baseName || matchingItem?.fullName || 'Self' : undefined);
      return buildMemberPayloadFromKey(memberKey, fallbackName);
    });

    const primarySelectionKey = selectedMemberKeys[0] ?? 'self';
    const primaryPayload =
      membersPayload[0] ??
      buildMemberPayloadFromKey(primarySelectionKey, baseName || matchingItem?.fullName || 'Self');
    const primaryDirectoryEntry =
      memberLookup.get(primaryPayload.selectionKey ?? primarySelectionKey) ??
      memberLookup.get(primarySelectionKey) ??
      null;

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
      customDayDate: requiresChartDetails ? chartDetails?.date ?? null : null,
      customDayNote: requiresChartDetails ? chartDetails?.note?.trim() ?? null : null,
      postPrasadam,
      memberId: primaryDirectoryEntry?.id ?? null,
      memberRelationship: primaryPayload.relationship ?? undefined,
      memberGender: primaryPayload.gender,
      memberTamilStar: primaryPayload.tamilStar,
      memberGothra: primaryPayload.gothra,
      memberDob: primaryPayload.dob ?? null,
      memberFamilyName: primaryPayload.familyName ?? null,
      members: membersPayload,
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
    setTableMessage({ status: 'info', text: `${row.uiLabel} added to cart.` });
  };

  const handleCloseModal = () => {
    setSelectedPooja(null);
    setDateValue('');
    setFormError('');
    setSelectedDayOptionId(null);
    setBookingMode('full');
    setSelectedMemberIds(['self']);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTableMessage(null);
    if (!selectedPooja) return;

    if (bookingMode === 'memberOnly') {
      const memberKeys = Array.from(new Set(selectedMemberIds.length > 0 ? selectedMemberIds : ['self']));
      setMemberSelectionMap((prev) => ({
        ...prev,
        [selectedPooja.id]: memberKeys,
      }));
      handleCloseModal();
      return;
    }

    if (!dateValue) {
      setFormError('Please choose a booking date to proceed.');
      return;
    }

    if (selectedPooja.source === 'master' && dayOptionChoices.length > 0 && !selectedDayOptionId) {
      setFormError('Please choose a day option to proceed.');
      return;
    }

    const chosenDayOption = selectedDayOptionId ? dayOptionMap.get(selectedDayOptionId) : undefined;
    const requiresChartDetails = isChartDayOption(chosenDayOption);
    const chartDetails = chartDetailsMap[selectedPooja.id];
    const postPrasadam = prasadamSelectionMap[selectedPooja.id] ?? false;

    if (requiresChartDetails) {
      if (!chartDetails?.date) {
        setFormError('Please choose a preferred date for this day option.');
        return;
      }
      if (!chartDetails?.note?.trim()) {
        setFormError('Please add instructions for this day option.');
        return;
      }
    }

    const memberKeysRaw = selectedMemberIds.length > 0 ? selectedMemberIds : ['self'];
    const memberKeys = Array.from(new Set(memberKeysRaw));
    const membersPayload = memberKeys.map((key, index) =>
      buildMemberPayloadFromKey(key, index === 0 ? resolvedName : undefined),
    );

    const selectedStarForSelected =
      selectedPooja ? tamilStarSelectionMap[selectedPooja.id] ?? selectedTamilStar : selectedTamilStar;
    const selectedTamilStarOption =
      selectedStarForSelected && chosenDayOption?.code === 'CS'
        ? dayOptionMap.get(Number(selectedStarForSelected))
        : undefined;

    const primaryEntry =
      membersPayload[0] ?? buildMemberPayloadFromKey(memberKeys[0] ?? 'self', resolvedName);
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
      customDayDate: requiresChartDetails ? chartDetails?.date ?? null : null,
      customDayNote: requiresChartDetails ? chartDetails?.note?.trim() ?? null : null,
      postPrasadam,
      memberId: primaryEntry?.id ?? null,
      memberRelationship: primaryEntry?.relationship ?? undefined,
      memberGender: primaryEntry?.gender,
      memberTamilStar: primaryEntry?.tamilStar,
      memberGothra: primaryEntry?.gothra,
      memberDob: primaryEntry?.dob ?? null,
      members: membersPayload,
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

  const modalRequiresChartDetails =
    selectedPooja && selectedDayOptionId ? isChartDayOption(dayOptionMap.get(selectedDayOptionId)) : false;
  const modalChartDetails = selectedPooja ? chartDetailsMap[selectedPooja.id] ?? { date: '', note: '' } : { date: '', note: '' };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pooja Registration</h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            Browse our complete pooja catalogue and select your preferred options to book a pooja ceremony
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 border border-gray-200">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Available Poojas</h2>
                <p className="text-gray-700 mt-1">
                  Select a pooja, choose your preferred day option, and add to cart
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-900 text-sm font-medium">
                  நாள் விருப்பம் - உங்கள் நட்சத்திரங்களின் அடிப்படையில், உங்கள் சொந்த தேதியை நீங்கள் தேர்வு செய்யலாம்.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
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
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-700">No pooja options available at the moment.</p>
              </div>
            )}

            {!isLoading && !error && masterRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-[1800px] w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-32">
                        Code
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-96">
                        Pooja Name
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-[500px]">
                        Day Option
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-64">
                        Devotees
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-48">
                        Next Occurrence
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                        Prasadam
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                        Add to Cart
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-48">
                        Registered By
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                        Registration Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {masterRows.map((row) => {
                      const selectedDayId = resolveSelectedDayId(row.pooja.id);
                      const matchingItem = findMatchingCartItem(row, selectedDayId);
                      const inCart = Boolean(matchingItem);
                      const selectedDayOption = selectedDayId ? dayOptionMap.get(selectedDayId) : undefined;
                      const requiresChartDetails = isChartDayOption(selectedDayOption);
                      const chartDetails = chartDetailsMap[row.pooja.id] ?? { date: '', note: '' };
                      const occurrenceState = dayOccurrenceMap[row.pooja.id];
                      const iconLabel = inCart
                        ? `Remove ${row.uiLabel} from cart`
                        : `Add ${row.uiLabel} to cart`;
                      const iconClasses = inCart
                        ? 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300'
                        : 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300';
                      const resolvedMemberKeys = resolveSelectedMemberKeys(row.pooja.id, matchingItem);
                      const memberButtonLabel = formatMemberLabel(row.pooja.id, resolvedMemberKeys, matchingItem);
                      const postPrasadamSelected = resolvePostPrasadam(row.pooja.id, matchingItem);
                      
                      return (
                        <tr key={row.pooja.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {row.code}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {row.uiLabel}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {dayOptionChoices.length > 0 ? (
                              <div className="space-y-3">
                                <SearchableSelect
                                  options={dayOptionChoices.map((option) => ({
                                    value: String(option.id),
                                    label: formatDayOptionLabel(option),
                                  }))}
                                  value={selectedDayId !== null ? String(selectedDayId) : ''}
                                  onChange={(val) => handleDaySelectionChange(row.pooja.id, val)}
                                  placeholder="Select day option"
                                  className="w-full max-w-md"
                                />
                                {selectedDayOption?.code === 'CS' && (
                                  <div className="mt-2">
                                    <SearchableSelect
                                      options={tamilStarOptions.map((option) => ({
                                        value: String(option.id),
                                        label: formatDayOptionLabel(option),
                                      }))}
                                      value={tamilStarSelectionMap[row.pooja.id] || ''}
                                      onChange={(val) => handleTamilStarSelection(row.pooja.id, val)}
                                      placeholder="Select your star"
                                      className="w-full max-w-md"
                                    />
                                  </div>
                                )}
                                {requiresChartDetails && (
                                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 mt-2">
                                    <div className="space-y-1">
                                      <label className="block text-xs font-medium text-gray-700">
                                        Preferred Date
                                      </label>
                                      <input
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        value={chartDetails.date}
                                        onChange={(event) => updateChartDetails(row.pooja.id, 'date', event.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-xs font-medium text-gray-700">
                                        Donor Instructions
                                      </label>
                                      <textarea
                                        rows={2}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        value={chartDetails.note}
                                        onChange={(event) => updateChartDetails(row.pooja.id, 'note', event.target.value)}
                                        placeholder="Add donor instructions"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">Not configured</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <MemberMultiSelect
                              label={memberButtonLabel}
                              options={memberOptions}
                              selectedValues={resolvedMemberKeys.length > 0 ? resolvedMemberKeys : ['self']}
                              onToggleValue={(value) => toggleMemberSelectionForRow(row, value)}
                              disabled={memberOptions.length === 0}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {selectedDayId === null ? (
                              <span className="text-xs text-gray-500">Select a day option</span>
                            ) : !occurrenceState ? (
                              <span className="text-xs text-gray-500">Select a day option</span>
                            ) : occurrenceState.status === 'loading' ? (
                              <span className="text-xs text-gray-600">Fetching date…</span>
                            ) : occurrenceState.status === 'ready' ? (
                              <div className="space-y-1">
                                <span className="font-medium text-gray-900">
                                  {formatDisplayDate(occurrenceState.date)}
                                </span>
                                {occurrenceState.label && (
                                  <span className="block text-xs text-gray-600">{occurrenceState.label}</span>
                                )}
                                {occurrenceState.note && (
                                  <span className="block text-xs text-gray-500">{occurrenceState.note}</span>
                                )}
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
                            {row.rateLabel}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            <div className="flex items-center justify-center space-x-4">
                              <label className="inline-flex items-center">
                                <input
                                  type="radio"
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
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
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
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
            )}

            {tableMessage && (
              <div className={`mt-4 p-3 rounded-lg text-center ${tableMessage.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {tableMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {selectedPooja && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
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
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
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
                            <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-gray-700">
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

                {bookingMode === 'full' && dayOptionChoices.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day Option
                    </label>
                    <SearchableSelect
                      options={dayOptionChoices.map((option) => ({
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
                      <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Preferred Date
                          </label>
                          <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            value={modalChartDetails.date}
                            onChange={(event) => updateChartDetails(selectedPooja.id, 'date', event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Donor Instructions
                          </label>
                          <textarea
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            value={modalChartDetails.note}
                            onChange={(event) => updateChartDetails(selectedPooja.id, 'note', event.target.value)}
                            placeholder="Add donor instructions"
                          />
                        </div>
                      </div>
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
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
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
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
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
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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