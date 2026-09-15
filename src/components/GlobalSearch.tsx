import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, X, Package, CreditCard, Receipt, User, Clock, Trash2, 
  ShoppingCart, Store, ChevronUp, ChevronDown, Edit2, PlusCircle, Camera
} from 'lucide-react';
import type { InventoryItem, Customer, Transaction, CatalogPayload } from '../types';
import type { GlobalSearchResultItem, SearchCategory } from '../types/search';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { translate, type LanguageCode } from '../utils/i18n';
import { formatPeso, formatDateTime } from '../utils/formatters';
import { safeStorage } from '../utils/safeStorage';

const RECENT_SEARCHES_KEY = 'tindahan_recent_searches_global';
const MAX_RECENT_SEARCHES = 3;

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  customers: Customer[];
  transactions: Transaction[];
  savedStores?: CatalogPayload[];
  appMode?: 'seller' | 'buyer';
  lang: LanguageCode;
  initialQuery?: string;
  
  onActionProduct?: (productId: number, action: 'EDIT' | 'SELL' | 'VIEW') => void;
  onActionCustomer?: (customerId: number, action: 'PAY' | 'ADD_CREDIT' | 'VIEW') => void;
  onActionReceipt?: (transactionId: number) => void;
  onSelectSavedStore?: (store: CatalogPayload) => void;
  onOpenScanner?: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  inventory,
  customers,
  transactions,
  savedStores = [],
  appMode = 'seller',
  lang,
  initialQuery = '',
  onActionProduct,
  onActionCustomer,
  onActionReceipt,
  onSelectSavedStore,
  onOpenScanner,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<SearchCategory>('ALL');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sync initial query
  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

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

  // Use the existing fuse hook
  const { flatResults: results, counts, isSearching } = useGlobalSearch({
    query,
    category,
    inventory,
    customers,
    transactions,
    savedStores,
    appMode,
    lang,
    debounceMs: 150,
  });

  // Safe storage for recent searches (max 3, FIFO eviction)
  useEffect(() => {
    try {
      const stored = safeStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
        }
      }
    } catch (e) {
      console.error('Error loading recent searches', e);
    }
  }, []);

  const recordSearchTerm = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecentSearches((prev) => {
      // Prepend newest term; if length exceeds MAX_RECENT_SEARCHES (3), the oldest item at the end is evicted (FIFO)
      const updated = [t, ...prev.filter((i) => i.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
      try {
        safeStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Error saving recent searches', err);
      }
      return updated;
    });
  };

  const removeSearchTerm = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((i) => i.toLowerCase() !== term.toLowerCase());
      try {
        safeStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Error removing recent search', err);
      }
      return updated;
    });
  };

  const clearAllRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    safeStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Close & reset
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 150);
    } else {
      setQuery('');
      setExpandedId(null);
    }
  }, [isOpen]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // Render Product Drill-Down
  const renderProductPreview = (p: Extract<GlobalSearchResultItem, { type: 'PRODUCT' }>) => {
    const { item } = p;
    // Find last 3 sales for this item
    const recentSales = transactions
      .filter(tx => tx.type === 'SALE' && tx.items?.some(it => it.itemName === item.name))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);

    return (
      <div className="pt-2 pb-3 px-3 border-t theme-border-subtle mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle">
            <span className="theme-text-secondary block mb-0.5">Stock</span>
            <span className="font-bold theme-text-app">{item.stock ?? 0} {item.unit || 'pcs'}</span>
          </div>
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle">
            <span className="theme-text-secondary block mb-0.5">Cost</span>
            <span className="font-bold theme-text-app">{formatPeso(item.costPrice || 0)}</span>
          </div>
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle">
            <span className="theme-text-secondary block mb-0.5">Low Stock Alert</span>
            <span className="font-bold theme-text-app">{item.minStockAlert || 5} {item.unit || 'pcs'}</span>
          </div>
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle">
            <span className="theme-text-secondary block mb-0.5">Category</span>
            <span className="font-bold theme-text-app truncate">{item.category || 'N/A'}</span>
          </div>
        </div>

        {recentSales.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary">Recent Sales</span>
            <div className="space-y-1">
              {recentSales.map(tx => {
                const txItem = tx.items?.find(it => it.itemName === item.name);
                return (
                  <div key={tx.id} className="flex justify-between items-center text-xs theme-bg-surface p-1.5 rounded-md">
                    <span className="theme-text-secondary">{formatDateTime(tx.timestamp)}</span>
                    <div className="flex gap-2">
                      <span className="theme-text-app font-medium">{txItem?.quantity}x</span>
                      <span className="theme-text-app font-bold">{formatPeso(txItem?.totalPrice || 0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              if (item.id) onActionProduct?.(item.id, 'EDIT');
            }}
            className="flex-1 py-2 rounded-xl theme-bg-surface border theme-border hover:theme-bg-surface-subtle font-bold text-xs theme-text-app flex items-center justify-center gap-1.5 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Product
          </button>
          <button
            onClick={() => {
              if (item.id) onActionProduct?.(item.id, 'SELL');
            }}
            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Sell Now
          </button>
        </div>
      </div>
    );
  };

  // Render Customer Preview
  const renderCustomerPreview = (p: Extract<GlobalSearchResultItem, { type: 'CUSTOMER' | 'UTANG' }>) => {
    const { customer } = p;
    const recentTx = transactions
      .filter(tx => tx.customerName === customer.name)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);

    return (
      <div className="pt-2 pb-3 px-3 border-t theme-border-subtle mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle col-span-2">
            <span className="theme-text-secondary block mb-0.5">Phone</span>
            <span className="font-bold theme-text-app">{customer.phone || 'No phone'}</span>
          </div>
        </div>

        {recentTx.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary">Recent Transactions</span>
            <div className="space-y-1">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex justify-between items-center text-xs theme-bg-surface p-1.5 rounded-md">
                  <span className="theme-text-secondary">{formatDateTime(tx.timestamp)}</span>
                  <div className="flex gap-2 items-center">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      tx.type === 'PAUTANG_RECORD' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }`}>
                      {tx.type === 'PAUTANG_RECORD' ? 'Pautang' : 'Bayad'}
                    </span>
                    <span className="theme-text-app font-bold">{formatPeso(tx.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              if (customer.id) onActionCustomer?.(customer.id, 'PAY');
            }}
            className="flex-1 py-2 rounded-xl theme-bg-surface border theme-border hover:theme-bg-surface-subtle font-bold text-xs theme-text-app flex items-center justify-center gap-1.5 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Record Payment
          </button>
          <button
            onClick={() => {
              if (customer.id) onActionCustomer?.(customer.id, 'ADD_CREDIT');
            }}
            className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Pautang
          </button>
        </div>
      </div>
    );
  };

  // Render Receipt Preview
  const renderReceiptPreview = (p: Extract<GlobalSearchResultItem, { type: 'RECEIPT' }>) => {
    const { transaction } = p;
    return (
      <div className="pt-2 pb-3 px-3 border-t theme-border-subtle mt-2 space-y-3">
        <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle text-xs space-y-1">
          <div className="flex justify-between">
            <span className="theme-text-secondary">Type</span>
            <span className="font-bold theme-text-app">{transaction.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="theme-text-secondary">Date</span>
            <span className="font-bold theme-text-app">{formatDateTime(transaction.timestamp)}</span>
          </div>
          {transaction.customerName && (
            <div className="flex justify-between">
              <span className="theme-text-secondary">Customer</span>
              <span className="font-bold theme-text-app">{transaction.customerName}</span>
            </div>
          )}
        </div>

        {transaction.items && transaction.items.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary">Items</span>
            <div className="space-y-1">
              {transaction.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs theme-bg-surface p-1.5 rounded-md">
                  <span className="theme-text-app">{it.itemName} &times; {it.quantity}</span>
                  <span className="theme-text-app font-bold">{formatPeso(it.totalPrice || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center pt-3 mt-1 border-t-2 theme-border-subtle">
          <span className="text-sm font-bold theme-text-secondary uppercase tracking-widest">Total Amount:</span>
          <span className="font-black text-2xl text-emerald-600 dark:text-emerald-400">{formatPeso(transaction.totalAmount)}</span>
        </div>
        
        <div className="pt-2 flex justify-center">
           <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
             View Only Record
           </span>
        </div>
      </div>
    );
  };

  // Render Saved Store Preview
  const renderStorePreview = (p: Extract<GlobalSearchResultItem, { type: 'SAVED_STORE' }>) => {
    const { store } = p;
    return (
      <div className="pt-2 pb-3 px-3 border-t theme-border-subtle mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle col-span-2">
            <span className="theme-text-secondary block mb-0.5">Owner</span>
            <span className="font-bold theme-text-app">{store.ownerName || 'Unknown'}</span>
          </div>
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle">
            <span className="theme-text-secondary block mb-0.5">Items</span>
            <span className="font-bold theme-text-app">{store.items?.length || 0}</span>
          </div>
          <div className="theme-bg-surface p-2 rounded-lg border theme-border-subtle">
            <span className="theme-text-secondary block mb-0.5">Contact</span>
            <span className="font-bold theme-text-app truncate">{store.contactNumber || 'N/A'}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              onSelectSavedStore?.(store);
            }}
            className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            Visit Store Catalog
          </button>
        </div>
      </div>
    );
  };

  const renderItemCard = (item: GlobalSearchResultItem) => {
    const isProduct = item.type === 'PRODUCT';
    const isCustomerOrUtang = item.type === 'CUSTOMER' || item.type === 'UTANG';
    const isReceipt = item.type === 'RECEIPT';
    const isDirectAction = isProduct || isCustomerOrUtang || isReceipt;
    const isExpanded = expandedId === item.id;
    let Icon = Package;
    if (isCustomerOrUtang) Icon = User;
    if (isReceipt) Icon = Receipt;
    if (item.type === 'SAVED_STORE') Icon = Store;

    const handleCardClick = () => {
      if (query.trim()) {
        recordSearchTerm(query);
      }

      if (isProduct) {
        const prod = (item as Extract<GlobalSearchResultItem, { type: 'PRODUCT' }>).item;
        if (prod.id) {
          onActionProduct?.(prod.id, 'VIEW');
        }
      } else if (isCustomerOrUtang) {
        const cust = (item as Extract<GlobalSearchResultItem, { type: 'CUSTOMER' | 'UTANG' }>).customer;
        if (cust.id) {
          onActionCustomer?.(cust.id, 'VIEW');
        }
      } else if (isReceipt) {
        const tx = (item as Extract<GlobalSearchResultItem, { type: 'RECEIPT' }>).transaction;
        if (tx.id) {
          onActionReceipt?.(tx.id);
        }
      } else {
        toggleExpand(item.id);
      }
    };

    return (
      <div key={item.id} className="w-full theme-bg-surface-subtle hover:theme-bg-surface border theme-border rounded-2xl overflow-hidden transition-all duration-200">
        <div 
          onClick={handleCardClick}
          className="p-3 sm:p-4 flex flex-col cursor-pointer select-none"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl theme-bg-surface border theme-border shadow-2xs flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 theme-text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-bold theme-text-app truncate">
                  {item.title}
                </div>
                <div className="text-[11px] sm:text-xs theme-text-secondary truncate mt-0.5">
                  {item.subtitle}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                {item.badgeText && (
                  <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    item.badgeVariant === 'warning' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                    item.badgeVariant === 'primary' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                    item.badgeVariant === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'theme-bg-surface border theme-border-subtle theme-text-secondary'
                  }`}>
                    {item.badgeText}
                  </span>
                )}
                {!isDirectAction && (
                  isExpanded ? <ChevronUp className="w-4 h-4 theme-text-secondary" /> : <ChevronDown className="w-4 h-4 theme-text-secondary" />
                )}
              </div>
              {item.meta && (
                <span className="text-[10px] theme-text-secondary font-medium font-mono truncate max-w-[100px]">
                  {item.meta}
                </span>
              )}
            </div>
          </div>
        </div>

        {!isDirectAction && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {item.type === 'SAVED_STORE' && renderStorePreview(item as any)}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="global-search-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[100]"
        />
      )}
      
      {isOpen && (
        <motion.div
          key="global-search-modal"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-x-0 bottom-0 z-[101] w-full max-w-3xl mx-auto flex flex-col max-h-[90vh] theme-bg-card rounded-t-3xl shadow-2xl border-t border-x theme-border"
        >
            {/* Sheet Handle */}
            <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" onClick={onClose}>
              <div className="w-12 h-1.5 rounded-full theme-bg-surface-subtle" />
            </div>

            {/* Header & Search Input */}
            <div className="px-4 pb-3 border-b theme-border-subtle shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 theme-text-secondary" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      recordSearchTerm(query);
                    }
                  }}
                  placeholder={lang === 'tl' ? 'Maghanap (Paninda, Utang...)' : 'Search (Products, Debts...)'}
                  className="w-full pl-11 pr-24 py-3.5 rounded-2xl theme-bg-surface-subtle border-2 border-transparent focus:theme-border-primary theme-text-app outline-none transition-all font-bold text-sm sm:text-base placeholder:font-medium placeholder:theme-text-secondary"
                  autoComplete="off"
                />
                
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('');
                        inputRef.current?.focus();
                      }}
                      className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 theme-text-secondary hover:theme-text-app transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {onOpenScanner && (
                    <button
                      onClick={onOpenScanner}
                      className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 theme-text-secondary hover:text-primary dark:hover:text-primary transition-colors"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-2 pt-3 pb-1 overflow-x-auto no-scrollbar mask-edges-right">
                {(['ALL', 'PRODUCTS', 'UTANG', 'RECEIPTS', 'CUSTOMERS'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex-shrink-0 border ${
                      category === cat
                        ? 'bg-primary text-white border-primary'
                        : 'theme-bg-surface theme-border theme-text-secondary hover:theme-text-app'
                    }`}
                  >
                    {cat === 'ALL' ? (lang === 'tl' ? 'Lahat' : 'All') :
                     cat === 'PRODUCTS' ? (lang === 'tl' ? 'Paninda' : 'Products') :
                     cat === 'UTANG' ? (lang === 'tl' ? 'Utang' : 'Debts') :
                     cat === 'RECEIPTS' ? (lang === 'tl' ? 'Resibo' : 'Receipts') :
                     (lang === 'tl' ? 'Suki' : 'Customers')}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
              
              {/* Empty State / Recent Searches */}
              {!query && recentSearches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider theme-text-secondary">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{lang === 'tl' ? 'Mga Nakaraang Hinanap' : 'Recent Searches'}</span>
                    </div>
                    <button
                      onClick={clearAllRecent}
                      className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{lang === 'tl' ? 'Burahin' : 'Clear'}</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {recentSearches.map((term, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setQuery(term);
                          recordSearchTerm(term);
                        }}
                        className="w-full p-3 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 theme-text-secondary group-hover:theme-text-primary" />
                          <span className="text-sm font-bold theme-text-app">{term}</span>
                        </div>
                        <button
                          onClick={(e) => removeSearchTerm(e, term)}
                          className="p-1 rounded-lg hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 text-slate-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!query && recentSearches.length === 0 && (
                <div className="py-12 text-center flex flex-col items-center justify-center opacity-60">
                  <Search className="w-10 h-10 theme-text-secondary mb-3" />
                  <p className="text-sm font-bold theme-text-app">
                    {appMode === 'seller' ? 'Search Everything Offline' : 'Search Suki Stores'}
                  </p>
                  <p className="text-xs theme-text-secondary mt-1">
                    Instant fuzzy search across your whole database.
                  </p>
                </div>
              )}

              {/* No Results Feedback */}
              {query && counts.all === 0 && !isSearching && (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl theme-bg-surface-subtle flex items-center justify-center theme-text-secondary mb-3">
                    <Search className="w-6 h-6 opacity-60" />
                  </div>
                  <p className="text-sm font-bold theme-text-app">
                    {lang === 'tl' ? 'Walang nahanap' : 'No results found'}
                  </p>
                  <p className="text-xs theme-text-secondary mt-1 max-w-xs">
                    {lang === 'tl' ? 'Suriin ang spelling o sumubok ng ibang salita.' : 'Check your spelling or try different words.'}
                  </p>
                </div>
              )}

              {/* Searching Indicator */}
              {isSearching && (
                <div className="py-6 text-center flex flex-col items-center justify-center opacity-70 transition-opacity duration-150">
                   <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                   <p className="text-xs font-medium theme-text-secondary">
                     {lang === 'tl' ? 'Naghahanap...' : 'Searching...'}
                   </p>
                </div>
              )}

              {/* Search Results rendering */}
              {query && counts.all > 0 && (
                <div className={`space-y-2.5 pb-safe transition-opacity duration-150 ${isSearching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  {results.map(item => renderItemCard(item))}
                </div>
              )}
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
};
