import React from 'react';
import { motion } from 'motion/react';
import { StickyNote, Plus } from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';

interface QuickNoteFabProps {
  onClick: () => void;
  lang: LanguageCode;
}

export const QuickNoteFab: React.FC<QuickNoteFabProps> = ({ onClick, lang }) => {
  return (
    <motion.button
      id="floating-mabilisang-tala-btn"
      onClick={onClick}
      type="button"
      whileTap={{ scale: 0.92, y: 1 }}
      transition={{ duration: 0.12, ease: 'easeInOut' }}
      aria-label={translate(lang, 'mabilisang_tala')}
      title={translate(lang, 'mabilisang_tala')}
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-40 flex items-center gap-2 theme-bg-primary text-white p-3.5 sm:px-4 sm:py-3.5 rounded-full sm:rounded-2xl shadow-xl hover:shadow-2xl border border-white/20 select-none group cursor-pointer"
    >
      <div className="relative flex items-center justify-center">
        <StickyNote className="w-5 h-5 sm:w-5 sm:h-5 transition-transform duration-150 group-hover:scale-110" />
        <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center text-[9px] font-black border border-white dark:border-black">
          <Plus className="w-2.5 h-2.5" />
        </span>
      </div>
      <span className="hidden sm:inline text-xs font-black tracking-wide">
        {translate(lang, 'mabilisang_tala')}
      </span>
    </motion.button>
  );
};

