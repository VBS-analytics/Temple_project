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

const formatCurrency = (value?: string | null) => {
  if (!value) return '';
  const amountNumber = Number(value);
  if (Number.isNaN(amountNumber)) {
    return value;
  }
  return amountNumber.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const describePoojaAmount = (pooja: Pick<PoojaOption, 'default_amount' | 'min_amount' | 'max_amount' | 'description'>) => {
  const toLabel = (value?: string | null) => {
    const formatted = formatCurrency(value);
    return formatted ? `₹ ${formatted}` : '';
  };

  const defaultLabel = toLabel(pooja.default_amount);
  if (defaultLabel) return defaultLabel;

  const minLabel = toLabel(pooja.min_amount);
  const maxLabel = toLabel(pooja.max_amount);
  if (minLabel && maxLabel) {
    return `${minLabel} – ${maxLabel}`;
  }
  if (minLabel) return `Min ${minLabel}`;
  if (maxLabel) return `Max ${maxLabel}`;
  return pooja.description || '';
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
  minRate: string;
  maxRate: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'pooja' | 'english' | 'tamil'>('pooja');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const originalDayOrderRef = useRef<DayOption[]>([]);

  const dayForm = useForm<DayOptionFormValues>({ defaultValues: { code: '', description: '', category: 'weekday' } });
  const tamilDayForm = useForm<TamilDayOptionFormValues>({ defaultValues: { code: '', description: '' } });
  const headerForm = useForm<HeaderFormValues>({ defaultValues: { headerName: '' } });
  const poojaForm = useForm<PoojaOptionFormValues>({
    defaultValues: { code: '', poojaDescription: '', rate: '', minRate: '', maxRate: '', headerId: '' },
  });

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

  // Filter poojas based on search term
  const filteredHeaderSections = useMemo(() => {
    if (!searchTerm) return headerSections;
    
    return headerSections.map(section => ({
      option: section.option,
      children: section.children.filter(child => 
        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(section => 
      section.option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.option.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.children.length > 0
    );
  }, [headerSections, searchTerm]);
  
  const filteredUngroupedPoojas = useMemo(() => {
    if (!searchTerm) return ungroupedPoojas;
    
    return ungroupedPoojas.filter(pooja => 
      pooja.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pooja.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [ungroupedPoojas, searchTerm]);
  
  // For table view, create a flat list of all poojas with their headers
  const tableData = useMemo(() => {
    const result: Array<{
      item: PoojaOption;
      type: 'header' | 'pooja';
      headerName?: string;
      headerId?: number;
    }> = [];
    
    headerSections.forEach(section => {
      result.push({
        item: section.option,
        type: 'header',
        headerId: section.option.id,
      });
      
      section.children.forEach(child => {
        result.push({
          item: child,
          type: 'pooja',
          headerName: section.option.name,
          headerId: section.option.id,
        });
      });
    });
    
    ungroupedPoojas.forEach(pooja => {
      result.push({
        item: pooja,
        type: 'pooja'
      });
    });
    
    return result;
  }, [headerSections, ungroupedPoojas]);
  
  // Filter table data based on search term
  const filteredTableData = useMemo(() => {
    if (!searchTerm) return tableData;
    
    return tableData.filter(row => 
      row.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tableData, searchTerm]);

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

  // Enhanced error handling utility
  const extractErrorMessage = (error: any): string => {
    if (error?.response?.data) {
      const errorData = error.response.data;
      if (typeof errorData === 'string') {
        return errorData;
      } else if (errorData?.detail) {
        return errorData.detail;
      } else if (errorData?.message) {
        return errorData.message;
      } else if (errorData?.error) {
        return errorData.error;
      } else if (Array.isArray(errorData)) {
        return errorData.map(e => 
          typeof e === 'string' ? e : e.message || e.detail || JSON.stringify(e)
        ).join(', ');
      } else {
        return JSON.stringify(errorData);
      }
    } else if (error?.message) {
      return error.message;
    } else if (error?.request) {
      return 'Network error - no response from server';
    }
    return 'Unknown error occurred';
  };

  const fetchAllPages = async <T,>(initialUrl: string): Promise<T[]> => {
    const results: T[] = [];
    let nextUrl: string | null = initialUrl;

    const normalizeNextUrl = (nextValue: unknown): string | null => {
      if (typeof nextValue !== 'string' || nextValue.length === 0) {
        return null;
      }
      let path = nextValue;
      if (path.startsWith('http')) {
        try {
          const url = new URL(path);
          path = `${url.pathname}${url.search}`;
        } catch (err) {
          console.warn('Unable to parse next url', path, err);
          return null;
        }
      }
      if (path.startsWith('/')) {
        path = path.slice(1);
      }
      if (path.startsWith('api/')) {
        path = path.slice(4);
      }
      return path;
    };

    while (nextUrl) {
      const response = await api.get(nextUrl);
      results.push(...extractResults<T>(response.data));
      nextUrl = normalizeNextUrl(response.data?.next);
    }

    return results;
  };

  const load = async () => {
    const now = Date.now();
    if (isSyncing || (now - lastRefreshTime < 1000)) {
      return; // Prevent multiple simultaneous loads and rapid refreshes
    }
    
    setIsSyncing(true);
    try {
      const [newPoojaOptions, rawDayOptions] = await Promise.all([
        fetchAllPages<PoojaOption>('/pooja/options/?page_size=200'),
        fetchAllPages<DayOption>('/pooja/day-options/?page_size=200'),
      ]);
      
      // Clear editing states if items don't exist in new data
      if (editingPooja && !newPoojaOptions.some(p => p.id === editingPooja.id)) {
        resetPoojaForm();
      }
      if (editingHeader && !newPoojaOptions.some(p => p.id === editingHeader.id)) {
        resetHeaderForm();
      }
      
      setPoojaOptions(newPoojaOptions);
      setDayOptions(
        rawDayOptions
          .slice()
          .sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code)),
      );
      
      setLastRefreshTime(now);
    } catch (error) {
      console.error('Load error:', error);
      setNotice('Unable to load master data.');
    } finally {
      setIsSyncing(false);
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
    setIsSubmitting(true);
    const payload = editingDay && editingDay.category !== 'tamil_star'
      ? values
      : { ...values, category: 'weekday' };
    try {
      if (editingDay && editingDay.category !== 'tamil_star') {
        await api.put(`/pooja/day-options/${editingDay.id}/`, payload);
        setNotice('Day option updated successfully.');
      } else {
        await api.post('/pooja/day-options/', payload);
        setNotice('Day option saved successfully.');
      }
      clearDayEditing();
      load();
    } catch (err: any) {
      const errorMessage = extractErrorMessage(err);
      setNotice(`Error saving day option: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onCreateTamilDayOption = async (values: TamilDayOptionFormValues) => {
    setIsSubmitting(true);
    const payload = { ...values, category: 'tamil_star' };
    try {
      if (editingDay && editingDay.category === 'tamil_star') {
        await api.put(`/pooja/day-options/${editingDay.id}/`, payload);
        setNotice('Tamil day option updated successfully.');
      } else {
        await api.post('/pooja/day-options/', payload);
        setNotice('Tamil day option saved successfully.');
      }
      clearDayEditing();
      load();
    } catch (err: any) {
      const errorMessage = extractErrorMessage(err);
      setNotice(`Error saving Tamil day option: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
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
    setIsSubmitting(true);
    try {
      await api.delete(`/pooja/day-options/${day.id}/`);
      setNotice('Day option deleted successfully.');
      if (editingDay?.id === day.id) {
        clearDayEditing();
      }
      load();
    } catch (err: any) {
      const errorMessage = extractErrorMessage(err);
      if (errorMessage.includes('No PoojaDayOption matches the given query')) {
        setNotice('This day option was already deleted. The list will be refreshed.');
        clearDayEditing();
        load();
      } else {
        setNotice(`Error deleting day option: ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
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
      setNotice('Day options reordered successfully.');
    } catch (err: any) {
      const errorMessage = extractErrorMessage(err);
      setNotice(`Error reordering day options: ${errorMessage}`);
      revertDayOrder();
    }
  };

  const resetHeaderForm = () => {
    setEditingHeader(null);
    headerForm.reset({ headerName: '' });
  };

  const resetPoojaForm = () => {
    setEditingPooja(null);
    poojaForm.reset({ code: '', poojaDescription: '', rate: '', minRate: '', maxRate: '', headerId: '' });
  };

  const onSubmitHeader = async (values: HeaderFormValues) => {
    setIsSubmitting(true);
    const name = values.headerName.trim();
    if (!name) {
      setNotice('Please enter a header name.');
      setIsSubmitting(false);
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
        await api.put(`/pooja/options/${editingHeader.id}/`, payload);
        setNotice('Header updated successfully.');
      } else {
        await api.post('/pooja/options/', payload);
        setNotice('Header created successfully.');
      }
      resetHeaderForm();
      await load();
    } catch (err: any) {
      const errorMessage = extractErrorMessage(err);
      setNotice(`Error saving header: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitPooja = async (values: PoojaOptionFormValues) => {
    setIsSubmitting(true);
    const rawCode = values.code.trim();
    const name = values.poojaDescription.trim();
    const rate = values.rate.trim();
    const minRate = values.minRate.trim();
    const maxRate = values.maxRate.trim();
    const headerIdValue = values.headerId.trim();
    const headerId = headerIdValue ? Number(headerIdValue) : null;

    if (!rawCode || !name || !headerId) {
      setNotice('Code, header and pooja description are required.');
      setIsSubmitting(false);
      return;
    }

    if (!rate && !minRate && !maxRate) {
      setNotice('Please enter a rate, minimum rate or maximum rate.');
      setIsSubmitting(false);
      return;
    }

    const minNumber = minRate ? Number(minRate) : null;
    const maxNumber = maxRate ? Number(maxRate) : null;
    if (minNumber !== null && maxNumber !== null && minNumber > maxNumber) {
      setNotice('Minimum rate cannot be greater than maximum rate.');
      setIsSubmitting(false);
      return;
    }

    const payload: Record<string, any> = {
      code: rawCode,
      name,
      description: editingPooja?.description ?? '',
      default_amount: rate || null,
      min_amount: minRate || null,
      max_amount: maxRate || null,
      is_group_header: false,
      parent_id: headerId,
    };

    try {
      if (editingPooja) {
        // First verify the pooja still exists
        const existingPooja = poojaOptions.find(p => p.id === editingPooja.id);
        if (!existingPooja) {
          setNotice('This pooja item no longer exists. Please create a new one.');
          resetPoojaForm();
          await load();
          return;
        }

        await api.put(`/pooja/options/${editingPooja.id}/`, payload);
        setNotice('Pooja option updated successfully.');
      } else {
        await api.post('/pooja/options/', payload);
        setNotice('Pooja option created successfully.');
      }
      resetPoojaForm();
      await load();
    } catch (err: any) {
      const errorMessage = extractErrorMessage(err);
      
      // Handle specific error cases
      if (errorMessage.includes('No PoojaOption matches the given query')) {
        setNotice('This pooja item no longer exists. The list will be refreshed.');
        resetPoojaForm();
        await load();
      } else {
        setNotice(`Error saving pooja option: ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
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
      rate: pooja.default_amount ?? pooja.description ?? '',
      minRate: pooja.min_amount ?? '',
      maxRate: pooja.max_amount ?? '',
      headerId: pooja.parent_id ? String(pooja.parent_id) : '',
    });
  };

  const handleDeletePooja = async (pooja: PoojaOption) => {
    if (isSyncing || isSubmitting) {
      return; // Prevent multiple simultaneous operations
    }
    
    setIsSubmitting(true);
    try {
      // Verify this pooja still exists in our current state
      if (!poojaOptions.some(p => p.id === pooja.id)) {
        setNotice('Item not found in current data. Refreshing list...');
        await load();
        return;
      }
      
      // Get fresh data from backend to ensure we're working with latest state
      try {
        const verifyRes = await api.get(`/pooja/options/${pooja.id}/`);
        if (!verifyRes.data || verifyRes.data.id !== pooja.id) {
          throw new Error('Invalid response');
        }
      } catch (verifyErr: any) {
        if (verifyErr.response?.status === 404 || verifyErr.message === 'Invalid response') {
          setNotice('This item was already deleted. Refreshing list...');
          await load();
          return;
        }
        throw verifyErr;
      }

      const hasChildren = poojaOptions.some((option) => option.parent_id === pooja.id);
      const childCount = poojaOptions.filter(opt => opt.parent_id === pooja.id).length;
      
      const message = hasChildren
        ? `Delete header "${pooja.name}"? This will also remove all linked pooja entries (${childCount} items).`
        : `Delete pooja "${pooja.name}"?`;
        
      if (!window.confirm(message)) {
        return;
      }

      const deleteRes = await api.delete(`/pooja/options/${pooja.id}/`);
      
      if (deleteRes.status === 204) {
        // Immediately update local state
        setPoojaOptions(prev => {
          const filtered = hasChildren
            ? prev.filter(p => p.id !== pooja.id && p.parent_id !== pooja.id)
            : prev.filter(p => p.id !== pooja.id);
            
          return filtered;
        });
        
        // Reset any forms editing this item
        if (editingPooja?.id === pooja.id) {
          resetPoojaForm();
        }
        if (editingHeader?.id === pooja.id) {
          resetHeaderForm();
        }
        
        setNotice(hasChildren 
          ? `Successfully deleted "${pooja.name}" and all linked entries.`
          : `Successfully deleted "${pooja.name}".`
        );
      }
      
      // Always refresh to ensure consistency
      await load();
    } catch (err: any) {
      console.error('Delete error:', err);
      const errorMessage = extractErrorMessage(err);
      
      if (err.response?.status === 404) {
        setNotice('This pooja item no longer exists. The list will be refreshed.');
        await load();
      } else {
        setNotice(`Failed to delete: ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleHeaderCollapse = (headerId: number) => {
    setCollapsedHeaders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(headerId)) {
        newSet.delete(headerId);
      } else {
        newSet.add(headerId);
      }
      return newSet;
    });
  };

  const expandAllHeaders = () => {
    setCollapsedHeaders(new Set());
  };

  const collapseAllHeaders = () => {
    setCollapsedHeaders(new Set(headerSections.map(section => section.option.id)));
  };

  // Clear notice after 5 seconds
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-white pb-16">
      <div className="mx-auto max-w-full px-4 pt-6 sm:px-6 lg:px-8">
        {/* Header Section */}
        <header className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-700 via-rose-700 to-slate-900 p-5 sm:p-6 md:p-8 text-white shadow-2xl ring-1 ring-black/5">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.25) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-white/20 blur-3xl" aria-hidden />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white/90 backdrop-blur-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Console
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Master Data Control</h1>
                  <p className="mt-2 max-w-2xl text-sm sm:text-base text-orange-100/90">
                    Configure headers, pooja catalog items, and day codes that power bookings and rituals.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 text-sm text-white sm:flex-row sm:items-center">
                <button
                  onClick={load}
                  disabled={isLoading || isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Refresh Data
                </button>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-100">
                  <span className={`flex h-2 w-2 rounded-full ${isLoading ? 'bg-yellow-200 animate-pulse' : 'bg-lime-300'}`} />
                  {isLoading ? 'Syncing data…' : 'Data synced'}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="flex items-start gap-3 rounded-2xl bg-white/12 px-4 py-3 text-white shadow-inner ring-1 ring-white/30 backdrop-blur"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white">
                    {card.icon}
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-100/90">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-orange-100">{card.helper}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Notice Alert */}
        {notice && (
          <div className="mt-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50 px-4 sm:px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-800">{notice}</p>
                </div>
              </div>
              <button
                onClick={() => setNotice('')}
                className="text-orange-500 hover:text-orange-700"
              >
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-0">
              <nav className="flex -mb-px overflow-x-auto">
                <button
                  onClick={() => setActiveTab('pooja')}
                  className={`py-4 px-4 sm:px-6 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'pooja'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Pooja Catalogue
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('english')}
                  className={`py-4 px-4 sm:px-6 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'english'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    English Day Codes
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('tamil')}
                  className={`py-4 px-4 sm:px-6 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'tamil'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Tamil Day Codes
                  </div>
                </button>
              </nav>
              
              {/* Mobile menu button for form access */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden py-3 px-2 text-slate-500 hover:text-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Pooja Catalogue Tab */}
          {activeTab === 'pooja' && (
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">Pooja Catalogue</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>{headerCount} headers</span>
                    <span>•</span>
                    <span>{totalPoojaEntries} entries</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Search poojas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('card')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Card
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Table
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Forms - Hidden on mobile, shown when menu is open */}
                <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block w-full lg:w-80 space-y-6 lg:sticky lg:top-28 lg:h-fit`}>
                  {/* Header Form */}
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="rounded-lg bg-orange-100 p-1.5 text-orange-700">
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                          placeholder="Enter header name"
                          {...headerForm.register('headerName', { required: true })}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
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
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="rounded-lg bg-orange-100 p-1.5 text-orange-700">
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
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                            placeholder="Enter code"
                            {...poojaForm.register('code', { required: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Header</label>
                          <select
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                            {...poojaForm.register('headerId', { required: true })}
                          >
                            <option value="">Select header</option>
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                          placeholder="Enter rate"
                          {...poojaForm.register('rate')}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Minimum Rate</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                            placeholder="Enter minimum rate"
                            {...poojaForm.register('minRate')}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Maximum Rate</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                            placeholder="Enter maximum rate"
                            {...poojaForm.register('maxRate')}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">Code, header, description and at least one rate field are mandatory.</p>
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
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
                <div className="flex-1 space-y-6 min-w-0">
                  {headerSections.length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={expandAllHeaders}
                        className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                      >
                        Expand All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={collapseAllHeaders}
                        className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                      >
                        Collapse All
                      </button>
                    </div>
                  )}
                  
                  {viewMode === 'card' ? (
                    <>
                      {filteredHeaderSections.map(({ option, children }) => (
                        <article
                          key={option.id}
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:border-orange-300 hover:shadow-md"
                        >
                          <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-4 sm:px-6 py-4">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleHeaderCollapse(option.id)}
                                  className="rounded-lg bg-orange-100 p-2 text-orange-700 hover:bg-orange-200 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-5 w-5 transition-transform ${collapsedHeaders.has(option.id) ? '' : 'rotate-90'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                                <div>
                                  <h3 className="text-lg font-bold text-orange-800">{option.name}</h3>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 font-medium text-orange-800">
                                      Header
                                    </span>
                                    {option.code && (
                                      <span className="font-mono text-xs uppercase tracking-widest text-slate-500">#{option.code}</span>
                                    )}
                                    <span className="text-slate-400">{children.length} items</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditHeader(option)}
                                  disabled={isSubmitting}
                                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                  Edit Header
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePooja(option)}
                                  disabled={isSubmitting}
                                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {!collapsedHeaders.has(option.id) && (
                            <div className="p-4 sm:p-5">
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
                                  {children.map((child) => {
                                    const childRateLabel = describePoojaAmount(child);
                                    return (
                                    <div
                                      key={child.id}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-orange-300 hover:shadow-md"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-800">
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
                                            {childRateLabel && (
                                              <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 font-medium text-orange-700">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                                </svg>
                                                Rate: {childRateLabel}
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
                                          disabled={isSubmitting}
                                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                          </svg>
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeletePooja(child)}
                                          disabled={isSubmitting}
                                          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      ))}

                      {filteredUngroupedPoojas.length > 0 && (
                        <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:border-slate-300 hover:shadow-md">
                          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 sm:px-6 py-4">
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
                          <div className="p-4 sm:p-5">
                            <div className="space-y-3">
                              {filteredUngroupedPoojas.map((pooja) => {
                                const rateLabel = describePoojaAmount(pooja);
                                return (
                                  <div
                                    key={pooja.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md"
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
                                        {rateLabel && (
                                          <div className="mt-1 flex items-center text-xs text-slate-500">
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                              </svg>
                                              Rate: {rateLabel}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleEditPooja(pooja)}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                        </svg>
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePooja(pooja)}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </article>
                      )}
                    </>
                  ) : (
                    // Table View
                    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm min-w-0">
                      <table className="min-w-full table-fixed divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap w-2/6">
                              Name
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap w-1/6">
                              Code
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap w-[120px]">
                              Type
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap w-[100px]">
                              Rate
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap w-2/6">
                              Header
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap w-[140px]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredTableData.map((row) => {
                            if (!searchTerm && row.type === 'pooja' && row.headerId && collapsedHeaders.has(row.headerId)) {
                              return null;
                            }
                            return (
                            <tr key={row.item.id} className={row.type === 'header' ? 'bg-orange-50' : 'hover:bg-slate-50'}>
                              <td className="px-4 py-3">
                                <div className={`flex items-center ${row.type === 'pooja' ? 'pl-6' : ''}`}>
                                  {row.type === 'header' && (
                                    <button
                                      onClick={() => toggleHeaderCollapse(row.item.id)}
                                      className="mr-2 text-orange-600 hover:text-orange-900"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-4 w-4 transition-transform ${collapsedHeaders.has(row.item.id) ? '' : 'rotate-90'}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  )}
                                  <div className={`text-sm font-medium ${row.type === 'header' ? 'text-orange-900' : 'text-slate-900'} truncate`}>
                                    {row.item.name}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-slate-500 font-mono truncate">{row.item.code}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  row.type === 'header' 
                                    ? 'bg-orange-100 text-orange-800' 
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {row.type === 'header' ? 'Header' : 'Pooja'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-500">
                                {row.type === 'header' ? '-' : describePoojaAmount(row.item) || '--'}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-500">
                                <span className="truncate block">{row.headerName || '-'}</span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium">
                                <button
                                  onClick={() => row.type === 'header' ? handleEditHeader(row.item) : handleEditPooja(row.item)}
                                  disabled={isSubmitting}
                                  className="text-orange-600 hover:text-orange-900 mr-3 disabled:opacity-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePooja(row.item)}
                                  disabled={isSubmitting}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredHeaderSections.length === 0 && filteredUngroupedPoojas.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <h3 className="mt-4 text-lg font-medium text-slate-900">
                        {searchTerm ? 'No pooja entries found' : 'No pooja entries yet'}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {searchTerm ? 'Try a different search term' : 'Start by creating a header and add items to it.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* English Day Options Tab */}
          {activeTab === 'english' && (
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">Day Options — English Codes</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>{englishDayOptions.length} codes</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block w-full lg:w-80 space-y-6 lg:sticky lg:top-28 lg:h-fit`}>
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="rounded-lg bg-orange-100 p-1.5 text-orange-700">
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100"
                          placeholder="Enter code"
                          disabled={isEditingTamilDay || isSubmitting}
                          {...dayForm.register('code', { required: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Description</label>
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100"
                          placeholder="Enter description"
                          disabled={isEditingTamilDay || isSubmitting}
                          {...dayForm.register('description', { required: true })}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isEditingTamilDay || isSubmitting}
                          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
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

                <div className="flex-1">
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
                        className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 ${
                          draggingDayId === day.id
                            ? 'cursor-grabbing border-orange-400 bg-orange-50 shadow-md'
                            : 'cursor-grab border-slate-200 hover:border-orange-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-800">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {day.description}{' '}
                              <span className="ml-2 font-mono text-xs uppercase tracking-widest text-slate-500">{day.code}</span>
                            </p>
                            <span className="mt-2 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                              {formatCategoryLabel(day.category)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditDay(day)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDay(day)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
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
            </div>
          )}

          {/* Tamil Day Options Tab */}
          {activeTab === 'tamil' && (
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">Day Options — Tamil Codes</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>{tamilDayOptions.length} codes</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block w-full lg:w-80 space-y-6 lg:sticky lg:top-28 lg:h-fit`}>
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="rounded-lg bg-orange-100 p-1.5 text-orange-700">
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100"
                          placeholder="Enter code"
                          disabled={isEditingEnglishDay || isSubmitting}
                          {...tamilDayForm.register('code', { required: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Description</label>
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100"
                          placeholder="Enter description"
                          disabled={isEditingEnglishDay || isSubmitting}
                          {...tamilDayForm.register('description', { required: true })}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isEditingEnglishDay || isSubmitting}
                          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
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

                <div className="flex-1">
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
                        className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 ${
                          draggingDayId === day.id
                            ? 'cursor-grabbing border-orange-400 bg-orange-50 shadow-md'
                            : 'cursor-grab border-slate-200 hover:border-orange-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-800">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {day.description}{' '}
                              <span className="ml-2 font-mono text-xs uppercase tracking-widest text-slate-500">{day.code}</span>
                            </p>
                            <span className="mt-2 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                              {formatCategoryLabel(day.category)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditDay(day)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDay(day)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

AdminMasterPage.displayName = 'AdminMasterPage';
export default AdminMasterPage;
