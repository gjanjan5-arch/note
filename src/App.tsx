import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import {
  Notebook,
  CreditCard,
  Package,
  TrendingUp,
} from 'lucide-react';
import { db, initializeDatabase } from './db/db';
import { Header } from './components/Header';
import { TransactionLedger } from './components/TransactionLedger';
import { PautangLedger } from './components/PautangLedger';
import { InventoryManager } from './components/InventoryManager';
import { StoreAnalytics } from './components/StoreAnalytics';
import { SettingsModal } from './components/SettingsModal';
import { PullToRefresh } from './components/PullToRefresh';
import { QuickNoteComposer } from './components/QuickNoteComposer';
import { QuickNoteFab } from './components/QuickNoteFab';
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
import { RecommendationsModal } from './components/RecommendationsModal';
import {
  getActiveLanguage,
  setActiveLanguageStorage,
  translate,
  type LanguageCode,
} from './utils/i18n';
import {
  getStoreProfile,
  type StoreProfile,
} from './utils/storeSettings';
import type { CatalogPayload } from "./types";
import { triggerAutoBackupIfEnabled } from './utils/backupManager';
import { ThemeProvider } from './context/ThemeContext';
import { PerformanceProvider } from './context/PerformanceContext';
import { ExplorationTutorialProvider } from './context/ExplorationTutorialContext';
import { safeStorage } from './utils/safeStorage';
import { useScrollNavigation } from './hooks/useScrollNavigation';

const TAB_ORDER = ['LISTA', 'PAUTANG', 'PANINDA', 'ANALYTICS'] as const;
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
    const saved = safeStorage.getItem('appMode') as 'seller' | 'buyer';
    return saved === 'buyer' ? 'buyer' : 'seller';
  });
  const [isStoreQROpen, setIsStoreQROpen] = useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(false);
  const [isBuyerRecommendationsOpen, setIsBuyerRecommendationsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [scannedOrderPayload, setScannedOrderPayload] = useState<BuyerOrderPayload | null>(null);
  const { isNavVisible } = useScrollNavigation();

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
      // triggerSync();
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
    <ExplorationTutorialProvider lang={lang}>
      <div className="min-h-screen flex flex-col theme-bg-app theme-text-app font-sans antialiased transition-colors duration-200">
        {appMode === 'buyer' ? (
          <BuyerMode
            lang={lang}
            isMenuOpen={isDrawerOpen}
            onSwitchToSeller={() => handleSwitchMode('seller')}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenActivityUtang={() => setIsActivityUtangOpen(true)}
            isBuyerRecommendationsOpen={isBuyerRecommendationsOpen}
            onOpenBuyerRecommendations={() => setIsBuyerRecommendationsOpen(true)}
            onCloseBuyerRecommendations={() => setIsBuyerRecommendationsOpen(false)}
            selectedStoreFromSearch={selectedStoreFromSearch}
            onClearSelectedStoreFromSearch={() => setSelectedStoreFromSearch(null)}
            scanStoreRequested={scanStoreRequested}
            onResetScanStoreRequest={() => setScanStoreRequested(false)}
            scannedStoreRaw={scannedStoreRaw}
            onClearScannedStoreRaw={() => setScannedStoreRaw(null)}
          />
        ) : (
        <div className="flex-1 flex flex-col w-full">
          {/* Floating 5-Minute Expiring Quick Note Alert Banner */}
          <ExpiringNoteBanner lang={lang} onOpenQuickNotes={() => setIsQuickNoteOpen(true)} />

          {/* Top Header */}
          <Header
            storeProfile={storeProfile}
            lang={lang}
            appMode={appMode}
            isNavVisible={isNavVisible}
            isMenuOpen={isDrawerOpen}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
          />

      <PullToRefresh onRefresh={handleRefresh} lang={lang}>
        <main className="flex-1 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-4 pb-[calc(7.5rem+var(--safe-nav-pb))]">
          {/* Active Tab View Content with Directional Transitions */}
          <div className="relative min-h-[350px] w-full overflow-x-auto">
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
                {
                  <>
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
                        onOpenRecommendations={() => setIsRecommendationsOpen(true)}
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
                  </>
                }
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </PullToRefresh>

      {/* Primary Navigation Dock (Seller Mode) */}
      {appMode === 'seller' && (
        <nav className={`dock-container fixed bottom-[var(--dock-bottom)] left-1/2 -translate-x-1/2 z-40 theme-bg-nav/80 backdrop-blur-md border theme-border rounded-full px-4 py-2 shadow-2xl transition-transform duration-300 ease-in-out w-max max-w-[calc(100vw-1rem)] ${
          isNavVisible ? 'translate-y-0 pointer-events-auto' : 'translate-y-28 pointer-events-none'
        }`}>
          <div className="dock-nav flex items-center gap-4">
            {[
              { id: 'LISTA', label: translate(lang, 'nav_lista'), icon: Notebook },
              { id: 'PAUTANG', label: translate(lang, 'nav_pautang'), icon: CreditCard },
              { id: 'PANINDA', label: translate(lang, 'nav_paninda'), icon: Package },
              { id: 'ANALYTICS', label: translate(lang, 'nav_kikita'), icon: TrendingUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`mobile-nav-${tab.id.toLowerCase()}-tab`}
                  onClick={() => handleTabChange(tab.id as TabId)}
                  className={`dock-tab-btn flex flex-col items-center justify-center py-2 landscape:py-1 px-1 min-h-[48px] min-w-[48px] rounded-xl sm:rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer select-none ${
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
                    className={`dock-tab-label text-[10px] landscape:text-[9px] truncate max-w-full px-0.5 mt-0.5 leading-tight ${
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

      {/* Recommendations Modal */}
      <RecommendationsModal
        isOpen={isRecommendationsOpen}
        onClose={() => setIsRecommendationsOpen(false)}
        lang={lang}
        onNavigateToInventory={() => setActiveTab('PANINDA')}
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
      
      {/* Quick Access Floating Tool */}
      <QuickNoteFab
        lang={lang}
        isNavVisible={isNavVisible}
        activeTab={activeTab}
        onOpenQuickNote={() => setIsQuickNoteOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenPalengke={() => setIsPalengkeOpen(true)}
        onOpenVoiceLog={() => setIsVoiceLogOpen(true)}
        onOpenDailyRemit={() => setIsDailyRemitOpen(true)}
        onOpenStoreQR={() => setIsStoreQROpen(true)}
      />
        </div>
      )}

      {/* Side Navigation Drawer (Persistent across Seller, Owner, and Buyer modes) */}
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
          setIsDrawerOpen(false);
        }}
        onOpenStoreQR={() => setIsStoreQROpen(true)}
        onOpenSavedStores={() => setSelectedStoreFromSearch(null)}
        onOpenActivityUtang={() => setIsActivityUtangOpen(true)}
        onOpenScanQR={() => {
          setIsDrawerOpen(false);
          if (appMode === 'buyer') {
            setScanStoreRequested(true);
          } else {
            setIsScannerOpen(true);
          }
        }}
        onOpenQuickNote={() => {
          setIsDrawerOpen(false);
          setIsQuickNoteOpen(true);
        }}
        onOpenRecommendations={() => {
          setIsDrawerOpen(false);
          if (appMode === 'buyer') {
            setIsBuyerRecommendationsOpen(true);
          } else {
            setIsRecommendationsOpen(true);
          }
        }}
        isOnline={isOnline}
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
        onDataChanged={handleRefresh}
        onOpenStoreQR={() => {
          setIsSettingsOpen(false);
          setIsStoreQROpen(true);
        }}
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
    </ExplorationTutorialProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PerformanceProvider>
        <AppContent />
      </PerformanceProvider>
    </ThemeProvider>
  );
}

