import React, { useState, useRef } from 'react';
import { RefreshCw, ArrowDown, CheckCircle2 } from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  lang: LanguageCode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, lang }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const threshold = 55; // Smooth calibrated threshold

  // Clear in-memory browser transient caches & re-sync
  const executeCacheRefresh = async () => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((name) => {
            if (name.includes('temp') || name.includes('data')) {
              return caches.delete(name);
            }
            return Promise.resolve(false);
          })
        );
      }

      await Promise.resolve(onRefresh());

      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2200);
    } catch (err) {
      console.warn('[PullToRefresh] Cache refresh error:', err);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY > 2) {
      isDraggingRef.current = false;
      hasMovedRef.current = false;
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;

    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY > 2) {
      isDraggingRef.current = false;
      setPullDistance(0);
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    const deltaY = touch.clientY - startYRef.current;
    const deltaX = Math.abs(touch.clientX - startXRef.current);

    if (deltaX > Math.abs(deltaY) || deltaY <= 0) {
      return;
    }

    if (deltaY > 5) {
      hasMovedRef.current = true;
      const damped = Math.min(85, Math.pow(deltaY, 0.82));
      setPullDistance(damped);
    } else {
      if (pullDistance !== 0) setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (hasMovedRef.current && pullDistance >= threshold && !isRefreshing) {
      console.log('[PullToRefresh] Threshold reached, executing cache & state refresh');
      setIsRefreshing(true);
      setPullDistance(threshold);
      try {
        await executeCacheRefresh();
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          hasMovedRef.current = false;
        }, 400);
      }
    } else {
      setPullDistance(0);
      hasMovedRef.current = false;
    }
  };

  // Mouse event handlers for desktop testing/dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY > 2) return;
    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || isRefreshing) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY > 2) {
      isDraggingRef.current = false;
      setPullDistance(0);
      return;
    }

    const deltaY = e.clientY - startYRef.current;
    const deltaX = Math.abs(e.clientX - startXRef.current);

    if (deltaX > Math.abs(deltaY) || deltaY <= 0) return;

    if (deltaY > 5) {
      hasMovedRef.current = true;
      const damped = Math.min(85, Math.pow(deltaY, 0.82));
      setPullDistance(damped);
    }
  };

  const handleMouseUp = async () => {
    if (!isDraggingRef.current) return;
    handleTouchEnd();
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="relative select-none"
    >
      {/* Toast Notification when refreshed & caches cleared */}
      {showSuccessToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transition-opacity duration-200 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
          <span>
            {lang === 'tl'
              ? 'Nalinis ang cache at na-refresh ang datos!'
              : 'Cache cleared & data refreshed!'}
          </span>
        </div>
      )}

      {/* Pull Indicator Header */}
      <div
        className="overflow-hidden flex items-center justify-center transition-all duration-200 pointer-events-none"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 text-xs font-bold theme-text-accent py-2">
          {isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
              <span>{translate(lang, 'refreshing')}</span>
            </>
          ) : pullDistance >= threshold ? (
            <>
              <RefreshCw className="w-4 h-4 text-[var(--color-primary)] rotate-180 transition-transform" />
              <span>{translate(lang, 'release_to_refresh')}</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-4 h-4 text-[var(--color-primary)]" />
              <span>{translate(lang, 'pull_to_refresh')}</span>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  );
};
