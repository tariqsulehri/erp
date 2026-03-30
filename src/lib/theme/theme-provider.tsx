'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'slate' | 'warm';

export interface ThemeConfig {
  value:   Theme;
  label:   string;
  desc:    string;
  sidebar: string;   /* sidebar bg colour for preview */
  bg:      string;   /* page bg colour for preview */
  accent:  string;   /* primary accent colour */
}

export const THEMES: ThemeConfig[] = [
  {
    value:   'light',
    label:   'Ocean',
    desc:    'Crisp royal blue',
    sidebar: '#0b1940',
    bg:      '#e8f0fe',
    accent:  '#1d4ed8',
  },
  {
    value:   'dark',
    label:   'Carbon',
    desc:    'High-contrast dark',
    sidebar: '#060d1a',
    bg:      '#0a1220',
    accent:  '#4d8eff',
  },
  {
    value:   'slate',
    label:   'Midnight',
    desc:    'Deep indigo premium',
    sidebar: '#1e1b4b',
    bg:      '#eeecff',
    accent:  '#4f46e5',
  },
  {
    value:   'warm',
    label:   'Sunset',
    desc:    'Vibrant amber orange',
    sidebar: '#1a0900',
    bg:      '#fff7ed',
    accent:  '#ea580c',
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
