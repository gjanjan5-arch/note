import { collection, doc, setDoc, getFirestore } from 'firebase/firestore';
import { db as firestoreDb } from '../db/firebase';
import { db as localDb } from '../db/db';
import type { Transaction } from '../types';

let isSyncing = false;
let syncTimeout: any = null;

export type SyncState = 'IDLE' | 'SYNCING' | 'SYNCED' | 'OFFLINE' | 'ERROR';
let currentSyncState: SyncState = typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'IDLE';

type SyncListener = (state: SyncState, unsyncedCount: number) => void;
const listeners = new Set<SyncListener>();

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  // Initial callback
  getUnsyncedCount().then((count) => listener(currentSyncState, count)).catch(() => {});
  return () => listeners.delete(listener);
}

function notifyListeners(unsyncedCount: number) {
  listeners.forEach((fn) => fn(currentSyncState, unsyncedCount));
}

export async function getUnsyncedCount(): Promise<number> {
  try {
    return await localDb.transactions.where('syncStatus').equals('LOCAL').count();
  } catch {
    return 0;
  }
}

/**
 * Triggers background sync of pending LOCAL transactions to Firestore.
 * Highly optimized, debounced, zero polling loops to save device battery and memory.
 */
export function triggerSync(): void {
  if (typeof window === 'undefined') return;

  if (!navigator.onLine) {
    currentSyncState = 'OFFLINE';
    getUnsyncedCount().then(notifyListeners);
    return;
  }

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    executeSync().catch((err) => {
      console.warn('[SyncEngine] Sync error:', err);
    });
  }, 400);
}

async function executeSync(): Promise<void> {
  if (isSyncing || !navigator.onLine) return;

  try {
    isSyncing = true;
    currentSyncState = 'SYNCING';
    const pendingCount = await getUnsyncedCount();
    notifyListeners(pendingCount);

    const unsyncedTransactions = await localDb.transactions
      .where('syncStatus')
      .equals('LOCAL')
      .limit(50)
      .toArray();

    if (unsyncedTransactions.length === 0) {
      currentSyncState = 'SYNCED';
      notifyListeners(0);
      isSyncing = false;
      return;
    }

    for (const tx of unsyncedTransactions) {
      if (!tx.id) continue;
      const docId = `tx_${tx.id}_${tx.timestamp}`;
      const docRef = doc(firestoreDb, 'transactions', docId);

      const payload = {
        localId: tx.id,
        timestamp: tx.timestamp,
        dateStr: tx.dateStr,
        type: tx.type,
        customerName: tx.customerName || null,
        items: tx.items || [],
        totalAmount: tx.totalAmount || 0,
        rawNote: tx.rawNote || '',
        paymentMethod: tx.paymentMethod || 'CASH',
        paymentRefNumber: tx.paymentRefNumber || null,
        cashTendered: tx.cashTendered ?? null,
        changeAmount: tx.changeAmount ?? null,
        notes: tx.notes || null,
        syncedAt: Date.now(),
      };

      await setDoc(docRef, payload, { merge: true });

      // Mark locally as SYNCED
      await localDb.transactions.update(tx.id, { syncStatus: 'SYNCED' });
    }

    const remaining = await getUnsyncedCount();
    currentSyncState = remaining === 0 ? 'SYNCED' : 'SYNCING';
    notifyListeners(remaining);

    // If there were more than 50, trigger another batch smoothly
    if (remaining > 0) {
      setTimeout(() => triggerSync(), 200);
    }
  } catch (err) {
    currentSyncState = 'ERROR';
    const count = await getUnsyncedCount();
    notifyListeners(count);
  } finally {
    isSyncing = false;
  }
}

// Auto-listen to native browser connection events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    currentSyncState = 'SYNCING';
    triggerSync();
  });

  window.addEventListener('offline', () => {
    currentSyncState = 'OFFLINE';
    getUnsyncedCount().then(notifyListeners);
  });
}
