warning: in the working copy of 'src/components/TransactionLedger.tsx', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/src/components/TransactionLedger.tsx b/src/components/TransactionLedger.tsx[m
[1mindex 0d4d53a..e1700bc 100644[m
[1m--- a/src/components/TransactionLedger.tsx[m
[1m+++ b/src/components/TransactionLedger.tsx[m
[36m@@ -7,9 +7,11 @@[m [mimport {[m
   RefreshCw,[m
   Filter,[m
   Check,[m
[32m+[m[32m  X,[m
[32m+[m[32m  Receipt,[m
 } from 'lucide-react';[m
 import type { Transaction, TransactionType } from '../types';[m
[31m-import { formatPeso, formatDateTime } from '../utils/formatters';[m
[32m+[m[32mimport { formatPeso, formatDateTime, getLocalDateStr } from '../utils/formatters';[m
 import { translate, type LanguageCode } from '../utils/i18n';[m
 [m
 interface TransactionLedgerProps {[m
[36m@@ -28,11 +30,40 @@[m [mexport const TransactionLedger: React.FC<TransactionLedgerProps> = ({[m
   const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);[m
   const dropdownRef = useRef<HTMLDivElement>(null);[m
   const [selectedDateFilter, setSelectedDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'ALL'>('TODAY');[m
[32m+[m[32m  const [viewDetailTx, setViewDetailTx] = useState<Transaction | null>(null);[m
 [m
[31m-  const todayISO = new Date().toISOString().slice(0, 10);[m
[32m+[m[32m  useEffect(() => {[m
[32m+[m[32m    if (viewDetailTx) {[m
[32m+[m[32m      console.log('[TransactionLedger] Detail view active for transaction:', {[m
[32m+[m[32m        id: viewDetailTx.id,[m
[32m+[m[32m        type: viewDetailTx.type,[m
[32m+[m[32m        customerName: viewDetailTx.customerName,[m
[32m+[m[32m        totalAmount: viewDetailTx.totalAmount,[m
[32m+[m[32m        items: viewDetailTx.items,[m
[32m+[m[32m        timestamp: viewDetailTx.timestamp,[m
[32m+[m[32m        dateStr: viewDetailTx.dateStr,[m
[32m+[m[32m      });[m
[32m+[m[32m    } else {[m
[32m+[m[32m      console.log('[TransactionLedger] Detail view closed');[m
[32m+[m[32m    }[m
[32m+[m[32m  }, [viewDetailTx]);[m
[32m+[m
[32m+[m[32m  const handleItemSelect = (tx: Transaction, eventSource: string) => {[m
[32m+[m[32m    console.log(`[TransactionLedger] History item selected via ${eventSource}:`, {[m
[32m+[m[32m      id: tx.id,[m
[32m+[m[32m      type: tx.type,[m
[32m+[m[32m      customerName: tx.customerName,[m
[32m+[m[32m      totalAmount: tx.totalAmount,[m
[32m+[m[32m      itemsCount: tx.items?.length || 0,[m
[32m+[m[32m      timestamp: tx.timestamp,[m
[32m+[m[32m    });[m
[32m+[m[32m    setViewDetailTx(tx);[m
[32m+[m[32m  };[m
[32m+[m
[32m+[m[32m  const todayStr = getLocalDateStr();[m
   const yesterday = new Date();[m
   yesterday.setDate(yesterday.getDate() - 1);[m
[31m-  const yesterdayISO = yesterday.toISOString().slice(0, 10);[m
[32m+[m[32m  const yesterdayStr = getLocalDateStr(yesterday);[m
 [m
   // Close dropdown on outside click[m
   useEffect(() => {[m
[36m@@ -60,9 +91,10 @@[m [mexport const TransactionLedger: React.FC<TransactionLedgerProps> = ({[m
     .filter((tx) => {[m
       if (!tx) return false;[m
 [m
[31m-      // 1. Date Filter[m
[31m-      if (selectedDateFilter === 'TODAY' && tx.dateStr !== todayISO) return false;[m
[31m-      if (selectedDateFilter === 'YESTERDAY' && tx.dateStr !== yesterdayISO) return false;[m
[32m+[m[32m      // 1. Date Filter (using local device dateStr or local formatted timestamp)[m
[32m+[m[32m      const txDate = tx.dateStr || getLocalDateStr(tx.timestamp);[m
[32m+[m[32m      if (selectedDateFilter === 'TODAY' && txDate !== todayStr) return false;[m
[32m+[m[32m      if (selectedDateFilter === 'YESTERDAY' && txDate !== yesterdayStr) return false;[m
 [m
       // 2. Type Filter (Multi-select / empty = all)[m
       if (selectedTypes.length > 0 && !selectedTypes.includes(tx.type)) return false;[m
[36m@@ -88,7 +120,7 @@[m [mexport const TransactionLedger: React.FC<TransactionLedgerProps> = ({[m
           tx.totalAmount != null &&[m
           (tx.totalAmount.toString().includes(q) ||[m
             formatPeso(tx.totalAmount).toLowerCase().includes(q));[m
[31m-        const matchDateStr = tx.dateStr?.toLowerCase().includes(q) || false;[m
[32m+[m[32m        const matchDateStr = (tx.dateStr || txDate).toLowerCase().includes(q) || false;[m
         const formattedDate = formatDateTime(tx.timestamp).toLowerCase();[m
         const matchFormattedDate = formattedDate.includes(q);[m
 [m
[36m@@ -348,9 +380,22 @@[m [mexport const TransactionLedger: React.FC<TransactionLedgerProps> = ({[m
             return ([m
               <div[m
                 key={tx.id}[m
[31m-                className="theme-card rounded-3xl p-3.5 sm:p-4 shadow-2xs border hover:border-[var(--color-primary)] transition-all flex items-start justify-between gap-3"[m
[32m+[m[32m                role="button"[m
[32m+[m[32m                tabIndex={0}[m
[32m+[m[32m                aria-label={`View transaction details for ${tx.customerName || tx.type}`}[m
[32m+[m[32m                onClick={(e) => {[m
[32m+[m[32m                  e.stopPropagation();[m
[32m+[m[32m                  handleItemSelect(tx, 'onClick');[m
[32m+[m[32m                }}[m
[32m+[m[32m                onKeyDown={(e) => {[m
[32m+[m[32m                  if (e.key === 'Enter' || e.key === ' ') {[m
[32m+[m[32m                    e.preventDefault();[m
[32m+[m[32m                    handleItemSelect(tx, 'onKeyDown');[m
[32m+[m[32m                  }[m
[32m+[m[32m                }}[m
[32m+[m[32m                className="theme-card rounded-3xl p-3.5 sm:p-4 shadow-2xs border hover:border-[var(--color-primary)] active:scale-[0.99] transition-all flex items-start justify-between gap-3 cursor-pointer select-none touch-manipulation focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"[m
               >[m
[31m-                <div className="space-y-1.5 flex-1 min-w-0">[m
[32m+[m[32m                <div className="space-y-1.5 flex-1 min-w-0 pointer-events-none">[m
                   <div className="flex items-center gap-2 flex-wrap">[m
                     <span[m
                       className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-lg ${style.bg}`}[m
[36m@@ -389,7 +434,7 @@[m [mexport const TransactionLedger: React.FC<TransactionLedgerProps> = ({[m
                   )}[m
                 </div>[m
 [m
[31m-                <div className="text-right shrink-0 flex flex-col items-end justify-center self-stretch">[m
[32m+[m[32m                <div className="text-right shrink-0 flex flex-col items-end justify-center self-stretch pointer-events-none">[m
                   <span className="text-sm sm:text-base font-black theme-text-app">[m
                     {formatPeso(tx.totalAmount)}[m
                   </span>[m
[36m@@ -399,6 +444,110 @@[m [mexport const TransactionLedger: React.FC<TransactionLedgerProps> = ({[m
           })[m
         )}[m
       </div>[m
[32m+[m
[32m+[m[32m      {/* Transaction Breakdown / Receipt Modal */}[m
[32m+[m[32m      {viewDetailTx && ([m
[32m+[m[32m        <div[m
[32m+[m[32m          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"[m
[32m+[m[32m          onClick={(e) => {[m
[32m+[m[32m            if (e.target === e.currentTarget) {[m
[32m+[m[32m              console.log('[TransactionLedger] Modal backdrop clicked, closing detail view');[m
[32m+[m[32m              setViewDetailTx(null);[m
[32m+[m[32m            }[m
[32m+[m[32m          }}[m
[32m+[m[32m        >[m
[32m+[m[32m          <div[m
[32m+[m[32m            className="theme-card rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border animate-in zoom-in-95 space-y-4"[m
[32m+[m[32m            onClick={(e) => e.stopPropagation()}[m
[32m+[m[32m          >[m
[32m+[m[32m            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle">[m
[32m+[m[32m              <div className="flex items-center gap-2">[m
[32m+[m[32m                <Receipt className="w-5 h-5 theme-text-accent" />[m
[32m+[m[32m                <h3 className="font-black theme-text-app text-base">[m
[32m+[m[32m                  {lang === 'tl' ? 'Detalye ng Transaksyon' : 'Transaction Receipt'}[m
[32m+[m[32m                </h3>[m
[32m+[m[32m              </div>[m
[32m+[m[32m              <button[m
[32m+[m[32m                type="button"[m
[32m+[m[32m                onClick={() => {[m
[32m+[m[32m                  console.log('[TransactionLedger] Close icon clicked, closing modal');[m
[32m+[m[32m                  setViewDetailTx(null);[m
[32m+[m[32m                }}[m
[32m+[m[32m                className="w-8 h-8 rounded-xl theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary flex items-center justify-center cursor-pointer active:scale-95 transition-all"[m
[32m+[m[32m                aria-label={translate(lang, 'btn_cancel') || 'Close'}[m
[32m+[m[32m              >[m
[32m+[m[32m                <X className="w-4 h-4" />[m
[32m+[m[32m              </button>[m
[32m+[m[32m            </div>[m
[32m+[m
[32m+[m[32m            <div className="space-y-3 text-xs">[m
[32m+[m[32m              <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-1">[m
[32m+[m[32m                <div className="flex items-center justify-between text-xs">[m
[32m+[m[32m                  <span className="theme-text-secondary">{translate(lang, 'date') || 'Date'}:</span>[m
[32m+[m[32m                  <span className="font-bold theme-text-app">{formatDateTime(viewDetailTx.timestamp)}</span>[m
[32m+[m[32m                </div>[m
[32m+[m[32m                {viewDetailTx.customerName && ([m
[32m+[m[32m                  <div className="flex items-center justify-between text-xs">[m
[32m+[m[32m                    <span className="theme-text-secondary">{translate(lang, 'customer_name') || 'Customer'}:</span>[m
[32m+[m[32m                    <span className="font-black theme-text-accent">{viewDetailTx.customerName}</span>[m
[32m+[m[32m                  </div>[m
[32m+[m[32m                )}[m
[32m+[m[32m                <div className="flex items-center justify-between text-xs">[m
[32m+[m[32m                  <span className="theme-text-secondary">Type:</span>[m
[32m+[m[32m                  <span className="font-bold theme-text-app">{viewDetailTx.type}</span>[m
[32m+[m[32m                </div>[m
[32m+[m[32m              </div>[m
[32m+[m
[32m+[m[32m              {/* Items Table */}[m
[32m+[m[32m              {viewDetailTx.items && viewDetailTx.items.length > 0 ? ([m
[32m+[m[32m                <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle space-y-2">[m
[32m+[m[32m                  <span className="text-[10px] font-black uppercase tracking-wider theme-text-secondary block border-b theme-border-subtle pb-1">[m
[32m+[m[32m                    {lang === 'tl' ? 'Mga Binili / Kasama' : 'Items Sold'}[m
[32m+[m[32m                  </span>[m
[32m+[m[32m                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">[m
[32m+[m[32m                    {viewDetailTx.items.map((it, idx) => ([m
[32m+[m[32m                      <div key={idx} className="flex items-center justify-between gap-2">[m
[32m+[m[32m                        <span className="font-bold theme-text-app truncate">[m
[32m+[m[32m                          {it.quantity}x {it.itemName}[m
[32m+[m[32m                        </span>[m
[32m+[m[32m                        <span className="font-mono font-bold theme-text-app shrink-0">[m
[32m+[m[32m                          {formatPeso(it.totalPrice)}[m
[32m+[m[32m                        </span>[m
[32m+[m[32m                      </div>[m
[32m+[m[32m                    ))}[m
[32m+[m[32m                  </div>[m
[32m+[m[32m                </div>[m
[32m+[m[32m              ) : ([m
[32m+[m[32m                <div className="theme-bg-surface-subtle p-3 rounded-2xl border theme-border-subtle">[m
[32m+[m[32m                  <p className="text-xs theme-text-secondary italic">"{viewDetailTx.rawNote}"</p>[m
[32m+[m[32m                </div>[m
[32m+[m[32m              )}[m
[32m+[m
[32m+[m[32m              {/* Amount Summary */}[m
[32m+[m[32m              <div className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle space-y-1.5 font-bold">[m
[32m+[m[32m                <div className="flex items-center justify-between text-sm">[m
[32m+[m[32m                  <span className="font-black theme-text-app">{translate(lang, 'total_price_label') || 'Total Amount'}:</span>[m
[32m+[m[32m                  <span className="text-base font-black theme-text-accent">{formatPeso(viewDetailTx.totalAmount)}</span>[m
[32m+[m[32m                </div>[m
[32m+[m[32m              </div>[m
[32m+[m[32m            </div>[m
[32m+[m
[32m+[m[32m            <div className="pt-2 border-t theme-border-subtle">[m
[32m+[m[32m              <button[m
[32m+[m[32m                type="button"[m
[32m+[m[32m                onClick={() => {[m
[32m+[m[32m                  console.log('[TransactionLedger] Close action button clicked, closing modal');[m
[32m+[m[32m                  setViewDetailTx(null);[m
[32m+[m[32m                }}[m
[32m+[m[32m                className="w-full theme-bg-primary text-white py-2.5 rounded-xl font-black text-xs shadow-2xs active:scale-95 transition-all cursor-pointer"[m
[32m+[m[32m              >[m
[32m+[m[32m                {translate(lang, 'btn_cancel') || 'Close'}[m
[32m+[m[32m              </button>[m
[32m+[m[32m            </div>[m
[32m+[m[32m          </div>[m
[32m+[m[32m        </div>[m
[32m+[m[32m      )}[m
     </div>[m
   );[m
[31m-};[m
\ No newline at end of file[m
[32m+[m[32m};[m
[41m+[m
