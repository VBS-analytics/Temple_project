import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import api, { extractResults } from '../../lib/api';

declare global {
  interface Window {
    pdfMake?: {
      createPdf: (documentDefinition: TDocumentDefinitions) => {
        download: (fileName: string) => void;
      };
    };
  }
}

const DAY_BUCKETS = [
  { key: 'previous', label: 'Previous Day', offset: -1 },
  { key: 'today', label: 'Today', offset: 0 },
  { key: 'tomorrow', label: 'Tomorrow', offset: 1 },
] as const;

type DayBucketKey = (typeof DAY_BUCKETS)[number]['key'];

interface RegistrationMember {
  id?: number;
  name?: string | null;
  date_of_birth?: string | null;
  dateOfBirth?: string | null;
  dob?: string | null;
  family_name?: string | null;
  familyName?: string | null;
  tamil_star?: string | null;
  tamilStar?: string | null;
  gothra?: string | null;
  gothram?: string | null;
}

interface RegistrationRecord {
  id: number;
  pooja_reg_id?: string | null;
  start_date?: string | null;
  pooja_option_name?: string | null;
  day_option_description?: string | null;
  donor_name?: string | null;
  post_prasadam?: boolean | null;
  created_at?: string | null;
  members?: RegistrationMember[] | null;
}

type RegistrationBuckets = Record<DayBucketKey, RegistrationRecord[]>;

const buildEmptyBuckets = (): RegistrationBuckets => ({
  previous: [],
  today: [],
  tomorrow: [],
});

const toLocalDateIso = (date: Date) => {
  const offsetMillis = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(offsetMillis).toISOString().split('T')[0];
};

const computeOffsetIso = (offset: number) => {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + offset);
  return toLocalDateIso(base);
};

const formatDateDisplay = (value?: string | null) => {
  if (!value) return 'N/A';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    if (year && month && day) {
      const monthLabel = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleString('en-IN', {
        month: 'short',
      });
      return `${day}-${monthLabel}-${year}`;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTimeDisplay = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDateDisplay(value);
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDobDisplay = (value?: string | null) => {
  if (!value) return 'N/A';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    if (year && month && day) return `${day}-${month}-${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatBooleanLabel = (value?: boolean | null) => (value ? 'Yes' : 'No');

const EXPORT_HEADERS = [
  'Pooja ID',
  'Pooja Date',
  'Pooja Name',
  'Day Option',
  'Devotees',
  'Post Prasadam',
  'Registered By',
  'Registration Date',
] as const;

type ExportHeader = (typeof EXPORT_HEADERS)[number];
type ExportRow = Record<ExportHeader, string>;

let pdfMakeLoaded = false;

const loadPdfMake = async () => {
  if (!pdfMakeLoaded) {
    const script1 = document.createElement('script');
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
    script1.async = true;
    
    const script2 = document.createElement('script');
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js';
    script2.async = true;

    await new Promise<void>((resolve) => {
      script1.onload = () => {
        document.head.appendChild(script2);
        script2.onload = () => {
          pdfMakeLoaded = true;
          resolve();
        };
      };
      document.head.appendChild(script1);
    });
  }

  if (!window.pdfMake) {
    throw new Error('PDFMake failed to load');
  }

  return window.pdfMake;
};

const MEMBER_FIELD_ALIASES = {
  dateOfBirth: ['date_of_birth', 'dateOfBirth', 'dob', 'birth_date', 'birthDate'],
  familyName: ['family_name', 'familyName', 'family', 'familyname'],
  tamilStar: ['tamil_star', 'tamilStar', 'star'],
  gothra: ['gothra', 'gothram', 'gothram_name', 'gothramName', 'gothram'],
} as const;

const normalizeMemberValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asString = value.toString().trim();
    return asString.length > 0 ? asString : null;
  }
  if (value && typeof value === 'object') {
    const maybeLabel = (value as Record<string, unknown>).label ?? (value as Record<string, unknown>).name;
    if (typeof maybeLabel === 'string') {
      const trimmed = maybeLabel.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
};

const readMemberField = (member: RegistrationMember | null | undefined, keys: readonly string[]) => {
  if (!member) return null;
  const record = member as Record<string, unknown>;
  for (const key of keys) {
    const raw = normalizeMemberValue(record[key]);
    if (raw) return raw;
  }
  return null;
};

const resolveMemberDob = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.dateOfBirth);

const resolveMemberFamilyName = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.familyName);

const resolveMemberTamilStar = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.tamilStar);

const resolveMemberGothra = (member: RegistrationMember | null | undefined) =>
  readMemberField(member, MEMBER_FIELD_ALIASES.gothra);

const formatDevoteesForExport = (members?: RegistrationMember[] | null) => {
  const validMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  if (validMembers.length === 0) return 'No devotee details available';

  return validMembers
    .map((member) => {
      const name = (member?.name ?? '').trim() || 'N/A';
      const familyName = resolveMemberFamilyName(member) ?? 'N/A';
      const tamilStar = resolveMemberTamilStar(member) ?? 'N/A';
      const gothra = resolveMemberGothra(member) ?? 'N/A';
      const dob = formatDobDisplay(resolveMemberDob(member));
      return `${name} (DOB: ${dob}, Family: ${familyName}, Tamil Star: ${tamilStar}, Gothram: ${gothra})`;
    })
    .join('\n');
};

const resolvePoojaId = (record: RegistrationRecord) => {
  const trimmed = (record.pooja_reg_id ?? '').trim();
  return trimmed || `#${record.id}`;
};

const resolveDonorName = (value?: string | null) => {
  const trimmed = (value ?? '').trim();
  return trimmed || 'Temple Admin';
};

const parseCreatedAt = (record: RegistrationRecord) => {
  if (!record.created_at) return Number.NaN;
  const timestamp = new Date(record.created_at).getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
};

const sortRegistrations = (records: RegistrationRecord[]) =>
  [...records].sort((a, b) => {
    const aTime = parseCreatedAt(a);
    const bTime = parseCreatedAt(b);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
    if (!Number.isNaN(aTime)) return -1;
    if (!Number.isNaN(bTime)) return 1;
    return b.id - a.id;
  });

const categorizeRegistrationsByDay = (records: RegistrationRecord[]): RegistrationBuckets => {
  const buckets = buildEmptyBuckets();
  const offsetMap: Record<DayBucketKey, string> = {
    previous: computeOffsetIso(-1),
    today: computeOffsetIso(0),
    tomorrow: computeOffsetIso(1),
  };

  records.forEach((record) => {
    const startDate = typeof record.start_date === 'string' ? record.start_date.slice(0, 10) : null;
    if (!startDate) return;

    if (startDate === offsetMap.today) {
      buckets.today.push(record);
      return;
    }
    if (startDate === offsetMap.previous) {
      buckets.previous.push(record);
      return;
    }
    if (startDate === offsetMap.tomorrow) {
      buckets.tomorrow.push(record);
    }
  });

  (Object.keys(buckets) as DayBucketKey[]).forEach((key) => {
    buckets[key] = sortRegistrations(buckets[key]);
  });

  return buckets;
};

const PoojaDetailsPage = () => {
  const [buckets, setBuckets] = useState<RegistrationBuckets>(() => buildEmptyBuckets());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const buildExportRows = useCallback(() => {
    const registrations = Object.values(buckets).reduce<RegistrationRecord[]>(
      (acc, bucket) => acc.concat(bucket),
      [],
    );

    if (registrations.length === 0) {
      return null;
    }

    const rows: ExportRow[] = registrations.map((record) => ({
      'Pooja ID': resolvePoojaId(record),
      'Pooja Date': formatDateDisplay(record.start_date),
      'Pooja Name': record.pooja_option_name?.trim() || 'N/A',
      'Day Option': record.day_option_description?.trim() || 'N/A',
      Devotees: formatDevoteesForExport(record.members),
      'Post Prasadam': formatBooleanLabel(record.post_prasadam),
      'Registered By': resolveDonorName(record.donor_name),
      'Registration Date': formatDateTimeDisplay(record.created_at),
    }));

    const filenameDate = selectedDate || toLocalDateIso(new Date());
    const selectionLabel = selectedDate
      ? `Selected Date: ${formatDateDisplay(selectedDate)}`
      : 'Selected Date: All Dates';

    return { rows, filenameDate, selectionLabel };
  }, [buckets, selectedDate]);

  const handleExcelDownload = useCallback(() => {
    const exportData = buildExportRows();
    if (!exportData) {
      window.alert('No registrations available to download for the selected criteria.');
      return;
    }

    const { rows, filenameDate } = exportData;
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pooja Details');
    XLSX.writeFile(workbook, `pooja-details-${filenameDate}.xlsx`);
  }, [buildExportRows]);

  const handlePdfDownload = useCallback(async () => {
    const exportData = buildExportRows();
    if (!exportData) {
      window.alert('No registrations available to download for the selected criteria.');
      return;
    }

    const { rows, filenameDate, selectionLabel } = exportData;

    try {
      const pdfMakeInstance = await loadPdfMake();
      if (!pdfMakeInstance?.createPdf) {
        throw new Error('pdfMake is unavailable');
      }

      const tableBody = [
        EXPORT_HEADERS.map((header) => ({ text: header, style: 'tableHeader' })),
        ...rows.map((row) => EXPORT_HEADERS.map((header) => row[header] ?? '')),
      ];

      const generatedOn = formatDateTimeDisplay(new Date().toISOString());

      const docDefinition: TDocumentDefinitions = {
        info: {
          title: `Pooja Details - ${filenameDate}`,
        },
        pageOrientation: 'landscape',
        pageSize: 'A4',
        pageMargins: [24, 24, 24, 24],
        defaultStyle: {
          fontSize: 9,
        },
        styles: {
          header: {
            fontSize: 16,
            bold: true,
          },
          subheader: {
            fontSize: 10,
            color: '#475569',
            margin: [0, 2, 0, 8],
          },
          tableHeader: {
            bold: true,
            fillColor: '#f1f5f9',
          },
        },
        content: [
          { text: 'Registered Pooja Details', style: 'header', margin: [0, 0, 0, 4] },
          { text: selectionLabel, style: 'subheader' },
          { text: `Generated on: ${generatedOn}`, style: 'subheader' },
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', 'auto', 'auto', '*', 'auto', 'auto', 'auto'],
              body: tableBody,
            },
            layout: 'lightHorizontalLines',
          },
        ],
      };

      pdfMakeInstance.createPdf(docDefinition).download(`pooja-details-${filenameDate}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      window.alert('Unable to generate PDF right now. Please try again later.');
    }
  }, [buildExportRows]);

  useEffect(() => {
    let active = true;

    const fetchRegistrations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all records if no date selected, otherwise fetch for specific date
        const response = await api.get('pooja/registrations/', { 
          params: { 
            page_size: 500,
            ...(selectedDate && { date: selectedDate })
          } 
        });
        
        if (!active) return;
        
        const records = extractResults<RegistrationRecord>(response.data);
        let filteredRecords = records;
        
        // Filter by date if a date is selected
        if (selectedDate) {
          filteredRecords = records.filter(record => {
            const startDate = record.start_date?.slice(0, 10);
            return startDate === selectedDate;
          });
        }
        
        const newBuckets = buildEmptyBuckets();
        newBuckets.today = sortRegistrations(filteredRecords);
        setBuckets(newBuckets);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load pooja registrations', err);
        if (active) {
          setError('Unable to load pooja details right now. Please try again later.');
          setBuckets(buildEmptyBuckets());
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchRegistrations();

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const bucketDateLabels = useMemo(() => {
    const result = {} as Record<DayBucketKey, string>;
    DAY_BUCKETS.forEach(({ key, offset }) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      result[key] = formatDateDisplay(toLocalDateIso(date));
    });
    return result;
  }, []);

  return (
    <div className="space-y-6 p-3">
      <div className="rounded-lg p-6 mx-2">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Registered Pooja Details</h1>
        
        <div className="mb-6 flex items-center gap-4">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="block w-48 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
            focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <button
            onClick={handleExcelDownload}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Download Data - Excel
          </button>
          <button
            onClick={handlePdfDownload}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Download Data - PDF
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 text-red-600 p-4">{error}</div>
        ) : (
          <div>
            <table className="min-w-full divide-y divide-gray-200">
              <colgroup>
                <col className="w-[10%]" /> {/* Pooja ID */}
                <col className="w-[12%]" /> {/* Pooja Date */}
                <col className="w-[15%]" /> {/* Pooja Name */}
                <col className="w-[15%]" /> {/* Day Option */}
                <col className="w-[20%]" /> {/* Devotees */}
                <col className="w-[8%]" />  {/* Post Prasadam */}
                <col className="w-[10%]" /> {/* Registered By */}
                <col className="w-[10%]" /> {/* Registration Date */}
              </colgroup>

              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Pooja ID
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Pooja Date
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Pooja Name
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Day Option
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Devotees
                    <span className="block text-xs font-normal normal-case">(Name, DOB, Family Name, Tamil Star, Gothram)</span>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Post Prasadam
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Registered By
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Registration Date
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {DAY_BUCKETS.map(({ key }) => {
                  const registrations = buckets[key];
                  return registrations.map((registration) => {
                    const members = Array.isArray(registration.members)
                      ? registration.members.filter(Boolean)
                      : [];

                    return (
                      <tr key={registration.id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                          {resolvePoojaId(registration)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {formatDateDisplay(registration.start_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700" title={registration.pooja_option_name ?? ''}>
                          {registration.pooja_option_name?.trim() || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {registration.day_option_description?.trim() || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <div>
                            {members.length === 0 ? (
                              <span className="text-slate-400">No devotee details available</span>
                            ) : (
                              members.map((member, index) => {
                                const name = (member?.name ?? '').trim() || 'N/A';
                                const familyName = resolveMemberFamilyName(member) ?? 'N/A';
                                const tamilStar = resolveMemberTamilStar(member) ?? 'N/A';
                                const gothra = resolveMemberGothra(member) ?? 'N/A';
                                const dob = formatDobDisplay(resolveMemberDob(member));

                                return (
                                  <div key={member?.id ?? index} className="text-xs">
                                    <span className="font-semibold" title={name}>{name}</span>
                                    <span className="text-slate-600 ml-2">
                                      (DOB: {dob}, 
                                      Family: {familyName}, 
                                      Tamil Star: {tamilStar}, 
                                      Gothram: {gothra})
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                          {formatBooleanLabel(registration.post_prasadam)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700" title={registration.donor_name ?? ''}>
                          {resolveDonorName(registration.donor_name)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                          {formatDateTimeDisplay(registration.created_at)}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PoojaDetailsPage;
