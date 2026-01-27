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
    if (!open) {
      return;
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, handleClickOutside, handleEscape]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
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
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        onClick={() => setOpen((prev) => !prev)}
        disabled={options.length === 0}
      >
        <span className="truncate">
          {selectedLabel ? `${selectedLabel.name} — ${selectedLabel.phone_number}` : placeholder}
        </span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="px-3 py-2">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search donor"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="max-h-48 overflow-auto">
            {filtered.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {filtered.map((donor) => (
                  <li key={`donor-option-${donor.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        onSelectId(donor.id);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">{`${donor.name} — ${donor.phone_number}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-xs text-slate-500">No donors match your search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface RecurringPlan {
  id: number;
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

const PAUSE_MONTH_OPTIONS = Array.from({ length: 24 }, (_, index) => index + 1);

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
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatPlanAmount = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
};

const addMonthsToIso = (iso: string, months: number) => {
  if (months <= 0) return iso;
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetMonth = month + months;
  const result = new Date(year, targetMonth, day);
  return result.toISOString().split('T')[0];
};

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
  const label = frequency === 'monthly' ? 'Monthly' : frequency === 'quarterly' ? 'Quarterly' : frequency;
  return `${label} recurring`;
};

const extractErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (typeof responseData === 'string') {
      return responseData.trim();
    }
    if (isRecord(responseData)) {
      if ('detail' in responseData && typeof responseData.detail === 'string') {
        return responseData.detail;
      }
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

const PoojaPauseCancelPage = () => {
  const [donors, setDonors] = useState<DonorListEntry[]>([]);
  const [donorLoading, setDonorLoading] = useState(true);
  const [donorError, setDonorError] = useState<string | null>(null);
  const [selectedDonorId, setSelectedDonorId] = useState<number | null>(null);
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [pauseDurationSelection, setPauseDurationSelection] = useState<Record<number, number>>({});
  const [pauseReasonSelections, setPauseReasonSelections] = useState<Record<number, string>>({});
  const [activePausePlanId, setActivePausePlanId] = useState<number | null>(null);
  const [planActionState, setPlanActionState] = useState<Record<number, 'pause' | 'resume' | 'cancel' | null>>({});
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
    if (selectedDonorId === null) {
      setPlans([]);
      return;
    }
    setPlansLoading(true);
    setPlansError(null);
    try {
      const response = await api.get('pooja/recurrence/plans/', {
        params: { page_size: 200, donor: selectedDonorId },
      });
      const allPlans = extractResults<RecurringPlan>(response.data);
      // Filter to show only recurring plans, not one-time extra plans
      const recurringPlans = allPlans.filter((plan) => plan.recurrence_kind === 'recurring');
      setPlans(recurringPlans);
    } catch (error) {
      setPlans([]);
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlansLoading(false);
    }
  }, [selectedDonorId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const togglePauseForm = (planId: number) => {
    setActivePausePlanId((prev) => (prev === planId ? null : planId));
    setPauseReasonSelections((prev) => ({
      ...prev,
      [planId]: prev[planId] ?? PAUSE_REASON_OPTIONS[0],
    }));
    setPauseDurationSelection((prev) => ({
      ...prev,
      [planId]: prev[planId] ?? 1,
    }));
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
    setPlanEditValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handlePlanEditSave = useCallback(async () => {
    if (editingPlanId === null) return;
    const payload: Record<string, string> = {};
    if (planEditValues.recurrence_frequency) {
      payload.recurrence_frequency = planEditValues.recurrence_frequency;
    }
    const amountValue = planEditValues.amount.trim();
    if (amountValue) {
      payload.amount = amountValue;
    }
    if (Object.keys(payload).length === 0) {
      setPlansError('Update at least one field.');
      return;
    }
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

  useEffect(() => {
    cancelPlanEditing();
  }, [selectedDonorId, cancelPlanEditing]);

  const handlePausePlan = async (plan: RecurringPlan, reason: string) => {
    const months = pauseDurationSelection[plan.id] ?? 1;
    if (months <= 0) return;
    if (!reason.trim()) return;
    setPlanActionState((prev) => ({ ...prev, [plan.id]: 'pause' }));
    try {
      const start = new Date().toISOString().split('T')[0];
      const end = addMonthsToIso(start, months);
      await api.post(`pooja/recurrence/plans/${plan.id}/pause/`, {
        pause_from: start,
        pause_until: end,
        pause_reason: reason,
        pause_months: months,
      });
      await loadPlans();
    } catch (error) {
      setPlansError(extractErrorMessage(error));
    } finally {
      setPlanActionState((prev) => ({ ...prev, [plan.id]: null }));
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

  const pauseDuration = useCallback(
    (planId: number) => pauseDurationSelection[planId] ?? 1,
    [pauseDurationSelection],
  );

  const pauseReason = useCallback(
    (planId: number) => pauseReasonSelections[planId] ?? PAUSE_REASON_OPTIONS[0],
    [pauseReasonSelections],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Pooja - Pause/Cancel</h1>
        <p className="text-sm text-slate-500">
          Select a donor to view their recurring plans and manage pause/cancel actions using the shared APIs.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Filter by donor name</label>
        <DonorSearchDropdown
          options={donors}
          selectedId={selectedDonorId}
          onSelectId={(value) => setSelectedDonorId(value)}
          className="max-w-sm"
        />
        {donorError && <p className="mt-3 text-xs text-rose-600">{donorError}</p>}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Recurring Plans</h2>
          <span className="text-sm text-slate-500">{plans.length} plan{plans.length !== 1 ? 's' : ''}</span>
        </div>
        {plansError && <p className="mt-3 text-sm text-rose-600">{plansError}</p>}
        {plansLoading ? (
          <div className="mt-6 text-sm text-slate-500">Loading plans…</div>
        ) : plans.length === 0 ? (
          <div className="mt-6 text-sm text-slate-500">Select a donor to fetch their recurring plans.</div>
        ) : (
          <div className="mt-6 space-y-4">
            {plans.map((plan) => {
              const isPaused = Boolean(plan.pause_from || plan.pause_until);
              const isActive = plan.is_active;
              const memberNames = getPlanMemberNames(plan.metadata);
              return (
                <div key={plan.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {plan.pooja_option_name ?? 'Unnamed plan'}
                      </h3>
                      <p className="text-sm text-slate-500">{plan.day_option_description ?? '—'}</p>
                    </div>
                    <div className="flex flex-col items-end text-right text-sm text-slate-500">
                      <span className="text-xs font-semibold uppercase text-emerald-600">
                        {formatPlanFrequencyLabel(plan.recurrence_frequency)}
                      </span>
                      <span className="text-lg font-bold text-slate-900">₹ {formatPlanAmount(plan.amount)}</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                    Members: {memberNames.length > 0 ? memberNames.join(', ') : '—'}
                  </div>
                  {(plan.pause_from || plan.pause_until) && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-700">
                      {plan.pause_from && plan.pause_until
                        ? `Paused ${formatDate(plan.pause_from)} until ${formatDate(plan.pause_until)}`
                        : plan.pause_until
                          ? `Paused until ${formatDate(plan.pause_until)}`
                          : `Pause scheduled from ${formatDate(plan.pause_from)}`}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => togglePauseForm(plan.id)}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        {activePausePlanId === plan.id ? 'Hide pause options' : 'Pause / Update pause'}
                      </button>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => startEditingPlan(plan)}
                        disabled={planEditSubmitting && editingPlanId === plan.id}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>
                    )}
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => handleCancelPlan(plan.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Cancel plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResumePlan(plan.id)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                  {editingPlanId === plan.id && (
                    <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <h4 className="text-sm font-semibold text-slate-800">Edit plan</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                          <select
                            value={planEditValues.recurrence_frequency}
                            onChange={(event) => handlePlanEditChange('recurrence_frequency', event.target.value)}
                            className="block w-full rounded-md border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {PLAN_FREQUENCY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={planEditValues.amount}
                            onChange={(event) => handlePlanEditChange('amount', event.target.value)}
                            className="block w-full rounded-md border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handlePlanEditSave}
                          disabled={planEditSubmitting}
                          className="flex-1 rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {planEditSubmitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelPlanEditing}
                          disabled={planEditSubmitting}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {activePausePlanId === plan.id && (
                    <div className="mt-4 space-y-3 rounded-lg border border-orange-200 bg-white p-4 shadow-sm">
                      <div>
                        <label className="block text-xs font-semibold text-orange-900 mb-1">Pause handling</label>
                        <select
                          value={pauseReason(plan.id)}
                          onChange={(event) =>
                            setPauseReasonSelections((prev) => ({ ...prev, [plan.id]: event.target.value }))
                          }
                          className="block w-full rounded-md border-orange-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                        >
                          {PAUSE_REASON_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-orange-900 mb-1">Duration (months)</label>
                        <select
                          value={pauseDuration(plan.id)}
                          onChange={(event) =>
                            setPauseDurationSelection((prev) => ({
                              ...prev,
                              [plan.id]: Number(event.target.value),
                            }))
                          }
                          className="block w-full rounded-md border-orange-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                        >
                          {PAUSE_MONTH_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option} month{option > 1 ? 's' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePausePlan(plan, pauseReason(plan.id))}
                        className="w-full rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                      >
                        Pause plan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PoojaPauseCancelPage;
