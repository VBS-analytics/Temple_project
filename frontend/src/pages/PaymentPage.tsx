import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import api, { extractResults } from '../lib/api';

interface PaymentRecord {
  id: number;
  amount: string;
  currency: string;
  mode: string;
  status: string;
  transaction_reference: string;
  payment_month?: string;
  notes?: string;
  created_at: string;
  pooja_option?: string;
}

type FormValues = {
  registration?: number | null;
  amount: number;
  mode: string;
  payment_month?: string;
  notes?: string;
};

const paymentModes = [
  { value: 'neft', label: 'NEFT' },
  { value: 'upi', label: 'UPI / Paytm' },
  { value: 'cash', label: 'Cash Deposit' },
  { value: 'card', label: 'Credit / Debit' },
  { value: 'auto_debit', label: 'Auto Debit' },
  { value: 'other', label: 'Other' },
];

const formatHistoryDateTime = (value: string) => {
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

const formatPaymentModeLabel = (mode: string) => mode.replace(/_/g, ' ');

const PaymentPage = () => {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [message, setMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      amount: 0,
      mode: 'neft',
    },
  });

  const loadPayments = async () => {
    try {
      const { data } = await api.get('/payments/records/');
      setRecords(extractResults<PaymentRecord>(data));
    } catch (error) {
      setMessage('Unable to load payment history.');
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setMessage('');
    try {
      await api.post('/payments/records/', values);
      setMessage('Payment recorded.');
      reset({ amount: 0, mode: 'neft', notes: '' });
      loadPayments();
    } catch (error: any) {
      const detail = error?.response?.data ?? 'Could not record payment';
      setMessage(typeof detail === 'string' ? detail : 'Error recording payment');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Log Payment</h1>
        <p className="mt-1 text-sm text-slate-600">Capture offline payments against your regular commitments (Form-13).</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount (INR)</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('amount', { valueAsNumber: true, min: { value: 1, message: 'Enter amount' } })}
            />
            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Payment Mode</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('mode', { required: true })}>
              {paymentModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Payment Month</label>
            <input type="month" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('payment_month')} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" rows={3} {...register('notes')} />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Save Payment'}
            </button>
            {message && <span className="text-sm text-slate-600">{message}</span>}
          </div>
        </form>
      </section>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">History</h2>
        {records.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No payments logged yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Mode</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{formatHistoryDateTime(record.created_at)}</td>
                      <td className="px-4 py-2">
                        {record.amount} {record.currency}
                      </td>
                      <td className="px-4 py-2 capitalize">{formatPaymentModeLabel(record.mode)}</td>
                      <td
                        className={`px-4 py-2 capitalize ${
                          record.status === 'pending' ? 'text-amber-600' : 'text-green-600'
                        }`}
                      >
                        {record.status}
                      </td>
                      <td className="px-4 py-2">{record.notes || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {records.map((record) => {
                const statusColor = record.status === 'pending' ? 'text-amber-600' : 'text-green-600';
                return (
                  <article
                    key={record.id}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{formatHistoryDateTime(record.created_at)}</p>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${statusColor}`}>
                        {record.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Amount</span>
                        <span>
                          ₹ {record.amount} {record.currency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Mode</span>
                        <span className="capitalize">{formatPaymentModeLabel(record.mode)}</span>
                      </div>
                      {record.payment_month && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-600">Payment Month</span>
                          <span>{record.payment_month}</span>
                        </div>
                      )}
                      {record.pooja_option && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-600">Pooja</span>
                          <span>{record.pooja_option}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Notes</span>
                        <span className="text-slate-500">{record.notes || '--'}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default PaymentPage;
