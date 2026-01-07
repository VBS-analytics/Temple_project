import axios from 'axios';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import api, { extractResults } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { usePaymentStore } from '../store/payments';
import { useCartStore } from '../store/cart';
import type { CartItem } from '../store/cart';
import type { RecurrenceKind } from '../types/recurrence';
import { rasiOptions, tamilStarOptions } from '../data/familyAttributes';
import { useMasterDataStore } from '../store/masterData';
import { useCurrentBalance } from '../hooks/useCurrentBalance';

// All interfaces remain the same
interface ApiUser {
  id: number;
  name?: string | null;
  phone_number: string;
  email?: string | null;
  role: string;
}

interface ApiDonorProfile {
  donor_id?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  gothra?: string | null;
  tamil_star?: string | null;
  rasi?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  family_name?: string | null;
  notes?: string | null;
  tamil_name?: string | null;
}

interface FamilyMember {
  id: number;
  name: string;
  gender?: string | null;
  relationship?: string | null;
  date_of_birth?: string | null;
  tamil_star?: string | null;
  gothra?: string | null;
  rasi?: string | null;
  family_name?: string | null;
}

// Add this interface definition
interface ProfileResponse {
  user: ApiUser;
  profile: ApiDonorProfile;
  members: FamilyMember[];
}

interface FamilyMemberFormState {
  name: string;
  relationship: string;
  gender: string;
  date_of_birth: string;
  tamil_star: string;
  gothra: string;
  rasi: string;
  family_name: string;
  family_selection: string;
}

interface DonorProfileFormState {
  family_name: string;
  notes: string;
  gender: string;
  date_of_birth: string;
  gothra: string;
  tamil_star: string;
  rasi: string;
  tamil_name: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  postal_code: string;
}

interface RegistrationMember {
  id?: number;
  name?: string | null;
  relationship?: string | null;
}

interface PlanDueRegistration {
  id: number;
  pooja_reg_id?: string | null;
  start_date?: string | null;
  total_amount?: string | null;
  paid_amount?: string | null;
  due_amount?: string | null;
  is_paid?: boolean | null;
  status?: string | null;
}

interface RegistrationCartItem {
  recurrenceKind?: RecurrenceKind | null;
  recurrenceFrequency?: string | null;
  recurrenceOneTimeDate?: string | null;
  recurrence_kind?: RecurrenceKind | null;
}

interface PoojaRegistration {
  id: number;
  recurrence_kind?: RecurrenceKind | null;
  recurrence_frequency?: string | null;
  recurrence_one_time_date?: string | null;
  pooja_reg_id?: string | null;
  pooja_option_name?: string | null;
  start_date?: string | null;
  day_option_description?: string | null;
  post_prasadam?: boolean | null;
  total_amount?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  members?: RegistrationMember[];
  status?: string | null;
  cart_item?: RegistrationCartItem | null;
}

interface RecurringPlan {
  id: number;
  pooja_option_name?: string | null;
  pooja_option_code?: string | null;
  day_option_description?: string | null;
  recurrence_kind: RecurrenceKind;
  recurrence_frequency?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_occurrence?: string | null;
  one_time_date?: string | null;
  amount?: string | number | null;
  is_active: boolean;
  pause_until?: string | null;
  pause_from?: string | null;
  metadata?: Record<string, unknown>;
  due_registration?: PlanDueRegistration | null;
  origin_registration_created_at?: string | null;
  origin_registration_updated_at?: string | null;
  origin_registration_id?: number | null;
}

interface PaymentRecordEntry {
  id: number;
  registration?: number | null;
  status?: string | null;
  transaction_reference?: string | null;
  created_at?: string | null;
}

interface PlanEditFormState {
  recurrence_frequency: string;
  amount: string;
}

type PlanActionType = 'pause' | 'resume' | 'cancel' | 'prepare';

const PLAN_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const PAUSE_REASON_OPTIONS = [
  'No Pooja and No Payment',
  'No Pooja and use the money for temple purpose',
  "Continue the pooja with the Samy's names",
];

const PAUSE_MONTH_OPTIONS = Array.from({ length: 50 }, (_, index) => index + 1);

// All utility functions remain the same
const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const resolveText = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
};

const formatGender = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const normalized = value.replace(/_/g, ' ').trim();
  if (!normalized) {
    return '—';
  }
  return normalized
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const formatCurrencyValue = (value?: number | null) => {
  if (value == null) {
    return '—';
  }
  return `₹ ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
};

const sortMembers = (list: FamilyMember[]) =>
  [...list].sort((a, b) => {
    const left = (a.name || '').toLowerCase();
    const right = (b.name || '').toLowerCase();
    return left.localeCompare(right);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const addMonthsToIso = (iso: string, months: number) => {
  if (months <= 0) {
    return iso;
  }
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetMonth = month + months;
  const result = new Date(year, targetMonth, day);
  const adjusted = result.toISOString().split('T')[0];
  return adjusted;
};

const getPauseReasonLabel = (metadata?: Record<string, unknown>) => {
  if (!isRecord(metadata)) {
    return null;
  }
  const reason = metadata.pause_reason;
  if (typeof reason === 'string' && reason.trim().length > 0) {
    return reason.trim();
  }
  return null;
};

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

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return formatDate(value);
  }
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

const formatPlanFrequencyLabel = (kind: RecurringPlan['recurrence_kind'], frequency?: string | null) => {
  if (kind === 'recurring') {
    const frequencyLabel =
      frequency === 'quarterly'
        ? 'Quarterly'
        : frequency === 'monthly'
          ? 'Monthly'
          : 'Recurring';
    return `${frequencyLabel} recurring`;
  }
  return 'One-time extra';
};

const formatPlanAmount = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
};

const parseDecimalValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatCartAmount = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return `₹ ${numeric.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatCartFrequencyLabel = (frequency?: string | null) => {
  switch (frequency) {
    case 'monthly':
      return 'Monthly recurring';
    case 'quarterly':
      return 'Quarterly recurring';
    case 'annually':
    case 'annual':
      return 'Annual recurring';
    default:
      return 'Recurring';
  }
};

const STATUS_PAYMENT_RECEIVED_LABEL = 'Payment Received';
const STATUS_PAYMENT_NOT_RECEIVED_LABEL = 'Payment not received';
const STATUS_ADMIN_PENDING_LABEL = 'Admin action is pending';
const STATUS_POOJA_COMPLETED_LABEL = 'Pooja Completed';
const STATUS_LOADING_LABEL = 'Loading status...';

const STATUS_BADGE_CLASSES: Record<string, string> = {
  [STATUS_PAYMENT_RECEIVED_LABEL]: 'bg-emerald-100 text-emerald-800',
  [STATUS_PAYMENT_NOT_RECEIVED_LABEL]: 'bg-rose-100 text-rose-800',
  [STATUS_ADMIN_PENDING_LABEL]: 'bg-amber-100 text-amber-800',
  [STATUS_POOJA_COMPLETED_LABEL]: 'bg-emerald-100 text-emerald-800',
  [STATUS_LOADING_LABEL]: 'bg-slate-100 text-slate-600',
};

const getRegistrationStatusLabel = (
  registration: PoojaRegistration,
  recordsByRegistration: Map<number, PaymentRecordEntry[]>,
  recordsLoaded: boolean,
) => {
  if (!recordsLoaded) {
    return STATUS_LOADING_LABEL;
  }
  const normalizedRegistrationStatus = (registration.status ?? '').toLowerCase();
  if (normalizedRegistrationStatus === 'completed') {
    return STATUS_POOJA_COMPLETED_LABEL;
  }
  const records = recordsByRegistration.get(registration.id) ?? [];
  if (records.length === 0) {
    return STATUS_PAYMENT_NOT_RECEIVED_LABEL;
  }
  return STATUS_ADMIN_PENDING_LABEL;
};

const getRegistrationStatusBadgeClasses = (label: string) =>
  STATUS_BADGE_CLASSES[label] ?? 'bg-slate-100 text-slate-600';

const buildCartMemberNames = (members?: CartItem['members']) => {
  if (!members || members.length === 0) {
    return '—';
  }
  const names = members
    .map((member) => member?.name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 0));
  return names.length > 0 ? names.join(', ') : '—';
};

const formatPlanDateLabel = (plan: RecurringPlan, todayIso: string) => {
  const collectFuture = (value?: string | null) => {
    if (!value) {
      return null;
    }
    return value;
  };

  const candidates = [
    collectFuture(plan.start_date),
    collectFuture(plan.next_occurrence),
    collectFuture(plan.one_time_date),
  ].filter(Boolean) as string[];

  let nextDate: string | null = null;
  for (const candidate of candidates) {
    if (candidate >= todayIso) {
      if (!nextDate || candidate < nextDate) {
        nextDate = candidate;
      }
    }
  }

  const fallback = plan.next_occurrence ?? plan.one_time_date ?? plan.start_date ?? '';
  const pickDate = nextDate ?? fallback;
  return pickDate ? formatDate(pickDate) : '—';
};

const getPlanMemberNames = (metadata?: RecurringPlan['metadata']) => {
  if (!metadata) {
    return [];
  }
  const members = (metadata as { members?: unknown }).members;
  if (!Array.isArray(members)) {
    return [];
  }
  return members.map((entry) => {
    if (typeof entry === 'object' && entry !== null) {
      const name = (entry as { name?: string | null }).name;
      if (name && name.trim()) {
        return name.trim();
      }
    }
    return 'Member';
  });
};

const resolvePoojaId = (registration: PoojaRegistration) => {
  const trimmed = (registration.pooja_reg_id ?? '').trim();
  return trimmed.length > 0 ? trimmed : `#${registration.id}`;
};

const formatMemberNames = (members?: RegistrationMember[]) => {
  if (!Array.isArray(members)) {
    return '—';
  }
  const names = members
    .map((member) => (member?.name ?? '').trim())
    .filter((name) => name.length > 0);
  return names.length > 0 ? names.join(', ') : '—';
};

const formatRegistrationTimeline = (registration: PoojaRegistration) => {
  const createdAt = registration.created_at;
  if (!createdAt) {
    return '—';
  }
  const createdText = formatDateTime(createdAt);
  const updatedAt = registration.updated_at;
  if (!updatedAt) {
    return createdText;
  }

  const createdTime = new Date(createdAt).getTime();
  const updatedTime = new Date(updatedAt).getTime();
  if (
    Number.isNaN(createdTime) ||
    Number.isNaN(updatedTime) ||
    Math.abs(createdTime - updatedTime) < 1000
  ) {
    return createdText;
  }

  return `${formatDateTime(updatedAt)}** updated`;
};

const formatPlanRegistrationTimeline = (
  createdAt?: string | null,
  updatedAt?: string | null,
) => {
  if (!createdAt) {
    return '—';
  }
  const timelineRegistration: PoojaRegistration = {
    id: 0,
    created_at: createdAt,
    updated_at: updatedAt,
  };
  return formatRegistrationTimeline(timelineRegistration);
};

const DonorProfile = () => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [profile, setProfile] = useState<ApiDonorProfile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [registrations, setRegistrations] = useState<PoojaRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecordEntry[]>([]);
  const [paymentRecordsLoading, setPaymentRecordsLoading] = useState(true);
  const [paymentRecordsError, setPaymentRecordsError] = useState<string | null>(null);
  const [recurrencePlans, setRecurrencePlans] = useState<RecurringPlan[]>([]);
  const [recurrenceLoading, setRecurrenceLoading] = useState(true);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
  const [pauseDurationSelection, setPauseDurationSelection] = useState<Record<number, number>>({});
  const [pauseReasonSelections, setPauseReasonSelections] = useState<Record<number, string>>({});
  const [activePausePlanId, setActivePausePlanId] = useState<number | null>(null);
  const [planActionState, setPlanActionState] = useState<Record<number, PlanActionType | null>>({});
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planEditValues, setPlanEditValues] = useState<PlanEditFormState>({
    recurrence_frequency: 'monthly',
    amount: '',
  });
  const [planEditSubmitting, setPlanEditSubmitting] = useState(false);
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const authUser = useAuthStore((state) => state.user);
  const cartKey = authUser ? String(authUser.id) : 'guest';
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const paymentSnapshot = usePaymentStore((state) => state.lastGeneralPaymentByUser[cartKey] ?? null);
  const location = useLocation();
  const navigate = useNavigate();
  const fromCartReview = useMemo(
    () => new URLSearchParams(location.search).get('fromCart') === '1',
    [location.search],
  );
  const mergedCartItems = useMemo(() => {
    const itemsMap = new Map<string, CartItem>();
    (paymentSnapshot?.items ?? []).forEach((item) => {
      itemsMap.set(item.cartId, item);
    });
    cartItems.forEach((item) => {
      itemsMap.set(item.cartId, item);
    });
    return Array.from(itemsMap.values());
  }, [paymentSnapshot, cartItems]);
  const pendingRegistrations = useMemo(
    () => mergedCartItems.filter((item) => item.recurrenceKind !== 'recurring'),
    [mergedCartItems],
  );
  const pendingRecurringPlans = useMemo(
    () => mergedCartItems.filter((item) => item.recurrenceKind === 'recurring'),
    [mergedCartItems],
  );
  const pendingCartCount = pendingRegistrations.length + pendingRecurringPlans.length;
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gothraOptions = useMasterDataStore((state) => state.gothraOptions);
  const loadGothraOptions = useMasterDataStore((state) => state.loadGothraOptions);
  const { balance: currentBalance, loading: balanceLoading, error: balanceError, refresh: refreshBalance } =
    useCurrentBalance();

  useEffect(() => {
    loadGothraOptions();
  }, [loadGothraOptions]);

  const reloadRecurrencePlans = useCallback(
    async (options?: { activeCheck?: () => boolean }) => {
      const isActive = options?.activeCheck ?? (() => true);
      if (!isActive()) {
        return;
      }

      setRecurrenceLoading(true);
      setRecurrenceError(null);
      try {
        const response = await api.get('pooja/recurrence/plans/', { params: { page_size: 200 } });
        if (!isActive()) {
          return;
        }
        setRecurrencePlans(extractResults<RecurringPlan>(response.data));
        setPauseReasonSelections({});
        setActivePausePlanId(null);
        setPlanActionState({});
      } catch (err) {
        if (!isActive()) {
          return;
        }
        setRecurrencePlans([]);
        setRecurrenceError(extractErrorMessage(err));
      } finally {
        if (!isActive()) {
          return;
        }
        setRecurrenceLoading(false);
      }
    },
    [],
  );

  const togglePauseForm = useCallback(
    (planId: number) => {
      setActivePausePlanId((prev) => (prev === planId ? null : planId));
      setPauseReasonSelections((prev) => {
        if (prev[planId]) {
          return prev;
        }
        return {
          ...prev,
          [planId]: PAUSE_REASON_OPTIONS[0],
        };
      });
      setPauseDurationSelection((prev) => ({
        ...prev,
        [planId]: prev[planId] ?? 1,
      }));
      setRecurrenceError(null);
    },
    [setRecurrenceError],
  );

  const handlePausePlan = useCallback(
    async (plan: RecurringPlan, pauseReason: string) => {
      const months = pauseDurationSelection[plan.id] ?? 1;
      if (months <= 0) {
        setRecurrenceError('Select at least one month for the pause duration.');
        return;
      }
      if (!pauseReason?.trim()) {
        setRecurrenceError('Select how you’d like to handle the pause.');
        return;
      }
      const start = todayIso;
      const end = addMonthsToIso(start, months);
      setPlanActionState((prev) => ({
        ...prev,
        [plan.id]: 'pause',
      }));
      setRecurrenceError(null);
      try {
        await api.post(`pooja/recurrence/plans/${plan.id}/pause/`, {
          pause_from: start,
          pause_until: end,
          pause_reason: pauseReason,
          pause_months: months,
        });
        setActivePausePlanId(null);
        await reloadRecurrencePlans();
        await refreshBalance();
      } catch (error) {
        setRecurrenceError(extractErrorMessage(error));
      } finally {
        setPlanActionState((prev) => ({
          ...prev,
          [plan.id]: null,
        }));
      }
    },
    [reloadRecurrencePlans, refreshBalance, todayIso, pauseDurationSelection],
  );

  const handleResumePlan = useCallback(
    async (planId: number) => {
      setPlanActionState((prev) => ({
        ...prev,
        [planId]: 'resume',
      }));
      setRecurrenceError(null);
      try {
        await api.post(`pooja/recurrence/plans/${planId}/resume/`);
        setActivePausePlanId(null);
        await reloadRecurrencePlans();
        await refreshBalance();
      } catch (error) {
        setRecurrenceError(extractErrorMessage(error));
      } finally {
        setPlanActionState((prev) => ({
          ...prev,
          [planId]: null,
        }));
      }
    },
    [reloadRecurrencePlans, refreshBalance],
  );

  const handleCancelPlan = useCallback(
    async (plan: RecurringPlan) => {
      const confirmText =
        'Canceling this plan will stop future poojas and payments. Continue?';
      if (!window.confirm(confirmText)) {
        return;
      }
      setPlanActionState((prev) => ({
        ...prev,
        [plan.id]: 'cancel',
      }));
      setRecurrenceError(null);
      try {
        await api.post(`pooja/recurrence/plans/${plan.id}/cancel/`);
        setActivePausePlanId(null);
        await reloadRecurrencePlans();
        await refreshBalance();
      } catch (error) {
        setRecurrenceError(extractErrorMessage(error));
      } finally {
        setPlanActionState((prev) => ({
          ...prev,
          [plan.id]: null,
        }));
      }
    },
    [reloadRecurrencePlans, refreshBalance],
  );

  const handlePrepareRecurringPayment = useCallback(
    async (plan: RecurringPlan) => {
      setPlanActionState((prev) => ({
        ...prev,
        [plan.id]: 'prepare',
      }));
      setRecurrenceError(null);
      try {
        const response = await api.post<PoojaRegistration>(`pooja/recurrence/plans/${plan.id}/prepare-payment/`);
        await reloadRecurrencePlans();
        const params = new URLSearchParams();
        params.set('registration', String(response.data.id));
        const amountValue = response.data.total_amount;
        if (amountValue !== undefined && amountValue !== null) {
          params.set('amount', String(amountValue));
        } else if (plan.amount !== undefined && plan.amount !== null) {
          params.set('amount', String(plan.amount));
        }
        navigate(`/payments/general?${params.toString()}`);
      } catch (error) {
        setRecurrenceError(extractErrorMessage(error));
      } finally {
        setPlanActionState((prev) => ({
          ...prev,
          [plan.id]: null,
        }));
      }
    },
    [navigate, reloadRecurrencePlans],
  );

  const handlePayRecurringPlan = useCallback(
    (registration?: PlanDueRegistration) => {
      if (!registration?.id) {
        return;
      }
      const params = new URLSearchParams();
      params.set('registration', String(registration.id));
      if (registration.due_amount) {
        params.set('amount', registration.due_amount);
      }
      navigate(`/payments/general?${params.toString()}`);
    },
    [navigate],
  );

  const startEditingPlan = useCallback((plan: RecurringPlan) => {
    setEditingPlanId(plan.id);
    setPlanEditValues({
      recurrence_frequency: plan.recurrence_frequency ?? 'monthly',
      amount: plan.amount != null ? String(plan.amount) : '',
    });
    setRecurrenceError(null);
  }, []);

  const cancelPlanEditing = useCallback(() => {
    setEditingPlanId(null);
    setPlanEditValues({
      recurrence_frequency: 'monthly',
      amount: '',
    });
    setRecurrenceError(null);
  }, []);

  const handlePlanEditChange = useCallback(
    (field: keyof PlanEditFormState, value: string) => {
      setPlanEditValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const handlePlanEditSave = useCallback(async () => {
    if (editingPlanId === null) {
      return;
    }
    const payload: Record<string, string> = {};
    if (planEditValues.recurrence_frequency) {
      payload.recurrence_frequency = planEditValues.recurrence_frequency;
    }
    const amountValue = planEditValues.amount.trim();
    if (amountValue) {
      payload.amount = amountValue;
    }
    if (Object.keys(payload).length === 0) {
      setRecurrenceError('Update at least one field.');
      return;
    }
    setPlanEditSubmitting(true);
    setRecurrenceError(null);
    try {
      await api.patch(`pooja/recurrence/plans/${editingPlanId}/`, payload);
      await reloadRecurrencePlans();
      cancelPlanEditing();
    } catch (error) {
      setRecurrenceError(extractErrorMessage(error));
    } finally {
      setPlanEditSubmitting(false);
    }
  }, [editingPlanId, planEditValues, reloadRecurrencePlans, cancelPlanEditing]);
  const [editingRegistrationId, setEditingRegistrationId] = useState<number | null>(null);
  const [registrationEditDate, setRegistrationEditDate] = useState('');
  const [registrationEditError, setRegistrationEditError] = useState<string | null>(null);
  const [registrationEditSubmitting, setRegistrationEditSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const FAMILY_OPTIONS = [
    'Arunachalam-Sambasiva Iyr',
    'Kadakarar Subramani Iyr',
    'Sundaresa Iyr+ Pannai+Balu Fmly',
    'Narayanswamy fmly',
    'Mangalam Periyamma Fmly',
    'Koorakattu Fmly',
    'RamaniSastri Fmly',
    'Pichu Iyr Fmly',
    'Pattamani Iyr Fmly',
    'Other',
  ];

  const createInitialFormState = (profileData?: ApiDonorProfile): FamilyMemberFormState => ({
    name: '',
    relationship: '',
    gender: '',
    date_of_birth: '',
    tamil_star: '',
    gothra: '',
    rasi: '',
    family_name: (profileData?.family_name ?? '').trim(),
    family_selection: (() => {
      const family = (profileData?.family_name ?? '').trim();
      if (!family) return '';
      return FAMILY_OPTIONS.includes(family) ? family : 'Other';
    })(),
  });

  const createDonorProfileFormState = (profileData?: ApiDonorProfile): DonorProfileFormState => ({
    family_name: (profileData?.family_name ?? '').trim(),
    notes: (profileData?.notes ?? '').trim(),
    gender: (profileData?.gender ?? '').trim(),
    date_of_birth: profileData?.date_of_birth ?? '',
    gothra: (profileData?.gothra ?? '').trim(),
    tamil_star: (profileData?.tamil_star ?? '').trim(),
    rasi: (profileData?.rasi ?? '').trim(),
    tamil_name: (profileData?.tamil_name ?? '').trim(),
    address_line1: (profileData?.address_line1 ?? '').trim(),
    address_line2: (profileData?.address_line2 ?? '').trim(),
    address_line3: (profileData?.address_line3 ?? '').trim(),
    city: (profileData?.city ?? '').trim(),
    state: (profileData?.state ?? '').trim(),
    postal_code: (profileData?.postal_code ?? '').trim(),
  });

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FamilyMemberFormState>(() => createInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState<DonorProfileFormState>(() =>
    createDonorProfileFormState()
  );
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('auth/profile/');
      const data = response.data as ProfileResponse;
      if (!isMountedRef.current) {
        return;
      }
      setUser(data.user);
      setProfile(data.profile);
      setMembers(sortMembers(data.members ?? []));
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      setError(extractErrorMessage(err));
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    setRegistrationsLoading(true);
    setRegistrationsError(null);
    try {
      const response = await api.get('pooja/registrations/', { params: { page_size: 200 } });
      if (!isMountedRef.current) {
        return;
      }
      setRegistrations(extractResults<PoojaRegistration>(response.data));
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      setRegistrations([]);
      setRegistrationsError(extractErrorMessage(err));
    } finally {
      if (isMountedRef.current) {
        setRegistrationsLoading(false);
      }
    }
  }, []);

  const fetchPaymentRecords = useCallback(async () => {
    setPaymentRecordsLoading(true);
    setPaymentRecordsError(null);
    try {
      const response = await api.get('payments/records/', {
        params: { page_size: 250, ordering: '-created_at' },
      });
      if (!isMountedRef.current) {
        return;
      }
      setPaymentRecords(extractResults<PaymentRecordEntry>(response.data));
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      setPaymentRecords([]);
      setPaymentRecordsError(extractErrorMessage(err));
    } finally {
      if (isMountedRef.current) {
        setPaymentRecordsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadProfile();
    fetchRegistrations();
    fetchPaymentRecords();
    let activeCheck = () => isMountedRef.current;
    reloadRecurrencePlans({ activeCheck });
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPaymentRecords, fetchRegistrations, loadProfile, reloadRecurrencePlans]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        fetchRegistrations();
        fetchPaymentRecords();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchPaymentRecords, fetchRegistrations]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isMountedRef.current) {
        return;
      }
      fetchRegistrations();
      fetchPaymentRecords();
    }, 30000);
    return () => {
      window.clearInterval(interval);
    };
  }, [fetchPaymentRecords, fetchRegistrations]);

  useEffect(() => {
    if (!isEditingProfile) {
      setProfileFormData(createDonorProfileFormState(profile ?? undefined));
    }
  }, [profile, isEditingProfile]);

  const handleManualPaymentRedirect = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    navigate('/payments/general?tab=summary');
  }, [navigate]);

  useEffect(() => {
    if (!fromCartReview || pendingCartCount === 0) {
      return () => {
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current);
          redirectTimerRef.current = null;
        }
      };
    }
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }
    const startTimeout = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    redirectTimerRef.current = startTimeout(() => {
      redirectTimerRef.current = null;
      navigate('/payments/general?tab=summary');
    }, 2400);
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [fromCartReview, navigate, pendingCartCount]);

  const paymentRecordsByRegistration = useMemo(() => {
    const sortedRecords = [...paymentRecords].sort((a, b) => {
      const left = a.created_at ?? '';
      const right = b.created_at ?? '';
      return right.localeCompare(left);
    });
    const map = new Map<number, PaymentRecordEntry[]>();
    for (const record of sortedRecords) {
      const registrationId = record.registration;
      if (typeof registrationId !== 'number') {
        continue;
      }
      const bucket = map.get(registrationId);
      if (bucket) {
        bucket.push(record);
      } else {
        map.set(registrationId, [record]);
      }
    }
    return map;
  }, [paymentRecords]);

  const paymentRecordsLoaded = !paymentRecordsLoading;

  const visibleRegistrations = useMemo(() => {
    const recurringRegistrationIds = new Set<number>();
    for (const plan of recurrencePlans) {
      if (plan.recurrence_kind === 'recurring' && typeof plan.origin_registration_id === 'number') {
        recurringRegistrationIds.add(plan.origin_registration_id);
      }
    }
    return registrations.filter((registration) => {
      if (recurringRegistrationIds.has(registration.id)) {
        return false;
      }
      const cartRecurrenceKind =
        registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
      const hasRecurrenceKind = Boolean(registration.recurrence_kind);
      return !hasRecurrenceKind && !cartRecurrenceKind;
    });
  }, [registrations, recurrencePlans]);

  const recurringPlansToShow = useMemo(
    () => recurrencePlans.filter((plan) => plan.recurrence_kind === 'recurring'),
    [recurrencePlans],
  );

  const startAddingNew = () => {
    setFormData(createInitialFormState(profile ?? undefined));
    setFormError(null);
    setIsAddingNew(true);
  };

  const cancelAddingNew = () => {
    if (submitting) {
      return;
    }
    setIsAddingNew(false);
    setFormError(null);
    setFormData(createInitialFormState(profile ?? undefined));
  };

  const startEditingProfile = () => {
    setProfileFormData(createDonorProfileFormState(profile ?? undefined));
    setIsEditingProfile(true);
    setProfileFormError(null);
  };

  const cancelProfileEditing = () => {
    if (profileSubmitting) {
      return;
    }
    setIsEditingProfile(false);
    setProfileFormError(null);
    setProfileFormData(createDonorProfileFormState(profile ?? undefined));
  };

  const handleProfileInputChange =
    (field: keyof DonorProfileFormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setProfileFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const submitProfileForm = async () => {
    setProfileSubmitting(true);
    setProfileFormError(null);
    try {
      const payload = {
        family_name: profileFormData.family_name.trim(),
        notes: profileFormData.notes.trim(),
        gender: profileFormData.gender.trim(),
        date_of_birth: profileFormData.date_of_birth || null,
        gothra: profileFormData.gothra.trim(),
        tamil_star: profileFormData.tamil_star.trim(),
        rasi: profileFormData.rasi.trim(),
        tamil_name: profileFormData.tamil_name.trim(),
        address_line1: profileFormData.address_line1.trim(),
        address_line2: profileFormData.address_line2.trim(),
        address_line3: profileFormData.address_line3.trim(),
        city: profileFormData.city.trim(),
        state: profileFormData.state.trim(),
        postal_code: profileFormData.postal_code.trim(),
      };
      const response = await api.put<ApiDonorProfile>('auth/profile/', payload);
      const updatedProfile = {
        ...response.data,
        rasi: response.data.rasi?.trim() || payload.rasi,
        tamil_name: response.data.tamil_name?.trim() ?? payload.tamil_name,
      };
      setProfile(updatedProfile);
      setIsEditingProfile(false);
      setProfileFormData(createDonorProfileFormState(updatedProfile));
    } catch (err) {
      setProfileFormError(extractErrorMessage(err));
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleInputChange =
    (field: keyof FamilyMemberFormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const startEditing = (member: FamilyMember) => {
    setFormData({
      name: member.name || '',
      relationship: member.relationship || '',
      gender: member.gender || '',
      date_of_birth: member.date_of_birth || '',
      tamil_star: member.tamil_star || '',
      gothra: member.gothra || '',
      rasi: member.rasi || '',
      family_name: member.family_name || profile?.family_name || '',
      family_selection: (() => {
        const fam = (member.family_name || profile?.family_name || '').trim();
        if (!fam) return '';
        return FAMILY_OPTIONS.includes(fam) ? fam : 'Other';
      })(),
    });
    setEditingMemberId(member.id);
    setIsAddingNew(false);
    setFormError(null);
  };

  const cancelEditing = () => {
    setEditingMemberId(null);
    setFormData(createInitialFormState(profile ?? undefined));
    setFormError(null);
  };

  const startEditingRegistration = (registration: PoojaRegistration) => {
    if (registrationEditSubmitting) {
      return;
    }
    setEditingRegistrationId(registration.id);
    setRegistrationEditDate(formatDateForInput(registration.start_date));
    setRegistrationEditError(null);
  };

  const cancelRegistrationEditing = () => {
    if (registrationEditSubmitting) {
      return;
    }
    setEditingRegistrationId(null);
    setRegistrationEditDate('');
    setRegistrationEditError(null);
  };

  const submitRegistrationEdit = async () => {
    if (!editingRegistrationId) {
      return;
    }
    if (!registrationEditDate) {
      setRegistrationEditError('Pooja date is required');
      return;
    }
    setRegistrationEditSubmitting(true);
    setRegistrationEditError(null);
    try {
      const response = await api.patch<PoojaRegistration>(`pooja/registrations/${editingRegistrationId}/`, {
        start_date: registrationEditDate,
      });
      setRegistrations((prev) =>
        prev.map((item) => (item.id === editingRegistrationId ? { ...item, ...response.data } : item))
      );
      setEditingRegistrationId(null);
      setRegistrationEditDate('');
    } catch (err) {
      setRegistrationEditError(extractErrorMessage(err));
    } finally {
      setRegistrationEditSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        relationship: formData.relationship.trim(),
        gender: formData.gender.trim(),
        date_of_birth: formData.date_of_birth || null,
        tamil_star: formData.tamil_star.trim(),
        gothra: formData.gothra.trim(),
        rasi: formData.rasi.trim(),
        family_name: formData.family_name.trim(),
      };

      if (editingMemberId) {
        const response = await api.put<FamilyMember>(`auth/family-members/${editingMemberId}/`, payload);
        setMembers((prev) => sortMembers(prev.map(m => m.id === editingMemberId ? response.data : m)));
        setEditingMemberId(null);
      } else {
        const response = await api.post<FamilyMember>('auth/family-members/', payload);
        setMembers((prev) => sortMembers([...prev, response.data]));
        setIsAddingNew(false);
      }
      setFormData(createInitialFormState(profile ?? undefined));
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const profileAddress = () => {
    if (!profile) {
      return '—';
    }
    const parts = [
      profile.address_line1,
      profile.address_line2,
      profile.address_line3,
      profile.city,
      profile.state,
      profile.postal_code,
    ]
      .map((part) => (part ?? '').trim())
      .filter((part) => part.length > 0);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  const donorDetails: Array<{ label: string; value: string; span?: string }> = [
    { label: 'Donor ID', value: resolveText(profile?.donor_id ?? '') },
    { label: 'Family Name', value: resolveText(profile?.family_name) },
    { label: 'Donor Name', value: resolveText(user?.name ?? '') },
    { label: 'Tamil Name (Saravam)', value: resolveText(profile?.tamil_name) },
    { label: 'Donor Header Text', value: resolveText(profile?.notes) },
    { label: 'Gender', value: formatGender(profile?.gender) },
    { label: 'Date of Birth', value: formatDate(profile?.date_of_birth) },
    { label: 'Gothra', value: resolveText(profile?.gothra) },
    { label: 'Tamil Star', value: resolveText(profile?.tamil_star) },
    { label: 'Rasi', value: resolveText(profile?.rasi) },
    { label: 'Phone No', value: resolveText(user?.phone_number ?? '') },
    { label: 'Address', value: profileAddress(), span: 'sm:col-span-2 lg:col-span-3' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-[90rem] px-4 lg:px-8">
      <div className="mb-6 sm:mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">Donor Profile</h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">Review your donor details and manage your family members.</p>
        </div>
        <div className="flex items-end gap-3 sm:text-right">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Balance</span>
            <span className="text-lg font-semibold text-orange-600">
              {balanceLoading ? 'Loading...' : balanceError ? 'Unavailable' : formatCurrencyValue(currentBalance)}
            </span>
            {balanceError && (
              <span className="text-[0.7rem] text-rose-600 capitalize">{balanceError}</span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center rounded-lg border border-slate-200 bg-white/90 p-8 text-sm text-slate-500 shadow-sm backdrop-blur">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
            <span className="mt-3">Loading profile...</span>
          </div>
        </div>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="mt-6 space-y-8">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">Donor Details</h2>
                <p className="text-sm text-slate-500">Review and update the information we have on file for you.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {isEditingProfile ? (
                  <>
                    <button
                      type="button"
                      onClick={cancelProfileEditing}
                      className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                      disabled={profileSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitProfileForm}
                      className="rounded bg-orange-600 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-70"
                      disabled={profileSubmitting}
                    >
                      {profileSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={startEditingProfile}
                    className="rounded border border-orange-600 px-3 py-1 text-sm font-semibold text-orange-600 transition hover:bg-orange-50"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
            {profileFormError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileFormError}
              </div>
            )}
            {isEditingProfile ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Family Name</label>
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.family_name}
                      onChange={handleProfileInputChange('family_name')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.gender}
                      onChange={handleProfileInputChange('gender')}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tamil Name (Saravam)</label>
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.tamil_name}
                      onChange={handleProfileInputChange('tamil_name')}
                      placeholder="Enter Tamil name (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.date_of_birth}
                      onChange={handleProfileInputChange('date_of_birth')}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Donor Header Text</label>
                    <textarea
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      rows={2}
                      value={profileFormData.notes}
                      onChange={handleProfileInputChange('notes')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Gothra</label>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.gothra}
                      onChange={handleProfileInputChange('gothra')}
                    >
                      <option value="">Select Gothra</option>
                      {gothraOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tamil Star</label>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.tamil_star}
                      onChange={handleProfileInputChange('tamil_star')}
                    >
                      <option value="">Select Tamil star</option>
                      {tamilStarOptions.map((star) => (
                        <option key={star} value={star}>
                          {star}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Rasi</label>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.rasi}
                      onChange={handleProfileInputChange('rasi')}
                    >
                      <option value="">Select Rasi</option>
                      {rasiOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.address_line1}
                      onChange={handleProfileInputChange('address_line1')}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.address_line2}
                      onChange={handleProfileInputChange('address_line2')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.city}
                      onChange={handleProfileInputChange('city')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.state}
                      onChange={handleProfileInputChange('state')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={profileFormData.postal_code}
                      onChange={handleProfileInputChange('postal_code')}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {donorDetails.map(({ label, value, span }) => (
                  <div
                    key={label}
                    className={`flex flex-col rounded-lg border border-slate-100 bg-slate-50/60 p-4 ${span ?? ''}`}
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-800 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">Family Members</h2>
                <p className="text-sm text-slate-500">Keep your family list current for Pooja registrations.</p>
              </div>
              <button
                type="button"
                onClick={startAddingNew}
                className="mt-2 inline-flex items-center justify-center rounded-lg border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-600 transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:mt-0"
              >
                + Add Member
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {members.length === 0 && !isAddingNew ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No family members added yet. Click &quot;Add Member&quot; to include your family details.
              </div>
            ) : (
              <div className="mt-6">
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {isAddingNew && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-medium text-slate-800 mb-3">Add New Member</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.name}
                            onChange={handleInputChange('name')}
                            placeholder="Enter full name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Relationship</label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.relationship}
                            onChange={handleInputChange('relationship')}
                            placeholder="e.g., Son, Daughter"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.gender}
                            onChange={handleInputChange('gender')}
                          >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                          <input
                            type="date"
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.date_of_birth}
                            onChange={handleInputChange('date_of_birth')}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Rasi</label>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.rasi}
                            onChange={(event) =>
                              setFormData((prev) => ({
                                ...prev,
                                rasi: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select Rasi</option>
                            {rasiOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Tamil Star</label>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.tamil_star}
                            onChange={(event) =>
                              setFormData((prev) => ({
                                ...prev,
                                tamil_star: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select Tamil star</option>
                            {tamilStarOptions.map((star) => (
                              <option key={star} value={star}>
                                {star}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Gothram</label>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.gothra}
                            onChange={handleInputChange('gothra')}
                          >
                            <option value="">Select Gothra</option>
                            {gothraOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Family Name</label>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={formData.family_selection}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                family_selection: val,
                                family_name: val === 'Other' ? '' : val,
                              }));
                            }}
                          >
                            <option value="">Select a family</option>
                            {FAMILY_OPTIONS.map((opt) => (
                              <option key={opt} value={opt === 'Other' ? 'Other' : opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {formData.family_selection === 'Other' && (
                            <input
                              type="text"
                              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.family_name}
                              onChange={handleInputChange('family_name')}
                              placeholder="Enter family name"
                            />
                          )}
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                          <button
                            type="button"
                            onClick={cancelAddingNew}
                            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            disabled={submitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSubmit}
                            className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
                            disabled={submitting}
                          >
                            {submitting ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {members.map((member) => (
                    <div key={member.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      {editingMemberId === member.id ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                            <input
                              type="text"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.name}
                              onChange={handleInputChange('name')}
                              placeholder="Enter full name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Relationship</label>
                            <input
                              type="text"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.relationship}
                              onChange={handleInputChange('relationship')}
                              placeholder="e.g., Son, Daughter"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                            <select
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.gender}
                              onChange={handleInputChange('gender')}
                            >
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                            <input
                              type="date"
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.date_of_birth}
                              onChange={handleInputChange('date_of_birth')}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Rasi</label>
                            <select
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.rasi}
                              onChange={(event) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  rasi: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select Rasi</option>
                              {rasiOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Tamil Star</label>
                            <select
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.tamil_star}
                              onChange={(event) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  tamil_star: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select Tamil star</option>
                              {tamilStarOptions.map((star) => (
                                <option key={star} value={star}>
                                  {star}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Gothra</label>
                            <select
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.gothra}
                              onChange={handleInputChange('gothra')}
                            >
                              <option value="">Select Gothra</option>
                              {gothraOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Family Name</label>
                            <select
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={formData.family_selection}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((prev) => ({
                                  ...prev,
                                  family_selection: val,
                                  family_name: val === 'Other' ? '' : val,
                                }));
                              }}
                            >
                              <option value="">Select a family</option>
                              {FAMILY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt === 'Other' ? 'Other' : opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            {formData.family_selection === 'Other' && (
                              <input
                                type="text"
                                className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                                value={formData.family_name}
                                onChange={handleInputChange('family_name')}
                                placeholder="Enter family name"
                              />
                            )}
                          </div>
                          <div className="flex justify-end space-x-3 pt-2">
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                              disabled={submitting}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmit}
                              className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
                              disabled={submitting}
                            >
                              {submitting ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="text-base font-medium text-slate-800">{resolveText(member.name)}</h3>
                            <button
                              type="button"
                              onClick={() => startEditing(member)}
                              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-xs text-slate-500">Relationship</dt>
                              <dd className="text-slate-700">{resolveText(member.relationship)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">Gender</dt>
                              <dd className="text-slate-700">{resolveText(member.gender)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">Date of Birth</dt>
                              <dd className="text-slate-700">{formatDate(member.date_of_birth)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">Rasi</dt>
                              <dd className="text-slate-700">{resolveText(member.rasi)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">Tamil Star</dt>
                              <dd className="text-slate-700">{resolveText(member.tamil_star)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">Gothra</dt>
                              <dd className="text-slate-700">{resolveText(member.gothra)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">Family Name</dt>
                              <dd className="text-slate-700">{resolveText(member.family_name ?? profile?.family_name ?? '')}</dd>
                            </div>
                          </dl>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1600px] divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[280px]">Name</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[240px]">Relationship</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[180px]">Gender</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[180px]">
                            Date of Birth
                          </th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[200px]">Rasi</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[240px]">Tamil Star</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[220px]">Gothra</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold min-w-[320px]">Family Name</th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold min-w-[180px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {isAddingNew && (
                          <tr className="bg-slate-50/70">
                            <td className="px-4 py-3 align-top min-w-[280px]">
                              <input
                                type="text"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.name}
                                onChange={handleInputChange('name')}
                                placeholder="Enter full name"
                              />
                            </td>
                              <td className="px-4 py-3 align-top min-w-[240px]">
                              <input
                                type="text"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.relationship}
                                onChange={handleInputChange('relationship')}
                                placeholder="e.g., Son, Daughter"
                              />
                            </td>
                            <td className="px-4 py-3 align-top min-w-[180px]">
                              <select
                                className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.gender}
                                onChange={handleInputChange('gender')}
                              >
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 align-top min-w-[180px]">
                              <input
                                type="date"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.date_of_birth}
                                onChange={handleInputChange('date_of_birth')}
                              />
                            </td>
                            <td className="px-4 py-3 align-top min-w-[200px]">
                              <select
                                className="w-full min-w-[200px] rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.rasi}
                                onChange={(event) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    rasi: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Select Rasi</option>
                                {rasiOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 align-top min-w-[240px]">
                              <select
                                className="w-full min-w-[240px] rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.tamil_star}
                                onChange={(event) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    tamil_star: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Select Tamil star</option>
                                {tamilStarOptions.map((star) => (
                                  <option key={star} value={star}>
                                    {star}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 align-top min-w-[220px]">
                              <select
                                className="w-full min-w-[220px] rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.gothra}
                                onChange={handleInputChange('gothra')}
                              >
                                <option value="">Select Gothra</option>
                                {gothraOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 align-top min-w-[320px]">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                                <div className="w-full sm:min-w-[320px]">
                                  <label className="sr-only">Family</label>
                                  <select
                                    className="w-full min-w-[320px] rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.family_selection}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormData((prev) => ({
                                        ...prev,
                                        family_selection: val,
                                        family_name: val === 'Other' ? '' : val,
                                      }));
                                    }}
                                  >
                                    <option value="">Select a family</option>
                                    {FAMILY_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt === 'Other' ? 'Other' : opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                  {formData.family_selection === 'Other' && (
                                    <input
                                      type="text"
                                      className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                      value={formData.family_name}
                                      onChange={handleInputChange('family_name')}
                                      placeholder="Enter family name"
                                    />
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-right min-w-[180px]">
                              <div className="flex flex-col items-stretch gap-2 sm:inline-flex sm:flex-row sm:justify-end">
                                <button
                                  type="button"
                                  onClick={cancelAddingNew}
                                  className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                                  disabled={submitting}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSubmit}
                                  className="rounded bg-orange-600 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-500"
                                  disabled={submitting}
                                >
                                  {submitting ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {members.map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50">
                            {editingMemberId === member.id ? (
                              <>
                                <td className="px-4 py-3 align-top min-w-[280px]">
                                  <input
                                    type="text"
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.name}
                                    onChange={handleInputChange('name')}
                                    placeholder="Enter full name"
                                  />
                                </td>
                                <td className="px-4 py-3 align-top min-w-[240px]">
                                  <input
                                    type="text"
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.relationship}
                                    onChange={handleInputChange('relationship')}
                                    placeholder="e.g., Son, Daughter"
                                  />
                                </td>
                                <td className="px-4 py-3 align-top min-w-[180px]">
                                  <select
                                    className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.gender}
                                    onChange={handleInputChange('gender')}
                                  >
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3 align-top min-w-[180px]">
                                  <input
                                    type="date"
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.date_of_birth}
                                    onChange={handleInputChange('date_of_birth')}
                                  />
                                </td>
                                <td className="px-4 py-3 align-top min-w-[200px]">
                                  <select
                                    className="w-full min-w-[200px] rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.rasi}
                                    onChange={(event) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        rasi: event.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">Select Rasi</option>
                                    {rasiOptions.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3 align-top min-w-[240px]">
                                  <select
                                    className="w-full min-w-[240px] rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.tamil_star}
                                    onChange={(event) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        tamil_star: event.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">Select Tamil star</option>
                                    {tamilStarOptions.map((star) => (
                                      <option key={star} value={star}>
                                        {star}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3 align-top min-w-[220px]">
                                  <select
                                    className="w-full min-w-[220px] rounded border border-slate-300 px-2 py-1 text-sm"
                                    value={formData.gothra}
                                    onChange={handleInputChange('gothra')}
                                  >
                                    <option value="">Select Gothra</option>
                                    {gothraOptions.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3 align-top min-w-[320px]">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                                    <div className="w-full sm:min-w-[320px]">
                                      <label className="sr-only">Family</label>
                                      <select
                                        className="w-full min-w-[320px] rounded border border-slate-300 px-2 py-1 text-sm"
                                        value={formData.family_selection}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormData((prev) => ({
                                            ...prev,
                                            family_selection: val,
                                            family_name: val === 'Other' ? '' : val,
                                          }));
                                        }}
                                      >
                                        <option value="">Select a family</option>
                                        {FAMILY_OPTIONS.map((opt) => (
                                          <option key={opt} value={opt === 'Other' ? 'Other' : opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                      {formData.family_selection === 'Other' && (
                                        <input
                                          type="text"
                                          className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                          value={formData.family_name}
                                          onChange={handleInputChange('family_name')}
                                          placeholder="Enter family name"
                                        />
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top text-right min-w-[180px]">
                                  <div className="flex flex-col items-stretch gap-2 sm:inline-flex sm:flex-row sm:justify-end">
                                    <button
                                      type="button"
                                      onClick={cancelEditing}
                                      className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                                      disabled={submitting}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleSubmit}
                                      className="rounded bg-orange-600 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-500"
                                      disabled={submitting}
                                    >
                                      {submitting ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 text-slate-700 min-w-[280px]">{resolveText(member.name)}</td>
                                <td className="px-4 py-3 text-slate-600 min-w-[240px]">
                                  {resolveText(member.relationship)}
                                </td>
                                <td className="px-4 py-3 text-slate-600 min-w-[180px]">{resolveText(member.gender)}</td>
                                <td className="px-4 py-3 text-slate-600 min-w-[180px]">
                                  {formatDate(member.date_of_birth)}
                                </td>
                                <td className="px-4 py-3 text-slate-600 min-w-[200px]">{resolveText(member.rasi)}</td>
                                <td className="px-4 py-3 text-slate-600 min-w-[240px]">{resolveText(member.tamil_star)}</td>
                                <td className="px-4 py-3 text-slate-600 min-w-[220px]">{resolveText(member.gothra)}</td>
                                <td className="px-4 py-3 text-slate-600 min-w-[320px]">
                                  {resolveText(member.family_name ?? profile?.family_name ?? '')}
                                </td>
                                <td className="px-4 py-3 text-right min-w-[180px]">
                                  <button
                                    type="button"
                                    onClick={() => startEditing(member)}
                                    className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">One-time Registered Pooja&apos;s</h2>
                <p className="text-sm text-slate-500">Review all pooja registrations linked to your account.</p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600">
                {visibleRegistrations.length} {visibleRegistrations.length === 1 ? 'Registration' : 'Registrations'}
              </span>
            </div>

            {paymentRecordsError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                Unable to load payment status updates. {paymentRecordsError}
              </div>
            )}

            {fromCartReview && pendingCartCount > 0 && (
              <div className="mt-4 space-y-2 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                <p className="font-semibold">
                  You&apos;re reviewing {pendingCartCount} cart item
                  {pendingCartCount === 1 ? '' : 's'} before saving. We will redirect you to the Payment Page shortly.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualPaymentRedirect}
                    className="inline-flex items-center justify-center rounded-full bg-orange-600 px-4 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700"
                  >
                    Continue to Payment
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                    Redirecting in a moment...
                  </span>
                </div>
              </div>
            )}

            {pendingRegistrations.length > 0 && (
              <div className="mt-6 space-y-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Cart preview (pending registrations)</p>
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Pending
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingRegistrations.map((item) => {
                    const serviceDate = item.customDayDate || item.bookingDate;
                    const membersLabel = buildCartMemberNames(item.members);
                    const amountLabel = formatCartAmount(item.amount);
                    return (
                      <article key={item.cartId} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500">
                              {item.poojaCode ?? 'POOJA'}
                            </p>
                            <h3 className="text-lg font-semibold text-slate-900">{item.poojaName}</h3>
                            {item.dayOptionDescription && (
                              <p className="text-sm text-slate-500">{item.dayOptionDescription}</p>
                            )}
                          </div>
                          <span className="rounded-full bg-amber-100 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            Cart
                          </span>
                        </div>
                        <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Service Date</dt>
                            <dd className="text-slate-800">{formatDate(serviceDate)}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Members</dt>
                            <dd className="text-slate-800">{membersLabel}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</dt>
                            <dd className="text-slate-800">{amountLabel}</dd>
                          </div>
                        </dl>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span
                            className={`rounded-full px-3 py-0.5 ${
                              item.postPrasadam ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            Post Prasadam {item.postPrasadam ? 'Yes' : 'No'}
                          </span>
                        </div>
                        {item.customDayNote && (
                          <p className="mt-3 text-sm text-slate-600">Notes: {item.customDayNote}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {registrationsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                Loading pooja registrations...
              </div>
            ) : registrationsError ? (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {registrationsError}
              </div>
            ) : visibleRegistrations.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No pooja registrations found for your account.
              </div>
            ) : (
              <div className="mt-6">
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                {visibleRegistrations.map((registration) => {
                  const isEditingRegistration = editingRegistrationId === registration.id;
                  const statusLabel = getRegistrationStatusLabel(
                    registration,
                    paymentRecordsByRegistration,
                    paymentRecordsLoaded,
                  );
                  const statusClasses = getRegistrationStatusBadgeClasses(statusLabel);
                  return (
                    <div key={registration.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-base font-medium text-indigo-700">
                          {resolvePoojaId(registration)}
                          </h3>
                          <button
                            type="button"
                            onClick={() => startEditingRegistration(registration)}
                            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit Date
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        
                        <dl className="space-y-2 text-sm">
                          <div>
                            <dt className="text-xs text-slate-500">Pooja Name</dt>
                            <dd className="text-slate-700">{registration.pooja_option_name?.trim() || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Pooja Date</dt>
                            <dd className="text-slate-700">
                              {isEditingRegistration ? (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="date"
                                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                                    value={registrationEditDate}
                                    onChange={(event) => setRegistrationEditDate(event.target.value)}
                                    max="9999-12-31"
                                  />
                                  {registrationEditError && (
                                    <span className="text-xs text-red-600">{registrationEditError}</span>
                                  )}
                                </div>
                              ) : (
                                formatDate(registration.start_date)
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Day Option</dt>
                            <dd className="text-slate-700">{registration.day_option_description?.trim() || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Devotees</dt>
                            <dd className="text-slate-700">{formatMemberNames(registration.members)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Post Prasadam</dt>
                            <dd className="text-slate-700">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  registration.post_prasadam
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {registration.post_prasadam ? 'Yes' : 'No'}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Registered On</dt>
                            <dd className="text-slate-700" title={formatRegistrationTimeline(registration)}>
                              {formatRegistrationTimeline(registration)}
                            </dd>
                          </div>
                        </dl>
                        
                        {isEditingRegistration && (
                          <div className="flex justify-end space-x-3 mt-4">
                            <button
                              type="button"
                              onClick={cancelRegistrationEditing}
                              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                              disabled={registrationEditSubmitting}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={submitRegistrationEdit}
                              className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-70"
                              disabled={registrationEditSubmitting}
                            >
                              {registrationEditSubmitting ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Pooja ID</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Pooja Name</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Pooja Date</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Day Option</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Devotees</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Post Prasadam</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Registered On</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {visibleRegistrations.map((registration, index) => {
                          const isEditingRegistration = editingRegistrationId === registration.id;
                          const statusLabel = getRegistrationStatusLabel(
                            registration,
                            paymentRecordsByRegistration,
                            paymentRecordsLoaded,
                          );
                          const statusClasses = getRegistrationStatusBadgeClasses(statusLabel);
                          return (
                            <tr key={registration.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                              <td className="whitespace-nowrap px-4 py-3 font-medium text-indigo-700">
                                {resolvePoojaId(registration)}
                              </td>
                              <td className="px-4 py-3 text-slate-700" title={registration.pooja_option_name ?? undefined}>
                                {registration.pooja_option_name?.trim() || '—'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                {isEditingRegistration ? (
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="date"
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                      value={registrationEditDate}
                                      onChange={(event) => setRegistrationEditDate(event.target.value)}
                                      max="9999-12-31"
                                    />
                                    {registrationEditError && (
                                      <span className="text-xs text-red-600">{registrationEditError}</span>
                                    )}
                                  </div>
                                ) : (
                                  formatDate(registration.start_date)
                                )}
                              </td>
                              <td
                                className="px-4 py-3 text-slate-700"
                                title={registration.day_option_description ?? undefined}
                              >
                                {registration.day_option_description?.trim() || '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-700">{formatMemberNames(registration.members)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    registration.post_prasadam
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {registration.post_prasadam ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td
                                className="whitespace-nowrap px-4 py-3 text-slate-700"
                                title={formatRegistrationTimeline(registration)}
                              >
                                {formatRegistrationTimeline(registration)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right min-w-[160px]">
                                {isEditingRegistration ? (
                                  <div className="flex flex-col items-stretch gap-2 sm:inline-flex sm:flex-row sm:justify-end">
                                    <button
                                      type="button"
                                      onClick={cancelRegistrationEditing}
                                      className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                                      disabled={registrationEditSubmitting}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={submitRegistrationEdit}
                                      className="rounded bg-orange-600 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-70"
                                      disabled={registrationEditSubmitting}
                                    >
                                      {registrationEditSubmitting ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditingRegistration(registration)}
                                    className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                                  >
                                    Edit Date
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 w-full mt-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">Recurring Pooja Plans</h2>
                <p className="text-sm text-slate-500">
                  Track your ongoing monthly schedules or one-time extras so you know what’s coming up.
                </p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                {recurringPlansToShow.length} {recurringPlansToShow.length === 1 ? 'Plan' : 'Plans'}
              </span>
            </div>

            {pendingRecurringPlans.length > 0 && (
              <div className="mt-6 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Cart preview (pending recurring plans)</p>
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Recurring
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingRecurringPlans.map((item) => {
                    const serviceDate = item.customDayDate || item.bookingDate;
                    const membersLabel = buildCartMemberNames(item.members);
                    const amountLabel = formatCartAmount(item.amount);
                    return (
                      <article key={item.cartId} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500">
                              {item.poojaCode ?? 'PLAN'}
                            </p>
                            <h3 className="text-lg font-semibold text-slate-900">{item.poojaName}</h3>
                            {item.dayOptionDescription && (
                              <p className="text-sm text-slate-500">{item.dayOptionDescription}</p>
                            )}
                            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {formatCartFrequencyLabel(item.recurrenceFrequency ?? null)}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                            Cart
                          </span>
                        </div>
                        <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              Next occurrence
                            </dt>
                            <dd className="text-slate-800">{formatDate(serviceDate)}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Members</dt>
                            <dd className="text-slate-800">{membersLabel}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</dt>
                            <dd className="text-slate-800">{amountLabel}</dd>
                          </div>
                        </dl>
                        {item.customDayNote && (
                          <p className="mt-3 text-sm text-slate-600">Notes: {item.customDayNote}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {recurrenceLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600"></div>
                Loading recurring plans...
              </div>
            ) : recurrenceError ? (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {recurrenceError}
              </div>
            ) : recurringPlansToShow.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No recurring plans found yet. Start by adding a recurring pooja from the registration page.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {recurringPlansToShow.map((plan) => {
                  const memberNames = getPlanMemberNames(plan.metadata);
                  const pauseReasonLabel = getPauseReasonLabel(plan.metadata);
                  const pauseDuration = pauseDurationSelection[plan.id] ?? 1;
                  const currentAction = planActionState[plan.id] ?? null;
                  const actionLoading = Boolean(currentAction);
                  const isRecurringPlan = plan.recurrence_kind === 'recurring';
                  const selectedPauseReason = pauseReasonSelections[plan.id] ?? PAUSE_REASON_OPTIONS[0];
                  const isPlanActive = plan.is_active && isRecurringPlan;
                  const cancellationDate =
                    isRecord(plan.metadata) && typeof plan.metadata.canceled_at === 'string'
                      ? plan.metadata.canceled_at
                      : null;
                  const dueRegistration = plan.due_registration ?? null;
                  const dueAmountValue = dueRegistration
                    ? parseDecimalValue(dueRegistration.due_amount)
                    : 0;
                  const planAmountValue = parseDecimalValue(plan.amount);
                  const paymentReadyLabel =
                    dueRegistration && dueAmountValue <= 0 ? 'Payment up to date' : null;
                  const upcomingLabel =
                    !dueRegistration && !paymentReadyLabel
                      ? 'Upcoming payment will appear here'
                      : null;
                  const statusLabel = paymentReadyLabel ?? upcomingLabel;
                  const amountToPay =
                    dueRegistration && dueAmountValue > 0 ? dueRegistration.due_amount : plan.amount ?? planAmountValue;
                  const buttonAmountLabel = formatCartAmount(amountToPay ?? planAmountValue);
                  const shouldShowPayButton = isRecurringPlan && plan.is_active;
                  const preparingPayment = currentAction === 'prepare';
                  const planRegistrationLabel =
                    plan.origin_registration_created_at
                      ? formatPlanRegistrationTimeline(
                          plan.origin_registration_created_at,
                          plan.origin_registration_updated_at,
                        )
                      : null;
                  const planPaymentStatusLabel =
                    dueRegistration && dueRegistration.id
                      ? getRegistrationStatusLabel(
                          { id: dueRegistration.id, status: dueRegistration.status ?? undefined } as PoojaRegistration,
                          paymentRecordsByRegistration,
                          paymentRecordsLoaded,
                        )
                      : null;
                  const planPaymentStatusClasses = planPaymentStatusLabel
                    ? getRegistrationStatusBadgeClasses(planPaymentStatusLabel)
                    : null;
                  return (
                    <div
                      key={plan.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                          {plan.pooja_option_code || 'Pooja'}
                        </p>
                        <h3 className="text-base font-medium text-slate-900">
                          {plan.pooja_option_name?.trim() || 'Unnamed pooja'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {plan.day_option_description?.trim() || '—'}
                        </p>
                        {planRegistrationLabel && planRegistrationLabel !== '—' && (
                          <p className="text-xs text-slate-500">
                            Registered on {planRegistrationLabel}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          plan.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">Schedule</p>
                          <p className="text-base font-semibold text-slate-900">
                            {formatPlanFrequencyLabel(plan.recurrence_kind, plan.recurrence_frequency)}
                          </p>
                        </div>
                        {isRecurringPlan && (
                          <button
                            type="button"
                            onClick={() => startEditingPlan(plan)}
                            className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100"
                          >
                            Edit plan
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Next occurrence</p>
                          <p className="text-sm font-medium text-slate-900">
                            {formatPlanDateLabel(plan, todayIso)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Amount</p>
                          <p className="text-sm font-medium text-slate-900">
                            ₹ {formatPlanAmount(plan.amount)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(plan.pause_from || plan.pause_until) && (
                      <div className="mt-4 text-xs font-semibold text-orange-700">
                        {plan.pause_from && plan.pause_until
                          ? `Paused from ${formatDate(plan.pause_from)} until ${formatDate(plan.pause_until)}.`
                          : plan.pause_until
                            ? `Paused until ${formatDate(plan.pause_until)}.`
                            : `Pause scheduled from ${formatDate(plan.pause_from)}.`}
                        {pauseReasonLabel && (
                          <p className="mt-1 text-xs font-normal text-orange-700">
                            Handling: {pauseReasonLabel}
                          </p>
                        )}
                      </div>
                    )}
                    {memberNames.length > 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        Members: {memberNames.join(', ')}
                      </p>
                    )}
                    {dueRegistration && (
                      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Due amount
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCartAmount(dueRegistration.due_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Paid amount
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCartAmount(dueRegistration.paid_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Scheduled for
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {dueRegistration.start_date ? formatDate(dueRegistration.start_date) : '—'}
                          </p>
                        </div>
                      </div>
                    )}
                      <div className="mt-3 space-y-2">
                        {planPaymentStatusLabel && planPaymentStatusClasses && (
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${planPaymentStatusClasses}`}
                            >
                              {planPaymentStatusLabel}
                            </span>
                          </div>
                        )}
                        {statusLabel && (
                          <div
                            className={`text-xs font-semibold uppercase tracking-wide ${
                              paymentReadyLabel ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            {statusLabel}
                          </div>
                        )}
                      <div className="mt-1 flex flex-nowrap items-start gap-2">
                        {shouldShowPayButton && (
                          <div className="flex flex-col gap-1 self-start">
                            <button
                              type="button"
                              onClick={() => handlePrepareRecurringPayment(plan)}
                              disabled={actionLoading}
                              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
                            >
                              {preparingPayment ? 'Preparing payment…' : 'Pay'}
                            </button>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {buttonAmountLabel}
                            </span>
                          </div>
                        )}
                        {isRecurringPlan && (
                          <>
                            {isPlanActive ? (
                              <>
                              <button
                                type="button"
                                onClick={() => togglePauseForm(plan.id)}
                                disabled={actionLoading}
                                className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {activePausePlanId === plan.id ? 'Hide pause options' : 'Pause'}
                              </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelPlan(plan)}
                                  disabled={actionLoading}
                                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {currentAction === 'cancel' ? 'Canceling...' : 'Cancel'}
                                </button>
                              </>
                            ) : (
                              <>
                              <button
                                type="button"
                                onClick={() => togglePauseForm(plan.id)}
                                disabled={actionLoading}
                                className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {activePausePlanId === plan.id ? 'Hide pause details' : 'Edit pause details'}
                              </button>
                                <button
                                  type="button"
                                  onClick={() => handleResumePlan(plan.id)}
                                  disabled={actionLoading}
                                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
                                >
                                  {currentAction === 'resume' ? 'Resuming...' : 'Resume plan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelPlan(plan)}
                                  disabled={actionLoading}
                                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70"
                                >
                                  {currentAction === 'cancel' ? 'Canceling...' : 'Cancel'}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {isRecurringPlan && (
                      <div className="mt-4 space-y-3">
                        {editingPlanId === plan.id && (
                          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1 text-sm text-slate-500">
                                <label
                                  htmlFor={`plan-frequency-${plan.id}`}
                                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                  Recurrence frequency
                                </label>
                                <select
                                  id={`plan-frequency-${plan.id}`}
                                  value={planEditValues.recurrence_frequency}
                                  onChange={(event) =>
                                    handlePlanEditChange('recurrence_frequency', event.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                >
                                  {PLAN_FREQUENCY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1 text-sm text-slate-500">
                                <label
                                  htmlFor={`plan-amount-${plan.id}`}
                                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                  Amount
                                </label>
                                <input
                                  id={`plan-amount-${plan.id}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={planEditValues.amount}
                                  onChange={(event) => handlePlanEditChange('amount', event.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handlePlanEditSave}
                                disabled={planEditSubmitting}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
                              >
                                {planEditSubmitting ? 'Saving...' : 'Save changes'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelPlanEditing}
                                disabled={planEditSubmitting}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-wait disabled:opacity-70"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {isPlanActive ? (
                          <>
                            {activePausePlanId === plan.id && (
                              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="space-y-1 text-sm text-slate-500">
                                  <label
                                    htmlFor={`pause-reason-${plan.id}`}
                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                  >
                                    Pause handling
                                  </label>
                                  <select
                                    id={`pause-reason-${plan.id}`}
                                    value={selectedPauseReason}
                                    onChange={(event) =>
                                      setPauseReasonSelections((prev) => ({
                                        ...prev,
                                        [plan.id]: event.target.value,
                                      }))
                                    }
                                    className="w-full max-w-[320px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                  >
                                    {PAUSE_REASON_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1 text-sm text-slate-500">
                                  <label
                                    htmlFor={`pause-months-${plan.id}`}
                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                  >
                                    Pause duration (months)
                                  </label>
                                  <select
                                    id={`pause-months-${plan.id}`}
                                    value={pauseDuration}
                                    onChange={(event) =>
                                      setPauseDurationSelection((prev) => ({
                                        ...prev,
                                        [plan.id]: Number(event.target.value),
                                      }))
                                    }
                                    className="w-full max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
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
                                  onClick={() => handlePausePlan(plan, selectedPauseReason)}
                                  disabled={actionLoading}
                                  className="w-full rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-70"
                                >
                                  {currentAction === 'pause' ? 'Pausing...' : 'Pause plan'}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {cancellationDate && (
                              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                                Canceled on {formatDate(cancellationDate)}
                              </div>
                            )}
                            {activePausePlanId === plan.id && (
                              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Update pause window
                                </p>
                                <div className="space-y-1 text-sm text-slate-500">
                                  <label
                                    htmlFor={`pause-months-${plan.id}`}
                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                  >
                                    Pause duration (months)
                                  </label>
                                  <select
                                    id={`pause-months-${plan.id}`}
                                    value={pauseDuration}
                                    onChange={(event) =>
                                      setPauseDurationSelection((prev) => ({
                                        ...prev,
                                        [plan.id]: Number(event.target.value),
                                      }))
                                    }
                                    className="w-full max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                  >
                                    {PAUSE_MONTH_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option} month{option > 1 ? 's' : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1 text-sm text-slate-500">
                                  <label
                                    htmlFor={`pause-reason-${plan.id}`}
                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                  >
                                    Pause handling
                                  </label>
                                  <select
                                    id={`pause-reason-${plan.id}`}
                                    value={selectedPauseReason}
                                    onChange={(event) =>
                                      setPauseReasonSelections((prev) => ({
                                        ...prev,
                                        [plan.id]: event.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                  >
                                    {PAUSE_REASON_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handlePausePlan(plan, selectedPauseReason)}
                                  disabled={actionLoading}
                                  className="w-full rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-70"
                                >
                                  {currentAction === 'pause' ? 'Updating...' : 'Update pause'}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  </div>
  );
};

export default DonorProfile;
