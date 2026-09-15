import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Layers, Plus, X, PackageCheck } from 'lucide-react';
import type { InventoryItem, InventoryVariant } from '../types';
import type { LanguageCode } from '../utils/i18n';
import { formatPeso } from '../utils/formatters';

interface QuickSellPadProps {
  inventory: InventoryItem[];
  lang: LanguageCode;
  onAddToCart: (item: InventoryItem, variant?: InventoryVariant) => void;
  onOpenAddVarietyItem?: () => void;
}

export const QuickSellPad: React.FC<QuickSellPadProps> = ({
  inventory,
  lang,
  onAddToCart,
  onOpenAddVarietyItem,
}) => {
  const [selectedVariantItem, setSelectedVariantItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    if (!selectedVariantItem) return;
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
  }, [selectedVariantItem]);

  // Filter items that are either marked as PACK_VARIETY or have variants / quickIcon
  const varietyItems = inventory.filter(
    (item) => item.itemType === 'PACK_VARIETY' || (item.variants && item.variants.length > 0) || item.quickIcon
  );

  const handleTileClick = (item: InventoryItem) => {
    if (item.variants && item.variants.length > 0) {
      setSelectedVariantItem(item);
    } else {
      onAddToCart(item);
    }
  };

  if (varietyItems.length === 0) {
    return (
      <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">
              {lang === 'tl' ? '⚡ Mabilisang Benta (Fast-Pad)' : '⚡ Quick Sell Fast-Pad'}
            </h4>
            <p className="text-[11px] text-slate-400">
              {lang === 'tl'
                ? 'Walang naka-set na Yelo, Asukal, o Tingi items. Magdagdag ng Pack & Variety paninda.'
                : 'No Pack & Variety items found. Add Ice, Sugar, or Tingi items for 1-tap checkout.'}
            </p>
          </div>
        </div>
        {onOpenAddVarietyItem && (
          <button
            type="button"
            onClick={onOpenAddVarietyItem}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'tl' ? '+ Dagdag' : '+ Add'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-5 bg-slate-900/90 border border-amber-500/30 rounded-3xl p-3.5 shadow-lg relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-xs font-black tracking-tight text-amber-300 uppercase">
            {lang === 'tl' ? 'Mabilisang Benta (Pack & Variety)' : 'Quick-Sell Fast-Pad'}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {varietyItems.length}
          </span>
        </div>
        {onOpenAddVarietyItem && (
          <button
            type="button"
            onClick={onOpenAddVarietyItem}
            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'tl' ? '+ Bagong Variety' : '+ New Item'}</span>
          </button>
        )}
      </div>

      {/* Grid of Quick Touch Tiles - Fluid Auto-fit for all Zoom scales */}
      <div className="fluid-grid-tiles max-h-60 md:max-h-80 lg:max-h-none overflow-y-auto pr-1 scrollbar-thin">
        {varietyItems.map((item) => {
          const icon = item.quickIcon || '⚡';
          const hasVariants = item.variants && item.variants.length > 0;

          return (
            <motion.button
              key={item.id || item.name}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleTileClick(item)}
              className={`relative flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer min-h-[82px] shadow-sm hover:shadow-md ${
                item.tileColor
                  ? item.tileColor
                  : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700/80 hover:border-amber-500/50 text-slate-100'
              }`}
            >
              {/* Variant Badge Indicator */}
              {hasVariants && (
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center gap-0.5 shadow-sm">
                  <Layers className="w-2.5 h-2.5" />
                  <span>{item.variants?.length}</span>
                </div>
              )}

              {/* Emoji Icon */}
              <span className="text-2xl mb-1 drop-shadow-sm select-none">{icon}</span>

              {/* Title */}
              <span className="text-[11px] font-black leading-tight line-clamp-1 w-full text-slate-100 px-0.5">
                {item.name}
              </span>

              {/* Price */}
              <span className="text-[11px] font-black text-amber-400 mt-0.5">
                {formatPeso(item.unitPrice)}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Variant Selection Modal Popup */}
      <AnimatePresence>
        {selectedVariantItem && (
          <div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain min-h-full bg-black/65 backdrop-blur-xs select-none animate-in fade-in duration-200"
            onClick={() => setSelectedVariantItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              className="my-auto relative w-full max-w-xs md:max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100"
              onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedVariantItem(null)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-3xl">{selectedVariantItem.quickIcon || '📦'}</span>
                <div>
                  <h3 className="text-sm font-black text-white">{selectedVariantItem.name}</h3>
                  <p className="text-[11px] font-semibold text-amber-400">
                    {lang === 'tl' ? 'Pumili ng Sukat / Sukat ng Benta' : 'Select Size / Variant'}
                  </p>
                </div>
              </div>

              {/* Base Price Option */}
              <div className="space-y-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(selectedVariantItem);
                    setSelectedVariantItem(null);
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-white">
                      {lang === 'tl' ? 'Pangunahing Sukat' : 'Base Product'} ({selectedVariantItem.unit || 'pcs'})
                    </div>
                    <div className="text-[10px] text-slate-400">Stock: {selectedVariantItem.stock}</div>
                  </div>
                  <div className="text-xs font-black text-emerald-400">
                    {formatPeso(selectedVariantItem.unitPrice)}
                  </div>
                </button>

                {/* Variant List */}
                {selectedVariantItem.variants?.map((v, idx) => (
                  <button
                    key={v.id || idx}
                    type="button"
                    onClick={() => {
                      onAddToCart(selectedVariantItem, v);
                      setSelectedVariantItem(null);
                    }}
                    className="w-full p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-black text-amber-300">{v.label}</div>
                      {typeof v.stock === 'number' && (
                        <div className="text-[10px] text-slate-400">Stock: {v.stock}</div>
                      )}
                    </div>
                    <div className="text-xs font-black text-amber-400">{formatPeso(v.unitPrice)}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
