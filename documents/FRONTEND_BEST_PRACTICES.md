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
- Use simple, clear ERP layouts instead of decorative marketing-style screens.
- Do not hand-draw common icons when a matching Tabler icon exists.
- Avoid playful theme names, neon accents, and loud palettes for ERP workspaces.

## Tables And Lists

- Use readable column names.
- Show status clearly, such as `Active`, `Inactive`, `Blocked`, `Draft`, or `Posted`.
- Provide search and filters for large lists.
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

## Accessibility

- Use labels for every input.
- Keep keyboard navigation usable.
- Use sufficient contrast.
- Do not rely on color alone to communicate status.
