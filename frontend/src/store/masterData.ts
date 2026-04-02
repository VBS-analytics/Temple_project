import { create } from 'zustand';

import api, { extractResults } from '../lib/api';
import { defaultGothraOptions, rasiOptions as defaultRasiOptions } from '../data/familyAttributes';
import { nakshatraOptions as defaultNakshatraOptions } from '../data/nakshatraOptions';

export type GothraOptionPayload = {
  id: number;
  name: string;
  display_order: number;
};

export type NakshatraOptionPayload = {
  id: number;
  name: string;
  display_order: number;
};

export type RasiOptionPayload = {
  id: number;
  name: string;
  display_order: number;
};

type MasterDataState = {
  gothraOptions: string[];
  gothraOptionEntries: GothraOptionPayload[];
  nakshatraOptions: string[];
  nakshatraOptionEntries: NakshatraOptionPayload[];
  rasiOptions: string[];
  rasiOptionEntries: RasiOptionPayload[];
  isGothraLoading: boolean;
  isGothraSaving: boolean;
  isGothraLoaded: boolean;
  isNakshatraLoading: boolean;
  isNakshatraSaving: boolean;
  isNakshatraLoaded: boolean;
  isRasiLoading: boolean;
  isRasiSaving: boolean;
  isRasiLoaded: boolean;
  loadGothraOptions: (force?: boolean) => Promise<void>;
  createGothraOption: (name: string) => Promise<void>;
  updateGothraOption: (id: number, name: string) => Promise<void>;
  loadNakshatraOptions: (force?: boolean) => Promise<void>;
  createNakshatraOption: (name: string) => Promise<void>;
  updateNakshatraOption: (id: number, name: string) => Promise<void>;
  loadRasiOptions: (force?: boolean) => Promise<void>;
  createRasiOption: (name: string) => Promise<void>;
  updateRasiOption: (id: number, name: string) => Promise<void>;
};

const defaultEntries: GothraOptionPayload[] = defaultGothraOptions.map((name, index) => ({
  id: index + 1,
  name,
  display_order: index + 1,
}));

const defaultNakshatraEntries: NakshatraOptionPayload[] = defaultNakshatraOptions.map((name, index) => ({
  id: index + 1,
  name,
  display_order: index + 1,
}));

const defaultRasiEntries: RasiOptionPayload[] = defaultRasiOptions.map((name, index) => ({
  id: index + 1,
  name,
  display_order: index + 1,
}));

export const useMasterDataStore = create<MasterDataState>((set, get) => ({
  gothraOptions: Array.from(defaultGothraOptions),
  gothraOptionEntries: defaultEntries,
  nakshatraOptions: Array.from(defaultNakshatraOptions),
  nakshatraOptionEntries: defaultNakshatraEntries,
  rasiOptions: Array.from(defaultRasiOptions),
  rasiOptionEntries: defaultRasiEntries,
  isGothraLoading: false,
  isGothraSaving: false,
  isGothraLoaded: false,
  isNakshatraLoading: false,
  isNakshatraSaving: false,
  isNakshatraLoaded: false,
  isRasiLoading: false,
  isRasiSaving: false,
  isRasiLoaded: false,
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
        gothraOptionEntries: remoteOptions,
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
  updateGothraOption: async (id: number, name: string) => {
    set({ isGothraSaving: true });
    try {
      await api.patch(`auth/gothra-options/${id}/`, { name });
      await get().loadGothraOptions(true);
    } finally {
      set({ isGothraSaving: false });
    }
  },
  loadNakshatraOptions: async (force = false) => {
    const { isNakshatraLoading, isNakshatraLoaded } = get();
    if (!force && (isNakshatraLoading || isNakshatraLoaded)) {
      return;
    }
    set({ isNakshatraLoading: true });
    if (force) {
      set({ isNakshatraLoaded: false });
    }
    try {
      const response = await api.get('auth/nakshatra-options/', {
        params: {
          page_size: 200,
          ordering: 'display_order',
        },
      });
      const remoteOptions = extractResults<NakshatraOptionPayload>(response.data);
      set({
        nakshatraOptions: remoteOptions.map((option) => option.name),
        nakshatraOptionEntries: remoteOptions,
        isNakshatraLoaded: true,
      });
    } catch (error) {
      console.error('Unable to load nakshatra options', error);
    } finally {
      set({ isNakshatraLoading: false });
    }
  },
  createNakshatraOption: async (name: string) => {
    set({ isNakshatraSaving: true });
    try {
      await api.post('auth/nakshatra-options/', { name });
      await get().loadNakshatraOptions(true);
    } finally {
      set({ isNakshatraSaving: false });
    }
  },
  updateNakshatraOption: async (id: number, name: string) => {
    set({ isNakshatraSaving: true });
    try {
      await api.patch(`auth/nakshatra-options/${id}/`, { name });
      await get().loadNakshatraOptions(true);
    } finally {
      set({ isNakshatraSaving: false });
    }
  },
  loadRasiOptions: async (force = false) => {
    const { isRasiLoading, isRasiLoaded } = get();
    if (!force && (isRasiLoading || isRasiLoaded)) {
      return;
    }
    set({ isRasiLoading: true });
    if (force) {
      set({ isRasiLoaded: false });
    }
    try {
      const response = await api.get('auth/rasi-options/', {
        params: {
          page_size: 200,
          ordering: 'display_order',
        },
      });
      const remoteOptions = extractResults<RasiOptionPayload>(response.data);
      set({
        rasiOptions: remoteOptions.map((option) => option.name),
        rasiOptionEntries: remoteOptions,
        isRasiLoaded: true,
      });
    } catch (error) {
      console.error('Unable to load rasi options', error);
    } finally {
      set({ isRasiLoading: false });
    }
  },
  createRasiOption: async (name: string) => {
    set({ isRasiSaving: true });
    try {
      await api.post('auth/rasi-options/', { name });
      await get().loadRasiOptions(true);
    } finally {
      set({ isRasiSaving: false });
    }
  },
  updateRasiOption: async (id: number, name: string) => {
    set({ isRasiSaving: true });
    try {
      await api.patch(`auth/rasi-options/${id}/`, { name });
      await get().loadRasiOptions(true);
    } finally {
      set({ isRasiSaving: false });
    }
  },
}));
