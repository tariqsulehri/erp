# ERP Design Standards — Master Prompt for Claude

Source: the design system of the Calibr (DevOps Carrier) app, erp brand.
Target: a new **ERP** app built with **Node.js + Next.js (App Router) + Tailwind CSS**.

---

## 1. Where to put this

In the **new ERP repo** (not in Calibr):

| File | Put it at | Purpose |
|---|---|---|
| This whole file | `documents/design/DESIGN_STANDARDS.md` | The design rules Claude reads |
| Brand guideline PDF (optional) | `documents/design/erp-Brand-Guidelines.pdf` | Source for colours |
| One line in `CLAUDE.md` (repo root) | `CLAUDE.md` | So Claude follows it in every session |

Add this to the ERP repo's `CLAUDE.md`:

```md
## Design
All UI must follow documents/design/DESIGN_STANDARDS.md (fonts, themes, colour tokens, charts, layout).
No raw hex colours in components. Use the tokens only.
```

## 2. How to run it

1. Open Claude Code in the ERP repo root.
2. Paste the **Master Prompt** (section 3) as your first message.
3. Check the result in a real browser (light + dark) before accepting.
4. For later screens, just say: *"Build the X screen. Follow documents/design/DESIGN_STANDARDS.md."*

---

## 3. Master Prompt (copy and paste)

```text
You are setting up the design system for our ERP web app (Node.js, Next.js App Router, Tailwind CSS, TypeScript).
Read documents/design/DESIGN_STANDARDS.md fully first. It is the single source of truth.

Do this in order:

1. FONTS
   - Install @fontsource/poppins (400, 500, 600, 700) and @fontsource/jetbrains-mono (500, 600), latin subset only,
     or use next/font/local with the same files. Self-host. No Google Fonts link at runtime.
   - Poppins = all UI text. JetBrains Mono = all numbers (amounts, quantities, IDs/codes, dates in tables, KPI values).
   - Set CSS vars --font-sans and --font-mono and wire them into tailwind.config fontFamily.sans / mono.

2. COLOUR TOKENS
   - Create styles/themes/brand-palette.css with the brand palette from section 5 of the standards.
     This is the ONLY file allowed to contain raw colour values.
   - Create styles/themes/light.css and styles/themes/dark.css that map semantic tokens (section 6) to palette names.
   - All values are space-separated RGB triplets (e.g. 7 85 233) so Tailwind opacity works: rgb(var(--accent) / 0.5).
   - Register every semantic token in tailwind.config colors.

3. THEMES
   - Themes switch by class on <html>: "erp" (light), "erp dark" (dark), optional "vivid" add-on.
   - Use next-themes (attribute="class") or a small ThemeProvider. Avoid flash: set the class before first paint.
   - Persist the user's choice. Default = light.

4. BASE COMPONENTS (components/ui/)
   Button, IconButton (with title tooltip), Input, Select, Textarea, Checkbox, Badge/StatusChip, Card, StatTile (KPI),
   DataTable (sortable, sticky header, compact rows, right-aligned numbers), Toolbar, PageHeader, Modal, Drawer,
   Tabs, Toast, EmptyState, Skeleton, HelpButton (opens a help modal), ChartCard.
   Each uses tokens only. Create components/COMPONENT_CATALOG.md listing each one with a usage example.

5. CHARTS
   - Use Recharts. Create hooks/useChartTheme.ts that reads the CSS tokens at runtime and returns colours,
     font sizes and grid/axis styles, and re-renders on theme change.
   - Follow section 8 of the standards.

6. GUARDS
   - Add a script (npm run check:colors) that fails if any file outside brand-palette.css contains a hex/rgb/hsl literal.
   - Add a test that checks text tokens meet WCAG AA contrast (4.5:1) on their surfaces in both themes.
   - Add eslint-plugin-jsx-a11y.

7. DEMO PAGE
   Build /design-system showing every token, both themes, every component, and one of each chart type,
   using clearly labelled sample data on this page only.

Rules: no raw colours in components, no fake/fallback numbers in real screens, every icon button has a title,
every screen/chart has a HelpButton, text never below 12px. Show me a screenshot of light and dark before saying done.
```

---

## 4. Fonts

| Use | Font | Weights | Notes |
|---|---|---|---|
| All UI text | **Poppins** | 400, 500, 600, 700 | Self-hosted via `@fontsource/poppins` |
| Numbers | **JetBrains Mono** | 500, 600 | Poppins has no tabular figures, so numbers jump in columns. Apply to `.tabular-nums` |
| Fallback | `ui-sans-serif, system-ui, sans-serif` | | |

```css
html.erp {
  --font-sans: 'Poppins', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
html.erp .tabular-nums { font-family: var(--font-mono); }
```

Typography rules:
- **Minimum size 12px** for anything that carries information (incl. chart labels).
- `font-black` / `font-extrabold` render as **700** (Poppins loaded only to 700).
- **Headings:** sentence case, weight 600, no letter-spacing. Only small labels/overlines/badges stay UPPERCASE.
- Table headers: `text-xs`, bold, uppercase. Body text: `text-sm`. KPI value: `text-2xl` bold, mono.
- Poppins is ~6% wider than Inter: give name/description columns a bit more width (`14rem`, small `12.5rem`).

---

## 5. Brand palette (`brand-palette.css` — the only place for raw colours)

| Token | Hex | Use |
|---|---|---|
| `--erp-blue` | `#0755E9` | Primary action, links, main series. White on it = 6.03:1 |
| `--erp-blue-deep` | `#04338C` | Hover, focus ring, gradient end |
| `--erp-orange` | `#EE4200` | Accent **marks and large text only** (3.88:1) |
| `--erp-orange-text` | `#BE3500` | Orange for small text (5.68:1) |
| `--erp-feather` | `#D2D9D9` | Dividers, borders, chart tracks (decorative) |
| `--erp-dark` | `#1B1B1B` | Main text (light), card (dark) |
| `--erp-white` | `#FFFFFF` | Card surface (light) |
| `--erp-canvas` | `#F2F5F5` | Page background (light) |
| `--erp-surface-2` | `#EEF1F1` | Secondary surface, row hover |
| `--erp-border-strong` | `#7E8A8A` | Input borders (3.57:1) |
| `--erp-text-2` | `#4A4A4A` | Secondary text |
| `--erp-text-3` | `#5E5E5E` | Muted text (still 4.5:1) |
| Blue tints 80/60/40/20/10 | `#3977ED` `#6A99F2` `#9CBBF6` `#CDDDFB` `#E6EEFD` | Soft fills; `-60` = link text on dark |
| Orange tints 80/10 | `#F16833` `#FDECE6` | Orange text on dark / soft fill |
| Dark tints 80/60/40/20/10 | `#494949` `#767676` `#A4A4A4` `#D1D1D1` `#E8E8E8` | Greys |
| Night | `#141414` `#242424` `#2E2E2E` | Dark page / surface-2 / surface-3 |
| Night borders | `#333333` / `#6B6B6B` | Dark border / strong border |
| Hover (dark theme) | `#2F6BE6` | Button hover in dark |
| Chart teal | `#0F9F8F` (light) / `#13A08F` (dark) | Second chart series |
| Chart orange (dark) | `#E04E14` | Third series on dark |

Store as RGB triplets, e.g. `--erp-blue: 7 85 233; /* #0755E9 */`.

---

## 6. Semantic tokens (what components use)

| Token | Light | Dark |
|---|---|---|
| `--bg` (page) | canvas `#F2F5F5` | night `#141414` |
| `--surface` (card) | white | `#1B1B1B` |
| `--surface-2` / `--surface-3` | `#EEF1F1` / feather | `#242424` / `#2E2E2E` |
| `--border` / `--border-2` | feather / `#7E8A8A` | `#333333` / `#6B6B6B` |
| `--text-1` / `-2` / `-3` | `#1B1B1B` / `#4A4A4A` / `#5E5E5E` | white / `#D1D1D1` / `#A4A4A4` |
| `--accent` (primary fill) | blue | blue |
| `--accent-h` (hover) | blue-deep | `#2F6BE6` |
| `--accent-soft` | blue-10 | `#0A2A66` |
| `--accent-txt` (link/text) | blue | blue-60 `#6A99F2` |
| `--accent-ring` (focus) | blue-deep | blue-40 |
| `--accent-fg` (text on accent) | white | white |
| `--brand-accent` / `-txt` / `-soft` | orange / `#BE3500` / orange-10 | orange / `#F16833` / `#3A1A0D` |
| `--success` / `-soft` | `21 128 61` / `220 252 231` | `74 222 128` / `5 46 22` |
| `--warning` / `-soft` | `161 98 7` / `254 249 195` | `250 204 21` / `69 26 3` |
| `--danger` / `-soft` | `185 28 28` / `254 226 226` | `248 113 113` / `69 10 10` |
| `--info` | blue | blue-60 |
| `--chart-target` | orange-text | orange-80 |

In dark: blue is a **fill behind white text**; blue **text** uses blue-60 (brand blue on dark is only 2.86:1). Success/warning/danger fills in dark use near-black text (`--*-fg: 20 20 20`).

### ERP status mapping (use these, do not invent new colours)

| ERP status | Token |
|---|---|
| Draft | `text-3` on `surface-2` |
| Submitted / Pending approval | `warning` on `warning-soft` |
| Approved / Posted / Paid | `success` on `success-soft` |
| Rejected / Overdue / Cancelled | `danger` on `danger-soft` |
| In progress / Open | `accent-txt` on `accent-soft` |
| Flagged / Needs attention | `brand-accent-txt` on `brand-accent-soft` |

Status chips: `rounded-full px-2 py-0.5 text-xs font-semibold`, always with a text label (never colour alone).

---

## 7. Themes, shape and surface

- **erp (light)** — default. `<html class="erp">`
- **erp dark** — `<html class="erp dark">` (Tailwind `darkMode: ['class']`)
- **Vivid** (optional add-on) — `<html class="erp vivid">`: soft depth only; no colour changes.
  - Meters: blue gradient (blue-80 → blue → blue-deep) in a sunken blue-20→blue-10 track.
  - Cards: low blue-tinted lift `0 1px 2px rgb(blue-deep/.06), 0 6px 16px -6px rgb(blue-deep/.18)`.
  - No glow, no glass, no bevel.

Style: **flat and crisp**. No glassmorphism, no glow, no multi-colour gradients.
The only gradient allowed: `linear-gradient(135deg, blue 0%, blue-deep 100%)` (hero banner / brand).

| Radius | sm | base | md | lg | xl | 2xl | 3xl |
|---|---|---|---|---|---|---|---|
| Value | 0.25rem | 0.25rem | 0.375rem | 0.5rem | 0.75rem | 0.75rem | 1rem |

Shadows: `card: 0 1px 3px rgb(0 0 0/.07), 0 1px 2px -1px rgb(0 0 0/.07)`, `card-hover: 0 4px 16px rgb(0 0 0/.12)`, `elevated: 0 8px 24px -4px rgb(0 0 0/.15)`.
Icons: **lucide-react**. Icon tiles and avatars: flat `accent` fill, `accent-fg` icon.

---

## 8. Charts (Recharts)

All chart colours come from `useChartTheme()`, which reads the CSS tokens. Never hard-code colours in a chart.

**Series order (categorical):**
1. Blue `--accent` (`#0755E9`; dark `#3977ED`)
2. Teal (`#0F9F8F`; dark `#13A08F`)
3. Orange `--brand-accent` (`#EE4200`; dark `#E04E14`)
4. Then blue-deep, blue-40, dark-60 grey. More than 6 series → group into "Other" or use a table.

**Ordered levels (e.g. aging buckets, grades):** a single-hue ladder — blue `#0755E9 → #0649C4 → #053DA0 → #04338C → #03266A` (light), lighter steps in dark (`#6A99F2 → #CDDDFB`). Teal ladder for a second scale.

**Status in charts:** success / warning / danger tokens only (e.g. paid / due / overdue).

**Marks and chrome:**
- Grid lines: `--border` (feather), horizontal only, dashed or light.
- Axis text: `--text-3`, **12px minimum**, numbers in mono.
- Target / budget line: `--chart-target` (orange-text), dashed.
- Bars: standard height and solid presence. Horizontal ranked bars (`RankedBars`) use a standard track height of 14px (pill rounded with 3D specular rim) to ensure tactile legibility instead of thin hairlines. Column bars use standard widths up to 38px with rounded top corners.
- Donut charts: compact 130px diameter with 72px central metric core and inline table legend (max-width: 480px) to prevent awkward vertical whitespace and avoid empty gaps.
- Chart width and ergonomics: graphs maintain meaningful, presentable content widths (capping excessive horizontal stretching on wide screens) to keep titles, marks, and values readable without empty space consumption.
- Tooltip: plain `surface` background, `border`, `text-1` title, value coloured with its series colour. No gradients/blur.
- Donut: max 5 slices, label with value + %.
- Legend: always present when >1 series; text label, not colour alone.

**Which chart for which ERP question:**

| Question | Chart |
|---|---|
| Trend over time (revenue, expenses, stock) | Line / area |
| Compare categories (by branch, product, vendor) | Horizontal bar, sorted |
| Actual vs budget/target | Bar + dashed target line |
| Part of a whole (≤5 parts) | Donut, else stacked bar |
| Aging (AR/AP 0-30, 31-60…) | Stacked bar with level ladder |
| Single KPI | StatTile: label, mono value, delta chip, optional sparkline |

**Data rules (No Fabricated / Static Graph Data):** never show invented or fallback numbers; never fabricate graphs, charts, or KPI tiles with static or dummy values. All visualization figures and data points must come directly from the database and reflect real, authenticated business data. Missing data shows "No data", not 0. Unassessed/empty ≠ zero. Every chart sits in a `ChartCard` with title (sentence case), unit, period, and a HelpButton explaining what it shows.

**Functional Invariance During Visual Refactoring:** never touch, alter, or break component business logic, validation rules, event handlers, props contracts, data fetching, state flows, or calculations when working on look and feel, themes, or styling. Visual improvements must remain strictly presentation-only. CSS custom properties and design tokens in `design-tokens.css` and `globals.css` are the single source of truth for styles, gradients, surfaces, and tiles.

---

## 9. ERP layout rules

- **Compact UI:** maximum space for data. No heavy margins, no big fonts, no one-item lines.
- **Overlapping Slide-Over Drawers (`Drawer.tsx`):** Document and transaction detail views (Vouchers, Purchases, Sales, Stock Transfers, Adjustments) must render inside the standard elevated slide-over `Drawer` overlay (`Drawer.tsx`, default `size="lg"`: `min(900px, 96vw)`), floating above the grid with a backdrop scrim (`var(--color-scrim)`). Never compress the document table into a narrow side-by-side column (`.split-view.has-side` anti-pattern). The underlying list table stays 100% wide. Line items inside the drawer must have ample column widths with zero text truncation.
- **Document Detail Drawer Anatomy & Type Heading:** All current and upcoming document detail views (Invoices, Transfers, Adjustments, Vouchers, Returns) must follow the standardized `DocumentDetailPanel` pattern:
  - **Descriptive Heading:** Top drawer title describes document type (`Voucher Details`, `Stock Transfer Details`, `Stock Adjustment Details`, `Opening Stock Details`, `Purchase Invoice Details`, `Sales Invoice Details`, `Purchase Return Details`, `Sale Return Details`), never just a raw reference number.
  - **Header Actions:** Edit Draft (when editable), Print, and Close.
  - **Fields Grid:** Starts with Document No., Date, Document Type, and Status badge (`StatusChip`).
  - **Lines Table:** Standard table (`No.`, Code, Description, UOM, Qty, Price, Amount).
  - **Totals:** Symmetrically right-aligned totals (`DetailTotals`).
  - **Status Guidance Note:** `DetailNote` explaining document lifecycle status.
  - **Action Footer:** Lifecycle actions (`DetailActions`) rendered at the bottom, never as a jarring top banner.
- **Whole-Screen Overview & Preserving Vertical Scroll:** Overview pages and dashboard grids must be designed to fit common laptop screens (768px–900px) cleanly on a single screen using compact vertical padding (`8px`–`12px`), sleek tile heights (~64px–72px), and calibrated chart heights (`170px`–`190px`). Layout containers and page shells must never clip content with `overflow: hidden` without a scrollable container; `overflow-y: auto` must always remain accessible so cards and graphs are never trimmed off or unreachable at the bottom.
- **Standard Modal & Drawer Components:** All modal dialogs and slide-overs must consume the shared `Modal.tsx` and `Drawer.tsx` components with unified size tokens (`sm`, `md`, `lg`, `xl`), accessible focus management (`useDialogFocus`), backdrop click dismiss, and `Escape` key handling.
- **Max two toolbars** per screen (page header + filter bar). Never repeat title, search or count.
- **Tables:** compact rows (`py-2`), sticky header, numbers right-aligned in mono, currency with thousand separators and fixed decimals, totals row bold. Zebra or grouped-row styling with `surface-2`.
- **Forms:** label above field (`text-xs font-bold uppercase`), 2–3 columns on desktop, required mark, inline errors in `danger`.
- **Never show database IDs.** Show business codes (Invoice No, SKU, Emp Code). No business code → don't show an ID.
- **Every button** has a `title` tooltip (icon-only ones especially).
- **Every screen, chart and KPI tile** has a HelpButton (ⓘ) opening a short help modal.
- Focus ring: 2px `--accent-ring`. Keyboard reachable. WCAG AA 4.5:1 for text.
- Sidebar ~19rem, collapsible. Content max width ~85rem on wide screens.

---

## 10. Suggested file layout in the Next.js ERP repo

```
documents/design/DESIGN_STANDARDS.md      ← this file
CLAUDE.md                            ← points to the file above
src/styles/globals.css               ← base, imports themes
src/styles/themes/brand-palette.css  ← raw colours (only here)
src/styles/themes/light.css
src/styles/themes/dark.css
src/styles/themes/vivid.css          ← optional
src/styles/themes/components.css     ← flat fills, 12px floor, heading case
src/lib/fonts.ts                     ← Poppins + JetBrains Mono
src/hooks/useChartTheme.ts
src/components/ui/*                  ← shared components
src/components/COMPONENT_CATALOG.md
src/app/(dev)/design-system/page.tsx ← demo page
scripts/check-raw-colors.mjs
tailwind.config.ts
```
