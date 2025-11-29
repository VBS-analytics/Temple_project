import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RecurrenceFrequency, RecurrenceKind } from '../types/recurrence';

export interface CartItem {
  cartId: string;
  poojaId: number;
  poojaName: string;
  poojaCode?: string | null;
  poojaImage: string;
  poojaImageUrl?: string | null;
  amount: string | null;
  bookingDate: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  dayOptionId?: number | null;
  dayOptionCode?: string | null;
  dayOptionDescription?: string | null;
  dayOptionCategory?: string | null;
  selectedTamilStarId?: string | null;
  selectedTamilStarLabel?: string | null;
  customDayDate?: string | null;
  customDayNote?: string | null;
  postPrasadam?: boolean;
  memberId?: number | null;
  memberRelationship?: string;
  memberGender?: string;
  memberTamilStar?: string;
  memberRasi?: string;
  memberGothra?: string;
  memberDob?: string | null;
  memberFamilyName?: string | null;
  recurrenceKind?: RecurrenceKind;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceOneTimeDate?: string | null;
  members?: Array<{
    id: number | null;
    name: string | null;
    relationship?: string | null;
    gender?: string | null;
    tamilStar?: string | null;
    gothra?: string | null;
    rasi?: string | null;
    dob?: string | null;
    familyName?: string | null;
    selectionKey?: string | null;
    donorName?: string | null;
    donorPhone?: string | null;
  }>;
}

type CartCollection = Record<string, CartItem[]>;

interface CartState {
  itemsByUser: CartCollection;
  addItem: (userKey: string, item: CartItem) => void;
  removeItem: (userKey: string, cartId: string) => void;
  clear: (userKey: string) => void;
  setItemsForUser: (userKey: string, items: CartItem[]) => void;
}

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      itemsByUser: {},
      addItem: (userKey, item) =>
        set((state) => {
          const existing = state.itemsByUser[userKey] ?? [];
          return {
            itemsByUser: {
              ...state.itemsByUser,
              [userKey]: [...existing, item],
            },
          };
        }),
      removeItem: (userKey, cartId) =>
        set((state) => {
          const existing = state.itemsByUser[userKey] ?? [];
          return {
            itemsByUser: {
              ...state.itemsByUser,
              [userKey]: existing.filter((item) => item.cartId !== cartId),
            },
          };
        }),
      clear: (userKey) =>
        set((state) => {
          if (!(userKey in state.itemsByUser)) return state;
          const next = { ...state.itemsByUser };
          delete next[userKey];
          return { itemsByUser: next };
        }),
      setItemsForUser: (userKey, items) =>
        set((state) => ({
          itemsByUser: {
            ...state.itemsByUser,
            [userKey]: items.map((item) => ({
              ...item,
              members: item.members ? item.members.map((member) => ({ ...member })) : [],
            })),
          },
        })),
    }),
    {
      name: 'pooja-cart',
      version: 1,
      partialize: (state) => ({ itemsByUser: state.itemsByUser }),
      migrate: (persistedState: any, version) => {
        if (!persistedState) {
          return { itemsByUser: {} };
        }
        if (version === 0 && Array.isArray(persistedState.items)) {
          const mapped = persistedState.items.map((item: any) => ({
            cartId: item?.cartId ?? generateId(),
            ...item,
          }));
          return { itemsByUser: { guest: mapped } };
        }
        if (!persistedState.itemsByUser) {
          return { itemsByUser: {} };
        }
        return persistedState;
      },
    },
  ),
);

export const createCartItem = (item: Omit<CartItem, 'cartId'>): CartItem => {
  const { members, ...rest } = item;
  return {
    cartId: generateId(),
    members: members ?? [],
    ...rest,
  };
};
