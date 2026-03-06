import { useEffect, useMemo, useState } from 'react';

import api from '../../lib/api';

interface DonorPoojaProfile {
  donor_id?: string | null;
  notes?: string | null;
  gothra?: string | null;
  rasi?: string | null;
  tamil_star?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

interface DonorPoojaMember {
  id?: number;
  name?: string | null;
}

interface DonorPoojaRecord {
  user: {
    id: number;
    name?: string | null;
  };
  profile?: DonorPoojaProfile;
  members?: DonorPoojaMember[];
}

interface DonorPoojaDetailRow {
  id: number;
  donorId: string;
  donorName: string;
  donorHeaderText: string;
  gothram: string;
  rasi: string;
  tamilStar: string;
  familyMembers: string;
  address: string;
}

const EMPTY_VALUE = '—';

const normalizeOptionalText = (value?: string | null) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed.toLowerCase();
  if (
    normalized === 'null' ||
    normalized === 'none' ||
    normalized === 'na' ||
    normalized === 'n/a' ||
    normalized === 'nan' ||
    normalized === '-'
  ) {
    return '';
  }
  return trimmed;
};

const normalizeText = (value?: string | null) => {
  const trimmed = normalizeOptionalText(value);
  return trimmed.length > 0 ? trimmed : EMPTY_VALUE;
};

const normalizeAddress = (profile?: DonorPoojaProfile) => {
  if (!profile) {
    return EMPTY_VALUE;
  }

  const lineParts = [
    normalizeOptionalText(profile.address_line1),
    normalizeOptionalText(profile.address_line2),
    normalizeOptionalText(profile.address_line3),
  ].filter(Boolean);
  const locationParts = [
    normalizeOptionalText(profile.city),
    normalizeOptionalText(profile.state),
  ].filter(Boolean);
  const postalCode = normalizeOptionalText(profile.postal_code);

  // If only postal code is present, treat address as missing/incomplete.
  if (lineParts.length === 0 && locationParts.length === 0) {
    return EMPTY_VALUE;
  }

  const formattedLocation =
    locationParts.length > 0 && postalCode
      ? `${locationParts.join(', ')} - ${postalCode}`
      : locationParts.length > 0
        ? locationParts.join(', ')
        : postalCode;

  const fullAddress = [...lineParts, formattedLocation].filter(Boolean).join(', ');
  return fullAddress || EMPTY_VALUE;
};

const normalizeFamilyMembers = (members?: DonorPoojaMember[]) => {
  if (!Array.isArray(members) || members.length === 0) {
    return EMPTY_VALUE;
  }
  const names = members
    .map((member) => (member?.name ?? '').trim())
    .filter((name) => name.length > 0);
  return names.length > 0 ? names.join(', ') : EMPTY_VALUE;
};

const DonorPoojaDetails = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<DonorPoojaRecord[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('auth/donors/');
        if (!mounted) {
          return;
        }
        const payload = Array.isArray(response.data) ? response.data : [];
        setRecords(payload as DonorPoojaRecord[]);
      } catch (loadError: any) {
        if (!mounted) {
          return;
        }
        const detail =
          loadError?.response?.data?.detail ??
          loadError?.message ??
          'Unable to load donor pooja details';
        setError(typeof detail === 'string' ? detail : 'Unable to load donor pooja details');
        setRecords([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo<DonorPoojaDetailRow[]>(() => {
    return records.map((record) => {
      const profile = record.profile;
      const donorId = normalizeText(profile?.donor_id);
      const donorName = normalizeText(record.user?.name);
      const donorHeaderText = normalizeText(profile?.notes);
      const gothram = normalizeText(profile?.gothra);
      const rasi = normalizeText(profile?.rasi);
      const tamilStar = normalizeText(profile?.tamil_star);
      const familyMembers = normalizeFamilyMembers(record.members);
      const address = normalizeAddress(profile);

      return {
        id: record.user.id,
        donorId,
        donorName,
        donorHeaderText,
        gothram,
        rasi,
        tamilStar,
        familyMembers,
        address,
      };
    });
  }, [records]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => {
      const searchable = [
        row.donorId,
        row.donorName,
        row.donorHeaderText,
        row.gothram,
        row.rasi,
        row.tamilStar,
        row.familyMembers,
        row.address,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [rows, searchQuery]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Donor Records</h2>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search donor records"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:w-80"
          />
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            Loading donor pooja details...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No donor records match your search.
          </div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-amber-200">
            <table className="w-full min-w-[980px] table-fixed divide-y divide-amber-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-24 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Donor ID
                  </th>
                  <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Donor Name
                  </th>
                  <th className="w-48 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Donor Header Text
                  </th>
                  <th className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Gothram
                  </th>
                  <th className="w-20 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Rasi
                  </th>
                  <th className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tamil Star
                  </th>
                  <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Family Members
                  </th>
                  <th className="w-[22rem] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Address
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 bg-white">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{row.donorId}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">{row.donorName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.donorHeaderText}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{row.gothram}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{row.rasi}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{row.tamilStar}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.familyMembers}</td>
                    <td
                      className="max-w-[22rem] px-4 py-3 text-sm text-slate-700 whitespace-normal break-words"
                      title={row.address !== EMPTY_VALUE ? row.address : undefined}
                    >
                      {row.address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default DonorPoojaDetails;
