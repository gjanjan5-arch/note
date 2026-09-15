import type { InventoryItem, Customer, Transaction, CatalogPayload } from '../types';

export type SearchCategory = 'ALL' | 'PRODUCTS' | 'UTANG' | 'RECEIPTS' | 'CUSTOMERS' | 'SAVED_STORES';

export type SearchResultType = 'PRODUCT' | 'UTANG' | 'RECEIPT' | 'CUSTOMER' | 'SAVED_STORE';

export interface BaseSearchResult {
  id: string; // Unique search result id e.g. "prod-1", "cust-2", "tx-3"
  type: SearchResultType;
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeVariant?: 'primary' | 'warning' | 'success' | 'neutral';
  meta?: string;
}

export interface ProductSearchResult extends BaseSearchResult {
  type: 'PRODUCT';
  item: InventoryItem;
}

export interface UtangSearchResult extends BaseSearchResult {
  type: 'UTANG';
  customer: Customer;
}

export interface ReceiptSearchResult extends BaseSearchResult {
  type: 'RECEIPT';
  transaction: Transaction;
}

export interface CustomerSearchResult extends BaseSearchResult {
  type: 'CUSTOMER';
  customer: Customer;
}

export interface SavedStoreSearchResult extends BaseSearchResult {
  type: 'SAVED_STORE';
  store: CatalogPayload;
}

export type GlobalSearchResultItem =
  | ProductSearchResult
  | UtangSearchResult
  | ReceiptSearchResult
  | CustomerSearchResult
  | SavedStoreSearchResult;

export interface GlobalSearchCounts {
  all: number;
  products: number;
  utang: number;
  receipts: number;
  customers: number;
  savedStores: number;
}

