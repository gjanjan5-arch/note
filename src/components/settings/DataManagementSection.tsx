import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
 RefreshCw,
 Download,
 Upload,
 Trash2,
 AlertTriangle,
 ChevronRight,
 ShieldAlert,
 Check,
 QrCode,
} from 'lucide-react';
import { translate, type LanguageCode } from '../../utils/i18n';
import {
 performExportBackup,
 performImportBackup,
 performClearActiveData,
 toggleAutoUpdateDataState,
} from '../../utils/dataManager';
import { isAutoUpdateEnabled } from '../../utils/backupManager';
import { getStoreProfile } from '../../utils/storeSettings';

interface SlideToDeleteProps {
 onComplete: () => void;
 label?: string;
 lang: LanguageCode;
 resetTrigger?: number;
}

export const SlideToDelete: React.FC<SlideToDeleteProps> = ({
 onComplete,
 label = 'Remove All Store Data',
 lang,
 resetTrigger = 0,
}) => {
 const [progress, setProgress] = useState(0);
 const [isDragging, setIsDragging] = useState(false);
 const trackRef = useRef<HTMLDivElement>(null);
 const thumbRef = useRef<HTMLDivElement>(null);
 const startXRef = useRef<number>(0);
 const currentDragPxRef = useRef<number>(0);

 useEffect(() => {
  setProgress(0);
  setIsDragging(false);
  currentDragPxRef.current = 0;
 }, [resetTrigger]);

 const updateDrag = useCallback(
  (clientX: number) => {
   if (!trackRef.current) return;
   const trackRect = trackRef.current.getBoundingClientRect();
   const thumbWidth = thumbRef.current ? thumbRef.current.offsetWidth : 48;
   const maxDrag = trackRect.width - thumbWidth;

   if (maxDrag <= 0) return;

   const currentX = clientX - trackRect.left - thumbWidth / 2;
   const clampedPx = Math.max(0, Math.min(currentX, maxDrag));
   currentDragPxRef.current = clampedPx;
   const newProgress = Math.round((clampedPx / maxDrag) * 100);
   setProgress(newProgress);

   if (newProgress >= 95) {
    setIsDragging(false);
    setProgress(100);
    onComplete();
   }
  },
  [onComplete]
 );

 const handleTouchStart = (e: React.TouchEvent) => {
  setIsDragging(true);
  startXRef.current = e.touches[0].clientX;
  updateDrag(e.touches[0].clientX);
 };

 const handleTouchMove = (e: React.TouchEvent) => {
  if (!isDragging) return;
  updateDrag(e.touches[0].clientX);
 };

 const handleTouchEnd = () => {
  if (!isDragging) return;
  setIsDragging(false);
  if (progress < 95) {
   setProgress(0);
   currentDragPxRef.current = 0;
  }
 };

 const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault();
  setIsDragging(true);
  startXRef.current = e.clientX;
  updateDrag(e.clientX);
 };

 useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
   if (!isDragging) return;
   updateDrag(e.clientX);
  };

  const handleMouseUp = () => {
   if (!isDragging) return;
   setIsDragging(false);
   if (progress < 95) {
    setProgress(0);
    currentDragPxRef.current = 0;
   }
  };

  if (isDragging) {
   window.addEventListener('mousemove', handleMouseMove);
   window.addEventListener('mouseup', handleMouseUp);
  }

  return () => {
   window.removeEventListener('mousemove', handleMouseMove);
   window.removeEventListener('mouseup', handleMouseUp);
  };
 }, [isDragging, progress, updateDrag]);

 return (
  <div className="space-y-1.5 select-none">
   <div className="flex items-center justify-between text-[11px] font-bold theme-text-secondary px-0.5">
    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
     <ShieldAlert className="w-3.5 h-3.5" />
     <span>Danger Zone</span>
    </span>
    <span className="text-[10px] theme-text-secondary">
     {progress > 0 && progress < 95
      ? `${progress}%`
      : lang === 'tl'
      ? 'I-slide pakanan para burahin'
      : 'Slide right to clear'}
    </span>
   </div>

   <div
    ref={trackRef}
    className="relative h-13 rounded-2xl bg-red-100/90 dark:bg-red-950/50 border border-red-300 dark:border-red-800/60 shadow-inner overflow-hidden flex items-center p-1 cursor-pointer touch-none"
   >
    <div
     className={`absolute inset-y-0 left-0 bg-red-500/25 dark:bg-red-600/35 border-r-2 border-red-500/70 ${
      !isDragging ? 'transition-all duration-300 ease-out' : ''
     }`}
     style={{ width: `${Math.max(0, progress)}%` }}
    />

    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-10">
     <span
      className="text-xs font-black tracking-wide text-red-700 dark:text-red-200 drop-shadow-xs flex items-center gap-1.5 transition-opacity"
      style={{ opacity: Math.max(0.15, 1 - progress / 60) }}
     >
      <span>{label}</span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-300" />
     </span>
    </div>

    <div
     ref={thumbRef}
     onTouchStart={handleTouchStart}
     onTouchMove={handleTouchMove}
     onTouchEnd={handleTouchEnd}
     onMouseDown={handleMouseDown}
     className={`relative z-10 w-11 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-900/40 cursor-grab active:cursor-grabbing shrink-0 ${
      !isDragging ? 'transition-all duration-300 ease-out' : ''
     }`}
     style={{
      transform: trackRef.current
       ? `translateX(${(progress / 100) * (trackRef.current.offsetWidth - (thumbRef.current?.offsetWidth || 44) - 8)}px)`
       : `translateX(${progress}%)`,
     }}
    >
     {progress >= 95 ? (
      <Check className="w-5 h-5 stroke-[3] text-white" />
     ) : (
      <Trash2 className="w-5 h-5 text-white" />
     )}
    </div>
   </div>
  </div>
 );
};

interface DataManagementSectionProps {
 lang: LanguageCode;
 onDataChanged: () => void;
 onOpenStoreQR?: () => void;
}

export const DataManagementSection: React.FC<DataManagementSectionProps> = ({
 lang,
 onDataChanged,
 onOpenStoreQR,
}) => {
 const [dataMessage, setDataMessage] = useState<string | null>(null);
 const [autoUpdateData, setAutoUpdateData] = useState<boolean>(() => isAutoUpdateEnabled());
 const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
 const [sliderResetKey, setSliderResetKey] = useState(0);
 const [countdownSeconds, setCountdownSeconds] = useState(8);
 const [confirmKeywordInput, setConfirmKeywordInput] = useState('');

 const requiredClearKeyword = lang === 'tl' ? 'BURAHIN' : 'DELETE';
 const isKeywordMatched = confirmKeywordInput.trim().toUpperCase() === requiredClearKeyword;
 const isClearExecutable = countdownSeconds === 0 && isKeywordMatched;

 // 8-second safety countdown timer
 useEffect(() => {
  let timer: NodeJS.Timeout;
  if (showClearConfirmModal) {
   setCountdownSeconds(8);
   setConfirmKeywordInput('');
   timer = setInterval(() => {
    setCountdownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
   }, 1000);
  } else {
   setCountdownSeconds(8);
   setConfirmKeywordInput('');
  }

  return () => {
   if (timer) clearInterval(timer);
  };
 }, [showClearConfirmModal]);

 const handleToggleAutoUpdate = async () => {
  const { newState, message } = await toggleAutoUpdateDataState(autoUpdateData, lang);
  setAutoUpdateData(newState);
  setDataMessage(message);
 };

 const handleExport = async () => {
  const res = await performExportBackup(lang);
  setDataMessage(res.message);
 };

 const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
   const readText = (): Promise<string> => {
    return new Promise((resolve, reject) => {
     if (typeof file.text === 'function') {
      file.text().then(resolve).catch(reject);
      return;
     }
     const reader = new FileReader();
     reader.onload = () => resolve(reader.result as string);
     reader.onerror = () => reject(new Error('Failed to read backup file'));
     reader.readAsText(file);
    });
   };

   const text = await readText();
   const res = await performImportBackup(text, lang);
   setDataMessage(res.message);
   if (res.success) {
    onDataChanged();
   }
  } catch (err: any) {
   setDataMessage(err?.message || 'Failed to read file.');
  } finally {
   e.target.value = '';
  }
 };

 const handleSlideComplete = () => {
  setShowClearConfirmModal(true);
  setCountdownSeconds(8);
  setConfirmKeywordInput('');
 };

 const handleCancelClear = () => {
  setShowClearConfirmModal(false);
  setConfirmKeywordInput('');
  setCountdownSeconds(8);
  setSliderResetKey((k) => k + 1);
 };

 const handleFinalConfirmClear = async () => {
  if (!isClearExecutable) return;

  setShowClearConfirmModal(false);
  setConfirmKeywordInput('');
  setCountdownSeconds(8);
  setSliderResetKey((k) => k + 1);

  setAutoUpdateData(false);
  const res = await performClearActiveData(lang);
  setDataMessage(res.message);
  onDataChanged();
 };

 return (
  <div className="space-y-4">
   <div>
    <h4 className="font-extrabold theme-text-app text-sm mb-1">{translate(lang, 'section_data')}</h4>
    <p className="text-xs theme-text-secondary">
     Export backups to files, restore existing store records, or configure sync preferences.
    </p>
   </div>

   {dataMessage && (
    <div className="theme-bg-surface-subtle border theme-border-subtle theme-text-app font-bold text-xs p-3 rounded-2xl whitespace-pre-line leading-relaxed">
     {dataMessage}
    </div>
   )}

   <div className="space-y-3">
    {/* Auto-Update Data Toggle Switch */}
    <div id="settings-auto-update-card" className="flex items-center justify-between p-3 theme-bg-surface-subtle rounded-2xl border theme-border-subtle">
     <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
       <RefreshCw className={`w-3.5 h-3.5 ${autoUpdateData ? 'animate-spin' : ''}`} />
      </div>
      <div>
       <span className="text-xs font-bold theme-text-app">Auto-Update Data</span>
       <span className="text-[10px] theme-text-secondary block">
        {lang === 'tl'
         ? 'Awtomatikong ino-overwrite ang backup sa Documents/Tindahan Notes'
         : 'Auto-overwrites backup in Documents/Tindahan Notes'}
       </span>
      </div>
     </div>
     <button
      type="button"
      onClick={handleToggleAutoUpdate}
      aria-label="Toggle Auto-Update Data"
      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer touch-manipulation ${
       autoUpdateData ? 'theme-bg-primary' : 'bg-gray-300 dark:bg-gray-600'
      }`}
     >
      <span
       className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        autoUpdateData ? 'translate-x-5' : 'translate-x-0'
       }`}
      />
     </button>
    </div>

    {/* Export Backup JSON */}
    <button
     type="button"
     onClick={handleExport}
     className="w-full theme-card hover:theme-bg-surface-subtle border theme-border-subtle theme-text-app font-extrabold p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-98 touch-manipulation"
    >
     <div className="flex items-center gap-2.5">
      <Download className="w-5 h-5 theme-text-accent" />
      <div className="text-left">
       <span className="block font-bold theme-text-app">{translate(lang, 'backup_export_btn')}</span>
       <span className="text-[11px] theme-text-secondary font-normal">
        Save & overwrite in Documents/Tindahan Notes
       </span>
      </div>
     </div>
     <span className="text-xs theme-text-accent font-bold">Export</span>
    </button>

    {/* Import JSON */}
    <label className="w-full theme-card hover:theme-bg-surface-subtle border theme-border-subtle theme-text-app font-extrabold p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-98 touch-manipulation">
     <div className="flex items-center gap-2.5">
      <Upload className="w-5 h-5 theme-text-primary" />
      <div className="text-left">
       <span className="block font-bold theme-text-app">{translate(lang, 'import_restore_btn')}</span>
       <span className="text-[11px] theme-text-secondary font-normal">Load from a backup .json file</span>
      </div>
     </div>
     <span className="text-xs theme-text-accent font-bold">Select File</span>
     <input type="file" accept=".json" onChange={handleImport} className="hidden" />
    </label>

    {/* Slide to Delete: Clear Active Store Data */}
    <div className="pt-3 border-t theme-border-subtle">
     <SlideToDelete
      label={lang === 'tl' ? 'Burahin ang Active Data' : 'Clear Active Data'}
      lang={lang}
      onComplete={handleSlideComplete}
      resetTrigger={sliderResetKey}
     />
     <p className="text-[10px] text-center theme-text-secondary mt-2">
      {lang === 'tl'
       ? 'Hindi maaapektuhan ang backup files sa Documents at store settings.'
       : 'Backup files in Documents and store settings remain safely preserved.'}
     </p>
    </div>
   </div>

   {/* Danger Modal with Step 2 (8s Timer) & Step 3 (Keyword Confirmation) */}
   {showClearConfirmModal && (
    <div
     className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
     onClick={handleCancelClear}
    >
     <div
      className="theme-card max-w-sm w-full rounded-3xl p-5 border-2 border-red-500/50 shadow-2xl space-y-4 text-center animate-in fade-in duration-150"
      onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
     >
      <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto shadow-inner">
       <AlertTriangle className="w-7 h-7 stroke-[2.5]" />
      </div>

      <div className="space-y-1.5">
       <h4 className="font-black text-base theme-text-app">
        {lang === 'tl' ? 'Burahin ang Active Store Data?' : 'Clear Active App Data?'}
       </h4>
       <p className="text-xs theme-text-secondary leading-relaxed">
        {lang === 'tl'
         ? 'Mabubura ang lahat ng paninda, benta, suki, at tala sa app. Mananatiling ligtas ang iyong backup files sa storage at mga setting.'
         : 'All active transactions, inventory, customers, and notes will be cleared. Downloaded backup files and store settings remain safe.'}
       </p>
      </div>

      {/* Step 2: 8-Second Safety Timer Countdown */}
      <div className="space-y-2">
       <div
        className={`text-xs font-bold p-2.5 rounded-xl border flex items-center justify-center gap-2 ${
         countdownSeconds > 0
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
        }`}
       >
        {countdownSeconds > 0 ? (
         <span>
          {lang === 'tl'
           ? `Naka-lock: Maghintay ng ${countdownSeconds}s...`
           : `Locked: Please wait ${countdownSeconds}s...`}
         </span>
        ) : (
         <span className="flex items-center gap-1">
          <Check className="w-4 h-4" />
          {lang === 'tl'
           ? `I-type ang "${requiredClearKeyword}" upang kumpirmahin`
           : `Type "${requiredClearKeyword}" to confirm`}
         </span>
        )}
       </div>

       {/* Step 3: Confirmation Keyword Input */}
       <div className="space-y-1 text-left">
        <label className="text-[11px] font-bold theme-text-secondary block">
         {lang === 'tl'
          ? `Kumpirmasyon (I-type ang "${requiredClearKeyword}"):`
          : `Confirmation (Type "${requiredClearKeyword}"):`}
        </label>
        <input
         type="text"
         disabled={countdownSeconds > 0}
         value={confirmKeywordInput}
         onChange={(e) => setConfirmKeywordInput(e.target.value)}
         placeholder={
          countdownSeconds > 0
           ? lang === 'tl'
            ? `Naka-lock (${countdownSeconds}s)...`
            : `Locked (${countdownSeconds}s)...`
           : requiredClearKeyword
         }
         className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold uppercase tracking-wider border transition-all ${
          countdownSeconds > 0
           ? 'opacity-50 cursor-not-allowed bg-black/5 dark:bg-white/5 theme-border-subtle text-center'
           : isKeywordMatched
           ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 focus:outline-hidden'
           : 'border-red-500/40 bg-black/5 dark:bg-white/5 focus:border-red-500 focus:outline-hidden theme-text-app'
         }`}
        />
       </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
       <button
        type="button"
        onClick={handleCancelClear}
        className="py-2.5 px-3 rounded-xl border theme-border-subtle theme-card font-bold theme-text-app hover:theme-bg-surface-subtle active:scale-95 transition-all cursor-pointer touch-manipulation text-xs"
       >
        {lang === 'tl' ? 'Kanselahin' : 'Cancel'}
       </button>
       <button
        type="button"
        disabled={!isClearExecutable}
        onClick={handleFinalConfirmClear}
        className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
         isClearExecutable
          ? 'bg-red-600 hover:bg-red-700 text-white active:scale-95 shadow-md shadow-red-950/40 cursor-pointer touch-manipulation'
          : 'bg-red-950/30 text-red-400/40 border border-red-500/20 cursor-not-allowed'
        }`}
       >
        <Trash2 className="w-4 h-4" />
        <span>{lang === 'tl' ? 'Burahin' : 'Clear Data'}</span>
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
};
