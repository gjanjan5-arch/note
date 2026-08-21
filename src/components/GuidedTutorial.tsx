import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  X,
  Store,
  ShoppingBag,
  TrendingUp,
  StickyNote,
  Package,
  CreditCard,
  Notebook,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';
import { setTutorialCompleted } from '../utils/storeSettings';

export type AppTab = 'LISTA' | 'PAUTANG' | 'PANINDA' | 'ANALYTICS' | 'SUKI_AI' | 'POSTER';

interface GuidedTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  onTabChange?: (tab: AppTab) => void;
}

interface StepConfig {
  id: string;
  stepNumber: number; // 1 to 8, or 0 for intro/final
  targetId?: string;
  tabRequirement?: AppTab;
  titleKey: string;
  descKey: string;
  icon: any;
  exampleNote?: string;
  isCenter?: boolean;
}

const TOUR_STEPS: StepConfig[] = [
  // STEP 1 — WELCOME
  {
    id: 'welcome',
    stepNumber: 1,
    isCenter: true,
    titleKey: 'tut_step1_welcome_title',
    descKey: 'tut_step1_welcome_desc',
    icon: Store,
  },
  // STEP 2 — BENTA
  {
    id: 'benta',
    stepNumber: 2,
    targetId: 'financials-benta-card',
    tabRequirement: 'ANALYTICS',
    titleKey: 'tut_step2_benta_title',
    descKey: 'tut_step2_benta_desc',
    icon: ShoppingBag,
  },
  // STEP 3 — TINATAYANG TUBO
  {
    id: 'tubo',
    stepNumber: 3,
    targetId: 'financials-tubo-card',
    tabRequirement: 'ANALYTICS',
    titleKey: 'tut_step3_tubo_title',
    descKey: 'tut_step3_tubo_desc',
    icon: TrendingUp,
  },
  // STEP 4 — MABILISANG TALA
  {
    id: 'mabilisang',
    stepNumber: 4,
    targetId: 'floating-mabilisang-tala-btn',
    titleKey: 'tut_step4_mabilisang_title',
    descKey: 'tut_step4_mabilisang_desc',
    icon: StickyNote,
  },
  // STEP 5 — PANINDA
  {
    id: 'paninda',
    stepNumber: 5,
    targetId: 'inventory-controls-section',
    tabRequirement: 'PANINDA',
    titleKey: 'tut_step5_paninda_title',
    descKey: 'tut_step5_paninda_desc',
    icon: Package,
  },
  // STEP 6 — SUKI AND PAUTANG
  {
    id: 'suki',
    stepNumber: 6,
    targetId: 'pautang-controls-section',
    tabRequirement: 'PAUTANG',
    titleKey: 'tut_step6_suki_title',
    descKey: 'tut_step6_suki_desc',
    icon: CreditCard,
  },
  // STEP 7 — HISTORY
  {
    id: 'history',
    stepNumber: 7,
    targetId: 'transaction-ledger-container',
    tabRequirement: 'LISTA',
    titleKey: 'tut_step7_history_title',
    descKey: 'tut_step7_history_desc',
    icon: Notebook,
  },
  // STEP 8 — SETTINGS AND AI
  {
    id: 'settings',
    stepNumber: 8,
    targetId: 'header-settings-btn',
    titleKey: 'tut_step8_settings_title',
    descKey: 'tut_step8_settings_desc',
    icon: Settings,
  },
  // FINAL STEP — YOU'RE READY
  {
    id: 'ready',
    stepNumber: 8, // treated as final completion
    isCenter: true,
    titleKey: 'tut_final_ready_title',
    descKey: 'tut_final_ready_desc',
    icon: CheckCircle2,
  },
];

export const GuidedTutorial: React.FC<GuidedTutorialProps> = ({
  isOpen,
  onClose,
  lang,
  onTabChange,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isFinal = currentStepIndex === TOUR_STEPS.length - 1;
  const totalDisplaySteps = 8;
  const displayStepNumber = Math.min(step.stepNumber, totalDisplaySteps);

  // Position and target measurement
  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;

    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    if (step.targetId && !step.isCenter) {
      const el = document.getElementById(step.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [isOpen, step.targetId, step.isCenter]);

  // Handle Tab Switch & Scroll on step change
  useEffect(() => {
    if (!isOpen) return;

    // Reset to step 0 when newly opened
    if (step.tabRequirement && onTabChange) {
      onTabChange(step.tabRequirement);
    }

    // Small delay to allow tab render before scroll & measure
    const timer = setTimeout(() => {
      if (step.targetId && !step.isCenter) {
        const el = document.getElementById(step.targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      updateTargetPosition();
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen, currentStepIndex, step.targetId, step.tabRequirement, step.isCenter, onTabChange, updateTargetPosition]);

  // Listen to window resize and scroll events
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, { passive: true });

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [isOpen, updateTargetPosition]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isFinal) {
      setTutorialCompleted(true);
      if (onTabChange) onTabChange('LISTA');
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    setTutorialCompleted(true);
    if (onTabChange) onTabChange('LISTA');
    onClose();
  };

  const Icon = step.icon;

  // Calculate dynamic card positioning relative to target element
  const getCardStyle = (): React.CSSProperties => {
    // If center step or target is not found/measured
    if (step.isCenter || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '480px',
        width: 'calc(100vw - 32px)',
        zIndex: 60,
      };
    }

    const cardWidth = Math.min(windowSize.width - 24, 440);
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const isTargetInUpperHalf = targetCenterY < windowSize.height * 0.48;

    // Horizontal positioning: align with target center, clamped to screen edges
    const idealLeft = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    const clampedLeft = Math.max(12, Math.min(idealLeft, windowSize.width - cardWidth - 12));

    // Vertical positioning: place below if target is in upper half, above if lower half
    if (isTargetInUpperHalf) {
      const topPos = Math.min(targetRect.bottom + 14, windowSize.height - 240);
      return {
        position: 'fixed',
        top: `${Math.max(12, topPos)}px`,
        left: `${clampedLeft}px`,
        width: `${cardWidth}px`,
        zIndex: 60,
      };
    } else {
      const bottomPos = Math.min(windowSize.height - targetRect.top + 14, windowSize.height - 80);
      return {
        position: 'fixed',
        bottom: `${Math.max(12, bottomPos)}px`,
        left: `${clampedLeft}px`,
        width: `${cardWidth}px`,
        zIndex: 60,
      };
    }
  };

  // Safe padding coordinates for spotlight outline
  const pad = 8;
  const spotX = targetRect ? Math.max(0, targetRect.left - pad) : 0;
  const spotY = targetRect ? Math.max(0, targetRect.top - pad) : 0;
  const spotW = targetRect ? targetRect.width + pad * 2 : 0;
  const spotH = targetRect ? targetRect.height + pad * 2 : 0;

  return (
    <div id="interactive-tutorial-root" className="fixed inset-0 z-50 overflow-hidden select-none pointer-events-none">
      {/* SVG Mask Overlay for true spotlight cutout + dimming */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none transition-all duration-300 z-40"
        style={{ width: '100vw', height: '100vh' }}
      >
        <defs>
          <mask id="tutorial-spotlight-mask">
            {/* White reveals the dark overlay */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black cutout creates the transparent window */}
            {targetRect && (
              <rect
                x={spotX}
                y={spotY}
                width={spotW}
                height={spotH}
                rx="20"
                ry="20"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dimming backdrop with cutout */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tutorial-spotlight-mask)"
        />
      </svg>

      {/* Target Element Illuminated Glowing Frame */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 rounded-3xl border-2 border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/30 shadow-2xl z-40 animate-pulse"
          style={{
            top: `${spotY}px`,
            left: `${spotX}px`,
            width: `${spotW}px`,
            height: `${spotH}px`,
          }}
        />
      )}

      {/* Interactive Tutorial Card */}
      <div
        ref={cardRef}
        id="tutorial-interactive-card"
        style={getCardStyle()}
        className="theme-card rounded-3xl p-5 sm:p-6 shadow-2xl border space-y-4 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
      >
        {/* Header with Step Counter, Badge & Skip */}
        <div className="flex items-center justify-between pb-3 border-b theme-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl theme-bg-primary text-white flex items-center justify-center font-black shadow-inner shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              {!isFinal ? (
                <span className="text-[11px] font-black uppercase tracking-wider theme-text-accent block">
                  {translate(lang, 'step_progress', {
                    current: displayStepNumber,
                    total: totalDisplaySteps,
                  })}
                </span>
              ) : (
                <span className="text-[11px] font-black uppercase tracking-wider theme-text-accent block">
                  {translate(lang, 'app_title')}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleSkip}
            className="text-xs font-bold theme-text-secondary hover:theme-text-app flex items-center gap-1 py-1 px-2 rounded-xl hover:bg-white/10 transition-colors"
            title={translate(lang, 'btn_skip')}
          >
            <span>{translate(lang, 'btn_skip')}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card Content & Explanations */}
        <div className="space-y-2 py-0.5">
          <h3 className="text-base sm:text-lg font-black theme-text-app leading-snug">
            {translate(lang, step.titleKey)}
          </h3>
          <p className="text-xs sm:text-sm theme-text-secondary leading-relaxed font-medium">
            {translate(lang, step.descKey)}
          </p>

          {/* Example Badge if provided */}
          {step.exampleNote && (
            <div className="mt-2 theme-bg-surface-subtle border theme-border-subtle rounded-2xl p-2.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold theme-text-accent">
                {translate(lang, 'example_label')}
              </span>
              <code className="text-xs font-black theme-card px-2.5 py-1 rounded-xl theme-text-app border theme-border-subtle shadow-2xs">
                "{step.exampleNote}"
              </code>
            </div>
          )}
        </div>

        {/* Visual Step Progress Bar */}
        <div className="w-full theme-bg-surface-subtle rounded-full h-1.5 overflow-hidden">
          <div
            className="theme-bg-primary h-full rounded-full transition-all duration-300"
            style={{
              width: `${(displayStepNumber / totalDisplaySteps) * 100}%`,
            }}
          />
        </div>

        {/* Action Controls (Back / Next / Start) */}
        <div className="flex items-center justify-between pt-1 gap-2">
          {!isFirst ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs font-extrabold theme-text-secondary hover:theme-text-app px-3.5 py-2.5 rounded-2xl hover:bg-white/10 transition-colors active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{translate(lang, 'btn_back')}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleNext}
            className="flex items-center gap-2 theme-bg-primary text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-sm active:scale-95 transition-all ml-auto"
          >
            <span>{isFinal ? translate(lang, 'btn_start_using') : translate(lang, 'btn_next')}</span>
            <ArrowRight className="w-4 h-4 text-white/90" />
          </button>
        </div>
      </div>
    </div>
  );
};
