import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CartItem } from './cart';

export interface RegistrationEntry extends CartItem {
  registrationId: string;
  completedAt: string;
  orderId?: string;
}

type RegistrationCollection = Record<string, RegistrationEntry[]>;

interface RegistrationState {
  registrationsByUser: RegistrationCollection;
  addRegistrations: (userKey: string, items: CartItem[]) => void;
  clearRegistrations: (userKey: string) => void;
  clearAllRegistrations: () => void;
}

const generateRegistrationId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set) => ({
      registrationsByUser: {},
      addRegistrations: (userKey, items) =>
        set((state) => {
          if (items.length === 0) {
            return state;
          }

          const existing = state.registrationsByUser[userKey] ?? [];
          const now = new Date().toISOString();
          const orderId = generateRegistrationId();

          const clonedItems = items.map((item) => ({
            ...item,
            members: item.members ? item.members.map((member) => ({ ...member })) : [],
          }));

          const nextEntries = clonedItems.map((item) => ({
            ...item,
            registrationId: generateRegistrationId(),
            orderId,
            completedAt: now,
          }));

          return {
            registrationsByUser: {
              ...state.registrationsByUser,
              [userKey]: [...nextEntries, ...existing],
            },
          };
        }),
      clearRegistrations: (userKey) =>
        set((state) => {
          if (!(userKey in state.registrationsByUser)) {
            return state;
          }
          const next = { ...state.registrationsByUser };
          delete next[userKey];
          return { registrationsByUser: next };
        }),
      clearAllRegistrations: () => set(() => ({ registrationsByUser: {} })),
    }),
    {
      name: 'pooja-registrations',
      version: 2,
      partialize: (state) => ({ registrationsByUser: state.registrationsByUser }),
      migrate: (persistedState: any, version) => {
        if (!persistedState) {
          return { registrationsByUser: {} };
        }

        if (version < 2) {
          return { registrationsByUser: {} };
        }

        if (!persistedState.registrationsByUser) {
          return { registrationsByUser: {} };
        }

        return persistedState;
      },
    },
  ),
);
