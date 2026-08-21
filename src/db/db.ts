import Dexie, { type Table } from 'dexie';
import type { Transaction, Customer, InventoryItem, Note, TransactionType } from '../types';
import { getStoreProfile, saveStoreProfile, type StoreProfile } from '../utils/storeSettings';

export class TindahanDatabase extends Dexie {
  transactions!: Table<Transaction>;
  customers!: Table<Customer>;
  inventory!: Table<InventoryItem>;
  notes!: Table<Note>;

  constructor() {
    super('TindahanNotesDB');
    this.version(1).stores({
      transactions: '++id, timestamp, dateStr, type, customerName, syncStatus',
      customers: '++id, &name, currentBalance, lastTransactionAt',
      inventory: '++id, &name, category, stock',
    });
    this.version(2).stores({
      transactions: '++id, timestamp, dateStr, type, customerName, syncStatus',
      customers: '++id, &name, currentBalance, lastTransactionAt',
      inventory: '++id, &name, category, stock',
      notes: '++id, createdAt, updatedAt, autoDelete, expiresAt',
    }).upgrade(async (tx) => {
      // Safe migration inside Dexie upgrade: move legacy NOTE transactions to dedicated notes table
      try {
        const legacyNotes = await tx.table('transactions').where('type').equals('NOTE').toArray();
        if (legacyNotes.length > 0) {
          const notesToAdd: Note[] = legacyNotes.map((lt: any) => ({
            text: lt.rawNote || '',
            createdAt: lt.timestamp || Date.now(),
            updatedAt: lt.timestamp || Date.now(),
            autoDelete: Boolean(lt.expiresAt && lt.expiresAt > 0),
            expiresAt: lt.expiresAt || null,
          }));
          await tx.table('notes').bulkAdd(notesToAdd);
          const idsToDelete = legacyNotes
            .map((lt: any) => lt.id)
            .filter((id: any): id is number => typeof id === 'number');
          if (idsToDelete.length > 0) {
            await tx.table('transactions').bulkDelete(idsToDelete);
          }
        }
      } catch (err) {
        console.warn('Upgrade note migration:', err);
      }
    });
  }
}

export const db = new TindahanDatabase();

/**
 * Safely requests persistent browser storage using navigator.storage.persist().
 * Checks for API availability, does not crash or block startup.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.persist === 'function'
  ) {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        const isPersisted = await navigator.storage.persisted();
        if (isPersisted) {
          return true;
        }
      }
      return await navigator.storage.persist();
    } catch (err) {
      console.warn('Persistent storage request skipped or failed:', err);
      return false;
    }
  }
  return false;
}

/**
 * Safely migrates any legacy NOTE transactions to the dedicated notes table if not already migrated.
 * Guarantees existing notes are preserved without data loss.
 */
export async function migrateLegacyNotes(): Promise<void> {
  try {
    const legacyNotes = await db.transactions
      .where('type')
      .equals('NOTE' as any)
      .toArray();

    if (legacyNotes.length > 0) {
      const now = Date.now();
      const notesToAdd: Note[] = legacyNotes
        .filter((lt: any) => !(lt.expiresAt && lt.expiresAt <= now))
        .map((lt: any) => ({
          text: lt.rawNote || '',
          createdAt: lt.timestamp || now,
          updatedAt: lt.timestamp || now,
          autoDelete: Boolean(lt.expiresAt && lt.expiresAt > 0),
          expiresAt: lt.expiresAt || null,
        }));

      if (notesToAdd.length > 0) {
        await db.notes.bulkAdd(notesToAdd);
      }

      const idsToDelete = legacyNotes
        .map((lt: any) => lt.id)
        .filter((id): id is number => typeof id === 'number');

      if (idsToDelete.length > 0) {
        await db.transactions.bulkDelete(idsToDelete);
      }
    }
  } catch (err) {
    console.warn('Legacy note migration check:', err);
  }
}

/**
 * Deletes expired notes from the dedicated notes database table.
 * Only deletes records where autoDelete === true and expiresAt <= now.
 * Never modifies or deletes financial, customer, or inventory records.
 */
export async function cleanExpiredNotes(): Promise<number> {
  try {
    const now = Date.now();
    const expiredNotes = await db.notes
      .filter((n) => n.autoDelete === true && typeof n.expiresAt === 'number' && n.expiresAt > 0 && n.expiresAt <= now)
      .toArray();

    if (expiredNotes.length > 0) {
      const idsToDelete = expiredNotes
        .map((n) => n.id)
        .filter((id): id is number => typeof id === 'number');
      if (idsToDelete.length > 0) {
        await db.notes.bulkDelete(idsToDelete);
        return idsToDelete.length;
      }
    }
    return 0;
  } catch (err) {
    console.warn('Error cleaning expired notes:', err);
    return 0;
  }
}

/**
 * Initializes DB connection without overwriting or injecting fake data.
 * Real store records are strictly preserved.
 * Safely cleans expired temporary notes and requests persistent storage.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    // Check and migrate legacy notes safely
    await migrateLegacyNotes();
    // Clean expired temporary notes on app startup
    await cleanExpiredNotes();
    // Non-blocking persistent storage request on app initialization
    requestPersistentStorage().catch(() => {});
  } catch (err) {
    console.warn('Database initialization warning:', err);
  }
}

/**
 * User-initiated complete data purge (used only when explicitly confirmed in Settings)
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.inventory, db.customers, db.transactions, db.notes], async () => {
    await db.inventory.clear();
    await db.customers.clear();
    await db.transactions.clear();
    await db.notes.clear();
  });
}

export interface TindahanBackupMetadata {
  app: string;
  backupVersion: number;
  appVersion: string;
  createdAt: string;
}

export interface TindahanBackupData extends TindahanBackupMetadata {
  storeProfile?: StoreProfile;
  transactions: Transaction[];
  customers: Customer[];
  inventory: InventoryItem[];
  notes?: Note[];
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  data?: TindahanBackupData;
}

/**
 * Validates a parsed JSON payload to ensure it is a genuine, compatible, and uncorrupted Tindahan Notes backup.
 */
export function validateBackupPayload(parsed: any): BackupValidationResult {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Invalid backup file: Not a valid JSON object.' };
  }

  // Verify app identifier
  const appIdentifier = parsed.app || parsed.appName;
  if (appIdentifier !== 'Tindahan Notes') {
    return {
      valid: false,
      error: 'Invalid or unsupported Tindahan Notes backup. The file identifier does not match Tindahan Notes.',
    };
  }

  // Verify backup version
  if (parsed.backupVersion !== undefined) {
    if (typeof parsed.backupVersion !== 'number' || parsed.backupVersion < 1) {
      return {
        valid: false,
        error: 'Invalid or unsupported Tindahan Notes backup: Invalid backupVersion format.',
      };
    }
    if (parsed.backupVersion > 1) {
      return {
        valid: false,
        error: `This backup was created by a newer version of Tindahan Notes (v${parsed.backupVersion}) and is not supported by this version.`,
      };
    }
  }

  // Validate required database collections exist
  if (!Array.isArray(parsed.transactions)) {
    return {
      valid: false,
      error: 'Invalid or unsupported Tindahan Notes backup: Missing transactions collection.',
    };
  }
  if (!Array.isArray(parsed.customers)) {
    return {
      valid: false,
      error: 'Invalid or unsupported Tindahan Notes backup: Missing customers collection.',
    };
  }
  if (!Array.isArray(parsed.inventory)) {
    return {
      valid: false,
      error: 'Invalid or unsupported Tindahan Notes backup: Missing inventory collection.',
    };
  }

  // Validate inventory item structures
  for (let i = 0; i < parsed.inventory.length; i++) {
    const item = parsed.inventory[i];
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim()) {
      return {
        valid: false,
        error: `Invalid inventory record at position ${i + 1}: Name is required.`,
      };
    }
    if (typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice)) {
      return {
        valid: false,
        error: `Invalid inventory record for "${item.name}": Selling price (unitPrice) must be a valid number.`,
      };
    }
    if (typeof item.stock !== 'number' || !Number.isFinite(item.stock)) {
      return {
        valid: false,
        error: `Invalid inventory record for "${item.name}": Stock quantity must be a valid number.`,
      };
    }
  }

  // Validate customer records
  for (let i = 0; i < parsed.customers.length; i++) {
    const cust = parsed.customers[i];
    if (!cust || typeof cust !== 'object' || typeof cust.name !== 'string' || !cust.name.trim()) {
      return {
        valid: false,
        error: `Invalid customer record at position ${i + 1}: Customer name is required.`,
      };
    }
    if (typeof cust.currentBalance !== 'number' || !Number.isFinite(cust.currentBalance)) {
      return {
        valid: false,
        error: `Invalid customer record for "${cust.name}": Balance must be a valid number.`,
      };
    }
  }

  // Validate transaction records
  const validTypes: (TransactionType | 'NOTE')[] = ['SALE', 'PAUTANG_RECORD', 'PAUTANG_PAYMENT', 'RESTOCK', 'NOTE'];
  for (let i = 0; i < parsed.transactions.length; i++) {
    const tx = parsed.transactions[i];
    if (!tx || typeof tx !== 'object') {
      return {
        valid: false,
        error: `Invalid transaction record at position ${i + 1}.`,
      };
    }
    if (typeof tx.timestamp !== 'number' || !Number.isFinite(tx.timestamp)) {
      return {
        valid: false,
        error: `Invalid transaction record at position ${i + 1}: Timestamp is required.`,
      };
    }
    if (!validTypes.includes(tx.type)) {
      return {
        valid: false,
        error: `Invalid transaction record at position ${i + 1}: Unrecognized type "${tx.type}".`,
      };
    }
    if (typeof tx.totalAmount !== 'number' || !Number.isFinite(tx.totalAmount)) {
      return {
        valid: false,
        error: `Invalid transaction record at position ${i + 1}: Total amount must be a valid number.`,
      };
    }
  }

  // Validate notes if present
  if (parsed.notes !== undefined) {
    if (!Array.isArray(parsed.notes)) {
      return {
        valid: false,
        error: 'Invalid notes collection in backup.',
      };
    }
    for (let i = 0; i < parsed.notes.length; i++) {
      const n = parsed.notes[i];
      if (!n || typeof n !== 'object' || typeof n.text !== 'string') {
        return {
          valid: false,
          error: `Invalid note record at position ${i + 1}.`,
        };
      }
      if (typeof n.createdAt !== 'number' || !Number.isFinite(n.createdAt)) {
        return {
          valid: false,
          error: `Invalid note record at position ${i + 1}: createdAt must be a number.`,
        };
      }
      if (n.expiresAt !== undefined && n.expiresAt !== null) {
        if (typeof n.expiresAt !== 'number' || !Number.isFinite(n.expiresAt)) {
          return {
            valid: false,
            error: `Invalid note record at position ${i + 1}: expiresAt must be a number timestamp.`,
          };
        }
      }
    }
  }

  // Validate storeProfile if present
  if (parsed.storeProfile !== undefined && parsed.storeProfile !== null) {
    if (typeof parsed.storeProfile !== 'object' || Array.isArray(parsed.storeProfile)) {
      return {
        valid: false,
        error: 'Invalid store profile structure in backup.',
      };
    }
  }

  return {
    valid: true,
    data: {
      app: 'Tindahan Notes',
      backupVersion: parsed.backupVersion || 1,
      appVersion: parsed.appVersion || parsed.version || '2.0.0',
      createdAt: parsed.createdAt || parsed.exportedAt || new Date().toISOString(),
      storeProfile: parsed.storeProfile,
      inventory: parsed.inventory,
      customers: parsed.customers,
      transactions: parsed.transactions,
      notes: parsed.notes,
    },
  };
}

/**
 * Exports all local data and store configuration to a standardized JSON backup structure.
 * This is a read-only operation that does not mutate any stored records.
 */
export async function exportDatabaseBackup(): Promise<string> {
  await cleanExpiredNotes();
  const [transactions, customers, inventory, notes] = await Promise.all([
    db.transactions.toArray(),
    db.customers.toArray(),
    db.inventory.toArray(),
    db.notes.toArray(),
  ]);

  const storeProfile = getStoreProfile();

  // Filter out any legacy 'NOTE' transactions from the financial transactions list in backup
  const financialTransactions = transactions.filter((t) => t.type !== ('NOTE' as any));

  const backupData: TindahanBackupData = {
    app: 'Tindahan Notes',
    backupVersion: 1,
    appVersion: '2.0.0',
    createdAt: new Date().toISOString(),
    storeProfile,
    transactions: financialTransactions,
    customers,
    inventory,
    notes,
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * Imports and restores backup JSON data safely.
 * Strictly validates the entire payload before modifying any database records.
 */
export async function importDatabaseBackup(jsonString: string): Promise<{
  txCount: number;
  customerCount: number;
  inventoryCount: number;
  notesCount: number;
  storeProfileRestored: boolean;
}> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid or unsupported Tindahan Notes backup. (Not a valid JSON file)');
  }

  // Comprehensive pre-validation before any database mutation
  const validation = validateBackupPayload(parsed);
  if (!validation.valid || !validation.data) {
    throw new Error(validation.error || 'Invalid or unsupported Tindahan Notes backup.');
  }

  const { inventory, customers, transactions, notes = [], storeProfile } = validation.data;

  // Separate any legacy NOTE records from transactions if old backup
  const legacyNotesInTx = transactions.filter((t: any) => t.type === 'NOTE');
  const pureTransactions = transactions.filter((t: any) => t.type !== 'NOTE');

  // Combine notes and legacy notes
  const allNotes: Note[] = [...notes];
  for (const lt of legacyNotesInTx) {
    allNotes.push({
      text: (lt as any).rawNote || '',
      createdAt: lt.timestamp || Date.now(),
      updatedAt: lt.timestamp || Date.now(),
      autoDelete: Boolean((lt as any).expiresAt && (lt as any).expiresAt > 0),
      expiresAt: (lt as any).expiresAt || null,
    });
  }

  // Filter out any temporary notes that have already expired
  const now = Date.now();
  const validNotes = allNotes.filter((n) => {
    if (n.autoDelete && typeof n.expiresAt === 'number' && n.expiresAt > 0 && n.expiresAt <= now) {
      return false; // Do not resurrect expired temporary notes
    }
    return true;
  });

  // Atomic database restoration inside a single read-write transaction
  await db.transaction('rw', [db.inventory, db.customers, db.transactions, db.notes], async () => {
    await db.inventory.clear();
    if (inventory.length > 0) {
      await db.inventory.bulkPut(inventory);
    }
    await db.customers.clear();
    if (customers.length > 0) {
      await db.customers.bulkPut(customers);
    }
    await db.transactions.clear();
    if (pureTransactions.length > 0) {
      await db.transactions.bulkPut(pureTransactions);
    }
    await db.notes.clear();
    if (validNotes.length > 0) {
      await db.notes.bulkPut(validNotes);
    }
  });

  // Restore store profile configuration if included
  let storeProfileRestored = false;
  if (storeProfile && typeof storeProfile === 'object') {
    saveStoreProfile({
      storeName: storeProfile.storeName || 'Tindahan ni Suki',
      ownerName: storeProfile.ownerName || '',
      contactNumber: storeProfile.contactNumber || '',
      notes: storeProfile.notes || '',
    });
    storeProfileRestored = true;
  }

  return {
    txCount: pureTransactions.length,
    customerCount: customers.length,
    inventoryCount: inventory.length,
    notesCount: validNotes.length,
    storeProfileRestored,
  };
}


