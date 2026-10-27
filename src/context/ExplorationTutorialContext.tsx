import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Lightbulb } from 'lucide-react';
import type { LanguageCode } from '../utils/i18n';
import { safeStorage } from '../utils/safeStorage';

export interface LocalizedString {
  en: string;
  tl: string;
  ja?: string;
  zh?: string;
  ko?: string;
}

export interface ExplorationTip {
  id: string;
  title: LocalizedString;
  desc: LocalizedString;
  icon?: any;
  targetId?: string;
}

interface ExplorationTutorialContextType {
  activeTip: ExplorationTip | null;
  triggerTip: (tip: ExplorationTip) => void;
  dismissTip: (tipId?: string) => void;
  resetAllTips: () => void;
  isTipSeen: (tipId: string) => boolean;
}

const STORAGE_KEY = 'tindahan_seen_exploration_tips_v1';

const ExplorationTutorialContext = createContext<ExplorationTutorialContextType>({
  activeTip: null,
  triggerTip: () => {},
  dismissTip: () => {},
  resetAllTips: () => {},
  isTipSeen: () => false,
});

export const ExplorationTutorialProvider: React.FC<{
  children: React.ReactNode;
  lang: LanguageCode;
}> = ({ children, lang }) => {
  // O(1) in-memory lookup set to avoid repeated disk/localStorage reads
  const seenSetRef = useRef<Set<string>>(new Set());
  const [activeTip, setActiveTip] = useState<ExplorationTip | null>(null);

  // Load seen tips once on mount
  useEffect(() => {
    try {
      const raw = safeStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          seenSetRef.current = new Set(arr);
        }
      }
    } catch (_) {
      seenSetRef.current = new Set();
    }
  }, []);

  const isTipSeen = useCallback((tipId: string): boolean => {
    return seenSetRef.current.has(tipId);
  }, []);

  const triggerTip = useCallback((tip: ExplorationTip) => {
    // If already seen, or if another tip is currently active, don't interrupt
    if (seenSetRef.current.has(tip.id)) return;
    setActiveTip((current) => {
      if (current) return current; // Keep single-active queue rule
      return tip;
    });
  }, []);

  const dismissTip = useCallback((tipId?: string) => {
    setActiveTip((current) => {
      const idToMark = tipId || current?.id;
      if (idToMark) {
        seenSetRef.current.add(idToMark);
        try {
          safeStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seenSetRef.current)));
        } catch (_) {}
      }
      return null;
    });
  }, []);

  const resetAllTips = useCallback(() => {
    seenSetRef.current.clear();
    try {
      safeStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setActiveTip(null);
  }, []);

  return (
    <ExplorationTutorialContext.Provider
      value={{
        activeTip,
        triggerTip,
        dismissTip,
        resetAllTips,
        isTipSeen,
      }}
    >
      {children}
      {/* Floating Exploration Tip Banner (Single active, pure CSS opacity fade, no heavy effects) */}
      <ExplorationTipBanner activeTip={activeTip} lang={lang} onDismiss={dismissTip} />
    </ExplorationTutorialContext.Provider>
  );
};

export const useExplorationTutorial = () => useContext(ExplorationTutorialContext);

// Isolated Banner Component - renders only when activeTip changes, never re-renders the parent
const ExplorationTipBanner: React.FC<{
  activeTip: ExplorationTip | null;
  lang: LanguageCode;
  onDismiss: (id?: string) => void;
}> = ({ activeTip, lang, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (activeTip) {
      // Smooth pure CSS opacity fade-in
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [activeTip]);

  if (!activeTip) return null;

  const titleText = activeTip.title[lang] || activeTip.title.en || activeTip.title.tl;
  const descText = activeTip.desc[lang] || activeTip.desc.en || activeTip.desc.tl;
  const IconComponent = activeTip.icon || Lightbulb;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-20 sm:bottom-24 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 pointer-events-auto transition-opacity duration-200 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ willChange: 'opacity' }}
    >
      <div className="theme-card border-2 theme-border-subtle shadow-2xl rounded-2xl p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-amber-500/40 dark:border-amber-400/30">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
            <IconComponent className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-extrabold text-xs sm:text-sm theme-text-app truncate">
                {titleText}
              </h4>
              <button
                type="button"
                onClick={() => onDismiss(activeTip.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Dismiss tip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] sm:text-xs theme-text-secondary leading-relaxed mt-1">
              {descText}
            </p>

            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => onDismiss(activeTip.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl theme-bg-primary text-white text-[11px] font-black shadow-xs hover:opacity-95 active:scale-95 transition-transform"
              >
                <Check className="w-3 h-3" />
                <span>{lang === 'tl' ? 'Nakuha ko' : 'Got it'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
