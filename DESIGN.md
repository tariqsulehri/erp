---
name: ERP Finance
description: Calm Ledger — the visual standard for every ERP screen
colors:
  ledger-blue: "#1f56c7"
  ledger-blue-hover: "#1a4aad"
  ledger-blue-tint: "#edf2fc"
  ledger-blue-ink: "#1f56c7"
  workspace-ground: "#f5f6f8"
  paper: "#ffffff"
  paper-alt: "#f7f9fb"
  rule: "#d5dce5"
  rule-subtle: "#e6ebf1"
  control-edge: "#8592a2"
  ink-heading: "#0f1b2d"
  ink: "#1e2a3b"
  ink-secondary: "#3b4859"
  ink-muted: "#556274"
  ink-light: "#6b7787"
  navigation-navy: "#182130"
  success: "#15803d"
  success-tint: "#edf7f0"
  warning: "#b45309"
  warning-tint: "#fdf6e9"
  danger: "#c62828"
  danger-tint: "#fdf0f0"
  dark-ground: "#0d1420"
  dark-paper: "#141c2a"
  dark-rule: "#2a3547"
  dark-ink: "#dbe2ec"
  dark-blue: "#3b6fe0"
typography:
  page-title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
  figure:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  sm: "4px"
  control: "6px"
  container: "8px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    background: "linear-gradient(180deg, #256df6 0%, #0755e9 60%, #043ec0 100%)"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
    typography: "{typography.control}"
    boxShadow: "0 2px 4px rgba(7,85,233,0.28), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.18)"
  button-primary-hover:
    background: "linear-gradient(180deg, #387df7 0%, #1562f1 60%, #0548d8 100%)"
    boxShadow: "0 3px 6px rgba(7,85,233,0.36), inset 0 1px 0 rgba(255,255,255,0.4)"
  button-secondary:
    background: "linear-gradient(180deg, #ffffff 0%, #f6f8fb 100%)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
    boxShadow: "0 1px 3px rgba(15,27,45,0.08), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.06)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    height: "32px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
    typography: "{typography.control}"
  table-header:
    background: "linear-gradient(180deg, #f8fafd 0%, #edf1f6 100%)"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    height: "36px"
  badge-success:
    background: "linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    height: "20px"
  panel:
    background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)"
    rounded: "{rounded.container}"
    boxShadow: "0 2px 6px -1px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.04), inset 0 1px 0 rgba(255,255,255,0.85)"
---

# Design System: ERP Finance

> **Who this is for:** everyone who builds or changes a screen in `frontend/`, people and AI agents alike.
> **Where the values live:** [`frontend/src/app/design-tokens.css`](frontend/src/app/design-tokens.css) holds every token. Shared classes are in [`globals.css`](frontend/src/app/globals.css) and shared components in [`frontend/src/components/ui/`](frontend/src/components/ui/).
> **Reference screens:** [Branches](frontend/src/components/branches/BranchManagementPage.tsx) (list + full-page form) and [Areas](frontend/src/components/config/AreasPage.tsx) (list + side panel). When in doubt, copy them.

## Overview

**Creative North Star: "The Dimensional Ledger (3D Gradient Style)"**

A high-precision financial instrument crafted with modern physical dimensionality: crisp surfaces, subtle top-to-bottom gradients that capture directional light, delicate specular inner highlights (`inset 0 1px 0`), and tactile 3D controls. The staff who use this ERP enter vouchers and maintain records all day. The interface earns their trust by pairing strict numerical predictability with satisfying tactile depth—making primary actions, data groupings, and active states unmistakable without visual clutter.

Depth comes from refined directional lighting, layered multi-stop ambient shadows, and top-edge specular bevels. Primary actions feature smooth 3D gradients with a physical click compression on `:active` (`translateY(1px)` with inset shadow). Density remains strictly compact (32px controls, 36px table rows), so a voucher displays comprehensive lines without scrolling while controls offer clear tactile target affordance.

**Key Characteristics:**
- Dimensional working surfaces with subtle directional gradient washes (`--grad-surface`) and top edge highlights on a cool, quiet ground (`Workspace Ground`)
- Tactile 3D primary actions (`--grad-primary`) with specular top sheen, bottom support border, and active press depression
- Structured secondary actions with frosted 3D button styling (`--grad-secondary`) and crisp bevel outlines
- Navy anchor only in the sidebar, styled with deep micro-gradient and sleek active indicators
- Compact 32px controls, 36px table rows, 6px control corners, 8px container corners
- Layered 3D elevation: subtle ambient grounding + key light drop shadows for panels and floating modals
- One open-source typeface (Inter), with tabular figures wherever numbers must line up (strictly NO licensed fonts)
- Two themes, Light and Dark, sharing identical 3D gradient token architecture

## Colors

A Restrained palette: cool neutrals, one blue, and three status hues.

### Primary
- **Ledger Blue** (`ledger-blue`): a deeper, less generic blue (6.5:1 with white text). Primary buttons, the active filter, links, the focus ring, and selected rows (as Ledger Blue Tint). Use it only on things a user can act on, or on the current selection.
- **Ledger Blue Tint** (`ledger-blue-tint`): background for selected rows, the active segment, and info badges.

### Neutral
- **Workspace Ground** (`workspace-ground`): the page background behind panels. Never used inside a panel.
- **Paper** (`paper`): panels, tables, forms, and inputs.
- **Paper Alt** (`paper-alt`): table headers, panel footers, read-only and disabled fields.
- **Rule** (`rule`) / **Rule Subtle** (`rule-subtle`): panel outlines and header underlines, then row dividers and inner separators.
- **Control Edge** (`control-edge`): the border of inputs and selects, 3:1 against Paper, so every field is visibly a field.
- **Ink Heading → Ink Light**: headings, body, secondary text, muted text, and placeholders. All pass 4.5:1 on Paper, placeholders included.
- **Navigation Navy** (`navigation-navy`): a low-saturation charcoal-navy for the sidebar background only, so navigation is anchored without pulling attention from the work area.

### Status
- **Success / Warning / Danger** with matching tints: badges, inline alerts, and negative amounts (Danger). Status text on tints uses the darker `*-text` tokens in design-tokens.css.

### Named Rules
**The One Blue Rule.** Ledger Blue marks what you can act on and what is selected. It never decorates: no blue header bars, no blue stripes, no blue icon tiles.

**The Navy Border Rule.** Navy appears in the sidebar and nowhere else. Table headers, panel headers, and list panes are light.

**The Token-Only Rule.** Components never contain hex values or `rgba()` literals. If a color is missing, add a token to design-tokens.css for both themes.

**The Ink Amounts Rule.** Debit, credit, and balance amounts are all ink (`--color-amount`); the column header says which is which. Only negative or out-of-balance values turn red (`--color-negative`). Green means success and blue means action, so neither is ever used to color an amount.

## Typography

**UI Font:** Inter (with -apple-system, Segoe UI, system-ui fallback)
**Figures:** Inter with `font-variant-numeric: tabular-nums`, set only on numeric cells, numeric inputs and totals, because Inter's tabular set also widens hyphens in codes like `BR-001`.
**Code Font:** `--font-code` (SF Mono, Consolas), only for code, JSON, and import previews.

**Character:** one well-tuned workhorse sans for everything. Inter is kept deliberately: it has true tabular figures, and all 50+ screens already use it. `--font-mono` is a historic alias of the UI font, so amounts never switch to a monospace costume.

### Hierarchy
- **Page Title** (600, 20px, 1.25): one per screen, in the Page Header.
- **Section Title** (600, 14–16px): panel titles and form section titles.
- **Body** (400, 14px, 1.5): descriptions and help text.
- **Control** (400, 13px): inputs, buttons, table cells.
- **Label** (600, 12px): field labels and table headers, in Title Case, never uppercase.
- **Caption** (400–600, 12px): badges, hints, pagination.

### Named Rules
**The 12px Floor Rule.** Nothing a user must read is smaller than 12px.

**The Four Weights Rule.** Use only 400, 500, 600, and 700; the font file loads only those. Weights like 800, 850 and 900 are not allowed.

**The Title Case Rule.** Labels, buttons, headers, and menu items use Title Case in plain words ("State Or Province", "Save Branch"). Never all-caps.

## Layout

Every screen follows one anatomy, top to bottom:

1. **Page Header** — title and one-line description on the left; actions on the right: secondary actions first, the one primary action last.
2. **Inline Alert** (optional) — success or error for the whole screen.
3. **Panel** — the main surface. For lists: Filter Bar, then Table (scrolls), then Pagination, all inside one panel.
4. **Side Panel** (optional, 380px) — create or edit a small record next to its list.

- Page padding is 16px top and bottom, 20px left and right (`.page-shell`); the gap between blocks is 12px.
- Spacing follows a 4px grid: 4 / 8 / 12 / 16 / 20 / 24.
- Forms use `.form-grid`: 4 columns by default (`--form-cols`), a 12px row gap and a 16px column gap, with `.span-2`, `.span-3` and `.span-all` for wide fields. Labels sit above fields.
- **Breakpoints:** 1280px+ is the main desktop target. Below 1100px the side panel stacks above the list. Below 1024px the sidebar becomes an off-canvas drawer opened from the header menu button. Below 900px forms drop to 2 columns. Below 640px page descriptions and the breadcrumb parent hide, and header actions wrap onto their own row.
- **Tables** keep a minimum width of 760px and scroll sideways inside their panel on small screens; they never squeeze a column to nothing.
- **Multi-column page layouts** use `.layout-cols-4/-3/-2`, `.layout-main-aside` (main + 340px side, `--aside-width` to change), `.layout-nav-content` (220px section list + content) and `.layout-label-row` (label column + field). They collapse at 1100px, 900px and 640px, so never hand-write a fixed `gridTemplateColumns` for page structure.
- **Counts** (records, vouchers, items) use `formatCount` — whole numbers, never money decimals. Money uses `formatMoney`, other quantities `formatNumber`.
- **Layers** come from tokens: `--z-header` < `--z-dropdown` < `--z-sidebar` < `--z-popover` < `--z-modal` < `--z-toast`. Never write a raw z-index.

### Choosing A Screen Pattern
| Record | Pattern | Reference |
|---|---|---|
| Small master data (up to about 6 fields) | List + Side Panel | Areas |
| Larger master data | List, then a full-page form with actions at the top | Branches |
| Documents (vouchers, invoices, transfers) | Full-page voucher form (below) | — |

## Elevation & 3D Depth

Surfaces and controls embrace a **3D Dimensional Standard**. Rather than stark flat surfaces, elements express physical depth through directional top-to-bottom gradients, 1px specular inner highlights (`inset 0 1px 0`), layered multi-stop ambient drop shadows, and tactile active depression on click.

### Lighting Model & Shadow Vocabulary
- **Directional Light (180° Top-Down):** A virtual key light casts downward. Surfaces have a brighter top edge (`inset 0 1px 0 rgba(255,255,255,0.85)` in Light theme; `rgba(255,255,255,0.06)` in Dark theme) and subtle bottom grounding.
- **Primary 3D Action** (`--shadow-3d-primary`): `0 2px 4px rgba(7,85,233,0.28), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.18)` — gives primary buttons a physical, tactile pill affordance.
- **Secondary 3D Action** (`--shadow-3d-secondary`): `0 1px 3px rgba(15,27,45,0.08), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.06)`.
- **Destructive 3D Action** (`--shadow-3d-danger`): `0 2px 4px rgba(198,40,40,0.28), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)`.
- **Panel & Container Depth** (`--shadow-3d-panel`): `0 2px 6px -1px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.04), inset 0 1px 0 rgba(255,255,255,0.85)` — separates workspaces and tables cleanly from Workspace Ground.
- **Card & Summary Depth** (`--shadow-3d-card`): `0 3px 8px -1px rgba(15,27,45,0.08), 0 1px 3px rgba(15,27,45,0.04), inset 0 1px 0 rgba(255,255,255,0.85)`.
- **Active Compression** (`--shadow-3d-pressed`): `inset 0 2px 4px rgba(0,0,0,0.22)` with `transform: translateY(1px)` on `:active` — delivers satisfying tactile feedback.
- **Overlay** (`--shadow-overlay`): `0 12px 32px rgba(15,27,45,0.14), 0 2px 6px rgba(15,27,45,0.08)` for floating dialogs, dropdowns, and popovers.

### Named Rules
**The 3D Dimensional Affordance Rule.** Interactive controls must communicate their physical state: rest has gentle elevation, hover increases specular brilliance, and `:active` provides a 1px physical push-down (`translateY(1px)`).

**The Directional Lighting Rule.** All gradients must follow a 180° vertical flow (lightest at top, deepest at bottom) simulating natural light. Horizontal or diagonal rainbow gradients are strictly forbidden.

## Shapes

Gently squared: 6px on controls (inputs, buttons, selects, segments), 8px on containers (panels, dialogs, dropdown menus), full pill only on status badges. Borders are 1px everywhere. A 1.5px or 2px border is a leftover to remove.

### Named Rules
**The No Side-Stripe Rule.** No colored left or right border on rows, cards, alerts, or list items. Show selection with Ledger Blue Tint, plus a 1px inset outline where more emphasis is needed.

## Components

Use the shared component; don't restyle it locally. If a variant is missing, add it to `components/ui/`.

### App Shell — `components/shell/`
- `nav-config.ts` is the single navigation tree (sections → links or groups → pages). Add a page there and the sidebar, breadcrumb and active state follow. The active route is the longest matching href.
- `AppSidebar`: navy, 248px, grouped by section; one group open at a time. The active page has a tinted fill and subtle 3D left pip; its group only brightens (one selected row at a time). Collapses to a 64px icon rail (remembered per browser) with tooltips; on tablet and phone it is a drawer.
- `AppHeader`: breadcrumb (group › page), mobile menu button, and the user menu (Appearance: Light / Dark, then Sign Out).

### Page Header — `PageHeader`
- Props: `title`, `description`, `actions`. No icon tiles and no noisy decorative banners.
- The primary action sits at the far right. At most one primary button per header.

### Buttons — `Button` (classes `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`)
- **Shape:** 6px corners, 32px high (`sm` 28px, `lg` 36px), 0 12px padding, 13px/600 label, 16px Tabler icon at stroke 1.8.
- **Primary:** 3D gradient `--grad-primary` with `--shadow-3d-primary`, white text. One per area: Save, Process, New. On `:hover`, brightens gradient. On `:active`, `translateY(1px)` with inset shadow.
- **Secondary:** 3D gradient `--grad-secondary` with `--shadow-3d-secondary` and Rule border. Refresh, Back To List, Print, filters. On `:active`, `translateY(1px)`.
- **Ghost:** flat transparent background, no border. Cancel next to Save, and icon-only row actions (`aria-label` required).
- **Danger:** 3D gradient `--grad-danger` with `--shadow-3d-danger`, white text, always behind a `ConfirmDialog`. On `:active`, `translateY(1px)`.
- **States:** hover enhances specular gradient sheen. Disabled is 50% opacity with no 3D shadow. `loading` shows a spinner and blocks clicks. Focus is a 2px Ledger Blue outline with a 2px offset (global `:focus-visible`).

### Inputs And Fields — `TextField`, `NumericField`, `DateField`, `SelectField`, `SearchableSelect`, `TextareaField`, `CheckboxField`, `SearchField`
- **Style:** 32px, 1px Control Edge border, 6px corners, 13px text, label above in 12px/600 Title Case.
- **Required:** the label ends with a red `*` (built into `FieldLabel`).
- **Focus:** Ledger Blue border plus `--focus-ring`.
- **Read-only / Disabled:** Paper Alt background, muted text.
- **Error:** `aria-invalid="true"` turns the border red; the message goes in an `InlineAlert` or `.form-error`.
- **Amounts and quantities:** `NumericField`, right-aligned, tabular figures, formatted from settings.
- **Selects:** always show the chevron (native: `--select-chevron`; searchable: the Tabler chevron). A list of more than about 15 options uses `SearchableSelect`.
- **Yes/No:** `CheckboxField`. Toggle switches are not used in forms, because a toggle suggests the change applies immediately.

### Tables — class `data-table`
- **Header:** 3D gradient `--grad-table-head`, 12px/600 Ink Secondary, Title Case, sticky, 36px, with a subtle bottom divider.
- **Rows:** 36px, 13px, a Rule Subtle divider, a barely-there zebra, hover tint. `tr.is-selected` uses Ledger Blue Tint.
- **Cells:** `.num` right-aligns with tabular figures (all amounts, quantities, counts). `.cell-strong` is for the record's code or name, `.cell-muted` for secondary columns, and `.cell-actions` for a right-aligned ghost icon button.
- **Missing value:** show "Not Set" in muted text, not "-".
- **Loading / Empty:** `TableMessageRow`. An empty list says what to do next and offers the primary action. A filtered empty list says how to widen the filter.

### Filter Bar — class `filter-bar`
- Order: `SearchField` (grows), then selects, then `SegmentedControl` for status, then Clear (ghost) when filters are active.
- Document lists with many labelled filters (Posted Purchases, Voucher List) use `.filter-grid`: labelled fields that wrap onto a second row, with the first field (search) wider and buttons at natural width. A filter row must never push the page sideways.

### Status Badges — `Badge`
- Pill, 20px, 12px/600: subtle 3D gradient fill (`--grad-badge-*`), top highlight, 1px border: `success` (Active, Posted, Approved), `warning` (Pending, Draft awaiting action), `danger` (Rejected, Voided), `info` (Default, Mode), `neutral` (Inactive, Draft).

### Inline Alert — `InlineAlert`
- Tones: success, danger, warning, info, with an icon. The text names what happened and what to do next ("Enter a Branch Name.", "Branch BR-001 saved."). Pass `onDismiss` for messages the user may close.

### Tabs — `Tabs`
- Underline tabs for switching views of one page (Bank Accounts / Cheque Books). 40px high, 2px Ledger Blue underline on the selected tab, optional count pill; arrow keys move between tabs. Use `SegmentedControl` instead for filters.

### Dialogs — `ConfirmDialog`, classes `.dialog*`
- Only for confirming destructive or irreversible actions, or a short focused task. 440px (`.dialog-lg` 760px), 8px corners, overlay shadow, footer with Cancel then the action. Escape and the backdrop cancel; focus moves in, is trapped, and returns on close.

### Loading
- Tables: `TableMessageRow loading` shows skeleton bars (screen readers still hear the title). Buttons: `loading` keeps the label and shows a spinner. Refetches never blank a table that already has data.

### Sortable Headers — class `.th-sort`
- A button inside the `th`, with `aria-sort` on the `th`; the sort icon turns Ledger Blue when active.

### Side Panel — `SidePanel`
- 380px wide, beside the list, not a modal. Header: title plus a ghost close button. Footer: Cancel (ghost) then the primary action. A form-level error shows at the top of the body.

### Summary Tiles And Analytics — `StatTile`, `StatGrid` (`components/ui/StatTile.tsx`), `ChartCard` (`components/analytics/ProCharts.tsx`)
- One tile everywhere (Dashboard, analytics screens, reports). Compact, about 84px tall, in a `StatGrid` that fits as many 220px+ columns as the width allows (five on a wide screen).
- Tile anatomy: small tone-coloured icon + label (+ a "?" help mark that explains the figure in plain words) / the figure in the code font, tone-coloured, with an optional muted suffix such as "/ 41" / an optional thin progress or part-to-whole bar / one or two short detail lines.
- The tone comes from the meaning: teal for good, amber for needs attention, rose for a problem (for example a loss or a negative balance), blue, violet and slate for neutral figures. The tone washes the tile, edges it, and colours the icon and the figure.
- A tile that leads to a report is a link: the whole tile is clickable, with a chevron after the label.
- Analytics screens and the Dashboard are split into titled sections (`analytics-section-title`).
- Charts sit in a `ChartCard`: title with a "?" explanation, one-line subtitle, a bold one-sentence finding (`headline`), and icon buttons to switch to the table or download it as CSV. Every card has a Table view.
- Columns are drawn as rounded tubes on a light track; only the peak carries a dark value pill. Bars use the vertical light-to-deep gradient from `BarGradientDefs`. One value axis per chart, never two.

### Voucher And Document Forms
- **Top:** Page Header with the document title and number, a status badge next to the title, and actions on the right (New, Print as secondary; Save Draft as secondary; the posting action as primary).
- **Header fields:** one `.form-grid` panel: number (read-only), date, reference, party, and description.
- **Lines:** one panel titled "Lines", with a numbered `data-table`, an input per cell, amount columns `.num`, and Add Line as a secondary button in the panel header. The table must fit its panel at 1280px; drop or narrow columns rather than scrolling sideways.
- **Summary:** bottom-right of the lines panel. Read-only totals are right-aligned (e.g. Debit Total, Credit Total, Difference). Difference turns Danger when not zero.
- Currency, dates and number formats always come from settings (`formatMoney`, `formatDate`, `formatNumber`).

### Screen Migration Checklist
When touching a screen that predates this standard:
1. Replace the local header with `PageHeader`.
2. Wrap content in `.page-shell` and a `.panel`; use `.filter-bar` and `.table-scroll`.
3. Change tables to `data-table`, and delete local `HeaderCell`, `EmptyRow` and `StatusBadge` copies.
4. Use shared fields and `Button` (with standard 3D tokens); delete inline font sizes, weights, colors and radii.
5. Replace `<style>` blocks and hex colors with tokens.
6. Check Light and Dark, and a 1280px width.

## Do's and Don'ts

### Do:
- **Do** build every screen from `PageHeader`, `.panel`, `data-table`, and the shared fields and buttons.
- **Do** use the standard 3D gradient tokens (`--grad-primary`, `--grad-secondary`, `--grad-surface`, etc.) and dimensional shadows (`--shadow-3d-*`) for rich physical affordance.
- **Do** provide physical active tactile depression (`translateY(1px)`) on interactive 3D buttons.
- **Do** right-align every amount, quantity, and count, with tabular figures.
- **Do** mark required fields with `*` and validate before calling the API.
- **Do** write labels, buttons, and headers in Title Case, in plain words a non-native English speaker understands.
- **Do** stick strictly to open-source fonts (Inter and system fallbacks); never introduce licensed font dependencies.
- **Do** take currency, date, timezone, and number formats from settings.
- **Do** give every icon-only button an `aria-label` and a `title`.
- **Do** check every change in both Light and Dark.

### Don't:
- **Don't** use arbitrary, neon, or horizontal novelty gradients; all gradients must adhere to the 180° directional top-down lighting tokens.
- **Don't** require commercial or licensed fonts (e.g. Giorgio Sans); open-source Inter is the single typography standard.
- **Don't** use navy or blue bars as panel or table headers.
- **Don't** use uppercase labels or table headers.
- **Don't** use font sizes below 12px, or weights outside 400–700.
- **Don't** hardcode hex, `rgba()`, pixel radii, or font sizes in components; use tokens.
- **Don't** put colored left or right stripes on rows, cards, or alerts.
- **Don't** use a modal for create/edit of small records; use `SidePanel`.
- **Don't** add pastel stat-card rows ("big number, small label") on list screens; put counts in the filter bar or pagination.
- **Don't** use Unicode glyphs (▼ ✓ ✕) as icons; use Tabler icons at stroke 1.8.
- **Don't** add new themes. Light and Dark only.
