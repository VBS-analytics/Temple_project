import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import * as XLSX from 'xlsx';

import api, { extractResults } from '../lib/api';
import { loadPdfMake, PDF_TAMIL_FONT_NAME, verifyTamilFont } from '../lib/pdfMakeLoader';
import type { CartItem } from '../store/cart';
import ExpensesPage from './admin/ExpensesPage';

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
    custom_number?: number | null;
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

interface CartSnapshotRecord {
  donor_id?: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  items?: CartItem[] | null;
  updated_at?: string | null;
}

interface PaymentRecordExportEntry {
  id?: number | string | null;
  donor?: number | null;
  donor_name?: string | null;
  pooja_option?: string | null;
  registration?: number | null;
  registration_start_date?: string | null;
  amount?: string | number | null;
  pooja_due_amount?: string | number | null;
  status?: string | null;
  transaction_reference?: string | null;
  mode?: string | null;
  payment_month?: string | null;
  created_at?: string | null;
  registration_status?: string | null;
  registration_donor_name?: string | null;
  registration_is_group_registration?: boolean | null;
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

const formatBooleanValue = (value?: boolean | null) =>
  value === undefined || value === null ? '—' : value ? 'Yes' : 'No';

const asNumericValue = (value?: string | number | null) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const joinCartMemberNames = (members?: CartItem['members']) => {
  if (!members?.length) {
    return '—';
  }
  const names = members
    .map((member) => (member?.name ?? '').trim())
    .filter((name) => name.length > 0);
  return names.length ? names.join('; ') : '—';
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

const POOJA_OPTION_NAMES: Record<PoojaReportKey, string> = {
  saturdayNavagraha: '4 saturday navagraha pooja per month',
  pradosha: '2 pradosha pooja per month',
  tillOil: 'till oil for lamps',
  nityaNeivedhyam: 'nitya neivedhyam',
  gauSamrakshana: 'gau samrakshana seva',
};

const POOJA_REPORTS: Record<
  PoojaReportKey,
  {
    endpoint: string;
    label: string;
    filenamePrefix: string;
    sheetName: string;
    emptyMessage: string;
    errorMessage: string;
    poojaOptionName: string;
  }
> = {
  saturdayNavagraha: {
    endpoint: 'pooja/registrations/saturday-navagraha-report/',
    label: 'Saturday Navagraha Pooja',
    filenamePrefix: 'saturday-navagraha-pooja',
    sheetName: 'Saturday Navagraha',
    emptyMessage: 'No donors have registered for the Saturday Navagraha Pooja yet.',
    errorMessage: 'Unable to download the Saturday Navagraha Pooja report right now.',
    poojaOptionName: POOJA_OPTION_NAMES.saturdayNavagraha,
  },
  pradosha: {
    endpoint: 'pooja/registrations/pradosha-pooja-report/',
    label: 'Pradosha Pooja',
    filenamePrefix: 'pradosha-pooja',
    sheetName: 'Pradosha Pooja',
    emptyMessage: 'No donors have registered for the Pradosha Pooja yet.',
    errorMessage: 'Unable to download the Pradosha Pooja report right now.',
    poojaOptionName: POOJA_OPTION_NAMES.pradosha,
  },
  tillOil: {
    endpoint: 'pooja/registrations/till-oil-for-lamps-report/',
    label: 'Till Oil for Lamps',
    filenamePrefix: 'till-oil-for-lamps',
    sheetName: 'Till Oil for Lamps',
    emptyMessage: 'No donors have registered for the Till Oil for Lamps pooja yet.',
    errorMessage: 'Unable to download the Till Oil for Lamps report right now.',
    poojaOptionName: POOJA_OPTION_NAMES.tillOil,
  },
  nityaNeivedhyam: {
    endpoint: 'pooja/registrations/nitya-neivedhyam-report/',
    label: 'Nitya Neivedhyam',
    filenamePrefix: 'nitya-neivedhyam',
    sheetName: 'Nitya Neivedhyam',
    emptyMessage: 'No donors have registered for the Nitya Neivedhyam pooja yet.',
    errorMessage: 'Unable to download the Nitya Neivedhyam report right now.',
    poojaOptionName: POOJA_OPTION_NAMES.nityaNeivedhyam,
  },
  gauSamrakshana: {
    endpoint: 'pooja/registrations/gau-samrakshana-seva-report/',
    label: 'Gau Samrakshana Seva',
    filenamePrefix: 'gau-samrakshana-seva',
    sheetName: 'Gau Samrakshana Seva',
    emptyMessage: 'No donors have registered for the Gau Samrakshana Seva yet.',
    errorMessage: 'Unable to download the Gau Samrakshana report right now.',
    poojaOptionName: POOJA_OPTION_NAMES.gauSamrakshana,
  },
};

const initialPoojaExportState: Record<PoojaReportKey, boolean> = POOJA_REPORT_KEYS.reduce(
  (acc, key) => {
    acc[key] = false;
    return acc;
  },
  {} as Record<PoojaReportKey, boolean>,
);

const GENERAL_POOJA_REPORT_KEYS: PoojaReportKey[] = ['tillOil', 'nityaNeivedhyam', 'gauSamrakshana'];
const OTHER_POOJA_REPORT_KEYS: PoojaReportKey[] = ['saturdayNavagraha', 'pradosha'];

type ReportTabKey = 'database' | 'general' | 'other' | 'expenses';

const REPORT_TABS: { key: ReportTabKey; label: string; description: string }[] = [
  {
    key: 'database',
    label: 'Database',
    description: 'Raw donor and registration datasets that power the portal.',
  },
  {
    key: 'general',
    label: 'General Pooja Report',
    description: 'General pooja exports covering till oil, neivedhyam, and gau samrakshana seva.',
  },
  {
    key: 'other',
    label: 'Other Pooja Report',
    description: 'Other recurring pooja exports such as Navagraha and Pradosha.',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    description: 'Track temple expenses and view recorded payouts.',
  },
];

const OPENING_BALANCE_HEADERS: string[] = [
  'S.no',
  'Donor ID',
  'Name',
  'Phone',
  'Opening Balance',
] as const;

const DATABASE_BUTTON_INFO = [
  {
    label: 'Download Database',
    description:
      'Bundles a fresh `.sql.gz` dump of the live database together with the five most recent backups into a single `.tar.gz` archive for restoration.',
  },
  {
    label: 'Donor Database',
    description:
      'Exports all donors plus family members into XLSX files, including per-family workbooks for offline sharing.',
  },
  {
    label: 'Pooja Registration Database',
    description:
      'Downloads cart snapshots and paid registrations so the team can reconcile bookings and payments.',
  },
  {
    label: 'Donor Details',
    description:
      'Provides a compact list of temple donor IDs, names, and phone numbers for quick reference.',
  },
  {
    label: 'Opening Balance',
    description:
      'Exports each donor\'s opening balance to help review outstanding pledges or credits.',
  },
] as const;

const POOJA_REPORT_HINTS: Record<PoojaReportKey, string> = {
  tillOil:
    'Export the Till Oil for Lamps registrations; pick PDF or Excel in the dialog to download the selected format.',
  nityaNeivedhyam:
    'Grab the Nitya Neivedhyam registrations so you can hand over attendee lists or financial reports.',
  gauSamrakshana:
    'Gather Gau Samrakshana Seva records and choose PDF for a print-ready snapshot or Excel for analysis.',
  saturdayNavagraha:
    'Collect Saturday Navagraha Pooja registrations to track attendance and cart details.',
  pradosha:
    'Retrieve Pradosha Pooja registrations; the dialog lets you download the format that suits your workflow.',
};

const OUTLINE_BUTTON_CLASSES =
  'rounded-full border border-orange-600 px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-orange-600 transition hover:border-orange-700 hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 disabled:hover:border-orange-600';

const buildPoojaReportRows = (registrations: PoojaReportEntry[]): PoojaReportRow[] =>
  registrations.map((registration, index) => ({
    'S.no': index + 1,
    'Temple Donor ID': registration.donor_id ?? '—',
    Name: displayValue(registration.name),
    Phone: displayValue(registration.phone_number),
    'Pooja Date': displayValue(registration.pooja_date),
  }));

const CART_SNAPSHOT_HEADERS: string[] = [
  'S.no',
  'Donor ID',
  'Donor Name',
  'Donor Phone',
  'Cart Item ID',
  'Pooja Name',
  'Pooja Code',
  'Booking Date',
  'Custom Date',
  'Custom Note',
  'Day Option',
  'Day Category',
  'Amount',
  'Post Prasadam',
  'Recurrence Kind',
  'Recurrence Frequency',
  'Target Donor ID',
  'Members',
  'Snapshot Updated At',
];

const PAYMENT_COMPLETED_HEADERS: string[] = [
  'S.no',
  'Payment ID',
  'Donor ID',
  'Donor Name',
  'Registration ID',
  'Pooja Option',
  'Start Date',
  'Amount Paid',
  'Due Amount',
  'Payment Mode',
  'Payment Status',
  'Transaction Reference',
  'Payment Month',
  'Registration Status',
  'Registered By',
  'Group Registration',
  'Recorded At',
];

const buildCartSnapshotRows = (snapshots: CartSnapshotRecord[]) => {
  const output: Record<string, string | number | null>[] = [];
  let sequence = 0;
  snapshots.forEach((snapshot) => {
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    items.forEach((item) => {
      sequence += 1;
      output.push({
        'S.no': sequence,
        'Donor ID': snapshot.donor_id ?? '—',
        'Donor Name': displayValue(snapshot.donor_name),
        'Donor Phone': displayValue(snapshot.donor_phone),
        'Cart Item ID': displayValue(item.cartId),
        'Pooja Name': displayValue(item.poojaName),
        'Pooja Code': displayValue(item.poojaCode),
        'Booking Date': formatDateValue(item.bookingDate),
        'Custom Date': formatDateValue(item.customDayDate),
        'Custom Note': displayValue(item.customDayNote),
        'Day Option': displayValue(item.dayOptionDescription),
        'Day Category': displayValue(item.dayOptionCategory),
        Amount: asNumericValue(item.amount),
        'Post Prasadam': formatBooleanValue(item.postPrasadam),
        'Recurrence Kind': displayValue(item.recurrenceKind),
        'Recurrence Frequency': displayValue(item.recurrenceFrequency),
        'Target Donor ID': item.targetDonorId ?? '—',
        Members: joinCartMemberNames(item.members),
        'Snapshot Updated At': formatDateValue(snapshot.updated_at),
      });
    });
  });
  return output;
};

const buildPaymentCompletedRows = (records: PaymentRecordExportEntry[]) =>
  records.map((record, index) => ({
    'S.no': index + 1,
    'Payment ID': record.id ?? '—',
    'Donor ID': record.donor ?? '—',
    'Donor Name': displayValue(record.donor_name),
    'Registration ID': record.registration ?? '—',
    'Pooja Option': displayValue(record.pooja_option),
    'Start Date': formatDateValue(record.registration_start_date),
    'Amount Paid': asNumericValue(record.amount),
    'Due Amount': asNumericValue(record.pooja_due_amount),
    'Payment Mode': displayValue(record.mode),
    'Payment Status': displayValue(record.status),
    'Transaction Reference': displayValue(record.transaction_reference),
    'Payment Month': formatDateValue(record.payment_month),
    'Registration Status': displayValue(record.registration_status),
    'Registered By': displayValue(record.registration_donor_name),
    'Group Registration': formatBooleanValue(record.registration_is_group_registration),
    'Recorded At': formatDateValue(record.created_at),
  }));

const fetchAllPayments = async (params: Record<string, string | number> = {}) => {
  const pageSize = 250;
  let page = 1;
  const records: PaymentRecordExportEntry[] = [];

  while (true) {
    const { data } = await api.get('payments/records/', {
      params: {
        ...params,
        page,
        page_size: pageSize,
      },
    });

    const pageResults = extractResults<PaymentRecordExportEntry>(data);
    if (!pageResults.length) {
      break;
    }

    records.push(...pageResults);

    const hasNext = Boolean(data?.next);
    if (!hasNext || pageResults.length < pageSize) {
      break;
    }
    page += 1;
  }

  return records;
};

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

const extractFilenameFromContentDisposition = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const sanitizedValue = value.trim();
  const filenameStarMatch = sanitizedValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (filenameStarMatch?.[1]) {
    try {
      return decodeURIComponent(filenameStarMatch[1]);
    } catch {
      return filenameStarMatch[1];
    }
  }
  const filenameMatch = sanitizedValue.match(/filename="([^"]+)"/i) ?? sanitizedValue.match(/filename=([^;]+)/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1].trim();
  }
  return null;
};

const normalizeText = (value?: string | null) => (value ?? '').trim().toLowerCase();

const buildPendingCartRows = (snapshots: CartSnapshotRecord[], key: PoojaReportKey): PoojaReportRow[] => {
  const targetName = POOJA_REPORTS[key].poojaOptionName;
  if (!targetName) {
    return [];
  }

  const normalizedTarget = normalizeText(targetName);
  let sequence = 0;
  const rows: PoojaReportRow[] = [];

  snapshots.forEach((snapshot) => {
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    items.forEach((item) => {
      const itemName = normalizeText(item.poojaName);
      if (!itemName) {
        return;
      }
      if (itemName !== normalizedTarget && !itemName.includes(normalizedTarget)) {
        return;
      }

      sequence += 1;
      rows.push({
        'S.no': sequence,
        'Temple Donor ID': snapshot.donor_id ?? '—',
        Name: displayValue(snapshot.donor_name),
        Phone: displayValue(snapshot.donor_phone),
        'Pooja Date': displayValue(item.customDayDate ?? item.bookingDate ?? ''),
      });
    });
  });

  return rows;
};

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

  pdfDoc.getBlob((blob: Blob) => {
    triggerBlobDownload(blob, `${filenameBase}.pdf`);
  });
};

const ReportPage = () => {
  const [exportingDonorDatabase, setExportingDonorDatabase] = useState(false);
  const [exportingDatabaseBackup, setExportingDatabaseBackup] = useState(false);
  const [exportingDonorDetails, setExportingDonorDetails] = useState(false);
  const [exportingPoojaRegistrationDatabase, setExportingPoojaRegistrationDatabase] = useState(false);
  const [exportingReports, setExportingReports] = useState(initialPoojaExportState);
  const [pendingReportKey, setPendingReportKey] = useState<PoojaReportKey | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingOpeningBalance, setExportingOpeningBalance] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTabKey>('database');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleDatabaseBackupDownload = useCallback(async () => {
    if (exportingDatabaseBackup) return;

    setExportError(null);
    setExportingDatabaseBackup(true);

    try {
      const response = await api.get<Blob>('reports/database-download/', {
        responseType: 'blob',
      });

      const blobData = response.data;
      if (!(blobData instanceof Blob)) {
        throw new Error('Received an invalid database backup file.');
      }

      const contentDispositionHeader =
        response.headers['content-disposition'] ?? response.headers['Content-Disposition'] ?? null;
      const headerFilename = extractFilenameFromContentDisposition(contentDispositionHeader);
      const fallbackFilename = `temple-database-${formatFilenameDate(new Date())}.sql.gz`;
      const rawFilename = headerFilename ?? fallbackFilename;
      const downloadFilename = sanitizeFilename(rawFilename) || fallbackFilename;

      triggerBlobDownload(blobData, downloadFilename);
    } catch (error) {
      console.error('Failed to download database backup', error);
      let detail: string | null = null;
      const axiosError = error as AxiosError<{ detail?: string | null }>;
      const responseData = axiosError?.response?.data;

      if (responseData instanceof Blob) {
        try {
          const text = await responseData.text();
          try {
            const parsed = JSON.parse(text);
            detail = parsed?.detail ?? parsed?.message ?? text;
          } catch {
            detail = text;
          }
        } catch {
          // ignore silently
        }
      } else if (responseData && typeof responseData === 'object') {
        detail = (responseData as { detail?: string | null }).detail ?? null;
      }

      if (detail) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the database backup right now.');
      }
    } finally {
      setExportingDatabaseBackup(false);
    }
  }, [exportingDatabaseBackup]);

  const handlePoojaRegistrationDatabaseDownload = useCallback(async () => {
    if (exportingPoojaRegistrationDatabase) return;

    setExportError(null);
    setExportingPoojaRegistrationDatabase(true);

    try {
      const [cartResponse, completedPayments] = await Promise.all([
        api.get<CartSnapshotRecord[]>('pooja/cart-snapshots/report/'),
        fetchAllPayments({ status: 'success' }),
      ]);
      const snapshots: CartSnapshotRecord[] = Array.isArray(cartResponse.data)
        ? cartResponse.data
        : [];
      const cartRows = buildCartSnapshotRows(snapshots);
      const paymentRows = buildPaymentCompletedRows(completedPayments);

      if (!cartRows.length && !paymentRows.length) {
        setExportError('No cart snapshots or completed payments are available at the moment.');
        return;
      }

      const timestamp = formatFilenameDate(new Date());

      const cartWorkbook = XLSX.utils.book_new();
      const cartSheet = XLSX.utils.json_to_sheet(cartRows, { header: CART_SNAPSHOT_HEADERS });
      XLSX.utils.book_append_sheet(cartWorkbook, cartSheet, 'Cart Snapshot');
      downloadWorkbook(cartWorkbook, `pooja-cart-snapshots-${timestamp}.xlsx`);

      const paymentWorkbook = XLSX.utils.book_new();
      const paymentSheet = XLSX.utils.json_to_sheet(paymentRows, { header: PAYMENT_COMPLETED_HEADERS });
      XLSX.utils.book_append_sheet(paymentWorkbook, paymentSheet, 'Paid Registrations');
      downloadWorkbook(paymentWorkbook, `pooja-registrations-paid-${timestamp}.xlsx`);
    } catch (error) {
      const detail =
        (error as AxiosError<{ detail?: string | null }>)?.response?.data?.detail ?? null;
      console.error('Failed to download pooja registration database', error);
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the pooja registration database right now.');
      }
    } finally {
      setExportingPoojaRegistrationDatabase(false);
    }
  }, [exportingPoojaRegistrationDatabase]);

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

      const headerKeys = ['S.no', 'Temple Donor ID', 'Name', 'Phone'];
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

  const handleOpeningBalanceDownload = useCallback(async () => {
    if (exportingOpeningBalance) return;

    setExportError(null);
    setExportingOpeningBalance(true);

    try {
      const donors = await fetchDonors();
      if (!donors.length) {
        setExportError('No donor records are available at the moment.');
        return;
      }

      const rows = donors.map((donor, index) => ({
        'S.no': index + 1,
        'Donor ID': displayValue(donor.profile?.donor_id),
        Name: displayValue(donor.user.name),
        Phone: displayValue(donor.user.phone_number),
        'Opening Balance': donor.profile?.custom_number ?? null,
      }));

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows, { header: OPENING_BALANCE_HEADERS });
      XLSX.utils.book_append_sheet(workbook, sheet, 'Opening Balance');

      downloadWorkbook(workbook, `opening-balance-${formatFilenameDate(new Date())}.xlsx`);
    } catch (error) {
      const detail =
        (error as AxiosError<{ detail?: string | null }>)?.response?.data?.detail ?? null;
      console.error('Failed to download opening balance report', error);
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the opening balance report right now.');
      }
    } finally {
      setExportingOpeningBalance(false);
    }
  }, [exportingOpeningBalance, fetchDonors]);

  const downloadPoojaReport = useCallback(
    async (key: PoojaReportKey, format: PoojaReportFormat) => {
      if (exportingReports[key]) return;

      const report = POOJA_REPORTS[key];
      setExportError(null);
      setExportingReports((prev) => ({ ...prev, [key]: true }));

      try {
        const { data } = await api.get(report.endpoint);
        const registrations = extractResults<PoojaReportEntry>(data);

        let rows = buildPoojaReportRows(registrations);

        if (!rows.length) {
          try {
            const cartResponse = await api.get<CartSnapshotRecord[]>('pooja/cart-snapshots/report/');
            const snapshots: CartSnapshotRecord[] = Array.isArray(cartResponse.data)
              ? cartResponse.data
              : [];
            const pendingRows = buildPendingCartRows(snapshots, key);
            if (pendingRows.length > 0) {
              rows = pendingRows;
            }
          } catch (fallbackError) {
            console.error('Failed to load pending cart snapshots', fallbackError);
          }
        }

        if (!rows.length) {
          setExportError(report.emptyMessage);
          return;
        }

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

  const downloadDatabaseLabel = useMemo(
    () => (exportingDatabaseBackup ? 'Preparing download…' : 'Download Database'),
    [exportingDatabaseBackup],
  );

  const buttonLabel = useMemo(
    () => (exportingDonorDatabase ? 'Preparing download…' : 'Donor Database'),
    [exportingDonorDatabase],
  );

  const detailsButtonLabel = useMemo(
    () => (exportingDonorDetails ? 'Preparing download…' : 'Donor Details'),
    [exportingDonorDetails],
  );

  const registrationDatabaseLabel = useMemo(
    () =>
      exportingPoojaRegistrationDatabase ? 'Preparing download…' : 'Pooja Registration Database',
    [exportingPoojaRegistrationDatabase],
  );

  const openingBalanceLabel = useMemo(
    () => (exportingOpeningBalance ? 'Preparing download…' : 'Opening Balance'),
    [exportingOpeningBalance],
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
  const activeTabMeta =
    REPORT_TABS.find((tab) => tab.key === activeTab) ?? REPORT_TABS[0];

  const getTabButtonClass = (tabKey: ReportTabKey) =>
    `px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
      activeTab === tabKey
        ? 'bg-orange-600 text-white shadow-sm'
        : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-700'
    } ${mobileMenuOpen ? 'block w-full text-left' : 'rounded-full'}`;

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header Section - Always at the top */}
      <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-800">Report</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Consolidated insights about donations and pooja activity across the portal.
            </p>
          </div>
        </div>

        {/* Tab Navigation - Below the header */}
        <div className="mt-4 sm:mt-6">
          {/* Mobile menu toggle */}
          <div className="sm:hidden flex justify-end mb-2">
            <button
              type="button"
              className="text-slate-600 hover:text-slate-800 focus:outline-none p-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Tab navigation - responsive layout */}
          <div className={`${mobileMenuOpen ? 'block' : 'hidden sm:block'}`}>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
              {REPORT_TABS.map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  className={getTabButtonClass(tab.key)}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setMobileMenuOpen(false);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-500">{activeTabMeta.description}</p>
        </div>
      </section>

      {/* Content Section - Below the header with tabs */}
      <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm">
        {activeTab === 'database' && (
          <div className="space-y-4">
            
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">Database Reports</h2>
            <div className="mt-4 space-y-2 text-xs sm:text-sm text-slate-500">
              {DATABASE_BUTTON_INFO.map((info) => (
                <p key={info.label} className="leading-relaxed">
                  <span className="font-semibold text-slate-800">{info.label}</span>{' '}
                  {info.description}
                </p>
              ))}
            </div>
            <div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={handleDatabaseBackupDownload}
                disabled={exportingDatabaseBackup}
                className={OUTLINE_BUTTON_CLASSES}
              >
                {downloadDatabaseLabel}
              </button>

              <button
                type="button"
                onClick={handleDonorDatabaseDownload}
                disabled={exportingDonorDatabase}
                className={OUTLINE_BUTTON_CLASSES}
              >
                {buttonLabel}
              </button>

              <button
                type="button"
                onClick={handlePoojaRegistrationDatabaseDownload}
                disabled={exportingPoojaRegistrationDatabase}
                className={OUTLINE_BUTTON_CLASSES}
              >
                {registrationDatabaseLabel}
              </button>

              <button
                type="button"
                onClick={handleDonorDetailsDownload}
                disabled={exportingDonorDetails}
                className={OUTLINE_BUTTON_CLASSES}
              >
                {detailsButtonLabel}
              </button>

              <button
                type="button"
                onClick={handleOpeningBalanceDownload}
                disabled={exportingOpeningBalance}
                className={OUTLINE_BUTTON_CLASSES}
              >
                {openingBalanceLabel}
              </button>
            </div>
            

          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">General Pooja Reports</h2>
            
            <div className="mt-4 space-y-2 text-xs sm:text-sm text-slate-500">
              {GENERAL_POOJA_REPORT_KEYS.map((key) => (
                <p key={key} className="leading-relaxed">
                  <span className="font-semibold text-slate-800">{POOJA_REPORTS[key].label}</span>{' '}
                  {POOJA_REPORT_HINTS[key]}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {GENERAL_POOJA_REPORT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openReportFormatDialog(key)}
                  disabled={isExportingPoojaReport(key)}
                  className={OUTLINE_BUTTON_CLASSES}
                >
                  {getPoojaReportLabel(key)}
                </button>
              ))}
            </div>
            

          </div>
        )}

        {activeTab === 'other' && (
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">Other Pooja Reports</h2>
            
            <div className="mt-4 space-y-2 text-xs sm:text-sm text-slate-500">
              {OTHER_POOJA_REPORT_KEYS.map((key) => (
                <p key={key} className="leading-relaxed">
                  <span className="font-semibold text-slate-800">{POOJA_REPORTS[key].label}</span>{' '}
                  {POOJA_REPORT_HINTS[key]}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OTHER_POOJA_REPORT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openReportFormatDialog(key)}
                  disabled={isExportingPoojaReport(key)}
                  className={OUTLINE_BUTTON_CLASSES}
                >
                  {getPoojaReportLabel(key)}
                </button>
              ))}
            </div>
            
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">Expense Management</h2>
            <ExpensesPage />
          </div>
        )}

        {exportError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <p className="text-xs sm:text-sm font-medium text-rose-600">{exportError}</p>
          </div>
        )}
      </section>

      {/* Responsive modal/dialog */}
      {pendingReportMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8"
          onClick={closeReportFormatDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pooja-report-format-title"
            className="w-full max-w-sm rounded-2xl bg-white p-4 sm:p-6 shadow-xl mx-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="pooja-report-format-title"
              className="text-base sm:text-lg font-semibold text-slate-800"
            >
              Download format
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Choose the format for the {pendingReportMeta.label} report.
            </p>
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={() => handleFormatSelection('pdf')}
                className="w-full sm:flex-1 rounded-full bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleFormatSelection('excel')}
                className="w-full sm:flex-1 rounded-full border border-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 transition hover:border-slate-700 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Excel
              </button>
            </div>
            <p className="mt-2 sm:mt-3 text-xs text-slate-500">
              PDF gives you a print-ready layout while Excel downloads the raw rows; use Cancel to exit without downloading.
            </p>
            <button
              type="button"
              onClick={closeReportFormatDialog}
              className="mt-3 sm:mt-4 w-full rounded-full border border-slate-200 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
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
