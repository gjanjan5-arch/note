import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db as firestoreDb } from '../db/firebase';
import { db as localDb } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Eye,
  TrendingUp,
  Receipt,
  Package,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Clock,
  ShieldCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { LanguageCode } from '../utils/i18n';
import type { Transaction, InventoryItem } from '../types';
import { formatPeso, formatDateTime, getLocalDateStr } from '../utils/formatters';
import { FormalReceipt } from './FormalReceipt';
import { usePerformance } from '../context/PerformanceContext';

interface OwnerDashboardProps {
  lang: LanguageCode;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ lang }) => {
  const { isEco } = usePerformance();
  const [activeTab, setActiveTab] = useState<'RECEIPTS' | 'INVENTORY' | 'ANALYTICS'>('RECEIPTS');
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [remoteTransactions, setRemoteTransactions] = useState<Transaction[]>([]);

  // 1. Dexie Realtime fallback + Read-only stock monitor
  const localTransactions = useLiveQuery(() => localDb.transactions.orderBy('timestamp').reverse().limit(100).toArray()) || [];
  const localInventory = useLiveQuery(() => localDb.inventory.toArray()) || [];

  // Low stock counter
  const lowStockCount = useMemo(() => {
    return localInventory.filter((it) => it.stock <= (it.minStockAlert || 5)).length;
  }, [localInventory]);

  // 2. Real-time Firebase Firestore onSnapshot Listener
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const q = query(collection(firestoreDb, 'transactions'), orderBy('timestamp', 'desc'), limit(100));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: Transaction[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: typeof data.id === 'number' ? data.id : Number(docSnap.id) || Date.now(),
              timestamp: data.timestamp || Date.now(),
              dateStr: data.dateStr || getLocalDateStr(data.timestamp),
              type: data.type || 'SALE',
              items: data.items || [],
              totalAmount: Number(data.totalAmount) || 0,
              rawNote: data.rawNote || '',
              customerName: data.customerName || '',
              paymentMethod: 'CASH',
              paymentRefNumber: null,
              cashTendered: data.cashTendered ?? null,
              changeAmount: data.changeAmount ?? null,
              syncStatus: 'SYNCED',
            };
          });
          setRemoteTransactions(list);
          setIsLiveConnected(true);
        },
        (err) => {
          console.warn('[OwnerDashboard] Firestore listener fallback:', err);
          setIsLiveConnected(false);
        }
      );
    } catch (err) {
      console.warn('[OwnerDashboard] Init error:', err);
      setIsLiveConnected(false);
    }

    return () => unsubscribe();
  }, []);

  // Today's summary calculations
  const todayStr = getLocalDateStr();
  const activeTxList = remoteTransactions.length > 0 ? remoteTransactions : localTransactions;
  const todayTransactions = useMemo(() => {
    return activeTxList.filter((tx) => tx.dateStr === todayStr || tx.timestamp > Date.now() - 24 * 60 * 60 * 1000);
  }, [activeTxList, todayStr]);

  const totalGrossToday = useMemo(() => {
    return todayTransactions.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
  }, [todayTransactions]);

  const totalCashToday = totalGrossToday;

  // Chart data: hourly or recent transaction breakdown
  const chartData = useMemo(() => {
    const recent = [...todayTransactions].reverse().slice(-10);
    return recent.map((tx, idx) => ({
      name: `#${String(tx.id || idx + 1).slice(-4)}`,
      Sales: tx.totalAmount || 0,
    }));
  }, [todayTransactions]);

  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return localInventory;
    const q = inventorySearch.toLowerCase();
    return localInventory.filter(
      (item) => item.name.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q)
    );
  }, [localInventory, inventorySearch]);

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Executive Terminal Banner */}
      <div className="theme-bg-card rounded-3xl p-5 sm:p-6 border theme-border shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {lang === 'tl' ? 'Terminal ng May-ari / Supervisor' : 'Owner / Supervisor Terminal'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1 ${
                  isLiveConnected
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {isLiveConnected
                  ? (lang === 'tl' ? 'Live Mirror Aktibo' : 'Live Mirror Connected')
                  : (lang === 'tl' ? 'Lokal / Offline' : 'Local / Standby')}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black theme-text-app">
              {lang === 'tl' ? 'Pagmamanman sa Pasalubong Center' : 'Pasalubong Center Live Audit'}
            </h1>
            <p className="text-xs theme-text-secondary flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                {lang === 'tl'
                  ? 'Audit Mode: Tinitingnan ang aktibidad ng kahera sa counter. Walang bentahan o pag-edit.'
                  : 'Audit Mode: Real-time observation of cashier sales. No selling or modifications permitted.'}
              </span>
            </p>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t theme-border-subtle">
          {/* Gross Sales */}
          <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle">
            <div className="flex items-center justify-between text-xs theme-text-secondary font-bold">
              <span>{lang === 'tl' ? 'Kabuuang Benta Ngayon' : "Today's Gross Sales"}</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono theme-text-accent mt-1">
              {formatPeso(totalGrossToday)}
            </div>
            <div className="text-[11px] theme-text-secondary mt-0.5">
              {todayTransactions.length} {lang === 'tl' ? 'resibo naitala' : 'receipts recorded'}
            </div>
          </div>

          {/* Cash In Drawer */}
          <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle">
            <div className="flex items-center justify-between text-xs theme-text-secondary font-bold">
              <span>{lang === 'tl' ? '💵 Benta sa Cash (Drawer)' : '💵 Cash in Drawer'}</span>
              <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatPeso(totalCashToday)}
            </div>
            <div className="text-[11px] theme-text-secondary mt-0.5">
              {lang === 'tl' ? 'Dapat nasa kaha ng kahera' : 'Physical cash drawer balance'}
            </div>
          </div>

          {/* Stock Health */}
          <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle">
            <div className="flex items-center justify-between text-xs theme-text-secondary font-bold">
              <span>{lang === 'tl' ? 'Pansinin sa Paninda' : 'Stock Alerts'}</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-500' : 'theme-text-app'}`}>
              {lowStockCount} {lang === 'tl' ? 'paubos' : 'low stock'}
            </div>
            <div className="text-[11px] theme-text-secondary mt-0.5">
              {localInventory.length} {lang === 'tl' ? 'kabuuang produkto' : 'registered items'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. TAB 1: Live Cashier Receipts Stream */}
      {activeTab === 'RECEIPTS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1 theme-text-secondary font-bold">
            <span>
              {lang === 'tl'
                ? 'Mga Kamakailang Resibo mula sa Kahera (Bawat 0ms)'
                : 'Live Sales Stream (Real-Time)'}
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3 text-amber-500" />
              {todayTransactions.length} {lang === 'tl' ? 'ngayong araw' : 'sales today'}
            </span>
          </div>

          {activeTxList.length === 0 ? (
            <div className="theme-card rounded-3xl p-8 border theme-border text-center space-y-2">
              <Receipt className="w-8 h-8 text-amber-500 mx-auto opacity-60" />
              <p className="text-xs font-bold theme-text-secondary">
                {lang === 'tl'
                  ? 'Wala pang naitalang resibo. Maghintay ng benta mula sa counter.'
                  : 'No receipts recorded yet. Waiting for cashier sales.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeTxList.map((tx, idx) => {
                return (
                  <div
                    key={tx.id || idx}
                    className="theme-card rounded-2xl p-4 border theme-border hover:border-amber-500/50 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Row: Time & Method */}
                      <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold theme-text-secondary">
                          #{String(tx.id || idx + 1).slice(-6)}
                        </span>
                        <span className="text-[11px] theme-text-secondary">
                          {formatDateTime(tx.timestamp)}
                        </span>
                      </div>

                      {/* Payment Method Badge */}
                      <div className="pt-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                          <Banknote className="w-3 h-3" />
                          {lang === 'tl' ? '💵 Cash / Kaliwaan' : '💵 Cash'}
                        </span>

                        <span className="text-base sm:text-lg font-black font-mono theme-text-accent">
                          {formatPeso(tx.totalAmount)}
                        </span>
                      </div>

                      {/* Item Breakdown */}
                      <div className="pt-2 border-t theme-border-subtle mt-2 space-y-1">
                        {tx.items && tx.items.length > 0 ? (
                          tx.items.map((it, itemIdx) => (
                            <div key={itemIdx} className="text-xs flex items-center justify-between theme-text-secondary">
                              <span className="truncate pr-2">{it.quantity}x {it.itemName}</span>
                              <span className="font-mono font-medium shrink-0">{formatPeso(it.totalPrice)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs theme-text-secondary italic">
                            {tx.rawNote || (lang === 'tl' ? 'Benta sa Counter' : 'Direct Counter Sale')}
                          </div>
                        )}
                      </div>

                      {/* Cash Tendered & Change if available */}
                      {typeof tx.cashTendered === 'number' && tx.cashTendered > 0 && (
                        <div className="pt-1 text-[11px] flex items-center justify-between theme-text-secondary">
                          <span>{lang === 'tl' ? 'Tendered / Sukli' : 'Tendered / Change'}:</span>
                          <span className="font-mono font-bold">
                            {formatPeso(tx.cashTendered)} / {formatPeso(tx.changeAmount || 0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* View Official Receipt Action */}
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(tx)}
                      className="w-full mt-2 py-2 rounded-xl text-xs font-bold theme-bg-surface-subtle hover:bg-white/10 theme-text-app border theme-border-subtle flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === 'tl' ? 'Tingnan ang Resibo (Audit)' : 'Inspect Official Receipt'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: Read-Only Inventory Audit */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 theme-text-secondary" />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder={lang === 'tl' ? 'Maghanap ng pasalubong, kakanin, souvenir...' : 'Search pasalubong, handicrafts...'}
                className="w-full pl-9 pr-3 py-2 rounded-2xl theme-bg-card border theme-border text-xs theme-text-app focus:outline-none"
              />
            </div>
            <span className="text-xs theme-text-secondary font-medium">
              {filteredInventory.length} {lang === 'tl' ? 'produkto sa talaan' : 'items found'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredInventory.map((item) => {
              const isLow = item.stock <= (item.minStockAlert || 5);
              const isOut = item.stock <= 0;

              return (
                <div
                  key={item.id}
                  className="theme-card p-3.5 rounded-2xl border theme-border space-y-2 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs theme-text-app truncate">{item.name}</h4>
                      <span className="text-[10px] theme-text-secondary font-medium">{item.category || 'Pasalubong'}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        isOut
                          ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          : isLow
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      }`}
                    >
                      {isOut
                        ? (lang === 'tl' ? 'UBOS NA' : 'OUT')
                        : isLow
                        ? (lang === 'tl' ? 'PAUBOS' : 'LOW')
                        : (lang === 'tl' ? 'MAY STOCK' : 'OK')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t theme-border-subtle">
                    <div>
                      <span className="text-[10px] theme-text-secondary block">
                        {lang === 'tl' ? 'Kasalukuyang Stock' : 'Current Stock'}
                      </span>
                      <span className="font-black font-mono text-sm theme-text-app">
                        {item.stock} {item.unit || 'pcs'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] theme-text-secondary block">
                        {lang === 'tl' ? 'Presyo Bawat Isa' : 'Unit Price'}
                      </span>
                      <span className="font-black font-mono text-sm theme-text-accent">
                        {formatPeso(item.sellingPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: Sales Trend */}
      {activeTab === 'ANALYTICS' && (
        <div className="theme-card p-5 sm:p-6 rounded-3xl border theme-border space-y-4">
          <div>
            <h3 className="font-black text-sm theme-text-app">
              {lang === 'tl' ? 'Tsart ng Kamakailang Benta sa Cash Drawer' : 'Recent Sales Trend (Cash Only)'}
            </h3>
            <p className="text-xs theme-text-secondary mt-0.5">
              {lang === 'tl'
                ? 'Pagsubaybay sa dami at halaga ng bawat opisyal na transaksyon sa counter.'
                : 'Direct monitoring of individual cash transactions over time.'}
            </p>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs theme-text-secondary border border-dashed theme-border rounded-2xl">
                {lang === 'tl' ? 'Magtala ng mga benta para makita ang tsart.' : 'Record sales to view graph.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" stroke="currentColor" opacity={0.6} fontSize={10} />
                  <YAxis stroke="currentColor" opacity={0.6} fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card, #1e293b)',
                      borderColor: 'var(--color-border, #334155)',
                      borderRadius: '16px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="Sales" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={!isEco} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Official Receipt Audit Viewer Modal */}
      {selectedReceipt && (
        <FormalReceipt
          transaction={selectedReceipt}
          lang={lang}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
