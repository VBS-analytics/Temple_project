import type { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import type { SVGProps } from 'react';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { loadPdfMake } from '../lib/pdfMakeLoader';

import api, { extractResults } from '../lib/api';
import { isAdmin, useAuthStore } from '../store/auth';
import { DONATION_AMOUNT } from '../config/globalConstants';

const TEMPLE_COUNT = 4;

interface DonorRecord {
  members?: unknown[];
  profile?: {
    monthly_donation_amount?: number | string | null;
  };
}

interface RegistrationMember {
  id?: number;
  name?: string | null;
  date_of_birth?: string | null;
  family_name?: string | null;
  tamil_star?: string | null;
  gothra?: string | null;
}

interface ProfilePayload {
  profile?: {
    monthly_donation_amount?: number | string | null;
  };
  members?: RegistrationMember[];
}

interface TodayPoojaRecord {
  id: number;
  pooja_reg_id?: string | null;
  start_date?: string | null;
  pooja_option_name?: string | null;
  day_option_description?: string | null;
  donor_name?: string | null;
  post_prasadam?: boolean | null;
  created_at?: string | null;
  members?: RegistrationMember[];
}

const joinDevoteeNames = (members?: RegistrationMember[]) => {
  if (!Array.isArray(members)) {
    return 'N/A';
  }
  const names = members
    .map((member) => (member?.name ?? '').trim())
    .filter((name) => name.length > 0);
  return names.length > 0 ? names.join(', ') : 'N/A';
};

const resolvePoojaId = (pooja: TodayPoojaRecord) => {
  const trimmed = (pooja.pooja_reg_id ?? '').trim();
  if (trimmed) {
    return trimmed;
  }
  return `#${pooja.id}`;
};

const formatBooleanLabel = (value?: boolean | null) => (value ? 'Yes' : 'No');

const resolveDonorName = (value?: string | null) => {
  const trimmed = (value ?? '').trim();
  return trimmed || 'Temple Admin';
};

const formatNumber = (value: number) => value.toLocaleString('en-IN');

const formatCurrency = (value: number) => `Rs. ${formatNumber(value)}`;

const toLocalDateIso = (date: Date) => {
  const offsetMillis = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(offsetMillis).toISOString().split('T')[0];
};

const formatDateDisplay = (value?: string | null) => {
  if (!value) {
    return 'N/A';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    if (year && month && day) {
      return `${day}-${month}-${year}`;
    }
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

const formatDateTimeDisplay = (value?: string | null) => {
  if (!value) {
    return 'N/A';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return formatDateDisplay(value);
  }
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const IconBase = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

const TempleIcon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M3 21h18" />
    <path d="M6 21V9l6-5 6 5v12" />
    <path d="M9 21v-5h6v5" />
  </IconBase>
);

const DonorIcon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M2 20a7 7 0 0 1 14 0" />
    <path d="M17 11a3 3 0 1 0-3-3" />
    <path d="M22 20c0-2.761-2.239-5-5-5" />
  </IconBase>
);

const FamilyIcon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="8" cy="9" r="2.5" />
    <circle cx="16" cy="8" r="3" />
    <path d="M2.5 20c0-3 2.5-5.5 5.5-5.5" />
    <path d="M13 20a7 7 0 0 1 7-7" />
    <path d="M13 20h11" />
  </IconBase>
);

const WalletIcon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M3 7h18v12H3z" />
    <path d="M16 12h5" />
    <path d="M6 3h12l3 4H3z" />
  </IconBase>
);

const CashIcon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="4" y="7" width="16" height="10" rx="2" />
    <path d="M4 11h16" />
    <circle cx="12" cy="12" r="2" />
  </IconBase>
);

const PrasadamIcon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="4" y="10" width="16" height="8" rx="2" />
    <path d="M4 10l8-4 8 4" />
    <path d="M12 10v9" />
  </IconBase>
);

const RefreshIcon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </IconBase>
);

const extractArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object' && 'results' in payload) {
    const results = (payload as { results?: unknown }).results;
    if (Array.isArray(results)) {
      return results;
    }
  }
  return [];
};

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const isAdminUser = isAdmin(user?.role);
  const displayName = (user?.name ?? '').trim() || (isAdminUser ? 'Temple Admin' : 'Devotee');

  const [donorCount, setDonorCount] = useState<number | null>(null);
  const [familyMemberCount, setFamilyMemberCount] = useState<number | null>(null);
  const [donorLoading, setDonorLoading] = useState(true);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [donationAmount, setDonationAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upcomingPoojaCount, setUpcomingPoojaCount] = useState<number | null>(null);
  const [prasadamRequestCount, setPrasadamRequestCount] = useState<number | null>(null);
  const [todayPoojas, setTodayPoojas] = useState<TodayPoojaRecord[]>([]);
  const [todayPoojaLoading, setTodayPoojaLoading] = useState(true);
  const [todayPoojaError, setTodayPoojaError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const selectTodayRegistrations = (registrations: TodayPoojaRecord[]) => {
    const todayIso = toLocalDateIso(new Date());
    const filtered = registrations.filter((item) => {
      if (!item?.start_date) {
        return false;
      }
      return item.start_date.slice(0, 10) === todayIso;
    });
    filtered.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.NaN;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.NaN;
      const aHasTime = !Number.isNaN(aTime);
      const bHasTime = !Number.isNaN(bTime);
      if (aHasTime && bHasTime) {
        return bTime - aTime;
      }
      if (aHasTime) {
        return -1;
      }
      if (bHasTime) {
        return 1;
      }
      return resolvePoojaId(a).localeCompare(resolvePoojaId(b));
    });
    return filtered;
  };

  const loadTodayPoojas = async () => {
    try {
      setTodayPoojaLoading(true);
      setTodayPoojaError(null);
      const response = await api.get('pooja/registrations/', { params: { page_size: 200 } });
      const allRegistrations = extractResults<TodayPoojaRecord>(response.data);
      const todayIso = toLocalDateIso(new Date());
      const filtered = allRegistrations.filter((item) => {
        if (!item?.start_date) {
          return false;
        }
        return item.start_date.slice(0, 10) === todayIso;
      });
      filtered.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.NaN;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.NaN;
        const aHasTime = !Number.isNaN(aTime);
        const bHasTime = !Number.isNaN(bTime);
        if (aHasTime && bHasTime) {
          return bTime - aTime;
        }
        if (aHasTime) {
          return -1;
        }
        if (bHasTime) {
          return 1;
        }
        return resolvePoojaId(a).localeCompare(resolvePoojaId(b));
      });
      setTodayPoojas(filtered);
    } catch (err) {
      console.error("Failed to load today's pooja registrations", err);
      const axiosError = err as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;
      setTodayPoojaError(
        typeof detail === 'string' && detail.trim()
          ? detail
          : "Unable to load today's pooja details right now."
      );
      setTodayPoojas([]);
    } finally {
      setTodayPoojaLoading(false);
    }
  };

  const loadAdminMetrics = async () => {
    try {
      setDonorLoading(true);
      setFamilyLoading(true);
      setError(null);
      setDonationAmount(null);
      const metricsResponse = await api.get('auth/dashboard-metrics/');
      const { donor_count: donorValue, family_member_count: familyValue, donation_amount: donationValue } =
        (metricsResponse.data ?? {}) as {
          donor_count?: unknown;
          family_member_count?: unknown;
          donation_amount?: unknown;
        };
      setDonorCount(Number(donorValue) || 0);
      setFamilyMemberCount(Number(familyValue) || 0);
      const parsedDonation = Number(donationValue);
      setDonationAmount(Number.isFinite(parsedDonation) ? parsedDonation : DONATION_AMOUNT);
    } catch (err) {
      const axiosError = err as AxiosError;
      const statusCode = axiosError.response?.status;

      if (statusCode === 403) {
        setError('You do not have permission to view metrics.');
        setDonorCount(null);
        setFamilyMemberCount(null);
        setDonationAmount(DONATION_AMOUNT);
      } else {
        console.warn('Dashboard metrics endpoint unavailable, falling back to donor list aggregation', err);
        try {
          const donorResponse = await api.get('auth/donors/');
          const donorsData = donorResponse.data;
          const donors = Array.isArray(donorsData)
            ? (donorsData as DonorRecord[])
            : extractResults<DonorRecord>(donorsData);
          const donorTotal = donors.length;
          const memberTotal = donors.reduce((sum, donor) => {
            if (Array.isArray(donor.members)) {
              return sum + donor.members.length;
            }
            return sum;
          }, 0);
          const fallbackDonation = donors.reduce((sum, donor) => {
            const rawValue = Number(donor.profile?.monthly_donation_amount ?? 0);
            return sum + (Number.isFinite(rawValue) ? rawValue : 0);
          }, 0);

          let combinedMembers = memberTotal;
          try {
            const adminMembersResponse = await api.get('auth/family-members/');
            combinedMembers += extractArray(adminMembersResponse.data).length;
          } catch (adminErr) {
            console.warn('Failed to include admin member metrics', adminErr);
          }

          setDonorCount(donorTotal);
          setFamilyMemberCount(combinedMembers);
          setDonationAmount(fallbackDonation);
        } catch (fallbackErr) {
          console.error('Failed to load donor metrics via fallback', fallbackErr);
          setError('Unable to load donor metrics right now.');
          setDonorCount(null);
          setFamilyMemberCount(null);
          setDonationAmount(DONATION_AMOUNT);
        }
      }
    } finally {
      setDonorLoading(false);
      setFamilyLoading(false);
    }
  };

  const loadDonorMetrics = async () => {
    setTodayPoojaLoading(true);
    setTodayPoojaError(null);
    try {
      setDonorLoading(true);
      setFamilyLoading(true);
      setError(null);
      setDonationAmount(null);
      setUpcomingPoojaCount(null);
      setPrasadamRequestCount(null);

      const [profileResponse, registrationsResponse] = await Promise.all([
        api.get('auth/profile/'),
        api.get('pooja/registrations/', { params: { page_size: 200 } }),
      ]);

      const profilePayload = (profileResponse.data ?? {}) as ProfilePayload;
      const profileMembers = Array.isArray(profilePayload.members) ? profilePayload.members : [];
      setFamilyMemberCount(profileMembers.length);
      const profileDonationValue = Number(profilePayload.profile?.monthly_donation_amount ?? 0);
      const sanitizedDonationValue = Number.isFinite(profileDonationValue) ? profileDonationValue : 0;
      setDonationAmount(sanitizedDonationValue);

      const registrations = extractResults<TodayPoojaRecord>(registrationsResponse.data);
      setDonorCount(registrations.length);
      setTodayPoojas(selectTodayRegistrations(registrations));

      const todayIso = toLocalDateIso(new Date());
      let upcomingTotal = 0;
      let prasadamTotal = 0;

      registrations.forEach((registration) => {
        const start = (registration.start_date ?? '').slice(0, 10);
        if (start && start >= todayIso) {
          upcomingTotal += 1;
        }
        if (registration.post_prasadam) {
          prasadamTotal += 1;
        }
      });

      setUpcomingPoojaCount(upcomingTotal);
      setPrasadamRequestCount(prasadamTotal);
    } catch (err) {
      console.error('Failed to load donor dashboard metrics', err);
      setError('Unable to load your dashboard metrics right now.');
      setDonorCount(null);
      setFamilyMemberCount(null);
      setDonationAmount(null);
      setUpcomingPoojaCount(null);
      setPrasadamRequestCount(null);
      setTodayPoojas([]);
      setTodayPoojaError("Unable to load today's pooja details right now.");
    } finally {
      setDonorLoading(false);
      setFamilyLoading(false);
      setTodayPoojaLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    setError(null);

    try {
      if (isAdminUser) {
        await loadAdminMetrics();
        await loadTodayPoojas();
      } else {
        await loadDonorMetrics();
      }
    } catch (err) {
      console.error('Failed to refresh dashboard', err);
      setError('Unable to refresh dashboard data right now.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadTodayPoojas = async () => {
    if (todayPoojas.length === 0) {
      window.alert('No pooja registrations available for today to download.');
      return;
    }

    try {
      const pdfMakeInstance = await loadPdfMake();
      if (!pdfMakeInstance?.createPdf) {
        throw new Error('pdfMake is unavailable');
      }

      const tableBody = [
        ['Pooja ID', 'Pooja Date', 'Pooja Name', 'Day Option', 'Devotee', 'Post Prasadam', 'Registered By', 'Registration Date'].map((header) => ({ text: header, style: 'tableHeader' })),
        ...todayPoojas.map((pooja) => [
          resolvePoojaId(pooja),
          formatDateDisplay(pooja.start_date),
          pooja.pooja_option_name?.trim() || 'N/A',
          pooja.day_option_description?.trim() || 'N/A',
          joinDevoteeNames(pooja.members),
          formatBooleanLabel(pooja.post_prasadam),
          resolveDonorName(pooja.donor_name),
          formatDateTimeDisplay(pooja.created_at),
        ]),
      ];

      const generatedOn = formatDateTimeDisplay(new Date().toISOString());
      const todayLabel = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const docDefinition: TDocumentDefinitions = {
        info: {
          title: `Today's Pooja Details - ${todayLabel}`,
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
          { text: "Today's Pooja Details", style: 'header', margin: [0, 0, 0, 4] },
          { text: `Pooja registrations scheduled for ${todayLabel}`, style: 'subheader' },
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

      pdfMakeInstance
        .createPdf(docDefinition)
        .download(`today-pooja-details-${toLocalDateIso(new Date())}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      window.alert('Unable to generate PDF right now. Please try again later.');
    }
  };

  useEffect(() => {
    if (!user) return;

    if (isAdminUser) {
      loadAdminMetrics();
    } else {
      loadDonorMetrics();
    }
  }, [isAdminUser, user?.id]);

  useEffect(() => {
    if (!isAdminUser) return;

    loadTodayPoojas();
  }, [isAdminUser]);

  const displayValue = (value: number | null, isLoading: boolean) => {
    if (isLoading && value === null) {
      return 'Loading...';
    }
    if (error) {
      return 'N/A';
    }
    if (value === null) {
      return 'N/A';
    }
    return formatNumber(value);
  };

  const loading = donorLoading || familyLoading;
  const donationDisplayValue =
    donationAmount === null ? (error ? 'N/A' : 'Loading...') : formatCurrency(donationAmount);

  const adminMetrics: {
    id: string;
    label: string;
    value: string;
    description: string;
    icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
    accent: string;
  }[] = [
    {
      id: 'temples',
      label: 'No. of Temples',
      value: formatNumber(TEMPLE_COUNT),
      description: 'Temples currently managed on the portal.',
      icon: TempleIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'donors',
      label: 'Registered Donors',
      value: displayValue(donorCount, donorLoading),
      description: 'Unique donors who have registered with the temple.',
      icon: DonorIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'family-members',
      label: 'Donor Family Members',
      value: displayValue(familyMemberCount, familyLoading),
      description: 'Family members linked to donor accounts and admin additions.',
      icon: FamilyIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'monthly-donations',
      label: 'Donation Amount (by all the donors)',
      value: donationDisplayValue,
      description: 'Approximate monthly inflow (updated for recent pauses).',
      icon: WalletIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
  ];

  const donorMetrics: {
    id: string;
    label: string;
    value: string;
    description: string;
    icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
    accent: string;
  }[] = [
    {
      id: 'pooja-total',
      label: 'Poojas Booked',
      value: displayValue(donorCount, donorLoading),
      description: 'Total pooja registrations completed with your account.',
      icon: TempleIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'upcoming-poojas',
      label: 'Upcoming Poojas',
      value: displayValue(upcomingPoojaCount, donorLoading),
      description: 'Scheduled poojas that are yet to be performed.',
      icon: DonorIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'family-members',
      label: 'Family Members',
      value: displayValue(familyMemberCount, familyLoading),
      description: 'Family members saved for quick pooja registrations.',
      icon: FamilyIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'prasadam-requests',
      label: 'Post Prasadam Requests',
      value: displayValue(prasadamRequestCount, donorLoading),
      description: 'Registrations where prasadam delivery was requested.',
      icon: PrasadamIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'total-donation',
      label: 'Total Donation',
      value: donationDisplayValue,
      description: 'Donations recorded through your account.',
      icon: CashIcon,
      accent: 'bg-orange-100 text-orange-700',
    },
  ];

  const todayReadableLabel = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="responsive-layout py-6 sm:py-8">
        {/* Header Section */}
        <div className="mb-8 sm:mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Welcome back,{' '}
                <span className="text-orange-700">{displayName}</span>
              </h1>
              <p className="mt-2 text-slate-600 text-sm sm:text-base max-w-2xl">
                {isAdminUser
                  ? 'Here is a quick overview of the key metrics across the donor portal.'
                  : 'Here is a quick snapshot of your pooja bookings and saved devotees.'}
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-3">
              <div className="inline-flex items-center px-3 sm:px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="h-3 w-3 rounded-full bg-orange-500 mr-2"></div>
                <span className="text-sm font-medium text-slate-700">Dashboard</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-3 sm:px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {refreshing ? (
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-orange-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <RefreshIcon className="h-4 w-4 mr-2 text-orange-600" />
                )}
                <span className="text-sm font-medium text-slate-700">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && !loading && (
          <div className="mb-6 sm:mb-8 rounded-xl border border-red-200 bg-red-50 px-4 py-4 flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="mb-8 sm:mb-12">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(isAdminUser ? adminMetrics : donorMetrics).map(
              ({ id, label, value, description, icon: Icon, accent }) => (
                <div
                  key={id}
                  className="group relative rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 h-24 w-24 -mr-6 -mt-6 rounded-full bg-rose-50 opacity-50 group-hover:bg-rose-100 transition-colors duration-300"></div>

                  <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-500">{label}</p>
                        <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
                          {value}
                        </p>
                      </div>
                      <div
                        className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl ${accent} shadow-sm flex-shrink-0`}
                      >
                        <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                      </div>
                    </div>
                    <p className="mt-3 sm:mt-4 text-sm text-slate-500">{description}</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Today's Pooja Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Today's Pooja Details
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {isAdminUser
                    ? `Pooja registrations scheduled for ${todayReadableLabel}.`
                    : `Your pooja registrations scheduled for ${todayReadableLabel}.`}
                </p>
              </div>
              <div className="mt-2 sm:mt-0 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  {todayPoojas.length}{' '}
                  {todayPoojas.length === 1 ? 'Pooja ' : 'Poojas '} Today
                </span>
                {isAdminUser && (
                  <button
                    onClick={handleDownloadTodayPoojas}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-pink-600 px-3 sm:px-4 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-lg hover:from-orange-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 5a2 2 0 012-2h6a2 2 0 012 2v14a2 2 0 01-2 2H9l-4-4V7a2 2 0 012-2z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 11h6M11 15h4"
                      />
                    </svg>
                    Download Data
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {todayPoojaLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-slate-500">Loading today's pooja details...</p>
              </div>
            ) : todayPoojaError ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-slate-900">
                  Unable to load pooja details
                </h3>
                <p className="mt-2 text-sm text-slate-500">{todayPoojaError}</p>
              </div>
            ) : todayPoojas.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-slate-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-slate-900">
                  No poojas scheduled today
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  There are no pooja registrations scheduled for today.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <div className="overflow-hidden border border-slate-200 rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Pooja ID
                          </th>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Pooja Date
                          </th>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Pooja Name
                          </th>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Day Option
                          </th>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Devotee
                          </th>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Post Prasadam
                          </th>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Registered By
                          </th>
                          <th
                            scope="col"
                            className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                          >
                            Registration Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {todayPoojas.map((pooja, index) => (
                          <tr
                            key={pooja.id}
                            className={`${
                              index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            } hover:bg-orange-50 transition-colors duration-150`}
                          >
                            <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm font-medium text-orange-700">
                              {resolvePoojaId(pooja)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-slate-700">
                              {formatDateDisplay(pooja.start_date)}
                            </td>
                            <td
                              className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-slate-700 max-w-xs truncate"
                              title={pooja.pooja_option_name?.trim() || 'N/A'}
                            >
                              {pooja.pooja_option_name?.trim() || 'N/A'}
                            </td>
                            <td
                              className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-slate-700 max-w-xs truncate"
                              title={pooja.day_option_description?.trim() || 'N/A'}
                            >
                              {pooja.day_option_description?.trim() || 'N/A'}
                            </td>
                            <td
                              className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-slate-700 max-w-xs truncate"
                              title={joinDevoteeNames(pooja.members)}
                            >
                              {joinDevoteeNames(pooja.members)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-slate-700">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  pooja.post_prasadam
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {formatBooleanLabel(pooja.post_prasadam)}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-slate-700">
                              {resolveDonorName(pooja.donor_name)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm text-slate-700">
                              {formatDateTimeDisplay(pooja.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
