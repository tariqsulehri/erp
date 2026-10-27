'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/**
 * Chart colours, read from the CSS tokens at runtime (documents/design/DESIGN_STANDARDS.md section 8).
 * Never hard-code a colour in a chart: use this hook. It re-reads when the theme classes change
 * (erp / dark / vivid), so SVG charts follow the theme.
 *
 * Series order: 1 blue, 2 teal, 3 orange, then blue-deep, blue-40, grey. Past 6 series, group into "Other".
 */
export interface ChartTheme {
  /** Named series. `slate` is the grey sixth series; `red` is the danger status (for status data only). */
  series: { blue: string; teal: string; amber: string; slate: string; red: string; blueSoft: string; blueDeep: string };
  /** Categorical order for multi-series charts and donuts. */
  categorical: string[];
  /** Single-hue ladder for ordered levels (aging buckets, grades). */
  ladder: string[];
  status: { success: string; warning: string; danger: string };
  grid: string;
  axisText: string;
  text: string;
  heading: string;
  surface: string;
  border: string;
  track: string;
  target: string;
}

// Before the stylesheet is readable (server render, tests) charts draw in the current text colour.
const PENDING = 'currentColor';

function emptyTheme(): ChartTheme {
  return {
    series: { blue: PENDING, teal: PENDING, amber: PENDING, slate: PENDING, red: PENDING, blueSoft: PENDING, blueDeep: PENDING },
    categorical: Array(6).fill(PENDING),
    ladder: Array(5).fill(PENDING),
    status: { success: PENDING, warning: PENDING, danger: PENDING },
    grid: PENDING, axisText: PENDING, text: PENDING, heading: PENDING, surface: 'transparent', border: PENDING, track: PENDING, target: PENDING,
  };
}

/** `rgb(r g b)` from a token holding an RGB triplet; the fallback when the token is missing. */
export function tokenColor(styles: CSSStyleDeclaration, name: string, fallback = PENDING) {
  const value = styles.getPropertyValue(`--${name}`).trim();
  return value ? `rgb(${value})` : fallback;
}

export function readChartTheme(root: Element = document.documentElement): ChartTheme {
  const styles = getComputedStyle(root);
  const color = (name: string) => tokenColor(styles, name);
  const categorical = [1, 2, 3, 4, 5, 6].map(index => color(`chart-${index}`));
  return {
    series: {
      blue: categorical[0],
      teal: categorical[1],
      amber: categorical[2],
      blueDeep: categorical[3],
      blueSoft: categorical[4],
      slate: categorical[5],
      red: color('danger'),
    },
    categorical,
    ladder: [1, 2, 3, 4, 5].map(index => color(`chart-ladder-${index}`)),
    status: { success: color('success'), warning: color('warning'), danger: color('danger') },
    grid: color('chart-grid'),
    axisText: color('chart-axis'),
    text: color('text-1'),
    heading: color('text-1'),
    surface: tokenColor(styles, 'surface', 'transparent'),
    border: color('border'),
    track: color('chart-track'),
    target: color('chart-target'),
  };
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(emptyTheme);

  useEffect(() => {
    setTheme(readChartTheme());
    const observer = new MutationObserver(() => setTheme(readChartTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/** Axis tick style: 12px minimum, muted text, numbers in the mono face. */
export function chartAxisTick(theme: ChartTheme) {
  return { fontSize: 12, fill: theme.axisText, fontFamily: 'var(--font-mono)' };
}

/** Legend text style for a Recharts Legend wrapper. */
export const chartLegendStyle: CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', paddingTop: 4 };
