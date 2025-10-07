import { useEffect, useState } from 'react';

import api from '../../lib/api';

interface RegistrationMember {
  id: number;
  name: string;
  phone_number?: string | null;
  relationship?: string | null;
}

interface RegistrationRecord {
  id: number;
  donor?: number | null;
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

const formatDate = (value?: string | null) => {
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

const DonorPoojaRegistrationsPage = () => {
  const [groups, setGroups] = useState<GroupedRegistrations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      let adminEndpointError = '';
      try {
        const response = await api.get('pooja/registrations/admin-overview/');
        const overview = normalizeAdminOverview(response.data);
        setGroups(overview);
        setLoading(false);
        return;
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

        setGroups(groupRegistrationsByDonor(Array.from(dedupe.values())));
      } catch (err: any) {
        const fallbackDetail = err?.response?.data?.detail ?? err?.message ?? adminEndpointError;
        setError(
          typeof fallbackDetail === 'string' && fallbackDetail
            ? fallbackDetail
            : adminEndpointError || 'Unable to load pooja registrations',
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <p>Loading donor pooja registrations…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-slate-800">Donor Pooja Registrations</h1>
          <p className="text-sm text-slate-600">Track all donor bookings and their associated members.</p>
        </header>
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No pooja registrations found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Donor Pooja Registrations</h1>
        <p className="text-sm text-slate-600">Track all donor bookings and their associated members.</p>
      </header>

      <div className="space-y-4">
        {groups.map((donorGroup) => (
          <section key={donorGroup.groupKey} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{donorGroup.donorName}</h2>
                <p className="text-sm text-slate-600">Phone: {donorGroup.donorPhone || 'N/A'}</p>
                {donorGroup.donorEmail && (
                  <p className="text-sm text-slate-600">Email: {donorGroup.donorEmail}</p>
                )}
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                {donorGroup.registrations.length} registration{donorGroup.registrations.length > 1 ? 's' : ''}
              </span>
            </header>

            <div className="mt-4 space-y-3">
              {donorGroup.registrations.map((registration) => (
                <article key={registration.id} className="rounded-md border border-slate-200 p-3">
                  <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>
                      <span className="font-medium text-slate-700">Pooja:</span>{' '}
                      {registration.pooja_option_name ?? 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">Start Date:</span>{' '}
                      {formatDate(registration.start_date)}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">Quantity:</span>{' '}
                      {registration.quantity ?? 1}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">Amount:</span>{' '}
                      {formatCurrency(registration.total_amount)}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">Schedule:</span>{' '}
                      {registration.day_option_description ?? 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">Post Prasadam:</span>{' '}
                      {registration.post_prasadam ? 'Yes' : 'No'}
                    </p>
                  </div>

                  {registration.additional_notes && (
                    <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-700">Notes:</span> {registration.additional_notes}
                    </p>
                  )}

                  {registration.members && registration.members.length > 0 && (
                    <div className="mt-3">
                      <h3 className="text-sm font-semibold text-slate-700">Members</h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {registration.members.map((member) => (
                          <li key={member.id} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">
                            <span className="font-medium text-slate-700">{member.name}</span>
                            {member.relationship ? ` · ${member.relationship}` : ''}
                            {member.phone_number ? ` · ${member.phone_number}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default DonorPoojaRegistrationsPage;
