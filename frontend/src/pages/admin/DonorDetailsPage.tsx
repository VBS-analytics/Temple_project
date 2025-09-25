import { useEffect, useState } from 'react';

import api from '../../lib/api';

interface DonorProfile {
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
}

interface DonorRecord {
  user: DonorUser;
  profile: DonorProfile;
  members: DonorMember[];
}

const formatDate = (value?: string | null) => {
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

const DonorDetailsPage = () => {
  const [donors, setDonors] = useState<DonorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('auth/donors/');
        setDonors(data);
        const nextExpanded: Record<number, boolean> = {};
        data.forEach((donor: DonorRecord) => {
          nextExpanded[donor.user.id] = false;
        });
        setExpanded(nextExpanded);
      } catch (err: any) {
        const detail = err?.response?.data?.detail ?? err?.message ?? 'Unable to load donor details';
        setError(typeof detail === 'string' ? detail : 'Unable to load donor details');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <p>Loading donor details…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (donors.length === 0) {
    return <p>No donors found.</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Donor Details</h1>
        <p className="text-sm text-slate-600">Overview of registered donors and their associated family members.</p>
      </header>

      <div className="space-y-4">
        {donors.map((donor) => {
          const { user, profile, members } = donor;
          const address = [profile.address_line1, profile.address_line2, profile.address_line3]
            .filter(Boolean)
            .join(', ');
          const location = [profile.city, profile.state, profile.postal_code].filter(Boolean).join(', ');
          const showMembers = expanded[user.id];

          return (
            <section key={user.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{user.name}</h2>
                  <p className="text-sm text-slate-600">Phone: {user.phone_number}</p>
                  {user.email && <p className="text-sm text-slate-600">Email: {user.email}</p>}
                </div>
                <div className="text-sm text-slate-600">
                  <p>Family: {profile.family_name || 'N/A'}</p>
                  <p>Tamil Star: {profile.tamil_star || 'N/A'}</p>
                  <p>Gothram: {profile.gothra || 'N/A'}</p>
                </div>
              </div>

              {(address || location) && (
                <div className="mt-3 text-sm text-slate-600">
                  {address && <p>Address: {address}</p>}
                  {location && <p>Location: {location}</p>}
                </div>
              )}

              {profile.date_of_birth && (
                <p className="mt-2 text-sm text-slate-600">DOB: {formatDate(profile.date_of_birth)}</p>
              )}

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-700">Family Members</h3>
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [user.id]: !prev[user.id] }))}
                    className="rounded-md border border-brand-600 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                  >
                    {showMembers ? 'Hide' : 'Family Members'}
                  </button>
                </div>
                {showMembers && (
                  members.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No family members recorded.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {members.map((member) => (
                        <li key={member.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                          <div className="flex flex-wrap gap-4">
                            <span>
                              Name: <span className="font-medium text-slate-800">{member.name}</span>
                            </span>
                            <span>Relationship: {member.relationship || 'N/A'}</span>
                            <span>Gender: {member.gender || 'N/A'}</span>
                            <span>Star: {member.tamil_star || 'N/A'}</span>
                            <span>Gothram: {member.gothra || 'N/A'}</span>
                            <span>DOB: {formatDate(member.date_of_birth)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default DonorDetailsPage;
