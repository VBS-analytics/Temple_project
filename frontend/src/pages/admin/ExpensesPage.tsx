import { CSSProperties, FormEvent, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import api, { extractResults } from '../../lib/api';
import { isReadOnlyAdmin, useAuthStore } from '../../store/auth';

// ── Types ─────────────────────────────────────────────────────────────────────
type ExpenseRecordResponse = {
  id: number;
  transaction_date: string;
  category: string;
  amount: string | number;
  transaction_no?: string;
  comments?: string;
  remarks?: string;
  notes?: string;
};

type PoojaOptionTotal = {
  pooja_option_name: string;
  option_code: string;
  parent_code: string;
  parent_name: string;
  total_amount: string;
  registration_count: number;
};

type PoojaOptionPaidTotal = {
  pooja_option_name: string;
  option_code: string;
  parent_code: string;
  parent_name: string;
  paid_amount: string;
  paid_donor_count: number;
  payment_count: number;
};

type ExpenseRecord = Omit<ExpenseRecordResponse, 'amount'> & { amount: number };
type MonthOption = { label: string; value: string };
type ExpenseCategoryGroupKey = 'poojari' | 'coordinator' | 'bank' | 'other';
type ExpenseCategoryGroup = {
  key: ExpenseCategoryGroupKey;
  title: string;
  items: string[];
  color: 'purple' | 'blue' | 'green' | 'gray';
  icon: string;
};
type ExpenseCategoryMaster = {
  id: number;
  name: string;
  group_key: string;
  group_label?: string;
  display_order?: number;
  is_active: boolean;
};
type ExpenseFormPayload = {
  transaction_date: string;
  category: string;
  amount: number;
  transaction_no?: string;
  comments?: string;
  remarks?: string;
};
type SaveExpenseResult = { ok: boolean; error?: string };

// ── Constants ─────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORY_GROUPS: ExpenseCategoryGroup[] = [
  {
    key: 'poojari',
    title: 'We pay to poojari for',
    items: ['Archana & Abishekam', 'For Til oil', 'For Neivedhyam', 'For Navagraha pooja', 'For Pradosham', 'For spl pooja'],
    color: 'purple',
    icon: '🙏',
  },
  {
    key: 'coordinator',
    title: 'We pay to co ordinator',
    items: ['Post expenses', 'Salary for 2 ladies', 'Repair & maintenance work in temple'],
    color: 'blue',
    icon: '👥',
  },
  {
    key: 'bank',
    title: 'We remit to bank',
    items: ['For FD'],
    color: 'green',
    icon: '🏦',
  },
];

const EXPENSE_CATEGORY_GROUP_META: Record<ExpenseCategoryGroupKey, Omit<ExpenseCategoryGroup, 'key' | 'items'>> = {
  poojari: { title: 'We pay to poojari for', color: 'purple', icon: '🙏' },
  coordinator: { title: 'We pay to co ordinator', color: 'blue', icon: '👥' },
  bank: { title: 'We remit to bank', color: 'green', icon: '🏦' },
  other: { title: 'Other', color: 'gray', icon: '🧾' },
};

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

// Match by option name keyword (case-insensitive) or parent name keyword.
// Uses name substrings because DB codes are auto-generated slugs, not fixed values.
const POOJA_CARD_CONFIG: Array<{
  nameContains: string[];        // match if pooja_option_name.toLowerCase() includes any of these
  optionCodeContains: string[];  // match if option_code.toLowerCase() includes any of these
  parentCodeContains: string[];  // match if parent_code.toLowerCase() includes any of these
  parentNameContains: string[];  // match if parent_name.toLowerCase() includes any of these
  label: string;
  icon: string;
  accent: string;
  iconBg: string;
}> = [
  { nameContains: ['till oil', 'til oil', 'lamp'], optionCodeContains: ['gp1', 'till', 'til-oil'], parentCodeContains: [], parentNameContains: [], label: 'Till Oil', icon: '🪔', accent: '#92400E', iconBg: '#FEF3C7' },
  { nameContains: ['neivedhyam', 'nivedhyam', 'nitya neivedhyam'], optionCodeContains: ['gp6', 'neivedhyam', 'nivedhyam'], parentCodeContains: [], parentNameContains: [], label: 'Neivedhyam', icon: '🍚', accent: '#065F46', iconBg: '#ECFDF5' },
  { nameContains: ['navagraha'], optionCodeContains: ['gp3', 'navagraha'], parentCodeContains: [], parentNameContains: [], label: 'Navagraha Pooja', icon: '⭐', accent: '#1D4ED8', iconBg: '#EFF6FF' },
  { nameContains: ['pradosh', 'pradosha', 'pradosham'], optionCodeContains: ['gp2', 'pradosh'], parentCodeContains: [], parentNameContains: [], label: 'Pradosham Pooja', icon: '🌙', accent: '#5B21B6', iconBg: '#EDE9FE' },
  // "Kalabhairavar archana" (General) + all One Day Archana + all One Day Abishekam
  {
    nameContains: ['kalabhairavar', 'ayyanar koil', 'shivan koil', 'archana', 'abishekam', 'abhishekam'],
    optionCodeContains: ['gp5', 'archana', 'abishekam', 'abhishekam'],
    parentCodeContains: ['one-day', 'one_day', 'abishekam'],
    parentNameContains: ['archana', 'abishekam', 'abhishekam'],
    label: 'Archana & Abishekam',
    icon: '🌸',
    accent: '#BE185D',
    iconBg: '#FCE7F3',
  },
  {
    nameContains: ['mahashivratri', 'mahashivrathri', 'navaratri', 'navarathri', 'kumbabishekam', 'aarudhra', 'aarudra'],
    optionCodeContains: ['special'],
    parentCodeContains: ['special'],
    parentNameContains: ['special'],
    label: 'Special Pooja',
    icon: '✨',
    accent: '#B45309',
    iconBg: '#FFFBEB',
  },
];
type PoojaCardSummary = (typeof POOJA_CARD_CONFIG)[number] & { total: number; count: number; matchCodes: string[] };
type StatementRow = {
  key: string;
  label: string;
  total: number;
  donorAmountReceived: number | null;
  difference: number | null;
  amountPaid: number | null;
  dateLabel?: string;
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const buildMonthOptions = (): MonthOption[] => {
  const start = new Date(2025, 11, 1); // December 2025 (month is 0-indexed)
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), 1);
  const options: MonthOption[] = [];
  const cursor = new Date(end);
  while (cursor >= start) {
    options.push({
      label: MONTH_FORMATTER.format(cursor),
      value: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return options;
};

const normalizeExpenseRecords = (records: ExpenseRecordResponse[]): ExpenseRecord[] =>
  records.map((r) => ({ ...r, amount: Number(r.amount) }));

const normalizeExpenseCategoryGroupKey = (value: string | undefined): ExpenseCategoryGroupKey => {
  if (!value) return 'other';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'poojari' || normalized === 'coordinator' || normalized === 'bank' || normalized === 'other') {
    return normalized;
  }
  return 'other';
};

const buildExpenseCategoryGroups = (categories: ExpenseCategoryMaster[]): ExpenseCategoryGroup[] => {
  if (!categories.length) return [];
  const grouped = new Map<ExpenseCategoryGroupKey, string[]>();
  for (const category of categories) {
    if (!category.is_active) continue;
    const key = normalizeExpenseCategoryGroupKey(category.group_key);
    const items = grouped.get(key) ?? [];
    if (!items.includes(category.name)) items.push(category.name);
    grouped.set(key, items);
  }
  return (Object.keys(EXPENSE_CATEGORY_GROUP_META) as ExpenseCategoryGroupKey[])
    .map((key) => ({
      key,
      ...EXPENSE_CATEGORY_GROUP_META[key],
      items: grouped.get(key) ?? [],
    }))
    .filter((group) => group.items.length > 0);
};

const getCategoryGroup = (category: string, groups: ExpenseCategoryGroup[] = EXPENSE_CATEGORY_GROUPS) =>
  groups.find((g) => g.items.includes(category)) ?? EXPENSE_CATEGORY_GROUPS.find((g) => g.items.includes(category)) ?? null;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const formatDisplayDate = (date: string) => {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}-${month}-${year}`;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const maybeError = error as {
    response?: { data?: { detail?: string } | string };
    message?: string;
  };
  const detail = maybeError?.response?.data;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (detail && typeof detail === 'object' && typeof detail.detail === 'string' && detail.detail.trim()) {
    return detail.detail.trim();
  }
  if (typeof maybeError?.message === 'string' && maybeError.message.trim()) return maybeError.message.trim();
  return fallback;
};

const buildPoojaCardSummaries = (totals: PoojaOptionTotal[]): PoojaCardSummary[] => {
  const buckets: PoojaOptionTotal[][] = POOJA_CARD_CONFIG.map(() => []);
  for (const row of totals) {
    const name = row.pooja_option_name.toLowerCase();
    const optionCode = (row.option_code || '').toLowerCase();
    const parentCode = (row.parent_code || '').toLowerCase();
    const parentName = (row.parent_name || '').toLowerCase();
    const idx = POOJA_CARD_CONFIG.findIndex(
      (cfg) =>
        cfg.nameContains.some((kw) => name.includes(kw)) ||
        cfg.optionCodeContains.some((kw) => optionCode.includes(kw)) ||
        cfg.parentCodeContains.some((kw) => parentCode.includes(kw)) ||
        cfg.parentNameContains.some((kw) => parentName.includes(kw)),
    );
    if (idx >= 0) buckets[idx].push(row);
  }

  return POOJA_CARD_CONFIG.map((cfg, idx) => {
    const matching = buckets[idx];
    const total = matching.reduce((sum, row) => sum + Number(row.total_amount), 0);
    const count = matching.reduce((sum, row) => sum + row.registration_count, 0);
    const matchCodes = [...new Set(matching.map((row) => row.option_code).filter(Boolean))];
    return { ...cfg, total, count, matchCodes };
  });
};

const buildPoojaPaidCardSummaries = (totals: PoojaOptionPaidTotal[]): PoojaCardSummary[] =>
  buildPoojaCardSummaries(
    totals.map((row) => ({
      pooja_option_name: row.pooja_option_name,
      option_code: row.option_code,
      parent_code: row.parent_code,
      parent_name: row.parent_name,
      total_amount: row.paid_amount,
      registration_count: row.paid_donor_count,
    })),
  );

// ── Pooja option totals hook (filtered by active recurring plans in selected month) ─
const usePoojaOptionTotals = (month: string) => {
  const [totals, setTotals] = useState<PoojaOptionTotal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (m) params.month = m;
      const { data } = await api.get('/pooja/registrations/option-totals/', { params });
      setTotals(Array.isArray(data) ? data : []);
    } catch {
      setTotals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(month); }, [fetch, month]);

  return { totals, loading };
};

const usePoojaPaidOptionTotals = (month: string) => {
  const [totals, setTotals] = useState<PoojaOptionPaidTotal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (m) params.month = m;
      const { data } = await api.get('/pooja/registrations/paid-totals-by-option/', { params });
      setTotals(Array.isArray(data) ? data : []);
    } catch {
      setTotals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(month); }, [fetch, month]);

  return { totals, loading };
};

const useExpenseCategories = () => {
  const [categories, setCategories] = useState<ExpenseCategoryMaster[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payments/expense-categories/', {
        params: { active: 'true', ordering: 'group_key,display_order,name' },
      });
      const rows = extractResults<ExpenseCategoryMaster>(data);
      setCategories(Array.isArray(rows) ? rows : []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { categories, loading, refresh: fetch };
};

// ── Types ─────────────────────────────────────────────────────────────────────
type DonorByOptionEntry = {
  donor_id: number;
  donor_name: string;
  donor_phone: string;
  pooja_option_name: string;
  total_amount: string;
  start_date: string | null;
  registration_count?: number;
};

// ── Donors popup modal ────────────────────────────────────────────────────────
const DonorsByOptionModal = ({
  cardLabel,
  cardIcon,
  codes,
  showPoojaName,
  month,
  onClose,
}: {
  cardLabel: string;
  cardIcon: string;
  codes: string[];
  showPoojaName: boolean;
  month: string;
  onClose: () => void;
}) => {
  const [rows, setRows] = useState<DonorByOptionEntry[]>([]);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (codes.length) params.codes = codes.join(',');
        if (showPoojaName) params.include_pooja_names = '1';
        if (month) params.month = month;
        const { data } = await api.get('/pooja/registrations/donors-by-option/', { params });
        const nextRows = Array.isArray(data?.results) ? data.results : [];
        setRows(nextRows);
        setRegistrationCount(
          typeof data?.registration_count === 'number'
            ? data.registration_count
            : nextRows.length,
        );
      } catch {
        setError('Unable to load registrations.');
        setRegistrationCount(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [codes.join(','), showPoojaName, month]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.total_amount), 0), [rows]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: showPoojaName ? 760 : 560,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(15,23,42,0.22)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.primaryGhost, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            {cardIcon}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: C.fNunito, fontSize: 15, fontWeight: 800, color: C.ink, margin: 0 }}>{cardLabel}</p>
            <p style={{ fontFamily: C.fNunito, fontSize: 12, color: C.inkMuted, margin: 0 }}>Registered donors</p>
          </div>
          {!loading && rows.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: C.fMono, fontSize: 14, fontWeight: 700, color: C.primary, margin: 0 }}>{formatCurrency(total)}</p>
              <p style={{ fontFamily: C.fNunito, fontSize: 11, color: C.inkMuted, margin: 0 }}>
                {registrationCount} registration{registrationCount !== 1 ? 's' : ''} · {rows.length} donor{rows.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.inkMuted} strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontFamily: C.fNunito, fontSize: 13, color: C.inkMuted, margin: 0 }}>Loading…</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : error ? (
            <p style={{ padding: '32px 22px', textAlign: 'center', fontFamily: C.fNunito, fontSize: 13, color: '#991B1B', margin: 0 }}>{error}</p>
          ) : rows.length === 0 ? (
            <p style={{ padding: '40px 22px', textAlign: 'center', fontFamily: C.fNunito, fontSize: 14, color: C.inkMuted, margin: 0 }}>No registrations found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.surfaceInset, position: 'sticky', top: 0 }}>
                  {(showPoojaName ? ['#', 'Donor', 'Pooja Name', 'Donor ID', 'Amount'] : ['#', 'Donor', 'Donor ID', 'Amount']).map((h, i, arr) => (
                    <th key={h} style={{ padding: '9px 16px', textAlign: i === arr.length - 1 ? 'right' : 'left', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.donor_id} style={{ background: i % 2 === 0 ? '#fff' : C.surfaceInset }}>
                    <td style={{ padding: '10px 16px', fontFamily: C.fMono, fontSize: 12, color: C.inkMuted, borderBottom: `1px solid ${C.surfaceInset}` }}>{i + 1}</td>
                    <td style={{ padding: '10px 16px', borderBottom: `1px solid ${C.surfaceInset}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.primaryGhost, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.fNunito, fontSize: 12, fontWeight: 800, color: C.primary, flexShrink: 0 }}>
                          {(row.donor_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontFamily: C.fNunito, fontSize: 13, fontWeight: 600, color: C.ink }}>{row.donor_name}</span>
                      </div>
                    </td>
                    {showPoojaName && (
                      <td style={{ padding: '10px 16px', fontFamily: C.fNunito, fontSize: 12, color: C.inkMuted, borderBottom: `1px solid ${C.surfaceInset}`, maxWidth: 260 }}>
                        <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.pooja_option_name || '—'}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: '10px 16px', fontFamily: C.fMono, fontSize: 12, color: C.inkMuted, borderBottom: `1px solid ${C.surfaceInset}` }}>D{row.donor_id}</td>
                    <td style={{ padding: '10px 16px', fontFamily: C.fMono, fontSize: 13, fontWeight: 600, color: C.ink, textAlign: 'right', borderBottom: `1px solid ${C.surfaceInset}`, whiteSpace: 'nowrap' }}>{formatCurrency(Number(row.total_amount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: C.primaryGhost }}>
                  <td colSpan={showPoojaName ? 4 : 3} style={{ padding: '10px 16px', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Total — {registrationCount} registration{registrationCount !== 1 ? 's' : ''} · {rows.length} donor{rows.length !== 1 ? 's' : ''}
                  </td>
                  <td colSpan={1} style={{ padding: '10px 16px', fontFamily: C.fMono, fontSize: 14, fontWeight: 700, color: C.primary, textAlign: 'right' }}>
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Pooja Summary Cards ───────────────────────────────────────────────────────
const PoojaSummaryCards = ({
  totals,
  loading,
  month,
}: {
  totals: PoojaOptionTotal[];
  loading: boolean;
  month: string;
}) => {
  const [activeModal, setActiveModal] = useState<{ codes: string[]; label: string; icon: string; showPoojaName: boolean } | null>(null);

  // Assign each option-total row to the first matching card to avoid cross-card double counting.
  const cards = useMemo(() => buildPoojaCardSummaries(totals), [totals]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {POOJA_CARD_CONFIG.map((c) => (
          <div key={c.label} style={{ height: 96, borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.surfaceInset, animation: 'pulse 1.4s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              borderRadius: 14,
              border: `1.5px solid ${C.border}`,
              background: C.surface,
              padding: '14px 16px',
              boxShadow: '0 1px 6px rgba(15,23,42,0.06)',
            }}
          >
            {/* Icon + clickable count badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                {card.icon}
              </div>
              <button
                type="button"
                disabled={card.count === 0}
                onClick={() => card.count > 0 && setActiveModal({ codes: card.matchCodes, label: card.label, icon: card.icon, showPoojaName: card.label === 'Special Pooja' })}
                title={card.count > 0 ? `View ${card.count} registrations` : 'No registrations'}
                style={{
                  fontSize: 11, fontWeight: 700, color: card.count > 0 ? card.accent : C.inkMuted,
                  background: card.count > 0 ? card.iconBg : C.surfaceInset,
                  padding: '2px 8px', borderRadius: 20,
                  border: 'none',
                  cursor: card.count > 0 ? 'pointer' : 'default',
                  transition: 'opacity 0.15s',
                  textDecoration: card.count > 0 ? 'underline dotted' : 'none',
                }}
              >
                {card.count} reg
              </button>
            </div>
            {/* Amount */}
            <p style={{ fontFamily: C.fMono, fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 3px', lineHeight: 1.2 }}>
              {formatCurrency(card.total)}
            </p>
            {/* Label */}
            <p style={{ fontFamily: C.fNunito, fontSize: 11, fontWeight: 600, color: C.inkMuted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {activeModal && (
        <DonorsByOptionModal
          cardLabel={activeModal.label}
          cardIcon={activeModal.icon}
          codes={activeModal.codes}
          showPoojaName={activeModal.showPoojaName}
          month={month}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
};

const StatementTable = ({
  rows,
  viewingMonthLabel,
  loading,
}: {
  rows: StatementRow[];
  viewingMonthLabel: string;
  loading: boolean;
}) => (
  <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
    <div style={{ padding: '14px 20px', background: C.primaryGhost, borderBottom: `1.5px solid ${C.border}` }}>
      <span style={{ fontFamily: C.fNunito, fontSize: 15, fontWeight: 800, color: C.ink }}>Expense Statement</span>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '6%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '22%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '15%' }} />
      </colgroup>
      <thead>
        <tr style={{ background: C.surfaceInset }}>
          {['S.No', 'Date', 'Pooja Name', 'Pooja Amount Received', 'Donor Amount Received', 'Difference', 'Amount Paid'].map((h, i) => (
            <th
              key={h}
              style={{
                padding: '9px 10px',
                textAlign: i >= 3 ? 'right' : 'left',
                fontFamily: C.fNunito,
                fontSize: 11,
                fontWeight: 700,
                color: C.inkMuted,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                borderBottom: `1px solid ${C.border}`,
                whiteSpace: 'nowrap',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td
              colSpan={7}
              style={{ padding: '20px 10px', textAlign: 'center', fontFamily: C.fNunito, fontSize: 13, color: C.inkMuted, borderBottom: `1px solid ${C.surfaceInset}` }}
            >
              Loading statement rows...
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={row.key} style={{ background: index % 2 === 0 ? C.surface : '#F8FAFC' }}>
              <td style={{ padding: '11px 10px', fontFamily: C.fMono, fontSize: 12, color: C.inkMuted, borderBottom: `1px solid ${C.surfaceInset}` }}>{index + 1}</td>
              <td style={{ padding: '11px 10px', fontFamily: C.fNunito, fontSize: 13, color: C.inkMid, borderBottom: `1px solid ${C.surfaceInset}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.dateLabel ?? viewingMonthLabel}</td>
              <td style={{ padding: '11px 10px', fontFamily: C.fNunito, fontSize: 13, fontWeight: 700, color: C.ink, borderBottom: `1px solid ${C.surfaceInset}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.label}
              </td>
              <td style={{ padding: '11px 10px', fontFamily: C.fMono, fontSize: 13, fontWeight: 600, color: C.ink, textAlign: 'right', borderBottom: `1px solid ${C.surfaceInset}` }}>
                {row.amountPaid === null ? formatCurrency(row.total) : '-'}
              </td>
              <td style={{ padding: '11px 10px', fontFamily: C.fMono, fontSize: 13, fontWeight: 600, color: C.ink, textAlign: 'right', borderBottom: `1px solid ${C.surfaceInset}` }}>
                {row.donorAmountReceived === null ? '-' : formatCurrency(row.donorAmountReceived)}
              </td>
              <td style={{ padding: '11px 10px', fontFamily: C.fMono, fontSize: 13, fontWeight: 600, color: C.ink, textAlign: 'right', borderBottom: `1px solid ${C.surfaceInset}` }}>
                {row.difference === null ? '-' : formatCurrency(row.difference)}
              </td>
              <td style={{ padding: '11px 10px', fontFamily: C.fMono, fontSize: 13, fontWeight: 600, color: C.ink, textAlign: 'right', borderBottom: `1px solid ${C.surfaceInset}` }}>
                {row.amountPaid === null ? '-' : formatCurrency(row.amountPaid)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// ── Custom Hook ───────────────────────────────────────────────────────────────
const useExpenses = () => {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(() => monthOptions[0]?.value ?? '');
  const [monthlyExpenses, setMonthlyExpenses] = useState<ExpenseRecord[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyStatus, setMonthlyStatus] = useState('');
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  const fetchMonthlyExpenses = useCallback(async (month: string) => {
    if (!month) { setMonthlyExpenses([]); setMonthlyStatus('Pick a month to load totals.'); return; }
    setMonthlyLoading(true);
    try {
      const { data } = await api.get('/payments/expenses/', { params: { month } });
      const records = normalizeExpenseRecords(extractResults<ExpenseRecordResponse>(data));
      setMonthlyExpenses(records);
      const label = monthOptions.find((o) => o.value === month)?.label ?? month;
      const total = records.reduce((s, r) => s + r.amount, 0);
      setMonthlyStatus(
        records.length
          ? `${records.length} expense${records.length === 1 ? '' : 's'} · ${formatCurrency(total)} for ${label}`
          : `No expenses recorded yet for ${label}.`,
      );
    } catch { setMonthlyExpenses([]); setMonthlyStatus('Unable to load monthly expense data.'); }
    finally { setMonthlyLoading(false); }
  }, [monthOptions]);

  const saveExpense = useCallback(async (payload: ExpenseFormPayload): Promise<SaveExpenseResult> => {
    setIsSavingExpense(true);
    try {
      await api.post('/payments/expenses/', payload);
      await fetchMonthlyExpenses(selectedMonth);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to save expense.');
      setMonthlyStatus(message);
      return { ok: false, error: message };
    }
    finally { setIsSavingExpense(false); }
  }, [fetchMonthlyExpenses, selectedMonth]);

  const updateExpense = useCallback(async (expenseId: number, payload: ExpenseFormPayload): Promise<SaveExpenseResult> => {
    setIsSavingExpense(true);
    try {
      await api.patch(`/payments/expenses/${expenseId}/`, payload);
      await fetchMonthlyExpenses(selectedMonth);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to update expense.');
      setMonthlyStatus(message);
      return { ok: false, error: message };
    }
    finally { setIsSavingExpense(false); }
  }, [fetchMonthlyExpenses, selectedMonth]);

  const deleteExpense = useCallback(async (expenseId: number): Promise<SaveExpenseResult> => {
    setIsSavingExpense(true);
    try {
      await api.delete(`/payments/expenses/${expenseId}/`);
      await fetchMonthlyExpenses(selectedMonth);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to delete expense.');
      setMonthlyStatus(message);
      return { ok: false, error: message };
    }
    finally { setIsSavingExpense(false); }
  }, [fetchMonthlyExpenses, selectedMonth]);

  useEffect(() => { fetchMonthlyExpenses(selectedMonth); }, [selectedMonth, fetchMonthlyExpenses]);

  return {
    monthOptions,
    selectedMonth,
    setSelectedMonth,
    monthlyExpenses,
    monthlyLoading,
    monthlyStatus,
    isSavingExpense,
    fetchMonthlyExpenses,
    saveExpense,
    updateExpense,
    deleteExpense,
  };
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: 'transparent',
  surface: '#FFFFFF',
  surfaceInset: '#F8FAFC',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  primary: '#E65100',
  primaryHover: '#F57C00',
  primaryGhost: '#FFF3E0',
  ink: '#000000',
  inkMid: '#000000',
  inkMuted: '#000000',
  inkFaint: '#FDBA74',
  catPurple: { dot: '#EA580C', text: '#9A3412', bg: '#FFF7ED', border: '#FED7AA' },
  catBlue:   { dot: '#2563EB', text: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  catGreen:  { dot: '#059669', text: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
  catGray:   { dot: '#6B7280', text: '#374151', bg: '#F9FAFB', border: '#E5E7EB' },
  ok: '#065F46', okBg: '#ECFDF5', okBorder: '#6EE7B7',
  err: '#991B1B', errBg: '#FEF2F2', errBorder: '#FECACA',
  fNunito: 'inherit',
  fMono: 'inherit',
};

const getCat = (c: string) => ({ purple: C.catPurple, blue: C.catBlue, green: C.catGreen }[c] ?? C.catGray);

// ── Shared ────────────────────────────────────────────────────────────────────
const Dot = ({ color }: { color: string }) => (
  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
);

const CatPill = ({ category, categoryGroups }: { category: string; categoryGroups?: ExpenseCategoryGroup[] }) => {
  const g = getCategoryGroup(category, categoryGroups);
  const cat = getCat(g?.color ?? 'gray');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text, fontFamily: C.fNunito, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <Dot color={cat.dot} />
      {category}
    </span>
  );
};

// ── Entry Form ────────────────────────────────────────────────────────────────
const EntryForm = ({
  onCreate,
  onUpdate,
  editingExpense,
  onCancelEdit,
  isSaving,
  isReadOnly,
  selectedMonth,
  selectedMonthLabel,
  categoryGroups,
}: {
  onCreate: (p: ExpenseFormPayload) => Promise<SaveExpenseResult>;
  onUpdate: (expenseId: number, p: ExpenseFormPayload) => Promise<SaveExpenseResult>;
  editingExpense: ExpenseRecord | null;
  onCancelEdit: () => void;
  isSaving: boolean;
  isReadOnly: boolean;
  selectedMonth: string;
  selectedMonthLabel: string;
  categoryGroups: ExpenseCategoryGroup[];
}) => {
  const [vals, setVals] = useState({
    date: '',
    category: '',
    amount: '',
    transactionNo: '',
    comments: '',
    remarks: '',
  });
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const set = (k: keyof typeof vals, v: string) => setVals(p => ({ ...p, [k]: v }));
  const formDisabled = isSaving || isReadOnly;
  const selectedMonthMinDate = selectedMonth ? `${selectedMonth}-01` : undefined;
  const selectedMonthMaxDate = useMemo(() => {
    if (!selectedMonth) return undefined;
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return undefined;
    const lastDay = new Date(year, month, 0).getDate();
    return `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
  }, [selectedMonth]);

  useEffect(() => {
    if (!status) return;
    const timerId = window.setTimeout(() => setStatus(null), 5000);
    return () => window.clearTimeout(timerId);
  }, [status]);

  useEffect(() => {
    if (!editingExpense) {
      setVals({ date: '', category: '', amount: '', transactionNo: '', comments: '', remarks: '' });
      setShowNotes(false);
      return;
    }
    setVals({
      date: editingExpense.transaction_date ?? '',
      category: editingExpense.category ?? '',
      amount: editingExpense.amount != null ? String(editingExpense.amount) : '',
      transactionNo: editingExpense.transaction_no ?? '',
      comments: editingExpense.comments ?? '',
      remarks: editingExpense.remarks ?? '',
    });
    if (editingExpense.comments || editingExpense.remarks) setShowNotes(true);
  }, [editingExpense]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      setStatus({ msg: 'This admin account has read-only access.', ok: false });
      return;
    }
    if (!vals.date || !vals.category || !vals.amount) {
      setStatus({ msg: 'Fill in all three fields to continue.', ok: false });
      return;
    }
    if (!vals.date.startsWith(`${selectedMonth}-`)) {
      setStatus({ msg: `Transaction date must be within ${selectedMonthLabel}.`, ok: false });
      return;
    }
    const payload: ExpenseFormPayload = {
      transaction_date: vals.date,
      category: vals.category,
      amount: Number(vals.amount),
      transaction_no: vals.transactionNo.trim(),
      comments: vals.comments.trim(),
      remarks: vals.remarks.trim(),
    };
    const result = editingExpense ? await onUpdate(editingExpense.id, payload) : await onCreate(payload);
    if (result.ok) {
      setStatus({ msg: `${editingExpense ? 'Updated' : 'Saved'} ${formatCurrency(Number(vals.amount))} for "${vals.category}"`, ok: true });
      setVals({ date: '', category: '', amount: '', transactionNo: '', comments: '', remarks: '' });
      if (editingExpense) onCancelEdit();
    } else {
      setStatus({ msg: result.error || 'Save failed. Please try again.', ok: false });
    }
  };

  const selectedGroup = vals.category ? getCategoryGroup(vals.category, categoryGroups) : null;
  const selectedCat = getCat(selectedGroup?.color ?? 'gray');

  const field: CSSProperties = {
    width: '100%', padding: '10px 13px', border: `1.5px solid ${C.border}`, borderRadius: 10,
    background: C.surfaceInset, fontFamily: C.fNunito, fontSize: 14, color: C.ink,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>

      {/* Header strip */}
      <div style={{ padding: '14px 20px', background: C.primaryGhost, borderBottom: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </div>
        <span style={{ fontFamily: C.fNunito, fontSize: 15, fontWeight: 800, color: C.ink }}>
          {editingExpense ? `Edit Entry #${editingExpense.id}` : 'New Expense Entry'}
        </span>
      </div>

      <form onSubmit={submit} style={{ padding: '20px' }}>
        {isReadOnly && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: C.surfaceInset, border: `1px solid ${C.border}`, fontFamily: C.fNunito, fontSize: 12, color: C.inkMuted }}>
            This admin account has read-only access. Expense creation is disabled.
          </div>
        )}

        {/* Section label: Required */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: C.fNunito, fontSize: 10, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>Required</span>
        </div>

        {/* Date + Amount — two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
              Date
            </label>
            <input
              type="date"
              value={vals.date}
              onChange={e => set('date', e.target.value)}
              min={selectedMonthMinDate}
              max={selectedMonthMaxDate}
              onKeyDown={e => { if (e.key !== 'Tab') e.preventDefault(); }}
              onPaste={e => e.preventDefault()}
              onDrop={e => e.preventDefault()}
              disabled={formDisabled}
              style={{ ...field, cursor: 'pointer', fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
              Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={vals.amount}
              onChange={e => set('amount', e.target.value)}
              onKeyDown={e => {
                const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','.'];
                if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
              }}
              disabled={formDisabled}
              placeholder="0.00"
              style={{ ...field, fontFamily: C.fMono, fontSize: 15, fontWeight: 500 }}
            />
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
            Category
          </label>
          <select value={vals.category} onChange={e => set('category', e.target.value)} disabled={formDisabled} style={{ ...field, appearance: 'none', cursor: 'pointer' }}>
            <option value="">Choose a category…</option>
            {categoryGroups.map(g => (
              <optgroup key={g.title} label={`${g.icon}  ${g.title}`}>
                {g.items.map(item => <option key={item} value={item}>{item}</option>)}
              </optgroup>
            ))}
          </select>
          {selectedGroup && (
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: selectedCat.bg, border: `1px solid ${selectedCat.border}`, color: selectedCat.text, fontFamily: C.fNunito, fontSize: 11, fontWeight: 700 }}>
              {selectedGroup.icon} {selectedGroup.title}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.border, margin: '0 0 14px' }} />

        {/* Section label: Optional */}
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontFamily: C.fNunito, fontSize: 10, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>Optional</span>
        </div>

        {/* Transaction No */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
            Transaction No
          </label>
          <input
            type="text"
            value={vals.transactionNo}
            onChange={e => set('transactionNo', e.target.value)}
            disabled={formDisabled}
            placeholder="Enter transaction number"
            style={field}
          />
        </div>

        {/* Notes toggle (Comments + Remarks) */}
        <div style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setShowNotes(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: showNotes ? C.primary : C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ transform: showNotes ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {showNotes ? 'Hide Notes' : 'Add Notes (comments & remarks)'}
          </button>

          {showNotes && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                  Comments
                </label>
                <textarea
                  value={vals.comments}
                  onChange={e => set('comments', e.target.value)}
                  disabled={formDisabled}
                  placeholder="Add comments"
                  rows={2}
                  style={{ ...field, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                  Remarks
                </label>
                <textarea
                  value={vals.remarks}
                  onChange={e => set('remarks', e.target.value)}
                  disabled={formDisabled}
                  placeholder="Add remarks"
                  rows={2}
                  style={{ ...field, resize: 'vertical' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <button type="submit" disabled={formDisabled} style={{ width: '100%', padding: '12px', background: formDisabled ? C.inkFaint : C.primary, color: '#fff', border: 'none', borderRadius: 10, fontFamily: C.fNunito, fontSize: 14, fontWeight: 800, cursor: formDisabled ? 'not-allowed' : 'pointer', letterSpacing: '0.02em', transition: 'background 0.15s' }}>
          {isReadOnly ? 'Read-only access' : isSaving ? (editingExpense ? 'Updating…' : 'Saving…') : (editingExpense ? '✓  Update Expense' : '✓  Save Expense')}
        </button>

        {editingExpense && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={formDisabled}
            style={{ width: '100%', marginTop: 8, padding: '10px', background: 'transparent', color: C.inkMid, border: `1.5px solid ${C.borderStrong}`, borderRadius: 10, fontFamily: C.fNunito, fontSize: 13, fontWeight: 700, cursor: formDisabled ? 'not-allowed' : 'pointer' }}
          >
            Cancel Edit
          </button>
        )}

        {/* Status */}
        {status && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: status.ok ? C.okBg : C.errBg, border: `1px solid ${status.ok ? C.okBorder : C.errBorder}`, color: status.ok ? C.ok : C.err, fontFamily: C.fNunito, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{status.ok ? '✓' : '!'}</span>
            {status.msg}
          </div>
        )}
      </form>
    </div>
  );
};

// ── Records panel ─────────────────────────────────────────────────────────────
const RecordsPanel = ({
  expenses,
  loading,
  readOnly,
  editingExpenseId,
  deletingExpenseId,
  onEdit,
  onDelete,
  categoryGroups,
}: {
  expenses: ExpenseRecord[];
  loading: boolean;
  readOnly: boolean;
  editingExpenseId: number | null;
  deletingExpenseId: number | null;
  onEdit: (expense: ExpenseRecord) => void;
  onDelete: (expense: ExpenseRecord) => void;
  categoryGroups: ExpenseCategoryGroup[];
}) => {
  const total = useMemo(() => expenses.reduce((s, r) => s + r.amount, 0), [expenses]);

  if (loading) return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
      <p style={{ fontFamily: C.fNunito, fontSize: 14, color: C.inkMuted, margin: 0 }}>Loading records…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!expenses.length) return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: '56px 32px', textAlign: 'center', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.primaryGhost, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke={C.inkFaint} strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p style={{ fontFamily: C.fNunito, fontSize: 18, fontWeight: 800, color: C.inkMid, margin: '0 0 6px' }}>No expenses this month</p>
      <p style={{ fontFamily: C.fNunito, fontSize: 13, color: C.inkMuted, margin: 0 }}>No expenses recorded for this period.</p>
    </div>
  );

  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>

      {/* Panel header */}
      <div style={{ padding: '14px 20px', background: C.primaryGhost, borderBottom: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: C.fNunito, fontSize: 15, fontWeight: 800, color: C.ink }}>Transactions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: C.fMono, fontSize: 13, fontWeight: 600, color: C.primary }}>{formatCurrency(total)}</span>
          <span style={{ fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, background: C.border, padding: '2px 8px', borderRadius: 20 }}>{expenses.length} entries</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.surfaceInset }}>
              {['#', 'Date', 'Category', 'Txn No', 'Amount', ''].map((h, i) => (
                <th key={i} style={{ padding: '9px 14px', textAlign: i === 4 ? 'right' : 'left', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, i) => {
          const g = getCategoryGroup(exp.category, categoryGroups);
              const cat = getCat(g?.color ?? 'gray');
              const isEditingRow = editingExpenseId === exp.id;
              const isDeletingRow = deletingExpenseId === exp.id;
              return (
                <tr key={exp.id} style={{ background: isEditingRow ? '#FFF7ED' : i % 2 === 0 ? C.surface : '#F8FAFC' }}>
                  <td style={{ padding: '11px 14px', fontFamily: C.fMono, fontSize: 12, color: C.inkMuted, borderBottom: `1px solid ${C.surfaceInset}`, width: 36 }}>{i + 1}</td>
                  <td style={{ padding: '11px 14px', fontFamily: C.fMono, fontSize: 12, color: C.inkMid, borderBottom: `1px solid ${C.surfaceInset}`, whiteSpace: 'nowrap' }}>{formatDisplayDate(exp.transaction_date)}</td>
                  <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.surfaceInset}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: cat.bg, border: `1px solid ${cat.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                        {g?.icon ?? '💰'}
                      </div>
                      <div>
                        <p style={{ fontFamily: C.fNunito, fontSize: 13, fontWeight: 700, color: C.ink, margin: 0, whiteSpace: 'nowrap' }}>{exp.category}</p>
                        <p style={{ fontFamily: C.fNunito, fontSize: 10, color: C.inkMuted, margin: 0 }}>{g?.title ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', fontFamily: C.fMono, fontSize: 12, color: C.inkMuted, borderBottom: `1px solid ${C.surfaceInset}`, whiteSpace: 'nowrap' }}>
                    {exp.transaction_no || '—'}
                  </td>
                  <td style={{ padding: '11px 14px', fontFamily: C.fMono, fontSize: 13, fontWeight: 600, color: C.ink, textAlign: 'right', borderBottom: `1px solid ${C.surfaceInset}`, whiteSpace: 'nowrap' }}>
                    {formatCurrency(exp.amount)}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.surfaceInset}`, whiteSpace: 'nowrap' }}>
                    {!readOnly && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => onEdit(exp)}
                          disabled={isDeletingRow}
                          style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.borderStrong}`, background: isEditingRow ? C.primaryGhost : '#fff', color: isEditingRow ? C.primary : C.inkMid, fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, cursor: isDeletingRow ? 'not-allowed' : 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(exp)}
                          disabled={isDeletingRow}
                          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, cursor: isDeletingRow ? 'not-allowed' : 'pointer', opacity: isDeletingRow ? 0.7 : 1 }}
                        >
                          {isDeletingRow ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: C.primaryGhost }}>
              <td colSpan={4} style={{ padding: '11px 14px', fontFamily: C.fNunito, fontSize: 12, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total — {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
              </td>
              <td style={{ padding: '11px 14px', fontFamily: C.fMono, fontSize: 15, fontWeight: 700, color: C.primary, textAlign: 'right' }}>
                {formatCurrency(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ── Monthly Tracker ───────────────────────────────────────────────────────────
const MonthlyTracker = ({
  expenses, monthOptions, selectedMonth, onMonthChange, onRefresh, statusMessage, isLoading, categoryGroups,
}: {
  expenses: ExpenseRecord[]; monthOptions: MonthOption[]; selectedMonth: string;
  onMonthChange: (v: string) => void; onRefresh: () => void; statusMessage: string; isLoading: boolean;
  categoryGroups: ExpenseCategoryGroup[];
}) => {
  const total = useMemo(() => expenses.reduce((s, r) => s + r.amount, 0), [expenses]);

  const groups = useMemo(() => {
    const map: Record<string, { title: string; icon: string; color: string; total: number; count: number }> = {};
    for (const exp of expenses) {
      const g = getCategoryGroup(exp.category, categoryGroups);
      const key = g?.title ?? 'Other';
      if (!map[key]) map[key] = { title: key, icon: g?.icon ?? '💰', color: g?.color ?? 'gray', total: 0, count: 0 };
      map[key].total += exp.amount;
      map[key].count++;
    }
    return Object.values(map);
  }, [expenses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Controls + summary row */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>

        {/* Month selector card */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: '18px 20px', flex: '1 1 240px', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
          <label style={{ display: 'block', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Viewing Month</label>
          <select value={selectedMonth} onChange={e => onMonthChange(e.target.value)} style={{ width: '100%', padding: '10px 13px', border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.surfaceInset, fontFamily: C.fNunito, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={onRefresh} disabled={isLoading} type="button" style={{ marginTop: 10, width: '100%', padding: '9px', background: 'transparent', border: `1.5px solid ${C.border}`, borderRadius: 10, fontFamily: C.fNunito, fontSize: 13, fontWeight: 700, color: C.inkMid, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {isLoading ? 'Refreshing…' : 'Refresh Data'}
          </button>
        </div>

        {/* Total card */}
        <div style={{ background: C.primary, borderRadius: 16, padding: '18px 24px', flex: '1 1 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 4px 20px rgba(230,81,0,0.24)' }}>
          <p style={{ fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>Monthly Total</p>
          <p style={{ fontFamily: C.fMono, fontSize: 30, fontWeight: 600, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1 }}>{formatCurrency(total)}</p>
          <p style={{ fontFamily: C.fNunito, fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded</p>
        </div>

        {/* Category summary cards */}
        {groups.map(g => {
          const cat = getCat(g.color);
          const pct = total > 0 ? (g.total / total) * 100 : 0;
          return (
            <div key={g.title} style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${cat.border}`, padding: '18px 20px', flex: '1 1 180px', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{g.icon}</span>
                <span style={{ fontFamily: C.fNunito, fontSize: 12, fontWeight: 700, color: cat.text }}>{g.count} entr{g.count === 1 ? 'y' : 'ies'}</span>
              </div>
              <p style={{ fontFamily: C.fMono, fontSize: 17, fontWeight: 700, color: cat.text, margin: '0 0 10px' }}>{formatCurrency(g.total)}</p>
              <div style={{ height: 5, background: cat.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: cat.dot, borderRadius: 3, transition: 'width .5s ease' }} />
              </div>
              <p style={{ fontFamily: C.fNunito, fontSize: 10, fontWeight: 700, color: cat.text, opacity: 0.7, margin: '5px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</p>
            </div>
          );
        })}
      </div>

      {/* Status line */}
      {statusMessage && (
        <p style={{ fontFamily: C.fNunito, fontSize: 13, color: C.inkMuted, margin: 0, padding: '0 4px' }}>{statusMessage}</p>
      )}

      {/* Transaction table */}
      {expenses.length > 0 ? (
        <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
          <div style={{ padding: '14px 20px', background: C.primaryGhost, borderBottom: `1.5px solid ${C.border}` }}>
            <span style={{ fontFamily: C.fNunito, fontSize: 15, fontWeight: 800, color: C.ink }}>All Transactions</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.surfaceInset }}>
                {['Date', 'Category', 'Amount'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: i === 2 ? 'right' : 'left', fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => (
                <tr key={exp.id} style={{ background: i % 2 === 0 ? C.surface : '#F8FAFC' }}>
                  <td style={{ padding: '12px 20px', fontFamily: C.fMono, fontSize: 13, color: C.inkMid, borderBottom: `1px solid ${C.surfaceInset}`, whiteSpace: 'nowrap' }}>{formatDisplayDate(exp.transaction_date)}</td>
                  <td style={{ padding: '12px 20px', borderBottom: `1px solid ${C.surfaceInset}` }}><CatPill category={exp.category} categoryGroups={categoryGroups} /></td>
                  <td style={{ padding: '12px 20px', fontFamily: C.fMono, fontSize: 14, fontWeight: 600, color: C.ink, textAlign: 'right', borderBottom: `1px solid ${C.surfaceInset}` }}>{formatCurrency(exp.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.primaryGhost }}>
                <td colSpan={2} style={{ padding: '12px 20px', fontFamily: C.fNunito, fontSize: 12, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly Total</td>
                <td style={{ padding: '12px 20px', fontFamily: C.fMono, fontSize: 15, fontWeight: 700, color: C.primary, textAlign: 'right' }}>{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : !isLoading && (
        <div style={{ background: C.surface, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: '48px 32px', textAlign: 'center', boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
          <p style={{ fontFamily: C.fNunito, fontSize: 18, fontWeight: 800, color: C.inkMid, margin: '0 0 6px' }}>No data for this month</p>
          <p style={{ fontFamily: C.fNunito, fontSize: 13, color: C.inkMuted, margin: 0 }}>Switch to Data Entry to add expenses for this period.</p>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const ExpensesPage = () => {
  const [activeTab, setActiveTab] = useState<'statement' | 'data' | 'tracking'>('statement');
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const authUser = useAuthStore((state) => state.user);
  const readOnlyAdmin = isReadOnlyAdmin(authUser);

  const {
    monthOptions,
    selectedMonth,
    setSelectedMonth,
    monthlyExpenses,
    monthlyLoading,
    monthlyStatus,
    isSavingExpense,
    fetchMonthlyExpenses,
    saveExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses();
  const { categories: expenseCategories } = useExpenseCategories();
  const { totals: poojaOptionTotals, loading: poojaOptionLoading } = usePoojaOptionTotals(selectedMonth);
  const { totals: poojaPaidOptionTotals, loading: poojaPaidOptionLoading } = usePoojaPaidOptionTotals(selectedMonth);
  const expenseCategoryGroups = useMemo(() => {
    const dynamicGroups = buildExpenseCategoryGroups(expenseCategories);
    return dynamicGroups.length ? dynamicGroups : EXPENSE_CATEGORY_GROUPS;
  }, [expenseCategories]);
  const statementRows = useMemo(() => {
    const poojaRows = buildPoojaCardSummaries(poojaOptionTotals);
    const paidRows = buildPoojaPaidCardSummaries(poojaPaidOptionTotals);
    const paidByLabel = new Map(paidRows.map((row) => [row.label, row.total]));
    const rows = poojaRows.map((row) => {
      const donorAmountReceived = paidByLabel.get(row.label) ?? 0;
      return {
        key: `pooja-${row.label}`,
        label: row.label,
        total: row.total,
        donorAmountReceived,
        difference: row.total - donorAmountReceived,
        amountPaid: null,
      };
    });
    rows.push(
      ...monthlyExpenses.map((expense) => ({
        key: `expense-${expense.id}`,
        label: expense.category,
        total: expense.amount,
        donorAmountReceived: null,
        difference: null,
        amountPaid: expense.amount,
        dateLabel: formatDisplayDate(expense.transaction_date),
      })),
    );
    return rows;
  }, [poojaOptionTotals, poojaPaidOptionTotals, monthlyExpenses]);
  const selectedMonthLabel = useMemo(
    () => monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth,
    [monthOptions, selectedMonth],
  );

  useEffect(() => {
    if (!editingExpense) return;
    if (!monthlyExpenses.some((expense) => expense.id === editingExpense.id)) {
      setEditingExpense(null);
    }
  }, [monthlyExpenses, editingExpense]);

  const handleCreate = async (payload: ExpenseFormPayload) => {
    const result = await saveExpense(payload);
    if (result.ok) setActiveTab('data');
    return result;
  };

  const handleUpdate = async (expenseId: number, payload: ExpenseFormPayload) => {
    const result = await updateExpense(expenseId, payload);
    if (result.ok) {
      setActiveTab('data');
      setEditingExpense(null);
    }
    return result;
  };

  const handleDelete = async (expense: ExpenseRecord) => {
    if (readOnlyAdmin) return;
    const confirmDelete = window.confirm(
      `Delete expense "${expense.category}" (${formatCurrency(expense.amount)}) on ${formatDisplayDate(expense.transaction_date)}?`,
    );
    if (!confirmDelete) return;
    setDeletingExpenseId(expense.id);
    const result = await deleteExpense(expense.id);
    if (result.ok && editingExpense?.id === expense.id) {
      setEditingExpense(null);
    }
    setDeletingExpenseId(null);
  };

  return (
    <div style={{ fontFamily: C.fNunito, paddingBottom: 40 }}>

        {/* Page header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: C.fNunito, fontSize: 28, fontWeight: 800, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Expense Management</h1>
            <p style={{ fontFamily: C.fNunito, fontSize: 14, color: C.inkMuted, margin: 0 }}>Track and manage all temple expenses</p>
          </div>
          {/* Pill tab switcher */}
          <div style={{ display: 'flex', background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 4, gap: 4, boxShadow: '0 1px 4px rgba(15,23,42,0.08)' }}>
            {[{ key: 'statement', label: '🧾  Statement' }, { key: 'data', label: '📋  Data Entry' }, { key: 'tracking', label: '📊  Monthly Tracker' }].map(({ key, label }) => {
              const active = activeTab === key;
              return (
                <button key={key} type="button" onClick={() => setActiveTab(key as 'statement' | 'data' | 'tracking')}
                  style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: active ? C.primary : 'transparent', color: active ? '#fff' : C.inkMuted, fontFamily: C.fNunito, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', boxShadow: active ? '0 2px 8px rgba(230,81,0,0.25)' : 'none' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Statement: month picker + donor summary cards */}
        {activeTab === 'statement' && (
          <>
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontFamily: C.fNunito, fontSize: 12, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Viewing Month
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ padding: '8px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.surface, fontFamily: C.fNunito, fontSize: 14, fontWeight: 700, color: C.ink, outline: 'none', cursor: 'pointer', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
              >
                {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <span style={{ fontFamily: C.fNunito, fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Donor Registrations — Total by Pooja (Active This Month)
              </span>
            </div>
            <PoojaSummaryCards totals={poojaOptionTotals} loading={poojaOptionLoading} month={selectedMonth} />
            <StatementTable rows={statementRows} viewingMonthLabel={selectedMonthLabel} loading={poojaOptionLoading || poojaPaidOptionLoading || monthlyLoading} />
          </>
        )}

        {/* Data Entry: side-by-side form & records */}
        {activeTab === 'data' && (
          <>
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontFamily: C.fNunito, fontSize: 12, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Viewing Month
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ padding: '8px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.surface, fontFamily: C.fNunito, fontSize: 14, fontWeight: 700, color: C.ink, outline: 'none', cursor: 'pointer', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
              >
                {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* ── Entry form + transactions ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'start' }}>
              <div style={{ flex: '0 0 340px', maxWidth: '100%' }}>
                <EntryForm
                  onCreate={handleCreate}
                  onUpdate={handleUpdate}
                  editingExpense={editingExpense}
                  onCancelEdit={() => setEditingExpense(null)}
                  isSaving={isSavingExpense}
                  isReadOnly={readOnlyAdmin}
                  selectedMonth={selectedMonth}
                  selectedMonthLabel={selectedMonthLabel}
                  categoryGroups={expenseCategoryGroups}
                />
              </div>
              <div style={{ flex: '1 1 400px', minWidth: 0 }}>
                <RecordsPanel
                  expenses={monthlyExpenses}
                  loading={monthlyLoading}
                  readOnly={readOnlyAdmin}
                  editingExpenseId={editingExpense?.id ?? null}
                  deletingExpenseId={deletingExpenseId}
                  onEdit={(expense) => setEditingExpense(expense)}
                  onDelete={handleDelete}
                  categoryGroups={expenseCategoryGroups}
                />
              </div>
            </div>
          </>
        )}

        {/* Monthly Tracker */}
        {activeTab === 'tracking' && (
          <MonthlyTracker
            expenses={monthlyExpenses} monthOptions={monthOptions} selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth} onRefresh={() => fetchMonthlyExpenses(selectedMonth)}
            statusMessage={monthlyStatus} isLoading={monthlyLoading} categoryGroups={expenseCategoryGroups}
          />
        )}
    </div>
  );
};

export default ExpensesPage;
