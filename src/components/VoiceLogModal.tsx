import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mic,
  MicOff,
  ShoppingBag,
  StickyNote,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Settings,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Volume2,
} from 'lucide-react';
import { db } from '../db/db';
import type { Transaction, Note, InventoryItem, InventoryVariant } from '../types';
import { formatPeso, getLocalDateStr } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';
import { playScanBeep } from '../utils/audioBeep';
import {
  ensureMicrophonePermission,
  openMicrophoneSettings,
  getMicrophonePermissionStrings,
} from '../utils/microphonePermission';

interface VoiceLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  lang: LanguageCode;
}

export interface VoiceDraftItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  inventoryId?: number;
  variantLabel?: string;
  sourceText?: string;
}

interface MatchCandidate {
  item: InventoryItem;
  variant?: InventoryVariant;
  label: string;
  price: number;
  stock: number;
}

interface SelectionModalState {
  rawQuery: string;
  qty: number;
  candidates: MatchCandidate[];
}

// Word-to-number mapping for Tagalog and English retail speech
const NUMBER_WORDS: Record<string, number> = {
  isa: 1,
  dalawa: 2,
  tatlo: 3,
  apat: 4,
  lima: 5,
  anim: 6,
  pito: 7,
  walo: 8,
  siyam: 9,
  sampu: 10,
  labing: 10,
  bente: 20,
  beinte: 20,
  baynte: 20,
  trenta: 30,
  kwarenta: 40,
  kuwarenta: 40,
  singkwenta: 50,
  singkuwenta: 50,
  animnapu: 60,
  pitumpu: 70,
  walumpu: 80,
  siyamnapu: 90,
  daan: 100,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

// Finish / checkout trigger phrases
const FINISH_KEYWORDS = [
  'tapos na',
  'tapos',
  'done',
  'checkout',
  'bayad',
  'isara',
  'close',
  'sige na',
  'save',
  'itala',
  'i-log',
  'finish',
  'tama na',
];

export const VoiceLogModal: React.FC<VoiceLogModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  lang,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [draftItems, setDraftItems] = useState<VoiceDraftItem[]>([]);
  const [selectionModal, setSelectionModal] = useState<SelectionModalState | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(true);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [speechLang, setSpeechLang] = useState<'fil-PH' | 'en-PH'>('fil-PH');

  // Inventory cache for smart product & variant matching
  const inventoryRef = useRef<InventoryItem[]>([]);

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
  const draftItemsRef = useRef<VoiceDraftItem[]>([]);
  const selectionModalRef = useRef<SelectionModalState | null>(null);

  // Sync refs with state
  draftItemsRef.current = draftItems;
  selectionModalRef.current = selectionModal;

  const permStrings = getMicrophonePermissionStrings(lang);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const restartTimerRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);

  // Load Inventory for Voice Lookup on Open
  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
      db.inventory
        .toArray()
        .then((items) => {
          if (isMountedRef.current) {
            inventoryRef.current = items;
          }
        })
        .catch((e) => console.warn('[Voice] Failed to load inventory:', e));

      // Reset state for new session
      setDraftItems([]);
      setSelectionModal(null);
      setLiveTranscript('');
      setSuccessToast(null);
      setIsSaving(false);
      startRecording();
    } else {
      stopRecording();
    }

    return () => {
      isMountedRef.current = false;
      stopRecording();
    };
  }, [isOpen]);

  // Normalize string for fuzzy matching
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();

  // Find candidate products and variants matching a query
  const findInventoryMatches = (query: string): MatchCandidate[] => {
    const cleanQ = normalize(query);
    if (!cleanQ || cleanQ.length < 2) return [];

    const candidates: MatchCandidate[] = [];
    const queryTokens = cleanQ.split(/\s+/);

    for (const item of inventoryRef.current) {
      const cleanItemName = normalize(item.name);
      const isDirectMatch =
        cleanItemName === cleanQ ||
        cleanItemName.includes(cleanQ) ||
        queryTokens.every((tok) => cleanItemName.includes(tok));

      // Check if item has multiple variants
      if (item.variants && item.variants.length > 0) {
        if (isDirectMatch) {
          // If the main product name matches, offer its variants
          for (const v of item.variants) {
            candidates.push({
              item,
              variant: v,
              label: `${item.name} (${v.label})`,
              price: v.unitPrice,
              stock: v.stock ?? item.stock,
            });
          }
        } else {
          // Check if specific variant label matched
          for (const v of item.variants) {
            const cleanVarLabel = normalize(`${item.name} ${v.label}`);
            if (cleanVarLabel.includes(cleanQ) || cleanQ.includes(normalize(v.label))) {
              candidates.push({
                item,
                variant: v,
                label: `${item.name} (${v.label})`,
                price: v.unitPrice,
                stock: v.stock ?? item.stock,
              });
            }
          }
        }
      } else if (isDirectMatch) {
        candidates.push({
          item,
          label: item.name,
          price: item.unitPrice,
          stock: item.stock,
        });
      }
    }

    return candidates;
  };

  // Add an item to the active draft receipt
  const addItemToDraft = (
    name: string,
    quantity: number,
    price: number,
    inventoryId?: number,
    variantLabel?: string,
    sourceText?: string
  ) => {
    const newItem: VoiceDraftItem = {
      id: `voice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemName: name,
      quantity: Math.max(1, quantity),
      unitPrice: price > 0 ? (price / Math.max(1, quantity)) : 0,
      totalPrice: price,
      inventoryId,
      variantLabel,
      sourceText,
    };

    setDraftItems((prev) => [...prev, newItem]);
    playScanBeep('success');
  };

  // Resolve selection from modal (by voice or tap)
  const handleSelectCandidate = (candidate: MatchCandidate, qty: number) => {
    addItemToDraft(
      candidate.label,
      qty,
      candidate.price * qty,
      candidate.item.id,
      candidate.variant?.label,
      selectionModalRef.current?.rawQuery
    );
    setSelectionModal(null);
  };

  // Process finalized speech transcript
  const handleFinalSpeech = (rawText: string) => {
    const clean = rawText.toLowerCase().trim();
    if (!clean) return;

    // 1. Check if user is saying checkout / finish
    const isFinishCommand = FINISH_KEYWORDS.some((kw) => clean === kw || clean.startsWith(kw));
    if (isFinishCommand && draftItemsRef.current.length > 0) {
      handleSaveAsSale();
      return;
    }

    // 2. If Selection Modal is currently active, check if user is speaking a variant choice
    if (selectionModalRef.current) {
      const activeCandidates = selectionModalRef.current.candidates;
      const matched = activeCandidates.find((c) => {
        const cleanLabel = normalize(c.label);
        const cleanVar = c.variant ? normalize(c.variant.label) : '';
        return (
          clean.includes(cleanLabel) ||
          (cleanVar && clean.includes(cleanVar)) ||
          clean.includes(normalize(c.item.name))
        );
      });

      if (matched) {
        handleSelectCandidate(matched, selectionModalRef.current.qty);
        return;
      }
    }

    // 3. Parse quantity, price, and item phrase from spoken text
    const words = clean.split(/\s+/);
    let foundQty = 1;
    let foundAmount = 0;
    const itemTokens: string[] = [];

    // Extract numbers like "20 pesos", "₱50", "30"
    const moneyRegex = /(?:₱|p|pesos?|peso)?\s*(\d+(?:\.\d{1,2})?)\s*(?:pesos?|peso)?/i;
    const match = clean.match(moneyRegex);
    if (match && match[1]) {
      foundAmount = parseFloat(match[1]);
    }

    // Check number words
    for (let i = 0; i < words.length; i++) {
      const w = words[i].replace(/[.,]/g, '');
      if (NUMBER_WORDS[w]) {
        if (foundAmount === 0 && (words[i + 1] === 'pesos' || words[i + 1] === 'peso')) {
          foundAmount = NUMBER_WORDS[w];
        } else if (i === 0 || words[i - 1] === 'benta' || words[i - 1] === 'sale') {
          foundQty = NUMBER_WORDS[w];
        }
      } else if (!['benta', 'sale', 'pesos', 'peso', 'ng', 'na', 'ang', 'sa', 'at', 'isang', 'dalawang', 'tatlong'].includes(w)) {
        itemTokens.push(w);
      }
    }

    const itemQuery = itemTokens.join(' ').replace(/\d+/g, '').trim();
    if (!itemQuery && foundAmount <= 0) return;

    // Check for inventory matches
    const matches = findInventoryMatches(itemQuery);

    if (matches.length >= 2) {
      // Multiple items/variants matched: Show Selection Modal with Bottom-Center Mic
      setSelectionModal({
        rawQuery: itemQuery,
        qty: foundQty,
        candidates: matches,
      });
      playScanBeep('double');
    } else if (matches.length === 1) {
      // Exact single match found
      const matchItem = matches[0];
      const finalPrice = foundAmount > 0 ? foundAmount : matchItem.price * foundQty;
      addItemToDraft(
        matchItem.label,
        foundQty,
        finalPrice,
        matchItem.item.id,
        matchItem.variant?.label,
        rawText
      );
    } else {
      // No direct inventory match: Add as custom spoken entry
      const itemName = itemQuery ? (itemQuery.charAt(0).toUpperCase() + itemQuery.slice(1)) : 'Paninda';
      const finalAmount = foundAmount > 0 ? foundAmount : 20 * foundQty;
      addItemToDraft(itemName, foundQty, finalAmount, undefined, undefined, rawText);
    }
  };

  // Start Hardware Noise-Cancelled Audio & Speech Recognition
  const startRecording = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    shouldKeepListeningRef.current = true;

    setErrorMessage(null);
    setLiveTranscript('');

    stopRecording(false);

    // Explicit permission verification
    const permResult = await ensureMicrophonePermission();
    if (!isMountedRef.current || !isOpen) {
      isStartingRef.current = false;
      return;
    }

    if (!permResult.granted) {
      setHasMicPermission(false);
      setIsPermanentlyDenied(permResult.permanentlyDenied);
      setErrorMessage(
        permResult.permanentlyDenied ? permStrings.deniedMsg : permStrings.promptMsg
      );
      setIsRecording(false);
      isStartingRef.current = false;
      return;
    }

    setHasMicPermission(true);
    setIsPermanentlyDenied(false);

    // Initialize Audio Visualizer
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!isMountedRef.current || !isOpen) {
          stream.getTracks().forEach((t) => t.stop());
          isStartingRef.current = false;
          return;
        }

        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          src.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let lastCheckTime = 0;
          const checkVolume = (time: number) => {
            if (!analyserRef.current) return;
            if (time - lastCheckTime > 60) {
              lastCheckTime = time;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            }
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          animFrameRef.current = requestAnimationFrame(checkVolume);
        }
      }
    } catch (err: any) {
      console.warn('[Voice] Hardware audio stream init skipped or failed:', err);
    }

    if (!isMountedRef.current || !isOpen) {
      isStartingRef.current = false;
      return;
    }

    // Initialize Speech Recognition
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMessage(translate(lang, 'voice_not_supported'));
      setIsRecording(false);
      isStartingRef.current = false;
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
        isStartingRef.current = false;
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript + ' ';
          } else {
            interim += res[0].transcript;
          }
        }

        setLiveTranscript(interim || finalChunk);

        if (finalChunk.trim()) {
          handleFinalSpeech(finalChunk.trim());
          setLiveTranscript('');
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[Voice] Speech recognition event error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage(permStrings.deniedMsg);
          shouldKeepListeningRef.current = false;
        }
        isStartingRef.current = false;
      };

      recognition.onend = () => {
        setIsRecording(false);
        isStartingRef.current = false;
        // Auto-restart if session is still active and user did not stop it
        if (shouldKeepListeningRef.current && isOpen && isMountedRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (shouldKeepListeningRef.current && isOpen && isMountedRef.current) {
              try {
                recognition.start();
              } catch (e) {}
            }
          }, 200);
        }
      };

      try {
        recognition.start();
      } catch (startErr) {
        console.warn('[Voice] Speech recognition start error:', startErr);
      }
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('[Voice] Failed to initialize speech recognition:', e);
      setIsRecording(false);
      isStartingRef.current = false;
    }
  };

  const stopRecording = (clearListeningFlag: boolean = true) => {
    if (clearListeningFlag) {
      shouldKeepListeningRef.current = false;
    }
    isStartingRef.current = false;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {}
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }
      } catch (e) {}
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
  };

  const grandTotal = draftItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleUpdateQty = (id: string, delta: number) => {
    setDraftItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = Math.max(1, item.quantity + delta);
            return {
              ...item,
              quantity: newQty,
              totalPrice: item.unitPrice * newQty,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveDraftItem = (id: string) => {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveAsSale = async () => {
    if (draftItems.length === 0 || isSaving) return;
    setIsSaving(true);
    stopRecording(true);

    try {
      const now = Date.now();
      const dateStr = getLocalDateStr();

      const txItems = draftItems.map((d) => ({
        itemName: d.itemName,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        totalPrice: d.totalPrice,
      }));

      const summaryNote = draftItems
        .map((d) => `${d.quantity}x ${d.itemName} (${formatPeso(d.totalPrice)})`)
        .join(', ');

      const newTx: Transaction = {
        timestamp: now,
        dateStr,
        type: 'SALE',
        customerName: null,
        items: txItems,
        totalAmount: grandTotal,
        rawNote: `Boses na Benta: ${summaryNote}`,
        syncStatus: 'LOCAL',
      };

      await db.transactions.add(newTx);
      playScanBeep('success');
      setSuccessToast(
        lang === 'tl'
          ? `Naitala ang benta (${formatPeso(grandTotal)})!`
          : `Sale recorded (${formatPeso(grandTotal)})!`
      );

      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } catch (err) {
      console.error('[Voice] Failed to save multi-item sale:', err);
      setIsSaving(false);
    }
  };

  const handleSaveAsNote = async () => {
    if (draftItems.length === 0 && !liveTranscript.trim()) return;
    setIsSaving(true);
    stopRecording(true);

    try {
      const now = Date.now();
      const noteContent = draftItems.length > 0
        ? draftItems.map((d) => `${d.quantity}x ${d.itemName} - ${formatPeso(d.totalPrice)}`).join('\n')
        : liveTranscript.trim();

      const newNote: Note = {
        text: `Boses Note (${draftItems.length} items):\n${noteContent}`,
        createdAt: now,
        updatedAt: now,
        autoDelete: false,
        expiresAt: null,
      };

      await db.notes.add(newNote);
      playScanBeep('success');
      setSuccessToast(translate(lang, 'voice_saved_note_success'));

      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } catch (err) {
      console.error('[Voice] Failed to save note:', err);
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-start sm:justify-center min-h-full touch-manipulation animate-in fade-in duration-200"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="my-auto w-full max-w-lg md:max-w-3xl theme-bg-card rounded-3xl border theme-border shadow-2xl overflow-hidden flex flex-col relative"
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b theme-border bg-linear-to-r from-blue-500/10 to-indigo-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-md shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg theme-text-app leading-tight">
                  {translate(lang, 'voice_heading')}
                </h3>
                <p className="text-[11px] sm:text-xs theme-text-secondary mt-0.5">
                  Sabihin ang mga item at presyo (tuloy-tuloy)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Switcher Pill */}
              <button
                type="button"
                onClick={() => {
                  const nextLang = speechLang === 'fil-PH' ? 'en-PH' : 'fil-PH';
                  setSpeechLang(nextLang);
                  stopRecording(false);
                  setTimeout(() => startRecording(), 100);
                }}
                className="px-2.5 py-1 rounded-xl text-[11px] font-black theme-bg-surface-subtle border theme-border theme-text-app hover:theme-bg-surface transition-colors cursor-pointer"
              >
                {speechLang === 'fil-PH' ? '🇵🇭 Tagalog' : '🌐 English'}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl theme-hover-bg theme-text-secondary hover:theme-text-app cursor-pointer transition-colors"
                aria-label={translate(lang, 'btn_close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content - Responsive 2-column on MD/PC */}
          <div className="p-4 sm:p-5 space-y-4 flex-1">
            {successToast ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 flex flex-col items-center justify-center text-center space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-lg font-black theme-text-app">{successToast}</h4>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left Side: Voice status & controls */}
                <div className="md:col-span-5 space-y-3">
                  {/* Live Mic Wave & Status */}
                  <div className="flex flex-col gap-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => (isRecording ? stopRecording(true) : startRecording())}
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md cursor-pointer transition-all active:scale-95 shrink-0 ${
                          isRecording
                            ? 'bg-blue-600 text-white shadow-blue-500/30'
                            : 'theme-bg-surface-subtle theme-text-secondary border theme-border'
                        }`}
                      >
                        {isRecording ? (
                          <Mic className="w-5 h-5 " />
                        ) : (
                          <MicOff className="w-5 h-5 opacity-60" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black theme-text-app">
                            {isRecording ? 'Nakikinig nang tuloy-tuloy...' : 'Naka-pause ang mikropono'}
                          </span>
                          {isRecording && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] theme-text-secondary mt-0.5">
                          Sabihin: <i>"2 Coke bente"</i>, <i>"Milo"</i>, <i>"Tapos na"</i>
                        </p>
                      </div>
                    </div>

                    {/* Audio Volume Bar */}
                    {isRecording && (
                      <div className="flex items-center gap-2 h-7 px-2.5 rounded-xl bg-blue-500/15">
                        <Volume2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <div className="flex-1 h-1.5 bg-blue-200 dark:bg-blue-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-75"
                            style={{ width: `${audioLevel}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {audioLevel}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Live Speech Recognition Transcript Box */}
                  {liveTranscript && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-medium theme-text-app flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-spin" />
                      <span className="italic truncate">{liveTranscript}</span>
                    </motion.div>
                  )}

                  {/* Error Banner */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 flex flex-col gap-2.5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <span className="leading-snug font-medium">{errorMessage}</span>
                      </div>
                      {isPermanentlyDenied ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={openMicrophoneSettings}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>{permStrings.openSettingsBtn}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={startRecording}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>{permStrings.allowBtn}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Side: Draft Receipt / Multi-Item Basket */}
                <div className="md:col-span-7 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black theme-text-app uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                      Narinig na mga Paninda ({draftItems.length})
                    </span>
                    {draftItems.length > 0 && (
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                        Kabuuan: {formatPeso(grandTotal)}
                      </span>
                    )}
                  </div>

                  {draftItems.length === 0 ? (
                    <div className="p-6 md:p-8 rounded-2xl theme-bg-surface-subtle border border-dashed theme-border text-center space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <Mic className="w-6 h-6 " />
                      </div>
                      <p className="text-xs font-bold theme-text-app">
                        Magsalita para magdagdag ng paninda
                      </p>
                      <p className="text-[11px] theme-text-secondary max-w-xs mx-auto">
                        Hindi magsasara ang window na ito habang nagsasalita ka. Sabihin ang{' '}
                        <b className="theme-text-app">"Tapos na"</b> o i-tap ang button sa ibaba kapag kumpleto na.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 md:max-h-72 overflow-y-auto pr-1">
                      {draftItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl theme-bg-surface-subtle border theme-border flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-xs theme-text-app truncate">
                              {item.itemName}
                            </div>
                            <div className="text-[11px] theme-text-secondary flex items-center gap-2 mt-0.5">
                              <span>
                                {item.quantity} x {formatPeso(item.unitPrice)}
                              </span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                = {formatPeso(item.totalPrice)}
                              </span>
                            </div>
                          </div>

                          {/* Quantity +/- Controls */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, -1)}
                              className="w-7 h-7 rounded-xl theme-bg-card border theme-border theme-text-app font-black text-xs flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-black theme-text-app">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, 1)}
                              className="w-7 h-7 rounded-xl theme-bg-card border theme-border theme-text-app font-black text-xs flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftItem(item.id)}
                              className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 cursor-pointer ml-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          {!successToast && (
            <div className="p-4 sm:p-5 border-t theme-border flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                disabled={draftItems.length === 0 || isSaving}
                onClick={handleSaveAsNote}
                className="w-full sm:w-auto py-3 px-4 rounded-2xl theme-bg-surface-subtle theme-text-app text-xs font-black hover:theme-bg-surface cursor-pointer active:scale-95 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <StickyNote className="w-4 h-4 text-amber-500" />
                <span>I-save bilang Note</span>
              </button>

              <button
                type="button"
                disabled={draftItems.length === 0 || isSaving}
                onClick={handleSaveAsSale}
                className="w-full sm:flex-1 py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  I-log ang Benta ({draftItems.length > 0 ? formatPeso(grandTotal) : '₱0.00'})
                </span>
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* VARIANT SELECTION OVERLAY & BOTTOM-CENTER VOICE INDICATOR */}
          {/* ======================================================== */}
          <AnimatePresence>
            {selectionModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-40 bg-black/70 backdrop-blur-xs flex flex-col justify-end p-3 sm:p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.15 }}
                  className="w-full theme-bg-card rounded-3xl border theme-border shadow-2xl p-4 sm:p-5 flex flex-col max-h-[75%]"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b theme-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm theme-text-app">
                          Pumili ng Item / Variant
                        </h4>
                        <p className="text-[11px] theme-text-secondary">
                          Narinig: <b className="theme-text-app">"{selectionModal.rawQuery}"</b>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectionModal(null)}
                      className="p-1.5 rounded-xl theme-hover-bg theme-text-secondary cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* List of Matched Items/Variants */}
                  <div className="space-y-2 overflow-y-auto max-h-48 mb-4">
                    {selectionModal.candidates.map((c, idx) => (
                      <button
                        key={`${c.item.id}-${c.variant?.label || idx}`}
                        type="button"
                        onClick={() => handleSelectCandidate(c, selectionModal.qty)}
                        className="w-full p-3 rounded-2xl theme-bg-surface-subtle hover:theme-bg-surface border theme-border text-left flex items-center justify-between gap-3 active:scale-98 transition-all cursor-pointer"
                      >
                        <div>
                          <div className="font-black text-xs theme-text-app">{c.label}</div>
                          <div className="text-[10px] theme-text-secondary mt-0.5">
                            Stock: {c.stock} • {c.item.category || 'Paninda'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-xs text-blue-600 dark:text-blue-400">
                            {formatPeso(c.price * selectionModal.qty)}
                          </div>
                          <div className="text-[10px] theme-text-secondary">
                            {formatPeso(c.price)} / pc
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* BOTTOM-CENTER PULSING VOICE INDICATOR */}
                  <div className="pt-2 border-t theme-border flex items-center justify-center">
                    <div className="px-4 py-2 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 flex items-center gap-2.5 ">
                      <Mic className="w-4 h-4" />
                      <span className="text-xs font-black">
                        Nakikinig... Sabihin ang variant o i-tap
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

