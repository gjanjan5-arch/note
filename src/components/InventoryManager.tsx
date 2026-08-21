import React, { useState, useRef, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit3,
  Trash2,
  Minus,
  ShoppingBag,
  CheckCircle2,
  X,
  Filter,
  Check,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import type { InventoryItem } from '../types';
import { db } from '../db/db';
import { formatPeso, formatDateTime } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  lang: LanguageCode;
  onRefresh: () => void;
}

interface CartItem {
  id: string; // unique cart line id
  productId: number;
  name: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
}

interface SaleReceipt {
  timestamp: number;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  totalAmount: number;
  buyersMoney?: number;
  change?: number;
}

const PRODUCT_CATEGORIES = [
  'Beverages',
  'Noodles',
  'Snacks',
  'Condiments',
  'Personal Care',
  'Cigarettes',
  'Grocery',
];

const INVENTORY_FILTER_OPTIONS = [
  { id: 'AZ_SORT', label: 'A to Z Sort', icon: '🔤', type: 'sort' },
  { id: 'Beverages', label: 'Beverages', icon: '🥤', type: 'category' },
  { id: 'Noodles', label: 'Noodles', icon: '🍜', type: 'category' },
  { id: 'Snacks', label: 'Snacks', icon: '🍿', type: 'category' },
  { id: 'Condiments', label: 'Condiments', icon: '🧂', type: 'category' },
  { id: 'Personal Care', label: 'Personal Care', icon: '🧴', type: 'category' },
  { id: 'Cigarettes', label: 'Cigarettes', icon: '🚬', type: 'category' },
  { id: 'Grocery', label: 'Grocery', icon: '🥫', type: 'category' },
] as const;

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  inventory,
  lang,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterOption, setActiveFilterOption] = useState<string | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Add / Edit Product Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Beverages');
  const [stock, setStock] = useState('10');
  const [unitCost, setUnitCost] = useState('10');
  const [unitPrice, setUnitPrice] = useState('12');
  const [minStockAlert, setMinStockAlert] = useState('5');

  // Add Stock Modal state
  const [addStockItem, setAddStockItem] = useState<InventoryItem | null>(null);
  const [addStockQty, setAddStockQty] = useState('1');

  // Sell Now Multi-Item Sale Modal state
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [initialSellProduct, setInitialSellProduct] = useState<InventoryItem | null>(null);
  const [buyersMoneyInput, setBuyersMoneyInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAddProductPickerOpen, setIsAddProductPickerOpen] = useState(false);
  const [pickerSearchTerm, setPickerSearchTerm] = useState('');

  // Sale Receipt Modal state
  const [activeReceipt, setActiveReceipt] = useState<SaleReceipt | null>(null);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSelectFilterOption = (optionId: string) => {
    if (activeFilterOption === optionId) {
      setActiveFilterOption(null); // Toggle off if tapped again
    } else {
      setActiveFilterOption(optionId);
    }
    setIsFilterDropdownOpen(false);
  };

  const clearFilter = () => {
    setActiveFilterOption(null);
    setIsFilterDropdownOpen(false);
  };

  const filteredItems = (inventory || [])
    .filter((item) => {
      // Category filter (if an option other than AZ_SORT is selected)
      if (activeFilterOption && activeFilterOption !== 'AZ_SORT') {
        if (item.category !== activeFilterOption) {
          return false;
        }
      }

      // Comprehensive search across all inventory item fields
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q) || false;
        const matchCategory = item.category?.toLowerCase().includes(q) || false;
        const matchSKU = item.sku?.toLowerCase().includes(q) || false;
        const matchDescription = item.description?.toLowerCase().includes(q) || false;

        const currentStock = item.stock != null ? item.stock : item.quantity;
        const matchStock =
          currentStock != null &&
          (currentStock.toString().includes(q) ||
            (currentStock <= 0 && 'out of stock'.includes(q)) ||
            `stock: ${currentStock}`.includes(q));

        const matchUnitPrice =
          item.unitPrice != null &&
          (item.unitPrice.toString().includes(q) ||
            formatPeso(item.unitPrice).toLowerCase().includes(q));

        const matchUnitCost =
          item.unitCost != null &&
          (item.unitCost.toString().includes(q) ||
            formatPeso(item.unitCost).toLowerCase().includes(q));

        const tubo =
          item.unitPrice != null && item.unitCost != null ? item.unitPrice - item.unitCost : null;
        const matchTubo =
          tubo != null &&
          (tubo.toString().includes(q) ||
            formatPeso(tubo).toLowerCase().includes(q) ||
            'profit'.includes(q) ||
            'tubo'.includes(q) ||
            'cost'.includes(q));

        return (
          matchName ||
          matchCategory ||
          matchSKU ||
          matchDescription ||
          Boolean(matchStock) ||
          Boolean(matchUnitPrice) ||
          Boolean(matchUnitCost) ||
          Boolean(matchTubo)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (activeFilterOption === 'AZ_SORT') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

  const lowStockItems = inventory.filter((i) => i.stock <= i.minStockAlert);

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setCategory('Beverages');
    setStock('10');
    setUnitCost('10');
    setUnitPrice('12');
    setMinStockAlert('5');
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category || 'Beverages');
    setStock(item.stock.toString());
    setUnitCost(item.unitCost.toString());
    setUnitPrice(item.unitPrice.toString());
    setMinStockAlert((item.minStockAlert || 5).toString());
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert(lang === 'tl' ? 'Mangyaring ilagay ang pangalan ng paninda.' : 'Please enter the product name.');
      return;
    }

    if (stock.trim() === '' || isNaN(Number(stock))) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong dami ng stock.' : 'Please enter a valid stock quantity.');
      return;
    }

    if (unitCost.trim() === '' || isNaN(Number(unitCost))) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong puhunan / cost price.' : 'Please enter a valid cost price.');
      return;
    }

    if (unitPrice.trim() === '' || isNaN(Number(unitPrice))) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong presyo ng benta.' : 'Please enter a valid selling price.');
      return;
    }

    if (minStockAlert.trim() === '' || isNaN(Number(minStockAlert))) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong min stock alert.' : 'Please enter a valid min stock alert.');
      return;
    }

    const parsedStock = Math.floor(Number(stock));
    const parsedUnitCost = Number(unitCost);
    const parsedUnitPrice = Number(unitPrice);
    const parsedMinStock = Math.floor(Number(minStockAlert));

    if (parsedStock < 0 || parsedUnitCost < 0 || parsedUnitPrice < 0 || parsedMinStock < 1) {
      alert(
        lang === 'tl'
          ? 'Ang stock at presyo ay dapat 0 pataas, at ang min stock alert ay dapat 1 pataas.'
          : 'Stock and prices must be 0 or greater, and minimum stock alert must be at least 1.'
      );
      return;
    }

    try {
      // Check for duplicate name if adding or renaming
      const existing = await db.inventory.where('name').equalsIgnoreCase(trimmedName).first();
      if (existing && (!editingItem || existing.id !== editingItem.id)) {
        alert(
          lang === 'tl'
            ? `May existing paninda na may pangalang "${trimmedName}". Mangyaring gumamit ng ibang pangalan.`
            : `A product with the name "${trimmedName}" already exists. Please choose a different name.`
        );
        return;
      }

      const validStock = parsedStock;
      const validUnitCost = parsedUnitCost;
      const validUnitPrice = parsedUnitPrice;
      const validMinStockAlert = parsedMinStock;

      if (editingItem && editingItem.id) {
        await db.inventory.update(editingItem.id, {
          name: trimmedName,
          category,
          stock: validStock,
          unitCost: validUnitCost,
          unitPrice: validUnitPrice,
          minStockAlert: validMinStockAlert,
          updatedAt: Date.now(),
        });
        showNotification(lang === 'tl' ? 'Matagumpay na na-update ang paninda!' : 'Product updated successfully!');
      } else {
        await db.inventory.add({
          name: trimmedName,
          category,
          stock: validStock,
          unitCost: validUnitCost,
          unitPrice: validUnitPrice,
          minStockAlert: validMinStockAlert,
          updatedAt: Date.now(),
        });
        showNotification(lang === 'tl' ? 'Matagumpay na naidagdag ang bagong paninda!' : 'New product added successfully!');
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      alert('Error saving product: ' + (err.message || 'Unknown error'));
    }
  };

  // Open Add Stock Modal
  const openAddStockModal = (item: InventoryItem) => {
    setAddStockItem(item);
    setAddStockQty('1');
  };

  // Confirm Add Stock
  const handleConfirmAddStock = async () => {
    if (!addStockItem || !addStockItem.id) return;
    if (addStockQty.trim() === '' || isNaN(Number(addStockQty))) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong dami (1 o pataas).' : 'Please enter a valid quantity (1 or more).');
      return;
    }
    const qtyToAdd = Math.floor(Number(addStockQty));
    if (qtyToAdd < 1) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong dami (1 o pataas).' : 'Please enter a valid quantity (1 or more).');
      return;
    }
    const newTotalStock = addStockItem.stock + qtyToAdd;

    try {
      await db.inventory.update(addStockItem.id, {
        stock: newTotalStock,
        updatedAt: Date.now(),
      });

      const todayISO = new Date().toISOString().slice(0, 10);
      await db.transactions.add({
        timestamp: Date.now(),
        dateStr: todayISO,
        type: 'RESTOCK',
        items: [{ itemName: addStockItem.name, quantity: qtyToAdd, totalPrice: addStockItem.unitCost * qtyToAdd }],
        totalAmount: addStockItem.unitCost * qtyToAdd,
        rawNote: `restock ${qtyToAdd} ${addStockItem.name}`,
        syncStatus: 'LOCAL',
      });

      showNotification(`Added ${qtyToAdd} pcs to ${addStockItem.name}`);
      setAddStockItem(null);
      onRefresh();
    } catch (err: any) {
      console.error('Add stock error:', err);
      alert('Failed to add stock: ' + (err.message || 'Unknown error'));
    }
  };

  // Open Sell Now Multi-Item Sale Modal
  const openSellNowModal = (item: InventoryItem) => {
    if (!item.id) return;
    setInitialSellProduct(item);
    setBuyersMoneyInput('');
    setIsAddProductPickerOpen(false);
    setPickerSearchTerm('');
    // Pre-add the tapped product with quantity 1
    const initialCartItem: CartItem = {
      id: `${item.id}-${Date.now()}`,
      productId: item.id,
      name: item.name,
      unitPrice: item.unitPrice,
      availableStock: item.stock,
      quantity: 1,
    };
    setCart([initialCartItem]);
    setSellModalOpen(true);
  };

  // Add another product to cart from picker
  const handleAddProductToCart = (product: InventoryItem) => {
    if (!product.id) return;
    const newCartItem: CartItem = {
      id: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      availableStock: product.stock,
      quantity: 1,
    };
    setCart((prev) => [...prev, newCartItem]);
    setIsAddProductPickerOpen(false);
    setPickerSearchTerm('');
  };

  const handleUpdateCartItemQty = (cartItemId: string, newQty: number) => {
    setCart((prev) =>
      prev.map((it) => {
        if (it.id === cartItemId) {
          const clamped = Math.max(1, Math.min(it.availableStock, newQty));
          return { ...it, quantity: clamped };
        }
        return it;
      })
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((it) => it.id !== cartItemId));
  };

  // Calculate cart totals
  const totalSaleAmount = cart.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const parsedBuyersMoney = buyersMoneyInput.trim() !== '' && !isNaN(Number(buyersMoneyInput))
    ? Number(buyersMoneyInput)
    : null;

  const isBudgetEntered = parsedBuyersMoney !== null;
  const budgetDifference = isBudgetEntered ? parsedBuyersMoney - totalSaleAmount : 0;
  const hasInsufficientBudget = isBudgetEntered && budgetDifference < 0;

  // Check if aggregate quantity of any product in cart exceeds available stock
  const aggregateQtyByProduct: Record<number, number> = {};
  cart.forEach((it) => {
    aggregateQtyByProduct[it.productId] = (aggregateQtyByProduct[it.productId] || 0) + it.quantity;
  });

  const hasExceededStock = cart.some((it) => {
    const totalQtyWanted = aggregateQtyByProduct[it.productId] || 0;
    return totalQtyWanted > it.availableStock;
  });

  const isCartEmpty = cart.length === 0;

  // Confirm Multi-Item Sale
  const handleConfirmSellNow = async () => {
    if (isCartEmpty) {
      alert(lang === 'tl' ? 'Walang produkto sa cart.' : 'Your cart is empty.');
      return;
    }

    if (hasExceededStock) {
      alert(
        lang === 'tl'
          ? 'May produkto sa cart na lumalagpas sa kasalukuyang stock!'
          : 'One or more items in the cart exceed available stock!'
      );
      return;
    }

    if (hasInsufficientBudget) {
      alert(
        lang === 'tl'
          ? `Kulang ang bayad ng mamimili ng ${formatPeso(Math.abs(budgetDifference))}.`
          : `Buyer's money is insufficient by ${formatPeso(Math.abs(budgetDifference))}.`
      );
      return;
    }

    try {
      const todayISO = new Date().toISOString().slice(0, 10);
      const timestamp = Date.now();

      // Aggregate deductions per product
      const consolidatedItemsMap: Record<number, { name: string; quantity: number; unitPrice: number; subtotal: number }> = {};
      cart.forEach((it) => {
        if (!consolidatedItemsMap[it.productId]) {
          consolidatedItemsMap[it.productId] = {
            name: it.name,
            quantity: 0,
            unitPrice: it.unitPrice,
            subtotal: 0,
          };
        }
        consolidatedItemsMap[it.productId].quantity += it.quantity;
        consolidatedItemsMap[it.productId].subtotal += it.quantity * it.unitPrice;
      });

      // Prepare items for transaction
      const transactionItems = Object.values(consolidatedItemsMap).map((it) => ({
        itemName: it.name,
        quantity: it.quantity,
        totalPrice: it.subtotal,
        unitPrice: it.unitPrice,
      }));

      // Description summary (e.g. "Sold: Coke 250ml ×2, Lucky Me ×1")
      const itemsDescription = transactionItems
        .map((it) => `${it.itemName} ×${it.quantity}`)
        .join(', ');
      const rawNote = `Sold: ${itemsDescription}`;

      await db.transaction('rw', db.inventory, db.transactions, async () => {
        // Verify and deduct stock for each product
        for (const [prodIdStr, consolidated] of Object.entries(consolidatedItemsMap)) {
          const prodId = Number(prodIdStr);
          const currentItem = await db.inventory.get(prodId);
          if (!currentItem || currentItem.stock < consolidated.quantity) {
            throw new Error(`Not enough stock available for ${consolidated.name}`);
          }

          await db.inventory.update(prodId, {
            stock: currentItem.stock - consolidated.quantity,
            updatedAt: Date.now(),
          });
        }

        // Add single transaction to Ledger
        await db.transactions.add({
          timestamp,
          dateStr: todayISO,
          type: 'SALE',
          items: transactionItems,
          totalAmount: totalSaleAmount,
          rawNote,
          syncStatus: 'LOCAL',
        });
      });

      // Show receipt modal
      const receipt: SaleReceipt = {
        timestamp,
        items: transactionItems.map((it) => ({
          name: it.itemName,
          quantity: it.quantity,
          unitPrice: it.unitPrice || (it.totalPrice / it.quantity),
          subtotal: it.totalPrice,
        })),
        totalAmount: totalSaleAmount,
        buyersMoney: isBudgetEntered ? parsedBuyersMoney : undefined,
        change: isBudgetEntered && budgetDifference >= 0 ? budgetDifference : undefined,
      };

      setSellModalOpen(false);
      setCart([]);
      setInitialSellProduct(null);
      setActiveReceipt(receipt);
      onRefresh();
    } catch (err: any) {
      console.error('Sale error:', err);
      alert('Failed to record sale: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteItem = async (id?: number) => {
    if (!id) return;
    if (confirm(translate(lang, 'delete_confirm'))) {
      await db.inventory.delete(id);
      showNotification('Product deleted.');
      onRefresh();
    }
  };

  return (
    <div id="inventory-manager-container" className="space-y-4">
      {/* Toast / Notification Banner */}
      {statusMessage && (
        <div className="theme-bg-primary text-white text-xs font-black p-3 rounded-2xl flex items-center gap-2 shadow-md animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-white/90 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Low Stock Banner Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-3xl p-4 flex items-center justify-between gap-3 text-xs theme-text-app shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="font-black theme-text-app">
                {lowStockItems.length} {translate(lang, 'low_stock_warning')}
              </strong>
              <p className="text-[11px] theme-text-secondary font-medium">
                {lowStockItems.map((i) => i.name).slice(0, 3).join(', ')}
                {lowStockItems.length > 3 ? '...' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveFilterOption(null)}
            className="text-xs font-extrabold theme-bg-surface-subtle theme-text-accent border theme-border-subtle px-3 py-1.5 rounded-xl shrink-0 transition-all active:scale-95 hover:bg-white/10"
          >
            {translate(lang, 'filter_all')}
          </button>
        </div>
      )}

      {/* Control Header & Add Button */}
      <div
        id="inventory-controls-section"
        className="theme-card p-3.5 sm:p-4 rounded-3xl shadow-2xs border space-y-3 transition-colors duration-200"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 theme-text-secondary absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={translate(lang, 'search_placeholder')}
              className="w-full theme-input border rounded-2xl py-2 pl-9.5 pr-3 text-xs sm:text-sm theme-text-app focus:outline-none font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filter by Dropdown Anchor */}
            <div className="relative" ref={dropdownRef}>
              <button
                id="btn-inventory-filter-by"
                onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-extrabold border transition-all active:scale-95 shadow-2xs ${
                  activeFilterOption
                    ? 'theme-bg-primary text-white border-white/20'
                    : 'theme-bg-surface-subtle hover:bg-white/10 theme-text-app border-theme-border-subtle'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{translate(lang, 'filter_by') || 'Filter by'}</span>
                {activeFilterOption && (
                  <span className="w-4 h-4 rounded-full bg-white text-[var(--color-primary)] flex items-center justify-center text-[10px] font-black shrink-0">
                    1
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {isFilterDropdownOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-60 max-w-[calc(100vw-2rem)] theme-card rounded-2xl p-2 shadow-2xl border theme-border-subtle z-50 animate-in fade-in zoom-in-95 space-y-1">
                  {INVENTORY_FILTER_OPTIONS.map((opt, index) => {
                    const isSelected = activeFilterOption === opt.id;
                    return (
                      <React.Fragment key={opt.id}>
                        {index === 1 && <div className="border-t theme-border-subtle my-1" />}
                        <button
                          onClick={() => handleSelectFilterOption(opt.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
                            isSelected
                              ? 'theme-bg-primary text-white'
                              : 'theme-text-app hover:theme-bg-surface-subtle'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{opt.icon}</span>
                            <span>{opt.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </React.Fragment>
                    );
                  })}

                  {/* Clear filter button if active */}
                  {activeFilterOption && (
                    <div className="pt-1 border-t theme-border-subtle">
                      <button
                        onClick={clearFilter}
                        className="w-full text-center py-1.5 text-[11px] font-bold theme-text-secondary hover:theme-text-accent"
                      >
                        {lang === 'tl' ? 'I-reset ang filter' : 'Clear Filter'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              id="btn-add-paninda"
              onClick={openAddModal}
              className="flex items-center justify-center gap-1.5 theme-bg-primary text-white px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shadow-2xs active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 text-white/90" />
              <span>+ {translate(lang, 'btn_add_item')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-full theme-card rounded-3xl p-8 text-center border border-dashed theme-border theme-text-secondary">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold theme-text-app">{translate(lang, 'no_records_found')}</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isLowStock = item.stock <= item.minStockAlert;
            const isOutOfStock = item.stock <= 0;
            const tubo = item.unitPrice - item.unitCost;

            return (
              <div
                key={item.id}
                className={`theme-card p-4 rounded-3xl border transition-all flex flex-col justify-between gap-3 shadow-2xs ${
                  isOutOfStock
                    ? 'border-red-500/40 bg-red-500/5'
                    : isLowStock
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'hover:border-[var(--color-primary)]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider theme-text-accent theme-bg-surface-subtle px-2 py-0.5 rounded-lg border theme-border-subtle">
                        {item.category}
                      </span>
                      <h4 className="font-black theme-text-app text-base mt-1.5">{item.name}</h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 theme-text-secondary hover:theme-text-primary transition-colors rounded-lg hover:bg-white/10"
                        title="Edit Item"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 theme-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Pricing and Stock details */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs theme-bg-surface-subtle p-2.5 rounded-2xl border theme-border-subtle">
                    <div>
                      <span className="text-[10px] font-bold theme-text-secondary block">
                        {translate(lang, 'price')}
                      </span>
                      <strong className="text-sm font-black theme-text-app">
                        {formatPeso(item.unitPrice)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold theme-text-secondary block">Cost / Profit</span>
                      <span className="text-xs font-bold theme-text-secondary">
                        {formatPeso(item.unitCost)}{' '}
                        <span className="text-[10px] theme-text-accent font-black">
                          (+{formatPeso(tubo)})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock Status & Action Buttons */}
                <div className="pt-2 border-t theme-border-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                        isOutOfStock
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : isLowStock
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'theme-bg-surface-subtle theme-text-accent border theme-border-subtle'
                      }`}
                    >
                      {isOutOfStock ? 'Out of Stock (0)' : `Stock: ${item.stock} pcs`}
                    </span>
                    {isLowStock && !isOutOfStock && (
                      <span className="text-[10px] font-black text-amber-400">⚠️ Reorder!</span>
                    )}
                  </div>

                  {/* Explicit Text Action Buttons: [ Add Stock ] and [ Sell Now ] */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openAddStockModal(item)}
                      className="theme-bg-surface-subtle hover:bg-white/10 border theme-border-subtle theme-text-app font-black text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 theme-text-accent" />
                      <span>{translate(lang, 'btn_add_stock')}</span>
                    </button>

                    <button
                      onClick={() => openSellNowModal(item)}
                      disabled={isOutOfStock}
                      className={`font-black text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs ${
                        isOutOfStock
                          ? 'opacity-40 cursor-not-allowed theme-bg-surface-subtle theme-text-secondary'
                          : 'theme-bg-primary text-white shadow-2xs'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-white/90" />
                      <span>{isOutOfStock ? translate(lang, 'out_of_stock') : translate(lang, 'btn_sell_now')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 1. ADD STOCK MODAL */}
      {addStockItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle mb-3">
              <div>
                <h3 className="font-black theme-text-app text-base">
                  {translate(lang, 'add_stock_title')}
                </h3>
                <p className="text-xs theme-text-accent font-bold">{addStockItem.name}</p>
              </div>
              <button
                onClick={() => setAddStockItem(null)}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-1">
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle flex items-center justify-between text-xs font-bold theme-text-secondary">
                <span>{translate(lang, 'current_stock', { count: addStockItem.stock })}</span>
                <span className="font-mono theme-text-app">{addStockItem.stock} pcs</span>
              </div>

              <div>
                <label className="block font-black theme-text-app text-xs mb-2 text-center">
                  {translate(lang, 'how_many_adding')}
                </label>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(addStockQty) || 0;
                      setAddStockQty(Math.max(1, current - 1).toString());
                    }}
                    className="w-11 h-11 rounded-2xl theme-bg-surface-subtle hover:bg-white/10 theme-text-app font-black text-lg flex items-center justify-center transition-all active:scale-90"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={addStockQty}
                    onChange={(e) => setAddStockQty(e.target.value)}
                    className="w-24 h-11 text-center font-black text-xl theme-input border rounded-2xl theme-text-app focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(addStockQty) || 0;
                      setAddStockQty((current + 1).toString());
                    }}
                    className="w-11 h-11 rounded-2xl theme-bg-primary text-white font-black text-lg flex items-center justify-center transition-all active:scale-90 shadow-2xs"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle flex items-center justify-between text-xs font-black theme-text-app">
                <span>New Total Stock:</span>
                <span className="text-sm font-black theme-text-accent">
                  {addStockItem.stock + (!isNaN(Number(addStockQty)) && Number(addStockQty) > 0 ? Math.floor(Number(addStockQty)) : 0)} pcs
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setAddStockItem(null)}
                  className="px-4 py-2.5 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddStock}
                  className="theme-bg-primary text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-white/90" />
                  <span>{translate(lang, 'btn_ok')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ENHANCED MULTI-ITEM SELL NOW MODAL */}
      {sellModalOpen && initialSellProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="theme-card rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border animate-in fade-in zoom-in-95 my-auto max-h-[90vh] flex flex-col justify-between">
            {/* Header: "Sell Product" + product name + close (X) button */}
            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle shrink-0">
              <div>
                <h3 className="font-black theme-text-app text-base">
                  {translate(lang, 'sell_product_title') || 'Sell Product'}
                </h3>
                <p className="text-xs theme-text-accent font-bold">{initialSellProduct.name}</p>
              </div>
              <button
                onClick={() => {
                  setSellModalOpen(false);
                  setCart([]);
                  setInitialSellProduct(null);
                  setIsAddProductPickerOpen(false);
                }}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 py-3 overflow-y-auto pr-1 flex-1">
              {/* Budget Input Field: Label "Buyer's Money" */}
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-black theme-text-app">
                    {lang === 'tl' ? 'Pera ng Mamimili (Buyer\'s Money)' : "Buyer's Money"}
                  </label>
                  <span className="text-[10px] font-bold theme-text-secondary">
                    {lang === 'tl' ? 'Opsyonal' : 'Optional'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-black text-sm theme-text-secondary">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={buyersMoneyInput}
                    onChange={(e) => setBuyersMoneyInput(e.target.value)}
                    placeholder={lang === 'tl' ? 'Hal. 200' : 'e.g. 200'}
                    className="w-full theme-input border rounded-xl py-2 pl-7 pr-3 text-sm font-black theme-text-app focus:outline-none"
                  />
                </div>
              </div>

              {/* Available Stock info for pre-selected product */}
              <div className="flex items-center justify-between text-xs px-1 theme-text-secondary font-bold">
                <span>{translate(lang, 'available_stock', { count: initialSellProduct.stock })}:</span>
                <span className={`font-mono ${initialSellProduct.stock <= 0 ? 'text-red-400' : 'theme-text-app'}`}>
                  {initialSellProduct.stock} pcs
                </span>
              </div>

              {/* Cart Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black uppercase tracking-wider theme-text-secondary flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 theme-text-accent" />
                    <span>Cart ({cart.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddProductPickerOpen((prev) => !prev);
                      setPickerSearchTerm('');
                    }}
                    className="text-xs font-extrabold theme-text-accent hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Product</span>
                  </button>
                </div>

                {/* Searchable Product Picker Drawer */}
                {isAddProductPickerOpen && (
                  <div className="theme-bg-surface-elevated p-3 rounded-2xl border theme-border space-y-2 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black theme-text-app">
                        {lang === 'tl' ? 'Pumili ng Karagdagang Produkto' : 'Select Product to Add'}
                      </span>
                      <button
                        onClick={() => setIsAddProductPickerOpen(false)}
                        className="text-xs theme-text-secondary hover:theme-text-app"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 theme-text-secondary absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={pickerSearchTerm}
                        onChange={(e) => setPickerSearchTerm(e.target.value)}
                        placeholder={translate(lang, 'search_placeholder')}
                        className="w-full theme-input border rounded-xl py-1.5 pl-8 pr-2 text-xs theme-text-app focus:outline-none"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {inventory
                        .filter((item) =>
                          pickerSearchTerm.trim()
                            ? item.name.toLowerCase().includes(pickerSearchTerm.toLowerCase()) ||
                              item.category.toLowerCase().includes(pickerSearchTerm.toLowerCase())
                            : true
                        )
                        .map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleAddProductToCart(prod)}
                            disabled={prod.stock <= 0}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
                              prod.stock <= 0
                                ? 'opacity-40 cursor-not-allowed theme-bg-surface-subtle'
                                : 'theme-bg-surface-subtle hover:theme-bg-primary hover:text-white theme-text-app'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <span className="truncate block">{prod.name}</span>
                              <span className="text-[10px] opacity-75 font-normal">
                                Stock: {prod.stock} pcs • {formatPeso(prod.unitPrice)}
                              </span>
                            </div>
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Running Cart Items List */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {cart.map((cartItem) => {
                    const totalProductQtyInCart = aggregateQtyByProduct[cartItem.productId] || cartItem.quantity;
                    const isExceeding = totalProductQtyInCart > cartItem.availableStock;

                    return (
                      <div
                        key={cartItem.id}
                        className={`theme-bg-surface-subtle p-3 rounded-2xl border transition-all space-y-2 ${
                          isExceeding ? 'border-red-500/50 bg-red-500/10' : 'theme-border-subtle'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-black theme-text-app">{cartItem.name}</h4>
                            <span className="text-[11px] font-medium theme-text-secondary">
                              {formatPeso(cartItem.unitPrice)} each
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(cartItem.id)}
                            className="p-1 rounded-lg theme-text-secondary hover:text-red-400 hover:bg-white/10 transition-colors"
                            title="Remove item"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t theme-border-subtle">
                          {/* Stepper (– / number / +) */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartItemQty(cartItem.id, cartItem.quantity - 1)}
                              disabled={cartItem.quantity <= 1}
                              className="w-7 h-7 rounded-lg theme-bg-card hover:bg-white/10 theme-text-app font-bold text-xs flex items-center justify-center transition-all disabled:opacity-40"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <input
                              type="number"
                              min="1"
                              max={cartItem.availableStock}
                              value={cartItem.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  handleUpdateCartItemQty(cartItem.id, val);
                                }
                              }}
                              className="w-12 h-7 text-center font-black text-xs theme-input border rounded-lg theme-text-app focus:outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => handleUpdateCartItemQty(cartItem.id, cartItem.quantity + 1)}
                              disabled={cartItem.quantity >= cartItem.availableStock}
                              className="w-7 h-7 rounded-lg theme-bg-primary text-white font-bold text-xs flex items-center justify-center transition-all disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Item Subtotal */}
                          <div className="text-right">
                            <span className="text-[10px] theme-text-secondary block">Subtotal</span>
                            <span className="text-xs font-black theme-text-accent font-mono">
                              {formatPeso(cartItem.quantity * cartItem.unitPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Inline Stock Warning */}
                        {isExceeding && (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-red-400 pt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {lang === 'tl'
                                ? `Sobra sa stock! ${cartItem.availableStock} pcs lang ang meron.`
                                : `Exceeds stock! Only ${cartItem.availableStock} pcs available.`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Section */}
              <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black theme-text-app">
                    {translate(lang, 'total_price_label') || 'Total Amount'}:
                  </span>
                  <span className="text-base font-black theme-text-accent font-mono">
                    {formatPeso(totalSaleAmount)}
                  </span>
                </div>

                {isBudgetEntered && (
                  <div className="pt-2 border-t theme-border-subtle space-y-1 text-xs font-bold">
                    <div className="flex items-center justify-between theme-text-secondary">
                      <span>{lang === 'tl' ? 'Pera ng Mamimili' : "Buyer's Money"}:</span>
                      <span className="font-mono theme-text-app">{formatPeso(parsedBuyersMoney)}</span>
                    </div>

                    {budgetDifference >= 0 ? (
                      <div className="flex items-center justify-between text-xs font-black theme-text-accent">
                        <span>{lang === 'tl' ? 'Sukli (Change)' : 'Change'}:</span>
                        <span className="text-sm font-black font-mono">
                          {formatPeso(budgetDifference)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs font-black text-amber-400">
                        <span>{lang === 'tl' ? 'Kulang pa ng' : 'Need more'}:</span>
                        <span className="text-sm font-black font-mono">
                          {formatPeso(Math.abs(budgetDifference))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons: [Cancel] [Sell] */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSellModalOpen(false);
                  setCart([]);
                  setInitialSellProduct(null);
                  setIsAddProductPickerOpen(false);
                }}
                className="px-4 py-2.5 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10"
              >
                {translate(lang, 'btn_cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSellNow}
                disabled={isCartEmpty || hasExceededStock || hasInsufficientBudget}
                className={`theme-bg-primary text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 ${
                  isCartEmpty || hasExceededStock || hasInsufficientBudget
                    ? 'opacity-40 cursor-not-allowed'
                    : ''
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-white/90" />
                <span>{translate(lang, 'btn_sell') || 'Sell'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SALE RECEIPT MODAL */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 theme-text-accent" />
                <h3 className="font-black theme-text-app text-base">
                  {lang === 'tl' ? 'Resibo ng Benta' : 'Sale Receipt'}
                </h3>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="theme-text-secondary">{translate(lang, 'date') || 'Date'}:</span>
                  <span className="font-bold theme-text-app">{formatDateTime(activeReceipt.timestamp)}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider theme-text-secondary block border-b theme-border-subtle pb-1">
                  {lang === 'tl' ? 'Mga Nabiling Paninda' : 'Items Sold'}
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {activeReceipt.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="font-bold theme-text-app">{it.name}</span>
                        <span className="text-[10px] theme-text-secondary block">
                          {it.quantity} × {formatPeso(it.unitPrice)}
                        </span>
                      </div>
                      <span className="font-mono font-bold theme-text-app shrink-0">
                        {formatPeso(it.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals, Buyer Money & Change */}
              <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle space-y-1.5 font-bold">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-black theme-text-app">{translate(lang, 'total_price_label') || 'Total Amount'}:</span>
                  <span className="text-base font-black theme-text-accent font-mono">
                    {formatPeso(activeReceipt.totalAmount)}
                  </span>
                </div>

                {activeReceipt.buyersMoney !== undefined && (
                  <div className="pt-1.5 border-t theme-border-subtle space-y-1">
                    <div className="flex items-center justify-between text-xs theme-text-secondary">
                      <span>{lang === 'tl' ? 'Pera ng Mamimili' : "Buyer's Money"}:</span>
                      <span className="font-mono theme-text-app">{formatPeso(activeReceipt.buyersMoney)}</span>
                    </div>
                    {activeReceipt.change !== undefined && (
                      <div className="flex items-center justify-between text-xs font-black theme-text-accent">
                        <span>{lang === 'tl' ? 'Sukli' : 'Change'}:</span>
                        <span className="text-sm font-black font-mono">
                          {formatPeso(activeReceipt.change)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t theme-border-subtle">
              <button
                onClick={() => setActiveReceipt(null)}
                className="w-full theme-bg-primary text-white py-2.5 rounded-xl font-black text-xs shadow-2xs active:scale-95 transition-all"
              >
                {translate(lang, 'btn_cancel') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle mb-3">
              <h3 className="font-black theme-text-app text-base">
                {editingItem ? translate(lang, 'edit_product_title') : `+ ${translate(lang, 'btn_add_item')}`}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold theme-text-app mb-1">
                  {translate(lang, 'product_name')} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={translate(lang, 'product_name_placeholder')}
                  className="w-full theme-input border rounded-xl p-2.5 font-bold theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">
                  {translate(lang, 'category')}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full theme-input border rounded-xl p-2.5 font-bold theme-text-app focus:outline-none"
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold theme-text-app mb-1">
                    {translate(lang, 'stock_qty')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full theme-input border rounded-xl p-2.5 font-bold theme-text-app"
                  />
                </div>
                <div>
                  <label className="block font-bold theme-text-app mb-1">
                    {translate(lang, 'min_stock_alert')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                    className="w-full theme-input border rounded-xl p-2.5 font-bold theme-text-app"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold theme-text-app mb-1">
                    {translate(lang, 'cost_price')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full theme-input border rounded-xl p-2.5 font-bold theme-text-app"
                  />
                </div>
                <div>
                  <label className="block font-bold theme-text-app mb-1">
                    {translate(lang, 'selling_price')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full theme-input border rounded-xl p-2.5 font-black theme-text-accent"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl theme-text-secondary font-bold hover:bg-white/10"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="theme-bg-primary text-white px-5 py-2.5 rounded-xl font-extrabold shadow-2xs active:scale-95 transition-all"
                >
                  {translate(lang, 'btn_save_confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
