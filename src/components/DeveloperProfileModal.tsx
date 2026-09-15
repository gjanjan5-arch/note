import React, { useState } from 'react';
import { X, Heart, Github, Copy, Check, ExternalLink } from 'lucide-react';
import { ModalPortal } from './ModalPortal';
import { translate, type LanguageCode } from '../utils/i18n';

interface DeveloperProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
}

export const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const [copied, setCopied] = useState(false);
  const GCASH_NUMBER = '09517100777';
  const GITHUB_LINK = 'https://github.com/gjanjan5-arch';

  const handleCopyGcash = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(GCASH_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b theme-border-subtle bg-linear-to-r from-blue-500/10 to-indigo-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Heart className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg theme-text-app leading-tight">
              {translate(lang, 'dev_modal_title')}
            </h3>
            <p className="text-[11px] sm:text-xs theme-text-secondary mt-0.5">
              Developed by {translate(lang, 'dev_name')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl theme-hover-bg theme-text-secondary hover:theme-text-app cursor-pointer transition-colors"
          aria-label={translate(lang, 'btn_close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto no-scrollbar space-y-5">
        
        {/* About Message */}
        <div className="theme-card rounded-2xl p-4 border theme-border-subtle shadow-sm space-y-4">
          <p className="text-sm theme-text-app leading-relaxed font-medium">
            {translate(lang, 'dev_message')}
          </p>
          
          <a
            href={GITHUB_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#24292F] hover:bg-[#24292F]/90 text-white font-bold text-xs transition-colors shadow-sm"
          >
            <Github className="w-4 h-4" />
            <span>{translate(lang, 'dev_github')}</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
          </a>
        </div>

        {/* Support Section */}
        <div className="rounded-2xl p-4 bg-linear-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💙</span>
            <h4 className="font-black text-sm text-blue-700 dark:text-blue-400">
              {translate(lang, 'dev_support_title')}
            </h4>
          </div>
          
          <p className="text-xs theme-text-secondary leading-relaxed font-medium">
            {translate(lang, 'dev_support_msg')}
          </p>

          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-500/20 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">GCash</div>
              <div className="font-mono text-lg font-black theme-text-app">{GCASH_NUMBER}</div>
            </div>
            
            <button
              onClick={handleCopyGcash}
              className={`p-2.5 rounded-xl flex items-center gap-2 transition-all ${
                copied 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-bold">{translate(lang, 'dev_copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-xs font-bold">{translate(lang, 'dev_copy_gcash')}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </ModalPortal>
  );
};
