import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb, X, AlertTriangle, TrendingUp, Package, CheckCircle2, ArrowRight } from 'lucide-react';
import { type LanguageCode } from '../utils/i18n';
import { db } from '../db/db';
import type { InventoryItem } from '../types';
import { formatPeso } from '../utils/formatters';

interface RecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  onNavigateToInventory?: () => void;
}

export const RecommendationsModal: React.FC<RecommendationsModalProps> = ({
  isOpen,
  onClose,
  lang,
  onNavigateToInventory,
}) => {
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [lowMarginItems, setLowMarginItems] = useState<InventoryItem[]>([]);
  const [topItems, setTopItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const loadRecommendations = async () => {
      try {
        const allItems = await db.inventory.toArray();
        if (!isMounted) return;

        // 1. Low stock items
        const lowStock = allItems.filter((item) => {
          const effectiveStock =
            item.variants && item.variants.length > 0
              ? item.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
              : item.stock;
          return effectiveStock <= (item.minStockAlert || 5);
        });

        // 2. Low margin items (< 15% profit margin)
        const lowMargin = allItems.filter((item) => {
          if (!item.unitCost || item.unitCost <= 0) return false;
          const margin = ((item.unitPrice - item.unitCost) / item.unitPrice) * 100;
          return margin > 0 && margin < 15;
        });

        // 3. Top items with healthy stock
        const healthy = allItems
          .filter((item) => item.stock > (item.minStockAlert || 5))
          .slice(0, 3);

        setLowStockItems(lowStock);
        setLowMarginItems(lowMargin);
        setTopItems(healthy);
      } catch (err) {
        console.warn('[RecommendationsModal] Failed to load data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const isTl = lang === 'tl';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[100] theme-bg-card rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col border-t theme-border-subtle shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black theme-text-app">
                    {isTl ? 'Mga Rekomendasyon' : 'Recommendations'}
                  </h2>
                  <p className="text-[11px] theme-text-secondary">
                    {isTl ? 'Matalinong payo para sa iyong tindahan' : 'Smart insights for your store'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:theme-bg-surface-subtle transition-colors theme-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {isLoading ? (
                <div className="py-8 text-center text-xs theme-text-secondary">
                  {isTl ? 'Kinalakula ang mga rekomendasyon...' : 'Calculating store recommendations...'}
                </div>
              ) : (
                <>
                  {/* Section 1: Restock Needed */}
                  {lowStockItems.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <h3 className="text-xs font-black uppercase tracking-wider">
                          {isTl ? 'Kailangan nang Mag-Restock' : 'Restock Recommended'}
                        </h3>
                      </div>
                      <p className="text-xs theme-text-app">
                        {isTl
                          ? `May ${lowStockItems.length} paninda na paubos na ang stock. Mag-restock para hindi mawalan ng benta.`
                          : `${lowStockItems.length} item(s) are running low on stock. Restock soon to avoid lost sales.`}
                      </p>
                      <div className="space-y-2 pt-1">
                        {lowStockItems.slice(0, 4).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2.5 rounded-xl theme-bg-card border theme-border-subtle text-xs"
                          >
                            <span className="font-bold theme-text-app truncate max-w-[180px]">
                              {item.name}
                            </span>
                            <span className="font-extrabold text-amber-600 dark:text-amber-400">
                              {item.stock} {item.unit || 'pcs'} {isTl ? 'natitira' : 'left'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Margin Advice */}
                  {lowMarginItems.length > 0 && (
                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <TrendingUp className="w-4 h-4 shrink-0" />
                        <h3 className="text-xs font-black uppercase tracking-wider">
                          {isTl ? 'Pagpapataas ng Tubo' : 'Profit Margin Opportunity'}
                        </h3>
                      </div>
                      <p className="text-xs theme-text-app">
                        {isTl
                          ? `May ${lowMarginItems.length} paninda na mababa sa 15% ang tubo. Subukang i-adjust ang SRP.`
                          : `${lowMarginItems.length} item(s) have a profit margin under 15%. Consider adjusting retail prices.`}
                      </p>
                      <div className="space-y-2 pt-1">
                        {lowMarginItems.slice(0, 3).map((item) => {
                          const margin = (((item.unitPrice - (item.unitCost || 0)) / item.unitPrice) * 100).toFixed(0);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2.5 rounded-xl theme-bg-card border theme-border-subtle text-xs"
                            >
                              <span className="font-bold theme-text-app truncate max-w-[180px]">
                                {item.name}
                              </span>
                              <div className="text-right">
                                <span className="font-extrabold text-blue-600 dark:text-blue-400 block">
                                  {formatPeso(item.unitPrice)}
                                </span>
                                <span className="text-[10px] theme-text-secondary">
                                  {margin}% {isTl ? 'tubo' : 'margin'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 3: General Best Practices */}
                  <div className="p-4 rounded-2xl theme-bg-surface-subtle border theme-border-subtle space-y-3">
                    <div className="flex items-center gap-2 theme-text-accent">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        {isTl ? 'Payo sa Pamamahala' : 'Store Best Practice'}
                      </h3>
                    </div>
                    <ul className="text-xs theme-text-app space-y-2 list-disc list-inside">
                      <li>
                        {isTl
                          ? 'I-record agad ang bawat utang para hindi makalimutan ang singilin.'
                          : 'Record credit transactions immediately to keep track of collectibles.'}
                      </li>
                      <li>
                        {isTl
                          ? 'Magsagawa ng regular na backup gamit ang "Backup & Data" sa menu.'
                          : 'Perform regular backups using "Backup & Data" in the main menu.'}
                      </li>
                    </ul>
                  </div>

                  {lowStockItems.length === 0 && lowMarginItems.length === 0 && (
                    <div className="p-4 text-center rounded-2xl theme-bg-surface-subtle border theme-border-subtle space-y-2 py-6">
                      <Package className="w-8 h-8 mx-auto theme-text-accent opacity-80" />
                      <p className="text-xs font-bold theme-text-app">
                        {isTl ? 'Maganda ang estado ng iyong imbentaryo!' : 'Your store inventory looks great!'}
                      </p>
                      <p className="text-[11px] theme-text-secondary">
                        {isTl
                          ? 'Sapat ang stock at maayos ang mga presyo ng iyong paninda.'
                          : 'Your stock levels and pricing margins are healthy.'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer action */}
            {onNavigateToInventory && (
              <div className="p-4 border-t theme-border-subtle bg-transparent">
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToInventory();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl theme-bg-accent text-white font-bold text-xs shadow-md active:scale-98 transition-all"
                >
                  <span>{isTl ? 'Pumunta sa Imbentaryo' : 'Go to Inventory'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
