import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode,
  Scan,
  Store,
  Plus,
  Minus,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Clock,
  Search,
  Package,
  Info,
  X,
  MapPin,
  Phone,
  User,
  CreditCard,
  MessageSquarePlus,
  ShoppingBag,
  ArrowLeft,
  Sparkles,
  Trash2,
  Receipt,
  PanelLeft,
} from 'lucide-react';
import { QRCode } from './QRCode';
import LZString from 'lz-string';
import { bleSyncManager, type BleSyncState } from '../utils/bleOrderSync';
import {
  ensureBlePermission,
  promptOpenLocationSettings,
} from '../utils/blePermission';
import { formatPeso } from '../utils/formatters';
import type { LanguageCode } from '../utils/i18n';
import { playScanBeep } from '../utils/audioBeep';
import { safeStorage } from '../utils/safeStorage';
import type { Transaction } from '../types';
import { FormalReceipt } from './FormalReceipt';
import { saveBuyerReceipt, recordBuyerUtang } from '../utils/buyerActivity';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { ScannerModal } from './ScannerModal';
import type { CatalogItem, CatalogPayload } from '../types';

export interface BuyerModeProps {
  lang: LanguageCode;
  onSwitchToSeller: () => void;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  onOpenActivityUtang?: () => void;
  selectedStoreFromSearch?: CatalogPayload | null;
  onClearSelectedStoreFromSearch?: () => void;
  scanStoreRequested?: boolean;
  onResetScanStoreRequest?: () => void;
  scannedStoreRaw?: string | null;
  onClearScannedStoreRaw?: () => void;
}

interface SelectedCartItem {
  name: string;
  sku?: string;
  price: number;
  qty: number;
  maxStock: number;
  variantLabel?: string;
  isCustomRequest?: boolean;
}

const SAVED_STORES_KEY = 'tindahan_saved_suki_stores';

const getWelcomeGreetingTitle = (lang: LanguageCode, storeName: string) => {
  switch (lang) {
    case 'en':
      return `Welcome to ${storeName}!`;
    case 'ja':
      return `${storeName}へようこそ！`;
    case 'zh':
      return `欢迎光临 ${storeName}！`;
    case 'ko':
      return `${storeName}에 오신 것을 환영합니다!`;
    case 'tl':
    default:
      return `Maligayang Pagdating sa ${storeName}!`;
  }
};

const getWelcomeGreetingDesc = (lang: LanguageCode) => {
  switch (lang) {
    case 'en':
      return 'Shop fast, order via QR, and leave notes for Suki. Tap anywhere to get started!';
    case 'ja':
      return 'スピーディーにお買い物、QRでご注文、Sukiにメモを残せます。タップして開始！';
    case 'zh':
      return '快速选购、QR码下单、留言给店主。点击任意位置开始！';
    case 'ko':
      return '빠른 쇼핑, QR 주문, 메세지 남기기. 아무 데나 탭하여 시작하세요!';
    case 'tl':
    default:
      return 'Mamili nang mabilis, mag-order sa QR, at mag-iwan ng paalala para kay Suki. I-tap kahit saan para magsimula!';
  }
};

const getWelcomeGreetingAction = (lang: LanguageCode) => {
  switch (lang) {
    case 'en':
      return '👆 Tap anywhere to enter...';
    case 'ja':
      return '👆 タップして入場...';
    case 'zh':
      return '👆 点击任意位置进入...';
    case 'ko':
      return '👆 아무 데나 탭하여 입장...';
    case 'tl':
    default:
      return '👆 I-tap kahit saan para pumasok...';
  }
};

export const BuyerMode: React.FC<BuyerModeProps> = ({
  lang,
  onSwitchToSeller,
  onOpenMenu,
  onOpenSearch,
  onOpenActivityUtang,
  selectedStoreFromSearch,
  onClearSelectedStoreFromSearch,
  scanStoreRequested,
  onResetScanStoreRequest,
  scannedStoreRaw,
  onClearScannedStoreRaw,
}) => {
  const [savedStores, setSavedStores] = useState<CatalogPayload[]>([]);
  const [activeCatalog, setActiveCatalog] = useState<CatalogPayload | null>(null);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState<boolean>(false);
  const [showStoreInfoSheet, setShowStoreInfoSheet] = useState<boolean>(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState<boolean>(false);
  const [variantModalProduct, setVariantModalProduct] = useState<CatalogItem | null>(null);
  const [focusedVariant, setFocusedVariant] = useState<{ label: string; price: number } | null>(null);

  const [isScanningStore, setIsScanningStore] = useState<boolean>(false);
  const [isGeneratingOrder, setIsGeneratingOrder] = useState<boolean>(false);
  const [cart, setCart] = useState<{ [key: string]: SelectedCartItem }>({});
  const [buyerCash, setBuyerCash] = useState<string>('');
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'CASH' | 'UTANG'>('CASH');
  const [generatedOrderQr, setGeneratedOrderQr] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isOrderConfirmedBySeller, setIsOrderConfirmedBySeller] = useState<boolean>(false);
  const [syncSecondsLeft, setSyncSecondsLeft] = useState<number>(10);
  const [orderExpiry, setOrderExpiry] = useState<number>(0);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('30:00');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [orderDoneToast, setOrderDoneToast] = useState<string | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<CatalogPayload | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [bleState, setBleState] = useState<BleSyncState>(() => bleSyncManager.getState());

  // Sync selected store from global search
  useEffect(() => {
    if (selectedStoreFromSearch) {
      setActiveCatalog(selectedStoreFromSearch);
      onClearSelectedStoreFromSearch?.();
    }
  }, [selectedStoreFromSearch, onClearSelectedStoreFromSearch]);

  // Sync external scan store request from drawer
  useEffect(() => {
    if (scanStoreRequested) {
      setIsScanningStore(true);
      onResetScanStoreRequest?.();
    }
  }, [scanStoreRequested, onResetScanStoreRequest]);

  // Custom Item Request form state
  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemPrice, setCustomItemPrice] = useState<string>('');

  // Load saved stores from safeStorage
  useEffect(() => {
    try {
      const raw = safeStorage.getItem(SAVED_STORES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(
            (s: CatalogPayload) =>
              s &&
              s.storeName &&
              !s.storeName.toLowerCase().includes("aling nena's sari-sari store")
          );
          if (clean.length !== parsed.length) {
            safeStorage.setItem(SAVED_STORES_KEY, JSON.stringify(clean));
          }
          setSavedStores(clean);
        }
      }
    } catch (_) {}
  }, []);

  // Save stores to safeStorage helper
  const saveStoreToSukiList = (storeData: CatalogPayload) => {
    setSavedStores((prev) => {
      const filtered = prev.filter((s) => s.storeName !== storeData.storeName);
      const updated = [storeData, ...filtered];
      try {
        safeStorage.setItem(SAVED_STORES_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  // Remove store from safeStorage helper
  const removeStoreFromSukiList = (storeNameToRemove: string) => {
    setSavedStores((prev) => {
      const updated = prev.filter((s) => s.storeName !== storeNameToRemove);
      try {
        safeStorage.setItem(SAVED_STORES_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
    if (activeCatalog && activeCatalog.storeName === storeNameToRemove) {
      setActiveCatalog(null);
      setCart({});
      setShowStoreInfoSheet(false);
    }
    setStoreToDelete(null);
  };

  // Subscribe to BleSyncManager state changes (Phase 1)
  useEffect(() => {
    const unsubscribe = bleSyncManager.onStateChange((state) => {
      setBleState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Cleanup BLE on unmount
  useEffect(() => {
    return () => {
      bleSyncManager.cleanup();
    };
  }, []);

  // Ensure BLE is cleaned up whenever the QR modal is closed
  useEffect(() => {
    if (!generatedOrderQr) {
      bleSyncManager.cleanup();
    }
  }, [generatedOrderQr]);

  // Foreground reliability (Phase 2):
  // If app goes to background (visibilitychange) while QR is showing -> pause BLE gracefully, resume when foregrounded again.
  // Do NOT crash or throw errors if BLE state is stale.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        bleSyncManager.pauseSync().catch(() => {});
      } else {
        if (generatedOrderQr && !isOrderConfirmedBySeller) {
          bleSyncManager.resumeSync().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [generatedOrderQr, isOrderConfirmedBySeller]);

  // When BLE confirmation succeeds (SYNCED): mark as confirmed without prematurely auto-closing
  useEffect(() => {
    if (bleState === 'SYNCED' && generatedOrderQr && !isOrderConfirmedBySeller) {
      setIsOrderConfirmedBySeller(true);
      playScanBeep('success');
    }
  }, [bleState, generatedOrderQr, isOrderConfirmedBySeller]);

  // 10-second sync window countdown
  useEffect(() => {
    if (!generatedOrderQr || isOrderConfirmedBySeller) return;
    if (syncSecondsLeft <= 0) return;

    const timer = setTimeout(() => {
      setSyncSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [generatedOrderQr, isOrderConfirmedBySeller, syncSecondsLeft]);

  // 30-minute order QR countdown
  useEffect(() => {
    if (!orderExpiry) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, orderExpiry - now);
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeftStr(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);

      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orderExpiry]);

  // Listen for seller scan confirmation of the generated Order QR
  useEffect(() => {
    if (!currentOrderId || !generatedOrderQr) return;

    const checkOrderConfirmed = () => {
      try {
        const processed: string[] = JSON.parse(
          safeStorage.getItem('processed_buyer_orders') || '[]'
        );
        if (processed.includes(currentOrderId)) {
          setIsOrderConfirmedBySeller((prev) => {
            if (!prev) {
              playScanBeep('success');
            }
            return true;
          });
        }
      } catch (_) {}
    };

    checkOrderConfirmed();
    const interval = setInterval(checkOrderConfirmed, 1000);

    const handleCustomEvent = (e: any) => {
      if (e.detail?.orderId === currentOrderId) {
        setIsOrderConfirmedBySeller(true);
        playScanBeep('success');
      }
    };
    window.addEventListener('buyer_order_confirmed', handleCustomEvent);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('tindahan_order_channel');
      bc.onmessage = (event) => {
        if (
          event.data?.type === 'ORDER_CONFIRMED' &&
          event.data?.orderId === currentOrderId
        ) {
          setIsOrderConfirmedBySeller(true);
          playScanBeep('success');
        }
      };
    } catch (_) {}

    return () => {
      clearInterval(interval);
      window.removeEventListener('buyer_order_confirmed', handleCustomEvent);
      if (bc) bc.close();
    };
  }, [currentOrderId, generatedOrderQr]);

  const isAnyBuyerModalOpen = Boolean(
    showWelcomeSplash ||
    showStoreInfoSheet ||
    showCustomItemModal ||
    variantModalProduct !== null ||
    generatedOrderQr !== null ||
    storeToDelete !== null
  );

  useEffect(() => {
    if (!isAnyBuyerModalOpen) return;
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
  }, [isAnyBuyerModalOpen]);

  // Handle Scanning Store Catalog QR
  const handleStartScanStore = () => {
    setScanError(null);
    setIsScannerOpen(true);
  };

  const processStoreQrData = (rawString?: string) => {
    if (!rawString) return;

    try {
      const trimmed = rawString.trim();
      let jsonStr = LZString.decompressFromEncodedURIComponent(trimmed);
      if (!jsonStr) {
        jsonStr = LZString.decompressFromBase64(trimmed);
      }
      if (!jsonStr) {
        jsonStr = trimmed;
      }

      const parsed: any = JSON.parse(jsonStr);

      // Check if valid Store Catalog (v4 compact schema, v3, or legacy format)
      const isV5 = Boolean(parsed && parsed.v === 5 && parsed.t === 'SC');
      const isV4 = Boolean(parsed && parsed.v === 4 && parsed.t === 'SC' && Array.isArray(parsed.info));
      const isV3 = Boolean(parsed && (parsed.v === 3 || parsed.t === 'SC' || Array.isArray(parsed.i)));
      const isLegacy = Boolean(
        parsed && (parsed.type === 'STORE_CATALOG' || parsed.storeName) && Array.isArray(parsed.items)
      );

      if (!isV5 && !isV4 && !isV3 && !isLegacy) {
        throw new Error('Invalid Store QR structure');
      }

      let storeName = '';
      let ownerName = '';
      let contactNumber = '';
      let storeAddress = '';
      let gcashNumber = '';
      let purchaseMessage = '';
      let offlineText = '';
      let ts = Date.now();
      let page = 1;
      let totalPages = 1;
      let incomingItems: CatalogItem[] = [];

      if (isV5) {
        storeName = String(parsed.storeName || (lang === 'tl' ? 'Aking Tindahan' : 'My Store'));
        gcashNumber = String(parsed.g || '');
        contactNumber = String(parsed.p || '');
        storeAddress = String(parsed.loc || '');
        purchaseMessage = String(parsed.m || '');
        offlineText = String(parsed.offlineText || '');
        ownerName = String(parsed.ownerName || '');
        ts = parsed.ts || Date.now();
        incomingItems = (parsed.i || parsed.items || []).map((tuple: any) => {
          if (!Array.isArray(tuple)) {
            return {
              name: String(tuple.name || ''),
              price: Number(tuple.unitPrice ?? tuple.price ?? 0),
              stock: Number(tuple.stock || 0),
              sku: tuple.sku ? String(tuple.sku) : undefined,
              category: tuple.category ? String(tuple.category) : undefined,
              variants: tuple.variants,
            };
          }
          const [name, rawPrice, stock, sku, category, rawVariants] = tuple;
          let variants: { label: string; price: number }[] | undefined = undefined;
          if (Array.isArray(rawVariants) && rawVariants.length > 0) {
            variants = rawVariants.map((v: any) =>
              Array.isArray(v)
                ? { label: String(v[0]), price: Number(v[1] || 0) }
                : { label: String(v.label), price: Number(v.unitPrice ?? v.price ?? 0) }
            );
          }
          return {
            name: String(name || ''),
            price: Number(rawPrice ?? (tuple as any).unitPrice ?? (tuple as any).price ?? 0),
            stock: Number(stock || 0),
            sku: sku ? String(sku) : undefined,
            category: category ? String(category) : undefined,
            variants,
          };
        });
      } else if (isV4) {
        // v4 schema: info: [storeName, gcash, address, phone, purchaseMessage, offlineText, ownerName], items: [[id, name, price, stock, category, rawVariants]]
        storeName = String(parsed.info[0] || (lang === 'tl' ? 'Aking Tindahan' : 'My Store'));
        gcashNumber = String(parsed.info[1] || '');
        storeAddress = String(parsed.info[2] || '');
        contactNumber = String(parsed.info[3] || '');
        purchaseMessage = String(parsed.info[4] || '');
        offlineText = String(parsed.info[5] || parsed.offlineText || parsed.ot || '');
        ownerName = String(parsed.info[6] || parsed.ownerName || parsed.o || '');
        ts = parsed.ts || Date.now();
        page = 1;
        totalPages = 1;

        incomingItems = (parsed.items || []).map((tuple: any) => {
          if (!Array.isArray(tuple)) {
            return {
              name: String(tuple.name || ''),
              price: Number(tuple.unitPrice ?? tuple.price ?? 0),
              stock: Number(tuple.stock || 0),
              sku: tuple.sku ? String(tuple.sku) : undefined,
              category: tuple.category ? String(tuple.category) : undefined,
              variants: tuple.variants,
            };
          }
          const [, name, rawPrice, stock, category, rawVariants] = tuple;
          let variants: { label: string; price: number }[] | undefined = undefined;
          if (Array.isArray(rawVariants) && rawVariants.length > 0) {
            variants = rawVariants.map((v: any) =>
              Array.isArray(v)
                ? { label: String(v[0]), price: Number(v[1] || 0) }
                : { label: String(v.label), price: Number(v.unitPrice ?? v.price ?? 0) }
            );
          }
          return {
            name: String(name || ''),
            price: Number(rawPrice ?? (tuple as any).unitPrice ?? (tuple as any).price ?? 0),
            stock: Number(stock || 0),
            category: category ? String(category) : undefined,
            variants,
          };
        });
      } else if (isV3) {
        storeName = parsed.s || parsed.storeName || (lang === 'tl' ? 'Aking Tindahan' : 'My Store');
        ownerName = parsed.o || parsed.ownerName || '';
        contactNumber = parsed.c || parsed.contactNumber || '';
        storeAddress = parsed.a || parsed.storeAddress || '';
        gcashNumber = parsed.g || parsed.gcashNumber || '';
        purchaseMessage = parsed.m || parsed.purchaseMessage || '';
        offlineText = parsed.ot || parsed.offlineText || '';
        ts = parsed.ts || Date.now();
        page = Number(parsed.p || parsed.page || 1);
        totalPages = Number(parsed.tp || parsed.totalPages || 1);

        // Convert compact array tuples: [name, price, stock, sku, category, rawVariants]
        incomingItems = (parsed.i || []).map((tuple: any) => {
          if (!Array.isArray(tuple)) {
            return {
              name: String(tuple.name || ''),
              price: Number(tuple.unitPrice ?? tuple.price ?? 0),
              stock: Number(tuple.stock || 0),
              sku: tuple.sku ? String(tuple.sku) : undefined,
              category: tuple.category ? String(tuple.category) : undefined,
              variants: tuple.variants,
            };
          }
          const [name, rawPrice, stock, sku, category, rawVariants] = tuple;
          let variants: { label: string; price: number }[] | undefined = undefined;
          if (Array.isArray(rawVariants) && rawVariants.length > 0) {
            variants = rawVariants.map((v: any) =>
              Array.isArray(v)
                ? { label: String(v[0]), price: Number(v[1] || 0) }
                : { label: String(v.label), price: Number(v.unitPrice ?? v.price ?? 0) }
            );
          }
          return {
            name: String(name || ''),
            price: Number(rawPrice ?? (tuple as any).unitPrice ?? (tuple as any).price ?? 0),
            stock: Number(stock || 0),
            sku: sku ? String(sku) : undefined,
            category: category ? String(category) : undefined,
            variants,
          };
        });
      } else {
        // Legacy format
        storeName = parsed.storeName || (lang === 'tl' ? 'Aking Tindahan' : 'My Store');
        ownerName = parsed.ownerName || '';
        contactNumber = parsed.contactNumber || '';
        storeAddress = parsed.storeAddress || '';
        gcashNumber = parsed.gcashNumber || '';
        purchaseMessage = parsed.purchaseMessage || '';
        offlineText = parsed.offlineText || '';
        ts = parsed.ts || Date.now();
        page = Number(parsed.page || 1);
        totalPages = Number(parsed.totalPages || 1);
        incomingItems = Array.isArray(parsed.items) ? parsed.items : [];
      }

      // Handle Rewrite & Multi-Page Chunk Aggregation
      let mergedItems: CatalogItem[] = incomingItems;
      const isSameStore = activeCatalog && activeCatalog.storeName === storeName;

      if (totalPages > 1 && isSameStore && activeCatalog) {
        // Multi-page catalog for the same store: merge new page items without wiping previous pages
        const existingMap = new Map<string, CatalogItem>();
        activeCatalog.items.forEach((item) => {
          existingMap.set(item.name, item);
        });
        incomingItems.forEach((item) => {
          existingMap.set(item.name, item);
        });
        mergedItems = Array.from(existingMap.values());
      } else {
        // Fresh store or single-page catalog: rewrite current catalog with fresh new data
        mergedItems = incomingItems;
      }

      const updatedCatalog: CatalogPayload = {
        v: isV4 ? 4 : 3,
        type: 'STORE_CATALOG',
        storeName,
        ownerName,
        contactNumber,
        storeAddress,
        gcashNumber,
        purchaseMessage,
        offlineText,
        ts,
        page,
        totalPages,
        items: mergedItems,
      };

      setActiveCatalog(updatedCatalog);
      saveStoreToSukiList(updatedCatalog);
      playScanBeep('success');
      setScanError(null);

      // Feedback for multi-page scanning
      if (totalPages > 1 && page < totalPages) {
        const msg =
          lang === 'tl'
            ? `Na-scan ang Pahina ${page} ng ${totalPages} (${mergedItems.length} kabuuang paninda). I-scan ang susunod na QR pahina!`
            : lang === 'ja'
            ? `ページ ${page}/${totalPages} をスキャンしました（合計 ${mergedItems.length} 件）。次のページをスキャンしてください。`
            : lang === 'zh'
            ? `已扫描第 ${page}/${totalPages} 页（共 ${mergedItems.length} 件商品）。请扫描下一页。`
            : lang === 'ko'
            ? `${totalPages}페이지 중 ${page}페이지를 스캔했습니다(총 ${mergedItems.length}개 상품). 다음 페이지를 스캔하세요.`
            : `Scanned page ${page} of ${totalPages} (${mergedItems.length} total items). Scan next page!`;
        setScanError(msg);
      } else {
        setShowWelcomeSplash(true);
      }
    } catch (err) {
      console.error('Failed to parse Store QR:', err);
      playScanBeep('error');
      setScanError(
        lang === 'tl'
          ? 'Mali ang na-scan na QR. Siguraduhing Store QR ito mula sa tindahan.'
          : 'Invalid QR code. Please scan a valid Store Catalog QR.'
      );
    }
  };

  // Sync scanned raw string from App scanner
  useEffect(() => {
    if (scannedStoreRaw) {
      processStoreQrData(scannedStoreRaw);
      onClearScannedStoreRaw?.();
    }
  }, [scannedStoreRaw, onClearScannedStoreRaw]);

  const handleSelectStoreCard = (store: CatalogPayload) => {
    setActiveCatalog(store);
    setCart({});
    setShowWelcomeSplash(true);
  };

  // Add/Update Item in Cart
  const handleUpdateQty = (
    item: CatalogItem,
    delta: number,
    selectedVariant?: { label: string; price: number }
  ) => {
    const key = selectedVariant ? `${item.name}-${selectedVariant.label}` : item.name;
    const currentQty = cart[key]?.qty || 0;
    const newQty = currentQty + delta;
    const maxStock = item.stock;

    if (newQty <= 0) {
      const nextCart = { ...cart };
      delete nextCart[key];
      setCart(nextCart);
      return;
    }

    if (newQty > maxStock) return;

    setCart((prev) => ({
      ...prev,
      [key]: {
        name: item.name,
        sku: item.sku,
        price: selectedVariant ? selectedVariant.price : item.price,
        qty: newQty,
        maxStock,
        variantLabel: selectedVariant?.label,
      },
    }));
  };

  // Handle adding custom requested item
  const handleAddCustomRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = customItemName.trim();
    if (!nameTrimmed) return;

    const estPrice = parseFloat(customItemPrice) || 0;
    const key = `REQUESTED-${nameTrimmed}`;

    setCart((prev) => ({
      ...prev,
      [key]: {
        name: nameTrimmed,
        price: estPrice,
        qty: Math.max(1, customItemQty),
        maxStock: 999,
        isCustomRequest: true,
      },
    }));

    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemPrice('');
    setShowCustomItemModal(false);
  };

  // Cart total calculations
  const totalAmount = useMemo(() => {
    return (Object.values(cart) as SelectedCartItem[]).reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );
  }, [cart]);

  const cashNum = parseFloat(buyerCash) || 0;
  const changeAmount = cashNum >= totalAmount ? cashNum - totalAmount : 0;
  const shortAmount = cashNum > 0 && cashNum < totalAmount ? totalAmount - cashNum : 0;

  // Generate Buyer Order QR Code
  const handleGenerateOrderQr = async () => {
    if (isGeneratingOrder) return;
    setIsGeneratingOrder(true);

    const itemsList = (Object.values(cart) as SelectedCartItem[]).map((i) => ({
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      price: i.price,
      variantLabel: i.variantLabel,
      isCustomRequest: i.isCustomRequest,
    }));

    if (itemsList.length === 0) {
      setIsGeneratingOrder(false);
      return;
    }

    const expiryTime = Date.now() + 30 * 60 * 1000;
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const paymentMethod = paymentMethodChoice === 'UTANG'
      ? 'UTANG'
      : cashNum >= totalAmount
      ? 'CASH'
      : cashNum > 0
      ? 'PARTIAL_CASH'
      : 'CASH';

    const orderPayload = {
      v: 2,
      type: 'BUYER_ORDER',
      id: orderId,
      storeName: activeCatalog?.storeName || 'Tindahan',
      items: itemsList,
      total: totalAmount,
      cash: paymentMethodChoice === 'CASH' && cashNum > 0 ? cashNum : undefined,
      paymentMethod,
      ts: Date.now(),
      exp: expiryTime,
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(orderPayload));

    // Reset 10-second sync window countdown
    setSyncSecondsLeft(10);

    // BLE Sync: Re-check hardware, auto-request Bluetooth/Location enablement & start sync strictly if needed
    try {
      const hardwareState = await bleSyncManager.initialize();
      if (hardwareState !== 'UNSUPPORTED') {
        const { granted, locationEnabled } = await ensureBlePermission(true);
        if (granted) {
          // If location is specifically needed by the device platform and not active, trigger automatically
          if (!locationEnabled) {
            promptOpenLocationSettings().catch(() => {});
          }
          bleSyncManager.startBuyerSync(orderId);
        }
      }
    } catch (_) {}

    // Note: Saving to "My Activity" and "Utang" is deferred until the order is confirmed
    // and the receipt is closed by the buyer, preventing ghost entries and storage bloat.
    setCurrentOrderId(orderId);
    setIsOrderConfirmedBySeller(false);
    setGeneratedOrderQr(compressed);
    setOrderExpiry(expiryTime);
    playScanBeep('success');
    setIsGeneratingOrder(false);
  };

  // Handle Closing the Order QR Modal
  // If confirmed: commit the clean receipt to My Activity and Utang (without bulky qrPayload)
  // If unconfirmed/cancelled: discard temporary order state so no storage is consumed
  const handleCloseOrderQrModal = (isConfirmedAction: boolean = false) => {
    const isConfirmed = isOrderConfirmedBySeller || isConfirmedAction;

    if (isConfirmed) {
      try {
        const itemsList = (Object.values(cart) as SelectedCartItem[]).map((i) => ({
          name: i.name,
          qty: i.qty,
          price: i.price,
          variantLabel: i.variantLabel,
          isCustomRequest: i.isCustomRequest,
        }));

        saveBuyerReceipt({
          id: currentOrderId || `ORD-${Date.now()}`,
          storeName: activeCatalog?.storeName || 'Tindahan',
          ownerName: activeCatalog?.ownerName,
          storeAddress: activeCatalog?.storeAddress,
          contactNumber: activeCatalog?.contactNumber,
          gcashNumber: activeCatalog?.gcashNumber,
          timestamp: Date.now(),
          items: itemsList,
          total: totalAmount,
          cash: paymentMethodChoice === 'CASH' && cashNum > 0 ? cashNum : undefined,
          change: paymentMethodChoice === 'CASH' && changeAmount > 0 ? changeAmount : undefined,
          paymentMethod: paymentMethodChoice === 'UTANG'
            ? 'UTANG'
            : cashNum >= totalAmount
            ? 'CASH'
            : cashNum > 0
            ? 'PARTIAL_CASH'
            : 'CASH',
          status: 'CONFIRMED',
        });

        if (paymentMethodChoice === 'UTANG') {
          const itemSummary = itemsList.map((i) => `${i.qty}x ${i.name}`).join(', ');
          recordBuyerUtang(
            activeCatalog?.storeName || 'Tindahan',
            activeCatalog?.ownerName,
            itemSummary,
            totalAmount
          );
        }
      } catch (err) {
        console.warn('[BuyerMode] Error saving receipt on close:', err);
      }

      setCart({});
      setBuyerCash('');
      setGeneratedOrderQr(null);
      setCurrentOrderId(null);
      setIsOrderConfirmedBySeller(false);
      setOrderExpiry(0);
      playScanBeep('success');
      setOrderDoneToast(
        lang === 'tl'
          ? 'Salamat sa pag-order! Na-save sa My Activity ang iyong resibo.'
          : 'Thank you for ordering! Receipt saved to My Activity.'
      );
      bleSyncManager.cleanup();
      setTimeout(() => setOrderDoneToast(null), 4000);
    } else {
      // Unconfirmed or cancelled by buyer:
      // Discard temporary QR payload to ensure zero storage bloat
      setGeneratedOrderQr(null);
      setCurrentOrderId(null);
      setIsOrderConfirmedBySeller(false);
      bleSyncManager.cleanup();
    }
  };

  const filteredCatalogItems = useMemo(() => {
    if (!activeCatalog || !Array.isArray(activeCatalog.items)) return [];
    if (!searchFilter.trim()) return activeCatalog.items;
    const query = searchFilter.toLowerCase();
    return activeCatalog.items.filter((item) => item.name.toLowerCase().includes(query));
  }, [activeCatalog, searchFilter]);

  return (
    <div
      className={`min-h-screen theme-bg-app theme-text-app ${
        activeCatalog && Object.keys(cart).length > 0 ? 'pb-64 sm:pb-56' : activeCatalog ? 'pb-12' : 'pb-24'
      } font-sans antialiased`}
    >
      {/* Buyer Dedicated Top Title Bar Header */}
      <header className="sticky top-0 z-30 theme-bg-header backdrop-blur-md border-b theme-border shadow-2xs transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 safe-pt-header pb-2.5 flex items-center justify-between gap-2">
          {/* Top Left: Drawer menu button (or Back if activeCatalog) */}
          <div className="flex items-center gap-2">
            {activeCatalog ? (
              <button
                type="button"
                onClick={() => setActiveCatalog(null)}
                className="p-2 rounded-xl theme-bg-surface-subtle theme-text-secondary hover:theme-text-app border theme-border-subtle transition-colors cursor-pointer"
                title={lang === 'tl' ? 'Bumalik sa Suki Stores' : 'Back to Stores'}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenMenu}
                className="p-2 rounded-xl theme-bg-surface-subtle theme-text-app hover:theme-bg-surface border theme-border-subtle transition-colors cursor-pointer"
                title="Open Menu"
                aria-label="Open Menu"
              >
                <PanelLeft className="w-5 h-5 stroke-[2.2]" />
              </button>
            )}

            {/* Center / Brand mark */}
            {activeCatalog ? (
              <button
                type="button"
                onClick={() => setShowStoreInfoSheet(true)}
                className="flex items-center gap-2 theme-bg-surface-subtle hover:theme-bg-surface py-1.5 px-3 rounded-2xl border theme-border transition-all cursor-pointer active:scale-95 touch-manipulation text-left"
                title={lang === 'tl' ? 'Tingnan ang detalye ng tindahan' : 'View store details'}
              >
                <div className="w-7 h-7 rounded-xl theme-bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  🏪
                </div>
                <div className="text-left leading-tight min-w-0">
                  <div className="text-xs font-black theme-text-app truncate max-w-[140px] sm:max-w-[200px]">
                    {activeCatalog.storeName}
                  </div>
                  <div className="text-[10px] font-bold theme-text-accent flex items-center gap-1">
                    <Info className="w-2.5 h-2.5" />
                    <span>{lang === 'tl' ? 'Detatye' : 'Store Info'}</span>
                  </div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-2xl theme-bg-primary text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                  🛒
                </div>
                <div>
                  <h1 className="text-xs sm:text-sm font-black theme-text-app leading-none">
                    Tinda
                  </h1>
                  <p className="text-[10px] theme-text-secondary font-medium">
                    {lang === 'tl' ? 'Customer / Suki Portal' : 'Customer / Suki Portal'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Controls: Unified Global Search button trigger */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border text-xs font-bold theme-text-secondary hover:theme-text-app transition-all cursor-pointer active:scale-95"
            >
              <Search className="w-4 h-4 stroke-[2.2] theme-text-app shrink-0" />
              <span className="hidden sm:inline">
                {lang === 'tl' ? 'Maghanap sa Suki Stores...' : 'Search Suki Stores...'}
              </span>
              <span className="sm:hidden">
                {lang === 'tl' ? 'Hanap...' : 'Search...'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Buyer Body Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 pt-4 space-y-4">
        {!activeCatalog ? (
          /* SAVED STORES HOME VIEW (Positioned at the top per requirements) */
          <div className="space-y-4">
            {scanError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{scanError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScanError(null)}
                  className="text-rose-300 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Saved Store Cards Minimalist Grid (TOP PRIORITY CONTENT) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black theme-text-app uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 theme-text-accent" />
                  <span>{lang === 'tl' ? 'Na-save na Mga Tindahan' : 'SAVED STORES'} ({savedStores.length})</span>
                </h2>
              </div>

              {savedStores.length === 0 ? (
                <div className="rounded-3xl p-8 text-center border border-dashed border-emerald-900/50 bg-[#0B2E21] theme-card theme-text-secondary space-y-3 shadow-lg">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black theme-text-app">
                      {lang === 'tl' ? 'Wala pang na-save na Suki Store' : 'No saved stores yet'}
                    </p>
                    <p className="text-xs theme-text-secondary max-w-xs mx-auto mt-1">
                      {lang === 'tl'
                        ? 'I-scan ang QR code ng paboritong tindahan upang ma-save ito dito at makapag-order offline.'
                        : 'Scan a store QR code to bookmark it here and order offline anytime.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedStores.map((store, idx) => (
                    <motion.div
                      key={idx}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectStoreCard(store)}
                      className="theme-card rounded-3xl p-4 border theme-border hover:border-emerald-500/50 transition-all text-left shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer touch-manipulation group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl theme-bg-primary text-white font-black text-base flex items-center justify-center shrink-0 shadow-2xs">
                          🏪
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-xs sm:text-sm theme-text-app truncate">
                            {store.storeName}
                          </h3>
                          <p className="text-[11px] theme-text-secondary truncate mt-0.5">
                            {store.ownerName ? `Owner: ${store.ownerName}` : 'Suki Sari-Sari Store'}
                          </p>
                          <p className="text-[10px] theme-text-accent font-bold mt-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>{store.items.length} {lang === 'tl' ? 'Paninda' : 'Products'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-900/20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectStoreCard(store);
                          }}
                          className="px-3 py-1.5 rounded-xl theme-bg-primary text-white font-black text-xs hover:opacity-90 transition-all cursor-pointer active:scale-95"
                        >
                          {lang === 'tl' ? 'Buksan Tindahan' : 'Open Store'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStoreToDelete(store);
                          }}
                          className="p-2 rounded-xl hover:bg-rose-500/15 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title={lang === 'tl' ? 'Alisin ang tindahan' : 'Remove store'}
                          aria-label={lang === 'tl' ? 'Alisin ang tindahan' : 'Remove store'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Floating Scan Store QR Button (FAB) positioned bottom-center */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
              <button
                type="button"
                onClick={handleStartScanStore}
                disabled={isScanningStore}
                className="backdrop-blur-md bg-[#0a2c1f]/90 border border-emerald-500/30 shadow-2xl rounded-full px-6 py-3 flex items-center gap-2 text-emerald-300 hover:text-white font-black text-xs sm:text-sm hover:bg-[#0a2c1f] transition-all cursor-pointer active:scale-95 select-none"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'tl' ? 'I-scan ang Store QR' : 'Scan Store QR'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE STORE CATALOG VIEW */
          <div className="space-y-3">
            {/* Action Bar with Custom Item Request (individual tab search input removed) */}
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-black theme-text-secondary">
                {activeCatalog.items.length} {lang === 'tl' ? 'panindang mabibili' : 'products available'}
              </div>

              <button
                type="button"
                onClick={() => setShowCustomItemModal(true)}
                className="theme-bg-primary hover:opacity-95 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-95 touch-manipulation"
                title={lang === 'tl' ? 'Mag-request ng wala sa listahan' : 'Request unlisted item'}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'tl' ? 'Dagdag Ibang Item' : 'Add Custom Item'}</span>
                <span className="sm:hidden">{lang === 'tl' ? 'Dagdag Item' : 'Add Item'}</span>
              </button>
            </div>

            {/* Product Items Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredCatalogItems.map((item, idx) => {
                const isOutOfStock = item.stock <= 0;
                const baseCartKey = item.name;
                const baseQty = cart[baseCartKey]?.qty || 0;

                const hasVariants = Boolean(item.variants && item.variants.length > 0);
                const totalVariantQty = hasVariants && item.variants
                  ? item.variants.reduce(
                      (sum, v) => sum + (cart[`${item.name}-${v.label}`]?.qty || 0),
                      0
                    )
                  : 0;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (hasVariants && !isOutOfStock) {
                        setVariantModalProduct(item);
                        setFocusedVariant(null);
                      }
                    }}
                    className={`theme-card rounded-3xl p-3 border transition-all flex flex-col justify-between select-none ${
                      isOutOfStock
                        ? 'opacity-50 grayscale theme-border-subtle'
                        : hasVariants
                        ? 'theme-border hover:border-[var(--color-primary)] cursor-pointer active:scale-98'
                        : 'theme-border hover:border-[var(--color-primary)]'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-xs theme-text-app line-clamp-2 mb-1">{item.name}</h4>
                      <div className="theme-text-accent font-black text-sm">
                        {formatPeso(item.price)}
                      </div>
                      <div className="text-[10px] font-semibold theme-text-secondary mb-2">
                        {isOutOfStock
                          ? lang === 'tl'
                            ? 'Wala na / Out of Stock'
                            : 'Out of Stock'
                          : `${item.stock} ${lang === 'tl' ? 'natitira' : 'in stock'}`}
                      </div>

                      {/* Clean Variant Count Badge (Tapping opens clean focused modal) */}
                      {hasVariants && !isOutOfStock && item.variants && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVariantModalProduct(item);
                            setFocusedVariant(null);
                          }}
                          className={`w-full py-1.5 px-2.5 rounded-xl border text-left flex items-center justify-between text-[11px] font-bold transition-all cursor-pointer ${
                            totalVariantQty > 0
                              ? 'theme-bg-surface border-[var(--color-primary)] theme-text-app shadow-2xs'
                              : 'theme-bg-surface-subtle theme-border-subtle theme-text-secondary hover:theme-text-app'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Sparkles className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                            <span className="truncate">{item.variants.length} {lang === 'tl' ? 'Pagpipilian' : 'Variants'}</span>
                          </span>
                          <span className="text-[10px] shrink-0 font-extrabold theme-text-accent">
                            {totalVariantQty > 0
                              ? `${totalVariantQty} ${lang === 'tl' ? 'napili' : 'selected'}`
                              : (lang === 'tl' ? 'Pumili' : 'Select')}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Standard Quantity Adjuster for items WITHOUT variants */}
                    {!isOutOfStock && !hasVariants && (
                      <div className="flex items-center justify-between theme-bg-surface-subtle rounded-2xl p-1 mt-1 border theme-border-subtle">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQty(item, -1);
                          }}
                          disabled={baseQty === 0}
                          className="p-1.5 rounded-xl theme-bg-surface hover:theme-bg-card disabled:opacity-30 theme-text-app transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-black text-xs theme-text-accent">{baseQty}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQty(item, 1);
                          }}
                          disabled={baseQty >= item.stock}
                          className="p-1.5 rounded-xl theme-bg-surface hover:theme-bg-card disabled:opacity-30 theme-text-app transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Panel */}
      {activeCatalog && Object.keys(cart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 theme-bg-nav backdrop-blur-md border-t theme-border p-3.5 shadow-2xl">
          <div className="max-w-lg mx-auto space-y-2.5">
            {/* Selected Items Summary Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(Object.values(cart) as SelectedCartItem[]).map((item, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1 rounded-xl theme-bg-surface border theme-border-subtle text-xs font-bold theme-text-app shrink-0 flex items-center gap-1.5"
                >
                  <span>
                    {item.qty}x {item.name} {item.variantLabel ? `(${item.variantLabel})` : ''}
                    {item.isCustomRequest && ' 📝'}
                  </span>
                  <span className="theme-text-accent font-black">{formatPeso(item.qty * item.price)}</span>
                </div>
              ))}
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl theme-bg-card border theme-border">
              <button
                type="button"
                onClick={() => setPaymentMethodChoice('CASH')}
                className={`py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethodChoice === 'CASH'
                    ? 'theme-bg-primary text-white shadow-xs'
                    : 'theme-text-secondary hover:theme-text-app'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>{lang === 'tl' ? '💵 Cash / Kaliwaan' : '💵 Cash / FTF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethodChoice('UTANG')}
                className={`py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethodChoice === 'UTANG'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'theme-text-secondary hover:theme-text-app'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{lang === 'tl' ? '📱 Credit / Utang QR' : '📱 Credit / Utang QR'}</span>
              </button>
            </div>

            {/* Money / Cash Input & Total */}
            {paymentMethodChoice === 'CASH' ? (
              <div className="grid grid-cols-2 gap-2 items-center theme-bg-card p-2.5 rounded-2xl border theme-border">
                <div className="flex items-center gap-2 px-1">
                  <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
                  <input
                    type="number"
                    value={buyerCash}
                    onChange={(e) => setBuyerCash(e.target.value)}
                    placeholder={lang === 'tl' ? 'Pera ko (₱)...' : 'My Money (₱)...'}
                    className="w-full bg-transparent text-xs font-bold theme-text-app placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="text-right pr-1">
                  <div className="text-[10px] font-bold theme-text-secondary">{lang === 'tl' ? 'Kabuuan' : 'Total'}</div>
                  <div className="text-base font-black theme-text-accent">{formatPeso(totalAmount)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between theme-bg-card p-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
                <div className="text-[11px] font-semibold text-amber-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'tl' ? 'Itatala sa iyong Utang Ledger' : 'Will log to your Utang Ledger'}</span>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-amber-400">{formatPeso(totalAmount)}</div>
                </div>
              </div>
            )}

            {/* Change or Shortage Display for Cash */}
            {paymentMethodChoice === 'CASH' && cashNum > 0 && (
              <div className="flex justify-between items-center text-xs font-bold px-1">
                {cashNum >= totalAmount ? (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'tl' ? 'Sukli:' : 'Change:'} {formatPeso(changeAmount)}</span>
                  </span>
                ) : (
                  <span className="text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'tl' ? 'Kulang ng:' : 'Short by:'} {formatPeso(shortAmount)}</span>
                  </span>
                )}
              </div>
            )}

            {/* Generate Order QR Button */}
            <button
              type="button"
              disabled={isGeneratingOrder}
              onClick={handleGenerateOrderQr}
              className={`w-full py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all cursor-pointer active:scale-98 disabled:opacity-50 ${
                paymentMethodChoice === 'UTANG'
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'theme-bg-primary text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>
                {isGeneratingOrder
                  ? lang === 'tl'
                    ? 'Inihahanda ang QR...'
                    : 'Generating QR...'
                  : paymentMethodChoice === 'UTANG'
                  ? lang === 'tl'
                    ? 'Ipakita ang Utang Order QR'
                    : 'Generate Utang Order QR'
                  : lang === 'tl'
                  ? 'Handa Na / Generate Order QR'
                  : 'Generate Order QR'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 1. WELCOME SPLASH ENTRANCE OVERLAY */}
      <AnimatePresence>
        {showWelcomeSplash && activeCatalog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWelcomeSplash(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer select-none"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm rounded-3xl theme-bg-card border theme-border shadow-2xl p-6 text-center space-y-4"
            >
              <div className="w-16 h-16 mx-auto rounded-3xl theme-bg-primary text-white font-black text-3xl flex items-center justify-center shadow-lg">
                🏪
              </div>

              <div>
                <h2 className="text-lg font-black theme-text-app">
                  {getWelcomeGreetingTitle(lang, activeCatalog.storeName)}
                </h2>
                <p className="text-xs theme-text-secondary mt-1.5 leading-relaxed font-medium">
                  {getWelcomeGreetingDesc(lang)}
                </p>
              </div>

              <div className="pt-2 text-[11px] font-extrabold theme-text-accent ">
                {getWelcomeGreetingAction(lang)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. TOP-LEFT STORE INFORMATION SHEET */}
      <AnimatePresence>
        {showStoreInfoSheet && activeCatalog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowStoreInfoSheet(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl theme-bg-card border theme-border shadow-2xl p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b theme-border-subtle pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl theme-bg-primary text-white flex items-center justify-center font-bold text-base shadow-xs">
                    🏪
                  </div>
                  <div>
                    <h3 className="text-sm font-black theme-text-app">{activeCatalog.storeName}</h3>
                    <p className="text-[10px] font-bold theme-text-accent">
                      {lang === 'tl' ? 'Impormasyon ng Suki Store' : 'Store Profile & Info'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowStoreInfoSheet(false)}
                  className="p-1.5 rounded-xl theme-bg-surface-subtle theme-text-secondary hover:theme-text-app transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Details List */}
              <div className="space-y-3 text-xs">
                {activeCatalog.ownerName && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl theme-bg-surface-subtle">
                    <User className="w-4 h-4 theme-text-accent shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold theme-text-secondary">{lang === 'tl' ? 'May-ari' : 'Owner'}</div>
                      <div className="font-bold theme-text-app">{activeCatalog.ownerName}</div>
                    </div>
                  </div>
                )}

                {activeCatalog.storeAddress && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl theme-bg-surface-subtle">
                    <MapPin className="w-4 h-4 theme-text-accent shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold theme-text-secondary">{lang === 'tl' ? 'Lokasyon' : 'Address'}</div>
                      <div className="font-bold theme-text-app">{activeCatalog.storeAddress}</div>
                    </div>
                  </div>
                )}

                {activeCatalog.gcashNumber && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl theme-bg-surface-subtle">
                    <CreditCard className="w-4 h-4 theme-text-accent shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold theme-text-secondary">GCash / Payment</div>
                      <div className="font-bold theme-text-app">{activeCatalog.gcashNumber}</div>
                    </div>
                  </div>
                )}

                {activeCatalog.contactNumber && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl theme-bg-surface-subtle">
                    <Phone className="w-4 h-4 theme-text-accent shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold theme-text-secondary">{lang === 'tl' ? 'Telepono' : 'Contact'}</div>
                      <div className="font-bold theme-text-app">{activeCatalog.contactNumber}</div>
                    </div>
                  </div>
                )}

                {activeCatalog.purchaseMessage && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">
                      {lang === 'tl' ? 'Mensahe mula sa Tindahan' : 'Store Message'}
                    </div>
                    <div className="italic">“{activeCatalog.purchaseMessage}”</div>
                  </div>
                )}
                {activeCatalog.offlineText && (
                  <div className="p-3 rounded-2xl theme-bg-surface-subtle border theme-border-subtle theme-text-app text-xs mt-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider theme-text-accent mb-0.5">
                      Offline Sharing Text
                    </div>
                    <div className="italic">“{activeCatalog.offlineText}”</div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowStoreInfoSheet(false);
                    handleStartScanStore();
                  }}
                  className="w-full py-2.5 rounded-2xl theme-bg-surface-subtle border theme-border hover:theme-bg-surface theme-text-app font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <QrCode className="w-4 h-4 theme-text-accent" />
                  <span>{lang === 'tl' ? 'I-update ang Tindahan (Scan QR)' : 'Update Store (Scan QR)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeCatalog) {
                      setStoreToDelete(activeCatalog);
                    }
                  }}
                  className="w-full py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {lang === 'tl'
                      ? 'Alisin ang Tindahang Ito'
                      : lang === 'ja'
                      ? 'この店舗を削除'
                      : lang === 'zh'
                      ? '移除此店铺'
                      : lang === 'ko'
                      ? '이 매장 삭제'
                      : 'Remove this Store'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStoreInfoSheet(false)}
                  className="w-full py-2.5 rounded-2xl theme-bg-primary text-white font-extrabold text-xs cursor-pointer active:scale-98"
                >
                  {lang === 'tl' ? 'Isara' : 'Close'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. CUSTOM ITEM REQUEST MODAL */}
      <AnimatePresence>
        {showCustomItemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCustomItemModal(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl theme-bg-card border theme-border shadow-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between border-b theme-border-subtle pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl theme-bg-primary/20 theme-text-accent">
                    <MessageSquarePlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black theme-text-app">
                    {lang === 'tl' ? 'Dagdag Ibang Item (Custom Request)' : 'Add Custom Requested Item'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomItemModal(false)}
                  className="p-1 rounded-lg theme-text-secondary hover:theme-text-app"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCustomRequest} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold theme-text-app mb-1">
                    {lang === 'tl' ? 'Pangalan ng Item / Pakiusap:' : 'Item Name / Request:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    placeholder={lang === 'tl' ? 'Hal. 2 packs Yelo, Marlboro Lights' : 'E.g. 2 packs Ice'}
                    className="w-full theme-input border rounded-xl p-2.5 text-xs font-bold theme-text-app focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold theme-text-app mb-1">
                      {lang === 'tl' ? 'Dami (Qty):' : 'Quantity:'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={customItemQty}
                      onChange={(e) => setCustomItemQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full theme-input border rounded-xl p-2.5 text-xs font-bold theme-text-app focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold theme-text-app mb-1">
                      {lang === 'tl' ? 'Tantyang Presyo (₱):' : 'Est. Price (₱):'}
                    </label>
                    <input
                      type="number"
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value)}
                      placeholder="0"
                      className="w-full theme-input border rounded-xl p-2.5 text-xs font-bold theme-text-app focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomItemModal(false)}
                    className="px-3 py-2 rounded-xl text-xs font-bold theme-text-secondary"
                  >
                    {lang === 'tl' ? 'Kanselahin' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-extrabold theme-bg-primary text-white shadow-2xs"
                  >
                    {lang === 'tl' ? 'I-dagdag sa Cart' : 'Add to Cart'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. PRODUCT VARIANT FOCUSED SELECTION MODAL */}
      <AnimatePresence>
        {variantModalProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVariantModalProduct(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl theme-bg-card border theme-border shadow-2xl p-5 theme-text-app"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="absolute top-4 right-4 p-2 rounded-full theme-bg-surface-subtle theme-text-secondary hover:theme-text-app transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="mb-4 pr-8">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full theme-bg-surface-subtle text-[10px] font-black uppercase tracking-wider theme-text-accent mb-1">
                  <Sparkles className="w-3 h-3 text-[var(--color-primary)]" />
                  <span>{lang === 'tl' ? 'Mga Pagpipilian' : 'Product Options'}</span>
                </div>
                <h3 className="text-base font-black theme-text-app leading-tight truncate">
                  {variantModalProduct.name}
                </h3>
                <p className="text-xs theme-text-secondary mt-0.5">
                  {variantModalProduct.stock} {lang === 'tl' ? 'kabuuang stock' : 'total in stock'}
                </p>
              </div>

              {/* FOCUSED VARIANT: When a variant is selected, hide the others and show adjuster + Add Another Variant button */}
              {focusedVariant ? (
                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl theme-bg-surface-subtle border-2 border-[var(--color-primary)] space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider theme-text-secondary">
                          {lang === 'tl' ? 'Napiling Variant' : 'Selected Variant'}
                        </span>
                        <h4 className="text-sm font-black theme-text-app">{focusedVariant.label}</h4>
                      </div>
                      <div className="text-sm font-black theme-text-accent">
                        {formatPeso(focusedVariant.price)}
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    {(() => {
                      const vKey = `${variantModalProduct.name}-${focusedVariant.label}`;
                      const qty = cart[vKey]?.qty || 0;
                      return (
                        <div className="flex items-center justify-between theme-bg-surface rounded-2xl p-2 border theme-border">
                          <span className="text-xs font-bold theme-text-secondary px-2">
                            {lang === 'tl' ? 'Dami (Qty):' : 'Quantity:'}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(variantModalProduct, -1, focusedVariant)}
                              disabled={qty === 0}
                              className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:theme-bg-card disabled:opacity-30 theme-text-app flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-black text-sm theme-text-accent min-w-[24px] text-center">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(variantModalProduct, 1, focusedVariant)}
                              disabled={qty >= variantModalProduct.stock}
                              className="w-8 h-8 rounded-xl theme-bg-primary text-white disabled:opacity-30 flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-xs"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Add Another Variant button */}
                  <button
                    type="button"
                    onClick={() => setFocusedVariant(null)}
                    className="w-full py-2.5 px-3 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border-subtle theme-text-app font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-95 touch-manipulation"
                  >
                    <Plus className="w-3.5 h-3.5 theme-text-accent" />
                    <span>{lang === 'tl' ? 'Magdagdag ng Ibang Variant' : 'Add Another Variant'}</span>
                  </button>

                  {/* Done button */}
                  <button
                    type="button"
                    onClick={() => setVariantModalProduct(null)}
                    className="w-full py-2.5 px-3 rounded-2xl theme-bg-primary text-white font-black text-xs flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <span>{lang === 'tl' ? 'Tapos na' : 'Done'}</span>
                  </button>
                </div>
              ) : (
                /* VARIANT SELECTION LIST */
                <div className="space-y-3">
                  <p className="text-xs font-bold theme-text-secondary">
                    {lang === 'tl' ? 'Pumili ng variant na nais idagdag:' : 'Select a variant to add:'}
                  </p>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {variantModalProduct.variants?.map((v, idx) => {
                        const vKey = `${variantModalProduct.name}-${v.label}`;
                        const qty = cart[vKey]?.qty || 0;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setFocusedVariant(v);
                              if (qty === 0) {
                                handleUpdateQty(variantModalProduct, 1, v);
                              }
                            }}
                            className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer select-none active:scale-98 ${
                              qty > 0
                                ? 'theme-bg-surface border-[var(--color-primary)] shadow-xs'
                                : 'theme-bg-surface-subtle theme-border hover:theme-border'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-black theme-text-app">{v.label}</div>
                              <div className="text-xs font-bold theme-text-accent mt-0.5">
                                {formatPeso(v.price)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {qty > 0 && (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-black">
                                  {qty} {lang === 'tl' ? 'sa cart' : 'in cart'}
                                </span>
                              )}
                              <span className="text-xs font-bold theme-text-secondary">→</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                  <button
                    type="button"
                    onClick={() => setVariantModalProduct(null)}
                    className="w-full mt-2 py-2.5 px-3 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border theme-text-app font-black text-xs flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                  >
                    <span>{lang === 'tl' ? 'Isara' : 'Close'}</span>
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. GENERATED ORDER QR FULLSCREEN MODAL */}
      <AnimatePresence>
        {generatedOrderQr && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pb-20 sm:pb-6 bg-black/65 backdrop-blur-xs select-none animate-in fade-in duration-200"
            onClick={() => {
              if (isOrderConfirmedBySeller) {
                handleCloseOrderQrModal(true);
              } else {
                handleCloseOrderQrModal(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm max-h-[calc(100dvh-5rem)] overflow-y-auto slim-scrollbar rounded-3xl theme-bg-card border theme-border p-5 sm:p-6 theme-text-app flex flex-col items-center shadow-2xl overscroll-contain"
              onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2.5 rounded-2xl theme-bg-primary text-white shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black theme-text-app">
                  {lang === 'tl' ? 'Ipakita sa Tindera' : 'Show to Seller'}
                </h2>
              </div>

              <p className="text-xs theme-text-secondary text-center mb-4 font-medium">
                {lang === 'tl'
                  ? 'I-scan ito ng tindera upang ma-process agad ang iyong order.'
                  : 'The seller will scan this QR to instantly process your order.'}
              </p>

              {/* Order QR Code Canvas with Unobstructed Pattern */}
              <div className="relative p-4 bg-white rounded-3xl border-4 theme-border shadow-inner flex items-center justify-center mb-3 w-full max-w-[250px] aspect-square">
                <div className="relative w-full h-full flex items-center justify-center">
                  <QRCode
                    value={generatedOrderQr}
                    size={220}
                    level="H"
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  />
                </div>
              </div>

              {/* Progressive BLE Sync Status Indicator */}
              {bleState === 'READY' && (
                <div className="flex items-center justify-center gap-1.5 mb-3 text-[11px] theme-text-secondary">
                  <div className="w-2 h-2 rounded-full bg-slate-400/50 shrink-0" />
                  <span>
                    {syncSecondsLeft > 0
                      ? (lang === 'tl' ? `Naghahanap (${syncSecondsLeft}s)...` : `Scanning (${syncSecondsLeft}s)...`)
                      : (lang === 'tl' ? 'Ipakita ang QR sa tindera para ma-scan' : 'Show QR code to seller to scan')}
                  </span>
                </div>
              )}
              {(bleState === 'ADVERTISING' || bleState === 'SCANNING') && !isOrderConfirmedBySeller && (
                <div className="flex items-center justify-center gap-1.5 mb-3 text-[11px] theme-text-secondary">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-ble-breathe shrink-0" />
                  <span>
                    {syncSecondsLeft > 0
                      ? (lang === 'tl'
                          ? `Kumokonekta sa device ng tindero (${syncSecondsLeft}s)...`
                          : `Syncing with seller's device (${syncSecondsLeft}s)...`)
                      : (lang === 'tl'
                          ? 'Ipakita ang QR sa tindera para ma-scan'
                          : 'Show QR code to seller to scan')}
                  </span>
                </div>
              )}
              {(bleState === 'SYNCED' || isOrderConfirmedBySeller) && (
                <div className="flex items-center justify-center gap-1.5 mb-3 text-[11px] text-emerald-600 font-bold transition-opacity duration-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>
                    {lang === 'tl'
                      ? '✓ Kumpirmado na ng tindero!'
                      : '✓ Confirmed by seller!'}
                  </span>
                </div>
              )}

              {/* STATUS INDICATOR: Waiting vs Confirmed */}
              {!isOrderConfirmedBySeller ? (
                <div className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl theme-bg-surface-subtle border theme-border-subtle text-amber-400 text-xs font-bold mb-4">
                  <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    {syncSecondsLeft > 0
                      ? (lang === 'tl'
                          ? `⏳ Naghihintay ma-scan ng tindera (${syncSecondsLeft}s)...`
                          : `⏳ Waiting for seller to scan (${syncSecondsLeft}s)...`)
                      : (lang === 'tl'
                          ? '📱 Ipakita ang QR code na ito sa tindera'
                          : '📱 Show this QR code to the seller')}
                  </span>
                </div>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black mb-4">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>
                    {lang === 'tl'
                      ? '✅ Na-scan at Na-confirm na ng Tindera!'
                      : '✅ Scanned & Confirmed by Seller!'}
                  </span>
                </div>
              )}

              {/* CLEAN ORDER SUMMARY (No Crowded FormalReceipt inside modal) */}
              <div className="w-full theme-bg-surface-subtle border theme-border rounded-2xl p-3.5 space-y-2 mb-4 text-left font-mono text-xs max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between border-b theme-border-subtle pb-1.5 font-bold theme-text-app">
                  <span className="flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 theme-text-accent" />
                    <span>{lang === 'tl' ? 'Buod ng Order' : 'Order Summary'}</span>
                  </span>
                  <span className="text-[10px] theme-text-secondary truncate max-w-[120px]">
                    {activeCatalog?.storeName || 'Suki Store'}
                  </span>
                </div>
                {/* Items */}
                <div className="space-y-1 py-1">
                  {(Object.values(cart) as SelectedCartItem[]).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="theme-text-app truncate max-w-[180px]">
                        {item.qty}x {item.name} {item.variantLabel ? `(${item.variantLabel})` : ''}
                      </span>
                      <span className="font-bold theme-text-accent shrink-0">
                        {formatPeso(item.qty * item.price)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Total and Cash/Change */}
                <div className="border-t theme-border-subtle pt-1.5 space-y-1">
                  <div className="flex justify-between font-black text-sm theme-text-app">
                    <span>{lang === 'tl' ? 'Kabuuan (Total):' : 'Total Amount:'}</span>
                    <span className="theme-text-accent">{formatPeso(totalAmount)}</span>
                  </div>
                  {buyerCash && parseFloat(buyerCash) > 0 && (
                    <>
                      <div className="flex justify-between text-[11px] theme-text-secondary">
                        <span>{lang === 'tl' ? 'Pera na Ibibigay:' : 'Cash Tendered:'}</span>
                        <span>{formatPeso(parseFloat(buyerCash))}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-emerald-400">
                        <span>{lang === 'tl' ? 'Inaasahang Sukli:' : 'Est. Change:'}</span>
                        <span>
                          {formatPeso(Math.max(0, parseFloat(buyerCash) - totalAmount))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons: Edit/Cancel vs Received/Done */}
              <div className="w-full flex gap-2">
                {!isOrderConfirmedBySeller ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCloseOrderQrModal(false)}
                      className="flex-1 py-3 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border theme-text-app font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                    >
                      <Edit2 className="w-3.5 h-3.5 theme-text-accent" />
                      <span>{lang === 'tl' ? 'Baguhin' : 'Edit'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCloseOrderQrModal(false)}
                      className="flex-1 py-3 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border theme-text-secondary font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{lang === 'tl' ? 'Isara' : 'Close'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCloseOrderQrModal(true)}
                    className="w-full py-3.5 rounded-2xl theme-bg-primary hover:opacity-90 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>{lang === 'tl' ? 'Tapos Na (Isara & I-save)' : 'Done (Close & Save)'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4.5 STORE REMOVAL CONFIRMATION MODAL */}
      <AnimatePresence>
        {storeToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStoreToDelete(null)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl theme-bg-card border theme-border shadow-2xl p-5 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h4 className="font-black text-sm sm:text-base theme-text-app">
                  {lang === 'tl'
                    ? 'Alisin ang Suki Store?'
                    : lang === 'ja'
                    ? '店舗を削除しますか？'
                    : lang === 'zh'
                    ? '移除店铺？'
                    : lang === 'ko'
                    ? '매장을 삭제하시겠습니까?'
                    : 'Remove Saved Store?'}
                </h4>
                <p className="text-xs theme-text-secondary leading-relaxed px-2">
                  {lang === 'tl'
                    ? `Nais mo bang alisin ang "${storeToDelete.storeName}" sa iyong mga naka-save na tindahan?`
                    : lang === 'ja'
                    ? `「${storeToDelete.storeName}」を保存済みリストから削除しますか？`
                    : lang === 'zh'
                    ? `您确定要从已保存列表中移除“${storeToDelete.storeName}”吗？`
                    : lang === 'ko'
                    ? `저장된 매장 목록에서 "${storeToDelete.storeName}"을(를) 삭제하시겠습니까?`
                    : `Are you sure you want to remove "${storeToDelete.storeName}" from your saved stores?`}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStoreToDelete(null)}
                  className="flex-1 py-2.5 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border theme-text-secondary font-extrabold text-xs transition-colors cursor-pointer active:scale-98"
                >
                  {lang === 'tl'
                    ? 'Kanselahin'
                    : lang === 'ja'
                    ? 'キャンセル'
                    : lang === 'zh'
                    ? '取消'
                    : lang === 'ko'
                    ? '취소'
                    : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => removeStoreFromSukiList(storeToDelete.storeName)}
                  className="flex-1 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer active:scale-98"
                >
                  {lang === 'tl'
                    ? 'Alisin'
                    : lang === 'ja'
                    ? '削除'
                    : lang === 'zh'
                    ? '移除'
                    : lang === 'ko'
                    ? '삭제'
                    : 'Remove'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUCCESS TOAST BANNER */}
      <AnimatePresence>
        {orderDoneToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center gap-2 border border-emerald-400/40"
          >
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{orderDoneToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. LIVE STORE QR CAMERA SCANNER */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onOpenAddItem={() => {}}
        scanType="qr_only"
        onScanSuccess={(detectedText) => {
          setIsScannerOpen(false);
          processStoreQrData(detectedText);
        }}
        lang={lang}
      />
    </div>
  );
};
