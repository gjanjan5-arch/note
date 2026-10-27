import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { InventoryItem } from '../types';
import type { LanguageCode } from '../utils/i18n';
import { formatPeso } from '../utils/formatters';

interface InsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockItems: InventoryItem[];
  lang: LanguageCode;
}

export const InsightModal: React.FC<InsightModalProps> = ({ isOpen, onClose, lowStockItems, lang }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="theme-card rounded-3xl max-w-sm w-full p-5 shadow-2xl border animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-lg theme-text-app">
            {lang === 'tl' ? 'Paalala sa Paninda' : 'Inventory Insights'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg theme-text-secondary hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {lowStockItems.length > 0 ? (
            lowStockItems.map((item) => (
              <div key={item.id} className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs theme-text-app">{item.name}</h4>
                  <p className="text-[10px] theme-text-secondary">
                    {lang === 'tl' ? `Kasalukuyang stock: ${item.stock}` : `Current stock: ${item.stock}`}
                  </p>
                </div>
                <div className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-500 text-[10px] font-bold">
                  {lang === 'tl' ? 'Paubos na' : 'Low Stock'}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm theme-text-secondary text-center py-4">{lang === 'tl' ? 'Walang babala sa ngayon.' : 'No alerts at the moment.'}</p>
          )}
        </div>
      </div>
    </div>
  );
};
