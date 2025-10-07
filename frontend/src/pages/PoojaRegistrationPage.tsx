import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
        />
        {value && (
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 text-sm"
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
          className="text-slate-400 hover:text-slate-600 text-xs"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle options"
        >
          ▾
        </button>
      </div>

      {open && (
        <div
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
          role="listbox"
          onMouseLeave={() => setActiveIndex(-1)}
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
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
                className={`block w-full px-3 py-2 text-left text-sm ${
                  active ? 'bg-slate-100' : ''
                } ${isSelected ? 'font-medium text-slate-900' : 'text-slate-700'}`}
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
}

interface ProfilePayload {
  user: {
    name?: string;
    email?: string;
    phone_number?: string;
  };
  profile?: {
    address_line1?: string;
    address_line2?: string;
    address_line3?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  members?: ProfileMember[];
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
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [dateValue, setDateValue] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(['self']);
  const [contactDetails, setContactDetails] = useState({ phoneNumber: '', address: '' });
  const [daySelectionMap, setDaySelectionMap] = useState<Record<number, number | null>>({});
  const [memberSelectionMap, setMemberSelectionMap] = useState<Record<number, string[]>>({});
  const [prasadamSelectionMap, setPrasadamSelectionMap] = useState<Record<number, boolean>>({});
  const [chartDetailsMap, setChartDetailsMap] = useState<Record<number, { date: string; note: string }>>({});
  const [bookingMode, setBookingMode] = useState<BookingMode>('full');
  const [tableMessage, setTableMessage] = useState<{ status: 'info' | 'error'; text: string } | null>(null);
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const addToCart = useCartStore((state) => state.addItem);
  const removeFromCart = useCartStore((state) => state.removeItem);
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);

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

  const memberOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const baseName = profile?.user?.name;
    options.push({ value: 'self', label: baseName ? `${baseName} (Self)` : 'Self' });
    profile?.members?.forEach((member) => {
      const label = member.name ? `${member.name}${member.relationship ? ` (${member.relationship})` : ''}` : `Member #${member.id}`;
      options.push({ value: String(member.id), label });
    });
    return options;
  }, [profile]);

  const primaryMemberKey = selectedMemberIds[0] ?? 'self';

  const primaryMember = useMemo(() => {
    if (!profile?.members || primaryMemberKey === 'self') return undefined;
    return profile.members.find((member) => String(member.id) === primaryMemberKey);
  }, [profile, primaryMemberKey]);

  const selectedMemberEntries = useMemo<ProfileMember[]>(() => {
    if (!profile?.members) return [];
    return selectedMemberIds
      .filter((memberKey) => memberKey !== 'self')
      .map((memberKey) => profile.members?.find((member) => String(member.id) === memberKey))
      .filter((member): member is ProfileMember => Boolean(member));
  }, [profile, selectedMemberIds]);

  const dayOptionMap = useMemo(() => {
    const map = new Map<number, DayOption>();
    dayOptions.forEach((option) => {
      map.set(option.id, option);
    });
    return map;
  }, [dayOptions]);

  const dayOptionChoices = useMemo(() => {
    return dayOptions
      .slice()
      .sort((a, b) => {
        const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.description.localeCompare(b.description);
      });
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
    if (primaryMemberKey !== 'self' && !primaryMember) {
      setSelectedMemberIds(['self']);
    }
  }, [primaryMemberKey, primaryMember]);

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

  useEffect(() => {
    Object.entries(daySelectionMap).forEach(([poojaIdKey, optionIdValue]) => {
      const poojaId = Number(poojaIdKey);
      const optionId = optionIdValue ?? null;
      ensureChartDetailState(poojaId, optionId);
    });
  }, [daySelectionMap, ensureChartDetailState]);

  const handleDaySelectionChange = (poojaId: number, value: string) => {
    const optionId = value ? Number(value) : null;
    setDaySelectionMap((prev) => ({
      ...prev,
      [poojaId]: optionId,
    }));
    ensureChartDetailState(poojaId, optionId);
    setTableMessage(null);
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

  const resolveSelectedDayId = (poojaId: number): number | null => {
    if (Object.prototype.hasOwnProperty.call(daySelectionMap, poojaId)) {
      return daySelectionMap[poojaId] ?? null;
    }
    const existing = cartItems.find((item) => item.poojaId === poojaId);
    return existing?.dayOptionId ?? null;
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
            if (member.id !== undefined && member.id !== null) {
              return String(member.id);
            }
            return 'self';
          }),
        ),
      );
    }

    if (matchingItem) {
      if (matchingItem.memberId !== undefined && matchingItem.memberId !== null) {
        return [String(matchingItem.memberId)];
      }
      if (matchingItem.fullName) {
        return ['self'];
      }
    }

    return [];
  };

  const describeMemberKey = (memberKey: string, matchingItem?: CartItem): string => {
    if (memberKey === 'self') {
      const fallbackName = matchingItem?.members?.find((entry) => entry.id === null)?.name || matchingItem?.fullName;
      const baseLabel = baseName || fallbackName || 'Self';
      return `${baseLabel} - Self`;
    }
    const member = profile?.members?.find((candidate) => String(candidate.id) === memberKey);
    if (member) {
      const relationship = member.relationship ? ` - ${member.relationship}` : '';
      const name = member.name || `Member #${member.id}`;
      return `${name}${relationship}`;
    }
    const fallback = matchingItem?.members?.find((entry) => (entry.id !== null ? String(entry.id) === memberKey : false));
    if (fallback) {
      const relationship = fallback.relationship ? ` - ${fallback.relationship}` : '';
      return `${fallback.name ?? 'Member'}${relationship}`;
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
    const amountForCart = getRowAmount(row);
    const mapSelection = memberSelectionMap[row.pooja.id];
    const selectedMemberKeysRaw = mapSelection && mapSelection.length > 0
      ? mapSelection
      : selectedMemberIds.length > 0
        ? selectedMemberIds
        : ['self'];
    const selectedMemberKeys = Array.from(new Set(selectedMemberKeysRaw));

    const membersPayload = selectedMemberKeys.map((memberKey) => {
      if (memberKey === 'self') {
        return {
          id: null,
          name: baseName || matchingItem?.fullName || 'Self',
          relationship: 'Self',
          gender: undefined,
          tamilStar: undefined,
          gothra: undefined,
          dob: undefined,
        };
      }
      const member = profile?.members?.find((candidate) => String(candidate.id) === memberKey);
      return {
        id: member ? member.id : Number(memberKey) || null,
        name: member?.name ?? matchingItem?.fullName ?? 'Member',
        relationship: member?.relationship ?? matchingItem?.memberRelationship ?? undefined,
        gender: member?.gender,
        tamilStar: member?.tamil_star,
        gothra: member?.gothra,
        dob: member?.date_of_birth ?? undefined,
      };
    });

    const primaryMemberEntry = membersPayload[0];
    const primaryMember = primaryMemberEntry && primaryMemberEntry.id !== null
      ? profile?.members?.find((member) => member.id === primaryMemberEntry.id)
      : undefined;

    const item = createCartItem({
      poojaId: row.pooja.id,
      poojaName: row.pooja.name,
      poojaCode: row.code,
      poojaImage: '',
      poojaImageUrl: null,
      amount: amountForCart,
      bookingDate: '',
      fullName: primaryMemberEntry?.name ?? baseName,
      email: baseEmail,
      phoneNumber: basePhone,
      address: baseAddress,
      dayOptionId: chosenDayOption?.id ?? null,
      dayOptionCode: chosenDayOption?.code ?? null,
      dayOptionDescription: chosenDayOption?.description ?? null,
      dayOptionCategory: chosenDayOption?.category ?? null,
      customDayDate: requiresChartDetails ? chartDetails?.date ?? null : null,
      customDayNote: requiresChartDetails ? chartDetails?.note?.trim() ?? null : null,
      postPrasadam,
      memberId: primaryMember ? primaryMember.id : null,
      memberRelationship: primaryMemberEntry?.relationship ?? primaryMember?.relationship,
      memberGender: primaryMember?.gender,
      memberTamilStar: primaryMember?.tamil_star,
      memberGothra: primaryMember?.gothra,
      memberDob: primaryMember?.date_of_birth ?? null,
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
    const membersPayload = memberKeys.map((key) => {
      if (key === 'self') {
        return {
          id: null,
          name: baseName || resolvedName || 'Self',
          relationship: 'Self',
          gender: undefined,
          tamilStar: undefined,
          gothra: undefined,
          dob: undefined,
        };
      }
      const member = profile?.members?.find((candidate) => String(candidate.id) === key);
      return {
        id: member ? member.id : Number(key) || null,
        name: member?.name ?? 'Member',
        relationship: member?.relationship ?? undefined,
        gender: member?.gender,
        tamilStar: member?.tamil_star,
        gothra: member?.gothra,
        dob: member?.date_of_birth ?? undefined,
      };
    });

    const primaryEntry = membersPayload[0];
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
      customDayDate: requiresChartDetails ? chartDetails?.date ?? null : null,
      customDayNote: requiresChartDetails ? chartDetails?.note?.trim() ?? null : null,
      postPrasadam,
      memberId: primaryEntry?.id ?? null,
      memberRelationship: primaryEntry?.relationship ?? (primaryEntry?.id === null ? 'Self' : undefined),
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
    <div className="space-y-12">

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800">Pooja Registrations</h2>
          <p className="text-sm text-slate-600">
            Browse the complete pooja catalogue and pick a suitable day option before adding it to your cart.
          </p>
          <p className="text-sm text-slate-600">
            Day Option - You can choose your own date, based on your Stars <br></br>
              <span className="inline-block mt-1 rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                நாள் விருப்பம் - உங்கள் நட்சத்திரங்களின் அடிப்படையில், உங்கள் சொந்த தேதியை நீங்கள் தேர்வு செய்யலாம்.
              </span>
          </p>
        </header>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && masterRows.length === 0 && (
          <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">No pooja master entries found.</p>
        )}

        {!isLoading && masterRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">Code</th>
                  <th scope="col" className="px-3 py-2 text-left">Pooja Name</th>
                  <th scope="col" className="px-3 py-2 text-left">Day Option</th>
                  <th scope="col" className="px-3 py-2 text-left">Add Member</th>
                  <th scope="col" className="px-3 py-2 text-left">Pooja Rate</th>
                  <th scope="col" className="px-3 py-2 text-center">Post Prasadam for this day</th>
                  <th scope="col" className="px-3 py-2 text-center">Add to Cart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {masterRows.map((row) => {
                  const selectedDayId = resolveSelectedDayId(row.pooja.id);
                  const matchingItem = findMatchingCartItem(row, selectedDayId);
                  const inCart = Boolean(matchingItem);
                  const selectedDayOption = selectedDayId ? dayOptionMap.get(selectedDayId) : undefined;
                  const requiresChartDetails = isChartDayOption(selectedDayOption);
                  const chartDetails = chartDetailsMap[row.pooja.id] ?? { date: '', note: '' };
                  const iconLabel = inCart
                    ? `Remove ${row.uiLabel} from cart`
                    : `Add ${row.uiLabel} to cart`;
                  const iconClasses = inCart
                    ? 'inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300'
                    : 'inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300';
                  const resolvedMemberKeys = resolveSelectedMemberKeys(row.pooja.id, matchingItem);
                  const memberButtonLabel = formatMemberLabel(row.pooja.id, resolvedMemberKeys, matchingItem);
                  const postPrasadamSelected = resolvePostPrasadam(row.pooja.id, matchingItem);
                  return (
                    <tr key={row.pooja.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{row.code}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{row.uiLabel}</p>
                      </td>
                      <td className="px-3 py-2">
                        {dayOptionChoices.length > 0 ? (
                          <div className="space-y-2">
                            <SearchableSelect
                              options={dayOptionChoices.map((option) => ({
                                value: String(option.id),
                                label: formatDayOptionLabel(option),
                              }))}
                              value={selectedDayId !== null ? String(selectedDayId) : ''}
                              onChange={(val) => handleDaySelectionChange(row.pooja.id, val)}
                              placeholder="Select day option"
                            />
                            {requiresChartDetails && (
                              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                                <div className="space-y-1">
                                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Preferred Date
                                  </label>
                                  <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={chartDetails.date}
                                    onChange={(event) => updateChartDetails(row.pooja.id, 'date', event.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Donor Instructions
                                  </label>
                                  <textarea
                                    rows={2}
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={chartDetails.note}
                                    onChange={(event) => updateChartDetails(row.pooja.id, 'note', event.target.value)}
                                    placeholder="Add donor instructions"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs uppercase text-slate-400">Not configured</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleMasterRowAction(row, 'memberOnly')}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {memberButtonLabel}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.rateLabel}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-4 text-xs text-slate-600">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={postPrasadamSelected === true}
                              onChange={() => {
                                setPrasadamSelectionMap((prev) => ({
                                  ...prev,
                                  [row.pooja.id]: true,
                                }));
                                setTableMessage(null);
                              }}
                              aria-label={`Select Yes for post prasadam for ${row.uiLabel}`}
                            />
                            <span>Yes</span>
                          </label>

                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={postPrasadamSelected === false}
                              onChange={() => {
                                setPrasadamSelectionMap((prev) => ({
                                  ...prev,
                                  [row.pooja.id]: false,
                                }));
                                setTableMessage(null);
                              }}
                              aria-label={`Select No for post prasadam for ${row.uiLabel}`}
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleCartItem(row)}
                          className={iconClasses}
                          aria-label={iconLabel}
                        >
                          {inCart ? <CartRemoveIcon className="h-4 w-4" /> : <CartAddIcon className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {tableMessage && (
          <p
            className={`text-sm ${
              tableMessage.status === 'error' ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {tableMessage.text}
          </p>
        )}
      </section>

      {selectedPooja && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-600"
              aria-label="Close booking form"
            >
              ×
            </button>
            <header className="space-y-1 pb-4 text-center">
              <h3 className="text-xl font-semibold text-slate-900">
                Book {selectedPooja.displayName ?? selectedPooja.name}
              </h3>
              {selectedPooja.code && (
                <p className="text-xs uppercase tracking-wide text-slate-500">Code: {selectedPooja.code}</p>
              )}
              {selectedPooja.amountLabel && (
                <p className="text-sm font-medium text-emerald-700">Offering: {selectedPooja.amountLabel}</p>
              )}
            </header>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {memberOptions.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Select Devotees</label>
                  <div className="space-y-2">
                    {memberOptions.map((option) => {
                      const checked = selectedMemberIds.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${checked ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'}`}
                        >
                          <span>{option.label}</span>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() => toggleMemberSelection(option.value)}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Tap to toggle devotees. At least one devotee must remain selected.</p>
                </div>
              )}

              {(selectedMemberIds.includes('self') || selectedMemberEntries.length > 0) && (
                <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600 space-y-1">
                  {selectedMemberIds.includes('self') && (
                    <p>
                      <span className="font-semibold text-slate-700">Primary:</span> {baseName || 'Self'}
                    </p>
                  )}
                  {selectedMemberEntries.map((member, index) => (
                    <div key={`${member.id ?? member.name ?? 'member'}-${index}`} className="space-y-1 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">
                      <p>
                        <span className="font-semibold text-slate-700">Name:</span> {member.name || `Member #${member.id}`}
                        {member.relationship && ` (${member.relationship})`}
                      </p>
                      {member.gender && (
                        <p>
                          <span className="font-semibold text-slate-700">Gender:</span> {member.gender}
                        </p>
                      )}
                      {member.date_of_birth && (
                        <p>
                          <span className="font-semibold text-slate-700">Birth date:</span> {formatDisplayDate(member.date_of_birth)}
                        </p>
                      )}
                      {member.tamil_star && (
                        <p>
                          <span className="font-semibold text-slate-700">Tamil star:</span> {member.tamil_star}
                        </p>
                      )}
                      {member.gothra && (
                        <p>
                          <span className="font-semibold text-slate-700">Gothra:</span> {member.gothra}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {bookingMode === 'full' && dayOptionChoices.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Day Option</label>
                  <SearchableSelect
                    options={dayOptionChoices.map((option) => ({
                      value: String(option.id),
                      label: formatDayOptionLabel(option),
                    }))}
                    value={selectedDayOptionId ? String(selectedDayOptionId) : ''}
                    onChange={(val) => {
                      const valueNum = val ? Number(val) : null;
                      setSelectedDayOptionId(valueNum);
                      if (selectedPooja?.source === 'master') {
                        setDaySelectionMap((prev) => ({ ...prev, [selectedPooja.id]: valueNum }));
                      }
                      ensureChartDetailState(selectedPooja.id, valueNum);
                      setFormError('');
                    }}
                    placeholder="Select day option"
                  />
                  {modalRequiresChartDetails && (
                    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Preferred Date
                        </label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          value={modalChartDetails.date}
                          onChange={(event) => updateChartDetails(selectedPooja.id, 'date', event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Donor Instructions
                        </label>
                        <textarea
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                <div className="inline-flex items-center gap-6 text-sm text-slate-700">
                  <span>Post Prasadam for this day</span>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={(prasadamSelectionMap[selectedPooja.id] ?? false) === true}
                      onChange={() =>
                        setPrasadamSelectionMap((prev) => ({
                          ...prev,
                          [selectedPooja.id]: true,
                        }))
                      }
                    />
                    <span>Yes</span>
                  </label>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={(prasadamSelectionMap[selectedPooja.id] ?? false) === false}
                      onChange={() =>
                        setPrasadamSelectionMap((prev) => ({
                          ...prev,
                          [selectedPooja.id]: false,
                        }))
                      }
                    />
                    <span>No</span>
                  </label>
                </div>
              )}

              {bookingMode === 'full' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Mobile Number</label>
                    <input
                      name="phoneNumber"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={contactDetails.phoneNumber}
                      onChange={(event) => setContactDetails((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                      placeholder="91XXXXXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Address</label>
                    <textarea
                      name="address"
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={contactDetails.address}
                      onChange={(event) => setContactDetails((prev) => ({ ...prev, address: event.target.value }))}
                      placeholder="Address for correspondence"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Booking Date</label>
                    <input
                      name="bookingDate"
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={dateValue}
                      onChange={(event) => setDateValue(event.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              {formError && bookingMode === 'full' && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
              )}
              <button
                type="submit"
                className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
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
      )}
    </div>
  );
};

export default PoojaRegistrationPage;
