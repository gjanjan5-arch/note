import React from 'react';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  ShoppingBag,
  PieChart,
  Sparkles,
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

export const StoreAnalytics: React.FC<StoreAnalyticsProps> = ({
  transactions = [],
  inventory = [],
  customers = [],
  lang,
}) => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayTx = (transactions || []).filter((t) => t && t.dateStr === todayISO);

  const todaySales = todayTx
    .filter((t) => t && (t.type === 'SALE' || t.type === 'PAUTANG_RECORD'))
    .reduce((sum, t) => sum + (t?.totalAmount || 0), 0);

  const todayCashReceived = todayTx
    .filter((t) => t && (t.type === 'SALE' || t.type === 'PAUTANG_PAYMENT'))
    .reduce((sum, t) => sum + (t?.totalAmount || 0), 0);

  const totalCollectibles = (customers || []).reduce((sum, c) => sum + (c?.currentBalance || 0), 0);

  // Estimate today's profit based on inventory costs
  let todayEstimatedProfit = 0;
  todayTx.forEach((tx) => {
    if (tx && tx.type === 'SALE' && tx.items) {
      tx.items.forEach((it) => {
        if (!it || !it.itemName) return;
        const inv = (inventory || []).find(
          (i) => i && i.name && i.name.toLowerCase() === it.itemName.toLowerCase()
        );
        const totalCost = inv ? inv.unitCost * (it.quantity || 1) : (it.totalPrice || 0) * 0.75;
        const profit = (it.totalPrice || 0) - totalCost;
        todayEstimatedProfit += Math.max(0, profit);
      });
    }
  });

  // Estimate total all-time profit
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

  // Top selling products counter
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

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div id="financials-benta-card" className="theme-card p-4 rounded-3xl border shadow-2xs transition-colors duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary">
              {translate(lang, 'today_sales')}
            </span>
            <ShoppingBag className="w-4 h-4 theme-text-accent" />
          </div>
          <span className="text-xl sm:text-2xl font-black theme-text-app">
            {formatPeso(todaySales)}
          </span>
          <span className="text-[11px] theme-text-secondary font-medium block mt-0.5">
            {todayTx.length} records today
          </span>
        </div>

        <div id="financials-tubo-card" className="theme-card p-4 rounded-3xl border shadow-2xs transition-colors duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary">
              {translate(lang, 'estimated_profit')}
            </span>
            <TrendingUp className="w-4 h-4 theme-text-accent" />
          </div>
          <span className="text-xl sm:text-2xl font-black theme-text-accent">
            {formatPeso(todayEstimatedProfit)}
          </span>
          <span className="text-[11px] theme-text-secondary font-bold block mt-0.5">
            {totalEstimatedProfit > 0
              ? `Est. Profit Today (${formatPeso(totalEstimatedProfit)} total)`
              : 'Est. Net Profit Today'}
          </span>
        </div>

        <div className="theme-card p-4 rounded-3xl border shadow-2xs transition-colors duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary">
              {translate(lang, 'cash_in')}
            </span>
            <DollarSign className="w-4 h-4 theme-text-primary" />
          </div>
          <span className="text-xl sm:text-2xl font-black theme-text-app">
            {formatPeso(todayCashReceived)}
          </span>
          <span className="text-[11px] theme-text-secondary font-medium block mt-0.5">
            Sales + Bayad
          </span>
        </div>

        <div className="theme-card p-4 rounded-3xl border shadow-2xs transition-colors duration-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary">
              {translate(lang, 'pautang_collectibles')}
            </span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-amber-400">
            {formatPeso(totalCollectibles)}
          </span>
          <span className="text-[11px] theme-text-secondary font-bold block mt-0.5">
            Total Suki Credit
          </span>
        </div>
      </div>

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
                  className="flex items-center justify-between text-xs font-bold p-2.5 theme-bg-surface-subtle rounded-2xl border theme-border-subtle"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full theme-bg-primary text-white flex items-center justify-center text-[10px] font-black">
                      #{idx + 1}
                    </span>
                    <span className="theme-text-app font-extrabold">{pName}</span>
                  </div>
                  <div className="text-right">
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
    </div>
  );
};
