import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  importDatabaseBackup,
  clearAllData,
  db,
} from '../db/db';
import {
  saveOrUpdateBackupFile,
  isAutoUpdateEnabled,
  setAutoUpdateEnabled,
  setAutoSyncSuppressed,
  archiveExistingBackupOnDisk,
  BACKUP_FILE_NAME,
  BACKUP_FOLDER_NAME,
} from './backupManager';
import { getStoreProfile, type StoreProfile } from './storeSettings';
import type { LanguageCode } from './i18n';

export interface DataOperationResult {
  success: boolean;
  message: string;
  overwritten?: boolean;
  fileUri?: string;
  error?: string;
  stats?: {
    inventoryCount: number;
    customerCount: number;
    txCount: number;
    storeProfileRestored: boolean;
  };
}

/**
 * Perform manual export and backup file creation directly to Documents/Tindahan Notes/ (EDB).
 * Overwrites existing backup if present with the latest in-app data.
 */
export async function performExportBackup(lang: LanguageCode): Promise<DataOperationResult> {
  try {
    const res = await saveOrUpdateBackupFile(true);
    if (!res.success) {
      throw new Error(res.error || 'Failed to write backup file');
    }

    const successMsg = lang === 'tl'
      ? `${res.overwritten ? 'Na-update at na-overwrite' : 'Nai-save'} ang backup sa ${res.locationDescription}`
      : `Backup ${res.overwritten ? 'updated & overwritten at' : 'saved to'} ${res.locationDescription}`;

    if (Capacitor.isNativePlatform() && res.fileUri) {
      try {
        const canShare = await Share.canShare();
        if (canShare?.value) {
          await Share.share({
            title: 'Tindahan Notes Backup',
            text: `Tindahan Notes Store Backup (${BACKUP_FILE_NAME})`,
            url: res.fileUri,
            dialogTitle: 'Save or Share Backup',
          });
        }
      } catch (shareErr) {
        console.warn('Share intent error:', shareErr);
      }
    }

    return {
      success: true,
      message: successMsg,
      overwritten: res.overwritten,
      fileUri: res.fileUri,
    };
  } catch (err: any) {
    console.error('Export error in dataManager:', err);
    const errMsg = lang === 'tl'
      ? `Hindi nai-save ang backup: ${err?.message || 'Pakisubukang muli.'}`
      : `Failed to save backup: ${err?.message || 'Please try again.'}`;

    return {
      success: false,
      message: errMsg,
      error: err?.message,
    };
  }
}

/**
 * Import and restore backup JSON text.
 */
export async function performImportBackup(
  backupJsonText: string,
  lang: LanguageCode
): Promise<DataOperationResult> {
  try {
    if (!backupJsonText || typeof backupJsonText !== 'string' || !backupJsonText.trim()) {
      throw new Error(lang === 'tl' ? 'Walang laman ang backup file.' : 'Empty or unreadable backup file.');
    }

    const result = await importDatabaseBackup(backupJsonText);
    const msg = lang === 'tl'
      ? `Matagumpay ang restore.\nNai-restore:\n• ${result.inventoryCount} paninda\n• ${result.customerCount} suki\n• ${result.txCount} transaksyon${result.storeProfileRestored ? '\n• Profile ng tindahan' : ''}`
      : `Restore successful.\nRestored:\n• ${result.inventoryCount} inventory items\n• ${result.customerCount} suki / customers\n• ${result.txCount} transactions${result.storeProfileRestored ? '\n• Store profile' : ''}`;

    return {
      success: true,
      message: msg,
      stats: result,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || (lang === 'tl' ? 'Hindi balido ang backup file.' : 'Invalid or unsupported Tindahan Notes backup.'),
      error: err?.message,
    };
  }
}

/**
 * Clear Active Data (CAD):
 * 1. Automatically turns OFF AUD so empty tables don't overwrite existing backup.
 * 2. Archives / preserves the existing backup in Documents/Tindahan Notes/ safely so it is unharmed.
 * 3. Clears in-app IndexedDB tables (transactions, inventory, customers, notes).
 * 4. Preserves store profile preferences and external backup storage unharmed.
 */
export async function performClearActiveData(lang: LanguageCode): Promise<DataOperationResult> {
  // 1. Immediately turn OFF AUD and suppress auto-sync
  setAutoUpdateEnabled(false);
  setAutoSyncSuppressed(true);

  try {
    // 2. Archive and protect any existing backup in Documents/Tindahan Notes/
    await archiveExistingBackupOnDisk();

    // 3. Clear active IndexedDB records
    await clearAllData();

    const successMsg = lang === 'tl'
      ? 'Matagumpay na na-reset ang active store records. Ligtas at hindi nagalaw ang backup files sa Documents/Tindahan Notes.'
      : 'Active store records cleared. Existing backup files in Documents/Tindahan Notes remain unharmed and safe.';

    return {
      success: true,
      message: successMsg,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to clear store data.',
      error: err?.message,
    };
  } finally {
    // Keep auto-sync suppressed for a short cooldown
    setTimeout(() => setAutoSyncSuppressed(false), 3000);
  }
}

/**
 * Toggle and configure Auto-Update Data (AUD) mode.
 * - When turned ON: Saves/overwrites Documents/Tindahan Notes/tindahan-notes-backup.json with latest data.
 * - When turned OFF: Zero function.
 */
export async function toggleAutoUpdateDataState(
  currentState: boolean,
  lang: LanguageCode
): Promise<{ newState: boolean; message: string }> {
  const newValue = !currentState;

  setAutoUpdateEnabled(newValue);

  if (newValue) {
    try {
      const res = await saveOrUpdateBackupFile(false);
      const msg = lang === 'tl'
        ? `Naka-ON na ang Auto-Update Data. ${res.overwritten ? 'Na-update at na-overwrite' : 'Nai-save'} ang backup sa ${res.locationDescription}`
        : `Auto-Update Data is ON. Backup ${res.overwritten ? 'updated & overwritten' : 'created'} at ${res.locationDescription}`;
      return { newState: true, message: msg };
    } catch (err) {
      console.warn('Initial AUD inspection error:', err);
      return {
        newState: true,
        message: lang === 'tl'
          ? 'Naka-ON na ang Auto-Update Data.'
          : 'Auto-Update Data is now enabled.',
      };
    }
  } else {
    const msg = lang === 'tl'
      ? 'Naka-OFF na ang Auto-Update Data. Naka-pause ang auto-backup (zero function).'
      : 'Auto-Update Data is OFF. Zero background backup synchronization.';
    return { newState: false, message: msg };
  }
}
