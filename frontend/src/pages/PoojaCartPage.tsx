import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../lib/api';
import { useCartStore } from '../store/cart';
import type { CartItem } from '../store/cart';
import { useAuthStore } from '../store/auth';
import { useRegistrationStore } from '../store/registrations';

const formatCurrency = (value?: string | null) => {
  if (!value) return '';
  const amountNumber = Number(value);
  if (Number.isNaN(amountNumber)) {
    return value ?? '';
  }
  return amountNumber.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDisplayDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const DAY_CATEGORY_LABELS: Record<string, string> = {
  weekday: '',
  tamil_star: '',
  code: 'Template Code',
};

const PoojaCartPage = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const items = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clear);
  const addRegistrations = useRegistrationStore((state) => state.addRegistrations);

  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const value = item.amount ? Number(item.amount) : 0;
      return Number.isNaN(value) ? sum : sum + value;
    }, 0);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-lg bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">Pooja Cart</h1>
          <p className="mt-2 text-sm text-slate-600">You have not added any poojas yet.</p>
        </header>
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">
            Browse the available poojas and add them to your cart from the{' '}
            <Link to="/pooja/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Pooja Registration
            </Link>{' '}
            page.
          </p>
        </div>
        {paymentStatus && (
          <div className="rounded-3xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
            {paymentStatus}
          </div>
        )}
        {paymentError && (
          <div className="rounded-3xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
            {paymentError}
          </div>
        )}
      </div>
    );
  }

  const buildRegistrationPayload = (item: CartItem) => {
    const normalizedMembers = (item.members ?? [])
      .map((member) => ({
        name: (member?.name ?? '').trim(),
        relationship: (member?.relationship ?? '').trim(),
      }))
      .filter((member) => member.name.length > 0);

    if (normalizedMembers.length === 0) {
      const fallbackName = (item.fullName ?? '').trim();
      if (fallbackName) {
        normalizedMembers.push({ name: fallbackName, relationship: (item.memberRelationship ?? 'Self').trim() });
      }
    }

    const quantity = normalizedMembers.length > 0 ? normalizedMembers.length : 1;

    return {
      pooja_option: item.poojaId,
      day_option: item.dayOptionId ?? null,
      start_date: item.customDayDate || item.bookingDate || null,
      quantity,
      is_group_registration: quantity > 1,
      post_prasadam: Boolean(item.postPrasadam),
      additional_notes: item.customDayNote?.trim() ?? '',
      total_amount: item.amount ?? null,
      members: normalizedMembers.map((member) => ({
        name: member.name,
        relationship: member.relationship || '',
      })),
    };
  };

  const handleCheckout = async () => {
    if (items.length === 0 || processing) {
      return;
    }

    setProcessing(true);
    setPaymentStatus(null);
    setPaymentError(null);

    try {
      for (const item of items) {
        const payload = buildRegistrationPayload(item);
        await api.post('pooja/registrations/', payload);
      }

      addRegistrations(cartKey, items);
      clearCart(cartKey);
      setPaymentStatus('Pooja registrations recorded successfully.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message ?? 'Unable to record registrations.';
      setPaymentError(typeof detail === 'string' ? detail : 'Unable to record registrations.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Pooja Cart</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review your pooja selection and booking details before proceeding to payment.
        </p>
      </header>

      <div className="space-y-6">
        <table className="min-w-full divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white text-sm shadow-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">Pooja</th>
              <th className="px-4 py-2 text-left">Day Option</th>
              <th className="px-4 py-2 text-left">Devotee</th>
              <th className="px-4 py-2 text-left">Member</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const amountLabel = item.amount ? `₹ ${formatCurrency(item.amount)}` : '--';
              const dayOptionCategoryLabel = item.dayOptionCategory
                ? DAY_CATEGORY_LABELS[item.dayOptionCategory] ?? item.dayOptionCategory
                : null;
              const combinedDayOption = item.dayOptionDescription
                ? `${item.dayOptionDescription}${dayOptionCategoryLabel ? ` (${dayOptionCategoryLabel})` : ''}`
                : '--';
              const selectedTamilStarLabel = item.selectedTamilStarLabel ?? null;
              const memberSummary = item.members && item.members.length > 0
                ? item.members
                    .map((member) => {
                      const name = member.name || 'Member';
                      const relationship = member.relationship ? ` (${member.relationship})` : '';
                      return `${name}${relationship}`;
                    })
                    .join(', ')
                : item.memberRelationship
                  ? `${item.fullName || 'Member'} (${item.memberRelationship})`
                  : '--';

              return (
                <tr key={item.cartId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-slate-900">{item.poojaName}</div>
                    {item.poojaCode && <div className="text-xs uppercase tracking-wide text-slate-500">Code: {item.poojaCode}</div>}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">
                    <div className="space-y-1">
                      <div>{combinedDayOption}</div>
                      {item.customDayDate && (
                        <div className="text-xs text-slate-500">
                          Preferred date: {formatDisplayDate(item.customDayDate)}
                        </div>
                      )}
                      {selectedTamilStarLabel && (
                        <div className="text-xs text-slate-500">
                          Star: {selectedTamilStarLabel}
                        </div>
                      )}
                      {item.customDayNote && (
                        <div className="text-xs text-slate-500 whitespace-pre-wrap">
                          Note: {item.customDayNote}
                        </div>
                      )}
                      {item.postPrasadam && (
                        <div className="text-xs font-medium text-emerald-600">Post prasadam requested</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">{item.fullName || '--'}</td>
                  <td className="px-4 py-3 align-top text-xs text-slate-600 whitespace-pre-wrap">{memberSummary}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{amountLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(cartKey, item.cartId)}
                      className="rounded-full border border-slate-300 px-4 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <aside className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-600">Cart total</p>
          <p className="text-2xl font-semibold text-slate-900">₹ {formatCurrency(totalAmount.toString())}</p>
          <p className="mt-1 text-xs text-slate-500">Continue the booking process with the temple office to complete payment.</p>
          {paymentStatus && (
            <p className="mt-3 text-sm font-semibold text-emerald-600">{paymentStatus}</p>
          )}
          {paymentError && (
            <p className="mt-3 text-sm font-semibold text-red-600">{paymentError}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={processing}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white shadow focus:outline-none ${
              processing
                ? 'cursor-not-allowed bg-red-400'
                : 'bg-red-700 hover:bg-red-800'
            }`}
          >
            {processing ? 'Processing…' : `Pay ₹${formatCurrency(totalAmount.toString())}`}
          </button>

          <button
            type="button"
            onClick={() => {
              clearCart(cartKey);
              setPaymentStatus(null);
              setPaymentError(null);
            }}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Clear cart
          </button>
        </div>
      </aside>
    </div>
  );
};

export default PoojaCartPage;
