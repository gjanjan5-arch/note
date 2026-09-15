import { safeStorage } from './safeStorage';

export interface BuyerDebtItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  isPaid?: boolean;
}

export interface BuyerPaymentRecord {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface BuyerStoreUtang {
  storeId: string;
  storeName: string;
  ownerName?: string;
  lastUpdated: string;
  debts: BuyerDebtItem[];
  payments: BuyerPaymentRecord[];
}

export interface BuyerDigitalReceipt {
  id: string;
  storeName: string;
  ownerName?: string;
  storeAddress?: string;
  contactNumber?: string;
  gcashNumber?: string;
  timestamp: number;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    variantLabel?: string;
    isCustomRequest?: boolean;
  }>;
  total: number;
  cash?: number;
  change?: number;
  paymentMethod: 'CASH' | 'UTANG' | 'GCASH' | 'PARTIAL_CASH';
  qrPayload?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'CREDIT';
}

const BUYER_UTANGS_STORAGE_KEY = 'tindahan_buyer_utangs';
const BUYER_RECEIPTS_STORAGE_KEY = 'tindahan_buyer_receipts';

export function getBuyerUtangs(): BuyerStoreUtang[] {
  try {
    const raw = safeStorage.getItem(BUYER_UTANGS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: BuyerStoreUtang[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out any legacy development mock seeds
    const clean = parsed.filter(
      (s) =>
        s &&
        s.storeId !== 'store-aling-nena' &&
        !s.storeName?.toLowerCase().includes("aling nena's sari-sari store")
    );

    // If mock items were stripped, rewrite clean state
    if (clean.length !== parsed.length) {
      safeStorage.setItem(BUYER_UTANGS_STORAGE_KEY, JSON.stringify(clean));
    }

    return clean;
  } catch {
    return [];
  }
}

export function saveBuyerUtangs(utangs: BuyerStoreUtang[]): void {
  try {
    safeStorage.setItem(BUYER_UTANGS_STORAGE_KEY, JSON.stringify(utangs));
  } catch (err) {
    console.error('Failed to save buyer utangs:', err);
  }
}

export function recordBuyerUtang(
  storeName: string,
  ownerName: string | undefined,
  description: string,
  amount: number
): void {
  try {
    const current = getBuyerUtangs();
    const cleanStoreId = `store-${storeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const existingIndex = current.findIndex(
      (s) => s.storeName.toLowerCase() === storeName.toLowerCase() || s.storeId === cleanStoreId
    );

    const newDebt: BuyerDebtItem = {
      id: `d-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
      description,
      amount,
    };

    if (existingIndex >= 0) {
      current[existingIndex].debts.push(newDebt);
      current[existingIndex].lastUpdated = new Date().toISOString();
      if (ownerName && !current[existingIndex].ownerName) {
        current[existingIndex].ownerName = ownerName;
      }
    } else {
      current.push({
        storeId: cleanStoreId,
        storeName,
        ownerName,
        lastUpdated: new Date().toISOString(),
        debts: [newDebt],
        payments: [],
      });
    }

    saveBuyerUtangs(current);
  } catch (err) {
    console.error('Failed to record buyer utang:', err);
  }
}

export function getBuyerReceipts(): BuyerDigitalReceipt[] {
  try {
    const raw = safeStorage.getItem(BUYER_RECEIPTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: BuyerDigitalReceipt[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out any legacy development mock receipts
    const clean = parsed.filter(
      (r) =>
        r &&
        r.id !== 'rec-1' &&
        r.id !== 'rec-2' &&
        !r.storeName?.toLowerCase().includes("aling nena's sari-sari store")
    );

    // If mock items were stripped, rewrite clean state
    if (clean.length !== parsed.length) {
      safeStorage.setItem(BUYER_RECEIPTS_STORAGE_KEY, JSON.stringify(clean));
    }

    return clean;
  } catch {
    return [];
  }
}

export function saveBuyerReceipt(receipt: BuyerDigitalReceipt): void {
  try {
    const existing = getBuyerReceipts();
    const updated = [receipt, ...existing.filter((r) => r.id !== receipt.id)];
    safeStorage.setItem(BUYER_RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save buyer receipt:', err);
  }
}

export function calculateStoreNetUtang(store: BuyerStoreUtang): number {
  const totalDebts = store.debts.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalPayments = store.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  return Math.max(0, totalDebts - totalPayments);
}

export function calculateTotalBuyerUtang(stores: BuyerStoreUtang[]): number {
  return stores.reduce((acc, store) => acc + calculateStoreNetUtang(store), 0);
}

