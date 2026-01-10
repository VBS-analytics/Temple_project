import { create } from 'zustand';
import { isAxiosError } from 'axios';

import api from '../lib/api';
import type { CartItem } from './cart';

interface CombineAccessParent {
  id: number | null;
  name?: string | null;
  phone?: string | null;
  items: CartItem[];
  updatedAt?: string | null;
}

interface CombineAccessState {
  loading: boolean;
  canCombine: boolean | null;
  parentDonors: CombineAccessParent[];
  error: string | null;
  fetchAccess: () => Promise<void>;
  resetAccess: () => void;
}

export const useCombineAccessStore = create<CombineAccessState>((set, get) => ({
  loading: false,
  canCombine: null,
  parentDonors: [],
  error: null,
  fetchAccess: async () => {
    const state = get();
    if (state.loading) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const response = await api.get('payments/combine-access/');
      const canCombine = Boolean(response.data?.can_combine);
      const parentDonors = Array.isArray(response.data?.parent_donors)
        ? response.data.parent_donors.map((donor: any) => ({
            id: donor?.id ?? null,
            name: donor?.name ?? null,
            phone: donor?.phone ?? null,
            items: Array.isArray(donor?.items) ? donor.items : [],
            updatedAt: donor?.updated_at ?? null,
          }))
        : [];
      set({
        loading: false,
        canCombine,
        parentDonors,
        error: null,
      });
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.detail ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to verify combine payment access.';
      set({
        loading: false,
        canCombine: null,
        parentDonors: [],
        error: message,
      });
    }
  },
  resetAccess: () =>
    set({
      loading: false,
      canCombine: null,
      parentDonors: [],
      error: null,
    }),
}));
