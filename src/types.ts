export type TransactionType = 'SALE' | 'PAUTANG_RECORD' | 'PAUTANG_PAYMENT' | 'RESTOCK';

export interface TransactionItem {
  itemName: string;
  quantity: number;
  totalPrice: number;
  unitPrice?: number;
}

export interface Transaction {
  id?: number;
  timestamp: number;
  dateStr: string; // YYYY-MM-DD
  type: TransactionType;
  customerName?: string | null;
  handledBy?: string; // Optional: who paid or who took the credit if not the main customer
  items: TransactionItem[];
  totalAmount: number;
  rawNote: string;
  notes?: string;
  syncStatus: 'LOCAL' | 'SYNCED';
}

export interface Note {
  id?: number;
  text: string;
  createdAt: number;
  updatedAt: number;
  autoDelete: boolean;
  expiresAt?: number | null;
}

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  currentBalance: number; // Positive = owes money to store
  lastTransactionAt: number;
  notes?: string;
  nickname?: string;
  creditLimit?: number;
}

export type ProductItemType = 'STANDARD' | 'PACK_VARIETY';

export interface InventoryVariant {
  id?: string;
  label: string;
  unitPrice: number;
  unitCost?: number;
  stock?: number;
  barcode?: string;
}

export interface InventoryItem {
  id?: number;
  name: string;
  category: string;
  stock: number;
  unitCost: number;
  unitPrice: number;
  minStockAlert: number;
  updatedAt: number;
  itemType?: ProductItemType;
  quickIcon?: string;
  tileColor?: string;
  sku?: string;
  photo?: string;
  variants?: InventoryVariant[];
  description?: string;
  quantity?: number;
  unit?: string;
  [key: string]: any;
}

export interface ParsedNoteResult {
  transaction_type: TransactionType;
  customer_name: string | null;
  items: Array<{
    item_name: string;
    quantity: number;
    total_price: number;
  }>;
  total_amount: number;
  raw_note: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  modelUsed?: string;
}

export type ImageSizeOption = '1K' | '2K' | '4K';

export interface CatalogItem {
  id?: string;
  name: string;
  price: number;
  stock: number;
  sku?: string;
  category?: string;
  unitPrice?: number;
  icon?: string;
  unit?: string;
  variants?: Array<{ label: string; price: number }>;
}

export interface CatalogPayload {
  v: number;
  type: 'STORE_CATALOG';
  storeName: string;
  ownerName?: string;
  contactNumber?: string;
  storeAddress?: string;
  gcashNumber?: string;
  purchaseMessage?: string;
  offlineText?: string;
  // New fields for enhanced QR broadcast
  g?: string; // GCash
  p?: string; // Phone
  loc?: string; // Location
  m?: string; // Greeting
  ts: number;
  items: CatalogItem[];
  page?: number;
  totalPages?: number;
}
