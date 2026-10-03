import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * Small UI choices (filters, sorts, grid or list) kept across restarts in SQLite's
 * key-value store. Synchronous, so a screen opens with them already applied. A failing
 * read or write only loses the remembered choice, never the screen.
 */
const sync: StateStorage = {
  getItem: (key) => {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      Storage.setItemSync(key, value);
    } catch (e) {
      if (__DEV__) console.warn('persist: write failed', key, e);
    }
  },
  removeItem: (key) => {
    try {
      Storage.removeItemSync(key);
    } catch {
      // Nothing to keep.
    }
  },
};

export const persistStorage = createJSONStorage(() => sync);
