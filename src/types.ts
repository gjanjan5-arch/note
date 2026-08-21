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
