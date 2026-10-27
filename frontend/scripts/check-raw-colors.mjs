#!/usr/bin/env node
// Fails when a colour literal (hex, rgb()/rgba(), hsl()/hsla() with numbers, or a named colour in a CSS
// colour property) appears anywhere in src/ outside src/styles/themes/brand-palette.css.
// Colours must come from tokens: rgb(var(--accent)), var(--color-primary), useChartTheme().
// Usage: npm run check:colors
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const ALLOWED = new Set([
  join('src', 'styles', 'themes', 'brand-palette.css'),
  join('src', 'styles', 'themes', 'theme-palettes.css'),
  join('src', 'lib', 'theme', 'theme-definitions.ts'),
  // Product colour codes are business data (the Colour master), not interface colours.
  join('src', 'components', 'inventory', 'product-colour-defaults.ts'),
]);
const EXTENSIONS = /\.(css|scss|ts|tsx|js|jsx|mjs)$/;

const RULES = [
  // #abc, #aabbcc, #aabbccdd — not HTML entities (&#039;) and not inside identifiers or URLs' %23.
  { name: 'hex colour', pattern: /(?<![&\w%])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g },
  { name: 'rgb() literal', pattern: /\brgba?\(\s*\d/g },
  { name: 'hsl() literal', pattern: /\bhsla?\(\s*\d/g },
  // Named colours as a CSS value, e.g. `color: white` or `background: 'black'`.
  { name: 'named colour', pattern: /\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*['"]?(?:white|black|red|blue|green|gray|grey|orange|yellow)\b/gi },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (EXTENSIONS.test(entry)) files.push(path);
  }
  return files;
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split(sep).join(sep);
  if (ALLOWED.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(line);
      if (match) problems.push(`${rel}:${index + 1}  ${rule.name}: ${match[0].trim()}`);
    }
  });
}

if (problems.length) {
  console.error(`Raw colours found outside src/styles/themes/brand-palette.css (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('Use a token instead: rgb(var(--accent)), var(--color-text), or useChartTheme() in charts.');
  process.exit(1);
}
console.log('check:colors — no raw colours outside brand-palette.css.');
