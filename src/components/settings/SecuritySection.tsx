import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  RotateCcw,
  Smartphone,
  Timer,
  CheckCircle2,
} from 'lucide-react';
import {
  hasOwnerPin,
  removeOwnerPin,
  verifyOwnerPin,
  setOwnerPin,
  triggerHapticFeedback,
} from '../../utils/securityUtils';
import { type LanguageCode } from '../../utils/i18n';

interface SecuritySectionProps {
  lang: LanguageCode;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({ lang }) => {
  const isTl = lang === 'tl';
  const [isPinActive, setIsPinActive] = useState<boolean>(() => hasOwnerPin());
  const [actionFlow, setActionFlow] = useState<'idle' | 'set' | 'change' | 'remove'>('idle');

  // Multi-step form state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const resetForm = () => {
    setActionFlow('idle');
    setCurrentPin('');
    setNewPin('');
    setConfirmNewPin('');
    setErrorMsg(null);
  };

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setErrorMsg(isTl ? 'Dapat eksaktong 6 na numero ang PIN.' : 'PIN must be exactly 6 digits.');
      triggerHapticFeedback();
      return;
    }

    if (newPin !== confirmNewPin) {
      setErrorMsg(isTl ? 'Hindi nagtutugma ang bagong PIN.' : 'New PINs do not match.');
      triggerHapticFeedback();
      return;
    }

    // If changing, verify current PIN first
    if (actionFlow === 'change') {
      const isCurrentValid = await verifyOwnerPin(currentPin);
      if (!isCurrentValid) {
        setErrorMsg(isTl ? 'Mali ang kasalukuyang PIN.' : 'Current PIN is incorrect.');
        triggerHapticFeedback();
        return;
      }
    }

    const saved = await setOwnerPin(newPin);
    if (saved) {
      setIsPinActive(true);
      resetForm();
      showSuccess(
        isTl
          ? 'Matagumpay na na-set ang bagong 6-Digit Owner PIN!'
          : 'New 6-Digit Owner PIN successfully set!'
      );
    } else {
      setErrorMsg(isTl ? 'Nagka-problema sa pag-save.' : 'Error saving PIN.');
    }
  };

  const handleRemovePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const isCurrentValid = await verifyOwnerPin(currentPin);
    if (!isCurrentValid) {
      setErrorMsg(isTl ? 'Mali ang kasalukuyang PIN.' : 'Current PIN is incorrect.');
      triggerHapticFeedback();
      return;
    }

    removeOwnerPin();
    setIsPinActive(false);
    resetForm();
    showSuccess(
      isTl
        ? 'Tinanggal na ang Owner PIN. Bukas na ang Owner Mode.'
        : 'Owner PIN removed. Owner Mode is now open.'
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Success notification */}
      {successToast && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-opacity duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 1. Status Card at the Top */}
      <div
        className={`p-4 rounded-3xl border transition-all duration-150 ${
          isPinActive
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs ${
                isPinActive
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-amber-500 text-white border-amber-400'
              }`}
            >
              {isPinActive ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm theme-text-app">
                  {isPinActive
                    ? isTl
                      ? 'Protektado ng 6-Digit PIN'
                      : 'Protected with 6-Digit PIN'
                    : isTl
                    ? 'Walang PIN ang Tindahan'
                    : 'No Owner PIN Configured'}
                </h4>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    isPinActive
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isPinActive
                    ? isTl
                      ? 'Aktibo'
                      : 'ACTIVE'
                    : isTl
                    ? 'Bukas'
                    : 'UNLOCKED'}
                </span>
              </div>
              <p className="text-xs theme-text-secondary mt-0.5">
                {isPinActive
                  ? isTl
                    ? 'Kailangan ng PIN para makita ang kita, tubo, at settings ng may-ari.'
                    : 'PIN required to access business profits, ledger totals, and owner settings.'
                  : isTl
                  ? 'Kahit sino ay maaaring makapasok sa Owner Mode nang walang verification.'
                  : 'Anyone can enter Owner Mode without verification.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t theme-border-subtle flex flex-wrap items-center gap-2">
          {isPinActive ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setActionFlow('change');
                }}
                className="px-3.5 py-2 rounded-xl theme-bg-primary text-white text-xs font-black shadow-xs hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isTl ? 'Palitan ang PIN' : 'Change 6-Digit PIN'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setActionFlow('remove');
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isTl ? 'Tanggalin ang PIN' : 'Disable PIN'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setActionFlow('set');
              }}
              className="px-4 py-2 rounded-xl theme-bg-primary text-white text-xs font-black shadow-xs hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isTl ? 'Mag-set ng 6-Digit PIN' : 'Create 6-Digit PIN'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Form Flow for Setting / Changing / Removing PIN */}
      {actionFlow !== 'idle' && (
        <div className="p-4 rounded-3xl theme-bg-surface-subtle border theme-border-subtle space-y-3 transition-opacity duration-150">
          <div className="flex items-center justify-between">
            <h5 className="font-extrabold text-xs theme-text-app uppercase tracking-wide">
              {actionFlow === 'set' && (isTl ? 'Gumawa ng PIN' : 'Set New PIN')}
              {actionFlow === 'change' && (isTl ? 'Palitan ang PIN' : 'Change PIN')}
              {actionFlow === 'remove' && (isTl ? 'I-disable ang PIN' : 'Disable PIN')}
            </h5>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold theme-text-secondary hover:theme-text-app cursor-pointer"
            >
              {isTl ? 'Kanselahin' : 'Cancel'}
            </button>
          </div>

          {errorMsg && (
            <div className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={actionFlow === 'remove' ? handleRemovePin : handleSaveNewPin}
            className="space-y-3"
          >
            {(actionFlow === 'change' || actionFlow === 'remove') && (
              <div>
                <label className="block text-[11px] font-bold theme-text-secondary mb-1">
                  {isTl ? 'Kasalukuyang 6-Digit PIN' : 'Current 6-Digit PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="● ● ● ● ● ●"
                  className="w-full px-3.5 py-2 rounded-xl theme-bg-card border theme-border-subtle font-mono text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  required
                />
              </div>
            )}

            {actionFlow !== 'remove' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold theme-text-secondary mb-1">
                    {isTl ? 'Bagong 6-Digit PIN' : 'New 6-Digit PIN'}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="● ● ● ● ● ●"
                    className="w-full px-3.5 py-2 rounded-xl theme-bg-card border theme-border-subtle font-mono text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    required
                  />
                  <span className="text-[10px] theme-text-secondary mt-1 block">
                    {isTl
                      ? 'Halimbawa: Birthday (MM/DD/YY)'
                      : 'Example: Birthday (MM/DD/YY)'}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold theme-text-secondary mb-1">
                    {isTl ? 'Kumpirmahin ang Bagong PIN' : 'Confirm New 6-Digit PIN'}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="● ● ● ● ● ●"
                    className="w-full px-3.5 py-2 rounded-xl theme-bg-card border theme-border-subtle font-mono text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    required
                  />
                </div>
              </>
            )}

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-xl theme-bg-card border theme-border-subtle text-xs font-bold theme-text-secondary cursor-pointer"
              >
                {isTl ? 'Kanselahin' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl theme-bg-primary text-white text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                {actionFlow === 'remove'
                  ? isTl
                    ? 'Kumpirmahin ang Pag-alis'
                    : 'Confirm Removal'
                  : isTl
                  ? 'I-save ang PIN'
                  : 'Save PIN'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Automatic Protections (Auto-Lock Rules) */}
      <div className="p-4 rounded-3xl theme-bg-surface-subtle border theme-border-subtle space-y-3">
        <h5 className="font-extrabold text-xs theme-text-app uppercase tracking-wide flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 theme-text-primary" />
          <span>{isTl ? 'Awtomatikong Proteksyon (Auto-Lock)' : 'Automatic Protection (Auto-Lock)'}</span>
        </h5>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 rounded-2xl theme-bg-card border theme-border-subtle">
            <Smartphone className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold theme-text-app block">
                {isTl ? 'Pag-alis o Pag-switch ng App' : 'App Switch & Sleep Detection'}
              </span>
              <span className="text-[11px] theme-text-secondary">
                {isTl
                  ? 'Kapag pinindot ang Home, nagpalit ng app, o nag-lock ang screen, agad ibabalik sa Seller Mode ang tindahan.'
                  : 'Pressing Home, switching to other apps, or sleeping the phone automatically locks back to Seller Mode.'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-2xl theme-bg-card border theme-border-subtle">
            <Timer className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold theme-text-app block">
                {isTl ? '5-Minutong Idle Timer' : '5-Minute Inactivity Lock'}
              </span>
              <span className="text-[11px] theme-text-secondary">
                {isTl
                  ? 'Kapag walang humahawak o pumipindot sa cellphone nang 5 minuto, kusa itong magla-lock para sa seguridad.'
                  : 'If the device is untouched for 5 minutes, Owner Mode locks automatically.'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-2xl theme-bg-card border theme-border-subtle">
            <RotateCcw className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold theme-text-app block">
                {isTl ? '100% Offline-Safe (Bypass-Proof)' : '100% Offline-Proof Protection'}
              </span>
              <span className="text-[11px] theme-text-secondary">
                {isTl
                  ? 'Nasa loob mismo ng cellphone ang verification. Hindi mabubuksan ang app kahit patayin o buksan ang internet.'
                  : 'Authentication runs on-device. Disconnecting or reconnecting the internet cannot bypass verification.'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
