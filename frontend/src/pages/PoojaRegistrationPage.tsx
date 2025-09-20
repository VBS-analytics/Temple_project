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

interface RegistrationMember {
  id?: number;
  name: string;
  phone_number: string;
  relationship: string;
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
  pooja_option: number | '';
  day_option?: number | null;
  start_date?: string | null;
  quantity: number;
  is_group_registration: boolean;
  post_prasadam: boolean;
  additional_notes: string;
  total_amount?: string | null;
  members: RegistrationMember[];
}

const defaultValues: FormValues = {
  pooja_option: '',
  day_option: undefined,
  start_date: undefined,
  quantity: 1,
  is_group_registration: false,
  post_prasadam: false,
  additional_notes: '',
  total_amount: '',
  members: [],
};

const PoojaRegistrationPage = () => {
  const [poojaOptions, setPoojaOptions] = useState<Option[]>([]);
  const [dayOptions, setDayOptions] = useState<DayOption[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationPayload[]>([]);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<RegistrationPayload | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues,
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'members' });
  const isGroup = watch('is_group_registration');

  const optionLookup = useMemo(() => Object.fromEntries(poojaOptions.map((opt) => [opt.id, opt])), [poojaOptions]);

  const loadMasterData = async () => {
    try {
      const [optionsRes, daysRes] = await Promise.all([
        api.get('/pooja/options/'),
        api.get('/pooja/day-options/'),
      ]);
      setPoojaOptions(extractResults<Option>(optionsRes.data));
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

  useEffect(() => {
    loadMasterData();
    loadRegistrations();
  }, []);

  const resetForm = () => {
    setEditing(null);
    reset(defaultValues);
    replace([]);
  };

  const onSubmit = async (values: FormValues) => {
    setMessage('');
    const payload = {
      ...values,
      pooja_option: typeof values.pooja_option === 'string' ? Number(values.pooja_option) : values.pooja_option,
      members: isGroup ? values.members : [],
      day_option: values.day_option || null,
      total_amount: values.total_amount || null,
    };

    try {
      if (editing) {
        await api.put(`/pooja/registrations/${editing.id}/`, payload);
        setMessage('Registration updated.');
      } else {
        await api.post('/pooja/registrations/', payload);
        setMessage('Registration saved!');
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
    reset({
      pooja_option: registration.pooja_option,
      day_option: registration.day_option ?? undefined,
      start_date: registration.start_date ?? undefined,
      quantity: registration.quantity,
      is_group_registration: registration.is_group_registration,
      post_prasadam: registration.post_prasadam,
      additional_notes: registration.additional_notes ?? '',
      total_amount: registration.total_amount ?? '',
      members: registration.members?.map((m) => ({
        name: m.name,
        phone_number: m.phone_number,
        relationship: m.relationship,
      })) ?? [],
    });
    replace(
      registration.members?.map((m) => ({
        name: m.name,
        phone_number: m.phone_number,
        relationship: m.relationship,
      })) ?? [],
    );
  };

  const handleDelete = async (registration: RegistrationPayload) => {
    if (!window.confirm(`Delete registration #${registration.id}?`)) return;
    try {
      await api.delete(`/pooja/registrations/${registration.id}/`);
      setMessage('Registration deleted.');
      if (editing?.id === registration.id) {
        resetForm();
      }
      loadRegistrations();
    } catch (error: any) {
      const detail = error?.response?.data ?? 'Could not delete registration';
      setMessage(typeof detail === 'string' ? detail : 'Error deleting registration');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Pooja Registration</h1>
        <p className="mt-1 text-sm text-slate-600">Submit Form-10 / Form-11 data for donors.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
          {message && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pooja Option</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('pooja_option', { required: 'Select a pooja option' })}
              >
                <option value="">Select</option>
                {poojaOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} — {option.name}
                  </option>
                ))}
              </select>
              {errors.pooja_option && <p className="mt-1 text-sm text-red-600">{errors.pooja_option.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pooja Day / Tamil Star</label>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('day_option', { valueAsNumber: true })}>
                <option value="">As per chart</option>
                {dayOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} — {option.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('start_date')} />
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
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Total Amount (optional)</label>
              <input type="number" step="0.01" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('total_amount')} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4" {...register('is_group_registration')} />
              Register as group (Form-11 flow)
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4" {...register('post_prasadam')} />
              Post prasadam for this day
            </label>
          </div>

          {isGroup && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">Group Members</h3>
                <button
                  type="button"
                  onClick={() => append({ name: '', phone_number: '', relationship: '' })}
                  className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                  Add member
                </button>
              </div>
              {fields.length === 0 && <p className="text-sm text-slate-500">No members added yet.</p>}
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-4">
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
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Existing Registrations</h2>
        <p className="mt-1 text-sm text-slate-600">Manage saved entries (edit / delete).</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Donor</th>
                <th className="px-4 py-2">Pooja</th>
                <th className="px-4 py-2">Start Date</th>
                <th className="px-4 py-2">Group</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => (
                <tr key={registration.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{registration.id}</td>
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
                  <td className="px-4 py-2">{registration.start_date ?? 'TBD'}</td>
                  <td className="px-4 py-2">{registration.is_group_registration ? 'Yes' : 'No'}</td>
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
          {registrations.length === 0 && <p className="p-4 text-sm text-slate-500">No registrations found.</p>}
        </div>
      </div>
    </div>
  );
};

export default PoojaRegistrationPage;
