# Component Catalog

Shared building blocks for every screen. They use the design tokens only (no raw colours) and follow
`documents/design/DESIGN_STANDARDS.md`. See them live on the **Design System** page (`/design-system`).

## Layout And Headers

| Component | File | Use |
|---|---|---|
| `PageHeader` | `ui/PageHeader.tsx` | Title, description, help, actions on every list or report screen. |
| `ScreenHeader` | `ui/ScreenHeader.tsx` | Header card with an icon tile for setup screens (Fiscal Years). |
| `DocumentHeader` | `documents/DocumentPage.tsx` | Header for voucher and document entry screens. |
| `ModuleTabs` | `shell/ModuleTabs.tsx` | Pages of one menu group as tabs (added by the layout; do not render by hand). |
| `Card` | `ui/Card.tsx` | Flat surface with an optional title, help, and actions. |
| `Toolbar` | `ui/Toolbar.tsx` | The one filter bar under the header. |

```tsx
<PageHeader title="Customers" description="People and companies you sell to." help={<p>…</p>}
  actions={<Button variant="primary" icon={<IconPlus size={16} />}>New Customer</Button>} />
<Card title="Totals" help="What the totals include." actions={<IconButton icon={<IconRefresh size={16} />} label="Refresh" />}>…</Card>
<Toolbar end={<Button variant="ghost">Clear Filters</Button>}>…filters…</Toolbar>
```

## Actions And Help

| Component | File | Use |
|---|---|---|
| `Button` | `ui/Button.tsx` | `primary` (one per area), `secondary`, `ghost`, `danger`. |
| `IconButton` | `ui/IconButton.tsx` | Icon-only button; `label` becomes the tooltip and the accessible name. |
| `HelpButton` | `ui/HelpButton.tsx` | ⓘ button that opens a short plain-words help window. Every screen, chart, and tile has one. |

```tsx
<IconButton icon={<IconPrinter size={16} />} label="Print Voucher" onClick={print} />
<HelpButton title="Net Sales">Total of posted sales after discount and tax.</HelpButton>
```

## Forms

`ui/inputs.ts` exports the fields under the standard names (implemented in `ui/FormFields.tsx`):
`Input`, `NumberInput`, `DateInput`, `Select`, `Textarea`, `Checkbox`, plus `SearchableSelect`.
Label above the field, `required` shows `*`, `hint` and `error` are linked for screen readers.

```tsx
<Input label="Customer Name" required value={name} onChange={setName} error={nameError} />
<NumberInput label="Amount" value={amount} onChange={setAmount} decimalPlaces={2} />
```

## Status And Feedback

| Component | File | Use |
|---|---|---|
| `StatusChip` | `ui/StatusChip.tsx` | ERP status with the standard colours (Draft, Pending, Posted/Paid, Overdue/Voided, Open, Flagged). |
| `Badge` | `ui/Badge.tsx` | Small label (account types, kinds of place). |
| `InlineAlert` | `ui/InlineAlert.tsx` | Message on the page: success, warning, danger, info. |
| `Toast` / `useToast` | `ui/Toast.tsx` | Short corner message after an action. Errors stay until closed. |
| `EmptyState` | `ui/EmptyState.tsx` | Nothing here yet, and what to do next. |
| `Skeleton` | `ui/Skeleton.tsx` | Placeholder while loading. |

```tsx
<StatusChip status={voucher.status} />
const toast = useToast(); toast(`${number} posted.`, 'success');
```

## Dialogs

| Component | File | Use |
|---|---|---|
| `Modal` | `ui/Modal.tsx` | General dialog (title, content, footer). |
| `FormDialog` | `ui/FormDialog.tsx` | Create or edit form in a dialog, full-width Save and Cancel. |
| `ConfirmDialog` | `ui/ConfirmDialog.tsx` | Yes/No for risky actions, optional typed confirmation. |
| `Drawer` | `ui/Drawer.tsx` | Panel from the right for details or a short form. |

All trap Tab inside, close on Escape (unless saving), and return focus to the opener.

## Data

| Component | File | Use |
|---|---|---|
| `DataTable` | `ui/DataTable.tsx` | Sortable headers, sticky header, numbers right-aligned in JetBrains Mono, totals row. |
| `StatTile` / `StatGrid` | `ui/StatTile.tsx` | KPI tile: label, mono value, change, bar, help. |
| `SummaryCard` | `ui/SummaryCard.tsx` | Larger summary card at the top of a setup screen. |
| `Tabs`, `SegmentedControl` | `ui/` | Switch views; filter a list. |
| `PaginationBar` | `ui/PaginationBar.tsx` | Page through long lists. |

```tsx
<DataTable caption="Invoices" rowKey={row => row.id} rows={rows}
  columns={[{ key: 'number', header: 'Invoice No.', sortable: true }, { key: 'amount', header: 'Amount', numeric: true, render: row => money(row.amount) }]}
  totals={{ amount: money(total) }} />
<StatTile label="Net Sales" tone="blue" icon={<IconReceipt2 />} value={money(net)} help="Total of posted sales." />
```

## Charts (`analytics/ProCharts.tsx`, colours from `hooks/useChartTheme.ts`)

| Component | Use |
|---|---|
| `ChartCard` | Title, help, one-sentence finding, Table view and CSV download. Every chart sits in one. |
| `MonthlyColumnChart` | Trend by month with a dashed orange average or target line. |
| `StackedMonthlyChart` | Two or three parts of each month. |
| `BridgeChart` | Gross to net: what adds and what takes away. |
| `RankedBars` | Compare categories, largest first, with share of the total. |
| `DonutChart` | Part of a whole, five slices at most. |

Never hard-code a chart colour: use `useChartTheme()` (`series.blue`, `series.teal`, `status.danger`, `ladder[…]`).
