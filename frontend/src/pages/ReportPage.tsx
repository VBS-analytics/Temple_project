import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import * as XLSX from 'xlsx';

import api, { extractResults } from '../lib/api';
import { loadPdfMake, PDF_TAMIL_FONT_NAME, testTamilFont, verifyTamilFont } from '../lib/pdfMakeLoader';

interface DonorRecord {
  user: {
    id: number;
    name?: string | null;
    phone_number?: string | null;
    email?: string | null;
  };
  profile?: {
    donor_id?: string | null;
    family_name?: string | null;
    gothra?: string | null;
    rasi?: string | null;
    tamil_star?: string | null;
    monthly_donation_amount?: number | string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    address_line3?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    notes?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    tamil_name?: string | null;
  };
  members?: {
    id?: number;
    name?: string | null;
    relationship?: string | null;
    gender?: string | null;
    tamil_star?: string | null;
    gothra?: string | null;
    rasi?: string | null;
    date_of_birth?: string | null;
    family_name?: string | null;
  }[];
}

interface PoojaReportEntry {
  donor_id: number;
  name?: string | null;
  phone_number?: string | null;
  pooja_date?: string | null;
}

const formatFilenameDate = (value: Date) =>
  value.toISOString().replace(/[:.]/g, '').replace(/-/g, '').slice(0, 15);

const displayValue = (value?: string | number | null) =>
  value === undefined || value === null || value === '' ? '—' : String(value);

const formatDateValue = (value?: string | number | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatProfileAddress = (profile?: DonorRecord['profile']) => {
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

const FAMILY_NAME_UNKNOWN = 'Unknown Family';

const sanitizeFilename = (value: string) =>
  value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);

const sanitizeSheetName = (value: string) =>
  value.replace(/[:\/\\\?\*\[\]]/g, '').trim().slice(0, 31);

const createDonorSheetRows = (donor: DonorRecord): (string | number)[][] => {
  const rows: (string | number)[][] = [
    ['Temple Donor Details'],
    [],
    ['Field', 'Value'],
    ['Temple Donor ID', displayValue(donor.profile?.donor_id)],
    ['Family Name', displayValue(donor.profile?.family_name)],
    ['Name', displayValue(donor.user.name)],
    ['Phone', displayValue(donor.user.phone_number)],
    ['Email', displayValue(donor.user.email)],
    ['Rasi', displayValue(donor.profile?.rasi)],
    ['Gothra', displayValue(donor.profile?.gothra)],
    ['Tamil Star', displayValue(donor.profile?.tamil_star)],
    ['Date of Birth', formatDateValue(donor.profile?.date_of_birth)],
    ['Donor Header Text', displayValue(donor.profile?.notes)],
    ['Gender', displayValue(donor.profile?.gender)],
    ['Address', formatProfileAddress(donor.profile)],
    ['Monthly Donation Amount', displayValue(donor.profile?.monthly_donation_amount)],
  ];

  rows.push([]);
  rows.push(['Family Members']);
  const memberHeader = [
    'Member ID',
    'Member Name',
    'Relationship',
    'Gender',
    'Date of Birth',
    'Family Name',
    'Rasi',
    'Gothra',
    'Tamil Star',
  ];
  rows.push(memberHeader);

  const members = donor.members ?? [];
  if (members.length === 0) {
    rows.push(['No family members recorded', '', '', '', '', '', '', '', '']);
  } else {
    members.forEach((member) => {
      rows.push([
        member.id ?? '—',
        displayValue(member.name),
        displayValue(member.relationship),
        displayValue(member.gender),
        displayValue(member.date_of_birth),
        displayValue(member.family_name ?? donor.profile?.family_name),
        displayValue(member.rasi),
        displayValue(member.gothra),
        displayValue(member.tamil_star),
      ]);
    });
  }

  return rows;
};

const downloadWorkbook = (workbook: XLSX.WorkBook, filename: string) => {
  XLSX.writeFile(workbook, filename);
};

const createUniqueSheetName = (donor: DonorRecord, usedNames: Set<string>) => {
  const baseName =
    donor.user.name?.trim() ??
    donor.profile?.donor_id?.trim() ??
    `Donor-${donor.user.id}`;
  let sanitized = sanitizeSheetName(baseName);
  if (!sanitized) {
    sanitized = `Donor-${donor.user.id}`;
  }

  let candidate = sanitized;
  let counter = 1;
  while (usedNames.has(candidate)) {
    const suffix = `-${counter}`;
    const maxLength = Math.max(1, 31 - suffix.length);
    const truncated = sanitized.slice(0, maxLength);
    candidate = `${truncated}${suffix}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
};

const groupDonorsByFamily = (donors: DonorRecord[]) => {
  const familyMap = new Map<string, DonorRecord[]>();
  donors.forEach((donor) => {
    const rawName = donor.profile?.family_name?.trim();
    const familyName = rawName && rawName.length > 0 ? rawName : FAMILY_NAME_UNKNOWN;
    if (!familyMap.has(familyName)) {
      familyMap.set(familyName, []);
    }
    familyMap.get(familyName)?.push(donor);
  });
  return familyMap;
};

const createFamilyWorkbook = (donors: DonorRecord[]): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
  donors.forEach((donor) => {
    const rows = createDonorSheetRows(donor);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const sheetName = createUniqueSheetName(donor, usedSheetNames);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });
  return workbook;
};

const POOJA_REPORT_HEADERS = [
  'S.no',
  'Temple Donor ID',
  'Name',
  'Phone',
  'Pooja Date',
] as const;

type PoojaReportHeader = (typeof POOJA_REPORT_HEADERS)[number];
type PoojaReportRow = Record<PoojaReportHeader, string | number>;
type PoojaReportFormat = 'pdf' | 'excel';

const POOJA_REPORT_KEYS = [
  'saturdayNavagraha',
  'pradosha',
  'tillOil',
  'nityaNeivedhyam',
  'gauSamrakshana',
] as const;

type PoojaReportKey = (typeof POOJA_REPORT_KEYS)[number];

const POOJA_REPORTS: Record<
  PoojaReportKey,
  {
    endpoint: string;
    label: string;
    filenamePrefix: string;
    sheetName: string;
    emptyMessage: string;
    errorMessage: string;
  }
> = {
  saturdayNavagraha: {
    endpoint: 'pooja/registrations/saturday-navagraha-report/',
    label: 'Saturday Navagraha Pooja',
    filenamePrefix: 'saturday-navagraha-pooja',
    sheetName: 'Saturday Navagraha',
    emptyMessage: 'No donors have registered for the Saturday Navagraha Pooja yet.',
    errorMessage: 'Unable to download the Saturday Navagraha Pooja report right now.',
  },
  pradosha: {
    endpoint: 'pooja/registrations/pradosha-pooja-report/',
    label: 'Pradosha Pooja',
    filenamePrefix: 'pradosha-pooja',
    sheetName: 'Pradosha Pooja',
    emptyMessage: 'No donors have registered for the Pradosha Pooja yet.',
    errorMessage: 'Unable to download the Pradosha Pooja report right now.',
  },
  tillOil: {
    endpoint: 'pooja/registrations/till-oil-for-lamps-report/',
    label: 'Till Oil for Lamps',
    filenamePrefix: 'till-oil-for-lamps',
    sheetName: 'Till Oil for Lamps',
    emptyMessage: 'No donors have registered for the Till Oil for Lamps pooja yet.',
    errorMessage: 'Unable to download the Till Oil for Lamps report right now.',
  },
  nityaNeivedhyam: {
    endpoint: 'pooja/registrations/nitya-neivedhyam-report/',
    label: 'Nitya Neivedhyam',
    filenamePrefix: 'nitya-neivedhyam',
    sheetName: 'Nitya Neivedhyam',
    emptyMessage: 'No donors have registered for the Nitya Neivedhyam pooja yet.',
    errorMessage: 'Unable to download the Nitya Neivedhyam report right now.',
  },
  gauSamrakshana: {
    endpoint: 'pooja/registrations/gau-samrakshana-seva-report/',
    label: 'Gau Samrakshana Seva',
    filenamePrefix: 'gau-samrakshana-seva',
    sheetName: 'Gau Samrakshana Seva',
    emptyMessage: 'No donors have registered for the Gau Samrakshana Seva yet.',
    errorMessage: 'Unable to download the Gau Samrakshana report right now.',
  },
};

const initialPoojaExportState: Record<PoojaReportKey, boolean> = POOJA_REPORT_KEYS.reduce(
  (acc, key) => {
    acc[key] = false;
    return acc;
  },
  {} as Record<PoojaReportKey, boolean>,
);

const buildPoojaReportRows = (registrations: PoojaReportEntry[]): PoojaReportRow[] =>
  registrations.map((registration, index) => ({
    'S.no': index + 1,
    'Temple Donor ID': registration.donor_id ?? '—',
    Name: displayValue(registration.name),
    Phone: displayValue(registration.phone_number),
    'Pooja Date': displayValue(registration.pooja_date),
  }));

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

// ✅ FIXED: Uses getBlob() (most reliable) + ensures tamil font is usable
const downloadPoojaReportPdf = async (
  rows: PoojaReportRow[],
  filenameBase: string,
  title: string,
) => {
  if (typeof window === 'undefined') {
    console.error('PDF download is only available in the browser');
    return;
  }

  const pdfMakeInstance = await loadPdfMake();

  const ok = verifyTamilFont();
  if (!ok) {
    throw new Error('Tamil font not registered properly. Check base64 and TTF format.');
  }

  const tableBody: TableCell[][] = [
    POOJA_REPORT_HEADERS.map((header) => ({
      text: header,
      style: 'tableHeader',
      font: PDF_TAMIL_FONT_NAME,
    })),
    ...rows.map((row) =>
      POOJA_REPORT_HEADERS.map((key) => {
        const value = row[key];
        return {
          text: value === undefined || value === null || value === '' ? '—' : String(value),
          font: PDF_TAMIL_FONT_NAME,
          noWrap: false,
        };
      }),
    ),
  ];

  const generatedOn = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const headerContentLines: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: title, style: 'header' },
            {
              text: `Following list of donor for ${title}`,
              style: 'subheader',
              margin: [0, 0, 0, 8],
            },
          ],
        },
        {
          width: 'auto',
          stack: [
            {
              text: `Records: ${rows.length}`,
              style: 'subheader',
              alignment: 'right',
            },
            {
              text: `Generated on: ${generatedOn}`,
              style: 'subheader',
              alignment: 'right',
              margin: [0, 0, 0, 8],
            },
          ],
        },
      ],
      columnGap: 32,
      margin: [0, 0, 0, 12],
    },
  ];

  const docDefinition: TDocumentDefinitions = {
    info: { title: `${title} - ${filenameBase}` },
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [24, 24, 24, 24],
    defaultStyle: {
      font: PDF_TAMIL_FONT_NAME,
      fontSize: 10,
    },
    styles: {
      header: {
        font: PDF_TAMIL_FONT_NAME,
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 4],
      },
      subheader: {
        font: PDF_TAMIL_FONT_NAME,
        fontSize: 12,
        margin: [0, 0, 0, 4],
        color: '#475569',
      },
      tableHeader: {
        font: PDF_TAMIL_FONT_NAME,
        bold: true,
        fillColor: '#f8fafc',
        fontSize: 10,
      },
    },
    content: [
      ...headerContentLines,
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 1),
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
        },
      },
    ],
  };

  const pdfDoc: any = pdfMakeInstance.createPdf(docDefinition);

  // ✅ Most reliable across browsers
  pdfDoc.getBlob((blob: Blob) => {
    triggerBlobDownload(blob, `${filenameBase}.pdf`);
  });
};

const ReportPage = () => {
  const [exportingDonorDatabase, setExportingDonorDatabase] = useState(false);
  const [exportingDonorDetails, setExportingDonorDetails] = useState(false);
  const [exportingReports, setExportingReports] = useState(initialPoojaExportState);
  const [pendingReportKey, setPendingReportKey] = useState<PoojaReportKey | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // ✅ Preload pdfMake once to avoid download gesture issues + reduce delay on click
  useEffect(() => {
    loadPdfMake().catch((err) => console.error('pdfMake preload failed', err));
  }, []);

  const fetchDonors = useCallback(async (): Promise<DonorRecord[]> => {
    const { data } = await api.get<DonorRecord[]>('auth/donors/');
    const donors = extractResults<DonorRecord>(data);
    return donors;
  }, []);

  const handleDonorDatabaseDownload = useCallback(async () => {
    if (exportingDonorDatabase) return;

    setExportError(null);
    setExportingDonorDatabase(true);

    try {
      const donors = await fetchDonors();
      if (!donors.length) {
        setExportError('No donor records are available at the moment.');
        return;
      }

      const donorRows = donors.map((donor, index) => ({
        'S.no': index + 1,
        'Donor ID': displayValue(donor.profile?.donor_id ?? '—'),
        'User ID': donor.user.id,
        Name: displayValue(donor.user.name),
        Phone: displayValue(donor.user.phone_number),
        Email: displayValue(donor.user.email),
        'Family Name': displayValue(donor.profile?.family_name),
        Rasi: displayValue(donor.profile?.rasi),
        Gothra: displayValue(donor.profile?.gothra),
        'Tamil Star': displayValue(donor.profile?.tamil_star),
        'Date of Birth': formatDateValue(donor.profile?.date_of_birth),
        'Donor Header Text': displayValue(donor.profile?.notes),
        Gender: displayValue(donor.profile?.gender),
        Address: formatProfileAddress(donor.profile),
        'Monthly Donation Amount': displayValue(donor.profile?.monthly_donation_amount),
      }));

      const memberRows = donors.flatMap((donor) =>
        (donor.members ?? []).map((member) => ({
          'Donor User ID': donor.user.id,
          'Donor Name': displayValue(donor.user.name),
          'Member ID': member.id ?? '—',
          'Member Name': displayValue(member.name),
          Relationship: displayValue(member.relationship),
          Gender: displayValue(member.gender),
          'Date of Birth': displayValue(member.date_of_birth),
          'Family Name': displayValue(member.family_name ?? donor.profile?.family_name),
          Rasi: displayValue(member.rasi),
          Gothra: displayValue(member.gothra),
          'Tamil Star': displayValue(member.tamil_star),
        })),
      );

      const workbook = XLSX.utils.book_new();
      const donorHeaderKeys = [
        'S.no',
        'Donor ID',
        'User ID',
        'Name',
        'Phone',
        'Email',
        'Family Name',
        'Rasi',
        'Gothra',
        'Tamil Star',
        'Date of Birth',
        'Donor Header Text',
        'Gender',
        'Address',
        'Monthly Donation Amount',
      ];
      const donorSheet = XLSX.utils.json_to_sheet(donorRows, { header: donorHeaderKeys });
      XLSX.utils.book_append_sheet(workbook, donorSheet, 'Donors');

      if (memberRows.length > 0) {
        const memberHeaderKeys = [
          'Donor User ID',
          'Donor Name',
          'Member ID',
          'Member Name',
          'Relationship',
          'Gender',
          'Date of Birth',
          'Family Name',
          'Rasi',
          'Gothra',
          'Tamil Star',
        ];
        const memberSheet = XLSX.utils.json_to_sheet(memberRows, { header: memberHeaderKeys });
        XLSX.utils.book_append_sheet(workbook, memberSheet, 'Family Members');
      }

      const familyMap = groupDonorsByFamily(donors);
      const familyFileNames = new Set<string>();
      const masterFilename = `donor-database-${formatFilenameDate(new Date())}.xlsx`;
      downloadWorkbook(workbook, masterFilename);

      for (const [familyName, familyDonors] of familyMap) {
        const familyWorkbook = createFamilyWorkbook(familyDonors);
        const safeFamilyName = sanitizeFilename(familyName) || 'Family';
        let familyFileName = `${safeFamilyName}.xlsx`;
        let suffixIndex = 1;
        while (familyFileNames.has(familyFileName)) {
          familyFileName = `${safeFamilyName}-${suffixIndex}.xlsx`;
          suffixIndex += 1;
        }
        familyFileNames.add(familyFileName);
        downloadWorkbook(familyWorkbook, familyFileName);
      }
    } catch (error) {
      const detail =
        (error as AxiosError<{ detail?: string | null }>)?.response?.data?.detail ?? null;
      console.error('Failed to download donor database', error);
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the donor database right now.');
      }
    } finally {
      setExportingDonorDatabase(false);
    }
  }, [exportingDonorDatabase, fetchDonors]);

  const handleDonorDetailsDownload = useCallback(async () => {
    if (exportingDonorDetails) return;

    setExportError(null);
    setExportingDonorDetails(true);

    try {
      const donors = await fetchDonors();
      if (!donors.length) {
        setExportError('No donor records are available at the moment.');
        return;
      }

      const donorDetailsRows = donors.map((donor, index) => ({
        'S.no': index + 1,
        'Temple Donor ID': displayValue(donor.profile?.donor_id ?? '—'),
        Name: displayValue(donor.user.name),
        Phone: displayValue(donor.user.phone_number),
      }));

      const headerKeys = ['S.no', 'Temple Donor ID', 'Name', 'Phone', 'Pooja Date'];
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(donorDetailsRows, { header: headerKeys });
      XLSX.utils.book_append_sheet(workbook, sheet, 'Donor Details');

      const filename = `donor-details-${formatFilenameDate(new Date())}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      const detail =
        (error as AxiosError<{ detail?: string | null }>)?.response?.data?.detail ?? null;
      console.error('Failed to download donor details', error);
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the donor details right now.');
      }
    } finally {
      setExportingDonorDetails(false);
    }
  }, [exportingDonorDetails, fetchDonors]);

  const downloadPoojaReport = useCallback(
    async (key: PoojaReportKey, format: PoojaReportFormat) => {
      if (exportingReports[key]) return;

      const report = POOJA_REPORTS[key];
      setExportError(null);
      setExportingReports((prev) => ({ ...prev, [key]: true }));

      try {
        const { data } = await api.get(report.endpoint);
        const registrations = extractResults<PoojaReportEntry>(data);

        if (!registrations.length) {
          setExportError(report.emptyMessage);
          return;
        }

        const rows = buildPoojaReportRows(registrations);
        const headerKeys = [...POOJA_REPORT_HEADERS];
        const filenameBase = `${report.filenamePrefix}-${formatFilenameDate(new Date())}`;

        if (format === 'excel') {
          const workbook = XLSX.utils.book_new();
          const sheet = XLSX.utils.json_to_sheet(rows, { header: headerKeys });
          XLSX.utils.book_append_sheet(workbook, sheet, report.sheetName);
          downloadWorkbook(workbook, `${filenameBase}.xlsx`);
          return;
        }

        await downloadPoojaReportPdf(rows, filenameBase, report.label);
      } catch (error) {
        console.error(`Failed to download ${report.label} report`, error);
        setExportError(error instanceof Error ? error.message : report.errorMessage);
      } finally {
        setExportingReports((prev) => ({ ...prev, [key]: false }));
      }
    },
    [exportingReports],
  );

  const buttonLabel = useMemo(
    () => (exportingDonorDatabase ? 'Preparing download…' : 'Donor Database'),
    [exportingDonorDatabase],
  );

  const detailsButtonLabel = useMemo(
    () => (exportingDonorDetails ? 'Preparing download…' : 'Donor Details'),
    [exportingDonorDetails],
  );

  const openReportFormatDialog = useCallback(
    (key: PoojaReportKey) => {
      if (exportingReports[key]) return;
      setPendingReportKey(key);
    },
    [exportingReports],
  );

  const closeReportFormatDialog = useCallback(() => {
    setPendingReportKey(null);
  }, []);

  const handleFormatSelection = useCallback(
    (format: PoojaReportFormat) => {
      if (!pendingReportKey) return;
      const key = pendingReportKey;
      setPendingReportKey(null);
      downloadPoojaReport(key, format);
    },
    [pendingReportKey, downloadPoojaReport],
  );

  const getPoojaReportLabel = useCallback(
    (key: PoojaReportKey) =>
      exportingReports[key] ? 'Preparing download…' : POOJA_REPORTS[key].label,
    [exportingReports],
  );

  const isExportingPoojaReport = useCallback(
    (key: PoojaReportKey) => exportingReports[key],
    [exportingReports],
  );

  const pendingReportMeta = pendingReportKey ? POOJA_REPORTS[pendingReportKey] : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Report</h1>
            <p className="mt-1 text-sm text-slate-500">
              Consolidated insights about donations and pooja activity across the portal.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-4 py-1 text-sm font-semibold text-amber-700">
            Coming soon
          </span>
        </div>

        <div className="mt-6 space-y-4 text-sm text-slate-600">
          <p>
            The Report section will house downloadable summaries, charts, and filters to help temple
            administrators make informed decisions. Stay tuned while we build the first set of widgets
            and export options.
          </p>
          <p>
            If you need immediate data, visit the Payment Statement tab or reach out to the operations
            team for interim exports.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDonorDatabaseDownload}
            disabled={exportingDonorDatabase}
            className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-70 disabled:hover:bg-orange-600"
          >
            {buttonLabel}
          </button>

          <button
            type="button"
            onClick={handleDonorDetailsDownload}
            disabled={exportingDonorDetails}
            className="rounded-full border border-orange-600 px-5 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-700 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 disabled:hover:border-orange-600"
          >
            {detailsButtonLabel}
          </button>

          <button
            type="button"
            onClick={() => openReportFormatDialog('saturdayNavagraha')}
            disabled={isExportingPoojaReport('saturdayNavagraha')}
            className="rounded-full border border-orange-600 px-5 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-700 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 disabled:hover:border-orange-600"
          >
            {getPoojaReportLabel('saturdayNavagraha')}
          </button>

          <button
            type="button"
            onClick={() => openReportFormatDialog('pradosha')}
            disabled={isExportingPoojaReport('pradosha')}
            className="rounded-full border border-orange-600 px-5 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-700 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 disabled:hover:border-orange-600"
          >
            {getPoojaReportLabel('pradosha')}
          </button>

          <button
            type="button"
            onClick={() => openReportFormatDialog('tillOil')}
            disabled={isExportingPoojaReport('tillOil')}
            className="rounded-full border border-orange-600 px-5 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-700 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 disabled:hover:border-orange-600"
          >
            {getPoojaReportLabel('tillOil')}
          </button>

          <button
            type="button"
            onClick={() => openReportFormatDialog('nityaNeivedhyam')}
            disabled={isExportingPoojaReport('nityaNeivedhyam')}
            className="rounded-full border border-orange-600 px-5 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-700 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 disabled:hover:border-orange-600"
          >
            {getPoojaReportLabel('nityaNeivedhyam')}
          </button>

          <button
            type="button"
            onClick={() => openReportFormatDialog('gauSamrakshana')}
            disabled={isExportingPoojaReport('gauSamrakshana')}
            className="rounded-full border border-orange-600 px-5 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-700 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 disabled:hover:border-orange-600"
          >
            {getPoojaReportLabel('gauSamrakshana')}
          </button>

          {exportError && (
            <p className="w-full text-sm font-medium text-rose-600">
              {exportError}
            </p>
          )}
        </div>
      </section>

      {pendingReportMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8"
          onClick={closeReportFormatDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pooja-report-format-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="pooja-report-format-title"
              className="text-lg font-semibold text-slate-800"
            >
              Download format
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Choose the format for the {pendingReportMeta.label} report.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleFormatSelection('pdf')}
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleFormatSelection('excel')}
                className="flex-1 rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-700 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Excel
              </button>
            </div>
            <button
              type="button"
              onClick={closeReportFormatDialog}
              className="mt-4 w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPage;
