import { BarcodeScanner, type PermissionStatus } from '@capacitor-mlkit/barcode-scanning';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { Capacitor } from '@capacitor/core';

export interface ScannerPermissionResult {
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited' | 'unknown';
  permanentlyDenied: boolean;
  message?: string;
}

/**
 * Handles the complete check-then-request camera permission flow for barcode scanning.
 * 
 * Flow:
 * 1. Calls BarcodeScanner.checkPermissions() to inspect current OS state.
 * 2. If already 'granted', returns immediately without disturbing the user.
 * 3. If not 'granted', explicitly calls BarcodeScanner.requestPermissions() to trigger
 *    the real Android OS runtime camera permission dialog.
 * 4. Safely catches denials and permanent denials, providing Open Settings support.
 */
export async function ensureCameraPermission(): Promise<ScannerPermissionResult> {
  // BRANCH 1: Web / Laptop Browser Environment
  if (!Capacitor.isNativePlatform()) {
    console.log('[ScannerPermission] Running in Web / Laptop browser environment.');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        granted: false,
        state: 'unknown',
        permanentlyDenied: false,
        message: 'Camera API (navigator.mediaDevices) is not supported in this browser.',
      };
    }

    // Do NOT rely on navigator.permissions.query({ name: 'camera' }) for denial checks.
    // In mobile WebViews, iOS Safari, and sandboxed preview iFrames, permissions.query returns 'denied'
    // prematurely before getUserMedia is ever called, blocking the OS/browser permission prompt.
    // We return state: 'prompt' with granted: true so startCameraStream directly invokes
    // navigator.mediaDevices.getUserMedia() to trigger the native browser permission dialog.
    return {
      granted: true,
      state: 'prompt',
      permanentlyDenied: false,
    };
  }

  // BRANCH 2: Native Android / iOS Capacitor Environment
  try {
    console.log('[ScannerPermission] Running in Native Capacitor environment.');
    // 1. Check current permission status
    let checkResult: PermissionStatus = { camera: 'prompt' };
    try {
      checkResult = await BarcodeScanner.checkPermissions();
      console.log('[ScannerPermission] Native checkPermissions status:', checkResult.camera);
    } catch (checkErr) {
      console.warn('[ScannerPermission] checkPermissions call warning:', checkErr);
    }

    // 2. Already granted: Return granted immediately
    if (checkResult.camera === 'granted') {
      console.log('[ScannerPermission] Camera permission already GRANTED.');
      return {
        granted: true,
        state: 'granted',
        permanentlyDenied: false,
      };
    }

    // 3. Not yet granted: Always trigger requestPermissions() so Android OS dialog can appear
    console.log('[ScannerPermission] Requesting camera permission from native OS...');
    const requestResult = await BarcodeScanner.requestPermissions();
    console.log('[ScannerPermission] Result from requestPermissions():', requestResult.camera);

    if (requestResult.camera === 'granted') {
      console.log('[ScannerPermission] Camera permission GRANTED by user.');
      return {
        granted: true,
        state: 'granted',
        permanentlyDenied: false,
      };
    }

    const isDenied = requestResult.camera === 'denied';
    console.log('[ScannerPermission] Camera permission not granted. Status:', requestResult.camera);
    return {
      granted: false,
      state: requestResult.camera,
      permanentlyDenied: isDenied,
      message: isDenied
        ? 'Camera permission was denied.'
        : 'Camera access is not permitted.',
    };
  } catch (error: any) {
    console.error('[ScannerPermission] Error in native permission request workflow:', error);
    return {
      granted: false,
      state: 'unknown',
      permanentlyDenied: false,
      message: error?.message || 'Failed to request camera permission.',
    };
  }
}

/**
 * Prepares the Google Barcode Scanner ML Kit module on Android devices.
 */
export async function prepareGoogleBarcodeScannerModule(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return true;
  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      console.log('[ScannerPermission] Installing Google Barcode Scanner Module...');
      await BarcodeScanner.installGoogleBarcodeScannerModule();
      return true;
    }
    return true;
  } catch (e) {
    console.warn('[ScannerPermission] Google Barcode Scanner module check/install notice:', e);
    return false;
  }
}

export type MlKitModuleStatus = 'READY' | 'INSTALLING' | 'ERROR' | 'N/A';

/**
 * Prepares the Google Text Recognition ML Kit module on Android devices.
 */
export async function prepareGoogleTextRecognitionModule(
  onStatusChange?: (status: MlKitModuleStatus) => void
): Promise<MlKitModuleStatus> {
  if (!Capacitor.isNativePlatform()) {
    onStatusChange?.('N/A');
    return 'N/A';
  }
  if (Capacitor.getPlatform() !== 'android') {
    onStatusChange?.('READY');
    return 'READY';
  }

  try {
    if (typeof (TextRecognition as any).isGoogleTextRecognitionModuleAvailable === 'function') {
      const { available } = await (TextRecognition as any).isGoogleTextRecognitionModuleAvailable();
      if (!available) {
        onStatusChange?.('INSTALLING');
        if (typeof (TextRecognition as any).installGoogleTextRecognitionModule === 'function') {
          console.log('[ScannerPermission] Installing Google Text Recognition Module...');
          await (TextRecognition as any).installGoogleTextRecognitionModule();
          onStatusChange?.('READY');
          return 'READY';
        }
      }
    }
    onStatusChange?.('READY');
    return 'READY';
  } catch (e) {
    console.warn('[ScannerPermission] Google Text Recognition module check/install notice:', e);
    onStatusChange?.('ERROR');
    return 'ERROR';
  }
}

/**
 * Opens the native Android application settings page so the user can enable Camera permission.
 */
export async function openCameraSettings(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await BarcodeScanner.openSettings();
    } else {
      console.log('[ScannerPermission] openSettings is only available in native Android/iOS environments.');
    }
  } catch (err) {
    console.warn('[ScannerPermission] Failed to open system settings:', err);
  }
}

