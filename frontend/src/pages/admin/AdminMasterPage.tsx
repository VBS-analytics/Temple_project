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

type PoojaOptionFormValues = {
  code: string;
  poojaDescription: string;
  rate: string;
  headerId: string;
};

type HeaderFormValues = {
  headerName: string;
};

// ↓↓↓ UPDATED: Only two categories ↓↓↓
const categories = [
  { value: 'weekday', label: 'English Day' },
  { value: 'tamil_star', label: 'Tamil Star' },
];

const categoryDisplayNames: Record<string, string> = {
  weekday: 'English Day',
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
  const originalDayOrderRef = useRef<DayOption[]>([]);

  const dayForm = useForm<DayOptionFormValues>({ defaultValues: { code: '', description: '', category: 'weekday' } });
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

  const load = async () => {
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
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetDayForm = () => {
    setEditingDay(null);
    dayForm.reset({ code: '', description: '', category: 'weekday' });
  };

  const onCreateDayOption = async (values: DayOptionFormValues) => {
    try {
      if (editingDay) {
        await api.put(`/pooja/day-options/${editingDay.id}/`, values);
        setNotice('Day option updated.');
      } else {
        await api.post('/pooja/day-options/', values);
        setNotice('Day option saved.');
      }
      resetDayForm();
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not save day option';
      setNotice(typeof detail === 'string' ? detail : 'Error saving day option');
    }
  };

  const handleEditDay = (day: DayOption) => {
    setEditingDay(day);
    dayForm.reset({ code: day.code, description: day.description, category: day.category });
  };

  const handleDeleteDay = async (day: DayOption) => {
    if (!window.confirm(`Delete day option ${day.code}?`)) return;
    try {
      await api.delete(`/pooja/day-options/${day.id}/`);
      setNotice('Day option deleted.');
      if (editingDay?.id === day.id) {
        resetDayForm();
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
    <div className="space-y-6">
      <header className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Admin Master Data</h1>
        <p className="mt-1 text-sm text-slate-600">Manage Form-4/5/6 and daily message templates.</p>
        {notice && <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{notice}</p>}
      </header>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Pooja Master</h2>
        <p className="mt-1 text-sm text-slate-600">Maintain the master list of pooja headers and their individual entries.</p>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Add Header</h3>
            <form onSubmit={headerForm.handleSubmit(onSubmitHeader)} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Header Title</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 md:max-w-sm"
                  {...headerForm.register('headerName', { required: true })}
                />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  {editingHeader ? 'Update Header' : 'Save Header'}
                </button>
                {editingHeader && (
                  <button
                    type="button"
                    onClick={resetHeaderForm}
                    className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Add Pooja Item</h3>
            <form onSubmit={poojaForm.handleSubmit(onSubmitPooja)} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Code</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...poojaForm.register('code', { required: true })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Header</label>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...poojaForm.register('headerId')}>
                  <option value="">None</option>
                  {availableParentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Pooja Description</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  {...poojaForm.register('poojaDescription', { required: true })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Rate</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 md:max-w-xs"
                  {...poojaForm.register('rate', { required: true })}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  {editingPooja ? 'Update Pooja' : 'Save Pooja'}
                </button>
                {editingPooja && (
                  <button
                    type="button"
                    onClick={resetPoojaForm}
                    className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 space-y-6 text-sm">
          {headerSections.map(({ option, children }) => (
            <section key={option.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-brand-700">{option.name}</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditHeader(option)}
                    className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Edit Header
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePooja(option)}
                    className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {children.length === 0 && <p className="mt-3 text-xs text-slate-500">No pooja entries under this header yet.</p>}
              {children.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-200">
                  {children.map((child) => (
                    <li key={child.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <div>
                        <p className="font-medium text-slate-800">{child.name}{child.code ? ` — ${child.code}` : ''}</p>
                        {child.description && <p className="mt-1 text-xs text-slate-600">Rate: {child.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditPooja(child)}
                          className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePooja(child)}
                          className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {ungroupedPoojas.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">Other Poojas</h3>
              </div>
              <ul className="divide-y divide-slate-200">
                {ungroupedPoojas.map((pooja) => (
                  <li key={pooja.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">{pooja.name}{pooja.code ? ` — ${pooja.code}` : ''}</p>
                      {pooja.description && <p className="mt-1 text-xs text-slate-600">Rate: {pooja.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditPooja(pooja)}
                        className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePooja(pooja)}
                        className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {headerSections.length === 0 && ungroupedPoojas.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No pooja entries yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Day Options</h2>
        <p className="mt-1 text-sm text-slate-600">Represents Form-6 (Tamil stars / day codes).</p>

        <form onSubmit={dayForm.handleSubmit(onCreateDayOption)} className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Code</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...dayForm.register('code', { required: true })} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...dayForm.register('description', { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Category</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...dayForm.register('category')}>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4 flex items-center gap-3">
            <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              {editingDay ? 'Update Day Option' : 'Save Day Option'}
            </button>
            {editingDay && (
              <button
                type="button"
                onClick={resetDayForm}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {dayOptions.map((day) => (
            <li
              key={day.id}
              draggable
              onDragStart={(event) => handleDayDragStart(event, day.id)}
              onDragOver={(event) => handleDayDragOver(event, day.id)}
              onDragEnd={handleDayDragEnd}
              onDrop={(event) => event.preventDefault()}
              aria-grabbed={draggingDayId === day.id}
              className={`flex flex-wrap items-center justify-between gap-3 py-2 transition ${
                draggingDayId === day.id ? 'cursor-grabbing opacity-80' : 'cursor-grab'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">::</span>
                <span className="font-medium">
                  {day.description} — {day.code}
                </span>
                <span className="ml-3 text-xs uppercase text-slate-500">
                  {(categoryDisplayNames[day.category] ?? day.category).toUpperCase()}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEditDay(day)}
                  className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDay(day)}
                  className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {dayOptions.length === 0 && <li className="py-3 text-sm text-slate-500">No entries yet.</li>}
        </ul>
      </section>

    </div>
  );
};

export default AdminMasterPage;
