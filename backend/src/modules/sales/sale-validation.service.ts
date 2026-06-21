import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

export const SaleInvoiceLineInput = z.object({
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  sale_price: z.number().positive('Sale Price must be greater than zero.'),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
});

export const ValidateSaleInvoiceInput = z.object({
  sale_date: dateInput,
  customer_id: z.string().uuid(),
  payment_type: z.enum(['Cash', 'Credit']),
  due_date: dateInput.optional(),
  delivery_date: dateInput.optional(),
  warehouse_id: z.string().uuid(),
  location_id: z.string().uuid().optional().or(z.literal('')),
  customer_reference_number: z.string().max(100).optional(),
  delivery_note_number: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  freight_amount: z.number().min(0).default(0),
  lines: z.array(SaleInvoiceLineInput).min(1, 'Add at least one sale item.'),
});

export type ValidateSaleInvoiceInput = z.infer<typeof ValidateSaleInvoiceInput>;

interface CustomerValidationRow {
  id: string;
  code: string;
  name: string;
  ar_account_id: string | null;
  account_code: string | null;
  credit_limit: string;
}

interface ItemValidationRow {
  id: string;
  item_code: string;
  item_name: string;
  stock_on_hand: string;
  minimum_sales_price: string | null;
}

interface FiscalPeriodValidationRow {
  fiscal_year_id: string;
  fiscal_year: string;
  fiscal_year_locked: boolean;
  period_name: string;
  is_open: boolean;
}

export class SaleValidationService {
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
      this.addError(errors, 'Sale Date does not fall within any active fiscal year.');
      return null;
    }
    if (fiscalPeriod.fiscal_year_locked) {
      this.addError(errors, 'Fiscal year is locked. No new transactions allowed.');
      return fiscalPeriod;
    }
    if (!fiscalPeriod.period_name) {
      this.addError(errors, 'No open period found for Sale Date.');
      return fiscalPeriod;
    }
    if (!fiscalPeriod.is_open) {
      this.addError(errors, `Period "${fiscalPeriod.period_name}" is closed. Cannot post transactions.`);
    }
    return fiscalPeriod;
  }

  async validate(input: ValidateSaleInvoiceInput) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const saleDate = this.databaseDate(input.sale_date);
    const dueDate = input.due_date ? this.databaseDate(input.due_date) : null;
    const deliveryDate = input.delivery_date ? this.databaseDate(input.delivery_date) : null;

    if (input.payment_type === 'Credit' && !dueDate) {
      this.addError(errors, 'Due Date is required for Credit sale.');
    }
    if (input.payment_type === 'Credit' && dueDate && dueDate < saleDate) {
      this.addError(errors, 'Due Date cannot be before Sale Date.');
    }
    if (deliveryDate && deliveryDate < saleDate) {
      this.addError(errors, 'Delivery Date cannot be before Sale Date.');
    }

    const fiscalPeriod = await this.validatePostingDate(input.sale_date, errors);

    const customerRows = await prisma.$queryRaw<CustomerValidationRow[]>`
      SELECT
        c.id,
        c.code,
        c.name,
        c.ar_account_id,
        a.code AS account_code,
        c.credit_limit::text
      FROM customers c
      LEFT JOIN accounts a ON a.id = c.ar_account_id AND a.company_id = c.company_id
      WHERE c.company_id = CAST(${this.companyId} AS uuid)
        AND c.id = CAST(${input.customer_id} AS uuid)
        AND c.is_active = true
      LIMIT 1
    `;
    const customer = customerRows[0];
    if (!customer) {
      this.addError(errors, 'Customer was not found or is inactive.');
    } else if (!customer.ar_account_id || !customer.account_code) {
      this.addError(errors, 'Customer Linked Account is missing. Please update the customer before posting sale.');
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

    if (customer && input.customer_reference_number?.trim()) {
      const duplicateRows = await prisma.$queryRaw<{ sale_number: string }[]>`
        SELECT sale_number
        FROM sale_invoices
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND customer_id = CAST(${customer.id} AS uuid)
          AND LOWER(customer_reference_number) = LOWER(${input.customer_reference_number.trim()})
          AND status <> 'Voided'
        LIMIT 1
      `;
      if (duplicateRows[0]) {
        this.addError(errors, `Customer Reference No. is already used on ${duplicateRows[0].sale_number}.`);
      }
    }

    const itemIds = [...new Set(input.lines.map(line => line.item_id))];
    const itemRows = itemIds.length > 0
      ? await prisma.$queryRaw<ItemValidationRow[]>`
          SELECT
            i.id,
            COALESCE(i.sku, i.item_code) AS item_code,
            i.item_name,
            i.minimum_sales_price::text,
            COALESCE(SUM(sb.stock_on_hand) FILTER (
              WHERE sb.warehouse_id = CAST(${input.warehouse_id} AS uuid)
                AND (${resolvedLocationId}::uuid IS NULL AND sb.location_id IS NULL OR sb.location_id = ${resolvedLocationId}::uuid)
            ), 0)::text AS stock_on_hand
          FROM inventory_items i
          LEFT JOIN inventory_stock_balances sb
            ON sb.company_id = i.company_id
            AND sb.item_id = i.id
            AND sb.is_active = true
          WHERE i.company_id = CAST(${this.companyId} AS uuid)
            AND i.id = ANY(${itemIds}::uuid[])
            AND i.is_active = true
            AND i.is_blocked = false
            AND i.is_sales_item = true
          GROUP BY i.id, i.sku, i.item_code, i.item_name, i.minimum_sales_price
        `
      : [];
    const itemMap = new Map(itemRows.map(item => [item.id, item]));
    if (itemMap.size !== itemIds.length) {
      this.addError(errors, 'One or more sale items were not found, inactive, or not sellable.');
    }

    const quantityByItem = new Map<string, Decimal>();
    const calculatedLines = input.lines.map((line, index) => {
      if (line.warehouse_id && line.warehouse_id !== input.warehouse_id) {
        this.addError(errors, `Line ${index + 1} Warehouse must match the selected Warehouse.`);
      }

      const quantity = this.quantity(line.quantity);
      const salePrice = this.money(line.sale_price);
      const gross = this.money(quantity.times(salePrice));
      const discount = this.money(line.discount_amount);
      const tax = this.money(line.tax_amount);
      const item = itemMap.get(line.item_id);

      if (discount.gt(gross)) {
        this.addError(errors, `Discount cannot be greater than item amount on line ${index + 1}.`);
      }
      if (item?.minimum_sales_price && salePrice.lt(item.minimum_sales_price)) {
        this.addError(errors, `Sale Price is below Minimum Sale Price on line ${index + 1}.`);
      }

      const runningQuantity = (quantityByItem.get(line.item_id) ?? new Decimal(0)).plus(quantity);
      quantityByItem.set(line.item_id, runningQuantity);
      if (item && runningQuantity.gt(item.stock_on_hand)) {
        this.addError(errors, `Stock is not enough for ${item.item_code} - ${item.item_name}.`);
      }

      const lineTotal = this.money(gross.minus(discount).plus(tax));
      if (lineTotal.lte(0)) {
        this.addError(errors, `Line Total must be greater than zero on line ${index + 1}.`);
      }

      return {
        line_number: index + 1,
        item_id: line.item_id,
        item_code: item?.item_code ?? null,
        item_name: item?.item_name ?? null,
        quantity: quantity.toFixed(4),
        sale_price: salePrice.toFixed(2),
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

    if (netAmount.lte(0)) this.addError(errors, 'Net Amount must be greater than zero.');
    if (input.payment_type === 'Cash') warnings.push('Cash sale will use the default cash account when saved and posted.');

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
