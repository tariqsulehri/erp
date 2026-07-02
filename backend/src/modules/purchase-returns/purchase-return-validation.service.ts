import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

export const PurchaseReturnLineInput = z.object({
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  purchase_price: z.number().positive('Purchase Price must be greater than zero.'),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
});

export const ValidatePurchaseReturnInput = z.object({
  purchase_return_date: dateInput,
  supplier_id: z.string().uuid(),
  supplier_return_number: z.string().max(100).optional(),
  supplier_return_date: dateInput.optional(),
  payment_type: z.enum(['Cash', 'Credit']),
  warehouse_id: z.string().uuid(),
  location_id: z.string().uuid().optional().or(z.literal('')),
  reference_number: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  freight_amount: z.number().min(0).default(0),
  lines: z.array(PurchaseReturnLineInput).min(1, 'Add at least one purchase return item.'),
});

export type ValidatePurchaseReturnInput = z.infer<typeof ValidatePurchaseReturnInput>;

interface SupplierValidationRow {
  id: string;
  code: string;
  name: string;
  ap_account_id: string | null;
  account_code: string | null;
}

interface ItemValidationRow {
  id: string;
  item_code: string;
  item_name: string;
}

interface StockBalanceRow {
  item_id: string;
  warehouse_id: string;
  location_id: string | null;
  stock_on_hand: string;
}

interface FiscalPeriodValidationRow {
  fiscal_year_id: string;
  fiscal_year: string;
  fiscal_year_locked: boolean;
  period_name: string;
  is_open: boolean;
}

export class PurchaseReturnValidationService {
  constructor(private readonly companyId: string) {}

  private databaseDate(value: string) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) throw new Error('Date is not valid.');
    return date;
  }

  private money(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private quantity(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  private addError(errors: string[], message: string) {
    if (!errors.includes(message)) errors.push(message);
  }

  private async validatePostingDate(dateText: string, errors: string[]) {
    const rows = await prisma.$queryRaw<FiscalPeriodValidationRow[]>`
      SELECT
        fy.id AS fiscal_year_id,
        fy.fiscal_year,
        fy.is_locked AS fiscal_year_locked,
        fp.period_name,
        fp.is_open
      FROM fiscal_years fy
      LEFT JOIN fiscal_periods fp
        ON fp.fiscal_year_id = fy.id
        AND fp.start_date <= CAST(${dateText} AS date)
        AND (fp.end_date + (fp.posting_cutoff_days * INTERVAL '1 day')) >= CAST(${dateText} AS date)
      WHERE fy.company_id = CAST(${this.companyId} AS uuid)
        AND fy.is_deleted = false
        AND fy.start_date <= CAST(${dateText} AS date)
        AND fy.end_date >= CAST(${dateText} AS date)
      LIMIT 1
    `;

    const fiscalPeriod = rows[0];
    if (!fiscalPeriod) {
      this.addError(errors, 'Purchase Return Date does not fall within any active fiscal year.');
      return null;
    }
    if (fiscalPeriod.fiscal_year_locked) {
      this.addError(errors, 'Fiscal year is locked. No new transactions allowed.');
      return fiscalPeriod;
    }
    if (!fiscalPeriod.period_name) {
      this.addError(errors, 'No open period found for Purchase Return Date.');
      return fiscalPeriod;
    }
    if (!fiscalPeriod.is_open) {
      this.addError(errors, `Period "${fiscalPeriod.period_name}" is closed. Cannot post transactions.`);
    }
    return fiscalPeriod;
  }

  async validate(input: ValidatePurchaseReturnInput) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const returnDate = this.databaseDate(input.purchase_return_date);
    const supplierReturnDate = input.supplier_return_date ? this.databaseDate(input.supplier_return_date) : null;

    if (supplierReturnDate && supplierReturnDate > returnDate) {
      this.addError(errors, 'Supplier Return Date cannot be after Purchase Return Date.');
    }

    const fiscalPeriod = await this.validatePostingDate(input.purchase_return_date, errors);

    const supplierRows = await prisma.$queryRaw<SupplierValidationRow[]>`
      SELECT
        s.id,
        s.code,
        s.name,
        s.ap_account_id,
        a.code AS account_code
      FROM suppliers s
      LEFT JOIN accounts a ON a.id = s.ap_account_id AND a.company_id = s.company_id
      WHERE s.company_id = CAST(${this.companyId} AS uuid)
        AND s.id = CAST(${input.supplier_id} AS uuid)
        AND s.is_active = true
      LIMIT 1
    `;
    const supplier = supplierRows[0];
    if (!supplier) {
      this.addError(errors, 'Supplier was not found or is inactive.');
    } else if (!supplier.ap_account_id || !supplier.account_code) {
      this.addError(errors, 'Supplier Linked Account is missing. Please update the supplier before posting purchase return.');
    }

    let resolvedLocationId: string | null = null;
    const warehouseRows = await prisma.$queryRaw<{ id: string; use_locations: boolean }[]>`
      SELECT id, use_locations
      FROM inventory_warehouses
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${input.warehouse_id} AS uuid)
        AND is_active = true
      LIMIT 1
    `;
    const warehouse = warehouseRows[0];
    if (!warehouse) {
      this.addError(errors, 'Warehouse was not found or is inactive.');
    } else if (warehouse.use_locations) {
      if (!input.location_id) {
        this.addError(errors, 'Location is required because the selected Warehouse uses Locations.');
      } else {
        const locationRows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM inventory_warehouse_locations
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND id = CAST(${input.location_id} AS uuid)
            AND warehouse_id = CAST(${input.warehouse_id} AS uuid)
            AND is_active = true
          LIMIT 1
        `;
        if (!locationRows[0]) {
          this.addError(errors, 'Location was not found, inactive, or does not belong to the selected Warehouse.');
        } else {
          resolvedLocationId = locationRows[0].id;
        }
      }
    } else if (input.location_id) {
      this.addError(errors, 'Location can only be selected when the Warehouse uses Locations.');
    }

    if (supplier && input.supplier_return_number?.trim()) {
      const duplicateRows = await prisma.$queryRaw<{ purchase_return_number: string }[]>`
        SELECT purchase_return_number
        FROM purchase_returns
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND supplier_id = CAST(${supplier.id} AS uuid)
          AND LOWER(supplier_return_number) = LOWER(${input.supplier_return_number.trim()})
          AND status <> 'Voided'
        LIMIT 1
      `;
      if (duplicateRows[0]) {
        this.addError(errors, `Supplier Return No. is already used on ${duplicateRows[0].purchase_return_number}.`);
      }
    }

    const itemIds = [...new Set(input.lines.map(line => line.item_id))];
    const itemRows = itemIds.length > 0
      ? await prisma.$queryRaw<ItemValidationRow[]>`
          SELECT
            i.id,
            COALESCE(i.sku, i.item_code) AS item_code,
            i.item_name
          FROM inventory_items i
          WHERE i.company_id = CAST(${this.companyId} AS uuid)
            AND i.id = ANY(${itemIds}::uuid[])
            AND i.is_active = true
            AND i.is_blocked = false
            AND i.is_purchase_item = true
        `
      : [];
    const itemMap = new Map(itemRows.map(item => [item.id, item]));
    if (itemMap.size !== itemIds.length) {
      this.addError(errors, 'One or more return items were not found, inactive, or not purchasable.');
    }

    const stockRows = itemIds.length > 0
      ? await prisma.$queryRaw<StockBalanceRow[]>`
          SELECT item_id::text, warehouse_id::text, location_id::text, stock_on_hand::text
          FROM inventory_stock_balances
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND item_id = ANY(${itemIds}::uuid[])
            AND is_active = true
        `
      : [];
    const stockMap = new Map(stockRows.map(row => [`${row.item_id}:${row.warehouse_id}:${row.location_id ?? ''}`, row.stock_on_hand]));

    const lineQuantityByItemWarehouse = new Map<string, Decimal>();
    const calculatedLines = input.lines.map((line, index) => {
      const quantity = this.quantity(line.quantity);
      const purchasePrice = this.money(line.purchase_price);
      const gross = this.money(quantity.times(purchasePrice));
      const discount = this.money(line.discount_amount);
      const tax = this.money(line.tax_amount);
      const warehouseId = line.warehouse_id || input.warehouse_id;
      if (warehouseId !== input.warehouse_id) this.addError(errors, `Line ${index + 1} Warehouse must match the selected Warehouse.`);

      if (discount.gt(gross)) {
        this.addError(errors, `Discount cannot be greater than item amount on line ${index + 1}.`);
      }

      const lineTotal = this.money(gross.minus(discount).plus(tax));
      if (lineTotal.lte(0)) this.addError(errors, `Line Total must be greater than zero on line ${index + 1}.`);

      const key = `${line.item_id}:${warehouseId}:${resolvedLocationId ?? ''}`;
      lineQuantityByItemWarehouse.set(key, (lineQuantityByItemWarehouse.get(key) ?? new Decimal(0)).plus(quantity));

      return {
        line_number: index + 1,
        item_id: line.item_id,
        item_code: itemMap.get(line.item_id)?.item_code ?? null,
        item_name: itemMap.get(line.item_id)?.item_name ?? null,
        warehouse_id: warehouseId,
        quantity: quantity.toFixed(4),
        purchase_price: purchasePrice.toFixed(2),
        gross_amount: gross.toFixed(2),
        discount_amount: discount.toFixed(2),
        tax_amount: tax.toFixed(2),
        line_total: lineTotal.toFixed(2),
      };
    });

    lineQuantityByItemWarehouse.forEach((requestedQuantity, key) => {
      const availableQuantity = this.quantity(stockMap.get(key) ?? 0);
      if (requestedQuantity.gt(availableQuantity)) {
        this.addError(errors, 'Purchase Return quantity cannot be greater than Stock On Hand.');
      }
    });

    const grossAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.gross_amount), new Decimal(0)));
    const discountAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.discount_amount), new Decimal(0)));
    const taxAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.tax_amount), new Decimal(0)));
    const freightAmount = this.money(input.freight_amount);
    const netAmount = this.money(grossAmount.minus(discountAmount).plus(taxAmount).plus(freightAmount));

    if (netAmount.lte(0)) this.addError(errors, 'Net Amount must be greater than zero.');
    if (input.payment_type === 'Cash') {
      warnings.push('Cash purchase return will use the default cash account when saved and posted.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fiscalPeriod,
      totals: {
        gross_amount: grossAmount.toFixed(2),
        discount_amount: discountAmount.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        freight_amount: freightAmount.toFixed(2),
        net_amount: netAmount.toFixed(2),
      },
      lines: calculatedLines,
      location_id: resolvedLocationId,
    };
  }
}
