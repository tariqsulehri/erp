'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeConfig {
  value:   Theme;
  label:   string;
  desc:    string;
  sidebar: string;   /* sidebar bg colour for preview */
  bg:      string;   /* page bg colour for preview */
  accent:  string;   /* primary accent colour */
}

// Preview swatches mirror src/app/design-tokens.css.
export const THEMES: ThemeConfig[] = [
  {
    value:   'light',
    label:   'Light',
    desc:    'Bright workspace for daytime use',
    sidebar: '#182130',
    bg:      '#f5f6f8',
    accent:  '#1f56c7',
  },
  {
    value:   'dark',
    label:   'Dark',
    desc:    'Low-glare workspace for dim rooms',
    sidebar: '#0a101b',
    bg:      '#0d1420',
    accent:  '#3b6fe0',
  },
];

const STORAGE_KEY = 'erp-theme';

interface ThemeContextValue {
  theme:    Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && THEMES.some(t => t.value === stored)) {
      apply(stored);
      setThemeState(stored);
    }
  }, []);

  function setTheme(t: Theme) {
    apply(t);
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
}

export function useTheme() {
  return useContext(ThemeContext);
}
