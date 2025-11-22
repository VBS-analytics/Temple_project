import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import api from '../lib/api';
import { useCartStore } from '../store/cart';
import type { CartItem } from '../store/cart';
import { useAuthStore } from '../store/auth';
import { useRegistrationStore } from '../store/registrations';
import { usePaymentStore } from '../store/payments';

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
  const navigate = useNavigate();
  const cartKey = user ? String(user.id) : 'guest';
  const items = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clear);
  const addRegistrations = useRegistrationStore((state) => state.addRegistrations);
  const setGeneralPayment = usePaymentStore((state) => state.setGeneralPayment);

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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-white py-6 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="rounded-lg bg-white p-4 sm:p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-800">Pooja Cart</h1>
            <p className="mt-2 text-sm text-slate-600">You have not added any poojas yet.</p>
          </header>
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-600">
              Browse the available poojas and add them to your cart from the{' '}
              <Link to="/pooja/register" className="font-semibold text-orange-600 hover:text-orange-700">
                Pooja Registration
              </Link>{' '}
              page.
            </p>
          </div>
          {paymentStatus && (
            <div className="rounded-3xl bg-orange-50 p-4 text-center text-sm font-semibold text-orange-700">
              {paymentStatus}
            </div>
          )}
          {paymentError && (
            <div className="rounded-3xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
              {paymentError}
            </div>
          )}
        </div>
      </div>
    );
  }

  const buildRegistrationPayload = (item: CartItem) => {
    const normalizedMembers = (item.members ?? [])
      .map((member) => {
        const name = (member?.name ?? '').toString().trim();
        const relationship = (member?.relationship ?? '').toString().trim();
        const tamilStar = (member?.tamilStar ?? (member as any)?.tamil_star ?? '').toString().trim();
        const gothra = (member?.gothra ?? (member as any)?.gothram ?? '').toString().trim();
        const familyName = (member?.familyName ?? (member as any)?.family_name ?? '').toString().trim();
        const dobRaw = (member?.dob ?? (member as any)?.date_of_birth ?? '').toString().trim();

        return {
          name,
          relationship,
          tamil_star: tamilStar,
          gothra,
          family_name: familyName,
          date_of_birth: dobRaw || null,
        };
      })
      .filter((member) => member.name.length > 0);

    if (normalizedMembers.length === 0) {
      const fallbackName = (item.fullName ?? '').trim();
      if (fallbackName) {
        normalizedMembers.push({
          name: fallbackName,
          relationship: (item.memberRelationship ?? 'Self').trim(),
          tamil_star: (item.memberTamilStar ?? '').toString().trim(),
          gothra: (item.memberGothra ?? '').toString().trim(),
          family_name:
            (item.memberFamilyName ?? item.members?.[0]?.familyName ?? '').toString().trim(),
          date_of_birth: (item.memberDob ?? '').toString().trim() || null,
        });
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
        tamil_star: member.tamil_star || '',
        gothra: member.gothra || '',
        family_name: member.family_name || '',
        date_of_birth: member.date_of_birth,
      })),
    };
  };

  const cloneItemsForSnapshot = (cartItems: CartItem[]): CartItem[] =>
    cartItems.map((item) => ({
      ...item,
      members: item.members ? item.members.map((member) => ({ ...member })) : [],
    }));

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

      const snapshot = cloneItemsForSnapshot(items);
      addRegistrations(cartKey, items);
      clearCart(cartKey);
      setGeneralPayment({
        items: snapshot,
        totalAmount,
        userKey: cartKey,
      });
      setPaymentStatus('Pooja registrations recorded successfully.');
      navigate('/payments/general');
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message ?? 'Unable to record registrations.';
      setPaymentError(typeof detail === 'string' ? detail : 'Unable to record registrations.');
    } finally {
      setProcessing(false);
    }
  };

  // Mobile card view for cart items
  const CartItemCard = ({ item }: { item: CartItem }) => {
    const amountLabel = item.amount ? `₹ ${formatCurrency(item.amount)}` : '--';
    const dayOptionCategoryLabel = item.dayOptionCategory
      ? DAY_CATEGORY_LABELS[item.dayOptionCategory] ?? item.dayOptionCategory
      : null;
    const combinedDayOption = item.dayOptionDescription
      ? `${item.dayOptionDescription}${dayOptionCategoryLabel ? ` (${dayOptionCategoryLabel})` : ''}`
      : '--';
    const selectedTamilStarLabel = item.selectedTamilStarLabel ?? null;
    
    const membersForDisplay = (() => {
      const entries = Array.isArray(item.members) && item.members.length > 0 ? item.members : null;
      if (entries && entries.length > 0) {
        return entries;
      }
      const fallbackName = item.fullName?.trim() || 'Member';
      return [
        {
          id: null,
          name: fallbackName,
          relationship: item.memberRelationship ?? 'Self',
          gender: item.memberGender ?? undefined,
          tamilStar: item.memberTamilStar ?? undefined,
          gothra: item.memberGothra ?? undefined,
          dob: item.memberDob ?? undefined,
        },
      ];
    })().map((member) => {
      const name = member?.name?.toString().trim();
      const relationship =
        (member?.relationship as string | undefined)?.toString().trim() ||
        undefined;
      const gender = (member?.gender as string | undefined)?.toString().trim() || undefined;
      const tamilStar =
        (member?.tamilStar as string | undefined)?.toString().trim() ||
        (member && typeof (member as any).tamil_star === 'string'
          ? (member as any).tamil_star.trim()
          : undefined);
      const gothra =
        (member?.gothra as string | undefined)?.toString().trim() ||
        (member && typeof (member as any).gothram === 'string'
          ? (member as any).gothram.trim()
          : undefined);
      const familyName =
        (member?.familyName as string | undefined)?.toString().trim() ||
        (member && typeof (member as any).family_name === 'string'
          ? (member as any).family_name.trim()
          : undefined);
      const dobRaw =
        (member?.dob as string | undefined)?.toString().trim() ||
        (member && typeof (member as any).date_of_birth === 'string'
          ? (member as any).date_of_birth.trim()
          : undefined);
      return {
        name: name && name.length > 0 ? name : 'Member',
        relationship,
        gender,
        tamilStar,
        gothra,
        familyName,
        dob: dobRaw,
      };
    });

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-slate-900">{item.poojaName}</h3>
            {item.poojaCode && <div className="text-xs uppercase tracking-wide text-slate-500">Code: {item.poojaCode}</div>}
          </div>
          <div className="font-semibold text-slate-900">{amountLabel}</div>
        </div>
        
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Day Option</h4>
          <div className="text-sm text-slate-700">{combinedDayOption}</div>
          {item.customDayDate && (
            <div className="text-xs text-slate-500 mt-1">
              Preferred date: {formatDisplayDate(item.customDayDate)}
            </div>
          )}
          {selectedTamilStarLabel && (
            <div className="text-xs text-slate-500 mt-1">
              Star: {selectedTamilStarLabel}
            </div>
          )}
          {item.customDayNote && (
            <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
              Note: {item.customDayNote}
            </div>
          )}
          {item.postPrasadam && (
            <div className="text-xs font-medium text-yellow-600 mt-1">Post prasadam requested</div>
          )}
        </div>
        
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Devotees</h4>
          <div className="space-y-2">
            {membersForDisplay.map((member, index) => (
              <div
                key={`${member.name}-${member.relationship ?? 'na'}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <div className="text-sm font-semibold text-slate-700">
                  {member.name}
                  {index === 0 && membersForDisplay.length > 1 && (
                    <span className="ml-2 rounded bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-600">
                      Primary
                    </span>
                  )}
                </div>
                {member.relationship && (
                  <div className="text-xs text-slate-500">Relationship: {member.relationship}</div>
                )}
                {member.gender && (
                  <div className="text-xs text-slate-500">Gender: {member.gender}</div>
                )}
                {member.tamilStar && (
                  <div className="text-xs text-slate-500">Tamil star: {member.tamilStar}</div>
                )}
                {member.gothra && (
                  <div className="text-xs text-slate-500">Gothra: {member.gothra}</div>
                )}
                {member.familyName && (
                  <div className="text-xs text-slate-500">Family name: {member.familyName}</div>
                )}
                {member.dob && (
                  <div className="text-xs text-slate-500">
                    Birth date: {formatDisplayDate(member.dob)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => removeItem(cartKey, item.cartId)}
            className="rounded-full border border-slate-300 px-4 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Remove
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-white py-6 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-lg bg-white p-4 sm:p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">Pooja Cart</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review your pooja selection and booking details before proceeding to payment.
          </p>
        </header>

        <div className="space-y-6">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Pooja</th>
                  <th className="px-4 py-2 text-left">Day Option</th>
                  <th className="px-4 py-2 text-left">Devotees</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item) => {
                const amountLabel = item.amount ? `₹ ${formatCurrency(item.amount)}` : '--';
                const dayOptionCategoryLabel = item.dayOptionCategory
                  ? DAY_CATEGORY_LABELS[item.dayOptionCategory] ?? item.dayOptionCategory
                  : null;
                const combinedDayOption = item.dayOptionDescription
                  ? `${item.dayOptionDescription}${dayOptionCategoryLabel ? ` (${dayOptionCategoryLabel})` : ''}`
                  : '--';
                const selectedTamilStarLabel = item.selectedTamilStarLabel ?? null;
                const membersForDisplay = (() => {
                  const entries = Array.isArray(item.members) && item.members.length > 0 ? item.members : null;
                  if (entries && entries.length > 0) {
                    return entries;
                  }
                  const fallbackName = item.fullName?.trim() || 'Member';
                  return [
                    {
                      id: null,
                      name: fallbackName,
                      relationship: item.memberRelationship ?? 'Self',
                      gender: item.memberGender ?? undefined,
                      tamilStar: item.memberTamilStar ?? undefined,
                      gothra: item.memberGothra ?? undefined,
                      dob: item.memberDob ?? undefined,
                    },
                  ];
                })().map((member) => {
                  const name = member?.name?.toString().trim();
                  const relationship =
                    (member?.relationship as string | undefined)?.toString().trim() ||
                    undefined;
                  const gender = (member?.gender as string | undefined)?.toString().trim() || undefined;
                  const tamilStar =
                    (member?.tamilStar as string | undefined)?.toString().trim() ||
                    (member && typeof (member as any).tamil_star === 'string'
                      ? (member as any).tamil_star.trim()
                      : undefined);
                  const gothra =
                    (member?.gothra as string | undefined)?.toString().trim() ||
                    (member && typeof (member as any).gothram === 'string'
                      ? (member as any).gothram.trim()
                      : undefined);
                  const familyName =
                    (member?.familyName as string | undefined)?.toString().trim() ||
                    (member && typeof (member as any).family_name === 'string'
                      ? (member as any).family_name.trim()
                      : undefined);
                  const dobRaw =
                    (member?.dob as string | undefined)?.toString().trim() ||
                    (member && typeof (member as any).date_of_birth === 'string'
                      ? (member as any).date_of_birth.trim()
                      : undefined);
                  return {
                    name: name && name.length > 0 ? name : 'Member',
                    relationship,
                    gender,
                    tamilStar,
                    gothra,
                    familyName,
                    dob: dobRaw,
                  };
                });

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
                          <div className="text-xs font-medium text-yellow-600">Post prasadam requested</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-600">
                      <div className="space-y-2">
                        {membersForDisplay.map((member, index) => (
                          <div
                            key={`${member.name}-${member.relationship ?? 'na'}-${index}`}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                          >
                            <div className="text-sm font-semibold text-slate-700">
                              {member.name}
                              {index === 0 && membersForDisplay.length > 1 && (
                                <span className="ml-2 rounded bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-600">
                                  Primary
                                </span>
                              )}
                            </div>
                            {member.relationship && (
                              <div className="text-xs text-slate-500">Relationship: {member.relationship}</div>
                            )}
                            {member.gender && (
                              <div className="text-xs text-slate-500">Gender: {member.gender}</div>
                            )}
                            {member.tamilStar && (
                              <div className="text-xs text-slate-500">Tamil star: {member.tamilStar}</div>
                            )}
                            {member.gothra && (
                              <div className="text-xs text-slate-500">Gothra: {member.gothra}</div>
                            )}
                            {member.familyName && (
                              <div className="text-xs text-slate-500">Family name: {member.familyName}</div>
                            )}
                            {member.dob && (
                              <div className="text-xs text-slate-500">
                                Birth date: {formatDisplayDate(member.dob)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
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

        {/* Mobile Card View */}
        <div className="md:hidden">
          {items.map((item) => (
            <CartItemCard key={item.cartId} item={item} />
          ))}
        </div>

          <aside className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-600">Cart total</p>
              <p className="text-2xl font-semibold text-slate-900">₹ {formatCurrency(totalAmount.toString())}</p>
              <p className="mt-1 text-xs text-slate-500">Continue the booking process with the temple office to complete payment.</p>
              {paymentStatus && (
                <p className="mt-3 text-sm font-semibold text-orange-600">{paymentStatus}</p>
              )}
              {paymentError && (
                <p className="mt-3 text-sm font-semibold text-red-600">{paymentError}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={processing}
                className={`w-full sm:w-auto rounded-full px-5 py-2 text-sm font-semibold text-white shadow focus:outline-none ${
                  processing
                    ? 'cursor-not-allowed bg-orange-400'
                    : 'bg-orange-700 hover:bg-orange-800'
                }`}
              >
                {processing ? 'Processing…' : `Save ₹${formatCurrency(totalAmount.toString())}`}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearCart(cartKey);
                  setPaymentStatus(null);
                  setPaymentError(null);
                }}
                className="w-full sm:w-auto rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Clear cart
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PoojaCartPage;
