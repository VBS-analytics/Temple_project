import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import api from '../lib/api';
import { useAuthStore } from '../store/auth';

interface FamilyMember {
  id: number;
  name: string;
  gender?: string;
  relationship?: string;
  date_of_birth?: string | null;
  tamil_star?: string;
  gothra?: string;
}

interface ProfileResponse {
  user: {
    name: string;
    phone_number: string;
    role: string;
  };
  profile: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    tamil_star?: string;
    gothra?: string;
    family_name?: string;
  };
  members?: FamilyMember[];
}

interface RegistrationMemberItem {
  id: number;
  name: string;
  relationship?: string | null;
  phone_number?: string | null;
}

interface RegistrationItem {
  id: number;
  pooja_option: number;
  pooja_option_name?: string;
  pooja_option_code?: string | null;
  day_option?: number | null;
  day_option_description?: string | null;
  day_option_category?: string | null;
  start_date: string | null;
  is_group_registration: boolean;
  quantity?: number | null;
  total_amount: string | null;
  additional_notes?: string;
  donor?: number;
  donor_name?: string;
  donor_phone?: string;
  post_prasadam?: boolean;
  status?: 'pending' | 'confirmed' | 'completed';
  members?: RegistrationMemberItem[];
  created_at?: string;
  updated_at?: string;
}

interface RegistrationSummary {
  count: number;
  results: RegistrationItem[];
}

const formatCurrency = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const amountNumber = Number(value);
  if (Number.isNaN(amountNumber)) {
    return value ?? '';
  }
  return amountNumber.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'N/A';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DAY_CATEGORY_LABELS: Record<string, string> = {
  weekday: 'English Day',
  tamil_star: 'Tamil Star',
  code: 'Template Code',
};

const STATUS_LABELS: Record<'pending' | 'confirmed' | 'completed', string> = {
  pending: 'Pending',
  confirmed: 'Pooja Confirmed',
  completed: 'Pooja Completed',
};

const STATUS_BADGE_CLASSES: Record<'pending' | 'confirmed' | 'completed', string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const resolveStatusKey = (status?: string | null): 'pending' | 'confirmed' | 'completed' => {
  if (status === 'confirmed' || status === 'completed') {
    return status;
  }
  return 'pending';
};

const formatDate = (dateValue?: string | null) => {
  if (!dateValue) {
    return 'N/A';
  }
  const parts = dateValue.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (day && month && year) {
      return `${day}-${month}-${year}`;
    }
  }
  return dateValue;
};

const DashboardPage = () => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [summary, setSummary] = useState<RegistrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [memberFormVisible, setMemberFormVisible] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [memberError, setMemberError] = useState('');
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    gender: '',
    relationship: '',
    date_of_birth: '',
    tamil_star: '',
    gothra: '',
  });

  const user = useAuthStore((state) => state.user);

  const groupedRegistrations = useMemo(() => {
    if (!summary?.results || summary.results.length === 0) {
      return [];
    }

    const map = new Map<
      string,
      {
        groupId: string;
        completedAt: string;
        items: RegistrationItem[];
      }
    >();

    summary.results.forEach((registration) => {
      const createdAt = registration.created_at ?? registration.updated_at ?? '';
      const createdDate = createdAt ? new Date(createdAt) : null;
      const minuteBucket =
        createdDate && !Number.isNaN(createdDate.getTime())
          ? Math.floor(createdDate.getTime() / 60000).toString()
          : `registration-${registration.id}`;
      const donorKey = registration.donor ?? 'self';
      const groupKey = `${donorKey}-${minuteBucket}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupId: groupKey,
          completedAt: createdAt || registration.updated_at || '',
          items: [],
        });
      }

      const group = map.get(groupKey);
      if (!group) {
        return;
      }

      group.items.push(registration);

      if (createdDate && !Number.isNaN(createdDate.getTime())) {
        const groupDate = group.completedAt ? new Date(group.completedAt) : null;
        if (!groupDate || Number.isNaN(groupDate.getTime()) || groupDate.getTime() < createdDate.getTime()) {
          group.completedAt = createdAt;
        }
      }
    });

    const groups = Array.from(map.values()).map((group) => {
      const fallbackTimestamp =
        group.completedAt || group.items[0]?.created_at || group.items[0]?.updated_at || new Date().toISOString();
      const sortedItems = [...group.items].sort((a, b) => {
        const first = new Date(a.created_at ?? a.updated_at ?? fallbackTimestamp).getTime();
        const second = new Date(b.created_at ?? b.updated_at ?? fallbackTimestamp).getTime();
        return second - first;
      });
      return {
        groupId: group.groupId,
        completedAt: fallbackTimestamp,
        items: sortedItems,
      };
    });

    return groups.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
  }, [summary]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, memberRes, registrationsRes] = await Promise.all([
          api.get('auth/profile/'),
          api.get('auth/family-members/'),
          api.get('pooja/registrations/summary/'),
        ]);
        setProfile(profileRes.data);
        const memberList = Array.isArray(memberRes.data)
          ? (memberRes.data as FamilyMember[])
          : profileRes.data?.members ?? [];
        setMembers(memberList);
        setSummary(registrationsRes.data);
      } catch (err: any) {
        const detail = err?.response?.data?.detail ?? 'Unable to load dashboard data';
        setError(detail);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <p>Loading dashboard…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  const adminView = user?.role === 'admin';

  const handleMemberChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetMemberForm = () => {
    setMemberForm({
      name: '',
      gender: '',
      relationship: '',
      date_of_birth: '',
      tamil_star: '',
      gothra: '',
    });
  };

  const startCreateFlow = () => {
    setMemberFormVisible(true);
    setEditingMemberId(null);
    resetMemberForm();
    setMemberError('');
  };

  const handleEditMember = (member: FamilyMember) => {
    setMemberFormVisible(true);
    setEditingMemberId(member.id);
    setMemberError('');
    setMemberForm({
      name: member.name ?? '',
      gender: member.gender ?? '',
      relationship: member.relationship ?? '',
      date_of_birth: member.date_of_birth ?? '',
      tamil_star: member.tamil_star ?? '',
      gothra: member.gothra ?? '',
    });
  };

  const handleDeleteMember = async (memberId: number, memberName?: string) => {
    setMemberError('');
    const sure = window.confirm(`Delete ${memberName || 'this family member'}?`);
    if (!sure) return;

    try {
      setDeletingId(memberId);
      await api.delete(`auth/family-members/${memberId}/`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));

      // if the currently edited member is deleted, reset the form
      if (editingMemberId === memberId) {
        setEditingMemberId(null);
        resetMemberForm();
        setMemberFormVisible(false);
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data ??
        err?.message ??
        'Unable to delete member';
      setMemberError(typeof detail === 'string' ? detail : 'Unable to delete member');
    } finally {
      setDeletingId(null);
    }
  };

  const handleMemberSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMemberError('');

    if (!memberForm.name.trim()) {
      setMemberError('Name is required.');
      return;
    }

    if (!memberForm.relationship.trim()) {
      setMemberError('Relationship is required.');
      return;
    }

    const payload: Record<string, string> = {
      name: memberForm.name.trim(),
      relationship: memberForm.relationship.trim(),
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

    try {
      setMemberSubmitting(true);

      if (editingMemberId !== null) {
        const { data } = await api.put(`auth/family-members/${editingMemberId}/`, payload);
        setMembers((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      } else {
        const { data } = await api.post('auth/family-members/', payload);
        setMembers((prev) => [...prev, data]);
      }

      resetMemberForm();
      setMemberFormVisible(false);
      setEditingMemberId(null);
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message ?? 'Unable to add member';
      setMemberError(typeof detail === 'string' ? detail : 'Unable to add member');
    } finally {
      setMemberSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Welcome back, {user?.name}</h2>
        <p className="mt-2 text-sm text-slate-600">Mobile: {profile?.user.phone_number}</p>
        <p className="text-sm text-slate-600">Role: {profile?.user.role}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-slate-700">Address</h3>
            <p className="text-sm text-slate-600">
              {[profile?.profile.address_line1, profile?.profile.address_line2, profile?.profile.city]
                .filter(Boolean)
                .join(', ')}
            </p>
            <p className="text-sm text-slate-600">
              {[profile?.profile.state, profile?.profile.postal_code].filter(Boolean).join(' ')}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700">Spiritual Profile</h3>
            <p className="text-sm text-slate-600">Tamil Star: {profile?.profile.tamil_star || 'N/A'}</p>
            <p className="text-sm text-slate-600">Gothra: {profile?.profile.gothra || 'N/A'}</p>
            <p className="text-sm text-slate-600">Family: {profile?.profile.family_name || 'N/A'}</p>
          </div>
        </div>
        <div className="mt-6 rounded-md border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">Family Members</h3>
            <button
              type="button"
              onClick={() => {
                if (memberFormVisible && editingMemberId === null) {
                  setMemberFormVisible(false);
                  resetMemberForm();
                  setMemberError('');
                } else {
                  startCreateFlow();
                }
              }}
              className="rounded-md bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700"
            >
              {memberFormVisible && editingMemberId === null ? 'Cancel' : 'Add member'}
            </button>
          </div>

          {members.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No members added yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {members.map((member) => (
                <li key={member.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 md:text-sm">
                      <span>
                        Name: <span className="font-semibold text-slate-800">{member.name || 'N/A'}</span>
                      </span>
                      <span>Relationship: {member.relationship || 'N/A'}</span>
                      <span>Gender: {member.gender || 'N/A'}</span>
                      <span>Date of Birth: {formatDate(member.date_of_birth)}</span>
                      <span>Star: {member.tamil_star || 'N/A'}</span>
                      <span>Gothram: {member.gothra || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditMember(member)}
                        className="rounded-md border border-brand-600 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member.id, member.name)}
                        disabled={deletingId === member.id}
                        className="rounded-md border border-red-600 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                        title="Delete this member"
                      >
                        {deletingId === member.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {memberFormVisible && (
            <form onSubmit={handleMemberSubmit} className="mt-4 space-y-3">
              {memberError && <p className="rounded-md bg-red-100 p-2 text-sm text-red-700">{memberError}</p>}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="member-name">
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
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="member-gender">
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
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="member-relationship">
                    Relationship
                  </label>
                  <input
                    id="member-relationship"
                    name="relationship"
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={memberForm.relationship}
                    onChange={handleMemberChange}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="member-dob">
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
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="member-star">
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
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="member-gothra">
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
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMemberFormVisible(false);
                    setEditingMemberId(null);
                    resetMemberForm();
                    setMemberError('');
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={memberSubmitting}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {memberSubmitting ? 'Saving…' : editingMemberId !== null ? 'Update member' : 'Save member'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Pooja Registrations</h2>
        </div>

        {groupedRegistrations.length > 0 && (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Recent Registrations</h3>
            <ul className="space-y-4">
              {groupedRegistrations.map((group) => {
                const totalAmountValue = group.items.reduce((sum, entry) => {
                  const amountNumber = Number(entry.total_amount ?? 0);
                  return Number.isNaN(amountNumber) ? sum : sum + amountNumber;
                }, 0);
                const totalAmountLabel = totalAmountValue > 0 ? `₹ ${formatCurrency(totalAmountValue.toString())}` : '--';

                return (
                  <li key={group.groupId} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {group.items.length} booking{group.items.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-slate-500">Completed on {formatDateTime(group.completedAt)}</p>
                      </div>
                      <div className="text-right text-sm font-semibold text-slate-900">{totalAmountLabel}</div>
                    </div>
                    <ul className="mt-3 space-y-3">
                      {group.items.map((registration) => {
                        const amountLabel = registration.total_amount
                          ? `₹ ${formatCurrency(registration.total_amount)}`
                          : '--';
                        const dayOptionCategoryLabel = registration.day_option_category
                          ? DAY_CATEGORY_LABELS[registration.day_option_category] ?? registration.day_option_category
                          : null;
                        const combinedDayOption = registration.day_option_description
                          ? `${registration.day_option_description}${
                              dayOptionCategoryLabel ? ` (${dayOptionCategoryLabel})` : ''
                            }`
                          : '--';
                        const memberSummary =
                          registration.members && registration.members.length > 0
                            ? registration.members
                                .map((member) => {
                                  const relationship = member.relationship ? ` (${member.relationship})` : '';
                                  const name = member.name || 'Member';
                                  return `${name}${relationship}`;
                                })
                                .join(', ')
                            : '—';
                        const statusKey = resolveStatusKey(registration.status);
                        const statusLabel = STATUS_LABELS[statusKey];
                        const statusClasses = STATUS_BADGE_CLASSES[statusKey];

                        return (
                          <li key={registration.id} className="rounded-md border border-slate-200 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {registration.pooja_option_name ?? 'Pooja'}
                                </p>
                                {registration.pooja_option_code && (
                                  <p className="text-xs uppercase tracking-wide text-slate-500">
                                    Code: {registration.pooja_option_code}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-sm font-semibold text-slate-900">{amountLabel}</div>
                            </div>

                            <div className="mt-3">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Status
                              </span>
                              <div className="mt-1">
                                <span
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusClasses}`}
                                >
                                  {statusLabel}
                                </span>
                              </div>
                            </div>

                            <dl className="mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <dt className="font-medium text-slate-700">Day Option</dt>
                                <dd>{combinedDayOption}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-slate-700">Devotee</dt>
                                <dd>{registration.donor_name || user?.name || '--'}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-slate-700">Members</dt>
                                <dd>{memberSummary}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-slate-700">Notes</dt>
                                <dd>{registration.additional_notes?.trim() || 'None'}</dd>
                              </div>
                            </dl>

                            {registration.post_prasadam && (
                              <p className="mt-3 text-xs font-medium text-emerald-600">Post prasadam requested</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

      </section>
    </div>
  );
};

export default DashboardPage;
