import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import api from '../../lib/api';

interface DonorProfile {
  donor_id?: string | null;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  tamil_star?: string;
  gothra?: string;
  date_of_birth?: string | null;
  family_name?: string;
  gender?: string;
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
  date_of_birth?: string | null;
  family_name?: string;
}

interface DonorRecord {
  user: DonorUser;
  profile: DonorProfile;
  members: DonorMember[];
}

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

const normalizePhone = (value?: string | null) => (value ? value.replace(/\D/g, '') : '');

const formatNumber = (value: number) => value.toLocaleString('en-IN');

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
  const [donors, setDonors] = useState<DonorRecord[]>([]);
  const [registrationGroups, setRegistrationGroups] = useState<GroupedRegistrations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<
    Record<number, { members: boolean; registrations: boolean }>
  >({});
  const [memberFormVisible, setMemberFormVisible] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: '',
    gender: '',
    date_of_birth: '',
    tamil_star: '',
    gothra: '',
    family_name: '',
    isOtherSelected: false,
    customFamilyName: ''
  });
  const [memberError, setMemberError] = useState('');
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [adminMembers, setAdminMembers] = useState<DonorMember[]>([]);
  const [adminMembersError, setAdminMembersError] = useState('');
  const [adminMembersLoading, setAdminMembersLoading] = useState(false);
  const [editingAdminMemberId, setEditingAdminMemberId] = useState<number | null>(null);
  const [adminMemberEditForm, setAdminMemberEditForm] = useState(() => ({
    name: '',
    gender: '',
    tamil_star: '',
    gothra: '',
    date_of_birth: '',
    family_name: '',
    relationship: '',
  }));
  const [adminMemberEditError, setAdminMemberEditError] = useState('');
  const [adminMemberEditSubmitting, setAdminMemberEditSubmitting] = useState(false);
  const [adminMemberDeleteError, setAdminMemberDeleteError] = useState('');
  const [adminMemberDeleteSubmitting, setAdminMemberDeleteSubmitting] = useState(false);
  const [adminMemberDeleteId, setAdminMemberDeleteId] = useState<number | null>(null);

  const loadAdminMembers = useCallback(async () => {
    setAdminMembersLoading(true);
    setAdminMembersError('');
    try {
      const response = await api.get('auth/family-members/');
      const payload = response.data as any;
      const members: DonorMember[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
          ? payload.results
          : [];
      setAdminMembers(members);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Unable to load admin members';
      setAdminMembersError(typeof detail === 'string' && detail ? detail : 'Unable to load admin members');
      setAdminMembers([]);
    } finally {
      setAdminMembersLoading(false);
    }
  }, []);

  const resetMemberForm = () => {
    setMemberForm({
      name: '',
      gender: '',
      date_of_birth: '',
      tamil_star: '',
      gothra: '',
      family_name: '',
      isOtherSelected: false,
      customFamilyName: ''
    });
  };

  const handleMemberChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    if (name === 'family_name') {
      const isOtherSelected = value === 'Other';
      setMemberForm((prev) => ({
        ...prev,
        [name]: value,
        isOtherSelected,
        customFamilyName: isOtherSelected ? prev.customFamilyName : ''
      }));
    } else {
      setMemberForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleMemberSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMemberError('');

    if (!memberForm.name.trim()) {
      setMemberError('Name is required.');
      return;
    }

    const payload: Record<string, string> = {
      name: memberForm.name.trim(),
    };

    if (memberForm.gender) {
      payload.gender = memberForm.gender;
    }
    if (memberForm.tamil_star) {
      payload.tamil_star = memberForm.tamil_star;
    }
    if (memberForm.gothra) {
      payload.gothra = memberForm.gothra;
    }
    if (memberForm.date_of_birth) {
      payload.date_of_birth = memberForm.date_of_birth;
    }
    const finalFamilyName = memberForm.isOtherSelected
      ? memberForm.customFamilyName.trim()
      : memberForm.family_name.trim();
    if (finalFamilyName) {
      payload.family_name = finalFamilyName;
    }

    try {
      setMemberSubmitting(true);
      await api.post('auth/family-members/', payload);
      await loadAdminMembers();

      resetMemberForm();
      setMemberFormVisible(false);
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message ?? 'Unable to add member';
      setMemberError(typeof detail === 'string' ? detail : 'Unable to add member');
    } finally {
      setMemberSubmitting(false);
    }
  };

  const resetAdminMemberEditForm = () => {
    setAdminMemberEditForm({
      name: '',
      gender: '',
      tamil_star: '',
      gothra: '',
      date_of_birth: '',
      family_name: '',
      relationship: '',
    });
  };

  const startAdminMemberEdit = (member: DonorMember) => {
    setEditingAdminMemberId(member.id);
    setAdminMemberEditError('');
    setAdminMemberEditForm({
      name: member.name ?? '',
      gender: member.gender ?? '',
      tamil_star: member.tamil_star ?? '',
      gothra: member.gothra ?? '',
      date_of_birth: member.date_of_birth ?? '',
      family_name: member.family_name ?? '',
      relationship: member.relationship ?? '',
    });
  };

  const handleAdminMemberEditChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setAdminMemberEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const cancelAdminMemberEdit = () => {
    setEditingAdminMemberId(null);
    setAdminMemberEditError('');
    resetAdminMemberEditForm();
  };

  const handleAdminMemberEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingAdminMemberId === null) {
      return;
    }

    setAdminMemberEditError('');

    if (!adminMemberEditForm.name.trim()) {
      setAdminMemberEditError('Name is required.');
      return;
    }

    const payload: Record<string, string | null> = {
      name: adminMemberEditForm.name.trim(),
      gender: adminMemberEditForm.gender,
      tamil_star: adminMemberEditForm.tamil_star,
      gothra: adminMemberEditForm.gothra,
      family_name: adminMemberEditForm.family_name.trim(),
      relationship: adminMemberEditForm.relationship.trim(),
      date_of_birth: adminMemberEditForm.date_of_birth ? adminMemberEditForm.date_of_birth : null,
    };

    try {
      setAdminMemberEditSubmitting(true);
      const { data } = await api.put<DonorMember>(`auth/family-members/${editingAdminMemberId}/`, payload);
      setAdminMembers((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setEditingAdminMemberId(null);
      resetAdminMemberEditForm();
      setAdminMemberEditError('');
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message ?? 'Unable to update member';
      setAdminMemberEditError(typeof detail === 'string' ? detail : 'Unable to update member');
    } finally {
      setAdminMemberEditSubmitting(false);
    }
  };

  const handleAdminMemberDelete = async (memberId: number) => {
    if (adminMemberDeleteSubmitting) {
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this member? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    setAdminMemberDeleteError('');
    setAdminMemberDeleteSubmitting(true);
    setAdminMemberDeleteId(memberId);

    try {
      await api.delete(`auth/family-members/${memberId}/`);
      setAdminMembers((prev) => prev.filter((item) => item.id !== memberId));
      if (editingAdminMemberId === memberId) {
        setEditingAdminMemberId(null);
        resetAdminMemberEditForm();
      }
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message ?? 'Unable to delete member';
      setAdminMemberDeleteError(typeof detail === 'string' ? detail : 'Unable to delete member');
    } finally {
      setAdminMemberDeleteSubmitting(false);
      setAdminMemberDeleteId(null);
    }
  };

  const fetchRegistrations = useCallback(async (): Promise<GroupedRegistrations[]> => {
    let adminEndpointError = '';

    try {
      const response = await api.get('pooja/registrations/admin-overview/');
      const overview = normalizeAdminOverview(response.data);
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
      try {
        const [donorResponse, registrations] = await Promise.all([api.get('auth/donors/'), fetchRegistrations()]);
        const donorData = donorResponse.data as DonorRecord[];
        setDonors(donorData);
        setRegistrationGroups(registrations);
        setExpandedSections((prev) => {
          const next: Record<number, { members: boolean; registrations: boolean }> = {};
          donorData.forEach((donor) => {
            next[donor.user.id] = prev[donor.user.id] ?? { members: false, registrations: false };
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
    loadAdminMembers();
  }, [fetchRegistrations, loadAdminMembers]);

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

  const toggleSection = (donorId: number, section: 'members' | 'registrations') => {
    setExpandedSections((prev) => {
      const current = prev[donorId] ?? { members: false, registrations: false };
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
            className="h-7 w-7 text-green-500"
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
            className="h-7 w-7 text-green-500"
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
      {
        label: 'Pooja Registrations',
        value: formatNumber(totalRegistrations),
        helper:
          totalRegistrations > 0
            ? `${formatNumber(Math.round(totalRegistrations / Math.max(donors.length, 1)))} per donor (avg)`
            : 'No registrations recorded',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 6.75h12m-12 10.5h12M3 6.75l1.5 1.5L6 6.75m0 10.5l-1.5-1.5L3 17.25"
            />
          </svg>
        ),
      },
      {
        label: 'Admin Added Members',
        value: formatNumber(adminMembers.length),
        helper: 'Centralised records created from this dashboard',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-sky-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        ),
      },
    ],
    [adminMembers.length, donors.length, donorsWithRegistrations, totalFamilyMembers, totalRegistrations],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-6"></div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Loading Donor Details</h3>
          <p className="text-slate-600 text-center">Please wait while we fetch the latest information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 text-center mb-2">Error Loading Data</h3>
          <p className="text-red-600 bg-red-50 rounded-lg p-4 text-center">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="mb-10">
          <div className="bg-white rounded-2xl shadow-md p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Donor Management</h1>
                </div>
                <p className="text-slate-600 max-w-2xl">
                  Manage donor profiles, family members, and pooja registrations. View detailed information and track engagement.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search donors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                  />
                  <svg
                    className="absolute left-3 top-3.5 h-5 w-5 text-slate-400"
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
                <button
                  type="button"
                  onClick={() => setMemberFormVisible(!memberFormVisible)}
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition duration-200 ${memberFormVisible ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {memberFormVisible ? 'Cancel' : 'Add Member'}
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
              {summaryCards.map((card, index) => (
                <div key={card.label} className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{card.label}</p>
                      <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                      <p className="text-xs text-slate-500 mt-2">{card.helper}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${index === 0 ? 'bg-green-100 text-green-600' : index === 1 ? 'bg-green-100 text-green-600' : index === 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                      {card.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Add Member Form */}
        {memberFormVisible && (
          <div className="mb-10 bg-white rounded-2xl shadow-md p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Add New Member</h2>
            </div>
            
            <form onSubmit={handleMemberSubmit} className="space-y-6">
              {memberError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{memberError}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="member-name">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="member-name"
                    name="name"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                    value={memberForm.name}
                    onChange={handleMemberChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="member-dob">
                    Date of Birth
                  </label>
                  <input
                    id="member-dob"
                    name="date_of_birth"
                    type="date"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                    value={memberForm.date_of_birth}
                    onChange={handleMemberChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="member-gender">
                    Gender
                  </label>
                  <select
                    id="member-gender"
                    name="gender"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                    value={memberForm.gender}
                    onChange={handleMemberChange}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="member-star">
                    Tamil Star
                  </label>
                  <input
                    id="member-star"
                    name="tamil_star"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                    value={memberForm.tamil_star}
                    onChange={handleMemberChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="member-gothra">
                    Gothram
                  </label>
                  <select
                    id="member-gothra"
                    name="gothra"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                    value={memberForm.gothra}
                    onChange={handleMemberChange}
                  >
                    <option value="">Select Gothram</option>
                    <option value="Atri">Atri</option>
                    <option value="Bharadvaja">Bharadvaja</option>
                    <option value="Gautama">Gautama</option>
                    <option value="Jamadagni">Jamadagni</option>
                    <option value="Kashyapa">Kashyapa</option>
                    <option value="Vasishta">Vasishta</option>
                    <option value="Vishvamitra">Vishvamitra</option>
                    <option value="Agastya">Agastya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="member-family">
                    Family Name
                  </label>
                  <select
                    id="member-family"
                    name="family_name"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                    value={memberForm.family_name}
                    onChange={handleMemberChange}
                  >
                    <option value="">Select family name</option>
                    <option value="Arunachalam-Sambasiva Iyr">Arunachalam-Sambasiva Iyr</option>
                    <option value="Kadakarar Subramani Iyr">Kadakarar Subramani Iyr</option>
                    <option value="Sundaresa Iyr+ Pannai+Balu Fmly">Sundaresa Iyr+ Pannai+Balu Fmly</option>
                    <option value="Narayanswamy fmly">Narayanswamy fmly</option>
                    <option value="Mangalam Periyamma Fmly">Mangalam Periyamma Fmly</option>
                    <option value="Koorakattu Fmly">Koorakattu Fmly</option>
                    <option value="RamaniSastri Fmly">RamaniSastri Fmly</option>
                    <option value="Pichu Iyr Fmly">Pichu Iyr Fmly</option>
                    <option value="Pattamani Iyr Fmly">Pattamani Iyr Fmly</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {memberForm.isOtherSelected && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="member-custom-family">
                      Custom Family Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="member-custom-family"
                      name="customFamilyName"
                      type="text"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition duration-200"
                      value={memberForm.customFamilyName}
                      onChange={handleMemberChange}
                      placeholder="Enter custom family name"
                      required={memberForm.isOtherSelected}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMemberFormVisible(false)}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={memberSubmitting}
                  className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 shadow-md hover:shadow-lg transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {memberSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </span>
                  ) : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Donor List */}
        <div className="space-y-6">
          {!loading && donors.length === 0 && (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No Donors Found</h3>
              <p className="text-slate-600 max-w-md mx-auto">There are no donors in the system yet. Add donors to get started.</p>
            </div>
          )}
          
          {!loading && donors.length > 0 && filteredDonors.length === 0 && (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No Matching Donors</h3>
              <p className="text-slate-600 max-w-md mx-auto">No donors match your search criteria. Try different keywords.</p>
            </div>
          )}
          
          {filteredDonors.map((donor) => {
            const { user, profile, members } = donor;
            const sectionState = expandedSections[user.id] ?? { members: false, registrations: false };
            const registrationGroup =
              registrationIndex.byId.get(user.id) ||
              registrationIndex.byPhone.get(normalizePhone(user.phone_number)) ||
              registrationIndex.byName.get(user.name.trim().toLowerCase());
            const registrations = registrationGroup?.registrations ?? [];

            const profileAddress = [profile.address_line1, profile.address_line2, profile.address_line3]
              .filter(Boolean)
              .join(', ');
            const profileLocation = [profile.city, profile.state, profile.postal_code].filter(Boolean).join(', ');
            const memberCount = Array.isArray(members) ? members.length : 0;
            const locationLabel = profileLocation || 'Location not provided';
            const rawGender = (profile.gender ?? '').trim();
            const genderLabel = rawGender ? `${rawGender.charAt(0).toUpperCase()}${rawGender.slice(1)}` : 'Gender not provided';
            const hasProfileMeta = Boolean(profile.tamil_star || profile.gothra || profile.family_name);

            return (
              <section
                key={user.id}
                className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg"
              >
                {/* Donor Header */}
                <header className="p-6 border-b border-slate-100">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
                        <span className="text-lg font-bold text-green-700">{user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {profile.donor_id && (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                              Donor #{profile.donor_id}
                            </span>
                          )}
                          <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
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
                        
                        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.25v6" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 20.25h4.5" />
                            </svg>
                            {genderLabel}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <div className="flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12m-12 10.5h12M3 6.75l1.5 1.5L6 6.75m0 10.5l-1.5-1.5L3 17.25" />
                        </svg>
                        {registrations.length} registration{registrations.length === 1 ? '' : 's'}
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
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
                  {/* Family Members Section */}
                  <div className="p-6">
                    <button
                      type="button"
                      onClick={() => toggleSection(user.id, 'members')}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M4.5 9.75h15" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 7.5h13.5A1.5 1.5 0 0120.25 9v9a1.5 1.5 0 01-1.5 1.5H5.25A1.5 1.5 0 013.75 18V9a1.5 1.5 0 011.5-1.5z" />
                                    </svg>
                                    DOB: {formatDonorDate(member.date_of_birth)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pooja Registrations Section */}
                  <div className="p-6">
                    <button
                      type="button"
                      onClick={() => toggleSection(user.id, 'registrations')}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                  <th className="whitespace-nowrap px-4 py-3">Pooja Date</th>
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
                                        className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
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

        {/* Admin Members Section */}
        <section className="mt-10 bg-white rounded-2xl shadow-md p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Admin-Added Members</h2>
                <p className="text-slate-600 text-sm">Members created directly through this admin panel</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
              {adminMembers.length} member{adminMembers.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-6">
            {adminMembersLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
              </div>
            ) : adminMembersError ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{adminMembersError}</p>
                  </div>
                </div>
              </div>
            ) : adminMembers.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-1">No Admin Members Yet</h3>
                <p className="text-slate-600 max-w-md mx-auto">Add new members using the "Add Member" button at the top of the page.</p>
              </div>
            ) : (
              <>
                {adminMemberDeleteError && (
                  <div className="mb-4">
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{adminMemberDeleteError}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="divide-y divide-slate-200">
                  {adminMembers.map((member) => {
                    const isEditing = editingAdminMemberId === member.id;
                    const isDeleting = adminMemberDeleteSubmitting && adminMemberDeleteId === member.id;
                    return (
                      <div key={member.id} className="py-5">
                        {isEditing ? (
                          <form onSubmit={handleAdminMemberEditSubmit} className="space-y-5">
                          {adminMemberEditError && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                              <div className="flex">
                                <div className="flex-shrink-0">
                                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm text-red-700">{adminMemberEditError}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`admin-member-name-${member.id}`}>
                                Full Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                id={`admin-member-name-${member.id}`}
                                name="name"
                                type="text"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none transition duration-200"
                                value={adminMemberEditForm.name}
                                onChange={handleAdminMemberEditChange}
                                disabled={adminMemberEditSubmitting || isDeleting}
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`admin-member-dob-${member.id}`}>
                                Date of Birth
                              </label>
                              <input
                                id={`admin-member-dob-${member.id}`}
                                name="date_of_birth"
                                type="date"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none transition duration-200"
                                value={adminMemberEditForm.date_of_birth}
                                onChange={handleAdminMemberEditChange}
                                disabled={adminMemberEditSubmitting || isDeleting}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`admin-member-gender-${member.id}`}>
                                Gender
                              </label>
                              <select
                                id={`admin-member-gender-${member.id}`}
                                name="gender"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none transition duration-200"
                                value={adminMemberEditForm.gender}
                                onChange={handleAdminMemberEditChange}
                                disabled={adminMemberEditSubmitting || isDeleting}
                              >
                                <option value="">Select gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`admin-member-star-${member.id}`}>
                                Tamil Star
                              </label>
                              <input
                                id={`admin-member-star-${member.id}`}
                                name="tamil_star"
                                type="text"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none transition duration-200"
                                value={adminMemberEditForm.tamil_star}
                                onChange={handleAdminMemberEditChange}
                                disabled={adminMemberEditSubmitting || isDeleting}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`admin-member-gothra-${member.id}`}>
                                Gothram
                              </label>
                              <select
                                id={`admin-member-gothra-${member.id}`}
                                name="gothra"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none transition duration-200"
                                value={adminMemberEditForm.gothra}
                                onChange={handleAdminMemberEditChange}
                                disabled={adminMemberEditSubmitting || isDeleting}
                              >
                                <option value="">Select Gothram</option>
                                <option value="Atri">Atri</option>
                                <option value="Bharadvaja">Bharadvaja</option>
                                <option value="Gautama">Gautama</option>
                                <option value="Jamadagni">Jamadagni</option>
                                <option value="Kashyapa">Kashyapa</option>
                                <option value="Vasishta">Vasishta</option>
                                <option value="Vishvamitra">Vishvamitra</option>
                                <option value="Agastya">Agastya</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`admin-member-family-${member.id}`}>
                                Family Name
                              </label>
                              <input
                                id={`admin-member-family-${member.id}`}
                                name="family_name"
                                type="text"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none transition duration-200"
                                value={adminMemberEditForm.family_name}
                                onChange={handleAdminMemberEditChange}
                                disabled={adminMemberEditSubmitting || isDeleting}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`admin-member-relationship-${member.id}`}>
                                Relationship
                              </label>
                              <input
                                id={`admin-member-relationship-${member.id}`}
                                name="relationship"
                                type="text"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none transition duration-200"
                                value={adminMemberEditForm.relationship}
                                onChange={handleAdminMemberEditChange}
                                disabled={adminMemberEditSubmitting || isDeleting}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 pt-2">
                            <button
                              type="submit"
                              className="px-5 py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 shadow-md hover:shadow-lg transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                              disabled={adminMemberEditSubmitting || isDeleting}
                            >
                              {adminMemberEditSubmitting ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving...
                                </span>
                              ) : 'Save Changes'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelAdminMemberEdit}
                              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition duration-200"
                              disabled={adminMemberEditSubmitting || isDeleting}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminMemberDelete(member.id)}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                              disabled={isDeleting || adminMemberEditSubmitting}
                            >
                              {isDeleting ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Deleting...
                                </span>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-4 0a1 1 0 00-1 1v1h6V4a1 1 0 00-1-1m-4 0h4" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 11v6M14 11v6" />
                                  </svg>
                                  Delete
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 flex items-center justify-center">
                              <span className="text-lg font-bold text-sky-700">{member.name.charAt(0)}</span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-800">{member.name}</h3>
                              <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                                <span>Gender: {member.gender || 'N/A'}</span>
                                <span>Star: {member.tamil_star || 'N/A'}</span>
                                <span>Gothram: {member.gothra || 'N/A'}</span>
                                <span>DOB: {formatDonorDate(member.date_of_birth)}</span>
                                <span>Family: {member.family_name || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startAdminMemberEdit(member)}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                              disabled={isDeleting}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminMemberDelete(member.id)}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Deleting...
                                </span>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-4 0a1 1 0 00-1 1v1h6V4a1 1 0 00-1-1m-4 0h4" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 11v6M14 11v6" />
                                  </svg>
                                  Delete
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DonorDetailsPage;
