import React, { useState, useEffect } from 'react';
import { PanelLeft, Store, Search } from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';
import type { StoreProfile } from '../utils/storeSettings';
import { safeStorage } from '../utils/safeStorage';

const MENU_TOOLTIP_KEY = 'tindahan_menu_tooltip_views';
const MAX_TOOLTIP_VIEWS = 5;

interface HeaderProps {
  storeProfile: StoreProfile;
  lang: LanguageCode;
  onOpenMenu: () => void;
  onOpenSearch?: () => void;
  appMode?: 'seller' | 'buyer';
}

export const Header: React.FC<HeaderProps> = ({
  storeProfile,
  lang,
  onOpenMenu,
  onOpenSearch,
  appMode = 'seller',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const rawCount = safeStorage.getItem(MENU_TOOLTIP_KEY);
    const count = rawCount ? parseInt(rawCount, 10) : 0;

    if (count < MAX_TOOLTIP_VIEWS) {
      safeStorage.setItem(MENU_TOOLTIP_KEY, (count + 1).toString());
      setShowTooltip(true);
    }
  }, []);

  // Dismiss on first touch or click with minimal event listeners
  useEffect(() => {
    if (!showTooltip) return;

    const handleDismiss = () => {
      setShowTooltip(false);
    };

    // Use { once: true, passive: true } for minimal RAM, low battery, and zero garbage collection overhead
    window.addEventListener('click', handleDismiss, { once: true, passive: true });
    window.addEventListener('touchstart', handleDismiss, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('touchstart', handleDismiss);
    };
  }, [showTooltip]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showTooltip) setShowTooltip(false);
    onOpenMenu();
  };

  return (
    <header className="theme-bg-header text-white shadow-xs border-b theme-border-subtle sticky top-0 z-30 transition-colors duration-200 w-full">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 safe-pt-header pb-2.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Menu Drawer Toggle Button with Custom Geometric Icon & Speech Bubble */}
        <div className="relative flex items-center">
          <button
            id="header-menu-btn"
            type="button"
            role="button"
            tabIndex={0}
            style={{ touchAction: 'manipulation' }}
            onClick={handleMenuClick}
            className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white rounded-2xl transition-all border border-white/15 active:scale-95 cursor-pointer flex items-center justify-center shadow-2xs"
            aria-label="Open Navigation Menu"
            title="Menu"
          >
            <PanelLeft className="w-5 h-5 stroke-[2.2] text-white" />
          </button>

          {/* Lightweight Floating Speech Bubble (Inherits active theme colors) */}
          {showTooltip && (
            <div
              id="menu-speech-bubble"
              role="tooltip"
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(false);
                onOpenMenu();
              }}
              className="absolute left-0 top-full mt-2.5 z-50 pointer-events-auto cursor-pointer select-none transition-opacity duration-200"
            >
              {/* Pointer Triangle / Tail pointing up to Menu button */}
              <div
                className="w-0 h-0 border-x-[6px] border-x-transparent border-b-[6px] ml-3.5 drop-shadow-xs"
                style={{ borderBottomColor: 'var(--color-surface-card)' }}
              />

              {/* Bubble Body with theme styling */}
              <div className="theme-bg-card theme-text-app border theme-border px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap flex items-center gap-1.5 leading-tight tracking-tight text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full theme-bg-primary shrink-0" />
                <span>{translate(lang, 'menu_tooltip') || 'Tap here for Settings & more'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Brand & Store Name */}
        <div id="header-store-badge" className="flex items-center justify-center gap-2 min-w-0 flex-1 text-center">
          <div className="w-8 h-8 rounded-xl theme-bg-primary text-white flex items-center justify-center font-black shadow-inner shrink-0 border border-white/20">
            <Store className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0 max-w-[200px] sm:max-w-sm">
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white leading-tight truncate">
              {translate(lang, 'app_title') || 'Tinda'}
            </h1>
            <p className="text-[10px] sm:text-[11px] theme-text-accent font-medium truncate opacity-90">
              {storeProfile.storeName || translate(lang, 'app_subtitle')}
            </p>
          </div>
        </div>

        {/* Right: Global Search Button with responsive touch target & label for older users */}
        <div className="flex items-center">
          <button
            id="header-global-search-btn"
            type="button"
            role="button"
            tabIndex={0}
            style={{ touchAction: 'manipulation' }}
            onClick={onOpenSearch}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white rounded-2xl transition-all border border-white/15 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            aria-label="Global Search"
            title={lang === 'tl' ? 'Maghanap (Ctrl+K)' : 'Search (Ctrl+K)'}
          >
            <Search className="w-4 h-4 stroke-[2.2] text-white shrink-0" />
            <span className="text-xs font-bold whitespace-nowrap">
              {appMode === 'buyer'
                ? lang === 'tl'
                  ? 'Hanapin Suki'
                  : 'Search Suki Stores'
                : lang === 'tl'
                ? 'Hanap Paninda / Utang'
                : 'Search Store'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};


