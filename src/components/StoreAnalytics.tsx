import React, { useState, useRef, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  ShoppingBag,
  PieChart,
  Sparkles,
  ArrowDownLeft,
  X,
  User,
  Calendar,
  AlertTriangle,
  Package,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import type { Transaction, InventoryItem, Customer } from '../types';
import { db } from '../db/db';
import { formatPeso, formatDateTime, getLocalDateStr, formatDisplayItemName, formatDisplayNote } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';

interface StoreAnalyticsProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  customers: Customer[];
  lang: LanguageCode;
}

type ActiveModal = 'sales' | 'profit' | 'cashin' | 'pautang' | null;
type DateFilter = 'today' | 'yesterday' | 'all';

interface RestockRecommendation {
  id: string;
  productId?: number;
  productName: string;
  currentStock: number;
  qtySoldLast7Days: number;
  daysSinceLastSale?: number;
  threshold?: number;
  type: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'BEST_SELLER' | 'SLOW_MOVING' | 'STAGNANT';
  message: string;
}

export const StoreAnalytics: React.FC<StoreAnalyticsProps> = ({
  transactions = [],
  inventory = [],
  customers = [],
  lang,
}) => {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // Smart Restock Recommendations state
  const [recommendations, setRecommendations] = useState<RestockRecommendation[]>([]);
  const [dismissedRecIds, setDismissedRecIds] = useState<Set<string>>(new Set());
  const [isAllRecsDismissed, setIsAllRecsDismissed] = useState(false);

  // Touch tracking refs
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastSelectTimeRef = useRef(0);

  const handleCardTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const handleCardTouchEnd = (callback: () => void, e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    if (t) {
      const dx = Math.abs(t.clientX - touchStartRef.current.x);
      const dy = Math.abs(t.clientY - touchStartRef.current.y);
      const dt = Date.now() - touchStartRef.current.time;
      if (dx < 12 && dy < 12 && dt < 400) callback();
    }
    touchStartRef.current = null;
  };

  const handleItemSelect = (callback: () => void) => {
    const now = Date.now();
    if (now - lastSelectTimeRef.current < 300) return;
    lastSelectTimeRef.current = now;
    callback();
  };

  const todayStr = getLocalDateStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yesterday);

  // Compute Smart Restock Recommendations on component mount & when transactions/inventory change
  useEffect(() => {
    let isMounted = true;

    const generateSmartRecommendations = async () => {
      try {
        // Compute last 7 local date strings
        const last7DaysSet = new Set<string>();
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7DaysSet.add(getLocalDateStr(d));
        }

        // Query db directly to ensure fresh state
        const [allTx, allInv] = await Promise.all([
          db.transactions.toArray(),
          db.inventory.toArray(),
        ]);

        const txList = allTx.length > 0 ? allTx : transactions;
        const invList = allInv.length > 0 ? allInv : inventory;

        // 1. Check if store has at least 7 full days of transaction records
        const oldestTxTimestamp = txList.reduce((min, tx) => {
          if (!tx || !tx.timestamp) return min;
          return Math.min(min, tx.timestamp);
        }, Date.now());

        const now = Date.now();
        const storeAgeInDays = (now - oldestTxTimestamp) / (24 * 60 * 60 * 1000);
        const has7DaysStoreHistory = storeAgeInDays >= 7;

        // 2. Track most recent RESTOCK & SALE timestamps per product
        const lastRestockTimeByProduct: Record<string, number> = {};
        const lastSaleTimeByProduct: Record<string, number> = {};

        for (const tx of txList) {
          if (!tx || !tx.timestamp) continue;
          if (tx.type === 'RESTOCK' && tx.items && Array.isArray(tx.items)) {
            for (const it of tx.items) {
              if (it && it.itemName) {
                const k = it.itemName.trim().toLowerCase();
                lastRestockTimeByProduct[k] = Math.max(lastRestockTimeByProduct[k] || 0, tx.timestamp || 0);
              }
            }
          } else if ((tx.type === 'SALE' || tx.type === 'PAUTANG_RECORD') && tx.items && Array.isArray(tx.items)) {
            for (const it of tx.items) {
              if (it && it.itemName) {
                const k = it.itemName.trim().toLowerCase();
                lastSaleTimeByProduct[k] = Math.max(lastSaleTimeByProduct[k] || 0, tx.timestamp || 0);
              }
            }
          }
        }

        // Filter transactions for last 7 days where type === 'SALE'
        const last7DaysSales = txList.filter((tx) => {
          if (tx.type !== 'SALE' && tx.type !== 'PAUTANG_RECORD') return false;
          const txDate = tx.dateStr || getLocalDateStr(tx.timestamp);
          return last7DaysSet.has(txDate);
        });

        // Aggregate total quantity sold per product (normalized by lowercase name)
        const salesByProductMap: Record<string, number> = {};
        for (const tx of last7DaysSales) {
          if (tx.items && Array.isArray(tx.items)) {
            for (const item of tx.items) {
              if (item && item.itemName && item.quantity > 0) {
                const key = item.itemName.trim().toLowerCase();
                salesByProductMap[key] = (salesByProductMap[key] || 0) + item.quantity;
              }
            }
          }
        }

        const recsList: RestockRecommendation[] = [];

        for (const item of invList) {
          if (!item || !item.name) continue;
          const key = item.name.trim().toLowerCase();
          const qtySold = salesByProductMap[key] || 0;
          const stock = typeof item.stock === 'number' ? item.stock : 0;
          // Set custom threshold from item or fallback to 5
          const threshold = typeof item.minStockAlert === 'number' && item.minStockAlert > 0
            ? item.minStockAlert
            : (typeof item.minStock === 'number' && item.minStock > 0 ? item.minStock : 5);

          const lastSaleTime = lastSaleTimeByProduct[key] || 0;
          const lastRestockTime = lastRestockTimeByProduct[key] || 0;
          const isRecentlyRestocked24h = lastRestockTime > 0 && (now - lastRestockTime) < 24 * 60 * 60 * 1000;

          // Compute real-time days since last sale
          let daysSinceLastSale: number | undefined;
          if (lastSaleTime > 0) {
            daysSinceLastSale = Math.floor((now - lastSaleTime) / (24 * 60 * 60 * 1000));
          } else if (has7DaysStoreHistory) {
            // Never sold since store tracking started
            daysSinceLastSale = Math.max(8, Math.floor(storeAgeInDays));
          }

          // 1. CRITICAL OUT OF STOCK (Stock = 0)
          if (stock <= 0) {
            recsList.push({
              id: `out-of-stock-${item.id || item.name}`,
              productId: item.id,
              productName: item.name,
              currentStock: 0,
              qtySoldLast7Days: qtySold,
              threshold,
              type: 'OUT_OF_STOCK',
              message:
                lang === 'tl'
                  ? `🚨 Ubos na ang stock ng ${item.name}! Agad mag-restock para hindi mawalan ng benta sa suki.`
                  : `🚨 ${item.name} is completely out of stock! Restock immediately to avoid missing customer sales.`,
            });
          }
          // 2. LOW STOCK WARNING (Stock <= user-set item threshold)
          else if (stock <= threshold && !isRecentlyRestocked24h) {
            recsList.push({
              id: `low-stock-${item.id || item.name}`,
              productId: item.id,
              productName: item.name,
              currentStock: stock,
              qtySoldLast7Days: qtySold,
              threshold,
              type: 'LOW_STOCK',
              message:
                lang === 'tl'
                  ? `⚠️ Paubos na si ${item.name} (${stock} natira). Naabot na ang itinakdang threshold (${threshold} pcs). Maghanda ng order bago tuluyang maubos.`
                  : `⚠️ ${item.name} is running low (${stock} left), hitting your set threshold (${threshold} pcs). Prepare a restock order soon.`,
            });
          }

          // 3. BEST SELLER HIGHLIGHT (High unit sales in past 7 days)
          if (qtySold >= 6 && stock > 0) {
            recsList.push({
              id: `bestseller-${item.id || item.name}`,
              productId: item.id,
              productName: item.name,
              currentStock: stock,
              qtySoldLast7Days: qtySold,
              threshold,
              type: 'BEST_SELLER',
              message:
                lang === 'tl'
                  ? `⭐ Mabilis mabenta ang ${item.name} (${qtySold} pcs naibenta sa 7 araw)! Panatilihing may sapat na stock para tuloy-tuloy ang kita.`
                  : `⭐ ${item.name} is a top seller (${qtySold} pcs sold in 7 days)! Keep plenty in stock to maintain strong daily sales.`,
            });
          }

          // 4. REAL-TIME VELOCITY: SLOW-MOVING (> 3 days up to 7 days without sales)
          if (stock > 0 && daysSinceLastSale !== undefined && daysSinceLastSale > 3 && daysSinceLastSale <= 7) {
            recsList.push({
              id: `slow-${item.id || item.name}`,
              productId: item.id,
              productName: item.name,
              currentStock: stock,
              qtySoldLast7Days: qtySold,
              daysSinceLastSale,
              threshold,
              type: 'SLOW_MOVING',
              message:
                lang === 'tl'
                  ? `🐢 ${daysSinceLastSale} araw nang walang benta ang ${item.name}. Bantayan o ilipat sa mas kita na pwesto bago mag-order ulit.`
                  : `🐢 ${item.name} has had no sales for ${daysSinceLastSale} days. Consider highlighting it or moving to eye-level before re-ordering.`,
            });
          }

          // 5. REAL-TIME VELOCITY: STAGNANT PRODUCTS (> 7 days without sales)
          if (stock > 0 && daysSinceLastSale !== undefined && daysSinceLastSale > 7) {
            recsList.push({
              id: `stagnant-${item.id || item.name}`,
              productId: item.id,
              productName: item.name,
              currentStock: stock,
              qtySoldLast7Days: qtySold,
              daysSinceLastSale,
              threshold,
              type: 'STAGNANT',
              message:
                lang === 'tl'
                  ? `🧊 Nakatenggang produkto: ${daysSinceLastSale} araw nang walang benta ang ${item.name} (${stock} pcs nakatambak). Bawasan ang order o mag-combo promo para mailabas ang puhunan.`
                  : `🧊 Stagnant item: ${item.name} has not sold in ${daysSinceLastSale} days (${stock} pcs on shelf). Reduce next order or bundle with top sellers to recover capital.`,
            });
          }
        }

        // Priority Sort: OUT_OF_STOCK first, LOW_STOCK second, BEST_SELLER third, SLOW_MOVING fourth, STAGNANT fifth
        const priorityOrder: Record<RestockRecommendation['type'], number> = {
          OUT_OF_STOCK: 1,
          LOW_STOCK: 2,
          BEST_SELLER: 3,
          SLOW_MOVING: 4,
          STAGNANT: 5,
        };

        recsList.sort((a, b) => {
          const pDiff = (priorityOrder[a.type] || 99) - (priorityOrder[b.type] || 99);
          if (pDiff !== 0) return pDiff;
          if (a.type === 'BEST_SELLER' && b.type === 'BEST_SELLER') {
            return b.qtySoldLast7Days - a.qtySoldLast7Days;
          }
          if ((a.type === 'SLOW_MOVING' || a.type === 'STAGNANT') && (b.type === 'SLOW_MOVING' || b.type === 'STAGNANT')) {
            return (b.daysSinceLastSale || 0) - (a.daysSinceLastSale || 0);
          }
          return a.currentStock - b.currentStock;
        });

        if (isMounted) {
          setRecommendations(recsList);
        }
      } catch (err) {
        console.warn('Error generating smart restock recommendations:', err);
      }
    };

    generateSmartRecommendations().catch((err) => {
      console.warn('Unhandled rejection in generateSmartRecommendations:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [transactions, inventory, lang]);

  const dismissSingleRec = (id: string) => {
    setDismissedRecIds((prev) => new Set([...prev, id]));
  };

  const dismissAllRecs = () => {
    setIsAllRecsDismissed(true);
  };

  const visibleRecommendations = isAllRecsDismissed
    ? []
    : recommendations.filter((r) => !dismissedRecIds.has(r.id));

  const outOfStockRecs = visibleRecommendations.filter((r) => r.type === 'OUT_OF_STOCK');
  const lowStockRecs = visibleRecommendations.filter((r) => r.type === 'LOW_STOCK');
  const bestSellerRecs = visibleRecommendations.filter((r) => r.type === 'BEST_SELLER');
  const slowMovingRecs = visibleRecommendations.filter((r) => r.type === 'SLOW_MOVING');
  const stagnantRecs = visibleRecommendations.filter((r) => r.type === 'STAGNANT');

  const todayTx = (transactions || []).filter((t) => {
    if (!t) return false;
    const tDate = t.dateStr || getLocalDateStr(t.timestamp);
    return tDate === todayStr;
  });

  const todaySales = todayTx
    .filter((t) => t && (t.type === 'SALE' || t.type === 'PAUTANG_RECORD'))
    .reduce((sum, t) => sum + (t?.totalAmount || 0), 0);

  const todayCashReceived = todayTx
    .filter((t) => t && (t.type === 'SALE' || t.type === 'PAUTANG_PAYMENT'))
    .reduce((sum, t) => sum + (t?.totalAmount || 0), 0);

  const totalCollectibles = (customers || []).reduce((sum, c) => sum + (c?.currentBalance || 0), 0);

  // Helper for item cost and profit calculation
  const getItemCostAndProfit = (it: { itemName?: string; quantity?: number; totalPrice?: number }) => {
    if (!it || !it.itemName) return { unitCost: 0, totalCost: 0, profit: 0 };
    const inv = (inventory || []).find(
      (i) => i && i.name && i.name.toLowerCase() === it.itemName.toLowerCase()
    );
    const totalCost = inv ? inv.unitCost * (it.quantity || 1) : (it.totalPrice || 0) * 0.75;
    const profit = (it.totalPrice || 0) - totalCost;
    return {
      unitCost: inv ? inv.unitCost : ((it.totalPrice || 0) * 0.75) / (it.quantity || 1),
      totalCost,
      profit: Math.max(0, profit),
    };
  };

  const getTxProfit = (tx: Transaction) => {
    if (!tx || tx.type !== 'SALE' || !tx.items) return 0;
    return tx.items.reduce((sum, it) => sum + getItemCostAndProfit(it).profit, 0);
  };

  // Estimate today's profit based on inventory costs
  let todayEstimatedProfit = 0;
  todayTx.forEach((tx) => {
    if (tx && tx.type === 'SALE' && tx.items) {
      tx.items.forEach((it) => {
        if (!it || !it.itemName) return;
        const { profit } = getItemCostAndProfit(it);
        todayEstimatedProfit += profit;
      });
    }
  });

  // Estimate total all-time profit
  let totalEstimatedProfit = 0;
  (transactions || []).forEach((tx) => {
    if (tx && tx.type === 'SALE' && tx.items) {
      tx.items.forEach((it) => {
        if (!it || !it.itemName) return;
        const { profit } = getItemCostAndProfit(it);
        totalEstimatedProfit += profit;
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
    .sort((a, b) => b[1].qty - a[1].qty || b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Helper date filter for transactions
  const filterByDate = (txList: Transaction[]) => {
    return txList.filter((tx) => {
      if (!tx) return false;
      const txDate = tx.dateStr || getLocalDateStr(tx.timestamp);
      if (dateFilter === 'today') return txDate === todayStr;
      if (dateFilter === 'yesterday') return txDate === yesterdayStr;
      return true;
    });
  };

  // 1. Sales Transactions Modal List
  const salesTxList = filterByDate(
    (transactions || []).filter((tx) => tx && (tx.type === 'SALE' || tx.type === 'PAUTANG_RECORD'))
  ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const salesTotal = salesTxList.reduce((sum, tx) => sum + (tx?.totalAmount || 0), 0);

  // 2. Profit Transactions Modal List
  const profitTxList = filterByDate(
    (transactions || []).filter((tx) => tx && tx.type === 'SALE')
  ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const profitTotal = profitTxList.reduce((sum, tx) => sum + getTxProfit(tx), 0);

  // 3. Cash In Transactions Modal List (SALE + PAUTANG_PAYMENT)
  const cashInTxList = filterByDate(
    (transactions || []).filter((tx) => tx && (tx.type === 'SALE' || tx.type === 'PAUTANG_PAYMENT'))
  ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const cashInTotal = cashInTxList.reduce((sum, tx) => sum + (tx?.totalAmount || 0), 0);

  // 4. Customers with Collectibles (currentBalance > 0)
  const activeDebtors = (customers || [])
    .filter((c) => c && (c.currentBalance || 0) > 0)
    .sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));

  const openModal = (type: ActiveModal) => {
    setDateFilter('today');
    setActiveModal(type);
  };

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* 1. Today's Sales Card */}
        <div
          id="financials-benta-card"
          onClick={() => openModal('sales')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('sales');
            }
          }}
          className="theme-card p-4 rounded-3xl border shadow-2xs cursor-pointer select-none touch-manipulation active:scale-[0.98] transition-all hover:border-[var(--color-primary)] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary group-hover:theme-text-primary transition-colors">
              {translate(lang, 'stat_today_sales')}
            </span>
            <div className="w-7 h-7 rounded-xl theme-bg-surface-subtle group-hover:theme-bg-primary/20 flex items-center justify-center transition-colors">
              <TrendingUp className="w-4 h-4 theme-text-primary" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black theme-text-app tracking-tight">
            {formatPeso(todaySales)}
          </div>
          <span className="text-[10px] font-bold theme-text-secondary mt-1 flex items-center gap-1">
            {translate(lang, 'filter_today')} &bull; Tap for details &rarr;
          </span>
        </div>

        {/* 2. Estimated Profit Card */}
        <div
          id="financials-tubo-card"
          onClick={() => openModal('profit')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('profit');
            }
          }}
          className="theme-card p-4 rounded-3xl border shadow-2xs cursor-pointer select-none touch-manipulation active:scale-[0.98] transition-all hover:border-[var(--color-primary)] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary group-hover:theme-text-primary transition-colors">
              {translate(lang, 'stat_est_profit')}
            </span>
            <div className="w-7 h-7 rounded-xl theme-bg-surface-subtle group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
              <PieChart className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatPeso(todayEstimatedProfit)}
          </div>
          <span className="text-[10px] font-bold theme-text-secondary mt-1 flex items-center gap-1">
            {translate(lang, 'filter_today')} &bull; Tap for breakdown &rarr;
          </span>
        </div>

        {/* 3. Cash In Card */}
        <div
          id="financials-cash-in-card"
          onClick={() => openModal('cashin')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('cashin');
            }
          }}
          className="theme-card p-4 rounded-3xl border shadow-2xs cursor-pointer select-none touch-manipulation active:scale-[0.98] transition-all hover:border-[var(--color-primary)] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary group-hover:theme-text-primary transition-colors">
              {translate(lang, 'stat_cash_in')}
            </span>
            <div className="w-7 h-7 rounded-xl theme-bg-surface-subtle group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
              <DollarSign className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
            {formatPeso(todayCashReceived)}
          </div>
          <span className="text-[10px] font-bold theme-text-secondary mt-1 flex items-center gap-1">
            {translate(lang, 'filter_today')} &bull; {lang === 'tl' ? 'Benta + Bayad' : 'Sales + Payments'} &rarr;
          </span>
        </div>

        {/* 4. Pautang Collectibles Card */}
        <div
          id="financials-pautang-card"
          onClick={() => openModal('pautang')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('pautang');
            }
          }}
          className="theme-card p-4 rounded-3xl border shadow-2xs cursor-pointer select-none touch-manipulation active:scale-[0.98] transition-all hover:border-[var(--color-primary)] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-secondary group-hover:text-amber-400 transition-colors">
              {translate(lang, 'stat_collectibles')}
            </span>
            <div className="w-7 h-7 rounded-xl theme-bg-surface-subtle group-hover:bg-amber-500/20 flex items-center justify-center transition-colors">
              <CreditCard className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {formatPeso(totalCollectibles)}
          </div>
          <span className="text-[10px] font-bold theme-text-secondary mt-1 flex items-center gap-1">
            {activeDebtors.length} {lang === 'tl' ? 'suki may utang' : 'customers'} &rarr;
          </span>
        </div>
      </div>

      {/* SMART RESTOCK & VELOCITY RECOMMENDATIONS CARD */}
      {visibleRecommendations.length > 0 && (
        <div className="theme-card p-4 sm:p-5 rounded-3xl border shadow-2xs space-y-3.5 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black theme-text-app">
                  {lang === 'tl' ? 'Smart Recommendations' : 'Smart Recommendations'}
                </h3>
                <p className="text-[11px] theme-text-secondary">
                  {lang === 'tl' ? 'Real-time bilis ng benta, threshold at stock alerts' : 'Real-time sales velocity, thresholds & stock alerts'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissAllRecs}
              className="text-xs font-bold theme-text-secondary hover:theme-text-app px-2.5 py-1 rounded-xl theme-bg-surface-subtle transition-colors cursor-pointer select-none active:scale-95"
            >
              {lang === 'tl' ? 'Itago Lahat' : 'Hide All'}
            </button>
          </div>

          {/* 1. CRITICAL OUT OF STOCK (Stock = 0) */}
          {outOfStockRecs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5 " />
                <span>{lang === 'tl' ? '🚨 Ubos na ang Stock (Critical Out of Stock)' : '🚨 Critical Out of Stock (0 pcs)'}</span>
              </div>
              <div className="space-y-2">
                {outOfStockRecs.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start justify-between gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-800 dark:text-rose-200 transition-all"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 font-black flex-wrap">
                        <span className="text-sm font-extrabold">{rec.productName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-mono font-black">
                          0 {lang === 'tl' ? 'stock' : 'left'}
                        </span>
                        {rec.threshold && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-[10px] font-mono">
                            {lang === 'tl' ? 'Threshold' : 'Threshold'}: {rec.threshold} pcs
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-95">{rec.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissSingleRec(rec.id)}
                      className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                      title={lang === 'tl' ? 'Itago' : 'Dismiss'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. LOW STOCK WARNING (Stock <= user-set threshold) */}
          {lowStockRecs.length > 0 && (
            <div className="space-y-2 pt-1 border-t theme-border-subtle">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{lang === 'tl' ? '⚠️ Paubos na Stocks (Nasa Threshold)' : '⚠️ Low Stock (At/Below Threshold)'}</span>
              </div>
              <div className="space-y-2">
                {lowStockRecs.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start justify-between gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200 transition-all"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 font-black flex-wrap">
                        <span className="font-extrabold">{rec.productName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/25 text-[10px] font-mono font-bold">
                          {rec.currentStock} {lang === 'tl' ? 'natira' : 'left'}
                        </span>
                        {rec.threshold && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-[10px] font-mono">
                            {lang === 'tl' ? 'Set Threshold' : 'Threshold'}: {rec.threshold} pcs
                          </span>
                        )}
                        {rec.qtySoldLast7Days > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-[10px] font-mono">
                            {rec.qtySoldLast7Days} {lang === 'tl' ? 'nabenta (7d)' : 'sold (7d)'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-95">{rec.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissSingleRec(rec.id)}
                      className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                      title={lang === 'tl' ? 'Itago' : 'Dismiss'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. BEST SELLERS (Fast moving by unit quantity sold) */}
          {bestSellerRecs.length > 0 && (
            <div className="space-y-2 pt-1 border-t theme-border-subtle">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{lang === 'tl' ? '⭐ Mabentang Produkto (Dami ng Benta)' : '⭐ Top Fast-Moving Sellers (Units Sold)'}</span>
              </div>
              <div className="space-y-2">
                {bestSellerRecs.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start justify-between gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-800 dark:text-emerald-200 transition-all"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 font-black flex-wrap">
                        <span className="font-extrabold">{rec.productName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono font-bold">
                          {rec.qtySoldLast7Days} pcs {lang === 'tl' ? 'nabenta' : 'sold'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[10px] font-mono">
                          {rec.currentStock} {lang === 'tl' ? 'stock natira' : 'in stock'}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-95">{rec.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissSingleRec(rec.id)}
                      className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                      title={lang === 'tl' ? 'Itago' : 'Dismiss'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. SLOW-MOVING PRODUCTS (> 3 days without sales) */}
          {slowMovingRecs.length > 0 && (
            <div className="space-y-2 pt-1 border-t theme-border-subtle">
              <div className="flex items-center gap-1.5 text-xs font-black text-sky-600 dark:text-sky-400">
                <Package className="w-3.5 h-3.5" />
                <span>{lang === 'tl' ? '🐢 Matamlay na Benta (> 3 araw walang benta)' : '🐢 Slow-Moving Products (> 3 days idle)'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {slowMovingRecs.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-800 dark:text-sky-200"
                  >
                    <span className="font-bold">{rec.productName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 font-mono">
                      {rec.daysSinceLastSale} {lang === 'tl' ? 'araw walang benta' : 'days idle'}
                    </span>
                    <span className="text-[10px] opacity-80 font-mono">({rec.currentStock} pcs)</span>
                    <button
                      type="button"
                      onClick={() => dismissSingleRec(rec.id)}
                      className="hover:opacity-100 p-0.5 rounded-md transition-colors cursor-pointer"
                      title={lang === 'tl' ? 'Itago' : 'Dismiss'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. STAGNANT PRODUCTS (> 7 days without sales) */}
          {stagnantRecs.length > 0 && (
            <div className="space-y-2 pt-1 border-t theme-border-subtle">
              <div className="flex items-center gap-1.5 text-xs font-black text-purple-600 dark:text-purple-400">
                <Package className="w-3.5 h-3.5" />
                <span>{lang === 'tl' ? '🧊 Nakatenggang Produkto (> 7 araw walang benta)' : '🧊 Stagnant Products (> 7 days idle)'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stagnantRecs.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-xs text-purple-800 dark:text-purple-200"
                  >
                    <span className="font-bold">{rec.productName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 font-mono font-bold">
                      {rec.daysSinceLastSale} {lang === 'tl' ? 'araw tengga' : 'days stagnant'}
                    </span>
                    <span className="text-[10px] opacity-80 font-mono">({rec.currentStock} pcs)</span>
                    <button
                      type="button"
                      onClick={() => dismissSingleRec(rec.id)}
                      className="hover:opacity-100 p-0.5 rounded-md transition-colors cursor-pointer"
                      title={lang === 'tl' ? 'Itago' : 'Dismiss'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Products Card (Ranked by Units/Pieces Sold) */}
      <div className="theme-card p-4 sm:p-5 rounded-3xl border shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl theme-bg-surface-subtle flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 theme-text-primary" />
            </div>
            <h3 className="text-sm font-black theme-text-app">
              {translate(lang, 'top_selling')}
            </h3>
          </div>
          <span className="text-[11px] font-bold theme-text-primary">
            {lang === 'tl' ? 'Batay sa Dami (Pieces Sold)' : 'By Units Sold (Pieces)'}
          </span>
        </div>

        {topProducts.length === 0 ? (
          <div className="py-6 text-center text-xs theme-text-secondary">
            {translate(lang, 'no_sales_data')}
          </div>
        ) : (
          <div className="space-y-2.5">
            {topProducts.map(([name, data], idx) => {
              const maxQty = topProducts[0][1].qty || 1;
              const pct = Math.min(100, Math.max(10, Math.round((data.qty / maxQty) * 100)));
              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-center font-mono text-[10px] theme-text-secondary">
                        #{idx + 1}
                      </span>
                      <span className="theme-text-app font-bold">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="theme-text-primary font-black font-mono text-xs px-2 py-0.5 rounded-lg theme-bg-surface-subtle border theme-border-subtle">
                        {data.qty} pcs
                      </span>
                      <span className="theme-text-secondary font-mono text-[11px]">
                        ({formatPeso(data.revenue)})
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full theme-bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Today's Sales Modal */}
      {activeModal === 'sales' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <div
            className="theme-card rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col p-4 sm:p-6 shadow-2xl border animate-in  space-y-4"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
            
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl theme-bg-primary/20 flex items-center justify-center text-[var(--color-primary)]">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black theme-text-app">
                    {translate(lang, 'stat_today_sales')} {lang === 'tl' ? '(Mga Benta)' : '(Sales)'}
                  </h3>
                  <p className="text-xs theme-text-secondary">
                    {lang === 'tl' ? 'Lahat ng benta (Cash at Pautang)' : 'All sales transactions (Cash & Credit)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label={translate(lang, 'btn_close') || 'Close'}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer active:scale-95 transition-all touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date Filters & Filter Total Summary */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 theme-bg-surface-subtle p-1 rounded-2xl text-xs font-extrabold border theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'today'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_today')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'yesterday'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_yesterday')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'all'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_all')}
                </button>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold theme-text-secondary uppercase block">
                  {lang === 'tl' ? 'Kabuuan' : 'Total'}
                </span>
                <span className="text-base font-black theme-text-app">{formatPeso(salesTotal)}</span>
              </div>
            </div>

            {/* Scrollable Transaction List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
              {salesTxList.length === 0 ? (
                <div className="py-12 text-center text-xs theme-text-secondary space-y-2">
                  <ShoppingBag className="w-8 h-8 mx-auto opacity-30" />
                  <p>{lang === 'tl' ? 'Walang naitalang benta sa panahong ito.' : 'No sales records found for this period.'}</p>
                </div>
              ) : (
                salesTxList.map((tx) => (
                  <div key={tx.id} className="pt-2 pb-1 space-y-1.5 first:pt-0">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            tx.type === 'SALE'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {tx.type === 'SALE' ? 'CASH SALE' : (lang === 'tl' ? 'PAUTANG' : 'CREDIT')}
                        </span>
                        {tx.customerName && (
                          <span className="font-bold theme-text-app flex items-center gap-1">
                            <User className="w-3 h-3 theme-text-secondary" />
                            {tx.customerName}
                          </span>
                        )}
                        {tx.handledBy && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                            {tx.type === 'PAUTANG_RECORD' ? (lang === 'tl' ? 'Kinuha ni' : 'Taken by') : (lang === 'tl' ? 'Nagbayad' : 'Paid by')}: {tx.handledBy}
                          </span>
                        )}
                        <span className="text-[10px] theme-text-secondary font-mono">
                          {formatDateTime(tx.timestamp)}
                        </span>
                      </div>
                      <span className="font-black text-sm theme-text-app font-mono">
                        {formatPeso(tx.totalAmount)}
                      </span>
                    </div>

                    {/* Breakdown of items */}
                    {tx.items && tx.items.length > 0 && (
                      <div className="bg-black/5 dark:bg-white/5 p-2 rounded-xl text-[11px] space-y-1">
                        {tx.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center theme-text-secondary">
                            <span>
                              {it.quantity}x {formatDisplayItemName(it.itemName, lang)}
                            </span>
                            <span className="font-mono font-medium">{formatPeso(it.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Estimated Profit Modal with Breakdown */}
      {activeModal === 'profit' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <div
            className="theme-card rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col p-4 sm:p-6 shadow-2xl border animate-in  space-y-4"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
            
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black theme-text-app">
                    {translate(lang, 'stat_est_profit')} {lang === 'tl' ? '(Tubo Breakdown)' : '(Profit Breakdown)'}
                  </h3>
                  <p className="text-xs theme-text-secondary">
                    {lang === 'tl'
                      ? 'Kita matapos ibawas ang puhunan sa bawat item'
                      : 'Net profit after item inventory costs'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label={translate(lang, 'btn_close') || 'Close'}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer active:scale-95 transition-all touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date Filters & Filter Total Summary */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 theme-bg-surface-subtle p-1 rounded-2xl text-xs font-extrabold border theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'today'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_today')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'yesterday'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_yesterday')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'all'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_all')}
                </button>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold theme-text-secondary uppercase block">
                  {lang === 'tl' ? 'Kabuuang Tubo' : 'Total Profit'}
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {formatPeso(profitTotal)}
                </span>
              </div>
            </div>

            {/* Scrollable Profit Breakdown List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {profitTxList.length === 0 ? (
                <div className="py-12 text-center text-xs theme-text-secondary space-y-2">
                  <PieChart className="w-8 h-8 mx-auto opacity-30" />
                  <p>{lang === 'tl' ? 'Walang naitalang kita sa panahong ito.' : 'No profit records for this period.'}</p>
                </div>
              ) : (
                profitTxList.map((tx) => {
                  const txProfit = getTxProfit(tx);
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border theme-border-subtle space-y-2"
                    >
                      <div className="flex justify-between items-center text-xs border-b border-black/5 dark:border-white/5 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono theme-text-secondary">
                            {formatDateTime(tx.timestamp)}
                          </span>
                          {tx.customerName && (
                            <span className="font-bold theme-text-app flex items-center gap-1 text-[11px]">
                              <User className="w-3 h-3 theme-text-secondary" />
                              {tx.customerName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[11px] theme-text-secondary">
                            Benta: {formatPeso(tx.totalAmount)}
                          </span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                            Tubo: +{formatPeso(txProfit)}
                          </span>
                        </div>
                      </div>

                      {/* Items with Puhunan vs Benta */}
                      {tx.items && tx.items.length > 0 && (
                        <div className="space-y-1 text-[11px]">
                          {tx.items.map((it, idx) => {
                            const { unitCost, totalCost, profit } = getItemCostAndProfit(it);
                            return (
                              <div
                                key={idx}
                                className="flex justify-between items-center theme-text-secondary font-mono text-[10px] sm:text-[11px]"
                              >
                                <div className="theme-text-app font-sans font-bold flex-1 truncate pr-2">
                                  {it.quantity}x {it.itemName}
                                </div>
                                <div className="flex items-center gap-3 text-right">
                                  <span>
                                    Puhunan: {formatPeso(totalCost)}{' '}
                                    <span className="opacity-60 text-[9px]">
                                      (@{formatPeso(unitCost)})
                                    </span>
                                  </span>
                                  <span>Benta: {formatPeso(it.totalPrice)}</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    +{formatPeso(profit)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Cash In History Modal */}
      {activeModal === 'cashin' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <div
            className="theme-card rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col p-4 sm:p-6 shadow-2xl border animate-in  space-y-4"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
            
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black theme-text-app">
                    {translate(lang, 'stat_cash_in')} {lang === 'tl' ? '(Pumasok na Pera)' : '(Cash Received)'}
                  </h3>
                  <p className="text-xs theme-text-secondary">
                    {lang === 'tl'
                      ? 'Lahat ng aktwal na hawak na cash (Cash Benta + Bayad Utang)'
                      : 'Actual cash received in drawer (Cash Sales + Debt Payments)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label={translate(lang, 'btn_close') || 'Close'}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer active:scale-95 transition-all touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date Filters & Filter Total Summary */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 theme-bg-surface-subtle p-1 rounded-2xl text-xs font-extrabold border theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'today'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_today')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'yesterday'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_yesterday')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    dateFilter === 'all'
                      ? 'theme-bg-primary text-white shadow-2xs'
                      : 'theme-text-secondary hover:theme-text-app'
                  }`}
                >
                  {translate(lang, 'filter_all')}
                </button>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold theme-text-secondary uppercase block">
                  {lang === 'tl' ? 'Kabuuang Cash In' : 'Total Cash Received'}
                </span>
                <span className="text-base font-black text-blue-600 dark:text-blue-400">
                  {formatPeso(cashInTotal)}
                </span>
              </div>
            </div>

            {/* Scrollable Cash In Transactions List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
              {cashInTxList.length === 0 ? (
                <div className="py-12 text-center text-xs theme-text-secondary space-y-2">
                  <DollarSign className="w-8 h-8 mx-auto opacity-30" />
                  <p>{lang === 'tl' ? 'Walang naitalang cash in sa panahong ito.' : 'No cash received records for this period.'}</p>
                </div>
              ) : (
                cashInTxList.map((tx) => (
                  <div key={tx.id} className="pt-2 pb-1 space-y-1.5 first:pt-0">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            tx.type === 'SALE'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <ArrowDownLeft className="w-3 h-3" />
                          {tx.type === 'SALE' ? 'CASH SALE' : (lang === 'tl' ? 'BAYAD UTANG' : 'DEBT PAYMENT')}
                        </span>
                        {tx.customerName && (
                          <span className="font-bold theme-text-app flex items-center gap-1">
                            <User className="w-3 h-3 theme-text-secondary" />
                            {tx.customerName}
                          </span>
                        )}
                        {tx.handledBy && (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded border border-blue-500/30">
                            {tx.type === 'PAUTANG_RECORD' ? (lang === 'tl' ? 'Kinuha ni' : 'Taken by') : (lang === 'tl' ? 'Nagbayad' : 'Paid by')}: {tx.handledBy}
                          </span>
                        )}
                        <span className="text-[10px] theme-text-secondary font-mono">
                          {formatDateTime(tx.timestamp)}
                        </span>
                      </div>
                      <span className="font-black text-sm text-blue-600 dark:text-blue-400 font-mono">
                        +{formatPeso(tx.totalAmount)}
                      </span>
                    </div>

                    {tx.notes && (
                      <p className="text-[11px] theme-text-secondary italic pl-1">
                        Note: {tx.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Pautang Collectibles Modal */}
      {activeModal === 'pautang' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <div
            className="theme-card rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col p-4 sm:p-6 shadow-2xl border animate-in  space-y-4"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
            
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black theme-text-app">
                    {translate(lang, 'stat_collectibles')} {lang === 'tl' ? '(Pautang Collectibles)' : '(Collectibles)'}
                  </h3>
                  <p className="text-xs theme-text-secondary">
                    {lang === 'tl' ? 'Listahan ng mga suki na may utang' : 'Active customers with outstanding balances'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label={translate(lang, 'btn_close') || 'Close'}
                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer active:scale-95 transition-all touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total Collectibles Summary Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {activeDebtors.length} {lang === 'tl' ? 'Suki na may Utang' : 'Active Debtors'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                  {formatPeso(totalCollectibles)}
                </span>
              </div>
            </div>

            {/* Scrollable Customer List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
              {activeDebtors.length === 0 ? (
                <div className="py-12 text-center text-xs theme-text-secondary space-y-2">
                  <CreditCard className="w-8 h-8 mx-auto opacity-30" />
                  <p>{lang === 'tl' ? 'Walang may utang sa kasalukuyan!' : 'No active debts found!'}</p>
                </div>
              ) : (
                activeDebtors.map((cust) => (
                  <div key={cust.id} className="pt-2.5 pb-1 flex items-center justify-between text-xs first:pt-0">
                    <div className="space-y-0.5">
                      <div className="font-black theme-text-app flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 theme-text-secondary" />
                        <span>{cust.name}</span>
                        {cust.nickname && (
                          <span className="text-[10px] theme-text-secondary font-normal">
                            ({cust.nickname})
                          </span>
                        )}
                      </div>
                      {cust.phone && (
                        <span className="text-[10px] theme-text-secondary font-mono block pl-5">
                          {cust.phone}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="font-black text-sm text-amber-600 dark:text-amber-400 font-mono block">
                        {formatPeso(cust.currentBalance)}
                      </span>
                      {cust.creditLimit && cust.creditLimit > 0 && (
                        <span className="text-[9px] theme-text-secondary font-mono">
                          Limit: {formatPeso(cust.creditLimit)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
