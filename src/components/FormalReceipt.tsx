import React, { useEffect, useState } from 'react';
import { Printer, Share2, X, Receipt, Download } from 'lucide-react';
import type { Transaction } from '../types';
import { formatDateTime, formatPeso, formatDisplayItemName } from '../utils/formatters';
import { getStoreProfile } from '../utils/storeSettings';
import { translate, type LanguageCode } from '../utils/i18n';
import { saveModalToGalleryAsPng } from '../utils/modalGalleryExport';

interface FormalReceiptProps {
  transaction: Transaction;
  lang: LanguageCode;
  customerPhone?: string;
  customerAddress?: string;
  dueDate?: string;
  onClose: () => void;
  overrideStoreName?: string;
  overrideStoreAddress?: string;
  overrideStoreContact?: string;
  overrideSellerName?: string;
  overrideReceiptNumber?: string;
  overridePaymentMethod?: string;
  customActionNode?: React.ReactNode;
}

// Filter helper to remove pseudo-item labels that duplicate payment / debt actions
const isRealProductItem = (itemName: string): boolean => {
  if (!itemName) return false;
  const lower = itemName.trim().toLowerCase();
  const blacklisted = [
    'payment',
    'debt payment',
    'bayad',
    'bayad sa utang',
    'bayad sa pautang',
    'credit purchase',
    'pautang',
    'utang',
    'credit',
    'cash payment',
  ];
  return !blacklisted.includes(lower);
};

export const FormalReceipt: React.FC<FormalReceiptProps> = ({
  transaction,
  lang,
  customerPhone,
  customerAddress,
  dueDate,
  onClose,
  overrideStoreName,
  overrideStoreAddress,
  overrideStoreContact,
  overrideSellerName,
  overrideReceiptNumber,
  overridePaymentMethod,
  customActionNode,
}) => {
  const storeProfile = getStoreProfile();

  const isCredit = transaction.type === 'PAUTANG_RECORD';
  const receiptNumber = overrideReceiptNumber || (transaction.id != null ? String(transaction.id).padStart(6, '0') : '000001');
  const storeName = overrideStoreName || storeProfile.storeName || 'Tinda';
  const storeAddress = overrideStoreAddress || storeProfile.storeAddress || storeProfile.location || '';
  const storeContact = overrideStoreContact || storeProfile.contactNumber || storeProfile.phoneNumber || '';
  const sellerName = overrideSellerName || storeProfile.ownerName || (lang === 'tl' ? 'Tindero / Tindera' : 'Store Cashier');

  const customerName = transaction.customerName || (lang === 'tl' ? 'Walk-in Customer' : 'Walk-in Customer');

  // Filter actual real products only
  const realItems = (transaction.items || []).filter((it) => isRealProductItem(it.itemName));
  const hasRealItems = realItems.length > 0;

  const getPaymentMethodLabel = () => {
    if (overridePaymentMethod) return overridePaymentMethod;
    switch (transaction.type) {
      case 'SALE':
        return lang === 'tl' ? 'Cash / Kaliwaan' : 'Cash';
      case 'PAUTANG_RECORD':
        return lang === 'tl' ? 'Pautang (Credit)' : 'Credit';
      case 'PAUTANG_PAYMENT':
        return lang === 'tl' ? 'Bayad sa Pautang' : 'Debt Payment';
      case 'RESTOCK':
        return lang === 'tl' ? 'Restock / Dagdag Paninda' : 'Restock';
      default:
        return 'Cash';
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadReceipt = async () => {
    try {
      setIsExporting(true);
      await saveModalToGalleryAsPng('formal-receipt-modal-card', 'tinda-receipt');
    } catch (err: any) {
      console.error('[FormalReceipt] Failed to save receipt modal:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    const text = `TINDA Receipt #${receiptNumber}\nStore: ${storeName}\nCustomer: ${customerName}\nTotal: ${formatPeso(transaction.totalAmount)}\nDate: ${formatDateTime(transaction.timestamp)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt #${receiptNumber} - ${storeName}`,
          text,
        });
      } catch {
        // Cancelled by user
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Ignored
      }
    }
  };

  // Receipt greeting from storeSettings.purchaseMessage (empty if not set)
  const receiptGreeting = storeProfile.purchaseMessage ? storeProfile.purchaseMessage.trim() : '';

  useEffect(() => {
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
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overscroll-contain min-h-full animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Outer Card Container - strictly respecting theme system & responsive */}
      <div
        id="formal-receipt-modal-card"
        className="my-auto w-full max-w-sm sm:max-w-md shadow-2xl rounded-3xl overflow-hidden border theme-card theme-border-subtle transition-opacity duration-150"
        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b theme-border-subtle theme-bg-surface-subtle">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 theme-text-accent" />
            <span className="text-xs font-black uppercase tracking-wider theme-text-app">
              {lang === 'tl' ? 'Resibo ng Tindahan' : 'Store Receipt'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadReceipt}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-app hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              title={lang === 'tl' ? 'I-save bilang Larawan' : 'Save as Image'}
              aria-label="Save as Image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-app hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={lang === 'tl' ? 'I-print' : 'Print'}
              aria-label="Print"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-app hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={lang === 'tl' ? 'I-bahagi' : 'Share'}
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-app hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={translate(lang, 'btn_cancel') || 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 text-xs space-y-3.5 select-text">
          {/* Store Branding */}
          <div className="text-center space-y-0.5 pb-1">
            <h2 className="text-xs sm:text-sm font-black tracking-widest theme-text-accent uppercase">
              TINDA
            </h2>
            <div className="text-base sm:text-lg font-black theme-text-app break-words whitespace-normal">
              {storeName}
            </div>
            {storeAddress ? (
              <div className="text-[11px] theme-text-secondary leading-tight break-words whitespace-normal">
                {storeAddress}
              </div>
            ) : null}
            {storeContact ? (
              <div className="text-[11px] theme-text-secondary leading-tight break-words whitespace-normal">
                {lang === 'tl' ? 'Kontak' : 'Contact'}: {storeContact}
              </div>
            ) : null}
          </div>

          <div className="border-t border-dashed theme-border-subtle" />

          {/* Date & Receipt ID */}
          <div className="flex justify-between items-center text-[11px] theme-text-secondary flex-wrap gap-1">
            <div>
              <span className="font-semibold">{lang === 'tl' ? 'Petsa' : 'Date'}:</span>{' '}
              <span className="font-medium theme-text-app">{formatDateTime(transaction.timestamp)}</span>
            </div>
            <div className="font-mono">
              <span className="font-semibold">{lang === 'tl' ? 'Resibo' : 'Receipt'}:</span>{' '}
              <span className="font-bold theme-text-accent">#{receiptNumber}</span>
            </div>
          </div>

          {/* Customer Details Box */}
          <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-1.5 text-[11px]">
            <div className="flex justify-between items-start gap-2">
              <span className="theme-text-secondary shrink-0">{lang === 'tl' ? 'Pangalan / Suki' : 'Customer Name'}:</span>
              <span className="font-bold theme-text-app text-right break-words whitespace-normal">{customerName}</span>
            </div>
            {customerPhone && (
              <div className="flex justify-between items-center gap-2">
                <span className="theme-text-secondary shrink-0">{lang === 'tl' ? 'Kontak' : 'Contact'}:</span>
                <span className="font-mono font-medium theme-text-app">{customerPhone}</span>
              </div>
            )}
            {customerAddress && (
              <div className="flex justify-between items-start gap-2">
                <span className="theme-text-secondary shrink-0">{lang === 'tl' ? 'Tirahan / Tala' : 'Address / Notes'}:</span>
                <span className="font-medium theme-text-app text-right break-words whitespace-normal">{customerAddress}</span>
              </div>
            )}
            {transaction.handledBy && (
              <div className="flex justify-between items-start gap-2">
                <span className="theme-text-secondary shrink-0">
                  {transaction.type === 'PAUTANG_RECORD'
                    ? (lang === 'tl' ? 'Kinuha ni' : 'Received by')
                    : (lang === 'tl' ? 'Nagbayad' : 'Paid by')}:
                </span>
                <span className="font-bold text-amber-400 text-right break-words whitespace-normal">{transaction.handledBy}</span>
              </div>
            )}
          </div>

          {/* Items Table - Only rendered when there are real products */}
          {hasRealItems && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-12 text-[10px] font-black theme-text-secondary uppercase tracking-wider pb-1 border-b theme-border-subtle">
                <div className="col-span-5">{lang === 'tl' ? 'Item' : 'Item'}</div>
                <div className="col-span-2 text-center">{lang === 'tl' ? 'Qty' : 'Qty'}</div>
                <div className="col-span-2 text-right">{lang === 'tl' ? 'Presyo' : 'Price'}</div>
                <div className="col-span-3 text-right">{lang === 'tl' ? 'Halaga' : 'Amount'}</div>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {realItems.map((it, idx) => {
                  const unitPrice = it.unitPrice || (it.quantity > 0 ? it.totalPrice / it.quantity : it.totalPrice);
                  return (
                    <div key={idx} className="grid grid-cols-12 text-[11px] items-baseline py-1 border-b border-black/5 dark:border-white/5">
                      <div className="col-span-5 font-bold theme-text-app break-words whitespace-normal pr-1">
                        {formatDisplayItemName(it.itemName, lang)}
                      </div>
                      <div className="col-span-2 text-center font-mono theme-text-secondary">
                        {it.quantity}
                      </div>
                      <div className="col-span-2 text-right font-mono theme-text-secondary">
                        ₱{unitPrice.toFixed(0)}
                      </div>
                      <div className="col-span-3 text-right font-mono font-bold theme-text-app">
                        ₱{it.totalPrice.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t-2 theme-border-subtle my-1" />

          {/* Total Section */}
          <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="font-black text-xs uppercase tracking-wider theme-text-app">TOTAL:</span>
              <span className="font-mono text-base sm:text-lg font-black theme-text-accent">
                {formatPeso(transaction.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] pt-1 border-t theme-border-subtle">
              <span className="theme-text-secondary">{lang === 'tl' ? 'Paraan ng Pagbayad' : 'Payment Method'}:</span>
              <span className="font-bold theme-text-app">{getPaymentMethodLabel()}</span>
            </div>
          </div>

          {/* If Credit / Pautang */}
          {isCredit && (
            <div className="pt-2 border-t border-dashed theme-border-subtle space-y-3 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="theme-text-secondary">{lang === 'tl' ? 'Inaasahang Petsa ng Bayad' : 'Expected Payment Date'}:</span>
                <span className="font-mono font-bold text-amber-400">
                  {dueDate || (lang === 'tl' ? 'Walang Takdang Araw' : 'No set date')}
                </span>
              </div>
              <div className="pt-3 space-y-1">
                <div className="border-b border-current opacity-30 w-44 sm:w-52 mx-auto" />
                <div className="text-center text-[10px] theme-text-secondary uppercase tracking-wider font-bold">
                  {lang === 'tl' ? 'Lagda ng Customer' : 'Customer Signature'}
                </div>
              </div>
            </div>
          )}

          {/* Received By */}
          <div className="pt-1 flex justify-between items-center text-[11px] theme-text-secondary">
            <span>{lang === 'tl' ? 'Natanggap ni' : 'Received by'}:</span>
            <span className="font-bold theme-text-app break-words whitespace-normal">{sellerName}</span>
          </div>

          {/* Bottom Footer with Store Greeting */}
          <div className="text-center pt-2 space-y-1 theme-text-secondary border-t border-dashed theme-border-subtle">
            {receiptGreeting ? (
              <div className="text-[11px] font-bold theme-text-app italic break-words whitespace-normal px-2">
                “{receiptGreeting}”
              </div>
            ) : null}
            <div className="text-[10px] tracking-wide opacity-60">
              Powered by Tinda
            </div>
          </div>
          {customActionNode && (
            <div className="pt-4 border-t border-dashed theme-border-subtle mt-4 text-center w-full flex flex-col items-center justify-center space-y-3">
              {customActionNode}
            </div>
          )}
        </div>

        {/* Bottom Close Button */}
        <div className="p-3 border-t theme-border-subtle theme-bg-surface-subtle">
          <button
            type="button"
            onClick={onClose}
            className="w-full theme-bg-primary text-white font-black py-2.5 rounded-xl text-xs active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            {translate(lang, 'btn_cancel') || (lang === 'tl' ? 'Isara' : 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
