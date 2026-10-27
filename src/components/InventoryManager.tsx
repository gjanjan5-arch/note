import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit3,
  Trash2,
  Minus,
  ShoppingBag,
  CheckCircle2,
  X,
  Filter,
  Check,
  Receipt,
  ShoppingCart,
  Pencil,
  User,
  CreditCard,
  Barcode,
  Layers,
  Camera,
  Image,
  Loader2,
  Zap,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Banknote,
} from "lucide-react";
import type { InventoryItem, Customer, InventoryVariant, ProductItemType, Transaction } from "../types";
import { db } from "../db/db";
import { formatPeso, formatDateTime, getLocalDateStr } from "../utils/formatters";
import { translate, type LanguageCode } from "../utils/i18n";
import { ConfirmModal } from "./ConfirmModal";
import { AlertModal } from "./AlertModal";
import { FormalReceipt } from "./FormalReceipt";
import { ProductModal } from "./ProductModal";
import { ScannerModal } from "./ScannerModal";
import { useExplorationTutorial } from "../context/ExplorationTutorialContext";
import { compressImage } from "../utils/imageCompressor";
import { TINGI_PRESETS, calculateWeightVariants, type TingiPreset } from "../utils/tingiCalculator";

interface InventoryManagerProps {
  inventory: InventoryItem[];
  lang: LanguageCode;
  onRefresh: () => void;
  openAddModalPrefill?: { name?: string; sku?: string; itemType?: ProductItemType } | null;
  onClearAddModalPrefill?: () => void;
  prefillAction?: { productId: number; action: "EDIT" | "SELL" | "VIEW" } | null;
  onClearPrefillAction?: () => void;
  onOpenRecommendations?: () => void;
}

interface CartItem {
  id: string; // unique cart line id
  productId: number;
  name: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
  variantLabel?: string;
  variantIndex?: number;
}

interface SaleReceipt {
  timestamp: number;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  totalAmount: number;
  buyersMoney?: number;
  change?: number;
  isCredit?: boolean;
  customerName?: string;
  customerPhone?: string;
}

const PRODUCT_CATEGORIES = [
  "Beverages",
  "Noodles",
  "Snacks",
  "Condiments",
  "Personal Care",
  "Cigarettes",
  "Grocery",
];

const ITEM_ICON_OPTIONS = [
  { icon: "🥤", label: "🥤 Inumin (Softdrinks & Drinks)", category: "Beverages" },
  { icon: "🍿", label: "🍿 Snacks & Chichirya", category: "Snacks" },
  { icon: "🥫", label: "🥫 Delata & Canned Goods", category: "Grocery" },
  { icon: "🍜", label: "🍜 Instant Noodles & Sopas", category: "Noodles" },
  { icon: "🍞", label: "🍞 Tinapay & Bakery", category: "Grocery" },
  { icon: "🧼", label: "🧼 Banyo & Sabon (Personal Care)", category: "Personal Care" },
  { icon: "🧹", label: "🧹 Panglinis & Labada", category: "Grocery" },
  { icon: "🧂", label: "🧂 Bumbu & Condiments", category: "Condiments" },
  { icon: "🍺", label: "🍺 Alak & Beer", category: "Beverages" },
  { icon: "🍬", label: "🍬 Kendi & Tsokolate", category: "Snacks" },
  { icon: "🧊", label: "🧊 Yelo & Ice Products", category: "Beverages" },
  { icon: "🍚", label: "🍚 Bigas & Rice", category: "Grocery" },
  { icon: "🚬", label: "🚬 Yosi / Cigarettes", category: "Cigarettes" },
  { icon: "🛢️", label: "🛢️ Mantika / Cooking Oil", category: "Condiments" },
  { icon: "🪵", label: "🪵 Uling & Kahoy", category: "Grocery" },
  { icon: "🥚", label: "🥚 Itlog / Eggs", category: "Grocery" },
  { icon: "🧄", label: "🧄 Bawang, Sibuyas & Spices", category: "Condiments" },
  { icon: "🥩", label: "🥩 Karne & Isda", category: "Grocery" },
  { icon: "📦", label: "📦 Pangkalahatan (General)", category: "Grocery" },
];

const INVENTORY_FILTER_OPTIONS = [
  { id: "TYPE_ALL", label: "Lahat (All Items)", icon: "📋", type: "itemType" },
  { id: "TYPE_STANDARD", label: "📦 Standard Items", icon: "📦", type: "itemType" },
  { id: "TYPE_PACK_VARIETY", label: "⚡ Pack & Variety", icon: "⚡", type: "itemType" },
  { id: "AZ_SORT", label: "A to Z Sort", icon: "🔤", type: "sort" },
  { id: "Beverages", label: "Beverages", icon: "🥤", type: "category" },
  { id: "Noodles", label: "Noodles", icon: "🍜", type: "category" },
  { id: "Snacks", label: "Snacks", icon: "🍿", type: "category" },
  { id: "Condiments", label: "Condiments", icon: "🧂", type: "category" },
  { id: "Personal Care", label: "Personal Care", icon: "🧴", type: "category" },
  { id: "Cigarettes", label: "Cigarettes", icon: "🚬", type: "category" },
  { id: "Grocery", label: "Grocery", icon: "🥫", type: "category" },
] as const;

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  inventory,
  lang,
  onRefresh,
  openAddModalPrefill,
  onClearAddModalPrefill,
  prefillAction,
  onClearPrefillAction,
  onOpenRecommendations,
}) => {
  const [activeFilterOption, setActiveFilterOption] = useState<string | null>(null);
  const [itemTypeFilter, setItemTypeFilter] = useState<"ALL" | "STANDARD" | "PACK_VARIETY">("ALL");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<number | string | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
  const [selectedDetailVariantIdx, setSelectedDetailVariantIdx] = useState<number | null>(null);

  const handleOpenViewItem = (item: InventoryItem) => {
    setSelectedDetailItem(item);
    setSelectedDetailVariantIdx(null);
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { triggerTip } = useExplorationTutorial();

  // Recommendations and notification states
  const [isInsightDismissed, setIsInsightDismissed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Add / Edit Product Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [stock, setStock] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [minStockAlert, setMinStockAlert] = useState("5");
  const [unit, setUnit] = useState("pcs");
  const [quickIcon, setQuickIcon] = useState("📦");
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [itemType, setItemType] = useState<ProductItemType>("STANDARD");
  const [photo, setPhoto] = useState("");
  const [newVariantLabel, setNewVariantLabel] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [newVariantStock, setNewVariantStock] = useState("");
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Add Stock Modal states
  const [addStockItem, setAddStockItem] = useState<InventoryItem | null>(null);
  const [addStockQty, setAddStockQty] = useState("1");
  const [selectedRestockVariantIdx, setSelectedRestockVariantIdx] = useState<number | 'ALL' | null>(null);

  // Sell Now Modal states
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [initialSellProduct, setInitialSellProduct] = useState<InventoryItem | null>(null);
  const [selectedSellVariantIdx, setSelectedSellVariantIdx] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyersMoneyInput, setBuyersMoneyInput] = useState("");
  const [isAddProductPickerOpen, setIsAddProductPickerOpen] = useState(false);
  const [pickerSearchTerm, setPickerSearchTerm] = useState("");

  // Customer Credit Modal states
  const [isCreditCustomerModalOpen, setIsCreditCustomerModalOpen] = useState(false);
  const [creditCustomerName, setCreditCustomerName] = useState("");
  const [creditCustomerPhone, setCreditCustomerPhone] = useState("");
  const [creditErrorBanner, setCreditErrorBanner] = useState<string | null>(null);
  const [existingCustomersList, setExistingCustomersList] = useState<Customer[]>([]);

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);

  // Global Alert & Confirm Modals
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "info" | "success" | "warning" | "error";
  }>({ isOpen: false, message: "" });

  const showAlert = (
    message: string,
    title?: string,
    type?: "info" | "success" | "warning" | "error"
  ) => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  // Load existing customers for credit suggestions
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const list = await db.customers.toArray();
        setExistingCustomersList(list);
      } catch (err) {
        console.warn("Could not load customers for credit modal:", err);
      }
    };
    loadCustomers();
  }, []);

  // Filter & Search calculation
  const handleSelectFilterOption = (optId: string) => {
    const opt = INVENTORY_FILTER_OPTIONS.find((o) => o.id === optId);
    if (!opt) return;
    if (opt.type === "itemType") {
      if (opt.id === "TYPE_ALL") setItemTypeFilter("ALL");
      else if (opt.id === "TYPE_STANDARD") setItemTypeFilter("STANDARD");
      else if (opt.id === "TYPE_PACK_VARIETY") setItemTypeFilter("PACK_VARIETY");
    } else {
      setActiveFilterOption((prev) => (prev === opt.id ? null : opt.id));
    }
    setIsFilterDropdownOpen(false);
  };

  const clearFilter = () => {
    setActiveFilterOption(null);
    setItemTypeFilter("ALL");
    setIsFilterDropdownOpen(false);
  };

  const lowStockItems = useMemo(() => {
    return inventory.filter((it) => {
      const threshold = typeof it.minStockAlert === "number" ? it.minStockAlert : (it.lowStockThreshold || 5);
      const effectiveStock = it.variants && it.variants.length > 0
        ? it.variants.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : 0), 0)
        : it.stock;
      return effectiveStock <= threshold;
    });
  }, [inventory]);

  const filteredItems = useMemo(() => {
    let result = [...inventory];
    if (itemTypeFilter === "STANDARD") {
      result = result.filter((it) => !it.itemType || it.itemType === "STANDARD");
    } else if (itemTypeFilter === "PACK_VARIETY") {
      result = result.filter((it) => it.itemType === "PACK_VARIETY");
    }

    if (activeFilterOption) {
      if (activeFilterOption === "AZ_SORT") {
        result.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        result = result.filter((it) => it.category === activeFilterOption);
      }
    }
    return result;
  }, [inventory, itemTypeFilter, activeFilterOption]);

  // Handle outside click for filter dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Pre-fill handling
  useEffect(() => {
    if (openAddModalPrefill) {
      openAddModal(openAddModalPrefill);
      onClearAddModalPrefill?.();
    }
  }, [openAddModalPrefill]);

  useEffect(() => {
    if (prefillAction) {
      const prod = inventory.find((p) => p.id === prefillAction.productId);
      if (prod) {
        if (prefillAction.action === "EDIT") openEditModal(prod);
        else if (prefillAction.action === "SELL") openSellNowModal(prod);
        else if (prefillAction.action === "VIEW") handleOpenViewItem(prod);
      }
      onClearPrefillAction?.();
    }
  }, [prefillAction, inventory]);

  useEffect(() => {
    triggerTip({
      id: "paninda_intro",
      icon: Package,
      title: {
        tl: "Imbentaryo ng Tindahan (PANINDA)",
        en: "Product Inventory (PANINDA)",
      },
      desc: {
        tl: "Dito nakalista ang iyong mga paninda, puhunan, presyo ng benta (SRP), at tinatayang tubo.",
        en: "Manage all store products, wholesale cost (Puhunan), retail price (SRP), and profit margin.",
      },
    });
  }, [triggerTip]);

  useEffect(() => {
    if (inventory.length > 0) {
      triggerTip({
        id: "paninda_first_product",
        icon: Package,
        title: {
          tl: "Kalkulasyon ng Tubo",
          en: "Profit Calculation",
        },
        desc: {
          tl: "Awtomatikong kinakalkula ng app ang iyong kikitain sa bawat piraso batay sa iyong Puhunan at Presyo.",
          en: "The app automatically computes your estimated profit (Tubo) per item based on cost and retail price.",
        },
      });

      const hasLowStock = inventory.some((it) => it.stock <= (it.lowStockThreshold || 5));
      if (hasLowStock) {
        triggerTip({
          id: "paninda_low_stock",
          icon: AlertTriangle,
          title: {
            tl: "Paubos na Paninda",
            en: "Low Stock Warning",
          },
          desc: {
            tl: "Nagiging kulay orange/pula ang badge kapag malapit nang maubos ang produkto para makapag-restock ka agad bago maubusan.",
            en: "Badges turn warning colored when stock is low so you can restock before running out.",
          },
        });
      }
    }
  }, [inventory, triggerTip]);

  // Product Add / Edit Handlers
  const openAddModal = (prefill?: { name?: string; sku?: string; itemType?: ProductItemType }) => {
    setEditingItem(null);
    setName(prefill?.name || "");
    setSku(prefill?.sku || "");
    setCategory(PRODUCT_CATEGORIES[0]);
    setStock("0");
    setUnitCost("0");
    setUnitPrice("0");
    setMinStockAlert("5");
    setUnit("pcs");
    setQuickIcon("📦");
    setVariants([]);
    setItemType(prefill?.itemType || "STANDARD");
    setPhoto("");
    setNewVariantLabel("");
    setNewVariantPrice("");
    setNewVariantStock("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setSku(item.sku || "");
    setCategory(item.category || PRODUCT_CATEGORIES[0]);
    setStock(item.stock.toString());
    setUnitCost(item.unitCost.toString());
    setUnitPrice(item.unitPrice.toString());
    setMinStockAlert((item.minStockAlert ?? 5).toString());
    setUnit(item.unit || "pcs");
    setQuickIcon(item.quickIcon || "📦");
    setVariants(item.variants ? [...item.variants] : []);
    setItemType(item.itemType || "STANDARD");
    setPhoto(item.photo || "");
    setNewVariantLabel("");
    setNewVariantPrice("");
    setNewVariantStock("");
    setIsModalOpen(true);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImage(file, 600, 0.7);
      setPhoto(compressed);
    } catch (err) {
      console.error("Photo compression error:", err);
      showAlert(
        lang === "tl" ? "Nabigong i-compress ang larawan." : "Failed to compress photo.",
        "Error",
        "error"
      );
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleAddVariantItem = () => {
    if (!newVariantLabel.trim() || !newVariantPrice.trim()) {
      showAlert(
        lang === "tl" ? "Punan ang label at presyo ng variant." : "Fill in variant label and price.",
        lang === "tl" ? "Kulang na Datos" : "Missing Information",
        "warning"
      );
      return;
    }
    const vPrice = parseFloat(newVariantPrice) || 0;
    const vStock = parseInt(newVariantStock, 10) || 0;
    setVariants((prev) => [
      ...prev,
      {
        label: newVariantLabel.trim(),
        unitPrice: vPrice,
        stock: vStock,
      },
    ]);
    setNewVariantLabel("");
    setNewVariantPrice("");
    setNewVariantStock("");
  };

  const handleRemoveVariantItem = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showAlert(
        lang === "tl" ? "Pakilagay ang pangalan ng produkto." : "Please enter product name.",
        lang === "tl" ? "Kulang na Datos" : "Missing Data",
        "warning"
      );
      return;
    }

    const parsedStock = parseInt(stock, 10) || 0;
    const parsedCost = parseFloat(unitCost) || 0;
    const parsedPrice = parseFloat(unitPrice) || 0;
    const parsedMinAlert = parseInt(minStockAlert, 10) || 5;

    const productData: Omit<InventoryItem, "id"> = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      category,
      stock: variants.length > 0 ? variants.reduce((sum, v) => sum + (v.stock ?? 0), 0) : parsedStock,
      unitCost: parsedCost,
      unitPrice: parsedPrice,
      minStockAlert: parsedMinAlert,
      unit: unit.trim() || "pcs",
      quickIcon: quickIcon || "📦",
      variants: variants.length > 0 ? variants : undefined,
      itemType,
      photo: photo || undefined,
      
      syncStatus: "LOCAL",
    };

    try {
      if (editingItem && editingItem.id) {
        await db.inventory.update(editingItem.id, productData);
        showAlert(
          lang === "tl" ? `Na-update ang "${name}".` : `"${name}" updated successfully.`,
          lang === "tl" ? "Na-update" : "Success",
          "success"
        );
      } else {
        await db.inventory.add({
          ...productData,
          
        } as unknown as InventoryItem);
        showAlert(
          lang === "tl" ? `Naidagdag ang "${name}".` : `"${name}" added successfully.`,
          lang === "tl" ? "Naidagdag" : "Success",
          "success"
        );
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error("Error saving product:", err);
      showAlert(
        lang === "tl" ? "Hindi na-save ang produkto." : "Failed to save product.",
        "Error",
        "error"
      );
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    setConfirmState({
      isOpen: true,
      title: lang === "tl" ? "Burahin ang Produkto?" : "Delete Product?",
      message: lang === "tl"
        ? `Sigurado ka bang nais mong burahin ang "${item.name}" mula sa imbentaryo?`
        : `Are you sure you want to delete "${item.name}" from inventory?`,
      confirmText: lang === "tl" ? "Oo, Burahin" : "Yes, Delete",
      cancelText: lang === "tl" ? "Kanselahin" : "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          await db.inventory.delete(item.id!);
          onRefresh();
          showAlert(
            lang === "tl" ? `Nabura na ang "${item.name}".` : `"${item.name}" deleted.`,
            lang === "tl" ? "Nabura" : "Deleted",
            "success"
          );
        } catch (e) {
          console.error("Error deleting product:", e);
          showAlert(
            lang === "tl" ? "Hindi nabura ang produkto." : "Failed to delete product.",
            "Error",
            "error"
          );
        }
      },
    });
  };

  // Add Stock Handlers
  const openAddStockModal = (item: InventoryItem) => {
    setAddStockItem(item);
    setAddStockQty("1");
    setSelectedRestockVariantIdx(item.variants && item.variants.length > 0 ? 0 : null);
  };

  const handleConfirmAddStock = async () => {
    if (!addStockItem) return;
    const qty = parseInt(addStockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showAlert(
        lang === "tl" ? "Maglagay ng wastong dami ng stock." : "Please enter a valid stock quantity.",
        lang === "tl" ? "Maling Dami" : "Invalid Quantity",
        "warning"
      );
      return;
    }

    try {
      if (addStockItem.variants && addStockItem.variants.length > 0 && selectedRestockVariantIdx !== null) {
        const updatedVariants = [...addStockItem.variants];
        const curVar = updatedVariants[selectedRestockVariantIdx];
        const curStock = curVar.stock !== undefined ? curVar.stock : addStockItem.stock;
        updatedVariants[selectedRestockVariantIdx] = {
          ...curVar,
          stock: curStock + qty,
        };
        const newTotal = updatedVariants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
        await db.inventory.update(addStockItem.id!, {
          variants: updatedVariants,
          stock: newTotal,
          
        });
      } else {
        await db.inventory.update(addStockItem.id!, {
          stock: addStockItem.stock + qty,
          
        });
      }

      setAddStockItem(null);
      onRefresh();
      showAlert(
        lang === "tl"
          ? `Matagumpay na nadagdagan ng ${qty} ang stock ng ${addStockItem.name}.`
          : `Successfully added ${qty} stock to ${addStockItem.name}.`,
        lang === "tl" ? "Matagumpay" : "Success",
        "success"
      );
    } catch (err) {
      console.error("Failed to add stock:", err);
      showAlert(
        lang === "tl" ? "Hindi naidagdag ang stock." : "Failed to add stock.",
        "Error",
        "error"
      );
    }
  };

  // Sell Now Handlers & Calculations
  const openSellNowModal = (item: InventoryItem, variantIdx?: number | null) => {
    setInitialSellProduct(item);
    setSelectedSellVariantIdx(variantIdx !== undefined ? variantIdx : null);
    setBuyersMoneyInput("");
    setIsAddProductPickerOpen(false);
    setPickerSearchTerm("");

    if (variantIdx !== null && variantIdx !== undefined && item.variants && item.variants[variantIdx]) {
      const v = item.variants[variantIdx];
      const vStock = v.stock !== undefined ? v.stock : item.stock;
      setCart([
        {
          id: `${item.id}-v${variantIdx}`,
          productId: item.id!,
          name: `${item.name} (${v.label})`,
          unitPrice: v.unitPrice,
          availableStock: vStock,
          quantity: 1,
          variantLabel: v.label,
          variantIndex: variantIdx,
        },
      ]);
    } else {
      setCart([
        {
          id: `${item.id}`,
          productId: item.id!,
          name: item.name,
          unitPrice: item.unitPrice,
          availableStock: item.stock,
          quantity: 1,
        },
      ]);
    }
    setSellModalOpen(true);
  };

  const handleAddProductToCart = (item: InventoryItem, variant?: InventoryVariant, variantIdx?: number) => {
    const displayName = variant ? `${item.name} (${variant.label})` : item.name;
    const availableStock = variant && variant.stock !== undefined ? variant.stock : item.stock;
    const unitPrice = variant ? variant.unitPrice : item.unitPrice;
    const lineId = variant ? `${item.id}-v${variantIdx}` : `${item.id}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === lineId);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const newQty = Math.min(availableStock, existing.quantity + 1);
        const updated = [...prev];
        updated[existingIndex] = { ...existing, quantity: newQty };
        return updated;
      }
      return [
        ...prev,
        {
          id: lineId,
          productId: item.id!,
          name: displayName,
          unitPrice,
          availableStock,
          quantity: 1,
          variantLabel: variant?.label,
          variantIndex: variantIdx,
        },
      ];
    });
    setIsAddProductPickerOpen(false);
  };

  const handleUpdateCartItemQty = (cartId: string, qty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.id === cartId) {
          const clamped = Math.max(1, Math.min(c.availableStock, qty));
          return { ...c, quantity: clamped };
        }
        return c;
      })
    );
  };

  const handleRemoveCartItem = (cartId: string) => {
    setCart((prev) => prev.filter((c) => c.id !== cartId));
  };

  const totalSaleAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const parsedBuyersMoney = useMemo(() => {
    return Number(buyersMoneyInput) || 0;
  }, [buyersMoneyInput]);

  const isBudgetEntered = buyersMoneyInput.trim() !== "";
  const budgetDifference = parsedBuyersMoney - totalSaleAmount;
  const hasInsufficientBudget = isBudgetEntered && budgetDifference < 0;

  const aggregateQtyByProduct = useMemo(() => {
    const map: Record<number, number> = {};
    cart.forEach((c) => {
      map[c.productId] = (map[c.productId] || 0) + c.quantity;
    });
    return map;
  }, [cart]);

  const hasExceededStock = useMemo(() => {
    return cart.some((c) => c.quantity > c.availableStock);
  }, [cart]);

  const isCartEmpty = cart.length === 0;

  const handleConfirmSellNow = async () => {
    if (isCartEmpty || hasExceededStock || hasInsufficientBudget) return;

    try {
      // 1. Deduct inventory stocks
      for (const cartItem of cart) {
        const prod = inventory.find((p) => p.id === cartItem.productId);
        if (!prod) continue;
        if (cartItem.variantIndex !== undefined && prod.variants && prod.variants[cartItem.variantIndex]) {
          const updatedVariants = [...prod.variants];
          const curVar = updatedVariants[cartItem.variantIndex];
          const curStock = curVar.stock !== undefined ? curVar.stock : prod.stock;
          updatedVariants[cartItem.variantIndex] = {
            ...curVar,
            stock: Math.max(0, curStock - cartItem.quantity),
          };
          const newTotalStock = updatedVariants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
          await db.inventory.update(prod.id!, {
            variants: updatedVariants,
            stock: newTotalStock,
            
          });
        } else {
          await db.inventory.update(prod.id!, {
            stock: Math.max(0, prod.stock - cartItem.quantity),
            
          });
        }
      }

      // 2. Create transaction record
      const itemsDescription = cart.map((c) => `${c.name} ×${c.quantity}`).join(", ");
      const newTx: Transaction = {
        timestamp: Date.now(),
        dateStr: getLocalDateStr(),
        type: "SALE",
        totalAmount: totalSaleAmount,
        items: cart.map((c) => ({
          itemName: c.name,
          quantity: c.quantity,
          totalPrice: c.unitPrice * c.quantity,
          unitPrice: c.unitPrice,
        })),
        rawNote: `Benta (${cart.length} uri): ${itemsDescription} = ₱${totalSaleAmount}`,
        paymentMethod: "CASH",
        cashTendered: isBudgetEntered ? parsedBuyersMoney : null,
        changeAmount: isBudgetEntered && budgetDifference >= 0 ? budgetDifference : null,
        syncStatus: "LOCAL",
      };

      const txId = await db.transactions.add(newTx);
      const savedTx = { ...newTx, id: txId as number };

      setSellModalOpen(false);
      setCart([]);
      setInitialSellProduct(null);
      setIsAddProductPickerOpen(false);
      onRefresh();

      setActiveReceipt(savedTx);
    } catch (err) {
      console.error("Error processing sale:", err);
      showAlert(
        lang === "tl" ? "Nagka-error sa pagproseso ng benta." : "Error processing sale.",
        "Error",
        "error"
      );
    }
  };

  const handleConfirmCreditNow = async () => {
    const targetName = creditCustomerName.trim();
    if (!targetName) {
      setCreditErrorBanner(
        lang === "tl" ? "Kailangan ang pangalan ng suki." : "Customer name is required."
      );
      return;
    }

    try {
      // 1. Deduct inventory stocks
      for (const cartItem of cart) {
        const prod = inventory.find((p) => p.id === cartItem.productId);
        if (!prod) continue;
        if (cartItem.variantIndex !== undefined && prod.variants && prod.variants[cartItem.variantIndex]) {
          const updatedVariants = [...prod.variants];
          const curVar = updatedVariants[cartItem.variantIndex];
          const curStock = curVar.stock !== undefined ? curVar.stock : prod.stock;
          updatedVariants[cartItem.variantIndex] = {
            ...curVar,
            stock: Math.max(0, curStock - cartItem.quantity),
          };
          const newTotalStock = updatedVariants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
          await db.inventory.update(prod.id!, {
            variants: updatedVariants,
            stock: newTotalStock,
            
          });
        } else {
          await db.inventory.update(prod.id!, {
            stock: Math.max(0, prod.stock - cartItem.quantity),
            
          });
        }
      }

      // 2. Find or create customer
      const existing = await db.customers.where("name").equalsIgnoreCase(targetName).first();
      if (!existing) {
        await db.customers.add({
          name: targetName,
          phone: creditCustomerPhone.trim() || undefined,
          currentBalance: totalSaleAmount, lastTransactionAt: Date.now(),
          
          
        });
      } else {
        await db.customers.update(existing.id!, {
          currentBalance: (existing.currentBalance || 0) + totalSaleAmount, lastTransactionAt: Date.now(),
          phone: creditCustomerPhone.trim() || existing.phone,
          
        });
      }

      // 3. Create transaction record
      const itemsDescription = cart.map((c) => `${c.name} ×${c.quantity}`).join(", ");
      const newTx: Transaction = {
        timestamp: Date.now(),
        dateStr: getLocalDateStr(),
        type: "PAUTANG_RECORD",
        customerName: targetName,
        handledBy: targetName,
        totalAmount: totalSaleAmount,
        items: cart.map((c) => ({
          itemName: c.name,
          quantity: c.quantity,
          totalPrice: c.unitPrice * c.quantity,
          unitPrice: c.unitPrice,
        })),
        rawNote: `Pautang kay ${targetName}: ${itemsDescription} = ₱${totalSaleAmount}`,
        syncStatus: "LOCAL",
      };

      const txId = await db.transactions.add(newTx);
      const savedTx = { ...newTx, id: txId as number };

      setIsCreditCustomerModalOpen(false);
      setCreditCustomerName("");
      setCreditCustomerPhone("");
      setCreditErrorBanner(null);
      setSellModalOpen(false);
      setCart([]);
      setInitialSellProduct(null);
      setIsAddProductPickerOpen(false);
      onRefresh();

      setActiveReceipt(savedTx);
    } catch (err) {
      console.error("Error processing credit:", err);
      showAlert(
        lang === "tl" ? "Nagka-error sa pag-record ng utang." : "Error recording credit.",
        "Error",
        "error"
      );
    }
  };

  return (
   <div className="space-y-4">
   {/* Recommendations Trigger */}
   {lowStockItems.length > 0 && !isInsightDismissed && (
    <div className="w-full bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-center justify-between animate-in fade-in">
     <button onClick={() => onOpenRecommendations?.()} className="flex-1 text-left flex items-center gap-2 cursor-pointer">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-xs font-black text-amber-900 dark:text-amber-300">
       {lang === 'tl' ? 'Rekomendasyon' : 'Recommendation'}
      </span>
     </button>
     <button onClick={() => setIsInsightDismissed(true)} className="p-1 rounded-full hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer">
      <X className="w-4 h-4" />
     </button>
    </div>
   )}
   {/* Toast / Notification Banner */}
   {statusMessage && (
    <div className="theme-bg-primary text-white text-xs font-black p-3 rounded-2xl flex items-center gap-2 shadow-md animate-in fade-in ">
     <CheckCircle2 className="w-4 h-4 text-white/90 shrink-0" />
     <span>{statusMessage}</span>
    </div>
   )}

   {/* Control Header & Add Button */}
   <div
    id="inventory-controls-section"
    className="theme-card p-3.5 sm:p-4 rounded-3xl shadow-2xs border transition-colors duration-200"
   >
    <div className="flex flex-wrap items-center justify-between gap-2.5">
     <div className="flex items-center gap-2">
      {/* Filter by Dropdown Anchor */}
      <div className="relative" ref={dropdownRef}>
       <button
        id="btn-inventory-filter-by"
        type="button"
        role="button"
        tabIndex={0}
        style={{ touchAction: 'manipulation' }}
        onClick={() => {
         console.log('[InventoryManager] Toggling filter dropdown');
         setIsFilterDropdownOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsFilterDropdownOpen((prev) => !prev);
         }
        }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-extrabold border transition-all active:scale-95 shadow-2xs select-none touch-manipulation cursor-pointer ${
         activeFilterOption || itemTypeFilter !== 'ALL'
          ? 'theme-bg-primary text-white border-white/20'
          : 'theme-bg-surface-subtle hover:bg-white/10 theme-text-app border-theme-border-subtle'
        }`}
       >
        <Filter className="w-3.5 h-3.5" />
        <span>{translate(lang, 'filter_by') || 'Filter by'}</span>
        {(activeFilterOption || itemTypeFilter !== 'ALL') && (
         <span className="w-4 h-4 rounded-full bg-white text-[var(--color-primary)] flex items-center justify-center text-[10px] font-black shrink-0">
          !
         </span>
        )}
       </button>

       {/* Dropdown Menu */}
       {isFilterDropdownOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] theme-card rounded-2xl p-2 shadow-2xl border theme-border-subtle z-50 animate-in fade-in space-y-1">
         {INVENTORY_FILTER_OPTIONS.map((opt, index) => {
          const isSelected =
           opt.type === 'itemType'
            ? (opt.id === 'TYPE_ALL' && itemTypeFilter === 'ALL') ||
             (opt.id === 'TYPE_STANDARD' && itemTypeFilter === 'STANDARD') ||
             (opt.id === 'TYPE_PACK_VARIETY' && itemTypeFilter === 'PACK_VARIETY')
            : activeFilterOption === opt.id;

          return (
           <React.Fragment key={opt.id}>
            {(index === 3 || index === 4) && <div className="border-t theme-border-subtle my-1" />}
            <button
             type="button"
             role="button"
             tabIndex={0}
             style={{ touchAction: 'manipulation' }}
             onClick={() => handleSelectFilterOption(opt.id)}
             onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
               e.preventDefault();
               handleSelectFilterOption(opt.id);
              }
             }}
             className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left select-none touch-manipulation cursor-pointer ${
              isSelected
               ? 'theme-bg-primary text-white'
               : 'theme-text-app hover:theme-bg-surface-subtle'
             }`}
            >
             <div className="flex items-center gap-2">
              <span className="text-sm">{opt.icon}</span>
              <span>{opt.label}</span>
             </div>
             {isSelected && <Check className="w-3.5 h-3.5" />}
            </button>
           </React.Fragment>
          );
         })}

         {/* Clear filter button if active */}
         {activeFilterOption && (
          <div className="pt-1 border-t theme-border-subtle">
           <button
            type="button"
            role="button"
            tabIndex={0}
            style={{ touchAction: 'manipulation' }}
            onClick={clearFilter}
            onKeyDown={(e) => {
             if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              clearFilter();
             }
            }}
            className="w-full text-center py-1.5 text-[11px] font-bold theme-text-secondary hover:theme-text-accent select-none touch-manipulation cursor-pointer"
           >
            {lang === 'tl' ? 'I-reset ang filter' : 'Clear Filter'}
           </button>
          </div>
         )}
        </div>
       )}
      </div>

      <button
       id="btn-add-paninda"
       type="button"
       role="button"
       tabIndex={0}
       style={{ touchAction: 'manipulation' }}
       onClick={() => openAddModal()}
       onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
         e.preventDefault();
         openAddModal();
        }
       }}
       className="flex items-center justify-center gap-1.5 theme-bg-primary text-white px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shadow-2xs active:scale-95 shrink-0 select-none touch-manipulation cursor-pointer"
      >
       <Plus className="w-4 h-4 text-white/90" />
       <span>+ {translate(lang, 'btn_add_item')}</span>
      </button>
     </div>
    </div>
   </div>

   {/* Inventory Items Box-Type Grid (Fluid auto-fit for all browser zoom levels) */}
   <div className="fluid-grid-products">
    {filteredItems.length === 0 ? (
     <div className="col-span-full theme-card rounded-3xl p-8 text-center border border-dashed theme-border theme-text-secondary">
      <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
      <p className="text-sm font-bold theme-text-app">{translate(lang, 'no_records_found')}</p>
     </div>
    ) : (
     filteredItems.map((item) => {
      const hasVariants = item.variants && item.variants.length > 0;
      const effectiveStock = hasVariants
       ? item.variants!.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : 0), 0)
       : item.stock;

      const isLowStock = effectiveStock <= item.minStockAlert;
      const isOutOfStock = effectiveStock <= 0;
      const displayIcon = item.quickIcon || (item.itemType === 'PACK_VARIETY' ? '⚡' : '📦');

      return (
       <div
        key={item.id}
        role="button"
        tabIndex={0}
        style={{ touchAction: 'manipulation' }}
        onClick={() => handleOpenViewItem(item)}
        onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenViewItem(item);
         }
        }}
        className={`theme-card rounded-2xl border transition-all duration-150 p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer select-none active:scale-[0.98] shadow-2xs hover:shadow-xs min-h-[125px] sm:min-h-[140px] ${
         isOutOfStock
          ? 'border-red-500/40 bg-red-500/5'
          : isLowStock
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'hover:border-[var(--color-primary)]'
        }`}
       >
        {/* Top Row: Quick Avatar Icon & Stock Status */}
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
         <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-base shrink-0 shadow-2xs">
          {displayIcon}
         </div>
         <div className="flex flex-col items-end gap-0.5">
          <span
           className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border tracking-tight ${
            isOutOfStock
             ? 'bg-red-500/20 text-red-400 border-red-500/30'
             : isLowStock
             ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
             : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
           }`}
          >
           {isOutOfStock ? (lang === 'tl' ? 'Ubos' : 'Out') : `${effectiveStock} ${hasVariants ? (effectiveStock === 1 ? 'pack' : 'packs') : (item.unit || 'pcs')}`}
          </span>
          {hasVariants && (
           <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
            {item.variants!.length} var
           </span>
          )}
         </div>
        </div>

        {/* Middle: Item Name (clean 2-line clamp for uniform box height) */}
        <div className="min-w-0 flex-1 flex flex-col justify-center my-1">
         <h4 className="font-black theme-text-app text-xs sm:text-sm leading-snug line-clamp-2" title={item.name}>
          {item.name}
         </h4>
        </div>

        {/* Bottom Row: Selling Price & Category */}
        <div className="pt-1.5 border-t theme-border-subtle flex items-center justify-between gap-1">
         <span className="font-black text-xs sm:text-sm theme-text-app truncate">
          {formatPeso(item.unitPrice)}
         </span>
         <span className="text-[9px] font-bold theme-text-secondary truncate max-w-[60px] uppercase">
          {item.category}
         </span>
        </div>
       </div>
      );
     })
    )}
   </div>

   {/* ITEM DETAILS & ACTIONS MODAL (Reveals Sell Now, Add Stock, and full details upon tapping card) */}
   {selectedDetailItem && (() => {
    const item = inventory.find((it) => it.id === selectedDetailItem.id) || selectedDetailItem;
    const tubo = item.unitPrice - item.unitCost;
    const displayIcon = item.quickIcon || (item.itemType === 'PACK_VARIETY' ? '⚡' : '📦');

    const hasVariants = item.variants && item.variants.length > 0;
    const noVariantSelected = hasVariants && selectedDetailVariantIdx === null;
    
    // Compute effective stock based on selection
    const effectiveStock = hasVariants 
     ? (selectedDetailVariantIdx !== null && item.variants![selectedDetailVariantIdx].stock !== undefined
       ? item.variants![selectedDetailVariantIdx].stock!
       : item.variants!.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : 0), 0))
     : item.stock;

    const isOutOfStock = effectiveStock <= 0;
    const isLowStock = effectiveStock <= item.minStockAlert;
    
    const disableSellBtn = noVariantSelected || isOutOfStock;

    return (
     <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in"
      onClick={(e) => {
       if (e.target === e.currentTarget) {
        setSelectedDetailItem(null);
       }
      }}
     >
      <div
       className="theme-card rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border theme-border-subtle animate-in sm: max-h-[85vh] flex flex-col space-y-4"
       onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
       {/* Header */}
       <div className="flex items-start justify-between gap-3 border-b theme-border-subtle pb-3">
        <div className="flex items-center gap-3 min-w-0">
         <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl shrink-0 shadow-xs">
          {displayIcon}
         </div>
         <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
           <h3 className="font-black theme-text-app text-base sm:text-lg leading-tight truncate">
            {item.name}
           </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
           <span className="text-[10px] font-black uppercase tracking-wider theme-text-accent theme-bg-surface-subtle px-2 py-0.5 rounded-md border theme-border-subtle">
            {item.category}
           </span>
           {item.sku && (
            <span className="text-[10px] font-mono theme-text-secondary bg-slate-800/80 px-1.5 py-0.5 rounded border theme-border-subtle">
             SKU: {item.sku}
            </span>
           )}
          </div>
         </div>
        </div>

        <button
         type="button"
         onClick={() => setSelectedDetailItem(null)}
         className="p-1.5 rounded-full theme-text-secondary hover:theme-text-app cursor-pointer"
        >
         <X className="w-5 h-5" />
        </button>
       </div>

       {/* Stock & Pricing Details */}
       <div className="grid grid-cols-3 gap-2 text-center">
        <div className="theme-bg-surface-subtle p-2.5 rounded-2xl border theme-border-subtle">
         <span className="text-[10px] font-bold theme-text-secondary block mb-0.5">
          {translate(lang, 'price')}
         </span>
         <strong className="text-sm sm:text-base font-black theme-text-app">
          {formatPeso(item.unitPrice)}
         </strong>
        </div>

        <div className="theme-bg-surface-subtle p-2.5 rounded-2xl border theme-border-subtle">
         <span className="text-[10px] font-bold theme-text-secondary block mb-0.5">Cost / Profit</span>
         <strong className="text-xs sm:text-sm font-black theme-text-secondary block">
          {formatPeso(item.unitCost)}
         </strong>
         <span className="text-[10px] theme-text-accent font-black">
          (+{formatPeso(tubo)})
         </span>
        </div>

        <div className="theme-bg-surface-subtle p-2.5 rounded-2xl border theme-border-subtle">
         <span className="text-[10px] font-bold theme-text-secondary block mb-0.5">Stock Status</span>
         <strong
          className={`text-xs sm:text-sm font-black block ${
           isOutOfStock ? 'text-red-400' : isLowStock ? 'text-amber-400' : 'theme-text-accent'
          }`}
         >
          {isOutOfStock ? 'Out of Stock' : `${effectiveStock} ${hasVariants ? (effectiveStock === 1 ? 'pack' : 'packs') : (item.unit || 'pcs')}`}
         </strong>
        </div>
       </div>

       {/* Variants List if present */}
       {hasVariants && (
        <div className="space-y-1.5 p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 max-h-48 overflow-y-auto no-scrollbar">
         <span className="text-[10px] font-extrabold uppercase tracking-wider theme-text-secondary block">
          Portions / Variants ({item.variants!.length})
         </span>
         <div className="grid grid-cols-2 gap-2">
          {item.variants!.map((v, idx) => {
           const isSelected = selectedDetailVariantIdx === idx;
           const vStock = v.stock !== undefined ? v.stock : item.stock;
           const isVOutOfStock = vStock <= 0;
           return (
            <button
             key={idx}
             type="button"
             disabled={isVOutOfStock}
             onClick={() => setSelectedDetailVariantIdx(idx)}
             className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
              isSelected
               ? 'border-amber-500 bg-amber-500/15 shadow-xs'
               : isVOutOfStock
               ? 'border-slate-700/40 bg-slate-900/30 opacity-50 cursor-not-allowed'
               : 'border-slate-700/40 bg-slate-900/60 hover:border-slate-600/50'
             }`}
            >
             <div className="flex items-center justify-between text-xs">
              <span className={`font-bold truncate pr-1 ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
               {v.label}
              </span>
              <span className="font-black text-amber-300 shrink-0">{formatPeso(v.unitPrice)}</span>
             </div>
             <div className="flex items-center justify-between mt-1 text-[10px] opacity-75">
              <span className={isVOutOfStock ? 'text-red-400 font-bold' : 'text-slate-300'}>
               Stock: {vStock}
              </span>
              {isSelected && (
               <span className="font-black text-amber-500">
                {lang === 'tl' ? '✓ Napili' : '✓ Selected'}
               </span>
              )}
             </div>
            </button>
           );
          })}
         </div>
         {noVariantSelected && (
          <p className="text-[11px] text-amber-500 font-medium text-center pt-1">
           {lang === 'tl' 
            ? '⚠️ Pumili muna ng variant sa itaas para makapagbenta' 
            : '⚠️ Select a variant above before selling'}
          </p>
         )}
        </div>
       )}

       {/* Primary Actions: Add Stock & Sell Now */}
       <div className="space-y-2 pt-1">
        <div className="grid grid-cols-2 gap-2">
         <button
          type="button"
          onClick={() => {
           const current = item;
           setSelectedDetailItem(null);
           openAddStockModal(current);
          }}
          className="theme-bg-surface-subtle hover:bg-white/10 border theme-border-subtle theme-text-app font-black text-xs sm:text-sm py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
         >
          <Plus className="w-4 h-4 theme-text-accent" />
          <span>{translate(lang, 'btn_add_stock')}</span>
         </button>

         <button
          type="button"
          disabled={disableSellBtn}
          onClick={() => {
           const current = item;
           const variantIdx = selectedDetailVariantIdx;
           setSelectedDetailItem(null);
           openSellNowModal(current, variantIdx);
          }}
          className={`font-black text-xs sm:text-sm py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs ${
           disableSellBtn
            ? 'opacity-40 cursor-not-allowed theme-bg-surface-subtle theme-text-secondary border border-dashed theme-border-subtle select-none'
            : 'theme-bg-primary text-white cursor-pointer'
          }`}
         >
          <ShoppingCart className="w-4 h-4" />
          <span>
           {noVariantSelected 
            ? (lang === 'tl' ? 'Pumili ng Variant' : 'Select Variant')
            : isOutOfStock
            ? (lang === 'tl' ? 'Walang Stock' : 'Out of Stock')
            : translate(lang, 'btn_sell_now')}
          </span>
         </button>
        </div>

        {/* Secondary Actions: Edit & Delete */}
        <div className="flex items-center justify-between pt-2 border-t theme-border-subtle text-xs">
         <button
          type="button"
          onClick={() => {
           const current = item;
           setSelectedDetailItem(null);
           openEditModal(current);
          }}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl theme-text-secondary hover:theme-text-app hover:bg-white/5 cursor-pointer font-bold"
         >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{translate(lang, 'btn_edit') || 'Edit Product'}</span>
         </button>

         <button
          type="button"
          onClick={() => {
           const current = item;
           setSelectedDetailItem(null);
           handleDeleteItem(current);
          }}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer font-bold"
         >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{translate(lang, 'btn_delete') || 'Delete'}</span>
         </button>
        </div>
       </div>
      </div>
     </div>
    );
   })()}

   {/* 1. ADD STOCK MODAL */}
   {addStockItem && (
    <div
     className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
     onClick={(e) => {
      if (e.target === e.currentTarget) {
       console.log('[AddStockModal] Backdrop tapped -> closing modal');
       setAddStockItem(null);
      }
     }}
    >
     <div
      className="theme-card rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border animate-in "
      onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      style={{ touchAction: 'manipulation' }}
     >
      <div className="flex items-center justify-between pb-2 border-b theme-border-subtle mb-3">
       <div>
        <h3 className="font-black theme-text-app text-base">
         {translate(lang, 'add_stock_title')}
        </h3>
        <p className="text-xs theme-text-accent font-bold">{addStockItem.name}</p>
       </div>
       <button
        type="button"
        role="button"
        tabIndex={0}
        style={{ touchAction: 'manipulation' }}
        onClick={() => {
         console.log('[AddStockModal] Close button tapped');
         setAddStockItem(null);
        }}
        onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setAddStockItem(null);
         }
        }}
        className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer select-none touch-manipulation active:scale-95"
        aria-label="Close"
       >
        <X className="w-4 h-4" />
       </button>
      </div>

      <div className="space-y-4 py-1">
       <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle flex items-center justify-between text-xs font-bold theme-text-secondary">
        <span>{translate(lang, 'current_stock', { count: addStockItem.stock })}</span>
        <span className="font-mono theme-text-app">
         {addStockItem.stock} {addStockItem.variants && addStockItem.variants.length > 0 ? (addStockItem.stock === 1 ? 'pack' : 'packs') : (addStockItem.unit || 'pcs')}
        </span>
       </div>

       <div>
        <label className="block font-black theme-text-app text-xs mb-2 text-center">
         {translate(lang, 'how_many_adding')}
        </label>

        <div className="flex items-center justify-center gap-3">
         <button
          type="button"
          role="button"
          tabIndex={0}
          style={{ touchAction: 'manipulation' }}
          onClick={() => {
           const current = Number(addStockQty) || 0;
           const nextVal = Math.max(1, current - 1).toString();
           console.log('[AddStockModal] Stepper minus tapped ->', nextVal);
           setAddStockQty(nextVal);
          }}
          onKeyDown={(e) => {
           if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const current = Number(addStockQty) || 0;
            setAddStockQty(Math.max(1, current - 1).toString());
           }
          }}
          className="w-11 h-11 rounded-2xl theme-bg-surface-subtle hover:bg-white/10 theme-text-app font-black text-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer select-none touch-manipulation"
          aria-label="Decrease quantity"
         >
          <Minus className="w-5 h-5" />
         </button>

         <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="1"
          value={addStockQty}
          onChange={(e) => setAddStockQty(e.target.value)}
          onBlur={(e) => {
           const val = parseInt(e.target.value, 10);
           if (isNaN(val) || val < 1) {
            setAddStockQty('1');
           } else {
            setAddStockQty(val.toString());
           }
          }}
          className="w-24 h-11 text-center font-black text-xl theme-input border rounded-2xl theme-text-app focus:outline-none"
         />

         <button
          type="button"
          role="button"
          tabIndex={0}
          style={{ touchAction: 'manipulation' }}
          onClick={() => {
           const current = Number(addStockQty) || 0;
           const nextVal = (current + 1).toString();
           console.log('[AddStockModal] Stepper plus tapped ->', nextVal);
           setAddStockQty(nextVal);
          }}
          onKeyDown={(e) => {
           if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const current = Number(addStockQty) || 0;
            setAddStockQty((current + 1).toString());
           }
          }}
          className="w-11 h-11 rounded-2xl theme-bg-primary text-white font-black text-lg flex items-center justify-center transition-all active:scale-90 shadow-2xs cursor-pointer select-none touch-manipulation"
          aria-label="Increase quantity"
         >
          <Plus className="w-5 h-5" />
         </button>
        </div>
       </div>

       <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle flex items-center justify-between text-xs font-black theme-text-app">
        <span>New Total Stock:</span>
        <span className="text-sm font-black theme-text-accent">
         {addStockItem.stock +
          (!isNaN(Number(addStockQty)) && Number(addStockQty) > 0
           ? Math.floor(Number(addStockQty))
           : 0)}{' '}
         {addStockItem.variants && addStockItem.variants.length > 0 ? 'packs' : (addStockItem.unit || 'pcs')}
        </span>
       </div>

       {/* Product Variants selection in Add Stock */}
       {addStockItem.variants && addStockItem.variants.length > 0 && (
        <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-2">
         <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider theme-text-secondary">
          <span>{lang === 'tl' ? 'Piliin ang Sukat / Variant' : 'Select Variant to Restock'}</span>
          <span className="text-[10px] lowercase font-semibold opacity-80">{addStockItem.variants.length} options</span>
         </div>
         <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
           type="button"
           disabled={addStockItem.variants && addStockItem.variants.length > 0}
           onClick={() => setSelectedRestockVariantIdx('ALL')}
           className={`p-2 rounded-xl border text-xs font-bold text-left transition-all ${
            addStockItem.variants && addStockItem.variants.length > 0
             ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 border-dashed border-slate-300 dark:border-slate-700'
             : selectedRestockVariantIdx === 'ALL'
              ? 'border-amber-500 bg-amber-500/15 theme-text-accent shadow-xs cursor-pointer'
              : 'theme-bg-card border-transparent theme-text-secondary hover:theme-text-app cursor-pointer'
           }`}
          >
           <span className="block truncate font-black">{lang === 'tl' ? '📦 Lahat / General' : '📦 All / General'}</span>
           <span className="text-[10px] opacity-75">{addStockItem.stock} pcs total</span>
          </button>
          {addStockItem.variants.map((v, i) => (
           <button
            key={i}
            type="button"
            onClick={() => setSelectedRestockVariantIdx(i)}
            className={`p-2 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
             selectedRestockVariantIdx === i
              ? 'border-amber-500 bg-amber-500/15 theme-text-accent shadow-xs'
              : 'theme-bg-card border-transparent theme-text-secondary hover:theme-text-app'
            }`}
           >
            <div className="flex items-center justify-between gap-1">
             <span className="truncate">{v.label}</span>
             <span className="font-mono shrink-0">{formatPeso(v.unitPrice)}</span>
            </div>
            <span className="text-[10px] opacity-75 block">
             Stock: {v.stock !== undefined ? `${v.stock} pcs` : 'Not set'}
            </span>
           </button>
          ))}
         </div>
        </div>
       )}

       <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border-subtle">
        <button
         type="button"
         role="button"
         tabIndex={0}
         style={{ touchAction: 'manipulation' }}
         onClick={() => {
          console.log('[AddStockModal] Cancel button tapped');
          setAddStockItem(null);
         }}
         onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
           e.preventDefault();
           setAddStockItem(null);
          }
         }}
         className="px-4 py-2.5 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10 cursor-pointer select-none touch-manipulation"
        >
         {translate(lang, 'btn_cancel')}
        </button>
        <button
         type="button"
         role="button"
         tabIndex={0}
         style={{ touchAction: 'manipulation' }}
         disabled={addStockItem.variants && addStockItem.variants.length > 0 && selectedRestockVariantIdx === null}
         onClick={handleConfirmAddStock}
         onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
           e.preventDefault();
           if (!(addStockItem.variants && addStockItem.variants.length > 0 && selectedRestockVariantIdx === null)) {
            handleConfirmAddStock();
           }
          }
         }}
         className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer select-none touch-manipulation ${
          addStockItem.variants && addStockItem.variants.length > 0 && selectedRestockVariantIdx === null
           ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed border border-dashed border-slate-400'
           : 'theme-bg-primary text-white active:scale-95'
         }`}
        >
         <Plus className={`w-4 h-4 ${addStockItem.variants && addStockItem.variants.length > 0 && selectedRestockVariantIdx === null ? 'text-slate-500' : 'text-white/90'}`} />
         <span>
          {addStockItem.variants && addStockItem.variants.length > 0 && selectedRestockVariantIdx === null 
           ? (lang === 'tl' ? 'Pumili ng Variant' : 'Select Variant') 
           : translate(lang, 'btn_ok')}
         </span>
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* 2. ENHANCED MULTI-ITEM SELL NOW MODAL */}
   {sellModalOpen && initialSellProduct && (
    <div
     className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in duration-200"
     onClick={(e) => {
      if (e.target === e.currentTarget) {
       console.log('[SellModal] Backdrop tapped -> closing modal');
       setSellModalOpen(false);
       setCart([]);
       setInitialSellProduct(null);
       setIsAddProductPickerOpen(false);
      }
     }}
    >
     <div
      className="theme-card rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border animate-in my-auto max-h-[85vh] flex flex-col justify-between"
      onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      style={{ touchAction: 'manipulation' }}
     >
      {/* Header: "Sell Product" + product name/multi-item indicator + close (X) button */}
      <div className="flex items-center justify-between pb-2 border-b theme-border-subtle shrink-0">
       <div>
        <h3 className="font-black theme-text-app text-base">
         {translate(lang, 'sell_product_title') || 'Sell Product'}
        </h3>
        <p className="text-xs theme-text-accent font-bold">
         {cart.length <= 1
          ? (cart[0]?.name || initialSellProduct.name)
          : `${cart.length} items in cart`}
        </p>
       </div>
       <button
        type="button"
        role="button"
        tabIndex={0}
        style={{ touchAction: 'manipulation' }}
        onClick={() => {
         console.log('[SellModal] Close button tapped');
         setSellModalOpen(false);
         setCart([]);
         setInitialSellProduct(null);
         setIsAddProductPickerOpen(false);
        }}
        onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSellModalOpen(false);
          setCart([]);
          setInitialSellProduct(null);
          setIsAddProductPickerOpen(false);
         }
        }}
        className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center transition-colors cursor-pointer select-none touch-manipulation active:scale-95"
        aria-label="Close"
       >
        <X className="w-4 h-4" />
       </button>
      </div>

      <div className="space-y-3.5 py-3 overflow-y-auto no-scrollbar pr-1 flex-1">
       {/* Buyer's Cash Input */}
       <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle">
        <div className="flex items-center justify-between gap-2 mb-1.5">
         <label className="text-xs font-black theme-text-app flex items-center gap-1.5">
          <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{lang === 'tl' ? "Pera ng Mamimili (Spot Cash)" : "Buyer's Cash"}</span>
         </label>
         <span className="text-[10px] font-bold theme-text-secondary">
          {lang === 'tl' ? 'Opsyonal para sa Sukli' : 'Optional for Change'}
         </span>
        </div>
        <div className="relative">
         <span className="absolute left-3 top-2.5 font-black text-sm theme-text-secondary">₱</span>
         <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={buyersMoneyInput}
          onChange={(e) => setBuyersMoneyInput(e.target.value)}
          onBlur={(e) => {
           const num = parseFloat(e.target.value);
           if (!isNaN(num) && num >= 0) {
            setBuyersMoneyInput(num.toString());
           } else if (e.target.value.trim() !== '') {
            setBuyersMoneyInput('');
           }
          }}
          placeholder={lang === 'tl' ? 'Hal. 500' : 'e.g. 500'}
          className="w-full theme-input border rounded-xl py-2 pl-7 pr-3 text-sm font-black theme-text-app focus:outline-none"
         />
        </div>
       </div>

       {/* Available Stock info: shown for single item, or multi-item neutral indicator */}
       <div className="flex items-center justify-between text-xs px-1 theme-text-secondary font-bold">
        {cart.length <= 1 ? (
         <>
          <span>
           {translate(lang, 'available_stock', {
            count: cart[0]?.availableStock ?? initialSellProduct.stock,
           })}:
          </span>
          <span
           className={`font-mono ${
            (cart[0]?.availableStock ?? initialSellProduct.stock) <= 0
             ? 'text-red-400'
             : 'theme-text-app'
           }`}
          >
           {cart[0]?.availableStock ?? initialSellProduct.stock} pcs
          </span>
         </>
        ) : (
         <>
          <span>{lang === 'tl' ? 'Mga Piniling Produkto' : 'Selected Products'}:</span>
          <span className="font-mono theme-text-app">{cart.length} {lang === 'tl' ? 'iba-ibang produkto' : 'different items'}</span>
         </>
        )}
       </div>

       {/* Variant selection for the initial product being sold */}
       {initialSellProduct.variants && initialSellProduct.variants.length > 0 && (
        <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-2">
         <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider theme-text-secondary">
          <span>{lang === 'tl' ? 'Pumili ng Sukat / Variant' : 'Select Variant / Portion'}</span>
          <span className="text-[10px] text-amber-400 font-bold">{initialSellProduct.variants.length} options</span>
         </div>
         <div className="grid grid-cols-2 gap-1.5">
          {initialSellProduct.variants.map((v, vIdx) => {
           const vDisplayName = `${initialSellProduct.name} (${v.label})`;
           const isSelected = cart.some(
            (c) => c.productId === initialSellProduct.id && (c.name === vDisplayName || c.variantLabel === v.label)
           );
           const vStock = v.stock !== undefined ? v.stock : initialSellProduct.stock;
           const isVOutOfStock = vStock <= 0;

           return (
            <button
             key={vIdx}
             type="button"
             disabled={isVOutOfStock}
             onClick={() => {
              if (cart.length === 1 && cart[0].productId === initialSellProduct.id) {
               setCart([
                {
                 id: `${initialSellProduct.id}-${Date.now()}`,
                 productId: initialSellProduct.id,
                 name: vDisplayName,
                 unitPrice: v.unitPrice,
                 availableStock: vStock,
                 quantity: 1,
                 variantLabel: v.label,
                 variantIndex: vIdx,
                },
               ]);
              } else {
               handleAddProductToCart(initialSellProduct, v, vIdx);
              }
              setSelectedSellVariantIdx(vIdx);
             }}
             className={`p-2 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer flex flex-col justify-between ${
              isSelected
               ? 'border-amber-500 bg-amber-500/20 theme-text-accent shadow-xs'
               : isVOutOfStock
               ? 'opacity-40 cursor-not-allowed theme-bg-card theme-border-subtle theme-text-secondary'
               : 'theme-bg-card theme-border-subtle theme-text-app hover:border-amber-500/50'
             }`}
            >
             <div className="flex items-center justify-between gap-1">
              <span className="font-black truncate">{v.label}</span>
              <span className="font-mono text-amber-400 shrink-0">{formatPeso(v.unitPrice)}</span>
             </div>
             <span className="text-[10px] opacity-75 mt-0.5">
              {isVOutOfStock ? (lang === 'tl' ? 'Ubos' : 'Out of stock') : `Stock: ${vStock}`}
             </span>
            </button>
           );
          })}
         </div>
        </div>
       )}

       {/* Cart Section */}
       <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
         <span className="text-xs font-black uppercase tracking-wider theme-text-secondary flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5 theme-text-accent" />
          <span>Cart ({cart.length})</span>
         </span>
         <button
          type="button"
          role="button"
          tabIndex={0}
          style={{ touchAction: 'manipulation' }}
          onClick={() => {
           console.log('[SellModal] Toggling product picker drawer');
           setIsAddProductPickerOpen((prev) => !prev);
           setPickerSearchTerm('');
          }}
          onKeyDown={(e) => {
           if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsAddProductPickerOpen((prev) => !prev);
            setPickerSearchTerm('');
           }
          }}
          className="text-xs font-extrabold theme-text-accent hover:underline flex items-center gap-1 cursor-pointer select-none touch-manipulation active:scale-95"
         >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Another Product</span>
         </button>
        </div>

        {/* Add Product to Cart Overlay Modal */}
        {isAddProductPickerOpen && (
         <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => {
           if (e.target === e.currentTarget) {
            setIsAddProductPickerOpen(false);
           }
          }}
         >
          <div className="theme-bg-card rounded-3xl p-5 max-w-md w-full border theme-border-subtle shadow-2xl max-h-[80vh] flex flex-col space-y-3">
           <div className="flex items-center justify-between pb-2 border-b theme-border-subtle shrink-0">
            <h3 className="font-black theme-text-app text-sm flex items-center gap-2">
             <Package className="w-4 h-4 theme-text-accent" />
             <span>
              {lang === 'tl' ? 'Pumili ng Karagdagang Produkto' : 'Select Product to Add'}
             </span>
            </h3>
            <button
             type="button"
             role="button"
             tabIndex={0}
             style={{ touchAction: 'manipulation' }}
             onClick={() => setIsAddProductPickerOpen(false)}
             onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
               e.preventDefault();
               setIsAddProductPickerOpen(false);
              }
             }}
             className="p-1 rounded-full theme-text-secondary hover:theme-text-app cursor-pointer"
            >
             <X className="w-4 h-4" />
            </button>
           </div>

           <div className="relative shrink-0">
            <Search className="w-4 h-4 theme-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
             type="text"
             value={pickerSearchTerm}
             onChange={(e) => setPickerSearchTerm(e.target.value)}
             placeholder={translate(lang, 'search_placeholder') || 'Search product...'}
             className="w-full theme-input border rounded-xl py-2 pl-9 pr-3 text-xs theme-text-app focus:outline-none"
             autoFocus
            />
           </div>

           <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1 min-h-[160px] max-h-[50vh]">
            {(() => {
             const query = pickerSearchTerm.trim().toLowerCase();
             const matchingItems = inventory.filter((item) => {
              if (!query) return true;
              if (item.name.toLowerCase().includes(query)) return true;
              if (item.category.toLowerCase().includes(query)) return true;
              if (item.variants?.some((v) => v.label.toLowerCase().includes(query))) return true;
              return false;
             });

             if (matchingItems.length === 0) {
              return (
               <div className="text-xs theme-text-secondary text-center py-6 font-bold">
                {lang === 'tl' ? 'Walang nahanap na produkto' : 'No available products found'}
               </div>
              );
             }

             return matchingItems.map((prod) => {
              const hasVariants = prod.variants && prod.variants.length > 0;
              const isOutOfStock = prod.stock <= 0;

              if (hasVariants) {
               return (
                <div
                 key={prod.id}
                 className="p-3 rounded-2xl border theme-border-subtle theme-bg-surface-subtle space-y-2"
                >
                 <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                   <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-xs theme-text-app truncate">{prod.name}</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                     {prod.variants!.length} options
                    </span>
                   </div>
                   <span className="text-[11px] theme-text-secondary font-medium">
                    Stock: {prod.stock} {prod.variants && prod.variants.length > 0 ? (prod.stock === 1 ? 'pack' : 'packs') : (prod.unit || 'pcs')}
                   </span>
                  </div>
                  {isOutOfStock && (
                   <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                    Out of Stock
                   </span>
                  )}
                 </div>

                 {/* List each variant / pack option for direct selection */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {prod.variants!.map((v, idx) => {
                   const vStock = v.stock !== undefined ? v.stock : prod.stock;
                   const isVOutOfStock = vStock <= 0;

                   return (
                    <button
                     key={idx}
                     type="button"
                     role="button"
                     tabIndex={isVOutOfStock ? -1 : 0}
                     style={{ touchAction: 'manipulation' }}
                     disabled={isVOutOfStock}
                     onClick={() => !isVOutOfStock && handleAddProductToCart(prod, v, idx)}
                     onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isVOutOfStock) {
                       e.preventDefault();
                       handleAddProductToCart(prod, v, idx);
                      }
                     }}
                     className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all text-left select-none touch-manipulation active:scale-95 ${
                      isVOutOfStock
                       ? 'opacity-40 cursor-not-allowed theme-bg-card theme-border-subtle'
                       : 'theme-bg-card hover:border-amber-500 theme-border-subtle theme-text-app hover:bg-amber-500/5 cursor-pointer'
                     }`}
                    >
                     <div className="min-w-0 pr-1 truncate">
                      <span className="block font-bold text-xs truncate">{v.label}</span>
                      <div className="flex items-center gap-1.5">
                       <span className="text-[10px] font-black text-amber-400">
                        {formatPeso(v.unitPrice)}
                       </span>
                       {v.stock !== undefined && (
                        <span className="text-[9px] opacity-75">({v.stock} left)</span>
                       )}
                      </div>
                     </div>
                     <Plus className="w-3.5 h-3.5 theme-text-accent shrink-0" />
                    </button>
                   );
                  })}
                 </div>
                </div>
               );
              }

              return (
               <button
                key={prod.id}
                type="button"
                role="button"
                tabIndex={prod.stock <= 0 ? -1 : 0}
                style={{ touchAction: 'manipulation' }}
                onClick={() => prod.stock > 0 && handleAddProductToCart(prod)}
                onKeyDown={(e) => {
                 if ((e.key === 'Enter' || e.key === ' ') && prod.stock > 0) {
                  e.preventDefault();
                  handleAddProductToCart(prod);
                 }
                }}
                disabled={prod.stock <= 0}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all text-left select-none touch-manipulation ${
                 prod.stock <= 0
                  ? 'opacity-40 cursor-not-allowed theme-bg-surface-subtle theme-border-subtle'
                  : 'theme-bg-surface-subtle hover:border-amber-500 theme-border-subtle theme-text-app cursor-pointer active:scale-98'
                }`}
               >
                <div className="min-w-0 pr-2">
                 <span className="truncate block font-black text-xs">{prod.name}</span>
                 <span className="text-[11px] theme-text-secondary font-medium">
                  Stock: {prod.stock} {prod.unit || 'pcs'} • {formatPeso(prod.unitPrice)}
                 </span>
                </div>
                <Plus className="w-4 h-4 theme-text-accent shrink-0" />
               </button>
              );
             });
            })()}
           </div>
          </div>
         </div>
        )}

        {/* Running Cart Items List or Empty State */}
        <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar pr-1">
         {cart.length === 0 ? (
          <div className="theme-bg-surface-subtle p-4 rounded-2xl border theme-border-subtle text-center space-y-1">
           <p className="text-xs font-bold theme-text-secondary">
            {lang === 'tl' ? 'Walang laman ang cart' : 'Cart is empty'}
           </p>
           <p className="text-[11px] theme-text-secondary/70">
            {lang === 'tl'
             ? 'Pindutin ang + Add Another Product para magpatuloy.'
             : 'Tap + Add Another Product to continue.'}
           </p>
          </div>
         ) : (
          cart.map((cartItem) => {
           const totalProductQtyInCart =
            aggregateQtyByProduct[cartItem.productId] || cartItem.quantity;
           const isExceeding = totalProductQtyInCart > cartItem.availableStock;

           return (
            <div
             key={cartItem.id}
             className={`theme-bg-surface-subtle p-3 rounded-2xl border transition-all space-y-2 ${
              isExceeding ? 'border-red-500/50 bg-red-500/10' : 'theme-border-subtle'
             }`}
            >
             <div className="flex items-start justify-between gap-2">
              <div>
               <h4 className="text-xs font-black theme-text-app">{cartItem.name}</h4>
               <span className="text-[11px] font-medium theme-text-secondary">
                {formatPeso(cartItem.unitPrice)} each
               </span>
              </div>

              <button
               type="button"
               role="button"
               tabIndex={0}
               style={{ touchAction: 'manipulation' }}
               onClick={() => handleRemoveCartItem(cartItem.id)}
               onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                 e.preventDefault();
                 handleRemoveCartItem(cartItem.id);
                }
               }}
               className="p-1 rounded-lg theme-text-secondary hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer select-none touch-manipulation active:scale-90"
               title="Remove item"
               aria-label={`Remove ${cartItem.name} from cart`}
              >
               <X className="w-3.5 h-3.5" />
              </button>
             </div>

             <div className="flex items-center justify-between pt-1 border-t theme-border-subtle">
              {/* Stepper (– / number / +) */}
              <div className="flex items-center gap-1.5">
               <button
                type="button"
                role="button"
                tabIndex={cartItem.quantity <= 1 ? -1 : 0}
                style={{ touchAction: 'manipulation' }}
                onClick={() => handleUpdateCartItemQty(cartItem.id, cartItem.quantity - 1)}
                onKeyDown={(e) => {
                 if ((e.key === 'Enter' || e.key === ' ') && cartItem.quantity > 1) {
                  e.preventDefault();
                  handleUpdateCartItemQty(cartItem.id, cartItem.quantity - 1);
                 }
                }}
                disabled={cartItem.quantity <= 1}
                className="w-7 h-7 rounded-lg theme-bg-card hover:bg-white/10 theme-text-app font-bold text-xs flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer select-none touch-manipulation active:scale-90"
                aria-label="Decrease item quantity"
               >
                <Minus className="w-3 h-3" />
               </button>

               <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                max={cartItem.availableStock}
                value={cartItem.quantity}
                onChange={(e) => {
                 const val = parseInt(e.target.value, 10);
                 if (!isNaN(val)) {
                  handleUpdateCartItemQty(cartItem.id, val);
                 }
                }}
                onBlur={(e) => {
                 const val = parseInt(e.target.value, 10);
                 if (isNaN(val) || val < 1) {
                  handleUpdateCartItemQty(cartItem.id, 1);
                 } else if (val > cartItem.availableStock) {
                  handleUpdateCartItemQty(cartItem.id, cartItem.availableStock);
                 }
                }}
                className="w-12 h-7 text-center font-black text-xs theme-input border rounded-lg theme-text-app focus:outline-none"
               />

               <button
                type="button"
                role="button"
                tabIndex={cartItem.quantity >= cartItem.availableStock ? -1 : 0}
                style={{ touchAction: 'manipulation' }}
                onClick={() => handleUpdateCartItemQty(cartItem.id, cartItem.quantity + 1)}
                onKeyDown={(e) => {
                 if ((e.key === 'Enter' || e.key === ' ') && cartItem.quantity < cartItem.availableStock) {
                  e.preventDefault();
                  handleUpdateCartItemQty(cartItem.id, cartItem.quantity + 1);
                 }
                }}
                disabled={cartItem.quantity >= cartItem.availableStock}
                className="w-7 h-7 rounded-lg theme-bg-primary text-white font-bold text-xs flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer select-none touch-manipulation active:scale-90"
                aria-label="Increase item quantity"
               >
                <Plus className="w-3 h-3" />
               </button>
              </div>

              {/* Item Subtotal */}
              <div className="text-right">
               <span className="text-[10px] theme-text-secondary block">Subtotal</span>
               <span className="text-xs font-black theme-text-accent font-mono">
                {formatPeso(cartItem.quantity * cartItem.unitPrice)}
               </span>
              </div>
             </div>

             {/* Inline Stock Warning */}
             {isExceeding && (
              <div className="flex items-center gap-1 text-[11px] font-bold text-red-400 pt-1">
               <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
               <span>
                {lang === 'tl'
                 ? `Sobra sa stock! ${cartItem.availableStock} pcs lang ang meron.`
                 : `Exceeds stock! Only ${cartItem.availableStock} pcs available.`}
               </span>
              </div>
             )}
            </div>
           );
          })
         )}
        </div>
       </div>

       {/* Summary Section */}
       <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle space-y-2">
        <div className="flex items-center justify-between">
         <span className="text-xs font-black theme-text-app">
          {translate(lang, 'total_price_label') || 'Total Amount'}:
         </span>
         <span className="text-base font-black theme-text-accent font-mono">
          {formatPeso(totalSaleAmount)}
         </span>
        </div>

        {isBudgetEntered && (
         <div className="pt-2 border-t theme-border-subtle space-y-1 text-xs font-bold">
          <div className="flex items-center justify-between theme-text-secondary">
           <span>{lang === 'tl' ? 'Pera ng Mamimili' : "Buyer's Money"}:</span>
           <span className="font-mono theme-text-app">{formatPeso(parsedBuyersMoney)}</span>
          </div>

          {budgetDifference >= 0 ? (
           <div className="flex items-center justify-between text-xs font-black theme-text-accent">
            <span>{lang === 'tl' ? 'Sukli (Change)' : 'Change'}:</span>
            <span className="text-sm font-black font-mono">
             {formatPeso(budgetDifference)}
            </span>
           </div>
          ) : (
           <div className="flex items-center justify-between text-xs font-black text-amber-400">
            <span>{lang === 'tl' ? 'Kulang pa ng' : 'Need more'}:</span>
            <span className="text-sm font-black font-mono">
             {formatPeso(Math.abs(budgetDifference))}
            </span>
           </div>
          )}
         </div>
        )}
       </div>

      </div>

      {/* Action Buttons: [Cancel] [Sell] */}
      <div className="flex items-center gap-2 pt-3 border-t theme-border-subtle shrink-0">
       {/* 1. Cancel */}
       <button
        type="button"
        role="button"
        tabIndex={0}
        style={{ touchAction: 'manipulation' }}
        onClick={() => {
         console.log('[SellModal] Cancel button tapped');
         setSellModalOpen(false);
         setCart([]);
         setInitialSellProduct(null);
         setIsAddProductPickerOpen(false);
        }}
        onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSellModalOpen(false);
          setCart([]);
          setInitialSellProduct(null);
          setIsAddProductPickerOpen(false);
         }
        }}
        className="w-1/3 py-2.5 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10 cursor-pointer select-none touch-manipulation text-center border theme-border-subtle"
       >
        {translate(lang, 'btn_cancel') || 'Cancel'}
       </button>

       <div className="flex-1 flex gap-2">
        {/* 2. Credit Button */}
        <button
         type="button"
         onClick={() => setIsCreditCustomerModalOpen(true)}
         disabled={isCartEmpty || hasExceededStock || hasInsufficientBudget}
         className={`flex-1 py-2.5 rounded-xl font-black text-xs shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5 select-none touch-manipulation ${
          isCartEmpty || hasExceededStock || hasInsufficientBudget
           ? 'opacity-40 cursor-not-allowed bg-amber-500/20 text-amber-500'
           : 'bg-amber-500 text-white hover:bg-amber-600'
         }`}
        >
         <CreditCard className="w-3.5 h-3.5 shrink-0" />
         <span>{lang === 'tl' ? 'Pautang' : 'Credit'}</span>
        </button>

        {/* 3. Sell / Complete Sale */}
        <button
         type="button"
         role="button"
         tabIndex={isCartEmpty || hasExceededStock || hasInsufficientBudget ? -1 : 0}
         style={{ touchAction: 'manipulation' }}
         onClick={handleConfirmSellNow}
         onKeyDown={(e) => {
          if (
           (e.key === 'Enter' || e.key === ' ') &&
           !isCartEmpty &&
           !hasExceededStock &&
           !hasInsufficientBudget
          ) {
           e.preventDefault();
           handleConfirmSellNow();
          }
         }}
         disabled={isCartEmpty || hasExceededStock || hasInsufficientBudget}
         className={`flex-1 theme-bg-primary text-white py-2.5 rounded-xl font-black text-xs shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5 select-none touch-manipulation ${
          isCartEmpty || hasExceededStock || hasInsufficientBudget
           ? 'opacity-40 cursor-not-allowed'
           : 'cursor-pointer'
         }`}
        >
         <ShoppingBag className="w-3.5 h-3.5 text-white/90 shrink-0" />
         <span className="truncate">
          {lang === 'tl'
           ? `Benta (${formatPeso(totalSaleAmount)})`
           : `Sell (${formatPeso(totalSaleAmount)})`}
         </span>
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* 3.5 CUSTOMER DETAILS CREDIT POPUP MODAL */}
   {isCreditCustomerModalOpen && (
    <div
     className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
     onClick={() => setIsCreditCustomerModalOpen(false)}
    >
     <div
      className="theme-bg-card border theme-border-app rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in duration-150"
      onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
     >
      {/* Header */}
      <div className="flex items-center justify-between border-b theme-border-subtle pb-3">
       <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
         <h3 className="font-black theme-text-app text-base">
          {lang === 'tl' ? 'Detalye ng Pautang' : 'Credit Purchase Details'}
         </h3>
         <p className="text-[10px] theme-text-secondary font-bold">
          {lang === 'tl' ? 'Kabuuang Halaga:' : 'Total Amount:'}{' '}
          <span className="theme-text-accent font-extrabold">{formatPeso(totalSaleAmount)}</span>
         </p>
        </div>
       </div>
       <button
        type="button"
        onClick={() => setIsCreditCustomerModalOpen(false)}
        className="p-1 hover:bg-white/10 rounded-full theme-text-secondary hover:theme-text-app cursor-pointer"
       >
        <X className="w-5 h-5" />
       </button>
      </div>

      {/* Error Banner if user taps Confirm Credit without customer name */}
      {creditErrorBanner && (
       <div className="bg-amber-500/15 border border-amber-500/40 text-amber-500 dark:text-amber-400 p-2.5 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
        <span className="flex items-center gap-1.5">
         <AlertTriangle className="w-4 h-4 shrink-0" />
         <span>{creditErrorBanner}</span>
        </span>
        <button
         type="button"
         onClick={() => setCreditErrorBanner(null)}
         className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
        >
         <X className="w-3.5 h-3.5" />
        </button>
       </div>
      )}

      {/* Inputs Section */}
      <div className="space-y-3">
       {/* Customer Name input with Pen icon */}
       <div>
        <label className="block text-xs font-extrabold theme-text-app mb-1.5 flex items-center gap-1">
         <Pencil className="w-3.5 h-3.5 text-amber-500" />
         <span>{lang === 'tl' ? 'Pangalan ng Suki' : 'Customer Name'} *</span>
        </label>
        <div className="relative">
         <User className="w-4 h-4 theme-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
         <input
          type="text"
          value={creditCustomerName}
          onChange={(e) => {
           setCreditCustomerName(e.target.value);
           if (creditErrorBanner) setCreditErrorBanner(null);
          }}
          placeholder={lang === 'tl' ? 'e.g. Aling Nena, Pareng Juan' : 'e.g. Maria, John'}
          className="w-full theme-input border rounded-2xl py-2.5 pl-9 pr-3 text-xs font-extrabold theme-text-app focus:outline-none focus:border-amber-500"
          autoFocus
         />
        </div>
       </div>

       {/* Phone number input (Optional, Max 11 Digits) */}
       <div>
        <label className="block text-[11px] font-bold theme-text-secondary mb-1">
         {lang === 'tl' ? 'Numero ng Telepono (Opsiyonal - Max 11)' : 'Phone Number (Optional - Max 11)'}
        </label>
        <input
         type="text"
         inputMode="numeric"
         maxLength={11}
         value={creditCustomerPhone}
         onChange={(e) => {
          // Enforce digits only and strict maximum 11 characters
          const cleaned = e.target.value.replace(/\D/g, '').slice(0, 11);
          setCreditCustomerPhone(cleaned);
         }}
         placeholder="09171234567"
         className="w-full theme-input border rounded-2xl py-2 px-3 text-xs font-mono theme-text-app focus:outline-none focus:border-amber-500"
        />
       </div>

       {/* Quick Suki Suggestions */}
       {existingCustomersList.length > 0 && (
        <div className="pt-1 space-y-1">
         <span className="text-[10px] font-extrabold uppercase tracking-wider theme-text-secondary block">
          {lang === 'tl' ? 'Pumili sa umiiral na suki:' : 'Select existing customer:'}
         </span>
         <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar pr-1">
          {existingCustomersList.map((cust) => (
           <button
            key={cust.id || cust.name}
            type="button"
            onClick={() => {
             setCreditCustomerName(cust.name);
             if (cust.phone) setCreditCustomerPhone(cust.phone.replace(/\D/g, '').slice(0, 11));
             if (creditErrorBanner) setCreditErrorBanner(null);
            }}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
             creditCustomerName.trim().toLowerCase() === cust.name.toLowerCase()
              ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
              : 'theme-bg-surface-subtle theme-border-subtle theme-text-app hover:bg-white/10'
            }`}
           >
            {cust.name}
           </button>
          ))}
         </div>
        </div>
       )}
      </div>

      {/* Action Buttons inside Popup Modal */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border-subtle">
       <button
        type="button"
        onClick={() => setIsCreditCustomerModalOpen(false)}
        className="px-4 py-2.5 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10 cursor-pointer"
       >
        {translate(lang, 'btn_cancel') || 'Cancel'}
       </button>

       <button
        type="button"
        onClick={handleConfirmCreditNow}
        className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 ${
         !creditCustomerName.trim()
          ? 'bg-stone-500/20 text-stone-400 dark:text-stone-300 border border-stone-500/30 opacity-80 hover:bg-stone-500/30'
          : 'bg-amber-500 hover:bg-amber-600 text-white'
        }`}
        title={
         !creditCustomerName.trim()
          ? lang === 'tl'
           ? 'Pindutin para makita ang paalala'
           : 'Tap to see requirement'
          : lang === 'tl'
          ? 'Kumpirmahin ang Pautang'
          : 'Confirm Credit'
        }
       >
        <Check className="w-4 h-4" />
        <span>{lang === 'tl' ? 'Kumpirmahin ang Pautang' : 'Confirm Credit'}</span>
       </button>
      </div>
     </div>
    </div>
   )}

   {/* 4. SALE / CREDIT RECEIPT MODAL */}
   {activeReceipt && (
    <FormalReceipt
      transaction={activeReceipt}
      lang={lang}
      onClose={() => setActiveReceipt(null)}
    />
   )}

   {/* 3. ADD / EDIT PRODUCT MODAL */}
   <ProductModal
     isOpen={isModalOpen}
     onClose={() => setIsModalOpen(false)}
     editingItem={editingItem}
      onOpenScanner={() => setIsScannerOpen(true)}
     lang={lang}
     name={name}
     setName={setName}
     sku={sku}
     setSku={setSku}
     category={category}
     setCategory={setCategory}
     stock={stock}
     setStock={setStock}
     unitCost={unitCost}
     setUnitCost={setUnitCost}
     unitPrice={unitPrice}
     setUnitPrice={setUnitPrice}
     minStockAlert={minStockAlert}
     setMinStockAlert={setMinStockAlert}
     unit={unit}
     setUnit={setUnit}
     quickIcon={quickIcon}
     setQuickIcon={setQuickIcon}
     variants={variants}
     setVariants={setVariants}
     photo={photo}
     setPhoto={setPhoto}
     newVariantLabel={newVariantLabel}
     setNewVariantLabel={setNewVariantLabel}
     newVariantPrice={newVariantPrice}
     setNewVariantPrice={setNewVariantPrice}
     newVariantStock={newVariantStock}
     setNewVariantStock={setNewVariantStock}
     isCompressingPhoto={isCompressingPhoto}
     handlePhotoFileChange={handlePhotoFileChange}
     handleSaveProduct={handleSaveProduct}
     handleAddVariantItem={handleAddVariantItem}
     handleRemoveVariantItem={handleRemoveVariantItem}
     calculateWeightVariants={calculateWeightVariants}
     showAlert={showAlert}
      productType={itemType}
      setProductType={setItemType}
      TINGI_PRESETS={TINGI_PRESETS}
     ITEM_ICON_OPTIONS={ITEM_ICON_OPTIONS}
     PRODUCT_CATEGORIES={PRODUCT_CATEGORIES}
   />

   {/* Global Alert Modal */}
   <AlertModal
    isOpen={alertState.isOpen}
    title={alertState.title}
    message={alertState.message}
    type={alertState.type}
    onClose={closeAlert}
   />

   {/* Global Confirm Modal */}
   <ConfirmModal
    isOpen={confirmState.isOpen}
    title={confirmState.title}
    message={confirmState.message}
    confirmText={confirmState.confirmText}
    cancelText={confirmState.cancelText}
    isDestructive={confirmState.isDestructive}
    onConfirm={confirmState.onConfirm}
    onCancel={closeConfirm}
   />
   </div>
  );
};
