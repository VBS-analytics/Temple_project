import type { DragEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import api, { extractResults } from '../../lib/api';

const generateHeaderCode = (name: string) => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 8);
  const randomPart = Math.random().toString(36).slice(2, 6);
  const raw = `${baseSlug || 'hdr'}-${randomPart}`;
  return raw.slice(0, 16);
};

interface DayOption {
  id: number;
  code: string;
  description: string;
  category: string;
  display_order: number;
}

interface PoojaOption {
  id: number;
  code: string;
  name: string;
  description: string | null;
  min_amount: string | null;
  max_amount: string | null;
  default_amount: string | null;
  is_active: boolean;
  is_group_header: boolean;
  parent_id: number | null;
}

type DayOptionFormValues = {
  code: string;
  description: string;
  category: string;
};

type TamilDayOptionFormValues = {
  code: string;
  description: string;
};

type PoojaOptionFormValues = {
  code: string;
  poojaDescription: string;
  rate: string;
  headerId: string;
};

type HeaderFormValues = {
  headerName: string;
};

const categoryDisplayNames: Record<string, string> = {
  weekday: 'Weekday',
  tamil_star: 'Tamil Star',
  code: 'Template Code',
};

const AdminMasterPage = () => {
  const [dayOptions, setDayOptions] = useState<DayOption[]>([]);
  const [poojaOptions, setPoojaOptions] = useState<PoojaOption[]>([]);
  const [notice, setNotice] = useState('');
  const [editingDay, setEditingDay] = useState<DayOption | null>(null);
  const [editingHeader, setEditingHeader] = useState<PoojaOption | null>(null);
  const [editingPooja, setEditingPooja] = useState<PoojaOption | null>(null);
  const [draggingDayId, setDraggingDayId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const originalDayOrderRef = useRef<DayOption[]>([]);

  const dayForm = useForm<DayOptionFormValues>({ defaultValues: { code: '', description: '', category: 'weekday' } });
  const tamilDayForm = useForm<TamilDayOptionFormValues>({ defaultValues: { code: '', description: '' } });
  const headerForm = useForm<HeaderFormValues>({ defaultValues: { headerName: '' } });
  const poojaForm = useForm<PoojaOptionFormValues>({ defaultValues: { code: '', poojaDescription: '', rate: '', headerId: '' } });

  const parentCandidates = useMemo(() => poojaOptions.filter((option) => option.is_group_header), [poojaOptions]);
  const availableParentOptions = useMemo(
    () => parentCandidates.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [parentCandidates],
  );

  const groupedPoojas = useMemo(() => {
    const childrenMap = new Map<number, PoojaOption[]>();
    poojaOptions.forEach((option) => {
      if (option.parent_id) {
        const current = childrenMap.get(option.parent_id) ?? [];
        current.push(option);
        childrenMap.set(option.parent_id, current);
      }
    });

    const sortEntries = (items: PoojaOption[]) => items.slice().sort((a, b) => a.code.localeCompare(b.code));

    const topLevel = sortEntries(poojaOptions.filter((option) => option.parent_id === null));

    return topLevel.map((option) => ({
      option,
      children: sortEntries(childrenMap.get(option.id) ?? []),
    }));
  }, [poojaOptions]);

  const headerSections = useMemo(() => groupedPoojas.filter((section) => section.option.is_group_header), [groupedPoojas]);
  const ungroupedPoojas = useMemo(
    () =>
      groupedPoojas
        .filter((section) => !section.option.is_group_header)
        .flatMap((section) => [section.option, ...section.children])
        .filter((pooja, index, arr) => index === arr.findIndex((candidate) => candidate.id === pooja.id)),
    [groupedPoojas],
  );
  const englishDayOptions = useMemo(
    () => dayOptions.filter((option) => option.category !== 'tamil_star'),
    [dayOptions],
  );
  const tamilDayOptions = useMemo(() => dayOptions.filter((option) => option.category === 'tamil_star'), [dayOptions]);
  const isEditingEnglishDay = Boolean(editingDay && editingDay.category !== 'tamil_star');
  const isEditingTamilDay = editingDay?.category === 'tamil_star';

  const headerCount = parentCandidates.length;
  const totalPoojaEntries = useMemo(
    () => poojaOptions.filter((option) => !option.is_group_header).length,
    [poojaOptions],
  );
  const summaryCards = useMemo(
    () => [
      { 
        label: 'Active Headers', 
        value: headerCount, 
        helper: 'Grouping categories',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        )
      },
      { 
        label: 'Pooja Entries', 
        value: totalPoojaEntries, 
        helper: `${poojaOptions.length} total records`,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        )
      },
      { 
        label: 'English Day Codes', 
        value: englishDayOptions.length, 
        helper: 'Weekday & special day tags',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      },
      { 
        label: 'Tamil Nakshatras', 
        value: tamilDayOptions.length, 
        helper: 'Tamil star references',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )
      },
    ],
    [headerCount, totalPoojaEntries, poojaOptions.length, englishDayOptions.length, tamilDayOptions.length],
  );
  const formatCategoryLabel = (value: string) => {
    const fallback = value.replace(/_/g, ' ');
    const label = categoryDisplayNames[value] ?? fallback;
    return label.toUpperCase();
  };

  const load = async () => {
    setIsLoading(true);
    try {
      const [poojaRes, dayRes] = await Promise.all([
        api.get('/pooja/options/'),
        api.get('/pooja/day-options/'),
      ]);
      setPoojaOptions(extractResults<PoojaOption>(poojaRes.data));
      const rawDayOptions = extractResults<DayOption>(dayRes.data);
      setDayOptions(
        rawDayOptions
          .slice()
          .sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)),
      );
    } catch (error) {
      setNotice('Unable to load master data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetEnglishDayForm = () => {
    dayForm.reset({ code: '', description: '', category: 'weekday' });
  };

  const resetTamilDayForm = () => {
    tamilDayForm.reset({ code: '', description: '' });
  };

  const clearDayEditing = () => {
    setEditingDay(null);
    resetEnglishDayForm();
    resetTamilDayForm();
  };

  const onCreateDayOption = async (values: DayOptionFormValues) => {
    const payload =
      editingDay && editingDay.category !== 'tamil_star'
        ? values
        : { ...values, category: 'weekday' };
    try {
      if (editingDay && editingDay.category !== 'tamil_star') {
        await api.put(`/pooja/day-options/${editingDay.id}/`, payload);
        setNotice('Day option updated.');
      } else {
        await api.post('/pooja/day-options/', payload);
        setNotice('Day option saved.');
      }
      clearDayEditing();
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not save day option';
      setNotice(typeof detail === 'string' ? detail : 'Error saving day option');
    }
  };
  const onCreateTamilDayOption = async (values: TamilDayOptionFormValues) => {
    const payload = { ...values, category: 'tamil_star' };
    try {
      if (editingDay && editingDay.category === 'tamil_star') {
        await api.put(`/pooja/day-options/${editingDay.id}/`, payload);
        setNotice('Tamil day option updated.');
      } else {
        await api.post('/pooja/day-options/', payload);
        setNotice('Tamil day option saved.');
      }
      clearDayEditing();
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not save Tamil day option';
      setNotice(typeof detail === 'string' ? detail : 'Error saving Tamil day option');
    }
  };

  const handleEditDay = (day: DayOption) => {
    setEditingDay(day);
    if (day.category === 'tamil_star') {
      tamilDayForm.reset({ code: day.code, description: day.description });
      resetEnglishDayForm();
    } else {
      dayForm.reset({ code: day.code, description: day.description, category: day.category });
      resetTamilDayForm();
    }
  };

  const handleDeleteDay = async (day: DayOption) => {
    if (!window.confirm(`Delete day option ${day.code}?`)) return;
    try {
      await api.delete(`/pooja/day-options/${day.id}/`);
      setNotice('Day option deleted.');
      if (editingDay?.id === day.id) {
        clearDayEditing();
      }
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not delete day option';
      setNotice(typeof detail === 'string' ? detail : 'Error deleting day option');
    }
  };

  const reorderDayOptions = (dragId: number, targetId: number) => {
    setDayOptions((prev) => {
      const updated = [...prev];
      const dragIndex = updated.findIndex((item) => item.id === dragId);
      const targetIndex = updated.findIndex((item) => item.id === targetId);
      if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) {
        return prev;
      }

      const [draggedItem] = updated.splice(dragIndex, 1);
      updated.splice(targetIndex, 0, draggedItem);

      return updated.map((item, index) => ({ ...item, display_order: index + 1 }));
    });
  };

  const handleDayDragStart = (event: DragEvent<HTMLLIElement>, id: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
    originalDayOrderRef.current = dayOptions.map((item) => ({ ...item }));
    setDraggingDayId(id);
  };

  const handleDayDragOver = (event: DragEvent<HTMLLIElement>, overId: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggingDayId === null || draggingDayId === overId) {
      return;
    }
    reorderDayOptions(draggingDayId, overId);
  };

  const revertDayOrder = () => {
    if (originalDayOrderRef.current.length === 0) {
      return;
    }
    setDayOptions(originalDayOrderRef.current.map((item) => ({ ...item })));
    originalDayOrderRef.current = [];
  };

  const handleDayDragEnd = async () => {
    if (draggingDayId === null) {
      return;
    }

    setDraggingDayId(null);

    const originalOrder = originalDayOrderRef.current.map((item) => item.id);
    const newOrder = dayOptions.map((item) => item.id);
    const isSameOrder =
      originalOrder.length === newOrder.length && originalOrder.every((id, index) => id === newOrder[index]);

    if (isSameOrder) {
      originalDayOrderRef.current = [];
      return;
    }

    try {
      await api.post('/pooja/day-options/reorder/', { order: newOrder });
      originalDayOrderRef.current = [];
      setNotice('Day options reordered.');
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not reorder day options';
      setNotice(typeof detail === 'string' ? detail : 'Error reordering day options');
      revertDayOrder();
    }
  };

  const resetHeaderForm = () => {
    setEditingHeader(null);
    headerForm.reset({ headerName: '' });
  };

  const resetPoojaForm = () => {
    setEditingPooja(null);
    poojaForm.reset({ code: '', poojaDescription: '', rate: '', headerId: '' });
  };

  const onSubmitHeader = async (values: HeaderFormValues) => {
    const name = values.headerName.trim();
    if (!name) {
      setNotice('Please enter a header name.');
      return;
    }

    const code = editingHeader ? editingHeader.code : generateHeaderCode(name);

    const payload = {
      code,
      name,
      description: '',
      is_group_header: true,
      parent_id: null,
    };

    try {
      if (editingHeader) {
        await api.patch(`/pooja/options/${editingHeader.id}/`, payload);
        setNotice('Header updated.');
      } else {
        await api.post('/pooja/options/', payload);
        setNotice('Header added.');
      }
      resetHeaderForm();
      await load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not save header';
      setNotice(typeof detail === 'string' ? detail : 'Error saving header');
    }
  };

  const onSubmitPooja = async (values: PoojaOptionFormValues) => {
    const rawCode = values.code.trim();
    const name = values.poojaDescription.trim();
    const rate = values.rate.trim();
    const headerId = values.headerId ? Number(values.headerId) : null;

    if (!rawCode || !name) {
      setNotice('Code and description are required.');
      return;
    }

    if (!rate) {
      setNotice('Rate is required for the pooja.');
      return;
    }

    const payload: Record<string, any> = {
      code: rawCode,
      name,
      description: rate,
      is_group_header: false,
      parent_id: headerId,
    };

    try {
      if (editingPooja) {
        await api.patch(`/pooja/options/${editingPooja.id}/`, payload);
        setNotice('Pooja option updated.');
      } else {
        await api.post('/pooja/options/', payload);
        setNotice('Pooja option saved.');
      }
      resetPoojaForm();
      await load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not save pooja option';
      setNotice(typeof detail === 'string' ? detail : 'Error saving pooja option');
    }
  };

  const handleEditHeader = (header: PoojaOption) => {
    if (editingPooja) {
      resetPoojaForm();
    }
    setEditingHeader(header);
    headerForm.reset({ headerName: header.name });
  };

  const handleEditPooja = (pooja: PoojaOption) => {
    setEditingPooja(pooja);
    poojaForm.reset({
      code: pooja.code,
      poojaDescription: pooja.name,
      rate: pooja.description ?? '',
      headerId: pooja.parent_id ? String(pooja.parent_id) : '',
    });
  };

  const handleDeletePooja = async (pooja: PoojaOption) => {
    const hasChildren = poojaOptions.some((option) => option.parent_id === pooja.id);
    const message = hasChildren
      ? `Delete header "${pooja.name}"? This will also remove all linked pooja entries.`
      : `Delete pooja "${pooja.name}"?`;
    if (!window.confirm(message)) return;
    try {
      await api.delete(`/pooja/options/${pooja.id}/`);
      setNotice('Pooja option deleted.');
      if (editingPooja?.id === pooja.id) {
        resetPoojaForm();
      }
      if (editingHeader?.id === pooja.id) {
        resetHeaderForm();
      }
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not delete pooja option';
      setNotice(typeof detail === 'string' ? detail : 'Error deleting pooja option');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-16">
      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:px-6 lg:px-8">
        {/* Header Section */}
        <header className="rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-800 p-8 text-white shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-white/10 p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Admin Console</p>
              </div>
              <h1 className="mt-3 text-3xl font-bold leading-tight">Master Data Control</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/90">
                Configure headers, pooja catalog items, and day codes that power bookings and rituals.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={load}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Refresh Data
              </button>
              <div className="flex items-center gap-2 text-xs font-medium text-white/80">
                <span className={`flex h-2 w-2 rounded-full ${isLoading ? 'bg-yellow-300 animate-pulse' : 'bg-emerald-300'}`} />
                {isLoading ? 'Syncing data...' : 'Data synced with backend'}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="group rounded-2xl bg-white/15 p-5 shadow-sm backdrop-blur transition-all duration-300 hover:bg-white/20 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-white/75">{card.label}</p>
                    <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                    <p className="mt-1 text-xs text-white/70">{card.helper}</p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-2 text-white/80 group-hover:text-white">
                    {card.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* Notice Alert */}
        {notice && (
          <div className="rounded-2xl border-l-4 border-indigo-500 bg-indigo-50 px-6 py-4 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-indigo-800">{notice}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pooja Catalogue Section */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Pooja Catalogue</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Maintain headers and their individual pooja entries. These settings are used across registrations.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-[360px,1fr]">
            {/* Sidebar Forms */}
            <aside className="space-y-6 lg:sticky lg:top-28">
              {/* Header Form */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{editingHeader ? 'Edit Header' : 'Add Header'}</h3>
                </div>
                <p className="mb-4 text-sm text-slate-600">Group pooja entries by rituals or themes.</p>
                <form onSubmit={headerForm.handleSubmit(onSubmitHeader)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Header Title</label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Enter header name"
                      {...headerForm.register('headerName', { required: true })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {editingHeader ? 'Update Header' : 'Save Header'}
                    </button>
                    {editingHeader && (
                      <button
                        type="button"
                        onClick={resetHeaderForm}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Cancel
                      </button>
                    )}
                  </div>
                  {!editingHeader && <p className="text-xs text-slate-500">A header code will be generated automatically.</p>}
                </form>
              </div>

              {/* Pooja Form */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-lg bg-purple-100 p-1.5 text-purple-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{editingPooja ? 'Edit Pooja Item' : 'Add Pooja Item'}</h3>
                </div>
                <p className="mb-4 text-sm text-slate-600">Create individual pooja offerings and link them to headers.</p>
                <form onSubmit={poojaForm.handleSubmit(onSubmitPooja)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Code</label>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        placeholder="Enter code"
                        {...poojaForm.register('code', { required: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Header</label>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        {...poojaForm.register('headerId')}
                      >
                        <option value="">None</option>
                        {availableParentOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Pooja Description</label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      placeholder="Enter description"
                      {...poojaForm.register('poojaDescription', { required: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Rate</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      placeholder="Enter rate"
                      {...poojaForm.register('rate', { required: true })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {editingPooja ? 'Update Pooja' : 'Save Pooja'}
                    </button>
                    {editingPooja && (
                      <button
                        type="button"
                        onClick={resetPoojaForm}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </aside>

            {/* Main Content */}
            <div className="space-y-6">
              {headerSections.map(({ option, children }) => (
                <article
                  key={option.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-6 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-indigo-800">{option.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-medium text-indigo-800">
                              Header
                            </span>
                            {option.code && (
                              <span className="font-mono text-xs uppercase tracking-widest text-slate-500">#{option.code}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditHeader(option)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          Edit Header
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePooja(option)}
                          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    {children.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="mt-2 text-sm text-slate-500">No pooja entries under this header yet.</p>
                      </div>
                    )}
                    
                    {children.length > 0 && (
                      <div className="space-y-3">
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-purple-300 hover:shadow-md"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-800">
                                <span className="text-xs font-semibold">
                                  {child.code ? child.code.substring(0, 2) : 'PK'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">
                                  {child.name}
                                  {child.code ? (
                                    <span className="ml-2 font-mono text-xs uppercase tracking-widest text-slate-500">{child.code}</span>
                                  ) : null}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                  {child.description && (
                                    <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 font-medium text-purple-700">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                      </svg>
                                      Rate: {child.description}
                                    </span>
                                  )}
                                  {child.parent_id && (
                                    <span className="inline-flex items-center text-slate-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                                      </svg>
                                      Linked
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditPooja(child)}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePooja(child)}
                                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {ungroupedPoojas.length > 0 && (
                <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:border-slate-300 hover:shadow-md">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-200 p-2 text-slate-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Other Poojas</h3>
                      </div>
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
                        Ungrouped
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="space-y-3">
                      {ungroupedPoojas.map((pooja) => (
                        <div
                          key={pooja.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-800">
                              <span className="text-xs font-semibold">
                                {pooja.code ? pooja.code.substring(0, 2) : 'PK'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                {pooja.name}
                                {pooja.code ? (
                                  <span className="ml-2 font-mono text-xs uppercase tracking-widest text-slate-500">{pooja.code}</span>
                                ) : null}
                              </p>
                              {pooja.description && (
                                <div className="mt-1 flex items-center text-xs text-slate-500">
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                    </svg>
                                    Rate: {pooja.description}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditPooja(pooja)}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePooja(pooja)}
                              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              )}

              {headerSections.length === 0 && ungroupedPoojas.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-slate-900">No pooja entries yet</h3>
                  <p className="mt-2 text-sm text-slate-500">Start by creating a header and add items to it.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* English Day Options Section */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Day Options — English Codes</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Manage weekday and special day tags. Drag to reorder the sequence users see.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-[360px,1fr]">
            <aside className="space-y-6 lg:sticky lg:top-28">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-lg bg-blue-100 p-1.5 text-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{isEditingEnglishDay ? 'Edit Day Option' : 'Add Day Option'}</h3>
                </div>
                <p className="mb-4 text-sm text-slate-600">Use codes like MON, TUE or festival identifiers.</p>
                <form onSubmit={dayForm.handleSubmit(onCreateDayOption)} className="space-y-4">
                  <input type="hidden" {...dayForm.register('category')} />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Code</label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                      placeholder="Enter code"
                      disabled={isEditingTamilDay}
                      {...dayForm.register('code', { required: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Description</label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                      placeholder="Enter description"
                      disabled={isEditingTamilDay}
                      {...dayForm.register('description', { required: true })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isEditingTamilDay}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {isEditingEnglishDay ? 'Update Day Option' : 'Save Day Option'}
                    </button>
                    {isEditingEnglishDay && (
                      <button
                        type="button"
                        onClick={clearDayEditing}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </aside>

            <div>
              <ul className="space-y-3">
                {englishDayOptions.map((day) => (
                  <li
                    key={day.id}
                    draggable
                    onDragStart={(event) => handleDayDragStart(event, day.id)}
                    onDragOver={(event) => handleDayDragOver(event, day.id)}
                    onDragEnd={handleDayDragEnd}
                    onDrop={(event) => event.preventDefault()}
                    aria-grabbed={draggingDayId === day.id}
                    className={`group flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 ${
                      draggingDayId === day.id
                        ? 'cursor-grabbing border-blue-400 bg-blue-50 shadow-md'
                        : 'cursor-grab border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {day.description}{' '}
                          <span className="ml-2 font-mono text-xs uppercase tracking-widest text-slate-500">{day.code}</span>
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                          {formatCategoryLabel(day.category)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditDay(day)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDay(day)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {englishDayOptions.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-slate-900">No English day options yet</h3>
                  <p className="mt-2 text-sm text-slate-500">Add codes to define weekday availability.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tamil Day Options Section */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Day Options — Tamil Codes</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Maintain nakshatra-based day references. These drive Tamil-specific scheduling.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-[360px,1fr]">
            <aside className="space-y-6 lg:sticky lg:top-28">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{isEditingTamilDay ? 'Edit Tamil Day' : 'Add Tamil Day'}</h3>
                </div>
                <p className="mb-4 text-sm text-slate-600">Capture nakshatra shortcuts and their descriptions.</p>
                <form onSubmit={tamilDayForm.handleSubmit(onCreateTamilDayOption)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Code</label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100"
                      placeholder="Enter code"
                      disabled={isEditingEnglishDay}
                      {...tamilDayForm.register('code', { required: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Description</label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100"
                      placeholder="Enter description"
                      disabled={isEditingEnglishDay}
                      {...tamilDayForm.register('description', { required: true })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isEditingEnglishDay}
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {isEditingTamilDay ? 'Update Tamil Day Option' : 'Save Tamil Day Option'}
                    </button>
                    {isEditingTamilDay && (
                      <button
                        type="button"
                        onClick={clearDayEditing}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </aside>

            <div>
              <ul className="space-y-3">
                {tamilDayOptions.map((day) => (
                  <li
                    key={day.id}
                    draggable
                    onDragStart={(event) => handleDayDragStart(event, day.id)}
                    onDragOver={(event) => handleDayDragOver(event, day.id)}
                    onDragEnd={handleDayDragEnd}
                    onDrop={(event) => event.preventDefault()}
                    aria-grabbed={draggingDayId === day.id}
                    className={`group flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 ${
                      draggingDayId === day.id
                        ? 'cursor-grabbing border-amber-400 bg-amber-50 shadow-md'
                        : 'cursor-grab border-slate-200 hover:border-amber-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {day.description}{' '}
                          <span className="ml-2 font-mono text-xs uppercase tracking-widest text-slate-500">{day.code}</span>
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          {formatCategoryLabel(day.category)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditDay(day)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDay(day)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {tamilDayOptions.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-slate-900">No Tamil day options yet</h3>
                  <p className="mt-2 text-sm text-slate-500">Add nakshatra codes to enable Tamil calendar workflows.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminMasterPage;