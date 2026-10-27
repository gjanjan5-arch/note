import React, { useState, useEffect, useMemo } from 'react';
import {
  Lightbulb,
  X,
  CreditCard,
  ShoppingBag,
  Store,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  Banknote,
} from 'lucide-react';
import type { LanguageCode } from '../utils/i18n';
import {
  getBuyerReceipts,
  getBuyerUtangs,
  calculateStoreNetUtang,
  calculateTotalBuyerUtang,
  type BuyerStoreUtang,
  type BuyerDigitalReceipt,
} from '../utils/buyerActivity';
import { formatPeso, formatDateTime } from '../utils/formatters';

interface BuyerRecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  onOpenActivityUtang?: () => void;
}

export const BuyerRecommendationsModal: React.FC<BuyerRecommendationsModalProps> = ({
  isOpen,
  onClose,
  lang,
  onOpenActivityUtang,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'UTANG' | 'PENDING'>('ALL');
  const [utangStores, setUtangStores] = useState<BuyerStoreUtang[]>([]);
  const [receipts, setReceipts] = useState<BuyerDigitalReceipt[]>([]);

  // Load data whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setUtangStores(getBuyerUtangs());
      setReceipts(getBuyerReceipts());
    }
  }, [isOpen]);

  // Compute pending orders and active store utangs
  const pendingReceipts = useMemo(() => {
    return receipts.filter((r) => r.status === 'PENDING' || r.paymentMethod === 'UTANG');
  }, [receipts]);

  const activeUtangStores = useMemo(() => {
    return utangStores
      .map((s) => ({
        store: s,
        netUtang: calculateStoreNetUtang(s),
      }))
      .filter((s) => s.netUtang > 0);
  }, [utangStores]);

  const totalUtangAmount = useMemo(() => {
    return calculateTotalBuyerUtang(utangStores);
  }, [utangStores]);

  const totalPendingPurchasesAmount = useMemo(() => {
    return pendingReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
  }, [pendingReceipts]);

  const hasPendingItems = activeUtangStores.length > 0 || pendingReceipts.length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="theme-card rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border theme-border overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'manipulation' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b theme-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base theme-text-app leading-tight">
                {lang === 'tl' ? 'Rekomendasyon sa Bili at Utang' : 'Purchase & Credit Recommendations'}
              </h2>
              <p className="text-[11px] theme-text-secondary font-medium">
                {lang === 'tl'
                  ? 'Paalala sa mga bayarin at payo para sa maayos na suki record'
                  : 'Reminders on pending dues and advice for great buyer credit'}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="button"
            tabIndex={0}
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose();
              }
            }}
            className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary hover:theme-text-app flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 border-b theme-border-subtle bg-black/5 dark:bg-white/5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'theme-bg-primary text-white shadow-2xs'
                : 'theme-text-secondary hover:theme-text-app'
            }`}
          >
            {lang === 'tl' ? 'Lahat' : 'Overview'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('UTANG')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'UTANG'
                ? 'theme-bg-primary text-white shadow-2xs'
                : 'theme-text-secondary hover:theme-text-app'
            }`}
          >
            <span>{lang === 'tl' ? 'Utang sa Suki' : 'Store Credits'}</span>
            {activeUtangStores.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-black">
                {activeUtangStores.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'PENDING'
                ? 'theme-bg-primary text-white shadow-2xs'
                : 'theme-text-secondary hover:theme-text-app'
            }`}
          >
            <span>{lang === 'tl' ? 'Nakabinbing Bili' : 'Pending Orders'}</span>
            {pendingReceipts.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-black">
                {pendingReceipts.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* Top KPI Card */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-2xl border theme-border-subtle theme-bg-surface-subtle">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold theme-text-secondary">
                  {lang === 'tl' ? 'Kabuuang Utang' : 'Total Credits'}
                </span>
                <CreditCard className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-base sm:text-lg font-black theme-text-app font-mono">
                {formatPeso(totalUtangAmount)}
              </div>
              <div className="text-[10px] font-bold text-amber-500 mt-0.5">
                {activeUtangStores.length} {lang === 'tl' ? 'tindahan' : 'stores with balance'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border theme-border-subtle theme-bg-surface-subtle">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold theme-text-secondary">
                  {lang === 'tl' ? 'Nakabinbing Bili' : 'Pending Orders'}
                </span>
                <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-base sm:text-lg font-black theme-text-app font-mono">
                {formatPeso(totalPendingPurchasesAmount)}
              </div>
              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {pendingReceipts.length} {lang === 'tl' ? 'nakalista' : 'recorded items'}
              </div>
            </div>
          </div>

          {/* All Good State */}
          {!hasPendingItems && (
            <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400">
                {lang === 'tl' ? 'Malinis at Walang Nakabinbing Utang!' : 'All Settled & Clear!'}
              </p>
              <p className="text-[11px] theme-text-secondary max-w-xs mx-auto">
                {lang === 'tl'
                  ? 'Wala kang aktibong utang o pending order sa iyong mga suki store. Magaling ang iyong pagbabayad!'
                  : 'You have no outstanding credit or pending orders across your saved suki stores.'}
              </p>
            </div>
          )}

          {/* Section: Pending Utang by Store */}
          {(activeTab === 'ALL' || activeTab === 'UTANG') && activeUtangStores.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider theme-text-secondary flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === 'tl' ? 'Mga Utang sa Suki Stores' : 'Pending Store Credits'}</span>
                </h3>
                <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">
                  {formatPeso(totalUtangAmount)}
                </span>
              </div>

              <div className="space-y-2">
                {activeUtangStores.map(({ store, netUtang }, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border theme-border-subtle theme-bg-card flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 theme-text-accent shrink-0" />
                        <h4 className="font-black text-xs theme-text-app truncate">
                          {store.storeName}
                        </h4>
                      </div>
                      <p className="text-[10px] theme-text-secondary mt-0.5">
                        {store.ownerName ? `Owner: ${store.ownerName} • ` : ''}
                        {store.debts.length} {lang === 'tl' ? 'nakalistang kuha' : 'debts logged'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                        {formatPeso(netUtang)}
                      </div>
                      <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300">
                        {lang === 'tl' ? 'Kailangang bayaran' : 'Balance due'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Pending Orders */}
          {(activeTab === 'ALL' || activeTab === 'PENDING') && pendingReceipts.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider theme-text-secondary flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                  <span>{lang === 'tl' ? 'Mga Nakabinbing Bili' : 'Pending Purchases'}</span>
                </h3>
                <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">
                  {pendingReceipts.length} {lang === 'tl' ? 'resibo' : 'orders'}
                </span>
              </div>

              <div className="space-y-2">
                {pendingReceipts.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-2xl border theme-border-subtle theme-bg-card flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-xs theme-text-app truncate">
                        {rec.storeName}
                      </div>
                      <p className="text-[10px] theme-text-secondary mt-0.5 truncate">
                        {rec.items.map((it) => `${it.name} (${it.qty})`).join(', ')}
                      </p>
                      <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                        {rec.paymentMethod === 'UTANG'
                          ? (lang === 'tl' ? 'Naka-utang' : 'Charged to Credit')
                          : (lang === 'tl' ? 'Naghihintay ng bayad' : 'Pending Settlement')}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-xs sm:text-sm theme-text-app">
                        {formatPeso(rec.total)}
                      </div>
                      <span className="text-[9px] theme-text-secondary">
                        {formatDateTime(rec.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Suki Financial & Credit Tips */}
          {activeTab === 'ALL' && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider theme-text-secondary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'tl' ? 'Mga Payo para sa Mabuting Suki' : 'Tips for a Trusted Suki'}</span>
              </h3>

              <div className="space-y-2">
                <div className="p-3 rounded-2xl border theme-border-subtle theme-bg-surface-subtle flex items-start gap-2.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black theme-text-app block mb-0.5">
                      {lang === 'tl' ? 'Magbayad sa napagkasunduang petsa' : 'Pay on agreed due dates'}
                    </span>
                    <p className="text-[11px] theme-text-secondary">
                      {lang === 'tl'
                        ? 'Ang maagang pagbayad sa tindahan ay nagpapatibay ng tiwala at nagbubukas ng mas mataas na credit limit.'
                        : 'Settling utang on time builds store trust and ensures you remain a VIP priority suki.'}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border theme-border-subtle theme-bg-surface-subtle flex items-start gap-2.5 text-xs">
                  <Banknote className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black theme-text-app block mb-0.5">
                      {lang === 'tl' ? 'I-update ang partial payments' : 'Keep track of partial payments'}
                    </span>
                    <p className="text-[11px] theme-text-secondary">
                      {lang === 'tl'
                        ? 'Kapag nag-abot ng bahagyang bayad, i-log agad sa "Aking Talaan at Utang" upang laging tugma ang kwentada ninyo ni tindero.'
                        : 'Log partial payments in your tracker so your records always match the store ledger.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t theme-border flex items-center justify-between gap-2 shrink-0 bg-black/5 dark:bg-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl theme-text-secondary font-bold text-xs hover:theme-text-app transition-colors cursor-pointer"
          >
            {lang === 'tl' ? 'Isara' : 'Close'}
          </button>

          {onOpenActivityUtang && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenActivityUtang();
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl theme-bg-primary text-white font-black text-xs shadow-2xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <span>{lang === 'tl' ? 'Buksan Aking Talaan at Utang' : 'Open My Activity & Utang'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
