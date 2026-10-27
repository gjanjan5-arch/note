import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { safeStorage } from '../utils/safeStorage';

export type PerformanceMode = 'AUTO' | 'ECO' | 'FULL';
export type DeviceTier = 'low' | 'mid' | 'high';
export type AnimationLevel = 'none' | 'fade-only' | 'full';

const PERFORMANCE_STORAGE_KEY = 'tinda_performance_mode';

export interface PerformanceContextType {
  mode: PerformanceMode;
  resolvedMode: 'ECO' | 'FULL';
  animationLevel: AnimationLevel;
  canAnimate: boolean;
  isFadeOnly: boolean;
  isEco: boolean;
  isAuto: boolean;
  deviceTier: DeviceTier;
  searchDebounceMs: number;
  allowHeavyAnimations: boolean;
  scannerFrameIntervalMs: number;
  setMode: (mode: PerformanceMode) => void;
}

// Detect hardware tier (based on RAM and CPU concurrency, matching ScannerModal pattern)
const detectDeviceTier = (): DeviceTier => {
  try {
    if (typeof window === 'undefined') return 'mid';
    const ram = (navigator as any).deviceMemory;
    const cores = navigator.hardwareConcurrency;

    // If deviceMemory API is supported (Chrome/Android WebView):
    // < 3GB RAM is low tier (budget 1-2GB phones)
    if (typeof ram === 'number') {
      if (ram < 3) return 'low';
      if (ram >= 4) return 'high';
      return 'mid';
    }

    // Fallback heuristic: 4 cores or fewer is budget/low tier on modern Android
    if (typeof cores === 'number' && cores <= 4) {
      return 'low';
    }

    return 'mid';
  } catch (err) {
    console.warn('[PerformanceContext] Device tier detection fallback:', err);
    return 'mid';
  }
};

const PerformanceContext = createContext<PerformanceContextType>({
  mode: 'AUTO',
  resolvedMode: 'FULL',
  animationLevel: 'fade-only',
  canAnimate: true,
  isFadeOnly: true,
  isEco: false,
  isAuto: true,
  deviceTier: 'mid',
  searchDebounceMs: 150,
  allowHeavyAnimations: true,
  scannerFrameIntervalMs: 400,
  setMode: () => {},
});

export const PerformanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceTier] = useState<DeviceTier>(() => detectDeviceTier());

  // Load saved preference from safeStorage, defaulting to AUTO
  const [mode, setModeState] = useState<PerformanceMode>(() => {
    try {
      const saved = safeStorage.getItem(PERFORMANCE_STORAGE_KEY);
      if (saved === 'AUTO' || saved === 'ECO' || saved === 'FULL') {
        return saved;
      }
    } catch (e) {
      console.warn('[PerformanceContext] Failed to load performance mode:', e);
    }
    return 'AUTO';
  });

  // Calculate resolved effective mode
  const resolvedMode: 'ECO' | 'FULL' = useMemo(() => {
    if (mode === 'ECO') return 'ECO';
    if (mode === 'FULL') return 'FULL';
    // AUTO mode: resolve to ECO for low-tier devices; FULL for mid/high devices
    return deviceTier === 'low' ? 'ECO' : 'FULL';
  }, [mode, deviceTier]);

  // Dynamic Graphical & Animation Control Level:
  // - FULL mode: full motion & animations enabled ('full')
  // - ECO mode: light opacity fade only or disabled ('fade-only' / 'none')
  // - AUTO mode: dynamic algorithm - if device can render comfortably (mid/high), use lightest fade animations ('fade-only');
  //              if device is low-spec (low tier), suppress animations entirely ('none')
  const animationLevel: AnimationLevel = useMemo(() => {
    // Respect user/system reduced-motion preference unconditionally
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'none';
    }

    if (mode === 'FULL') {
      return 'full';
    }

    if (mode === 'ECO') {
      return deviceTier === 'low' ? 'none' : 'fade-only';
    }

    // AUTO mode:
    // Device capability algorithm:
    // If device can render it (mid or high tier) -> use lightest animations ('fade-only')
    // If device is low tier (< 3GB RAM or <= 4 cores) -> don't use animations ('none')
    return deviceTier === 'low' ? 'none' : 'fade-only';
  }, [mode, deviceTier]);

  // Synchronize with DOM dataset for instant CSS responsiveness
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.perfMode = resolvedMode.toLowerCase();
      document.documentElement.dataset.animationLevel = animationLevel;
    }
  }, [resolvedMode, animationLevel]);

  // Explicit user choice handler: persists to safeStorage, never silently overwritten
  const setMode = useCallback((newMode: PerformanceMode) => {
    setModeState(newMode);
    try {
      safeStorage.setItem(PERFORMANCE_STORAGE_KEY, newMode);
    } catch (e) {
      console.warn('[PerformanceContext] Failed to persist performance mode:', e);
    }
  }, []);

  const value = useMemo<PerformanceContextType>(
    () => ({
      mode,
      resolvedMode,
      animationLevel,
      canAnimate: animationLevel !== 'none',
      isFadeOnly: animationLevel === 'fade-only',
      isEco: resolvedMode === 'ECO',
      isAuto: mode === 'AUTO',
      deviceTier,
      searchDebounceMs: resolvedMode === 'ECO' ? 400 : 150,
      allowHeavyAnimations: animationLevel === 'full',
      scannerFrameIntervalMs: resolvedMode === 'ECO' ? 800 : 400,
      setMode,
    }),
    [mode, resolvedMode, animationLevel, deviceTier, setMode]
  );

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
};

export const usePerformance = (): PerformanceContextType => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};
