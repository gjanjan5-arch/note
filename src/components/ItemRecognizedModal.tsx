import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  ShoppingBag,
  CreditCard,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserPlus,
  Phone,
  Search,
  Receipt,
  Sparkles,
  Scale,
  Trash2,
  Camera,
  Layers,
  Tag,
  Calendar,
  FileText,
  DollarSign,
  User,
} from 'lucide-react';
import type { InventoryItem, InventoryVariant, Customer } from '../types';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatPeso, formatDateTime, getLocalDateStr } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';
import { playScanBeep } from '../utils/audioBeep';
import { ModalPortal } from './ModalPortal';

export interface CartItemEntry {
  item: InventoryItem;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantLabel?: string;
  isWeight?: boolean;
}

interface ItemRecognizedModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  scannedCode?: string;
  cartItems?: CartItemEntry[];
  onAddAnother?: (entry: CartItemEntry) => void;
  onRemoveCartItem?: (index: number) => void;
  onClose: () => void;
  onSuccess: (message: string) => void;
  lang: LanguageCode;
}

export const ItemRecognizedModal: React.FC<ItemRecognizedModalProps> = ({
  isOpen,
  item,
  scannedCode,
  cartItems = [],
  onAddAnother,
  onRemoveCartItem,
  onClose,
  onSuccess,
  lang,
}) => {
  // Selected variant or default price
  const [selectedVariant, setSelectedVariant] = useState<InventoryVariant | null>(() =>
    item?.variants && item.variants.length > 0 ? item.variants[0] : null
  );

  // Quantity / Stepper state
  const [quantity, setQuantity] = useState<string>('1');

  // Custom Weight state (e.g. for rice, sugar, oil sold in kg or g)
  const [customWeightKg, setCustomWeightKg] = useState<string>('');
  const [isWeightMode, setIsWeightMode] = useState<boolean>(false);

  // Suki Discount state
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);

  // Sell Flow States
  const [buyersMoney, setBuyersMoney] = useState<string>('');

  // Credit Flow States
  const [isCreditMode, setIsCreditMode] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creditDueDate, setCreditDueDate] = useState<string>('');
  const [creditNotes, setCreditNotes] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);

  // Completed Receipt state
  const [completedReceipt, setCompletedReceipt] = useState<{
    totalAmount: number;
    subtotal: number;
    discount?: number;
    itemsSummary: { name: string; qty: number; unitPrice: number; totalPrice: number; variant?: string }[];
    isCredit: boolean;
    customerName?: string;
    dueDate?: string;
    notes?: string;
    buyersMoney?: number;
    change?: number;
    timestamp: number;
  } | null>(null);

  // Feedback error/warning
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize and reset modal state whenever opening or when target item changes
  useEffect(() => {
    if (isOpen && item) {
      setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
      setQuantity('1');
      setCustomWeightKg('');
      setIsWeightMode(false);
      setDiscountAmount('');
      setShowDiscountInput(false);
      setBuyersMoney('');
      setIsCreditMode(false);
      setSelectedCustomer(null);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCreditDueDate('');
      setCreditNotes('');
      setCustomerSearch('');
      setIsCreatingNewCustomer(false);
      setCompletedReceipt(null);
      setErrorMessage(null);
    }
  }, [isOpen, item]);

  // Live queries for active customer balance and customer suggestions
  const customers =
    useLiveQuery(
      async () => {
        try {
          return await db.customers.toArray();
        } catch (err) {
          console.warn('[ItemRecognizedModal] customer query fallback:', err);
          return [];
        }
      },
      [],
      []
    ) ?? [];
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.trim().toLowerCase())
  );

  if (!isOpen || !item) return null;

  // Price calculations for CURRENT item
  const effectiveUnitPrice = selectedVariant ? selectedVariant.unitPrice : item.unitPrice;
  const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
  const parsedWeight = parseFloat(customWeightKg) || 0;

  const currentItemTotal = isWeightMode && parsedWeight > 0
    ? parsedWeight * effectiveUnitPrice
    : parsedQty * effectiveUnitPrice;

  const currentItemQtySold = isWeightMode ? (parsedWeight > 0 ? parsedWeight : 1) : parsedQty;

  // Cart accumulator calculations
  const existingCartTotal = cartItems.reduce((sum, it) => sum + it.totalPrice, 0);
  const subtotalAmount = existingCartTotal + currentItemTotal;

  // Parsed discount
  const parsedDiscount = parseFloat(discountAmount) || 0;
  const grandTotalAmount = Math.max(0, subtotalAmount - parsedDiscount);

  // Buyer's money and change calculation
  const parsedBuyersMoney = parseFloat(buyersMoney) || 0;
  const isBudgetEntered = buyersMoney.trim() !== '' && !isNaN(parsedBuyersMoney);
  const budgetDifference = isBudgetEntered ? parsedBuyersMoney - grandTotalAmount : 0;
  const hasInsufficientBudget = isBudgetEntered && budgetDifference < 0;

  const currentAvailableStock = item.stock ?? 0;
  const isOutOfStock = currentAvailableStock <= 0;

  // Build the current item CartEntry
  const getCurrentCartEntry = (): CartItemEntry => ({
    item,
    quantity: currentItemQtySold,
    unitPrice: effectiveUnitPrice,
    totalPrice: currentItemTotal,
    variantLabel: selectedVariant ? selectedVariant.label : isWeightMode ? `${parsedWeight}kg` : undefined,
    isWeight: isWeightMode,
  });

  // Handle "Add Another Product" / Fast Next Scan
  const handleAddAnotherProduct = () => {
    setErrorMessage(null);
    if (currentAvailableStock < currentItemQtySold) {
      setErrorMessage(
        lang === 'tl'
          ? `Kulang ang stock! Mayroon na lamang ${currentAvailableStock} pcs.`
          : `Insufficient stock! Only ${currentAvailableStock} pcs remaining.`
      );
      playScanBeep('error');
      return;
    }

    const currentEntry = getCurrentCartEntry();
    playScanBeep('double');
    if (onAddAnother) {
      onAddAnother(currentEntry);
    }
  };

  // Handle Sell Action (Consolidates all cart items + current item)
  const handleConfirmSell = async () => {
    setErrorMessage(null);
    if (currentAvailableStock < currentItemQtySold) {
      setErrorMessage(
        lang === 'tl'
          ? `Kulang ang stock! Mayroon na lamang ${currentAvailableStock} pcs.`
          : `Insufficient stock! Only ${currentAvailableStock} pcs remaining.`
      );
      playScanBeep('error');
      return;
    }

    if (hasInsufficientBudget) {
      setErrorMessage(
        lang === 'tl'
          ? `Kulang ang bayad! Kulang pa ng ${formatPeso(Math.abs(budgetDifference))}`
          : `Insufficient cash! Short by ${formatPeso(Math.abs(budgetDifference))}`
      );
      playScanBeep('error');
      return;
    }

    const buyersMoneyVal = isBudgetEntered && parsedBuyersMoney >= grandTotalAmount ? parsedBuyersMoney : undefined;
    const changeVal = buyersMoneyVal !== undefined ? buyersMoneyVal - grandTotalAmount : undefined;

    // Collect all items to sell: existing cart items + current item
    const allItemsToSell: CartItemEntry[] = [...cartItems, getCurrentCartEntry()];

    try {
      await db.transaction('rw', [db.inventory, db.transactions], async () => {
        // 1. Deduct Stock for all items
        for (const entry of allItemsToSell) {
          const itId = entry.item.id;
          if (itId) {
            const currentItem = await db.inventory.get(itId);
            if (currentItem) {
              const qtyToDeduct = entry.isWeight ? Math.ceil(entry.quantity) : entry.quantity;
              const newStock = Math.max(0, currentItem.stock - qtyToDeduct);
              await db.inventory.update(itId, {
                stock: newStock,
                updatedAt: Date.now(),
              });
            }
          }
        }

        // 2. Build Transaction Record
        const transactionItems = allItemsToSell.map((entry) => {
          const variantSuffix = entry.variantLabel ? ` (${entry.variantLabel})` : '';
          return {
            itemName: `${entry.item.name}${variantSuffix}`,
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
            totalPrice: entry.totalPrice,
          };
        });

        const itemsDescription = transactionItems
          .map((it) => `${it.itemName} ×${it.quantity}`)
          .join(', ');

        const discountNote = parsedDiscount > 0 ? ` [Discount: -₱${parsedDiscount}]` : '';

        await db.transactions.add({
          timestamp: Date.now(),
          dateStr: getLocalDateStr(),
          type: 'SALE',
          totalAmount: grandTotalAmount,
          items: transactionItems,
          rawNote: `Benta (${allItemsToSell.length} uri): ${itemsDescription} = ₱${grandTotalAmount}${discountNote}`,
          syncStatus: 'LOCAL',
        });
      });

      playScanBeep('success');

      // Show receipt view
      setCompletedReceipt({
        totalAmount: grandTotalAmount,
        subtotal: subtotalAmount,
        discount: parsedDiscount > 0 ? parsedDiscount : undefined,
        itemsSummary: allItemsToSell.map((entry) => ({
          name: entry.item.name,
          qty: entry.quantity,
          unitPrice: entry.unitPrice,
          totalPrice: entry.totalPrice,
          variant: entry.variantLabel,
        })),
        isCredit: false,
        buyersMoney: buyersMoneyVal,
        change: changeVal,
        timestamp: Date.now(),
      });

      onSuccess(
        lang === 'tl'
          ? `Benta naitala: ₱${grandTotalAmount.toLocaleString()} (${allItemsToSell.length} paninda)!`
          : `Sale recorded: ₱${grandTotalAmount.toLocaleString()} (${allItemsToSell.length} items)!`
      );
    } catch (err) {
      console.error('[ItemRecognizedModal] Sell error:', err);
      playScanBeep('error');
      setErrorMessage(lang === 'tl' ? 'Nagkaroon ng error sa pagbenta.' : 'Error recording sale.');
    }
  };

  // Handle Credit (Pautang) Action (Consolidates all cart items + current item)
  const handleConfirmCredit = async () => {
    setErrorMessage(null);
    const targetCustomerName = selectedCustomer
      ? selectedCustomer.name.trim()
      : newCustomerName.trim();

    if (!targetCustomerName) {
      setErrorMessage(
        lang === 'tl'
          ? 'Mangyaring pumili o maglagay ng pangalan ng suki.'
          : 'Please select or enter customer name.'
      );
      playScanBeep('error');
      return;
    }

    if (currentAvailableStock < currentItemQtySold) {
      setErrorMessage(
        lang === 'tl'
          ? `Kulang ang stock! Mayroon na lamang ${currentAvailableStock} pcs.`
          : `Insufficient stock! Only ${currentAvailableStock} pcs remaining.`
      );
      playScanBeep('error');
      return;
    }

    const allItemsToCredit: CartItemEntry[] = [...cartItems, getCurrentCartEntry()];

    try {
      await db.transaction('rw', [db.inventory, db.transactions, db.customers], async () => {
        // 1. Deduct Stock for all items
        for (const entry of allItemsToCredit) {
          const itId = entry.item.id;
          if (itId) {
            const currentItem = await db.inventory.get(itId);
            if (currentItem) {
              const qtyToDeduct = entry.isWeight ? Math.ceil(entry.quantity) : entry.quantity;
              const newStock = Math.max(0, currentItem.stock - qtyToDeduct);
              await db.inventory.update(itId, {
                stock: newStock,
                updatedAt: Date.now(),
              });
            }
          }
        }

        // 2. Upsert Customer Record
        const existingCust = await db.customers
          .where('name')
          .equalsIgnoreCase(targetCustomerName)
          .first();

        if (existingCust && existingCust.id) {
          await db.customers.update(existingCust.id, {
            currentBalance: (existingCust.currentBalance || 0) + grandTotalAmount,
            lastTransactionAt: Date.now(),
            phone: newCustomerPhone.trim() || existingCust.phone,
            notes: creditNotes.trim() || existingCust.notes,
          });
        } else {
          await db.customers.add({
            name: targetCustomerName,
            phone: newCustomerPhone.trim() || undefined,
            currentBalance: grandTotalAmount,
            lastTransactionAt: Date.now(),
            notes: creditNotes.trim() || undefined,
          });
        }

        // 3. Record PAUTANG_RECORD Transaction
        const transactionItems = allItemsToCredit.map((entry) => {
          const variantSuffix = entry.variantLabel ? ` (${entry.variantLabel})` : '';
          return {
            itemName: `${entry.item.name}${variantSuffix}`,
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
            totalPrice: entry.totalPrice,
          };
        });

        const itemsDescription = transactionItems
          .map((it) => `${it.itemName} ×${it.quantity}`)
          .join(', ');

        const dueNote = creditDueDate ? ` [Due: ${creditDueDate}]` : '';
        const notesSuffix = creditNotes.trim() ? ` (${creditNotes.trim()})` : '';

        await db.transactions.add({
          timestamp: Date.now(),
          dateStr: getLocalDateStr(),
          type: 'PAUTANG_RECORD',
          customerName: targetCustomerName,
          handledBy: targetCustomerName,
          totalAmount: grandTotalAmount,
          items: transactionItems,
          rawNote: `Pautang kay ${targetCustomerName}: ${itemsDescription} = ₱${grandTotalAmount}${dueNote}${notesSuffix}`,
          notes: creditDueDate ? `Due: ${creditDueDate}. ${creditNotes.trim()}` : creditNotes.trim() || undefined,
          syncStatus: 'LOCAL',
        });
      });

      playScanBeep('success');

      // Show receipt view
      setCompletedReceipt({
        totalAmount: grandTotalAmount,
        subtotal: subtotalAmount,
        discount: parsedDiscount > 0 ? parsedDiscount : undefined,
        itemsSummary: allItemsToCredit.map((entry) => ({
          name: entry.item.name,
          qty: entry.quantity,
          unitPrice: entry.unitPrice,
          totalPrice: entry.totalPrice,
          variant: entry.variantLabel,
        })),
        isCredit: true,
        customerName: targetCustomerName,
        dueDate: creditDueDate || undefined,
        notes: creditNotes.trim() || undefined,
        timestamp: Date.now(),
      });

      onSuccess(
        lang === 'tl'
          ? `Naitala ang pautang kay ${targetCustomerName} (₱${grandTotalAmount.toLocaleString()})!`
          : `Credit recorded for ${targetCustomerName} (₱${grandTotalAmount.toLocaleString()})!`
      );
    } catch (err) {
      console.error('[ItemRecognizedModal] Credit error:', err);
      playScanBeep('error');
      setErrorMessage(lang === 'tl' ? 'Nagkaroon ng error sa pautang.' : 'Error recording credit.');
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={!completedReceipt ? onClose : undefined}>
      {/* RECEIPT VIEW ON SUCCESS */}
      {completedReceipt ? (
        <div className="space-y-4 py-2 overflow-y-auto custom-modal-scrollbar">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center mb-2 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-black theme-text-app text-lg">
              {completedReceipt.isCredit
                ? (lang === 'tl' ? 'Matagumpay na Naka-Pautang!' : 'Credit Recorded!')
                : (lang === 'tl' ? 'Matagumpay na Nabenta!' : 'Sale Complete!')}
            </h3>
            <p className="text-xs theme-text-secondary">
              {formatDateTime(completedReceipt.timestamp)}
            </p>
          </div>

          <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle space-y-2.5 text-xs">
            {completedReceipt.isCredit && (
              <div className="space-y-1.5 border-b theme-border-subtle pb-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="theme-text-secondary">{lang === 'tl' ? 'Suki / Customer:' : 'Customer:'}</span>
                  <span className="font-black theme-text-accent text-sm">{completedReceipt.customerName}</span>
                </div>
                {completedReceipt.dueDate && (
                  <div className="flex items-center justify-between text-[11px] theme-text-secondary">
                    <span>{lang === 'tl' ? 'Araw ng Singil (Due Date):' : 'Due Date:'}</span>
                    <span className="font-mono font-bold theme-text-app">{completedReceipt.dueDate}</span>
                  </div>
                )}
                {completedReceipt.notes && (
                  <div className="text-[11px] theme-text-secondary pt-0.5">
                    <span className="font-bold">{lang === 'tl' ? 'Tala:' : 'Note:'} </span>
                    <span>{completedReceipt.notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Itemized List in Receipt */}
            <div className="space-y-2 divide-y theme-border-subtle">
              {completedReceipt.itemsSummary.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between pt-1.5 first:pt-0">
                  <div className="truncate pr-2">
                    <span className="font-black theme-text-app text-xs sm:text-sm block truncate">{it.name}</span>
                    <span className="text-[11px] theme-text-secondary">
                      {it.qty} {it.variant ? `(${it.variant})` : 'pcs'} × {formatPeso(it.unitPrice)}
                    </span>
                  </div>
                  <span className="font-mono font-black text-xs sm:text-sm theme-text-app shrink-0">
                    {formatPeso(it.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {completedReceipt.discount && (
              <div className="pt-2 border-t theme-border-subtle flex items-center justify-between font-bold text-amber-500">
                <span>{lang === 'tl' ? 'Suki Discount:' : 'Discount:'}</span>
                <span className="font-mono">-{formatPeso(completedReceipt.discount)}</span>
              </div>
            )}

            <div className="pt-2 border-t theme-border-subtle flex items-center justify-between font-black">
              <span className="theme-text-app">{lang === 'tl' ? 'Kabuuang Halaga:' : 'Grand Total:'}</span>
              <span className="font-mono text-base theme-text-accent">{formatPeso(completedReceipt.totalAmount)}</span>
            </div>

            {completedReceipt.buyersMoney !== undefined && (
              <div className="pt-2 border-t theme-border-subtle space-y-1 font-bold">
                <div className="flex items-center justify-between theme-text-secondary">
                  <span>{lang === 'tl' ? 'Pera ng Mamimili:' : "Buyer's Money:"}</span>
                  <span className="font-mono theme-text-app">{formatPeso(completedReceipt.buyersMoney)}</span>
                </div>
                {completedReceipt.change !== undefined && (
                  <div className="flex items-center justify-between theme-text-accent font-black">
                    <span>{lang === 'tl' ? 'Sukli:' : 'Change:'}</span>
                    <span className="font-mono text-sm">{formatPeso(completedReceipt.change)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl theme-bg-primary text-white font-black text-sm shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              {translate(lang, 'btn_done') || 'Tapos Na (Done)'}
            </button>
          </div>
        </div>
      ) : (
        /* ACTIVE RECOGNIZED ITEM SALE & CREDIT FORM */
        <div className="space-y-3.5 flex flex-col justify-between overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b theme-border-subtle pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black theme-text-app text-sm sm:text-base leading-tight">
                  {lang === 'tl' ? 'Natukoy ang Paninda' : 'Item Recognized'}
                </h3>
                {scannedCode && (
                  <span className="text-[10px] theme-text-secondary font-mono">
                    SKU: {scannedCode}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full theme-text-secondary hover:theme-text-app hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ERROR BANNER */}
          {errorMessage && (
            <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SCROLLABLE FORM CONTENT */}
          <div className="space-y-3 overflow-y-auto pr-1 max-h-[52vh] sm:max-h-[58vh] custom-modal-scrollbar">
            {/* CURRENT CART QUEUE TRAY (If multiple items are already scanned) */}
            {cartItems.length > 0 && (
              <div className="theme-bg-surface-subtle p-2.5 rounded-2xl border theme-border-subtle space-y-1.5">
                <div className="flex items-center justify-between text-xs font-black">
                  <span className="theme-text-accent flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{lang === 'tl' ? `Na-scan nang Paninda (${cartItems.length}):` : `Scanned in Cart (${cartItems.length}):`}</span>
                  </span>
                  <span className="font-mono theme-text-app">{formatPeso(existingCartTotal)}</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1 custom-modal-scrollbar">
                  {cartItems.map((cIt, cIdx) => (
                    <div
                      key={cIdx}
                      className="flex items-center justify-between p-1.5 rounded-lg theme-bg-card border theme-border-subtle text-[11px]"
                    >
                      <div className="truncate pr-1">
                        <span className="font-bold theme-text-app truncate block">{cIt.item.name}</span>
                        <span className="text-[10px] theme-text-secondary font-mono">
                          {cIt.quantity}x {cIt.variantLabel ? `(${cIt.variantLabel})` : ''} • {formatPeso(cIt.totalPrice)}
                        </span>
                      </div>
                      {onRemoveCartItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveCartItem(cIdx)}
                          className="w-5 h-5 rounded-md text-rose-400 hover:bg-rose-500/20 flex items-center justify-center cursor-pointer shrink-0 active:scale-90"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Item Card Banner */}
            <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle flex items-center gap-3">
              {item.photo ? (
                <img
                  src={item.photo}
                  alt={item.name}
                  className="w-14 h-14 rounded-xl object-cover border theme-border-subtle shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl theme-bg-card flex items-center justify-center theme-text-accent border theme-border-subtle shrink-0">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-black theme-text-app text-sm sm:text-base truncate">
                  {item.name}
                </h4>
                <div className="flex items-center gap-2 text-xs font-bold mt-0.5">
                  <span className="theme-text-secondary">
                    {translate(lang, 'item_recognized_stock')}:
                  </span>
                  <span
                    className={`font-mono ${
                      isOutOfStock ? 'text-rose-500 font-black' : 'theme-text-app'
                    }`}
                  >
                    {currentAvailableStock} pcs {isOutOfStock ? `(${translate(lang, 'out_of_stock') || 'Out of Stock'})` : ''}
                  </span>
                </div>
                <div className="text-sm font-black theme-text-accent font-mono mt-0.5">
                  {formatPeso(effectiveUnitPrice)}
                </div>
              </div>
            </div>

            {/* VARIANTS SELECTOR (If item has variants) */}
            {item.variants && item.variants.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-black theme-text-secondary block">
                  {translate(lang, 'variants_label') || 'Available Variants / Sizes:'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {item.variants.map((variant, idx) => {
                    const isSelected = selectedVariant?.label === variant.label;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedVariant(variant);
                          setIsWeightMode(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          isSelected
                            ? 'theme-bg-primary text-white border-transparent shadow-xs'
                            : 'theme-bg-surface-subtle theme-text-app theme-border-subtle hover:border-[var(--color-primary)]'
                        }`}
                      >
                        <span>{variant.label}</span>
                        <span className="ml-1.5 opacity-90 font-mono">
                          {formatPeso(variant.unitPrice)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WEIGHT CALCULATOR TOGGLE & Suki Discount Toggle */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setIsWeightMode((prev) => !prev)}
                className={`text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isWeightMode ? 'theme-text-accent' : 'theme-text-secondary hover:theme-text-app'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>
                  {isWeightMode
                    ? (lang === 'tl' ? 'Naka-On: Timbang (kg/g)' : 'Active: Weight Mode (kg/g)')
                    : (lang === 'tl' ? '+ Ibenta ayon sa Timbang' : '+ Sell by Weight (kg/g)')}
                </span>
              </button>

              {/* Suki Discount Toggle Button */}
              <button
                type="button"
                onClick={() => setShowDiscountInput((prev) => !prev)}
                className={`text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showDiscountInput || parsedDiscount > 0 ? 'text-amber-500' : 'theme-text-secondary hover:theme-text-app'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>
                  {parsedDiscount > 0
                    ? `-₱${parsedDiscount} Discount`
                    : (lang === 'tl' ? '+ Suki Discount' : '+ Discount')}
                </span>
              </button>
            </div>

            {/* DISCOUNT INPUT CARD */}
            {showDiscountInput && (
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black theme-text-app flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === 'tl' ? 'Bawas / Suki Discount (₱):' : 'Discount Amount (₱):'}</span>
                  </label>
                  {parsedDiscount > 0 && (
                    <button
                      type="button"
                      onClick={() => setDiscountAmount('')}
                      className="text-[11px] text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      {lang === 'tl' ? 'Alisin' : 'Clear'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 font-black text-xs theme-text-secondary">₱</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="w-full theme-input border rounded-xl py-1.5 pl-7 pr-3 text-xs font-black theme-text-app focus:outline-none"
                    />
                  </div>
                  {/* Quick discount pills */}
                  <div className="flex gap-1">
                    {['5', '10', '20', '50'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDiscountAmount(d)}
                        className="px-2 py-1.5 rounded-lg theme-bg-card border theme-border-subtle text-[11px] font-black theme-text-app hover:theme-text-accent"
                      >
                        -₱{d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* QUANTITY / WEIGHT SELECTOR */}
            {isWeightMode ? (
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-1.5">
                <label className="text-xs font-black theme-text-app flex items-center justify-between">
                  <span>{translate(lang, 'weight_calculator_label') || 'Weight Amount (kg):'}</span>
                  <span className="text-[10px] theme-text-secondary font-bold">
                    Rate: {formatPeso(effectiveUnitPrice)} / kg
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.05"
                    min="0"
                    placeholder="e.g. 0.5 (for ½kg) or 1.25"
                    value={customWeightKg}
                    onChange={(e) => setCustomWeightKg(e.target.value)}
                    className="flex-1 theme-input border rounded-xl py-2 px-3 text-sm font-black theme-text-app focus:outline-none"
                  />
                  <div className="flex gap-1">
                    {['0.25', '0.5', '1', '2'].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setCustomWeightKg(w)}
                        className="px-2 py-1.5 rounded-lg theme-bg-card border theme-border-subtle text-[11px] font-black theme-text-app hover:theme-text-accent"
                      >
                        {w === '0.25' ? '¼' : w === '0.5' ? '½' : `${w}`}kg
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* STANDARD QUANTITY STEPPER */
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle flex items-center justify-between">
                <span className="text-xs font-black theme-text-app">
                  {translate(lang, 'qty') || 'Quantity'}:
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseInt(quantity, 10) || 1;
                      setQuantity(Math.max(1, cur - 1).toString());
                    }}
                    className="w-8 h-8 rounded-xl theme-bg-card border theme-border-subtle flex items-center justify-center theme-text-app active:scale-90 font-black cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val < 1) setQuantity('1');
                    }}
                    className="w-14 h-8 text-center font-black text-sm theme-input border rounded-xl theme-text-app"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseInt(quantity, 10) || 1;
                      setQuantity((cur + 1).toString());
                    }}
                    className="w-8 h-8 rounded-xl theme-bg-primary text-white flex items-center justify-center active:scale-90 font-black shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* TOTAL PRICE BAR */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <div>
                <span className="text-xs font-black theme-text-app block">
                  {cartItems.length > 0
                    ? (lang === 'tl' ? 'Kabuuang Babayaran (Lahat):' : 'Grand Total (All Items):')
                    : (translate(lang, 'total') || 'Total Amount:')}
                </span>
                <div className="flex items-center gap-2 text-[10px] theme-text-secondary font-bold">
                  {cartItems.length > 0 && (
                    <span>{cartItems.length + 1} paninda sa transaksyon</span>
                  )}
                  {parsedDiscount > 0 && (
                    <span className="text-amber-500 font-extrabold">(-₱{parsedDiscount} discount)</span>
                  )}
                </div>
              </div>
              <span className="text-lg font-black theme-text-accent font-mono">
                {formatPeso(grandTotalAmount)}
              </span>
            </div>

            {/* CASH INPUT & QUICK PRESET BUTTONS (When not in credit mode) */}
            {!isCreditMode && (
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black theme-text-app flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{lang === 'tl' ? "Pera ng Mamimili (Bayad):" : "Customer Cash (Bayad):"}</span>
                  </label>
                  <span className="text-[10px] font-bold theme-text-secondary">
                    {lang === 'tl' ? 'Opsyonal' : 'Optional'}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-black text-sm theme-text-secondary">₱</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    placeholder={lang === 'tl' ? 'Hal. 100, 500, 1000' : 'e.g. 100, 500'}
                    value={buyersMoney}
                    onChange={(e) => setBuyersMoney(e.target.value)}
                    className="w-full theme-input border rounded-xl py-2 pl-7 pr-3 text-sm font-black theme-text-app focus:outline-none"
                  />
                </div>

                {/* QUICK CASH PRESET BUTTONS */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setBuyersMoney(grandTotalAmount.toString())}
                    className="px-2.5 py-1.5 rounded-xl theme-bg-card border theme-border-subtle text-[11px] font-black theme-text-accent hover:border-[var(--color-primary)] active:scale-95 transition-all cursor-pointer"
                  >
                    {lang === 'tl' ? 'Sakto' : 'Exact'} ({formatPeso(grandTotalAmount)})
                  </button>
                  {[20, 50, 100, 200, 500, 1000].map((presetVal) => {
                    if (presetVal >= grandTotalAmount || grandTotalAmount === 0) {
                      return (
                        <button
                          key={presetVal}
                          type="button"
                          onClick={() => setBuyersMoney(presetVal.toString())}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-black transition-all cursor-pointer active:scale-95 ${
                            buyersMoney === presetVal.toString()
                              ? 'theme-bg-primary text-white border-transparent'
                              : 'theme-bg-card theme-border-subtle theme-text-app hover:border-[var(--color-primary)]'
                          }`}
                        >
                          ₱{presetVal}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* CHANGE / SUKLI DISPLAY */}
                {isBudgetEntered && (
                  <div className="pt-2 border-t theme-border-subtle space-y-1 text-xs font-bold">
                    <div className="flex items-center justify-between theme-text-secondary">
                      <span>{lang === 'tl' ? 'Pera ng Mamimili:' : "Buyer's Cash:"}</span>
                      <span className="font-mono theme-text-app">{formatPeso(parsedBuyersMoney)}</span>
                    </div>

                    {budgetDifference >= 0 ? (
                      <div className="flex items-center justify-between text-xs font-black theme-text-accent">
                        <span>{lang === 'tl' ? 'Sukli (Change):' : 'Change:'}</span>
                        <span className="text-sm font-black font-mono">
                          {formatPeso(budgetDifference)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs font-black text-amber-500">
                        <span>{lang === 'tl' ? 'Kulang pa ng:' : 'Need more:'}</span>
                        <span className="text-sm font-black font-mono">
                          {formatPeso(Math.abs(budgetDifference))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CONDITIONAL CREDIT DRAWER */}
            {isCreditMode && (
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black theme-text-app flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === 'tl' ? 'Pautang sa Suki:' : 'Charge to Customer:'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewCustomer((p) => !p)}
                    className="text-[11px] font-black theme-text-accent hover:underline cursor-pointer"
                  >
                    {isCreatingNewCustomer ? (lang === 'tl' ? 'Pumili sa listahan' : 'Choose existing') : '+ Bagong Suki'}
                  </button>
                </div>

                {isCreatingNewCustomer ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="w-3.5 h-3.5 theme-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder={lang === 'tl' ? 'Pangalan ng Bagong Suki *' : 'New Customer Name *'}
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        className="w-full theme-input border rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-black theme-text-app"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 theme-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        maxLength={11}
                        placeholder={lang === 'tl' ? 'Numero ng Telepono (09xxxxxxxxx)' : 'Phone (Optional - Max 11)'}
                        value={newCustomerPhone}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '').slice(0, 11);
                          setNewCustomerPhone(cleaned);
                        }}
                        className="w-full theme-input border rounded-xl py-2 pl-9 pr-3 text-xs font-mono font-bold theme-text-app"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 theme-text-secondary" />
                      <input
                        type="text"
                        placeholder={lang === 'tl' ? 'Maghanap ng Suki...' : 'Search customer...'}
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full theme-input border rounded-xl py-2 pl-8 pr-2 text-xs sm:text-sm font-bold theme-text-app"
                      />
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-modal-scrollbar">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((cust) => {
                          const isSelected = selectedCustomer?.id === cust.id;
                          return (
                            <button
                              key={cust.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(cust);
                                setNewCustomerName(cust.name);
                                if (cust.phone) setNewCustomerPhone(cust.phone);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs border text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'theme-bg-primary text-white border-transparent font-black shadow-xs'
                                  : 'theme-bg-card theme-border-subtle theme-text-app hover:border-[var(--color-primary)]'
                              }`}
                            >
                              <span className="font-black truncate">{cust.name}</span>
                              <span className="text-[10px] font-mono shrink-0 ml-2">
                                Bal: {formatPeso(cust.currentBalance || 0)}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-center py-2 text-xs theme-text-secondary">
                          <span>{lang === 'tl' ? 'Walang nahanap. I-type ang pangalan.' : 'No customer found.'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CREDIT DUE DATE & OPTIONAL REMARKS */}
                <div className="pt-2 border-t theme-border-subtle space-y-2">
                  <div>
                    <label className="block text-[11px] font-extrabold theme-text-secondary mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === 'tl' ? 'Araw ng Singil / Due Date (Opsyonal):' : 'Promise to Pay / Due Date (Optional):'}</span>
                    </label>
                    <input
                      type="date"
                      value={creditDueDate}
                      onChange={(e) => setCreditDueDate(e.target.value)}
                      className="w-full theme-input border rounded-xl py-1.5 px-3 text-xs font-bold theme-text-app"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold theme-text-secondary mb-1 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === 'tl' ? 'Karagdagang Tala (Opsyonal):' : 'Notes / Remarks (Optional):'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder={lang === 'tl' ? 'Hal. babayaran sa Sabado' : 'e.g. will pay on payday'}
                      value={creditNotes}
                      onChange={(e) => setCreditNotes(e.target.value)}
                      className="w-full theme-input border rounded-xl py-1.5 px-3 text-xs font-bold theme-text-app"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ACTION CONTROLS & "SCAN ANOTHER ITEM" TRIGGER */}
          <div className="space-y-2 pt-2 border-t theme-border-subtle shrink-0">
            {/* PRIMARY FAST ACTION: + ADD ANOTHER PRODUCT / SCAN NEXT */}
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleAddAnotherProduct}
              className="w-full py-2.5 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-500 dark:text-amber-400 font-black text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-xs select-none"
            >
              <Camera className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {lang === 'tl' ? '+ Mag-scan ng Isa Pang Paninda' : '+ Add Another Product (Scan Next)'}
              </span>
            </button>

            {/* CHECKOUT / CONFIRM BUTTONS (SELL / CREDIT) */}
            <div className="grid grid-cols-2 gap-2">
              {/* CREDIT BUTTON */}
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={() => {
                  if (!isCreditMode) {
                    setIsCreditMode(true);
                  } else {
                    handleConfirmCredit();
                  }
                }}
                className={`py-3 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer ${
                  isOutOfStock
                    ? 'opacity-40 cursor-not-allowed bg-stone-500/20 text-stone-400'
                    : isCreditMode
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isCreditMode
                    ? (lang === 'tl' ? 'Kumpirmahin Pautang' : 'Confirm Credit')
                    : (translate(lang, 'item_recognized_credit') || 'Credit')}
                </span>
              </button>

              {/* SELL BUTTON */}
              <button
                type="button"
                disabled={isOutOfStock || hasInsufficientBudget}
                onClick={() => {
                  if (isCreditMode) {
                    setIsCreditMode(false);
                  } else {
                    handleConfirmSell();
                  }
                }}
                className={`py-3 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer ${
                  isOutOfStock || hasInsufficientBudget
                    ? 'opacity-40 cursor-not-allowed theme-bg-surface-subtle theme-text-secondary'
                    : 'theme-bg-primary text-white shadow-2xs hover:opacity-95'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-white" />
                <span>
                  {isCreditMode
                    ? (lang === 'tl' ? 'Lumipat sa Benta' : 'Switch to Sell')
                    : (translate(lang, 'item_recognized_sell') || 'Sell Now')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalPortal>
  );
};
