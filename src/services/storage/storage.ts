import { createJSONStorage } from 'zustand/middleware';

/**
 * Persistenz-Adapter.
 * V1: localStorage. Später kann hier ein Cloud-/IndexedDB-Adapter eingesetzt werden,
 * ohne Store oder UI anzufassen.
 */
export const STORAGE_KEY = 'lifeos-data';
export const STORAGE_VERSION = 4;

export const appStorage = createJSONStorage(() => localStorage);

export function isStorageAvailable(): boolean {
  try {
    const key = '__lifeos_probe__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
