import React from 'react';
import { Store, ShoppingBag, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface ModeSelectionScreenProps {
 onSelectMode: (mode: 'seller' | 'buyer') => void;
}

export const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({ onSelectMode }) => {
 return (
  <div className="min-h-screen w-full theme-bg-app theme-text-app flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans antialiased selection:bg-amber-500/20">
   {/* Top spacing & Decorative Header */}
   <div className="max-w-xl w-full mx-auto pt-6 sm:pt-10 text-center space-y-3 animate-in fade-in duration-300">
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full theme-bg-surface-subtle border theme-border-subtle text-xs font-bold text-amber-400 mb-1 shadow-2xs">
     <Sparkles className="w-3.5 h-3.5" />
     <span>Quick First-Time Setup</span>
    </div>

    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight theme-text-app leading-tight">
     Welcome to Tinda
    </h1>

    <p className="text-sm sm:text-base theme-text-secondary font-medium max-w-md mx-auto">
     Choose how you want to use the app
    </p>
   </div>

   {/* Two Large Clear Selection Cards */}
   <div className="max-w-xl w-full mx-auto my-auto py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
    {/* Card 1: Seller Mode */}
    <button
     type="button"
     role="button"
     tabIndex={0}
     style={{ touchAction: 'manipulation' }}
     onClick={() => onSelectMode('seller')}
     className="theme-card text-left p-5 sm:p-6 rounded-3xl border-2 theme-border hover:border-amber-500/80 focus:border-amber-500 shadow-lg hover:shadow-xl transition-all duration-150 flex flex-col justify-between group cursor-pointer active:scale-[0.98] select-none"
    >
     <div className="space-y-4">
      <div className="flex items-center justify-between">
       <div className="w-14 h-14 rounded-2xl theme-bg-primary text-white flex items-center justify-center font-black shadow-md border border-white/20 group-hover:scale-105 transition-transform">
        <Store className="w-7 h-7 stroke-[2.2]" />
       </div>
       <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
        Store Owner
       </span>
      </div>

      <div>
       <h2 className="text-lg sm:text-xl font-black theme-text-app group-hover:text-amber-400 transition-colors">
        Seller Mode
       </h2>
       <p className="text-xs sm:text-sm font-semibold text-amber-300/90 mt-0.5">
        For store owners
       </p>
       <p className="text-xs theme-text-secondary font-medium mt-2 leading-relaxed">
        Manage your store inventory, track customer pautang (credits), record daily sales, and compute daily earnings.
       </p>
      </div>
     </div>

     <div className="pt-5 mt-4 border-t theme-border-subtle flex items-center justify-between text-xs font-black theme-text-app group-hover:text-amber-400">
      <span>Continue as Seller</span>
      <div className="w-8 h-8 rounded-full theme-bg-surface-subtle border theme-border-subtle flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-2xs">
       <ArrowRight className="w-4 h-4 stroke-[2.5]" />
      </div>
     </div>
    </button>

    {/* Card 2: Buyer Mode */}
    <button
     type="button"
     role="button"
     tabIndex={0}
     style={{ touchAction: 'manipulation' }}
     onClick={() => onSelectMode('buyer')}
     className="theme-card text-left p-5 sm:p-6 rounded-3xl border-2 theme-border hover:border-emerald-500/80 focus:border-emerald-500 shadow-lg hover:shadow-xl transition-all duration-150 flex flex-col justify-between group cursor-pointer active:scale-[0.98] select-none"
    >
     <div className="space-y-4">
      <div className="flex items-center justify-between">
       <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md border border-emerald-400/40 group-hover:scale-105 transition-transform">
        <ShoppingBag className="w-7 h-7 stroke-[2.2]" />
       </div>
       <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
        Customer
       </span>
      </div>

      <div>
       <h2 className="text-lg sm:text-xl font-black theme-text-app group-hover:text-emerald-400 transition-colors">
        Buyer Mode
       </h2>
       <p className="text-xs sm:text-sm font-semibold text-emerald-300/90 mt-0.5">
        For customers
       </p>
       <p className="text-xs theme-text-secondary font-medium mt-2 leading-relaxed">
        Scan sari-sari store QR codes, browse available products & prices, build your grocery basket, and place orders directly.
       </p>
      </div>
     </div>

     <div className="pt-5 mt-4 border-t theme-border-subtle flex items-center justify-between text-xs font-black theme-text-app group-hover:text-emerald-400">
      <span>Continue as Buyer</span>
      <div className="w-8 h-8 rounded-full theme-bg-surface-subtle border theme-border-subtle flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shadow-2xs">
       <ArrowRight className="w-4 h-4 stroke-[2.5]" />
      </div>
     </div>
    </button>
   </div>

   {/* Footer note */}
   <div className="max-w-xl w-full mx-auto pb-4 text-center">
    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium theme-text-secondary bg-black/20 px-3 py-1.5 rounded-full border theme-border-subtle">
     <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
     <span>You can switch between Seller and Buyer mode anytime in Settings.</span>
    </div>
   </div>
  </div>
 );
};
