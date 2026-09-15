import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Receipt,
  QrCode,
  Store,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  DollarSign,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { QRCode } from './QRCode';
import LZString from 'lz-string';
import type { LanguageCode } from '../utils/i18n';
import { formatPeso, formatDateTime } from '../utils/formatters';
import type { Transaction } from '../types';
import { FormalReceipt } from './FormalReceipt';
import {
  getBuyerUtangs,
  getBuyerReceipts,
  calculateStoreNetUtang,
  calculateTotalBuyerUtang,
  type BuyerStoreUtang,
  type BuyerDigitalReceipt,
} from '../utils/buyerActivity';

interface MyActivityUtangModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
}

export const MyActivityUtangModal: React.FC<MyActivityUtangModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'UTANG' | 'RECEIPTS'>('UTANG');
  const [storeUtangs, setStoreUtangs] = useState<BuyerStoreUtang[]>([]);
  const [receipts, setReceipts] = useState<BuyerDigitalReceipt[]>([]);
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [selectedProofStore, setSelectedProofStore] = useState<BuyerStoreUtang | null>(null);
  const [selectedReceiptForQr, setSelectedReceiptForQr] = useState<BuyerDigitalReceipt | null>(null);

  const isTl = lang === 'tl';

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscroll || '';
    };
  }, [isOpen]);

  // Load utangs and receipts when modal opens & register Escape key listener
  useEffect(() => {
    if (isOpen) {
      const u = getBuyerUtangs();
      const r = getBuyerReceipts();
      setStoreUtangs(u);
      setReceipts(r);
      if (u.length > 0 && !expandedStoreId) {
        setExpandedStoreId(u[0].storeId);
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (selectedProofStore) {
            setSelectedProofStore(null);
          } else if (selectedReceiptForQr) {
            setSelectedReceiptForQr(null);
          } else {
            onClose();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedProofStore, selectedReceiptForQr, onClose]);

  const totalOutstanding = useMemo(() => {
    return calculateTotalBuyerUtang(storeUtangs);
  }, [storeUtangs]);

  // Generate offline verification QR code payload for debts
  const qrVerificationPayload = useMemo(() => {
    if (!selectedProofStore) return '';
    const netBalance = calculateStoreNetUtang(selectedProofStore);
    const payload = {
      type: 'UTANG_PROOF_VERIFICATION',
      storeId: selectedProofStore.storeId,
      storeName: selectedProofStore.storeName,
      balance: netBalance,
      debtsCount: selectedProofStore.debts.length,
      paymentsCount: selectedProofStore.payments.length,
      ts: Date.now(),
      clientRef: `PRF-${Date.now().toString(36).toUpperCase()}`,
    };
    return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  }, [selectedProofStore]);

  // Generate canonical Order QR payload for saved receipt re-scan / proof
  const receiptQrPayload = useMemo(() => {
    if (!selectedReceiptForQr) return '';
    if (selectedReceiptForQr.qrPayload) {
      return selectedReceiptForQr.qrPayload;
    }
    const orderPayload = {
      v: 2,
      type: 'BUYER_ORDER',
      id: selectedReceiptForQr.id,
      storeName: selectedReceiptForQr.storeName,
      items: selectedReceiptForQr.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        variantLabel: i.variantLabel,
        isCustomRequest: i.isCustomRequest,
      })),
      total: selectedReceiptForQr.total,
      cash: selectedReceiptForQr.cash,
      paymentMethod: selectedReceiptForQr.paymentMethod,
      ts: selectedReceiptForQr.timestamp,
    };
    return LZString.compressToEncodedURIComponent(JSON.stringify(orderPayload));
  }, [selectedReceiptForQr]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-2 sm:p-4 md:p-6 flex flex-col items-center justify-start sm:justify-center min-h-full animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-150 cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="my-auto relative w-full max-w-xl md:max-w-3xl flex flex-col theme-bg-card rounded-3xl border theme-border shadow-2xl z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b theme-border-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black theme-text-app">
                {isTl ? 'Aking Talaan at Utang' : 'My Activity & Utang'}
              </h2>
              <p className="text-xs theme-text-secondary">
                {isTl
                  ? 'Digital receipts at tala ng utang sa mga suki tindahan'
                  : 'Digital receipts & store utang records'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl theme-text-secondary hover:theme-text-app hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Outstanding Utang Summary Card */}
        <div className="p-4 sm:p-5 pb-3">
          <div className="p-4 rounded-3xl theme-bg-surface-subtle border theme-border flex items-center justify-between gap-4 shadow-inner">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>{isTl ? 'Kabuuang Balanse ng Utang' : 'Total Outstanding Utang'}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black theme-text-app mt-1">
                {formatPeso(totalOutstanding)}
              </div>
              <p className="text-[10px] theme-text-secondary mt-0.5">
                {storeUtangs.filter((s) => calculateStoreNetUtang(s) > 0).length}{' '}
                {isTl ? 'aktibong tindahan na may tala' : 'stores with active balance'}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                totalOutstanding > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {totalOutstanding > 0 ? (isTl ? 'May Utang' : 'Active Balance') : (isTl ? 'Bayad Lahat' : 'All Settled')}
              </span>
            </div>
          </div>
        </div>

        {/* Dual Tab Navigation */}
        <div className="px-4 sm:px-5 flex items-center gap-2 border-b theme-border-subtle pb-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('UTANG')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-opacity duration-150 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'UTANG'
                ? 'theme-bg-primary text-white shadow-xs'
                : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{isTl ? 'Talaan ng Utang' : 'Utang Ledger'}</span>
            <span className="text-[10px] opacity-75 font-mono">({storeUtangs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RECEIPTS')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-opacity duration-150 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'RECEIPTS'
                ? 'theme-bg-primary text-white shadow-xs'
                : 'theme-text-secondary hover:theme-text-app hover:theme-bg-surface-subtle'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{isTl ? 'Mga Resibo' : 'Recent Purchases'}</span>
            <span className="text-[10px] opacity-75 font-mono">({receipts.length})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {activeTab === 'UTANG' && (
            <div className="space-y-3">
              {storeUtangs.length === 0 ? (
                <div className="text-center py-12 theme-text-secondary space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 opacity-60" />
                  <p className="text-sm font-bold theme-text-app">
                    {isTl ? 'Walang nakatalang utang' : 'No recorded utang'}
                  </p>
                  <p className="text-xs">
                    {isTl
                      ? 'Lahat ng iyong transaksyon ay bayad at malinis.'
                      : 'All your store transactions are settled.'}
                  </p>
                </div>
              ) : (
                storeUtangs.map((store) => {
                  const net = calculateStoreNetUtang(store);
                  const isExpanded = expandedStoreId === store.storeId;

                  return (
                    <div
                      key={store.storeId}
                      className="theme-card rounded-3xl border theme-border overflow-hidden transition-all shadow-xs"
                    >
                      {/* Store Card Header */}
                      <div
                        onClick={() => setExpandedStoreId(isExpanded ? null : store.storeId)}
                        className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:theme-bg-surface-subtle transition-colors select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-2xl theme-bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                            🏪
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-xs sm:text-sm theme-text-app truncate">
                              {store.storeName}
                            </h3>
                            <p className="text-[10px] theme-text-secondary truncate mt-0.5">
                              {store.ownerName ? `${isTl ? 'May-ari:' : 'Owner:'} ${store.ownerName}` : 'Suki Store'} • {store.debts.length} {isTl ? 'tala' : 'entries'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xs sm:text-sm font-black theme-text-app block">
                              {formatPeso(net)}
                            </span>
                            <span className="text-[10px] font-bold text-amber-400">
                              {net > 0 ? (isTl ? 'Balanse' : 'Balance') : (isTl ? 'Bayad' : 'Settled')}
                            </span>
                          </div>

                          <div className="p-1 rounded-xl theme-bg-surface-subtle theme-text-secondary">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Store Itemized Breakdown */}
                      {isExpanded && (
                        <div className="border-t theme-border-subtle p-3.5 sm:p-4 bg-black/10 space-y-3 animate-in fade-in duration-150">
                          {/* Itemized Debts */}
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider theme-text-secondary mb-1.5 flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3" />
                              <span>{isTl ? 'Mga Inutang na Paninda' : 'Itemized Debts'}</span>
                            </div>
                            <div className="space-y-1.5">
                              {store.debts.map((d) => (
                                <div
                                  key={d.id}
                                  className="p-2.5 rounded-2xl theme-bg-surface-subtle border theme-border-subtle flex items-center justify-between text-xs"
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <div className="font-bold theme-text-app truncate">{d.description}</div>
                                    <div className="text-[10px] theme-text-secondary mt-0.5">{d.date}</div>
                                  </div>
                                  <div className="font-black theme-text-app shrink-0">
                                    {formatPeso(d.amount)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Payments / Hulog */}
                          {store.payments.length > 0 && (
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{isTl ? 'Mga Naibayad / Hulog' : 'Partial Payments'}</span>
                              </div>
                              <div className="space-y-1.5">
                                {store.payments.map((p) => (
                                  <div
                                    key={p.id}
                                    className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs"
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <div className="font-bold text-emerald-300 truncate">
                                        {p.note || (isTl ? 'Bayad' : 'Payment')}
                                      </div>
                                      <div className="text-[10px] text-emerald-400/80 mt-0.5">{p.date}</div>
                                    </div>
                                    <div className="font-black text-emerald-400 shrink-0">
                                      -{formatPeso(p.amount)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Show QR Proof to Owner Button */}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => setSelectedProofStore(store)}
                              className="w-full py-2.5 px-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                            >
                              <QrCode className="w-4 h-4" />
                              <span>{isTl ? '📱 Ipakita ang QR Patunay sa May-ari' : '📱 Show QR Proof to Owner'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'RECEIPTS' && (
            <div className="space-y-2.5">
              {receipts.length === 0 ? (
                <div className="text-center py-12 theme-text-secondary space-y-2">
                  <Receipt className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-sm font-bold theme-text-app">
                    {isTl ? 'Wala pang digital resibo' : 'No receipts logged yet'}
                  </p>
                  <p className="text-xs">
                    {isTl
                      ? 'Ang mga binili mong paninda ay magpapakita dito pagkatapos mag-order.'
                      : 'Orders placed via QR will appear in your digital receipt ledger.'}
                  </p>
                </div>
              ) : (
                receipts.map((rec) => (
                  <div
                    key={rec.id}
                    className="theme-card rounded-3xl p-3.5 sm:p-4 border theme-border space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b theme-border-subtle pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Store className="w-4 h-4 theme-text-accent shrink-0" />
                        <span className="font-black text-xs sm:text-sm theme-text-app truncate">
                          {rec.storeName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono theme-text-secondary shrink-0">
                        {formatDateTime(rec.timestamp)}
                      </span>
                    </div>

                    {/* Item list */}
                    <div className="space-y-1">
                      {rec.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="theme-text-app truncate pr-2">
                            {item.qty}x {item.name}
                            {item.variantLabel && (
                              <span className="theme-text-secondary text-[10px]"> ({item.variantLabel})</span>
                            )}
                          </span>
                          <span className="theme-text-secondary font-mono shrink-0">
                            {formatPeso(item.price * item.qty)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t theme-border-subtle text-xs font-black">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono border ${
                          rec.paymentMethod === 'GCASH'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                            : rec.paymentMethod === 'UTANG'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {rec.paymentMethod}
                        </span>
                        {rec.cash && rec.cash > 0 && (
                          <span className="text-[10px] font-semibold theme-text-secondary">
                            ({isTl ? 'Bayad:' : 'Paid:'} {formatPeso(rec.cash)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptForQr(rec)}
                          className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title={isTl ? 'Ipakita ang Purchase QR' : 'Show Purchase QR'}
                        >
                          <QrCode className="w-3 h-3" />
                          <span>{isTl ? 'QR Patunay' : 'View QR'}</span>
                        </button>
                        <span className="text-sm theme-text-app font-black">
                          {formatPeso(rec.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trust & Verification QR Modal Overlay for Utang */}
      {selectedProofStore && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm theme-bg-card rounded-3xl border theme-border p-5 text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>{isTl ? 'Patunay ng Utang' : 'Utang Verification'}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofStore(null)}
                className="p-1 rounded-full theme-text-secondary hover:theme-text-app"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black theme-text-app">
                {selectedProofStore.storeName}
              </h3>
              <p className="text-xs theme-text-secondary mt-0.5">
                {isTl ? 'Kabuuang Balanse Ayon sa Iyong Tala' : 'Current Balance According to Suki'}
              </p>
              <div className="text-2xl font-black text-emerald-400 mt-2">
                {formatPeso(calculateStoreNetUtang(selectedProofStore))}
              </div>
            </div>

            {/* High-contrast QR Container */}
            <div className="p-4 bg-white rounded-3xl inline-block mx-auto shadow-md border-4 border-emerald-500/40">
              <QRCode
                value={qrVerificationPayload}
                size={180}
                level="M"
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              />
            </div>

            <p className="text-[11px] theme-text-secondary leading-relaxed px-2">
              {isTl
                ? 'Ipakita ang QR na ito sa may-ari ng tindahan upang mabilis na ma-cross check ang talaan kahit walang internet.'
                : 'Show this QR code to the store owner to quickly cross-check totals across the counter offline.'}
            </p>

            <button
              type="button"
              onClick={() => setSelectedProofStore(null)}
              className="w-full py-3 rounded-2xl theme-bg-primary text-white font-bold text-xs cursor-pointer active:scale-98 transition-all"
            >
              {isTl ? 'Naintindihan / Isara' : 'Done / Close'}
            </button>
          </div>
        </div>
      )}

      {/* Saved Purchase QR Code Viewer Modal / Formal Receipt */}
      {selectedReceiptForQr && (() => {
        const mappedTransaction: Transaction = {
          id: parseInt(selectedReceiptForQr.id.replace(/\D/g, '').slice(-6)) || 0,
          timestamp: selectedReceiptForQr.timestamp,
          dateStr: new Date(selectedReceiptForQr.timestamp).toISOString().split('T')[0],
          type: selectedReceiptForQr.paymentMethod === 'UTANG' ? 'PAUTANG_RECORD' : 'SALE',
          customerName: isTl ? 'Mamimili' : 'Buyer',
          totalAmount: selectedReceiptForQr.total,
          items: selectedReceiptForQr.items.map(it => ({
            itemName: `${it.name} ${it.variantLabel ? `(${it.variantLabel})` : ''}`.trim(),
            quantity: it.qty,
            totalPrice: it.qty * it.price,
            unitPrice: it.price
          })),
          rawNote: '',
          syncStatus: 'LOCAL'
        };
        
        return (
          <FormalReceipt
            transaction={mappedTransaction}
            lang={lang}
            onClose={() => setSelectedReceiptForQr(null)}
            overrideStoreName={selectedReceiptForQr.storeName}
            overrideStoreContact={selectedReceiptForQr.contactNumber}
            overrideStoreAddress={selectedReceiptForQr.storeAddress}
            overrideSellerName={selectedReceiptForQr.ownerName}
            overrideReceiptNumber={selectedReceiptForQr.id.slice(-6)}
            overridePaymentMethod={selectedReceiptForQr.paymentMethod}
            customActionNode={
              <>
                <div className="text-[10px] font-black uppercase tracking-wider theme-text-secondary">
                  {isTl ? 'Patunay ng Pagbili (Order QR)' : 'Purchase Proof QR'}
                </div>
                <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-sm border border-emerald-500/20">
                  <QRCode
                    value={receiptQrPayload}
                    size={140}
                    level="M"
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  />
                </div>
                <p className="text-[9px] theme-text-secondary leading-relaxed px-4 opacity-70">
                  {isTl
                    ? 'Maaaring i-scan muli ng tindera ang QR na ito o ipakita bilang opisyal na patunay ng iyong order.'
                    : 'The seller can re-scan this QR code or use it as official verified proof of your order.'}
                </p>
              </>
            }
          />
        );
      })()}
    </div>
  );
};
