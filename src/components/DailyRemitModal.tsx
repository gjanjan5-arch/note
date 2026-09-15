import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Banknote,
  Coins,
  Copy,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { db } from '../db/db';
import { formatPeso, getLocalDateStr } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';
import { getStoreProfile } from '../utils/storeSettings';
import { safeStorage } from '../utils/safeStorage';
import { ModalPortal } from './ModalPortal';

interface DailyRemitModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
}

interface DenominationConfig {
  value: number;
  label: string;
  type: 'BILL' | 'COIN';
}

const DENOMINATIONS: DenominationConfig[] = [
  { value: 1000, label: '₱1,000 Bill', type: 'BILL' },
  { value: 500, label: '₱500 Bill', type: 'BILL' },
  { value: 200, label: '₱200 Bill', type: 'BILL' },
  { value: 100, label: '₱100 Bill', type: 'BILL' },
  { value: 50, label: '₱50 Bill', type: 'BILL' },
  { value: 20, label: '₱20 Bill', type: 'BILL' },
  { value: 20, label: '₱20 Coin', type: 'COIN' },
  { value: 10, label: '₱10 Coin', type: 'COIN' },
  { value: 5, label: '₱5 Coin', type: 'COIN' },
  { value: 1, label: '₱1 Coin', type: 'COIN' },
  { value: 0.25, label: '25¢ Coin', type: 'COIN' },
];

const REMIT_STORAGE_KEY = 'tindahan_daily_remit_counts';

export const DailyRemitModal: React.FC<DailyRemitModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [todaySalesTotal, setTodaySalesTotal] = useState<number>(0);
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const todayStr = getLocalDateStr();
      db.transactions
        .where('dateStr')
        .equals(todayStr)
        .toArray()
        .then((txs) => {
          const sales = txs
            .filter((t) => t.type === 'SALE')
            .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
          setTodaySalesTotal(sales);
        })
        .catch((e) => console.warn('Could not load today sales:', e));

      try {
        const raw = safeStorage.getItem(REMIT_STORAGE_KEY);
        if (raw) {
          setCounts(JSON.parse(raw));
        } else {
          setCounts({});
        }
      } catch (e) {
        setCounts({});
      }
    }
  }, [isOpen]);

  const updateCount = (key: string, val: number) => {
    const safeVal = Math.max(0, val);
    const updated = { ...counts, [key]: safeVal };
    setCounts(updated);
    try {
      safeStorage.setItem(REMIT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Storage error:', e);
    }
  };

  const handleReset = () => {
    setCounts({});
    try {
      safeStorage.removeItem(REMIT_STORAGE_KEY);
    } catch (e) {}
  };

  // Calculate totals
  const totalPhysicalCash = useMemo(() => {
    let sum = 0;
    DENOMINATIONS.forEach((d, idx) => {
      const key = `${d.type}_${d.value}_${idx}`;
      const count = counts[key] || 0;
      sum += count * d.value;
    });
    return sum;
  }, [counts]);

  const difference = useMemo(() => {
    return totalPhysicalCash - todaySalesTotal;
  }, [totalPhysicalCash, todaySalesTotal]);

  const statusType = useMemo<'BALANCED' | 'SURPLUS' | 'SHORTAGE'>(() => {
    if (Math.abs(difference) < 0.01) return 'BALANCED';
    if (difference > 0) return 'SURPLUS';
    return 'SHORTAGE';
  }, [difference]);

  const handleCopyReport = () => {
    const store = getStoreProfile();
    const now = new Date();
    let text = `💵 ULAT NG REMIT / SARADO (${store.storeName})\n`;
    text += `Petsa: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `------------------------------------\n`;
    text += `KABUUANG HAWAK NA PERA: ${formatPeso(totalPhysicalCash)}\n`;
    text += `NAITALANG BENTA SA APP: ${formatPeso(todaySalesTotal)}\n`;
    text += `STATUS: ${
      statusType === 'BALANCED'
        ? 'SAKTO AT BALANSE (₱0.00)'
        : statusType === 'SURPLUS'
        ? `SOBRA (+${formatPeso(difference)})`
        : `KULANG (-${formatPeso(Math.abs(difference))})`
    }\n`;
    text += `------------------------------------\n`;
    text += `PAGLILINAW NG PERA:\n`;

    DENOMINATIONS.forEach((d, idx) => {
      const key = `${d.type}_${d.value}_${idx}`;
      const count = counts[key] || 0;
      if (count > 0) {
        text += `• ${d.label} x ${count} = ${formatPeso(count * d.value)}\n`;
      }
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b theme-border-subtle bg-linear-to-r from-teal-500/10 to-emerald-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg theme-text-app leading-tight">
              {translate(lang, 'remit_heading')}
            </h3>
            <p className="text-[11px] sm:text-xs theme-text-secondary mt-0.5">
              {translate(lang, 'tool_daily_remit_desc')}
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

      {/* Balance Comparison KPI Header */}
      <div className="shrink-0 p-4 theme-bg-surface-subtle border-b theme-border space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl theme-bg-card border theme-border">
            <span className="text-[10px] font-bold uppercase tracking-wider theme-text-secondary block">
              {translate(lang, 'remit_total_cash')}
            </span>
            <span className="text-xl font-black text-teal-600 dark:text-teal-400">
              {formatPeso(totalPhysicalCash)}
            </span>
          </div>

          <div className="p-3 rounded-2xl theme-bg-card border theme-border">
            <span className="text-[10px] font-bold uppercase tracking-wider theme-text-secondary block">
              {translate(lang, 'remit_system_sales')}
            </span>
            <span className="text-xl font-black theme-text-app">
              {formatPeso(todaySalesTotal)}
            </span>
          </div>
        </div>

        {/* Discrepancy Status Card */}
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            statusType === 'BALANCED'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : statusType === 'SURPLUS'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusType === 'BALANCED' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : statusType === 'SURPLUS' ? (
              <TrendingUp className="w-5 h-5 text-blue-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <div>
              <span className="text-xs font-black block">
                {statusType === 'BALANCED'
                  ? translate(lang, 'remit_status_balanced')
                  : statusType === 'SURPLUS'
                  ? translate(lang, 'remit_status_surplus')
                  : translate(lang, 'remit_status_shortage')}
              </span>
              <span className="text-[11px] opacity-80 block">
                {translate(lang, 'remit_difference')}
              </span>
            </div>
          </div>

          <span className="text-lg font-black">
            {statusType === 'BALANCED'
              ? '₱0.00'
              : statusType === 'SURPLUS'
              ? `+${formatPeso(difference)}`
              : `-${formatPeso(Math.abs(difference))}`}
          </span>
        </div>
      </div>

      {/* Denomination Counter Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {copiedToast && (
          <div className="p-2.5 rounded-xl bg-teal-600 text-white text-center text-xs font-black shadow-lg mb-2">
            {translate(lang, 'remit_report_copied')}
          </div>
        )}

        <div className="space-y-2">
          {DENOMINATIONS.map((d, idx) => {
            const key = `${d.type}_${d.value}_${idx}`;
            const count = counts[key] || 0;
            const subtotal = count * d.value;

            return (
              <div
                key={key}
                className="p-2.5 rounded-2xl theme-bg-card border theme-border flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-[110px]">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 ${
                      d.type === 'BILL' ? 'bg-teal-600' : 'bg-amber-600'
                    }`}
                  >
                    {d.type === 'BILL' ? (
                      <Banknote className="w-4 h-4" />
                    ) : (
                      <Coins className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black theme-text-app block leading-tight">
                      {d.label}
                    </span>
                    <span className="text-[10px] theme-text-secondary">
                      {formatPeso(subtotal)}
                    </span>
                  </div>
                </div>

                {/* Numeric Count Stepper */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateCount(key, count - 1)}
                    className="w-8 h-8 rounded-xl theme-bg-surface-subtle border theme-border flex items-center justify-center font-black theme-text-app hover:theme-bg-surface active:scale-95 cursor-pointer text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={(e) => updateCount(key, parseInt(e.target.value) || 0)}
                    className="w-14 text-center py-1.5 rounded-xl text-xs font-black theme-input-box"
                  />
                  <button
                    type="button"
                    onClick={() => updateCount(key, count + 1)}
                    className="w-8 h-8 rounded-xl theme-bg-surface-subtle border theme-border flex items-center justify-center font-black theme-text-app hover:theme-bg-surface active:scale-95 cursor-pointer text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer CTAs */}
      <div className="shrink-0 p-4 border-t theme-border flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{translate(lang, 'remit_reset_counts')}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReport}
            className="py-2.5 px-4 rounded-2xl theme-bg-card theme-text-app border theme-border hover:theme-border-strong text-xs font-black flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{translate(lang, 'remit_copy_report')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md cursor-pointer active:scale-95 transition-transform"
          >
            {translate(lang, 'btn_close')}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
