import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  RefreshCw,
  Filter,
  Check,
} from 'lucide-react';
import type { Transaction, TransactionType } from '../types';
import { formatPeso, formatDateTime } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';

interface TransactionLedgerProps {
  transactions: Transaction[];
  lang: LanguageCode;
  onRefresh: () => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  lang,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<TransactionType[]>([]);
  const [isSortAZ, setIsSortAZ] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'ALL'>('TODAY');

  const todayISO = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

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

      // 1. Date Filter
      if (selectedDateFilter === 'TODAY' && tx.dateStr !== todayISO) return false;
      if (selectedDateFilter === 'YESTERDAY' && tx.dateStr !== yesterdayISO) return false;

      // 2. Type Filter (Multi-select / empty = all)
      if (selectedTypes.length > 0 && !selectedTypes.includes(tx.type)) return false;

      // 3. Search Term: matches customer, note, items, type labels, amounts, dateStr, formatted date/time
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCustomer = tx.customerName?.toLowerCase().includes(q) || false;
        const matchNote = tx.rawNote?.toLowerCase().includes(q) || false;
        const matchItems = (tx.items || []).some(
          (i) =>
            (i && i.itemName && i.itemName.toLowerCase().includes(q)) ||
            (i && i.quantity != null && i.quantity.toString().includes(q)) ||
            (i && i.totalPrice != null && i.totalPrice.toString().includes(q))
        );
        const matchType =
          tx.type?.toLowerCase().includes(q) ||
          (tx.type === 'SALE' && ('sale'.includes(q) || 'benta'.includes(q))) ||
          (tx.type === 'PAUTANG_RECORD' && ('pautang'.includes(q) || 'credit'.includes(q) || 'utang'.includes(q))) ||
          (tx.type === 'PAUTANG_PAYMENT' && ('payment'.includes(q) || 'bayad'.includes(q) || 'pay'.includes(q))) ||
          (tx.type === 'RESTOCK' && ('restock'.includes(q) || 'dagdag'.includes(q)));
        const matchAmount =
          tx.totalAmount != null &&
          (tx.totalAmount.toString().includes(q) ||
            formatPeso(tx.totalAmount).toLowerCase().includes(q));
        const matchDateStr = tx.dateStr?.toLowerCase().includes(q) || false;
        const formattedDate = formatDateTime(tx.timestamp).toLowerCase();
        const matchFormattedDate = formattedDate.includes(q);

        return (
          matchCustomer ||
          matchNote ||
          matchItems ||
          Boolean(matchType) ||
          Boolean(matchAmount) ||
          matchDateStr ||
          matchFormattedDate
        );
      }

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
      {/* Search & Filter Header Controls */}
      <div className="theme-card p-3.5 sm:p-4 rounded-3xl shadow-2xs border space-y-3 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
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

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Date Range Tabs */}
            <div className="flex items-center gap-1 theme-bg-surface-subtle p-1 rounded-2xl text-xs font-extrabold border theme-border-subtle">
              <button
                onClick={() => setSelectedDateFilter('TODAY')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  selectedDateFilter === 'TODAY'
                    ? 'theme-bg-primary text-white shadow-2xs'
                    : 'theme-text-secondary hover:theme-text-app'
                }`}
              >
                {translate(lang, 'filter_today')}
              </button>
              <button
                onClick={() => setSelectedDateFilter('YESTERDAY')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  selectedDateFilter === 'YESTERDAY'
                    ? 'theme-bg-primary text-white shadow-2xs'
                    : 'theme-text-secondary hover:theme-text-app'
                }`}
              >
                {translate(lang, 'filter_yesterday')}
              </button>
              <button
                onClick={() => setSelectedDateFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  selectedDateFilter === 'ALL'
                    ? 'theme-bg-primary text-white shadow-2xs'
                    : 'theme-text-secondary hover:theme-text-app'
                }`}
              >
                {translate(lang, 'filter_all')}
              </button>
            </div>

            {/* Filter by Dropdown Anchor */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-extrabold border transition-all active:scale-95 shadow-2xs ${
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
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-60 max-w-[calc(100vw-2rem)] theme-card rounded-2xl p-2 shadow-2xl border theme-border-subtle z-50 animate-in fade-in zoom-in-95 space-y-1">
                  {/* Option 1: A → Z */}
                  <button
                    onClick={() => setIsSortAZ((prev) => !prev)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
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
                    onClick={() => toggleType('SALE')}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
                      selectedTypes.includes('SALE')
                        ? 'theme-bg-primary text-white'
                        : 'theme-text-app hover:theme-bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🛒</span>
                      <span>{translate(lang, 'type_sale')} (Benta)</span>
                    </div>
                    {selectedTypes.includes('SALE') && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Option 3: Credit */}
                  <button
                    onClick={() => toggleType('PAUTANG_RECORD')}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
                      selectedTypes.includes('PAUTANG_RECORD')
                        ? 'theme-bg-primary text-white'
                        : 'theme-text-app hover:theme-bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">💳</span>
                      <span>{translate(lang, 'type_pautang')} (Credit)</span>
                    </div>
                    {selectedTypes.includes('PAUTANG_RECORD') && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Option 4: Payment */}
                  <button
                    onClick={() => toggleType('PAUTANG_PAYMENT')}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
                      selectedTypes.includes('PAUTANG_PAYMENT')
                        ? 'theme-bg-primary text-white'
                        : 'theme-text-app hover:theme-bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">💰</span>
                      <span>{translate(lang, 'type_bayad')} (Payment)</span>
                    </div>
                    {selectedTypes.includes('PAUTANG_PAYMENT') && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Option 5: Restock */}
                  <button
                    onClick={() => toggleType('RESTOCK')}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
                      selectedTypes.includes('RESTOCK')
                        ? 'theme-bg-primary text-white'
                        : 'theme-text-app hover:theme-bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📦</span>
                      <span>{translate(lang, 'type_restock')} (Restock)</span>
                    </div>
                    {selectedTypes.includes('RESTOCK') && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Clear all if any active */}
                  {activeFiltersCount > 0 && (
                    <div className="pt-1 border-t theme-border-subtle">
                      <button
                        onClick={() => {
                          setSelectedTypes([]);
                          setIsSortAZ(false);
                        }}
                        className="w-full text-center py-1.5 text-[11px] font-bold theme-text-secondary hover:theme-text-accent"
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
          <div className="theme-card rounded-3xl p-8 text-center border border-dashed theme-border theme-text-secondary">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold theme-text-app">{translate(lang, 'no_records_found')}</p>
            <p className="text-xs theme-text-secondary mt-1">
              {translate(lang, 'quick_entry_placeholder')}
            </p>
          </div>
        ) : (
          filteredTx.map((tx) => {
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

            return (
              <div
                key={tx.id}
                className="theme-card rounded-3xl p-3.5 sm:p-4 shadow-2xs border hover:border-[var(--color-primary)] transition-all flex items-start justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-lg ${style.bg}`}
                    >
                      <Icon className="w-3 h-3" />
                      {style.label}
                    </span>

                    {tx.customerName && (
                      <span className="text-xs font-black theme-text-app theme-bg-surface-subtle px-2 py-0.5 rounded-lg border theme-border-subtle">
                        👤 {tx.customerName}
                      </span>
                    )}

                    <span className="text-[11px] font-medium theme-text-secondary ml-auto">
                      {formatDateTime(tx.timestamp)}
                    </span>
                  </div>

                  {/* Transaction items list */}
                  {tx.items && tx.items.length > 0 ? (
                    <div className="text-xs font-semibold theme-text-app space-y-0.5 pl-0.5">
                      {tx.items.map((it, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            • {it.quantity}x {it.itemName}
                          </span>
                          <span className="theme-text-secondary font-mono text-[11px]">
                            {formatPeso(it.totalPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-medium theme-text-secondary italic">"{tx.rawNote}"</p>
                  )}
                </div>

                <div className="text-right shrink-0 flex flex-col items-end justify-center self-stretch">
                  <span className="text-sm sm:text-base font-black theme-text-app">
                    {formatPeso(tx.totalAmount)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};