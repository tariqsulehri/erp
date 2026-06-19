'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  MantineProvider,
  createTheme,
  type MantineColorShade,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from '@mantine/core';

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
    label:   'Clarity',
    desc:    'Bright ERP workspace',
    sidebar: '#132238',
    bg:      '#f5f8fc',
    accent:  '#1677ff',
  },
  {
    value:   'dark',
    label:   'Graphite',
    desc:    'Clear dark operations',
    sidebar: '#141820',
    bg:      '#0f131a',
    accent:  '#22d3ee',
  },
  {
    value:   'slate',
    label:   'Aurora',
    desc:    'Modern teal violet',
    sidebar: '#18213a',
    bg:      '#f4f7fb',
    accent:  '#13c2c2',
  },
  {
    value:   'warm',
    label:   'Citrus',
    desc:    'Fresh amber green',
    sidebar: '#1f2933',
    bg:      '#fbfaf4',
    accent:  '#84cc16',
  },
];

const clarity: MantineColorsTuple = [
  '#e6f4ff',
  '#cfe8ff',
  '#91caff',
  '#69b1ff',
  '#4096ff',
  '#1677ff',
  '#0958d9',
  '#003eb3',
  '#002c8c',
  '#001d66',
];

const graphite: MantineColorsTuple = [
  '#ecfeff',
  '#cffafe',
  '#a5f3fc',
  '#67e8f9',
  '#22d3ee',
  '#06b6d4',
  '#0891b2',
  '#0e7490',
  '#155e75',
  '#164e63',
];

const aurora: MantineColorsTuple = [
  '#e6fffb',
  '#b5f5ec',
  '#87e8de',
  '#5cdbd3',
  '#36cfc9',
  '#13c2c2',
  '#08979c',
  '#006d75',
  '#00474f',
  '#002329',
];

const citrus: MantineColorsTuple = [
  '#f7fee7',
  '#ecfccb',
  '#d9f99d',
  '#bef264',
  '#a3e635',
  '#84cc16',
  '#65a30d',
  '#4d7c0f',
  '#3f6212',
  '#365314',
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
      clarity,
      graphite,
      aurora,
      citrus,
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
      sm: '4px',
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
      fontWeight: '700',
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
  light: makeMantineTheme('clarity', 5),
  dark: makeMantineTheme('graphite', 4),
  slate: makeMantineTheme('aurora', 5),
  warm: makeMantineTheme('citrus', 5),
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
