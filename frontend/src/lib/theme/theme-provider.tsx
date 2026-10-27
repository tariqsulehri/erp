'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Themes switch by class on <html> (documents/design/DESIGN_STANDARDS.md section 7):
 *   "erp" (light, default) · "erp dark" · optional "vivid" add-on (soft depth, no colour change).
 * The root layout applies the saved classes before the first paint; this provider keeps them in sync.
 */
export type Theme = 'light' | 'dark';

export const THEMES: Array<{ value: Theme; label: string; desc: string }> = [
  { value: 'light', label: 'Light', desc: 'Bright workspace for daytime use' },
  { value: 'dark',  label: 'Dark',  desc: 'Low-glare workspace for dim rooms' },
];

const THEME_KEY = 'erp-theme';
const VIVID_KEY = 'erp-vivid';

interface ThemeContextValue {
  theme:    Theme;
  setTheme: (theme: Theme) => void;
  vivid:    boolean;
  setVivid: (vivid: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', setTheme: () => {}, vivid: false, setVivid: () => {} });

function applyClasses(theme: Theme, vivid: boolean) {
  const classes = document.documentElement.classList;
  classes.add('erp');
  classes.toggle('dark', theme === 'dark');
  classes.toggle('vivid', vivid);
}

function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable: the choice lasts for this visit */ }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [vivid, setVividState] = useState(false);

  useEffect(() => {
    let storedTheme: Theme = 'light';
    let storedVivid = false;
    try {
      storedTheme = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
      storedVivid = localStorage.getItem(VIVID_KEY) === '1';
    } catch { /* storage unavailable: keep the defaults */ }
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

  return (
    <ThemeContext.Provider value={{ theme, setTheme, vivid, setVivid }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
