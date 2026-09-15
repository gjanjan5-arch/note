import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import {
  Notebook,
  CreditCard,
  Package,
  TrendingUp,
  Bot,
} from 'lucide-react';
import { db, initializeDatabase } from './db/db';
import { Header } from './components/Header';
import { TransactionLedger } from './components/TransactionLedger';
import { PautangLedger } from './components/PautangLedger';
import { InventoryManager } from './components/InventoryManager';
import { StoreAnalytics } from './components/StoreAnalytics';
import { SukiChatbot } from './components/SukiChatbot';
import { SettingsModal } from './components/SettingsModal';
import { GuidedTutorial } from './components/GuidedTutorial';
import { PullToRefresh } from './components/PullToRefresh';
import { QuickNoteFab } from './components/QuickNoteFab';
import { QuickNoteComposer } from './components/QuickNoteComposer';
import { ExpiringNoteBanner } from './components/ExpiringNoteBanner';
import { ScannerModal } from './components/ScannerModal';
import { PalengkeChecklistModal } from './components/PalengkeChecklistModal';
import { VoiceLogModal } from './components/VoiceLogModal';
import { DailyRemitModal } from './components/DailyRemitModal';
import { StoreQRModal } from './components/StoreQRModal';
import { BuyerOrderModal, type BuyerOrderPayload } from './components/BuyerOrderModal';
import { BuyerMode } from './components/BuyerMode';
import { ModeSelectionScreen } from './components/ModeSelectionScreen';
import { SideDrawer } from './components/SideDrawer';
import { GlobalSearch } from './components/GlobalSearch';
import { MyActivityUtangModal } from './components/MyActivityUtangModal';
import {
  getActiveLanguage,
  setActiveLanguageStorage,
  translate,
  type LanguageCode,
} from './utils/i18n';
import {
  getStoreProfile,
  isTutorialCompleted,
  type StoreProfile,
} from './utils/storeSettings';
import type { CatalogPayload } from "./types";
import { triggerAutoBackupIfEnabled } from './utils/backupManager';
import { ThemeProvider } from './context/ThemeContext';
import { safeStorage } from './utils/safeStorage';

const TAB_ORDER = ['LISTA', 'PAUTANG', 'PANINDA', 'ANALYTICS', 'SUKI_AI'] as const;
type TabId = (typeof TAB_ORDER)[number];

const MODE_SELECTION_KEY = 'tindahan_mode_selected';

const tabTransitionVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 16 : dir < 0 ? -16 : 0,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.18,
      ease: 'easeOut' as const,
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -16 : dir < 0 ? 16 : 0,
    opacity: 0,
    transition: {
      duration: 0.14,
      ease: 'easeIn' as const,
    },
  }),
};

function AppContent() {
  const [hasSelectedMode, setHasSelectedMode] = useState<boolean>(() => {
    return safeStorage.getItem(MODE_SELECTION_KEY) === 'true';
  });
  const [appMode, setAppMode] = useState<'seller' | 'buyer'>(() => {
    return (safeStorage.getItem('appMode') as 'seller' | 'buyer') || 'seller';
  });
  const [isStoreQROpen, setIsStoreQROpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [scannedOrderPayload, setScannedOrderPayload] = useState<BuyerOrderPayload | null>(null);

  const handleInitialModeSelect = (mode: 'seller' | 'buyer') => {
    setAppMode(mode);
    setHasSelectedMode(true);
    safeStorage.setItem('appMode', mode);
    safeStorage.setItem(MODE_SELECTION_KEY, 'true');
  };

  const handleSwitchMode = (mode: 'seller' | 'buyer') => {
    setAppMode(mode);
    safeStorage.setItem('appMode', mode);
    safeStorage.setItem(MODE_SELECTION_KEY, 'true');
  };

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    };
    window.addEventListener('focus', handleFocus, true);
    return () => window.removeEventListener('focus', handleFocus, true);
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>('LISTA');
  const [direction, setDirection] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && 'onLine' in navigator ? Boolean(navigator.onLine) : true
  );
  const [lang, setLang] = useState<LanguageCode>(() => getActiveLanguage());
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(() => getStoreProfile());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'GENERAL' | 'STORE' | 'DATA' | 'HELP' | 'ABOUT'>('GENERAL');
  const [isTutorialOpen, setIsTutorialOpen] = useState(() => !isTutorialCompleted());
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPalengkeOpen, setIsPalengkeOpen] = useState(false);
  const [isVoiceLogOpen, setIsVoiceLogOpen] = useState(false);
  const [isDailyRemitOpen, setIsDailyRemitOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inventoryPrefill, setInventoryPrefill] = useState<{ name?: string; sku?: string } | null>(null);

  // Added Saved Stores state to supply global search
  const [savedStores, setSavedStores] = useState<CatalogPayload[]>([]);
  const [isActivityUtangOpen, setIsActivityUtangOpen] = useState(false);
  const [selectedStoreFromSearch, setSelectedStoreFromSearch] = useState<CatalogPayload | null>(null);
  const [scanStoreRequested, setScanStoreRequested] = useState(false);
  const [scannedStoreRaw, setScannedStoreRaw] = useState<string | null>(null);
  const [productActionPrefill, setProductActionPrefill] = useState<{ productId: number; action: 'EDIT' | 'SELL' | 'VIEW' } | null>(null);
  const [customerActionPrefill, setCustomerActionPrefill] = useState<{ customerId: number; action: 'PAY' | 'ADD_CREDIT' | 'VIEW' } | null>(null);
  const [receiptActionPrefill, setReceiptActionPrefill] = useState<number | null>(null);

  useEffect(() => {
    const loadStores = () => {
      try {
        const raw = safeStorage.getItem('tindahan_saved_suki_stores');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (s: CatalogPayload) =>
                s &&
                s.storeName &&
                !s.storeName.toLowerCase().includes("aling nena's sari-sari store")
            );
            setSavedStores(clean);
          }
        }
      } catch (_) {}
    };
    loadStores();
    window.addEventListener('storage', loadStores);
    return () => window.removeEventListener('storage', loadStores);
  }, []);

  const handleTabChange = (targetTab: TabId) => {
    if (targetTab === activeTab) return;
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const targetIndex = TAB_ORDER.indexOf(targetTab);
    const dir = targetIndex > currentIndex ? 1 : -1;
    setDirection(dir);
    setActiveTab(targetTab);
  };

  // Initialize DB seed & online listener
  useEffect(() => {
    initializeDatabase().catch((err) => {
      console.warn('[App] Database init handled error:', err);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Dexie Reactive Live Queries - guarded with fallback to prevent Android WebView startup crashes
  const transactions =
    useLiveQuery(
      async () => {
        try {
          return await db.transactions.orderBy('timestamp').reverse().toArray();
        } catch (err) {
          console.warn('[Dexie LiveQuery] transactions fallback:', err);
          return [];
        }
      },
      [],
      []
    ) ?? [];

  const customers =
    useLiveQuery(
      async () => {
        try {
          return await db.customers.orderBy('name').toArray();
        } catch (err) {
          console.warn('[Dexie LiveQuery] customers fallback:', err);
          return [];
        }
      },
      [],
      []
    ) ?? [];

  const inventory =
    useLiveQuery(
      async () => {
        try {
          return await db.inventory.orderBy('name').toArray();
        } catch (err) {
          console.warn('[Dexie LiveQuery] inventory fallback:', err);
          return [];
        }
      },
      [],
      []
    ) ?? [];

  // When AUD is ON and store records change, trigger debounced backup update
  useEffect(() => {
    if (transactions.length > 0 || customers.length > 0 || inventory.length > 0) {
      triggerAutoBackupIfEnabled();
    }
  }, [transactions.length, customers.length, inventory.length, storeProfile]);

  const handleLanguageChange = (newLang: LanguageCode) => {
    setLang(newLang);
    setActiveLanguageStorage(newLang);
  };

  const handleRefresh = async () => {
    try {
      setStoreProfile(getStoreProfile());
      triggerAutoBackupIfEnabled();
    } catch (err) {
      console.warn('[App] Refresh error:', err);
    }
  };

  // Web keyboard shortcut & escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Search Shortcut: Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
          setStoreProfile(getStoreProfile());
        } else if (isTutorialOpen) {
          setIsTutorialOpen(false);
        } else if (isQuickNoteOpen) {
          setIsQuickNoteOpen(false);
        } else if (isScannerOpen) {
          setIsScannerOpen(false);
        } else if (isPalengkeOpen) {
          setIsPalengkeOpen(false);
        } else if (isVoiceLogOpen) {
          setIsVoiceLogOpen(false);
        } else if (isDailyRemitOpen) {
          setIsDailyRemitOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isSearchOpen,
    isDrawerOpen,
    isSettingsOpen,
    isTutorialOpen,
    isQuickNoteOpen,
    isScannerOpen,
    isPalengkeOpen,
    isVoiceLogOpen,
    isDailyRemitOpen,
  ]);

  if (!hasSelectedMode) {
    return <ModeSelectionScreen onSelectMode={handleInitialModeSelect} />;
  }

  return (
    <div className="min-h-screen theme-bg-app theme-text-app font-sans antialiased transition-colors duration-200">
      {appMode === 'buyer' ? (
        <BuyerMode
          lang={lang}
          onSwitchToSeller={() => handleSwitchMode('seller')}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenActivityUtang={() => setIsActivityUtangOpen(true)}
          selectedStoreFromSearch={selectedStoreFromSearch}
          onClearSelectedStoreFromSearch={() => setSelectedStoreFromSearch(null)}
          scanStoreRequested={scanStoreRequested}
          onResetScanStoreRequest={() => setScanStoreRequested(false)}
          scannedStoreRaw={scannedStoreRaw}
          onClearScannedStoreRaw={() => setScannedStoreRaw(null)}
        />
      ) : (
        <div className="pb-24 md:pb-12">
          {/* Floating 5-Minute Expiring Quick Note Alert Banner */}
          <ExpiringNoteBanner lang={lang} onOpenQuickNotes={() => setIsQuickNoteOpen(true)} />

          {/* Top Header */}
          <Header
            storeProfile={storeProfile}
            lang={lang}
            appMode={appMode}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
          />

      <PullToRefresh onRefresh={handleRefresh} lang={lang}>
        <main className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-4 pb-24 landscape:pb-20 md:pb-8 overflow-x-clip">
          {/* Desktop & Tablet Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1.5 theme-bg-card p-1.5 rounded-3xl shadow-2xs border theme-border mb-5">
            {[
              { id: 'LISTA', label: translate(lang, 'nav_lista'), icon: Notebook },
              {
                id: 'PAUTANG',
                label: `${translate(lang, 'nav_pautang')} (${
                  customers.filter((c) => c.currentBalance > 0).length
                })`,
                icon: CreditCard,
              },
              {
                id: 'PANINDA',
                label: `${translate(lang, 'nav_paninda')} (${inventory.length})`,
                icon: Package,
              },
              { id: 'ANALYTICS', label: translate(lang, 'nav_kikita'), icon: TrendingUp },
              { id: 'SUKI_AI', label: translate(lang, 'nav_suki_ai'), icon: Bot },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-${tab.id.toLowerCase()}-tab`}
                  onClick={() => handleTabChange(tab.id as TabId)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-black transition-all duration-150 active:scale-95 cursor-pointer select-none ${
                    isActive
                      ? 'theme-bg-primary text-white shadow-2xs border border-white/10'
                      : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'theme-text-secondary'}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab View Content with Directional Transitions */}
          <div className="relative min-h-[350px]">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={activeTab}
                custom={direction}
                variants={tabTransitionVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full"
              >
                {activeTab === 'LISTA' && (
                  <TransactionLedger
                    transactions={transactions}
                    lang={lang}
                    onRefresh={handleRefresh}
                    prefillTransactionId={receiptActionPrefill}
                    onClearPrefillTransactionId={() => setReceiptActionPrefill(null)}
                  />
                )}
                {activeTab === 'PAUTANG' && (
                  <PautangLedger
                    customers={customers}
                    transactions={transactions}
                    lang={lang}
                    onRefresh={handleRefresh}
                    prefillAction={customerActionPrefill}
                    onClearPrefillAction={() => setCustomerActionPrefill(null)}
                  />
                )}
                {activeTab === 'PANINDA' && (
                  <InventoryManager
                    inventory={inventory}
                    lang={lang}
                    onRefresh={handleRefresh}
                    openAddModalPrefill={inventoryPrefill}
                    onClearAddModalPrefill={() => setInventoryPrefill(null)}
                    prefillAction={productActionPrefill}
                    onClearPrefillAction={() => setProductActionPrefill(null)}
                  />
                )}
                {activeTab === 'ANALYTICS' && (
                  <StoreAnalytics
                    transactions={transactions}
                    inventory={inventory}
                    customers={customers}
                    lang={lang}
                  />
                )}
                {activeTab === 'SUKI_AI' && <SukiChatbot isOnline={isOnline} lang={lang} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </PullToRefresh>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 theme-bg-nav backdrop-blur-md border-t theme-border z-40 px-2 pt-1 safe-pb-nav landscape:py-0.5 shadow-2xl">
        <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto text-center items-center">
          {[
            { id: 'LISTA', label: translate(lang, 'nav_lista'), icon: Notebook },
            { id: 'PAUTANG', label: translate(lang, 'nav_pautang'), icon: CreditCard },
            { id: 'PANINDA', label: translate(lang, 'nav_paninda'), icon: Package },
            { id: 'ANALYTICS', label: translate(lang, 'nav_kikita'), icon: TrendingUp },
            { id: 'SUKI_AI', label: translate(lang, 'nav_suki_ai'), icon: Bot },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`mobile-nav-${tab.id.toLowerCase()}-tab`}
                onClick={() => handleTabChange(tab.id as TabId)}
                className={`flex flex-col items-center justify-center py-1.5 landscape:py-1 px-1 rounded-xl sm:rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer select-none ${
                  isActive
                    ? 'theme-bg-primary text-white font-black shadow-xs'
                    : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
                }`}
              >
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform ${
                    isActive ? 'text-white scale-105' : 'theme-text-secondary'
                  }`}
                />
                <span
                  className={`text-[10px] landscape:text-[9px] truncate max-w-[58px] mt-0.5 leading-tight ${
                    isActive ? 'text-white font-black' : 'font-semibold theme-text-secondary'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button for Tools Hub & Quick Actions */}
      {!isSettingsOpen && !isScannerOpen && !isPalengkeOpen && !isVoiceLogOpen && !isDailyRemitOpen && (
        <QuickNoteFab
          onOpenQuickNote={() => setIsQuickNoteOpen(true)}
          onClick={() => setIsQuickNoteOpen(true)}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenPalengke={() => setIsPalengkeOpen(true)}
          onOpenVoiceLog={() => setIsVoiceLogOpen(true)}
          onOpenDailyRemit={() => setIsDailyRemitOpen(true)}
          onOpenStoreQR={() => setIsStoreQROpen(true)}
          lang={lang}
          activeTab={activeTab}
        />
      )}

      {/* 1. Talaan sa Palengke & Restock Checklist Modal */}
      <PalengkeChecklistModal
        isOpen={isPalengkeOpen}
        onClose={() => setIsPalengkeOpen(false)}
        lang={lang}
      />

      {/* 3. Boses na Listahan (Voice Quick Record) Modal with Hardware Noise Suppression */}
      <VoiceLogModal
        isOpen={isVoiceLogOpen}
        onClose={() => setIsVoiceLogOpen(false)}
        onSaved={handleRefresh}
        lang={lang}
      />

      {/* 4. Kwenta ng Benta / Daily Remit Cash Drawer Modal */}
      <DailyRemitModal
        isOpen={isDailyRemitOpen}
        onClose={() => setIsDailyRemitOpen(false)}
        lang={lang}
      />

      {/* Product Barcode & Label Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onOpenAddItem={(prefill) => {
          setIsScannerOpen(false);
          setInventoryPrefill(prefill);
          setActiveTab('PANINDA');
        }}
        onTransactionSuccess={() => {
          handleRefresh();
        }}
        onScannedBuyerOrder={(order) => {
          setIsScannerOpen(false);
          setScannedOrderPayload(order);
        }}
        onScannedStoreCatalog={(raw) => {
          setIsScannerOpen(false);
          setScannedStoreRaw(raw);
          handleSwitchMode('buyer');
        }}
        lang={lang}
      />

      {/* Store Catalog QR Code Modal */}
      <StoreQRModal
        isOpen={isStoreQROpen}
        onClose={() => setIsStoreQROpen(false)}
        lang={lang}
      />

      {/* Seller Scan -> Buyer Order Checkout Processing Modal */}
      <BuyerOrderModal
        isOpen={!!scannedOrderPayload}
        onClose={() => setScannedOrderPayload(null)}
        orderPayload={scannedOrderPayload}
        onOrderConfirmed={() => {
          setScannedOrderPayload(null);
          handleRefresh();
        }}
        lang={lang}
      />

      {/* Mabilisang Tala Quick Note Composer Bottom Sheet */}
      <QuickNoteComposer
        isOpen={isQuickNoteOpen && !isSettingsOpen}
        onClose={() => setIsQuickNoteOpen(false)}
        onSaved={handleRefresh}
        lang={lang}
      />
        </div>
      )}

      {/* Side Navigation Drawer (Persistent across Seller & Buyer modes) */}
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        lang={lang}
        storeProfile={storeProfile}
        appMode={appMode}
        onSwitchMode={handleSwitchMode}
        onOpenSettings={(tab = 'GENERAL') => {
          setSettingsInitialTab(tab);
          setIsSettingsOpen(true);
        }}
        onOpenStoreQR={() => setIsStoreQROpen(true)}
        onStartTutorial={() => setIsTutorialOpen(true)}
        onOpenSavedStores={() => setSelectedStoreFromSearch(null)}
        onOpenActivityUtang={() => setIsActivityUtangOpen(true)}
        onOpenScanQR={() => setScanStoreRequested(true)}
      />

      {/* Settings Modal (Theme, Language, Store Profile, Data Backup, Tutorial Reset) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setStoreProfile(getStoreProfile());
        }}
        lang={lang}
        appMode={appMode}
        onSwitchMode={handleSwitchMode}
        initialTab={settingsInitialTab}
        onLanguageChange={handleLanguageChange}
        onStartTutorial={() => {
          setIsSettingsOpen(false);
          setIsTutorialOpen(true);
        }}
        onDataChanged={handleRefresh}
        onOpenStoreQR={() => {
          setIsSettingsOpen(false);
          setIsStoreQROpen(true);
        }}
      />

      {/* Guided First-Launch & Help Interactive Tour */}
      <GuidedTutorial
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        lang={lang}
        onTabChange={setActiveTab}
      />

      {/* Global 100% Offline Search Engine Modal (Cmd+K / Ctrl+K) */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        inventory={inventory}
        customers={customers}
        transactions={transactions}
        savedStores={savedStores}
        appMode={appMode}
        lang={lang}
        onSelectSavedStore={(store) => {
          setIsSearchOpen(false);
          if (appMode !== 'buyer') {
            handleSwitchMode('buyer');
          }
          setSelectedStoreFromSearch(store);
        }}
        onActionProduct={(productId, action) => {
          setIsSearchOpen(false);
          if (appMode !== 'seller') handleSwitchMode('seller');
          setActiveTab('PANINDA');
          setProductActionPrefill({ productId, action });
        }}
        onActionCustomer={(customerId, action) => {
          setIsSearchOpen(false);
          if (appMode !== 'seller') handleSwitchMode('seller');
          setActiveTab('PAUTANG');
          setCustomerActionPrefill({ customerId, action });
        }}
        onActionReceipt={(transactionId) => {
          setIsSearchOpen(false);
          if (appMode !== 'seller') handleSwitchMode('seller');
          setActiveTab('LISTA');
          setReceiptActionPrefill(transactionId);
        }}
      />

      {/* Buyer Activity & Utang Modal */}
      <MyActivityUtangModal
        isOpen={isActivityUtangOpen}
        onClose={() => setIsActivityUtangOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

