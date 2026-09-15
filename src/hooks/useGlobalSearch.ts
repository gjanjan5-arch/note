import { useState, useEffect, useMemo, useRef } from 'react';
import type { InventoryItem, Customer, Transaction, CatalogPayload } from '../types';
import type {
  GlobalSearchResultItem,
  SearchCategory,
  GlobalSearchCounts,
  ProductSearchResult,
  UtangSearchResult,
  ReceiptSearchResult,
  CustomerSearchResult,
  SavedStoreSearchResult,
} from '../types/search';
import { formatPeso } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';

interface UseGlobalSearchOptions {
  query: string;
  category: SearchCategory;
  inventory: InventoryItem[];
  customers: Customer[];
  transactions: Transaction[];
  savedStores?: CatalogPayload[];
  appMode?: 'seller' | 'buyer';
  lang: LanguageCode;
  debounceMs?: number;
  maxResultsPerCategory?: number;
}

// Zero-dependency native multi-term search algorithm

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => {
    if (acc == null) return acc;
    if (Array.isArray(acc)) {
      return acc.map(item => item?.[part]).filter(Boolean);
    }
    return acc[part];
  }, obj);
}

function scoreItem(item: any, searchFields: string[], queryTerms: string[]): number {
  if (!queryTerms.length) return 1;

  let itemScore = 0;
  const fieldValues = searchFields.map(field => {
    const value = getNestedValue(item, field);
    if (Array.isArray(value)) {
      return value.map(v => String(v || '').toLowerCase()).join(' ');
    }
    return String(value || '').toLowerCase();
  });

  for (const term of queryTerms) {
    let termMatched = false;
    let termBestScore = 0;

    for (const val of fieldValues) {
      if (!val) continue;

      if (val === term) {
        termBestScore = Math.max(termBestScore, 100);
        termMatched = true;
      } else if (val.startsWith(term) || val.includes(` ${term}`)) {
        termBestScore = Math.max(termBestScore, 50);
        termMatched = true;
      } else if (val.includes(term)) {
        termBestScore = Math.max(termBestScore, 10);
        termMatched = true;
      }
    }

    if (!termMatched) {
      return 0; // Fail if any term is not found
    }
    itemScore += termBestScore;
  }

  return itemScore;
}

function nativeSearch<T>(
  items: T[],
  query: string,
  keys: string[],
  limit: number
): T[] {
  if (!query.trim()) return items.slice(0, limit);

  const queryTerms = query.trim().toLowerCase().split(/\s+/);
  const scoredItems = items
    .map(item => ({
      item,
      score: scoreItem(item, keys, queryTerms),
    }))
    .filter(x => x.score > 0);

  scoredItems.sort((a, b) => b.score - a.score);
  return scoredItems.slice(0, limit).map(x => x.item);
}

export function useGlobalSearch({
  query,
  category,
  inventory,
  customers,
  transactions,
  savedStores = [],
  appMode = 'seller',
  lang,
  debounceMs = 200,
  maxResultsPerCategory = 25,
}: UseGlobalSearchOptions) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  const isSearching = query.trim().length > 0 && query.trim() !== debouncedQuery.trim();

  const results = useMemo(() => {
    const q = debouncedQuery.trim();

    let matchedProducts: ProductSearchResult[] = [];
    let matchedUtang: UtangSearchResult[] = [];
    let matchedReceipts: ReceiptSearchResult[] = [];
    let matchedCustomers: CustomerSearchResult[] = [];
    let matchedSavedStores: SavedStoreSearchResult[] = [];

    // Helper to format Product
    const formatProduct = (item: InventoryItem, idx: number): ProductSearchResult => ({
      id: `prod-${item.id || idx}`,
      type: 'PRODUCT',
      title: item.name,
      subtitle: `${item.category || translate(lang, 'general') || 'General'} • ${formatPeso(item.unitPrice || 0)}`,
      badgeText: `${item.stock ?? 0} ${item.variants && item.variants.length > 0 ? ((item.stock ?? 0) === 1 ? 'pack' : 'packs') : (item.unit || translate(lang, 'unit_pcs') || 'pcs')}`,
      badgeVariant: (item.stock ?? 0) <= (item.minStockAlert || 5) ? 'warning' : 'neutral',
      meta: item.sku ? `SKU: ${item.sku}` : undefined,
      item,
    });

    // Helper to format Utang/Customer
    const formatCustomer = (cust: Customer, idx: number, type: 'UTANG' | 'CUSTOMER'): UtangSearchResult | CustomerSearchResult => ({
      id: `${type.toLowerCase()}-${cust.id || idx}`,
      type: type as any,
      title: cust.name,
      subtitle: cust.phone || translate(lang, 'no_phone') || 'No contact',
      badgeText: cust.currentBalance > 0 ? `${formatPeso(cust.currentBalance)}` : (translate(lang, 'no_balance') || 'Walang utang'),
      badgeVariant: cust.currentBalance > 0 ? 'warning' : 'neutral',
      meta: type === 'UTANG' ? (cust.currentBalance > 0 ? (translate(lang, 'has_unpaid_debt') || 'May utang') : (translate(lang, 'no_balance') || 'Walang utang')) : undefined,
      customer: cust,
    });

    // Helper to calculate relative time (e.g., 5m ago, 2h ago, 1d ago)
    const getRelativeTime = (timestamp: number) => {
      const diffMs = Date.now() - timestamp;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) return `${diffDays}d ago`;
      if (diffHours > 0) return `${diffHours}h ago`;
      if (diffMins > 0) return `${diffMins}m ago`;
      return `${diffSecs}s ago`;
    };

    // Helper to format Receipt
    const formatReceipt = (tx: Transaction, idx: number): ReceiptSearchResult => {
      const amount = tx.totalAmount || 0;
      // Pad ID with leading zeros (e.g., 000001)
      const displayId = tx.id != null ? String(tx.id).padStart(6, '0') : String(idx).padStart(6, '0');
      return {
        id: `tx-${tx.id || idx}`,
        type: 'RECEIPT',
        title: tx.customerName ? `${tx.customerName} - ${formatPeso(amount)}` : `${translate(lang, 'receipt_num') || 'Resibo'} #${displayId} - ${formatPeso(amount)}`,
        subtitle: getRelativeTime(tx.timestamp),
        badgeText: tx.type,
        badgeVariant: tx.type === 'PAUTANG_RECORD' ? 'warning' : 'neutral',
        meta: `#${displayId} • ${tx.items?.length || 0} paninda`,
        transaction: tx,
      };
    };

    // Helper to format Saved Store
    const formatStore = (store: CatalogPayload, idx: number, qMatch: string): SavedStoreSearchResult => {
      const matchedItemNames = qMatch ? (store.items || [])
        .filter((it) => it.name.toLowerCase().includes(qMatch))
        .map((it) => it.name)
        .slice(0, 2)
        .join(', ') : '';

      return {
        id: `store-${store.storeName}-${idx}`,
        type: 'SAVED_STORE',
        title: store.storeName,
        subtitle: matchedItemNames ? `May: ${matchedItemNames}` : (store.ownerName || 'Suki Store'),
        badgeText: `${store.items?.length || 0} items`,
        badgeVariant: 'primary',
        meta: store.contactNumber || store.storeAddress || undefined,
        store: store,
      };
    };

    if (appMode === 'seller') {
      // PRODUCTS
      if (category === 'ALL' || category === 'PRODUCTS') {
        matchedProducts = nativeSearch(
          inventory,
          q,
          ['name', 'sku', 'category'],
          maxResultsPerCategory
        ).map((item, i) => formatProduct(item, i));
      }

      // UTANG & CUSTOMERS
      const formatAndFilterCustomers = (type: 'UTANG' | 'CUSTOMER') => {
        return nativeSearch(
          customers,
          q,
          ['name', 'phone'],
          maxResultsPerCategory
        ).map((c, i) => formatCustomer(c, i, type));
      };

      if (category === 'ALL' || category === 'UTANG') {
        matchedUtang = formatAndFilterCustomers('UTANG') as UtangSearchResult[];
      }
      if (category === 'ALL' || category === 'CUSTOMERS') {
        matchedCustomers = formatAndFilterCustomers('CUSTOMER') as CustomerSearchResult[];
      }

      // RECEIPTS
      if (category === 'ALL' || category === 'RECEIPTS') {
        matchedReceipts = nativeSearch(
          transactions,
          q,
          ['id', 'customerName', 'type', 'items.itemName'],
          maxResultsPerCategory
        ).map((tx, i) => formatReceipt(tx, i));
      }
    }

    if (appMode === 'buyer') {
      const qLower = q.toLowerCase();
      matchedSavedStores = nativeSearch(
        savedStores,
        q,
        ['storeName', 'ownerName', 'contactNumber', 'storeAddress', 'items.name'],
        maxResultsPerCategory
      ).map((s, i) => formatStore(s, i, qLower));
    }

    const counts: GlobalSearchCounts = {
      all: matchedProducts.length + matchedUtang.length + matchedReceipts.length + matchedCustomers.length + matchedSavedStores.length,
      products: matchedProducts.length,
      utang: matchedUtang.length,
      receipts: matchedReceipts.length,
      customers: matchedCustomers.length,
      savedStores: matchedSavedStores.length,
    };

    let flatResults: GlobalSearchResultItem[] = [];
    if (category === 'ALL') {
      flatResults = [
        ...matchedProducts,
        ...matchedUtang,
        ...matchedReceipts,
        ...matchedCustomers,
        ...matchedSavedStores,
      ];
    } else if (category === 'PRODUCTS') {
      flatResults = matchedProducts;
    } else if (category === 'UTANG') {
      flatResults = matchedUtang;
    } else if (category === 'RECEIPTS') {
      flatResults = matchedReceipts;
    } else if (category === 'CUSTOMERS') {
      flatResults = matchedCustomers;
    } else if (category === 'SAVED_STORES') {
      flatResults = matchedSavedStores;
    }

    return {
      products: matchedProducts,
      utang: matchedUtang,
      receipts: matchedReceipts,
      customers: matchedCustomers,
      savedStores: matchedSavedStores,
      flatResults,
      counts,
      isSearching,
    };
  }, [debouncedQuery, isSearching, category, inventory, customers, transactions, savedStores, appMode, lang, maxResultsPerCategory]);

  return results;
}
