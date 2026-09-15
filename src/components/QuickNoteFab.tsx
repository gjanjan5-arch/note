import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  X,
  StickyNote,
  Camera,
  ShoppingCart,
  Mic,
  Wallet,
  Wrench,
  QrCode,
} from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';

interface QuickNoteFabProps {
  onOpenQuickNote?: () => void;
  onClick?: () => void;
  onOpenScanner: () => void;
  onOpenPalengke?: () => void;
  onOpenVoiceLog?: () => void;
  onOpenDailyRemit?: () => void;
  onOpenStoreQR?: () => void;
  lang: LanguageCode;
  activeTab?: string;
}

type ToolAction =
  | 'scanner'
  | 'palengke'
  | 'voice_log'
  | 'daily_remit'
  | 'store_qr'
  | 'quick_note';

export const QuickNoteFab: React.FC<QuickNoteFabProps> = ({
  onOpenQuickNote,
  onClick,
  onOpenScanner,
  onOpenPalengke,
  onOpenVoiceLog,
  onOpenDailyRemit,
  onOpenStoreQR,
  lang,
  activeTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Hide in Suki AI so it never covers the chat input and send buttons
  if (activeTab === 'SUKI_AI') {
    return null;
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelectOption = (action: ToolAction) => {
    setIsOpen(false);
    switch (action) {
      case 'scanner':
        onOpenScanner();
        break;
      case 'palengke':
        if (onOpenPalengke) onOpenPalengke();
        break;
      case 'voice_log':
        if (onOpenVoiceLog) onOpenVoiceLog();
        break;
      case 'daily_remit':
        if (onOpenDailyRemit) onOpenDailyRemit();
        break;
      case 'store_qr':
        if (onOpenStoreQR) onOpenStoreQR();
        break;
      case 'quick_note':
        if (onOpenQuickNote) onOpenQuickNote();
        else if (onClick) onClick();
        break;
    }
  };

  return (
    <>
      {/* Dimmed Blurred Backdrop when Speed Dial is Expanded */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="speed-dial-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[55] touch-manipulation cursor-pointer"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Speed Dial Container */}
      <div className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] landscape:bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] right-3.5 sm:right-6 md:bottom-8 md:right-8 ${isOpen ? 'z-[56]' : 'z-30'} flex flex-col items-end gap-2 select-none pointer-events-none`}>
        {/* Speed Dial Expanded Options (fanning upward) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="speed-dial-options"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: {
                  transition: { staggerChildren: 0.04, delayChildren: 0.01 },
                },
                closed: {
                  transition: { staggerChildren: 0.03, staggerDirection: -1 },
                },
              }}
              className="flex flex-col items-end gap-2 pointer-events-auto mb-1 max-h-[72vh] overflow-y-auto pr-0.5 pb-0.5"
            >
              {/* Option 1: 📷 Scanner (Camera / Barcode / OCR) */}
              <motion.button
                type="button"
                id="speed-dial-scanner-btn"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 16, scale: 0.85 },
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectOption('scanner')}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shadow-xl border border-white/25 active:scale-95 cursor-pointer touch-manipulation group transition-colors"
                aria-label={translate(lang, 'scanner_title') || 'Scanner'}
                title={translate(lang, 'scanner_title') || 'Scanner'}
              >
                <span className="text-xs font-black tracking-wide drop-shadow-xs">
                  {translate(lang, 'scanner_fab_label') || 'Scanner'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                </div>
              </motion.button>

              {/* Option 2: 🛒 Talaan sa Palengke (Palengke & Restock Checklist) */}
              <motion.button
                type="button"
                id="speed-dial-palengke-btn"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 16, scale: 0.85 },
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectOption('palengke')}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl border border-white/25 active:scale-95 cursor-pointer touch-manipulation group transition-colors"
                aria-label={translate(lang, 'tool_palengke_title')}
                title={translate(lang, 'tool_palengke_desc')}
              >
                <span className="text-xs font-black tracking-wide drop-shadow-xs">
                  {translate(lang, 'tool_palengke_title')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                </div>
              </motion.button>

              {/* Option 4: 🎙️ Boses na Listahan (Voice Quick Record) */}
              <motion.button
                type="button"
                id="speed-dial-voice-btn"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 16, scale: 0.85 },
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectOption('voice_log')}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl border border-white/25 active:scale-95 cursor-pointer touch-manipulation group transition-colors"
                aria-label={translate(lang, 'tool_voice_record_title')}
                title={translate(lang, 'tool_voice_record_desc')}
              >
                <span className="text-xs font-black tracking-wide drop-shadow-xs">
                  {translate(lang, 'tool_voice_record_title')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                </div>
              </motion.button>

              {/* Option 5: 💵 Kwenta ng Benta / Remit (End-of-Day Cash Drawer Counter) */}
              <motion.button
                type="button"
                id="speed-dial-remit-btn"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 16, scale: 0.85 },
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectOption('daily_remit')}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white shadow-xl border border-white/25 active:scale-95 cursor-pointer touch-manipulation group transition-colors"
                aria-label={translate(lang, 'tool_daily_remit_title')}
                title={translate(lang, 'tool_daily_remit_desc')}
              >
                <span className="text-xs font-black tracking-wide drop-shadow-xs">
                  {translate(lang, 'tool_daily_remit_title')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                </div>
              </motion.button>

              {/* Option 6: 📱 Generate Store QR Code */}
              <motion.button
                type="button"
                id="speed-dial-store-qr-btn"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 16, scale: 0.85 },
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectOption('store_qr')}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-xl border border-white/25 active:scale-95 cursor-pointer touch-manipulation group transition-colors"
                aria-label={lang === 'tl' ? 'QR Code ng Tindahan' : 'Generate Store QR Code'}
                title={lang === 'tl' ? 'Ipakita ang QR Code ng tindahan para sa mga mamimili' : 'Generate Store QR Code for customer ordering'}
              >
                <span className="text-xs font-black tracking-wide drop-shadow-xs">
                  {lang === 'tl' ? 'Store QR Code' : 'Generate Store QR'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                  <QrCode className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                </div>
              </motion.button>

              {/* Option 7: 📝 Mabilisang Tala (Quick Note Scratchpad) */}
              <motion.button
                type="button"
                id="speed-dial-quick-note-btn"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 16, scale: 0.85 },
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectOption('quick_note')}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl theme-bg-card theme-text-app border theme-border shadow-xl active:scale-95 cursor-pointer touch-manipulation group hover:border-[var(--color-primary)] transition-colors"
                aria-label={translate(lang, 'mabilisang_tala') || 'Quick Note'}
                title={translate(lang, 'mabilisang_tala') || 'Quick Note'}
              >
                <span className="text-xs font-black tracking-wide">
                  {translate(lang, 'mabilisang_tala') || 'Quick Note'}
                </span>
                <div className="w-8 h-8 rounded-xl theme-bg-primary text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <StickyNote className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Floating Action Button (Rotates + to X when expanded, with language-adaptive Tools label) */}
        <motion.button
          id="floating-speed-dial-fab-btn"
          onClick={handleToggle}
          type="button"
          whileTap={{ scale: 0.92, y: 1 }}
          transition={{ duration: 0.14, ease: 'easeInOut' }}
          aria-expanded={isOpen}
          aria-label={isOpen ? translate(lang, 'btn_close') : translate(lang, 'tools_button_label')}
          title={isOpen ? translate(lang, 'btn_close') : translate(lang, 'tools_button_tooltip')}
          className="pointer-events-auto flex items-center gap-2 theme-bg-primary text-white p-3.5 landscape:px-4 landscape:py-3.5 rounded-full md:rounded-2xl shadow-xl hover:shadow-2xl border border-white/25 select-none group cursor-pointer touch-manipulation"
        >
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ rotate: isOpen ? 135 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex items-center justify-center"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            </motion.div>
          </div>
          <span className="hidden landscape:inline text-xs sm:text-sm font-black tracking-wide">
            {isOpen
              ? (translate(lang, 'btn_close') || 'Close')
              : (translate(lang, 'tools_button_label') || 'Tools')}
          </span>
        </motion.button>
      </div>
    </>
  );
};
