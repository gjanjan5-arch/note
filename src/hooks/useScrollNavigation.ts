import { useState, useEffect, useRef } from 'react';

interface UseScrollNavigationOptions {
  /**
   * The minimum scroll threshold in pixels from the top before hiding (defaults to 50px).
   */
  threshold?: number;
  /**
   * Sensitivity delta in pixels to ignore touch jitter (defaults to 3px).
   */
  sensitivity?: number;
}

export function useScrollNavigation(options?: UseScrollNavigationOptions) {
  const threshold = options?.threshold ?? 50;
  const sensitivity = options?.sensitivity ?? 3;

  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const isTicking = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      if (isTicking.current) return;

      isTicking.current = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
        const delta = currentScrollY - lastScrollY.current;

        // If near the top (within threshold), header is always visible
        if (currentScrollY <= threshold) {
          setIsNavVisible(true);
        } else if (delta > sensitivity) {
          // Scrolling DOWN past min threshold -> hide header
          setIsNavVisible(false);
        } else if (delta < -sensitivity) {
          // Scrolling UP (even slightly) -> immediately show header
          setIsNavVisible(true);
        }

        lastScrollY.current = currentScrollY;
        isTicking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, sensitivity]);

  return { isNavVisible };
}
