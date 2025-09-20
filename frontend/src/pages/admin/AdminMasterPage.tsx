import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import api, { extractResults } from '../../lib/api';

interface PoojaOption {
  id: number;
  code: string;
  name: string;
  min_amount?: string;
  max_amount?: string;
}

interface DayOption {
  id: number;
  code: string;
  description: string;
  category: string;
}

interface DailyMessage {
  id: number;
  label: string;
  header_text: string;
  footer_text?: string;
}

type OptionFormValues = {
  code: string;
  name: string;
  min_amount?: number;
  max_amount?: number;
};

type DayOptionFormValues = {
  code: string;
  description: string;
  category: string;
};

type DailyMessageFormValues = {
  label: string;
  header_text: string;
  footer_text?: string;
};

const categories = [
  { value: 'code', label: 'Template Code (Form-6)' },
  { value: 'weekday', label: 'Weekday' },
  { value: 'tamil_star', label: 'Tamil Star' },
];

const AdminMasterPage = () => {
  const [options, setOptions] = useState<PoojaOption[]>([]);
  const [dayOptions, setDayOptions] = useState<DayOption[]>([]);
  const [messages, setMessages] = useState<DailyMessage[]>([]);
  const [notice, setNotice] = useState('');
  const [editingOption, setEditingOption] = useState<PoojaOption | null>(null);
  const [editingDay, setEditingDay] = useState<DayOption | null>(null);
  const [editingMessage, setEditingMessage] = useState<DailyMessage | null>(null);

  const optionForm = useForm<OptionFormValues>({ defaultValues: { code: '', name: '' } });
  const dayForm = useForm<DayOptionFormValues>({ defaultValues: { code: '', description: '', category: 'code' } });
  const messageForm = useForm<DailyMessageFormValues>({ defaultValues: { label: '', header_text: '', footer_text: '' } });

  const load = async () => {
    try {
      const [optRes, dayRes, msgRes] = await Promise.all([
        api.get('/pooja/options/'),
        api.get('/pooja/day-options/'),
        api.get('/pooja/daily-messages/'),
      ]);
      setOptions(extractResults<PoojaOption>(optRes.data));
      setDayOptions(extractResults<DayOption>(dayRes.data));
      setMessages(extractResults<DailyMessage>(msgRes.data));
    } catch (error) {
      setNotice('Unable to load master data.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetOptionForm = () => {
    setEditingOption(null);
    optionForm.reset({ code: '', name: '', min_amount: undefined, max_amount: undefined });
  };

  const onCreateOption = async (values: OptionFormValues) => {
    try {
      if (editingOption) {
        await api.put(`/pooja/options/${editingOption.id}/`, values);
        setNotice('Pooja option updated.');
      } else {
        await api.post('/pooja/options/', values);
        setNotice('Pooja option saved.');
      }
      resetOptionForm();
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not save option';
      setNotice(typeof detail === 'string' ? detail : 'Error saving option');
    }
  };

  const handleEditOption = (option: PoojaOption) => {
    setEditingOption(option);
    optionForm.reset({
      code: option.code,
      name: option.name,
      min_amount: option.min_amount ? Number(option.min_amount) : undefined,
      max_amount: option.max_amount ? Number(option.max_amount) : undefined,
    });
  };

  const handleDeleteOption = async (option: PoojaOption) => {
    if (!window.confirm(`Delete pooja option ${option.code}?`)) return;
    try {
      await api.delete(`/pooja/options/${option.id}/`);
      setNotice('Pooja option deleted.');
      if (editingOption?.id === option.id) {
        resetOptionForm();
      }
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not delete option';
      setNotice(typeof detail === 'string' ? detail : 'Error deleting option');
    }
  };

  const resetDayForm = () => {
    setEditingDay(null);
    dayForm.reset({ code: '', description: '', category: 'code' });
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

  const resetMessageForm = () => {
    setEditingMessage(null);
    messageForm.reset({ label: '', header_text: '', footer_text: '' });
  };

  const onCreateMessage = async (values: DailyMessageFormValues) => {
    try {
      if (editingMessage) {
        await api.put(`/pooja/daily-messages/${editingMessage.id}/`, values);
        setNotice('Daily message updated.');
      } else {
        await api.post('/pooja/daily-messages/', values);
        setNotice('Daily message saved.');
      }
      resetMessageForm();
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not save message';
      setNotice(typeof detail === 'string' ? detail : 'Error saving message');
    }
  };

  const handleEditMessage = (message: DailyMessage) => {
    setEditingMessage(message);
    messageForm.reset({
      label: message.label,
      header_text: message.header_text,
      footer_text: message.footer_text ?? '',
    });
  };

  const handleDeleteMessage = async (message: DailyMessage) => {
    if (!window.confirm(`Delete daily message ${message.label}?`)) return;
    try {
      await api.delete(`/pooja/daily-messages/${message.id}/`);
      setNotice('Daily message deleted.');
      if (editingMessage?.id === message.id) {
        resetMessageForm();
      }
      load();
    } catch (err: any) {
      const detail = err?.response?.data ?? 'Could not delete message';
      setNotice(typeof detail === 'string' ? detail : 'Error deleting message');
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
        <h2 className="text-lg font-semibold text-slate-800">Pooja Options</h2>
        <p className="mt-1 text-sm text-slate-600">Represents Form-4/5 master data.</p>

        <form onSubmit={optionForm.handleSubmit(onCreateOption)} className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Code</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...optionForm.register('code', { required: true })} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...optionForm.register('name', { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Min Amount</label>
            <input type="number" step="0.01" className="w-full rounded-md border border-slate-300 px-3 py-2" {...optionForm.register('min_amount', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Max Amount</label>
            <input type="number" step="0.01" className="w-full rounded-md border border-slate-300 px-3 py-2" {...optionForm.register('max_amount', { valueAsNumber: true })} />
          </div>
          <div className="md:col-span-4 flex items-center gap-3">
            <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              {editingOption ? 'Update Option' : 'Save Option'}
            </button>
            {editingOption && (
              <button
                type="button"
                onClick={resetOptionForm}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {options.map((opt) => (
            <li key={opt.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div>
                <span className="font-medium text-slate-700">
                  {opt.code} — {opt.name}
                </span>
                <span className="ml-3 text-xs text-slate-500">
                  Min: {opt.min_amount ?? '--'} | Max: {opt.max_amount ?? '--'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEditOption(opt)}
                  className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOption(opt)}
                  className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {options.length === 0 && <li className="py-3 text-sm text-slate-500">No options yet.</li>}
        </ul>
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
            <li key={day.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div>
                <span className="font-medium">
                  {day.code} — {day.description}
                </span>
                <span className="ml-3 text-xs uppercase text-slate-500">{day.category}</span>
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

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Daily Messages</h2>
        <p className="mt-1 text-sm text-slate-600">Manage Form-7 daily headers.</p>

        <form onSubmit={messageForm.handleSubmit(onCreateMessage)} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Label</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...messageForm.register('label', { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Header Text</label>
            <textarea rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" {...messageForm.register('header_text', { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Footer Text (optional)</label>
            <textarea rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2" {...messageForm.register('footer_text')} />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              {editingMessage ? 'Update Message' : 'Save Message'}
            </button>
            {editingMessage && (
              <button
                type="button"
                onClick={resetMessageForm}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {messages.map((msg) => (
            <li key={msg.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold text-brand-700">{msg.label}</span>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{msg.header_text}</p>
                  {msg.footer_text && <p className="text-xs text-slate-500 whitespace-pre-line">{msg.footer_text}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditMessage(msg)}
                    className="rounded-md bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg)}
                    className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
          {messages.length === 0 && <li className="py-3 text-sm text-slate-500">No messages configured.</li>}
        </ul>
      </section>
    </div>
  );
};

export default AdminMasterPage;
