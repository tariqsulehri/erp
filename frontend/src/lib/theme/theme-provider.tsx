'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  THEMES,
  THEME_DEFINITIONS,
  THEME_IDS,
  THEMES_LIST,
  DEFAULT_THEME,
  type Theme,
  type ThemeDefinition,
  type ThemeOption,
} from './theme-definitions';

export {
  THEMES,
  THEME_DEFINITIONS,
  THEME_IDS,
  THEMES_LIST,
  DEFAULT_THEME,
  type Theme,
  type ThemeDefinition,
  type ThemeOption,
};

const THEME_KEY = 'erp-theme';
const VIVID_KEY = 'erp-vivid';

interface ThemeContextValue {
  theme: Theme;
  currentTheme: ThemeDefinition;
  setTheme: (theme: Theme) => void;
  vivid: boolean;
  setVivid: (vivid: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  currentTheme: THEME_DEFINITIONS[DEFAULT_THEME],
  setTheme: () => {},
  vivid: false,
  setVivid: () => {},
});

function applyClasses(theme: Theme, vivid: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const classes = root.classList;
  classes.add('erp');

  // Strip non-active theme-* classes
  THEME_IDS.forEach(id => {
    if (id !== 'light' && id !== 'dark') {
      classes.remove(`theme-${id}`);
    }
  });

  const isDark = theme === 'dark' || theme === 'midnight' || Boolean(THEME_DEFINITIONS[theme]?.isDark);
  classes.toggle('dark', isDark);

  if (theme !== 'light' && theme !== 'dark') {
    classes.add(`theme-${theme}`);
  }

  root.setAttribute('data-theme', theme);
  classes.toggle('vivid', vivid);
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: choice lasts for this visit */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [vivid, setVividState] = useState(false);

  useEffect(() => {
    let storedTheme: Theme = DEFAULT_THEME;
    let storedVivid = false;
    try {
      const rawTheme = localStorage.getItem(THEME_KEY);
      if (rawTheme && THEME_IDS.includes(rawTheme as Theme)) {
        storedTheme = rawTheme as Theme;
      }
      storedVivid = localStorage.getItem(VIVID_KEY) === '1';
    } catch {
      /* storage unavailable: keep defaults */
    }
    setThemeState(storedTheme);
    setVividState(storedVivid);
    applyClasses(storedTheme, storedVivid);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyClasses(next, vivid);
    save(THEME_KEY, next);
  }

  function setVivid(next: boolean) {
    setVividState(next);
    applyClasses(theme, next);
    save(VIVID_KEY, next ? '1' : '0');
  }

  const currentTheme = THEME_DEFINITIONS[theme] || THEME_DEFINITIONS[DEFAULT_THEME];

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme, vivid, setVivid }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * useThemeStore hook providing store-like access to the active theme,
 * full theme dictionary, and theme-setting methods.
 */
export function useThemeStore() {
  const context = useContext(ThemeContext);
  return {
    theme: context.theme,
    currentTheme: context.currentTheme,
    setTheme: context.setTheme,
    vivid: context.vivid,
    setVivid: context.setVivid,
    themes: THEME_DEFINITIONS,
    themesList: THEMES_LIST,
  };
}
