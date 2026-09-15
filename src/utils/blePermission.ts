import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

export interface BlePermissionResult {
  granted: boolean;
  permanentlyDenied: boolean;
  bluetoothEnabled: boolean;
  locationEnabled: boolean;
}

/**
 * Handles BLE runtime permission flow and checks hardware enablement (Bluetooth + GPS/Location).
 * @param autoEnableBluetooth If true, prompts Android's native system dialog to turn on Bluetooth if it's currently disabled.
 */
export async function ensureBlePermission(autoEnableBluetooth: boolean = true): Promise<BlePermissionResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return { granted: true, permanentlyDenied: false, bluetoothEnabled: true, locationEnabled: true };
  }

  try {
    const info = await Device.getInfo();
    const osVersion = parseInt(info.osVersion?.split('.')[0] || '0', 10);

    // 1. Request BLE runtime permissions
    const blePlugin = BleClient as any;
    const result = blePlugin.requestPermissions
      ? await blePlugin.requestPermissions()
      : { bluetooth: 'granted', location: 'granted' };
    
    const granted = result?.bluetooth === 'granted' || result?.location === 'granted';

    if (!granted) {
      return {
        granted: false,
        permanentlyDenied: true,
        bluetoothEnabled: false,
        locationEnabled: false,
      };
    }

    // 2. Check and optionally prompt to enable Bluetooth
    let bluetoothEnabled = false;
    try {
      bluetoothEnabled = await BleClient.isEnabled();
      if (!bluetoothEnabled && autoEnableBluetooth) {
        // Native Android dialog: "An app wants to turn on Bluetooth. [Allow] [Deny]"
        await BleClient.requestEnable();
        bluetoothEnabled = await BleClient.isEnabled();
      }
    } catch (err) {
      console.warn('[BlePermission] requestEnable failed or declined:', err);
    }

    // 3. Check Location Services / GPS (required on Android for BLE scanning)
    let locationEnabled = true;
    try {
      locationEnabled = await BleClient.isLocationEnabled();
    } catch (err) {
      console.warn('[BlePermission] isLocationEnabled check error:', err);
    }

    return {
      granted: true,
      permanentlyDenied: false,
      bluetoothEnabled,
      locationEnabled,
    };
  } catch (error) {
    console.error('[BlePermission] Error:', error);
    return { granted: false, permanentlyDenied: false, bluetoothEnabled: false, locationEnabled: false };
  }
}

/**
 * Prompt Android native dialog to turn on Bluetooth.
 */
export async function promptEnableBluetooth(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return true;
  }
  try {
    await BleClient.requestEnable();
    return await BleClient.isEnabled();
  } catch (err) {
    console.warn('[BlePermission] promptEnableBluetooth declined:', err);
    return false;
  }
}

/**
 * Open Android system Location / GPS settings so user can toggle Location on.
 */
export async function promptOpenLocationSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }
  try {
    await BleClient.openLocationSettings();
  } catch (err) {
    console.warn('[BlePermission] openLocationSettings error:', err);
  }
}

