import { create } from 'zustand';

export type Language = 'en' | 'ta';

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: 'en',
  setLanguage: (language) => set({ language }),
  toggleLanguage: () => {
    const next = get().language === 'en' ? 'ta' : 'en';
    set({ language: next });
  },
}));

export default useLanguageStore;
