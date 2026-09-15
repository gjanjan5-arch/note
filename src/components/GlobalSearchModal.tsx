import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Package,
  CreditCard,
  Receipt,
  User,
  Clock,
  Trash2,
  Layers,
  Phone,
  ShoppingCart,
  Store,
} from 'lucide-react';
import type { InventoryItem, Customer, Transaction, CatalogPayload } from '../types';
import type { SearchCategory } from '../types/search';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { translate, type LanguageCode } from '../utils/i18n';
import { formatPeso } from '../utils/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  customers: Customer[];
  transactions: Transaction[];
  savedStores?: CatalogPayload[];
  appMode?: 'seller' | 'buyer';
  lang: LanguageCode;
  onSelectProduct?: (item: InventoryItem) => void;
  onSelectCustomer?: (customer: Customer) => void;
  onSelectUtang?: (customer: Customer) => void;
  onSelectReceipt?: (transaction: Transaction) => void;
  onSelectSavedStore?: (store: CatalogPayload) => void;
  onOpenAddProduct?: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  inventory,
  customers,
  transactions,
  savedStores = [],
  appMode = 'seller',
  lang,
  onSelectProduct,
  onSelectCustomer,
  onSelectUtang,
  onSelectReceipt,
  onSelectSavedStore,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('ALL');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isTl = lang === 'tl';
  const isBuyer = appMode === 'buyer';
  const storageKey = `tindahan_recent_searches_${appMode}`;

  // Load 5-item FIFO recent search history on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategory('ALL');
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed.slice(0, 5));
          }
        }
      } catch (_) {}

      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, storageKey]);

  // FIFO push: max 5 items, when 6th is added, the oldest drops off
  const recordSearchTerm = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== clean.toLowerCase());
      const next = [clean, ...filtered].slice(0, 5); // strict 5-item limit
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const removeSearchTerm = (e: React.MouseEvent, termToRemove: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const next = prev.filter((term) => term !== termToRemove);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (_) {}
  };

  const {
    products,
    utang,
    receipts,
    customers: matchedCustomers,
    savedStores: matchedSavedStores,
    counts,
    isSearching,
  } = useGlobalSearch({
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

  // Handle keyboard navigation within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && query.trim()) {
        recordSearchTerm(query);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, query, onClose]);

  if (!isOpen) return null;

  const renderCategoryPill = (
    cat: SearchCategory,
    label: string,
    count: number,
    Icon: React.ElementType
  ) => {
    const isActive = category === cat;
    return (
      <button
        type="button"
        key={cat}
        onClick={() => setCategory(cat)}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity duration-150 flex items-center gap-1.5 shrink-0 select-none cursor-pointer border ${
          isActive
            ? 'theme-bg-primary text-white border-white/20 shadow-xs'
            : 'theme-bg-surface-subtle theme-text-secondary hover:theme-text-app border-transparent hover:border-white/10'
        }`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            isActive
              ? 'bg-white/20 text-white'
              : 'theme-bg-surface theme-text-secondary'
          }`}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-search-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 pt-10 sm:pt-14 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl theme-bg-card theme-text-app rounded-3xl shadow-2xl border theme-border overflow-hidden flex flex-col max-h-[85vh] transition-opacity duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Bar with App Mode Isolation Indicator */}
        <div className="p-3 sm:p-4 border-b theme-border flex items-center gap-2 sm:gap-3 bg-transparent">
          <div className="p-2 rounded-xl theme-bg-surface-subtle theme-text-secondary shrink-0">
            <Search className="w-5 h-5 stroke-[2.2]" />
          </div>

          <input
            ref={inputRef}
            id="global-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                recordSearchTerm(query);
              }
            }}
            placeholder={
              isBuyer
                ? (isTl ? 'Maghanap ng Suki Store o paninda...' : 'Search saved stores or catalog items...')
                : (isTl ? 'Maghanap ng paninda, pautang, resibo, o kustomer...' : 'Search products, debts, receipts, or customers...')
            }
            className="w-full bg-transparent border-none text-sm sm:text-base font-semibold theme-text-app placeholder:theme-text-secondary focus:outline-none focus:ring-0"
            autoComplete="off"
            spellCheck="false"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-xl hover:theme-bg-surface-subtle theme-text-secondary transition-opacity cursor-pointer shrink-0"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-2 rounded-xl theme-bg-surface-subtle hover:theme-bg-surface theme-text-secondary hover:theme-text-app transition-opacity cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode-Isolated Category Filter Tabs */}
        <div className="px-3 sm:px-4 py-2 border-b theme-border flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {renderCategoryPill(
            'ALL',
            isTl ? 'Lahat' : 'All',
            counts.all,
            Layers
          )}

          {/* Seller-Only Category Tabs */}
          {!isBuyer && (
            <>
              {renderCategoryPill(
                'PRODUCTS',
                isTl ? 'Mga Paninda' : 'Products',
                counts.products,
                Package
              )}
              {renderCategoryPill(
                'UTANG',
                isTl ? 'Talaan ng Utang' : 'Utang Ledgers',
                counts.utang,
                CreditCard
              )}
              {renderCategoryPill(
                'RECEIPTS',
                isTl ? 'Mga Resibo' : 'Receipts',
                counts.receipts,
                Receipt
              )}
              {renderCategoryPill(
                'CUSTOMERS',
                isTl ? 'Mga Kustomer' : 'Customers',
                counts.customers,
                User
              )}
            </>
          )}

          {/* Buyer-Only Category Tabs */}
          {isBuyer && (
            renderCategoryPill(
              'SAVED_STORES',
              isTl ? 'Suki Stores' : 'Saved Stores',
              counts.savedStores,
              Store
            )
          )}
        </div>

        {/* Search Results / Clean 5-Item FIFO Initial State */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 divide-y theme-divide">
          {/* INITIAL CLEAN STATE: 5-Item FIFO Recent Searches */}
          {!isSearching && (
            <div className="pt-1">
              {recentSearches.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider theme-text-secondary">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{isTl ? 'Mga Nakaraang Hinanap' : 'Recent Searches'}</span>
                      <span className="text-[10px] opacity-70">({recentSearches.length}/5)</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAllRecent}
                      className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{isTl ? 'Burahin' : 'Clear'}</span>
                    </button>
                  </div>

                  {/* FIFO Recent Searches List (Max 5) */}
                  <div className="space-y-1.5">
                    {recentSearches.map((term, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setQuery(term);
                          recordSearchTerm(term);
                        }}
                        className="w-full p-2.5 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border flex items-center justify-between gap-2 transition-colors cursor-pointer group select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Clock className="w-3.5 h-3.5 theme-text-secondary shrink-0 group-hover:theme-text-primary" />
                          <span className="text-xs sm:text-sm font-semibold theme-text-app truncate">
                            {term}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => removeSearchTerm(e, term)}
                          className="p-1 rounded-lg hover:theme-bg-surface-subtle text-slate-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                          title={isTl ? 'Alisin' : 'Remove'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Minimalist Empty Search State */
                <div className="py-12 text-center flex flex-col items-center justify-center select-none">
                  <div className="w-12 h-12 rounded-2xl theme-bg-surface-subtle flex items-center justify-center theme-text-secondary mb-3">
                    <Search className="w-5 h-5 opacity-60" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold theme-text-app">
                    {isBuyer
                      ? (isTl ? 'Maghanap sa Suki Stores' : 'Search Suki Stores')
                      : (isTl ? 'Mabilisang Search Engine' : 'Instant Offline Search')}
                  </p>
                  <p className="text-xs theme-text-secondary mt-1 max-w-xs">
                    {isBuyer
                      ? (isTl ? 'I-type ang pangalan ng tindahan o paninda para makita agad.' : 'Type store name or product to find it instantly.')
                      : (isTl ? 'I-type ang paninda, may-utang, o resibo para makita agad.' : 'Type product, debtor, or receipt to find it instantly.')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE SEARCH: Empty Results Feedback */}
          {counts.all === 0 && isSearching && (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl theme-bg-surface-subtle flex items-center justify-center theme-text-secondary mb-3">
                <Search className="w-6 h-6 opacity-60" />
              </div>
              <p className="text-sm font-bold theme-text-app">
                {isTl ? 'Walang nahanap na resulta' : 'No matching results found'}
              </p>
              <p className="text-xs theme-text-secondary mt-1 max-w-xs">
                {isTl
                  ? `Walang tumutugma sa "${query}".`
                  : `Nothing matched "${query}".`}
              </p>
            </div>
          )}

          {/* 1. SELLER: Products & Inventory Section */}
          {!isBuyer && (category === 'ALL' || category === 'PRODUCTS') && products.length > 0 && (
            <div className="pt-2 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider theme-text-secondary">
                  <Package className="w-3.5 h-3.5" />
                  <span>{isTl ? 'Mga Paninda' : 'Products & Inventory'}</span>
                  <span className="text-[11px] font-bold opacity-75">({products.length})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      recordSearchTerm(query || p.title);
                      onSelectProduct?.(p.item);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border flex items-center justify-between gap-2.5 transition-opacity duration-150 cursor-pointer select-none group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold theme-text-app truncate group-hover:theme-text-primary transition-colors">
                        {p.title}
                      </div>
                      <div className="text-[11px] theme-text-secondary truncate mt-0.5">
                        {p.subtitle}
                      </div>
                      {p.meta && (
                        <div className="text-[10px] theme-text-secondary opacity-80 mt-0.5 truncate font-mono">
                          {p.meta}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                          p.badgeVariant === 'warning'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'theme-bg-surface theme-text-app border theme-border'
                        }`}
                      >
                        {p.badgeText}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. SELLER: Utang / Debt Ledgers Section */}
          {!isBuyer && (category === 'ALL' || category === 'UTANG') && utang.length > 0 && (
            <div className="pt-3 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider theme-text-secondary">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{isTl ? 'Talaan ng Utang' : 'Utang Ledgers'}</span>
                  <span className="text-[11px] font-bold opacity-75">({utang.length})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {utang.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      recordSearchTerm(query || u.title);
                      onSelectUtang?.(u.customer);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border flex items-center justify-between gap-2.5 transition-opacity duration-150 cursor-pointer select-none group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold theme-text-app truncate group-hover:theme-text-primary transition-colors">
                        {u.title}
                      </div>
                      <div className="text-[11px] theme-text-secondary truncate mt-0.5 flex items-center gap-1">
                        {u.subtitle !== 'No contact' && <Phone className="w-3 h-3 shrink-0 opacity-70" />}
                        <span>{u.subtitle}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span
                        className={`text-xs font-black ${
                          u.badgeVariant === 'warning'
                            ? 'text-amber-500'
                            : 'theme-text-accent'
                        }`}
                      >
                        {u.badgeText}
                      </span>
                      {u.meta && (
                        <span className="text-[10px] theme-text-secondary mt-0.5 font-medium">
                          {u.meta}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. SELLER: Receipts / Transactions Section */}
          {!isBuyer && (category === 'ALL' || category === 'RECEIPTS') && receipts.length > 0 && (
            <div className="pt-3 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider theme-text-secondary">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{isTl ? 'Mga Resibo' : 'Receipts & Transactions'}</span>
                  <span className="text-[11px] font-bold opacity-75">({receipts.length})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {receipts.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      recordSearchTerm(query || r.title);
                      onSelectReceipt?.(r.transaction);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border flex items-center justify-between gap-2.5 transition-opacity duration-150 cursor-pointer select-none group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold theme-text-app truncate group-hover:theme-text-primary transition-colors">
                        {r.title}
                      </div>
                      <div className="text-[11px] theme-text-secondary truncate mt-0.5">
                        {r.subtitle}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg theme-bg-surface border theme-border theme-text-app">
                        {r.badgeText}
                      </span>
                      {r.meta && (
                        <span className="text-[10px] theme-text-secondary mt-0.5">
                          {r.meta}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. SELLER: Customers Section */}
          {!isBuyer && (category === 'ALL' || category === 'CUSTOMERS') && matchedCustomers.length > 0 && (
            <div className="pt-3 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider theme-text-secondary">
                  <User className="w-3.5 h-3.5" />
                  <span>{isTl ? 'Mga Kustomer' : 'Customers'}</span>
                  <span className="text-[11px] font-bold opacity-75">({matchedCustomers.length})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      recordSearchTerm(query || c.title);
                      onSelectCustomer?.(c.customer);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border flex items-center justify-between gap-2.5 transition-opacity duration-150 cursor-pointer select-none group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold theme-text-app truncate group-hover:theme-text-primary transition-colors">
                        {c.title}
                      </div>
                      <div className="text-[11px] theme-text-secondary truncate mt-0.5 flex items-center gap-1">
                        {c.subtitle !== 'No contact' && <Phone className="w-3 h-3 shrink-0 opacity-70" />}
                        <span>{c.subtitle}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-bold theme-text-secondary">
                        {c.badgeText}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. BUYER: Saved Stores Section (Only in Buyer Mode) */}
          {isBuyer && matchedSavedStores.length > 0 && (
            <div className="pt-2 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider theme-text-secondary">
                  <Store className="w-3.5 h-3.5" />
                  <span>{isTl ? 'Suki Stores' : 'Saved Stores'}</span>
                  <span className="text-[11px] font-bold opacity-75">({matchedSavedStores.length})</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedSavedStores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      recordSearchTerm(query || s.title);
                      onSelectSavedStore && onSelectSavedStore(s.store);
                      onClose();
                    }}
                    className="flex items-center gap-3 p-3 rounded-2xl border theme-border theme-bg-card hover:theme-bg-surface-subtle transition-all text-left w-full group cursor-pointer"
                  >
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold theme-text-app truncate group-hover:theme-text-primary transition-colors">
                        {s.title}
                      </div>
                      <div className="text-[11px] theme-text-secondary truncate mt-0.5 flex items-center gap-1">
                        <span>{s.subtitle}</span>
                        {s.meta && <span className="opacity-70 truncate">• {s.meta}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-bold theme-text-secondary">
                        {s.badgeText}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Quick Shortcut Tip */}
        <div className="px-3 sm:px-4 py-2.5 border-t theme-border theme-bg-surface-subtle flex items-center justify-between text-[11px] theme-text-secondary">
          <div className="flex items-center gap-2">
            <span className="font-bold">Shortcut:</span>
            <kbd className="px-1.5 py-0.5 rounded-md theme-bg-card border theme-border font-mono text-[10px] font-semibold">
              Ctrl+K
            </kbd>
            <span>/</span>
            <kbd className="px-1.5 py-0.5 rounded-md theme-bg-card border theme-border font-mono text-[10px] font-semibold">
              ⌘K
            </kbd>
          </div>

          <div className="text-[11px] font-medium">
            {isSearching ? `${counts.all} ${isTl ? 'resulta' : 'results'}` : (isBuyer ? 'Buyer Search' : 'Seller Search')}
          </div>
        </div>
      </div>
    </div>
  );
};
