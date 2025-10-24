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
  status?: 'pending' | 'confirmed' | 'completed';
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
    family_name: ''
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
      family_name: ''
    });
  };

  const handleMemberChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
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
    if (memberForm.family_name.trim()) {
      payload.family_name = memberForm.family_name.trim();
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

  if (loading) {
    return <p>Loading donor details…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Donor Details</h1>
            <p className="text-sm text-slate-600">
              Overview of registered donors, their family members, and pooja registrations.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search donors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-md border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
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
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {memberFormVisible ? 'Cancel' : 'Add member'}
            </button>
          </div>
        </div>

        {memberFormVisible && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              {memberError && <p className="rounded-md bg-red-100 p-2 text-sm text-red-700">{memberError}</p>}
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="member-name">
                    Name
                  </label>
                  <input
                    id="member-name"
                    name="name"
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={memberForm.name}
                    onChange={handleMemberChange}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="member-dob">
                    Date of Birth
                  </label>
                  <input
                    id="member-dob"
                    name="date_of_birth"
                    type="date"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={memberForm.date_of_birth}
                    onChange={handleMemberChange}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="member-gender">
                    Gender
                  </label>
                  <select
                    id="member-gender"
                    name="gender"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="member-star">
                    Star
                  </label>
                  <input
                    id="member-star"
                    name="tamil_star"
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={memberForm.tamil_star}
                    onChange={handleMemberChange}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="member-gothra">
                    Gothram
                  </label>
                  <input
                    id="member-gothra"
                    name="gothra"
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={memberForm.gothra}
                    onChange={handleMemberChange}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="member-family">
                    Family Name
                  </label>
                  <input
                    id="member-family"
                    name="family_name"
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={memberForm.family_name}
                    onChange={handleMemberChange}
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={memberSubmitting}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {memberSubmitting ? 'Adding member…' : 'Add member'}
                </button>
              </div>
            </form>
          </div>
        )}
      </header>

      <div className="space-y-4">
        {!loading && donors.length === 0 && (
          <p className="text-sm text-slate-500">No donors found.</p>
        )}
        {!loading && donors.length > 0 && filteredDonors.length === 0 && (
          <p className="text-sm text-slate-500">No donors found matching your search.</p>
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

          return (
            <section key={user.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <header className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {profile.donor_id && (
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        {profile.donor_id}
                      </span>
                    )}
                    <h2 className="text-lg font-semibold text-slate-800">
                      {user.name}
                      {profile.family_name && (
                        <span className="ml-2 text-sm font-normal text-slate-600">
                          (Family Name: {profile.family_name})
                        </span>
                      )}
                    </h2>
                  </div>
                  <p className="text-sm text-slate-600">Phone: {user.phone_number}</p>
                  {user.email && <p className="text-sm text-slate-600">Email: {user.email}</p>}
                </div>
                <span className="self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {registrations.length} registration{registrations.length === 1 ? '' : 's'}
                </span>
              </header>

              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSection(user.id, 'members')}
                    className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>Profile &amp; Family Details</span>
                    <span className="text-xs text-slate-500">{sectionState.members ? 'Hide' : 'Show'}</span>
                  </button>

                  {sectionState.members && (
                    <div className="space-y-3 px-4 py-3 text-sm text-slate-600">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <tbody>
                            <tr className="text-sm text-slate-600">
                              <td className="whitespace-nowrap px-3 py-2">
                                <span className="font-medium text-slate-700">DOB:</span>{' '}
                                {formatDonorDate(profile.date_of_birth)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <span className="font-medium text-slate-700">Tamil Star:</span>{' '}
                                {profile.tamil_star || 'N/A'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <span className="font-medium text-slate-700">Gothram:</span>{' '}
                                {profile.gothra || 'N/A'}
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-medium text-slate-700">Address:</span>{' '}
                                {profileAddress || 'N/A'}
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-medium text-slate-700">Location:</span>{' '}
                                {profileLocation || 'N/A'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-700">Family Members</h3>
                        {members.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">No family members recorded.</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {members.map((member) => (
                              <li
                                key={member.id}
                                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600"
                              >
                                <div className="flex flex-wrap gap-4">
                                  <span>
                                    Name:{' '}
                                    <span className="font-medium text-slate-800">{member.name}</span>
                                  </span>
                                  <span>Relationship: {member.relationship || 'N/A'}</span>
                                  <span>Gender: {member.gender || 'N/A'}</span>
                                  <span>Star: {member.tamil_star || 'N/A'}</span>
                                  <span>Gothram: {member.gothra || 'N/A'}</span>
                                  <span>Family Name: {member.family_name || 'N/A'}</span>
                                  <span>DOB: {formatDonorDate(member.date_of_birth)}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSection(user.id, 'registrations')}
                    className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>Pooja Registrations</span>
                    <span className="text-xs text-slate-500">{sectionState.registrations ? 'Hide' : 'Show'}</span>
                  </button>

                  {sectionState.registrations && (
                    <div className="px-4 py-3">
                      {registrations.length === 0 ? (
                        <p className="text-sm text-slate-500">No pooja registrations recorded.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead>
                              <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                <th className="whitespace-nowrap px-3 py-2">Registration ID</th>
                                <th className="whitespace-nowrap px-3 py-2">Pooja Date</th>
                                <th className="whitespace-nowrap px-3 py-2">Pooja Name</th>
                                <th className="whitespace-nowrap px-3 py-2">Pooja Day</th>
                                <th className="whitespace-nowrap px-3 py-2">Member - Devotee</th>
                                <th className="whitespace-nowrap px-3 py-2">Amount</th>
                                <th className="whitespace-nowrap px-3 py-2">Post Prasadam</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {registrations.map((registration) => (
                                <tr key={registration.id} className="text-sm text-slate-600">
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {registration.pooja_reg_id || 'N/A'}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {formatRegistrationDate(registration.start_date)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {registration.pooja_option_name || 'N/A'}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {registration.day_option_description || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {registration.members?.map((member) => (
                                        <span
                                          key={member.id}
                                          className="inline-block rounded bg-slate-100 px-2 py-1 text-xs"
                                        >
                                          {member.name}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {formatCurrency(registration.total_amount)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {registration.post_prasadam ? 'Yes' : 'No'}
                                  </td>
                                </tr>
                              ))}
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

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Added Members from Admin</h2>
            <p className="text-sm text-slate-600">Members created directly through this admin panel.</p>
          </div>
          <span className="self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {adminMembers.length} member{adminMembers.length === 1 ? '' : 's'}
          </span>
        </header>

        <div className="mt-4">
          {adminMembersLoading ? (
            <p className="text-sm text-slate-500">Loading admin members…</p>
          ) : adminMembersError ? (
            <p className="text-sm text-red-600">{adminMembersError}</p>
          ) : adminMembers.length === 0 ? (
            <p className="text-sm text-slate-500">No members have been added from the admin panel yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {adminMembers.map((member) => {
                const isEditing = editingAdminMemberId === member.id;
                return (
                  <li key={member.id} className="py-3 text-sm text-slate-600">
                    {isEditing ? (
                      <form onSubmit={handleAdminMemberEditSubmit} className="space-y-3">
                        {adminMemberEditError && (
                          <p className="rounded-md bg-red-100 p-2 text-sm text-red-700">
                            {adminMemberEditError}
                          </p>
                        )}

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div>
                            <label
                              className="mb-1 block text-sm font-medium text-slate-600"
                              htmlFor={`admin-member-name-${member.id}`}
                            >
                              Name
                            </label>
                            <input
                              id={`admin-member-name-${member.id}`}
                              name="name"
                              type="text"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={adminMemberEditForm.name}
                              onChange={handleAdminMemberEditChange}
                              disabled={adminMemberEditSubmitting}
                              required
                            />
                          </div>

                          <div>
                            <label
                              className="mb-1 block text-sm font-medium text-slate-600"
                              htmlFor={`admin-member-dob-${member.id}`}
                            >
                              Date of Birth
                            </label>
                            <input
                              id={`admin-member-dob-${member.id}`}
                              name="date_of_birth"
                              type="date"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={adminMemberEditForm.date_of_birth}
                              onChange={handleAdminMemberEditChange}
                              disabled={adminMemberEditSubmitting}
                            />
                          </div>

                          <div>
                            <label
                              className="mb-1 block text-sm font-medium text-slate-600"
                              htmlFor={`admin-member-gender-${member.id}`}
                            >
                              Gender
                            </label>
                            <select
                              id={`admin-member-gender-${member.id}`}
                              name="gender"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={adminMemberEditForm.gender}
                              onChange={handleAdminMemberEditChange}
                              disabled={adminMemberEditSubmitting}
                            >
                              <option value="">Select gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div>
                            <label
                              className="mb-1 block text-sm font-medium text-slate-600"
                              htmlFor={`admin-member-star-${member.id}`}
                            >
                              Star
                            </label>
                            <input
                              id={`admin-member-star-${member.id}`}
                              name="tamil_star"
                              type="text"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={adminMemberEditForm.tamil_star}
                              onChange={handleAdminMemberEditChange}
                              disabled={adminMemberEditSubmitting}
                            />
                          </div>

                          <div>
                            <label
                              className="mb-1 block text-sm font-medium text-slate-600"
                              htmlFor={`admin-member-gothra-${member.id}`}
                            >
                              Gothram
                            </label>
                            <input
                              id={`admin-member-gothra-${member.id}`}
                              name="gothra"
                              type="text"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={adminMemberEditForm.gothra}
                              onChange={handleAdminMemberEditChange}
                              disabled={adminMemberEditSubmitting}
                            />
                          </div>

                          <div>
                            <label
                              className="mb-1 block text-sm font-medium text-slate-600"
                              htmlFor={`admin-member-family-${member.id}`}
                            >
                              Family Name
                            </label>
                            <input
                              id={`admin-member-family-${member.id}`}
                              name="family_name"
                              type="text"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={adminMemberEditForm.family_name}
                              onChange={handleAdminMemberEditChange}
                              disabled={adminMemberEditSubmitting}
                            />
                          </div>

                          <div>
                            <label
                              className="mb-1 block text-sm font-medium text-slate-600"
                              htmlFor={`admin-member-relationship-${member.id}`}
                            >
                              Relationship
                            </label>
                            <input
                              id={`admin-member-relationship-${member.id}`}
                              name="relationship"
                              type="text"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              value={adminMemberEditForm.relationship}
                              onChange={handleAdminMemberEditChange}
                              disabled={adminMemberEditSubmitting}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="submit"
                            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                            disabled={adminMemberEditSubmitting}
                          >
                            {adminMemberEditSubmitting ? 'Saving changes…' : 'Save changes'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelAdminMemberEdit}
                            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            disabled={adminMemberEditSubmitting}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-4">
                          <span>
                            Name: <span className="font-medium text-slate-800">{member.name}</span>
                          </span>
                          <span>Gender: {member.gender || 'N/A'}</span>
                          <span>Star: {member.tamil_star || 'N/A'}</span>
                          <span>Gothram: {member.gothra || 'N/A'}</span>
                          <span>DOB: {formatDonorDate(member.date_of_birth)}</span>
                          <span>Family Name: {member.family_name || 'N/A'}</span>
                          <span>Relationship: {member.relationship || 'N/A'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => startAdminMemberEdit(member)}
                          className="text-sm font-medium text-brand-600 hover:text-brand-700"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

export default DonorDetailsPage;
