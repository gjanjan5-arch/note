import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, RefreshCw, Store, PackageCheck, Download } from 'lucide-react';
import LZString from 'lz-string';
import { db } from '../db/db';
import type { InventoryItem } from '../types';
import { getStoreProfile, type StoreProfile } from '../utils/storeSettings';
import { type LanguageCode } from '../utils/i18n';
import { saveModalToGalleryAsPng } from '../utils/modalGalleryExport';
import { QRCode } from './QRCode';

interface StoreQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory?: InventoryItem[];
  storeSettings?: StoreProfile;
  lang: LanguageCode;
}

export const StoreQRModal: React.FC<StoreQRModalProps> = ({
  isOpen,
  onClose,
  inventory,
  storeSettings,
  lang,
}) => {
  const dbInventory =
    useLiveQuery(
      async () => {
        try {
          return await db.inventory.toArray();
        } catch (err) {
          console.warn('[StoreQRModal] inventory query fallback:', err);
          return [];
        }
      },
      [],
      []
    ) ?? [];
  const activeInventory = inventory || dbInventory;
  const profile: StoreProfile = storeSettings || getStoreProfile();

  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());
  const [isExporting, setIsExporting] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const isTl = lang === 'tl';

  const storeName = profile.storeName || 'Sari-Sari Store';
  const gcashNumber = profile.gcashNumber || '';
  const storeAddress = profile.storeAddress || '';
  const contactNumber = profile.contactNumber || '';
  const purchaseMessage = profile.purchaseMessage || '';
  const offlineText = profile.offlineText || '';
  const ownerName = profile.ownerName || '';

  const qrData = useMemo(() => {
    const syncPayload = {
      v: 5,
      t: 'SC',
      storeName,
      g: gcashNumber,
      p: contactNumber,
      loc: storeAddress,
      owner: ownerName,
      m: purchaseMessage,
      offlineText,
      i: activeInventory.map((item) => [
        item.name,
        typeof item.unitPrice === 'number' ? item.unitPrice : ((item as any).price || 0),
        item.stock ?? 0,
        item.sku || '',
        item.category || 'General',
        Array.isArray(item.variants)
          ? item.variants.map((v) => [v.label, typeof v.unitPrice === 'number' ? v.unitPrice : ((v as any).price || 0)])
          : ((item as any).unitPrices || []),
      ]),
      ts: lastRefreshed,
    };
    return LZString.compressToEncodedURIComponent(JSON.stringify(syncPayload));
  }, [activeInventory, storeName, gcashNumber, storeAddress, contactNumber, purchaseMessage, offlineText, ownerName, lastRefreshed]);

  const handleDownloadCard = async () => {
    try {
      setIsExporting(true);
      await saveModalToGalleryAsPng('store-qr-modal-card', 'tinda-store-qr');
    } catch (err: any) {
      console.error('[StoreQRModal] Failed to save modal to gallery:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-xs select-none overflow-y-auto overscroll-contain min-h-full animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="store-qr-modal-card"
        className="my-auto relative w-full max-w-sm md:max-w-md rounded-3xl theme-bg-card border theme-border shadow-2xl p-5 sm:p-6 theme-text-app flex flex-col items-center"
        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full theme-bg-surface-subtle theme-text-secondary hover:theme-text-app transition-colors cursor-pointer touch-manipulation active:scale-95"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-full flex flex-col items-center mb-4">
          <div className="flex items-center gap-2 mb-2 text-center">
            <div className="p-2 rounded-xl theme-bg-primary text-white">
              <Store className="w-4 h-4" />
            </div>
            <h3 className="font-black text-base theme-text-app truncate max-w-[220px]">{storeName}</h3>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full theme-bg-surface-subtle border theme-border-subtle text-[11px] font-bold theme-text-secondary mb-3">
            <PackageCheck className="w-3 h-3 theme-text-accent" />
            <span>{activeInventory.length} {isTl ? 'paninda sa QR' : 'items cataloged'}</span>
          </div>

          <div ref={qrContainerRef} className="p-4 bg-white rounded-3xl shadow-inner border-4 theme-border max-w-[220px] w-full aspect-square flex items-center justify-center">
            <QRCode 
              value={qrData}
              size={200}
              level="M"
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            />
          </div>
        </div>

        <div className="w-full space-y-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadCard}
            className="w-full py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer touch-manipulation active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting ? 'Saving Image...' : 'Save Image'}
            </span>
          </button>

          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={() => setLastRefreshed(Date.now())}
              className="flex-1 py-2 px-3 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border-subtle theme-text-app font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-manipulation active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 theme-text-accent" />
              <span>{isTl ? 'I-refresh' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-2xl theme-bg-primary text-white font-black text-xs flex items-center justify-center transition-colors cursor-pointer touch-manipulation active:scale-95 shadow-2xs"
            >
              <span>{isTl ? 'Isara' : 'Done'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
