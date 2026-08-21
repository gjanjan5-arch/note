export interface StoreProfile {
  storeName: string;
  ownerName: string;
  contactNumber: string;
  notes: string;
}

const STORE_PROFILE_KEY = 'tindahan_store_profile';
const TUTORIAL_DONE_KEY = 'tindahan_tutorial_done';

export function getStoreProfile(): StoreProfile {
  try {
    const raw = localStorage.getItem(STORE_PROFILE_KEY);
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
  localStorage.setItem(STORE_PROFILE_KEY, JSON.stringify(profile));
}

export function isTutorialCompleted(): boolean {
  return localStorage.getItem(TUTORIAL_DONE_KEY) === 'true';
}

export function setTutorialCompleted(completed: boolean) {
  localStorage.setItem(TUTORIAL_DONE_KEY, completed ? 'true' : 'false');
}

const QUICK_NOTE_HEIGHT_KEY = 'tindahan_quick_note_window_height';

export function getSavedQuickNoteHeight(): number | null {
  try {
    const raw = localStorage.getItem(QUICK_NOTE_HEIGHT_KEY);
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
    localStorage.setItem(QUICK_NOTE_HEIGHT_KEY, String(Math.round(height)));
  } catch (e) {
    // ignore
  }
}
