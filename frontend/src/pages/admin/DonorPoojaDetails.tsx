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
  rasi?: string | null;
  tamil_star?: string | null;
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
  const formattedMembers = members
    .map((member) => {
      const name = normalizeOptionalText(member?.name);
      const rasi = normalizeOptionalText(member?.rasi);
      const tamilStar = normalizeOptionalText(member?.tamil_star);

      const attributes: string[] = [];
      if (rasi) {
        attributes.push(`Rasi: ${rasi}`);
      }
      if (tamilStar) {
        attributes.push(`Star: ${tamilStar}`);
      }

      if (!name && attributes.length === 0) {
        return '';
      }
      if (!name) {
        return attributes.join(', ');
      }
      if (attributes.length === 0) {
        return name;
      }
      return `${name} (${attributes.join(', ')})`;
    })
    .filter((value) => value.length > 0);

  return formattedMembers.length > 0 ? formattedMembers.join('; ') : EMPTY_VALUE;
};

const compareDonorIdAscending = (left: string, right: string) => {
  const leftMissing = left === EMPTY_VALUE;
  const rightMissing = right === EMPTY_VALUE;
  if (leftMissing && rightMissing) {
    return 0;
  }
  if (leftMissing) {
    return 1;
  }
  if (rightMissing) {
    return -1;
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
};

const formatDonorRowForCopy = (row: DonorPoojaDetailRow) => {
  return [
    `Donor ID: ${row.donorId}`,
    `Donor Name: ${row.donorName}`,
    `Donor Header Text: ${row.donorHeaderText}`,
    `Gothram: ${row.gothram}`,
    `Rasi: ${row.rasi}`,
    `Tamil Star: ${row.tamilStar}`,
    `Family Members: ${row.familyMembers}`,
    `Address: ${row.address}`,
  ].join('\n');
};

const copyToClipboard = async (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

const DonorPoojaDetails = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<DonorPoojaRecord[]>([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);

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
    return records
      .map((record) => {
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
      })
      .sort((first, second) => {
        const donorIdOrder = compareDonorIdAscending(first.donorId, second.donorId);
        if (donorIdOrder !== 0) {
          return donorIdOrder;
        }
        return first.id - second.id;
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

  const handleCopyRow = async (row: DonorPoojaDetailRow) => {
    try {
      await copyToClipboard(formatDonorRowForCopy(row));
      setCopyStatus(`Copied record for ${row.donorName}`);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy row');
    }
  };

  const handleCopyAll = async () => {
    try {
      const content = filteredRows.map((row) => formatDonorRowForCopy(row)).join('\n\n');
      await copyToClipboard(content);
      setCopyStatus(`Copied ${filteredRows.length} donor record${filteredRows.length > 1 ? 's' : ''}`);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy donor records');
    }
  };

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRowIds.includes(row.id)),
    [rows, selectedRowIds],
  );

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedRowIds.includes(row.id));

  const toggleRowSelection = (id: number) => {
    setSelectedRowIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedRowIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !filteredRows.some((row) => row.id === id));
      }
      const next = [...current];
      filteredRows.forEach((row) => {
        if (!next.includes(row.id)) {
          next.push(row.id);
        }
      });
      return next;
    });
  };

  const handleCopySelected = async () => {
    try {
      const content = selectedRows.map((row) => formatDonorRowForCopy(row)).join('\n\n');
      await copyToClipboard(content);
      setCopyStatus(`Copied ${selectedRows.length} selected donor record${selectedRows.length > 1 ? 's' : ''}`);
    } catch (copyError: any) {
      setCopyStatus(copyError?.message || 'Failed to copy selected donor records');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Donor Records</h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search donor records"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:w-80"
              />
              <button
                type="button"
                onClick={handleCopyAll}
                disabled={loading || !!error || filteredRows.length === 0}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Copy All
              </button>
              <button
                type="button"
                onClick={handleCopySelected}
                disabled={loading || !!error || selectedRows.length === 0}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Copy Selected ({selectedRows.length})
              </button>
            </div>
            {copyStatus && <p className="text-xs text-slate-600">{copyStatus}</p>}
          </div>
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
          <div className="rounded-xl border border-amber-200">
            <table className="w-full table-auto divide-y divide-amber-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-200"
                      />
                    </label>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Donor ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Donor Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Donor Header Text
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Gothram
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Rasi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tamil Star
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Family Members
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Address
                  </th>
                  <th className="w-20 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Copy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 bg-white">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedRowIds.includes(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-200"
                        aria-label={`Select donor row ${row.donorId}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.donorId}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.donorName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.donorHeaderText}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.gothram}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.rasi}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.tamilStar}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.familyMembers}</td>
                    <td
                      className="max-w-[22rem] px-4 py-3 text-sm text-slate-700 whitespace-normal break-words"
                      title={row.address !== EMPTY_VALUE ? row.address : undefined}
                    >
                      {row.address}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <button
                        type="button"
                        onClick={() => handleCopyRow(row)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Copy
                      </button>
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
