import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import * as XLSX from 'xlsx';
import api, { extractResults } from '../lib/api';
import { loadPdfMake, PDF_TAMIL_FONT_NAME, verifyTamilFont } from '../lib/pdfMakeLoader';
import {
  canDownloadReports,
  REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE,
  useAuthStore,
} from '../store/auth';
import type { CartItem } from '../store/cart';

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
    last_payment_date?: string | null;
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

interface PoojaRegistrationRecord {
  id?: number | null;
  donor?: number | null;
  donor_name?: string | null;
  pooja_option?: string | null;
  day_option?: string | null;
  start_date?: string | null;
  quantity?: number | null;
  is_group_registration?: boolean | null;
  post_prasadam?: boolean | null;
  additional_notes?: string | null;
  total_amount?: string | number | null;
  status?: string | null;
  registration_number?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface RecurringPlanDueRegistration {
  id?: number | null;
  pooja_reg_id?: string | null;
  start_date?: string | null;
  total_amount?: string | number | null;
  paid_amount?: string | number | null;
  due_amount?: string | number | null;
  is_paid?: boolean | null;
  status?: string | null;
}

interface RecurringPoojaPlanRecord {
  id?: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  donor_email?: string | null;
  pooja_option_name?: string | null;
  pooja_option_code?: string | null;
  day_option_description?: string | null;
  day_option_code?: string | null;
  recurrence_kind?: string | null;
  recurrence_frequency?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_occurrence?: string | null;
  one_time_date?: string | null;
  amount?: string | number | null;
  is_active?: boolean | null;
  pause_from?: string | null;
  pause_until?: string | null;
  origin_registration_created_at?: string | null;
  origin_registration_updated_at?: string | null;
  origin_registration_id?: number | null;
  metadata?: Record<string, unknown> | null;
  due_registration?: RecurringPlanDueRegistration | null;
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
  'postPrasadam',
] as const;

type PoojaReportKey = (typeof POOJA_REPORT_KEYS)[number];

const POOJA_OPTION_NAMES: Record<PoojaReportKey, string> = {
  saturdayNavagraha: '4 saturday navagraha pooja per month',
  pradosha: '2 pradosha pooja per month',
  tillOil: 'till oil for lamps',
  nityaNeivedhyam: 'nitya neivedhyam',
  gauSamrakshana: 'gau samrakshana seva',
  postPrasadam: '',
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
  postPrasadam: {
    endpoint: 'pooja/registrations/post-prasadam-report/',
    label: 'Post Prasadam Report',
    filenamePrefix: 'post-prasadam-report',
    sheetName: 'Post Prasadam',
    emptyMessage: 'No donors have selected Post Prasadam yet.',
    errorMessage: 'Unable to download the Post Prasadam report right now.',
    poojaOptionName: POOJA_OPTION_NAMES.postPrasadam,
  },
};

const initialPoojaExportState: Record<PoojaReportKey, boolean> = POOJA_REPORT_KEYS.reduce(
  (acc, key) => {
    acc[key] = false;
    return acc;
  },
  {} as Record<PoojaReportKey, boolean>,
);

const GENERAL_POOJA_REPORT_KEYS: PoojaReportKey[] = [
  'tillOil',
  'nityaNeivedhyam',
  'gauSamrakshana',
  'postPrasadam',
  'saturdayNavagraha',
  'pradosha',
];

type ReportTabKey = 'database' | 'general';

const REPORT_TABS: { key: ReportTabKey; label: string; description: string }[] = [
  {
    key: 'database',
    label: 'Database',
    description: '',
  },
  {
    key: 'general',
    label: 'General Pooja Report',
    description: '',
  },
];

const OPENING_BALANCE_HEADERS: string[] = [
  'S.no',
  'Donor ID',
  'Name',
  'Phone',
  'Opening Balance',
] as const;

const EXCESS_DONATION_HEADERS: string[] = [
  'S.no',
  'Temple Donor ID',
  'Name',
  'Phone',
  'Excess Donation Amount',
  'Donation Added Date',
  'Export Date',
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
    label: 'Payment Details',
    description:
      'Exports payment records, passbook entries, and donor-wise statements into a single Excel workbook for audits.',
  },
  {
    label: 'General Donation (Homepage)',
    description:
      'Exports all records from the general donation register into a single Excel workbook.',
  },
  {
    label: 'Donor Feedback',
    description:
      'Exports all donor corner feedback entries with donor name, phone number, message, and submission timestamp.',
  },
  {
    label: 'Opening Balance',
    description:
      'Exports each donor\'s opening balance to help review outstanding pledges or credits.',
  },
  {
    label: 'Excess Donation',
    description:
      'Lists donors whose excess ₹1-₹5 contributions were routed to the temple donation pool.',
  },
] as const;

const POOJA_REPORT_HINTS: Record<PoojaReportKey, string> = {
  tillOil:
    'Export the Till Oil for Lamps registrations; pick PDF or Excel in the dialog to download the selected format.',
  nityaNeivedhyam:
    'Grab the Nitya Neivedhyam registrations so you can hand over attendee lists or financial reports.',
  gauSamrakshana:
    'Gather Gau Samrakshana Seva records and choose PDF for a print-ready snapshot or Excel for analysis.',
  postPrasadam:
    'Download donor registrations where Post Prasadam was selected as Yes.',
  saturdayNavagraha:
    'Collect Saturday Navagraha Pooja registrations to track attendance and cart details.',
  pradosha:
    'Retrieve Pradosha Pooja registrations; the dialog lets you download the format that suits your workflow.',
};

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

const POOJA_REGISTRATIONS_HEADERS: string[] = [
  'S.no',
  'Registration ID',
  'Donor ID',
  'Donor Name',
  'Pooja Option',
  'Day Option',
  'Start Date',
  'Quantity',
  'Is Group Registration',
  'Post Prasadam',
  'Additional Notes',
  'Total Amount',
  'Status',
  'Created At',
  'Updated At',
] as const;

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

const POOJA_PLAN_HEADERS: string[] = [
  'S.no',
  'Donor Name',
  'Donor Phone',
  'Donor Email',
  'Pooja Option',
  'Pooja Code',
  'Day Option',
  'Recurrence Kind',
  'Recurrence Frequency',
  'Amount',
  'Start Date',
  'Next Occurrence',
  'Last Occurrence',
  'Preferred / One-time Date',
  'Is Active',
  'Pause From',
  'Pause Until',
  'Origin Registration ID',
  'Origin Registration Created At',
  'Origin Registration Updated At',
  'Due Registration ID',
  'Due Registration Status',
  'Due Amount',
  'Paid Amount',
  'Total Amount',
] as const;

const buildPoojaPlanRows = (plans: RecurringPoojaPlanRecord[]) =>
  plans.map((plan, index) => ({
    'S.no': index + 1,
    'Donor Name': displayValue(plan.donor_name),
    'Donor Phone': displayValue(plan.donor_phone),
    'Donor Email': displayValue(plan.donor_email),
    'Pooja Option': displayValue(plan.pooja_option_name),
    'Pooja Code': displayValue(plan.pooja_option_code),
    'Day Option': displayValue(plan.day_option_description ?? plan.day_option_code),
    'Recurrence Kind': displayValue(plan.recurrence_kind),
    'Recurrence Frequency': displayValue(plan.recurrence_frequency),
    Amount: asNumericValue(plan.amount),
    'Start Date': formatDateValue(plan.start_date),
    'Next Occurrence': formatDateValue(plan.next_occurrence),
    'Last Occurrence': formatDateValue(plan.last_occurrence),
    'Preferred / One-time Date': formatDateValue(plan.one_time_date),
    'Is Active': formatBooleanValue(plan.is_active),
    'Pause From': formatDateValue(plan.pause_from),
    'Pause Until': formatDateValue(plan.pause_until),
    'Origin Registration ID': plan.origin_registration_id ?? '—',
    'Origin Registration Created At': formatDateValue(plan.origin_registration_created_at),
    'Origin Registration Updated At': formatDateValue(plan.origin_registration_updated_at),
    'Due Registration ID': plan.due_registration?.id ?? '—',
    'Due Registration Status': displayValue(plan.due_registration?.status),
    'Due Amount': asNumericValue(plan.due_registration?.due_amount),
    'Paid Amount': asNumericValue(plan.due_registration?.paid_amount),
    'Total Amount': asNumericValue(plan.due_registration?.total_amount),
  }));

const buildPoojaRegistrationRows = (registrations: PoojaRegistrationRecord[]) =>
  registrations.map((registration, index) => ({
    'S.no': index + 1,
    'Registration ID': displayValue(registration.registration_number ?? registration.id),
    'Donor ID': registration.donor ?? '—',
    'Donor Name': displayValue(registration.donor_name),
    'Pooja Option': displayValue(registration.pooja_option),
    'Day Option': displayValue(registration.day_option),
    'Start Date': formatDateValue(registration.start_date),
    Quantity: registration.quantity ?? 1,
    'Is Group Registration': formatBooleanValue(registration.is_group_registration),
    'Post Prasadam': formatBooleanValue(registration.post_prasadam),
    'Additional Notes': displayValue(registration.additional_notes),
    'Total Amount': asNumericValue(registration.total_amount),
    Status: displayValue(registration.status),
    'Created At': formatDateValue(registration.created_at),
    'Updated At': formatDateValue(registration.updated_at),
  }));

const isCHRTPlan = (plan: RecurringPoojaPlanRecord) => {
  const recurrenceKind = (plan.recurrence_kind ?? '').toLowerCase();
  const dayCode = (plan.day_option_code ?? '').trim().toUpperCase();
  return recurrenceKind === 'recurring' && (dayCode === 'CHRT' || Boolean(plan.one_time_date));
};

const partitionPlanRows = (plans: RecurringPoojaPlanRecord[]) => {
  const recurring: RecurringPoojaPlanRecord[] = [];
  const oneTime: RecurringPoojaPlanRecord[] = [];
  const chrt: RecurringPoojaPlanRecord[] = [];
  plans.forEach((plan) => {
    const donorName = (plan.donor_name ?? '').trim().toLowerCase();
    if (donorName === 'temple admin') {
      return;
    }
    const recurrenceKind = (plan.recurrence_kind ?? '').toLowerCase();
    if (isCHRTPlan(plan)) {
      chrt.push(plan);
      return;
    }
    if (recurrenceKind === 'one_time_extra') {
      oneTime.push(plan);
      return;
    }
    if (recurrenceKind === 'recurring') {
      recurring.push(plan);
    }
  });
  return { recurring, oneTime, chrt };
};

const createSheetWithHeaders = (
  headers: readonly string[],
  rows: Record<string, string | number | null>[] = [],
) => {
  if (rows.length > 0) {
    return XLSX.utils.json_to_sheet(rows, { header: headers as string[] });
  }
  return XLSX.utils.aoa_to_sheet([[...headers]]);
};

const fetchAllRecurringPlans = async (): Promise<RecurringPoojaPlanRecord[]> => {
  const pageSize = 250;
  let page = 1;
  const records: RecurringPoojaPlanRecord[] = [];
  while (true) {
    const { data } = await api.get('pooja/recurrence/plans/', {
      params: {
        page,
        page_size: pageSize,
      },
    });
    const pageResults = extractResults<RecurringPoojaPlanRecord>(data);
    if (!pageResults.length) {
      break;
    }
    records.push(...pageResults);
    const hasNext = Boolean(data?.next);
    if (!hasNext) {
      break;
    }
    page += 1;
  }
  return records;
};

const fetchAllRegistrations = async (): Promise<PoojaRegistrationRecord[]> => {
  const pageSize = 250;
  let page = 1;
  const records: PoojaRegistrationRecord[] = [];
  while (true) {
    const { data } = await api.get('pooja/registrations/', {
      params: {
        page,
        page_size: pageSize,
      },
    });
    const pageResults = extractResults<PoojaRegistrationRecord>(data);
    if (!pageResults.length) {
      break;
    }
    records.push(...pageResults);
    const hasNext = Boolean(data?.next);
    if (!hasNext) {
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

// Icons Components
const DatabaseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PoojaIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const ReportPage = () => {
  const user = useAuthStore((state) => state.user);
  const [exportingDonorDatabase, setExportingDonorDatabase] = useState(false);
  const [exportingDatabaseBackup, setExportingDatabaseBackup] = useState(false);
  const [exportingDonorDetails, setExportingDonorDetails] = useState(false);
  const [exportingPoojaRegistrationDatabase, setExportingPoojaRegistrationDatabase] = useState(false);
  const [exportingReports, setExportingReports] = useState(initialPoojaExportState);
  const [exportingExcessDonation, setExportingExcessDonation] = useState(false);
  const [exportingPaymentDetails, setExportingPaymentDetails] = useState(false);
  const [exportingGeneralDonation, setExportingGeneralDonation] = useState(false);
  const [exportingDonorFeedback, setExportingDonorFeedback] = useState(false);
  const [pendingReportKey, setPendingReportKey] = useState<PoojaReportKey | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingOpeningBalance, setExportingOpeningBalance] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTabKey>('database');

  useEffect(() => {
    loadPdfMake().catch((err) => console.error('pdfMake preload failed', err));
  }, []);

  const ensureReportDownloadAccess = useCallback(() => {
    if (canDownloadReports(user)) {
      return true;
    }
    setExportError(REPORT_DOWNLOAD_ACCESS_DENIED_MESSAGE);
    return false;
  }, [user]);

  const fetchDonors = useCallback(async (): Promise<DonorRecord[]> => {
    const { data } = await api.get<DonorRecord[]>('auth/donors/');
    const donors = extractResults<DonorRecord>(data);
    return donors;
  }, []);

  const handleDonorDatabaseDownload = useCallback(async () => {
    if (exportingDonorDatabase) return;
    if (!ensureReportDownloadAccess()) return;
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
  }, [ensureReportDownloadAccess, exportingDonorDatabase, fetchDonors]);

  const handleDatabaseBackupDownload = useCallback(async () => {
    if (exportingDatabaseBackup) return;
    if (!ensureReportDownloadAccess()) return;
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
  }, [ensureReportDownloadAccess, exportingDatabaseBackup]);

  const handlePoojaRegistrationDatabaseDownload = useCallback(async () => {
    if (exportingPoojaRegistrationDatabase) return;
    if (!ensureReportDownloadAccess()) return;
    setExportError(null);
    setExportingPoojaRegistrationDatabase(true);
    try {
      const [recurringPlans, registrations, cartResponse] = await Promise.all([
        fetchAllRecurringPlans(),
        fetchAllRegistrations(),
        api.get<CartSnapshotRecord[]>('pooja/cart-snapshots/report/'),
      ]);

      const snapshots: CartSnapshotRecord[] = Array.isArray(cartResponse.data)
        ? cartResponse.data
        : [];

      const { recurring, oneTime, chrt } = partitionPlanRows(recurringPlans);

      const filteredRegistrations = registrations.filter((registration) => {
        const donorName = (registration.donor_name ?? '').trim().toLowerCase();
        return donorName !== 'temple admin';
      });

      const allRegistrationRows = buildPoojaRegistrationRows(filteredRegistrations);

      const originRegistrationIds = new Set(
        recurringPlans
          .map((plan) => plan.origin_registration_id)
          .filter((value): value is number => typeof value === 'number'),
      );

      const oneTimeRegistrations = filteredRegistrations.filter(
        (registration) => !originRegistrationIds.has(registration.id ?? -1),
      );

      const registrationRows = buildPoojaRegistrationRows(oneTimeRegistrations);

      const timestamp = formatFilenameDate(new Date());

      const registrationWorkbook = XLSX.utils.book_new();

      const recurringSheet = createSheetWithHeaders(POOJA_PLAN_HEADERS, buildPoojaPlanRows(recurring));
      XLSX.utils.book_append_sheet(registrationWorkbook, recurringSheet, 'Recurring Pooja');

      const allRegistrationsSheet = createSheetWithHeaders(POOJA_REGISTRATIONS_HEADERS, allRegistrationRows);
      XLSX.utils.book_append_sheet(registrationWorkbook, allRegistrationsSheet, 'Pooja Registration');

      const oneTimeSheet = createSheetWithHeaders(
        POOJA_REGISTRATIONS_HEADERS,
        registrationRows,
      );
      XLSX.utils.book_append_sheet(registrationWorkbook, oneTimeSheet, 'One-time Registered Pooja');

      const chrtSheet = createSheetWithHeaders(POOJA_PLAN_HEADERS, buildPoojaPlanRows(chrt));
      XLSX.utils.book_append_sheet(registrationWorkbook, chrtSheet, 'CHRT Pooja');

      downloadWorkbook(registrationWorkbook, `pooja-registration-${timestamp}.xlsx`);

      const cartRows = buildCartSnapshotRows(snapshots);
      const cartWorkbook = XLSX.utils.book_new();
      const cartSheet = createSheetWithHeaders(CART_SNAPSHOT_HEADERS, cartRows);
      XLSX.utils.book_append_sheet(cartWorkbook, cartSheet, 'Cart Snapshots');
      downloadWorkbook(cartWorkbook, `pooja-cart-snapshots-${timestamp}.xlsx`);
    } catch (error) {
      const detail =
        (error as AxiosError<{ detail?: string | null }>)?.response?.data?.detail ?? null;
      console.error('Failed to download pooja registration database', error);
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the pooja registration database or cart snapshots right now.');
      }
    } finally {
      setExportingPoojaRegistrationDatabase(false);
    }
  }, [ensureReportDownloadAccess, exportingPoojaRegistrationDatabase]);

  const handleDonorDetailsDownload = useCallback(async () => {
    if (exportingDonorDetails) return;
    if (!ensureReportDownloadAccess()) return;
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
  }, [ensureReportDownloadAccess, exportingDonorDetails, fetchDonors]);

  const handlePaymentDetailsDownload = useCallback(async () => {
    if (exportingPaymentDetails) return;
    if (!ensureReportDownloadAccess()) return;
    setExportError(null);
    setExportingPaymentDetails(true);
    try {
      const response = await api.get<Blob>('payments/payment-details-export/', {
        responseType: 'blob',
      });
      const blobData = response.data;
      if (!(blobData instanceof Blob)) {
        throw new Error('Received an invalid payment details file.');
      }

      const contentDispositionHeader =
        response.headers['content-disposition'] ?? response.headers['Content-Disposition'] ?? null;
      const headerFilename = extractFilenameFromContentDisposition(contentDispositionHeader);
      const fallbackFilename = `payment-details-${formatFilenameDate(new Date())}.xlsx`;
      const rawFilename = headerFilename ?? fallbackFilename;
      const downloadFilename = sanitizeFilename(rawFilename) || fallbackFilename;

      triggerBlobDownload(blobData, downloadFilename);
    } catch (error) {
      console.error('Failed to download payment details report', error);
      const detail =
        (error as AxiosError<{ detail?: string | null }>).response?.data?.detail ?? null;
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the payment details report right now.');
      }
    } finally {
      setExportingPaymentDetails(false);
    }
  }, [ensureReportDownloadAccess, exportingPaymentDetails]);

  const handleGeneralDonationDownload = useCallback(async () => {
    if (exportingGeneralDonation) return;
    if (!ensureReportDownloadAccess()) return;
    setExportError(null);
    setExportingGeneralDonation(true);
    try {
      const response = await api.get<Blob>('payments/general-donation-export/', {
        responseType: 'blob',
      });
      const blobData = response.data;
      if (!(blobData instanceof Blob)) {
        throw new Error('Received an invalid general donation file.');
      }

      const contentDispositionHeader =
        response.headers['content-disposition'] ?? response.headers['Content-Disposition'] ?? null;
      const headerFilename = extractFilenameFromContentDisposition(contentDispositionHeader);
      const fallbackFilename = `general-donation-${formatFilenameDate(new Date())}.xlsx`;
      const rawFilename = headerFilename ?? fallbackFilename;
      const downloadFilename = sanitizeFilename(rawFilename) || fallbackFilename;

      triggerBlobDownload(blobData, downloadFilename);
    } catch (error) {
      console.error('Failed to download general donation report', error);
      const detail =
        (error as AxiosError<{ detail?: string | null }>).response?.data?.detail ?? null;
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the general donation report right now.');
      }
    } finally {
      setExportingGeneralDonation(false);
    }
  }, [ensureReportDownloadAccess, exportingGeneralDonation]);

  const handleDonorFeedbackDownload = useCallback(async () => {
    if (exportingDonorFeedback) return;
    if (!ensureReportDownloadAccess()) return;
    setExportError(null);
    setExportingDonorFeedback(true);
    try {
      const response = await api.get<Blob>('auth/donor-feedback-export/', {
        responseType: 'blob',
      });
      const blobData = response.data;
      if (!(blobData instanceof Blob)) {
        throw new Error('Received an invalid donor feedback file.');
      }

      const contentDispositionHeader =
        response.headers['content-disposition'] ?? response.headers['Content-Disposition'] ?? null;
      const headerFilename = extractFilenameFromContentDisposition(contentDispositionHeader);
      const fallbackFilename = `donor-feedback-${formatFilenameDate(new Date())}.xlsx`;
      const rawFilename = headerFilename ?? fallbackFilename;
      const downloadFilename = sanitizeFilename(rawFilename) || fallbackFilename;

      triggerBlobDownload(blobData, downloadFilename);
    } catch (error) {
      console.error('Failed to download donor feedback report', error);
      const detail =
        (error as AxiosError<{ detail?: string | null }>).response?.data?.detail ?? null;
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the donor feedback report right now.');
      }
    } finally {
      setExportingDonorFeedback(false);
    }
  }, [ensureReportDownloadAccess, exportingDonorFeedback]);

  const handleOpeningBalanceDownload = useCallback(async () => {
    if (exportingOpeningBalance) return;
    if (!ensureReportDownloadAccess()) return;
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
  }, [ensureReportDownloadAccess, exportingOpeningBalance, fetchDonors]);

  const handleExcessDonationDownload = useCallback(async () => {
    if (exportingExcessDonation) return;
    if (!ensureReportDownloadAccess()) return;
    setExportError(null);
    setExportingExcessDonation(true);
    try {
      const donors = await fetchDonors();
      const filteredDonors = donors.filter((donor) => {
        const donationValue = asNumericValue(donor.profile?.monthly_donation_amount);
        return donationValue !== null && donationValue > 0;
      });

      if (!filteredDonors.length) {
        setExportError('No excess donation records are available right now.');
        return;
      }

      const todayLabel = formatDateValue(new Date().toISOString());
      const rows = filteredDonors.map((donor, index) => ({
        'S.no': index + 1,
        'Temple Donor ID': displayValue(donor.profile?.donor_id ?? '—'),
        Name: displayValue(donor.user.name),
        Phone: displayValue(donor.user.phone_number),
        'Excess Donation Amount': displayValue(donor.profile?.monthly_donation_amount),
        'Donation Added Date': formatDateValue(donor.profile?.last_payment_date),
        'Export Date': todayLabel,
      }));

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows, { header: EXCESS_DONATION_HEADERS });
      XLSX.utils.book_append_sheet(workbook, sheet, 'Excess Donations');
      downloadWorkbook(workbook, `excess-donation-${formatFilenameDate(new Date())}.xlsx`);
    } catch (error) {
      const detail =
        (error as AxiosError<{ detail?: string | null }>)?.response?.data?.detail ?? null;
      console.error('Failed to download excess donation report', error);
      if (typeof detail === 'string' && detail.length > 0) {
        setExportError(detail);
      } else {
        setExportError('Unable to download the excess donation report right now.');
      }
    } finally {
      setExportingExcessDonation(false);
    }
  }, [ensureReportDownloadAccess, exportingExcessDonation, fetchDonors]);

  const downloadPoojaReport = useCallback(
    async (key: PoojaReportKey, format: PoojaReportFormat) => {
      if (exportingReports[key]) return;
      if (!ensureReportDownloadAccess()) return;
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
    [ensureReportDownloadAccess, exportingReports],
  );

  const openReportFormatDialog = useCallback(
    (key: PoojaReportKey) => {
      if (exportingReports[key]) return;
      if (!ensureReportDownloadAccess()) return;
      setPendingReportKey(key);
    },
    [ensureReportDownloadAccess, exportingReports],
  );

  const closeReportFormatDialog = useCallback(() => {
    setPendingReportKey(null);
  }, []);

  const handleFormatSelection = useCallback(
    (format: PoojaReportFormat) => {
      if (!pendingReportKey) return;
      if (!ensureReportDownloadAccess()) {
        setPendingReportKey(null);
        return;
      }
      const key = pendingReportKey;
      setPendingReportKey(null);
      downloadPoojaReport(key, format);
    },
    [ensureReportDownloadAccess, pendingReportKey, downloadPoojaReport],
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                <DocumentIcon />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Reports</h1>
            </div>
            <p className="text-orange-50 text-sm md:text-base max-w-2xl">
              Consolidated insights about donations and pooja activity across the portal
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200/60 bg-slate-50/50">
            <div className="flex flex-wrap gap-2 p-4 md:p-6">
              {REPORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 md:px-6 py-2.5 rounded-xl font-semibold text-sm md:text-base transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 md:p-8">
            {activeTab === 'database' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <DatabaseIcon />
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800">Database Reports</h2>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  {DATABASE_BUTTON_INFO.map((info, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60"
                    >
                      <h3 className="font-semibold text-slate-800 mb-1.5 text-sm md:text-base">{info.label}</h3>
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{info.description}</p>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  <button
                    onClick={handleDatabaseBackupDownload}
                    disabled={exportingDatabaseBackup}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingDatabaseBackup ? <LoadingSpinner /> : <DatabaseIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingDatabaseBackup ? 'Preparing…' : 'Download Database'}
                    </p>
                  </button>

                  <button
                    onClick={handleDonorDatabaseDownload}
                    disabled={exportingDonorDatabase}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingDonorDatabase ? <LoadingSpinner /> : <DocumentIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingDonorDatabase ? 'Preparing…' : 'Donor Database'}
                    </p>
                  </button>

                  <button
                    onClick={handlePoojaRegistrationDatabaseDownload}
                    disabled={exportingPoojaRegistrationDatabase}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingPoojaRegistrationDatabase ? <LoadingSpinner /> : <PoojaIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingPoojaRegistrationDatabase ? 'Preparing…' : 'Pooja Registration Database'}
                    </p>
                  </button>

                  <button
                    onClick={handleDonorDetailsDownload}
                    disabled={exportingDonorDetails}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingDonorDetails ? <LoadingSpinner /> : <DocumentIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingDonorDetails ? 'Preparing…' : 'Donor Details'}
                    </p>
                  </button>

                  <button
                    onClick={handlePaymentDetailsDownload}
                    disabled={exportingPaymentDetails}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingPaymentDetails ? <LoadingSpinner /> : <DownloadIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingPaymentDetails ? 'Preparing…' : 'Payment Details'}
                    </p>
                  </button>

                  <button
                    onClick={handleOpeningBalanceDownload}
                    disabled={exportingOpeningBalance}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingOpeningBalance ? <LoadingSpinner /> : <DocumentIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingOpeningBalance ? 'Preparing…' : 'Opening Balance'}
                    </p>
                  </button>

                  <button
                    onClick={handleGeneralDonationDownload}
                    disabled={exportingGeneralDonation}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingGeneralDonation ? <LoadingSpinner /> : <DownloadIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingGeneralDonation ? 'Preparing…' : 'General Donation'}
                    </p>
                  </button>

                  <button
                    onClick={handleDonorFeedbackDownload}
                    disabled={exportingDonorFeedback}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingDonorFeedback ? <LoadingSpinner /> : <DownloadIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingDonorFeedback ? 'Preparing…' : 'Donor Feedback'}
                    </p>
                  </button>

                  <button
                    onClick={handleExcessDonationDownload}
                    disabled={exportingExcessDonation}
                    className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {exportingExcessDonation ? <LoadingSpinner /> : <DownloadIcon />}
                    </div>
                    <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                      {exportingExcessDonation ? 'Preparing…' : 'Excess Donation'}
                    </p>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <PoojaIcon />
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800">Pooja Reports</h2>
                </div>

                {/* Info Cards */}
                <div className="space-y-3 mb-6">
                  {GENERAL_POOJA_REPORT_KEYS.map((key) => (
                    <div
                      key={key}
                      className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60"
                    >
                      <h3 className="font-semibold text-slate-800 mb-1.5 text-sm md:text-base">
                        {POOJA_REPORTS[key].label}
                      </h3>
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{POOJA_REPORT_HINTS[key]}</p>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {GENERAL_POOJA_REPORT_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => openReportFormatDialog(key)}
                      disabled={isExportingPoojaReport(key)}
                      className="group relative bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-400 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between mb-2">
                        {isExportingPoojaReport(key) ? <LoadingSpinner /> : <PoojaIcon />}
                      </div>
                      <p className="font-semibold text-slate-800 text-sm md:text-base text-left">
                        {getPoojaReportLabel(key)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {exportError && (
              <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-red-800 mb-1">Error</h3>
                    <p className="text-sm text-red-700">{exportError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Format Selection Modal */}
      {pendingReportMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={closeReportFormatDialog}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
              <h3 className="text-xl font-bold text-white">Choose Download Format</h3>
              <p className="text-orange-50 text-sm mt-1">Select the format for {pendingReportMeta.label}</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleFormatSelection('pdf')}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/40"
                >
                  PDF Format
                </button>
                <button
                  onClick={() => handleFormatSelection('excel')}
                  className="flex-1 bg-white border-2 border-orange-500 hover:bg-orange-50 text-orange-600 font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/20"
                >
                  Excel Format
                </button>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                PDF provides a print-ready layout while Excel downloads raw data for further analysis
              </p>

              <button
                onClick={closeReportFormatDialog}
                className="w-full border-2 border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPage;
