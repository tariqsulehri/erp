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
    desc:    'Clean light workspace',
    sidebar: '#172033',
    bg:      '#f6f8fb',
    accent:  '#2563eb',
  },
  {
    value:   'dark',
    label:   'Midnight',
    desc:    'Low-glare dark workspace',
    sidebar: '#111827',
    bg:      '#0f172a',
    accent:  '#38bdf8',
  },
  {
    value:   'slate',
    label:   'Harbor',
    desc:    'Calm teal workspace',
    sidebar: '#17313a',
    bg:      '#f5f8fa',
    accent:  '#0f766e',
  },
  {
    value:   'warm',
    label:   'Sage',
    desc:    'Soft green workspace',
    sidebar: '#1f2a24',
    bg:      '#f8faf4',
    accent:  '#4f772d',
  },
];

const clarity: MantineColorsTuple = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
  '#172554',
];

const graphite: MantineColorsTuple = [
  '#ecfeff',
  '#cffafe',
  '#a5f3fc',
  '#67e8f9',
  '#38bdf8',
  '#0ea5e9',
  '#0284c7',
  '#0369a1',
  '#075985',
  '#0c4a6e',
];

const aurora: MantineColorsTuple = [
  '#f0fdfa',
  '#ccfbf1',
  '#99f6e4',
  '#5eead4',
  '#2dd4bf',
  '#0f766e',
  '#0d625d',
  '#134e4a',
  '#115e59',
  '#042f2e',
];

const citrus: MantineColorsTuple = [
  '#f7fbeF',
  '#edf6df',
  '#dcebc5',
  '#c4d7a4',
  '#a7bd7c',
  '#4f772d',
  '#3f5f25',
  '#2f461d',
  '#243816',
  '#17250d',
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
