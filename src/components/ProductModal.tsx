import React, { useState } from 'react';
import { X, Package, Zap, Barcode, Layers, Camera, Image, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { InventoryItem, InventoryVariant, ProductItemType } from '../types';
import { translate, LanguageCode } from '../utils/i18n';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: InventoryItem | null;
  lang: LanguageCode;
  name: string;
  setName: (v: string) => void;
  sku: string;
  setSku: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  stock: string;
  setStock: (v: string) => void;
  unitCost: string;
  setUnitCost: (v: string) => void;
  unitPrice: string;
  setUnitPrice: (v: string) => void;
  minStockAlert: string;
  setMinStockAlert: (v: string) => void;
  unit: string;
  setUnit: (v: string) => void;
  quickIcon: string;
  setQuickIcon: (v: string) => void;
  variants: InventoryVariant[];
  setVariants: React.Dispatch<React.SetStateAction<InventoryVariant[]>>;
  productType: ProductItemType;
  setProductType: (v: ProductItemType) => void;
  photo: string;
  setPhoto: (v: string) => void;
  newVariantLabel: string;
  setNewVariantLabel: (v: string) => void;
  newVariantPrice: string;
  setNewVariantPrice: (v: string) => void;
  newVariantStock: string;
  setNewVariantStock: (v: string) => void;
  isCompressingPhoto: boolean;
  handlePhotoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveProduct: (e: React.FormEvent) => void;
  handleAddVariantItem: () => void;
  handleRemoveVariantItem: (idx: number) => void;
  calculateWeightVariants: (price: number, cost: number) => any[];
  showAlert: (msg: string, title?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  TINGI_PRESETS: any[];
  ITEM_ICON_OPTIONS: any[];
  PRODUCT_CATEGORIES: string[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  lang,
  name,
  setName,
  sku,
  setSku,
  category,
  setCategory,
  stock,
  setStock,
  unitCost,
  setUnitCost,
  unitPrice,
  setUnitPrice,
  minStockAlert,
  setMinStockAlert,
  unit,
  setUnit,
  quickIcon,
  setQuickIcon,
  variants,
  setVariants,
  productType,
  setProductType,
  photo,
  setPhoto,
  newVariantLabel,
  setNewVariantLabel,
  newVariantPrice,
  setNewVariantPrice,
  newVariantStock,
  setNewVariantStock,
  isCompressingPhoto,
  handlePhotoFileChange,
  handleSaveProduct,
  handleAddVariantItem,
  handleRemoveVariantItem,
  calculateWeightVariants,
  showAlert,
  TINGI_PRESETS,
  ITEM_ICON_OPTIONS,
  PRODUCT_CATEGORIES,
}) => {


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="theme-card rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col p-4 sm:p-6 shadow-2xl border animate-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{ touchAction: 'manipulation' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b theme-border-subtle shrink-0">
          <h3 className="font-black theme-text-app text-base">
            {editingItem ? translate(lang, 'edit_product_title') : `+ ${translate(lang, 'btn_add_item')}`}
          </h3>
          <button
            type="button"
            role="button"
            tabIndex={0}
            style={{ touchAction: 'manipulation' }}
            onClick={onClose}
            className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer select-none touch-manipulation active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Container */}
        <form
          onSubmit={handleSaveProduct}
          className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3.5 custom-modal-scrollbar pt-3 pb-8 text-xs sm:text-sm"
        >


          {/* Product Name */}
          <div>
            <label className="block font-bold theme-text-app mb-1">
              {translate(lang, 'product_name')} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={translate(lang, 'product_name_placeholder') || 'e.g. Pancit Canton, Sardinas'}
              className="w-full min-w-0 theme-input border rounded-xl p-3 font-bold theme-text-app focus:outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="min-w-0">
              <label className="block font-bold theme-text-app mb-1">{translate(lang, 'category')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full min-w-0 theme-input border rounded-xl p-3 font-bold theme-text-app focus:outline-none text-xs sm:text-sm">
                {PRODUCT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label className="block font-bold theme-text-app mb-1">Quick Icon</label>
              <select
                value={quickIcon}
                onChange={(e) => {
                  const selectedIcon = e.target.value;
                  setQuickIcon(selectedIcon);
                  const matched = ITEM_ICON_OPTIONS.find((opt) => opt.icon === selectedIcon);
                  if (matched) setCategory(matched.category);
                }}
                className="w-full min-w-0 theme-input border rounded-xl p-3 font-bold theme-text-app focus:outline-none text-xs sm:text-sm"
              >
                {ITEM_ICON_OPTIONS.map((opt) => <option key={opt.icon} value={opt.icon}>{opt.icon} {opt.label}</option>)}
              </select>
            </div>
          </div>
          
          <div>
             <label className="block font-bold theme-text-app mb-1">SKU / Barcode</label>
             <div className="flex gap-2">
                <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Scan or Type SKU"
                    className="flex-1 theme-input border rounded-xl p-3 font-bold theme-text-app focus:outline-none text-sm"
                />
                <button type="button" className="theme-bg-surface-subtle p-3 rounded-xl border">
                    <Barcode className="w-5 h-5 theme-text-accent" />
                </button>
             </div>
          </div>
          
          {/* Product Format Selector */}
          <div>
            <label className="block font-bold theme-text-app mb-1">Select Type</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductItemType)}
              className="w-full theme-input border rounded-xl p-3 font-bold theme-text-app focus:outline-none text-sm"
            >
              <option value="STANDARD">Standard Item (Single Price & Stock)</option>
              <option value="PACK_VARIETY">Pack & Variety (Multiple Sizes / Packs)</option>
            </select>
          </div>
          
          {/* Dynamic Fields */}
          {productType === 'STANDARD' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold theme-text-app mb-1">{translate(lang, 'selling_price')} (₱) *</label>
                    <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full theme-input border rounded-xl p-3 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="block font-bold theme-text-app mb-1">{translate(lang, 'stock_qty')} *</label>
                    <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full theme-input border rounded-xl p-3 font-bold text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold theme-text-app mb-1">{translate(lang, 'cost_price')} (₱)</label>
                    <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full theme-input border rounded-xl p-3 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="block font-bold theme-text-app mb-1">{translate(lang, 'min_stock_alert')}</label>
                    <input type="number" value={minStockAlert} onChange={(e) => setMinStockAlert(e.target.value)} className="w-full theme-input border rounded-xl p-3 font-bold text-sm" />
                  </div>
                </div>
              </div>
          ) : null}
          
          <div>
            <label className="block font-bold theme-text-app mb-1">Selling Unit</label>
            <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full theme-input border rounded-xl p-3 font-bold theme-text-app focus:outline-none text-sm"
            >
                <option value="Piece">Piece (Pcs)</option>
                <option value="Pack">Pack</option>
                <option value="Kg">Kg</option>
                <option value="Grams">Grams</option>
                <option value="Bottle">Bottle</option>
            </select>
          </div>


          
          {productType === 'PACK_VARIETY' && (
              <div className="pt-2.5 border-t theme-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold theme-text-app flex items-center gap-1.5 text-xs sm:text-sm">
                <Layers className="w-3.5 h-3.5 theme-text-accent" />
                <span>{translate(lang, 'variants_label') || 'Weight / Pack Variants'}</span>
              </span>
              <span className="text-[10px] theme-text-secondary font-bold">
                {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
              </span>
            </div>

            {(unit === 'Kilo') && (
              <button
                type="button"
                onClick={() => {
                  const priceNum = parseFloat(unitPrice) || 0;
                  const costNum = parseFloat(unitCost) || 0;
                  if (priceNum > 0) {
                    const calculated = calculateWeightVariants(priceNum, costNum);
                    setVariants(calculated.map((v) => ({ ...v })));
                  } else {
                    showAlert('Please enter a 1kg Selling Price first to auto-calculate weight portions.', 'Price Required', 'warning');
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>⚡ Auto-calc ¼kg, ½kg, 1kg Weight Portions</span>
              </button>
            )}

            {variants.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-modal-scrollbar">
                {variants.map((v, vIdx) => (
                  <div
                    key={vIdx}
                    className="flex items-center gap-1.5 p-2 rounded-xl theme-bg-surface-subtle border theme-border-subtle text-xs"
                  >
                    <input
                      type="text"
                      value={v.label}
                      onChange={(e) => {
                        const updated = [...variants];
                        updated[vIdx].label = e.target.value;
                        setVariants(updated);
                      }}
                      className="flex-1 min-w-[80px] bg-transparent border-none outline-none font-bold theme-text-app"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-bold text-amber-500">₱</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={v.unitPrice}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[vIdx].unitPrice = parseFloat(e.target.value) || 0;
                          setVariants(updated);
                        }}
                        className="w-14 bg-transparent border-none outline-none font-black theme-text-accent text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariantItem(vIdx)}
                      className="w-6 h-6 rounded-md text-rose-400 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer active:scale-90 shrink-0"
                      title="Remove variant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <input
                type="text"
                placeholder={lang === 'tl' ? 'Sukat (hal. ½kg, 1kg, 3-Pack)' : 'Variant (e.g. ½kg, 1kg)'}
                value={newVariantLabel}
                onChange={(e) => setNewVariantLabel(e.target.value)}
                className="flex-1 min-w-[110px] theme-input border rounded-xl p-2.5 text-xs font-bold theme-text-app"
              />
              <div className="relative w-24 shrink-0">
                <span className="absolute left-2.5 top-2.5 font-bold text-xs theme-text-secondary">₱</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Presyo"
                  value={newVariantPrice}
                  onChange={(e) => setNewVariantPrice(e.target.value)}
                  className="w-full min-w-0 theme-input border rounded-xl py-2.5 pl-6 pr-2 text-xs font-black theme-text-app"
                />
              </div>
              <button
                type="button"
                onClick={handleAddVariantItem}
                className="p-2.5 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-accent border theme-border-subtle font-black text-xs cursor-pointer active:scale-95 shrink-0"
                title="Add variant"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          )}

          {/* PRODUCT PHOTO SECTION */}
          <div className="pt-2.5 border-t theme-border-subtle space-y-2">
            <label className="block font-bold theme-text-app text-xs sm:text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 theme-text-accent" />
                <span>{lang === 'tl' ? 'Larawan ng Paninda' : 'Product Photo'}</span>
              </span>
              <span className="text-[10px] theme-text-secondary font-bold">
                {isCompressingPhoto ? 'Compressing...' : 'Optional'}
              </span>
            </label>

            {photo ? (
              <div className="flex items-center gap-3 p-2 rounded-2xl theme-bg-surface-subtle border theme-border-subtle">
                <div className="relative shrink-0">
                  <img
                    src={photo}
                    alt="Product Preview"
                    className="w-14 h-14 rounded-xl object-cover border theme-border-subtle shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-black cursor-pointer shadow-md active:scale-90"
                  >
                    ×
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold theme-text-app block truncate">Photo Attached</span>
                  <span className="text-[10px] text-emerald-500 font-mono font-bold block">✓ Optimized ~600px WebP</span>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-dashed theme-border-subtle text-xs font-black theme-text-app cursor-pointer active:scale-95 transition-all text-center ${
                isCompressingPhoto ? 'opacity-50 pointer-events-none' : 'theme-bg-surface-subtle hover:border-amber-500'
              }`}>
                {isCompressingPhoto ? <Loader2 className="w-4 h-4 animate-spin theme-text-accent shrink-0" /> : <Camera className="w-4 h-4 theme-text-accent shrink-0" />}
                <span className="truncate">Camera</span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoFileChange} disabled={isCompressingPhoto} className="hidden" />
              </label>

              <label className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-dashed theme-border-subtle text-xs font-black theme-text-app cursor-pointer active:scale-95 transition-all text-center ${
                isCompressingPhoto ? 'opacity-50 pointer-events-none' : 'theme-bg-surface-subtle hover:border-amber-500'
              }`}>
                {isCompressingPhoto ? <Loader2 className="w-4 h-4 animate-spin theme-text-accent shrink-0" /> : <Image className="w-4 h-4 theme-text-accent shrink-0" />}
                <span className="truncate">Photos / Album</span>
                <input type="file" accept="image/*" onChange={handlePhotoFileChange} disabled={isCompressingPhoto} className="hidden" />
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl theme-text-secondary font-bold hover:bg-white/10 cursor-pointer select-none text-xs sm:text-sm"
            >
              {translate(lang, 'btn_cancel')}
            </button>
            <button
              type="submit"
              className="theme-bg-primary text-white px-5 py-2.5 rounded-xl font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer text-xs sm:text-sm"
            >
              {translate(lang, 'btn_save_confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
