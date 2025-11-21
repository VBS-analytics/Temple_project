import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CartItem } from './cart';

interface GeneralPaymentSnapshot {
  id: string;
  createdAt: string;
  totalAmount: number;
  items: CartItem[];
}

interface GeneralPaymentState {
  lastGeneralPayment: GeneralPaymentSnapshot | null;
  setGeneralPayment: (payload: { items: CartItem[]; totalAmount: number }) => void;
  clearGeneralPayment: () => void;
}

const cloneCartItem = (item: CartItem): CartItem => ({
  ...item,
  members: item.members ? item.members.map((member) => ({ ...member })) : [],
});

export const usePaymentStore = create<GeneralPaymentState>()(
  persist(
    (set) => ({
      lastGeneralPayment: null,
      setGeneralPayment: ({ items, totalAmount }) =>
        set(() => ({
          lastGeneralPayment: {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
            totalAmount,
            items: items.map(cloneCartItem),
          },
        })),
      clearGeneralPayment: () => set(() => ({ lastGeneralPayment: null })),
    }),
    {
      name: 'general-payment-snapshot',
      version: 1,
      partialize: (state) => ({ lastGeneralPayment: state.lastGeneralPayment }),
    },
  ),
);
