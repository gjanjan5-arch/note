export type ThemePalette = 'oceanic' | 'botanical' | 'sunset' | 'lavender';
export type AppearanceMode = 'dark' | 'light' | 'amoled';

export interface ThemeSettings {
  palette: ThemePalette;
  mode: AppearanceMode;
}

export interface PaletteInfo {
  id: ThemePalette;
  name: string;
  subtitle: string;
  previewColor: string;
  description: string;
}

export const PALETTES: PaletteInfo[] = [
  {
    id: 'oceanic',
    name: 'Oceanic',
    subtitle: 'M3 Dynamic',
    previewColor: '#2563eb', // Vibrant Ocean Blue
    description: 'Blue-based palette',
  },
  {
    id: 'botanical',
    name: 'Botanical',
    subtitle: 'M3 Dynamic',
    previewColor: '#059669', // Emerald / Forest Green
    description: 'Green-based palette',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    subtitle: 'M3 Dynamic',
    previewColor: '#ea580c', // Sunset Orange
    description: 'Orange-based palette',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    subtitle: 'M3 Dynamic',
    previewColor: '#7c3aed', // Royal Lavender / Violet
    description: 'Purple-based palette',
  },
];

export interface AppearanceModeInfo {
  id: AppearanceMode;
  name: string;
  description: string;
}

export const APPEARANCE_MODES: AppearanceModeInfo[] = [
  {
    id: 'dark',
    name: 'Dark',
    description: 'Selected palette with a dark interface',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Selected palette with a light interface',
  },
  {
    id: 'amoled',
    name: 'AMOLED',
    description: 'OLED-friendly true black interface',
  },
];

const THEME_SETTINGS_KEY = 'tindahan_theme_settings';

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  palette: 'oceanic',
  mode: 'dark',
};

// Complete palette & appearance color definitions
interface ColorThemeTokens {
  primary: string;
  primaryHover: string;
  primaryBg: string;
  primaryFg: string;
  accent: string;
  accentHover: string;
  accentText: string;
  background: string;
  surface: string;
  surfaceElevated?: string;
  surfaceCard: string;
  surfaceHover: string;
  surfaceHeader: string;
  surfaceNav: string;
  surfaceSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  cardBorder: string;
  input?: string;
  inputBg: string;
  inputBorder: string;
  hover?: string;
  selected?: string;
  badgeBg: string;
  badgeText: string;
}

const THEME_DEFINITIONS: Record<ThemePalette, Record<AppearanceMode, ColorThemeTokens>> = {
  oceanic: {
    dark: {
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      primaryBg: '#1e3a8a',
      primaryFg: '#ffffff',
      accent: '#60a5fa',
      accentHover: '#93c5fd',
      accentText: '#93c5fd',
      background: '#0b1329',
      surface: '#111d3d',
      surfaceCard: '#16254c',
      surfaceHover: '#1d3061',
      surfaceHeader: '#070e20',
      surfaceNav: '#070e20',
      surfaceSubtle: '#182952',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#233876',
      borderSubtle: '#192a59',
      cardBorder: '#233876',
      inputBg: '#0d1733',
      inputBorder: '#2a438c',
      badgeBg: '#1e3a8a',
      badgeText: '#93c5fd',
    },
    light: {
      primary: '#1d4ed8',
      primaryHover: '#1e40af',
      primaryBg: '#dbeafe',
      primaryFg: '#ffffff',
      accent: '#2563eb',
      accentHover: '#1d4ed8',
      accentText: '#1e40af',
      background: '#f1f5f9',
      surface: '#ffffff',
      surfaceCard: '#ffffff',
      surfaceHover: '#f8fafc',
      surfaceHeader: '#1e3a8a',
      surfaceNav: '#ffffff',
      surfaceSubtle: '#eff6ff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      border: '#cbd5e1',
      borderSubtle: '#e2e8f0',
      cardBorder: '#e2e8f0',
      inputBg: '#f8fafc',
      inputBorder: '#cbd5e1',
      badgeBg: '#dbeafe',
      badgeText: '#1e40af',
    },
    amoled: {
      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primaryBg: '#172554',
      primaryFg: '#ffffff',
      accent: '#60a5fa',
      accentHover: '#93c5fd',
      accentText: '#93c5fd',
      background: '#000000',
      surface: '#0a0f1d',
      surfaceCard: '#0f172a',
      surfaceHover: '#1e293b',
      surfaceHeader: '#000000',
      surfaceNav: '#000000',
      surfaceSubtle: '#131f37',
      text: '#ffffff',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#1e293b',
      borderSubtle: '#172033',
      cardBorder: '#1e293b',
      inputBg: '#050811',
      inputBorder: '#1e293b',
      badgeBg: '#172554',
      badgeText: '#93c5fd',
    },
  },
  botanical: {
    dark: {
      primary: '#059669',
      primaryHover: '#047857',
      primaryBg: '#064e3b',
      primaryFg: '#ffffff',
      accent: '#34d399',
      accentHover: '#6ee7b7',
      accentText: '#a7f3d0',
      background: '#06150f',
      surface: '#0d241b',
      surfaceCard: '#123024',
      surfaceHover: '#193f30',
      surfaceHeader: '#04100b',
      surfaceNav: '#04100b',
      surfaceSubtle: '#163b2c',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#1c4d39',
      borderSubtle: '#133829',
      cardBorder: '#1c4d39',
      inputBg: '#081a13',
      inputBorder: '#1f5942',
      badgeBg: '#064e3b',
      badgeText: '#6ee7b7',
    },
    light: {
      primary: '#065f46',
      primaryHover: '#047857',
      primaryBg: '#d1fae5',
      primaryFg: '#ffffff',
      accent: '#059669',
      accentHover: '#047857',
      accentText: '#065f46',
      background: '#f1f7f4',
      surface: '#ffffff',
      surfaceCard: '#ffffff',
      surfaceHover: '#f8fafc',
      surfaceHeader: '#064e3b',
      surfaceNav: '#ffffff',
      surfaceSubtle: '#ecfdf5',
      text: '#06281e',
      textSecondary: '#334155',
      textMuted: '#94a3b8',
      border: '#cbd5e1',
      borderSubtle: '#e2e8f0',
      cardBorder: '#e2e8f0',
      inputBg: '#f8fafc',
      inputBorder: '#cbd5e1',
      badgeBg: '#d1fae5',
      badgeText: '#065f46',
    },
    amoled: {
      primary: '#10b981',
      primaryHover: '#34d399',
      primaryBg: '#064e3b',
      primaryFg: '#ffffff',
      accent: '#34d399',
      accentHover: '#6ee7b7',
      accentText: '#6ee7b7',
      background: '#000000',
      surface: '#07150f',
      surfaceCard: '#0c2017',
      surfaceHover: '#143325',
      surfaceHeader: '#000000',
      surfaceNav: '#000000',
      surfaceSubtle: '#10291e',
      text: '#ffffff',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#163b2c',
      borderSubtle: '#0f291e',
      cardBorder: '#163b2c',
      inputBg: '#040b07',
      inputBorder: '#163b2c',
      badgeBg: '#064e3b',
      badgeText: '#34d399',
    },
  },
  sunset: {
    dark: {
      primary: '#ea580c',
      primaryHover: '#c2410c',
      primaryBg: '#7c2d12',
      primaryFg: '#ffffff',
      accent: '#fb923c',
      accentHover: '#fdba74',
      accentText: '#fed7aa',
      background: '#1a0f0a',
      surface: '#291811',
      surfaceCard: '#351f16',
      surfaceHover: '#44281d',
      surfaceHeader: '#140a06',
      surfaceNav: '#140a06',
      surfaceSubtle: '#3d2319',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#522f21',
      borderSubtle: '#3b2218',
      cardBorder: '#522f21',
      inputBg: '#1e110b',
      inputBorder: '#5f3626',
      badgeBg: '#7c2d12',
      badgeText: '#fdba74',
    },
    light: {
      primary: '#c2410c',
      primaryHover: '#9a3412',
      primaryBg: '#ffedd5',
      primaryFg: '#ffffff',
      accent: '#ea580c',
      accentHover: '#c2410c',
      accentText: '#9a3412',
      background: '#fbf7f4',
      surface: '#ffffff',
      surfaceCard: '#ffffff',
      surfaceHover: '#f8fafc',
      surfaceHeader: '#7c2d12',
      surfaceNav: '#ffffff',
      surfaceSubtle: '#fff7ed',
      text: '#271406',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      border: '#cbd5e1',
      borderSubtle: '#e2e8f0',
      cardBorder: '#e2e8f0',
      inputBg: '#f8fafc',
      inputBorder: '#cbd5e1',
      badgeBg: '#ffedd5',
      badgeText: '#9a3412',
    },
    amoled: {
      primary: '#f97316',
      primaryHover: '#fb923c',
      primaryBg: '#7c2d12',
      primaryFg: '#ffffff',
      accent: '#fb923c',
      accentHover: '#fdba74',
      accentText: '#fdba74',
      background: '#000000',
      surface: '#140a06',
      surfaceCard: '#20110b',
      surfaceHover: '#301911',
      surfaceHeader: '#000000',
      surfaceNav: '#000000',
      surfaceSubtle: '#28160e',
      text: '#ffffff',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#3a1f14',
      borderSubtle: '#2a160e',
      cardBorder: '#3a1f14',
      inputBg: '#090402',
      inputBorder: '#3a1f14',
      badgeBg: '#7c2d12',
      badgeText: '#fb923c',
    },
  },
  lavender: {
    dark: {
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      primaryBg: '#4c1d95',
      primaryFg: '#ffffff',
      accent: '#a78bfa',
      accentHover: '#c4b5fd',
      accentText: '#ddd6fe',
      background: '#130c24',
      surface: '#20143a',
      surfaceCard: '#2a1b4d',
      surfaceHover: '#362362',
      surfaceHeader: '#0d071a',
      surfaceNav: '#0d071a',
      surfaceSubtle: '#301f57',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#422b70',
      borderSubtle: '#2e1e4e',
      cardBorder: '#422b70',
      inputBg: '#170e2c',
      inputBorder: '#4e3384',
      badgeBg: '#4c1d95',
      badgeText: '#c4b5fd',
    },
    light: {
      primary: '#6d28d9',
      primaryHover: '#5b21b6',
      primaryBg: '#ede9fe',
      primaryFg: '#ffffff',
      accent: '#7c3aed',
      accentHover: '#6d28d9',
      accentText: '#5b21b6',
      background: '#f6f4fa',
      surface: '#ffffff',
      surfaceCard: '#ffffff',
      surfaceHover: '#f8fafc',
      surfaceHeader: '#4c1d95',
      surfaceNav: '#ffffff',
      surfaceSubtle: '#f5f3ff',
      text: '#1e1035',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      border: '#cbd5e1',
      borderSubtle: '#e2e8f0',
      cardBorder: '#e2e8f0',
      inputBg: '#f8fafc',
      inputBorder: '#cbd5e1',
      badgeBg: '#ede9fe',
      badgeText: '#5b21b6',
    },
    amoled: {
      primary: '#8b5cf6',
      primaryHover: '#a78bfa',
      primaryBg: '#4c1d95',
      primaryFg: '#ffffff',
      accent: '#a78bfa',
      accentHover: '#c4b5fd',
      accentText: '#c4b5fd',
      background: '#000000',
      surface: '#110a20',
      surfaceCard: '#1b1033',
      surfaceHover: '#28184c',
      surfaceHeader: '#000000',
      surfaceNav: '#000000',
      surfaceSubtle: '#221440',
      text: '#ffffff',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#2e1b57',
      borderSubtle: '#21133e',
      cardBorder: '#2e1b57',
      inputBg: '#090510',
      inputBorder: '#2e1b57',
      badgeBg: '#4c1d95',
      badgeText: '#a78bfa',
    },
  },
};

export function getThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const palette: ThemePalette =
        parsed.palette && ['oceanic', 'botanical', 'sunset', 'lavender'].includes(parsed.palette)
          ? parsed.palette
          : DEFAULT_THEME_SETTINGS.palette;
      const mode: AppearanceMode =
        parsed.mode && ['dark', 'light', 'amoled'].includes(parsed.mode)
          ? parsed.mode
          : DEFAULT_THEME_SETTINGS.mode;
      return { palette, mode };
    }
  } catch (e) {
    // fallback to default
  }
  return DEFAULT_THEME_SETTINGS;
}

export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(THEME_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // ignore
  }
  applyTheme(settings);
}

export function applyTheme(settings: ThemeSettings): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const palette = settings.palette || DEFAULT_THEME_SETTINGS.palette;
  const mode = settings.mode || DEFAULT_THEME_SETTINGS.mode;

  const tokens = THEME_DEFINITIONS[palette]?.[mode] || THEME_DEFINITIONS.oceanic.dark;

  // Set data attributes
  root.setAttribute('data-theme-palette', palette);
  root.setAttribute('data-theme-mode', mode);

  // Set CSS variables
  root.style.setProperty('--color-primary', tokens.primary);
  root.style.setProperty('--color-primary-foreground', tokens.primaryFg);
  root.style.setProperty('--color-primary-hover', tokens.primaryHover);
  root.style.setProperty('--color-primary-bg', tokens.primaryBg);
  root.style.setProperty('--color-primary-fg', tokens.primaryFg);
  root.style.setProperty('--color-accent', tokens.accent);
  root.style.setProperty('--color-accent-hover', tokens.accentHover);
  root.style.setProperty('--color-accent-text', tokens.accentText);
  root.style.setProperty('--color-background', tokens.background);
  root.style.setProperty('--color-surface', tokens.surface);
  root.style.setProperty('--color-surface-elevated', tokens.surfaceElevated || tokens.surfaceCard);
  root.style.setProperty('--color-surface-card', tokens.surfaceCard);
  root.style.setProperty('--color-surface-hover', tokens.surfaceHover);
  root.style.setProperty('--color-surface-header', tokens.surfaceHeader);
  root.style.setProperty('--color-surface-nav', tokens.surfaceNav);
  root.style.setProperty('--color-surface-subtle', tokens.surfaceSubtle);
  root.style.setProperty('--color-text', tokens.text);
  root.style.setProperty('--color-text-secondary', tokens.textSecondary);
  root.style.setProperty('--color-text-muted', tokens.textMuted);
  root.style.setProperty('--color-border', tokens.border);
  root.style.setProperty('--color-border-subtle', tokens.borderSubtle);
  root.style.setProperty('--color-card-border', tokens.cardBorder);
  root.style.setProperty('--color-input', tokens.input || tokens.inputBg);
  root.style.setProperty('--color-input-bg', tokens.inputBg);
  root.style.setProperty('--color-input-border', tokens.inputBorder);
  root.style.setProperty('--color-hover', tokens.hover || tokens.surfaceHover);
  root.style.setProperty('--color-selected', tokens.selected || tokens.primaryBg);
  root.style.setProperty('--color-badge-bg', tokens.badgeBg);
  root.style.setProperty('--color-badge-text', tokens.badgeText);
}
