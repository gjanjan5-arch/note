import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  Database,
  ShoppingBag,
  Store,
  ChevronRight,
  Receipt,
  User,
  Heart,
  Package,
  TrendingUp,
  Lightbulb,
  Notebook,
  QrCode,
} from 'lucide-react';
import { BurgerIcon } from './BurgerIcon';
import { translate, type LanguageCode } from '../utils/i18n';
import type { StoreProfile } from '../utils/storeSettings';
import { usePerformance } from '../context/PerformanceContext';
import { useBodyScrollLock } from '../utils/scrollLock';

export interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  storeProfile: StoreProfile;
  appMode: 'seller' | 'buyer';
  onSwitchMode: (mode: 'seller' | 'buyer') => void;
  onOpenSettings: (tab?: 'GENERAL' | 'STORE' | 'DATA' | 'HELP' | 'ABOUT') => void;
  onOpenStoreQR: () => void;
  onOpenSavedStores?: () => void;
  onOpenActivityUtang?: () => void;
  onOpenScanQR?: () => void;
  onOpenRecommendations?: () => void;
  onOpenQuickNote?: () => void;
  isOnline?: boolean;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  lang,
  storeProfile,
  appMode,
  onSwitchMode,
  onOpenSettings,
  onOpenStoreQR,
  onOpenSavedStores,
  onOpenActivityUtang,
  onOpenScanQR,
  onOpenRecommendations,
  onOpenQuickNote,
  isOnline = true,
}) => {
  const { animationLevel, canAnimate, isFadeOnly, isEco } = usePerformance();
  const isFullMotion = animationLevel === 'full' && canAnimate;

  // Prevent background scrolling while open with centralized leak-proof lock
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    // Android Messenger KEYBOARD_TAP light haptic feedback on open
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch {
      // Haptics optional / ignored if unsupported
    }
  }, [isOpen]);

  const isBuyer = appMode === 'buyer';
  const isTl = lang === 'tl';

  // Material 3 Emphasized Decelerate curve
  const m3Ease = [0.32, 0.72, 0, 1] as const;

  // Motion variants for Messenger-style staggered cascade (Full Mode)
  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.035, // 35ms stagger per row
        delayChildren: 0.05,
      },
    },
  };

  const listItemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: m3Ease,
      },
    },
  };

  // Debounce/disable close trigger while drawer is mid-animation (~350ms duration + 30ms buffer)
  const isClosingRef = React.useRef(false);
  const handleSafeClose = React.useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setTimeout(() => {
      isClosingRef.current = false;
    }, 380);
    onClose();
  }, [onClose]);

  // Touch swipe-to-close gesture (Clean native tracking without React 19 DOM prop leaks)
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);
  const touchStartTimeRef = React.useRef<number>(0);

  // Sync theme-color with contrast shield when drawer is open
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) return;
    
    const originalColor = metaThemeColor.getAttribute('content');
    if (isOpen) {
      metaThemeColor.setAttribute('content', '#064e3b'); // Matches deep contrast shield color
    } else if (originalColor) {
      metaThemeColor.setAttribute('content', originalColor);
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches[0]) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && touchStartYRef.current !== null && e.changedTouches[0]) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
      const deltaTime = Math.max(1, Date.now() - touchStartTimeRef.current);
      const velocityX = deltaX / deltaTime; // px/ms

      // Only close if horizontal swipe intent dominates vertical scrolling (|deltaX| > |deltaY| * 1.5)
      const isHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
      if (isHorizontalIntent && (deltaX < -60 || velocityX < -0.4)) {
        handleSafeClose();
      }
      touchStartXRef.current = null;
      touchStartYRef.current = null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        /* Backdrop: Smooth 320ms fade in sync with 1x drawer motion */
        <motion.div
          key="drawer-backdrop"
          data-drawer-element="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.05, 0.7, 0.1, 1.0] }}
          className={`fixed inset-0 z-50 ${
            isFullMotion
              ? 'bg-black/50 backdrop-blur-md'
              : 'bg-black/60'
          } transition-colors cursor-pointer`}
          onClick={handleSafeClose}
          style={{ touchAction: 'none' }}
        />
      )}

      {isOpen && (
        /* Drawer Panel: Android 1x Premium Transition (350ms with Material 3 Emphasized Decelerate) */
        <motion.div
          key="drawer-panel"
          data-drawer-element="true"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{
            duration: 0.35,
            ease: [0.05, 0.7, 0.1, 1.0],
          }}
          className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-xs sm:max-w-sm h-full theme-bg-card border-r theme-border-subtle shadow-2xl flex flex-col justify-between select-none touch-pan-y gpu-layer"
          style={{ willChange: 'transform, opacity' }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header / Profile Info with Centralized Safe Area Clearance */}
          <div className="px-4 sm:px-5 pb-4 pt-4 border-b theme-border-subtle flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-md border shrink-0 ${
                      isBuyer
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400/40'
                        : 'theme-bg-primary text-white border-white/20'
                    }`}
                  >
                    {isBuyer ? <ShoppingBag className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-black theme-text-app truncate">
                      {translate(lang, 'app_title') || 'Tinda'}
                    </h2>
                    <p className="text-xs font-semibold theme-text-accent truncate">
                      {isBuyer
                        ? isTl
                          ? 'Bili at Utang Tracker'
                          : 'Customer & Suki Portal'
                        : storeProfile.storeName || (isTl ? 'Sari-Sari Store & POS' : 'Store POS & Inventory')}
                    </p>
                  </div>
                </div>

                {!isBuyer && (
                  <button
                    type="button"
                    role="button"
                    tabIndex={0}
                    style={{ touchAction: 'manipulation' }}
                    onClick={handleSafeClose}
                    className="p-2 rounded-2xl theme-text-secondary hover:theme-text-app hover:bg-white/10 active:bg-white/15 transition-all cursor-pointer flex items-center justify-center border theme-border-subtle active:scale-95"
                    aria-label="Close Drawer"
                    title={isTl ? 'Isara ang Menu' : 'Close Menu'}
                  >
                    <BurgerIcon isOpen={true} size={18} color="currentColor" />
                  </button>
                )}
              </div>

              {/* Dynamic Mode Badge & Subtitle */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl theme-bg-surface-subtle border theme-border-subtle text-xs">
                <div className="flex items-center gap-1.5 min-w-0 theme-text-secondary">
                  {isBuyer ? (
                    <>
                      <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate font-medium text-[11px] theme-text-app">
                        {isTl ? 'Mamimili / Suki' : 'Customer / Suki'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Store className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate font-medium text-[11px] theme-text-app">
                        {isTl ? 'Tindahan / Bantay (Seller)' : 'Store Owner (Seller)'}
                      </span>
                    </>
                  )}
                </div>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 transition-colors duration-150 ${
                    isBuyer
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                  }`}
                >
                  {isBuyer ? 'BUYER' : 'SELLER'}
                </span>
              </div>
            </div>

            {/* Scrollable Navigation Menu Items:
                - In Full Mode: Staggered entrance cascade (index * 35ms)
                - In Eco Mode: Instant render */}
            <motion.div
              variants={isFullMotion ? listContainerVariants : undefined}
              initial={isFullMotion ? 'hidden' : undefined}
              animate={isFullMotion ? 'visible' : undefined}
              className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-4"
            >


              {/* Menu & Tools Section */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider theme-text-secondary px-1 border-b theme-border-subtle pb-1">
                  {isTl ? 'Menu at Tools' : 'MENU & TOOLS'}
                </div>
                
                {/* Existing Menu Items */}
                <motion.div variants={isFullMotion ? listItemVariants : undefined}>
                  <button
                    type="button"
                    role="button"
                    tabIndex={0}
                    style={{ touchAction: 'manipulation' }}
                    onClick={() => {
                      onClose();
                      onOpenRecommendations?.();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold theme-text-app hover:theme-bg-surface-subtle transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl theme-bg-surface-subtle border theme-border-subtle flex items-center justify-center theme-text-accent">
                        <Lightbulb className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-extrabold text-xs">
                          {isTl ? 'Rekomendasyon' : 'Recommendation'}
                        </div>
                        <div className="text-[10px] theme-text-secondary font-normal">
                          {isTl ? 'Tips para sa iyong tindahan' : 'Store insights & tips'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 theme-text-secondary" />
                  </button>
                </motion.div>

                <motion.div variants={isFullMotion ? listItemVariants : undefined}>
                  <button
                    type="button"
                    role="button"
                    tabIndex={0}
                    style={{ touchAction: 'manipulation' }}
                    onClick={() => {
                      onClose();
                      onOpenSettings('GENERAL');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold theme-text-app hover:theme-bg-surface-subtle transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl theme-bg-surface-subtle border theme-border-subtle flex items-center justify-center theme-text-accent">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-extrabold text-xs">Settings</div>
                        <div className="text-[10px] theme-text-secondary font-normal">
                          Themes, Language & Preferences
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 theme-text-secondary" />
                  </button>
                </motion.div>
              </div>

              {/* SELLER MODE ITEMS */}
              {!isBuyer && (
                <motion.div variants={isFullMotion ? listItemVariants : undefined}>
                  {/* Backup & Data */}
                  <button
                    type="button"
                    role="button"
                    tabIndex={0}
                    style={{ touchAction: 'manipulation' }}
                    onClick={() => {
                      onClose();
                      onOpenSettings('DATA');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold theme-text-app hover:theme-bg-surface-subtle transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-extrabold text-xs">
                          {isTl ? 'Backup at Data' : 'Backup & Data'}
                        </div>
                        <div className="text-[10px] theme-text-secondary font-normal">
                          Export, Import & Reset
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 theme-text-secondary" />
                  </button>
                </motion.div>
              )}

              {/* BUYER MODE ITEMS */}
              {isBuyer && (
                <>
                  {/* Saved Suki Stores */}
                  <motion.div variants={isFullMotion ? listItemVariants : undefined}>
                    <button
                      type="button"
                      role="button"
                      tabIndex={0}
                      style={{ touchAction: 'manipulation' }}
                      onClick={() => {
                        onClose();
                        onOpenSavedStores?.();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold theme-text-app hover:theme-bg-surface-subtle transition-all cursor-pointer active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-extrabold text-xs">
                            {isTl ? 'Mga Suki Stores' : 'Saved Suki Stores'}
                          </div>
                          <div className="text-[10px] theme-text-secondary font-normal">
                            View bookmarked store catalogs
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 theme-text-secondary" />
                    </button>
                  </motion.div>

                  {/* My Activity & Utang */}
                  <motion.div variants={isFullMotion ? listItemVariants : undefined}>
                    <button
                      type="button"
                      role="button"
                      tabIndex={0}
                      style={{ touchAction: 'manipulation' }}
                      onClick={() => {
                        onClose();
                        onOpenActivityUtang?.();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold theme-text-app hover:theme-bg-surface-subtle transition-all cursor-pointer active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-extrabold text-xs">
                            {isTl ? 'Aking Talaan at Utang' : 'My Activity & Utang'}
                          </div>
                          <div className="text-[10px] theme-text-secondary font-normal">
                            View receipts & active debt ledger
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 theme-text-secondary" />
                    </button>
                  </motion.div>
                </>
              )}

              {/* About & Developer Profile */}
              <motion.div variants={isFullMotion ? listItemVariants : undefined}>
                <button
                  type="button"
                  role="button"
                  tabIndex={0}
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => {
                    onClose();
                    onOpenSettings('ABOUT');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold theme-text-app hover:theme-bg-surface-subtle transition-all cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-extrabold text-xs">
                        {isTl ? 'Tungkol at Gumawa' : 'About & Developer'}
                      </div>
                      <div className="text-[10px] theme-text-secondary font-normal">
                        Credits, Version & Support
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 theme-text-secondary" />
                </button>
              </motion.div>

              <div className="pt-2 pb-1">
                <div className="h-px w-full theme-border-subtle border-t" />
              </div>

              {/* DEDICATED APP MODE SELECTOR IN MENU: SELLER & BUYER ONLY */}
              <motion.div variants={isFullMotion ? listItemVariants : undefined} className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider theme-text-secondary px-1 flex items-center justify-between">
                  <span>{isTl ? 'Mode ng Tindahan' : 'STORE ACCESS MODE'}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isBuyer ? 'text-emerald-400 bg-emerald-500/10' : 'text-sky-400 bg-sky-500/10'}`}>
                    {isBuyer ? (isTl ? 'Mamimili' : 'Buyer Active') : (isTl ? 'Tindahan' : 'Seller Active')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl theme-bg-surface-subtle border theme-border-subtle">
                  {/* Seller Mode Option */}
                  <button
                    type="button"
                    onClick={() => {
                      if (appMode !== 'seller') {
                        onSwitchMode('seller');
                        onClose();
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      appMode === 'seller'
                        ? 'theme-bg-primary text-white shadow-xs border border-white/20'
                        : 'theme-text-secondary hover:theme-text-app hover:bg-white/5'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    <span>{isTl ? 'Seller Mode' : 'Seller Mode'}</span>
                    <span className="text-[9px] opacity-75 font-normal">
                      {isTl ? 'Tindahan / POS' : 'Store / POS'}
                    </span>
                  </button>

                  {/* Buyer Mode Option */}
                  <button
                    type="button"
                    onClick={() => {
                      if (appMode !== 'buyer') {
                        onSwitchMode('buyer');
                        onClose();
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      appMode === 'buyer'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs border border-emerald-400/40 font-black'
                        : 'theme-text-secondary hover:theme-text-app hover:bg-white/5'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{isTl ? 'Buyer Mode' : 'Buyer Mode'}</span>
                    <span className="text-[9px] opacity-75 font-normal">
                      {isTl ? 'Mamimili / Suki' : 'Customer / Suki'}
                    </span>
                  </button>
                </div>
              </motion.div>
            </motion.div>

            {/* Footer: Version and Sync / Pending / Offline Status Indicator with Centralized Safe Area Clearance */}
            <div className="px-4 pt-3.5 safe-pb-nav border-t theme-border-subtle bg-black/10 flex items-center justify-between text-[11px] theme-text-secondary">
              <span className="font-medium">Tinda • v1.0.0</span>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                  isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400'
                }`}
                title={isOnline ? 'Online - Nakatabi at naka-sync ang data' : 'Offline - Lokal na ligtas na nakatabi'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span>
                  {isOnline
                    ? isTl
                      ? 'Naka-Sync'
                      : 'Synced'
                    : isTl
                    ? 'Offline'
                    : 'Offline'}
                </span>
              </div>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
};
