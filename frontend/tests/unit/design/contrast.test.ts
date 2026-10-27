/**
 * WCAG AA guard for the colour tokens (documents/design/DESIGN_STANDARDS.md): every text token must reach
 * 4.5:1 on the surfaces it is used on, in both themes. Reads the real theme files, so a palette change
 * that breaks contrast fails here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const THEMES = join(__dirname, '../../../src/styles/themes');
const read = (file: string) => readFileSync(join(THEMES, file), 'utf8');

/** `--name: value;` pairs inside the first block that matches the selector. */
function declarations(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Selector ${selector} not found`);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
  const values = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) values.set(match[1], match[2].trim());
  return values;
}

const palette = declarations(read('brand-palette.css'), ':root');
const light = declarations(read('light.css'), ':root, html.erp');
const dark = new Map([...light, ...declarations(read('dark.css'), 'html.dark')]);

function triplet(theme: Map<string, string>, token: string): [number, number, number] {
  let value = theme.get(token) ?? palette.get(token);
  for (let depth = 0; value && depth < 5; depth += 1) {
    const reference = value.match(/^var\(--([\w-]+)\)$/);
    if (!reference) break;
    value = theme.get(reference[1]) ?? palette.get(reference[1]);
  }
  const parts = value?.split(/\s+/).map(Number);
  if (!parts || parts.length !== 3 || parts.some(Number.isNaN)) throw new Error(`Token --${token} is not an RGB triplet: ${value}`);
  return parts as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(first: [number, number, number], second: [number, number, number]) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

// [text token, background token]
const PAIRS: Array<[string, string]> = [
  ...['text-1', 'text-2', 'text-3'].flatMap(text => ['bg', 'surface', 'surface-2'].map(bg => [text, bg] as [string, string])),
  ['accent-txt', 'surface'], ['accent-txt', 'bg'], ['accent-txt', 'accent-soft'],
  ['accent-fg', 'accent'],
  ['success', 'success-soft'], ['warning', 'warning-soft'], ['danger', 'danger-soft'],
  ['success', 'surface'], ['danger', 'surface'],
  ['brand-accent-txt', 'surface'], ['brand-accent-txt', 'brand-accent-soft'],
  ['text-3', 'accent-soft'],
];

describe.each([['light', light], ['dark', dark]] as const)('%s theme contrast', (_name, theme) => {
  it.each(PAIRS)('%s on %s is at least 4.5:1', (text, background) => {
    expect(contrast(triplet(theme, text), triplet(theme, background))).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the accent fill is at least 4.5:1', () => {
    expect(contrast(triplet(theme, 'accent-fg'), triplet(theme, 'accent'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contrast()', () => {
  it('matches known WCAG values', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrast([7, 85, 233], [255, 255, 255])).toBeCloseTo(6.03, 1);
  });
});
