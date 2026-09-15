import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
 ArrowRight,
 ArrowLeft,
 X,
 Store,
 Notebook,
 StickyNote,
 CreditCard,
 Package,
 TrendingUp,
 Bot,
 Database,
 Palette,
 CheckCircle2,
} from 'lucide-react';
import { translate, type LanguageCode } from '../utils/i18n';
import { setTutorialCompleted } from '../utils/storeSettings';

export type AppTab = 'LISTA' | 'PAUTANG' | 'PANINDA' | 'ANALYTICS' | 'SUKI_AI';

interface GuidedTutorialProps {
 isOpen: boolean;
 onClose: () => void;
 lang: LanguageCode;
 onTabChange?: (tab: AppTab) => void;
}

interface LocalizedText {
 en: string;
 tl: string;
 ja?: string;
 zh?: string;
 ko?: string;
}

interface StepConfig {
 id: string;
 targetId?: string;
 tabRequirement?: AppTab;
 titleKey: string;
 descKey: string;
 content?: {
  title: LocalizedText;
  desc: LocalizedText;
  exampleNote?: LocalizedText;
 };
 icon: any;
 exampleNote?: string;
 isCenter?: boolean;
}

const TOUR_STEPS: StepConfig[] = [
 // 1. WELCOME / INTRO
 {
  id: 'welcome',
  isCenter: true,
  titleKey: 'tut_step1_welcome_title',
  descKey: 'tut_step1_welcome_desc',
  icon: Store,
  content: {
   title: {
    en: 'Welcome to Tindahan Notes',
    tl: 'Maligayang Pagdating sa Tindahan Notes',
    ja: 'Tindahan Notesへようこそ',
    zh: '欢迎使用 Tindahan Notes',
    ko: 'Tindahan Notes에 오신 것을 환영합니다',
   },
   desc: {
    en: 'Your 100% offline-first digital notebook engineered for sari-sari stores. Easily track daily sales (Benta), customer credit (Pautang), inventory (Paninda), and estimated profit (Tubo).',
    tl: 'Ang iyong 100% offline digital notebook para sa sari-sari store. Madaling subaybayan ang araw-araw na benta, pautang sa suki, paninda, at tinatayang tubo.',
    ja: '個人商店向けの完全オフライン対応デジタルノートです。日々の売上、売掛金（ツケ）、在庫、利益を簡単に管理できます。',
    zh: '专为零售小店设计的离线记账应用。轻松记录每日营业额、客户赊账、商品库存及预估利润。',
    ko: '소매점을 위한 완전 오프라인 디지털 장부입니다. 일일 매출, 외상, 재고 및 예상 이익을 간편하게 관리하세요.',
   },
  },
 },

 // 2. LISTA (Transaction Ledger & History)
 {
  id: 'lista',
  targetId: 'first-transaction-card',
  tabRequirement: 'LISTA',
  titleKey: 'tut_step7_history_title',
  descKey: 'tut_step7_history_desc',
  icon: Notebook,
  content: {
   title: {
    en: 'LISTA: Transaction Ledger & Receipts',
    tl: 'LISTA: Talaan ng Transaksyon at Resibo',
    ja: 'LISTA: 取引履歴とレシート台帳',
    zh: 'LISTA: 交易明细与收据',
    ko: 'LISTA: 거래 내역 및 영수증',
   },
   desc: {
    en: 'All recorded sales, credits, debt payments, and restocks appear here chronologically. Tap any transaction card to expand its itemized receipt.',
    tl: 'Lahat ng naitalang benta, pautang, bayad, at restock ay naka-lista rito. I-tap ang anumang tala upang buksan ang buong resibo.',
    ja: 'すべての売上、ツケ、入金、仕入れが時系列で表示されます。カードをタップして詳細レシートを確認できます。',
    zh: '所有销售、赊账、还款和进货均按时间顺序显示。点击任意卡片可展开查看完整收据。',
    ko: '모든 매출, 외상, 결제 및 입고 내역이 시간순으로 표시됩니다. 카드를 탭하여 상세 영수증을 확인하세요.',
   },
   exampleNote: {
    en: 'Tap any card to view its full receipt',
    tl: 'I-tap ang card para makita ang kumpletong resibo',
    ja: 'カードをタップして詳細レシートを表示',
    zh: '点击卡片查看完整收据',
    ko: '카드를 탭하여 전체 영수증 보기',
   },
  },
 },

 // 3. MABILISANG TALA (Floating Quick Notes & Reminders)
 {
  id: 'mabilisang',
  targetId: 'floating-mabilisang-tala-btn',
  titleKey: 'tut_step4_mabilisang_title',
  descKey: 'tut_step4_mabilisang_desc',
  icon: StickyNote,
  content: {
   title: {
    en: 'Mabilisang Tala: Quick Notes & Memos',
    tl: 'Mabilisang Tala: Mabilisang Paalala',
    ja: 'Mabilisang Tala: クイックメモ＆リマインダー',
    zh: 'Mabilisang Tala: 快捷备忘与提醒',
    ko: 'Mabilisang Tala: 빠른 메모 및 알림',
   },
   desc: {
    en: 'Tap the floating yellow-dot button anytime to write quick reminders, supplier delivery memos, or temporary notes with an optional 30-min auto-delete timer.',
    tl: 'Pindutin ang lumulutang na button anumang oras para magtala ng mga paalala o listahan sa supplier na may optional 30-min auto-delete timer.',
    ja: '画面右下のボタンから仕入れの覚え書きや30分自動削除タイマー付きメモを素早く記録できます。',
    zh: '点击右下角便签按钮快速记录进货提醒，支持30分钟自动清理。',
    ko: '우측 하단 버튼을 눌러 공급업체 메모나 30분 자동 삭제 메모를 빠르게 작성하세요.',
   },
   exampleNote: {
    en: 'Need to order cooking oil on Friday',
    tl: 'Kailangan umorder ng mantika sa Biyernes',
    ja: '金曜日に食用油を発注する',
    zh: '周五需要订购食用油',
    ko: '금요일에 식용유 주문하기',
   },
  },
 },

 // 4. PAUTANG (Customer Credit Ledger)
 {
  id: 'pautang',
  targetId: 'pautang-controls-section',
  tabRequirement: 'PAUTANG',
  titleKey: 'tut_step6_suki_title',
  descKey: 'tut_step6_suki_desc',
  icon: CreditCard,
  content: {
   title: {
    en: 'PAUTANG: Suki & Credit Management',
    tl: 'PAUTANG: Pamamahala ng Pautang at Suki',
    ja: 'PAUTANG: 顧客＆売掛金（ツケ）台帳',
    zh: 'PAUTANG: 客户与赊账管理',
    ko: 'PAUTANG: 단골 및 외상 장부 관리',
   },
   desc: {
    en: 'Track collectibles across all customers. Add customers, record new credit (+ Credit), accept payments (Payment), and copy polite reminders for SMS or Messenger.',
    tl: 'Subaybayan ang kabuuang pautang. Magdagdag ng suki, magtala ng bagong pautang (+ Pautang), tanggapin ang bayad, at mag-copy ng magalang na paalala.',
    ja: 'ツケの合計を管理できます。顧客追加、ツケ記帳、入金記録、SMS用督促文の作成に対応しています。',
    zh: '实时统计赊账总额。支持添加客户、记录新赊账、登记还款及一键复制还款提醒短信。',
    ko: '총 미수금을 관리하세요. 단골 추가, 신규 외상 기록, 결제 처리 및 알림 메시지 생성을 지원합니다.',
   },
   exampleNote: {
    en: 'Record ₱50 credit for Maria',
    tl: 'Magtala ng ₱50 utang para kay Maria',
    ja: '山田さんに500円のツケを記録',
    zh: '为客户记录 50 元赊账',
    ko: '단골 고객에게 5,000원 외상 기록',
   },
  },
 },

 // 5. PANINDA (Inventory & Quick Selling)
 {
  id: 'paninda',
  targetId: 'inventory-controls-section',
  tabRequirement: 'PANINDA',
  titleKey: 'tut_step5_paninda_title',
  descKey: 'tut_step5_paninda_desc',
  icon: Package,
  content: {
   title: {
    en: 'PANINDA: Inventory & Quick Selling',
    tl: 'PANINDA: Imbentaryo at Mabilisang Benta',
    ja: 'PANINDA: 商品在庫と販売レジ',
    zh: 'PANINDA: 商品库存与快捷收银',
    ko: 'PANINDA: 상품 재고 및 간편 판매',
   },
   desc: {
    en: 'Manage products, cost prices (Puhunan), and profit margins (Tubo). Get low-stock warnings and use "Sell Now" for multi-item cart checkout with automatic change calculation.',
    tl: 'Pamahalaan ang mga paninda, puhunan, at tubo. May alerto kapag paubos na ang stock at may multi-item "Sell Now" cart na may sukli calculator.',
    ja: '商品、原価、利益を管理します。品薄アラートやお釣り自動計算付きの「今すぐ販売」カート機能に対応しています。',
    zh: '管理商品进价与售价，支持低库存预警以及自动计算找零的“立即出售”购物车。',
    ko: '상품 원가와 마진을 관리하고 재고 부족 알림 및 거스름돈 자동 계산 장바구니 판매를 활용하세요.',
   },
   exampleNote: {
    en: 'Sell Now cart computes change',
    tl: 'Awtomatikong kinukuwenta ang sukli sa Sell Now',
    ja: '「今すぐ販売」でお釣りを自動計算',
    zh: '“立即出售”购物车自动计算找零',
    ko: '판매 장바구니에서 거스름돈 자동 계산',
   },
  },
 },

 // 6. ANALYTICS (Financials & Smart Restock)
 {
  id: 'analytics',
  targetId: 'financials-benta-card',
  tabRequirement: 'ANALYTICS',
  titleKey: 'tut_step2_benta_title',
  descKey: 'tut_step2_benta_desc',
  icon: TrendingUp,
  content: {
   title: {
    en: 'ANALYTICS: Financials & Smart Restock',
    tl: 'ANALYTICS: Pananalapi at Matalinong Restock',
    ja: 'ANALYTICS: 財務サマリーと仕入れ分析',
    zh: 'ANALYTICS: 财务分析与智能补货建议',
    ko: 'ANALYTICS: 재무 분석 및 스마트 입고 추천',
   },
   desc: {
    en: "Inspect your 4 real-time store metrics: Today's Benta (Sales), Estimated Tubo (Gross Profit), Cash In, and Total Collectibles. View Smart Restock Recommendations based on 7-day sales.",
    tl: 'Suriin ang 4 na mahalagang numero: Benta Ngayon, Tinatayang Tubo, Cash Pumasok, at Kabuuang Pautang. May Matalinong Payo sa Restock batay sa 7-araw na benta.',
    ja: '「本日の売上」「推定利益」「現金収入」「未回収ツケ」の4大指標と7日間の売上に基づくスマート仕入れアドバイスを確認できます。',
    zh: '实时查看今日销售额、预估毛利、现金入账与未收赊账总额，并获取7天销售趋势补货建议。',
    ko: '오늘의 매출, 예상 이익, 현금 수입, 총 미수금 등 4대 핵심 지표와 7일간의 스마트 입고 추천을 확인하세요.',
   },
   exampleNote: {
    en: "View Today's Benta, Tubo & Cash In",
    tl: 'Tingnan ang Benta, Tubo, at Cash Pumasok',
    ja: '売上 • 利益 • 現金受取を確認',
    zh: '查看今日营业额、预估毛利与现金入账',
    ko: '오늘의 매출, 예상 이익 및 현금 수입 확인',
   },
  },
 },

 // 7. SUKI AI (AI Business Advisor)
 {
  id: 'suki_ai',
  targetId: 'suki-ai-header',
  tabRequirement: 'SUKI_AI',
  titleKey: 'suki_ai_title',
  descKey: 'suki_ai_desc',
  icon: Bot,
  content: {
   title: {
    en: 'SUKI AI: Your Smart Store Consultant',
    tl: 'SUKI AI: Ang Iyong AI Tagapayo sa Tindahan',
    ja: 'SUKI AI: 店舗経営AIアドバイザー',
    zh: 'SUKI AI: 智能零售经营顾问',
    ko: 'SUKI AI: 스마트 매장 경영 어드바이저',
   },
   desc: {
    en: 'Ask Suki AI in Tagalog or English for tailored advice on product pricing, handling pautang diplomatically, fast-moving items, and promos. (Requires internet; bookkeeping works offline).',
    tl: 'Magtanong kay Suki AI sa Tagalog o English tungkol sa tamang presyo, diskarte sa pautang, at mabilis mabentang paninda. (Kailangan ng internet para sa AI; offline ang listahan).',
    ja: '価格設定やツケの回収マナー、売れ筋商品の見極めをAIに相談できます。（AI機能のみネット接続が必要です）。',
    zh: '随时向Suki AI咨询定价策略、礼貌催账话术与热销选品。（AI功能需联网，日常记账离线运行）。',
    ko: '가격 책정, 외상 수금 요령 및 인기 상품 추천을 Suki AI와 상의하세요. (AI 기능만 인터넷 필요).',
   },
   exampleNote: {
    en: '"Paano maiwasan ang malaking pautang?"',
    tl: '"Paano maiwasan ang malaking pautang?"',
    ja: '「常連客との関係を壊さずに売掛金を回収するコツは？」',
    zh: '“如何在不影响顾客关系的前提下礼貌收回欠款？”',
    ko: '“단골과의 관계를 해치지 않고 외상을 회수하는 방법은?”',
   },
  },
 },

 // 8. AUD: AUTO-UPDATE DATA & BACKUP
 {
  id: 'backup_data',
  isCenter: true,
  titleKey: 'backup_data',
  descKey: 'tut_step8_settings_desc',
  icon: Database,
  content: {
   title: {
    en: 'AUD: Auto-Update Data & Device Protection',
    tl: 'AUD: Auto-Update Data at Proteksyon ng Talaan',
    ja: 'AUD: 自動データ更新と端末保護',
    zh: 'AUD: 自动数据更新与本地保护',
    ko: 'AUD: 자동 데이터 업데이트 및 기기 보호',
   },
   desc: {
    en: 'AUD (Auto-Update Data) automatically saves all sales, inventory, and utang records directly to your device storage in Documents/Tindahan Notes/. Everything remains 100% private, offline, and secure.',
    tl: 'Awtomatikong sine-save ng AUD (Auto-Update Data) ang lahat ng benta, paninda, at pautang sa memory ng iyong device sa Documents/Tindahan Notes/. 100% pribado, offline, at protektado.',
    ja: 'AUD（自動データ更新）がすべての売上・商品・ツケ記録を端末（Documents/Tindahan Notes/）に自動保存します。完全オフラインかつ安全です。',
    zh: 'AUD（自动数据更新）会自动将所有销售、商品和欠款记录直接保存至设备存储（Documents/Tindahan Notes/），完全离线且安全。',
    ko: 'AUD(자동 데이터 업데이트)는 모든 매출, 상품, 외상 장부를 기기 저장소(Documents/Tindahan Notes/)에 자동 저장합니다. 100% 안전하고 오프라인으로 작동합니다.',
   },
   exampleNote: {
    en: 'AUD Active • Auto-Saved to Documents/Tindahan Notes/',
    tl: 'Aktibo ang AUD • Naka-save sa Documents/Tindahan Notes/',
    ja: 'AUD 有効 • Documents/Tindahan Notes/ に自動保存',
    zh: 'AUD 已启用 • 自动保存至 Documents/Tindahan Notes/',
    ko: 'AUD 활성화됨 • Documents/Tindahan Notes/ 자동 저장',
   },
  },
 },

 // 9. MATERIAL YOU PALETTES & THEMES
 {
  id: 'settings_themes',
  isCenter: true,
  titleKey: 'settings_title',
  descKey: 'tut_step8_settings_desc',
  icon: Palette,
  content: {
   title: {
    en: 'Material You Color Palettes & Themes',
    tl: 'Material You Dynamic Palettes at Kulay',
    ja: 'Material You カラーパレットとテーマ',
    zh: 'Material You 动态调色板与主题',
    ko: 'Material You 다이내믹 컬러 팔레트 및 테마',
   },
   desc: {
    en: 'Personalize your store with 4 dynamic Material You color palettes (Oceanic, Botanical, Sunset, Lavender) with full Light, Dark, and AMOLED contrast support.',
    tl: 'I-personalize ang iyong tindahan gamit ang 4 na Material You dynamic color palettes (Oceanic, Botanical, Sunset, Lavender) sa Light, Dark, o AMOLED mode.',
    ja: '4種類のMaterial Youダイナミックカラーパレット（Oceanic、Botanical、Sunset、Lavender）とライト/ダーク/AMOLEDモードで好みにカスタマイズできます。',
    zh: '随心定制专属店铺：支持4款Material You动态配色（海洋蓝、植物绿、落日橙、薰衣草紫），并适配明亮、深色与AMOLED模式。',
    ko: '4가지 Material You 다이내믹 컬러 팔레트(Oceanic, Botanical, Sunset, Lavender)와 라이트, 다크, AMOLED 모드로 매장을 꾸며보세요.',
   },
   exampleNote: {
    en: 'Material You: Oceanic • Botanical • Sunset • Lavender',
    tl: 'Material You: Oceanic • Botanical • Sunset • Lavender',
    ja: 'Material You: Oceanic • Botanical • Sunset • Lavender',
    zh: 'Material You: Oceanic • Botanical • Sunset • Lavender',
    ko: 'Material You: Oceanic • Botanical • Sunset • Lavender',
   },
  },
 },

 // 10. FINAL / YOU'RE READY
 {
  id: 'ready',
  isCenter: true,
  titleKey: 'tut_final_ready_title',
  descKey: 'tut_final_ready_desc',
  icon: CheckCircle2,
  content: {
   title: {
    en: "You're All Set!",
    tl: 'Handang-handa Ka Na!',
    ja: '準備完了です！',
    zh: '一切准备就绪！',
    ko: '모든 준비가 완료되었습니다!',
   },
   desc: {
    en: 'Start by adding your first product in PANINDA or recording your first transaction in LISTA. You can replay this interactive tutorial anytime by tapping the (?) help icon in the header.',
    tl: 'Simulan sa pagdagdag ng unang paninda sa PANINDA o magtala ng unang benta sa LISTA. Maaari mong ulitin ang gabay na ito anumang oras sa pamamagitan ng pag-tap sa (?) icon sa itaas.',
    ja: '「PANINDA」で最初の商品を追加するか、「LISTA」で最初の売上を記録してみましょう。ヘッダーの (?) アイコンからいつでもこのチュートリアルを再開できます。',
    zh: '现在即可在“PANINDA”中添加第一件商品，或在“LISTA”中记录第一笔交易。点击顶部标题栏的 (?) 帮助图标可随时重温此教程。',
    ko: '‘PANINDA’에서 첫 상품을 등록하거나 ‘LISTA’에서 첫 거래를 기록해 보세요. 상단 헤더의 (?) 도움말 아이콘을 눌러 언제든지 이 튜토리얼을 다시 볼 수 있습니다.',
   },
  },
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
 const step = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
 const isFirst = currentStepIndex === 0;
 const isFinal = currentStepIndex === TOUR_STEPS.length - 1;

 const totalDisplaySteps = TOUR_STEPS.length;
 const displayStepNumber = currentStepIndex + 1;

 // Localized string helpers with fallback to i18n dictionary
 const getStepTitle = (s: StepConfig): string => {
  if (s.content?.title?.[lang]) return s.content.title[lang];
  if (s.content?.title?.en) return s.content.title.en;
  return translate(lang, s.titleKey);
 };

 const getStepDesc = (s: StepConfig): string => {
  if (s.content?.desc?.[lang]) return s.content.desc[lang];
  if (s.content?.desc?.en) return s.content.desc.en;
  return translate(lang, s.descKey);
 };

 const getStepExample = (s: StepConfig): string | undefined => {
  if (s.content?.exampleNote?.[lang]) return s.content.exampleNote[lang];
  if (s.content?.exampleNote?.en) return s.content.exampleNote.en;
  return s.exampleNote;
 };

 // Position and target measurement
 const updateTargetPosition = useCallback((): boolean => {
  if (!isOpen) return false;

  setWindowSize({
   width: window.innerWidth,
   height: window.innerHeight,
  });

  if (step.targetId && !step.isCenter) {
   let el = document.getElementById(step.targetId);

   // Fallback for step 2 (lista) when store is newly installed and has 0 transaction records
   if (!el && step.targetId === 'first-transaction-card') {
    el = document.getElementById('transaction-empty-state') || document.getElementById('transaction-filter-header');
   }

   // Fallback for step 7 (suki-ai)
   if (!el && step.targetId === 'suki-ai-header') {
    el = document.getElementById('suki-ai-container') || document.getElementById('mobile-nav-suki_ai-tab') || document.getElementById('nav-suki_ai-tab');
   }

   if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
     setTargetRect(rect);
     return true;
    }
   }
   setTargetRect(null);
   return false;
  } else {
   setTargetRect(null);
   return true;
  }
 }, [isOpen, step.targetId, step.isCenter]);

 // Handle Tab Switch, target polling, and smooth scrolling on step change
 useEffect(() => {
  if (!isOpen) return;

  if (step.tabRequirement && onTabChange) {
   onTabChange(step.tabRequirement);
  }

  // Try measuring immediately
  let found = updateTargetPosition();
  if (found && step.targetId && !step.isCenter) {
   const el = document.getElementById(step.targetId);
   if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
   }
  }

  // Polling retry intervals to account for AnimatePresence tab transitions (which take 200-350ms)
  const timers: NodeJS.Timeout[] = [];
  const retryDelays = [60, 150, 300, 450, 650];

  retryDelays.forEach((delay) => {
   const t = setTimeout(() => {
    const ok = updateTargetPosition();
    if (ok && step.targetId && !step.isCenter) {
     const el = document.getElementById(step.targetId);
     if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
     }
    }
   }, delay);
   timers.push(t);
  });

  return () => {
   timers.forEach((t) => clearTimeout(t));
  };
 }, [isOpen, currentStepIndex, step.targetId, step.tabRequirement, step.isCenter, onTabChange, updateTargetPosition]);

 // Listen to window resize and scroll events
 useEffect(() => {
  if (!isOpen) return;

  const handleResizeOrScroll = () => {
   updateTargetPosition();
  };

  window.addEventListener('resize', handleResizeOrScroll);
  window.addEventListener('scroll', handleResizeOrScroll, { passive: true });

  return () => {
   window.removeEventListener('resize', handleResizeOrScroll);
   window.removeEventListener('scroll', handleResizeOrScroll);
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
    maxWidth: '460px',
    width: 'calc(100vw - 28px)',
    maxHeight: 'min(82vh, 560px)',
    zIndex: 70,
   };
  }

  const cardWidth = Math.min(windowSize.width - 24, 420);
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const isTargetInUpperHalf = targetCenterY < windowSize.height * 0.48;

  // Horizontal positioning: align with target center, clamped to screen edges
  const idealLeft = targetRect.left + targetRect.width / 2 - cardWidth / 2;
  const clampedLeft = Math.max(12, Math.min(idealLeft, windowSize.width - cardWidth - 12));

  // Vertical positioning: place below if target is in upper half, above if lower half
  if (isTargetInUpperHalf) {
   const topPos = Math.min(targetRect.bottom + 12, windowSize.height - 240);
   return {
    position: 'fixed',
    top: `${Math.max(12, topPos)}px`,
    left: `${clampedLeft}px`,
    width: `${cardWidth}px`,
    maxHeight: `calc(100vh - ${Math.max(12, topPos) + 20}px)`,
    zIndex: 70,
   };
  } else {
   const bottomPos = Math.min(windowSize.height - targetRect.top + 12, windowSize.height - 80);
   return {
    position: 'fixed',
    bottom: `${Math.max(12, bottomPos)}px`,
    left: `${clampedLeft}px`,
    width: `${cardWidth}px`,
    maxHeight: `calc(100vh - ${Math.max(12, bottomPos) + 20}px)`,
    zIndex: 70,
   };
  }
 };

 // Safe padding coordinates for spotlight outline
 const pad = 8;
 const spotX = targetRect ? Math.max(0, targetRect.left - pad) : 0;
 const spotY = targetRect ? Math.max(0, targetRect.top - pad) : 0;
 const spotW = targetRect ? targetRect.width + pad * 2 : 0;
 const spotH = targetRect ? targetRect.height + pad * 2 : 0;

 const exampleText = getStepExample(step);

 return (
  <div id="interactive-tutorial-root" className="fixed inset-0 z-60 overflow-hidden select-none pointer-events-none">
   {/* SVG Mask Overlay for spotlight cutout + dimming */}
   <svg
    className="fixed inset-0 w-full h-full pointer-events-none transition-all duration-300 z-60"
    style={{ width: '100vw', height: '100vh' }}
   >
    <defs>
     <mask id="tutorial-spotlight-mask">
      <rect width="100%" height="100%" fill="white" />
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
    <rect
     width="100%"
     height="100%"
     fill="rgba(0, 0, 0, 0.68)"
     mask="url(#tutorial-spotlight-mask)"
    />
   </svg>

   {/* Target Element Illuminated Glowing Frame */}
   {targetRect && (
    <div
     className="fixed pointer-events-none transition-all duration-300 rounded-3xl border-2 border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/30 shadow-2xl z-60 "
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
    className="theme-card rounded-3xl p-4 sm:p-5 shadow-2xl border flex flex-col justify-between overflow-hidden animate-in fade-in duration-200 pointer-events-auto"
   >
    {/* Scrollable Content Container */}
    <div className="overflow-y-auto overscroll-contain pr-1 space-y-3">
     {/* Header with Step Counter, Badge & Skip */}
     <div className="flex items-center justify-between pb-2 border-b theme-border-subtle">
      <div className="flex items-center gap-2.5">
       <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl theme-bg-primary text-white flex items-center justify-center font-black shadow-inner shrink-0">
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
       </div>
       <div>
        {!isFinal ? (
         <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider theme-text-accent block">
          {translate(lang, 'step_progress', {
           current: displayStepNumber,
           total: totalDisplaySteps,
          })}
         </span>
        ) : (
         <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider theme-text-accent block">
          {translate(lang, 'app_title')}
         </span>
        )}
       </div>
      </div>

      <button
       onClick={handleSkip}
       className="text-xs font-bold theme-text-secondary hover:theme-text-app flex items-center gap-1 py-1 px-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
       title={translate(lang, 'btn_skip')}
      >
       <span>{translate(lang, 'btn_skip')}</span>
       <X className="w-3.5 h-3.5" />
      </button>
     </div>

     {/* Card Content & Explanations */}
     <div className="space-y-1.5 py-0.5">
      <h3 className="text-sm sm:text-base font-black theme-text-app leading-snug">
       {getStepTitle(step)}
      </h3>
      <p className="text-xs sm:text-xs theme-text-secondary leading-relaxed font-medium">
       {getStepDesc(step)}
      </p>

      {/* Step 8 AUD Visual Showcase */}
      {step.id === 'backup_data' && (
       <div className="mt-2 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
         <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
          <Database className="w-4 h-4" />
         </div>
         <div>
          <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
           <span>AUD (Auto-Update Data)</span>
           <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
            Aktibo / ON
           </span>
          </div>
          <div className="text-[10px] theme-text-secondary font-medium">
           Documents/Tindahan Notes/
          </div>
         </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
         100% Offline
        </span>
       </div>
      )}

      {/* Step 9 Material You Palette Visual Showcase */}
      {step.id === 'settings_themes' && (
       <div className="mt-2 p-2.5 rounded-2xl theme-bg-surface-subtle border theme-border-subtle space-y-1.5">
        <div className="text-[10px] font-black uppercase tracking-wider theme-text-accent flex items-center gap-1">
         <Palette className="w-3.5 h-3.5" />
         <span>4 Material You Palettes</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
         {[
          { name: 'Oceanic', color: '#2563eb' },
          { name: 'Botanical', color: '#059669' },
          { name: 'Sunset', color: '#ea580c' },
          { name: 'Lavender', color: '#7c3aed' },
         ].map((item) => (
          <div
           key={item.name}
           className="p-1.5 rounded-xl theme-card border theme-border-subtle flex flex-col items-center gap-1 text-center"
          >
           <span
            className="w-4 h-4 rounded-full border border-black/15 shadow-2xs shrink-0"
            style={{ backgroundColor: item.color }}
           />
           <span className="text-[9px] font-black theme-text-app truncate w-full">
            {item.name}
           </span>
          </div>
         ))}
        </div>
       </div>
      )}

      {/* Exactly 1 Single Example Badge */}
      {exampleText && (
       <div className="mt-2 theme-bg-surface-subtle border theme-border-subtle rounded-2xl p-2 flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-[11px] font-semibold theme-text-accent shrink-0">
         {translate(lang, 'example_label')}:
        </span>
        <span className="text-[11px] sm:text-xs font-bold theme-text-app truncate">
         "{exampleText}"
        </span>
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
    </div>

    {/* Action Controls Footer (Back / Next / Start) */}
    <div className="shrink-0 pt-3 border-t theme-border-subtle flex items-center justify-between gap-2 mt-2">
     {!isFirst ? (
      <button
       onClick={handleBack}
       className="flex items-center gap-1.5 text-xs font-extrabold theme-text-secondary hover:theme-text-app px-3 py-2 rounded-2xl hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
      >
       <ArrowLeft className="w-3.5 h-3.5" />
       <span>{translate(lang, 'btn_back')}</span>
      </button>
     ) : (
      <div />
     )}

     <button
      onClick={handleNext}
      className="flex items-center gap-2 theme-bg-primary text-white font-extrabold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-sm active:scale-95 transition-all ml-auto cursor-pointer"
     >
      <span>{isFinal ? translate(lang, 'btn_start_using') : translate(lang, 'btn_next')}</span>
      <ArrowRight className="w-4 h-4 text-white/90" />
     </button>
    </div>
   </div>
  </div>
 );
};


