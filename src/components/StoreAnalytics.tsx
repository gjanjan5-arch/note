import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  ShoppingBag,
  PieChart,
  Sparkles,
  X,
  Calendar,
  AlertTriangle,
  Package,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import type { Transaction, InventoryItem, Customer } from '../types';
import { formatPeso } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';

interface StoreAnalyticsProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  customers: Customer[];
  lang: LanguageCode;
}

type ModalType = 'sales' | 'profit' | 'cashin' | 'pautang' | null;
type DateFilter = 'today' | 'yesterday' | 'all';

export const StoreAnalytics: React.FC<StoreAnalyticsProps> = ({
  transactions = [],
  inventory = [],
  customers = [],
  lang,
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // --- Date helpers (LOCAL timezone, NOT UTC) ---
  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayLocalStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // --- Filter transactions by date ---
  const getFilteredTransactions = () => {
    if (dateFilter === 'today') return transactions.filter(t => t?.dateStr === todayLocalStr);
    if (dateFilter === 'yesterday') return transactions.filter(t => t?.dateStr === yesterdayLocalStr);
    return transactions;
  };

  const filteredTx = getFilteredTransactions();

  // --- Metrics calculations (using filtered transactions) ---
  const todaySales = filteredTx
    .filter((t) => t && (t.type === 'SALE' || t.type === 'PAUTANG_RECORD'))
    .reduce((sum, t) => sum + (t?.totalAmount || 0), 0);

  const todayCashReceived = filteredTx
    .filter((t) => t && (t.type === 'SALE' || t.type === 'PAUTANG_PAYMENT'))
    .reduce((sum, t) => sum + (t?.totalAmount || 0), 0);

  const totalCollectibles = (customers || []).reduce((sum, c) => sum + (c?.currentBalance || 0), 0);

  // Estimate profit for filtered transactions
  const calculateProfit = (txList: Transaction[]) => {
    let profit = 0;
    txList.forEach((tx) => {
      if (tx && tx.type === 'SALE' && tx.items) {
        tx.items.forEach((it) => {
          if (!it || !it.itemName) return;
          const inv = (inventory || []).find(
            (i) => i && i.name && i.name.toLowerCase() === it.itemName.toLowerCase()
          );
          const totalCost = inv ? inv.unitCost * (it.quantity || 1) : (it.totalPrice || 0) * 0.75;
          const itemProfit = (it.totalPrice || 0) - totalCost;
          profit += Math.max(0, itemProfit);
        });
      }
    });
    return profit;
  };

  const todayEstimatedProfit = calculateProfit(filteredTx);

  // All-time profit (for display label)
  let totalEstimatedProfit = 0;
  (transactions || []).forEach((tx) => {
    if (tx && tx.type === 'SALE' && tx.items) {
      tx.items.forEach((it) => {
        if (!it || !it.itemName) return;
        const inv = (inventory || []).find(
          (i) => i && i.name && i.name.toLowerCase() === it.itemName.toLowerCase()
        );
        const totalCost = inv ? inv.unitCost * (it.quantity || 1) : (it.totalPrice || 0) * 0.75;
        const profit = (it.totalPrice || 0) - totalCost;
        totalEstimatedProfit += Math.max(0, profit);
      });
    }
  });

  // --- Smart Restock Recommendations ---
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekAgoStr = `${oneWeekAgo.getFullYear()}-${String(oneWeekAgo.getMonth() + 1).padStart(2, '0')}-${String(oneWeekAgo.getDate()).padStart(2, '0')}`;

  const lastWeekSales: Record<string, number> = {};
  (transactions || []).forEach((tx) => {
    if (tx && tx.type === 'SALE' && tx.dateStr >= weekAgoStr && tx.items) {
      tx.items.forEach((it) => {
        if (!it?.itemName) return;
        lastWeekSales[it.itemName] = (lastWeekSales[it.itemName] || 0) + (it.quantity || 1);
      });
    }
  });

  const restockWarnings = (inventory || []).filter((item) => {
    if (!item?.name) return false;
    const soldLastWeek = lastWeekSales[item.name] || 0;
    return soldLastWeek >= 5 && item.stockQuantity <= 5;
  });

  const deadStock = (inventory || []).filter((item) => {
    if (!item?.name || item.stockQuantity <= 0) return false;
    const soldLastWeek = lastWeekSales[item.name] || 0;
    return soldLastWeek === 0;
  });

  // --- Top Products ---
  const productSalesMap: Record<string, { qty: number; revenue: number }> = {};
  (transactions || []).forEach((tx) => {
    if (tx && tx.type === 'SALE' && tx.items) {
      tx.items.forEach((it) => {
        if (!it) return;
        const name = it.itemName || 'Iba Pa';
        if (!productSalesMap[name]) productSalesMap[name] = { qty: 0, revenue: 0 };
        productSalesMap[name].qty += it.quantity || 1;
        productSalesMap[name].revenue += it.totalPrice || 0;
      });
    }
  });

  const topProducts = Object.entries(productSalesMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // --- Modal content generators ---
  const getModalTitle = () => {
    switch (activeModal) {
      case 'sales': return translate(lang, 'today_sales');
      case 'profit': return translate(lang, 'estimated_profit');
      case 'cashin': return translate(lang, 'cash_in');
      case 'pautang': return translate(lang, 'pautang_collectibles');
      default: return '';
    }
  };

  const getModalTransactions = () => {
    switch (activeModal) {
      case 'sales':
        return filteredTx.filter(t => t?.type === 'SALE' || t?.type === 'PAUTANG_RECORD');
      case 'profit':
        return filteredTx.filter(t => t?.type === 'SALE');
      case 'cashin':
        return filteredTx.filter(t => t?.type === 'SALE' || t?.type === 'PAUTANG_PAYMENT');
      default:
        return [];
    }
  };

  // --- Touch-safe card component ---
  const MetricCard = ({
    id,
    label,
    value,
    subtext,
    icon: Icon,
    iconColorClass,
    valueColorClass,
    onClick,
  }: {
    id?: string;
    label: string;
    value: string;
    subtext: string;
    icon: React.ElementType;
    iconColorClass: string;
    valueColorClass: string;
    onClick: () => void;
  }) => (
    <div
      id={id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="theme-card p-4 rounded-3xl border shadow-2xs transition-colors duration-200 cursor-pointer select-none touch-manipulation active:scale-[0.99]"
    >
      <div className="flex items-center justify-between mb-1 pointer-events-none">
        <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${iconColorClass}`} />
      </div>
      <span className={`text-xl sm:text-2xl font-black ${valueColorClass} pointer-events-none`}>
        {value}
      </span>
      <span className="text-[11px] theme-text-secondary font-medium block mt-0.5 pointer-events-none">
        {subtext}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          id="financials-benta-card"
          label={translate(lang, 'today_sales')}
          value={formatPeso(todaySales)}
          subtext={`${filteredTx.length} records ${dateFilter === 'today' ? 'today' : dateFilter === 'yesterday' ? 'yesterday' : 'total'}`}
          icon={ShoppingBag}
          iconColorClass="theme-text-accent"
          valueColorClass="theme-text-app"
          onClick={() => { setDateFilter('today'); setActiveModal('sales'); }}
        />

        <MetricCard
          id="financials-tubo-card"
          label={translate(lang, 'estimated_profit')}
          value={formatPeso(todayEstimatedProfit)}
          subtext={totalEstimatedProfit > 0
            ? `Est. Profit (${formatPeso(totalEstimatedProfit)} total)`
            : 'Est. Net Profit'}
          icon={TrendingUp}
          iconColorClass="theme-text-accent"
          valueColorClass="theme-text-accent"
          onClick={() => { setDateFilter('today'); setActiveModal('profit'); }}
        />

        <MetricCard
          label={translate(lang, 'cash_in')}
          value={formatPeso(todayCashReceived)}
          subtext="Sales + Bayad"
          icon={DollarSign}
          iconColorClass="theme-text-primary"
          valueColorClass="theme-text-app"
          onClick={() => { setDateFilter('today'); setActiveModal('cashin'); }}
        />

        <MetricCard
          label={translate(lang, 'pautang_collectibles')}
          value={formatPeso(totalCollectibles)}
          subtext="Total Suki Credit"
          icon={CreditCard}
          iconColorClass="text-amber-400"
          valueColorClass="text-amber-400"
          onClick={() => setActiveModal('pautang')}
        />
      </div>

      {/* Smart Restock Recommendations */}
      {(restockWarnings.length > 0 || deadStock.length > 0) && (
        <div className="theme-card p-4 rounded-3xl border shadow-2xs transition-colors duration-200">
          <h3 className="font-black theme-text-app text-sm mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 theme-text-accent" />
            <span>Smart Restock Recommendations</span>
          </h3>
          
          {restockWarnings.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-bold theme-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Restock Needed
              </p>
              <div className="space-y-1.5">
                {restockWarnings.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs p-2 theme-bg-surface-subtle rounded-xl border theme-border-subtle"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowDown className="w-3 h-3 text-red-500" />
                      <span className="theme-text-app font-bold">{item.name}</span>
                    </div>
                    <span className="text-red-500 font-black">{item.stockQuantity} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deadStock.length > 0 && (
            <div>
              <p className="text-[11px] font-bold theme-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowUp className="w-3 h-3 text-gray-400" />
                Dead Stock (No sales in 7 days)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {deadStock.slice(0, 5).map((item) => (
                  <span
                    key={item.id}
                    className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text-secondary font-medium"
                  >
                    {item.name} ({item.stockQuantity})
                  </span>
                ))}
                {deadStock.length > 5 && (
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text-secondary font-medium">
                    +{deadStock.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Products & Business Advice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Selling Items */}
        <div className="theme-card p-4 sm:p-5 rounded-3xl border shadow-2xs transition-colors duration-200">
          <h3 className="font-black theme-text-app text-sm mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 theme-text-accent" />
            <span>Pinakamabilis Mabenta (Top Items)</span>
          </h3>

          {topProducts.length === 0 ? (
            <p className="text-xs theme-text-secondary py-6 text-center">
              {translate(lang, 'no_records_found')}
            </p>
          ) : (
            <div className="space-y-2">
              {topProducts.map(([pName, data], idx) => (
                <div
                  key={pName}
                  role="button"
                  tabIndex={0}
                  onClick={() => { /* Could open product detail modal */ }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { /* open detail */ } }}
                  className="flex items-center justify-between text-xs font-bold p-2.5 theme-bg-surface-subtle rounded-2xl border theme-border-subtle cursor-pointer select-none touch-manipulation active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 pointer-events-none">
                    <span className="w-5 h-5 rounded-full theme-bg-primary text-white flex items-center justify-center text-[10px] font-black">
                      #{idx + 1}
                    </span>
                    <span className="theme-text-app font-extrabold">{pName}</span>
                  </div>
                  <div className="text-right pointer-events-none">
                    <span className="theme-text-app font-black">{formatPeso(data.revenue)}</span>
                    <span className="text-[10px] theme-text-secondary font-normal block">
                      {data.qty} pcs sold
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Store Insights Card */}
        <div className="theme-card p-5 rounded-3xl shadow-2xs border flex flex-col justify-between transition-colors duration-200">
          <div>
            <div className="flex items-center gap-1.5 theme-text-accent font-black text-xs uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Suki Business Tip</span>
            </div>
            <p className="text-xs sm:text-sm theme-text-app leading-relaxed font-medium">
              "Para tuloy-tuloy ang kita ng tindahan: laging itabi ang 70-80% ng daily benta para sa restock, at 20-30% para sa net profit. I-track ang pautang at regular na magpaalala sa suki tuwing weekend!"
            </p>
          </div>

          <div className="mt-4 pt-3 border-t theme-border-subtle flex items-center justify-between text-[11px] theme-text-secondary font-bold">
            <span>Tindahan Notes 🇵🇭 Offline-Ready</span>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}
        >
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b theme-border-subtle shrink-0">
              <h3 className="font-black text-sm theme-text-app">{getModalTitle()}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full theme-bg-surface-subtle flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="w-4 h-4 theme-text-secondary" />
              </button>
            </div>

            {/* Date Filter Tabs */}
            {activeModal !== 'pautang' && (
              <div className="flex gap-2 p-3 border-b theme-border-subtle shrink-0 overflow-x-auto">
                {(['today', 'yesterday', 'all'] as DateFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold capitalize whitespace-nowrap transition-colors ${
                      dateFilter === filter
                        ? 'theme-bg-primary text-white'
                        : 'theme-bg-surface-subtle theme-text-secondary'
                    }`}
                  >
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {filter}
                  </button>
                ))}
              </div>
            )}

            {/* Modal Content */}
            <div className="overflow-y-auto p-4 space-y-2">
              {activeModal === 'pautang' ? (
                // Pautang Collectibles - show customers with balance
                (customers || []).filter(c => c?.currentBalance > 0).length === 0 ? (
                  <p className="text-xs theme-text-secondary py-8 text-center">No outstanding balances</p>
                ) : (
                  (customers || [])
                    .filter(c => c?.currentBalance > 0)
                    .sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0))
                    .map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center justify-between p-3 theme-bg-surface-subtle rounded-2xl border theme-border-subtle"
                      >
                        <div>
                          <p className="text-xs font-black theme-text-app">{customer.name}</p>
                          <p className="text-[10px] theme-text-secondary">{customer.phone || 'No phone'}</p>
                        </div>
                        <span className="text-sm font-black text-amber-400">{formatPeso(customer.currentBalance || 0)}</span>
                      </div>
                    ))
                )
              ) : (
                // Sales / Profit / Cash In - show transactions
                getModalTransactions().length === 0 ? (
                  <p className="text-xs theme-text-secondary py-8 text-center">
                    {translate(lang, 'no_records_found')}
                  </p>
                ) : (
                  getModalTransactions().map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 theme-bg-surface-subtle rounded-2xl border theme-border-subtle"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black theme-text-app">
                          {tx.type === 'SALE' ? 'Sale' : tx.type === 'PAUTANG_RECORD' ? 'Credit Sale' : 'Payment'}
                        </span>
                        <span className="text-[10px] theme-text-secondary">{tx.dateStr}</span>
                      </div>
                      
                      {activeModal === 'profit' && tx.items ? (
                        // Profit breakdown per item
                        <div className="space-y-1">
                          {tx.items.map((it, idx) => {
                            const inv = (inventory || []).find(
                              (i) => i && i.name && i.name.toLowerCase() === (it?.itemName || '').toLowerCase()
                            );
                            const cost = inv ? inv.unitCost * (it?.quantity || 1) : (it?.totalPrice || 0) * 0.75;
                            const profit = (it?.totalPrice || 0) - cost;
                            return (
                              <div key={idx} className="flex items-center justify-between text-[11px]">
                                <span className="theme-text-secondary">{it?.itemName} x{it?.quantity}</span>
                                <span className={`font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {formatPeso(Math.max(0, profit))}
                                </span>
                              </div>
                            );
                          })}
                          <div className="border-t theme-border-subtle pt-1 mt-1 flex justify-between">
                            <span className="text-[10px] font-bold theme-text-secondary">Total Profit</span>
                            <span className="text-xs font-black theme-text-accent">
                              {formatPeso(tx.items.reduce((sum, it) => {
                                const inv = (inventory || []).find(
                                  (i) => i && i.name && i.name.toLowerCase() === (it?.itemName || '').toLowerCase()
                                );
                                const cost = inv ? inv.unitCost * (it?.quantity || 1) : (it?.totalPrice || 0) * 0.75;
                                return sum + Math.max(0, (it?.totalPrice || 0) - cost);
                              }, 0))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        // Standard transaction display
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] theme-text-secondary">
                            {tx.customerName || tx.note || '—'}
                          </span>
                          <span className="text-sm font-black theme-text-app">{formatPeso(tx.totalAmount || 0)}</span>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};