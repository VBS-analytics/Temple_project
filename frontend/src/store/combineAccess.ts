import { create } from 'zustand';
import { isAxiosError } from 'axios';

import api from '../lib/api';
import type { CartItem } from './cart';

export interface CombineAccessParent {
  id: number | null;
  name?: string | null;
  phone?: string | null;
  items: CartItem[];
  dueMonths?: string[];
  updatedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  active?: boolean | null;
}

type CombineRole = 'main' | 'subordinate' | null;

interface CombinedToInfo {
  id: number | null;
  name?: string | null;
  phone?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

interface CombineAccessState {
  loading: boolean;
  canCombine: boolean | null;
  mainDonorItems: CartItem[];
  parentDonors: CombineAccessParent[];
  role: CombineRole;
  combinedTo: CombinedToInfo | null;
  error: string | null;
  fetchAccess: () => Promise<void>;
  resetAccess: () => void;
}

export const useCombineAccessStore = create<CombineAccessState>((set, get) => ({
  loading: false,
  canCombine: null,
  mainDonorItems: [],
  parentDonors: [],
  role: null,
  combinedTo: null,
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
      const role = (response.data?.role as CombineRole) ?? null;
      const combinedToPayload = response.data?.combined_to;
      const combinedTo: CombinedToInfo | null = combinedToPayload
        ? {
            id: combinedToPayload?.id ?? null,
            name: combinedToPayload?.name ?? null,
            phone: combinedToPayload?.phone ?? null,
            effectiveFrom: combinedToPayload?.effective_from ?? null,
            effectiveTo: combinedToPayload?.effective_to ?? null,
          }
        : null;
      const parentDonors = Array.isArray(response.data?.parent_donors)
        ? response.data.parent_donors.map((donor: any) => ({
            id: donor?.id ?? null,
            name: donor?.name ?? null,
            phone: donor?.phone ?? null,
            // Always keep the parent donor's pending items so the Combine Payment page can
            // display pooja counts and dues. Previously we filtered to cart-prefixed IDs,
            // which stripped out registration items returned by the API and resulted in
            // zero due/pooja counts for linked donors.
            items: Array.isArray(donor?.items)
              ? donor.items
                  .filter((item: any) => item && typeof item === 'object')
                  .map((item: any, index: number) => ({
                    ...item,
                    // Ensure every item has a cartId so UI keys stay stable
                    cartId:
                      item.cartId ?? `parent-${donor?.id ?? donor?.phone ?? 'unknown'}-${index}`,
                    members: Array.isArray(item?.members) ? item.members : [],
                  }))
              : [],
            dueMonths: Array.isArray(donor?.due_months) ? donor.due_months : [],
            updatedAt: donor?.updated_at ?? null,
            effectiveFrom: donor?.effective_from ?? null,
            effectiveTo: donor?.effective_to ?? null,
            active: typeof donor?.active === 'boolean' ? donor.active : null,
          }))
        : [];
      const mainDonorItems = Array.isArray(response.data?.main_donor?.items) ? response.data.main_donor.items : [];
      set({
        loading: false,
        canCombine,
        mainDonorItems,
        parentDonors,
        role,
        combinedTo,
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
        role: null,
        combinedTo: null,
        error: message,
      });
    }
  },
  resetAccess: () =>
    set({
      loading: false,
      canCombine: null,
      mainDonorItems: [],
      parentDonors: [],
      role: null,
      combinedTo: null,
      error: null,
    }),
}));
