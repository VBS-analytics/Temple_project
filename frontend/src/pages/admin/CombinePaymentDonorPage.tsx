import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../../lib/api';

interface DonorOption {
  id: number;
  name: string;
  phone: string;
}

interface MappingForm {
  id: number;
  mainPhone: string;
  parentPhones: string[];
  parentUncombineMonths: string[];
  effectiveMonth: string;
  statusMessage: { type: 'error' | 'success'; text: string } | null;
}

interface StoredParentEntry extends DonorOption {
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  active?: boolean | null;
}

interface StoredMappingEntry {
  id: number;
  mainDonor: DonorOption;
  parentDonors: StoredParentEntry[];
  savedAtLabel: string;
}

const DATELIST_ID = 'combine-donor-phone-options';

const createMappingForm = (): MappingForm => ({
  id: Date.now() + Math.random(),
  mainPhone: '',
  parentPhones: [''],
  parentUncombineMonths: [''],
  effectiveMonth: '',
  statusMessage: null,
});

const formatSavedAtLabel = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatMonthLabel = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4}-\d{2})/);
  if (!match) {
    return value;
  }
  const [year, month] = match[1].split('-');
  const parsed = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};

const toMonthInputValue = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : '';
};

const toDateInputValue = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4}-\d{2})/);
  return match ? `${match[1]}-01` : '';
};

const monthFromDateValue = (value: string) => (value ? value.slice(0, 7) : '');

const CombinePaymentDonorPage = () => {
  const [mappingForms, setMappingForms] = useState<MappingForm[]>(() => [createMappingForm()]);
  const [history, setHistory] = useState<StoredMappingEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [donorOptions, setDonorOptions] = useState<DonorOption[]>([]);
  const [donorsLoading, setDonorsLoading] = useState(true);
  const [donorsError, setDonorsError] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const mountedRef = useRef(false);

  const donorStatusMessage = donorsLoading
    ? 'Loading donors from the database…'
    : donorsError
      ? `Unable to load donors: ${donorsError}`
      : `${donorOptions.length} donor${donorOptions.length === 1 ? '' : 's'} loaded from the database.`;
  const mappingStatusMessage = historyLoading
    ? 'Loading stored mappings…'
    : historyError
      ? `Unable to load mappings: ${historyError}`
      : `${history.length} mapping${history.length === 1 ? '' : 's'} stored`;

  const findDonorDisplay = useCallback(
    (phone: string | undefined | null) => {
      if (!phone) {
        return null;
      }
      const normalized = phone.trim();
      if (!normalized) {
        return null;
      }
      const match = donorOptions.find((donor) => donor.phone === normalized);
      return match ? match.name : null;
    },
    [donorOptions],
  );

  const loadMappings = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await api.get('payments/combine-mappings/');
      const payload = Array.isArray(response.data) ? response.data : [];
      if (!mountedRef.current) {
        return;
      }
      const entries: StoredMappingEntry[] = payload
        .map((entry: any) => {
          const main = entry?.main_donor;
          if (!main || !main.phone) {
            return null;
          }
          const parents = Array.isArray(entry.parent_donors)
            ? entry.parent_donors
                .filter((parent: any) => parent?.phone)
                .map((parent: any) => ({
                  id: parent.id,
                  name: parent.name ?? 'Unnamed',
                  phone: parent.phone,
                  effectiveFrom: parent.effective_from ?? null,
                  effectiveTo: parent.effective_to ?? null,
                  active: typeof parent.active === 'boolean' ? parent.active : null,
                }))
            : [];
          return {
            id: main.id,
            mainDonor: {
              id: main.id,
              name: main.name ?? 'Unnamed',
              phone: main.phone,
            },
            parentDonors: parents,
            savedAtLabel: formatSavedAtLabel(entry?.saved_at),
          };
        })
        .filter((entry): entry is StoredMappingEntry => Boolean(entry));
      setHistory(entries);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      const message = isAxiosError(error)
        ? error.response?.data?.detail ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to load stored mappings.';
      setHistoryError(message);
    } finally {
      if (!mountedRef.current) {
        return;
      }
      setHistoryLoading(false);
    }
  }, []);

  const handleEditMapping = (entry: StoredMappingEntry) => {
    setEditingEntryId(entry.mainDonor.id);
    const firstParent = entry.parentDonors[0];
    setMappingForms([
      {
        id: Date.now(),
        mainPhone: entry.mainDonor.phone,
        parentPhones: entry.parentDonors.map((parent) => parent.phone || ''),
        parentUncombineMonths: entry.parentDonors.map((parent) => toMonthInputValue(parent.effectiveTo)),
        effectiveMonth: toMonthInputValue(firstParent?.effectiveFrom),
        statusMessage: null,
      },
    ]);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setMappingForms([createMappingForm()]);
  };

  const handleDeleteMapping = async (entry: StoredMappingEntry) => {
    setDeletingEntryId(entry.mainDonor.id);
    try {
      await api.delete('payments/combine-mappings/', {
        data: { main_phone: entry.mainDonor.phone },
      });
      setHistoryError(null);
      loadMappings();
      if (editingEntryId === entry.mainDonor.id) {
        handleCancelEdit();
      }
    } catch (error) {
      if (isAxiosError(error)) {
        setHistoryError(error.response?.data?.detail ?? error.message);
      } else if (error instanceof Error) {
        setHistoryError(error.message);
      } else {
        setHistoryError('Unable to delete mapping.');
      }
    } finally {
      setDeletingEntryId(null);
    }
  };

  const mutateForm = (formId: number, update: (form: MappingForm) => MappingForm) => {
    setMappingForms((previous) =>
      previous.map((form) => (form.id === formId ? update(form) : form)),
    );
  };

  const addMappingForm = () => {
    setMappingForms((previous) => [...previous, createMappingForm()]);
  };

  const removeMappingForm = (formId: number) => {
    setMappingForms((previous) => {
      if (previous.length === 1) {
        return previous;
      }
      return previous.filter((form) => form.id !== formId);
    });
  };

  const handleMainPhoneChange = (formId: number, value: string) => {
    mutateForm(formId, (form) => ({
      ...form,
      mainPhone: value,
      statusMessage: null,
    }));
  };

  const handleParentChange = (formId: number, index: number, value: string) => {
    mutateForm(formId, (form) => ({
      ...form,
      parentPhones: form.parentPhones.map((phone, key) => (key === index ? value : phone)),
      statusMessage: null,
    }));
  };

  const handleAddParent = (formId: number) => {
    mutateForm(formId, (form) => ({
      ...form,
      parentPhones: [...form.parentPhones, ''],
      parentUncombineMonths: [...form.parentUncombineMonths, ''],
      statusMessage: null,
    }));
  };

  const handleRemoveParent = (formId: number, index: number) => {
    mutateForm(formId, (form) => {
      const next = form.parentPhones.filter((_, key) => key !== index);
      const nextMonths = form.parentUncombineMonths.filter((_, key) => key !== index);
      return {
        ...form,
        parentPhones: next.length > 0 ? next : [''],
        parentUncombineMonths: nextMonths.length > 0 ? nextMonths : [''],
        statusMessage: null,
      };
    });
  };

  const handleEffectiveMonthChange = (formId: number, value: string) => {
    mutateForm(formId, (form) => ({
      ...form,
      effectiveMonth: value,
      statusMessage: null,
    }));
  };

  const handleUncombineMonthChange = (formId: number, index: number, value: string) => {
    mutateForm(formId, (form) => ({
      ...form,
      parentUncombineMonths: form.parentUncombineMonths.map((month, key) =>
        key === index ? value : month,
      ),
      statusMessage: null,
    }));
  };

  const handleSaveMapping = async (formId: number) => {
    const form = mappingForms.find((item) => item.id === formId);
    if (!form) {
      return;
    }
    const trimmedMain = form.mainPhone.trim();
    if (!trimmedMain) {
      mutateForm(formId, (current) => ({
        ...current,
        statusMessage: { type: 'error', text: 'A main donor phone number is required to save the mapping.' },
      }));
      return;
    }
    const parentRows = form.parentPhones
      .map((value, index) => ({
        phone: value.trim(),
        uncombineMonth: (form.parentUncombineMonths[index] ?? '').trim(),
      }))
      .filter((row) => row.phone.length > 0);
    const dedupedParents = Array.from(
      parentRows.reduce((acc, row) => {
        if (!acc.has(row.phone)) {
          acc.set(row.phone, row);
          return acc;
        }
        const existing = acc.get(row.phone)!;
        if (!existing.uncombineMonth && row.uncombineMonth) {
          acc.set(row.phone, row);
        }
        return acc;
      }, new Map<string, { phone: string; uncombineMonth: string }>())
        .values(),
    );
    const trimmedParents = dedupedParents.map((row) => row.phone);
    if (trimmedParents.length === 0) {
      mutateForm(formId, (current) => ({
        ...current,
        statusMessage: {
          type: 'error',
          text: 'Add at least one parent donor phone number before saving.',
        },
      }));
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        main_phone: trimmedMain,
        parent_phones: trimmedParents,
      };
      const effectiveMonthValue = form.effectiveMonth.trim();
      if (effectiveMonthValue) {
        payload.effective_month = effectiveMonthValue;
      }
      await api.post('payments/combine-mappings/', payload);

      const uncombineRows = dedupedParents.filter((row) => row.uncombineMonth);
      for (const row of uncombineRows) {
        await api.delete('payments/combine-mappings/', {
          data: {
            main_phone: trimmedMain,
            parent_phones: [row.phone],
            uncombine_month: row.uncombineMonth,
          },
        });
      }

      mutateForm(formId, () => ({
        ...createMappingForm(),
        id: formId,
        statusMessage: {
          type: 'success',
          text:
            uncombineRows.length > 0
              ? 'Mapping stored and uncombine month updated for selected parent donors.'
              : 'Mapping stored in the database.',
        },
      }));
      setEditingEntryId(null);
      loadMappings();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.detail ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to save mapping.';
      mutateForm(formId, (current) => ({
        ...current,
        statusMessage: { type: 'error', text: message },
      }));
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const loadDonors = async () => {
      setDonorsLoading(true);
      setDonorsError(null);
      try {
        const response = await api.get('auth/donors/');
        if (!mountedRef.current) {
          return;
        }
        const payload = Array.isArray(response.data) ? response.data : [];
        const options = payload
          .map((entry: any) => {
            const user = entry?.user;
            if (!user) {
              return null;
            }
            const phone = (user.phone_number ?? '').trim();
            if (!phone) {
              return null;
            }
            return {
              id: user.id,
              name: user.name ?? 'Unnamed',
              phone,
            };
          })
          .filter((value): value is DonorOption => Boolean(value));
        setDonorOptions(options);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to load donors.';
        setDonorsError(message);
      } finally {
        if (!mountedRef.current) {
          return;
        }
        setDonorsLoading(false);
      }
    };

    loadDonors();
    loadMappings();
    return () => {
      mountedRef.current = false;
    };
  }, [loadMappings]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Combine Payment - Donor</h1>
          <p className="text-sm text-slate-600">
            Map parent donors to a main donor so only the main donor needs to interact with the combine payment flow.
          </p>
          <p className="text-xs text-slate-500">{donorStatusMessage}</p>
          <p className="text-xs text-slate-500">{mappingStatusMessage}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addMappingForm}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Add another main donor
            </button>
            {editingEntryId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>
      </header>

      <datalist id={DATELIST_ID}>
        {donorOptions.map((donor) => (
          <option
            key={`donor-option-${donor.id}`}
            value={donor.phone}
            label={`${donor.name} — ${donor.phone}`}
          />
        ))}
      </datalist>

      <div className="space-y-6">
        {mappingForms.map((form, index) => {
          const trimmedParents = form.parentPhones
            .map((value, idx) => ({
              phone: value.trim(),
              uncombineMonth: (form.parentUncombineMonths[idx] ?? '').trim(),
            }))
            .filter((row) => row.phone.length > 0);

          return (
            <section key={form.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-600">Main Donor #{index + 1}</p>
                  <p className="text-xs text-slate-400">Only this main donor should trigger the combine payment screen.</p>
                </div>
                {mappingForms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMappingForm(form.id)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Main Donor</p>
                      <p className="text-xs text-slate-400">Only this donor should see the combine payment screen.</p>
                    </div>
                    <label className="block text-sm font-medium text-slate-700">
                      Phone number
                      <input
                        type="tel"
                        list={DATELIST_ID}
                        className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={form.mainPhone}
                        onChange={(event) => handleMainPhoneChange(form.id, event.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </label>
                    {(() => {
                      const name = findDonorDisplay(form.mainPhone);
                      return name ? (
                        <p className="mt-1 text-xs font-medium text-slate-500">Donor: {name}</p>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Parent Donors</p>
                      <p className="text-xs text-slate-400">
                        Map multiple parent donors to this main donor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddParent(form.id)}
                      aria-label="Add parent donor phone number"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-slate-300 text-2xl font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                    >
                      +
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {form.parentPhones.map((value, idx) => (
                      <div key={`parent-${form.id}-${idx}`} className="flex items-center gap-3">
                        <div className="flex-1 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            <span className="sr-only">Parent donor phone number {idx + 1}</span>
                            <input
                              type="tel"
                              list={DATELIST_ID}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="+91 91234 56789"
                              value={value}
                              onChange={(event) => handleParentChange(form.id, idx, event.target.value)}
                            />
                          </label>
                          {(() => {
                            const parentName = findDonorDisplay(value);
                            return parentName ? (
                              <p className="text-xs font-medium text-slate-500">Donor: {parentName}</p>
                            ) : null;
                          })()}
                          <label className="block text-xs font-medium text-slate-600">
                            Uncombine from (optional)
                            <input
                              type="date"
                              value={toDateInputValue(form.parentUncombineMonths[idx])}
                              onChange={(event) =>
                                handleUncombineMonthChange(
                                  form.id,
                                  idx,
                                  monthFromDateValue(event.target.value),
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="Select date"
                              min="2000-01-01"
                            />
                          </label>
                        </div>
                        {form.parentPhones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParent(form.id, idx)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                            aria-label={`Remove parent donor number ${idx + 1}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveMapping(form.id)}
                    className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    Save mapping
                  </button>
                </div>
                {form.statusMessage && (
                  <p
                    className={`text-sm font-medium ${
                      form.statusMessage.type === 'error' ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {form.statusMessage.text}
                  </p>
                )}
                {trimmedParents.length > 0 && (
                  <>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p className="font-medium text-slate-800">
                        Main donor:{' '}
                        <span className="text-indigo-600">{form.mainPhone.trim() || '—'}</span>
                      </p>
                      <p className="text-xs">Parent donors ready to map:</p>
                      <div className="flex flex-wrap gap-2">
                        {trimmedParents.map((row, previewIndex) => (
                          <span
                            key={`preview-${form.id}-${previewIndex}-${row.phone}`}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {row.phone}
                            {row.uncombineMonth
                              ? ` (Uncombine: ${formatMonthLabel(row.uncombineMonth)})`
                              : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Effective from
                        <input
                          type="date"
                          value={toDateInputValue(form.effectiveMonth)}
                          onChange={(event) =>
                            handleEffectiveMonthChange(
                              form.id,
                              monthFromDateValue(event.target.value),
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          placeholder="Select date"
                          min="2000-01-01"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Donor Mapping List</h2>
          <p className="text-xs text-slate-500">Stored in the database</p>
        </div>
        {historyLoading ? (
          <p className="text-sm text-slate-500">Loading stored mappings…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No mappings recorded yet.</p>
        ) : (
          <div className="grid gap-3">
            {history.map((entry) => (
              <article
                key={`${entry.mainDonor.id}-${entry.savedAtLabel}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-800 shadow-sm"
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Main</p>
                    <p className="text-xs text-slate-500">Saved {entry.savedAtLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditMapping(entry)}
                      className="rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMapping(entry)}
                      disabled={deletingEntryId === entry.mainDonor.id}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingEntryId === entry.mainDonor.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {entry.mainDonor.name || entry.mainDonor.phone}
                </p>
                <p className="text-xs text-slate-500">{entry.mainDonor.phone}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.parentDonors.map((parent, parentIndex) => (
                    <span
                      key={`history-${entry.mainDonor.id}-${parentIndex}-${parent.phone}`}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700"
                    >
                      {parent.name} — {parent.phone}
                    </span>
                  ))}
                </div>
                {entry.parentDonors.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Effective from {formatMonthLabel(entry.parentDonors[0]?.effectiveFrom)}
                    {entry.parentDonors[0]?.effectiveTo
                      ? ` • Uncombine from ${formatMonthLabel(entry.parentDonors[0]?.effectiveTo)}`
                      : ''}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CombinePaymentDonorPage;
