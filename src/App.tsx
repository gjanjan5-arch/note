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
import { ThemeProvider } from './context/ThemeContext';

const TAB_ORDER = ['LISTA', 'PAUTANG', 'PANINDA', 'ANALYTICS', 'SUKI_AI'] as const;
type TabId = (typeof TAB_ORDER)[number];

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
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -16 : dir < 0 ? 16 : 0,
    opacity: 0,
    transition: {
      duration: 0.14,
      ease: [0.25, 1, 0.5, 1],
    },
  }),
};

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('LISTA');
  const [direction, setDirection] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lang, setLang] = useState<LanguageCode>(getActiveLanguage());
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(getStoreProfile());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(!isTutorialCompleted());
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);

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
    initializeDatabase();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Dexie Reactive Live Queries
  const transactions =
    useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray()) || [];
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray()) || [];
  const inventory = useLiveQuery(() => db.inventory.orderBy('name').toArray()) || [];

  const handleLanguageChange = (newLang: LanguageCode) => {
    setLang(newLang);
    setActiveLanguageStorage(newLang);
  };

  const handleRefresh = async () => {
    setStoreProfile(getStoreProfile());
    // Live query automatically reactive
  };

  return (
    <div className="min-h-screen theme-bg-app theme-text-app pb-24 md:pb-12 font-sans antialiased transition-colors duration-200">
      {/* Top Header */}
      <Header
        storeProfile={storeProfile}
        lang={lang}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartTutorial={() => setIsTutorialOpen(true)}
      />

      <PullToRefresh onRefresh={handleRefresh} lang={lang}>
        <main className="max-w-5xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
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
                  <TransactionLedger transactions={transactions} lang={lang} onRefresh={handleRefresh} />
                )}
                {activeTab === 'PAUTANG' && (
                  <PautangLedger
                    customers={customers}
                    transactions={transactions}
                    lang={lang}
                    onRefresh={handleRefresh}
                  />
                )}
                {activeTab === 'PANINDA' && (
                  <InventoryManager inventory={inventory} lang={lang} onRefresh={handleRefresh} />
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 theme-bg-nav backdrop-blur-md border-t theme-border z-40 px-2 py-1.5 shadow-2xl">
        <div className="grid grid-cols-5 gap-1 max-w-md mx-auto text-center">
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
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer select-none ${
                  isActive
                    ? 'theme-bg-primary text-white font-black shadow-xs'
                    : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? 'text-white scale-105' : 'theme-text-secondary'
                  }`}
                />
                <span
                  className={`text-[10.5px] truncate max-w-[56px] mt-0.5 ${
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

      {/* Floating Action Button for Mabilisang Tala Quick Notes */}
      {!isSettingsOpen && (
        <QuickNoteFab
          onClick={() => setIsQuickNoteOpen(true)}
          lang={lang}
        />
      )}

      {/* Mabilisang Tala Quick Note Composer Bottom Sheet */}
      <QuickNoteComposer
        isOpen={isQuickNoteOpen && !isSettingsOpen}
        onClose={() => setIsQuickNoteOpen(false)}
        onSaved={handleRefresh}
        lang={lang}
      />

      {/* Settings Modal (Theme, Language, Store Profile, Data Backup, Tutorial Reset) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setStoreProfile(getStoreProfile());
        }}
        lang={lang}
        onLanguageChange={handleLanguageChange}
        onStartTutorial={() => {
          setIsSettingsOpen(false);
          setIsTutorialOpen(true);
        }}
        onDataChanged={handleRefresh}
      />

      {/* Guided First-Launch & Help Interactive Tour */}
      <GuidedTutorial
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        lang={lang}
        onTabChange={setActiveTab}
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

