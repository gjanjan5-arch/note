import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Delete, Lock, KeyRound } from 'lucide-react';
import {
  hasOwnerPin,
  verifyOwnerPin,
  setOwnerPin,
  triggerHapticFeedback,
} from '../utils/securityUtils';
import { translate, type LanguageCode } from '../utils/i18n';

interface OwnerPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang: LanguageCode;
  mode?: 'unlock' | 'setup'; // 'unlock' by default or 'setup' for first-time creation
}

export const OwnerPinModal: React.FC<OwnerPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lang,
  mode = 'unlock',
}) => {
  const isSetupFlow = mode === 'setup' || !hasOwnerPin();
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const isTl = lang === 'tl';

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setConfirmPin('');
      setSetupStep('create');
      setErrorMessage(null);
      setIsShaking(false);
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentEnteredPin = isSetupFlow && setupStep === 'confirm' ? confirmPin : pin;

  const handleKeyPress = (num: string) => {
    if (isVerifying) return;
    if (errorMessage) setErrorMessage(null);

    if (isSetupFlow && setupStep === 'confirm') {
      if (confirmPin.length < 6) {
        const next = confirmPin + num;
        setConfirmPin(next);
        if (next.length === 6) {
          handleCompleteConfirm(pin, next);
        }
      }
    } else {
      if (pin.length < 6) {
        const next = pin + num;
        setPin(next);
        if (next.length === 6) {
          if (isSetupFlow) {
            // Move to confirm step
            setTimeout(() => {
              setSetupStep('confirm');
            }, 150);
          } else {
            handleCompleteUnlock(next);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isVerifying) return;
    if (errorMessage) setErrorMessage(null);

    if (isSetupFlow && setupStep === 'confirm') {
      setConfirmPin((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleCompleteUnlock = async (enteredPin: string) => {
    setIsVerifying(true);
    const isValid = await verifyOwnerPin(enteredPin);

    if (isValid) {
      onSuccess();
      onClose();
    } else {
      triggerHapticFeedback([60, 40, 60]);
      setIsShaking(true);
      setErrorMessage(
        isTl
          ? 'Maling PIN. Subukan muli.'
          : 'Incorrect PIN. Please try again.'
      );
      // Auto-clear immediately as requested
      setTimeout(() => {
        setPin('');
        setIsShaking(false);
        setIsVerifying(false);
      }, 500);
    }
  };

  const handleCompleteConfirm = async (origPin: string, confPin: string) => {
    if (origPin !== confPin) {
      triggerHapticFeedback([60, 40, 60]);
      setIsShaking(true);
      setErrorMessage(
        isTl
          ? 'Hindi nagtutugma ang PIN. Ulitin muli.'
          : 'PINs do not match. Please try again.'
      );
      setTimeout(() => {
        setPin('');
        setConfirmPin('');
        setSetupStep('create');
        setIsShaking(false);
      }, 700);
      return;
    }

    setIsVerifying(true);
    const saved = await setOwnerPin(origPin);
    if (saved) {
      onSuccess();
      onClose();
    } else {
      setErrorMessage(isTl ? 'Nagka-problema sa pag-save.' : 'Error saving PIN.');
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs transition-opacity duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      onClick={onClose}
    >
      <div
        className="theme-card max-w-sm w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-opacity duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="theme-bg-header text-white px-5 py-4 flex items-center justify-between border-b theme-border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              {isSetupFlow ? (
                <KeyRound className="w-4 h-4 text-amber-300" />
              ) : (
                <Lock className="w-4 h-4 text-emerald-300" />
              )}
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight">
                {isSetupFlow
                  ? isTl
                    ? 'Mag-set ng 6-Digit Owner PIN'
                    : 'Set 6-Digit Owner PIN'
                  : isTl
                  ? 'Ilagay ang Owner PIN'
                  : 'Enter Owner PIN'}
              </h3>
              <p className="text-[11px] text-white/80">
                {isSetupFlow
                  ? isTl
                    ? setupStep === 'create'
                      ? 'Pang-proteksyon sa tindahan'
                      : 'Kumpirmahin ang PIN'
                    : setupStep === 'create'
                    ? 'Protect your store settings & profit'
                    : 'Confirm your 6-digit PIN'
                  : isTl
                  ? 'Protektadong Owner Mode'
                  : 'Protected Owner Access'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={translate(lang, 'btn_close')}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PIN Body Content */}
        <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl theme-bg-surface-subtle border theme-border-subtle flex items-center justify-center theme-text-primary shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h4 className="font-extrabold text-sm theme-text-app">
              {isSetupFlow
                ? setupStep === 'create'
                  ? isTl
                    ? 'Gumawa ng 6-Digit PIN'
                    : 'Create 6-Digit PIN'
                  : isTl
                  ? 'Ulitin ang 6-Digit PIN'
                  : 'Re-enter your 6-Digit PIN'
                : isTl
                ? 'I-enter ang 6-Digit PIN'
                : 'Enter your 6-Digit PIN'}
            </h4>
            <p className="text-xs theme-text-secondary max-w-xs">
              {isSetupFlow
                ? setupStep === 'create'
                  ? isTl
                    ? 'Tip: Pwedeng gamitin ang birthday (MM/DD/YY) para madaling tandaan.'
                    : 'Tip: You can use a birthday (MM/DD/YY) so it is easy to remember.'
                  : isTl
                  ? 'Pakilagay muli ang PIN para masigurong walang typo.'
                  : 'Please re-enter the PIN to confirm.'
                : isTl
                ? 'Proteksyon upang ang may-ari lamang ang makakakita ng kita at settings.'
                : 'Security guard so only the owner can access profits & settings.'}
            </p>
          </div>

          {/* 6-Digit Zero-Peek Dots (ATM / GCash Style with Active Cursor Tracking) */}
          <div
            className={`flex items-center justify-center gap-3 py-2.5 transition-transform duration-150 ${
              isShaking ? 'translate-x-1' : ''
            }`}
          >
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = index < currentEnteredPin.length;
              const isCurrent = index === currentEnteredPin.length;
              return (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 flex items-center justify-center ${
                    isFilled
                      ? 'bg-slate-900 border-slate-900 dark:bg-white dark:border-white shadow-xs scale-105'
                      : isCurrent
                      ? 'border-slate-800 dark:border-slate-200 bg-slate-300/60 dark:bg-slate-700/60 ring-2 ring-slate-800/25 dark:ring-white/30 scale-110'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40'
                  }`}
                >
                  {/* Filled: Solid clean center contrast dot */}
                  {isFilled && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-950" />}
                  {/* Current Active: Darkened center indicator showing exact active position */}
                  {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-200 opacity-70" />}
                </div>
              );
            })}
          </div>

          {/* Error Message Feedback */}
          {errorMessage && (
            <div className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl transition-opacity duration-150">
              {errorMessage}
            </div>
          )}

          {/* On-screen Tactile Keypad (GCash / ATM style) */}
          <div className="w-full max-w-[260px] grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-12 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border-subtle font-black text-lg theme-text-app active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              >
                {digit}
              </button>
            ))}

            {/* Clear or Cancel */}
            <button
              type="button"
              onClick={() => {
                if (isSetupFlow && setupStep === 'confirm') {
                  setConfirmPin('');
                } else {
                  setPin('');
                }
              }}
              className="h-12 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border-subtle text-xs font-bold theme-text-secondary active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              {isTl ? 'Bura' : 'Clear'}
            </button>

            {/* Zero Digit */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-12 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border-subtle font-black text-lg theme-text-app active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            >
              0
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Backspace"
              className="h-12 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border-subtle font-black theme-text-secondary hover:theme-text-app active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Footer Tip */}
        <div className="px-5 py-3 border-t theme-border-subtle bg-black/5 dark:bg-white/5 flex items-center justify-center text-[11px] theme-text-secondary">
          <span>
            {isTl
              ? '🔒 Offline-safe security • Walang nakatagong leak'
              : '🔒 Offline-safe security • 100% on-device'}
          </span>
        </div>
      </div>
    </div>
  );
};
