import { Filesystem, type PermissionStatus } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface StoragePermissionResult {
  granted: boolean;
  state: string;
  message?: string;
}

/**
 * Checks and requests storage/external storage permissions on native Android/iOS
 * using Filesystem.checkPermissions() and Filesystem.requestPermissions().
 */
export async function ensureStoragePermission(): Promise<StoragePermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, state: 'granted' };
  }

  try {
    let checkResult: PermissionStatus = { publicStorage: 'prompt' } as any;
    try {
      checkResult = await Filesystem.checkPermissions();
      console.log('[StoragePermission] checkPermissions status:', checkResult);
    } catch (err) {
      console.warn('[StoragePermission] checkPermissions warning:', err);
    }

    const currentStatus = (checkResult as any).publicStorage || (checkResult as any).file || 'granted';
    if (currentStatus === 'granted') {
      return { granted: true, state: 'granted' };
    }

    console.log('[StoragePermission] Requesting storage permission from native OS...');
    const requestResult = await Filesystem.requestPermissions();
    console.log('[StoragePermission] requestPermissions result:', requestResult);

    const finalStatus = (requestResult as any).publicStorage || (requestResult as any).file || 'granted';
    if (finalStatus === 'granted') {
      return { granted: true, state: 'granted' };
    }

    return {
      granted: false,
      state: finalStatus,
      message: 'Storage permission was not granted by the OS.',
    };
  } catch (error: any) {
    console.warn('[StoragePermission] Error requesting storage permission:', error);
    // Fallback: Directory.Data sandbox doesn't strictly require external storage permission on Android 10+
    return {
      granted: true,
      state: 'assumed-granted-sandbox',
    };
  }
}
