import { BleClient, type ScanResult } from '@capacitor-community/bluetooth-le';

export type BleSyncState =
  | 'UNSUPPORTED'   // device has no BLE hardware
  | 'READY'         // BLE available, not yet active
  | 'ADVERTISING'   // buyer broadcasting "waiting"
  | 'SCANNING'      // buyer listening for confirmation
  | 'SYNCED'        // confirmation received
  | 'FAILED'        // error occurred, fallback to QR-only
  | 'BT_OFF'        // Bluetooth is turned off in settings
  | 'LOCATION_OFF'; // Location/GPS is turned off (Android BLE requirement)

const SERVICE_UUID = '4c495c50-4954-4f4e-4341-504954414c00';

export class BleSyncManager {
  private state: BleSyncState = 'UNSUPPORTED';
  private listeners: Set<(state: BleSyncState) => void> = new Set();
  private initialized: boolean = false;
  private currentOrderId: string | null = null;
  private confirmationCallback: (() => void) | null = null;
  private advertiseTimeoutId: any = null;
  private listenTimeoutId: any = null;
  private retryTimeoutId: any = null;
  private sellerBurstTimeoutId: any = null;

  public getState(): BleSyncState {
    return this.state;
  }

  public onStateChange(callback: (state: BleSyncState) => void): () => void {
    this.listeners.add(callback);
    try {
      callback(this.state);
    } catch (_) {}
    return () => {
      this.listeners.delete(callback);
    };
  }

  private setState(newState: BleSyncState): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const listener of this.listeners) {
      try {
        listener(newState);
      } catch (_) {}
    }
  }

  public async initialize(): Promise<BleSyncState> {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      this.initialized = true;
      if (this.state === 'UNSUPPORTED') {
        this.setState('READY');
      }
      return this.state === 'UNSUPPORTED' ? 'READY' : this.state;
    } catch (err) {
      console.warn('[BleSyncManager] BLE initialization failed or unsupported:', err);
      this.initialized = false;
      this.setState('UNSUPPORTED');
      return 'UNSUPPORTED';
    }
  }

  public setBtOff(): void {
    this.setState('BT_OFF');
  }

  public setLocationOff(): void {
    this.setState('LOCATION_OFF');
  }

  public async startBuyerSync(orderId: string, onConfirmed?: () => void): Promise<void> {
    this.currentOrderId = orderId;
    if (onConfirmed) {
      this.confirmationCallback = onConfirmed;
    }

    try {
      const current = await this.initialize();
      if (current === 'UNSUPPORTED') {
        return;
      }

      // Check Bluetooth enablement
      const isBt = await BleClient.isEnabled().catch(() => true);
      if (!isBt) {
        this.setState('BT_OFF');
        return;
      }

      // Check Location Services / GPS (Android BLE requirement)
      const isLoc = await BleClient.isLocationEnabled().catch(() => true);
      if (!isLoc) {
        this.setState('LOCATION_OFF');
        return;
      }

      // Step 1: Start advertising "waiting" with 500ms retry logic
      await this.startAdvertisingWithRetry(orderId, 'waiting');

      // Step 2: Start scanning/listening for seller confirmation
      await this.startListening(orderId);
    } catch (err) {
      console.warn('[BleSyncManager] startBuyerSync encountered error:', err);
      this.setState('FAILED');
    }
  }

  private async startAdvertisingWithRetry(
    orderId: string,
    status: 'waiting' | 'confirmed',
    isRetry: boolean = false
  ): Promise<void> {
    const ble = BleClient as any;
    try {
      this.clearAdvertiseTimers();
      if (ble.stopAdvertising) {
        await ble.stopAdvertising().catch(() => {});
      }

      if (this.state !== 'SYNCED') {
        this.setState('ADVERTISING');
      }

      if (ble.advertise) {
        await ble.advertise({
          services: [SERVICE_UUID],
          device: { name: `Tinda-${orderId}-${status}` },
          timeout: 10000,
        });
      }

      // Auto-stop after 10 seconds to conserve battery
      this.advertiseTimeoutId = setTimeout(async () => {
        try {
          if (ble.stopAdvertising) await ble.stopAdvertising();
        } catch (_) {}
        // If advertising completed and still waiting for confirmation, set to SCANNING
        if (this.state === 'ADVERTISING') {
          this.setState('SCANNING');
        }
      }, 10000);
    } catch (err) {
      console.warn(`[BleSyncManager] Advertising attempt failed (retry=${isRetry}):`, err);
      if (!isRetry) {
        // Retry once after 500ms before marking as FAILED
        this.retryTimeoutId = setTimeout(() => {
          this.startAdvertisingWithRetry(orderId, status, true).catch(() => {
            if (this.state !== 'SYNCED') {
              this.setState('FAILED');
            }
          });
        }, 500);
      } else {
        if (this.state !== 'SYNCED') {
          this.setState('FAILED');
        }
      }
    }
  }

  private async startListening(orderId: string): Promise<void> {
    try {
      this.clearListenTimers();
      await BleClient.stopLEScan().catch(() => {});

      if (this.state !== 'ADVERTISING' && this.state !== 'SYNCED') {
        this.setState('SCANNING');
      }

      await BleClient.requestLEScan(
        {
          services: [SERVICE_UUID],
          allowDuplicates: true,
        },
        (result: ScanResult) => {
          const deviceName = result.device?.name || (result as any).localName || '';
          if (deviceName.includes(orderId) && deviceName.includes('confirmed')) {
            console.log('[BleSyncManager] Confirmation detected for orderId:', orderId);
            this.handleConfirmed();
          }
        }
      );

      // Auto-stop scanning after 35 minutes (5 min buffer past 30 min QR expiry)
      this.listenTimeoutId = setTimeout(async () => {
        try {
          await BleClient.stopLEScan();
        } catch (_) {}
      }, 35 * 60 * 1000);
    } catch (err) {
      console.warn('[BleSyncManager] Listening failed:', err);
      if (this.state !== 'SYNCED') {
        this.setState('FAILED');
      }
    }
  }

  private handleConfirmed(): void {
    this.setState('SYNCED');
    this.clearAdvertiseTimers();
    this.clearListenTimers();
    const ble = BleClient as any;
    BleClient.stopLEScan().catch(() => {});
    if (ble.stopAdvertising) ble.stopAdvertising().catch(() => {});

    if (this.confirmationCallback) {
      const cb = this.confirmationCallback;
      this.confirmationCallback = null;
      try {
        cb();
      } catch (err) {
        console.error('[BleSyncManager] Error in confirmation callback:', err);
      }
    }
  }

  public async startSellerConfirm(orderId: string): Promise<void> {
    const ble = BleClient as any;
    try {
      const current = await this.initialize();
      if (current === 'UNSUPPORTED') return;

      // Stop any existing advertising
      if (ble.stopAdvertising) await ble.stopAdvertising().catch(() => {});

      // Phase 2: Extend the confirmation broadcast from single-shot to re-advertise for 3-5 seconds continuously.
      // This ensures buyer's device has enough time window to catch the signal even with radio delays.
      if (ble.advertise) {
        await ble.advertise({
          services: [SERVICE_UUID],
          device: { name: `Tinda-${orderId}-confirmed` },
          timeout: 5000,
        });
      }

      if (this.sellerBurstTimeoutId) clearTimeout(this.sellerBurstTimeoutId);
      this.sellerBurstTimeoutId = setTimeout(async () => {
        try {
          if (ble.stopAdvertising) await ble.stopAdvertising();
        } catch (_) {}
      }, 4500);
    } catch (err) {
      console.warn('[BleSyncManager] Seller confirmation initial broadcast failed, retrying once in 500ms:', err);
      setTimeout(async () => {
        try {
          if (ble.advertise) {
            await ble.advertise({
              services: [SERVICE_UUID],
              device: { name: `Tinda-${orderId}-confirmed` },
              timeout: 4000,
            });
          }
        } catch (_) {}
      }, 500);
    }
  }

  public async pauseSync(): Promise<void> {
    if (this.state === 'SCANNING' || this.state === 'ADVERTISING') {
      try {
        const ble = BleClient as any;
        await BleClient.stopLEScan().catch(() => {});
        if (ble.stopAdvertising) await ble.stopAdvertising().catch(() => {});
      } catch (_) {}
    }
  }

  public async resumeSync(): Promise<void> {
    if (
      this.currentOrderId &&
      (this.state === 'SCANNING' ||
        this.state === 'ADVERTISING' ||
        this.state === 'BT_OFF' ||
        this.state === 'LOCATION_OFF')
    ) {
      try {
        const isBt = await BleClient.isEnabled().catch(() => true);
        if (!isBt) {
          this.setState('BT_OFF');
          return;
        }
        const isLoc = await BleClient.isLocationEnabled().catch(() => true);
        if (!isLoc) {
          this.setState('LOCATION_OFF');
          return;
        }
        await this.startListening(this.currentOrderId);
      } catch (_) {}
    }
  }

  public async stopAdvertising(): Promise<void> {
    this.clearAdvertiseTimers();
    try {
      const ble = BleClient as any;
      if (ble.stopAdvertising) await ble.stopAdvertising();
    } catch (_) {}
  }

  public async stopScanning(): Promise<void> {
    this.clearListenTimers();
    try {
      await BleClient.stopLEScan();
    } catch (_) {}
  }

  private clearAdvertiseTimers(): void {
    if (this.advertiseTimeoutId) {
      clearTimeout(this.advertiseTimeoutId);
      this.advertiseTimeoutId = null;
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private clearListenTimers(): void {
    if (this.listenTimeoutId) {
      clearTimeout(this.listenTimeoutId);
      this.listenTimeoutId = null;
    }
  }

  public cleanup(): void {
    this.currentOrderId = null;
    this.confirmationCallback = null;
    this.clearAdvertiseTimers();
    this.clearListenTimers();
    if (this.sellerBurstTimeoutId) {
      clearTimeout(this.sellerBurstTimeoutId);
      this.sellerBurstTimeoutId = null;
    }
    const ble = BleClient as any;
    if (ble.stopAdvertising) ble.stopAdvertising().catch(() => {});
    BleClient.stopLEScan().catch(() => {});
    if (this.state !== 'UNSUPPORTED') {
      this.setState('READY');
    }
  }
}

export const bleSyncManager = new BleSyncManager();

// Helper exports for backwards compatibility
export async function isBleSupported(): Promise<boolean> {
  const s = await bleSyncManager.initialize();
  return s !== 'UNSUPPORTED';
}

export async function startBleAdvertising(orderId: string, status: 'waiting' | 'confirmed'): Promise<void> {
  if (status === 'confirmed') {
    await bleSyncManager.startSellerConfirm(orderId);
  } else {
    await bleSyncManager.startBuyerSync(orderId);
  }
}

export async function stopBleAdvertising(): Promise<void> {
  await bleSyncManager.stopAdvertising();
}

export async function startBleListening(orderId: string, onConfirmed: () => void): Promise<void> {
  await bleSyncManager.startBuyerSync(orderId, onConfirmed);
}

export async function stopBleListening(): Promise<void> {
  await bleSyncManager.stopScanning();
}

