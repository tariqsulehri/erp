import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import { SaleValidationService, type ValidateSaleInvoiceInput } from './sale-validation.service.js';

const saleNumberPrefix = 'SI';

interface CustomerForDraft {
  id: string;
  ar_account_id: string;
}

interface ItemForDraft {
  id: string;
  item_code: string;
  item_name: string;
  uom_id: string | null;
  uom_name: string | null;
  average_cost: string;
}

export class SaleDraftService {
  constructor(private readonly companyId: string) {}

  private async nextSaleNumber(year: number, transaction: typeof prisma) {
    const prefix = `${saleNumberPrefix}-${year}-`;
    const rows = await transaction.$queryRaw<{ sale_number: string }[]>`
      SELECT sale_number
      FROM sale_invoices
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND sale_number LIKE ${`${prefix}%`}
      ORDER BY sale_number DESC
      LIMIT 1
    `;

    const last = rows[0]?.sale_number;
    const next = last ? Number.parseInt(last.split('-').pop() ?? '0', 10) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private userIdOrNull(userId?: string | null) {
    return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;
  }

  private money(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  async createDraft(input: ValidateSaleInvoiceInput, userId?: string | null) {
    const validation = await new SaleValidationService(this.companyId).validate(input);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    return prisma.$transaction(async transaction => {
      const customerRows = await transaction.$queryRaw<CustomerForDraft[]>`
        SELECT id, ar_account_id
        FROM customers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${input.customer_id} AS uuid)
          AND is_active = true
        LIMIT 1
      `;
      const customer = customerRows[0];
      if (!customer?.ar_account_id) {
        const error = new Error('Customer Linked Account is missing. Please update the customer before saving sale.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const itemIds = [...new Set(input.lines.map(line => line.item_id))];
      const itemRows = await transaction.$queryRaw<ItemForDraft[]>`
        SELECT
          i.id,
          COALESCE(i.sku, i.item_code) AS item_code,
          i.item_name,
          COALESCE(i.sales_uom_id, i.stock_uom_id, i.base_uom_id) AS uom_id,
          u.short_name AS uom_name,
          COALESCE(sb.average_cost, i.standard_cost, 0)::text AS average_cost
        FROM inventory_items i
        LEFT JOIN inventory_units_of_measure u
          ON u.id = COALESCE(i.sales_uom_id, i.stock_uom_id, i.base_uom_id)
        LEFT JOIN inventory_stock_balances sb
          ON sb.company_id = i.company_id
          AND sb.item_id = i.id
          AND sb.warehouse_id = CAST(${input.warehouse_id} AS uuid)
          AND (${validation.location_id}::uuid IS NULL AND sb.location_id IS NULL OR sb.location_id = ${validation.location_id}::uuid)
        WHERE i.company_id = CAST(${this.companyId} AS uuid)
          AND i.id = ANY(${itemIds}::uuid[])
          AND i.is_active = true
          AND i.is_blocked = false
          AND i.is_sales_item = true
      `;
      const itemMap = new Map(itemRows.map(item => [item.id, item]));

      const year = Number(input.sale_date.slice(0, 4));
      const saleNumber = await this.nextSaleNumber(year, transaction as unknown as typeof prisma);
      const createdBy = this.userIdOrNull(userId);
      const costAmount = this.money(input.lines.reduce((sum, line) => {
        const item = itemMap.get(line.item_id);
        return sum.plus(new Decimal(line.quantity).times(item?.average_cost ?? 0));
      }, new Decimal(0)));

      const invoiceRows = await transaction.$queryRaw<{ id: string; sale_number: string }[]>`
        INSERT INTO sale_invoices (
          company_id,
          sale_number,
          sale_date,
          customer_id,
          customer_account_id,
          payment_type,
          due_date,
          warehouse_id,
          location_id,
          customer_reference_number,
          delivery_date,
          delivery_note_number,
          description,
          status,
          gross_amount,
          discount_amount,
          tax_amount,
          freight_amount,
          net_amount,
          cost_amount,
          created_by_id,
          updated_by_id,
          updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          ${saleNumber},
          CAST(${input.sale_date} AS date),
          CAST(${customer.id} AS uuid),
          CAST(${customer.ar_account_id} AS uuid),
          ${input.payment_type},
          ${input.payment_type === 'Credit' && input.due_date ? input.due_date : null}::date,
          CAST(${input.warehouse_id} AS uuid),
          ${validation.location_id}::uuid,
          ${input.customer_reference_number || null},
          ${input.delivery_date || null}::date,
          ${input.delivery_note_number || null},
          ${input.description || null},
          'Draft',
          CAST(${validation.totals.gross_amount} AS numeric),
          CAST(${validation.totals.discount_amount} AS numeric),
          CAST(${validation.totals.tax_amount} AS numeric),
          CAST(${validation.totals.freight_amount} AS numeric),
          CAST(${validation.totals.net_amount} AS numeric),
          CAST(${costAmount.toFixed(2)} AS numeric),
          ${createdBy}::uuid,
          ${createdBy}::uuid,
          now()
        )
        RETURNING id, sale_number
      `;
      const invoice = invoiceRows[0];

      for (const [index, line] of input.lines.entries()) {
        const item = itemMap.get(line.item_id);
        const calculatedLine = validation.lines[index];
        if (!item || !calculatedLine) {
          const error = new Error(`Sale item on line ${index + 1} was not found.`);
          Object.assign(error, { statusCode: 400 });
          throw error;
        }

        const unitCost = new Decimal(item.average_cost || 0).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        const lineCost = this.money(new Decimal(calculatedLine.quantity).times(unitCost));
        await transaction.$queryRaw`
          INSERT INTO sale_invoice_lines (
            company_id,
            sale_invoice_id,
            line_number,
            item_id,
            item_code,
            item_name,
            uom_id,
            uom_name,
            warehouse_id,
            quantity,
            sale_price,
            discount_amount,
            tax_amount,
            line_total,
            unit_cost,
            cost_amount,
            description,
            updated_at
          )
          VALUES (
            CAST(${this.companyId} AS uuid),
            CAST(${invoice.id} AS uuid),
            ${index + 1},
            CAST(${item.id} AS uuid),
            ${item.item_code},
            ${item.item_name},
            ${item.uom_id}::uuid,
            ${item.uom_name},
            CAST(${line.warehouse_id || input.warehouse_id} AS uuid),
            CAST(${calculatedLine.quantity} AS numeric),
            CAST(${calculatedLine.sale_price} AS numeric),
            CAST(${calculatedLine.discount_amount} AS numeric),
            CAST(${calculatedLine.tax_amount} AS numeric),
            CAST(${calculatedLine.line_total} AS numeric),
            CAST(${unitCost.toFixed(4)} AS numeric),
            CAST(${lineCost.toFixed(2)} AS numeric),
            ${line.description || null},
            now()
          )
        `;
      }

      return { id: invoice.id, sale_number: invoice.sale_number };
    });
  }
}
