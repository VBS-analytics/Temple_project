import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import api, { extractResults } from '../lib/api';

interface Option {
  id: number;
  code: string;
  name: string;
  default_amount: string | null;
}

interface DayOption {
  id: number;
  code: string;
  description: string;
}

interface ProfilePayload {
  user: {
    name: string;
    phone_number: string;
  };
  profile: {
    address_line1?: string;
    address_line2?: string;
    address_line3?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  members?: Array<{
    id: number;
    name: string;
    gender?: string;
    relationship?: string;
    date_of_birth?: string | null;
    tamil_star?: string;
    gothra?: string;
  }>;
}

interface RegistrationMember {
  id?: number;
  name: string;
  phone_number: string;
  relationship: string;
  gender?: string;
  date_of_birth?: string | null;
  tamil_star?: string;
  gothra?: string;
  _source?: 'family' | 'manual';
}

interface RegistrationPayload {
  id: number;
  donor_name?: string;
  donor_phone?: string;
  pooja_option: number;
  pooja_option_name?: string;
  day_option?: number | null;
  day_option_description?: string | null;
  start_date?: string | null;
  quantity: number;
  is_group_registration: boolean;
  post_prasadam: boolean;
  additional_notes: string;
  total_amount?: string | null;
  members?: RegistrationMember[];
}

interface FormValues {
  day_option?: number | null;
  start_date?: string | null;
  quantity: number;
  is_group_registration: boolean;
  post_prasadam: boolean;
  additional_notes: string;
  total_amount?: string | null;
  members: Array<RegistrationMember & { selected?: boolean }>;
}

const defaultValues: FormValues = {
  day_option: undefined,
  start_date: undefined,
  quantity: 1,
  is_group_registration: false,
  post_prasadam: false,
  additional_notes: '',
  total_amount: '',
  members: [],
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return 'N/A';
  }
  const parts = value.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (day && month && year) {
      return `${day}-${month}-${year}`;
    }
  }
  return value;
};

const PoojaRegistrationPage = () => {
  const [poojaOptions, setPoojaOptions] = useState<Option[]>([]);
  const [dayOptions, setDayOptions] = useState<DayOption[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationPayload[]>([]);
  const [profileData, setProfileData] = useState<ProfilePayload | null>(null);
  const [message, setMessage] = useState('');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [editing, setEditing] = useState<RegistrationPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'summary'>('new');
  const [poojaAmounts, setPoojaAmounts] = useState<Record<number, string>>({});
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [summaryDateFilter, setSummaryDateFilter] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { isSubmitting },
    reset,
    setValue,
  } = useForm<FormValues>({
    defaultValues,
  });

  const { fields, remove, replace } = useFieldArray({ control, name: 'members' });
  const isGroup = watch('is_group_registration');
  const familyMembers = profileData?.members ?? [];

  const availableDateFilters = useMemo(() => {
    const uniqueDates = Array.from(
      new Set(
        registrations
          .map((registration) => registration.start_date)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
    return uniqueDates;
  }, [registrations]);

  const groupedRegistrations = useMemo(() => {
    const grouped = new Map<string, RegistrationPayload[]>();
    registrations.forEach((registration) => {
      const key = registration.start_date || 'No Date';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(registration);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [registrations]);

  const optionLookup = useMemo(() => Object.fromEntries(poojaOptions.map((opt) => [opt.id, opt])), [poojaOptions]);

  const loadMasterData = async () => {
    try {
      const [optionsRes, daysRes] = await Promise.all([
        api.get('/pooja/options/'),
        api.get('/pooja/day-options/'),
      ]);
      const extractedOptions = extractResults<Option>(optionsRes.data);
      setPoojaOptions(extractedOptions);
      const initialAmounts: Record<number, string> = {};
      extractedOptions.forEach((option) => {
        initialAmounts[option.id] = option.default_amount ?? '';
      });
      setPoojaAmounts(initialAmounts);
      setDayOptions(extractResults<DayOption>(daysRes.data));
    } catch (error) {
      setMessage('Unable to load master data.');
    }
  };

  const loadRegistrations = async () => {
    try {
      const { data } = await api.get('/pooja/registrations/');
      setRegistrations(extractResults<RegistrationPayload>(data));
    } catch (error) {
      setMessage('Unable to load registrations.');
    }
  };

  const loadProfile = async () => {
    try {
      const { data } = await api.get('auth/profile/');
      setProfileData(data);
    } catch (error) {
      // profile fetch failure is non-blocking
    }
  };

  useEffect(() => {
    loadMasterData();
    loadRegistrations();
    loadProfile();
  }, []);

  useEffect(() => {
    if (editing) {
      return;
    }
    if (selectedRowIds.length === 0) {
      setValue('total_amount', '', { shouldDirty: false });
      return;
    }
    const total = selectedRowIds.reduce((sum, id) => {
      const raw = (poojaAmounts[id] ?? '').replace(/[^0-9.\-]/g, '');
      const parsed = parseFloat(raw);
      return Number.isNaN(parsed) ? sum : sum + parsed;
    }, 0);
    const formatted = selectedRowIds.length > 0 && Number.isFinite(total) ? total.toString() : '';
    setValue('total_amount', formatted, { shouldDirty: false });
  }, [editing, poojaAmounts, selectedRowIds, setValue]);

  const resetForm = () => {
    setEditing(null);
    setActiveTab('new');
    reset(defaultValues);
    replace([]);
    setSelectedRowIds([]);
  };

  const onSubmit = async (values: FormValues) => {
    setMessage('');
    const selectedIds = editing ? [editing.pooja_option] : selectedRowIds;

    const hasStartDate = Boolean(values.start_date && values.start_date.trim() !== '');

    if (!hasStartDate) {
      window.alert('Please pick a pooja day before submitting.');
      return;
    }

    if (!editing && selectedIds.length === 0) {
      window.alert('Please select at least one pooja.');
      return;
    }

    const missingAmounts = selectedIds.filter((id) => {
      const raw = poojaAmounts[id];
      return !raw || raw.toString().trim() === '';
    });
    if (missingAmounts.length > 0) {
      window.alert('Please enter an amount for each selected pooja before submitting.');
      return;
    }

    const basePayload = {
      day_option: values.day_option && !Number.isNaN(values.day_option) ? values.day_option : null,
      start_date: values.start_date && values.start_date !== '' ? values.start_date : null,
      quantity: values.quantity,
      is_group_registration: values.is_group_registration,
      post_prasadam: values.post_prasadam,
      additional_notes: values.additional_notes,
      members: isGroup
        ? values.members
            .filter((member) => member.selected)
            .map((member) => ({
              name: member.name,
              phone_number: member.phone_number,
              relationship: member.relationship,
            }))
        : [],
    };

    try {
      if (editing) {
        const amount = (editing.pooja_option && poojaAmounts[editing.pooja_option]) || values.total_amount || '';
        await api.put(`/pooja/registrations/${editing.id}/`, {
          ...basePayload,
          pooja_option: editing.pooja_option,
          total_amount: amount ? amount : null,
        });
        setMessage('Registration updated.');
      } else {
        for (const id of selectedIds) {
          const amount = poojaAmounts[id] ?? '';
          await api.post('/pooja/registrations/', {
            ...basePayload,
            pooja_option: id,
            total_amount: amount ? amount : null,
          });
        }
        setMessage(`Registration saved for ${selectedIds.length} pooja${selectedIds.length > 1 ? 's' : ''}!`);
      }
      resetForm();
      loadRegistrations();
    } catch (error: any) {
      const detail = error?.response?.data ?? 'Could not save registration';
      setMessage(typeof detail === 'string' ? detail : 'Error saving registration');
    }
  };

  const handleEdit = (registration: RegistrationPayload) => {
    setEditing(registration);
    setActiveTab('new');
    reset({
      day_option: registration.day_option ?? undefined,
      start_date: registration.start_date ?? undefined,
      quantity: registration.quantity,
      is_group_registration: registration.is_group_registration,
      post_prasadam: registration.post_prasadam,
      additional_notes: registration.additional_notes ?? '',
      total_amount: registration.total_amount ?? '',
      members:
        registration.members?.map((m) => ({
          name: m.name,
          phone_number: m.phone_number,
          relationship: m.relationship,
        })) ?? [],
    });
    setSelectedRowIds(registration.pooja_option ? [registration.pooja_option] : []);
    if (registration.pooja_option) {
      setPoojaAmounts((prev) => ({
        ...prev,
        [registration.pooja_option]: registration.total_amount ?? prev[registration.pooja_option] ?? '',
      }));
    }
    replace(
      registration.members?.map((m) => ({
        name: m.name,
        phone_number: m.phone_number,
        relationship: m.relationship,
        gender: m.gender,
        date_of_birth: m.date_of_birth,
        tamil_star: m.tamil_star,
        gothra: m.gothra,
        _source: 'manual',
        selected: true,
      })) ?? [],
    );
  };

  useEffect(() => {
    if (!isGroup) {
      return;
    }
    if (editing) {
      return;
    }
    if (fields.length === 0 && familyMembers.length > 0) {
      replace(
        familyMembers.map((member) => ({
          name: member.name,
          phone_number: '',
          relationship: member.relationship ?? '',
          gender: member.gender,
          date_of_birth: member.date_of_birth ?? null,
          tamil_star: member.tamil_star,
          gothra: member.gothra,
          _source: 'family',
          selected: false,
        })),
      );
    }
  }, [isGroup, familyMembers, fields.length, replace, editing]);

  const handleDelete = async (registration: RegistrationPayload) => {
    if (!window.confirm(`Delete registration #${registration.id}?`)) return;
    try {
      await api.delete(`/pooja/registrations/${registration.id}/`);
        setSummaryMessage('Registration deleted.');
      if (editing?.id === registration.id) {
        resetForm();
      }
      loadRegistrations();
    } catch (error: any) {
      const detail = error?.response?.data ?? 'Could not delete registration';
      setMessage(typeof detail === 'string' ? detail : 'Error deleting registration');
    }
  };

  const donorAddressLines = useMemo(() => {
    if (!profileData) {
      return [] as string[];
    }
    const lines: string[] = [];
    const {
      address_line1,
      address_line2,
      address_line3,
      city,
      state,
      postal_code,
    } = profileData.profile;
    if (address_line1) lines.push(address_line1);
    if (address_line2) lines.push(address_line2);
    if (address_line3) lines.push(address_line3);
    const cityState = [city, state].filter(Boolean).join(', ');
    if (cityState) lines.push(cityState);
    if (postal_code) lines.push(postal_code);
    return lines;
  }, [profileData]);

  const dayOptionValue = watch('day_option');
  const selectedDayOption = useMemo(() => {
    if (dayOptionValue === null || dayOptionValue === undefined || Number.isNaN(dayOptionValue)) {
      return null;
    }
    return dayOptions.find((day) => day.id === dayOptionValue) ?? null;
  }, [dayOptions, dayOptionValue]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Pooja Registration</h1>
        <p className="mt-1 text-sm text-slate-600">Submit Form-10 / Form-11 data for donors.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              activeTab === 'summary' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Old / New Registrations Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              activeTab === 'new' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            New Registration
          </button>
        </div>

        {activeTab === 'new' && (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
            {message && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}

            {profileData && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Mobile No:</span> {profileData.user.phone_number}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Name:</span> {profileData.user.name}
                </p>
                {donorAddressLines.length > 0 && (
                  <p className="mt-1">
                    <span className="font-semibold">Address:</span> {donorAddressLines.join(', ')}
                  </p>
                )}
              </div>
            )}



            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Pooja Day</label>
                <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('start_date')} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Pooja Day Option</label>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('day_option', { valueAsNumber: true })}>
                  <option value="">As per chart</option>
                  {dayOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.code} — {option.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  {...register('quantity', { valueAsNumber: true, min: 1 })}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">S.No</th>
                    <th className="px-3 py-2 text-left">Pooja Item</th>
                    <th className="px-3 py-2 text-left">Select Pooja(Yes/No)</th>
                    <th className="px-3 py-2 text-left">Day Option Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {poojaOptions.map((option, index) => {
                    const isSelected = selectedRowIds.includes(option.id);
                    return (
                      <tr key={option.id} className={isSelected ? 'bg-brand-50' : undefined}>
                        <td className="px-3 py-2 font-medium text-slate-700">{index + 1}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <div className="flex flex-col">
                            <span className="font-medium">{option.name}</span>
                            <span className="text-xs text-slate-500">Code: {option.code}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            value={isSelected ? 'Yes' : 'No'}
                            onChange={(event) => {
                              const selected = event.target.value === 'Yes';
                              if (editing && editing.pooja_option !== option.id && selected) {
                                setMessage('You can only modify one pooja while editing an existing registration.');
                                return;
                              }
                              setSelectedRowIds((prev) => {
                                const next = new Set(prev);
                                if (selected) {
                                  next.add(option.id);
                                } else {
                                  next.delete(option.id);
                                  if (editing && editing.pooja_option === option.id) {
                                    next.add(option.id);
                                  }
                                }
                                const nextArray = Array.from(next);
                                const fallbackAmount = nextArray.length > 0 ? poojaAmounts[nextArray[0]] ?? '' : '';
                                const amountToApply = selected ? poojaAmounts[option.id] ?? '' : fallbackAmount;
                                setValue('total_amount', amountToApply, { shouldDirty: false });
                                return nextArray;
                              });
                            }}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {isSelected ? selectedDayOption?.description ?? 'As per chart' : '--'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          <input
                            type="text"
                            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-right"
                            value={poojaAmounts[option.id] ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPoojaAmounts((prev) => ({ ...prev, [option.id]: value }));
                              if (isSelected) {
                                setValue('total_amount', value, { shouldDirty: true });
                              }
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {poojaOptions.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-center text-sm text-slate-500" colSpan={5}>
                        No pooja options available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Total Amount (optional)</label>
                <input type="number" step="0.01" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('total_amount')} />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4" {...register('is_group_registration')} />
                  Register as group (Form-11 flow)
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4" {...register('post_prasadam')} />
                  Post prasadam for this day
                </label>
              </div>
            </div>

            {isGroup && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-700">Group Members</h3>
                  <button
                    type="button"
                    onClick={() => {
                      window.alert('Please add the family members details in the dashboard tab.');
                    }}
                    className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Add member
                  </button>
                </div>
                {fields.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {familyMembers.length === 0
                      ? 'Please add the family members details in the dashboard tab.'
                      : 'No members added yet.'}
                  </p>
                )}
                {fields.map((field, index) => (
                    <div key={field.id} className="rounded-lg border border-slate-200 p-3">
                    {field._source === 'family' ? (
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 md:text-sm">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            defaultChecked={!!field.selected}
                            {...register(`members.${index}.selected` as const)}
                          />
                          
                        </label>
                        <span>
                          Name: <span className="font-semibold text-slate-800">{field.name}</span>
                        </span>
                        <span>Relationship: {field.relationship || 'N/A'}</span>
                        <span>Gender: {field.gender || 'N/A'}</span>
                        <span>
                          Date of Birth:{' '}
                          {field.date_of_birth ? formatDate(field.date_of_birth) : 'N/A'}
                        </span>
                        <span>Star: {field.tamil_star || 'N/A'}</span>
                        <span>Gothram: {field.gothra || 'N/A'}</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 md:grid-cols-4">
                          <input
                            placeholder="Member name"
                            className="rounded-md border border-slate-300 px-3 py-2"
                            {...register(`members.${index}.name` as const, { required: 'Name required' })}
                          />
                          <input
                            placeholder="Mobile"
                            className="rounded-md border border-slate-300 px-3 py-2"
                            {...register(`members.${index}.phone_number` as const)}
                          />
                          <input
                            placeholder="Relationship"
                            className="rounded-md border border-slate-300 px-3 py-2"
                            {...register(`members.${index}.relationship` as const)}
                          />
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-600 hover:bg-red-200"
                          >
                            Remove
                          </button>
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500 md:text-sm">
                          <input
                            type="checkbox"
                            defaultChecked={!!field.selected}
                            {...register(`members.${index}.selected` as const)}
                          />
                          Select this member
                        </label>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Any additional information (e.g. gothra details, delivery instructions)"
                {...register('additional_notes')}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-brand-600 px-5 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Saving…' : editing ? 'Update Registration' : 'Submit Registration'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {activeTab === 'summary' && (
          <div className="mt-6">
            {summaryMessage && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{summaryMessage}</p>}
            <h2 className="text-lg font-semibold text-slate-800">Existing Registrations</h2>
            <p className="mt-1 text-sm text-slate-600">Manage saved entries (edit / delete).</p>
            <div className="mt-4 space-y-6">
              {groupedRegistrations.map(([startDate, registrationsForDate]) => (
                <section key={startDate} className="rounded-md border border-slate-200">
                  <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Pooja Date: {startDate === 'No Date' ? 'Not set' : startDate}
                    </h3>
                    <span className="text-xs text-slate-500">{registrationsForDate.length} record(s)</span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-white text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-2">Donor</th>
                          <th className="px-4 py-2">Pooja</th>
                          <th className="px-4 py-2">Group</th>
                          <th className="px-4 py-2">Members</th>
                          <th className="px-4 py-2">Amount</th>
                          <th className="px-4 py-2">Notes</th>
                          <th className="px-4 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrationsForDate.map((registration) => (
                          <tr key={registration.id} className="border-t border-slate-100">
                            <td className="px-4 py-2">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-700">
                                  {registration.donor_name || registration.donor_phone || 'Self (admin)'}
                                </span>
                                {registration.donor_phone && registration.donor_name && (
                                  <span className="text-xs text-slate-500">{registration.donor_phone}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-col">
                                <span>{registration.pooja_option_name ?? optionLookup[registration.pooja_option]?.name ?? '--'}</span>
                                {registration.day_option_description && (
                                  <span className="text-xs text-slate-500">{registration.day_option_description}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">{registration.is_group_registration ? 'Yes' : 'No'}</td>
                            <td className="px-4 py-2">
                              {registration.is_group_registration && registration.members && registration.members.length > 0 ? (
                                <ul className="space-y-1 text-xs text-slate-600">
                                  {registration.members.map((member) => (
                                    <li key={member.id ?? member.name}>
                                      <span className="font-semibold text-slate-700">{member.name}</span>
                                      {member.relationship && (
                                        <span className="text-slate-500"> — {member.relationship}</span>
                                      )}
                                      {member.phone_number && (
                                        <span className="ml-2 text-slate-400">{member.phone_number}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-slate-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-2">{registration.total_amount ?? '--'}</td>
                            <td className="px-4 py-2">
                              {registration.additional_notes ? (
                                <span className="whitespace-pre-line text-sm text-slate-600">{registration.additional_notes}</span>
                              ) : (
                                <span className="text-xs text-slate-400">No notes</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(registration)}
                                  className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(registration)}
                                  className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
              {groupedRegistrations.length === 0 && (
                <p className="p-4 text-sm text-slate-500">No registrations found.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PoojaRegistrationPage;
