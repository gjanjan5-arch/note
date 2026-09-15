/**
 * safeStorage.ts
 * Infallible, crash-resilient storage wrapper.
 * Automatically falls back to an in-memory dictionary if localStorage throws
 * (e.g., iOS Safari Private Browsing, Android WebView quota limits, or disabled storage).
 */

const memoryStore = new Map<string, string>();

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const storage = window.localStorage;
    if (!storage) return false;
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

let storageAvailable: boolean | null = null;

function checkStorage(): boolean {
  if (storageAvailable === null) {
    storageAvailable = isStorageAvailable();
  }
  return storageAvailable;
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (checkStorage()) {
        const value = window.localStorage.getItem(key);
        if (value !== null) {
          return value;
        }
      }
    } catch (err) {
      console.warn(`[safeStorage] Read failed for key "${key}", falling back to memory:`, err);
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    try {
      if (checkStorage()) {
        window.localStorage.setItem(key, value);
        // Also keep memory sync for fallback resilience
        memoryStore.set(key, value);
        return;
      }
    } catch (err) {
      console.warn(`[safeStorage] Write failed for key "${key}", saving in memory:`, err);
    }
    memoryStore.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (checkStorage()) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn(`[safeStorage] Remove failed for key "${key}":`, err);
    }
    memoryStore.delete(key);
  },

  clear(): void {
    try {
      if (checkStorage()) {
        window.localStorage.clear();
      }
    } catch (err) {
      console.warn('[safeStorage] Clear failed:', err);
    }
    memoryStore.clear();
  },

  /**
   * Safely reads and JSON-parses a value from storage with an infallible fallback default.
   */
  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = this.getItem(key);
      if (raw === null || raw === undefined || raw === '') {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[safeStorage] JSON parse failed for key "${key}":`, err);
      return fallback;
    }
  },

  /**
   * Safely JSON-stringifies and saves a value into storage.
   */
  setJSON(key: string, value: any): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[safeStorage] JSON stringify failed for key "${key}":`, err);
    }
  },
};

