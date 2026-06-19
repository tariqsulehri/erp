# Frontend Best Practices

## User-Facing Text

- Use simple labels that business staff can understand.
- Use Title Case for labels, headings, table columns, tabs, and field titles.
- Do not force normal labels to all uppercase. Keep common business abbreviations uppercase, such as SKU, UOM, PO, SO, VAT, and EAN.
- Avoid technical words unless the business already uses them.
- Keep button text short and action-based.
- Use the same label everywhere for the same field.

Examples:

- Use `Item Name`, not `Inventory Entity Name`.
- Use `Sales Price`, not `Revenue Rate`.
- Use `Purchase Price`, not `Procurement Cost`.
- Use `Stock On Hand`, not `Quantity Balance`.

## Forms

- Group fields in the same order users think about the work.
- Show required fields clearly.
- Keep optional advanced fields in separate sections.
- Do not show database field names to users.
- Prefer dropdowns for configurable master data such as category, brand, size, UOM, warehouse, and location.
- All dropdowns for ERP master data and filters should be searchable.

## Configurable Item Fields

- Item setup fields that users can manage must use configurable master data from the backend.
- Category, Item Group, Product Type, Brand, Item Size, Origin, UOM, Warehouse, and Location should use searchable dropdowns.
- Brand should be selected from the Brand table, not typed as free text in normal item entry.
- If quick-create is allowed for master data, use an approved setup flow and refresh the dropdown after saving.
- Product Catalogue filters should use the same configurable master data as item entry forms.
- Business-specific extra item details should be shown through configurable item attributes, not hard-coded one-off controls.

## UI Library and Theme

- Use Mantine as the main frontend UI and theming library.
- Use Tabler Icons as the standard icon library because it pairs well with Mantine and gives a consistent professional stroke style.
- Define colors, spacing, radius, shadows, font sizes, and shared component defaults in the theme layer.
- Border radius should be controlled from shared theme tokens, not hard-coded inside voucher or form components.
- Regular fields, tables, and panels should stay crisp; buttons may use the shared button radius token for a slightly rounded clickable shape.
- Button radius must use the shared button radius token by default. Change an individual button radius only when there is a clear one-off design reason.
- Do not add another large component library unless there is a clear project-level reason.
- Keep custom CSS aligned with the shared theme variables.
- Use simple, clear ERP layouts instead of decorative marketing-style screens.
- Do not hand-draw common icons with inline SVG when a matching Tabler icon exists.
- Theme names and palettes should feel professional and work-focused. Avoid playful theme names, neon accents, and loud multi-color combinations for ERP workspaces.
- Theme selector controls should be compact, clear, and consistent with common settings/account controls used in professional web applications.

## Configuration And Hardcoding Rules

- Date format, currency symbol, currency code, locale, decimal places, thousand separator, and decimal separator must come from one shared formatting/configuration module.
- Do not hard-code currency text such as `Rs`, date locales such as `en-PK`, or date display formats inside screens or components.
- Form control sizes, button sizes, font sizes, spacing, border radius, shadows, table colors, and status colors should use shared theme tokens or shared component styles.
- Voucher-specific layout values, such as table column widths or default blank row count, may live in the voucher component while the voucher is being finalized. When reused by another voucher, move them to a shared voucher configuration file.
- User-facing business labels can stay inside the component while the screen is being designed. Repeated labels, status names, and messages should move to shared constants when they appear in more than one place.
- If a specific component needs an exception from shared configuration, keep the override local, small, and clearly limited to that component.

## Frontend Validation Rules

- Validate required fields before calling the API.
- Validate simple formats in the browser, such as email, date, number, and percentage.
- Validate numeric ranges before submit.
- Validate related fields together.
- Show validation messages next to the field.
- Field validation messages should appear close to the field or section they belong to.
- Use clear messages that explain how to fix the problem.
- Do not rely only on frontend validation; backend must validate again.

Good messages:

- `Item Name is required.`
- `Sales Price cannot be negative.`
- `Maximum Stock Level must be greater than Minimum Stock Level.`
- `Please select a Unit of Measure.`
- `Reorder Level should be between Minimum Stock Level and Maximum Stock Level.`
- `Discount Percent cannot be greater than 100.`

Avoid messages:

- `Invalid input.`
- `Validation failed.`
- `Bad request.`
- `Field error.`

## Money, Quantity, and Percent Fields

- Use consistent decimal formatting.
- Show thousand separators for money and quantity values when the field is not actively being typed.
- Right align numeric inputs and numeric table cells.
- Right align all amount, money, quantity, debit, credit, balance, and total values in inputs, tables, and summaries.
- Do not allow negative values unless the business case needs them.
- Do not allow zero values for transaction line amounts when the line is being saved or posted.
- Use percentage fields for discounts and tax rates.
- Use quantity fields with the selected UOM visible.
- Keep calculations visible when they affect user decisions.
- Numeric inputs must restrict typing to valid numeric characters before calling the backend.

## Tables and Lists

- Use readable column names.
- Show status clearly, such as `Active`, `Inactive`, `Blocked`, `Draft`, or `Posted`.
- Provide search and filters for large lists.
- Keep actions predictable: View, Edit, Print, Export, Activate, Deactivate.

## API Usage

- Keep API calls in clear service/hooks layers.
- Show loading states while saving or loading.
- Show friendly error messages from backend errors.
- No API, lookup, refresh, print, save, process, or delete error should fail silently. Every failed user action must show a clear message.
- Do not hide save failures.
- If a two-step action partly succeeds, explain the exact result. Example: `Voucher saved as Draft, but could not be posted.`
- Prevent double submit while a save request is running.
- Do not let the frontend decide final permissions or company access.
- Do not assume frontend validation is enough.

## ERP Form Rules

- New records should show clear required fields first.
- Advanced accounting, tax, and warehouse fields can be grouped separately.
- Voucher and transaction screens should keep main action buttons such as New, Save, Process, Print, Refresh, and Cancel in the top action bar.
- Voucher screens should use consistent compact font sizes for labels, inputs, buttons, table headers, table rows, validation messages, and summary values.
- Voucher status should be shown as a clear status badge or status area, not as a normal disabled input mixed with editable fields.
- Voucher line tables should avoid wasted space. Keep short columns narrow, such as No., date, type, and delete columns.
- Voucher line tables should give more width to Account and Description columns.
- Voucher screens should avoid unnecessary vertical scrolling and show the maximum practical number of line items on one screen.
- Voucher page, header, and summary areas should not scroll vertically. Only the line-items area should scroll vertically when rows exceed the defined available height.
- Voucher line-items areas should not scroll horizontally. Adjust column widths, labels, and visible columns so the table fits the voucher workspace.
- Voucher summary totals should stay visible on the screen where practical and should use bordered, right-aligned values.
- Voucher summary areas should use a consistent footer layout across voucher types.
- Voucher messages should be visible but not oversized. Use normal-weight text unless the message is critical.
- Use dropdowns for master data.
- Use searchable dropdowns for master data and filters by default.
- Use status labels users understand, such as `Active`, `Inactive`, `Blocked`, `Draft`, and `Posted`.
- Disable editing for posted documents unless the workflow explicitly allows correction documents.

## Transaction Module Layout

These rules apply to vouchers, sales, purchases, payments, receipts, stock documents, and future transaction screens.

- Keep a consistent space in transaction screens for workflow controls such as Approval Status, Attachments, Print, and document status.
- Keep a consistent space for document support fields such as Reference Number, Project, Cost Center, Department, and Auto Reverse Date when the module uses them.
- Do not show editable fields for Project, Cost Center, Attachment, Auto Reverse Date, or Approval unless the backend saves and validates them.
- Posted documents must open in read-only mode by default.
- If a posted document needs correction, show correction actions such as Reverse, Void, Return, Debit Note, Credit Note, or Adjustment instead of normal edit.
- Print buttons should produce a professional print format with document number, date, party/account details, line details, totals, prepared by, checked by, approved by, and signature spaces.
- Attachment controls should show uploaded file count or status clearly.
- Approval Status should be shown as a badge or workflow area, not mixed into normal editable fields.
- Auto Reverse Date should only be editable for voucher types that support reversing entries.
- Duplicate reference warnings should be visible before saving when the same party/account, date, reference, and amount already exist.

## Accessibility

- Use labels for every input.
- Keep keyboard navigation usable.
- Use sufficient contrast.
- Do not rely on color alone to communicate status.
