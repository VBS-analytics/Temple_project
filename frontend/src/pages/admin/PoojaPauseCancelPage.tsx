import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import api, { extractResults } from '../../lib/api';

interface DonorListEntry {
  id: number;
  name: string;
  phone_number: string;
}

interface DonorSearchDropdownProps {
  options: DonorListEntry[];
  selectedId: number | null;
  onSelectId: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}

const DonorSearchDropdown = ({
  options,
  selectedId,
  onSelectId,
  placeholder = 'Search by name or phone',
  className,
}: DonorSearchDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    },
    [],
  );

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, handleClickOutside, handleEscape]);

  useEffect(() => {
    if (!open) setSearchTerm('');
  }, [open]);

  const normalized = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return options;
    return options.filter((option) => {
      const label = `${option.name} — ${option.phone_number}`.toLowerCase();
      return label.includes(normalized);
    });
  }, [options, normalized]);

  const selectedLabel = options.find((donor) => donor.id === selectedId);

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={options.length === 0}
        className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition-all hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Search icon */}
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <span className={`flex-1 truncate text-sm ${selectedLabel ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
          {selectedLabel ? `${selectedLabel.name} — ${selectedLabel.phone_number}` : placeholder}
        </span>
        {selectedLabel && (
          <span
            role="button"
            aria-label="Clear selection"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelectId(null); } }}
            onClick={(e) => { e.stopPropagation(); onSelectId(null); }}
            className="flex-shrink-0 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
        <svg className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80">
          <div className="p-2 border-b border-slate-100">
            <input
              type="search"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search…"
              className="w-full rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-auto">
            {filtered.length > 0 ? (
              <ul>
                {filtered.map((donor) => (
                  <li key={`donor-option-${donor.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
                      onClick={() => { onSelectId(donor.id); setOpen(false); }}
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {donor.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{donor.name}</p>
                        <p className="truncate text-xs text-slate-400">{donor.phone_number}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">No donors match your search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface RecurringPlan {
  id: number;
  donor_name?: string | null;
  pooja_option_name?: string | null;
  pooja_option_code?: string | null;
  day_option_description?: string | null;
  day_option_code?: string | null;
  recurrence_kind: 'recurring';
  recurrence_frequency?: string | null;
  amount?: string | number | null;
  is_active: boolean;
  pause_until?: string | null;
  pause_from?: string | null;
  metadata?: Record<string, unknown>;
  origin_registration_created_at?: string | null;
  members?: unknown;
}

interface PlanEditFormState {
  recurrence_frequency: string;
  amount: string;
}

const PAUSE_REASON_OPTIONS = [
  'No Pooja and No Payment',
  'No Pooja and use money for temple purpose',
  "Continue the pooja with Samy's names",
];

const PLAN_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const createInitialPlanEditState = (): PlanEditFormState => ({
  recurrence_frequency: 'monthly',
  amount: '',
});

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatPlanAmount = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
};

const todayIso = () => new Date().toISOString().split('T')[0];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getPlanMemberNames = (metadata?: Record<string, unknown>) => {
  if (!metadata) return [];
  const members = (metadata as { members?: unknown }).members;
  if (!Array.isArray(members)) return [];
  return members
    .map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { name?: string | null }).name : null))
    .filter((name): name is string => Boolean(name && name.trim()))
    .map((name) => name.trim());
};

const formatPlanFrequencyLabel = (frequency?: string | null) => {
  if (!frequency) return 'Recurring';
  const label = frequency === 'monthly' ? 'Monthly' : frequency === 'quarterly' ? 'Quarterly' : frequency === 'annually' ? 'Annually' : frequency;
  return `${label} recurring`;
};

const extractErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (typeof responseData === 'string') return responseData.trim();
    if (isRecord(responseData)) {
      if ('detail' in responseData && typeof responseData.detail === 'string') return responseData.detail;
      const values = Object.values(responseData);
      if (values.length > 0) {
        const first = values[0];
        if (Array.isArray(first)) return first.join(', ');
        if (typeof first === 'string') return first;
      }
    }
    return error.message || 'Unexpected error';
  }
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
};

/* ─── Status badge ─────────────────────────────────────────────────────── */
const PlanStatusBadge = ({ plan }: { plan: RecurringPlan }) => {
  if (!plan.is_active && !plan.pause_from && !plan.pause_until) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Cancelled
      </span>
    );
  }
  if (plan.pause_from || plan.pause_until) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
};

/* ─── Frequency badge ───────────────────────────────────────────────────── */
const FrequencyBadge = ({ frequency }: { frequency?: string | null }) => (
  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
    {formatPlanFrequencyLabel(frequency)}
  </span>
);

/* ─── Page ──────────────────────────────────────────────────────────────── */
const PoojaPauseCancelPage = () => {
  const [donors, setDonors] = useState<DonorListEntry[]>([]);
  const [donorLoading, setDonorLoading] = useState(true);
  const [donorError, setDonorError] = useState<string | null>(null);
  const [selectedDonorId, setSelectedDonorId] = useState<number | null>(null);
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [pauseFromDates, setPauseFromDates] = useState<Record<number, string>>({});
  const [pauseToDates, setPauseToDates] = useState<Record<number, string>>({});
  const [pauseReasonSelections, setPauseReasonSelections] = useState<Record<number, string>>({});
  const [activePausePlanId, setActivePausePlanId] = useState<number | null>(null);
  const [planActionState, setPlanActionState] = useState<Record<number, 'pause' | 'resume' | 'cancel' | 'rerun' | null>>({});
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planEditValues, setPlanEditValues] = useState<PlanEditFormState>(createInitialPlanEditState);
  const [planEditSubmitting, setPlanEditSubmitting] = useState(false);

  useEffect(() => {
    const loadDonors = async () => {
      setDonorLoading(true);
      setDonorError(null);
      try {
        const response = await api.get('auth/donors/', { params: { page_size: 500 } });
        const payload = Array.isArray(response.data)
          ? response.data
          : Array.isArray((response.data as any)?.results)
            ? (response.data as any).results
            : [];
        const donorsMap = new Map<number, DonorListEntry>();
        payload.forEach((entry: any) => {
          const user = entry?.user ?? entry;
          const id = typeof entry?.id === 'number' ? entry.id : user?.id;
          if (typeof id !== 'number') return;
          const name = (user?.name ?? '').trim() || 'Unnamed donor';
          const phone = (user?.phone_number ?? '').trim() || '—';
          donorsMap.set(id, { id, name, phone_number: phone });
        });
        setDonors(Array.from(donorsMap.values()));
      } catch (error) {
        setDonorError(extractErrorMessage(error));
      } finally {
        setDonorLoading(false);
      }
    };
    loadDonors();
  }, []);

  const loadPlans = useCallback(async () => {
    const showingAllPaused = selectedDonorId === null;
    setPlansLoading(true);
    setPlansError(null);
    try {
      const response = await api.get('pooja/recurrence/plans/', {
        params: showingAllPaused
          ? { page_size: 1000, paused_only: true, recurring_only: true }
          : { page_size: 1000, donor: selectedDonorId, recurring_only: true },
      });
      const allPlans = extractResults<RecurringPlan>(response.data);
      const recurringPlans = allPlans.filter((plan) => plan.recurrence_kind === 'recurring');
      setPlans(
        showingAllPaused
          ? recurringPlans.filter((plan) => Boolean(plan.pause_from || plan.pause_until))
          : recurringPlans,
      );
    } catch (error) {
      setPlans([]);
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlansLoading(false);
    }
  }, [selectedDonorId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const togglePauseForm = (planId: number) => {
    setActivePausePlanId((prev) => (prev === planId ? null : planId));
    setPauseReasonSelections((prev) => ({ ...prev, [planId]: prev[planId] ?? PAUSE_REASON_OPTIONS[0] }));
    setPauseFromDates((prev) => ({ ...prev, [planId]: prev[planId] ?? todayIso() }));
    setPauseToDates((prev) => ({ ...prev, [planId]: prev[planId] ?? '' }));
  };

  const startEditingPlan = (plan: RecurringPlan) => {
    setEditingPlanId(plan.id);
    setPlanEditValues({
      recurrence_frequency: plan.recurrence_frequency ?? 'monthly',
      amount: plan.amount != null ? String(plan.amount) : '',
    });
    setPlansError(null);
  };

  const cancelPlanEditing = useCallback(() => {
    setEditingPlanId(null);
    setPlanEditValues(createInitialPlanEditState());
  }, []);

  const handlePlanEditChange = useCallback((field: keyof PlanEditFormState, value: string) => {
    setPlanEditValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handlePlanEditSave = useCallback(async () => {
    if (editingPlanId === null) return;
    const payload: Record<string, string> = {};
    if (planEditValues.recurrence_frequency) payload.recurrence_frequency = planEditValues.recurrence_frequency;
    const amountValue = planEditValues.amount.trim();
    if (amountValue) payload.amount = amountValue;
    if (Object.keys(payload).length === 0) { setPlansError('Update at least one field.'); return; }
    setPlanEditSubmitting(true);
    setPlansError(null);
    try {
      await api.patch(`pooja/recurrence/plans/${editingPlanId}/`, payload);
      await loadPlans();
      cancelPlanEditing();
    } catch (error) {
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlanEditSubmitting(false);
    }
  }, [cancelPlanEditing, editingPlanId, loadPlans, planEditValues]);

  useEffect(() => { cancelPlanEditing(); }, [selectedDonorId, cancelPlanEditing]);

  const handlePausePlan = async (planId: number, reason: string, fromDate: string, toDate: string) => {
    if (!reason.trim()) return;
    if (!fromDate || !toDate) { setPlansError('Select both effective from and effective to dates.'); return; }
    if (toDate <= fromDate) { setPlansError('Effective to date must be after effective from date.'); return; }
    setPlanActionState((prev) => ({ ...prev, [planId]: 'pause' }));
    setPlansError(null);
    try {
      await api.post(`pooja/recurrence/plans/${planId}/pause/`, {
        pause_from: fromDate,
        pause_until: toDate,
        pause_reason: reason,
      });
      await loadPlans();
    } catch (error) {
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlanActionState((prev) => ({ ...prev, [planId]: null }));
    }
  };

  const handleCancelPlan = async (planId: number) => {
    if (!window.confirm('Canceling will stop future poojas; continue?')) return;
    setPlanActionState((prev) => ({ ...prev, [planId]: 'cancel' }));
    try {
      await api.post(`pooja/recurrence/plans/${planId}/cancel/`);
      await loadPlans();
    } catch (error) {
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlanActionState((prev) => ({ ...prev, [planId]: null }));
    }
  };

  const handleResumePlan = async (planId: number) => {
    setPlanActionState((prev) => ({ ...prev, [planId]: 'resume' }));
    try {
      await api.post(`pooja/recurrence/plans/${planId}/resume/`);
      await loadPlans();
    } catch (error) {
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlanActionState((prev) => ({ ...prev, [planId]: null }));
    }
  };

  const handleRerunDonorDue = async (planId: number) => {
    if (!window.confirm('Re-run due generation only for this donor?')) return;
    setPlanActionState((prev) => ({ ...prev, [planId]: 'rerun' }));
    setPlansError(null);
    try {
      await api.post(`pooja/recurrence/plans/${planId}/rerun-due/`);
      await loadPlans();
    } catch (error) {
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlanActionState((prev) => ({ ...prev, [planId]: null }));
    }
  };

  const pauseReason = useCallback(
    (planId: number) => pauseReasonSelections[planId] ?? PAUSE_REASON_OPTIONS[0],
    [pauseReasonSelections],
  );

  const selectedDonor = donors.find((d) => d.id === selectedDonorId);
  const isShowingAllPaused = selectedDonorId === null;

  return (
    <div className="space-y-8">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Pooja Plans</h1>
        <p className="mt-1 text-sm text-slate-500">Pause or cancel a donor's recurring pooja subscriptions.</p>
      </div>

      {/* ── Donor Selector ───────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
          Select Donor
        </label>
        <DonorSearchDropdown
          options={donors}
          selectedId={selectedDonorId}
          onSelectId={(value) => setSelectedDonorId(value)}
          className="max-w-md"
        />
        {donorLoading && (
          <p className="text-xs text-slate-400">Loading donors…</p>
        )}
        {donorError && (
          <p className="text-xs text-rose-500">{donorError}</p>
        )}
      </div>

      {/* ── Global Error ─────────────────────────────────────────────────── */}
      {plansError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-rose-700">{plansError}</p>
          <button
            type="button"
            className="ml-auto text-rose-400 hover:text-rose-600"
            onClick={() => setPlansError(null)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      {plansLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="mb-3 h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-sm font-medium text-slate-400">
            {isShowingAllPaused
              ? 'No paused recurring plans found.'
              : `No recurring plans found for ${selectedDonor?.name}`}
          </p>
        </div>
      ) : (
        <div>
          {/* Plans count header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {isShowingAllPaused ? 'All Paused Recurring Plans' : 'Recurring Plans'}
            </p>
            <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
              {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
            {plans.map((plan) => {
              const isPaused = Boolean(plan.pause_from || plan.pause_until);
              const isActive = plan.is_active;
              const isCancelled = !isActive && !isPaused;
              const memberNames = getPlanMemberNames(plan.metadata);
              const isPauseFormOpen = activePausePlanId === plan.id;
              const isEditOpen = editingPlanId === plan.id;
              const actionLoading = planActionState[plan.id];
              const pauseStillActive = Boolean(plan.pause_until && plan.pause_until >= todayIso());
              const rerunLabelDonorName = (plan.donor_name ?? '').trim() || 'this donor';

              /* left-border accent color by status */
              const accentClass = isCancelled
                ? 'border-l-rose-300'
                : isPaused
                  ? 'border-l-amber-400'
                  : 'border-l-emerald-400';

              return (
                <div key={plan.id} className={`border-l-[3px] px-5 py-4 transition-colors ${accentClass}`}>

                  {/* ── Plan Header Row ──────────────────────────────────── */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          {plan.pooja_option_name ?? 'Unnamed plan'}
                        </h3>
                        <FrequencyBadge frequency={plan.recurrence_frequency} />
                      </div>
                      {plan.day_option_description && (
                        <p className="mt-0.5 text-xs text-slate-400">{plan.day_option_description}</p>
                      )}
                      {isShowingAllPaused && plan.donor_name && (
                        <p className="mt-1 text-xs font-semibold text-slate-500">Donor: {plan.donor_name}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <PlanStatusBadge plan={plan} />
                      <span className="text-base font-bold tabular-nums text-slate-800">
                        ₹&nbsp;{formatPlanAmount(plan.amount)}
                      </span>
                    </div>
                  </div>

                  {/* ── Members ─────────────────────────────────────────── */}
                  {memberNames.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {memberNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-500"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ── Pause info strip ────────────────────────────────── */}
                  {isPaused && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                      <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                      </svg>
                      <span className="font-medium">
                        {plan.pause_from && plan.pause_until
                          ? `Paused ${formatDate(plan.pause_from)} — ${formatDate(plan.pause_until)}`
                          : plan.pause_until
                            ? `Paused until ${formatDate(plan.pause_until)}`
                            : `Pause from ${formatDate(plan.pause_from)}`}
                      </span>
                      {(plan.metadata as any)?.pause_reason && (
                        <span className="text-amber-500">· {(plan.metadata as any).pause_reason}</span>
                      )}
                    </div>
                  )}

                  {/* ── Action Buttons ───────────────────────────────────── */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* Pause / Update pause */}
                    <button
                      type="button"
                      onClick={() => togglePauseForm(plan.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isPauseFormOpen
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700'
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                      </svg>
                      {isPauseFormOpen ? 'Hide pause' : isPaused ? 'Update pause' : 'Pause'}
                    </button>

                    {/* Edit — only for active plans */}
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => (isEditOpen ? cancelPlanEditing() : startEditingPlan(plan))}
                        disabled={planEditSubmitting && editingPlanId === plan.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          isEditOpen
                            ? 'border-slate-400 bg-slate-100 text-slate-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800'
                        }`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                        Edit
                      </button>
                    )}

                    {/* Cancel / Resume */}
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => handleCancelPlan(plan.id)}
                        disabled={actionLoading === 'cancel'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {actionLoading === 'cancel' ? (
                          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel plan'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResumePlan(plan.id)}
                        disabled={actionLoading === 'resume'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {actionLoading === 'resume' ? (
                          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                        )}
                        {actionLoading === 'resume' ? 'Resuming…' : 'Resume'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRerunDonorDue(plan.id)}
                      disabled={actionLoading === 'rerun' || pauseStillActive}
                      title={pauseStillActive ? 'Re-run is available only after pause end date.' : undefined}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {actionLoading === 'rerun' ? (
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1114.11 3.401M19.5 12v4.5m0 0H15" />
                        </svg>
                      )}
                      {actionLoading === 'rerun'
                        ? `Re-running for ${rerunLabelDonorName}…`
                        : pauseStillActive
                          ? `Re-run for ${rerunLabelDonorName} after pause end`
                          : `Re-run due for ${rerunLabelDonorName}`}
                    </button>
                  </div>

                  {/* ── Edit Form ────────────────────────────────────────── */}
                  {isEditOpen && (
                    <div className="mt-4 rounded-xl border border-slate-200 p-4">
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Edit Plan</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">Frequency</label>
                          <select
                            value={planEditValues.recurrence_frequency}
                            onChange={(e) => handlePlanEditChange('recurrence_frequency', e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                          >
                            {PLAN_FREQUENCY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={planEditValues.amount}
                            onChange={(e) => handlePlanEditChange('amount', e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={handlePlanEditSave}
                          disabled={planEditSubmitting}
                          className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                        >
                          {planEditSubmitting ? 'Saving…' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelPlanEditing}
                          disabled={planEditSubmitting}
                          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Pause Form ───────────────────────────────────────── */}
                  {isPauseFormOpen && (
                    <div className="mt-4 rounded-xl border border-amber-200 p-4">
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-700">Pause Settings</p>
                      <div className="space-y-3">
                        {/* Reason */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">Handling</label>
                          <select
                            value={pauseReason(plan.id)}
                            onChange={(e) => setPauseReasonSelections((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
                          >
                            {PAUSE_REASON_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        {/* Dates */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-600">From</label>
                            <input
                              type="date"
                              min={todayIso()}
                              value={pauseFromDates[plan.id] ?? todayIso()}
                              onChange={(e) => setPauseFromDates((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                              onFocus={(e) => {
                                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                input.showPicker?.();
                              }}
                              onClick={(e) => {
                                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                input.showPicker?.();
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== 'Tab') {
                                  e.preventDefault();
                                }
                              }}
                              onPaste={(e) => e.preventDefault()}
                              onDrop={(e) => e.preventDefault()}
                              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-600">Until</label>
                            <input
                              type="date"
                              min={pauseFromDates[plan.id] ?? todayIso()}
                              value={pauseToDates[plan.id] ?? ''}
                              onChange={(e) => setPauseToDates((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                              onFocus={(e) => {
                                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                input.showPicker?.();
                              }}
                              onClick={(e) => {
                                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                input.showPicker?.();
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== 'Tab') {
                                  e.preventDefault();
                                }
                              }}
                              onPaste={(e) => e.preventDefault()}
                              onDrop={(e) => e.preventDefault()}
                              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
                            />
                          </div>
                        </div>

                        {/* Submit */}
                        <button
                          type="button"
                          onClick={() =>
                            handlePausePlan(
                              plan.id,
                              pauseReason(plan.id),
                              pauseFromDates[plan.id] ?? todayIso(),
                              pauseToDates[plan.id] ?? '',
                            )
                          }
                          disabled={actionLoading === 'pause'}
                          className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionLoading === 'pause' ? 'Pausing…' : isPaused ? 'Update pause' : 'Confirm pause'}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PoojaPauseCancelPage;
