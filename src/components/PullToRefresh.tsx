import React, { useState, useRef } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  lang: LanguageCode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, lang }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const threshold = 70;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 2) {
      isDraggingRef.current = false;
      return;
    }
    const clientY = e.touches[0]?.clientY ?? 0;
    startYRef.current = clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing || window.scrollY > 2) return;
    const clientY = e.touches[0]?.clientY ?? 0;
    const distance = clientY - startYRef.current;
    if (distance > 12) {
      // Apply rubber-band damping
      const damped = Math.min(100, Math.pow(distance - 12, 0.85));
      setPullDistance(damped);
    } else {
      if (pullDistance !== 0) setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      try {
        await Promise.resolve(onRefresh());
      } catch (err) {
        console.warn('Refresh error:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 500);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull Indicator */}
      <div
        className="overflow-hidden flex items-center justify-center transition-all duration-200"
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
              <ArrowDown className="w-4 h-4 text-[var(--color-primary)] animate-bounce" />
              <span>{translate(lang, 'pull_to_refresh')}</span>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  );
};
