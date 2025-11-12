const STORAGE_PURGE_MARKER = 'temple-storage-purge-marker';
const APP_STORAGE_PREFIXES = ['temple-', 'pooja-'];

const hasRelevantStorage = (storage: Storage) => {
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      return true;
    }
  }
  return false;
};

export const purgeLocalStorageIfNeeded = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const { localStorage } = window;

  try {
    if (localStorage.getItem(STORAGE_PURGE_MARKER)) {
      return;
    }

    const hadRelevantData = hasRelevantStorage(localStorage);

    if (hadRelevantData || localStorage.length > 0) {
      const clearedKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key) {
          clearedKeys.push(key);
        }
      }

      localStorage.clear();
      console.info('[storage] Cleared browser storage keys:', clearedKeys);
    }

    localStorage.setItem(STORAGE_PURGE_MARKER, `purged:${new Date().toISOString()}`);
  } catch (error) {
    console.warn('[storage] Unable to purge localStorage', error);
  }
};
