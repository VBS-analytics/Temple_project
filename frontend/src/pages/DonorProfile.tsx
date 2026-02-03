import axios from 'axios';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import api, { extractResults } from '../lib/api';
import type { RecurrenceFrequency, RecurrenceKind } from '../types/recurrence';
import { rasiOptions, tamilStarOptions } from '../data/familyAttributes';
import { useMasterDataStore } from '../store/masterData';

// --- INTERFACES ---
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
  dayOptionCode?: string | null;
  day_option_code?: string | null;
  dayOptionDescription?: string | null;
  day_option_description?: string | null;
  selectedTamilStarId?: string | null;
  selectedTamilStarLabel?: string | null;
}

interface PoojaRegistration {
  id: number;
  recurrence_kind?: RecurrenceKind | null;
  recurrence_frequency?: string | null;
  recurrence_one_time_date?: string | null;
  pooja_reg_id?: string | null;
  pooja_option_name?: string | null;
  start_date?: string | null;
  day_option_code?: string | null;
  day_option_description?: string | null;
  post_prasadam?: boolean | null;
  total_amount?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  members?: RegistrationMember[];
  status?: string | null;
  cart_item?: RegistrationCartItem | null;
  pooja_option_code?: string | null;
}

interface RecurringPlan {
  id: number;
  pooja_option_name?: string | null;
  pooja_option_code?: string | null;
  day_option_description?: string | null;
  day_option_code?: string | null;
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
  cart_payload?: Record<string, unknown> | null;
}

interface RegistrationEditFormState {
  start_date: string;
  amount: string;
}

interface PlanEditFormState {
  recurrence_frequency: RecurrenceFrequency;
  amount: string;
}


// --- CONSTANTS ---
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

const RECURRENCE_FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const createInitialPlanEditState = (): PlanEditFormState => ({
  recurrence_frequency: 'monthly',
  amount: '',
});

const ensureRecurrenceFrequency = (value?: string | null): RecurrenceFrequency => {
  if (!value) return 'monthly';
  if (RECURRENCE_FREQUENCY_OPTIONS.some((option) => option.value === value)) {
    return value as RecurrenceFrequency;
  }
  return 'monthly';
};

// --- UTILITIES ---
const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const resolveText = (value?: string | null) => {
  if (!value) return '—';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
};

const formatGender = (value?: string | null) => {
  if (!value) return '—';
  const normalized = value.replace(/_/g, ' ').trim();
  if (!normalized) return '—';
  return normalized
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const sortMembers = (list: FamilyMember[]) =>
  [...list].sort((a, b) => {
    const left = (a.name || '').toLowerCase();
    const right = (b.name || '').toLowerCase();
    return left.localeCompare(right);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getPauseReasonLabel = (metadata?: Record<string, unknown>) => {
  if (!isRecord(metadata)) return null;
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
          if (error.response?.status === 404) return 'Requested resource was not found.';
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
        if (Array.isArray(messageValue)) return messageValue.join(', ');
        if (typeof messageValue === 'string') return messageValue;
      }
    }
    return error.message || 'Unexpected error';
  }
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
};

const formatPlanFrequencyLabel = (kind: RecurringPlan['recurrence_kind'], frequency?: string | null) => {
  if (kind === 'recurring') {
    const frequencyLabel =
      frequency === 'monthly'
        ? 'Monthly'
        : frequency === 'quarterly'
          ? 'Quarterly'
          : frequency === 'annually'
            ? 'Annually'
            : 'Recurring';
    return `${frequencyLabel} recurring`;
  }
  return 'One-time extra';
};

const formatPlanAmount = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
};

const formatDateForInput = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

const parseDecimalValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getPlanMemberNames = (metadata?: RecurringPlan['metadata']) => {
  if (!metadata) return [];
  const members = (metadata as { members?: unknown }).members;
  if (!Array.isArray(members)) return [];
  return members.map((entry) => {
    if (typeof entry === 'object' && entry !== null) {
      const name = (entry as { name?: string | null }).name;
      if (name && name.trim()) return name.trim();
    }
    return 'Member';
  });
};

const normalizeCode = (value?: string | null) => (value ?? '').trim().toUpperCase();

const getPayloadDayOptionCode = (payload?: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  const keys = ['dayOptionCode', 'day_option_code'] as const;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toUpperCase();
    }
  }
  return '';
};

const getPayloadDayOptionDescription = (payload?: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  const keys = ['dayOptionDescription', 'day_option_description'] as const;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const includesCHRTKeyword = (value?: string | null) => {
  const normalized = (value ?? '').toLowerCase();
  return normalized.includes('preferred date') || normalized.includes('chrt');
};

const isCHRTPlan = (plan: RecurringPlan) => {
  const code =
    normalizeCode(plan.day_option_code) || getPayloadDayOptionCode(plan.cart_payload ?? undefined);
  const hasPreferredDate = Boolean(plan.one_time_date);

  if (code === 'CHRT') {
    return true;
  }
  // Legacy CHRT plans were saved with null day_option but one_time_date set.
  if (plan.recurrence_kind === 'recurring' && hasPreferredDate) {
    return true;
  }
  return includesCHRTKeyword(plan.day_option_description);
};

const isCHRTRegistration = (registration: PoojaRegistration) => {
  const code = getPayloadDayOptionCode(registration.cart_item ?? undefined);
  const dayOptionCode = normalizeCode(registration.day_option_code);
  if (dayOptionCode === 'CHRT') {
    return true;
  }
  if (code === 'CHRT') {
    return true;
  }
  if (includesCHRTKeyword(registration.day_option_description)) {
    return true;
  }
  const cartDescription =
    registration.cart_item?.dayOptionDescription ?? registration.cart_item?.day_option_description ?? '';
  return includesCHRTKeyword(cartDescription);
};

const isTamilStarDayOption = (
  dayOptionCode?: string | null,
  payload?: unknown,
  description?: string | null,
) => {
  const code = normalizeCode(dayOptionCode) || getPayloadDayOptionCode(payload);
  if (code === 'CS') {
    return true;
  }
  const normalizedDescription = (description ?? '').toLowerCase();
  if (normalizedDescription.includes('tamil star')) {
    return true;
  }
  const payloadDescription = getPayloadDayOptionDescription(payload).toLowerCase();
  return payloadDescription.includes('tamil star');
};

const getTamilStarLabelFromPayload = (payload?: unknown) => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const labelKeys = ['selectedTamilStarLabel', 'selected_tamil_star_label'] as const;
  for (const key of labelKeys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  const idKeys = ['selectedTamilStarId', 'selected_tamil_star_id'] as const;
  for (const key of idKeys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return null;
};

const resolveTamilStarSelection = (
  dayOptionCode?: string | null,
  payload?: unknown,
  description?: string | null,
) => {
  if (!isTamilStarDayOption(dayOptionCode, payload, description)) {
    return null;
  }
  return getTamilStarLabelFromPayload(payload) ?? '—';
};

const resolvePoojaId = (registration: PoojaRegistration) => {
  const trimmed = (registration.pooja_reg_id ?? '').trim();
  return trimmed.length > 0 ? trimmed : `#${registration.id}`;
};

const formatMemberNames = (members?: RegistrationMember[]) => {
  if (!Array.isArray(members)) return '—';
  const names = members
    .map((member) => (member?.name ?? '').trim())
    .filter((name) => name.length > 0);
  return names.length > 0 ? names.join(', ') : '—';
};

// --- COMPONENT ---
const formatCurrency = (value?: number | string | null) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};

const DONOR_PROFILE_TABS = ['overview', 'family', 'registrations', 'recurring', 'chrt_pooja'] as const;
type DonorProfileTab = (typeof DONOR_PROFILE_TABS)[number];

const DonorProfile = () => {
  const [activeTab, setActiveTab] = useState<DonorProfileTab>('overview');
  const [user, setUser] = useState<ApiUser | null>(null);
  const [profile, setProfile] = useState<ApiDonorProfile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [registrations, setRegistrations] = useState<PoojaRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [recurrencePlans, setRecurrencePlans] = useState<RecurringPlan[]>([]);
  const [recurrenceLoading, setRecurrenceLoading] = useState(true);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planEditValues, setPlanEditValues] = useState<PlanEditFormState>(createInitialPlanEditState);
  const [planEditSubmitting, setPlanEditSubmitting] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);
  const [editingRegistrationId, setEditingRegistrationId] = useState<number | null>(null);
  const [registrationEditValues, setRegistrationEditValues] = useState<RegistrationEditFormState>({
    start_date: '',
    amount: '',
  });
  const [registrationEditSubmitting, setRegistrationEditSubmitting] = useState(false);
  const [deletingRegistrationId, setDeletingRegistrationId] = useState<number | null>(null);
  const [registrationActionError, setRegistrationActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

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

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FamilyMemberFormState>(() => createInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Navigation
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    const tabParam = queryParams.get('tab');
    if (!tabParam) return;
    const normalizedTab = tabParam.toLowerCase();
    if (DONOR_PROFILE_TABS.includes(normalizedTab as DonorProfileTab)) {
      setActiveTab(normalizedTab as DonorProfileTab);
    }
  }, [queryParams]);

  const gothraOptions = useMasterDataStore((state) => state.gothraOptions);
  const loadGothraOptions = useMasterDataStore((state) => state.loadGothraOptions);

  useEffect(() => {
    loadGothraOptions();
  }, [loadGothraOptions]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('auth/profile/');
      const data = response.data as ProfileResponse;
      if (!isMountedRef.current) return;
      setUser(data.user);
      setProfile(data.profile);
      setMembers(sortMembers(data.members ?? []));
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(extractErrorMessage(err));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    setRegistrationsLoading(true);
    setRegistrationsError(null);
    try {
      const response = await api.get('pooja/registrations/', { params: { page_size: 200 } });
      if (!isMountedRef.current) return;
      setRegistrations(extractResults<PoojaRegistration>(response.data));
    } catch (err) {
      if (!isMountedRef.current) return;
      setRegistrations([]);
      setRegistrationsError(extractErrorMessage(err));
    } finally {
      if (isMountedRef.current) setRegistrationsLoading(false);
    }
  }, []);

  const reloadRecurrencePlans = useCallback(
    async (options?: { activeCheck?: () => boolean }) => {
      const isActive = options?.activeCheck ?? (() => true);
      if (!isActive()) return;

      setRecurrenceLoading(true);
      setRecurrenceError(null);
      try {
        const response = await api.get('pooja/recurrence/plans/', { params: { page_size: 200 } });
        if (!isActive()) return;
        setRecurrencePlans(extractResults<RecurringPlan>(response.data));
      } catch (err) {
        if (!isActive()) return;
        setRecurrencePlans([]);
        setRecurrenceError(extractErrorMessage(err));
      } finally {
        if (isActive()) {
          setRecurrenceLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    loadProfile();
    fetchRegistrations();
    let activeCheck = () => isMountedRef.current;
    reloadRecurrencePlans({ activeCheck });
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchRegistrations, loadProfile, reloadRecurrencePlans]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        fetchRegistrations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchRegistrations]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isMountedRef.current) return;
      fetchRegistrations();
    }, 30000);
    return () => {
      window.clearInterval(interval);
    };
  }, [fetchRegistrations]);

  // --- ACTIONS ---

  const resetPlanEditState = useCallback(() => {
    setEditingPlanId(null);
    setPlanEditValues(createInitialPlanEditState());
  }, []);
  const startPlanEdit = useCallback((plan: RecurringPlan) => {
    setEditingPlanId(plan.id);
    setPlanEditValues({
      recurrence_frequency: ensureRecurrenceFrequency(plan.recurrence_frequency),
      amount: plan.amount != null ? String(plan.amount) : '',
    });
    setRecurrenceError(null);
  }, []);
  const resetRegistrationEditState = useCallback(() => {
    setEditingRegistrationId(null);
    setRegistrationEditValues({ start_date: '', amount: '' });
  }, []);
  const startRegistrationEdit = useCallback((registration: PoojaRegistration) => {
    setEditingRegistrationId(registration.id);
    setRegistrationEditValues({
      start_date: formatDateForInput(registration.start_date),
      amount: registration.total_amount != null ? String(registration.total_amount) : '',
    });
    setRegistrationActionError(null);
  }, []);
  const handlePlanEditChange = useCallback(
    (field: keyof PlanEditFormState, value: string) => {
      setPlanEditValues((prev) => ({
        ...prev,
        [field]: field === 'recurrence_frequency' ? (value as RecurrenceFrequency) : value,
      }));
    },
    [],
  );
  const handleRegistrationEditChange = useCallback(
    (field: keyof RegistrationEditFormState, value: string) => {
      setRegistrationEditValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );
  const handlePlanEditSave = useCallback(async () => {
    if (editingPlanId === null) return;
    const payload: Record<string, string> = {
      recurrence_frequency: planEditValues.recurrence_frequency,
    };
    const amountValue = planEditValues.amount.trim();
    if (amountValue) {
      payload.amount = amountValue;
    }
    setPlanEditSubmitting(true);
    setRecurrenceError(null);
    try {
      await api.patch(`pooja/recurrence/plans/${editingPlanId}/`, payload);
      await reloadRecurrencePlans();
      resetPlanEditState();
    } catch (error) {
      setRecurrenceError(extractErrorMessage(error));
    } finally {
      setPlanEditSubmitting(false);
    }
  }, [editingPlanId, planEditValues, reloadRecurrencePlans, resetPlanEditState]);
  const handleRegistrationEditSave = useCallback(async () => {
    if (editingRegistrationId === null) return;
    const payload: Record<string, string> = {};
    if (registrationEditValues.start_date.trim()) {
      payload.start_date = registrationEditValues.start_date.trim();
    }
    if (registrationEditValues.amount.trim()) {
      payload.total_amount = registrationEditValues.amount.trim();
    }
    if (Object.keys(payload).length === 0) {
      setRegistrationActionError('Update at least one field.');
      return;
    }
    setRegistrationEditSubmitting(true);
    setRegistrationActionError(null);
    try {
      await api.patch(`pooja/registrations/${editingRegistrationId}/`, payload);
      await fetchRegistrations();
      resetRegistrationEditState();
    } catch (error) {
      setRegistrationActionError(extractErrorMessage(error));
    } finally {
      setRegistrationEditSubmitting(false);
    }
  }, [
    editingRegistrationId,
    fetchRegistrations,
    registrationEditValues.amount,
    registrationEditValues.start_date,
    resetRegistrationEditState,
  ]);
  const handleDeletePlan = useCallback(
    async (plan: RecurringPlan) => {
      const confirmed = window.confirm(
        'Delete this recurring pooja plan? This will remove the upcoming pooja and update your due payments.',
      );
      if (!confirmed) return;
      setDeletingPlanId(plan.id);
      setRecurrenceError(null);
      try {
        await api.delete(`pooja/recurrence/plans/${plan.id}/`);
        await reloadRecurrencePlans();
      } catch (error) {
        setRecurrenceError(extractErrorMessage(error));
      } finally {
        setDeletingPlanId(null);
      }
    },
    [reloadRecurrencePlans],
  );
  const handleDeleteRegistration = useCallback(
    async (registration: PoojaRegistration) => {
      if (!window.confirm('Delete this registration? Any pending dues for this pooja will be adjusted.')) {
        return;
      }
      setDeletingRegistrationId(registration.id);
      setRegistrationActionError(null);
      try {
        await api.delete(`pooja/registrations/${registration.id}/`);
        await fetchRegistrations();
        if (editingRegistrationId === registration.id) {
          resetRegistrationEditState();
        }
      } catch (error) {
        setRegistrationActionError(extractErrorMessage(error));
      } finally {
        setDeletingRegistrationId(null);
      }
    },
    [editingRegistrationId, fetchRegistrations, resetRegistrationEditState],
  );
  const handleManualPaymentRedirect = useCallback(() => {
    navigate('/payments/general?tab=summary');
  }, [navigate]);

  const handleStartRegistration = useCallback(() => {
    navigate('/pooja/register');
  }, [navigate]);

  const visibleRegistrations = useMemo(() => {
    const recurringRegistrationIds = new Set<number>();
    const recurringDueRegistrationIds = new Set<number>();
    for (const plan of recurrencePlans) {
      if (plan.recurrence_kind === 'recurring') {
        if (typeof plan.origin_registration_id === 'number') {
          recurringRegistrationIds.add(plan.origin_registration_id);
        }
        // Hide the due registration (auto-created for next payment cycle) from one-time list
        if (plan.due_registration?.id) {
          recurringDueRegistrationIds.add(plan.due_registration.id);
        }
      }
    }

    return registrations.filter((registration) => {
      if (recurringRegistrationIds.has(registration.id)) return false;
      if (recurringDueRegistrationIds.has(registration.id)) return false;

      const cartRecurrenceKind =
        registration.cart_item?.recurrenceKind ?? registration.cart_item?.recurrence_kind;
      const hasRecurrenceKind = Boolean(registration.recurrence_kind);

      if (hasRecurrenceKind && registration.recurrence_kind === 'recurring') {
        return false;
      }
      if (cartRecurrenceKind && cartRecurrenceKind === 'recurring') {
        return false;
      }
      if (isCHRTRegistration(registration)) {
        return false;
      }

      return true;
    });
  }, [registrations, recurrencePlans]);

  const recurringPlansToShow = useMemo(
    () => recurrencePlans.filter((plan) => plan.recurrence_kind === 'recurring' && !isCHRTPlan(plan)),
    [recurrencePlans],
  );
  const chrtPlansToShow = useMemo(
    () => recurrencePlans.filter((plan) => isCHRTPlan(plan)),
    [recurrencePlans],
  );
  const chrtRegistrations = useMemo(() => {
    const chrtPlanRegistrationIds = new Set<number>();
    chrtPlansToShow.forEach((plan) => {
      if (typeof plan.origin_registration_id === 'number') {
        chrtPlanRegistrationIds.add(plan.origin_registration_id);
      }
      if (plan.due_registration?.id) {
        chrtPlanRegistrationIds.add(plan.due_registration.id);
      }
    });
    return registrations.filter(
      (registration) =>
        isCHRTRegistration(registration) && !chrtPlanRegistrationIds.has(registration.id),
    );
  }, [chrtPlansToShow, registrations]);
  const chrtPoojaCount = chrtPlansToShow.length + chrtRegistrations.length;
  const chrtTotalAmount = useMemo(() => {
    const planTotal = chrtPlansToShow.reduce(
      (sum, plan) => sum + parseDecimalValue(plan.amount),
      0,
    );
    const registrationTotal = chrtRegistrations.reduce(
      (sum, registration) => sum + parseDecimalValue(registration.total_amount),
      0,
    );
    return planTotal + registrationTotal;
  }, [chrtPlansToShow, chrtRegistrations]);
  const registrationTotals = useMemo(() => {
    const count = visibleRegistrations.length;
    const amount = visibleRegistrations.reduce((total, registration) => {
      const numeric = Number(registration.total_amount);
      return total + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
    return { count, amount };
  }, [visibleRegistrations]);
  const isChrtDataLoading =
    (recurrenceLoading && chrtPlansToShow.length === 0) ||
    (registrationsLoading && chrtRegistrations.length === 0);
  const recurringPlansTotalAmount = useMemo(
    () => recurringPlansToShow.reduce((sum, plan) => sum + parseDecimalValue(plan.amount), 0),
    [recurringPlansToShow],
  );
  const hasRecurringPaymentItems = useMemo(
    () => recurringPlansToShow.length > 0 || chrtPlansToShow.length > 0 || chrtRegistrations.length > 0,
    [recurringPlansToShow, chrtPlansToShow, chrtRegistrations],
  );

  const handleViewRecurringPayments = useCallback(() => {
    if (!hasRecurringPaymentItems) return;
    navigate('/payments/general');
  }, [hasRecurringPaymentItems, navigate]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const donorProfileTabs: Array<{
    id: DonorProfileTab;
    label: string;
    icon: string;
    count?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: '👤' },
    { id: 'family', label: 'Family Members', icon: '👨‍👩‍👧‍👦', count: members.length },
    {
      id: 'registrations',
      label: 'Registrations',
      icon: '📋',
      count: visibleRegistrations.length,
    },
    {
      id: 'recurring',
      label: 'Recurring Plans',
      icon: '🔄',
      count: recurringPlansToShow.length,
    },
    { id: 'chrt_pooja', label: 'CHRT Pooja', icon: '🙏', count: chrtPoojaCount },
  ];

  const fullAddress = () => {
    if (!profile) return '—';
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

  // Profile Logic
  const startAddingNew = () => {
    setFormData(createInitialFormState(profile ?? undefined));
    setFormError(null);
    setIsAddingNew(true);
  };

  const cancelAddingNew = () => {
    if (submitting) return;
    setIsAddingNew(false);
    setFormError(null);
    setFormData(createInitialFormState(profile ?? undefined));
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

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Loading Screen */}
      {loading && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
            <span className="text-sm text-slate-500">Loading profile...</span>
          </div>
        </div>
      )}

      {/* Error Screen */}
      {!loading && error && (
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && user && profile && (
        <>
          {/* Sticky Header */}
          <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-orange-300 text-xl font-bold text-orange-700">
                    {getInitials(user.name)}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800">{user.name}</h1>
                    <p className="text-sm text-slate-500">{profile.donor_id} • {user.phone_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex gap-1 overflow-x-auto pb-0">
                {donorProfileTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      activeTab === tab.id
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-base">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                          activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-5 ring-1 ring-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-blue-600">Family Members</p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">{members.length}</p>
                      </div>
                      <div className="text-3xl">👨‍👩‍👧‍👦</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 p-5 ring-1 ring-violet-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-violet-600">Registrations</p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">{visibleRegistrations.length}</p>
                      </div>
                      <div className="text-3xl">📋</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 ring-1 ring-emerald-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-emerald-600">Active Plans</p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">{recurringPlansToShow.length}</p>
                      </div>
                      <div className="text-3xl">🔄</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-5 ring-1 ring-amber-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-amber-600">Monthly Contribution</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">₹ {formatPlanAmount(recurringPlansTotalAmount)}</p>
                      </div>
                      <div className="text-3xl">💰</div>
                    </div>
                  </div>
                </div>

                {/* Profile Details Grid */}
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Personal Info */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Full Name</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{user.name}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Tamil Name</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{resolveText(profile.tamil_name)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Family Name</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{resolveText(profile.family_name)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Gender</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{formatGender(profile.gender)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Date of Birth</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{formatDate(profile.date_of_birth)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Phone Number</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{user.phone_number}</p>
                      </div>
                      <div className="sm:col-span-2 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
                        <p className="text-xs font-bold uppercase text-amber-700">Donor Header Text</p>
                        <p className="mt-2 text-sm text-slate-900">{resolveText(profile.notes)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Religious Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <span>🕉️</span>
                      Religious Details
                    </h3>
                    <div className="space-y-3">
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Gothra</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{resolveText(profile.gothra)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Tamil Star</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{resolveText(profile.tamil_star)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">Rasi</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{resolveText(profile.rasi)}</p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                      <p className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
                        <span>📍</span>
                        Address
                      </p>
                      <p className="mt-2 text-sm text-slate-900 leading-relaxed">{fullAddress()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAMILY MEMBERS TAB */}
            {activeTab === 'family' && (
              <div>
                  <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Family Members</h2>
                    <p className="text-sm text-slate-500">Manage your family members for pooja registrations</p>
                  </div>
                  <button
                    onClick={startAddingNew}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Member
                  </button>
                </div>

                {formError && (
                  <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Add Member Form */}
                  {isAddingNew && (
                    <div className="rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-6">
                      <div className="flex flex-col gap-4">
                        <h4 className="mb-2 text-base font-semibold text-slate-900">Add New Member</h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                            <input type="text" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.name} onChange={handleInputChange('name')} placeholder="Enter full name" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                            <input type="text" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.relationship} onChange={handleInputChange('relationship')} placeholder="e.g. Son" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                            <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.gender} onChange={handleInputChange('gender')}>
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                            <input type="date" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.date_of_birth} onChange={handleInputChange('date_of_birth')} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Rasi</label>
                            <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.rasi} onChange={handleInputChange('rasi')}>
                              <option value="">Select Rasi</option>
                              {rasiOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Tamil Star</label>
                            <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.tamil_star} onChange={handleInputChange('tamil_star')}>
                              <option value="">Select Tamil Star</option>
                              {tamilStarOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Gothra</label>
                            <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.gothra} onChange={handleInputChange('gothra')}>
                              <option value="">Select Gothra</option>
                              {gothraOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                             <label className="block text-xs font-semibold text-slate-700 mb-1">Family Name</label>
                             <div className="flex gap-2">
                                <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.family_selection} onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, family_selection: val, family_name: val === 'Other' ? '' : val, }));
                                }}>
                                    <option value="">Select a family</option>
                                    {FAMILY_OPTIONS.map((opt) => <option key={opt} value={opt === 'Other' ? 'Other' : opt}>{opt}</option>)}
                                </select>
                                {formData.family_selection === 'Other' && <input type="text" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.family_name} onChange={handleInputChange('family_name')} placeholder="Enter family name" />}
                             </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={cancelAddingNew} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={submitting}>Cancel</button>
                          <button onClick={handleSubmit} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {members.length === 0 && !isAddingNew && (
                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white/70 p-6 text-center shadow-sm">
                      <p className="text-base font-semibold text-slate-900">No family members yet</p>
                      <p className="mt-2 text-sm text-slate-500">Add members to tie them to your pooja registrations.</p>
                      <button
                        type="button"
                        onClick={startAddingNew}
                        className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-indigo-500"
                      >
                        Add Member
                      </button>
                    </div>
                  )}

                  {members.map((member) => (
                    <div key={member.id} className="rounded-xl bg-white p-5 ring-1 ring-slate-200 hover:shadow-lg hover:ring-indigo-300 transition-all">
                      {editingMemberId === member.id ? (
                        // Edit Mode
                        <div className="flex flex-col gap-3">
                          <h4 className="mb-2 text-base font-semibold text-slate-900">Edit Member</h4>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                             <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                                <input type="text" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.name} onChange={handleInputChange('name')} />
                             </div>
                             <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                                <input type="text" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.relationship} onChange={handleInputChange('relationship')} />
                             </div>
                             <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                                <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.gender} onChange={handleInputChange('gender')}>
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                             </div>
                             <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                                <input type="date" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.date_of_birth} onChange={handleInputChange('date_of_birth')} />
                             </div>
                             <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Rasi</label>
                                <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.rasi} onChange={handleInputChange('rasi')}>
                                    <option value="">Select Rasi</option>
                                    {rasiOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Tamil Star</label>
                                <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.tamil_star} onChange={handleInputChange('tamil_star')}>
                                    <option value="">Select Tamil Star</option>
                                    {tamilStarOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Gothra</label>
                                <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.gothra} onChange={handleInputChange('gothra')}>
                                    <option value="">Select Gothra</option>
                                    {gothraOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                             </div>
                             <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Family Name</label>
                                <div className="flex gap-2">
                                    <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.family_selection} onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, family_selection: val, family_name: val === 'Other' ? '' : val, }));
                                    }}>
                                        <option value="">Select a family</option>
                                        {FAMILY_OPTIONS.map((opt) => <option key={opt} value={opt === 'Other' ? 'Other' : opt}>{opt}</option>)}
                                    </select>
                                    {formData.family_selection === 'Other' && <input type="text" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={formData.family_name} onChange={handleInputChange('family_name')} />}
                                </div>
                             </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                             <button onClick={cancelEditing} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={submitting}>Cancel</button>
                             <button onClick={handleSubmit} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <>
                          <div className="flex items-start gap-3 mb-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-200 to-indigo-300 text-xl font-bold text-indigo-700">
                              {getInitials(member.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base font-bold text-slate-900 truncate">{member.name}</h4>
                              <p className="text-sm text-slate-500">{member.relationship || '—'}</p>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs mb-4">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Gender</span>
                              <span className="font-medium text-slate-900">{member.gender || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Date of Birth</span>
                              <span className="font-medium text-slate-900">{formatDate(member.date_of_birth)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Star</span>
                              <span className="font-medium text-slate-900">{member.tamil_star || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Rasi</span>
                              <span className="font-medium text-slate-900">{member.rasi || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Gothra</span>
                              <span className="font-medium text-slate-900">{member.gothra || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Family Name</span>
                              <span className="font-medium text-slate-900">{member.family_name || profile?.family_name || '—'}</span>
                            </div>
                          </div>

                          <button onClick={() => startEditing(member)} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REGISTRATIONS TAB */}
            {activeTab === 'registrations' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">One-time Registrations</h2>
                    <p className="text-sm text-slate-500">View all your pooja registrations</p>
                  </div>
                  <button
                    onClick={handleManualPaymentRedirect}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Payments
                  </button>
                </div>

                <div className="mb-6 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 p-6 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-600">Total one-time contribution</p>
                      <p className="mt-2 text-4xl font-bold text-slate-900">₹ {formatCurrency(registrationTotals.amount)}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Across {registrationTotals.count} {registrationTotals.count === 1 ? 'pooja' : 'poojas'}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 ring-4 ring-white">
                        <span className="text-3xl">🎁</span>
                      </div>
                    </div>
                  </div>
                </div>

                {registrationsError && (
                  <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{registrationsError}</div>
                )}
                {registrationActionError && (
                  <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{registrationActionError}</div>
                )}
                
                {/* Registered Poojas Grid */}
                {registrationsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-violet-600"></div>
                    Loading pooja registrations...
                  </div>
                ) : visibleRegistrations.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visibleRegistrations.map((registration) => {
                      const memberNames = formatMemberNames(registration.members);
                      const registeredOn = formatDate(registration.created_at);
                      const isEditingThisRegistration = editingRegistrationId === registration.id;
                      const startDateInputId = `registration-start-${registration.id}`;
                      const amountInputId = `registration-amount-${registration.id}`;
                      const tamilStarLabel = resolveTamilStarSelection(
                        registration.day_option_code,
                        registration.cart_item ?? undefined,
                        registration.day_option_description,
                      );
                      return (
                        <div key={registration.id} className="rounded-xl bg-white p-5 ring-1 ring-slate-200 hover:shadow-lg hover:ring-violet-300 transition-all">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-block rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">One-time</span>
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700">Registration</span>
                              </div>
                              <h3 className="text-lg font-bold text-slate-900">{registration.pooja_option_name?.trim() || 'Unnamed pooja'}</h3>
                            </div>
                              <div className="flex flex-col items-end gap-1 text-right">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider text-purple-600 bg-purple-50">One-time</span>
                                <span className="text-lg font-bold text-slate-800">₹ {formatCurrency(registration.total_amount)}</span>
                              </div>
                            </div>

                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => startRegistrationEdit(registration)}
                                  disabled={
                                    isEditingThisRegistration ||
                                    registrationEditSubmitting ||
                                    deletingRegistrationId === registration.id
                                  }
                                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {isEditingThisRegistration ? 'Editing' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegistration(registration)}
                                  disabled={registrationEditSubmitting || deletingRegistrationId === registration.id || isEditingThisRegistration}
                                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                >
                                  {deletingRegistrationId === registration.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                              <span className="text-xs font-semibold text-slate-500">
                                Start date {formatDate(registration.start_date)}
                              </span>
                            </div>

                            {isEditingThisRegistration && (
                              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label htmlFor={startDateInputId} className="text-xs font-semibold uppercase text-slate-500">
                                    Preferred date
                                  </label>
                                  <input
                                    id={startDateInputId}
                                    type="date"
                                    value={registrationEditValues.start_date}
                                    onChange={(event) => handleRegistrationEditChange('start_date', event.target.value)}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                  />
                                  <label htmlFor={amountInputId} className="text-xs font-semibold uppercase text-slate-500">
                                    Amount
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-600">₹</span>
                                    <input
                                      id={amountInputId}
                                      type="text"
                                      inputMode="decimal"
                                      value={registrationEditValues.amount}
                                      onChange={(event) => handleRegistrationEditChange('amount', event.target.value)}
                                      placeholder="e.g., 200"
                                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                    />
                                  </div>
                                </div>
                                <div className="mt-3 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={resetRegistrationEditState}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleRegistrationEditSave}
                                    disabled={registrationEditSubmitting}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                                  >
                                    {registrationEditSubmitting ? 'Saving...' : 'Save changes'}
                                  </button>
                                </div>
                              </div>
                            )}

                          <div className="space-y-2 text-sm mb-4 pb-4 border-b border-slate-100">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Registered On</span>
                              <span className="font-medium text-slate-900">{registeredOn}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Pooja Day Option</span>
                              <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">
                                {registration.day_option_description?.trim() || '—'}
                              </span>
                            </div>
                            {tamilStarLabel !== null && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Tamil Star</span>
                                <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">
                                  {tamilStarLabel}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-slate-500">Members</span>
                              <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">{memberNames}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Prasadam</span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  registration.post_prasadam ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {registration.post_prasadam ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : visibleRegistrations.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center shadow-sm">
                    <p className="text-base font-semibold text-slate-900">No registrations yet</p>
                    <p className="mt-2 text-sm text-slate-500">Book a pooja to see it listed here.</p>
                    <button
                      type="button"
                      onClick={handleStartRegistration}
                      className="mt-4 inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-100"
                    >
                      Register for a pooja
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* RECURRING PLANS TAB */}
            {activeTab === 'recurring' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Recurring Pooja Plans</h2>
                    <p className="text-sm text-slate-500">Manage your active recurring donations</p>
                  </div>
                  <button onClick={handleViewRecurringPayments} disabled={!hasRecurringPaymentItems} className="inline-flex items-center gap-2 rounded-lg border-2 border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Payments
                  </button>
                </div>

                {/* Summary Banner */}
                <div className="mb-6 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 p-6 ring-1 ring-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-emerald-600">Total Monthly Contribution</p>
                      <p className="mt-2 text-4xl font-bold text-slate-900">₹ {formatPlanAmount(recurringPlansTotalAmount)}</p>
                      <p className="mt-1 text-sm text-slate-600">Across {recurringPlansToShow.length} active plan{recurringPlansToShow.length !== 1 ? 's' : ''}</p>
                      <p className="mt-1 text-sm font-semibold text-red-600">
                        {recurringPlansToShow.length} Recurring Pooja{recurringPlansToShow.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-white">
                        <span className="text-3xl">💰</span>
                      </div>
                    </div>
                  </div>
                </div>

                {recurrenceError && <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 text-center">{recurrenceError}</div>}

                {recurrenceLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600"></div>
                    <p className="text-sm font-medium">Loading recurring plans...</p>
                  </div>
                ) : recurringPlansToShow.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {recurringPlansToShow.map((plan) => {
                      const memberNames = getPlanMemberNames(plan.metadata);
                      const pauseReasonLabel = getPauseReasonLabel(plan.metadata);
                      const isPlanActive = plan.is_active && plan.recurrence_kind === 'recurring';
                      const scheduleLabel = formatPlanFrequencyLabel(plan.recurrence_kind, plan.recurrence_frequency);
                      const registeredOn = plan.origin_registration_created_at
                        ? formatDate(plan.origin_registration_created_at)
                        : '—';
                      const isEditingThisPlan = editingPlanId === plan.id;
                      const nextDueAmount = plan.due_registration?.due_amount ?? plan.due_registration?.total_amount;
                      const nextDueLabel = plan.due_registration ? formatPlanAmount(nextDueAmount) : null;
                      const nextDueStatus = plan.due_registration?.is_paid ? 'Paid' : 'Pending';
                      const frequencyInputId = `recurrence-frequency-${plan.id}`;
                      const amountInputId = `recurrence-amount-${plan.id}`;
                      const tamilStarLabel = resolveTamilStarSelection(
                        plan.day_option_code,
                        plan.cart_payload ?? undefined,
                        plan.day_option_description,
                      );

                      return (
                        <div key={plan.id} className="rounded-xl bg-white p-5 ring-1 ring-slate-200 hover:shadow-lg hover:ring-emerald-300 transition-all">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{plan.pooja_option_code || 'Pooja'}</span>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isPlanActive ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {isPlanActive ? 'Active' : 'Paused'}
                                </span>
                              </div>
                              <h3 className="text-lg font-bold text-slate-900">{plan.pooja_option_name?.trim() || 'Unnamed pooja'}</h3>
                            </div>
                            <div className="flex flex-col items-end gap-1 text-right">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider text-amber-600 bg-amber-50">
                                {scheduleLabel}
                              </span>
                              <span className="text-lg font-bold text-slate-800">
                                ₹ {formatPlanAmount(plan.amount)}
                              </span>
                            </div>
                        </div>

                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startPlanEdit(plan)}
                              disabled={isEditingThisPlan || deletingPlanId === plan.id || planEditSubmitting}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {isEditingThisPlan ? 'Editing' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePlan(plan)}
                              disabled={planEditSubmitting || deletingPlanId === plan.id || isEditingThisPlan}
                              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              {deletingPlanId === plan.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                          {plan.due_registration && nextDueLabel && (
                            <span className="text-xs font-semibold text-slate-500">
                              Next due ₹ {nextDueLabel} — {nextDueStatus}
                            </span>
                          )}
                        </div>

                        {isEditingThisPlan && (
                          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label htmlFor={frequencyInputId} className="text-xs font-semibold uppercase text-slate-500">
                                Frequency
                              </label>
                              <select
                                id={frequencyInputId}
                                value={planEditValues.recurrence_frequency}
                                onChange={(event) =>
                                  handlePlanEditChange('recurrence_frequency', event.target.value)
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                              >
                                {RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <label htmlFor={amountInputId} className="text-xs font-semibold uppercase text-slate-500">
                                Amount
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600">₹</span>
                                <input
                                  id={amountInputId}
                                  type="text"
                                  inputMode="decimal"
                                  value={planEditValues.amount}
                                  onChange={(event) => handlePlanEditChange('amount', event.target.value)}
                                  placeholder="e.g., 100"
                                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={resetPlanEditState}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handlePlanEditSave}
                                disabled={planEditSubmitting}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                              >
                                {planEditSubmitting ? 'Saving...' : 'Save changes'}
                              </button>
                            </div>
                          </div>
                        )}

                        {(plan.pause_from || plan.pause_until) && (
                          <div className="mb-4 rounded-lg bg-orange-50 p-3 ring-1 ring-orange-200">
                            <p className="text-xs font-semibold text-orange-800">
                              {plan.pause_from && plan.pause_until
                                  ? `Paused from ${formatDate(plan.pause_from)} until ${formatDate(plan.pause_until)}.`
                                  : plan.pause_until
                                    ? `Paused until ${formatDate(plan.pause_until)}.`
                                    : `Pause scheduled from ${formatDate(plan.pause_from)}.`}
                              </p>
                              {pauseReasonLabel && <p className="mt-1 text-xs text-orange-700">Handling: {pauseReasonLabel}</p>}
                            </div>
                          )}

                          <div className="space-y-2 text-sm mb-4 pb-4 border-b border-slate-100">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Registered On</span>
                              <span className="font-medium text-slate-900">{registeredOn}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Pooja Day Option</span>
                              <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">{plan.day_option_description?.trim() || '—'}</span>
                            </div>
                            {tamilStarLabel !== null && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Tamil Star</span>
                                <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">
                                  {tamilStarLabel}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-slate-500">Members</span>
                              <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">{memberNames.length > 0 ? memberNames.join(', ') : '—'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : recurringPlansToShow.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center shadow-sm">
                    <p className="text-base font-semibold text-slate-900">No recurring plans yet</p>
                    <p className="mt-2 text-sm text-slate-500">Start a recurring donation to keep giving consistently.</p>
                    <button
                      type="button"
                      onClick={handleStartRegistration}
                      className="mt-4 inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      Explore recurring poojas
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* CHRT POOJA TAB */}
            {activeTab === 'chrt_pooja' && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Choose Your Preferred Date - CHRT Pooja</h2>
                    <p className="text-sm text-slate-500">Manage your CHRT poojas with custom selected dates</p>
                  </div>
                  <button onClick={handleViewRecurringPayments} disabled={chrtPoojaCount === 0} className="inline-flex items-center gap-2 rounded-lg border-2 border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Payments
                  </button>
                </div>

                {/* Summary Banner */}
                <div className="mb-6 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 p-6 ring-1 ring-purple-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-purple-600">Total CHRT Poojas</p>
                      <p className="mt-2 text-4xl font-bold text-slate-900">{chrtPoojaCount}</p>
                      <p className="mt-1 text-sm text-slate-600">CHRT Pooja{chrtPoojaCount !== 1 ? 's' : ''} registered</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-white/70 px-4 py-3 shadow-sm ring-1 ring-purple-200">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-purple-600">Total Pooja Amount</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">₹ {formatCurrency(chrtTotalAmount)}</p>
                        <p className="text-xs text-slate-500">Across all CHRT poojas</p>
                      </div>
                      <div className="hidden sm:block">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 ring-4 ring-white">
                          <span className="text-3xl">🙏</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {recurrenceError && <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 text-center">{recurrenceError}</div>}
                {registrationsError && <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 text-center">{registrationsError}</div>}

            {isChrtDataLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600"></div>
                    <p className="text-sm font-medium">Loading CHRT poojas...</p>
                  </div>
                ) : chrtPoojaCount > 0 ? (
                  <>
                    {chrtPlansToShow.length > 0 && (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {chrtPlansToShow.map((plan) => {
                          const memberNames = getPlanMemberNames(plan.metadata);
                          const pauseReasonLabel = getPauseReasonLabel(plan.metadata);
                          const isPlanActive = plan.is_active && plan.recurrence_kind === 'recurring';
                          const scheduleLabel = formatPlanFrequencyLabel(plan.recurrence_kind, plan.recurrence_frequency);
                          const registeredOn = plan.origin_registration_created_at
                            ? formatDate(plan.origin_registration_created_at)
                            : '—';
                          const preferredDate = plan.one_time_date || plan.start_date;
                          const isEditingThisPlan = editingPlanId === plan.id;
                          const nextDueAmount = plan.due_registration?.due_amount ?? plan.due_registration?.total_amount;
                          const nextDueLabel = plan.due_registration ? formatPlanAmount(nextDueAmount) : null;
                          const nextDueStatus = plan.due_registration?.is_paid ? 'Paid' : 'Pending';
                          const frequencyInputId = `chrt-frequency-${plan.id}`;
                          const amountInputId = `chrt-amount-${plan.id}`;
                          const tamilStarLabel = resolveTamilStarSelection(
                            plan.day_option_code,
                            plan.cart_payload ?? undefined,
                            plan.day_option_description,
                          );

                          return (
                            <div key={plan.id} className="rounded-xl bg-white p-5 ring-1 ring-purple-200 hover:shadow-lg hover:ring-purple-300 transition-all">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-block rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">CHRT</span>
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                        isPlanActive ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                      }`}
                                    >
                                      {isPlanActive ? 'Active' : 'Paused'}
                                    </span>
                                  </div>
                                  <h3 className="text-lg font-bold text-slate-900">{plan.pooja_option_name?.trim() || 'Unnamed pooja'}</h3>
                                </div>
                               <div className="flex flex-col items-end gap-1 text-right">
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider text-purple-600 bg-purple-50">
                                    {scheduleLabel}
                                  </span>
                                  <span className="text-lg font-bold text-slate-800">
                                    ₹ {formatPlanAmount(plan.amount)}
                                  </span>
                                </div>
                              </div>

                              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startPlanEdit(plan)}
                                    disabled={isEditingThisPlan || deletingPlanId === plan.id || planEditSubmitting}
                                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {isEditingThisPlan ? 'Editing' : 'Edit'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePlan(plan)}
                                    disabled={planEditSubmitting || deletingPlanId === plan.id || isEditingThisPlan}
                                    className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    {deletingPlanId === plan.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                                {plan.due_registration && nextDueLabel && (
                                  <span className="text-xs font-semibold text-slate-500">
                                    Next due ₹ {nextDueLabel} — {nextDueStatus}
                                  </span>
                                )}
                              </div>

                              {isEditingThisPlan && (
                                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <label htmlFor={frequencyInputId} className="text-xs font-semibold uppercase text-slate-500">
                                      Frequency
                                    </label>
                                    <select
                                      id={frequencyInputId}
                                      value={planEditValues.recurrence_frequency}
                                      onChange={(event) =>
                                        handlePlanEditChange('recurrence_frequency', event.target.value)
                                      }
                                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                    >
                                      {RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    <label htmlFor={amountInputId} className="text-xs font-semibold uppercase text-slate-500">
                                      Amount
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-600">₹</span>
                                      <input
                                        id={amountInputId}
                                        type="text"
                                        inputMode="decimal"
                                        value={planEditValues.amount}
                                        onChange={(event) => handlePlanEditChange('amount', event.target.value)}
                                        placeholder="e.g., 100"
                                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={resetPlanEditState}
                                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handlePlanEditSave}
                                      disabled={planEditSubmitting}
                                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                                    >
                                      {planEditSubmitting ? 'Saving...' : 'Save changes'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {(plan.pause_from || plan.pause_until) && (
                                <div className="mb-4 rounded-lg bg-orange-50 p-3 ring-1 ring-orange-200">
                                  <p className="text-xs font-semibold text-orange-800">
                                    {plan.pause_from && plan.pause_until
                                      ? `Paused from ${formatDate(plan.pause_from)} until ${formatDate(plan.pause_until)}.`
                                      : plan.pause_until
                                        ? `Paused until ${formatDate(plan.pause_until)}.`
                                        : `Pause scheduled from ${formatDate(plan.pause_from)}.`}
                                  </p>
                                  {pauseReasonLabel && <p className="mt-1 text-xs text-orange-700">Handling: {pauseReasonLabel}</p>}
                                </div>
                              )}

                              <div className="space-y-2 text-sm mb-4 pb-4 border-b border-slate-100">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Preferred Date</span>
                                  <span className="font-bold text-purple-700 text-right">{formatDate(preferredDate)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Registered On</span>
                                  <span className="font-medium text-slate-900">{registeredOn}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Pooja Day Option</span>
                                  <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">{plan.day_option_description?.trim() || '—'}</span>
                                </div>
                                {tamilStarLabel !== null && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Tamil Star</span>
                                    <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">
                                      {tamilStarLabel}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Members</span>
                                  <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">{memberNames.length > 0 ? memberNames.join(', ') : '—'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {chrtRegistrations.length > 0 && (
                      <div className={`grid gap-4 lg:grid-cols-2 ${chrtPlansToShow.length > 0 ? 'mt-6' : ''}`}>
                        {chrtRegistrations.map((registration) => {
                          const isEditingThisRegistration = editingRegistrationId === registration.id;
                          const startDateInputId = `chrt-registration-start-${registration.id}`;
                          const amountInputId = `chrt-registration-amount-${registration.id}`;
                          const tamilStarLabel = resolveTamilStarSelection(
                            registration.day_option_code,
                            registration.cart_item ?? undefined,
                            registration.day_option_description,
                          );
                          return (
                            <div key={`chrt-registration-${registration.id}`} className="rounded-xl bg-white p-5 ring-1 ring-purple-200 hover:shadow-lg hover:ring-purple-300 transition-all">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-block rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">CHRT</span>
                                    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-purple-50 text-purple-600">Registration</span>
                                  </div>
                                  <h3 className="text-lg font-bold text-slate-900">{registration.pooja_option_name?.trim() || 'Unnamed pooja'}</h3>
                                  <p className="text-sm text-slate-500">{registration.day_option_description?.trim() || '—'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 text-right">
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider text-purple-600 bg-purple-50">
                                    One-time
                                  </span>
                                  <span className="text-lg font-bold text-slate-800">
                                    ₹ {formatPlanAmount(registration.total_amount)}
                                  </span>
                                </div>
                              </div>

                              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startRegistrationEdit(registration)}
                                    disabled={
                                      isEditingThisRegistration ||
                                      registrationEditSubmitting ||
                                      deletingRegistrationId === registration.id
                                    }
                                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {isEditingThisRegistration ? 'Editing' : 'Edit'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRegistration(registration)}
                                    disabled={registrationEditSubmitting || deletingRegistrationId === registration.id || isEditingThisRegistration}
                                    className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    {deletingRegistrationId === registration.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                                <span className="text-xs font-semibold text-slate-500">
                                  Preferred date {formatDate(registration.start_date)}
                                </span>
                              </div>

                              {isEditingThisRegistration && (
                                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <label htmlFor={startDateInputId} className="text-xs font-semibold uppercase text-slate-500">
                                      Preferred date
                                    </label>
                                    <input
                                      id={startDateInputId}
                                      type="date"
                                      value={registrationEditValues.start_date}
                                      onChange={(event) => handleRegistrationEditChange('start_date', event.target.value)}
                                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                    />
                                    <label htmlFor={amountInputId} className="text-xs font-semibold uppercase text-slate-500">
                                      Amount
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-600">₹</span>
                                      <input
                                        id={amountInputId}
                                        type="text"
                                        inputMode="decimal"
                                        value={registrationEditValues.amount}
                                        onChange={(event) => handleRegistrationEditChange('amount', event.target.value)}
                                        placeholder="e.g., 100"
                                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={resetRegistrationEditState}
                                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleRegistrationEditSave}
                                      disabled={registrationEditSubmitting}
                                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                                    >
                                      {registrationEditSubmitting ? 'Saving...' : 'Save changes'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2 text-sm mb-4 pb-4 border-b border-slate-100">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Preferred Date</span>
                                  <span className="font-bold text-purple-700 text-right">{formatDate(registration.start_date)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Registered On</span>
                                  <span className="font-medium text-slate-900">{formatDate(registration.created_at)}</span>
                                </div>
                                {tamilStarLabel !== null && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Tamil Star</span>
                                    <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">
                                      {tamilStarLabel}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Members</span>
                                  <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">{formatMemberNames(registration.members)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Prasadam</span>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      registration.post_prasadam ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {registration.post_prasadam ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center shadow-sm">
                    <p className="text-base font-semibold text-slate-900">No CHRT poojas registered</p>
                    <p className="mt-2 text-sm text-slate-500">Register a CHRT pooja to add it here.</p>
                    <button
                      type="button"
                      onClick={handleStartRegistration}
                      className="mt-4 inline-flex items-center justify-center rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-purple-700 shadow-sm hover:border-purple-300 hover:bg-purple-100"
                    >
                      Register CHRT Pooja
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
export default DonorProfile;
