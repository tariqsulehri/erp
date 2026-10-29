# Frontend Best Practices

These rules apply to frontend screens, components, forms, validation, layout, and user messages.

## Text And Labels

- Use simple labels that business staff can understand.
- Use Title Case for labels, headings, table columns, tabs, and field titles.
- Do not force normal labels to all uppercase.
- Keep common abbreviations uppercase, such as SKU, UOM, PO, SO, VAT, and EAN.
- Avoid technical words unless the business already uses them.
- Keep button text short and action-based.
- Use the same label everywhere for the same field.

Examples:

- Use `Item Name`, not `Inventory Entity Name`.
- Use `Sales Price`, not `Revenue Rate`.
- Use `Purchase Price`, not `Procurement Cost`.
- Use `Stock On Hand`, not `Quantity Balance`.

## Component Architecture

New components and modules must follow the Purchase module structure unless there is a clear reason not to.

- Page files should orchestrate screen flow and state.
- Focused child components should own UI sections such as Toolbar, Header Form, Line Entry, Line Table, Filters, Summary, Detail Panel, Analytics Charts, and Print Preview.
- Shared form controls should be reused from shared UI files.
- Hooks should own state workflows, data shaping, derived totals, debounced filters, and support-data mapping.
- Helper files should own validation, payload building, and business calculations.
- API calls should go through `src/lib/api`.
- Print preview UI and printable HTML/PDF logic should be separate.
- Avoid putting form controls, list views, analytics, print previews, validation helpers, formatting helpers, and API calls in one component file.

## Shared Form Controls

- Common field controls must use shared reusable components instead of repeated raw inputs.
- Shared field controls should include text, numeric, date, select, searchable select, checkbox, textarea, status, and read-only display fields.
- Numeric field components must own numeric typing cleanup, right alignment, tabular digits, and select-on-focus behavior.
- Date field components must own consistent compact sizing and use configured display rules where a browser date control is not used.
- Select and list controls must show a chevron or clear selectable state.
- All dropdowns for ERP master data and filters should be searchable.
- Prefer dropdowns for configurable master data such as category, brand, size, UOM, warehouse, location, account, supplier, and customer.

## Forms

- Group fields in the same order users think about the work.
- Show required fields clearly with `*`.
- Keep optional advanced fields in separate sections.
- Do not show database field names to users.
- Account Code inputs and displays must use the 10-digit Account Code format.
- Account Code examples should use `MM GG SS PPPP`, such as `0101100001`.
- New records should show clear required fields first.
- Advanced accounting, tax, warehouse, approval, and attachment fields should be grouped separately.
- Master-data list views and input forms should be separate when the form is detailed.
- Detailed master-data input forms should fill the available workspace and should not look like a smaller screen or modal inside the page.

## Validation And Messages

- Validate required fields before calling the API.
- Validate simple formats in the browser, such as email, date, number, and percentage.
- Validate numeric ranges before submit.
- Validate related fields together.
- Show validation messages close to the field or section they belong to.
- Use clear messages that explain how to fix the problem.
- Do not rely only on frontend validation; backend must validate again.
- No API, lookup, refresh, print, save, process, or delete error should fail silently.
- Prevent double submit while a save request is running.

Good messages:

- `Item Name is required.`
- `Sales Price cannot be negative.`
- `Maximum Stock Level must be greater than Minimum Stock Level.`
- `Please select a Unit of Measure.`
- `Discount Percent cannot be greater than 100.`

Avoid messages:

- `Invalid input.`
- `Validation failed.`
- `Bad request.`
- `Field error.`

## Money, Quantity, Date, And Currency

- Use shared settings and formatting helpers for date, number, and currency display.
- Do not hard-code currency text such as `$` or `Rs`.
- Do not hard-code date locales or display formats inside screens or components.
- Do not build currency strings manually in screens, tables, summaries, buttons, print formats, or reports.
- Right align all amount, money, quantity, debit, credit, balance, and total values.
- Show thousand separators for money and quantity values when the field is not actively being typed.
- Numeric inputs should use compact widths based on expected value length.
- Do not allow negative values unless the business case needs them.
- Do not allow zero transaction line amounts when the line is being saved or posted.
- Use percentage fields for discounts and tax rates.
- Use quantity fields with the selected UOM visible.

## Theme And Layout

- Use Mantine as the main frontend UI and theming library.
- Use Tabler Icons as the standard icon library.
- Define colors, spacing, radius, shadows, font sizes, and shared component defaults in the theme layer.
- Border radius should be controlled from shared theme tokens.
- Buttons may use the shared button radius token. Override individual buttons only for a clear one-off reason.
- Keep custom CSS aligned with shared theme variables.
- CSS is the single source of truth for styles, surface gradients, tile tokens, and depth shadows (`design-tokens.css` and `globals.css`). Components must consume these tokens and classes rather than inventing ad-hoc styles.
- Maintain functional invariance during visual refactoring: never touch, alter, or break component business logic, validation rules, event handlers, props contracts, data fetching, state workflows, or calculations when working on look and feel, themes, or styling. Visual enhancements must remain strictly presentation-only.
- **Chart Standards**: Horizontal ranked bars (`RankedBars`) use a standard track height of 14px (with pill rounding and 3D specular highlight) for solid visibility and tactile depth. Donut charts (`DonutChart`) use a compact 130px diameter with a 72px central metric core and inline legend (max-width: 480px) to prevent awkward vertical dead space. Charts maintain meaningful, presentable content widths without excessive stretching.
- Use simple, clear ERP layouts instead of decorative marketing-style screens.
- Do not hand-draw common icons when a matching Tabler icon exists.
- Avoid playful theme names, neon accents, and loud palettes for ERP workspaces.

## Tables And Lists

- Use readable column names.
- Show status clearly, such as `Active`, `Inactive`, `Blocked`, `Draft`, or `Posted`.
- Provide search and filters for large lists.
- **Searchable Dropdown Filter Standard**: Filter controls across list toolbars and table headers (Status, Direction, Business Type, Warehouse, Category, UOM Type, etc.) must always use dropdowns with search (`SearchableSelect`) rather than wide segmented button rows (`SegmentedControl`) or plain `<select>` elements. This prevents horizontal clutter and wrapping, fits neatly on all screen sizes, and provides fast search across choices.
- Large transaction and master-data lists must use backend pagination.
- Do not load all records into the browser for large lists.
- Default page size should normally be 50 records.
- Allow page sizes such as 25, 50, 100, and 200 only when the screen remains responsive.
- Show clear pagination controls: First, Previous, page number, Next, Last, page size, and total record count when available.
- Keep sorting stable across pages, such as document date descending plus document number descending.
- Reset the list to page 1 when filters change.
- Search boxes on large lists should debounce backend calls by about 300 to 500 milliseconds.
- Keep actions predictable: View, Edit, Print, Export, Activate, Deactivate.

## Transaction Screens

These rules apply to vouchers, sales, purchases, payments, receipts, stock documents, and future transaction screens.

- Use the Purchase Voucher screen as the reference pattern when the option applies.
- Include New Entry, Posted/History List, Search, backend-powered filters, Detail View, Print Preview, Print, and Download PDF where the business flow supports them.
- Common filters should include party/account, date range, document status, payment type, warehouse/location, reference number, and amount range when those fields exist.
- Do not show a filter or action unless it is connected to real frontend behavior and backend support.
- Posted/history lists should use backend filters and pagination, not browser-side filtering.
- Posted/history lists should load header summary rows first. Load line items only for detail, print preview, or export.
- Posted transaction detail views should be read-only by default.
- If a posted document needs correction, show correction actions such as Reverse, Void, Return, Debit Note, Credit Note, or Adjustment instead of normal edit.
- Print and PDF output should use settings-based date, number, and currency formatting.
- Print formats should include document number, date, party/account details, line details, totals, prepared by, checked by, approved by, and signature spaces.
- Approval Status should be shown as a badge or workflow area, not mixed into normal editable fields.
- Attachment controls should show uploaded file count or status clearly.
- Duplicate reference warnings should be visible before saving when the same party/account, date, reference, and amount already exist.

## Voucher Layout

- Main action buttons such as New, Save, Process, Print, Refresh, and Cancel should stay in the top action bar.
- Voucher status should be shown as a clear badge or status area, not as a disabled input mixed with editable fields.
- Use consistent compact font sizes for labels, inputs, buttons, table headers, table rows, validation messages, and summary values.
- Voucher line tables should avoid wasted space.
- Keep short columns narrow, such as No., date, type, and delete columns.
- Give more width to Account, Item, and Description columns.
- Voucher screens should avoid unnecessary vertical scrolling and show the maximum practical number of line items.
- Voucher page, header, and summary areas should not scroll vertically.
- Only the line-items area should scroll vertically when rows exceed the defined available height.
- Voucher line-items areas should not scroll horizontally; adjust column widths and visible columns to fit the workspace.
- Voucher summary totals should stay visible where practical and use bordered, right-aligned values.
- Voucher messages should be visible but not oversized.

## Customer And Supplier Screens

- Use `Party Type` and `Main Role` labels when a party can work as both customer and supplier.
- The base role should be shown as the default role.
- The second role should be a checkbox such as `Also Works As Supplier` or `Also Works As Customer`.
- Business Type should use a segmented choice when there are only a few fixed choices, defaulting to `Company`.
- Show the accounting link as `Linked Account`.
- Default status should be `Active`.
- Let users change status to `Inactive` only when the party should not be used in new transactions.
- Currency should be selected from a dropdown, not typed as free text.
- Payment Terms should be a numeric day input when users may need any day value.

## Inventory UI

- Item setup fields that users can manage must use configurable master data from the backend.
- Category, Item Group, Product Type, Brand, Item Size, Origin, UOM, Warehouse, and Location should use searchable dropdowns.
- Brand should be selected from the Brand table, not typed as free text in normal item entry.
- If quick-create is allowed for master data, use an approved setup flow and refresh the dropdown after saving.
- Product Catalogue filters should use the same configurable master data as item entry forms.
- Business-specific extra item details should be shown through configurable item attributes, not hard-coded one-off controls.
- Branch and Warehouse should be separate selections when a transaction needs branch-wise stock or reporting.
- Warehouse dropdowns should filter to Warehouses attached to the selected Branch when Branch is selected.
- Stock Transfer forms should clearly show `From Warehouse`, `From Location`, `To Warehouse`, and `To Location`.
- Stock Transfer forms must prevent users from posting when source and destination are the same or when line quantity is zero.

## Overlapping Slide-Over Drawers And Modals

- Detail and inspection views for vouchers, transactions, stock transfers, adjustments, and records must use the standard elevated slide-over `Drawer` overlay (`src/components/ui/Drawer.tsx`), floating over the grid with a backdrop scrim (`var(--color-scrim)`).
- Never squeeze list tables into cramped side-by-side columns (`.split-view.has-side` anti-pattern). The underlying document list table must stay 100% wide and completely readable.
- Default drawer size for itemized transaction/voucher records is `size="lg"` (`min(900px, 96vw)`).
- Line item tables inside the drawer must provide generous columns for item codes, full un-truncated descriptions, prices, quantities, and balances.
- All modal dialogs and slide-overs must consume standard components (`Modal.tsx`, `Drawer.tsx`, `ConfirmDialog.tsx`) with standard size tokens (`sm`, `md`, `lg`, `xl`), accessible focus management (`useDialogFocus`), backdrop click dismiss, and `Escape` key handling.
- **Document Detail Drawer Anatomy & Type Heading Rule:**
  All current and upcoming document detail views (Invoices, Transfers, Adjustments, Vouchers, Returns) must strictly follow the unified `DocumentDetailPanel` pattern:
  1. **Top Heading Describes Type:** The drawer title must clearly describe the document type (e.g. `Voucher Details`, `Stock Transfer Details`, `Stock Adjustment Details`, `Opening Stock Details`, `Purchase Invoice Details`, `Sales Invoice Details`, `Purchase Return Details`, `Sale Return Details`), NEVER just the bare document ID.
  2. **Top-Right Header Actions:** Edit Draft icon button (when draft & editable), Print icon button, and Close button.
  3. **Metadata Grid (`DetailFields`):** Starts with Document No., Date, Document Type, and Status badge (`StatusChip`), followed by parties, locations, references, posted/cancelled timestamps, and description.
  4. **Clean Line Items Table (`DetailLinesTable`):** Rendered with standard columns (`No.`, Code, Description, UOM, Qty, Price, Amount).
  5. **Right-Aligned Totals (`DetailTotals`):** Totals summary neatly aligned to the right.
  6. **Lifecycle Guidance Note (`DetailNote`):** Explains whether the document is a Draft, Posted, or Reversed/Cancelled.
  7. **Bottom Action Footer (`DetailActions`):** Action buttons (Post, Edit Draft, Reverse, Cancel) must be rendered at the bottom of the drawer, never placed as raw top banners under the header.

## Screen-Fit And Scroll Preservation

- Never clip page content with `overflow: hidden` on outer page wrappers or `.page-shell` without an inner scrollable container.
- If content exceeds the screen height, vertical scrolling (`overflow-y: auto`) must always remain accessible so cards, charts, and metrics are never trimmed off or trapped below the viewport fold.
- Overview dashboards and analytics screens must be designed to fit common laptop viewports (768px–900px) cleanly on a single screen without unnecessary vertical sprawl by keeping padding compact (`8px`–`12px`), tile heights sleek (~64px–72px), and plot heights proportional (~180px–190px).

## Accessibility

- Use labels for every input.
- Keep keyboard navigation usable.
- Use sufficient contrast.
- Do not rely on color alone to communicate status.
