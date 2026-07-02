import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

export const PurchaseInvoiceLineInput = z.object({
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  purchase_price: z.number().positive('Purchase Price must be greater than zero.'),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
});

export const ValidatePurchaseInvoiceInput = z.object({
  purchase_date: dateInput,
  supplier_id: z.string().uuid(),
  supplier_invoice_number: z.string().max(100).optional(),
  supplier_invoice_date: dateInput.optional(),
  payment_type: z.enum(['Cash', 'Credit']),
  due_date: dateInput.optional(),
  warehouse_id: z.string().uuid(),
  location_id: z.string().uuid().optional().or(z.literal('')),
  reference_number: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  freight_amount: z.number().min(0).default(0),
  lines: z.array(PurchaseInvoiceLineInput).min(1, 'Add at least one purchase item.'),
});

export type ValidatePurchaseInvoiceInput = z.infer<typeof ValidatePurchaseInvoiceInput>;

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

interface WarehouseValidationRow {
  id: string;
  use_locations: boolean;
}

interface FiscalPeriodValidationRow {
  fiscal_year_id: string;
  fiscal_year: string;
  fiscal_year_locked: boolean;
  period_name: string;
  is_open: boolean;
}

export class PurchaseValidationService {
  constructor(private readonly companyId: string) {}

  private databaseDate(value: string) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Date is not valid.');
    }
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
      this.addError(errors, 'Purchase Date does not fall within any active fiscal year.');
      return null;
    }
    if (fiscalPeriod.fiscal_year_locked) {
      this.addError(errors, 'Fiscal year is locked. No new transactions allowed.');
      return fiscalPeriod;
    }
    if (!fiscalPeriod.period_name) {
      this.addError(errors, 'No open period found for Purchase Date.');
      return fiscalPeriod;
    }
    if (!fiscalPeriod.is_open) {
      this.addError(errors, `Period "${fiscalPeriod.period_name}" is closed. Cannot post transactions.`);
    }

    return fiscalPeriod;
  }

  async validate(input: ValidatePurchaseInvoiceInput) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const purchaseDate = this.databaseDate(input.purchase_date);
    const supplierInvoiceDate = input.supplier_invoice_date ? this.databaseDate(input.supplier_invoice_date) : null;
    const dueDate = input.due_date ? this.databaseDate(input.due_date) : null;

    if (supplierInvoiceDate && supplierInvoiceDate > purchaseDate) {
      this.addError(errors, 'Supplier Invoice Date cannot be after Purchase Date.');
    }
    if (input.payment_type === 'Credit' && !dueDate) {
      this.addError(errors, 'Due Date is required for Credit purchase.');
    }
    if (input.payment_type === 'Credit' && dueDate && dueDate < purchaseDate) {
      this.addError(errors, 'Due Date cannot be before Purchase Date.');
    }

    const fiscalPeriod = await this.validatePostingDate(input.purchase_date, errors);

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
      this.addError(errors, 'Supplier Linked Account is missing. Please update the supplier before posting purchase.');
    }

    let resolvedLocationId: string | null = null;
    const warehouseRows = await prisma.$queryRaw<WarehouseValidationRow[]>`
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
      if (input.location_id) {
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
      } else {
        const defaultLocationRows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM inventory_warehouse_locations
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND warehouse_id = CAST(${input.warehouse_id} AS uuid)
            AND is_active = true
          ORDER BY is_default DESC, code ASC
          LIMIT 1
        `;
        if (!defaultLocationRows[0]) {
          this.addError(errors, 'Warehouse uses Locations. Please create an Active Default Location before posting purchase.');
        } else {
          resolvedLocationId = defaultLocationRows[0].id;
        }
      }
    } else if (input.location_id) {
      this.addError(errors, 'Location can only be selected when the Warehouse uses Locations.');
    }

    if (supplier && input.supplier_invoice_number?.trim()) {
      const duplicateRows = await prisma.$queryRaw<{ purchase_number: string }[]>`
        SELECT purchase_number
        FROM purchase_invoices
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND supplier_id = CAST(${supplier.id} AS uuid)
          AND LOWER(supplier_invoice_number) = LOWER(${input.supplier_invoice_number.trim()})
          AND status <> 'Voided'
        LIMIT 1
      `;
      if (duplicateRows[0]) {
        this.addError(errors, `Supplier Bill No. is already used on ${duplicateRows[0].purchase_number}.`);
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
      this.addError(errors, 'One or more purchase items were not found, inactive, or not purchasable.');
    }

    const calculatedLines = input.lines.map((line, index) => {
      if (line.warehouse_id && line.warehouse_id !== input.warehouse_id) {
        this.addError(errors, `Line ${index + 1} Warehouse must match the selected Warehouse.`);
      }

      const quantity = this.quantity(line.quantity);
      const purchasePrice = this.money(line.purchase_price);
      const gross = this.money(quantity.times(purchasePrice));
      const discount = this.money(line.discount_amount);
      const tax = this.money(line.tax_amount);

      if (discount.gt(gross)) {
        this.addError(errors, `Discount cannot be greater than item amount on line ${index + 1}.`);
      }

      const lineTotal = this.money(gross.minus(discount).plus(tax));
      if (lineTotal.lte(0)) {
        this.addError(errors, `Line Total must be greater than zero on line ${index + 1}.`);
      }

      return {
        line_number: index + 1,
        item_id: line.item_id,
        item_code: itemMap.get(line.item_id)?.item_code ?? null,
        item_name: itemMap.get(line.item_id)?.item_name ?? null,
        quantity: quantity.toFixed(4),
        purchase_price: purchasePrice.toFixed(2),
        gross_amount: gross.toFixed(2),
        discount_amount: discount.toFixed(2),
        tax_amount: tax.toFixed(2),
        line_total: lineTotal.toFixed(2),
      };
    });

    const grossAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.gross_amount), new Decimal(0)));
    const discountAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.discount_amount), new Decimal(0)));
    const taxAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.tax_amount), new Decimal(0)));
    const freightAmount = this.money(input.freight_amount);
    const netAmount = this.money(grossAmount.minus(discountAmount).plus(taxAmount).plus(freightAmount));

    if (netAmount.lte(0)) {
      this.addError(errors, 'Net Amount must be greater than zero.');
    }

    if (input.payment_type === 'Cash') {
      warnings.push('Cash purchase will use the default cash account when saved and posted.');
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
