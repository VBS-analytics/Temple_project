import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CartItem } from './cart';

const HISTORY_LIMIT = 10;

interface GeneralPaymentSnapshot {
  id: string;
  createdAt: string;
  totalAmount: number;
  items: CartItem[];
  userKey: string;
}

interface GeneralPaymentHistoryEntry extends GeneralPaymentSnapshot {
  completedAt: string;
}

interface CombinePaymentHistoryEntry {
  id: string;
  completedAt: string;
  combinedTotal: number;
  yourTotal: number;
  yourCount: number;
  yourItems: CartItem[];
  donors: {
    id: number | null;
    name?: string | null;
    phone?: string | null;
    totalAmount: number;
    count: number;
    items: CartItem[];
  }[];
}

interface CombinePaymentHistoryPayload {
  yourItems: CartItem[];
  yourTotal: number;
  donors?: {
    id: number | null;
    name?: string | null;
    phone?: string | null;
    items: CartItem[];
    totalAmount: number;
  }[] | null;
  combinedTotal: number;
}

interface CombineDraft {
  donorIds: number[];
  effectiveMonth: string;
  updatedAt: string;
}

interface GeneralPaymentState {
  lastGeneralPaymentByUser: Record<string, GeneralPaymentSnapshot>;
  generalPaymentHistory: GeneralPaymentHistoryEntry[];
  combinePaymentHistory: CombinePaymentHistoryEntry[];
  combineDraft: CombineDraft | null;
  setGeneralPayment: (payload: { items: CartItem[]; totalAmount: number; userKey: string }) => void;
  clearGeneralPayment: (userKey: string) => void;
  addGeneralPaymentHistory: (snapshot: GeneralPaymentSnapshot) => void;
  clearGeneralPaymentHistory: (userKey?: string) => void;
  addCombinePaymentHistory: (payload: CombinePaymentHistoryPayload) => void;
  clearCombinePaymentHistory: () => void;
  saveCombineDraft: (draft: CombineDraft) => void;
  clearCombineDraft: () => void;
}

const cloneCartItem = (item: CartItem): CartItem => ({
  ...item,
  members: item.members ? item.members.map((member) => ({ ...member })) : [],
});

export const usePaymentStore = create<GeneralPaymentState>()(
  persist(
    (set) => ({
      lastGeneralPaymentByUser: {},
      generalPaymentHistory: [],
      combinePaymentHistory: [],
      combineDraft: null,
      setGeneralPayment: ({ items, totalAmount, userKey }) =>
        set((state) => ({
          lastGeneralPaymentByUser: {
            ...state.lastGeneralPaymentByUser,
            [userKey]: {
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: new Date().toISOString(),
              totalAmount,
              items: items.map(cloneCartItem),
              userKey,
            },
          },
        })),
      clearGeneralPayment: (userKey) =>
        set((state) => {
          const next = { ...state.lastGeneralPaymentByUser };
          delete next[userKey];
          return { lastGeneralPaymentByUser: next };
        }),
      addGeneralPaymentHistory: (snapshot) =>
        set((state) => {
          const entry: GeneralPaymentHistoryEntry = {
            ...snapshot,
            items: snapshot.items.map(cloneCartItem),
            completedAt: new Date().toISOString(),
          };
          return {
            generalPaymentHistory: [entry, ...state.generalPaymentHistory].slice(0, HISTORY_LIMIT),
          };
        }),
      clearGeneralPaymentHistory: (userKey) =>
        set((state) => ({
          generalPaymentHistory: userKey
            ? state.generalPaymentHistory.filter((entry) => entry.userKey !== userKey)
            : [],
        })),
      addCombinePaymentHistory: ({ yourItems, yourTotal, donors, combinedTotal }) =>
        set((state) => {
          const entry: CombinePaymentHistoryEntry = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            completedAt: new Date().toISOString(),
            combinedTotal,
            yourTotal,
            yourCount: yourItems.length,
            yourItems: yourItems.map(cloneCartItem),
            donors: donors
              ? donors.map((donorEntry) => ({
                  id: donorEntry.id ?? null,
                  name: donorEntry.name ?? null,
                  phone: donorEntry.phone ?? null,
                  totalAmount: donorEntry.totalAmount,
                  count: donorEntry.items.length,
                  items: donorEntry.items.map(cloneCartItem),
                }))
              : [],
          };
          return {
            combinePaymentHistory: [entry, ...state.combinePaymentHistory].slice(0, HISTORY_LIMIT),
          };
        }),
      clearCombinePaymentHistory: () => set(() => ({ combinePaymentHistory: [] })),
      saveCombineDraft: (draft) => set(() => ({ combineDraft: draft })),
      clearCombineDraft: () => set(() => ({ combineDraft: null })),
    }),
    {
      name: 'general-payment-snapshot',
      version: 2,
      partialize: (state) => ({
        lastGeneralPaymentByUser: state.lastGeneralPaymentByUser,
        generalPaymentHistory: state.generalPaymentHistory,
        combinePaymentHistory: state.combinePaymentHistory,
        combineDraft: state.combineDraft,
      }),
    },
  ),
);
