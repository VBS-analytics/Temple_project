import type { CartItem } from '../store/cart';
import { POOJA_DATA_UPDATED_EVENT } from '../constants/events';

type RegistrationMemberPayload = {
  name: string;
  relationship?: string;
  phone_number?: string;
  tamil_star?: string;
  rasi?: string;
  gothra?: string;
  family_name?: string;
  date_of_birth?: string;
};

const buildRegistrationMembers = (members?: CartItem['members']) => {
  if (!Array.isArray(members) || members.length === 0) {
    return [];
  }
  return members.map((member) => {
    const payload: RegistrationMemberPayload = {
      name: member?.name?.trim() || 'Member',
    };
    if (member?.relationship?.trim()) payload.relationship = member.relationship.trim();
    if (member?.donorPhone?.trim()) payload.phone_number = member.donorPhone.trim();
    if (member?.tamilStar?.trim()) payload.tamil_star = member.tamilStar.trim();
    if (member?.rasi?.trim()) payload.rasi = member.rasi.trim();
    if (member?.gothra?.trim()) payload.gothra = member.gothra.trim();
    if (member?.familyName?.trim()) payload.family_name = member.familyName.trim();
    if (member?.dob) payload.date_of_birth = member.dob;
    return payload;
  });
};

const normalizeIsoDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
};

export interface RegistrationPayload {
  additional_notes?: string;
  [key: string]: unknown;
}

export const buildRegistrationPayload = (
  item: CartItem,
  paymentDate?: string,
  createdAtOverride?: string,
): RegistrationPayload => {
  const members = buildRegistrationMembers(item.members);
  if (members.length === 0) {
    const fallbackName = item.fullName?.trim() || 'Member';
    const fallback: RegistrationMemberPayload = { name: fallbackName };
    if (item.memberRelationship) fallback.relationship = item.memberRelationship.trim();
    if (item.memberTamilStar) fallback.tamil_star = item.memberTamilStar.trim();
    if (item.memberRasi) fallback.rasi = item.memberRasi.trim();
    if (item.memberGothra) fallback.gothra = item.memberGothra.trim();
    if (item.memberFamilyName) fallback.family_name = item.memberFamilyName.trim();
    if (item.memberDob) fallback.date_of_birth = item.memberDob;
    members.push(fallback);
  }

  const quantity = Math.max(members.length, 1);
  const registrationDate = item.customDayDate ?? item.bookingDate ?? paymentDate ?? new Date().toISOString();
  const normalizedStartDate = normalizeIsoDate(registrationDate);

  const payload: RegistrationPayload = {
    pooja_option: item.poojaId,
    day_option: item.dayOptionId ?? undefined,
    start_date: normalizedStartDate,
    quantity,
    is_group_registration: quantity > 1,
    post_prasadam: Boolean(item.postPrasadam),
    additional_notes: item.customDayNote?.trim() ?? '',
    members,
    cart_item: item,
  };

  const numericAmount = Number(item.amount);
  if (Number.isFinite(numericAmount)) {
    payload.total_amount = numericAmount;
  }
  if (item.recurrenceKind) payload.recurrence_kind = item.recurrenceKind;
  if (item.recurrenceFrequency) payload.recurrence_frequency = item.recurrenceFrequency;
  if (item.recurrenceOneTimeDate) payload.recurrence_one_time_date = item.recurrenceOneTimeDate;
  if (createdAtOverride) {
    payload.created_at_override = createdAtOverride;
  }

  return payload;
};

export const emitPoojaDataUpdatedEvent = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  const event = new CustomEvent(POOJA_DATA_UPDATED_EVENT);
  window.dispatchEvent(event);
};
