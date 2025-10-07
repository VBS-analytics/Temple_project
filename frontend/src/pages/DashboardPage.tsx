import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useRegistrationStore } from '../store/registrations';
import type { RegistrationEntry } from '../store/registrations';

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

interface RegistrationItem {
  id: number;
  pooja_option: number;
  pooja_option_name?: string;
  day_option?: number | null;
  day_option_description?: string | null;
  start_date: string | null;
  is_group_registration: boolean;
  total_amount: string | null;
  additional_notes?: string;
  donor?: number;
  donor_name?: string;
  donor_phone?: string;
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
  const [memberForm, setMemberForm] = useState({
    name: '',
    gender: '',
    relationship: '',
    date_of_birth: '',
    tamil_star: '',
    gothra: '',
  });
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const registrations = useRegistrationStore((state) => state.registrationsByUser[cartKey] ?? []);
  const clearAllRegistrations = useRegistrationStore((state) => state.clearAllRegistrations);
  const isAdminUser = user?.role === 'admin';

  const orderedRegistrations = useMemo(() => {
    return [...registrations].sort((a, b) => {
      const first = new Date(a.completedAt).getTime();
      const second = new Date(b.completedAt).getTime();
      return second - first;
    });
  }, [registrations]);

  const groupedRegistrations = useMemo(() => {
    const map = new Map<
      string,
      {
        orderId: string;
        completedAt: string;
        items: RegistrationEntry[];
      }
    >();

    orderedRegistrations.forEach((entry) => {
      const key = entry.orderId || entry.completedAt || entry.registrationId;
      if (!key) {
        return;
      }

      if (!map.has(key)) {
        map.set(key, {
          orderId: key,
          completedAt: entry.completedAt,
          items: [],
        });
      }

      const group = map.get(key);
      if (!group) {
        return;
      }

      group.items.push(entry);

      const entryTime = new Date(entry.completedAt).getTime();
      const groupTime = new Date(group.completedAt).getTime();
      if (entryTime > groupTime) {
        group.completedAt = entry.completedAt;
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
  }, [orderedRegistrations]);

  const totalLocalRegistrations = useMemo(
    () => groupedRegistrations.reduce((count, group) => count + group.items.length, 0),
    [groupedRegistrations],
  );
  useEffect(() => {
    if (!summary) {
      return;
    }

    if (summary.count === 0 && totalLocalRegistrations > 0) {
      clearAllRegistrations();
    }
  }, [summary, totalLocalRegistrations, clearAllRegistrations]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, registrationsRes] = await Promise.all([
          api.get('auth/profile/'),
          api.get('pooja/registrations/summary/'),
        ]);
        setProfile(profileRes.data);
        setMembers(profileRes.data?.members ?? []);
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
        {!isAdminUser && (
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
                      <button
                        type="button"
                        onClick={() => handleEditMember(member)}
                        className="rounded-md border border-brand-600 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      >
                        Edit
                      </button>
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
        )}
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
                  const amountNumber = Number(entry.amount ?? 0);
                  return Number.isNaN(amountNumber) ? sum : sum + amountNumber;
                }, 0);
                const totalAmountLabel = totalAmountValue > 0 ? `₹ ${formatCurrency(totalAmountValue.toString())}` : '--';

                return (
                  <li key={group.orderId} className="rounded-lg border border-slate-200 p-4">
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
                        const amountLabel = registration.amount ? `₹ ${formatCurrency(registration.amount)}` : '--';
                        const dayOptionLabel = registration.dayOptionDescription
                          ? `${registration.dayOptionDescription}${registration.dayOptionCategory ? ` (${DAY_CATEGORY_LABELS[registration.dayOptionCategory] ?? registration.dayOptionCategory})` : ''}`
                          : '--';
                        const memberSummary = registration.members && registration.members.length > 0
                          ? registration.members
                              .map((member) => {
                                const name = member.name || 'Member';
                                const relationship = member.relationship ? ` (${member.relationship})` : '';
                                return `${name}${relationship}`;
                              })
                              .join(', ')
                          : registration.memberRelationship
                            ? `${registration.fullName || 'Member'} (${registration.memberRelationship})`
                            : registration.fullName || '--';

                        return (
                          <li
                            key={registration.registrationId}
                            className="rounded-md border border-slate-200 p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{registration.poojaName}</p>
                                {registration.poojaCode && (
                                  <p className="text-xs uppercase tracking-wide text-slate-500">
                                    Code: {registration.poojaCode}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-sm font-semibold text-slate-900">{amountLabel}</div>
                            </div>
                            <dl className="mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <dt className="font-medium text-slate-700">Day Option</dt>
                                <dd>{dayOptionLabel}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-slate-700">Devotee</dt>
                                <dd>{registration.fullName || '--'}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-slate-700">Members</dt>
                                <dd>{memberSummary}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-slate-700">Notes</dt>
                                <dd>{registration.customDayNote || 'None'}</dd>
                              </div>
                            </dl>
                            {registration.postPrasadam && (
                              <p className="mt-3 text-xs font-medium text-emerald-600">
                                Post prasadam requested
                              </p>
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

        {adminView && (
          <div className="mt-6 overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Donor</th>
                  <th className="px-4 py-2">Pooja</th>
                  <th className="px-4 py-2">Start Date</th>
                  <th className="px-4 py-2">Group</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {summary?.results.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">
                          {item.donor_name || (item.donor_phone ? item.donor_phone : 'Self (admin)')}
                        </span>
                        {item.donor_phone && item.donor_name !== item.donor_phone && (
                          <span className="text-xs text-slate-500">{item.donor_phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span>{item.pooja_option_name ?? `#${item.pooja_option}`}</span>
                        {item.day_option_description && (
                          <span className="text-xs text-slate-500">{item.day_option_description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">{item.start_date ?? 'TBD'}</td>
                    <td className="px-4 py-2">{item.is_group_registration ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">{item.total_amount ?? '--'}</td>
                    <td className="px-4 py-2">
                      {item.additional_notes ? (
                        <span className="whitespace-pre-line text-sm text-slate-600">{item.additional_notes}</span>
                      ) : (
                        <span className="text-xs text-slate-400">No notes</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!summary || summary.results.length === 0) && (
              <p className="p-4 text-sm text-slate-500">No registrations yet.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
