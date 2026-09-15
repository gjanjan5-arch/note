import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Share2,
  Package,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Check,
} from 'lucide-react';
import { db } from '../db/db';
import type { InventoryItem } from '../types';
import { formatPeso } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';
import { getStoreProfile } from '../utils/storeSettings';
import { safeStorage } from '../utils/safeStorage';

interface PalengkeChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
}

interface CustomChecklistItem {
  id: string;
  name: string;
  qtyText: string;
  estCost?: number;
  isBought: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'tindahan_palengke_custom_items';
const CHECKED_INVENTORY_KEY = 'tindahan_palengke_checked_inventory_ids';

export const PalengkeChecklistModal: React.FC<PalengkeChecklistModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [customItems, setCustomItems] = useState<CustomChecklistItem[]>([]);
  const [checkedInventoryIds, setCheckedInventoryIds] = useState<number[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'LOW' | 'CUSTOM' | 'CHECKED'>('ALL');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

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

  // Load custom items from safeStorage
  useEffect(() => {
    if (isOpen) {
      db.inventory
        .toArray()
        .then((items) => setInventoryList(items))
        .catch((e) => console.warn('Could not load inventory:', e));

      try {
        const rawCustom = safeStorage.getItem(STORAGE_KEY);
        if (rawCustom) {
          setCustomItems(JSON.parse(rawCustom));
        }
        const rawChecked = safeStorage.getItem(CHECKED_INVENTORY_KEY);
        if (rawChecked) {
          setCheckedInventoryIds(JSON.parse(rawChecked));
        }
      } catch (err) {
        console.warn('Storage read error:', err);
      }
    }
  }, [isOpen]);

  const saveCustomItems = (updated: CustomChecklistItem[]) => {
    setCustomItems(updated);
    try {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save custom items:', e);
    }
  };

  const saveCheckedInventory = (updated: number[]) => {
    setCheckedInventoryIds(updated);
    try {
      safeStorage.setItem(CHECKED_INVENTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save checked inventory:', e);
    }
  };

  // Low stock inventory items
  const lowStockItems = useMemo(() => {
    return inventoryList.filter((it) => {
      const minAlert = typeof it.minStockAlert === 'number' ? it.minStockAlert : 5;
      return it.stock <= minAlert;
    });
  }, [inventoryList]);

  // Combined checklist calculation
  const combinedList = useMemo(() => {
    const list: Array<{
      type: 'INVENTORY' | 'CUSTOM';
      id: string | number;
      name: string;
      stockInfo?: string;
      qtyNeededText: string;
      estCost: number;
      isBought: boolean;
      originalItem?: InventoryItem;
      customItem?: CustomChecklistItem;
    }> = [];

    // Low stock inventory items
    lowStockItems.forEach((inv) => {
      const isBought = inv.id ? checkedInventoryIds.includes(inv.id) : false;
      const minAlert = typeof inv.minStockAlert === 'number' ? inv.minStockAlert : 5;
      const neededQty = Math.max(1, (minAlert * 2) - inv.stock);
      const estCost = (inv.unitCost || 0) * neededQty;

      list.push({
        type: 'INVENTORY',
        id: inv.id || inv.name,
        name: inv.name,
        stockInfo: `Stock: ${inv.stock} pcs (Min: ${minAlert})`,
        qtyNeededText: `+${neededQty} pcs`,
        estCost,
        isBought,
        originalItem: inv,
      });
    });

    // Custom items
    customItems.forEach((c) => {
      list.push({
        type: 'CUSTOM',
        id: c.id,
        name: c.name,
        stockInfo: 'Supplies / Dagdag',
        qtyNeededText: c.qtyText || '1x',
        estCost: c.estCost || 0,
        isBought: c.isBought,
        customItem: c,
      });
    });

    return list;
  }, [lowStockItems, customItems, checkedInventoryIds]);

  const filteredList = useMemo(() => {
    if (activeFilter === 'LOW') {
      return combinedList.filter((it) => it.type === 'INVENTORY' && !it.isBought);
    }
    if (activeFilter === 'CUSTOM') {
      return combinedList.filter((it) => it.type === 'CUSTOM');
    }
    if (activeFilter === 'CHECKED') {
      return combinedList.filter((it) => it.isBought);
    }
    return combinedList;
  }, [combinedList, activeFilter]);

  const totalEstimatedBudget = useMemo(() => {
    return combinedList
      .filter((it) => !it.isBought)
      .reduce((acc, curr) => acc + (curr.estCost || 0), 0);
  }, [combinedList]);

  if (!isOpen) return null;

  const handleToggleCheck = (item: (typeof combinedList)[number]) => {
    if (item.type === 'INVENTORY') {
      const invId = item.id as number;
      if (checkedInventoryIds.includes(invId)) {
        saveCheckedInventory(checkedInventoryIds.filter((id) => id !== invId));
      } else {
        saveCheckedInventory([...checkedInventoryIds, invId]);
      }
    } else {
      const customId = item.id as string;
      const updated = customItems.map((c) =>
        c.id === customId ? { ...c, isBought: !c.isBought } : c
      );
      saveCustomItems(updated);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: CustomChecklistItem = {
      id: `c_${Date.now()}`,
      name: newItemName.trim(),
      qtyText: newItemQty.trim() || '1x',
      estCost: parseFloat(newItemCost) || 0,
      isBought: false,
      createdAt: Date.now(),
    };

    saveCustomItems([newItem, ...customItems]);
    setNewItemName('');
    setNewItemQty('');
    setNewItemCost('');
    setIsAddingCustom(false);
  };

  const handleDeleteCustom = (id: string) => {
    saveCustomItems(customItems.filter((c) => c.id !== id));
  };

  const handleClearChecked = () => {
    saveCheckedInventory([]);
    saveCustomItems(customItems.filter((c) => !c.isBought));
  };

  const handleShareOrCopy = () => {
    const store = getStoreProfile();
    const unbought = combinedList.filter((it) => !it.isBought);
    let text = `🛒 LISTAHAN SA PAMAMALENGKE (${store.storeName})\n`;
    text += `Petsa: ${new Date().toLocaleDateString()}\n`;
    text += `------------------------------------\n`;

    if (unbought.length === 0) {
      text += `Lahat ng paninda at gamit ay kompleto na!\n`;
    } else {
      unbought.forEach((item, idx) => {
        text += `${idx + 1}. [ ] ${item.name} - ${item.qtyNeededText}${
          item.estCost > 0 ? ` (~${formatPeso(item.estCost)})` : ''
        }\n`;
      });
      if (totalEstimatedBudget > 0) {
        text += `------------------------------------\n`;
        text += `Tinatayang Badyet: ${formatPeso(totalEstimatedBudget)}\n`;
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="theme-card max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b theme-border bg-linear-to-r from-emerald-500/10 to-teal-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg theme-text-app leading-tight">
                  {translate(lang, 'palengke_heading')}
                </h3>
                <p className="text-[11px] sm:text-xs theme-text-secondary mt-0.5">
                  {translate(lang, 'tool_palengke_desc')}
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

          {/* Budget & Action Ribbon */}
          <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider theme-text-secondary block">
                {translate(lang, 'palengke_est_budget')}
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatPeso(totalEstimatedBudget)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddingCustom((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 active:scale-95 transition-transform cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{translate(lang, 'palengke_add_custom_item')}</span>
              </button>
              <button
                type="button"
                onClick={handleShareOrCopy}
                className="p-2 rounded-xl theme-bg-card theme-text-app border theme-border hover:theme-border-strong text-xs font-black flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                title={translate(lang, 'palengke_share_list')}
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-500" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 pt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: translate(lang, 'palengke_filter_all') },
              { id: 'LOW', label: translate(lang, 'palengke_filter_low') },
              { id: 'CUSTOM', label: translate(lang, 'palengke_filter_custom') },
              { id: 'CHECKED', label: translate(lang, 'palengke_filter_checked') },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'theme-bg-surface-subtle theme-text-secondary hover:theme-text-app'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Add Custom Item Drawer Form */}
          {isAddingCustom && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddCustom}
              className="p-3 mx-4 mt-2 rounded-2xl theme-bg-surface-subtle border theme-border space-y-2"
            >
              <input
                type="text"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={translate(lang, 'palengke_item_name_placeholder')}
                className="w-full px-3 py-2 rounded-xl text-xs theme-input-box"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  placeholder={translate(lang, 'palengke_qty_placeholder')}
                  className="w-full px-3 py-2 rounded-xl text-xs theme-input-box"
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={newItemCost}
                  onChange={(e) => setNewItemCost(e.target.value)}
                  placeholder="Est. Cost (₱)"
                  className="w-full px-3 py-2 rounded-xl text-xs theme-input-box"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="px-3 py-1 rounded-xl text-xs font-bold theme-text-secondary"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer shadow-xs active:scale-95"
                >
                  {translate(lang, 'btn_save')}
                </button>
              </div>
            </motion.form>
          )}

          {/* List Content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1">
            {copiedToast && (
              <div className="p-2.5 rounded-xl bg-emerald-500 text-white text-center text-xs font-black shadow-lg">
                {translate(lang, 'palengke_copied')}
              </div>
            )}

            {filteredList.length === 0 ? (
              <div className="py-12 text-center theme-text-secondary space-y-2">
                <ShoppingCart className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs font-bold">{translate(lang, 'palengke_no_items')}</p>
              </div>
            ) : (
              filteredList.map((item) => (
                <div
                  key={`${item.type}_${item.id}`}
                  onClick={() => handleToggleCheck(item)}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    item.isBought
                      ? 'theme-bg-surface-subtle theme-border opacity-60'
                      : 'theme-bg-card theme-border hover:border-emerald-500 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0 text-emerald-500">
                      {item.isBought ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 theme-text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs sm:text-sm font-black truncate ${
                          item.isBought ? 'line-through theme-text-secondary' : 'theme-text-app'
                        }`}
                      >
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] theme-text-secondary">
                        <span>{item.stockInfo}</span>
                        {item.type === 'INVENTORY' && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                        {item.qtyNeededText}
                      </span>
                      {item.estCost > 0 && (
                        <span className="text-[10px] theme-text-secondary font-bold block">
                          ~{formatPeso(item.estCost)}
                        </span>
                      )}
                    </div>

                    {item.type === 'CUSTOM' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustom(item.id as string);
                        }}
                        className="p-1.5 rounded-lg theme-hover-bg text-red-500 hover:text-red-700 cursor-pointer"
                        title={translate(lang, 'btn_delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Clean Buttons */}
          <div className="p-4 sm:p-5 border-t theme-border flex items-center justify-between">
            <button
              type="button"
              onClick={handleClearChecked}
              className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{translate(lang, 'palengke_clear_checked')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-md cursor-pointer active:scale-95 transition-transform"
            >
              {translate(lang, 'btn_close')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
