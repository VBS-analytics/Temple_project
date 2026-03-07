import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { indianCities } from '../../data/indianCities';
import { rasiOptions, tamilStarOptions } from '../../data/familyAttributes';
import api from '../../lib/api';
import { useMasterDataStore } from '../../store/masterData';
import { isReadOnlyAdmin, useAuthStore } from '../../store/auth';

interface DonorProfile {
  donor_id?: string | null;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  tamil_name?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  tamil_star?: string;
  gothra?: string;
  rasi?: string;
  date_of_birth?: string | null;
  family_name?: string;
  gender?: string;
  notes?: string | null;
  pooja_registration_access?: boolean;
  payment_delete_access?: boolean;
  custom_number?: number | null;
  current_month_due?: string | number | null;
  current_month_payments?: string | number | null;
  calculated_current_balance?: string | number | null;
}

interface DonorUser {
  id: number;
  name: string;
  phone_number: string;
  email?: string;
  role: string;
}

interface DonorMember {
  id: number;
  name: string;
  relationship?: string;
  gender?: string;
  tamil_star?: string;
  gothra?: string;
  rasi?: string;
  date_of_birth?: string | null;
  family_name?: string;
}

interface DonorRecord {
  user: DonorUser;
  profile: DonorProfile;
  members: DonorMember[];
}

type DonorEditFormState = {
  name: string;
  phone_number: string;
  email: string;
  gender: string;
  date_of_birth: string;
  tamil_star: string;
  gothra: string;
  family_name: string;
  notes: string;
  pooja_registration_access: 'yes' | 'no';
  payment_delete_access: 'yes' | 'no';
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  postal_code: string;
  custom_number: string;
};

const createEmptyDonorEditForm = (): DonorEditFormState => ({
  name: '',
  phone_number: '',
  email: '',
  gender: '',
  date_of_birth: '',
  tamil_star: '',
  gothra: '',
  family_name: '',
  notes: '',
  pooja_registration_access: 'no',
  payment_delete_access: 'no',
  address_line1: '',
  address_line2: '',
  address_line3: '',
  city: '',
  state: '',
  postal_code: '',
  custom_number: '',
});

interface RegistrationMember {
  id: number;
  name: string;
  phone_number?: string | null;
  relationship?: string | null;
  date_of_birth?: string | null;
  family_name?: string | null;
  tamil_star?: string | null;
  gothra?: string | null;
}

interface RegistrationRecord {
  id: number;
  donor?: number | null;
  pooja_reg_id?: string | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  pooja_option: number;
  pooja_option_name?: string | null;
  day_option?: number | null;
  day_option_description?: string | null;
  start_date?: string | null;
  quantity?: number | null;
  is_group_registration: boolean;
  post_prasadam?: boolean;
  additional_notes?: string | null;
  total_amount?: string | null;
  members?: RegistrationMember[];
  cart_item?: Record<string, unknown> | null;
}

interface GroupedRegistrations {
  groupKey: string;
  donorId: number | null;
  donorName: string;
  donorPhone: string;
  donorEmail?: string | null;
  registrations: RegistrationRecord[];
}

const formatDonorDate = (value?: string | null) => {
  if (!value) {
    return 'N/A';
  }
  const parts = value.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) {
      return `${day}-${month}-${year}`;
    }
  }
  return value;
};

const formatRegistrationDate = (value?: string | null) => {
  if (!value) {
    return 'N/A';
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

const formatCurrency = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return value;
  }
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

const toCurrencyString = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
};

const resolveOpeningBalanceValue = (profile: DonorProfile) => {
  const calculated = profile.calculated_current_balance;
  if (calculated !== null && calculated !== undefined && calculated !== '') {
    return String(calculated);
  }
  if (profile.custom_number != null) {
    return String(profile.custom_number);
  }
  return '';
};

const normalizePhone = (value?: string | null) => (value ? value.replace(/\D/g, '') : '');

const formatNumber = (value: number) => value.toLocaleString('en-IN');

const resolveText = (value?: string | null, fallback = 'Not provided') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const formatDonorDisplayName = (name?: string | null, savmanName?: string | null) => {
  const trimmedName = (name ?? '').trim() || 'Unknown Donor';
  const trimmedSavmanName = (savmanName ?? '').trim();
  return trimmedSavmanName ? `${trimmedName} (${trimmedSavmanName})` : trimmedName;
};

const extractRegistrationResults = (payload: any): RegistrationRecord[] => {
  if (Array.isArray(payload)) {
    return payload as RegistrationRecord[];
  }
  if (payload && Array.isArray(payload.results)) {
    return payload.results as RegistrationRecord[];
  }
  return [];
};

const buildGroupKey = (registration: RegistrationRecord) => {
  if (typeof registration.donor === 'number' && Number.isFinite(registration.donor)) {
    return { key: `donor-${registration.donor}`, donorId: registration.donor };
  }

  const trimmedPhone = (registration.donor_phone ?? '').trim();
  if (trimmedPhone) {
    return { key: `phone-${trimmedPhone}`, donorId: null };
  }

  const trimmedName = (registration.donor_name ?? '').trim();
  if (trimmedName) {
    return { key: `name-${trimmedName.toLowerCase()}`, donorId: null };
  }

  return { key: `registration-${registration.id}`, donorId: null };
};

const groupRegistrationsByDonor = (records: RegistrationRecord[]): GroupedRegistrations[] => {
  const map = new Map<string, GroupedRegistrations>();

  records.forEach((registration) => {
    const { key, donorId } = buildGroupKey(registration);
    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        donorId,
        donorName: registration.donor_name?.trim() || 'Unknown Donor',
        donorPhone: registration.donor_phone?.trim() || 'N/A',
        registrations: [],
      });
    }

    const entry = map.get(key);
    if (!entry) {
      return;
    }

    if (entry.donorId === null && donorId !== null) {
      entry.donorId = donorId;
    }

    if (typeof registration.donor_name === 'string' && registration.donor_name.trim()) {
      entry.donorName = registration.donor_name.trim();
    }

    if (typeof registration.donor_phone === 'string' && registration.donor_phone.trim()) {
      entry.donorPhone = registration.donor_phone.trim();
    }

    const donorEmail = (registration as any)?.donor_email;
    if (!entry.donorEmail && typeof donorEmail === 'string' && donorEmail.trim()) {
      entry.donorEmail = donorEmail.trim();
    }

    entry.registrations.push(registration);
  });

  return Array.from(map.values()).sort((a, b) => a.donorName.localeCompare(b.donorName));
};

const normalizeNextUrl = (nextUrl: any) => {
  if (typeof nextUrl !== 'string' || nextUrl.length === 0) {
    return null;
  }
  const baseUrl = api.defaults?.baseURL ?? '';
  if (nextUrl.startsWith('http') && baseUrl && nextUrl.startsWith(baseUrl)) {
    return nextUrl.slice(baseUrl.length);
  }
  return nextUrl;
};

const normalizeAdminOverview = (payload: any): GroupedRegistrations[] => {
  const rawGroups = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : [];

  const groups: GroupedRegistrations[] = [];

  rawGroups.forEach((group: any) => {
    const donorIdRaw = group?.donor_id ?? group?.donorId;
    const parsedDonorId = Number(donorIdRaw);
    const donorId = Number.isFinite(parsedDonorId) ? parsedDonorId : null;
    const donorName = group?.donor_name ?? group?.donorName ?? 'Unknown Donor';
    const donorPhone = group?.donor_phone ?? group?.donorPhone ?? 'N/A';
    const donorEmail = group?.donor_email ?? group?.donorEmail ?? null;
    const registrations = extractRegistrationResults(group?.registrations);

    let groupKey: string | null = null;
    if (donorId !== null) {
      groupKey = `donor-${donorId}`;
    } else if (typeof donorPhone === 'string' && donorPhone.trim()) {
      groupKey = `phone-${donorPhone.trim()}`;
    } else if (typeof donorName === 'string' && donorName.trim()) {
      groupKey = `name-${donorName.trim().toLowerCase()}`;
    } else if (registrations.length > 0) {
      groupKey = buildGroupKey(registrations[0]).key;
    }

    groups.push({
      groupKey: groupKey ?? `group-${registrations[0]?.id ?? 'unknown'}`,
      donorId,
      donorName,
      donorPhone: typeof donorPhone === 'string' && donorPhone.trim() ? donorPhone.trim() : 'N/A',
      donorEmail,
      registrations,
    });
  });

  return groups.sort((a, b) => a.donorName.localeCompare(b.donorName));
};

const DonorDetailsPage = () => {
  const authUser = useAuthStore((state) => state.user);
  const [donors, setDonors] = useState<DonorRecord[]>([]);
  const [registrationGroups, setRegistrationGroups] = useState<GroupedRegistrations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [poojaRegistrationsCount, setPoojaRegistrationsCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<
    Record<number, { members: boolean; registrations: boolean; details: boolean }>
  >({});
  const [editingDonorId, setEditingDonorId] = useState<number | null>(null);
  const [donorEditForm, setDonorEditForm] = useState<DonorEditFormState>(createEmptyDonorEditForm);
  const [donorEditError, setDonorEditError] = useState('');
  const [donorEditSubmitting, setDonorEditSubmitting] = useState(false);
  const [customNumberValues, setCustomNumberValues] = useState<Record<number, string>>({});
  const [customNumberSavingIds, setCustomNumberSavingIds] = useState<Set<number>>(() => new Set());
  const [customNumberErrors, setCustomNumberErrors] = useState<Record<number, string>>({});
  const [poojaAccessSavingIds, setPoojaAccessSavingIds] = useState<Set<number>>(() => new Set());
  const [poojaAccessErrors, setPoojaAccessErrors] = useState<Record<number, string>>({});
  const [paymentDeleteSavingIds, setPaymentDeleteSavingIds] = useState<Set<number>>(() => new Set());
  const [paymentDeleteErrors, setPaymentDeleteErrors] = useState<Record<number, string>>({});
  const readOnlyAdmin = isReadOnlyAdmin(authUser);
  const gothraOptions = useMasterDataStore((state) => state.gothraOptions);
  const loadGothraOptions = useMasterDataStore((state) => state.loadGothraOptions);

  useEffect(() => {
    loadGothraOptions();
  }, [loadGothraOptions]);
  const cityStateLookup = useMemo(() => {
    const map = new Map<string, string>();
    indianCities.forEach((city) => {
      const key = city.name.trim().toLowerCase();
      if (key && city.stateName) {
        map.set(key, city.stateName);
      }
    });
    return map;
  }, []);
  const stateOptions = useMemo(() => {
    const names = Array.from(new Set(indianCities.map((city) => city.stateName).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  }, []);

  useEffect(() => {
    setCustomNumberValues((prev) => {
      const next = { ...prev };
      donors.forEach((donor) => {
        const normalized = resolveOpeningBalanceValue(donor.profile);
        if (next[donor.user.id] !== normalized) {
          next[donor.user.id] = normalized;
        }
      });
      return next;
    });
  }, [donors]);

  const startDonorEdit = (record: DonorRecord) => {
    setEditingDonorId(record.user.id);
    setDonorEditError('');
    setDonorEditForm({
      name: record.user.name ?? '',
      phone_number: record.user.phone_number ?? '',
      email: record.user.email ?? '',
      gender: record.profile.gender ?? '',
      date_of_birth: record.profile.date_of_birth ?? '',
      tamil_star: record.profile.tamil_star ?? '',
      gothra: record.profile.gothra ?? '',
      family_name: record.profile.family_name ?? '',
      notes: record.profile.notes ?? '',
      pooja_registration_access: record.profile.pooja_registration_access ? 'yes' : 'no',
      payment_delete_access: record.profile.payment_delete_access ? 'yes' : 'no',
      address_line1: record.profile.address_line1 ?? '',
      address_line2: record.profile.address_line2 ?? '',
      address_line3: record.profile.address_line3 ?? '',
      city: record.profile.city ?? '',
      state: record.profile.state ?? '',
      postal_code: record.profile.postal_code ?? '',
      custom_number: resolveOpeningBalanceValue(record.profile),
    });
    setExpandedSections((prev) => {
      const current = prev[record.user.id] ?? { members: false, registrations: false, details: true };
      return { ...prev, [record.user.id]: { ...current, details: true } };
    });
  };

  const cancelDonorEdit = () => {
    setEditingDonorId(null);
    setDonorEditError('');
    setDonorEditForm(createEmptyDonorEditForm());
  };

  const handleDonorEditChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setDonorEditForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'city') {
        const normalizedCity = value.trim().toLowerCase();
        const matchedState = cityStateLookup.get(normalizedCity);
        if (matchedState) {
          next.state = matchedState;
        }
      }
      return next;
    });
  };

  const handleDonorEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingDonorId) {
      return;
    }
    if (!donorEditForm.name.trim()) {
      setDonorEditError('Name is required.');
      return;
    }
    if (!donorEditForm.phone_number.trim()) {
      setDonorEditError('Phone number is required.');
      return;
    }
    setDonorEditError('');
    setDonorEditSubmitting(true);
    const payload = {
      user: {
        name: donorEditForm.name.trim(),
        phone_number: donorEditForm.phone_number.trim(),
        email: donorEditForm.email.trim(),
      },
      profile: {
        gender: donorEditForm.gender,
        date_of_birth: donorEditForm.date_of_birth ? donorEditForm.date_of_birth : null,
        tamil_star: donorEditForm.tamil_star,
        gothra: donorEditForm.gothra,
        family_name: donorEditForm.family_name,
        notes: donorEditForm.notes,
        pooja_registration_access: donorEditForm.pooja_registration_access === 'yes',
        payment_delete_access: donorEditForm.payment_delete_access === 'yes',
        address_line1: donorEditForm.address_line1,
        address_line2: donorEditForm.address_line2,
        address_line3: donorEditForm.address_line3,
        city: donorEditForm.city,
        state: donorEditForm.state,
        postal_code: donorEditForm.postal_code,
        custom_number: null,
      },
    };
    const customNumberRaw = donorEditForm.custom_number.trim();
    const parsedCustomNumber = customNumberRaw === '' ? null : Number(customNumberRaw);
    payload.profile.custom_number =
      parsedCustomNumber === null || Number.isFinite(parsedCustomNumber) ? parsedCustomNumber : null;

    try {
      const response = await api.put(`auth/donors/${editingDonorId}/`, payload);
      const updatedUser = response.data?.user;
      const updatedProfile = response.data?.profile;
      if (updatedUser && updatedProfile) {
        setDonors((prev) =>
          prev.map((record) => (record.user.id === editingDonorId ? { ...record, user: updatedUser, profile: updatedProfile } : record)),
        );
      }
      cancelDonorEdit();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        'Unable to update donor details';
      setDonorEditError(typeof detail === 'string' ? detail : 'Unable to update donor details');
    } finally {
      setDonorEditSubmitting(false);
    }
  };

  const handleCustomNumberChange = (donorId: number, value: string) => {
    if (value !== '' && !/^-?\d*$/.test(value)) {
      return;
    }
    setCustomNumberValues((prev) => ({ ...prev, [donorId]: value }));
    setCustomNumberErrors((prev) => {
      if (!prev[donorId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[donorId];
      return next;
    });
  };

  const handleCustomNumberSave = async (donor: DonorRecord, overrideValue?: string) => {
    const donorId = donor.user.id;
    if (customNumberSavingIds.has(donorId)) {
      return;
    }
    const currentValue = (overrideValue ?? customNumberValues[donorId] ?? '').trim();
    setCustomNumberValues((prev) => {
      if (prev[donorId] === currentValue) {
        return prev;
      }
      return { ...prev, [donorId]: currentValue };
    });
    const originalValue = resolveOpeningBalanceValue(donor.profile);
    if (currentValue === originalValue) {
      setCustomNumberErrors((prev) => {
        if (!prev[donorId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[donorId];
        return next;
      });
      return;
    }

    let parsedValue: number | null = null;
    if (currentValue !== '') {
      parsedValue = Number(currentValue);
      if (Number.isNaN(parsedValue)) {
        setCustomNumberErrors((prev) => ({ ...prev, [donorId]: 'Enter a valid number' }));
        return;
      }
    }

    setCustomNumberSavingIds((prev) => {
      const next = new Set(prev);
      next.add(donorId);
      return next;
    });

    try {
      const response = await api.put(`auth/donors/${donorId}/`, {
        profile: {
          custom_number: parsedValue,
        },
      });
      const updatedUser = response.data?.user;
      const updatedProfile = response.data?.profile;
      if (updatedUser || updatedProfile) {
        setDonors((prev) =>
          prev.map((record) =>
            record.user.id === donorId
              ? {
                  ...record,
                  user: updatedUser ?? record.user,
                  profile: updatedProfile ?? record.profile,
                }
              : record,
          ),
        );
      }
      const normalized =
        updatedProfile?.custom_number != null
          ? String(updatedProfile.custom_number)
          : parsedValue != null
            ? String(parsedValue)
            : '';
      setCustomNumberValues((prev) => ({ ...prev, [donorId]: normalized }));
      setCustomNumberErrors((prev) => {
        if (!prev[donorId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[donorId];
        return next;
      });
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        'Unable to save custom number';
      setCustomNumberErrors((prev) => ({
        ...prev,
        [donorId]: typeof detail === 'string' ? detail : 'Unable to save custom number',
      }));
    } finally {
      setCustomNumberSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(donorId);
        return next;
      });
    }
  };

  const handlePoojaAccessChange = async (donor: DonorRecord, nextValue: boolean) => {
    const donorId = donor.user.id;
    if (readOnlyAdmin || poojaAccessSavingIds.has(donorId)) {
      return;
    }
    const currentValue = Boolean(donor.profile.pooja_registration_access);
    if (currentValue === nextValue) {
      return;
    }

    setDonors((prev) =>
      prev.map((record) =>
        record.user.id === donorId
          ? {
              ...record,
              profile: {
                ...record.profile,
                pooja_registration_access: nextValue,
              },
            }
          : record,
      ),
    );

    setPoojaAccessErrors((prev) => {
      if (!prev[donorId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[donorId];
      return next;
    });

    setPoojaAccessSavingIds((prev) => {
      const next = new Set(prev);
      next.add(donorId);
      return next;
    });

    try {
      const response = await api.put(`auth/donors/${donorId}/`, {
        profile: {
          pooja_registration_access: nextValue,
        },
      });
      const updatedUser = response.data?.user;
      const updatedProfile = response.data?.profile;
      if (updatedUser || updatedProfile) {
        setDonors((prev) =>
          prev.map((record) =>
            record.user.id === donorId
              ? {
                  ...record,
                  user: updatedUser ?? record.user,
                  profile: updatedProfile ?? record.profile,
                }
              : record,
          ),
        );
      }
      if (editingDonorId === donorId) {
        setDonorEditForm((prev) => ({
          ...prev,
          pooja_registration_access: nextValue ? 'yes' : 'no',
        }));
      }
    } catch (err: any) {
      setDonors((prev) =>
        prev.map((record) =>
          record.user.id === donorId
            ? {
                ...record,
                profile: {
                  ...record.profile,
                  pooja_registration_access: currentValue,
                },
              }
            : record,
        ),
      );
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        'Unable to update pooja access';
      setPoojaAccessErrors((prev) => ({
        ...prev,
        [donorId]: typeof detail === 'string' ? detail : 'Unable to update pooja access',
      }));
    } finally {
      setPoojaAccessSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(donorId);
        return next;
      });
    }
  };

  const handlePaymentDeleteAccessChange = async (donor: DonorRecord, nextValue: boolean) => {
    const donorId = donor.user.id;
    if (readOnlyAdmin || paymentDeleteSavingIds.has(donorId)) {
      return;
    }
    const currentValue = Boolean(donor.profile.payment_delete_access);
    if (currentValue === nextValue) {
      return;
    }

    setDonors((prev) =>
      prev.map((record) =>
        record.user.id === donorId
          ? {
              ...record,
              profile: {
                ...record.profile,
                payment_delete_access: nextValue,
              },
            }
          : record,
      ),
    );

    setPaymentDeleteErrors((prev) => {
      if (!prev[donorId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[donorId];
      return next;
    });

    setPaymentDeleteSavingIds((prev) => {
      const next = new Set(prev);
      next.add(donorId);
      return next;
    });

    try {
      const response = await api.put(`auth/donors/${donorId}/`, {
        profile: {
          payment_delete_access: nextValue,
        },
      });
      const updatedUser = response.data?.user;
      const updatedProfile = response.data?.profile;
      if (updatedUser || updatedProfile) {
        setDonors((prev) =>
          prev.map((record) =>
            record.user.id === donorId
              ? {
                  ...record,
                  user: updatedUser ?? record.user,
                  profile: updatedProfile ?? record.profile,
                }
              : record,
          ),
        );
      }
      if (editingDonorId === donorId) {
        setDonorEditForm((prev) => ({
          ...prev,
          payment_delete_access: nextValue ? 'yes' : 'no',
        }));
      }
    } catch (err: any) {
      setDonors((prev) =>
        prev.map((record) =>
          record.user.id === donorId
            ? {
                ...record,
                profile: {
                  ...record.profile,
                  payment_delete_access: currentValue,
                },
              }
            : record,
        ),
      );
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        'Unable to update payment delete access';
      setPaymentDeleteErrors((prev) => ({
        ...prev,
        [donorId]:
          typeof detail === 'string' ? detail : 'Unable to update payment delete access',
      }));
    } finally {
      setPaymentDeleteSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(donorId);
        return next;
      });
    }
  };

  const fetchRegistrations = useCallback(async (): Promise<GroupedRegistrations[]> => {
    let adminEndpointError = '';

    try {
      const response = await api.get('pooja/registrations/admin-overview/');
      const overview = normalizeAdminOverview(response.data);
      const overviewRegistrationCount = overview.reduce(
        (count, group) => count + group.registrations.length,
        0,
      );
      setPoojaRegistrationsCount(overviewRegistrationCount);
      return overview;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 404 && status !== 405) {
        const detail = err?.response?.data?.detail ?? err?.message;
        if (typeof detail === 'string' && detail) {
          adminEndpointError = detail;
        }
      }
    }

    try {
      const [summaryResponse, firstPageResponse] = await Promise.all([
        api.get('pooja/registrations/summary/'),
        api.get('pooja/registrations/', { params: { page_size: 100 } }),
      ]);

      const dedupe = new Map<number, RegistrationRecord>();
      extractRegistrationResults(summaryResponse.data).forEach((item) => {
        if (typeof item?.id === 'number') {
          dedupe.set(item.id, item);
        }
      });

      const firstPageData = firstPageResponse.data;
      extractRegistrationResults(firstPageData).forEach((item) => {
        if (typeof item?.id === 'number') {
          dedupe.set(item.id, item);
        }
      });

      let nextUrl = normalizeNextUrl(firstPageData?.next);
      while (nextUrl) {
        const nextResponse = await api.get(nextUrl);
        extractRegistrationResults(nextResponse.data).forEach((item) => {
          if (typeof item?.id === 'number') {
            dedupe.set(item.id, item);
          }
        });
        nextUrl = normalizeNextUrl(nextResponse.data?.next);
      }

      const summaryCount = Number(summaryResponse.data?.count ?? NaN);
      const firstPageCount = Number(firstPageData?.count ?? NaN);
      const registrationsCount =
        Number.isFinite(summaryCount)
          ? summaryCount
          : Number.isFinite(firstPageCount)
            ? firstPageCount
            : dedupe.size;
      setPoojaRegistrationsCount(registrationsCount);

      return groupRegistrationsByDonor(Array.from(dedupe.values()));
    } catch (err: any) {
      const fallbackDetail = err?.response?.data?.detail ?? err?.message ?? adminEndpointError;
      const message =
        typeof fallbackDetail === 'string' && fallbackDetail
          ? fallbackDetail
          : adminEndpointError || 'Unable to load pooja registrations';
      throw new Error(message);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setPoojaRegistrationsCount(null);
      try {
        const [donorResponse, registrations] = await Promise.all([api.get('auth/donors/'), fetchRegistrations()]);
        const donorData = donorResponse.data as DonorRecord[];
        setDonors(donorData);
        setRegistrationGroups(registrations);
        setExpandedSections((prev) => {
          const next: Record<number, { members: boolean; registrations: boolean; details: boolean }> = {};
          donorData.forEach((donor) => {
            next[donor.user.id] = prev[donor.user.id] ?? { members: false, registrations: false, details: false };
          });
          return next;
        });
      } catch (err: any) {
        const detail = err?.response?.data?.detail ?? err?.message ?? 'Unable to load donor details';
        setError(typeof detail === 'string' && detail ? detail : 'Unable to load donor details');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [fetchRegistrations]);

  const filteredDonors = useMemo(() => {
    if (!searchQuery.trim()) {
      return donors;
    }
    const query = searchQuery.toLowerCase().trim();
    return donors.filter((donor) => {
      const { user, profile, members } = donor;
      // Search in user details
      if (user.name.toLowerCase().includes(query)) return true;
      if (user.phone_number.includes(query)) return true;
      if (user.email?.toLowerCase().includes(query)) return true;
      if (profile.donor_id?.toLowerCase().includes(query)) return true;
      
      // Search in profile details
      if (profile.family_name?.toLowerCase().includes(query)) return true;
      if (profile.tamil_star?.toLowerCase().includes(query)) return true;
      if (profile.gothra?.toLowerCase().includes(query)) return true;
      
      // Search in member details
      return members.some(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.relationship?.toLowerCase().includes(query) ||
          member.tamil_star?.toLowerCase().includes(query) ||
          member.gothra?.toLowerCase().includes(query) ||
          member.family_name?.toLowerCase().includes(query)
      );
    });
  }, [donors, searchQuery]);

  const registrationIndex = useMemo(() => {
    const byId = new Map<number, GroupedRegistrations>();
    const byPhone = new Map<string, GroupedRegistrations>();
    const byName = new Map<string, GroupedRegistrations>();

    registrationGroups.forEach((group) => {
      if (group.donorId !== null) {
        byId.set(group.donorId, group);
      }
      const phoneKey = normalizePhone(group.donorPhone);
      if (phoneKey) {
        byPhone.set(phoneKey, group);
      }
      const nameKey = group.donorName?.trim().toLowerCase();
      if (nameKey) {
        byName.set(nameKey, group);
      }
    });

    return { byId, byPhone, byName };
  }, [registrationGroups]);

  const toggleSection = (donorId: number, section: 'members' | 'registrations' | 'details') => {
    setExpandedSections((prev) => {
      const current = prev[donorId] ?? { members: false, registrations: false, details: false };
      return { ...prev, [donorId]: { ...current, [section]: !current[section] } };
    });
  };

  const totals = useMemo(() => {
    const totalRegistrations = registrationGroups.reduce(
      (count, group) => count + group.registrations.length,
      0,
    );
    const donorsWithRegistrations = registrationGroups.reduce(
      (count, group) => count + (group.registrations.length > 0 ? 1 : 0),
      0,
    );
    const totalFamilyMembers = donors.reduce(
      (count, donor) => count + (Array.isArray(donor.members) ? donor.members.length : 0),
      0,
    );

    const locationCounts = new Map<string, number>();
    donors.forEach(({ profile }) => {
      const locationParts = [profile.city, profile.state].filter(Boolean);
      const locationLabel = locationParts.join(', ') || 'Not provided';
      locationCounts.set(locationLabel, (locationCounts.get(locationLabel) ?? 0) + 1);
    });

    const topLocations = Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));

    return {
      totalRegistrations,
      donorsWithRegistrations,
      totalFamilyMembers,
      topLocations,
    };
  }, [donors, registrationGroups]);

  const { totalRegistrations, donorsWithRegistrations, totalFamilyMembers, topLocations } = totals;

  const totalCartRegistrations = useMemo(
    () =>
      registrationGroups.reduce(
        (sum, group) =>
          sum + group.registrations.filter((registration) => Boolean(registration.cart_item)).length,
        0,
      ),
    [registrationGroups],
  );

  const displayedRegistrationCount = poojaRegistrationsCount ?? totalRegistrations;

  const registrationsHelper =
    totalCartRegistrations > 0
      ? `${formatNumber(Math.round(totalCartRegistrations / Math.max(donors.length, 1)))} per donor (avg based on cart)`
      : displayedRegistrationCount > 0
        ? `${formatNumber(Math.round(displayedRegistrationCount / Math.max(donors.length, 1)))} per donor (avg)`
        : 'No registrations recorded';

  const totalPaidRegistrations = Math.max(totalRegistrations - totalCartRegistrations, 0);
  const paymentsHelper =
    totalPaidRegistrations > 0
      ? `${formatNumber(Math.round(totalPaidRegistrations / Math.max(donors.length, 1)))} per donor (avg)`
      : 'No paid registrations yet';

  const registrationCardValue = totalCartRegistrations > 0 ? totalCartRegistrations : displayedRegistrationCount;

  const summaryCards = useMemo(
    () => [
      {
        label: 'Registered Donors',
        value: formatNumber(donors.length),
        helper:
          donorsWithRegistrations > 0
            ? `${formatNumber(donorsWithRegistrations)} donors with pooja activity`
            : 'Awaiting first pooja registration',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-orange-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19a3 3 0 10-6 0m9-11a3 3 0 11-6 0m0 0a3 3 0 11-6 0m6 0v2m0 10v-2m0-8v-2"
            />
          </svg>
        ),
      },
      {
        label: 'Family Members',
        value: formatNumber(totalFamilyMembers),
        helper:
          donors.length > 0
            ? `${formatNumber(Math.round((totalFamilyMembers || 0) / Math.max(donors.length, 1)))} avg per donor`
            : 'No donor records yet',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-orange-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM18.75 8.25A2.25 2.25 0 1119 3.75a2.25 2.25 0 01-.25 4.5zM19.5 21a6 6 0 00-12 0m14.25-.75a3.75 3.75 0 00-6.754-2.41"
            />
          </svg>
        ),
      },
    ],
    [
      donors.length,
      donorsWithRegistrations,
      totalFamilyMembers,
      totalCartRegistrations,
      totalRegistrations,
      displayedRegistrationCount,
    ],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-6"></div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Loading Donor Details</h3>
          <p className="text-slate-600 text-center">Please wait while we fetch the latest information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77 1.333-2.694 1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 text-center mb-2">Error Loading Data</h3>
          <p className="text-red-600 bg-red-50 rounded-lg p-4 text-center">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-6">
      <div className="responsive-layout">
        {/* Header Section */}
        <header className="mb-6 sm:mb-8 md:mb-10">
          <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Donor Management</h1>
                </div>
                <p className="text-slate-600 max-w-2xl text-sm sm:text-base">
                  Manage donor profiles, family members, and pooja registrations. View detailed information and track engagement.
                </p>
              </div>
              
              <div className="w-full md:w-auto">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search donors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition duration-200 text-sm sm:text-base"
                  />
                  <svg
                    className="absolute left-3 top-2.5 sm:top-3.5 h-5 w-5 text-slate-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-6 sm:mt-8">
              {summaryCards.map((card, index) => (
                <div key={card.label} className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{card.label}</p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-800">{card.value}</p>
                      <p className="text-xs text-slate-500 mt-2">{card.helper}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${index === 0 ? 'bg-orange-100 text-orange-600' : index === 1 ? 'bg-orange-100 text-orange-600' : index === 2 ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'}`}>
                      {card.icon}
                    </div>
                  </div>
                </div>
              ))}
              {!readOnlyAdmin && (
                <>
                  <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition duration-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Sign Up</p>
                        <p className="text-sm text-slate-600 mt-2">Open donor registration page</p>
                        <a
                          href="/register"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                        >
                          Go to Sign Up
                        </a>
                      </div>
                      <div className="p-3 rounded-lg bg-indigo-100 text-indigo-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-7 w-7"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition duration-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Forgot Password</p>
                        <p className="text-sm text-slate-600 mt-2">Open password reset page</p>
                        <a
                          href="/forgot-password"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                        >
                          Go to Forgot Password
                        </a>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-7 w-7"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m0 3h.008v.008H12v-.008zM10.5 6.75a1.5 1.5 0 113 0v1.02a4.5 4.5 0 11-3 0V6.75z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Donor List */}
        <div className="space-y-4 sm:space-y-6">
          {!loading && donors.length === 0 && (
            <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">No Donors Found</h3>
              <p className="text-slate-600 max-w-md mx-auto text-sm sm:text-base">There are no donors in the system yet. Add donors to get started.</p>
            </div>
          )}
          
          {!loading && donors.length > 0 && filteredDonors.length === 0 && (
            <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">No Matching Donors</h3>
              <p className="text-slate-600 max-w-md mx-auto text-sm sm:text-base">No donors match your search criteria. Try different keywords.</p>
            </div>
          )}
          
          {filteredDonors.map((donor) => {
            const { user, profile, members } = donor;
            const sectionState = expandedSections[user.id] ?? { members: false, registrations: false, details: false };
            const registrationGroup =
              registrationIndex.byId.get(user.id) ||
              registrationIndex.byPhone.get(normalizePhone(user.phone_number)) ||
              registrationIndex.byName.get(user.name.trim().toLowerCase());
            const registrations = registrationGroup?.registrations ?? [];

            const profileAddressLines = [profile.address_line1, profile.address_line2, profile.address_line3].map((line) =>
              typeof line === 'string' ? line.trim() : '',
            );
            const profileAddress = profileAddressLines.filter(Boolean).join(', ');
            const profileLocation = [profile.city, profile.state, profile.postal_code].filter(Boolean).join(', ');
            const memberCount = Array.isArray(members) ? members.length : 0;
            const locationLabel = profileLocation || 'Location not provided';
            const rawGender = (profile.gender ?? '').trim();
            const genderLabel = rawGender ? `${rawGender.charAt(0).toUpperCase()}${rawGender.slice(1)}` : 'Gender not provided';
            const emailLabel = resolveText(user.email, 'Not provided');
            const roleLabel = resolveText(user.role, 'Not provided');
            const fullAddress = profileAddress || 'Not provided';
            const inlineCustomNumber = customNumberValues[user.id] ?? resolveOpeningBalanceValue(profile);
            const customNumberError = customNumberErrors[user.id];
            const isCustomNumberSaving = customNumberSavingIds.has(user.id);
            const hasPoojaAccess = Boolean(profile.pooja_registration_access);
            const isPoojaAccessSaving = poojaAccessSavingIds.has(user.id);
            const poojaAccessError = poojaAccessErrors[user.id];
            const hasPaymentDeleteAccess = Boolean(profile.payment_delete_access);
            const isPaymentDeleteSaving = paymentDeleteSavingIds.has(user.id);
            const paymentDeleteError = paymentDeleteErrors[user.id];

            const basicDetails = [
              {
                label: 'Donor ID',
                value: resolveText(profile.donor_id, 'Not provided'),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m0 0l3-3m-3 3l-3-3" />
                  </svg>
                ),
              },
              {
                label: 'Phone Number',
                value: user.phone_number || 'Not provided',
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2.25 6.75C2.25 5.784 3.034 5 4 5h3c.966 0 1.75.784 1.75 1.75v.5c0 .495-.23.961-.62 1.262l-1.352 1.03a.75.75 0 00-.263.857A12 12 0 0014.6 20.485a.75.75 0 00.857-.262l1.03-1.353a1.5 1.5 0 011.262-.62h.5c.966 0 1.75.784 1.75 1.75V21c0 .966-.784 1.75-1.75 1.75H19C9.874 22.75 2.25 15.126 2.25 6.75z"
                    />
                  </svg>
                ),
              },
              {
                label: 'Email',
                value: emailLabel,
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75l9.75 7.5 9.75-7.5" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3.75 5.25h16.5A1.5 1.5 0 0121.75 6.75v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5z"
                    />
                  </svg>
                ),
              },
              {
                label: 'Gender',
                value: genderLabel,
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25v6" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 20.25h4.5" />
                  </svg>
                ),
              },
              {
                label: 'Date of Birth',
                value: formatDonorDate(profile.date_of_birth),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75v-1.5a1.5 1.5 0 011.5-1.5h4.5a1.5 1.5 0 011.5 1.5v1.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 9h16.5M6 12h.008v.008H6V12zM8.25 12h.008v.008H8.25V12zM10.5 12h.008v.008H10.5V12z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 5.25h10.5A1.5 1.5 0 0118.75 6.75v11.5a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5z" />
                  </svg>
                ),
              },
              {
                label: 'Account Role',
                value: roleLabel,
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19a3 3 0 10-6 0m9-11a3 3 0 11-6 0m0 0a3 3 0 11-6 0m6 0v2m0 10v-2m0-8v-2" />
                  </svg>
                ),
              },
              {
                label: 'Donor Header Text',
                value: resolveText(profile.notes),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-6 4.5l4.5 4.5"
                    />
                  </svg>
                ),
              },
            ];

            const residentialDetails = [
              { label: 'Full Address', value: fullAddress },
              { label: 'Address Line 1', value: resolveText(profile.address_line1) },
              { label: 'Address Line 2', value: resolveText(profile.address_line2) },
              { label: 'Address Line 3', value: resolveText(profile.address_line3) },
              { label: 'City', value: resolveText(profile.city) },
              { label: 'State', value: resolveText(profile.state) },
              { label: 'Postal Code', value: resolveText(profile.postal_code) },
            ];

            const spiritualDetails = [
              {
                label: 'Family Name',
                value: resolveText(profile.family_name),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5l7.5 6-7.5 6-7.5-6z" />
                  </svg>
                ),
              },
              {
                label: 'Sarman',
                value: resolveText(profile.tamil_name),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l2.09 6.26H20.5l-5.18 3.76 1.98 6.1L12 15.75l-5.3 3.37 1.98-6.1L3.5 9.26h6.41L12 3z" />
                  </svg>
                ),
              },
              {
                label: 'Tamil Star',
                value: resolveText(profile.tamil_star),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l2.09 6.26H20.5l-5.18 3.76 1.98 6.1L12 15.75l-5.3 3.37 1.98-6.1L3.5 9.26h6.41L12 3z" />
                  </svg>
                ),
              },
              {
                label: 'Gothra',
                value: resolveText(profile.gothra),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l7.5-15 7.5 15M9 19.5h6" />
                  </svg>
                ),
              },
              {
                label: 'Rasi',
                value: resolveText(profile.rasi),
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v18m-6-6h12" />
                  </svg>
                ),
              },
            ];

            return (
              <section
                key={user.id}
                className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg"
              >
                {/* Donor Header */}
                <header className="p-4 sm:p-6 border-b border-slate-100">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
                        <span className="text-lg font-bold text-orange-700">{user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {profile.donor_id && (
                            <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                              Donor #{profile.donor_id}
                            </span>
                          )}
                          <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                            {formatDonorDisplayName(user.name, profile.tamil_name)}
                          </h2>
                          <div className="inline-flex flex-wrap items-center gap-4 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
                            <div className="inline-flex items-center gap-2">
                              <span className="font-semibold text-slate-700">Pooja Access</span>
                              <label className="inline-flex items-center gap-1.5 text-slate-700">
                                <input
                                  type="radio"
                                  name={`pooja-access-${user.id}`}
                                  checked={hasPoojaAccess}
                                  onChange={() => handlePoojaAccessChange(donor, true)}
                                  disabled={readOnlyAdmin || isPoojaAccessSaving}
                                  className="h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className={hasPoojaAccess ? 'font-semibold text-emerald-700' : 'text-slate-500'}>
                                  Yes
                                </span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-slate-700">
                                <input
                                  type="radio"
                                  name={`pooja-access-${user.id}`}
                                  checked={!hasPoojaAccess}
                                  onChange={() => handlePoojaAccessChange(donor, false)}
                                  disabled={readOnlyAdmin || isPoojaAccessSaving}
                                  className="h-3.5 w-3.5 text-slate-600 focus:ring-slate-500"
                                />
                                <span className={!hasPoojaAccess ? 'font-semibold text-slate-700' : 'text-slate-500'}>
                                  No
                                </span>
                              </label>
                              {isPoojaAccessSaving && (
                                <span className="text-[10px] font-medium text-slate-500">Saving...</span>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-2">
                              <span className="font-semibold text-slate-700">Payment Delete</span>
                              <label className="inline-flex items-center gap-1.5 text-slate-700">
                                <input
                                  type="radio"
                                  name={`payment-delete-access-${user.id}`}
                                  checked={hasPaymentDeleteAccess}
                                  onChange={() => handlePaymentDeleteAccessChange(donor, true)}
                                  disabled={readOnlyAdmin || isPaymentDeleteSaving}
                                  className="h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className={hasPaymentDeleteAccess ? 'font-semibold text-emerald-700' : 'text-slate-500'}>
                                  Yes
                                </span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-slate-700">
                                <input
                                  type="radio"
                                  name={`payment-delete-access-${user.id}`}
                                  checked={!hasPaymentDeleteAccess}
                                  onChange={() => handlePaymentDeleteAccessChange(donor, false)}
                                  disabled={readOnlyAdmin || isPaymentDeleteSaving}
                                  className="h-3.5 w-3.5 text-slate-600 focus:ring-slate-500"
                                />
                                <span className={!hasPaymentDeleteAccess ? 'font-semibold text-slate-700' : 'text-slate-500'}>
                                  No
                                </span>
                              </label>
                              {isPaymentDeleteSaving && (
                                <span className="text-[10px] font-medium text-slate-500">Saving...</span>
                              )}
                            </div>
                          </div>
                          {poojaAccessError && <span className="text-[11px] text-red-600">{poojaAccessError}</span>}
                          {paymentDeleteError && (
                            <span className="text-[11px] text-red-600">{paymentDeleteError}</span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          {profile.family_name && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5l7.5 6-7.5 6-7.5-6z" />
                              </svg>
                              Family: {profile.family_name}
                            </span>
                          )}
                          {profile.tamil_star && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l2.09 6.26H20.5l-5.18 3.76 1.98 6.1L12 15.75l-5.3 3.37 1.98-6.1L3.5 9.26h6.41L12 3z" />
                              </svg>
                              Star: {profile.tamil_star}
                            </span>
                          )}
                          {profile.gothra && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l7.5-15 7.5 15M9 19.5h6" />
                              </svg>
                              Gothra: {profile.gothra}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 text-sm text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25v6" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 20.25h4.5" />
                            </svg>
                            {genderLabel}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 4.5c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V6c0 .621-.504 1.125-1.125 1.125h-.375A12.084 12.084 0 0014.875 18h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H14.25C7.67 22.5 2.25 17.08 2.25 10.5V4.5z" />
                            </svg>
                            {user.phone_number}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.125-7.5 11.25-7.5 11.25S4.5 17.625 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            {locationLabel}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12m-12 10.5h12M3 6.75l1.5 1.5L6 6.75m0 10.5l-1.5-1.5L3 17.25" />
                        </svg>
                        {registrations.length} registration{registrations.length === 1 ? '' : 's'}
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zm0 0v12" />
                        </svg>
                        {memberCount} family member{memberCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                </header>

                {/* Donor Details Sections */}
                <div className="divide-y divide-slate-100">
                  <div className="p-4 sm:p-6 bg-slate-50/70">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <button
                        type="button"
                        onClick={() => toggleSection(user.id, 'details')}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM18.75 8.25A2.25 2.25 0 1119 3.75a2.25 2.25 0 01-.25 4.5zM19.5 21a6 6 0 00-12 0m14.25-.75a3.75 3.75 0 00-6.754-2.41"
                              />
                            </svg>
                          </div>
                          <span className="font-semibold text-slate-800">Donor Information</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">{sectionState.details ? 'Hide' : 'Show'}</span>
                          <svg
                            className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${sectionState.details ? 'rotate-180' : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        {editingDonorId === user.id ? (
                          <button
                            type="button"
                            onClick={cancelDonorEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                            disabled={donorEditSubmitting}
                          >
                            Cancel Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startDonorEdit(donor)}
                            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Details
                          </button>
                        )}
                      </div>
                    </div>

                    {sectionState.details && (
                      <>
                        {editingDonorId === user.id ? (
                          <form onSubmit={handleDonorEditSubmit} className="mt-4 space-y-5">
                            {donorEditError && (
                              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {donorEditError}
                              </div>
                            )}
                            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                              <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM18.75 8.25A2.25 2.25 0 1119 3.75a2.25 2.25 0 01-.25 4.5zM19.5 21a6 6 0 00-12 0m14.25-.75a3.75 3.75 0 00-6.754-2.41" />
                                    </svg>
                                  </div>
                                  Basic Information
                                </div>
                                <div className="mt-4 space-y-3">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`donor-name-${user.id}`}>
                                      Donor Name
                                    </label>
                                    <input
                                      id={`donor-name-${user.id}`}
                                      name="name"
                                      type="text"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.name}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`donor-phone-${user.id}`}>
                                      Phone Number
                                    </label>
                                    <input
                                      id={`donor-phone-${user.id}`}
                                      name="phone_number"
                                      type="text"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.phone_number}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`donor-email-${user.id}`}>
                                      Email
                                    </label>
                                    <input
                                      id={`donor-email-${user.id}`}
                                      name="email"
                                      type="email"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.email}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`donor-gender-${user.id}`}>
                                        Gender
                                      </label>
                                      <select
                                        id={`donor-gender-${user.id}`}
                                        name="gender"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                        value={donorEditForm.gender}
                                        onChange={handleDonorEditChange}
                                        disabled={donorEditSubmitting}
                                      >
                                        <option value="">Select gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`donor-dob-${user.id}`}>
                                        Date of Birth
                                      </label>
                                      <input
                                        id={`donor-dob-${user.id}`}
                                        name="date_of_birth"
                                        type="date"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                        value={donorEditForm.date_of_birth}
                                        onChange={handleDonorEditChange}
                                        disabled={donorEditSubmitting}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`donor-notes-${user.id}`}>
                                      Donor Header Text
                                    </label>
                                    <textarea
                                      id={`donor-notes-${user.id}`}
                                      name="notes"
                                      rows={3}
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.notes}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    ></textarea>
                                  </div>
                                  <div>
                                    <p className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                      Pooja Access
                                    </p>
                                    <div className="flex flex-wrap items-center gap-4">
                                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                          type="radio"
                                          name="pooja_registration_access"
                                          value="yes"
                                          className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                          checked={donorEditForm.pooja_registration_access === 'yes'}
                                          onChange={handleDonorEditChange}
                                          disabled={donorEditSubmitting}
                                        />
                                        Yes
                                      </label>
                                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                          type="radio"
                                          name="pooja_registration_access"
                                          value="no"
                                          className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                          checked={donorEditForm.pooja_registration_access === 'no'}
                                          onChange={handleDonorEditChange}
                                          disabled={donorEditSubmitting}
                                        />
                                        No
                                      </label>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                      Payment Delete Access
                                    </p>
                                    <div className="flex flex-wrap items-center gap-4">
                                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                          type="radio"
                                          name="payment_delete_access"
                                          value="yes"
                                          className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                          checked={donorEditForm.payment_delete_access === 'yes'}
                                          onChange={handleDonorEditChange}
                                          disabled={donorEditSubmitting}
                                        />
                                        Yes
                                      </label>
                                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                          type="radio"
                                          name="payment_delete_access"
                                          value="no"
                                          className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                          checked={donorEditForm.payment_delete_access === 'no'}
                                          onChange={handleDonorEditChange}
                                          disabled={donorEditSubmitting}
                                        />
                                        No
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7.5l9-5.25L21 7.5v9l-9 5.25L3 16.5v-9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7.5l9 5.25L21 7.5" />
                                    </svg>
                                  </div>
                                  Residential Details
                                </div>
                                <div className="mt-4 space-y-3">
                                  {[
                                    { name: 'address_line1' as const, label: 'Address Line 1' },
                                    { name: 'address_line2' as const, label: 'Address Line 2' },
                                    { name: 'address_line3' as const, label: 'Address Line 3' },
                                  ].map((field) => (
                                    <div key={field.name}>
                                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`${field.name}-${user.id}`}>
                                        {field.label}
                                      </label>
                                      <input
                                        id={`${field.name}-${user.id}`}
                                        name={field.name}
                                        type="text"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                        value={donorEditForm[field.name]}
                                        onChange={handleDonorEditChange}
                                        disabled={donorEditSubmitting}
                                      />
                                    </div>
                                  ))}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`city-${user.id}`}>
                                        City
                                      </label>
                                      <input
                                        id={`city-${user.id}`}
                                        name="city"
                                        type="text"
                                        list="city-options-list"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                        value={donorEditForm.city}
                                        onChange={handleDonorEditChange}
                                        disabled={donorEditSubmitting}
                                      />
                                      <datalist id="city-options-list">
                                        {indianCities.map((city) => (
                                          <option
                                            key={`${city.name}-${city.stateCode}`}
                                            value={city.name}
                                            label={city.stateName ? `${city.name}, ${city.stateName}` : city.name}
                                          />
                                        ))}
                                      </datalist>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`state-${user.id}`}>
                                        State
                                      </label>
                                      <input
                                        id={`state-${user.id}`}
                                        name="state"
                                        type="text"
                                        list="state-options-list"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                        value={donorEditForm.state}
                                        onChange={handleDonorEditChange}
                                        disabled={donorEditSubmitting}
                                      />
                                      <datalist id="state-options-list">
                                        {stateOptions.map((state) => (
                                          <option key={state} value={state} />
                                        ))}
                                      </datalist>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`postal-${user.id}`}>
                                      Postal Code
                                    </label>
                                    <input
                                      id={`postal-${user.id}`}
                                      name="postal_code"
                                      type="text"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.postal_code}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l2.09 6.26H20.5l-5.18 3.76 1.98 6.1L12 15.75l-5.3 3.37 1.98-6.1L3.5 9.26h6.41L12 3z" />
                                    </svg>
                                  </div>
                                  Spiritual Details
                                </div>
                                <div className="mt-4 space-y-3">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`family-name-${user.id}`}>
                                      Family Name
                                    </label>
                                    <input
                                      id={`family-name-${user.id}`}
                                      name="family_name"
                                      type="text"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.family_name}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`tamil-star-${user.id}`}>
                                      Tamil Star
                                    </label>
                                    <select
                                      id={`tamil-star-${user.id}`}
                                      name="tamil_star"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.tamil_star}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    >
                                      <option value="">Select Tamil star</option>
                                      {tamilStarOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor={`gothra-${user.id}`}>
                                      Gothra
                                    </label>
                                    <select
                                      id={`gothra-${user.id}`}
                                      name="gothra"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm"
                                      value={donorEditForm.gothra}
                                      onChange={handleDonorEditChange}
                                      disabled={donorEditSubmitting}
                                    >
                                      <option value="">Select Gothra</option>
                                      {gothraOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={donorEditSubmitting}
                              >
                                {donorEditSubmitting ? (
                                  <>
                                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Save Changes
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={cancelDonorEdit}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={donorEditSubmitting}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM18.75 8.25A2.25 2.25 0 1119 3.75a2.25 2.25 0 01-.25 4.5zM19.5 21a6 6 0 00-12 0m14.25-.75a3.75 3.75 0 00-6.754-2.41" />
                                  </svg>
                                </div>
                                Basic Information
                              </div>
                              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {basicDetails.map((detail) => (
                                  <div key={detail.label} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="w-9 h-9 rounded-xl bg-white text-orange-500 flex items-center justify-center shadow-md shadow-orange-100/60">
                                      {detail.icon}
                                    </div>
                                    <div>
                                      <dt className="text-xs uppercase tracking-wide text-slate-500">{detail.label}</dt>
                                      <dd className="text-sm font-semibold text-slate-800 mt-0.5 break-words">{detail.value}</dd>
                                    </div>
                                  </div>
                                ))}
                              </dl>
                            </div>

                            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7.5l9-5.25L21 7.5v9l-9 5.25L3 16.5v-9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7.5l9 5.25L21 7.5" />
                                  </svg>
                                </div>
                                Residential Details
                              </div>
                              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {residentialDetails.map((detail) => (
                                  <div key={detail.label} className="rounded-2xl bg-slate-50 px-3 py-3 border border-slate-100">
                                    <dt className="text-xs uppercase tracking-wide text-slate-500">{detail.label}</dt>
                                    <dd className="text-sm font-semibold text-slate-800 mt-1 break-words">{detail.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>

                            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l2.09 6.26H20.5l-5.18 3.76 1.98 6.1L12 15.75l-5.3 3.37 1.98-6.1L3.5 9.26h6.41L12 3z" />
                                  </svg>
                                </div>
                                Spiritual Details
                              </div>
                              <dl className="mt-4 grid grid-cols-1 gap-3">
                                {spiritualDetails.map((detail) => (
                                  <div key={detail.label} className="rounded-2xl border border-slate-100 p-3 flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                                      {detail.icon}
                                    </div>
                                    <div>
                                      <dt className="text-xs uppercase tracking-wide text-slate-500">{detail.label}</dt>
                                      <dd className="text-sm font-semibold text-slate-800 mt-0.5">{detail.value}</dd>
                                    </div>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Family Members Section */}
                  <div className="p-4 sm:p-6">
                    <button
                      type="button"
                      onClick={() => toggleSection(user.id, 'members')}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13.5a3 3 0 10-6 0v2.25h6V13.5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 12a4.125 4.125 0 100-8.25A4.125 4.125 0 0012 12zm0 3.75a7.125 7.125 0 00-7.125 7.125h14.25A7.125 7.125 0 0012 15.75z" />
                          </svg>
                        </div>
                        <span className="font-semibold text-slate-800">Family Members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">{sectionState.members ? 'Hide' : 'Show'}</span>
                        <svg 
                          className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${sectionState.members ? 'rotate-180' : ''}`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {sectionState.members && (
                      <div className="mt-4 space-y-4">
                        {members.length === 0 ? (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zm0 0v12" />
                              </svg>
                            </div>
                            <p className="text-slate-600">No family members recorded.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {members.map((member) => (
                              <div key={member.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h3 className="font-semibold text-slate-800">{member.name}</h3>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
                                      {member.relationship || 'Relationship not provided'}
                                    </p>
                                  </div>
                                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                                    <span className="text-sm font-medium text-slate-700">{member.name.charAt(0)}</span>
                                  </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {member.gender && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25v6" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 20.25h4.5" />
                                      </svg>
                                      {member.gender}
                                    </span>
                                  )}
                                  {member.tamil_star && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l2.09 6.26H20.5l-5.18 3.76 1.98 6.1L12 15.75l-5.3 3.37 1.98-6.1L3.5 9.26h6.41L12 3z" />
                                      </svg>
                                      {member.tamil_star}
                                    </span>
                                  )}
                                  {member.gothra && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l7.5-15 7.5 15M9 19.5h6" />
                                      </svg>
                                      {member.gothra}
                                    </span>
                                  )}
                                  {member.family_name && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l7.5 4.5-7.5 4.5L4.5 7.5 12 3z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12l7.5 4.5L19.5 12M12 21V16.5" />
                                      </svg>
                                      {member.family_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pooja Registrations Section */}
                  <div className="p-4 sm:p-6">
                    <button
                      type="button"
                      onClick={() => toggleSection(user.id, 'registrations')}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12m-12 10.5h12" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 6.75A2.25 2.25 0 0018.75 4.5H6.75A2.25 2.25 0 004.5 6.75v12.75l3-3 3 3 3-3 3 3 3-3 3 3V6.75z" />
                          </svg>
                        </div>
                        <span className="font-semibold text-slate-800">Pooja Registrations</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">{sectionState.registrations ? 'Hide' : 'Show'}</span>
                        <svg 
                          className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${sectionState.registrations ? 'rotate-180' : ''}`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {sectionState.registrations && (
                      <div className="mt-4">
                        {registrations.length === 0 ? (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12m-12 10.5h12M3 6.75l1.5 1.5L6 6.75m0 10.5l-1.5-1.5L3 17.25" />
                              </svg>
                            </div>
                            <p className="text-slate-600">No pooja registrations recorded.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                              <thead>
                                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                  <th className="whitespace-nowrap px-4 py-3">Registration ID</th>
                                  <th className="whitespace-nowrap px-4 py-3">Pooja Name</th>
                                  <th className="whitespace-nowrap px-4 py-3">Pooja Day</th>
                                  <th className="whitespace-nowrap px-4 py-3">Members</th>
                                  <th className="whitespace-nowrap px-4 py-3">Amount</th>
                                  <th className="whitespace-nowrap px-4 py-3">Post Prasadam</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {registrations.map((registration) => {
                                  const postPrasadamMeta = registration.post_prasadam
                                    ? {
                                        label: 'Yes',
                                        className: 'border border-rose-200 bg-rose-50 text-rose-700',
                                      }
                                    : {
                                        label: 'No',
                                        className: 'border border-slate-200 bg-slate-100 text-slate-600',
                                      };
                                  return (
                                    <tr key={registration.id} className="hover:bg-slate-50 transition-colors duration-150">
                                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                                        {registration.pooja_reg_id || 'N/A'}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                        {formatRegistrationDate(registration.start_date)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                        {registration.pooja_option_name || 'N/A'}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                        {registration.day_option_description || 'N/A'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                          {registration.members && registration.members.length > 0 ? (
                                            registration.members.map((member) => (
                                              <span
                                                key={member.id ?? `${registration.id}-${member.name}`}
                                                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                              >
                                                {member.name}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                                              No members listed
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                                        {formatCurrency(registration.total_amount)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${postPrasadamMeta.className}`}>
                                          {postPrasadamMeta.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DonorDetailsPage;
