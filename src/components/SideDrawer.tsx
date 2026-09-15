import React, { useEffect } from 'react';
import {
  X,
  Settings,
  Database,
  ShoppingBag,
  Store,
  ChevronRight,
  ShieldCheck,
  Receipt,
  User,
} from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';
import type { StoreProfile } from '../utils/storeSettings';

export interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  storeProfile: StoreProfile;
  appMode: 'seller' | 'buyer';
  onSwitchMode: (mode: 'seller' | 'buyer') => void;
  onOpenSettings: (tab?: 'GENERAL' | 'STORE' | 'DATA' | 'HELP' | 'ABOUT') => void;
  onOpenStoreQR: () => void;
  onStartTutorial?: () => void;
  onOpenSavedStores?: () => void;
  onOpenActivityUtang?: () => void;
  onOpenScanQR?: () => void;
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
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscroll || '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isBuyer = appMode === 'buyer';
  const isTl = lang === 'tl';

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-150 cursor-pointer"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />

      {/* Drawer Panel */}
      <div
        className="relative w-[85%] max-w-xs sm:max-w-sm h-full theme-bg-card border-r theme-border-subtle shadow-2xl flex flex-col justify-between z-10 animate-in  duration-200 ease-out select-none"
        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header / Profile Info with in-place dynamic morphing */}
        <div className="px-4 sm:px-5 pb-4 pt-[max(1.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] border-b theme-border-subtle flex flex-col gap-3 transition-opacity duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl theme-bg-primary text-white flex items-center justify-center font-black shadow-md border border-white/20 shrink-0">
                {isBuyer ? <ShoppingBag className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black theme-text-app truncate">
                  {translate(lang, 'app_title') || 'Tinda'}
                </h2>
                <p className="text-xs font-semibold theme-text-accent truncate">
                  {isBuyer
                    ? (isTl ? 'Bili at Utang Tracker' : 'Customer & Suki Portal')
                    : (storeProfile.storeName || 'Sari-Sari Store Note & POS')}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="button"
              tabIndex={0}
              style={{ touchAction: 'manipulation' }}
              onClick={onClose}
              className="p-1.5 rounded-full theme-text-secondary hover:theme-text-app hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dynamic Mode Badge & Subtitle */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl theme-bg-surface-subtle border theme-border-subtle text-xs transition-opacity duration-150">
            <div className="flex items-center gap-1.5 min-w-0 theme-text-secondary">
              {isBuyer ? (
                <>
                  <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate font-medium text-[11px] theme-text-app">
                    Customer / Suki
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate font-medium text-[11px] theme-text-app">
                    {storeProfile.ownerName ? `Owner: ${storeProfile.ownerName}` : 'Owner: Tindero/a'}
                  </span>
                </>
              )}
            </div>
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 transition-colors duration-150 ${
                isBuyer
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}
            >
              {isBuyer ? 'BUYER' : 'SELLER'}
            </span>
          </div>
        </div>

        {/* Scrollable Navigation Menu Items with in-place morphing */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 transition-opacity duration-150">
          <div className="text-[10px] font-black uppercase tracking-wider theme-text-secondary px-3 py-1">
            {isTl ? 'Pangunahing Menu' : 'MENU & TOOLS'}
          </div>

          {/* 1. Settings (Common to both modes) */}
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

          {/* SELLER MODE ITEMS */}
          {!isBuyer && (
            <>
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
            </>
          )}

          {/* BUYER MODE ITEMS */}
          {isBuyer && (
            <>
              {/* Saved Suki Stores */}
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

              {/* My Activity & Utang */}
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
            </>
          )}

          <div className="pt-2 pb-1">
            <div className="h-px w-full theme-border-subtle border-t" />
          </div>

          {/* DEDICATED APP MODE SELECTOR IN MENU */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider theme-text-secondary px-1">
              {isTl ? 'Mode ng App' : 'APP MODE'}
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl theme-bg-surface-subtle border theme-border-subtle">
              <button
                type="button"
                onClick={() => {
                  if (isBuyer) onSwitchMode('seller');
                }}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                  !isBuyer
                    ? 'theme-bg-primary text-white shadow-xs border border-white/20'
                    : 'theme-text-secondary hover:theme-text-app hover:bg-white/5'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>{isTl ? 'Seller Mode' : 'Seller Mode'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!isBuyer) onSwitchMode('buyer');
                }}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                  isBuyer
                    ? 'theme-bg-primary text-white shadow-xs border border-white/20'
                    : 'theme-text-secondary hover:theme-text-app hover:bg-white/5'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isTl ? 'Buyer Mode' : 'Buyer Mode'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Clean Tinda • v1.0.0 (Status indicator completely removed) */}
        <div className="p-4 border-t theme-border-subtle bg-black/10 flex items-center justify-between text-[11px] theme-text-secondary">
          <span className="font-medium">Tinda • v1.0.0</span>
        </div>
      </div>
    </div>
  );
};
