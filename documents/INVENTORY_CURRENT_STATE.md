# Inventory And Warehousing — Current State

This document records how inventory and warehousing are defined and how stock moves in the code today, followed by known deficiencies and the planned next moves. It complements the design rules in `INVENTORY_SCHEMA.md`, `INVENTORY_TABLES.md`, `DATABASE_DESIGN_RULES.md`, and `ACCOUNTING_POSTING_RULES.md`. Where this file and those rules disagree, the rules describe the target and this file describes reality.

Snapshot date: 2026-09-30, branch `feature/inventory-professional`. Line numbers drift; search by function name if a reference is off.

**Update 2026-10-28 (branch `feature/document-drafts`):**

- **D1 fixed:** Stock Adjustment Save And Post now runs in one transaction.
- **F1 fixed:** Stock Transfer and Stock Adjustment lists have a Status filter (Posted, Draft, Cancelled). Drafts can be opened, changed, posted, or cancelled with a reason.
- **New columns:** `voided_by_id`, `voided_at` and `void_reason` on `stock_transfers` and `stock_adjustments`. A cancelled Draft has status `Voided`.
- **Same draft workflow for trade documents:** Purchases, Sales, Sale Returns and Purchase Returns now have it too, and their Save And Post also runs in one transaction.
- **D6 fixed (branch `feature/stock-reversal`):** posted Stock Transfers and Stock Adjustments can be reversed (`POST /:id/reverse`, permission `stock.reverse`: Admin, Top Management, Manager).
  - Each line goes back at its exact posted cost, on a Reversal Date in an open period.
  - An adjustment also gets a Reversal Voucher (RV) that mirrors its SA voucher.
  - The document becomes `Voided` with a posted date, shown as Reversed.
  - The reversal is refused when the place no longer holds the stock or value to give back.
- **Opening stock entry (branch `feature/opening-stock`):** Inventory → Opening Stock.
  - Opening Stock is a kind of stock adjustment (`document_kind = 'Opening Stock'`), numbered `OS-YYYY-NNNN`.
  - It is accepted once per item per Branch or Warehouse: only when the item has no stock history there.
  - Posting writes `OPENING_BALANCE` movements and an `OS` voucher: Dr Inventory, Cr the Opening Balance account (Settings → Posting Accounts; default Opening Balance Equity `0302100301`).

---

## 1. Definition

### 1.1 Master Data

| Table | Prisma model | Purpose | Unique keys |
|---|---|---|---|
| `inventory_categories` | `InventoryCategory` | Category tree (`parentId`, `level`, `path`) | `[companyId, code]` |
| `inventory_item_groups`, `product_types`, `brands`, `item_sizes`, `origins` | `InventoryItemGroup`, `ProductType`, `Brand`, `ItemSize`, `Origin` | Simple lookups | `[companyId, code]` |
| `inventory_units_of_measure` | `UnitOfMeasure` | Units | `[companyId, code]`, `[companyId, shortName]` |
| `inventory_unit_conversions` | `UnitConversion` | `fromUnit → toUnit × factor` (not used by any logic yet) | `[companyId, fromUnitId, toUnitId]` |
| `inventory_items` | `InventoryItem` | Item master: codes, lookups, 6 unit links, kind, valuation method, tracking method, flags, prices, min/max/reorder levels, default warehouse/location | `[companyId, itemCode]`, `[companyId, sku]` |
| `inventory_item_prices`, `_barcodes`, `_images`, `_attributes` | `ItemPrice`, `ItemBarcode`, `ItemImage`, `ItemAttribute` | Item children (cascade delete) | barcode: `[companyId, barcode]` |

### 1.2 Warehouses And Locations

| Table | Model | Key fields |
|---|---|---|
| `inventory_warehouses` | `Warehouse` | `branchId` (optional, must be an active branch), `isDefault`, `useLocations`, address |
| `inventory_warehouse_locations` | `WarehouseLocation` | `warehouseId`, `code`, `isDefault` — single level, no bins or hierarchy |

Rules enforced in `backend/src/modules/inventory/warehouse.service.ts`:

- Exactly one default warehouse per company; the first warehouse becomes default automatically. The same applies to the default location inside a warehouse.
- A default warehouse or location cannot be made inactive.
- A warehouse or location holding stock cannot be made inactive.
- `useLocations` cannot be switched while the warehouse holds stock.
- Branch stock is the sum of its warehouses. Stock is never stored on the branch or the item.

### 1.3 Stock Tables

| Table | Model | Role |
|---|---|---|
| `inventory_stock_movements` | `StockMovement` | **Source of truth.** One row per stock change: `movementKind`, `sourceKind`, `sourceDocumentId/Number`, `quantityIn`, `quantityOut`, `unitCost`, `totalCost`, `stockAfterMovement`, `valuationMethod` |
| `inventory_stock_balances` | `StockBalance` | **Snapshot only.** Per item + warehouse + location: `stockOnHand`, `reservedStock`, `availableStock`, `averageCost`, `totalStockValue` |

`StockBalance` is unique on `[companyId, itemId, warehouseId, locationId]`. Because PostgreSQL treats NULLs as distinct, a partial unique index `inventory_stock_balances_no_location_key ... WHERE location_id IS NULL` exists in `migrations/20260619190000_add_inventory_schema/migration.sql`. It is **not** declared in `schema.prisma`.

All quantities and costs are `Decimal(18,4)`.

### 1.4 Stock Documents

| Table | Model | Notes |
|---|---|---|
| `stock_transfers` / `stock_transfer_lines` | `StockTransfer`, `StockTransferLine` | From/to warehouse + location, `status` text (`Draft`, `Posted`, `Voided` via SQL CHECK), totals, `postedById/At`. No accounting voucher. |
| `stock_adjustments` / `stock_adjustment_lines` | `StockAdjustment`, `StockAdjustmentLine` | One warehouse + location, `reason`, `accountingVoucherId`, line `adjustmentType` (`Increase` / `Decrease` via SQL CHECK) |
| `stock_adjustment_settings` | `StockAdjustmentSettings` | One row per company: default inventory, gain, and loss account IDs |

Warehouse/location/item foreign keys on these tables exist in SQL migrations but are not declared as Prisma relations.

### 1.5 Enums

- `StockMovementKind`: `OPENING_BALANCE`, `PURCHASE_RECEIPT`, `PURCHASE_RETURN`, `SALES_DELIVERY`, `SALES_RETURN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `PRODUCTION_ISSUE`, `PRODUCTION_RECEIPT`
- `StockSourceKind`: `OPENING_BALANCE`, `PURCHASE_ORDER`, `PURCHASE_INVOICE`, `GOODS_RECEIPT`, `SALES_ORDER`, `SALES_INVOICE`, `DELIVERY_NOTE`, `SALES_RETURN`, `PURCHASE_RETURN`, `STOCK_ADJUSTMENT`, `STOCK_TRANSFER`, `PRODUCTION_ORDER`, `MANUAL_ENTRY`
- `StockValuationMethod`: `FIFO`, `WEIGHTED_AVERAGE`, `STANDARD_COST`, `SPECIFIC_IDENTIFICATION` — only `WEIGHTED_AVERAGE` is implemented
- `StockTrackingMethod`: `NONE`, `BATCH`, `SERIAL`, `BATCH_AND_SERIAL` — only `NONE` is implemented
- `InventoryItemKind`, `ItemPriceKind` — descriptive only

---

## 2. Stock Movement

### 2.1 Common Posting Pattern

Every document that changes stock follows the same steps inside one database transaction (raw SQL):

1. Lock the document header `FOR UPDATE` and require `status = 'Draft'`.
2. Check the posting date is in an open fiscal period.
3. Lock the affected `inventory_stock_balances` rows `FOR UPDATE` (insert missing rows first where stock comes in).
4. For stock going out, reject the line if `stock_on_hand < quantity`. **Negative stock is never allowed.**
5. Update the balance (quantity, average cost, value) and insert one `inventory_stock_movements` row per line and direction.
6. Create the accounting voucher where the document has GL impact.
7. Set the header to `Posted` with `posted_by_id` and `posted_at`.

Drafts never touch balances or movements.

### 2.2 Costing — Weighted Average

- **Stock in** (purchase, sale return, adjustment increase, transfer in):
  `new_avg = (old_value + in_value) / (old_qty + in_qty)`
- **Stock out** (sale, purchase return, adjustment decrease, transfer out): valued at the current `average_cost`. When a line takes all remaining stock, it takes the full remaining value so no residue is left. Value is clamped at ≥ 0.
- Every movement row stores `valuation_method = WEIGHTED_AVERAGE`.

### 2.3 Movement Map

| Document | Service / function | Movement kind | Source kind | Voucher | GL entry |
|---|---|---|---|---|---|
| Opening balance | `prisma/seed-inventory.ts` (seed only) | `OPENING_BALANCE` | `OPENING_BALANCE` | — | — |
| Purchase invoice | `purchases/purchase-post.service.ts` → `postStockLine` | `PURCHASE_RECEIPT` | `PURCHASE_INVOICE` | `PI` | Dr Inventory, VAT, charges / Cr Discount, Supplier or Cash |
| Purchase return | `purchase-returns/purchase-return-post.service.ts` → `postStockLine` | `PURCHASE_RETURN` | `PURCHASE_RETURN` | `PR` | Reverse of purchase |
| Sale invoice | `sales/sale-post.service.ts` → `postStockLine` | `SALES_DELIVERY` | `SALES_INVOICE` | `SI` | Revenue entry + Dr Cost Of Goods Sold / Cr Inventory |
| Sale return | `sale-returns/sale-return-post.service.ts` → `postStockLine` | `SALES_RETURN` | `SALES_RETURN` | `SR` | Reverse of sale, including cost |
| Stock adjustment | `stock-adjustments/stock-adjustment.service.ts` → `postLine` | `ADJUSTMENT_IN` / `ADJUSTMENT_OUT` | `STOCK_ADJUSTMENT` | `SA` (created Posted/Approved; none when total is 0) | Increase: Dr Inventory / Cr Stock Adjustment Gain. Decrease: Dr Stock Adjustment Loss / Cr Inventory |
| Stock transfer | `stock-transfers/stock-transfer.service.ts` → `postLine` | `TRANSFER_OUT` + `TRANSFER_IN` | `STOCK_TRANSFER` | none | none — value moves at source average cost |

Adjustment increases use the unit cost the user enters. Adjustment decreases always use the current average cost.

### 2.4 Locations During Movement

| Warehouse setting | Transfers, adjustments, sales | Purchases |
|---|---|---|
| `useLocations = false` | Location must be empty; stock held at warehouse level | Location empty |
| `useLocations = true` | Location required | Falls back to the warehouse's default (or first active) location |

A transfer may move stock between two locations of the same warehouse.

### 2.5 API Endpoints (`/api/v1`)

Company comes from the `x-company-id` header, user from `x-user-id`.

- `/products` — list, get, create, update, archive, delete, suggest SKU; `/categories`, `/units-of-measure` CRUD; `/brands` read only
- `/warehouses` — list, get, create, update; `/:id/locations` list and create; `/locations/:locationId` update; `/:id/stock-summary`
- `/stock-transfers` and `/stock-adjustments` — `GET /support-data`, `GET /`, `GET /:id`, `POST /validate`, `POST /drafts`, `POST /create-and-post`, `POST /:id/post`

### 2.6 Frontend

- Routes: `frontend/src/app/(dashboard)/inventory/{products,categories,uom,warehouses,branches,stock-transfers,stock-adjustments}` — each a thin wrapper around one component.
- Components: `components/inventory/*`, `components/warehouses/WarehouseManagementPage.tsx`, `components/stock-transfers/StockTransferPage.tsx`, `components/stock-adjustments/StockAdjustmentPage.tsx`.
- API clients (TanStack Query): `src/lib/api/{products,warehouses,stock-transfers,stock-adjustments,branches}.ts`.

---

## 3. Deficiencies

### 3.1 Correctness And Data Integrity (Backend)

| # | Deficiency | Where | Impact |
|---|---|---|---|
| D1 | Adjustment `createAndPost` runs draft and post in two transactions | `stock-adjustment.service.ts` `createAndPost` | A failed post leaves an orphan draft **Fixed 2026-10-28:** Save And Post now runs in one transaction. |
| D2 | Adjustment numbering uses `ORDER BY ... LIMIT 1 FOR UPDATE` on text | `nextAdjustmentNumber` | Duplicate numbers under concurrency; wrong order past 9999 |
| D3 | Adjustment balances are not locked in a fixed order | `postLine` | Possible deadlocks |
| D4 | `ensureStockAdjustmentSettings` overwrites settings with hard-coded accounts on every post; `ensureAccount` renames/reactivates them | `stock-adjustment.service.ts` | Custom account setup is lost; breaks "no hard-coded account ranges" rule |
| D5 | Voiding a system voucher (`SA`, `SI`, `PI`, `PR`, `SR`) does not reverse stock or update the source document | `vouchers/voucher.service.ts` `void` | Stock and GL go out of sync |
| D6 | No void / reversal flow for any stock document | all stock modules | Posted mistakes cannot be corrected per the immutability rule **Fixed 2026-10-28:** Posted Stock Transfers, Stock Adjustments and Opening Stock can be reversed (`POST /:id/reverse`). |
| D7 | Sale and sale-return cost captured at draft time | `sale-draft.service.ts`, `sale-return-draft.service.ts` | COGS drifts if average cost changes before posting |
| D8 | Stock value rounded to 2 dp in purchases/sales, 4 dp in transfers/adjustments | post services | Small value differences accumulate |
| D9 | Duplicate lines of the same item each validate against full balance | `validateInput` in stock modules | Validation passes, posting then fails |
| D10 | Partial unique index on `StockBalance` missing from `schema.prisma` | `schema.prisma` vs migration | `prisma migrate dev` may drop it; transfer locking depends on it |
| D11 | No unique key on movements by source document + line | `StockMovement` | Database does not stop double posting on its own |
| D12 | Item hard delete fails with a raw FK error when history exists | `product.service.ts` `delete` | Unfriendly error |
| D13 | No permission checks on post endpoints; user ID taken from a raw header | routes | Anyone with the header can post **Fixed 2026-10-28:** Routes check permissions with `requirePermission`; the user comes from the signed-in session (`currentUserId`), not a header. |

### 3.2 Unimplemented Schema Features

- FIFO, standard cost, specific identification (no cost-layer table).
- Batch and serial tracking.
- Unit conversions (one unit fills all six unit fields on product save).
- Reserved stock (`reservedStock` never written; available always equals on hand).
- Item default warehouse / location (never read by posting).
- Production movement kinds.
- Opening balance entry outside the seed script.
- Approval workflow for transfers and adjustments (only vouchers have one).
- GL impact for inter-branch transfers (in-transit or clearing account).

### 3.3 Frontend

| # | Deficiency | Where |
|---|---|---|
| F1 | Drafts can be saved but never reopened, edited, or posted; lists show only `Posted`, limit 50, no search or paging | `StockTransferPage.tsx`, `StockAdjustmentPage.tsx` **Fixed 2026-10-28:** Lists have a Status filter; Drafts can be opened, changed, posted or cancelled. |
| F2 | No stock movement history (stock ledger) screen or endpoint | — |
| F3 | No all-warehouse stock report, valuation report, or low-stock report | only per-warehouse Stock Summary |
| F4 | No brand management screen | — |
| F5 | Stock Adjustment missing from the inventory index cards | `inventory/page.tsx` |
| F6 | Transfer/adjustment screens hand-roll the detail panel and badges instead of `SidePanel`/`Badge`; line entry does not follow the voucher form pattern in `DESIGN.md`; many inline styles | stock pages, `WarehouseManagementPage.tsx` |
| F7 | Product margin uses `.toFixed(1)` instead of settings formatting | `ProductForm.tsx`, `ProductDetailPanel.tsx` |
| F8 | Product, category, unit, and stock response types are `any` | `src/lib/api/products.ts`, stock API files |
| F9 | Stray empty folder `frontend/src/{app/` from a failed `mkdir` | repo |

### 3.4 Documentation

- `INVENTORY_SCHEMA.md` and `INVENTORY_TABLES.md` do not describe transfer and adjustment tables, or `Warehouse.branchId` / `useLocations`.
- `ACCOUNTING_POSTING_RULES.md` says `SALE_RETURN`; the enum is `SALES_RETURN`.
- Posting rules hard-code account codes, while the schema has configurable `StockAdjustmentSettings`. Which one wins is not stated.
- `ItemPrice.currencyCode` defaults to `"PKR"`, breaking the "no hard-coded currency" rule.

---

## 4. Next Moves

Ordered by risk to data first, then usability.

### Phase 1 — Make Posting Safe

1. Bring `StockAdjustmentService` up to the transfer standard: single-transaction `createAndPost`, advisory-lock numbering, ordered balance locking (D1–D3).
2. Stop overwriting `StockAdjustmentSettings`; seed defaults once and read configured accounts at post time (D4).
3. Block voiding of system vouchers from the voucher screen until document reversal exists (D5).
4. Declare the `StockBalance` partial unique index in Prisma (or document it as SQL-only and protect it) (D10).
5. Aggregate duplicate item lines during validation (D9).
6. Unify stock value rounding at 4 dp; round only when creating voucher amounts (D8).

### Phase 2 — Complete The Document Lifecycle

1. Draft list with status filter, search, paging; reopen, edit, delete, and post drafts (F1).
2. Void by reversal for transfers and adjustments: write opposite movements and a reversing voucher, set status `Voided` (D6).
3. Re-read average cost at sale posting time (D7).
4. Status fields as enums or shared constants; add approval fields if approval is required.

### Phase 3 — Visibility

1. Stock ledger endpoint and screen: movements by item / warehouse / date range with running balance (F2).
2. Stock balance report across warehouses and branches, with valuation and low-stock views (F3).
3. Opening balance entry screen (posts `OPENING_BALANCE` movements).

### Phase 4 — Polish And Extend

1. Align transfer and adjustment screens with `DESIGN.md` voucher form pattern and shared components (F6, F7).
2. Replace `any` with typed API responses (F8).
3. Brand management; add Stock Adjustment card (F4, F5).
4. Update inventory docs to match the schema (3.4).
5. Later: unit conversions, reserved stock, batch/serial tracking, FIFO cost layers, transfer GL rules.
