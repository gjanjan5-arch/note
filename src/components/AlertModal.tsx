import React from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  buttonText?: string;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  type = 'warning',
  buttonText = 'OK',
  onClose,
}) => {
  const defaultTitle =
    type === 'error'
      ? 'Pansin (Error)'
      : type === 'warning'
      ? 'Paalala (Warning)'
      : type === 'success'
      ? 'Tagumpay (Success)'
      : 'Impormasyon (Info)';

  const displayTitle = title || defaultTitle;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      default:
        return <Info className="w-5 h-5 theme-text-accent" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'error':
        return 'bg-red-500/15 border border-red-500/30';
      case 'warning':
        return 'bg-amber-500/15 border border-amber-500/30';
      case 'success':
        return 'bg-emerald-500/15 border border-emerald-500/30';
      default:
        return 'theme-bg-surface-subtle border theme-border-subtle';
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="shrink-0 flex items-start justify-between gap-2 p-4 border-b theme-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${getIconBg()}`}>
            {getIcon()}
          </div>
          <h3 className="font-black theme-text-app text-base leading-tight">{displayTitle}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer active:scale-95 transition-all select-none touch-manipulation"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <p className="text-xs sm:text-sm theme-text-app leading-relaxed font-semibold whitespace-pre-line">
          {message}
        </p>
      </div>

      <div className="shrink-0 p-4 border-t theme-border-subtle">
        <button
          type="button"
          onClick={onClose}
          className="w-full theme-bg-primary text-white py-2.5 rounded-xl font-black text-xs shadow-2xs active:scale-95 transition-all cursor-pointer select-none touch-manipulation text-center"
        >
          {buttonText}
        </button>
      </div>
    </ModalPortal>
  );
};
