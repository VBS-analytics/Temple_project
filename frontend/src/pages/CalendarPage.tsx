import { useEffect, useState } from 'react';

import api, { extractResults } from '../lib/api';

interface DailyMessage {
  id: number;
  label: string;
  header_text: string;
}

interface DonorMessage {
  id: number;
  preferred_date?: string;
  summary_text: string;
  tamil_text?: string;
  gothra_details?: string;
  day_option?: {
    code: string;
    description: string;
  } | null;
}

const CalendarPage = () => {
  const [dailyMessages, setDailyMessages] = useState<DailyMessage[]>([]);
  const [donorMessages, setDonorMessages] = useState<DonorMessage[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [dailyRes, donorRes] = await Promise.all([
          api.get('/pooja/daily-messages/'),
          api.get('/pooja/donor-messages/'),
        ]);
        setDailyMessages(extractResults<DailyMessage>(dailyRes.data));
        setDonorMessages(extractResults<DonorMessage>(donorRes.data));
      } catch (err) {
        setError('Unable to load pooja calendar.');
      }
    };

    load();
  }, []);

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Daily Pooja Headers</h1>
        <p className="mt-1 text-sm text-slate-600">Reference for Form-7 / daily announcements.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {dailyMessages.map((msg) => (
            <article key={msg.id} className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-brand-700">{msg.label}</h3>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{msg.header_text}</p>
            </article>
          ))}
          {dailyMessages.length === 0 && <p className="text-sm text-slate-500">No daily messages configured yet.</p>}
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Upcoming Donor Messages</h2>
        <p className="mt-1 text-sm text-slate-600">Curated lines per donor (Form-8 / Form-9).</p>
        <div className="mt-4 space-y-4">
          {donorMessages.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-brand-700">
                  {item.day_option ? `${item.day_option.code} — ${item.day_option.description}` : 'Custom'}
                </span>
                {item.preferred_date && (
                  <span className="text-xs text-slate-500">Prefered Date: {new Date(item.preferred_date).toLocaleDateString()}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{item.summary_text}</p>
              {item.tamil_text && <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{item.tamil_text}</p>}
              {item.gothra_details && (
                <p className="mt-2 text-xs font-medium text-slate-500">Gothra / Star: {item.gothra_details}</p>
              )}
            </div>
          ))}
          {donorMessages.length === 0 && <p className="text-sm text-slate-500">No donor specific messages found.</p>}
        </div>
      </section>
    </div>
  );
};

export default CalendarPage;
