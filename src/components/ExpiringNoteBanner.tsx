import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Check, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { db } from '../db/db';
import type { LanguageCode } from '../utils/i18n';

interface ExpiringNoteBannerProps {
  lang: LanguageCode;
  onOpenQuickNotes?: () => void;
}

export const ExpiringNoteBanner: React.FC<ExpiringNoteBannerProps> = ({
  lang,
  onOpenQuickNotes,
}) => {
  const [now, setNow] = useState<number>(Date.now());
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  // Throttled low-power timer update every 5 seconds to minimize battery usage
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Live Query notes from IndexedDB safely guarded against WebView startup failures
  const expiringNotes = useLiveQuery(
    async () => {
      try {
        const allNotes = await db.notes.toArray();
        const currentTime = Date.now();
        // Filter notes expiring within 5 minutes (300,000ms) and not yet expired
        return allNotes.filter((n) => {
          if (!n.id || !n.autoDelete || !n.expiresAt) return false;
          const timeLeft = n.expiresAt - currentTime;
          return timeLeft > 0 && timeLeft <= 5 * 60 * 1000;
        });
      } catch (err) {
        console.warn('[ExpiringNoteBanner] liveQuery fallback:', err);
        return [];
      }
    },
    [],
    []
  ) ?? [];

  const activeExpiringNote = expiringNotes?.find((n) => n.id && !dismissedIds.has(n.id));

  if (!activeExpiringNote || !activeExpiringNote.expiresAt) {
    return null;
  }

  const msLeft = Math.max(0, activeExpiringNote.expiresAt - now);
  const minutesLeft = Math.floor(msLeft / 60000);
  const secondsLeft = Math.floor((msLeft % 60000) / 1000);
  const timeFormatted = `${minutesLeft}:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeExpiringNote.id) {
      setDismissedIds((prev) => new Set(prev).add(activeExpiringNote.id!));
    }
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeExpiringNote.id) {
      try {
        await db.notes.delete(activeExpiringNote.id);
      } catch (err) {
        console.warn('[ExpiringNoteBanner] Failed to delete completed note:', err);
      }
    }
  };

  const handleExtend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeExpiringNote.id) {
      try {
        const newExpiry = Date.now() + 30 * 60 * 1000; // extend by 30 mins
        await db.notes.update(activeExpiringNote.id, {
          expiresAt: newExpiry,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn('[ExpiringNoteBanner] Failed to extend note expiry:', err);
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key={`expiring-note-${activeExpiringNote.id}`}
        initial={{ y: -60, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -60, opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={() => onOpenQuickNotes?.()}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950 shadow-2xl rounded-2xl p-3 border border-amber-300/80 dark:border-amber-200/80 backdrop-blur-md cursor-pointer select-none touch-manipulation active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center justify-between gap-2.5">
          {/* Note Icon & Content */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-slate-950/15 border border-slate-950/20 flex items-center justify-center shrink-0 ">
              <AlertTriangle className="w-4 h-4 text-slate-950" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-slate-950/20 px-1.5 py-0.2 rounded-md">
                  {lang === 'tl' ? 'Paalala (5m)' : 'Reminder (5m)'}
                </span>
                <span className="text-xs font-mono font-black text-slate-900 bg-white/40 px-1.5 py-0.2 rounded-md">
                  ⏱️ {timeFormatted}
                </span>
              </div>
              <p className="text-xs font-bold truncate mt-0.5 leading-snug">
                {activeExpiringNote.text}
              </p>
            </div>
          </div>

          {/* Actions: Extend & Complete/Dismiss */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleExtend}
              className="px-2 py-1 rounded-xl bg-slate-950/15 hover:bg-slate-950/25 text-slate-950 font-black text-[10px] transition-all active:scale-95 flex items-center gap-1"
              title={lang === 'tl' ? 'Dagdag +30 mins' : '+30 mins'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>+30m</span>
            </button>

            <button
              type="button"
              onClick={handleComplete}
              className="p-1.5 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all active:scale-95"
              title={lang === 'tl' ? 'Tapusin / Burahin' : 'Done / Clear'}
            >
              <Check className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-xl hover:bg-slate-950/20 text-slate-950 transition-all active:scale-95"
              title={lang === 'tl' ? 'Itago' : 'Dismiss'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
