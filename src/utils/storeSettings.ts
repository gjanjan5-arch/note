import { safeStorage } from './safeStorage';

export interface StoreProfile {
  storeName: string;
  ownerName: string;
  contactNumber: string;
  notes: string;
  storeAddress?: string;
  location?: string;
  phoneNumber?: string;
  gcashNumber?: string;
  purchaseMessage?: string;
  offlineText?: string;
}

const STORE_PROFILE_KEY = 'tindahan_store_profile';
const TUTORIAL_DONE_KEY = 'tindahan_tutorial_done';

export function getStoreProfile(): StoreProfile {
  try {
    const raw = safeStorage.getItem(STORE_PROFILE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // fallback
  }
  return {
    storeName: 'Tindahan ni Suki',
    ownerName: '',
    contactNumber: '',
    notes: '',
  };
}

export function saveStoreProfile(profile: StoreProfile) {
  try {
    safeStorage.setItem(STORE_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('[storeSettings] Failed to save store profile:', e);
  }
}

export function isTutorialCompleted(): boolean {
  try {
    return safeStorage.getItem(TUTORIAL_DONE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function setTutorialCompleted(completed: boolean) {
  try {
    safeStorage.setItem(TUTORIAL_DONE_KEY, completed ? 'true' : 'false');
  } catch (e) {
    console.warn('[storeSettings] Failed to save tutorial completion:', e);
  }
}

const QUICK_NOTE_HEIGHT_KEY = 'tindahan_quick_note_window_height';

export function getSavedQuickNoteHeight(): number | null {
  try {
    const raw = safeStorage.getItem(QUICK_NOTE_HEIGHT_KEY);
    if (raw) {
      const val = parseInt(raw, 10);
      if (!isNaN(val) && val >= 220 && val <= 1800) {
        return val;
      }
    }
  } catch (e) {
    // fallback
  }
  return null;
}

export function saveQuickNoteHeight(height: number): void {
  try {
    safeStorage.setItem(QUICK_NOTE_HEIGHT_KEY, String(Math.round(height)));
  } catch (e) {
    // ignore
  }
}
