import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Camera,
  Flashlight,
  RefreshCw,
  Scan,
  AlertCircle,
  Plus,
  Package,
  Search,
  Sparkles,
  Barcode,
  Type,
  CheckCircle2,
  Settings,
  Bug,
  Moon,
  Power,
  Zap,
  QrCode,
  Upload,
} from 'lucide-react';
import { db } from '../db/db';
import type { InventoryItem } from '../types';
import { translate, type LanguageCode } from '../utils/i18n';
import { ItemRecognizedModal, type CartItemEntry } from './ItemRecognizedModal';
import { playScanBeep } from '../utils/audioBeep';
import { formatPeso } from '../utils/formatters';
import {
  ensureCameraPermission,
  openCameraSettings,
  prepareGoogleBarcodeScannerModule,
  prepareGoogleTextRecognitionModule,
  type MlKitModuleStatus,
} from '../utils/scannerPermission';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import LZString from 'lz-string';
import jsQR from 'jsqr';
import type { BuyerOrderPayload } from './BuyerOrderModal';
import { safeStorage } from '../utils/safeStorage';

const getScannerTitle = (scanType: 'all' | 'qr_only' | 'search' | string | undefined, lang: LanguageCode) => {
  if (scanType === 'search') {
    return lang === 'tl' ? 'I-scan para Hanapin' : 'Scan to Search';
  }
  if (scanType === 'qr_only') {
    switch (lang) {
      case 'ja':
        return '店舗カタログQRをスキャン';
      case 'zh':
        return '扫描店铺目录二维码';
      case 'ko':
        return '매장 카탈로그 QR 스캔';
      case 'en':
        return 'Scan Store Catalog QR';
      case 'tl':
      default:
        return 'I-scan ang Store Catalog QR';
    }
  }
  return translate(lang, 'scanner_title') || 'Product Scanner';
};

const getScannerReticleText = (
  scanType: 'all' | 'qr_only' | 'search' | string | undefined,
  scanMode: 'barcode' | 'text',
  lang: LanguageCode
) => {
  if (scanType === 'search') {
    return lang === 'tl' ? 'Itutok ang barcode dito' : 'Center barcode here';
  }
  if (scanType === 'qr_only') {
    switch (lang) {
      case 'ja':
        return '店舗QRコードを中央に配置';
      case 'zh':
        return '将店铺二维码对准中央';
      case 'ko':
        return '매장 QR 코드를 중앙에 맞추세요';
      case 'en':
        return 'Center Store QR code here';
      case 'tl':
      default:
        return 'Itutok ang Store QR code dito';
    }
  }
  if (scanMode === 'text') {
    return lang === 'tl' ? 'Inihanay ang teksto o presyo dito' : 'Align product name or price here';
  }
  return lang === 'tl' ? 'Itutok ang barcode dito' : 'Center barcode here';
};

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddItem: (prefill: { name?: string; sku?: string; itemType?: 'STANDARD' | 'PACK_VARIETY' }) => void;
  onOpenAddModal?: (prefill: { name?: string; sku?: string; itemType?: 'STANDARD' | 'PACK_VARIETY' }) => void;
  onTransactionSuccess?: (message: string) => void;
  onScanSuccess?: (detectedText: string) => void;
  onScannedBuyerOrder?: (order: BuyerOrderPayload) => void;
  onScannedStoreCatalog?: (rawString: string) => void;
  scanType?: 'all' | 'qr_only' | 'search';
  lang: LanguageCode;
}

// Tesseract whitelist character set
export const TESSERACT_CHAR_WHITELIST =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789₱.,-/% ';

// Normalizes OCR recognized text, cleans spaced digits/prices, and strips unreadable noise
function normalizeOcrText(rawText: string): string {
  if (!rawText) return '';
  // 1. Remove spaces inside numbers and decimals (e.g. "2 5 . 0 0" -> "25.00", "1 5 0" -> "150")
  let cleaned = rawText.replace(/(\d)\s+(\d)/g, '$1$2');
  cleaned = cleaned.replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2');
  // 2. Fix spaced Philippine peso currency strings (e.g. "₱ 25.00" -> "₱25.00", "PHP 50" -> "₱50")
  cleaned = cleaned.replace(/(?:₱|PHP|Php|P)\s*(\d+(?:\.\d{1,2})?)/gi, '₱$1');
  // 3. Enforce Tesseract character whitelist
  cleaned = cleaned.replace(/[^A-Za-z0-9₱.,\-/% \s]/g, ' ');
  // 4. Collapse consecutive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

// Stricter OCR line validation to eliminate noise and gibberish
function isValidOcrLine(line: string): boolean {
  if (!line || line.trim().length === 0) return false;
  const trimmed = line.trim();

  // 1. Maximum length: 35 characters
  if (trimmed.length > 35) return false;

  // 2. Reject more than 2 consecutive identical characters (e.g., "aaa", "111")
  if (/(.)\1\1/.test(trimmed)) return false;

  // 3. Must contain at least one vowel (a, e, i, o, u)
  if (!/[aeiou]/i.test(trimmed)) return false;

  // 4. Single-word lines must be at least 4 characters long
  const words = trimmed.split(/\s+/);
  if (words.length === 1 && words[0].length < 4) return false;

  // 5. Must not have more special characters than letters
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const specCount = (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (specCount > letterCount) return false;

  return true;
}

// Fuzzy OCR character normalization to handle common camera character misreadings
function normalizeOcrFuzzy(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[0o]/g, '0')
    .replace(/[1il]/g, '1')
    .replace(/[5s]/g, '5')
    .replace(/[8b]/g, '8')
    .replace(/[^a-z0-9]/g, '');
}

// Levenshtein similarity ratio between two normalized strings (0.0 to 1.0)
function getSimilarityRatio(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

// Check temporal consistency across last 3 frames (at least 2 matches required)
function isTemporallyConsistent(candidate: string, history: string[][]): boolean {
  if (!candidate || history.length < 2) return false;
  const normCand = normalizeOcrFuzzy(candidate);
  const candLower = candidate.toLowerCase();

  let matchFrameCount = 0;
  for (const frameLines of history) {
    const matchedInFrame = frameLines.some((line) => {
      const lineLower = line.toLowerCase();
      const normLine = normalizeOcrFuzzy(line);
      if (lineLower.includes(candLower) || candLower.includes(lineLower)) {
        return true;
      }
      if (normCand.length >= 3 && normLine.length >= 3) {
        if (getSimilarityRatio(normCand, normLine) >= 0.82) return true;
      }
      return false;
    });
    if (matchedInFrame) matchFrameCount++;
  }
  return matchFrameCount >= 2;
}

// Filter and rank top 3 recommended product name candidates
function filterAndRankRecommendedNames(extractedLines: string[]): string[] {
  if (!extractedLines || extractedLines.length === 0) return [];

  const noiseKeywords = [
    'ingredient',
    'nutrition',
    'manufactur',
    'expirat',
    'expiry',
    'batch',
    'customer',
    'keep in',
    'store in',
    'serving',
    'net wt',
    'distribut',
    'product of',
    'address',
    'tel no',
    'email',
    'www.',
    'http',
    'copyright',
    'made in',
    'best before',
    'lot no',
    'batch no',
    'mfg',
    'exp',
    'bb',
    'use by',
    'www',
    '.com',
    '.ph',
    'facebook',
    'instagram',
    'scan',
    'barcode',
    'allergen',
    'contains',
    'calories',
    'protein',
    'fat',
    'carb',
    'sugar',
    'serving size',
    'per 100',
    'nutrition facts',
  ];

  const validCandidates: string[] = [];

  for (const rawLine of extractedLines) {
    let line = rawLine.trim();
    if (!line || !isValidOcrLine(line)) continue;

    // Clean leading/trailing punctuation noise
    line = line.replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();
    if (line.length < 3) continue;

    const lower = line.toLowerCase();

    // 1. Packaging noise filter
    if (noiseKeywords.some((kw) => lower.includes(kw))) {
      continue;
    }

    // 2. Letter / word length filter: must contain letters/words with length >= 3
    const words = line.split(/\s+/);
    const hasValidLetterWord = words.some((w) => w.replace(/[^a-zA-Z]/g, '').length >= 3);
    const hasValidDigitGroup = /\d{2,}/.test(line);

    if (!hasValidLetterWord && !hasValidDigitGroup) {
      continue;
    }

    // 3. Weight / Measurement filter (grams, kg, ml, L): must be >= 0.1g / 0.1ml / 0.1kg / 0.1L
    const weightMatch = line.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b/i);
    if (weightMatch) {
      const val = parseFloat(weightMatch[1]);
      if (isNaN(val) || val < 0.1) {
        continue; // Skip 0g or invalid measurement
      }
    }

    // 4. Price filter (₱, P, Php): must be >= ₱0.10
    const priceMatch = line.match(/(?:₱|PHP|Php|P)\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      const val = parseFloat(priceMatch[1]);
      if (isNaN(val) || val < 0.1) {
        continue; // Skip ₱0 or ₱0.00
      }
    }

    // Title case formatting for neat product readability
    const formattedLine = line
      .split(' ')
      .map((w) => (w.length > 1 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');

    // Check line total character count (at least 3 characters)
    if (
      formattedLine.length >= 3 &&
      !validCandidates.some((c) => c.toLowerCase() === formattedLine.toLowerCase())
    ) {
      validCandidates.push(formattedLine);
    }
  }

  // Return up to 3 clean candidates
  return validCandidates.slice(0, 3);
}

// Barcode Checksum Validation Helpers
function validateEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = parseInt(code[12], 10);
  return (sum + checkDigit) % 10 === 0;
}

function validateEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const checkDigit = parseInt(code[7], 10);
  return (sum + checkDigit) % 10 === 0;
}

function validateUPCA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const checkDigit = parseInt(code[11], 10);
  return (sum + checkDigit) % 10 === 0;
}

function validateBarcode(code: string): boolean {
  if (!code) return false;
  // Non-numeric codes are 2D QR codes, alphanumeric SKUs, or Code-128 - bypass 1D checksums
  if (!/^\d+$/.test(code)) return true;
  if (code.length === 13) return validateEAN13(code);
  if (code.length === 8) return validateEAN8(code);
  if (code.length === 12) return validateUPCA(code);
  return true; // Other lengths / formats
}

/**
 * Checks Google Play Services availability for BarcodeScanner ML Kit
 */
async function checkIfGooglePlayServicesAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }
  try {
    if (
      typeof BarcodeScanner !== 'undefined' &&
      typeof BarcodeScanner.isGoogleBarcodeScannerModuleAvailable === 'function'
    ) {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      return !!available;
    }
    return false;
  } catch (_) {
    return false;
  }
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onOpenAddItem,
  onTransactionSuccess,
  onScanSuccess,
  onScannedBuyerOrder,
  onScannedStoreCatalog,
  scanType = 'all',
  lang,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const isProcessingOcrRef = useRef<boolean>(false);
  const isProcessingFrameRef = useRef<boolean>(false);
  const lastTextScanTimeRef = useRef<number>(0);
  const barcodeDetectorRef = useRef<any>(null);
  const isNativeScannerActiveRef = useRef(false);
  const isWebViewCameraActiveRef = useRef(false);
  const cameraTransitioningRef = useRef(false);
  const isMountedRef = useRef<boolean>(true);
  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;

  // Adaptive Scanner: Device Tier & Google Play Services Refs & State
  const deviceTierRef = useRef<'high' | 'mid' | 'low'>('mid');
  const hasGooglePlayServicesRef = useRef<boolean>(false);
  const [deviceTier, setDeviceTier] = useState<'high' | 'mid' | 'low'>('mid');
  const [hasGooglePlayServices, setHasGooglePlayServices] = useState<boolean>(false);

  // STEP 1: Device Tier Detection (runs once on mount)
  useEffect(() => {
    let isCancelled = false;
    const detectTier = async () => {
      const ram = (navigator as any).deviceMemory || 2;
      const tier: 'high' | 'mid' | 'low' = ram >= 3 ? 'high' : ram >= 2 ? 'mid' : 'low';
      deviceTierRef.current = tier;
      if (!isCancelled) setDeviceTier(tier);

      const hasGPS = await checkIfGooglePlayServicesAvailable();
      hasGooglePlayServicesRef.current = hasGPS;
      if (!isCancelled) setHasGooglePlayServices(hasGPS);
    };

    detectTier();
    return () => {
      isCancelled = true;
    };
  }, []);

  const shouldUseNativeScanner = useCallback(() => {
    return (
      deviceTierRef.current === 'high' &&
      hasGooglePlayServicesRef.current &&
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === 'android'
    );
  }, []);

  // Dual-mode state: 'barcode' vs 'text' (OCR)
  const [scanMode, setScanMode] = useState<'barcode' | 'text'>('barcode');
  const [isAiVisionLoading, setIsAiVisionLoading] = useState<boolean>(false);

  // Diagnostic HUD Overlay State for ML Kit Debugging
  const [showHud, setShowHud] = useState<boolean>(true);
  const [moduleStatus, setModuleStatus] = useState<MlKitModuleStatus | string>('BUNDLED/OK');
  const [frameTick, setFrameTick] = useState<number>(0);
  const [videoCanvasDims, setVideoCanvasDims] = useState<string>('0x0 -> 0x0');
  const [base64PayloadSize, setBase64PayloadSize] = useState<string>('0 chars');
  const [rawMlKitText, setRawMlKitText] = useState<string>('');
  const [lastOcrError, setLastOcrError] = useState<string>('None');

  // Checksum & Barcode Validation HUD Counters
  const [validScanCount, setValidScanCount] = useState<number>(0);
  const [rejectedScanCount, setRejectedScanCount] = useState<number>(0);
  const [lastRejectedBarcode, setLastRejectedBarcode] = useState<string>('');
  const [lastRejectedReason, setLastRejectedReason] = useState<string>('');
  const startNativeScanRef = useRef<(() => Promise<void>) | null>(null);

  // 2-Pass Hold-Steady Countdown State for OCR
  const [scanPhase, setScanPhase] = useState<'IDLE' | 'COUNTDOWN' | 'CONFIRMED'>('IDLE');
  const [countdown, setCountdown] = useState<number>(3);
  const [candidateText, setCandidateText] = useState<string | null>(null);
  const [recommendedNames, setRecommendedNames] = useState<string[]>([]);
  const candidateItemRef = useRef<InventoryItem | null>(null);
  const ocrHistoryRef = useRef<string[][]>([]);

  // Tap-to-Focus Visual Indicator Point
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number; id: number } | null>(null);

  // Camera Viewport Container Ref
  const cameraContainerRef = useRef<HTMLDivElement | null>(null);

  // Center Reticle Element Ref
  const reticleRef = useRef<HTMLDivElement | null>(null);

  // Tap-Targeted OCR State & Refs
  const tapTargetRef = useRef<{
    x: number;
    y: number;
    active: boolean;
  }>({ x: 0, y: 0, active: false });

  const TAP_BOX_WIDTH = 160;
  const TAP_BOX_HEIGHT = 90;
  const TAP_RESET_TIMEOUT = 5000; // auto reset after 5s
  const tapResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const [tapPosition, setTapPosition] = useState<{
    x: number;
    y: number;
    active: boolean;
  }>({ x: 0, y: 0, active: false });

  // Reset tap target to center
  const resetTapTarget = useCallback(() => {
    tapTargetRef.current = { x: 0, y: 0, active: false };
    setTapPosition({ x: 0, y: 0, active: false });
    if (tapResetTimerRef.current) {
      clearTimeout(tapResetTimerRef.current);
      tapResetTimerRef.current = null;
    }
    lastTapTimeRef.current = 0;
  }, []);

  // Device-tier responsive tap box size (Low tier uses 200x112 for lower resolution cameras)
  const getTapBoxDimensions = useCallback(() => {
    if (deviceTierRef.current === 'low') {
      return { width: 200, height: 112 };
    }
    return { width: TAP_BOX_WIDTH, height: TAP_BOX_HEIGHT };
  }, []);

  // Stabilized candidate scoring & anti-jitter refs for uncatalogued products
  const candidateScoresRef = useRef<Map<string, { text: string; count: number; lastSeen: number }>>(new Map());
  const lastCandidateUpdateRef = useRef<number>(0);
  const lastTextDetectedTimeRef = useRef<number>(0);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const userTorchPreferenceRef = useRef<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Initializing camera...');

  // 60-Second Inactivity Sleep Timer Ref
  const inactivityTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscroll || '';
    };
  }, [isOpen]);

  // Recognition outcome states
  const [recognizedItem, setRecognizedItem] = useState<InventoryItem | null>(null);
  const [detectedCode, setDetectedCode] = useState<string>('');
  const [detectedText, setDetectedText] = useState<string>('');
  const [isUnrecognizedFallback, setIsUnrecognizedFallback] = useState<boolean>(false);
  const [manualSearchInput, setManualSearchInput] = useState<string>('');

  // Multi-Item Scanned Cart State for rapid batch selling
  const [cartItems, setCartItems] = useState<CartItemEntry[]>([]);

  // QR Photo Upload Fallback (Minimal RAM, zero camera battery consumption)
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleQrPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatusText(
        lang === 'tl'
          ? 'Binabasa ang larawan ng QR...'
          : lang === 'ja'
          ? 'QR画像を解析中...'
          : lang === 'zh'
          ? '正在解析二维码图片...'
          : lang === 'ko'
          ? 'QR 이미지 분석 중...'
          : 'Analyzing QR image...'
      );

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!tempCtx) return;

        // Downscale photos (e.g. 12MP-48MP camera photos) to max 1200px to avoid memory spikes
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        tempCanvas.width = Math.round(img.width * scale);
        tempCanvas.height = Math.round(img.height * scale);
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

        let detected: string | null = null;

        // Try BarcodeDetector first (Native C++ zero-copy)
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(tempCanvas);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              detected = barcodes[0].rawValue.trim();
            }
          } catch (_) {}
        }

        // Fallback to jsQR
        if (!detected) {
          try {
            const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const qrCode = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (qrCode && qrCode.data) {
              detected = qrCode.data.trim();
            }
          } catch (err) {
            console.warn('[ScannerModal] QR photo jsQR error:', err);
          }
        }

        // Immediately release canvas buffer to keep RAM usage minimal
        tempCanvas.width = 1;
        tempCanvas.height = 1;

        if (detected) {
          resetInactivityTimer();
          await handleScannedBarcode(detected);
        } else {
          setStatusText(
            lang === 'tl'
              ? 'Walang nakitang QR code sa larawan. Subukan muli.'
              : lang === 'ja'
              ? '画像内にQRコードが見つかりませんでした。'
              : lang === 'zh'
              ? '未在图片中检测到二维码，请重试。'
              : lang === 'ko'
              ? '이미지에서 QR 코드를 찾을 수 없습니다. 다시 시도해 주세요.'
              : 'No QR code detected in the image. Please try again.'
          );
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setStatusText(lang === 'tl' ? 'Hindi ma-load ang larawan.' : 'Failed to load image.');
      };

      img.src = objectUrl;
    } catch (err) {
      console.error('[ScannerModal] QR photo upload catch:', err);
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Vibration feedback
  const triggerHapticFeedback = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch (_) {}
    }
  };

  // Reset inactivity sleep timer (25 seconds automatic timeout to preserve battery and prevent heating)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    // Only schedule sleep timer if modal is open and not already sleeping or recognized
    inactivityTimerRef.current = setTimeout(() => {
      setIsSleeping(true);
      // HARDWARE BATTERY SAVER: Turn off torch and stop camera hardware tracks completely on sleep
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsTorchOn(false);
    }, 25000);
  }, []);

  // Reset 2-Pass OCR Hold-Steady State Machine
  const resetOcrState = useCallback(() => {
    setScanPhase('IDLE');
    setCountdown(3);
    setCandidateText(null);
    setRecommendedNames([]);
    candidateItemRef.current = null;
    ocrHistoryRef.current = [];
    candidateScoresRef.current.clear();
    lastCandidateUpdateRef.current = 0;
    lastTextDetectedTimeRef.current = 0;
    resetTapTarget();
  }, [resetTapTarget]);

  // Apply physical hardware torch setting
  const applyPhysicalTorch = useCallback(async (turnOn: boolean) => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          await (track as any).applyConstraints({
            advanced: [{ torch: turnOn }],
          });
          setIsTorchOn(turnOn);
        }
      }
    } catch (e) {
      console.warn('[ScannerModal] applyPhysicalTorch failed:', e);
    }
  }, []);

  // Hardware Autofocus Handler (Continuous Autofocus & Tap-to-Focus)
  const triggerCameraAutofocus = useCallback(async (point?: { x: number; y: number }) => {
    if (!streamRef.current) return;
    try {
      const [videoTrack] = streamRef.current.getVideoTracks();
      if (!videoTrack || typeof videoTrack.applyConstraints !== 'function') return;

      const capabilities: any =
        typeof videoTrack.getCapabilities === 'function' ? videoTrack.getCapabilities() : {};
      const advancedConstraint: any = {};

      if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
        if (capabilities.focusMode.includes('continuous')) {
          advancedConstraint.focusMode = 'continuous';
        } else if (capabilities.focusMode.includes('single-shot')) {
          advancedConstraint.focusMode = 'single-shot';
        }
      }

      if (point && capabilities.pointsOfInterest) {
        advancedConstraint.pointsOfInterest = [{ x: point.x, y: point.y }];
      }

      if (Object.keys(advancedConstraint).length > 0) {
        await videoTrack.applyConstraints({
          advanced: [advancedConstraint],
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[ScannerModal] Autofocus adjustment error:', err);
    }
  }, []);

  // Common Barcode Lookup in Dexie Database
  const handleScannedBarcode = useCallback(async (barcodeVal: string) => {
    const cleanCode = barcodeVal.trim();
    if (!cleanCode) return;

    // 0. Dedicated QR-only or Search Mode: Pass scanned payload directly to onScanSuccess with zero barcode overhead
    if (scanType === 'qr_only' || scanType === 'search') {
      setIsScanning(false);
      applyPhysicalTorch(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      playScanBeep('success');
      triggerHapticFeedback();
      onScanSuccess?.(cleanCode);
      return;
    }

    // Check if code is a compressed or JSON Buyer Order / Store Catalog payload
    try {
      let decompressed = LZString.decompressFromEncodedURIComponent(cleanCode);
      if (!decompressed) decompressed = LZString.decompressFromBase64(cleanCode);
      if (!decompressed) decompressed = cleanCode;

      if (decompressed.startsWith('{') && decompressed.endsWith('}')) {
        const parsed = JSON.parse(decompressed);

        // 1. BUYER ORDER CHECK (MUST BE FIRST to prevent storeName collision with Store Catalog)
        if (
          parsed &&
          (parsed.type === 'BUYER_ORDER' || parsed.t === 'BO') &&
          (Array.isArray(parsed.items) || Array.isArray(parsed.i))
        ) {
          // Normalize items if compact array tuples are used
          let orderItems = parsed.items || [];
          if (Array.isArray(parsed.i) && (!parsed.items || parsed.items.length === 0)) {
            orderItems = parsed.i.map((tuple: any) => {
              if (Array.isArray(tuple)) {
                return {
                  name: tuple[0],
                  qty: tuple[1],
                  price: tuple[2],
                  sku: tuple[3],
                  variantLabel: tuple[4],
                };
              }
              return tuple;
            });
          }
          parsed.items = orderItems;

          // Check if already processed to flag as verified/re-scan
          const processed: string[] = safeStorage.getJSON<string[]>('processed_buyer_orders', []);
          if (processed.includes(parsed.id)) {
            parsed.isAlreadyProcessed = true;
          }

          // Valid Buyer Order -> trigger handler
          setIsScanning(false);
          playScanBeep('success');
          triggerHapticFeedback();
          applyPhysicalTorch(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          if (onScannedBuyerOrder) {
            onScannedBuyerOrder(parsed);
          } else {
            setStatusText(
              lang === 'tl'
                ? `Order mula kay ${parsed.buyerName || 'Buyer'} (${parsed.items.length} paninda)`
                : `Order from ${parsed.buyerName || 'Buyer'} (${parsed.items.length} items)`
            );
          }
          return;
        }

        // 2. STORE CATALOG QR CHECK (scanned in general mode or qr_only mode)
        if (
          parsed &&
          parsed.type !== 'BUYER_ORDER' &&
          (parsed.type === 'STORE_CATALOG' ||
            parsed.storeName ||
            parsed.t === 'SC' ||
            parsed.s ||
            Array.isArray(parsed.i) ||
            parsed.v === 5) // Support new version
        ) {
          setIsScanning(false);
          applyPhysicalTorch(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          playScanBeep('success');
          triggerHapticFeedback();
          if (onScannedStoreCatalog) {
            onScannedStoreCatalog(cleanCode);
          } else {
            onScanSuccess?.(cleanCode);
          }
          return;
        }
      }
    } catch (_) {
      // Not a JSON/Buyer QR, proceed to barcode validation
    }

    // Checksum & format validation check strictly for 1D numeric barcodes (8, 12, 13 digits)
    const isStandard1DNumeric = /^\d{8}$|^\d{12}$|^\d{13}$/.test(cleanCode);
    if (isStandard1DNumeric && !validateBarcode(cleanCode)) {
      setIsScanning(false);
      setRejectedScanCount((prev) => prev + 1);
      setLastRejectedBarcode(cleanCode);
      setLastRejectedReason(
        lang === 'tl'
          ? 'Mali ang checksum o pormat ng barcode'
          : 'Invalid barcode checksum or format'
      );
      playScanBeep('error');
      setStatusText(
        lang === 'tl'
          ? 'Mali ang nabasang barcode. Mag-scan ulit.'
          : 'Barcode misread. Please scan again.'
      );
      setTimeout(() => {
        setIsScanning(true);
        if (shouldUseNativeScanner() && scanMode === 'barcode') {
          startNativeScanRef.current?.();
        }
      }, 1500);
      return;
    }

    setValidScanCount((prev) => prev + 1);
    setDetectedCode(cleanCode);
    triggerHapticFeedback();

    const matchedBySku = await db.inventory
      .where('sku')
      .equalsIgnoreCase(cleanCode)
      .first();

    if (matchedBySku) {
      setIsScanning(false);
      setRecognizedItem(matchedBySku);
      // Temporarily dim/turn off torch and stop camera stream while reviewing product recognized modal
      applyPhysicalTorch(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      playScanBeep('success');
      setStatusText(lang === 'tl' ? 'Natukoy ang paninda!' : 'Item recognized by barcode!');
      onScanSuccess?.(matchedBySku.name);
    } else {
      // Barcode detected but not found in db: Show unrecognized fallback with prefilled SKU
      setIsScanning(false);
      setIsUnrecognizedFallback(true);
      applyPhysicalTorch(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      playScanBeep('error');
      setStatusText(
        lang === 'tl'
          ? 'Hindi pa nakatala ang barcode na ito. Idagdag sa paninda?'
          : 'Barcode not found in inventory. Add item?'
      );
      onScanSuccess?.(cleanCode);
    }
  }, [applyPhysicalTorch, lang, onScanSuccess]);

  // Common Text/OCR Lookup in Dexie Database
  const handleScannedText = useCallback(async (textVal: string, matchedItem?: InventoryItem) => {
    const cleanText = textVal.trim();
    if (!cleanText) return;

    setDetectedText(cleanText);
    triggerHapticFeedback();

    if (matchedItem) {
      setIsScanning(false);
      setRecognizedItem(matchedItem);
      applyPhysicalTorch(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      playScanBeep('success');
      setStatusText(lang === 'tl' ? 'Natukoy ang paninda sa teksto!' : 'Item recognized by text!');
      onScanSuccess?.(matchedItem.name);
    } else {
      // Unrecognized text -> fallback card
      setIsScanning(false);
      setIsUnrecognizedFallback(true);
      applyPhysicalTorch(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      playScanBeep('error');
      setStatusText(
        lang === 'tl'
          ? `Nabasa ang teksto: "${cleanText}". Idagdag sa paninda?`
          : `Recognized text: "${cleanText}". Add item to inventory?`
      );
      onScanSuccess?.(cleanText);
    }
  }, [applyPhysicalTorch, lang, onScanSuccess]);

  // AI Vision Lens for Stylized Packaging & 3D / Bubble Fonts
  const handleAiVisionLens = useCallback(async () => {
    if (isAiVisionLoading) return;
    setIsAiVisionLoading(true);
    setStatusText(
      lang === 'tl'
        ? '✨ AI Vision Lens: Sinusuri ang stylized packaging...'
        : '✨ AI Vision Lens: Analyzing stylized packaging...'
    );

    try {
      let base64Image = '';
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL('image/jpeg', 0.85);
        }
      }

      if (!base64Image) {
        throw new Error('Unable to capture camera frame');
      }

      const allInventory = await db.inventory.toArray();
      const inventoryList = allInventory.map((i) => ({
        name: i.name,
        sku: i.sku || '',
        price: i.unitPrice,
      }));

      const response = await fetch('/api/gemini/recognize-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image, inventoryList }),
      });

      const data = await response.json();

      if (data && data.productName) {
        const recognizedTitle = data.productName;
        const lower = recognizedTitle.toLowerCase();

        // Check if item exists in inventory
        const matched = allInventory.find(
          (inv) =>
            inv.name.toLowerCase() === lower ||
            (data.matchedSku && inv.sku && inv.sku.toLowerCase() === data.matchedSku.toLowerCase()) ||
            lower.includes(inv.name.toLowerCase()) ||
            inv.name.toLowerCase().includes(lower)
        );

        if (matched) {
          setIsScanning(false);
          setRecognizedItem(matched);
          applyPhysicalTorch(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          playScanBeep('success');
          setStatusText(
            lang === 'tl'
              ? `✨ Natukoy ng AI Vision: "${matched.name}"`
              : `✨ Recognized by AI Vision: "${matched.name}"`
          );
          onScanSuccess?.(matched.name);
        } else {
          setIsScanning(false);
          setIsUnrecognizedFallback(true);
          setDetectedText(recognizedTitle);
          applyPhysicalTorch(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          playScanBeep('error');
          setStatusText(
            lang === 'tl'
              ? `✨ Nabasa ng AI Vision: "${recognizedTitle}". Idagdag sa paninda?`
              : `✨ Extracted by AI Vision: "${recognizedTitle}". Add item to inventory?`
          );
          onScanSuccess?.(recognizedTitle);
        }
      } else {
        throw new Error(data?.error || 'Could not recognize product title');
      }
    } catch (err: any) {
      console.error('[ScannerModal] AI Vision Lens error:', err);
      playScanBeep('error');
      setStatusText(
        lang === 'tl'
          ? 'Hindi mabasa ang packaging. Subukang itapat nang maayos.'
          : 'Could not read packaging. Center item clearly and retry.'
      );
    } finally {
      setIsAiVisionLoading(false);
    }
  }, [applyPhysicalTorch, isAiVisionLoading, lang, onScanSuccess]);

  // FIX 6: stopWebViewCamera() Helper
  const stopWebViewCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    isWebViewCameraActiveRef.current = false;
    // Clear OCR interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  // FIX 2: Camera Retry Mechanism
  const startCameraWithRetry = useCallback(
    async (maxRetries = 3, delayMs = 400): Promise<MediaStream | null> => {
      for (let i = 0; i < maxRetries; i++) {
        if (!isOpenRef.current || !isMountedRef.current) return null;
        try {
          let stream: MediaStream | null = null;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: cameraFacing,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch (constraintErr) {
            // Fallback for budget/older devices rejecting ideal dimensions
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: cameraFacing },
              audio: false,
            });
          }

          if (!stream) {
            throw new Error('No media stream returned');
          }

          if (!isOpenRef.current || !isMountedRef.current) {
            stream.getTracks().forEach((t) => {
              try {
                t.stop();
              } catch (_) {}
            });
            return null;
          }

          // Continuous autofocus if supported
          try {
            const [videoTrack] = stream.getVideoTracks();
            if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
              const capabilities: any = typeof videoTrack.getCapabilities === 'function' ? videoTrack.getCapabilities() : {};
              if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
                await videoTrack.applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as any],
                }).catch(() => {});
              }
            }
          } catch (_) {}

          // Attach stream to video element
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.muted = true;
            try {
              await videoRef.current.play();
            } catch (_) {}
          }

          streamRef.current = stream;
          isWebViewCameraActiveRef.current = true;
          setIsScanning(true);

          if (scanMode === 'text') {
            setStatusText(
              lang === 'tl'
                ? 'Inihanay ang teksto o presyo sa frame...'
                : 'Align text or price inside the frame...'
            );
          } else {
            setStatusText(
              lang === 'tl'
                ? 'Gamit ang built-in scanner...'
                : 'Using built-in scanner...'
            );
          }

          return stream;
        } catch (err: any) {
          if (i < maxRetries - 1) {
            // Update HUD status during retry
            setStatusText(
              lang === 'tl'
                ? `Sinisimulan ang camera... (${i + 2}/${maxRetries})`
                : `Starting camera... (${i + 2}/${maxRetries})`
            );
            await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
          } else {
            console.warn('[ScannerModal] startCameraWithRetry exhausted all retries:', err);
            setStatusText(
              lang === 'tl'
                ? 'Hindi available ang camera. Isara at buksan muli.'
                : 'Camera unavailable. Close and reopen scanner.'
            );
          }
        }
      }
      return null;
    },
    [cameraFacing, lang, scanMode]
  );

  const startCameraStream = startCameraWithRetry;

  // FIX 1: Camera Handoff Manager - Switch to Native Scanner
  const switchToNativeScanner = useCallback(async () => {
    if (cameraTransitioningRef.current) return;
    cameraTransitioningRef.current = true;

    // Step 1: Stop WebView camera FIRST
    if (isWebViewCameraActiveRef.current || streamRef.current || videoRef.current?.srcObject) {
      stopWebViewCamera(); // stop all tracks
      isWebViewCameraActiveRef.current = false;
      // Wait for Android to fully release camera
      await new Promise((r) => setTimeout(r, 400));
    }

    // Step 2: Set lock BEFORE opening native scanner
    isNativeScannerActiveRef.current = true;
    cameraTransitioningRef.current = false;

    // Step 3: Open Google native scanner
    try {
      if (typeof BarcodeScanner === 'undefined') {
        console.warn('[ScannerModal] BarcodeScanner object is undefined. Falling back to built-in camera.');
        if (isOpenRef.current) {
          await startCameraWithRetry();
        }
        return;
      }

      // Check / install Google Barcode Scanner ML Kit module on Android
      try {
        await prepareGoogleBarcodeScannerModule();
      } catch (modErr) {
        console.warn('[ScannerModal] Google Barcode module check skipped/notice:', modErr);
      }

      // Active status for Google Play Services scanner
      setStatusText(
        lang === 'tl'
          ? 'Gamit ang device scanner...'
          : 'Using device scanner...'
      );
      setIsScanning(true);

      try {
        const formats =
          scanType === 'qr_only'
            ? [BarcodeFormat.QrCode]
            : [
                BarcodeFormat.Ean13,
                BarcodeFormat.Ean8,
                BarcodeFormat.UpcA,
                BarcodeFormat.UpcE,
                BarcodeFormat.Code128,
                BarcodeFormat.Code39,
                BarcodeFormat.QrCode,
              ];

        const scanResult = await BarcodeScanner.scan({ formats });
        if (scanResult && scanResult.barcodes && scanResult.barcodes.length > 0) {
          const detected = scanResult.barcodes[0].rawValue?.trim();
          if (detected) {
            await handleScannedBarcode(detected);
          }
        }
      } catch (innerScanErr: any) {
        console.warn('[ScannerModal] Native BarcodeScanner.scan() error or dismissed:', innerScanErr);
      } finally {
        // Step 4: Release lock AFTER native scanner closes
        isNativeScannerActiveRef.current = false;
        // Step 5: Wait for Android to release native camera
        await new Promise((r) => setTimeout(r, 300));
        // Step 6: Restart WebView camera if modal still open
        if (isOpenRef.current && !isNativeScannerActiveRef.current) {
          await startCameraWithRetry();
        }
      }
    } catch (scanErr: any) {
      console.warn('[ScannerModal] Native BarcodeScanner outer error:', scanErr);
    } finally {
      isNativeScannerActiveRef.current = false;
    }
  }, [handleScannedBarcode, lang, scanType, startCameraWithRetry, stopWebViewCamera]);

  const switchToWebViewCamera = useCallback(async () => {
    if (cameraTransitioningRef.current) return;
    if (isNativeScannerActiveRef.current) return;
    cameraTransitioningRef.current = true;

    try {
      await startCameraWithRetry();
      isWebViewCameraActiveRef.current = true;
    } finally {
      cameraTransitioningRef.current = false;
    }
  }, [startCameraWithRetry]);

  const startNativeScan = switchToNativeScanner;
  startNativeScanRef.current = switchToNativeScanner;

  // Main Camera & Scanner Entrypoint
  const startCamera = useCallback(async () => {
    try {
      const isNative = Capacitor.isNativePlatform();
      const currentPlatform = Capacitor.getPlatform();

      setStatusText(
        lang === 'tl'
          ? 'Inihahanda ang scanner...'
          : 'Preparing scanner...'
      );

      // Stop previous browser video tracks if any
      if (streamRef.current || videoRef.current?.srcObject) {
        stopWebViewCamera();
      }

      // 1. Android Native Barcode Mode: Uses Google Play Services BarcodeScanner.scan() for High Tier with GPS
      if (shouldUseNativeScanner() && scanMode === 'barcode') {
        setHasCameraPermission(true);
        setIsPermanentlyDenied(false);
        try {
          await switchToNativeScanner();
        } catch (nativeErr) {
          console.warn('[ScannerModal] switchToNativeScanner failed, activating HTML5 stream fallback:', nativeErr);
          await switchToWebViewCamera();
        }
        return;
      }

      // 2. iOS or other native platform permission flow
      if (isNative) {
        const permResult = await ensureCameraPermission();

        if (!permResult.granted) {
          setHasCameraPermission(false);
          setIsPermanentlyDenied(permResult.permanentlyDenied);
          setStatusText(
            permResult.permanentlyDenied
              ? (lang === 'tl' ? 'Pahintulot sa camera ay naka-off sa Settings.' : 'Camera permission is disabled in App Settings.')
              : (lang === 'tl' ? 'Kailangan ang pahintulot sa camera para makapag-scan.' : 'Camera permission is required for scanning.')
          );
          return;
        }

        setHasCameraPermission(true);
        setIsPermanentlyDenied(false);

        if (scanMode === 'barcode') {
          if (currentPlatform === 'ios') {
            await switchToNativeScanner();
          } else {
            // Android Mid/Low Tier: HTML5 BarcodeDetector
            await switchToWebViewCamera();
          }
          return;
        } else {
          // Text Recognition Mode on native: Start video feed for OCR frame capture
          await switchToWebViewCamera();
          return;
        }
      }

      // 3. Web / Laptop Browser Preview Fallback
      const permResult = await ensureCameraPermission();
      if (!permResult.granted) {
        setHasCameraPermission(false);
        setIsPermanentlyDenied(permResult.permanentlyDenied);
        setStatusText(
          lang === 'tl'
            ? 'Kailangan ang pahintulot sa camera sa browser.'
            : 'Browser camera permission required.'
        );
        return;
      }

      setHasCameraPermission(true);
      setIsPermanentlyDenied(false);
      await switchToWebViewCamera();
    } catch (err: any) {
      console.warn('[ScannerModal] Camera initialization error:', err);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        (typeof err?.message === 'string' &&
          (err.message.toLowerCase().includes('permission') || err.message.toLowerCase().includes('denied')));

      if (isDenied) {
        setHasCameraPermission(false);
        setIsPermanentlyDenied(true);
      } else {
        setStatusText(
          lang === 'tl'
            ? 'Hindi mabuksan ang camera. Subukang muli.'
            : 'Unable to start camera. Please try again.'
        );
      }
    }
  }, [ensureCameraPermission, lang, scanMode, shouldUseNativeScanner, stopWebViewCamera, switchToNativeScanner, switchToWebViewCamera]);

  // Wake scanner from sleep mode and re-start camera hardware
  const wakeScanner = useCallback(() => {
    triggerHapticFeedback();
    setIsSleeping(false);
    resetInactivityTimer();
    startCamera();
    if (userTorchPreferenceRef.current) {
      applyPhysicalTorch(true);
    }
  }, [applyPhysicalTorch, resetInactivityTimer, startCamera]);

  // Stop camera when closing
  const stopCamera = useCallback(() => {
    resetTapTarget();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isProcessingFrameRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      try {
        videoRef.current.pause();
      } catch (_) {}
    }
    // Free canvas GPU/RAM backing buffer
    if (canvasRef.current) {
      canvasRef.current.width = 0;
      canvasRef.current.height = 0;
    }
    // FIX 5: Reset transitions and active states on modal cleanup
    isNativeScannerActiveRef.current = false;
    isWebViewCameraActiveRef.current = false;
    cameraTransitioningRef.current = false;

    // Restore WebView surface opacity
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('scanner-transparent-active');
      document.body.classList.remove('scanner-transparent-active');
    }
  }, [resetTapTarget]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setIsSleeping(false);
      setIsUnrecognizedFallback(false);
      setRecognizedItem(null);
      setDetectedCode('');
      setDetectedText('');
      resetOcrState();
      resetInactivityTimer();
      // Set background transparent so underlying native camera preview is visible
      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('scanner-transparent-active');
        document.body.classList.add('scanner-transparent-active');
      }
      startCamera();
    } else {
      setIsSleeping(false);
      resetOcrState();
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, resetInactivityTimer, resetOcrState, startCamera, stopCamera]);

  // Handle Mode Switch (Barcode vs Text OCR)
  const handleSwitchMode = (newMode: 'barcode' | 'text') => {
    resetInactivityTimer();
    if (isSleeping) setIsSleeping(false);
    resetTapTarget();
    if (scanMode === newMode) return;
    setScanMode(newMode);
    setIsUnrecognizedFallback(false);
    setRecognizedItem(null);
    setDetectedCode('');
    setDetectedText('');
    resetOcrState();
    setIsScanning(true);

    if (newMode === 'text') {
      setStatusText(
        lang === 'tl'
          ? 'Inihanay ang teksto o presyo sa frame...'
          : 'Align text or price inside the frame...'
      );
      triggerCameraAutofocus();
      try {
        prepareGoogleTextRecognitionModule((status) => {
          setModuleStatus(status === 'ERROR' ? 'BUNDLED/OK' : status);
        }).catch(() => {
          setModuleStatus('BUNDLED/OK');
        });
      } catch (_) {
        setModuleStatus('BUNDLED/OK');
      }
      // Ensure camera stream is running for text OCR
      if (!streamRef.current) {
        startCameraStream();
      }
    } else {
      setStatusText(
        lang === 'tl'
          ? 'Inihahanda ang barcode scanner...'
          : 'Preparing barcode scanner...'
      );
      if (shouldUseNativeScanner() || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios')) {
        startNativeScan();
      } else if (!streamRef.current) {
        startCameraStream();
      }
    }
  };

  // Process viewport tap (Touch or Click) for focus, waking, and tap-targeted OCR
  const processViewportTap = useCallback(
    (clientX: number, clientY: number, currentTarget: HTMLElement) => {
      if (isSleeping) {
        wakeScanner();
        return;
      }
      if (!isScanning) return;

      const rect = currentTarget.getBoundingClientRect();
      const tapX = clientX - rect.left;
      const tapY = clientY - rect.top;

      // Check if double tap (within 300ms of last tap) -> reset to center
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        resetTapTarget();
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      // In text mode, activate tap-targeted OCR
      if (scanMode === 'text') {
        tapTargetRef.current = {
          x: tapX,
          y: tapY,
          active: true,
        };

        // Clear existing reset timer
        if (tapResetTimerRef.current) {
          clearTimeout(tapResetTimerRef.current);
        }

        // Auto reset after 5 seconds of no scan
        tapResetTimerRef.current = setTimeout(() => {
          resetTapTarget();
        }, TAP_RESET_TIMEOUT);

        // Force re-render to show tap indicator
        setTapPosition({ x: tapX, y: tapY, active: true });
      }

      // Hardware autofocus & visual focus point
      const normX = Math.max(0, Math.min(1, tapX / rect.width));
      const normY = Math.max(0, Math.min(1, tapY / rect.height));
      setFocusPoint({ x: tapX, y: tapY, id: Date.now() });
      triggerCameraAutofocus({ x: normX, y: normY });
    },
    [isScanning, isSleeping, resetTapTarget, scanMode, triggerCameraAutofocus, wakeScanner]
  );

  const handleCameraViewTap = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const touch = e.changedTouches[0];
      processViewportTap(touch.clientX, touch.clientY, e.currentTarget);
    },
    [processViewportTap]
  );

  const handleCameraViewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Prevent synthetic click immediately after touchEnd
      if (Date.now() - lastTapTimeRef.current < 50) return;
      processViewportTap(e.clientX, e.clientY, e.currentTarget);
    },
    [processViewportTap]
  );

  // Periodic refocus pulse when in text mode to keep camera focused
  useEffect(() => {
    if (scanMode !== 'text' || !isScanning || isSleeping) return;

    triggerCameraAutofocus();

    const focusInterval = setInterval(() => {
      triggerCameraAutofocus();
    }, 3500);

    return () => clearInterval(focusInterval);
  }, [scanMode, isScanning, isSleeping, triggerCameraAutofocus]);

  // Toggle Torch / Flashlight (User manual intent)
  const handleToggleTorch = async () => {
    resetInactivityTimer();
    if (isSleeping) setIsSleeping(false);
    const nextTorch = !isTorchOn;
    userTorchPreferenceRef.current = nextTorch;
    await applyPhysicalTorch(nextTorch);
  };

  // Flip Camera Front / Back
  const handleFlipCamera = () => {
    resetInactivityTimer();
    if (isSleeping) setIsSleeping(false);
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // 2. Core Frame Processing (Barcode vs Text OCR)
  const processFrame = useCallback(async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !isScanning ||
      isSleeping ||
      recognizedItem ||
      isUnrecognizedFallback ||
      isProcessingOcrRef.current ||
      isProcessingFrameRef.current
    ) {
      return;
    }

    const video = videoRef.current;
    // Platform & Canvas Safety: Ensure video has valid frame data before drawing
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return;

    isProcessingFrameRef.current = true;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // DEDICATED QR ONLY MODE (Ultra fast GPU-accelerated, battery-friendly, direct 2D QR decoding)
      if (scanType === 'qr_only') {
        let foundQr: string | null = null;

        // 1. Hardware Acceleration: Direct GPU decode from video element first (0 canvas copy, instant ~2ms detection)
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            if (!barcodeDetectorRef.current) {
              barcodeDetectorRef.current = new (window as any).BarcodeDetector({
                formats: ['qr_code'],
              });
            }
            const barcodes = await barcodeDetectorRef.current.detect(video).catch(() => null);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              foundQr = barcodes[0].rawValue.trim();
            }
          } catch (_) {}
        }

        // 2. Full-Resolution Center Bounding-Box ROI Crop (Zero downscaling, crisp 1:1 sensor modules, no blur)
        if (!foundQr) {
          const vWidth = video.videoWidth;
          const vHeight = video.videoHeight;
          const cropSize = Math.round(Math.min(vWidth, vHeight) * 0.6);
          const cropX = Math.round((vWidth - cropSize) / 2);
          const cropY = Math.round((vHeight - cropSize) / 2);

          if (canvas.width !== cropSize || canvas.height !== cropSize) {
            canvas.width = cropSize;
            canvas.height = cropSize;
          }
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

          // Check canvas with BarcodeDetector
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window && barcodeDetectorRef.current) {
            try {
              const canvasBarcodes = await barcodeDetectorRef.current.detect(canvas).catch(() => null);
              if (canvasBarcodes && canvasBarcodes.length > 0 && canvasBarcodes[0].rawValue) {
                foundQr = canvasBarcodes[0].rawValue.trim();
              }
            } catch (_) {}
          }

          // Software fallback: jsQR on unscaled ROI crop with attemptBoth
          if (!foundQr) {
            try {
              const imgData = ctx.getImageData(0, 0, cropSize, cropSize);
              const code = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (code && code.data) {
                foundQr = code.data.trim();
              }
            } catch (err) {
              console.warn('[ScannerModal] jsQR ROI decode notice:', err);
            }
          }
        }

        if (foundQr) {
          resetInactivityTimer();
          await handleScannedBarcode(foundQr);
          return;
        }
        return;
      }

    // MODE 1: BARCODE SCANNING (Ultra-responsive, zero GC churn, battery optimized)
    if (scanMode === 'barcode') {
      let foundBarcode: string | null = null;

      // 1. Direct hardware-accelerated decode from video element (Zero canvas copy, 0 extra RAM)
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          if (!barcodeDetectorRef.current) {
            barcodeDetectorRef.current = new (window as any).BarcodeDetector({
              formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
            });
          }
          const barcodes = await barcodeDetectorRef.current.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            foundBarcode = barcodes[0].rawValue.trim();
          }
        } catch (_) {}
      }

      // 2. High-performance software fallback: Center ROI crop with jsQR attemptBoth and BarcodeDetector
      if (!foundBarcode) {
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        const cropSize = Math.round(Math.min(vWidth, vHeight) * 0.65);
        const cropX = Math.round((vWidth - cropSize) / 2);
        const cropY = Math.round((vHeight - cropSize) / 2);

        if (canvas.width !== cropSize || canvas.height !== cropSize) {
          canvas.width = cropSize;
          canvas.height = cropSize;
        }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

        // Hardware decode on canvas if direct video detection returned empty
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window && barcodeDetectorRef.current) {
          try {
            const canvasBarcodes = await barcodeDetectorRef.current.detect(canvas);
            if (canvasBarcodes && canvasBarcodes.length > 0 && canvasBarcodes[0].rawValue) {
              foundBarcode = canvasBarcodes[0].rawValue.trim();
            }
          } catch (_) {}
        }

        // Full-detail QR decode attempt on unscaled ROI canvas with attemptBoth
        if (!foundBarcode) {
          try {
            const imgData = ctx.getImageData(0, 0, cropSize, cropSize);
            const qrCode = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (qrCode && qrCode.data) {
              foundBarcode = qrCode.data.trim();
            }
          } catch (_) {}
        }
      }

      if (foundBarcode) {
        resetInactivityTimer();
        await handleScannedBarcode(foundBarcode);
        return;
      }
      return;
    }

    // Adaptive scanner behavior per tier
    const tier = deviceTierRef.current;

    // OCR interval: High: 400ms, Mid: 600ms, Low: 800ms
    if (scanMode === 'text') {
      const now = Date.now();
      const ocrInterval = tier === 'high' ? 400 : tier === 'mid' ? 600 : 800;
      if (now - lastTextScanTimeRef.current < ocrInterval) {
        isProcessingFrameRef.current = false;
        return;
      }
      lastTextScanTimeRef.current = now;
    }

    if (scanMode === 'text') {
      const videoEl = videoRef.current || video;
      const container = cameraContainerRef.current;

      // STEP 9 SAFETY FALLBACK: Verify video dimensions and container presence
      if (!container || !videoEl.videoWidth || !videoEl.videoHeight) {
        isProcessingFrameRef.current = false;
        return;
      }

      const containerRect = container.getBoundingClientRect();
      if (containerRect.width <= 0 || containerRect.height <= 0) {
        isProcessingFrameRef.current = false;
        return;
      }

      const vWidth = videoEl.videoWidth;
      const vHeight = videoEl.videoHeight;
      const cWidth = containerRect.width;
      const cHeight = containerRect.height;

      // Calculate object-fit: cover projection from viewport container to video sensor
      const sourceAspect = vWidth / vHeight;
      const containerAspect = cWidth / cHeight;

      let renderedWidth: number;
      let renderedHeight: number;

      if (sourceAspect > containerAspect) {
        // Video is wider than container: fits container height, clipped horizontally
        renderedHeight = cHeight;
        renderedWidth = renderedHeight * sourceAspect;
      } else {
        // Video is taller than container: fits container width, clipped vertically
        renderedWidth = cWidth;
        renderedHeight = renderedWidth / sourceAspect;
      }

      const offsetX = (renderedWidth - cWidth) / 2;
      const offsetY = (renderedHeight - cHeight) / 2;
      const scale = vWidth / renderedWidth;

      let boxLeft = 0;
      let boxTop = 0;
      let boxWidth = 0;
      let boxHeight = 0;

      if (tapTargetRef.current.active) {
        // TAP TARGET MODE: 160x90 (or 200x112 on low tier) centered on tap coordinates
        const boxDim = getTapBoxDimensions();
        boxWidth = boxDim.width;
        boxHeight = boxDim.height;
        boxLeft = tapTargetRef.current.x - boxWidth / 2;
        boxTop = tapTargetRef.current.y - boxHeight / 2;
      } else {
        // CENTER RETICLE MODE: Use visible green dashed reticle as the source of truth
        const reticleEl = reticleRef.current;
        if (!reticleEl) {
          // Reticle not yet mounted, skip frame safely without full-frame fallback
          isProcessingFrameRef.current = false;
          return;
        }
        const reticleRect = reticleEl.getBoundingClientRect();
        if (reticleRect.width <= 0 || reticleRect.height <= 0) {
          isProcessingFrameRef.current = false;
          return;
        }
        boxLeft = reticleRect.left - containerRect.left;
        boxTop = reticleRect.top - containerRect.top;
        boxWidth = reticleRect.width;
        boxHeight = reticleRect.height;
      }

      // Project container-relative box coordinates into video frame pixels
      const rawCropX = (boxLeft + offsetX) * scale;
      const rawCropY = (boxTop + offsetY) * scale;
      const rawCropW = boxWidth * scale;
      const rawCropH = boxHeight * scale;

      // Safe sensor boundaries clamping
      const cropX = Math.max(0, Math.min(vWidth - 1, Math.round(rawCropX)));
      const cropY = Math.max(0, Math.min(vHeight - 1, Math.round(rawCropY)));
      const cropW = Math.max(1, Math.min(vWidth - cropX, Math.round(rawCropW)));
      const cropH = Math.max(1, Math.min(vHeight - cropY, Math.round(rawCropH)));

      // Sensible canvas output resolution based on device tier (preserves aspect ratio without stretching)
      const maxOutputDim = tier === 'high' ? 640 : tier === 'mid' ? 480 : 360;
      const scaleRatio = Math.min(1, maxOutputDim / Math.max(cropW, cropH));
      const outputWidth = Math.max(1, Math.round(cropW * scaleRatio));
      const outputHeight = Math.max(1, Math.round(cropH * scaleRatio));

      if (canvas.width !== outputWidth || canvas.height !== outputHeight) {
        canvas.width = outputWidth;
        canvas.height = outputHeight;
      }

      // 9-argument drawImage: Crop strictly the reticle / tap-target pixels
      ctx.drawImage(
        videoEl,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        outputWidth,
        outputHeight
      );
    }

    // STEP 5: Blank frame guard (all tiers) - skip blank/white frames
    const imageData = ctx.getImageData(0, 0, 4, 4);
    const isBlank = imageData.data.every((v) => v === 0 || v === 255);
    if (isBlank) return; // skip blank/white frames

    // MODE 2: TEXT RECOGNITION (OCR / Label / Price / Item name)
    if (scanMode === 'text') {
      isProcessingOcrRef.current = true;
      setFrameTick((t) => t + 1);
      try {
        // WEB VS NATIVE EXECUTION GUARD
        if (!Capacitor.isNativePlatform()) {
          // Web / Brave browser simulation mode: skip native plugin call to avoid exceptions
          if (scanPhase === 'IDLE') {
            setStatusText(
              lang === 'tl'
                ? 'OCR simulation mode active (Nasa browser)'
                : 'OCR simulation mode active'
            );
          }
          isProcessingOcrRef.current = false;
          return;
        }

        // GOOGLE PLAY SERVICES OCR MODULE CHECK (Android Native) - Non-blocking try/catch
        if (Capacitor.getPlatform() === 'android') {
          try {
            await prepareGoogleTextRecognitionModule((status) => {
              setModuleStatus(status === 'ERROR' ? 'BUNDLED/OK' : status);
            });
          } catch (_) {
            setModuleStatus('BUNDLED/OK');
          }
        }

        const rawBase64 = canvas.toDataURL('image/jpeg', 0.85);
        const cleanBase64 = rawBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

        setBase64PayloadSize(
          `${cleanBase64.length.toLocaleString()} chars (~${Math.round(
            (cleanBase64.length * 0.75) / 1024
          )}KB)`
        );

        if (cleanBase64.length <= 500) {
          setLastOcrError('Base64 payload under 500 chars limit (Skipped)');
          isProcessingOcrRef.current = false;
          return;
        }

        let ocrResultObj: any = null;

        // Execute Capacitor ML Kit Text Recognition with Native Android Safety
        try {
          if (TextRecognition) {
            // Save temporary image to native filesystem cache to provide valid file:/// URI
            let fileUri: string | null = null;
            try {
              const tempSavedFile = await Filesystem.writeFile({
                path: 'ocr_temp.jpg',
                data: cleanBase64,
                directory: Directory.Cache,
              });
              fileUri = tempSavedFile.uri;
            } catch (fsErr) {
              console.warn('[ScannerModal] Filesystem cache write notice:', fsErr);
            }

            if (typeof (TextRecognition as any).processImage === 'function') {
              if (fileUri) {
                ocrResultObj = await (TextRecognition as any).processImage({
                  path: fileUri,
                });
              } else {
                ocrResultObj = await (TextRecognition as any).processImage({
                  path: rawBase64,
                  base64Data: cleanBase64,
                });
              }
            } else if (typeof (TextRecognition as any).readText === 'function') {
              ocrResultObj = await (TextRecognition as any).readText({
                path: fileUri || rawBase64,
                base64Data: cleanBase64,
              });
            }
          }
        } catch (mlKitErr: any) {
          const errDiag = mlKitErr?.message || String(mlKitErr || '');
          setLastOcrError(errDiag);
          console.warn('[ScannerModal] TextRecognition ML Kit notice:', mlKitErr);
          if (Capacitor.isNativePlatform()) {
            setStatusText(
              lang === 'tl'
                ? `Native OCR notice: ${errDiag.slice(0, 30)}`
                : `Native OCR notice: ${errDiag.slice(0, 30)}`
            );
          }
        }

        const detectedRawStr =
          ocrResultObj?.text ||
          (Array.isArray(ocrResultObj?.blocks)
            ? ocrResultObj.blocks.map((b: any) => b.text || '').join(' ')
            : '');
        setRawMlKitText(detectedRawStr || '(No text detected)');
        if (ocrResultObj) {
          setModuleStatus((prev) => (prev === 'ERROR' ? 'BUNDLED/OK' : prev));
        }

        // Reset inactivity timer if text was detected by ML Kit (even if not matched to an item)
        if (detectedRawStr && detectedRawStr.trim().length > 0) {
          resetInactivityTimer();
        }

        // Structured Block, Line, and Token Parsing
        const extractedLines: string[] = [];
        const extractedTokens: string[] = [];

        if (ocrResultObj?.blocks && Array.isArray(ocrResultObj.blocks) && ocrResultObj.blocks.length > 0) {
          for (const block of ocrResultObj.blocks) {
            if (block.lines && Array.isArray(block.lines) && block.lines.length > 0) {
              for (const line of block.lines) {
                const normalizedLine = normalizeOcrText(line.text || '');
                if (isValidOcrLine(normalizedLine)) {
                  extractedLines.push(normalizedLine);
                  normalizedLine.split(/\s+/).forEach((tok) => {
                    const cleanTok = tok.trim().toLowerCase();
                    if (cleanTok.length >= 2) extractedTokens.push(cleanTok);
                  });
                }
              }
            } else if (block.text) {
              const normalizedBlock = normalizeOcrText(block.text);
              if (isValidOcrLine(normalizedBlock)) {
                extractedLines.push(normalizedBlock);
                normalizedBlock.split(/\s+/).forEach((tok) => {
                  const cleanTok = tok.trim().toLowerCase();
                  if (cleanTok.length >= 2) extractedTokens.push(cleanTok);
                });
              }
            }
          }
        }

        // Top-level raw text fallback if structured blocks were empty
        if (extractedLines.length === 0 && ocrResultObj?.text) {
          const normalizedRaw = normalizeOcrText(ocrResultObj.text);
          normalizedRaw.split('\n').forEach((l) => {
            const trimmed = l.trim();
            if (isValidOcrLine(trimmed)) {
              extractedLines.push(trimmed);
              trimmed.split(/\s+/).forEach((tok) => {
                const cleanTok = tok.trim().toLowerCase();
                if (cleanTok.length >= 2) extractedTokens.push(cleanTok);
              });
            }
          });
        }

        // Maintain 3-frame history buffer for temporal consistency (High/Mid tiers)
        if (extractedLines.length > 0 && deviceTierRef.current !== 'low') {
          ocrHistoryRef.current.push(extractedLines);
          if (ocrHistoryRef.current.length > 3) {
            ocrHistoryRef.current.shift();
          }
        }

        // Candidate Detection & Matching with Fuzzy OCR & Typo Resilience
        let foundCandidateText: string | null = null;
        let foundMatchedItem: InventoryItem | undefined = undefined;

        if (extractedLines.length > 0) {
          const allItems = await db.inventory.toArray();

          // Priority 1: Match whole line against inventory item name (exact or fuzzy OCR)
          if (allItems.length > 0) {
            for (const item of allItems) {
              const itemNameLower = item.name.toLowerCase();
              const itemNameFuzzy = normalizeOcrFuzzy(item.name);

              const lineMatch = extractedLines.some((line) => {
                const lineLower = line.toLowerCase();
                const lineFuzzy = normalizeOcrFuzzy(line);

                // Exact substring
                if (lineLower.includes(itemNameLower) || itemNameLower.includes(lineLower)) {
                  return true;
                }

                // Fuzzy character swap match or Levenshtein similarity >= 0.85
                if (itemNameFuzzy.length >= 3 && lineFuzzy.length >= 3) {
                  if (lineFuzzy.includes(itemNameFuzzy) || itemNameFuzzy.includes(lineFuzzy)) {
                    return true;
                  }
                  if (getSimilarityRatio(itemNameFuzzy, lineFuzzy) >= 0.85) {
                    return true;
                  }
                }
                return false;
              });

              if (lineMatch) {
                foundMatchedItem = item;
                foundCandidateText = item.name;
                break;
              }
            }
          }

          // Priority 2: Multi-token match across words
          if (!foundMatchedItem && allItems.length > 0 && extractedTokens.length > 0) {
            for (const item of allItems) {
              const itemTokens = item.name.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
              if (itemTokens.length === 0) continue;

              const matchedCount = itemTokens.filter((token) => {
                const fuzzyTok = normalizeOcrFuzzy(token);
                return extractedTokens.some((word) => {
                  const fuzzyWord = normalizeOcrFuzzy(word);
                  return (
                    word.includes(token) ||
                    token.includes(word) ||
                    (fuzzyTok.length >= 3 && fuzzyWord.length >= 3 && getSimilarityRatio(fuzzyTok, fuzzyWord) >= 0.82)
                  );
                });
              }).length;

              // Require at least 2 matching tokens for multi-word inventory names
              const minRequired = itemTokens.length > 1 ? Math.max(2, Math.ceil(itemTokens.length * 0.6)) : 1;
              if (matchedCount >= minRequired) {
                foundMatchedItem = item;
                foundCandidateText = item.name;
                break;
              }
            }
          }

          // Priority 3: Extract up to 3 recommended product names if no stored inventory item matched
          if (!foundMatchedItem) {
            const frameCandidates = filterAndRankRecommendedNames(extractedLines);
            const now = Date.now();

            if (frameCandidates.length > 0) {
              lastTextDetectedTimeRef.current = now;

              // Accumulate scores for each candidate word/phrase
              for (const cand of frameCandidates) {
                const normKey = cand.toLowerCase().trim();
                const existing = candidateScoresRef.current.get(normKey);
                if (existing) {
                  existing.count += 1;
                  existing.lastSeen = now;
                  if (cand !== existing.text && cand.length >= existing.text.length) {
                    existing.text = cand;
                  }
                } else {
                  candidateScoresRef.current.set(normKey, {
                    text: cand,
                    count: 1,
                    lastSeen: now,
                  });
                }
              }

              // Prune stale candidate scores (older than 4.5 seconds)
              for (const [k, v] of candidateScoresRef.current.entries()) {
                if (now - v.lastSeen > 4500) {
                  candidateScoresRef.current.delete(k);
                }
              }

              // Rank accumulated candidates by detection frequency, then string length
              const ranked = Array.from(candidateScoresRef.current.values())
                .sort((a, b) => b.count - a.count || b.text.length - a.text.length)
                .slice(0, 3)
                .map((item) => item.text);

              // Anti-Jitter Latch:
              // Keep words steady for at least 2.5s so users can comfortably read and tap them
              const timeSinceLastUpdate = now - lastCandidateUpdateRef.current;
              setRecommendedNames((prev) => {
                if (ranked.length === 0) return prev;
                if (prev.length === 0) {
                  lastCandidateUpdateRef.current = now;
                  return ranked;
                }
                if (timeSinceLastUpdate >= 2500) {
                  const hasChanged =
                    prev.length !== ranked.length ||
                    ranked.some((r, idx) => r.toLowerCase() !== prev[idx]?.toLowerCase());
                  if (hasChanged) {
                    lastCandidateUpdateRef.current = now;
                    return ranked;
                  }
                }
                return prev; // Keep current stable words
              });

              if (ranked.length > 0) {
                foundCandidateText = ranked[0];
              }
            }
          } else {
            // Found matched item in database -> clear candidate scores immediately
            candidateScoresRef.current.clear();
            setRecommendedNames([]);
          }

          // TEMPORAL CONSISTENCY CHECK: Reject one-off frame candidates unless present in at least 2 of last 3 frames
          // On LOW TIER: Disable double-pass OCR confirmation — single pass only
          if (
            deviceTierRef.current !== 'low' &&
            foundCandidateText &&
            foundMatchedItem &&
            !isTemporallyConsistent(foundCandidateText, ocrHistoryRef.current)
          ) {
            foundCandidateText = null;
            foundMatchedItem = undefined;
          }
        }

        // 2-PASS OCR STATE MACHINE & INSTANT CUT-THROUGH HANDLING
        if (foundMatchedItem) {
          // INSTANT CUT-THROUGH (0s delay): Item exists in store inventory -> Trigger modal immediately!
          setCandidateText(foundMatchedItem.name);
          candidateItemRef.current = foundMatchedItem;
          setScanPhase('CONFIRMED');
          setStatusText(
            lang === 'tl' ? 'Natukoy ang paninda sa bodega!' : 'Item recognized in inventory!'
          );
          handleScannedText(foundMatchedItem.name, foundMatchedItem);
          isProcessingOcrRef.current = false;
          return;
        }

        if (foundCandidateText) {
          // UNCATALOGUED ITEM (First time scanning): Cut countdown cleanly & show recommended name chips.
          // Do NOT pop up modal automatically until user selects a name chip.
          setCandidateText(foundCandidateText);
          candidateItemRef.current = null;
          setScanPhase('CONFIRMED');
          setStatusText(
            lang === 'tl'
              ? 'Pumili sa mga natukoy na pangalan sa ibaba:'
              : 'Select a product name from recommendations below:'
          );
        } else {
          // GRACE PERIOD SAFEGUARD: Don't instantly wipe recommendations on a 1-frame drop!
          // Only reset if NO text was seen for more than 3.5 seconds
          const now = Date.now();
          const timeSinceText = now - lastTextDetectedTimeRef.current;
          if (timeSinceText > 3500) {
            if (scanPhase === 'COUNTDOWN' || scanPhase === 'CONFIRMED') {
              resetOcrState();
            }
            setStatusText(
              lang === 'tl'
                ? 'Inihanay ang teksto o presyo sa frame...'
                : 'Align text or price inside the frame...'
            );
          }
        }
      } catch (ocrCatchErr: any) {
        console.warn('[ScannerModal] OCR processing frame error:', ocrCatchErr);
        // CRITICAL: Maintain active stream and do NOT set permission to false
        if (scanPhase === 'COUNTDOWN') {
          resetOcrState();
        }
        setStatusText(
          lang === 'tl'
            ? 'Inihanay ang teksto o presyo sa frame...'
            : 'Align text or price inside the frame...'
        );
      } finally {
        isProcessingOcrRef.current = false;
      }
    }
  } finally {
    isProcessingFrameRef.current = false;
  }
  }, [
    handleScannedBarcode,
    isScanning,
    isSleeping,
    isUnrecognizedFallback,
    lang,
    recognizedItem,
    resetInactivityTimer,
    resetOcrState,
    scanMode,
    scanPhase,
  ]);

  const processFrameRef = useRef(processFrame);
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  // Two-Pass Countdown Interval Controller
  useEffect(() => {
    let timer: any = null;
    if (
      scanMode === 'text' &&
      scanPhase === 'COUNTDOWN' &&
      isScanning &&
      !isSleeping &&
      !recognizedItem &&
      !isUnrecognizedFallback
    ) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [scanMode, scanPhase, isScanning, isSleeping, recognizedItem, isUnrecognizedFallback]);

  // Observe countdown state for transitions
  useEffect(() => {
    if (scanMode === 'text' && scanPhase === 'COUNTDOWN') {
      if (countdown > 0) {
        setStatusText(
          lang === 'tl'
            ? `Ipanatag ang camera... ${countdown}s`
            : `Hold camera steady... ${countdown}s`
        );
      } else if (countdown === 0 && candidateText) {
        setScanPhase('CONFIRMED');
        if (candidateItemRef.current) {
          handleScannedText(candidateText, candidateItemRef.current);
        } else {
          setStatusText(
            lang === 'tl'
              ? 'Pumili sa mga mungkahing pangalan sa ibaba:'
              : 'Select a product name from recommendations below:'
          );
        }
      }
    }
  }, [countdown, scanMode, scanPhase, candidateText, lang, handleScannedText]);

  // Page Visibility Listener: Minimize/Lock Screen Hardware Power Down
  useEffect(() => {
    const handleVisibilityChange = () => {
      // GUARD 1: Native scanner is handling camera, do not touch
      if (isNativeScannerActiveRef.current) return;
      // GUARD 2: Camera handoff is currently transitioning, do not touch
      if (cameraTransitioningRef.current) return;

      if (document.hidden) {
        // App minimized or tab switched: immediately stop camera tracks and turn off torch to conserve battery
        stopWebViewCamera();
        setIsTorchOn(false);
      } else if (isOpen && isScanning && !isSleeping && !recognizedItem && !isUnrecognizedFallback) {
        // GUARD 3: Only restart WebView camera if native scanner is NOT active and not already running
        if (!isNativeScannerActiveRef.current && !isWebViewCameraActiveRef.current) {
          switchToWebViewCamera();
          if (userTorchPreferenceRef.current) {
            applyPhysicalTorch(true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, isScanning, isSleeping, recognizedItem, isUnrecognizedFallback, stopWebViewCamera, switchToWebViewCamera, applyPhysicalTorch]);

  // Run scanning loop (paused when sleeping or hidden)
  useEffect(() => {
    if (isOpen && isScanning && !isSleeping && hasCameraPermission) {
      // Throttle frame processing to reduce battery consumption (250ms ~ 4 FPS)
      const loopInterval = 250;
      scanIntervalRef.current = setInterval(() => {
        processFrameRef.current();
      }, loopInterval);
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    }
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isOpen, isScanning, isSleeping, hasCameraPermission]);

  // Restart Scan
  const handleRestartScan = () => {
    resetInactivityTimer();
    setIsSleeping(false);
    setRecognizedItem(null);
    setDetectedCode('');
    setDetectedText('');
    setIsUnrecognizedFallback(false);
    resetOcrState();
    setIsScanning(true);

    // Restore torch if user had enabled it before scan, otherwise stay off
    if (userTorchPreferenceRef.current) {
      applyPhysicalTorch(true);
    } else {
      applyPhysicalTorch(false);
    }

    if (scanMode === 'text') {
      setStatusText(
        lang === 'tl'
          ? 'Inihanay ang teksto o presyo sa frame...'
          : 'Align text or price inside the frame...'
      );
    } else {
      setStatusText(
        lang === 'tl'
          ? 'Nagsa-scan ng barcode...'
          : 'Scanning barcode...'
      );
    }
    
    // Always use the master startCamera to safely reboot the correct feed (native or webview)
    startCamera();
  };

  // Trigger Add Item Modal
  const handleAddUnrecognizedItem = () => {
    resetInactivityTimer();
    onClose();
    onOpenAddItem({
      sku: detectedCode || undefined,
      name: detectedText || undefined,
    });
  };

  // Manual search fallback in scanner
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    resetInactivityTimer();
    if (isSleeping) setIsSleeping(false);
    if (!manualSearchInput.trim()) return;

    if (scanType === 'qr_only' || scanType === 'search') {
      setIsScanning(false);
      applyPhysicalTorch(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      playScanBeep('success');
      triggerHapticFeedback();
      onScanSuccess?.(manualSearchInput.trim());
      return;
    }

    const term = manualSearchInput.trim().toLowerCase();
    const found = await db.inventory
      .filter((item) =>
        item.name.toLowerCase().includes(term) ||
        (item.sku && item.sku.toLowerCase().includes(term))
      )
      .first();

    if (found) {
      setIsScanning(false);
      setRecognizedItem(found);
      onScanSuccess?.(found.name);
    } else {
      setIsUnrecognizedFallback(true);
      setDetectedText(manualSearchInput.trim());
      onScanSuccess?.(manualSearchInput.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none transition-opacity duration-200 ${isScanning ? 'bg-transparent' : 'bg-[#062016]'}`}>
        {/* TOP CAMERA CONTROLS BAR */}
        <div className="safe-pt-header px-4 py-3 bg-[#062016]/90  border-b border-[#0B2E21] z-20 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center border border-[#0B2E21]">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-black text-sm tracking-wide">
                  {getScannerTitle(scanType, lang)}
                </h2>
                <p className="text-[11px] text-white/70 font-medium truncate max-w-[180px] sm:max-w-[240px]">
                  {statusText}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Flashlight button */}
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-colors cursor-pointer ${
                  isTorchOn ? 'bg-amber-400 text-slate-900 shadow-md' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                aria-label="Toggle Torch"
                title="Toggle Torch"
              >
                <Flashlight className="w-4 h-4" />
              </button>

              {/* Flip Camera button */}
              <button
                type="button"
                onClick={handleFlipCamera}
                className="w-9 h-9 rounded-2xl bg-white/15 text-white hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Flip Camera"
                title="Flip Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* DUAL-MODE SWITCHER (BARCODE VS. TEXT OCR) OR QR DEDICATED BADGE */}
          {scanType === 'qr_only' ? (
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black/85  rounded-2xl border border-amber-500/30 shadow-lg text-xs font-black text-amber-400">
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {lang === 'tl'
                    ? 'Store Catalog QR Mode'
                    : lang === 'ja'
                    ? '店舗カタログQRモード'
                    : lang === 'zh'
                    ? '店铺目录二维码模式'
                    : lang === 'ko'
                    ? '매장 카탈로그 QR 모드'
                    : 'Store Catalog QR Mode'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="inline-flex p-1 bg-black/85  rounded-2xl border border-white/15 shadow-lg">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('barcode')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scanMode === 'barcode'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>{lang === 'tl' ? 'Barcode / QR' : 'Barcode / QR'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('text')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scanMode === 'text'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{lang === 'tl' ? 'Teksto / Label (OCR)' : 'Text / Label (OCR)'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FULL SCREEN CAMERA VIEWPORT */}
        <div
          ref={cameraContainerRef}
          onTouchEnd={handleCameraViewTap}
          onClick={handleCameraViewClick}
          onDoubleClick={wakeScanner}
          className={`relative flex-1 flex items-center justify-center overflow-hidden cursor-pointer transition-colors duration-200 ${
            isScanning ? 'bg-transparent' : 'bg-[#062016]'
          }`}
        >
          {/* Animated Tap-to-Focus Reticle */}
          {focusPoint && (
            <motion.div
              key={focusPoint.id}
              initial={{ scale: 1.4, opacity: 1 }}
              animate={{ scale: 1, opacity: [1, 1, 0] }}
              transition={{ duration: 1.1, times: [0, 0.4, 1] }}
              onAnimationComplete={() => setFocusPoint(null)}
              style={{ left: focusPoint.x - 24, top: focusPoint.y - 24 }}
              className="absolute w-12 h-12 border-2 border-amber-400 rounded-xl pointer-events-none z-30 shadow-[0_0_12px_rgba(251,191,36,0.6)] flex items-center justify-center"
            >
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            </motion.div>
          )}

          {/* SLEEP MODE DIMMED OVERLAY */}
          <AnimatePresence>
            {isSleeping && (
              <motion.div
                key="camera-sleep-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-40 bg-black/90  flex flex-col items-center justify-center p-6 text-center select-none"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-4 shadow-xl"
                >
                  <Moon className="w-8 h-8" />
                </motion.div>
                <h3 className="text-white font-black text-lg sm:text-xl tracking-tight mb-1.5">
                  {lang === 'tl' ? 'Natutulog ang Camera' : 'Camera sleeping...'}
                </h3>
                <p className="text-stone-300 text-xs sm:text-sm font-medium max-w-xs mb-5">
                  {lang === 'tl'
                    ? 'Naka-pause ang scanning upang makatipid sa baterya. I-double tap kahit saan upang magising.'
                    : 'Double tap anywhere on the screen to wake'}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    wakeScanner();
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-lg active:scale-95 transition-transform flex items-center gap-2 cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  <span>{lang === 'tl' ? 'Gisingin ang Camera' : 'Wake Camera'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* LIVE DIAGNOSTIC HUD OVERLAY FOR NATIVE APK OCR DEBUGGING */}
          {showHud ? (
            <div className="absolute top-16 left-3 right-3 z-30 pointer-events-auto bg-black/85  border border-amber-500/40 rounded-2xl p-2.5 shadow-2xl text-[10px] font-mono text-amber-300 space-y-1 max-h-52 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-1 mb-1">
                <span className="font-bold text-amber-400 flex items-center gap-1 text-[11px]">
                  <Bug className="w-3.5 h-3.5" /> DIAGNOSTIC HUD (OCR DEBUG)
                </span>
                <button
                  type="button"
                  onClick={() => setShowHud(false)}
                  className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/40 rounded text-[9px] text-amber-200 uppercase font-black cursor-pointer"
                >
                  Hide
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                <div>
                  <span className="text-stone-400">Device:</span>{' '}
                  <span className="font-bold text-amber-300">
                    {deviceTier.toUpperCase()} | GPS: {hasGooglePlayServices ? 'YES' : 'NO'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">Scanner:</span>{' '}
                  <span className="font-bold text-sky-300">
                    {shouldUseNativeScanner()
                      ? 'Native GPS'
                      : typeof window !== 'undefined' && 'BarcodeDetector' in window
                      ? 'HTML5'
                      : 'Manual'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">OCR:</span>{' '}
                  <span className="font-bold text-emerald-300">
                    {deviceTier === 'high' ? '400ms' : deviceTier === 'mid' ? '600ms' : '800ms'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">Platform:</span>{' '}
                  <span className="font-bold text-white">
                    {Capacitor.isNativePlatform() ? `Native (${Capacitor.getPlatform()})` : 'Web / Browser'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">ML Kit Module:</span>{' '}
                  <span
                    className={`font-bold ${
                      moduleStatus === 'READY' || moduleStatus === 'BUNDLED/OK'
                        ? 'text-emerald-400'
                        : moduleStatus === 'INSTALLING'
                        ? 'text-amber-400 '
                        : moduleStatus === 'ERROR'
                        ? 'text-rose-400'
                        : 'text-stone-300'
                    }`}
                  >
                    {moduleStatus}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">Frame Tick:</span>{' '}
                  <span className="font-bold text-sky-300">#{frameTick}</span>
                </div>
                <div>
                  <span className="text-stone-400">Phase & Timer:</span>{' '}
                  <span className="font-bold text-amber-300">
                    {scanPhase} {scanPhase === 'COUNTDOWN' ? `(${countdown}s)` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">Dims:</span>{' '}
                  <span className="font-bold text-stone-200">{videoCanvasDims}</span>
                </div>
                <div>
                  <span className="text-stone-400">Base64 Payload:</span>{' '}
                  <span className="font-bold text-purple-300">{base64PayloadSize}</span>
                </div>
                <div>
                  <span className="text-stone-400">Valid Scans:</span>{' '}
                  <span className="font-bold text-emerald-400">{validScanCount}</span>
                </div>
                <div>
                  <span className="text-stone-400">Rejected Scans:</span>{' '}
                  <span className="font-bold text-rose-400">{rejectedScanCount}</span>
                </div>
              </div>
              <div className="border-t border-white/10 pt-1 mt-1">
                <div className="text-stone-400">Raw ML Kit Detected Text:</div>
                <div className="bg-black/90 p-1 rounded border border-white/10 text-emerald-300 text-[9.5px] truncate select-all font-mono">
                  {rawMlKitText || '(Waiting for text in frame...)'}
                </div>
              </div>
              {lastRejectedBarcode && (
                <div className="border-t border-rose-500/20 pt-1 mt-1 text-[9.5px]">
                  <span className="text-rose-400 font-bold">Last Rejected:</span>{' '}
                  <span className="text-white font-mono">{lastRejectedBarcode}</span>
                  {lastRejectedReason && (
                    <div className="text-rose-300/80 text-[9px]">{lastRejectedReason}</div>
                  )}
                </div>
              )}
              {lastOcrError !== 'None' && (
                <div className="text-rose-400 font-bold truncate">
                  Last Error: {lastOcrError}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowHud(true)}
              className="absolute bottom-24 right-3 z-30 pointer-events-auto px-2.5 py-1 bg-black/80  border border-amber-500/40 rounded-full text-[10px] font-mono font-bold text-amber-300 shadow-lg flex items-center gap-1 cursor-pointer"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" /> HUD DEBUG
            </button>
          )}

          {/* Live Video Feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Hidden Canvas for Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* RESET TAP TARGET BUTTON */}
          <AnimatePresence>
            {scanMode === 'text' && isScanning && !isSleeping && tapPosition.active && (
              <motion.div
                key="reset-tap-target-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute top-4 left-4 z-40 pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetTapTarget();
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-black/85 hover:bg-black/95 text-white border border-white/30 text-xs font-bold shadow-2xl flex items-center gap-1.5 cursor-pointer touch-manipulation active:scale-95 transition-transform"
                >
                  <X className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === 'tl' ? '✕ I-reset' : '✕ Reset target'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VISUAL TAP TARGET INDICATOR BOX */}
          <AnimatePresence>
            {scanMode === 'text' && isScanning && !isSleeping && tapPosition.active && (
              <motion.div
                key="tap-target-box"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  width: getTapBoxDimensions().width,
                  height: getTapBoxDimensions().height,
                  left: tapPosition.x - getTapBoxDimensions().width / 2,
                  top: tapPosition.y - getTapBoxDimensions().height / 2,
                }}
                className="absolute z-20 border-2 border-white bg-white/15 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.25)]"
              >
                {/* Corner markers ⌜ ⌝ ⌞ ⌟ */}
                <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-white" />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-white" />
                <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-white" />
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-white" />

                {/* Small label below box */}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-black/85 text-[10px] font-bold text-white border border-white/25 shadow-lg pointer-events-none">
                  {lang === 'tl' ? 'Binabasa ang lugar na ito...' : 'Reading this area...'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CAMERA RETICLE / TARGETING CROSSHAIR */}
          {isScanning && (!tapPosition.active || scanMode !== 'text') && (
            <div
              ref={reticleRef}
              className={`relative z-10 ${
                scanMode === 'text' ? 'w-80 h-52 sm:w-96 sm:h-60' : 'w-72 h-72 sm:w-80 sm:h-80'
              } border-2 border-dashed border-[#10B981]/60 rounded-3xl flex flex-col items-center justify-between p-4 shadow-2xl transition-all duration-300`}
            >
              {/* Corner reticles */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#10B981] rounded-tl-xl -mt-1 -ml-1" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#10B981] rounded-tr-xl -mt-1 -mr-1" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#10B981] rounded-bl-xl -mb-1 -ml-1" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#10B981] rounded-br-xl -mb-1 -mr-1" />

              {/* Animated Laser Scanning Line */}
              <motion.div
                key="laser-scan-line"
                animate={{ y: scanMode === 'text' ? [0, 160, 0] : [0, 240, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#10B981] to-transparent shadow-[0_0_8px_#10B981]"
              />

              {/* Hold-Steady Countdown Visual Overlay */}
              {scanMode === 'text' && scanPhase === 'COUNTDOWN' && (
                <motion.div
                  key="ocr-countdown-overlay"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-2 flex flex-col items-center justify-center bg-black/85 rounded-2xl z-20 pointer-events-none p-2 space-y-1.5"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg border-2 border-emerald-300">
                    {countdown}s
                  </div>
                  <span className="text-white text-xs font-black text-center px-2">
                    {lang === 'tl' ? 'Ipanatag ang camera...' : 'Hold camera steady...'}
                  </span>
                </motion.div>
              )}

              <div className="bg-[#062016]/95 px-3 py-1.5 rounded-full text-[11px] font-black text-white/90 border border-[#0B2E21] flex items-center gap-1.5 shadow-md">
                {scanType === 'qr_only' ? (
                  <QrCode className="w-3.5 h-3.5 text-[#10B981]" />
                ) : scanMode === 'text' ? (
                  <Type className="w-3.5 h-3.5 text-[#10B981]" />
                ) : (
                  <Scan className="w-3.5 h-3.5 text-[#10B981]" />
                )}
                <span>{getScannerReticleText(scanType, scanMode, lang)}</span>
              </div>
            </div>
          )}

          {/* AI VISION LENS BUTTON (FOR STYLIZED / 3D / BUBBLE PACKAGING TEXT) */}
          {scanMode === 'text' && isScanning && !isSleeping && !recognizedItem && !isUnrecognizedFallback && (
            <div
              className={`absolute ${
                recommendedNames.length > 0 ? 'bottom-36' : 'bottom-24'
              } left-4 right-4 z-30 flex justify-center pointer-events-auto transition-all duration-200`}
            >
              <button
                type="button"
                disabled={isAiVisionLoading}
                onClick={handleAiVisionLens}
                className="px-5 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-amber-300/60 cursor-pointer touch-manipulation min-h-[44px]"
              >
                <Sparkles className={`w-4 h-4 text-slate-950 ${isAiVisionLoading ? 'animate-spin' : ''}`} />
                <span>
                  {isAiVisionLoading
                    ? (lang === 'tl' ? 'Sinusuri ng AI Vision...' : 'Analyzing with AI Vision...')
                    : (lang === 'tl' ? '✨ AI Vision Lens (Stylized Packaging)' : '✨ AI Vision Lens (Stylized Packaging)')}
                </span>
              </button>
            </div>
          )}

          {/* TOP 3 RECOMMENDED PRODUCT NAME CHIPS (Uncatalogued / No Store Match) */}
          {scanMode === 'text' && isScanning && recommendedNames.length > 0 && !recognizedItem && !isUnrecognizedFallback && (
            <div className="absolute bottom-16 left-4 right-4 z-30 flex flex-col items-center gap-2 pointer-events-auto">
              <div className="text-[11px] font-black text-amber-300 bg-black/85 px-3 py-1 rounded-full border border-amber-500/40 shadow-lg flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {lang === 'tl'
                    ? 'Pumili sa mga natukoy na salita/pangalan:'
                    : 'Select a recognized product name:'}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {recommendedNames.map((recName, idx) => (
                  <button
                    key={`rec-chip-${idx}-${recName}`}
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback();
                      playScanBeep('success');
                      setDetectedText(recName);
                      handleScannedText(recName, undefined);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 hover:text-white border border-amber-400/60 font-bold text-xs sm:text-sm shadow-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[44px]"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>"{recName}"</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Camera Permission Denied or Unavailable Banner */}
          {hasCameraPermission === false && (
            <div className="relative z-20 max-w-xs mx-auto p-5 rounded-3xl bg-neutral-900/95 border border-white/20 text-center space-y-3 shadow-2xl ">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-white font-black text-sm">
                  {isPermanentlyDenied
                    ? (lang === 'tl' ? 'Naka-off ang Camera sa Settings' : 'Camera Disabled in Settings')
                    : (lang === 'tl' ? 'Kailangan ang Pahintulot sa Camera' : 'Camera Permission Required')}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  {isPermanentlyDenied
                    ? (lang === 'tl'
                        ? 'Hindi mabuksan ang camera dahil naka-block ang pahintulot. Pindutin ang Buksan ang Settings upang payagan ang camera.'
                        : 'Camera access is disabled. Tap Open Settings below to allow camera permission for Tindahan Notes.')
                    : (lang === 'tl'
                        ? 'Pindutin ang button sa ibaba upang i-trigger ang camera prompt para makapag-scan ng barcode at teksto nang offline.'
                        : 'Tap the button below to prompt camera permission for scanning barcodes and product labels offline.')}
                </p>
              </div>

              {isPermanentlyDenied ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={openCameraSettings}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{lang === 'tl' ? 'Buksan ang Settings' : 'Open Settings'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'tl' ? 'I-refresh ang Pahintulot' : 'Re-check Permission'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{lang === 'tl' ? 'Payagan ang Camera' : 'Allow Camera Access'}</span>
                </button>
              )}
            </div>
          )}

          {/* STEP 3: FALLBACK CARD (ITEM NOT RECOGNIZED) */}
          <AnimatePresence>
            {isUnrecognizedFallback && (
              <motion.div
                key="unrecognized-fallback-card"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="absolute bottom-6 left-4 right-4 z-30 max-w-sm mx-auto p-5 rounded-3xl bg-stone-900/95 border border-stone-700  shadow-2xl space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black text-sm">
                      {translate(lang, 'scanner_status_not_found') || 'Item not recognized. Add it to inventory?'}
                    </h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {detectedCode
                        ? `Detected SKU: ${detectedCode}`
                        : (detectedText ? `Detected text: "${detectedText}"` : (lang === 'tl' ? 'Wala pang kaparehong paninda.' : 'No matching product found.'))}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenAddItem) {
                          onOpenAddItem({
                            name: detectedText || '',
                            sku: detectedCode || '',
                            itemType: 'PACK_VARIETY',
                          });
                        } else {
                          handleAddUnrecognizedItem();
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{lang === 'tl' ? '+ Pack & Variety' : '+ Pack & Variety'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenAddItem) {
                          onOpenAddItem({
                            name: detectedText || '',
                            sku: detectedCode || '',
                            itemType: 'STANDARD',
                          });
                        } else {
                          handleAddUnrecognizedItem();
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-black text-xs border border-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-sky-400" />
                      <span>{lang === 'tl' ? '+ Standard' : '+ Standard Item'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRestartScan}
                    className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs border border-stone-700/80 transition-colors cursor-pointer text-center"
                  >
                    {translate(lang, 'scanner_btn_retry') || 'Scan Again'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ACTIVE SCANNED MULTI-ITEM CART TRAY (Shows when 1 or more items are queued) */}
        {cartItems.length > 0 && (
          <div className="px-4 pt-2 z-20">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/50  flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-md">
                  {cartItems.length}
                </div>
                <div className="truncate">
                  <span className="text-white font-black text-xs block truncate">
                    {lang === 'tl' ? `${cartItems.length} paninda sa cart` : `${cartItems.length} items in cart`}
                  </span>
                  <span className="text-amber-300 font-mono font-bold text-[11px]">
                    {formatPeso(cartItems.reduce((sum, it) => sum + it.totalPrice, 0))}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-stone-300 hover:text-rose-300 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  {lang === 'tl' ? 'Linisin' : 'Clear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Open modal for the first item in cart to review/checkout
                    if (cartItems.length > 0) {
                      const first = cartItems[0];
                      setCartItems((prev) => prev.slice(1));
                      setRecognizedItem(first.item);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-md active:scale-95 transition-transform cursor-pointer"
                >
                  {lang === 'tl' ? 'I-checkout' : 'Checkout'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM CONTROLS: "SCAN ANOTHER ITEM / RE-SCAN" & SCROLLABLE MANUAL TYPE FALLBACK */}
        <div className="safe-pb-modal px-4 py-3 bg-[#062016]/95  border-t border-[#0B2E21] z-20 space-y-2.5">
          {/* 1. Primary Button */}
          {scanType === 'qr_only' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestartScan}
                className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-black text-xs sm:text-sm shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <Camera className="w-4 h-4 text-slate-950 shrink-0" />
                <span className="truncate">
                  {lang === 'tl'
                    ? 'I-scan Ulit'
                    : lang === 'ja'
                    ? '再スキャン'
                    : lang === 'zh'
                    ? '重新扫描'
                    : lang === 'ko'
                    ? '다시 스캔'
                    : 'Re-scan'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => qrFileInputRef.current?.click()}
                className="flex-1 py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs sm:text-sm border border-[#0B2E21] shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <Upload className="w-4 h-4 text-white shrink-0" />
                <span className="truncate">
                  {lang === 'tl'
                    ? 'Pumili sa Gallery'
                    : lang === 'ja'
                    ? '画像から読込'
                    : lang === 'zh'
                    ? '上传图片'
                    : lang === 'ko'
                    ? '사진 업로드'
                    : 'Select from Gallery'}
                </span>
              </button>
              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleQrPhotoUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestartScan}
                className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-black text-xs sm:text-sm shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <Camera className="w-4 h-4 text-slate-950" />
                <span className="truncate">
                  {lang === 'tl'
                    ? 'I-scan ang Susunod'
                    : 'Scan Another Item'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => qrFileInputRef.current?.click()}
                className="py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs sm:text-sm border border-[#0B2E21] shadow-xl active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none shrink-0"
                title={lang === 'tl' ? 'Pumili sa Gallery' : 'Select from Gallery'}
              >
                <Upload className="w-4 h-4 text-white shrink-0" />
                <span className="hidden sm:inline">
                  {lang === 'tl' ? 'Gallery' : 'Gallery'}
                </span>
              </button>
              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleQrPhotoUpload}
                className="hidden"
              />
            </div>
          )}

          {/* 2. Secondary Option: Scrollable Manual Type Area so text is never squeezed */}
          <div className="pt-0.5">
            <form onSubmit={handleManualSearch} className="w-full flex items-center gap-2">
              <div className="relative flex-1 min-w-0 overflow-x-auto custom-modal-scrollbar">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    scanType === 'qr_only'
                      ? (lang === 'tl'
                          ? 'I-paste ang Store QR data code...'
                          : lang === 'ja'
                          ? '店舗QRコードデータを貼り付け...'
                          : lang === 'zh'
                          ? '粘贴店铺二维码数据...'
                          : lang === 'ko'
                          ? '매장 QR 코드 데이터 붙여넣기...'
                          : 'Paste Store QR data code...')
                      : (lang === 'tl'
                          ? 'O i-type ang pangalan o SKU...'
                          : 'Or type product name/SKU manually...')
                  }
                  value={manualSearchInput}
                  onChange={(e) => setManualSearchInput(e.target.value)}
                  className="w-full bg-white/15 hover:bg-white/20 text-white placeholder:text-white/50 border border-white/25 rounded-2xl py-2.5 pl-9 pr-3 text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-400 focus:bg-white/25  transition-all min-w-[180px]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black text-xs sm:text-sm border border-white/30 shadow-md active:scale-95 transition-transform cursor-pointer shrink-0"
              >
                {scanType === 'qr_only'
                  ? (lang === 'tl'
                      ? 'I-load'
                      : lang === 'ja'
                      ? '読込'
                      : lang === 'zh'
                      ? '加载'
                      : lang === 'ko'
                      ? '불러오기'
                      : 'Load')
                  : (lang === 'tl' ? 'Hanapin' : 'Find')}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ITEM RECOGNIZED ACTION MODAL (SELL / CREDIT FLOW) */}
      <ItemRecognizedModal
        isOpen={Boolean(recognizedItem)}
        item={recognizedItem}
        scannedCode={detectedCode}
        cartItems={cartItems}
        onAddAnother={(entry) => {
          setCartItems((prev) => [...prev, entry]);
          setRecognizedItem(null);
          setDetectedCode('');
          setDetectedText('');
          setIsUnrecognizedFallback(false);
          handleRestartScan();
        }}
        onRemoveCartItem={(idx) => {
          setCartItems((prev) => prev.filter((_, i) => i !== idx));
        }}
        onClose={() => {
          setRecognizedItem(null);
          handleRestartScan();
        }}
        onSuccess={(msg) => {
          setCartItems([]);
          setRecognizedItem(null);
          if (onTransactionSuccess) {
            onTransactionSuccess(msg);
          }
          onClose();
        }}
        lang={lang}
      />

    </>
  );
};

