import React from 'react';
import { Store, Settings, HelpCircle } from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';
import type { StoreProfile } from '../utils/storeSettings';

interface HeaderProps {
  storeProfile: StoreProfile;
  lang: LanguageCode;
  onOpenSettings: () => void;
  onStartTutorial: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  storeProfile,
  lang,
  onOpenSettings,
  onStartTutorial,
}) => {
  return (
    <header className="theme-bg-header text-white shadow-xs border-b theme-border-subtle sticky top-0 z-30 transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl theme-bg-primary text-white flex items-center justify-center font-black shadow-inner shrink-0 border border-white/20">
            <Store className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                {translate(lang, 'app_title')}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/90 px-1.5 py-0.5 rounded border border-white/20">
                {lang.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] theme-text-accent font-medium truncate max-w-[200px] sm:max-w-xs opacity-90">
              {storeProfile.storeName || translate(lang, 'app_subtitle')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Tutorial Tour Button */}
          <button
            onClick={onStartTutorial}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/15 active:scale-95"
            title={translate(lang, 'start_tutorial_again')}
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            id="header-settings-btn"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all border border-white/15 active:scale-95"
            title={translate(lang, 'settings_title')}
          >
            <Settings className="w-4 h-4 text-white/90" />
            <span className="hidden sm:inline">{translate(lang, 'settings')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
