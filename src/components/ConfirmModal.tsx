import React from 'react';
import { AlertCircle, HelpCircle, X, Check } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <ModalPortal isOpen={isOpen} onClose={onCancel}>
      <div className="shrink-0 flex items-start justify-between gap-2 p-4 border-b theme-border-subtle">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-red-500/20 text-red-400' : 'theme-bg-surface-subtle theme-text-accent'
            }`}
          >
            {isDestructive ? <AlertCircle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
          </div>
          <h3 className="font-black theme-text-app text-base leading-tight">{title}</h3>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer active:scale-95 transition-all select-none touch-manipulation"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <p className="text-xs sm:text-sm theme-text-secondary leading-relaxed font-medium">
          {message}
        </p>
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 p-4 border-t theme-border-subtle">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10 cursor-pointer active:scale-95 transition-all select-none touch-manipulation"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 select-none touch-manipulation ${
            isDestructive
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'theme-bg-primary text-white'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          <span>{confirmText}</span>
        </button>
      </div>
    </ModalPortal>
  );
};
