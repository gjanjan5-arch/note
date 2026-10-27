/**
 * Centralized Reference-Counted Scroll Lock Manager
 * Prevents overlapping modals, sheets, and drawers from corrupting document.body.style.overflow
 * and eliminates touch-freeze bugs where touchAction: 'none' or overflow: 'hidden' leaks.
 */

import { useEffect } from 'react';

let lockCount = 0;

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  lockCount++;
  if (lockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.overscrollBehavior = '';
  }
}

export function forceUnlockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  lockCount = 0;
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  document.body.style.overscrollBehavior = '';
}

/**
 * React hook for declarative, leak-free body scroll locking.
 * Safe with overlapping dialogs, transitions, and sudden unmounts.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
