import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import type { LanguageCode } from './i18n';

export interface MicrophonePermissionResult {
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'unknown';
  permanentlyDenied: boolean;
  message?: string;
}

/**
 * Handles the microphone permission flow.
 * Returns state: 'prompt' with granted: true so that the actual recording function
 * can invoke a single navigator.mediaDevices.getUserMedia({ audio: true }) call directly
 * to trigger the OS/browser permission prompt without double-stream HAL errors.
 */
export async function ensureMicrophonePermission(): Promise<MicrophonePermissionResult> {
  // Check if browser/environment supports mediaDevices
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      granted: false,
      state: 'unknown',
      permanentlyDenied: false,
      message: 'Microphone API (navigator.mediaDevices) is not supported in this browser.',
    };
  }

  return {
    granted: true,
    state: 'prompt',
    permanentlyDenied: false,
  };
}

/**
 * Opens system settings page so user can grant Microphone permission.
 * In Android APK / Capacitor native environment, opens the app info settings.
 */
export async function openMicrophoneSettings(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await BarcodeScanner.openSettings();
    } else {
      console.log('[MicrophonePermission] openSettings is only available in native environments.');
    }
  } catch (err) {
    console.warn('[MicrophonePermission] Failed to open system settings:', err);
  }
}

/**
 * Localized permission messages adapting to all active languages (tl, en, ja, zh, ko)
 */
export function getMicrophonePermissionStrings(lang: LanguageCode) {
  switch (lang) {
    case 'tl':
      return {
        title: 'Kailangan ang Pahintulot sa Mikropono',
        deniedMsg: 'Naka-off ang mikropono. Pindutin ang "Buksan ang Settings" sa ibaba upang payagan.',
        promptMsg: 'Kailangan ang permiso sa mikropono para makapagsalita at makapagtala ng benta nang offline.',
        allowBtn: 'I-permit ang Mikropono',
        openSettingsBtn: 'Buksan ang Settings',
        recheckBtn: 'I-refresh ang Pahintulot',
      };
    case 'ja':
      return {
        title: 'マイクのアクセス許可が必要です',
        deniedMsg: 'マイクの権限が無効です。下の「設定を開く」から許可してください。',
        promptMsg: '音声入力で売上やメモをオフライン記録するためにマイク許可が必要です。',
        allowBtn: 'マイクを許可する',
        openSettingsBtn: '設定を開く',
        recheckBtn: '権限を再確認',
      };
    case 'zh':
      return {
        title: '需要麦克风访问权限',
        deniedMsg: '麦克风权限已停用，请点击下方的“打开系统设置”进行开启。',
        promptMsg: '需要麦克风权限以通过语音离线记录销售与备忘。',
        allowBtn: '允许麦克风权限',
        openSettingsBtn: '打开系统设置',
        recheckBtn: '重新检查权限',
      };
    case 'ko':
      return {
        title: '마이크 권한이 필요합니다',
        deniedMsg: '마이크 권한이 비활성화되어 있습니다. 아래의 "설정 열기"를 눌러 허용해 주세요.',
        promptMsg: '음성으로 오프라인 매출 및 메모를 기록하려면 마이크 권한이 필요합니다.',
        allowBtn: '마이크 허용하기',
        openSettingsBtn: '설정 열기',
        recheckBtn: '권한 다시 확인',
      };
    case 'en':
    default:
      return {
        title: 'Microphone Permission Required',
        deniedMsg: 'Microphone permission is disabled. Tap "Open Settings" below to allow.',
        promptMsg: 'Microphone access is needed to record sales and notes by voice offline.',
        allowBtn: 'Allow Microphone',
        openSettingsBtn: 'Open Settings',
        recheckBtn: 'Re-check Permission',
      };
  }
}
