import { prisma } from '../../db/prisma.js';
import {
  PurchaseReturnValidationService,
  type ValidatePurchaseReturnInput,
} from './purchase-return-validation.service.js';

const purchaseReturnNumberPrefix = 'PR';

interface SupplierForDraft {
  id: string;
  ap_account_id: string;
}

interface ItemForDraft {
  id: string;
  item_code: string;
  item_name: string;
  uom_id: string | null;
  uom_name: string | null;
}

export class PurchaseReturnDraftService {
  constructor(private readonly companyId: string) {}

  private async nextPurchaseReturnNumber(year: number, transaction: typeof prisma) {
    const prefix = `${purchaseReturnNumberPrefix}-${year}-`;
    const rows = await transaction.$queryRaw<{ purchase_return_number: string }[]>`
      SELECT purchase_return_number
      FROM purchase_returns
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND purchase_return_number LIKE ${`${prefix}%`}
      ORDER BY purchase_return_number DESC
      LIMIT 1
    `;

    const last = rows[0]?.purchase_return_number;
    const next = last ? Number.parseInt(last.split('-').pop() ?? '0', 10) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private userIdOrNull(userId?: string | null) {
    return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;
  }

  async createDraft(input: ValidatePurchaseReturnInput, userId?: string | null) {
    const validation = await new PurchaseReturnValidationService(this.companyId).validate(input);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    return prisma.$transaction(async transaction => {
      const supplierRows = await transaction.$queryRaw<SupplierForDraft[]>`
        SELECT id, ap_account_id
        FROM suppliers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${input.supplier_id} AS uuid)
          AND is_active = true
        LIMIT 1
      `;
      const supplier = supplierRows[0];
      if (!supplier?.ap_account_id) {
        const error = new Error('Supplier Linked Account is missing. Please update the supplier before saving purchase return.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const itemIds = [...new Set(input.lines.map(line => line.item_id))];
      const itemRows = await transaction.$queryRaw<ItemForDraft[]>`
        SELECT
          i.id,
          COALESCE(i.sku, i.item_code) AS item_code,
          i.item_name,
          COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id) AS uom_id,
          u.short_name AS uom_name
        FROM inventory_items i
        LEFT JOIN inventory_units_of_measure u
          ON u.id = COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id)
        WHERE i.company_id = CAST(${this.companyId} AS uuid)
          AND i.id = ANY(${itemIds}::uuid[])
          AND i.is_active = true
          AND i.is_blocked = false
          AND i.is_purchase_item = true
      `;
      const itemMap = new Map(itemRows.map(item => [item.id, item]));

      const year = Number(input.purchase_return_date.slice(0, 4));
      const purchaseReturnNumber = await this.nextPurchaseReturnNumber(year, transaction as unknown as typeof prisma);
      const createdBy = this.userIdOrNull(userId);

      const returnRows = await transaction.$queryRaw<{ id: string; purchase_return_number: string }[]>`
        INSERT INTO purchase_returns (
          company_id,
          purchase_return_number,
          purchase_return_date,
          supplier_id,
          supplier_account_id,
          supplier_return_number,
          supplier_return_date,
          payment_type,
          warehouse_id,
          location_id,
          reference_number,
          description,
          status,
          gross_amount,
          discount_amount,
          tax_amount,
          freight_amount,
          net_amount,
          created_by_id,
          updated_by_id,
          updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          ${purchaseReturnNumber},
          CAST(${input.purchase_return_date} AS date),
          CAST(${supplier.id} AS uuid),
          CAST(${supplier.ap_account_id} AS uuid),
          ${input.supplier_return_number?.trim() || null},
          ${input.supplier_return_date ? input.supplier_return_date : null}::date,
          ${input.payment_type},
          CAST(${input.warehouse_id} AS uuid),
          ${validation.location_id}::uuid,
          ${input.reference_number || null},
          ${input.description || null},
          'Draft',
          CAST(${validation.totals.gross_amount} AS numeric),
          CAST(${validation.totals.discount_amount} AS numeric),
          CAST(${validation.totals.tax_amount} AS numeric),
          CAST(${validation.totals.freight_amount} AS numeric),
          CAST(${validation.totals.net_amount} AS numeric),
          ${createdBy}::uuid,
          ${createdBy}::uuid,
          now()
        )
        RETURNING id, purchase_return_number
      `;
      const purchaseReturn = returnRows[0];

      for (const [index, line] of input.lines.entries()) {
        const item = itemMap.get(line.item_id);
        const calculatedLine = validation.lines[index];
        if (!item || !calculatedLine) {
          const error = new Error(`Return item on line ${index + 1} was not found.`);
          Object.assign(error, { statusCode: 400 });
          throw error;
        }

        await transaction.$queryRaw`
          INSERT INTO purchase_return_lines (
            company_id,
            purchase_return_id,
            line_number,
            item_id,
            item_code,
            item_name,
            uom_id,
            uom_name,
            warehouse_id,
            quantity,
            purchase_price,
            discount_amount,
            tax_amount,
            line_total,
            description,
            updated_at
          )
          VALUES (
            CAST(${this.companyId} AS uuid),
            CAST(${purchaseReturn.id} AS uuid),
            ${index + 1},
            CAST(${item.id} AS uuid),
            ${item.item_code},
            ${item.item_name},
            ${item.uom_id}::uuid,
            ${item.uom_name},
            CAST(${line.warehouse_id || input.warehouse_id} AS uuid),
            CAST(${calculatedLine.quantity} AS numeric),
            CAST(${calculatedLine.purchase_price} AS numeric),
            CAST(${calculatedLine.discount_amount} AS numeric),
            CAST(${calculatedLine.tax_amount} AS numeric),
            CAST(${calculatedLine.line_total} AS numeric),
            ${line.description || null},
            now()
          )
        `;
      }

      return { id: purchaseReturn.id, purchase_return_number: purchaseReturn.purchase_return_number };
    });
  }
}
