import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

import api from '../../lib/api';
import { loadPdfMake } from '../../lib/pdfMakeLoader';
import { useCartStore, type CartItem } from '../../store/cart';
import { useAuthStore } from '../../store/auth';
import { usePaymentStore } from '../../store/payments';

interface DonorDirectoryEntry {
  id: number;
  name: string;
  phone_number?: string | null;
}

interface CombineLookupPayload {
  donor_id: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  items: CartItem[];
}

interface SelectedDonorSummary {
  id: number | null;
  name?: string | null;
  phone?: string | null;
  items: CartItem[];
  totalAmount: number;
}

const buildMembersLabel = (members?: CartItem['members']) => {
  if (!members || members.length === 0) {
    return null;
  }
  const names = members
    .map((member) => member?.name?.toString().trim())
    .filter((name): name is string => Boolean(name && name.length > 0));
  if (names.length === 0) {
    return null;
  }
  return names.join(', ');
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return '0.00';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '0.00';
  }
  return numeric.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
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

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMonthKey = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }
  const parsed = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (key: string) => {
  const [yearPart, monthPart] = key.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return key;
  }
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const buildHistoryMonthOptions = <T,>(
  entries: T[],
  resolveDate: (entry: T) => string | Date | null | undefined,
) => {
  const keys = new Set<string>();
  const currentKey = formatMonthKey(new Date());
  if (currentKey) {
    keys.add(currentKey);
  }
  entries.forEach((entry) => {
    const key = formatMonthKey(resolveDate(entry));
    if (key) {
      keys.add(key);
    }
  });
  const sortedKeys = Array.from(keys).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  return sortedKeys.map((key) => ({ key, label: formatMonthLabel(key) }));
};

const parseAmount = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const CombinePaymentPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const cartItems = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const combinePaymentHistory = usePaymentStore((state) => state.combinePaymentHistory);
  const addCombinePaymentHistory = usePaymentStore((state) => state.addCombinePaymentHistory);
  const combineDraft = usePaymentStore((state) => state.combineDraft);
  const saveCombineDraft = usePaymentStore((state) => state.saveCombineDraft);
  const clearCombineDraft = usePaymentStore((state) => state.clearCombineDraft);

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [historyMonth, setHistoryMonth] = useState<string>(() => formatMonthKey(new Date()) ?? '');
  const [isClubExpanded, setIsClubExpanded] = useState(false);
  const [donorDirectory, setDonorDirectory] = useState<DonorDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [selectedDonorIds, setSelectedDonorIds] = useState<number[]>([]);
  const [selectedDonorDetails, setSelectedDonorDetails] = useState<Record<number, CombineLookupPayload>>({});
  const [selectedDonorLoadingIds, setSelectedDonorLoadingIds] = useState<number[]>([]);
  const [selectedDonorError, setSelectedDonorError] = useState('');
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [petalSeed, setPetalSeed] = useState(0);
  const [clubTransactionReference, setClubTransactionReference] = useState('');
  const [clubTransactionReferenceError, setClubTransactionReferenceError] = useState<string | null>(null);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedDonorDetailsRef = useRef<Record<number, CombineLookupPayload>>({});
  const updateSelectedDonorDetails = (
    updater: (prev: Record<number, CombineLookupPayload>) => Record<number, CombineLookupPayload>,
  ) => {
    setSelectedDonorDetails((prev) => {
      const next = updater(prev);
      selectedDonorDetailsRef.current = next;
      return next;
    });
  };

  const [draftMonth, setDraftMonth] = useState<string>(() => combineDraft?.effectiveMonth ?? formatMonthKey(new Date()) ?? '');
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yourTotalAmount = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        return sum + parseAmount(item.amount);
      }, 0),
    [cartItems],
  );

  const selectedDonorSummaries = useMemo<SelectedDonorSummary[]>(() => {
    return selectedDonorIds
      .map((id) => selectedDonorDetails[id])
      .filter((donor): donor is CombineLookupPayload => Boolean(donor))
      .map((donor) => {
        const totalAmount = donor.items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
        return {
          id: donor.donor_id ?? null,
          name: donor.donor_name ?? null,
          phone: donor.donor_phone ?? null,
          items: donor.items,
          totalAmount,
        };
      });
  }, [selectedDonorIds, selectedDonorDetails]);

  const clubTotals = useMemo(() => {
    const total = selectedDonorSummaries.reduce((sum, donor) => sum + donor.totalAmount, 0);
    const donorsCount = selectedDonorSummaries.length;
    const itemsCount = selectedDonorSummaries.reduce((sum, donor) => sum + donor.items.length, 0);
    return { donorsCount, itemsCount, total };
  }, [selectedDonorSummaries]);
  const isSelectedDonorLoading = selectedDonorLoadingIds.length > 0;
  const [donorSearch, setDonorSearch] = useState('');
  const filteredDirectory = useMemo(() => {
    const query = donorSearch.trim().toLowerCase();
    if (query.length === 0) {
      return donorDirectory;
    }
    return donorDirectory.filter((entry) => {
      const name = entry.name?.toLowerCase() ?? '';
      const phone = entry.phone_number?.toLowerCase() ?? '';
      return name.includes(query) || phone.includes(query);
    });
  }, [donorDirectory, donorSearch]);
  const handleToggleDonorSelected = (donorId: number) => {
    setSelectedDonorIds((prev) => {
      if (prev.includes(donorId)) {
        return prev.filter((id) => id !== donorId);
      }
      return [...prev, donorId];
    });
  };

  const combinedTotal = yourTotalAmount + clubTotals.total;
  const combinedPoojaCount = cartItems.length + clubTotals.itemsCount;
  const petals = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        left: Math.random() * 100,
        delay: index * 0.07,
        duration: 1.4 + Math.random() * 0.8,
        hue: 18 + Math.random() * 32,
        scale: 0.8 + Math.random() * 0.6,
        horizontal: (Math.random() - 0.5) * 120,
      })),
    [petalSeed],
  );
  const historyMonthOptions = useMemo(
    () => buildHistoryMonthOptions(combinePaymentHistory, (entry) => entry.completedAt),
    [combinePaymentHistory],
  );
  const filteredHistory = useMemo(
    () =>
      historyMonth
        ? combinePaymentHistory.filter((entry) => formatMonthKey(entry.completedAt) === historyMonth)
        : [],
    [combinePaymentHistory, historyMonth],
  );

  const handleDownloadPaymentHistory = async () => {
    if (!historyMonth || filteredHistory.length === 0) {
      return;
    }

    const selectedMonthLabel = formatMonthLabel(historyMonth);
    const generatedOnLabel = formatDateTime(new Date().toISOString());
    const content: TDocumentDefinitions['content'] = [
      { text: 'Combine Payment History', style: 'pdfTitle' },
      { text: selectedMonthLabel, style: 'pdfSubtitle' },
      { text: `Generated on ${generatedOnLabel}`, style: 'pdfMeta' },
    ];

    filteredHistory.forEach((entry, index) => {
      const completionLabel = formatDateTime(entry.completedAt);
      const donorTotal = entry.donors.reduce((sum, donor) => sum + donor.totalAmount, 0);
      content.push(
        {
          text: `Payment ${index + 1} • ₹ ${formatCurrency(entry.combinedTotal)} • ${completionLabel}`,
          style: 'pdfEntryTitle',
        },
        {
          text: `Your share ₹ ${formatCurrency(entry.yourTotal)} • Donor share ₹ ${formatCurrency(
            donorTotal,
          )}`,
          style: 'pdfEntryMeta',
        },
      );

      const tableBody = [
        [
          { text: 'Owner', style: 'pdfTableHeader' },
          { text: 'Pooja', style: 'pdfTableHeader' },
          { text: 'Service Date', style: 'pdfTableHeader' },
          { text: 'Amount', style: 'pdfTableHeader' },
          { text: 'Members', style: 'pdfTableHeader' },
        ],
        ...entry.yourItems.map((item) => [
          'You',
          item.poojaName || 'Pooja',
          formatDate(item.customDayDate || item.bookingDate),
          `₹ ${formatCurrency(item.amount)}`,
          buildMembersLabel(item.members) ?? '—',
        ]),
        ...entry.donors.flatMap((donor) =>
          donor.items.map((item) => [
            donor.name ?? 'Donor',
            item.poojaName || 'Pooja',
            formatDate(item.customDayDate || item.bookingDate),
            `₹ ${formatCurrency(item.amount)}`,
            buildMembersLabel(item.members) ?? '—',
          ]),
        ),
      ];

      if (tableBody.length > 1) {
        content.push({
          margin: [0, 0, 0, 8],
          table: {
            widths: ['auto', '*', 90, 70, '*'],
            body: tableBody,
          },
          layout: 'lightHorizontalLines',
        });
      } else {
        content.push({
          text: 'No items recorded for this combined payment.',
          italics: true,
          margin: [0, 0, 0, 8],
        });
      }
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      info: {
        title: `Combine Payment History • ${selectedMonthLabel}`,
      },
      content,
      styles: {
        pdfTitle: { fontSize: 20, bold: true },
        pdfSubtitle: { fontSize: 12, color: '#475569', margin: [0, 0, 0, 6] },
        pdfMeta: { fontSize: 10, color: '#6b7280', margin: [0, 0, 0, 12] },
        pdfEntryTitle: { fontSize: 14, bold: true, margin: [0, 12, 0, 4] },
        pdfEntryMeta: { fontSize: 10, color: '#475569', margin: [0, 0, 0, 6] },
        pdfTableHeader: { bold: true, fillColor: '#f3f4f6' },
      },
      defaultStyle: {
        fontSize: 11,
      },
    };

    try {
      const pdfMakeInstance = await loadPdfMake();
      pdfMakeInstance
        .createPdf(docDefinition)
        .download(`combine-payment-history-${historyMonth}.pdf`);
    } catch (error) {
      console.error('Failed to generate combined payment history PDF', error);
    }
  };

  const resolveDevoteesLabel = (item: CartItem) => {
    if (Array.isArray(item.members) && item.members.length > 0) {
      const names = item.members
        .map((member) => member?.name?.toString().trim())
        .filter((name): name is string => Boolean(name && name.length > 0));
      if (names.length > 0) {
        return names.join(', ');
      }
    }
    return item.fullName?.trim() || '—';
  };

  useEffect(() => {
    if (!isClubExpanded || donorDirectory.length > 0) {
      return;
    }
    let isActive = true;
    const fetchDirectory = async () => {
      setDirectoryLoading(true);
      setDirectoryError('');
      try {
        const { data } = await api.get<DonorDirectoryEntry[]>('pooja/registrations/donor-directory/');
        if (!isActive) {
          return;
        }
        setDonorDirectory(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (isActive) {
          const detail = err?.response?.data?.detail ?? err?.message ?? 'Unable to load donors.';
          setDirectoryError(typeof detail === 'string' ? detail : 'Unable to load donors.');
        }
      } finally {
        if (isActive) {
          setDirectoryLoading(false);
        }
      }
    };
    fetchDirectory();
    return () => {
      isActive = false;
    };
  }, [isClubExpanded, donorDirectory.length]);

  useEffect(() => {
    setSelectedDonorError('');
    if (selectedDonorIds.length === 0) {
      setSelectedDonorLoadingIds([]);
      return;
    }
    const idsToFetch = selectedDonorIds.filter((donorId) => !selectedDonorDetailsRef.current[donorId]);
    if (idsToFetch.length === 0) {
      return;
    }
    let isActive = true;
    idsToFetch.forEach((donorId) => {
      setSelectedDonorLoadingIds((prev) => Array.from(new Set([...prev, donorId])));
      api
        .get<CombineLookupPayload>('pooja/registrations/combine-lookup/', {
          params: { donor_id: donorId },
        })
        .then(({ data }) => {
          if (!isActive) {
            return;
          }
          updateSelectedDonorDetails((prev) => ({ ...prev, [donorId]: data }));
        })
        .catch((err: any) => {
          if (!isActive) {
            return;
          }
          const detail =
            err?.response?.data?.detail ??
            err?.message ??
            `Unable to load commitments for donor #${donorId}.`;
          setSelectedDonorError(
            typeof detail === 'string' ? detail : 'Unable to load the selected donor commitments.',
          );
          updateSelectedDonorDetails((prev) => {
            const next = { ...prev };
            delete next[donorId];
            return next;
          });
        })
        .finally(() => {
          if (!isActive) {
            return;
          }
          setSelectedDonorLoadingIds((prev) => prev.filter((loadingId) => loadingId !== donorId));
        });
    });
    return () => {
      isActive = false;
    };
  }, [selectedDonorIds]);

  useEffect(() => {
    if (selectedDonorSummaries.length === 0) {
      setShowPaymentDetails(false);
    }
  }, [selectedDonorSummaries]);

  useEffect(() => {
    if (!showPaymentDetails) {
      setClubTransactionReference('');
      setClubTransactionReferenceError(null);
    }
  }, [showPaymentDetails]);

  useEffect(() => {
    if (historyMonthOptions.length === 0) {
      return;
    }
    if (!historyMonth || !historyMonthOptions.some((option) => option.key === historyMonth)) {
      setHistoryMonth(historyMonthOptions[0].key);
    }
  }, [historyMonth, historyMonthOptions]);

  useEffect(() => {
    if (combineDraft?.effectiveMonth) {
      setDraftMonth(combineDraft.effectiveMonth);
      return;
    }
    setDraftMonth(formatMonthKey(new Date()) ?? '');
  }, [combineDraft]);

  useEffect(() => {
    if (!combineDraft?.donorIds?.length) {
      return;
    }
    const storedIds = combineDraft.donorIds;
    setSelectedDonorIds((prev) => {
      if (prev.length === storedIds.length && prev.every((value, index) => value === storedIds[index])) {
        return prev;
      }
      return storedIds;
    });
  }, [combineDraft]);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  const handleClearClubbedDonor = () => {
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    setShowCelebration(false);
    setSelectedDonorIds([]);
    updateSelectedDonorDetails(() => ({}));
    setSelectedDonorLoadingIds([]);
    setSelectedDonorError('');
    setShowPaymentDetails(false);
  };

  const handleProceedToPayment = () => {
    setShowPaymentDetails(true);
  };

  const handleSaveCombination = () => {
    if (selectedDonorSummaries.length === 0) {
      return;
    }
    const effectiveMonth = draftMonth?.trim() || formatMonthKey(new Date()) || '';
    if (!effectiveMonth) {
      return;
    }
    saveCombineDraft({
      donorIds: [...selectedDonorIds],
      effectiveMonth,
      updatedAt: new Date().toISOString(),
    });
    const monthLabel = formatMonthLabel(effectiveMonth);
    const donorLabel = `${selectedDonorSummaries.length} donor${
      selectedDonorSummaries.length === 1 ? '' : 's'
    }`;
    const message = `Saved ${donorLabel} for ${monthLabel}.`;
    setSaveStatusMessage(message);
    if (saveStatusTimeoutRef.current) {
      clearTimeout(saveStatusTimeoutRef.current);
    }
    saveStatusTimeoutRef.current = setTimeout(() => {
      setSaveStatusMessage('');
      saveStatusTimeoutRef.current = null;
    }, 4000);
  };

  const handleClearSavedCombination = () => {
    clearCombineDraft();
    if (saveStatusTimeoutRef.current) {
      clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current = null;
    }
    setSaveStatusMessage('');
    handleClearClubbedDonor();
  };

  const handlePaymentCompleted = () => {
    const trimmedReference = clubTransactionReference.trim();
    if (!trimmedReference) {
      setClubTransactionReferenceError('Transaction ID or UPI ID is required.');
      return;
    }
    setClubTransactionReferenceError(null);
    if (selectedDonorSummaries.length === 0) {
      return;
    }
    addCombinePaymentHistory({
      yourItems: cartItems,
      yourTotal: yourTotalAmount,
      donors: selectedDonorSummaries.map((donor) => ({
        id: donor.id,
        name: donor.name,
        phone: donor.phone,
        items: donor.items,
        totalAmount: donor.totalAmount,
      })),
      combinedTotal,
    });
    setPetalSeed((seed) => seed + 1);
    setShowCelebration(true);
    setShowPaymentDetails(false);
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
    }
    celebrationTimeoutRef.current = setTimeout(() => {
      setShowCelebration(false);
      handleClearClubbedDonor();
    }, 1800);
  };

  const renderCurrentView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Poojas</p>
          <p className="text-lg font-bold text-slate-800">{cartItems.length}</p>
          <p className="text-sm font-semibold text-slate-700">₹ {formatCurrency(yourTotalAmount)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clubbed Donors</p>
          <p className="text-lg font-bold text-slate-800">{clubTotals.donorsCount}</p>
          <p className="text-sm font-semibold text-slate-700">₹ {formatCurrency(clubTotals.total)}</p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Combined Total</p>
          <p className="text-lg font-bold text-orange-700">{combinedPoojaCount} items</p>
          <p className="text-sm font-semibold text-orange-700">₹ {formatCurrency(combinedTotal)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Your Cart Items</h3>
        </div>
        {cartItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            You have not added any poojas yet. Visit the Pooja cart to add offerings before combining payments.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {cartItems.map((item) => (
              <li key={item.cartId} className="grid gap-2 px-4 py-3 sm:grid-cols-5 sm:items-center">
                <div className="sm:col-span-2">
                  <p className="font-medium text-slate-800">{item.poojaName}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.poojaCode ?? 'POOJA'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="font-medium text-slate-800">{formatDate(item.customDayDate || item.bookingDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="font-medium text-slate-800">{item.customDayNote?.trim() || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-semibold text-slate-900">₹ {formatCurrency(item.amount)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 pt-6">
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
          onClick={() => setIsClubExpanded((prev) => !prev)}
        >
          {isClubExpanded ? 'Hide' : 'Club More Members For Group Payment'}
        </button>

        {isClubExpanded && (
          <div className="mt-4 space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="donor-search" className="text-sm font-semibold text-slate-700">
                  Pick donor by name & phone
                </label>
                <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">
                  Tap to toggle multiple
                </span>
              </div>
              <input
                id="donor-search"
                type="search"
                placeholder="Search name or phone"
                value={donorSearch}
                onChange={(event) => setDonorSearch(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                disabled={directoryLoading || donorDirectory.length === 0}
              />
              {directoryError && (
                <p className="mt-2 text-xs font-medium text-red-600">{directoryError}</p>
              )}
            </div>

            {directoryLoading && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                Loading donor directory…
              </div>
            )}

            {!directoryLoading && donorDirectory.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                No donors are currently available for clubbing.
              </div>
            )}

            {!directoryLoading && donorDirectory.length > 0 && filteredDirectory.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                No donors match your search. Clear the filter to see all donors.
              </div>
            )}

            {!directoryLoading && filteredDirectory.length > 0 && (
              <div className="grid gap-2 max-h-56 overflow-y-auto sm:grid-cols-2">
                {filteredDirectory.map((entry) => {
                  const isSelected = selectedDonorIds.includes(entry.id);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleToggleDonorSelected(entry.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition focus-visible:outline-none ${
                        isSelected
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {entry.name || `Donor #${entry.id}`}
                          </p>
                          <p className="text-xs text-slate-500">{entry.phone_number || 'Phone unavailable'}</p>
                        </div>
                        <span
                          className={`h-5 w-5 rounded-full border-2 ${
                            isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
                          }`}
                        />
                      </div>
                      <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-slate-400">
                        Tap to {isSelected ? 'remove' : 'add'} in your club
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedDonorError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                {selectedDonorError}
              </div>
            )}

            {isSelectedDonorLoading && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                Fetching the selected donors&apos; pooja selections…
              </div>
            )}

            {selectedDonorSummaries.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedDonorSummaries.map((donor, index) => (
                  <div
                    key={`selected-donor-${donor.id ?? index}-${donor.phone ?? donor.name ?? index}`}
                    className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{donor.name || 'Donor'}</p>
                        <p className="text-xs text-slate-500">
                          Contact: {donor.phone || 'Phone unavailable'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-lg font-semibold text-slate-900">
                          ₹ {formatCurrency(donor.totalAmount)}
                        </p>
                        <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">
                          {donor.items.length} item{donor.items.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    {donor.items.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        This donor does not have any poojas in their cart yet.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {donor.items.map((item) => (
                          <li key={item.cartId} className="grid gap-2 px-4 py-3 sm:grid-cols-4 sm:items-center">
                            <div className="sm:col-span-2">
                              <p className="font-semibold text-slate-900">
                                {item.poojaName || 'Pooja'}{' '}
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  {item.poojaCode ?? ''}
                                </span>
                              </p>
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                {item.dayOptionDescription || 'No day option'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Date</p>
                              <p className="font-medium text-slate-800">
                                {formatDate(item.customDayDate || item.bookingDate)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Devotees</p>
                              <p className="font-medium text-slate-800">{resolveDevoteesLabel(item)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Amount</p>
                              <p className="font-semibold text-slate-900">
                                ₹ {formatCurrency(item.amount)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                {isSelectedDonorLoading
                  ? 'Loading the selected donors so you can review their commitments.'
                  : 'Choose donors from the dropdown to preview their pooja commitments for clubbed payment.'}
              </p>
            )}

            {selectedDonorSummaries.length > 0 && (
              <div className="space-y-3 pt-4">
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor="combine-effective-month"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Effective month
                      </label>
                      <input
                        id="combine-effective-month"
                        type="month"
                        value={draftMonth}
                        onChange={(event) => setDraftMonth(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCombination}
                        disabled={isSelectedDonorLoading}
                        className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          isSelectedDonorLoading
                            ? 'border-slate-200 bg-slate-100 text-slate-400'
                            : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        }`}
                      >
                        Save combination
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSavedCombination}
                        disabled={!combineDraft}
                        className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          combineDraft
                            ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            : 'border-slate-100 bg-slate-50 text-slate-300'
                        }`}
                      >
                        De-link donors
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-[0.7rem] leading-snug text-slate-500">
                    {combineDraft ? (
                      <p>
                        Saved for {formatMonthLabel(combineDraft.effectiveMonth)} • {combineDraft.donorIds.length}{' '}
                        donor{combineDraft.donorIds.length === 1 ? '' : 's'} preserved.
                      </p>
                    ) : (
                      <p>Save the current club to resume this combination even after you log out.</p>
                    )}
                    {saveStatusMessage && <p className="text-xs font-semibold text-slate-700">{saveStatusMessage}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-600">
                    <p>
                      Ready to combine the payment with{' '}
                      <span className="font-semibold">
                        {selectedDonorSummaries.length} donor
                        {selectedDonorSummaries.length === 1 ? '' : 's'}
                      </span>
                      ? Click Proceed to view the payment instructions or clear to pick different donors.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleClearClubbedDonor}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Clear All
                    </button>
                    {!showPaymentDetails && (
                      <button
                        type="button"
                        onClick={handleProceedToPayment}
                        className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
                      >
                        Proceed for Payment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {selectedDonorSummaries.length > 0 && showPaymentDetails && (
          <div className="space-y-4 rounded-2xl border border-orange-100 bg-white p-5 shadow-inner">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
                <img
                  src="/images/payment_qrcode.png"
                  alt="Temple payment QR code"
                  className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-3 object-contain"
                />
                <p className="mt-3 text-sm font-medium text-slate-700">Scan & pay ₹ {formatCurrency(combinedTotal)}</p>
              </div>
              <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Holder</p>
                  <p className="text-lg font-semibold text-slate-900">Sri Temple Trust</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Number</p>
                  <p className="text-lg font-semibold text-slate-900">123456789012</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">IFSC Code</p>
                  <p className="text-lg font-semibold text-slate-900">SBIN0000123</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</p>
                  <p className="text-lg font-semibold text-slate-900">Mylapore, Chennai</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="club-transaction-reference">
                Transaction ID or UPI ID
              </label>
              <input
                id="club-transaction-reference"
                type="text"
                value={clubTransactionReference}
                onChange={(event) => {
                  setClubTransactionReference(event.target.value);
                  if (clubTransactionReferenceError) {
                    setClubTransactionReferenceError(null);
                  }
                }}
                placeholder="Enter the transaction reference or UPI ID used"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
              {clubTransactionReferenceError && (
                <p className="mt-2 text-sm text-rose-600">{clubTransactionReferenceError}</p>
              )}
            </div>
            <p className="text-sm text-slate-600">
              After the transfer, inform the temple office with both sets of cart details for quicker reconciliation.
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handlePaymentCompleted}
                className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
              >
                Payment Completed
              </button>
            </div>
          </div>
        )}
    </div>
  );

  const renderHistoryContent = () => {
    const renderPreviewList = (items: CartItem[]) => {
      const preview = items.slice(0, 2);
      const remaining = items.length - preview.length;
      return (
        <>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {preview.map((item, index) => (
              <li key={`${item.cartId ?? index}`}>
                {(item.poojaName || 'Pooja') + ' — ₹ ' + formatCurrency(item.amount)}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">+{remaining} more</p>
          )}
        </>
      );
    };

    const selectedMonthLabel = historyMonth ? formatMonthLabel(historyMonth) : 'Selected month';

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Latest confirmations are stored locally so you can recall which donor you clubbed with.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label
              htmlFor="combine-history-month"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Month
            </label>
            <select
              id="combine-history-month"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={historyMonth}
              onChange={(event) => setHistoryMonth(event.target.value)}
            >
              {historyMonthOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDownloadPaymentHistory}
              disabled={filteredHistory.length === 0}
              className={`inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                filteredHistory.length === 0
                  ? 'border-slate-200 text-slate-400'
                  : 'border-orange-300 text-orange-700 hover:bg-orange-50'
              }`}
            >
              Download Payment History
            </button>
          </div>
        </div>

        {combinePaymentHistory.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            Combined payments you complete will be listed here for local reference.
          </div>
        )}

        {combinePaymentHistory.length > 0 && filteredHistory.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-sm text-slate-600">
            No combined payments recorded for {selectedMonthLabel}.
          </div>
        )}

        {filteredHistory.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredHistory.map((entry) => {
              const donorItemCount = entry.donors.reduce((sum, donor) => sum + donor.count, 0);
              const totalCount = entry.yourCount + donorItemCount;
              return (
                <article
                  key={`${entry.id}-${entry.completedAt}`}
                  className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Completed</p>
                      <p className="text-base font-semibold text-slate-900">{formatDateTime(entry.completedAt)}</p>
                      <p className="text-sm text-slate-600">
                        {totalCount} pooja{totalCount === 1 ? '' : 's'} combined • Your share:{' '}
                        {entry.yourCount} item{entry.yourCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Combined Total</p>
                      <p className="text-2xl font-semibold text-orange-700">₹ {formatCurrency(entry.combinedTotal)}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Poojas</p>
                      <p className="text-sm font-medium text-slate-800">
                        {entry.yourCount} item{entry.yourCount === 1 ? '' : 's'} • ₹ {formatCurrency(entry.yourTotal)}
                      </p>
                      {entry.yourItems.length > 0 && renderPreviewList(entry.yourItems)}
                    </div>
                    {entry.donors.length > 0 && (
                      <div className="space-y-3">
                        {entry.donors.map((donor, index) => (
                          <div
                            key={`history-donor-${entry.id}-${donor.id ?? index}`}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Clubbed Donor {index + 1}
                            </p>
                            <p className="text-sm font-medium text-slate-800">
                              {donor.name || 'Donor'}{' '}
                              <span className="text-xs text-slate-500">
                                ({donor.count} item{donor.count === 1 ? '' : 's'})
                              </span>
                            </p>
                            <p className="text-sm font-semibold text-slate-700">
                              ₹ {formatCurrency(donor.totalAmount)}
                            </p>
                            {donor.phone && (
                              <p className="text-xs text-slate-500">Phone: {donor.phone}</p>
                            )}
                            {donor.items.length > 0 && renderPreviewList(donor.items)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const tabButtonClasses = (tab: 'current' | 'history') =>
    `flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
      activeTab === tab ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Combine Payment</h1>
            <p className="text-sm text-slate-600">
              Club your selections with another donor, follow the payment instructions, and revisit previous combined
              payments when needed.
            </p>
          </div>
          <div className="flex w-full max-w-md rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-semibold text-slate-600 md:w-auto">
            <button type="button" className={tabButtonClasses('current')} onClick={() => setActiveTab('current')}>
              Current Payment
            </button>
            <button type="button" className={tabButtonClasses('history')} onClick={() => setActiveTab('history')}>
              Payment History
            </button>
          </div>
        </div>
        <div className="mt-6">{activeTab === 'current' ? renderCurrentView() : renderHistoryContent()}</div>
      </section>
      {showCelebration && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0">
            {petals.map((petal, index) => (
              <span
                key={`${petalSeed}-${index}`}
                className="flower-petal"
                style={
                  {
                    left: `${petal.left}%`,
                    animationDelay: `${petal.delay}s`,
                    animationDuration: `${petal.duration}s`,
                    '--petal-scale': petal.scale,
                    '--petal-hue': petal.hue,
                    '--petal-horizontal': `${petal.horizontal}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className="absolute inset-x-0 top-24 flex justify-center">
            <div className="rounded-full bg-white/90 px-6 py-2 text-sm font-semibold text-orange-700 shadow-lg">
              Combined payment recorded! Thank you.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinePaymentPage;
