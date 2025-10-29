import axios from 'axios';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';

import api, { extractResults } from '../lib/api';

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
  gender?: string | null;
  date_of_birth?: string | null;
  family_name?: string | null;
  notes?: string | null;
}

interface FamilyMember {
  id: number;
  name: string;
  gender?: string | null;
  relationship?: string | null;
  date_of_birth?: string | null;
  tamil_star?: string | null;
  gothra?: string | null;
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
  family_name: string;
  // family_selection holds either one of the predefined family names or the special value 'Other' or ''
  family_selection: string;
}

interface RegistrationMember {
  id?: number;
  name?: string | null;
  relationship?: string | null;
}

interface PoojaRegistration {
  id: number;
  pooja_reg_id?: string | null;
  pooja_option_name?: string | null;
  start_date?: string | null;
  day_option_description?: string | null;
  post_prasadam?: boolean | null;
  created_at?: string | null;
  members?: RegistrationMember[];
}

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

const sortMembers = (list: FamilyMember[]) =>
  [...list].sort((a, b) => {
    const left = (a.name || '').toLowerCase();
    const right = (b.name || '').toLowerCase();
    return left.localeCompare(right);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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

const DonorProfile = () => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [profile, setProfile] = useState<ApiDonorProfile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [registrations, setRegistrations] = useState<PoojaRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    family_name: (profileData?.family_name ?? '').trim(),
    family_selection: (() => {
      const family = (profileData?.family_name ?? '').trim();
      if (!family) return '';
      // if profile family matches one of the predefined options (case-sensitive match), use it, else treat as 'Other'
      return FAMILY_OPTIONS.includes(family) ? family : 'Other';
    })(),
  });

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FamilyMemberFormState>(() => createInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const response = await api.get<ProfileResponse>('auth/profile/');
        if (!active) {
          return;
        }
        setUser(response.data.user);
        setProfile(response.data.profile);
        setMembers(sortMembers(response.data.members ?? []));
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(extractErrorMessage(err));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const loadRegistrations = async () => {
      setRegistrationsLoading(true);
      setRegistrationsError(null);
      try {
        const response = await api.get('pooja/registrations/', { params: { page_size: 200 } });
        if (!active) {
          return;
        }
        setRegistrations(extractResults<PoojaRegistration>(response.data));
      } catch (err) {
        if (!active) {
          return;
        }
        setRegistrations([]);
        setRegistrationsError(extractErrorMessage(err));
      } finally {
        if (active) {
          setRegistrationsLoading(false);
        }
      }
    };

    loadProfile();
    loadRegistrations();
    return () => {
      active = false;
    };
  }, []);

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
        family_name: formData.family_name.trim(),
      };

      if (editingMemberId) {
        // Update existing member
        const response = await api.put<FamilyMember>(`auth/family-members/${editingMemberId}/`, payload);
        setMembers((prev) => sortMembers(prev.map(m => m.id === editingMemberId ? response.data : m)));
        setEditingMemberId(null);
      } else {
        // Create new member
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

  return (
    <div className="container max-w-[1800px] mx-auto px-2 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Donor Profile</h1>
        <p className="text-sm text-slate-500">Review your donor details and manage your family members.</p>
      </div>

      {loading ? (
        <div className="mt-10 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading profile...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm w-full overflow-x-auto mx-2">
            <h2 className="text-lg font-semibold text-slate-800">Donor Details</h2>
            <div className="mt-6">
              <table className="w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Donor ID</th>
                    <th className="px-4 py-3 font-semibold">Family Name</th>
                    <th className="px-4 py-3 font-semibold">Donor Name</th>
                    <th className="px-4 py-3 font-semibold">Gender</th>
                    <th className="px-4 py-3 font-semibold">Date of Birth</th>
                    <th className="px-4 py-3 font-semibold">Gothra</th>
                    <th className="px-4 py-3 font-semibold">Tamil Star</th>
                    <th className="px-4 py-3 font-semibold">Phone No</th>
                    <th className="px-4 py-3 font-semibold">Address</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{resolveText(profile?.donor_id ?? '')}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveText(profile?.family_name)}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveText(user?.name ?? '')}</td>
                    <td className="px-4 py-3 text-slate-700">{formatGender(profile?.gender)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(profile?.date_of_birth)}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveText(profile?.gothra)}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveText(profile?.tamil_star)}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveText(user?.phone_number ?? '')}</td>
                    <td className="px-4 py-3 text-slate-700">{profileAddress()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm w-full overflow-x-auto mx-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Family Members</h2>
                <p className="text-sm text-slate-500">Keep your family list current for Pooja registrations.</p>
              </div>
              <button
                type="button"
                onClick={startAddingNew}
                className="inline-flex items-center justify-center rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                + Add Member
              </button>
            </div>

            {members.length === 0 && !isAddingNew ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No family members added yet. Click &quot;Add Member&quot; to include your family details.
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Relationship</th>
                      <th className="px-4 py-3 font-semibold">Gender</th>
                      <th className="px-4 py-3 font-semibold">Date of Birth</th>
                      <th className="px-4 py-3 font-semibold">Tamil Star</th>
                      <th className="px-4 py-3 font-semibold">Gothra</th>
                      <th className="px-4 py-3 font-semibold">Family Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isAddingNew && (
                      <tr>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={formData.name}
                            onChange={handleInputChange('name')}
                            placeholder="Enter full name"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={formData.relationship}
                            onChange={handleInputChange('relationship')}
                            placeholder="e.g., Son, Daughter"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={formData.gender}
                            onChange={handleInputChange('gender')}
                          >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={formData.date_of_birth}
                            onChange={handleInputChange('date_of_birth')}
                            placeholder="mm/dd/yyyy"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={formData.tamil_star}
                            onChange={handleInputChange('tamil_star')}
                            placeholder="Enter Tamil star"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={formData.gothra}
                            onChange={handleInputChange('gothra')}
                            placeholder="Enter gothra"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-full">
                              <label className="sr-only">Family</label>
                              <select
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
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
                            <button
                              type="button"
                              onClick={cancelAddingNew}
                              className="whitespace-nowrap rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                              disabled={submitting}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmit}
                              className="whitespace-nowrap rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-500"
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
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.name}
                                onChange={handleInputChange('name')}
                                placeholder="Enter full name"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.relationship}
                                onChange={handleInputChange('relationship')}
                                placeholder="e.g., Son, Daughter"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.gender}
                                onChange={handleInputChange('gender')}
                              >
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="date"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.date_of_birth}
                                onChange={handleInputChange('date_of_birth')}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.tamil_star}
                                onChange={handleInputChange('tamil_star')}
                                placeholder="Enter Tamil star"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                value={formData.gothra}
                                onChange={handleInputChange('gothra')}
                                placeholder="Enter gothra"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-full">
                                  <label className="sr-only">Family</label>
                                  <select
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
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
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  className="whitespace-nowrap rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                                  disabled={submitting}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSubmit}
                                  className="whitespace-nowrap rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-500"
                                  disabled={submitting}
                                >
                                  {submitting ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-slate-700">{resolveText(member.name)}</td>
                            <td className="px-4 py-3 text-slate-600">{resolveText(member.relationship)}</td>
                            <td className="px-4 py-3 text-slate-600">{resolveText(member.gender)}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(member.date_of_birth)}</td>
                            <td className="px-4 py-3 text-slate-600">{resolveText(member.tamil_star)}</td>
                            <td className="px-4 py-3 text-slate-600">{resolveText(member.gothra)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-600">
                                  {resolveText(member.family_name ?? profile?.family_name ?? '')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => startEditing(member)}
                                  className="ml-2 rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm w-full overflow-x-auto mx-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Registered Pooja&apos;s</h2>
                <p className="text-sm text-slate-500">Review all pooja registrations linked to your account.</p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600">
                {registrations.length} {registrations.length === 1 ? 'Registration' : 'Registrations'}
              </span>
            </div>

            {registrationsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                Loading pooja registrations...
              </div>
            ) : registrationsError ? (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {registrationsError}
              </div>
            ) : registrations.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No pooja registrations found for your account.
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Pooja ID</th>
                      <th className="px-4 py-3 font-semibold">Pooja Name</th>
                      <th className="px-4 py-3 font-semibold">Pooja Date</th>
                      <th className="px-4 py-3 font-semibold">Day Option</th>
                      <th className="px-4 py-3 font-semibold">Devotees</th>
                      <th className="px-4 py-3 font-semibold">Post Prasadam</th>
                      <th className="px-4 py-3 font-semibold">Registered On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registrations.map((registration, index) => (
                      <tr key={registration.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-indigo-700">
                          {resolvePoojaId(registration)}
                        </td>
                        <td className="px-4 py-3 text-slate-700" title={registration.pooja_option_name ?? undefined}>
                          {registration.pooja_option_name?.trim() || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(registration.start_date)}
                        </td>
                        <td className="px-4 py-3 text-slate-700" title={registration.day_option_description ?? undefined}>
                          {registration.day_option_description?.trim() || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatMemberNames(registration.members)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              registration.post_prasadam ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {registration.post_prasadam ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDateTime(registration.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}


    </div>
  );
};

export default DonorProfile;
