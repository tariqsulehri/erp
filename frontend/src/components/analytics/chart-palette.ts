'use client';

import { useEffect, useState } from 'react';

/**
 * The one chart palette for every ERP chart (Calm Ledger).
 * Built from Ledger Blue plus neutrals and the status hues, so charts read as one system.
 * Order matters: series 1 is always Ledger Blue, series 2 Slate, and so on.
 * This file is the only place where chart hex values are allowed.
 * Blue, Teal and Amber pass the dataviz palette checks (lightness, chroma, colour-blind separation, contrast)
 * against the light surface #ffffff and the dark surface #141c2a.
 */
const LIGHT_SERIES = {
  blue: '#1f56c7',     // Ledger Blue — the main figure
  slate: '#64748b',    // Slate — the comparison figure
  teal: '#12907f',     // Teal
  amber: '#b45309',    // Amber (warning hue)
  red: '#c62828',      // Red (danger hue)
  blueSoft: '#93b4f5', // Light Ledger Blue — background or total bars behind a Ledger Blue bar
} as const;

/** Same roles, lifted so they stay legible on the dark ground. */
const DARK_SERIES = {
  blue: '#5c8cf5',
  slate: '#9aa7b9',
  teal: '#1fa595',
  amber: '#c9802a',
  red: '#f38b8b',
  blueSoft: '#3b5a9a',
} as const;

export type ChartSeriesKey = keyof typeof LIGHT_SERIES;

export interface ChartTheme {
  series: Record<ChartSeriesKey, string>;
  /** Categorical order for pies and multi-series charts. */
  categorical: string[];
  grid: string;
  axisText: string;
  text: string;
  heading: string;
  surface: string;
  border: string;
}

function categoricalFrom(series: Record<ChartSeriesKey, string>) {
  return [series.blue, series.slate, series.teal, series.amber, series.red];
}

const FALLBACK_LIGHT: ChartTheme = {
  series: { ...LIGHT_SERIES },
  categorical: categoricalFrom(LIGHT_SERIES),
  grid: '#e6ebf1',
  axisText: '#556274',
  text: '#1e2a3b',
  heading: '#0f1b2d',
  surface: '#ffffff',
  border: '#d5dce5',
};

function readTheme(): ChartTheme {
  if (typeof window === 'undefined') return FALLBACK_LIGHT;
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const isDark = root.getAttribute('data-theme') === 'dark';
  const series = isDark ? DARK_SERIES : LIGHT_SERIES;
  return {
    series: { ...series },
    categorical: categoricalFrom(series),
    grid: read('--color-border-subtle', FALLBACK_LIGHT.grid),
    axisText: read('--color-text-muted', FALLBACK_LIGHT.axisText),
    text: read('--color-text', FALLBACK_LIGHT.text),
    heading: read('--color-heading', FALLBACK_LIGHT.heading),
    surface: read('--color-surface', FALLBACK_LIGHT.surface),
    border: read('--color-border', FALLBACK_LIGHT.border),
  };
}

/**
 * Chart colors resolved from the design tokens at render time.
 * Re-reads when the Light or Dark theme changes, so SVG charts follow the theme.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK_LIGHT);

  useEffect(() => {
    setTheme(readTheme());
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/** Axis tick style: 12px muted text. */
export function chartAxisTick(theme: ChartTheme) {
  return { fontSize: 12, fill: theme.axisText };
}


function mixHex(hex: string, target: number, amount: number) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(start => parseInt(value.slice(start, start + 2), 16));
  return `#${channels.map(channel => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Stops for the 3D bar fill: lit at the top, the true series colour through the body, a deeper base.
 * Follows the Directional Lighting Rule (vertical, light to deep). The middle stop keeps the validated colour.
 */
export function barGradientStops(color: string) {
  return [
    { offset: '0%', color: mixHex(color, 255, 0.28) },
    { offset: '45%', color },
    { offset: '100%', color: mixHex(color, 0, 0.18) },
  ];
}
