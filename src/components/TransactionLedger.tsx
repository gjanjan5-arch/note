import React, { useState, useRef, useEffect } from 'react';
import {
 ArrowUpRight,
 ArrowDownLeft,
 ShoppingBag,
 RefreshCw,
 Filter,
 Check,
 X,
 Receipt,
} from 'lucide-react';
import type { Transaction, TransactionType } from '../types';
import { formatPeso, formatDateTime, getLocalDateStr, formatDisplayItemName, formatDisplayNote } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';
import { FormalReceipt } from './FormalReceipt';

// Filter helper to exclude pseudo-item labels that duplicate payment/debt actions
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

// Helper for relative time (e.g. 5m ago)
const getRelativeTime = (timestamp: number) => {
 const diffMs = Date.now() - timestamp;
 const diffSecs = Math.floor(diffMs / 1000);
 const diffMins = Math.floor(diffSecs / 60);
 const diffHours = Math.floor(diffMins / 60);
 const diffDays = Math.floor(diffHours / 24);
 if (diffDays > 0) return `${diffDays}d ago`;
 if (diffHours > 0) return `${diffHours}h ago`;
 if (diffMins > 0) return `${diffMins}m ago`;
 return `${diffSecs}s ago`;
};

interface TransactionLedgerProps {
 transactions: Transaction[];
 lang: LanguageCode;
 onRefresh: () => void;
 prefillTransactionId?: number | null;
 onClearPrefillTransactionId?: () => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
 transactions,
 lang,
 prefillTransactionId,
 onClearPrefillTransactionId,
}) => {
 const [selectedTypes, setSelectedTypes] = useState<TransactionType[]>([]);
 const [isSortAZ, setIsSortAZ] = useState(false);
 const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
 const dropdownRef = useRef<HTMLDivElement>(null);
 const [selectedDateFilter, setSelectedDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'ALL'>('TODAY');
 const [viewDetailTx, setViewDetailTx] = useState<Transaction | null>(null);
 const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
 const lastSelectTimeRef = useRef<number>(0);
 const modalOpenTimeRef = useRef<number>(0);
 const backdropMouseDownTargetRef = useRef<EventTarget | null>(null);

 useEffect(() => {
  if (prefillTransactionId != null) {
   const targetId = Number(prefillTransactionId);
   const found = transactions.find((t) => Number(t.id) === targetId);
   if (found) {
    // Ensure date filter doesn't hide historical receipts on wide/mobile screens
    setSelectedDateFilter('ALL');
    modalOpenTimeRef.current = Date.now();
    setViewDetailTx(found);
   }
   if (onClearPrefillTransactionId) {
    onClearPrefillTransactionId();
   }
  }
 }, [prefillTransactionId, transactions, onClearPrefillTransactionId]);

 useEffect(() => {
  if (viewDetailTx) {
   console.log('[TransactionLedger] Detail view active for transaction:', {
    id: viewDetailTx.id,
    type: viewDetailTx.type,
    customerName: viewDetailTx.customerName,
    totalAmount: viewDetailTx.totalAmount,
    items: viewDetailTx.items,
    timestamp: viewDetailTx.timestamp,
    dateStr: viewDetailTx.dateStr,
   });
  } else {
   console.log('[TransactionLedger] Detail view closed');
  }
 }, [viewDetailTx]);

 const handleItemSelect = (tx: Transaction, eventSource: string) => {
  const now = Date.now();
  // Prevent duplicate rapid triggers within 150ms
  if (now - lastSelectTimeRef.current < 150) return;
  lastSelectTimeRef.current = now;

  console.log(`[TransactionLedger] History item selected via ${eventSource}:`, {
   id: tx.id,
   type: tx.type,
   customerName: tx.customerName,
   totalAmount: tx.totalAmount,
   itemsCount: tx.items?.length || 0,
   timestamp: tx.timestamp,
  });
  modalOpenTimeRef.current = Date.now();
  setViewDetailTx(tx);
 };

 const handleCardTouchStart = (e: React.TouchEvent) => {
  const t = e.touches[0];
  if (t) {
   touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }
 };

 const handleCardTouchEnd = (tx: Transaction, e: React.TouchEvent) => {
  if (!touchStartRef.current) return;
  const t = e.changedTouches[0];
  if (t) {
   const dx = Math.abs(t.clientX - touchStartRef.current.x);
   const dy = Math.abs(t.clientY - touchStartRef.current.y);
   const dt = Date.now() - touchStartRef.current.time;
   // If finger moved less than 15px and tap was under 500ms, trigger tap
   if (dx < 15 && dy < 15 && dt < 500) {
    handleItemSelect(tx, 'onTouchEnd');
   }
  }
  touchStartRef.current = null;
 };

 const todayStr = getLocalDateStr();
 const yesterday = new Date();
 yesterday.setDate(yesterday.getDate() - 1);
 const yesterdayStr = getLocalDateStr(yesterday);

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

 const toggleType = (type: TransactionType) => {
  setSelectedTypes((prev) =>
   prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
  );
 };

 // Filter & Sort logic
 const filteredTx = (transactions || [])
  .filter((tx) => {
   if (!tx) return false;

   // 1. Date Filter (using local device dateStr or local formatted timestamp)
   const txDate = tx.dateStr || getLocalDateStr(tx.timestamp);
   if (selectedDateFilter === 'TODAY' && txDate !== todayStr) return false;
   if (selectedDateFilter === 'YESTERDAY' && txDate !== yesterdayStr) return false;

   // 2. Type Filter (Multi-select / empty = all)
   if (selectedTypes.length > 0 && !selectedTypes.includes(tx.type)) return false;

   return true;
  })
  .sort((a, b) => {
   if (isSortAZ) {
    const nameA = (
     a.customerName ||
     (a.items && a.items[0]?.itemName) ||
     a.rawNote ||
     ''
    ).toLowerCase();
    const nameB = (
     b.customerName ||
     (b.items && b.items[0]?.itemName) ||
     b.rawNote ||
     ''
    ).toLowerCase();
    return nameA.localeCompare(nameB);
   }
   // Default: Most recent first
   return (b.timestamp || 0) - (a.timestamp || 0);
  });

 const activeFiltersCount = selectedTypes.length + (isSortAZ ? 1 : 0);

 return (
  <div id="transaction-ledger-container" className="space-y-4">
   {/* Date & Type Filter Controls */}
   <div id="transaction-filter-header" className="theme-card p-3.5 sm:p-4 rounded-3xl shadow-2xs border transition-colors duration-200">
    <div className="flex flex-wrap items-center justify-between gap-2.5">
     {/* Date Range Tabs */}
     <div className="flex items-center gap-1 theme-bg-surface-subtle p-1 rounded-2xl text-xs font-extrabold border theme-border-subtle">
      <button
       type="button"
       onClick={() => setSelectedDateFilter('TODAY')}
       className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
        selectedDateFilter === 'TODAY'
         ? 'theme-bg-primary text-white shadow-2xs'
         : 'theme-text-secondary hover:theme-text-app'
       }`}
      >
       {translate(lang, 'filter_today')}
      </button>
      <button
       type="button"
       onClick={() => setSelectedDateFilter('YESTERDAY')}
       className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
        selectedDateFilter === 'YESTERDAY'
         ? 'theme-bg-primary text-white shadow-2xs'
         : 'theme-text-secondary hover:theme-text-app'
       }`}
      >
       {translate(lang, 'filter_yesterday')}
      </button>
      <button
       type="button"
       onClick={() => setSelectedDateFilter('ALL')}
       className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
        selectedDateFilter === 'ALL'
         ? 'theme-bg-primary text-white shadow-2xs'
         : 'theme-text-secondary hover:theme-text-app'
       }`}
      >
       {translate(lang, 'filter_all')}
      </button>
     </div>

     <div className="flex items-center gap-2">
      {/* Filter by Dropdown Anchor */}
      <div className="relative" ref={dropdownRef}>
       <button
        type="button"
        onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-extrabold border transition-all active:scale-95 shadow-2xs cursor-pointer select-none touch-manipulation ${
         activeFiltersCount > 0
          ? 'theme-bg-primary text-white border-white/20'
          : 'theme-bg-surface-subtle hover:bg-white/10 theme-text-app border-theme-border-subtle'
        }`}
       >
        <Filter className="w-3.5 h-3.5" />
        <span>{translate(lang, 'filter_by') || 'Filter by'}</span>
        {activeFiltersCount > 0 && (
         <span className="w-4 h-4 rounded-full bg-white text-[var(--color-primary)] flex items-center justify-center text-[10px] font-black shrink-0">
          {activeFiltersCount}
         </span>
        )}
       </button>

       {/* Dropdown Menu */}
       {isFilterDropdownOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-60 max-w-[calc(100vw-2rem)] theme-card rounded-2xl p-2 shadow-2xl border theme-border-subtle z-50 animate-in fade-in space-y-1">
         {/* Option 1: A → Z */}
         <button
          type="button"
          onClick={() => setIsSortAZ((prev) => !prev)}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer select-none touch-manipulation ${
           isSortAZ
            ? 'theme-bg-primary text-white'
            : 'theme-text-app hover:theme-bg-surface-subtle'
          }`}
         >
          <div className="flex items-center gap-2">
           <span className="text-sm">🔤</span>
           <span>A → Z ({lang === 'tl' ? 'Alpabetiko' : 'Alphabetical'})</span>
          </div>
          {isSortAZ && <Check className="w-3.5 h-3.5" />}
         </button>

         <div className="border-t theme-border-subtle my-1" />

         {/* Option 2: Sale */}
         <button
          type="button"
          onClick={() => toggleType('SALE')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer select-none touch-manipulation ${
           selectedTypes.includes('SALE')
            ? 'theme-bg-primary text-white'
            : 'theme-text-app hover:theme-bg-surface-subtle'
          }`}
         >
          <div className="flex items-center gap-2">
           <span className="text-sm">🛒</span>
           <span>{translate(lang, 'type_sale')}</span>
          </div>
          {selectedTypes.includes('SALE') && <Check className="w-3.5 h-3.5" />}
         </button>

         {/* Option 3: Credit */}
         <button
          type="button"
          onClick={() => toggleType('PAUTANG_RECORD')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer select-none touch-manipulation ${
           selectedTypes.includes('PAUTANG_RECORD')
            ? 'theme-bg-primary text-white'
            : 'theme-text-app hover:theme-bg-surface-subtle'
          }`}
         >
          <div className="flex items-center gap-2">
           <span className="text-sm">💳</span>
           <span>{translate(lang, 'type_pautang')}</span>
          </div>
          {selectedTypes.includes('PAUTANG_RECORD') && <Check className="w-3.5 h-3.5" />}
         </button>

         {/* Option 4: Payment */}
         <button
          type="button"
          onClick={() => toggleType('PAUTANG_PAYMENT')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer select-none touch-manipulation ${
           selectedTypes.includes('PAUTANG_PAYMENT')
            ? 'theme-bg-primary text-white'
            : 'theme-text-app hover:theme-bg-surface-subtle'
          }`}
         >
          <div className="flex items-center gap-2">
           <span className="text-sm">💰</span>
           <span>{translate(lang, 'type_bayad')}</span>
          </div>
          {selectedTypes.includes('PAUTANG_PAYMENT') && <Check className="w-3.5 h-3.5" />}
         </button>

         {/* Option 5: Restock */}
         <button
          type="button"
          onClick={() => toggleType('RESTOCK')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer select-none touch-manipulation ${
           selectedTypes.includes('RESTOCK')
            ? 'theme-bg-primary text-white'
            : 'theme-text-app hover:theme-bg-surface-subtle'
          }`}
         >
          <div className="flex items-center gap-2">
           <span className="text-sm">📦</span>
           <span>{translate(lang, 'type_restock')}</span>
          </div>
          {selectedTypes.includes('RESTOCK') && <Check className="w-3.5 h-3.5" />}
         </button>

         {/* Clear all if any active */}
         {activeFiltersCount > 0 && (
          <div className="pt-1 border-t theme-border-subtle">
           <button
            type="button"
            onClick={() => {
             setSelectedTypes([]);
             setIsSortAZ(false);
            }}
            className="w-full text-center py-1.5 text-[11px] font-bold theme-text-secondary hover:theme-text-accent cursor-pointer select-none touch-manipulation"
           >
            {lang === 'tl' ? 'I-reset ang filter' : 'Clear all filters'}
           </button>
          </div>
         )}
        </div>
       )}
      </div>
     </div>
    </div>
   </div>

   {/* Transaction List Feed */}
   <div className="space-y-2.5">
    {filteredTx.length === 0 ? (
     <div id="transaction-empty-state" className="theme-card rounded-3xl p-8 text-center border border-dashed theme-border theme-text-secondary">
      <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
      <p className="text-sm font-bold theme-text-app">{translate(lang, 'no_records_found')}</p>
      <p className="text-xs theme-text-secondary mt-1">
       {translate(lang, 'quick_entry_placeholder')}
      </p>
     </div>
    ) : (
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
      {filteredTx.map((tx, index) => {
       const badgeStyles: Record<
        TransactionType,
        { bg: string; label: string; icon: any }
       > = {
        SALE: {
         bg: 'theme-bg-surface-subtle theme-text-accent border theme-border-subtle',
         label: translate(lang, 'type_sale'),
         icon: ShoppingBag,
        },
        PAUTANG_RECORD: {
         bg: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
         label: translate(lang, 'type_pautang'),
         icon: ArrowUpRight,
        },
        PAUTANG_PAYMENT: {
         bg: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
         label: translate(lang, 'type_bayad'),
         icon: ArrowDownLeft,
        },
        RESTOCK: {
         bg: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
         label: translate(lang, 'type_restock'),
         icon: RefreshCw,
        },
       };

       const style = badgeStyles[tx.type] || badgeStyles.SALE;
       const Icon = style.icon;

       // Filter out duplicate action text like "Credit Purchase", "Payment", etc.
       const validItems = (tx.items || []).filter((it) => isRealProductItem(it.itemName));
       const hasRealItems = validItems.length > 0;

       return (
        <div
         key={tx.id}
         id={index === 0 ? 'first-transaction-card' : undefined}
         role="button"
         tabIndex={0}
         aria-label={`View transaction details for ${tx.customerName || tx.type}`}
         onTouchStart={handleCardTouchStart}
         onTouchEnd={(e) => handleCardTouchEnd(tx, e)}
         onClick={(e) => {
          e.stopPropagation();
          handleItemSelect(tx, 'onClick');
         }}
         onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
           e.preventDefault();
           handleItemSelect(tx, 'onKeyDown');
          }
         }}
         className="theme-card rounded-2xl p-3.5 sm:p-4 shadow-2xs border hover:border-[var(--color-primary)] active:scale-[0.99] transition-all cursor-pointer select-none touch-manipulation hardware-accelerated focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] flex flex-col justify-between space-y-2"
        >
         {/* Row 1: Type badge + time + transaction number */}
         <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
           <span
            className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-lg ${style.bg}`}
           >
            <Icon className="w-3 h-3" />
            {style.label}
           </span>

           <span className="text-[11px] font-medium theme-text-secondary">
            • {getRelativeTime(tx.timestamp)}
           </span>

           <span className="text-[11px] font-mono font-medium theme-text-secondary">
            • #{tx.id != null ? String(tx.id).padStart(6, '0') : String(index).padStart(6, '0')}
           </span>
          </div>

          {tx.handledBy && (
           <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/30 whitespace-normal break-words">
            {tx.type === 'PAUTANG_RECORD' ? (lang === 'tl' ? 'Kinuha ni' : 'Taken by') : (lang === 'tl' ? 'Nagbayad' : 'Paid by')}: {tx.handledBy}
           </span>
          )}
         </div>

         {/* Middle Section: Customer name & items */}
         <div className="flex-1 space-y-1 my-0.5">
          {/* Row 2: Customer name (if present) */}
          {tx.customerName && (
           <div className="text-xs sm:text-sm font-black theme-text-app whitespace-normal break-words">
            {tx.customerName}
           </div>
          )}

          {/* Row 3: Actual product names + quantities (skip entirely for pure payments/no items) */}
          {hasRealItems && (
           <div className="text-xs font-medium theme-text-secondary whitespace-normal break-words space-y-0.5 pt-0.5">
            {validItems.map((it, i) => (
             <div key={i} className="leading-relaxed">
              {it.quantity}x {formatDisplayItemName(it.itemName, lang)}
              {i < validItems.length - 1 ? ',' : ''}
             </div>
            ))}
           </div>
          )}
         </div>

         {/* Last Row: Amount right-aligned */}
         <div className="flex justify-end items-baseline pt-1">
          <span className="text-base sm:text-lg font-black font-mono theme-text-app">
           {formatPeso(tx.totalAmount)}
          </span>
         </div>
        </div>
       );
      })}
     </div>
    )}
   </div>

   {/* Transaction Breakdown / Receipt Modal */}
   {viewDetailTx && (
    <FormalReceipt
     transaction={viewDetailTx}
     lang={lang}
     onClose={() => setViewDetailTx(null)}
    />
   )}
  </div>
 );
};

