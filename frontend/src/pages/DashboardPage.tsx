import { useEffect, useState } from 'react';

import api from '../lib/api';
import { useAuthStore } from '../store/auth';

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
  };
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

const DashboardPage = () => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [summary, setSummary] = useState<RegistrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, registrationsRes] = await Promise.all([
          api.get('/auth/profile/'),
          api.get('/pooja/registrations/summary/'),
        ]);
        setProfile(profileRes.data);
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
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Pooja Registrations</h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">You have {summary?.count ?? 0} active registrations.</p>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2">Registration ID</th>
                {adminView && <th className="px-4 py-2">Donor</th>}
                <th className="px-4 py-2">Pooja</th>
                <th className="px-4 py-2">Start Date</th>
                <th className="px-4 py-2">Group</th>
                <th className="px-4 py-2">Amount</th>
                {adminView && <th className="px-4 py-2">Notes</th>}
              </tr>
            </thead>
            <tbody>
              {summary?.results.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{item.id}</td>
                  {adminView && (
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
                  )}
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
                  {adminView && (
                    <td className="px-4 py-2">
                      {item.additional_notes ? (
                        <span className="whitespace-pre-line text-sm text-slate-600">{item.additional_notes}</span>
                      ) : (
                        <span className="text-xs text-slate-400">No notes</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          {(!summary || summary.results.length === 0) && <p className="p-4 text-sm text-slate-500">No registrations yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
