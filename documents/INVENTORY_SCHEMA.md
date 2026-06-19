# Inventory Schema

This document explains the inventory database tables in simple business language.

The Prisma source is:

```text
backend/prisma/schema.prisma
```

## Design Rules

- Use easy names that staff can understand.
- Every inventory table has `is_active`.
- `inventory_stock_movements` keeps the full stock history.
- `inventory_stock_balances` keeps the current stock summary.
- Draft documents do not change stock.
- Posted documents create stock movement records.

## Table Summary

| Table | Description |
| --- | --- |
| `inventory_items` | Main item master. Stores item code, item name, item settings, prices, stock rules, and default warehouse/location. |
| `inventory_categories` | Main and sub categories for items. Supports category hierarchy. |
| `inventory_item_groups` | Business grouping for items, separate from category. |
| `inventory_product_types` | Configurable product type list. |
| `inventory_brands` | Configurable brand list. |
| `inventory_item_sizes` | Configurable item size list. |
| `inventory_origins` | Configurable make/origin list. |
| `inventory_units_of_measure` | Unit list, such as piece, box, kg, meter, or square foot. |
| `inventory_unit_conversions` | Conversion rules between units. |
| `inventory_warehouses` | Warehouses, branches, or stock storage places. |
| `inventory_warehouse_locations` | Locations inside warehouses, such as room, rack, shelf, or office. |
| `inventory_item_prices` | Price records for purchase, sales, wholesale, and minimum sales price. |
| `inventory_item_barcodes` | Barcodes linked to items. |
| `inventory_item_images` | Images linked to items. |
| `inventory_item_attributes` | Extra configurable item details. |
| `inventory_stock_balances` | Current stock summary by item, warehouse, and location. |
| `inventory_stock_movements` | Permanent stock ledger for every posted stock change. |

## `inventory_items`

Main item master table.

| Field | Description |
| --- | --- |
| `id` | Unique item record ID. |
| `companyId` | Company that owns this item. |
| `itemCode` | Main item code used by users. |
| `sku` | Optional stock keeping unit or alternate item code. |
| `itemName` | Item name shown to users. |
| `saleDescription` | Short description used on sales documents. |
| `detailedDescription` | Longer item description. |
| `categoryId` | Item category. |
| `itemGroupId` | Item group for business reporting. |
| `productTypeId` | Product type selected from configurable list. |
| `brandId` | Item brand. |
| `itemSizeId` | Item size. |
| `originId` | Make, origin, or source. |
| `baseUomId` | Main base unit for the item. |
| `stockUomId` | Unit used for stock counting. |
| `purchaseUomId` | Unit used when buying this item. |
| `salesUomId` | Unit used when selling this item. |
| `itemKind` | Item kind, such as raw material, finished good, service, or consumable. |
| `valuationMethod` | Method used to value stock, such as FIFO or weighted average. |
| `trackingMethod` | Whether the item is tracked by batch, serial, both, or none. |
| `isInventoryItem` | Shows whether this item affects stock. |
| `isSalesItem` | Shows whether this item can be sold. |
| `isPurchaseItem` | Shows whether this item can be purchased. |
| `isManufacturedItem` | Shows whether this item is made through production. |
| `isServiceItem` | Shows whether this item is a service. |
| `standardCost` | Standard cost used when the item uses standard costing. |
| `defaultPurchasePrice` | Default purchase price. |
| `defaultSalesPrice` | Default sales price. |
| `minimumSalesPrice` | Lowest allowed sales price. |
| `wholesalePrice` | Default wholesale price. |
| `purchaseDiscountPercent` | Default purchase discount percent. |
| `salesDiscountPercent` | Default sales discount percent. |
| `wholesaleDiscountPercent` | Default wholesale discount percent. |
| `importTaxPercent` | Import tax percent, if used. |
| `packing` | Packing quantity or packing value. |
| `weight` | Item weight. |
| `weightUomId` | Unit used for item weight. |
| `length` | Item length. |
| `width` | Item width. |
| `height` | Item height. |
| `dimensionUomId` | Unit used for length, width, and height. |
| `minimumStockLevel` | Lowest desired stock level. |
| `maximumStockLevel` | Highest desired stock level. |
| `reorderLevel` | Stock level where reorder warning starts. |
| `reorderQuantity` | Suggested reorder quantity. |
| `defaultWarehouseId` | Default warehouse for this item. |
| `defaultLocationId` | Default location for this item. |
| `otherInformation` | Extra notes from old forms or business needs. |
| `isBlocked` | Shows if the item is temporarily blocked. |
| `blockedReason` | Reason why the item is blocked. |
| `isActive` | Shows if the item is active or inactive. |
| `createdById` | User who created the item. |
| `updatedById` | User who last updated the item. |
| `createdAt` | Date and time the item was created. |
| `updatedAt` | Date and time the item was last updated. |

## `inventory_categories`

Stores main and sub categories.

| Field | Description |
| --- | --- |
| `id` | Unique category ID. |
| `companyId` | Company that owns this category. |
| `parentId` | Parent category. Empty means main category. |
| `code` | Category code. |
| `name` | Category name. |
| `description` | Category description. |
| `level` | Category level in the tree. |
| `path` | Full category path used for fast tree queries. |
| `sortOrder` | Display order. |
| `isActive` | Shows if the category is active or inactive. |
| `createdAt` | Date and time the category was created. |
| `updatedAt` | Date and time the category was last updated. |

## `inventory_item_groups`

Stores business item groups.

| Field | Description |
| --- | --- |
| `id` | Unique item group ID. |
| `companyId` | Company that owns this group. |
| `code` | Group code. |
| `name` | Group name. |
| `description` | Group description. |
| `sortOrder` | Display order. |
| `isActive` | Shows if the group is active or inactive. |
| `createdAt` | Date and time the group was created. |
| `updatedAt` | Date and time the group was last updated. |

## `inventory_product_types`

Stores configurable product types.

| Field | Description |
| --- | --- |
| `id` | Unique product type ID. |
| `companyId` | Company that owns this product type. |
| `code` | Product type code. |
| `name` | Product type name. |
| `description` | Product type description. |
| `sortOrder` | Display order. |
| `isActive` | Shows if the product type is active or inactive. |
| `createdAt` | Date and time the product type was created. |
| `updatedAt` | Date and time the product type was last updated. |

## `inventory_brands`

Stores item brands.

| Field | Description |
| --- | --- |
| `id` | Unique brand ID. |
| `companyId` | Company that owns this brand. |
| `code` | Brand code. |
| `name` | Brand name. |
| `description` | Brand description. |
| `sortOrder` | Display order. |
| `isActive` | Shows if the brand is active or inactive. |
| `createdAt` | Date and time the brand was created. |
| `updatedAt` | Date and time the brand was last updated. |

## `inventory_item_sizes`

Stores item sizes.

| Field | Description |
| --- | --- |
| `id` | Unique size ID. |
| `companyId` | Company that owns this size. |
| `code` | Size code. |
| `name` | Size name. |
| `description` | Size description. |
| `sortOrder` | Display order. |
| `isActive` | Shows if the size is active or inactive. |
| `createdAt` | Date and time the size was created. |
| `updatedAt` | Date and time the size was last updated. |

## `inventory_origins`

Stores make, origin, country, or source values.

| Field | Description |
| --- | --- |
| `id` | Unique origin ID. |
| `companyId` | Company that owns this origin. |
| `code` | Origin code. |
| `name` | Origin name. |
| `description` | Origin description. |
| `sortOrder` | Display order. |
| `isActive` | Shows if the origin is active or inactive. |
| `createdAt` | Date and time the origin was created. |
| `updatedAt` | Date and time the origin was last updated. |

## `inventory_units_of_measure`

Stores units used for buying, selling, stock, weight, and dimensions.

| Field | Description |
| --- | --- |
| `id` | Unique unit ID. |
| `companyId` | Company that owns this unit. |
| `code` | Unit code. |
| `name` | Full unit name. |
| `shortName` | Short unit name shown to users. |
| `description` | Unit description. |
| `isDefault` | Shows if this is the default unit. |
| `isActive` | Shows if the unit is active or inactive. |
| `createdAt` | Date and time the unit was created. |
| `updatedAt` | Date and time the unit was last updated. |

## `inventory_unit_conversions`

Stores conversion rules between units.

| Field | Description |
| --- | --- |
| `id` | Unique conversion ID. |
| `companyId` | Company that owns this conversion. |
| `fromUnitId` | Unit being converted from. |
| `toUnitId` | Unit being converted to. |
| `factor` | Conversion factor. |
| `isActive` | Shows if the conversion is active or inactive. |
| `createdAt` | Date and time the conversion was created. |
| `updatedAt` | Date and time the conversion was last updated. |

Example:

```text
fromUnit = Box
toUnit = Piece
factor = 12
```

## `inventory_warehouses`

Stores warehouses, branches, or stock storage places.

| Field | Description |
| --- | --- |
| `id` | Unique warehouse ID. |
| `companyId` | Company that owns this warehouse. |
| `code` | Warehouse code. |
| `name` | Warehouse name. |
| `description` | Warehouse description. |
| `address` | Warehouse address. |
| `isDefault` | Shows if this is the default warehouse. |
| `isActive` | Shows if the warehouse is active or inactive. |
| `createdAt` | Date and time the warehouse was created. |
| `updatedAt` | Date and time the warehouse was last updated. |

## `inventory_warehouse_locations`

Stores locations inside a warehouse.

| Field | Description |
| --- | --- |
| `id` | Unique location ID. |
| `companyId` | Company that owns this location. |
| `warehouseId` | Warehouse where this location exists. |
| `code` | Location code. |
| `name` | Location name. |
| `description` | Location description. |
| `isDefault` | Shows if this is the default location. |
| `isActive` | Shows if the location is active or inactive. |
| `createdAt` | Date and time the location was created. |
| `updatedAt` | Date and time the location was last updated. |

## `inventory_item_prices`

Stores item price records.

| Field | Description |
| --- | --- |
| `id` | Unique price record ID. |
| `companyId` | Company that owns this price. |
| `itemId` | Item for this price. |
| `priceKind` | Price type, such as purchase, sales, wholesale, or minimum sales. |
| `currencyCode` | Currency code. |
| `price` | Price amount. |
| `discountPercent` | Discount percent for this price. |
| `effectiveFrom` | Date from which this price is valid. |
| `effectiveTo` | Date until which this price is valid. |
| `isActive` | Shows if the price record is active or inactive. |
| `createdAt` | Date and time the price record was created. |
| `updatedAt` | Date and time the price record was last updated. |

## `inventory_item_barcodes`

Stores one or more barcodes for an item.

| Field | Description |
| --- | --- |
| `id` | Unique barcode record ID. |
| `companyId` | Company that owns this barcode. |
| `itemId` | Item linked to this barcode. |
| `barcode` | Barcode value. |
| `label` | Optional barcode label. |
| `isPrimary` | Shows if this is the main barcode. |
| `isActive` | Shows if the barcode is active or inactive. |
| `createdAt` | Date and time the barcode was created. |
| `updatedAt` | Date and time the barcode was last updated. |

## `inventory_item_images`

Stores one or more images for an item.

| Field | Description |
| --- | --- |
| `id` | Unique image record ID. |
| `companyId` | Company that owns this image. |
| `itemId` | Item linked to this image. |
| `imageUrl` | Image file URL or storage path. |
| `label` | Optional image label. |
| `sortOrder` | Display order for item images. |
| `isPrimary` | Shows if this is the main item image. |
| `isActive` | Shows if the image is active or inactive. |
| `createdAt` | Date and time the image was created. |
| `updatedAt` | Date and time the image was last updated. |

## `inventory_item_attributes`

Stores extra configurable item details.

| Field | Description |
| --- | --- |
| `id` | Unique attribute ID. |
| `companyId` | Company that owns this attribute. |
| `itemId` | Item linked to this attribute. |
| `name` | Attribute name. |
| `value` | Attribute value. |
| `isActive` | Shows if the attribute is active or inactive. |
| `createdAt` | Date and time the attribute was created. |
| `updatedAt` | Date and time the attribute was last updated. |

Example:

```text
name = Color
value = Blue
```

## `inventory_stock_balances`

Stores current stock summary for fast reads.

| Field | Description |
| --- | --- |
| `id` | Unique stock balance ID. |
| `companyId` | Company that owns this stock balance. |
| `itemId` | Item for this balance. |
| `warehouseId` | Warehouse for this balance. |
| `locationId` | Location for this balance. |
| `stockOnHand` | Current stock quantity. |
| `reservedStock` | Quantity reserved for sales or other needs. |
| `availableStock` | Quantity available for use or sale. |
| `averageCost` | Current average cost. |
| `totalStockValue` | Total value of current stock. |
| `isActive` | Shows if the balance row is active or inactive. |
| `createdAt` | Date and time the balance row was created. |
| `updatedAt` | Date and time the balance row was last updated. |

## `inventory_stock_movements`

Stores permanent stock history.

Every posted inventory transaction should create one or more records in this table.

| Field | Description |
| --- | --- |
| `id` | Unique stock movement ID. |
| `companyId` | Company that owns this movement. |
| `itemId` | Item that moved. |
| `warehouseId` | Warehouse where stock changed. |
| `locationId` | Location where stock changed. |
| `movementDate` | Date of stock movement. |
| `movementKind` | Type of movement, such as purchase receipt or sales delivery. |
| `sourceKind` | Source document type. |
| `sourceDocumentId` | Source document ID. |
| `sourceDocumentNumber` | Source document number shown to users. |
| `quantityIn` | Quantity added to stock. |
| `quantityOut` | Quantity removed from stock. |
| `unitCost` | Cost per unit for this movement. |
| `totalCost` | Total cost for this movement. |
| `stockAfterMovement` | Stock balance after this movement. |
| `valuationMethod` | Valuation method used for this movement. |
| `remarks` | Notes or explanation. |
| `isActive` | Shows if the movement is active. Usually remains active for audit. |
| `createdById` | User who created the movement. |
| `createdAt` | Date and time the movement was created. |
| `updatedAt` | Date and time the movement was last updated. |

## Enums

### `InventoryItemKind`

| Value | Description |
| --- | --- |
| `RAW_MATERIAL` | Material purchased for production. |
| `FINISHED_GOOD` | Completed item ready for sale. |
| `SEMI_FINISHED` | Partly completed production item. |
| `SERVICE` | Service item with no physical stock. |
| `CONSUMABLE` | Consumable item used by the business. |
| `PACKAGING` | Packing material. |
| `ASSET` | Asset item. |
| `OTHER` | Other item type. |

### `StockValuationMethod`

| Value | Description |
| --- | --- |
| `FIFO` | First stock received is treated as first stock issued. |
| `WEIGHTED_AVERAGE` | Average cost is recalculated after stock receipts. |
| `STANDARD_COST` | Uses a fixed standard cost. |
| `SPECIFIC_IDENTIFICATION` | Tracks exact cost for specific units. |

### `StockTrackingMethod`

| Value | Description |
| --- | --- |
| `NONE` | No batch or serial tracking. |
| `BATCH` | Tracks stock by batch. |
| `SERIAL` | Tracks stock by serial number. |
| `BATCH_AND_SERIAL` | Tracks both batch and serial number. |

### `ItemPriceKind`

| Value | Description |
| --- | --- |
| `PURCHASE` | Purchase price. |
| `SALES` | Sales price. |
| `WHOLESALE` | Wholesale price. |
| `MINIMUM_SALES` | Minimum allowed sales price. |

### `StockMovementKind`

| Value | Description |
| --- | --- |
| `OPENING_BALANCE` | Starting stock. |
| `PURCHASE_RECEIPT` | Stock received from purchase. |
| `PURCHASE_RETURN` | Stock returned to supplier. |
| `SALES_DELIVERY` | Stock delivered to customer. |
| `SALES_RETURN` | Stock returned by customer. |
| `ADJUSTMENT_IN` | Stock added by adjustment. |
| `ADJUSTMENT_OUT` | Stock reduced by adjustment. |
| `TRANSFER_IN` | Stock received from another warehouse/location. |
| `TRANSFER_OUT` | Stock sent to another warehouse/location. |
| `PRODUCTION_ISSUE` | Stock issued to production. |
| `PRODUCTION_RECEIPT` | Stock received from production. |

### `StockSourceKind`

| Value | Description |
| --- | --- |
| `OPENING_BALANCE` | Opening stock entry. |
| `PURCHASE_ORDER` | Purchase order. |
| `PURCHASE_INVOICE` | Purchase invoice. |
| `GOODS_RECEIPT` | Goods receipt. |
| `SALES_ORDER` | Sales order. |
| `SALES_INVOICE` | Sales invoice. |
| `DELIVERY_NOTE` | Delivery note. |
| `SALES_RETURN` | Sales return. |
| `PURCHASE_RETURN` | Purchase return. |
| `STOCK_ADJUSTMENT` | Stock adjustment. |
| `STOCK_TRANSFER` | Stock transfer. |
| `PRODUCTION_ORDER` | Production order. |
| `MANUAL_ENTRY` | Manual entry. |
