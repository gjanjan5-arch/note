import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
 X,
 Languages,
 Store,
 Database,
 HelpCircle,
 Info,
 Check,
 Trash2,
 Play,
 RotateCcw,
 Palette,
 Moon,
 Sun,
 Layers,
} from 'lucide-react';
import {
 AVAILABLE_LANGUAGES,
 getInstalledLanguages,
 saveInstalledLanguages,
 setActiveLanguageStorage,
 translate,
 type LanguageCode,
} from '../utils/i18n';
import {
 getStoreProfile,
 saveStoreProfile,
 type StoreProfile,
} from '../utils/storeSettings';
import {
 PALETTES,
 APPEARANCE_MODES,
 type ThemePalette,
 type AppearanceMode,
} from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { DataManagementSection } from './settings/DataManagementSection';
import { DeveloperProfileModal } from './DeveloperProfileModal';
import { ModalPortal } from './ModalPortal';

interface SettingsModalProps {
 isOpen: boolean;
 onClose: () => void;
 lang: LanguageCode;
 appMode?: 'seller' | 'buyer';
 onSwitchMode?: (mode: 'seller' | 'buyer') => void;
 onLanguageChange: (newLang: LanguageCode) => void;
 onStartTutorial: () => void;
 onDataChanged: () => void;
 onOpenStoreQR?: () => void;
 initialTab?: 'GENERAL' | 'STORE' | 'DATA' | 'HELP' | 'ABOUT';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
 isOpen,
 onClose,
 lang,
 appMode = 'seller',
 onSwitchMode,
 onLanguageChange,
 onStartTutorial,
 onDataChanged,
 onOpenStoreQR,
 initialTab = 'GENERAL',
}) => {
 const [activeTab, setActiveTab] = useState<'GENERAL' | 'STORE' | 'DATA' | 'HELP' | 'ABOUT'>(initialTab);
 const [isDeveloperModalOpen, setIsDeveloperModalOpen] = useState(false);

 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const [canScrollLeft, setCanScrollLeft] = useState(false);
 const [canScrollRight, setCanScrollRight] = useState(false);

 const checkScroll = useCallback(() => {
  if (scrollContainerRef.current) {
   const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
   setCanScrollLeft(scrollLeft > 0);
   setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
  }
 }, []);

 useEffect(() => {
  if (isOpen) {
   const timer = setTimeout(checkScroll, 50);
   window.addEventListener('resize', checkScroll);
   return () => {
    clearTimeout(timer);
    window.removeEventListener('resize', checkScroll);
   };
  }
 }, [isOpen, checkScroll, activeTab]);

 // Synchronize activeTab when initialTab changes from external controllers (e.g. Guided Tutorial)
 useEffect(() => {
  if (isOpen && initialTab) {
   setActiveTab(initialTab);
  }
 }, [isOpen, initialTab]);


 const { palette: currentPalette, appearanceMode: currentMode, setPalette, setAppearanceMode } = useTheme();
 const [installedLangs, setInstalledLangs] = useState<LanguageCode[]>(getInstalledLanguages());
 const [storeProfile, setStoreProfile] = useState<StoreProfile>(getStoreProfile());
 const [storeSaveSuccess, setStoreSaveSuccess] = useState(false);

 if (!isOpen) return null;

 const handlePaletteSelect = (paletteId: ThemePalette) => {
  setPalette(paletteId);
 };

 const handleModeSelect = (modeId: AppearanceMode) => {
  setAppearanceMode(modeId);
 };

 const handleInstallLang = (code: LanguageCode) => {
  const updated = Array.from(new Set([...installedLangs, code]));
  setInstalledLangs(updated);
  saveInstalledLanguages(updated);
 };

 const handleRemoveLang = (code: LanguageCode) => {
  if (code === 'en') return; // Cannot remove default English
  const updated = installedLangs.filter((c) => c !== code);
  setInstalledLangs(updated);
  saveInstalledLanguages(updated);

  if (lang === code) {
   onLanguageChange('en');
   setActiveLanguageStorage('en');
  }
 };

 const handleActivateLang = (code: LanguageCode) => {
  onLanguageChange(code);
  setActiveLanguageStorage(code);
 };

 const handleSaveStoreProfile = (e: React.FormEvent) => {
  e.preventDefault();
  saveStoreProfile(storeProfile);
  setStoreSaveSuccess(true);
  setTimeout(() => setStoreSaveSuccess(false), 3000);
 };

 return (
  <div 
   className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
   onClick={onClose}
  >
   <div 
    className="theme-card max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden rounded-3xl"
    onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
   >
    {/* Header */}
    <div className="theme-bg-header text-white px-5 py-4 flex items-center justify-between border-b theme-border-subtle shrink-0">
     <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center border border-white/15 shadow-2xs">
       <Store className="w-5 h-5" />
      </div>
      <div>
       <h3 className="font-black text-lg tracking-tight leading-tight">{translate(lang, 'settings_title')}</h3>
       <p className="text-xs text-white/80 font-medium">Sari-Sari Store Notebook & Pautang Ledger</p>
      </div>
     </div>
     <button
      type="button"
      onClick={onClose}
      aria-label={translate(lang, 'btn_close')}
      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
     >
      <X className="w-5 h-5" />
     </button>
    </div>

    {/* Top Scrollable Tab Navigation */}
    <div className="theme-bg-surface-subtle border-b theme-border-subtle shrink-0 relative">
     <div
      ref={scrollContainerRef}
      onScroll={checkScroll}
      className="flex items-center gap-1.5 p-2 overflow-x-auto no-scrollbar relative"
      style={{
       maskImage: canScrollLeft && canScrollRight
        ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)'
        : canScrollLeft
        ? 'linear-gradient(to right, transparent, black 16px)'
        : canScrollRight
        ? 'linear-gradient(to left, transparent, black 16px)'
        : 'none',
       WebkitMaskImage: canScrollLeft && canScrollRight
        ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)'
        : canScrollLeft
        ? 'linear-gradient(to right, transparent, black 16px)'
        : canScrollRight
        ? 'linear-gradient(to left, transparent, black 16px)'
        : 'none'
      }}
     >
      <button
       type="button"
       onClick={() => setActiveTab('GENERAL')}
       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap cursor-pointer touch-manipulation active:scale-95 ${
        activeTab === 'GENERAL'
         ? 'theme-bg-primary text-white shadow-2xs font-extrabold'
         : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
       }`}
      >
       <Languages className="w-3.5 h-3.5" />
       <span>{translate(lang, 'section_general')}</span>
      </button>

      <button
       type="button"
       onClick={() => setActiveTab('STORE')}
       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap cursor-pointer touch-manipulation active:scale-95 ${
        activeTab === 'STORE'
         ? 'theme-bg-primary text-white shadow-2xs font-extrabold'
         : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
       }`}
      >
       <Store className="w-3.5 h-3.5" />
       <span>{translate(lang, 'section_store')}</span>
      </button>

      <button
       type="button"
       onClick={() => setActiveTab('DATA')}
       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap cursor-pointer touch-manipulation active:scale-95 ${
        activeTab === 'DATA'
         ? 'theme-bg-primary text-white shadow-2xs font-extrabold'
         : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
       }`}
      >
       <Database className="w-3.5 h-3.5" />
       <span>{translate(lang, 'section_data')}</span>
      </button>

      <button
       type="button"
       onClick={() => setActiveTab('HELP')}
       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap cursor-pointer touch-manipulation active:scale-95 ${
        activeTab === 'HELP'
         ? 'theme-bg-primary text-white shadow-2xs font-extrabold'
         : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
       }`}
      >
       <HelpCircle className="w-3.5 h-3.5" />
       <span>{translate(lang, 'section_help')}</span>
      </button>

      <button
       type="button"
       onClick={() => setActiveTab('ABOUT')}
       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap cursor-pointer touch-manipulation active:scale-95 ${
        activeTab === 'ABOUT'
         ? 'theme-bg-primary text-white shadow-2xs font-extrabold'
         : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
       }`}
      >
       <Info className="w-3.5 h-3.5" />
       <span>{translate(lang, 'section_about')}</span>
      </button>
     </div>
    </div>

    {/* Tab Content Body */}
    <div className="p-4 overflow-y-auto no-scrollbar flex-1 text-xs sm:text-sm space-y-4">
     {/* TAB 1: GENERAL & THEMES */}
     {activeTab === 'GENERAL' && (
      <div className="space-y-4">
       {/* 1. Theme Color Palette Section */}
       <div id="settings-theme-section" className="space-y-2.5">
        <div>
         <h4 className="font-extrabold theme-text-app text-sm flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-[var(--color-primary)]" />
          <span>Material You Palette</span>
         </h4>
         <p className="text-xs theme-text-secondary mt-0.5">
          Dynamic color schemes inspired by Material 3 design.
         </p>
        </div>

        {/* 4 Theme Badges in 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2.5">
         {PALETTES.map((pal) => {
          const isSelected = currentPalette === pal.id;
          return (
           <button
            key={pal.id}
            type="button"
            onClick={() => handlePaletteSelect(pal.id)}
            className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation flex items-center justify-between gap-2.5 ${
             isSelected
              ? 'theme-bg-surface-subtle border-2 theme-border shadow-xs'
              : 'theme-card border theme-border-subtle hover:theme-bg-surface-subtle'
            }`}
           >
            <div className="flex items-center gap-3">
             <span
              className="w-5 h-5 rounded-full border border-black/10 shadow-2xs shrink-0"
              style={{ backgroundColor: pal.previewColor }}
             />
             <div>
              <div className="text-xs font-black theme-text-app leading-tight truncate">{pal.name}</div>
              <div className="text-[10px] theme-text-secondary font-medium mt-0.5">
               {pal.subtitle}
              </div>
             </div>
            </div>
            {isSelected && (
             <div className="w-5 h-5 rounded-full theme-bg-primary text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Check className="w-3 h-3 stroke-[3]" />
             </div>
            )}
           </button>
          );
         })}
        </div>
       </div>

       {/* 2. Appearance Mode Section */}
       <div id="settings-appearance-section" className="space-y-2.5 pt-2 border-t theme-border-subtle">
        <div>
         <h4 className="font-extrabold theme-text-app text-sm flex items-center gap-1.5">
          <Moon className="w-4 h-4 text-[var(--color-primary)]" />
          <span>Appearance Mode</span>
         </h4>
         <p className="text-xs theme-text-secondary mt-0.5">
          Choose between Dark, Light, or battery-saving AMOLED black.
         </p>
        </div>

        {/* 3 Options in One Horizontal Row */}
        <div className="grid grid-cols-3 gap-2">
         {APPEARANCE_MODES.map((mode) => {
          const isSelected = currentMode === mode.id;
          const ModeIcon =
           mode.id === 'dark' ? Moon : mode.id === 'light' ? Sun : Layers;

          return (
           <button
            key={mode.id}
            type="button"
            onClick={() => handleModeSelect(mode.id)}
            className={`py-3 px-2 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation ${
             isSelected
              ? 'theme-bg-primary text-white border-2 shadow-xs font-black'
              : 'theme-card theme-text-secondary border theme-border-subtle hover:theme-bg-surface-subtle hover:theme-text-app'
            }`}
           >
            <ModeIcon className={`w-4 h-4 ${isSelected ? 'text-white' : 'theme-text-secondary'}`} />
            <span className="text-xs font-bold">{mode.name}</span>
           </button>
          );
         })}
        </div>
       </div>

       {/* 3. Language Management Section */}
       <div id="settings-lang-section" className="space-y-3 pt-3 border-t theme-border-subtle">
        <div>
         <h4 className="font-extrabold theme-text-app text-sm flex items-center gap-1.5">
          <Languages className="w-4 h-4 text-[var(--color-primary)]" />
          <span>{translate(lang, 'lang_manage')}</span>
         </h4>
         <p className="text-xs theme-text-secondary mt-0.5">
          English is default and active offline. Install optional language packs for Tagalog, Japanese, Chinese, and Korean.
         </p>
        </div>

        <div className="space-y-2">
         {AVAILABLE_LANGUAGES.map((pkg) => {
          const isInstalled = installedLangs.includes(pkg.code);
          const isActive = lang === pkg.code;

          return (
           <div
            key={pkg.code}
            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
             isActive
              ? 'theme-bg-surface-subtle border-2 theme-border shadow-2xs'
              : 'theme-card border theme-border-subtle hover:theme-bg-surface-subtle'
            }`}
           >
            <div className="flex items-center gap-2.5">
             <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-[11px] ${
               isActive ? 'theme-bg-primary text-white' : 'theme-bg-surface-subtle theme-text-secondary'
              }`}
             >
              {pkg.code.toUpperCase()}
             </div>
             <div>
              <div className="flex items-center gap-1.5">
               <span className="font-black theme-text-app text-xs sm:text-sm">{pkg.name}</span>
               <span className="text-[11px] theme-text-secondary font-medium">({pkg.nativeName})</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
               {isActive ? (
                <span className="text-[10px] font-extrabold theme-badge px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                 <Check className="w-3 h-3" /> {translate(lang, 'lang_active')}
                </span>
               ) : isInstalled ? (
                <span className="text-[10px] font-bold theme-text-secondary theme-bg-surface-subtle px-2 py-0.5 rounded-full">
                 {translate(lang, 'lang_installed')}
                </span>
               ) : (
                <span className="text-[10px] font-medium theme-text-secondary">
                 {translate(lang, 'lang_not_installed')}
                </span>
               )}
              </div>
             </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
             {isInstalled ? (
              <>
               {!isActive && (
                <button
                 type="button"
                 onClick={() => handleActivateLang(pkg.code)}
                 className="theme-bg-primary hover:opacity-90 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation"
                >
                 {translate(lang, 'btn_activate')}
                </button>
               )}
               {pkg.code !== 'en' && (
                <button
                 type="button"
                 onClick={() => handleRemoveLang(pkg.code)}
                 className="theme-text-secondary hover:text-red-500 font-bold text-xs p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer"
                 title="Remove pack"
                >
                 <Trash2 className="w-3.5 h-3.5" />
                </button>
               )}
              </>
             ) : (
              <button
               type="button"
               onClick={() => handleInstallLang(pkg.code)}
               className="theme-bg-surface-subtle hover:theme-card theme-text-app font-extrabold text-xs px-3 py-1.5 rounded-xl border theme-border-subtle shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation"
              >
               {translate(lang, 'btn_install')}
              </button>
             )}
            </div>
           </div>
          );
         })}
        </div>

        {lang !== 'en' && (
         <div className="pt-1">
          <button
           type="button"
           onClick={() => handleActivateLang('en')}
           className="flex items-center gap-1.5 text-xs font-bold theme-text-accent theme-bg-surface-subtle hover:theme-card px-3 py-2 rounded-xl border theme-border-subtle cursor-pointer active:scale-95 touch-manipulation"
          >
           <RotateCcw className="w-3.5 h-3.5" />
           <span>{translate(lang, 'btn_reset_english')}</span>
          </button>
         </div>
        )}
       </div>
      </div>
     )}

     {/* TAB 2: STORE INFORMATION */}
     {activeTab === 'STORE' && (
      <form onSubmit={handleSaveStoreProfile} className="space-y-3.5">
       <div>
        <h4 className="font-extrabold theme-text-app text-sm mb-1">{translate(lang, 'section_store')}</h4>
        <p className="text-xs theme-text-secondary">
         Custom details used in reminder messages and receipts.
        </p>
       </div>

       <div>
        <label className="block font-bold theme-text-app mb-1">{translate(lang, 'store_name_label')}</label>
        <input
         type="text"
         required
         value={storeProfile.storeName}
         onChange={(e) => setStoreProfile({ ...storeProfile, storeName: e.target.value })}
         placeholder="E.g. Tindahan ni Aling Nena"
         className="w-full theme-input border rounded-xl p-2.5 font-bold theme-text-app focus:outline-none"
        />
       </div>

       <div>
        <label className="block font-bold theme-text-app mb-1">{translate(lang, 'owner_name_label')}</label>
        <input
         type="text"
         value={storeProfile.ownerName}
         onChange={(e) => setStoreProfile({ ...storeProfile, ownerName: e.target.value })}
         placeholder="E.g. Maria Santos"
         className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
        />
       </div>

       <div>
        <label className="block font-bold theme-text-app mb-1">{translate(lang, 'store_contact_label')}</label>
        <input
         type="tel"
         inputMode="numeric"
         maxLength={11}
         value={storeProfile.contactNumber}
         onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, '').slice(0, 11);
          setStoreProfile({ ...storeProfile, contactNumber: clean });
         }}
         placeholder="09171234567"
         className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
        />
        <span className="text-[11px] theme-text-muted mt-0.5 block">
         {lang === 'tl' ? 'Numero lamang, hanggang 11 digits (hal. 09171234567)' : 'Numbers only, max 11 digits (e.g. 09171234567)'}
        </span>
       </div>

       <div>
        <label className="block font-bold theme-text-app mb-1">
         {lang === 'tl' ? 'Tirahan / Lokasyon ng Tindahan' : 'Store Address / Location'}
        </label>
        <input
         type="text"
         value={storeProfile.storeAddress || ''}
         onChange={(e) => setStoreProfile({ ...storeProfile, storeAddress: e.target.value })}
         placeholder={lang === 'tl' ? 'Hal. Purok 2, Brgy. Poblacion, Quezon City' : 'E.g. Main St., Brgy. San Jose'}
         className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
        />
       </div>

       <div>
        <label className="block font-bold theme-text-app mb-1">
         {lang === 'tl' ? 'GCash Number / Payment Details' : 'GCash Number / Payment Details'}
        </label>
        <input
         type="tel"
         inputMode="numeric"
         maxLength={11}
         value={storeProfile.gcashNumber || ''}
         onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, '').slice(0, 11);
          setStoreProfile({ ...storeProfile, gcashNumber: clean });
         }}
         placeholder="09171234567"
         className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
        />
        <span className="text-[11px] theme-text-muted mt-0.5 block">
         {lang === 'tl' ? 'Numero lamang, hanggang 11 digits (hal. 09171234567)' : 'Numbers only, max 11 digits (e.g. 09171234567)'}
        </span>
       </div>

       <div>
        <div className="flex items-center justify-between mb-1">
         <label className="block font-bold theme-text-app">
          {lang === 'tl' ? 'Pangungumusta sa Resibo' : 'Receipt Greeting'}
         </label>
         <span className="text-[10px] font-semibold theme-text-muted">
          {lang === 'tl' ? 'Opsyonal' : 'Optional'}
         </span>
        </div>
        <textarea
         rows={2}
         value={storeProfile.purchaseMessage || ''}
         onChange={(e) => setStoreProfile({ ...storeProfile, purchaseMessage: e.target.value })}
         placeholder={
          lang === 'tl'
           ? 'E.g. Salamat sa pagbili! Balik-balik po kayo.'
           : 'E.g. Thank you for shopping with us! Come again.'
         }
         className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none resize-none text-xs sm:text-sm"
        />
        <span className="text-[11px] theme-text-muted mt-0.5 block">
         {lang === 'tl'
          ? 'Ang pangungumustang ito ay lilitaw sa bawat resibo.'
          : 'This greeting will appear at the bottom of every receipt.'}
        </span>
       </div>

       {storeSaveSuccess && (
        <div className="theme-bg-surface-subtle border theme-border-subtle theme-text-accent font-bold text-xs p-2.5 rounded-xl flex items-center gap-2">
         <Check className="w-4 h-4" />
         <span>{translate(lang, 'store_info_saved')}</span>
        </div>
       )}

       <div className="pt-2">
        <button
         type="submit"
         className="theme-bg-primary hover:opacity-90 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-2xs active:scale-95 cursor-pointer touch-manipulation"
        >
         {translate(lang, 'btn_save_store_info')}
        </button>
       </div>
      </form>
     )}

     {/* TAB 3: DATA MANAGEMENT (Isolated Sub-Component) */}
     {activeTab === 'DATA' && (
      <DataManagementSection
       lang={lang}
       onDataChanged={onDataChanged}
       onOpenStoreQR={onOpenStoreQR}
      />
     )}

     {/* TAB 4: HELP & TUTORIALS */}
     {activeTab === 'HELP' && (
      <div className="space-y-4">
       <div>
        <h4 className="font-extrabold theme-text-app text-sm mb-1">{translate(lang, 'section_help')}</h4>
        <p className="text-xs theme-text-secondary">
         Learn how to use Mabilisang Tala, track credit, and navigate features.
        </p>
       </div>

       {/* Start Tutorial Again */}
       <div className="theme-bg-surface-subtle border theme-border-subtle p-4 rounded-2xl space-y-2">
        <div className="flex items-center gap-2">
         <Play className="w-5 h-5 theme-text-accent fill-current" />
         <h5 className="font-black theme-text-app text-sm">{translate(lang, 'start_tutorial_again')}</h5>
        </div>
        <p className="text-xs theme-text-secondary leading-relaxed font-medium">
         {translate(lang, 'tutorial_desc')}
        </p>
        <button
         type="button"
         onClick={() => {
          onClose();
          onStartTutorial();
         }}
         className="theme-bg-primary hover:opacity-90 text-white font-extrabold text-xs px-4 py-2 rounded-xl mt-1 shadow-2xs active:scale-95 cursor-pointer touch-manipulation"
        >
         Start Walkthrough
        </button>
       </div>

       {/* How Mabilisang Tala Works */}
       <div className="theme-card border theme-border-subtle p-4 rounded-2xl space-y-2">
        <h5 className="font-black theme-text-app text-sm">{translate(lang, 'how_mabilisang_tala_works')}</h5>
        <p className="text-xs theme-text-secondary leading-relaxed">
         {translate(lang, 'how_mabilisang_tala_desc')}
        </p>
        <div className="space-y-1 text-xs theme-text-app theme-bg-surface-subtle p-2.5 rounded-xl border theme-border-subtle font-mono">
         <div>• <code>Need to buy 5 sacks of rice at market</code></div>
         <div>• <code>Supplier delivery scheduled Friday 2PM</code></div>
         <div>• <code>Juan promised to pay pautang tomorrow</code></div>
        </div>
       </div>
      </div>
     )}

     {/* TAB 5: ABOUT */}
     {activeTab === 'ABOUT' && (
      <div className="space-y-4">
       <div className="text-center py-4 theme-bg-header text-white rounded-2xl p-4 border theme-border-subtle">
        <Store className="w-10 h-10 text-white mx-auto mb-2 opacity-90" />
        <h4 className="font-black text-lg text-white">{translate(lang, 'app_title')}</h4>
        <p className="text-xs theme-text-accent mt-0.5">{translate(lang, 'about_version')}</p>
       </div>

       <div className="theme-card border theme-border-subtle p-4 rounded-2xl text-xs theme-text-secondary leading-relaxed font-medium">
        {translate(lang, 'about_desc')}
       </div>

       <button
        onClick={() => setIsDeveloperModalOpen(true)}
        className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md transition-all active:scale-95"
       >
        <span className="text-sm">👨‍💻</span>
        <span>{translate(lang, 'dev_modal_title')}</span>
       </button>
      </div>
     )}
    </div>
   </div>
   <DeveloperProfileModal 
    isOpen={isDeveloperModalOpen} 
    onClose={() => setIsDeveloperModalOpen(false)} 
    lang={lang} 
   />
  </div>
 );
};
