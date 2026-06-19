# Inventory Tables

These table names are intentionally descriptive and easy to understand.

| Table | Simple Description |
| --- | --- |
| `inventory_items` | Main item master. Stores item code, name, category, prices, stock rules, and item settings. |
| `inventory_categories` | Item categories with main/sub category hierarchy. |
| `inventory_item_groups` | Configurable item groups used for business grouping and reporting. |
| `inventory_product_types` | Configurable product types such as raw material, finished goods, service, or consumable. |
| `inventory_brands` | Item brands. |
| `inventory_item_sizes` | Item sizes such as 54 x 164 or Small/Medium/Large. |
| `inventory_origins` | Make/origin/country/source descriptions. |
| `inventory_units_of_measure` | Units such as piece, box, kg, meter, square foot. |
| `inventory_unit_conversions` | Conversion rules between units, such as 1 box = 12 pieces. |
| `inventory_warehouses` | Warehouses or branches where stock is stored. |
| `inventory_warehouse_locations` | Locations inside a warehouse, such as rack, shelf, room, or head office. |
| `inventory_item_prices` | Item prices by price type, such as purchase, sales, wholesale, or minimum sales price. |
| `inventory_item_barcodes` | Extra barcodes for an item. |
| `inventory_item_images` | One or more item images, including primary image support. |
| `inventory_item_attributes` | Configurable extra item fields that may differ by business. |
| `inventory_stock_balances` | Fast current stock balance by item, warehouse, and location. |
| `inventory_stock_movements` | Permanent stock ledger. Every posted stock-in or stock-out creates a record here. |

## Reporting Rule

Stock reports should use:

- `inventory_stock_movements` for detailed history.
- `inventory_stock_balances` for fast current stock.

Do not calculate inventory reports by joining every purchase, sale, return, and adjustment document directly.
