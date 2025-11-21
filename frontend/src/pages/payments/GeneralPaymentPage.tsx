import { useState } from 'react';
import { Link } from 'react-router-dom';

import { usePaymentStore } from '../../store/payments';
import type { CartItem } from '../../store/cart';
import { useCartStore } from '../../store/cart';
import { useAuthStore } from '../../store/auth';

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return '0.00';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '0.00';
  }
  return numeric.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const buildMembersLabel = (members?: CartItem['members']) => {
  if (!members || members.length === 0) {
    return null;
  }
  const names = members
    .map((member) => member?.name?.toString().trim())
    .filter((name): name is string => Boolean(name && name.length > 0));
  if (names.length === 0) {
    return null;
  }
  return names.join(', ');
};

const GeneralPaymentPage = () => {
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const paymentSnapshot = usePaymentStore((state) => state.lastGeneralPayment);
  const clearPaymentSnapshot = usePaymentStore((state) => state.clearGeneralPayment);
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const setItemsForUser = useCartStore((state) => state.setItemsForUser);

  const restoreCartFromSnapshot = () => {
    if (!paymentSnapshot) {
      return;
    }
    setItemsForUser(cartKey, paymentSnapshot.items);
    setShowPaymentDetails(false);
  };

  if (!paymentSnapshot) {
    return (
      <div className="space-y-6">
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">General Payment</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review the pooja registrations you saved from the cart to log a single consolidated payment.
          </p>

          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-600">
              There are no saved payment details yet. Add poojas to your cart, click Save, and you will be redirected here with the payment summary.
            </p>
            <Link
              to="/pooja/cart"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              Go to Pooja Cart
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { items, totalAmount, createdAt } = paymentSnapshot;
  const triggerPaymentDetails = () => setShowPaymentDetails(true);
  const handleClearSummary = () => {
    setShowPaymentDetails(false);
    clearPaymentSnapshot();
  };

  return (
    <div className="space-y-6">
      <section className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">General Payment</h1>
            <p className="text-sm text-slate-600">
              Last saved on <span className="font-semibold text-slate-800">{formatDate(createdAt)}</span>. Use this summary to complete the donation payment.
            </p>
          </div>

          <div className="rounded-2xl bg-orange-50 px-5 py-3 text-center sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-orange-600">Total Amount</p>
            <p className="text-2xl font-semibold text-orange-700">₹ {formatCurrency(totalAmount)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const amountLabel = item.amount ? `₹ ${formatCurrency(item.amount)}` : '—';
            const membersLabel = buildMembersLabel(item.members);
            const selectedDate = item.customDayDate || item.bookingDate;

            return (
              <article
                key={item.cartId}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {item.poojaCode ?? 'Pooja'}
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">{item.poojaName}</h2>
                    {item.dayOptionDescription && (
                      <p className="text-sm text-slate-500">{item.dayOptionDescription}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pooja Amount</p>
                    <p className="text-xl font-semibold text-slate-900">{amountLabel}</p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Date</dt>
                    <dd className="text-sm font-medium text-slate-800">{formatDate(selectedDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</dt>
                    <dd className="text-sm font-medium text-slate-800">
                      {item.members?.length && item.members.length > 0 ? item.members.length : 1}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</dt>
                    <dd className="text-sm font-medium text-slate-800">
                      {item.customDayNote?.trim() || '—'}
                    </dd>
                  </div>
                </dl>

                {membersLabel && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered Members</p>
                    <p className="text-sm font-medium text-slate-800">{membersLabel}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {showPaymentDetails && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <h2 className="text-lg font-semibold text-slate-900">Complete Your Payment</h2>
            <p className="text-sm text-slate-600">
              Scan the QR code or use the account details to transfer the total amount.
            </p>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
                <img
                  src="/images/payment_qrcode.png"
                  alt="Temple payment QR code"
                  className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-3 object-contain"
                />
                <p className="mt-3 text-sm font-medium text-slate-700">
                  Scan & pay ₹ {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Account Holder
                  </p>
                  <p className="text-lg font-semibold text-slate-900">Sri Temple Trust</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Account Number
                  </p>
                  <p className="text-lg font-semibold text-slate-900">123456789012</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    IFSC Code
                  </p>
                  <p className="text-lg font-semibold text-slate-900">SBIN0000123</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Branch
                  </p>
                  <p className="text-lg font-semibold text-slate-900">Mylapore, Chennai</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            Need to make changes? Return to your cart, update the selections, and save again to refresh this summary.
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/pooja/cart"
              onClick={restoreCartFromSnapshot}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Update Cart
            </Link>
            <button
              type="button"
              onClick={triggerPaymentDetails}
              className="inline-flex items-center justify-center rounded-full border border-transparent bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              Payment
            </button>
            <button
              type="button"
              onClick={handleClearSummary}
              className="inline-flex items-center justify-center rounded-full border border-transparent bg-slate-800 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
            >
              Clear Summary
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GeneralPaymentPage;
