'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  MantineProvider,
  createTheme,
  type MantineColorShade,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from '@mantine/core';

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

const ledgerBlue: MantineColorsTuple = [
  '#edf2fc',
  '#d8e3f8',
  '#b4c9f1',
  '#86a8e6',
  '#4f7fd8',
  '#1f56c7',
  '#1a4aad',
  '#173f94',
  '#1e3a8a',
  '#172554',
];

function makeMantineTheme(primaryColor: string, primaryShade: MantineColorShade): MantineThemeOverride {
  return createTheme({
    primaryColor,
    primaryShade,
    autoContrast: true,
    luminanceThreshold: 0.35,
    defaultRadius: 'sm',
    cursorType: 'pointer',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    fontFamilyMonospace: '"JetBrains Mono", "SF Mono", Consolas, monospace',
    colors: {
      ledgerBlue,
    },
    fontSizes: {
      xs: '0.6875rem',
      sm: '0.8125rem',
      md: '0.875rem',
      lg: '1rem',
      xl: '1.125rem',
    },
    spacing: {
      xs: '0.375rem',
      sm: '0.5rem',
      md: '0.75rem',
      lg: '1rem',
      xl: '1.25rem',
    },
    radius: {
      xs: '2px',
      sm: '6px',
      md: '6px',
      lg: '8px',
      xl: '10px',
    },
    shadows: {
      xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
      sm: '0 2px 6px rgba(15, 23, 42, 0.08)',
      md: '0 8px 20px rgba(15, 23, 42, 0.10)',
      lg: '0 14px 32px rgba(15, 23, 42, 0.14)',
      xl: '0 22px 48px rgba(15, 23, 42, 0.18)',
    },
    headings: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      fontWeight: '600',
      sizes: {
        h1: { fontSize: '1.5rem', lineHeight: '1.25' },
        h2: { fontSize: '1.25rem', lineHeight: '1.3' },
        h3: { fontSize: '1.125rem', lineHeight: '1.35' },
        h4: { fontSize: '1rem', lineHeight: '1.4' },
        h5: { fontSize: '0.9375rem', lineHeight: '1.4' },
        h6: { fontSize: '0.875rem', lineHeight: '1.4' },
      },
    },
  });
}

const MANTINE_THEME_BY_NAME: Record<Theme, MantineThemeOverride> = {
  light: makeMantineTheme('ledgerBlue', 5),
  dark: makeMantineTheme('ledgerBlue', 5),
};

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
      <MantineProvider
        theme={MANTINE_THEME_BY_NAME[theme]}
        forceColorScheme={theme === 'dark' ? 'dark' : 'light'}
      >
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
}

export function useTheme() {
  return useContext(ThemeContext);
}
