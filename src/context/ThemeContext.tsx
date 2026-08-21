import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  type ThemePalette,
  type AppearanceMode,
  type ThemeSettings,
  getThemeSettings,
  saveThemeSettings,
  applyTheme,
  DEFAULT_THEME_SETTINGS,
} from '../utils/theme';

interface ThemeContextType {
  palette: ThemePalette;
  appearanceMode: AppearanceMode;
  themeSettings: ThemeSettings;
  setPalette: (palette: ThemePalette) => void;
  setAppearanceMode: (mode: AppearanceMode) => void;
  setTheme: (settings: ThemeSettings) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  palette: DEFAULT_THEME_SETTINGS.palette,
  appearanceMode: DEFAULT_THEME_SETTINGS.mode,
  themeSettings: DEFAULT_THEME_SETTINGS,
  setPalette: () => {},
  setAppearanceMode: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    const initial = getThemeSettings();
    applyTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyTheme(themeSettings);
  }, [themeSettings]);

  const setPalette = (palette: ThemePalette) => {
    const updated: ThemeSettings = { ...themeSettings, palette };
    setThemeSettings(updated);
    saveThemeSettings(updated);
  };

  const setAppearanceMode = (mode: AppearanceMode) => {
    const updated: ThemeSettings = { ...themeSettings, mode };
    setThemeSettings(updated);
    saveThemeSettings(updated);
  };

  const setTheme = (settings: ThemeSettings) => {
    setThemeSettings(settings);
    saveThemeSettings(settings);
  };

  const value = useMemo(
    () => ({
      palette: themeSettings.palette,
      appearanceMode: themeSettings.mode,
      themeSettings,
      setPalette,
      setAppearanceMode,
      setTheme,
    }),
    [themeSettings]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
