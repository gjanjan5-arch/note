import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { exportDatabaseBackup } from '../db/db';
import { safeStorage } from './safeStorage';
import { ensureStoragePermission } from './storagePermission';

export const BACKUP_FILE_NAME = 'tindahan-notes-backup.json';
export const BACKUP_FOLDER_NAME = 'Documents/Tinda';

const AUTO_UPDATE_STORAGE_KEY = 'autoUpdateData';

export function isAutoUpdateEnabled(): boolean {
  try {
    return safeStorage.getItem(AUTO_UPDATE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  try {
    safeStorage.setItem(AUTO_UPDATE_STORAGE_KEY, String(enabled));
  } catch (e) {
    console.warn('Failed to save autoUpdateData setting:', e);
  }
}

let isAutoSyncSuppressed = false;
let isWriteOperationInProgress = false;

/**
 * Temporarily suspends auto-sync to avoid overwriting backup files during clear operations
 */
export function setAutoSyncSuppressed(suppressed: boolean) {
  isAutoSyncSuppressed = suppressed;
  if (suppressed && autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = null;
  }
}

export interface BackupResult {
  success: boolean;
  locationDescription: string;
  fileUri?: string;
  overwritten: boolean;
  error?: string;
  jsonStr?: string;
}

/**
 * Shares the backup file using the native share sheet (via Directory.Cache temporary file).
 */
export async function shareBackupFile(jsonStr: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  try {
    const tempFile = await Filesystem.writeFile({
      path: BACKUP_FILE_NAME,
      data: jsonStr,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    if (tempFile?.uri) {
      await Share.share({
        title: 'Export Tindahan Notes Backup',
        text: 'Tindahan Notes Store Backup File',
        url: tempFile.uri,
        files: [tempFile.uri],
        dialogTitle: 'Export Tindahan Notes Backup',
      });
    }
  } catch (err) {
    console.warn('[backupManager] shareBackupFile warning:', err);
  }
}

/**
 * Preserves the existing backup file on disk by archiving it when CAD (Clear Active Data) is triggered.
 * This guarantees the user's previously saved backup in App Data/Tindahan Notes/ remains unharmed.
 */
export async function archiveExistingBackupOnDisk(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    const targetFolder = 'Tinda';
    const currentFilePath = `${targetFolder}/${BACKUP_FILE_NAME}`;
    
    // Check if the current backup file exists in Documents
    let exists = false;
    try {
      await Filesystem.stat({
        path: currentFilePath,
        directory: Directory.Documents,
      });
      exists = true;
    } catch {
      exists = false;
    }

    if (!exists) {
      return true; // Nothing to archive
    }

    // Read the existing file
    const readFile = await Filesystem.readFile({
      path: currentFilePath,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    if (readFile.data) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFileName = `tindahan-notes-backup-archived-${timestamp}.json`;
      const archiveFilePath = `${targetFolder}/${archiveFileName}`;

      await Filesystem.writeFile({
        path: archiveFilePath,
        data: readFile.data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      console.log(`[backupManager] Successfully archived existing backup to ${archiveFilePath}`);
    }

    return true;
  } catch (err) {
    console.warn('[backupManager] Archive on CAD warning:', err);
    return false;
  }
}

/**
 * Saves or overwrites the standard backup file in Documents/Tinda/tindahan-notes-backup.json
 * Synchronized for both AUD (Auto-Update Data) and EDB (Export Database Backup).
 */
export async function saveOrUpdateBackupFile(isManualExport: boolean = false): Promise<BackupResult> {
  // If not a manual export, and auto-sync is suppressed, abort immediately
  if (!isManualExport && isAutoSyncSuppressed) {
    return {
      success: false,
      locationDescription: '',
      overwritten: false,
      error: 'Auto-sync is temporarily suppressed.',
    };
  }

  // Mutex lock to prevent overlapping concurrent file writes
  if (isWriteOperationInProgress) {
    return {
      success: false,
      locationDescription: '',
      overwritten: false,
      error: 'A backup write operation is already in progress.',
    };
  }

  isWriteOperationInProgress = true;

  try {
    const jsonStr = await exportDatabaseBackup();

    // Safety guard: prevent AUD from auto-overwriting with 0 total active records
    if (!isManualExport) {
      try {
        const parsed = JSON.parse(jsonStr);
        const totalRecords =
          (parsed.transactions?.length || 0) +
          (parsed.customers?.length || 0) +
          (parsed.inventory?.length || 0) +
          (parsed.notes?.length || 0);

        if (totalRecords === 0) {
          console.warn('[backupManager] Guard: Suppressed auto-overwrite of backup because database is empty.');
          return {
            success: false,
            locationDescription: '',
            overwritten: false,
            error: 'Suppressed auto-overwrite for empty dataset.',
            jsonStr,
          };
        }
      } catch (parseErr) {
        console.warn('[backupManager] Safety check parse warning:', parseErr);
      }
    }

    if (Capacitor.isNativePlatform()) {
      // Trigger OS storage permission prompt if not already granted
      await ensureStoragePermission();

      const folderName = 'Tinda';
      const fullPath = `${folderName}/${BACKUP_FILE_NAME}`;

      // Check if file already exists to report overwrite accurately
      let fileAlreadyExists = false;
      try {
        await Filesystem.stat({
          path: fullPath,
          directory: Directory.Documents,
        });
        fileAlreadyExists = true;
      } catch {
        fileAlreadyExists = false;
      }

      // Ensure directory exists in Documents
      try {
        await Filesystem.mkdir({
          path: folderName,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (mkdirErr) {
        // Directory already exists
      }

      // Write/Overwrite latest data directly into Documents/Tinda/tindahan-notes-backup.json
      const writeResult = await Filesystem.writeFile({
        path: fullPath,
        data: jsonStr,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });

      if (isManualExport) {
        await shareBackupFile(jsonStr);
      }

      return {
        success: true,
        locationDescription: `Documents/${folderName}/${BACKUP_FILE_NAME}`,
        fileUri: writeResult?.uri,
        overwritten: fileAlreadyExists,
        jsonStr,
      };
    } else {
      // Browser environment
      if (isManualExport) {
        triggerBrowserDownloadFallback(jsonStr);
      }

      return {
        success: true,
        locationDescription: `${BACKUP_FOLDER_NAME}/${BACKUP_FILE_NAME}`,
        overwritten: true,
        jsonStr,
      };
    }
  } catch (globalErr: any) {
    console.warn('[backupManager] Backup save error caught:', globalErr);
    return {
      success: false,
      locationDescription: '',
      overwritten: false,
      error: globalErr?.message || 'Unexpected error during backup generation.',
    };
  } finally {
    isWriteOperationInProgress = false;
  }
}

function triggerBrowserDownloadFallback(jsonStr: string): void {
  try {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = BACKUP_FILE_NAME;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (downloadErr) {
    console.warn('Browser download trigger notice:', downloadErr);
  }
}

// Debounce timer for Auto-Update Data
let autoSyncDebounceTimer: any = null;

/**
 * Triggers an auto-update backup when store data changes, but ONLY if AUD is turned ON.
 * If AUD is OFF, it has ZERO function and returns immediately.
 */
export function triggerAutoBackupIfEnabled(): void {
  // ZERO function if AUD is OFF
  if (!isAutoUpdateEnabled()) {
    return;
  }

  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
  }

  // 1.5-second debounce so batch additions don't trigger multiple file writes
  autoSyncDebounceTimer = setTimeout(() => {
    saveOrUpdateBackupFile(false)
      .then((res) => {
        if (res.success) {
          console.log(`[Auto-Update Data] Backup updated (${res.overwritten ? 'overwritten' : 'created'} at ${res.locationDescription})`);
        }
      })
      .catch((err) => {
        console.warn('[Auto-Update Data] Handled sync warning:', err);
      });
  }, 1500);
}
