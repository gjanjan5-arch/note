import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  Banknote,
  Receipt,
} from 'lucide-react';
import { db } from '../db/db';
import type { InventoryItem, Transaction } from '../types';
import { FormalReceipt } from './FormalReceipt';
import { formatPeso } from '../utils/formatters';
import { playScanBeep } from '../utils/audioBeep';
import type { LanguageCode } from '../utils/i18n';
import { safeStorage } from '../utils/safeStorage';
import { ModalPortal } from './ModalPortal';
import { bleSyncManager } from '../utils/bleOrderSync';

export interface BuyerOrderItem {
  name: string;
  sku?: string;
  qty: number;
  price: number;
  variantLabel?: string;
}

export interface BuyerOrderPayload {
  v: number;
  type: 'BUYER_ORDER';
  id: string;
  ts: number;
  items: BuyerOrderItem[];
  total: number;
  cash?: number;
  paymentMethod?: string;
  storeName?: string;
  isAlreadyProcessed?: boolean;
}

interface BuyerOrderModalProps {
  isOpen: boolean;
  order?: BuyerOrderPayload | null;
  orderPayload?: BuyerOrderPayload | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onOrderConfirmed?: () => void;
  lang: LanguageCode;
}

export const BuyerOrderModal: React.FC<BuyerOrderModalProps> = ({
  isOpen,
  order: propOrder,
  orderPayload,
  onClose,
  onSuccess,
  onOrderConfirmed,
  lang,
}) => {
  const order = propOrder || orderPayload || null;
  const [stockCheck, setStockCheck] = useState<{
    [itemName: string]: { available: number; passes: boolean };
  }>({});
  const [hasStockIssue, setHasStockIssue] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Validate stock against current db inventory
  useEffect(() => {
    if (!order || !isOpen) return;

    let issueFound = false;
    const checks: { [itemName: string]: { available: number; passes: boolean } } = {};

    db.inventory.toArray().then((allInventory) => {
      for (const item of order.items) {
        const dbItem = allInventory.find(
          (inv) =>
            inv.name.toLowerCase() === item.name.toLowerCase() ||
            (item.sku && inv.sku && inv.sku.toLowerCase() === item.sku.toLowerCase())
        );

        const available = dbItem ? dbItem.stock : 0;
        const passes = available >= item.qty;

        if (!passes) {
          issueFound = true;
        }

        checks[item.name] = { available, passes };
      }

      setStockCheck(checks);
      setHasStockIssue(issueFound);
    });
  }, [order, isOpen]);

  // Handle escape key to close modal safely
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        if (isCompleted) {
          handleCloseReceipt();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, isCompleted, onClose]);

  if (!isOpen || !order) return null;

  const changeAmount = order.cash && order.cash >= order.total ? order.cash - order.total : 0;

  const handleConfirmSale = async () => {
    if (isProcessing || isCompleted) return;
    setIsProcessing(true);

    try {
      const allInventory = await db.inventory.toArray();

      // Deduct stock for each item
      for (const item of order.items) {
        const dbItem = allInventory.find(
          (inv) =>
            inv.name.toLowerCase() === item.name.toLowerCase() ||
            (item.sku && inv.sku && inv.sku.toLowerCase() === item.sku.toLowerCase())
        );

        if (dbItem && dbItem.id) {
          const newStock = Math.max(0, dbItem.stock - item.qty);
          await db.inventory.update(dbItem.id, {
            stock: newStock,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Record transaction
      const now = new Date();
      const isUtang = order.paymentMethod === 'UTANG';
      const customerName = (order as any).buyerName || (order as any).customerName || (lang === 'tl' ? 'Mamimili (QR Order)' : 'Buyer (QR Order)');

      const transactionRecord = {
        timestamp: now.getTime(),
        dateStr: now.toISOString().split('T')[0],
        type: (isUtang ? 'PAUTANG_RECORD' : 'SALE') as 'PAUTANG_RECORD' | 'SALE',
        customerName: isUtang ? customerName : undefined,
        items: order.items.map((i) => ({
          itemName: i.variantLabel ? `${i.name} (${i.variantLabel})` : i.name,
          quantity: i.qty,
          unitPrice: i.price,
          totalPrice: i.price * i.qty,
        })),
        totalAmount: order.total,
        rawNote: `Buyer QR Order #${order.id.slice(-6)}`,
        syncStatus: 'LOCAL' as const,
      };

      await db.transactions.add(transactionRecord);

      // If Utang, update customer balance in store database ledger
      if (isUtang) {
        try {
          const existingCust = await db.customers.where('name').equalsIgnoreCase(customerName).first();
          if (existingCust && existingCust.id) {
            await db.customers.update(existingCust.id, {
              currentBalance: (existingCust.currentBalance || 0) + order.total,
              lastTransactionAt: now.getTime(),
            });
          } else {
            await db.customers.add({
              name: customerName,
              currentBalance: order.total,
              lastTransactionAt: now.getTime(),
            });
          }
        } catch (cErr) {
          console.warn('[BuyerOrderModal] Error updating customer utang record:', cErr);
        }
      }

      // Record order ID in safeStorage as processed
      const processed = JSON.parse(safeStorage.getItem('processed_buyer_orders') || '[]');
      processed.push(order.id);
      safeStorage.setItem('processed_buyer_orders', JSON.stringify(processed));

      // Broadcast order confirmation event so Buyer Mode can trigger the receipt
      try {
        window.dispatchEvent(
          new CustomEvent('buyer_order_confirmed', { detail: { orderId: order.id } })
        );
        const bc = new BroadcastChannel('tindahan_order_channel');
        bc.postMessage({ type: 'ORDER_CONFIRMED', orderId: order.id });
        bc.close();
        
        // BLE Broadcast (re-advertises for 3-5 seconds continuously in background)
        bleSyncManager.startSellerConfirm(order.id).catch(() => {});
      } catch (_) {}

      playScanBeep('success');
      setIsCompleted(true);
      setIsProcessing(false);
      onOrderConfirmed?.();
    } catch (err) {
      console.error('Error confirming buyer order sale:', err);
      playScanBeep('error');
      setIsProcessing(false);
    }
  };

  const handleCloseReceipt = () => {
    const msg =
      lang === 'tl'
        ? `Matagumpay na naitala ang Order #${order.id.slice(-6)}!`
        : `Order #${order.id.slice(-6)} confirmed successfully!`;
    onSuccess?.(msg);
    onClose();
  };

  if (isCompleted) {
    const mappedTransaction: Transaction = {
      id: parseInt(order.id.replace(/\D/g, '').slice(-6)) || Math.floor(Math.random() * 10000),
      timestamp: order.ts,
      dateStr: new Date(order.ts).toISOString().split('T')[0],
      type: order.paymentMethod === 'UTANG' ? 'PAUTANG_RECORD' : 'SALE',
      customerName: order.storeName || (lang === 'tl' ? 'Mamimili' : 'Buyer'),
      totalAmount: order.total,
      items: order.items.map(it => ({
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
        onClose={handleCloseReceipt}
        overrideReceiptNumber={order.id.slice(-6)}
        overridePaymentMethod={order.paymentMethod}
      />
    );
  }

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b theme-border-subtle bg-linear-to-r from-emerald-500/10 to-teal-500/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl theme-bg-primary text-white shadow-xs">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black theme-text-app tracking-tight">
              {lang === 'tl' ? 'Buyer QR Order' : 'Buyer QR Order'}
            </h2>
            <p className="text-xs font-semibold theme-text-secondary">
              #{order.id.slice(-8)} • {new Date(order.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full theme-bg-surface-subtle theme-text-secondary hover:theme-text-app transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* Already Processed Notice */}
        {order.isAlreadyProcessed && (
          <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              {lang === 'tl'
                ? 'Re-scan / Naitala na dati ang order na ito sa tindahan.'
                : 'Re-scan / This order was previously recorded in sales.'}
            </span>
          </div>
        )}

        {/* Out of stock warning banner */}
        {hasStockIssue && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {lang === 'tl'
                ? 'May ilang paninda na kulang ang stock sa inventory!'
                : 'Some ordered items exceed available inventory stock!'}
            </span>
          </div>
        )}

        {/* Item Breakdown List */}
        <div className="theme-bg-surface-subtle border theme-border rounded-2xl p-3 space-y-2">
          {order.items.map((item, idx) => {
            const check = stockCheck[item.name];
            const isShort = check && !check.passes;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                  isShort
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : 'theme-bg-surface theme-border theme-text-app'
                }`}
              >
                <div className="flex-1 pr-2">
                  <div className="font-bold theme-text-app flex items-center gap-1.5">
                    <span>{item.name}</span>
                    {item.variantLabel && (
                      <span className="px-1.5 py-0.5 rounded-md theme-bg-surface-subtle theme-text-accent text-[10px] font-bold">
                        {item.variantLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] theme-text-secondary">
                    {item.qty}x @ {formatPeso(item.price)}
                    {check && (
                      <span className={`ml-2 font-mono ${isShort ? 'text-rose-400 font-black' : 'theme-text-muted'}`}>
                        ({lang === 'tl' ? 'Stock' : 'Stock'}: {check.available})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right font-black theme-text-accent text-sm">
                  {formatPeso(item.qty * item.price)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cash & Change Summary */}
        <div className="theme-bg-surface-subtle border theme-border rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center text-sm font-bold theme-text-app">
            <span>{lang === 'tl' ? 'Kabuuan (Total):' : 'Total Amount:'}</span>
            <span className="text-lg font-black theme-text-accent">{formatPeso(order.total)}</span>
          </div>

          {order.cash !== undefined && order.cash > 0 && (
            <>
              <div className="flex justify-between items-center text-xs theme-text-secondary">
                <span>{lang === 'tl' ? 'Pera ng Buyer:' : 'Buyer Cash:'}</span>
                <span className="font-bold theme-text-app">{formatPeso(order.cash)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold pt-1 border-t theme-border-subtle">
                <span className="theme-text-accent flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5" />
                  <span>{lang === 'tl' ? 'Sukli (Change):' : 'Change:'}</span>
                </span>
                <span className="text-sm font-black theme-text-accent">{formatPeso(changeAmount)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer / Action Buttons */}
      <div className="shrink-0 p-4 border-t theme-border-subtle flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 px-4 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border theme-text-app font-bold text-xs transition-colors cursor-pointer active:scale-95"
        >
          {lang === 'tl' ? 'I-kansela' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={handleConfirmSale}
          disabled={isProcessing}
          className="flex-2 py-3 px-4 rounded-2xl theme-bg-primary hover:opacity-90 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
        >
          <Receipt className="w-4 h-4 text-white" />
          <span>
            {isProcessing
              ? (lang === 'tl' ? 'Itinatala ang benta...' : 'Processing Sale...')
              : (lang === 'tl' ? 'I-confirm ang Benta' : 'Confirm Sale')}
          </span>
        </button>
      </div>
    </ModalPortal>
  );
};
