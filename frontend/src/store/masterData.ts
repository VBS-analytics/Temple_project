import { create } from 'zustand';

import api, { extractResults } from '../lib/api';
import { defaultGothraOptions } from '../data/familyAttributes';

type GothraOptionPayload = {
  id: number;
  name: string;
  display_order: number;
};

type MasterDataState = {
  gothraOptions: string[];
  isGothraLoading: boolean;
  isGothraSaving: boolean;
  isGothraLoaded: boolean;
  loadGothraOptions: (force?: boolean) => Promise<void>;
  createGothraOption: (name: string) => Promise<void>;
};

export const useMasterDataStore = create<MasterDataState>((set, get) => ({
  gothraOptions: defaultGothraOptions as string[],
  isGothraLoading: false,
  isGothraSaving: false,
  isGothraLoaded: false,
  loadGothraOptions: async (force = false) => {
    const { isGothraLoading, isGothraLoaded } = get();
    if (!force && (isGothraLoading || isGothraLoaded)) {
      return;
    }
    set({ isGothraLoading: true });
    if (force) {
      set({ isGothraLoaded: false });
    }
    try {
      const response = await api.get('auth/gothra-options/', {
        params: {
          page_size: 200,
          ordering: 'display_order',
        },
      });
      const remoteOptions = extractResults<GothraOptionPayload>(response.data);
      set({
        gothraOptions: remoteOptions.map((option) => option.name),
        isGothraLoaded: true,
      });
    } catch (error) {
      console.error('Unable to load gothra options', error);
    } finally {
      set({ isGothraLoading: false });
    }
  },
  createGothraOption: async (name: string) => {
    set({ isGothraSaving: true });
    try {
      await api.post('auth/gothra-options/', { name });
      await get().loadGothraOptions(true);
    } finally {
      set({ isGothraSaving: false });
    }
  },
}));
