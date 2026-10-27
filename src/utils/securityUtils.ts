import { safeStorage } from './safeStorage';

const PIN_STORAGE_KEY = 'tinda_owner_pin_hash';
const PIN_ENABLED_KEY = 'tinda_owner_pin_enabled';
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle time

/**
 * Offline-proof SHA-256 hashing for the 6-digit owner PIN.
 * This runs 100% on-device and cannot be bypassed by toggling internet on/off.
 */
async function hashPin(pin: string): Promise<string> {
  const salt = 'tinda_owner_mode_secure_salt_v1';
  const data = new TextEncoder().encode(salt + pin);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Pure JS fallback in case Web Crypto is unavailable in edge WebViews
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
}

/**
 * Checks whether an Owner PIN is currently configured and active.
 */
export function hasOwnerPin(): boolean {
  try {
    const isEnabled = safeStorage.getItem(PIN_ENABLED_KEY);
    const hash = safeStorage.getItem(PIN_STORAGE_KEY);
    return isEnabled === 'true' && !!hash;
  } catch {
    return false;
  }
}

/**
 * Verifies if the entered 6-digit PIN matches the stored hash.
 */
export async function verifyOwnerPin(pin: string): Promise<boolean> {
  try {
    const storedHash = safeStorage.getItem(PIN_STORAGE_KEY);
    if (!storedHash) return false;
    const computedHash = await hashPin(pin.trim());
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

/**
 * Saves a new 6-digit Owner PIN securely to local storage.
 */
export async function setOwnerPin(pin: string): Promise<boolean> {
  try {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      return false;
    }
    const computedHash = await hashPin(cleanPin);
    safeStorage.setItem(PIN_STORAGE_KEY, computedHash);
    safeStorage.setItem(PIN_ENABLED_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes or disables the Owner PIN.
 */
export function removeOwnerPin(): void {
  try {
    safeStorage.removeItem(PIN_STORAGE_KEY);
    safeStorage.removeItem(PIN_ENABLED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Triggers gentle phone haptic feedback on devices that support navigator.vibrate.
 * Default is a quick error pattern [50ms, 40ms, 50ms].
 */
export function triggerHapticFeedback(pattern: number[] = [50, 40, 50]): void {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported hardware
  }
}

/**
 * Global lifecycle listener for:
 * 1. App Switch / Home button / Screen Sleep (`visibilitychange` -> `hidden`)
 * 2. 5-Minute continuous idle timer (resets on tap/key/scroll)
 *
 * NOTE: Internal modals/popups/sheets inside this app do NOT fire `visibilitychange`
 * because the browser document stays visible.
 */
export function setupAutoLockListener(
  isOwnerMode: boolean,
  onAutoLock: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (!isOwnerMode) return;

    idleTimer = setTimeout(() => {
      onAutoLock();
    }, IDLE_TIMEOUT_MS);
  };

  const handleVisibilityChange = () => {
    // When the user taps Home, switches apps, or locks the phone
    if (document.visibilityState === 'hidden' && isOwnerMode) {
      onAutoLock();
    }
  };

  if (isOwnerMode) {
    resetIdleTimer();
    const interactionEvents: Array<keyof WindowEventMap> = [
      'mousedown',
      'touchstart',
      'keydown',
      'scroll',
    ];

    interactionEvents.forEach((ev) => {
      window.addEventListener(ev, resetIdleTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      interactionEvents.forEach((ev) => {
        window.removeEventListener(ev, resetIdleTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  return () => {
    if (idleTimer) clearTimeout(idleTimer);
  };
}
