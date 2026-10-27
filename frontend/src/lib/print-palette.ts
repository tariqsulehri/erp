/**
 * Print documents open in their own window, outside the app's stylesheet. This returns a CSS block that
 * copies the --print-* colours from styles/themes/brand-palette.css (read from the page at print time),
 * so print templates use var(--print-ink) etc. and never contain raw colour values.
 *
 *   const html = `<style>${printPaletteCss()} body { color: rgb(var(--print-ink)); }</style>…`;
 */
export const PRINT_TOKENS = [
  'print-ink', 'print-muted', 'print-faint', 'print-paper', 'print-rule', 'print-rule-strong',
  'print-head-bg', 'print-head-fg', 'print-band', 'print-accent', 'print-accent-soft', 'print-negative',
] as const;

export type PrintToken = typeof PRINT_TOKENS[number];

export function printPaletteCss(source: Element | null = typeof document === 'undefined' ? null : document.documentElement) {
  const styles = source ? getComputedStyle(source) : null;
  const declarations = PRINT_TOKENS
    .map(token => [token, styles?.getPropertyValue(`--${token}`).trim() ?? ''] as const)
    .filter(([, value]) => value)
    .map(([token, value]) => `--${token}: ${value};`);
  return `:root { ${declarations.join(' ')} }`;
}

/** `rgb(var(--print-ink))`, optionally with opacity. */
export function printColor(token: PrintToken, alpha?: number) {
  return alpha === undefined ? `rgb(var(--${token}))` : `rgb(var(--${token}) / ${alpha})`;
}
