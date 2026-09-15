import * as React from 'react';
import { RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { getActiveLanguage, type LanguageCode } from '../utils/i18n';

interface Props {
 children: React.ReactNode;
}

interface State {
 hasError: boolean;
 error: Error | null;
 copied: boolean;
 showDetails: boolean;
}

const ERROR_STRINGS: Record<
 LanguageCode,
 {
  title: string;
  description: string;
  safeNote: string;
  refreshBtn: string;
  detailsBtn: string;
  copied: string;
 }
> = {
 tl: {
  title: 'May kaunting aberya sa display',
  description: 'Huwag mag-alala! Naka-save at ligtas ang lahat ng iyong paninda, pautang, at benta sa device memory.',
  safeNote: '100% Ligtas ang Datos ng Tindahan',
  refreshBtn: 'I-refresh ang Tinda',
  detailsBtn: 'Tingnan ang Error Details',
  copied: 'Na-kopya na!',
 },
 en: {
  title: 'A display error occurred',
  description: "Don't worry! All your store items, credit records, and sales history are safely preserved on your device.",
  safeNote: 'Store Data is 100% Safe',
  refreshBtn: 'Refresh Tinda',
  detailsBtn: 'Show Error Details',
  copied: 'Copied!',
 },
 ja: {
  title: '表示エラーが発生しました',
  description: 'ご安心ください。店舗の在庫、売掛金、販売データは安全に端末に保存されています。',
  safeNote: 'データは100%安全です',
  refreshBtn: 'アプリを再読み込み',
  detailsBtn: 'エラー詳細を表示',
  copied: 'コピーしました',
 },
 zh: {
  title: '显示发生错误',
  description: '请放心！您的所有商品库存、赊账和销售记录均已安全保存在设备本地。',
  safeNote: '数据100%安全',
  refreshBtn: '刷新应用',
  detailsBtn: '查看错误详情',
  copied: '已复制',
 },
 ko: {
  title: '화면 표시 오류가 발생했습니다',
  description: '안심하세요! 모든 재고, 외상 및 판매 내역은 기기에 안전하게 보관되어 있습니다.',
  safeNote: '데이터는 100% 안전합니다',
  refreshBtn: '새로고침',
  detailsBtn: '오류 상세정보 보기',
  copied: '복사됨',
 },
};

export class ErrorBoundary extends React.Component<Props, State> {
 constructor(props: Props) {
  super(props);
  this.state = {
   hasError: false,
   error: null,
   copied: false,
   showDetails: false,
  };
 }

 public static getDerivedStateFromError(error: Error): State {
  return { hasError: true, error, copied: false, showDetails: false };
 }

 public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error('[ErrorBoundary caught error]', error, errorInfo);
 }

 private handleRefresh = () => {
  try {
   window.location.reload();
  } catch (e) {
   window.location.href = window.location.origin;
  }
 };

 private handleResetCacheAndReload = () => {
  try {
   if (typeof window !== 'undefined' && window.localStorage) {
    // Clear display/session keys without touching IndexedDB
    window.localStorage.removeItem('tindahan_theme_settings');
    window.localStorage.removeItem('tindahan_mode_selected');
    window.localStorage.removeItem('appMode');
   }
  } catch (_) {}
  this.handleRefresh();
 };

 private handleCopyError = () => {
  if (!this.state.error) return;
  const text = `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack || ''}`;
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
   navigator.clipboard.writeText(text).catch(() => {});
  }
  this.setState({ copied: true });
  setTimeout(() => this.setState({ copied: false }), 2500);
 };

 public render() {
  if (this.state.hasError) {
   const lang: LanguageCode = getActiveLanguage();
   const text = ERROR_STRINGS[lang] || ERROR_STRINGS.tl;

   return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-900 text-slate-100 select-none">
     <div className="w-full max-w-md bg-slate-800 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5 text-center animate-in fade-in duration-200">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
       <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-1.5">
       <h2 className="text-lg font-black text-white tracking-tight">{text.title}</h2>
       <p className="text-xs text-slate-300 leading-relaxed">{text.description}</p>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
       <CheckCircle2 className="w-3.5 h-3.5" />
       <span>{text.safeNote}</span>
      </div>

      <div className="space-y-2.5 pt-2">
       <button
        type="button"
        onClick={this.handleRefresh}
        className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
       >
        <RefreshCw className="w-4 h-4" />
        <span>{text.refreshBtn}</span>
       </button>

       {this.state.error && (
        <button
         type="button"
         onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
         className="w-full py-2 px-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
        >
         {this.state.showDetails ? 'Hide Error Details' : text.detailsBtn}
        </button>
       )}

       {this.state.showDetails && this.state.error && (
        <div className="text-left bg-slate-950 p-3 rounded-xl border border-slate-700/50 space-y-2 text-xs">
         <div className="font-mono text-red-400 font-bold break-all">
          {this.state.error.name}: {this.state.error.message}
         </div>
         {this.state.error.stack && (
          <div className="font-mono text-[10px] text-slate-400 max-h-36 overflow-y-auto whitespace-pre-wrap break-all select-text">
           {this.state.error.stack}
          </div>
         )}
         <div className="flex gap-2 pt-1">
          <button
           type="button"
           onClick={this.handleCopyError}
           className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium"
          >
           {this.state.copied ? text.copied : 'Copy Stack Trace'}
          </button>
          <button
           type="button"
           onClick={this.handleResetCacheAndReload}
           className="py-1 px-2 rounded-lg bg-rose-950/60 border border-rose-800/40 hover:bg-rose-900/80 text-[11px] text-rose-300 font-medium"
          >
           Reset UI Cache
          </button>
         </div>
        </div>
       )}
      </div>
     </div>
    </div>
   );
  }

  return this.props.children;
 }
}
