import { prisma } from '../../db/prisma.js';
import { withPaymentStatus } from '../parties/invoice-balances.js';
import type { AccessScope } from '../auth/access-rules.js';
import { holderFromColumns } from '../inventory/stock-holder.js';
import { canUseHolder } from '../inventory/stock-holder-access.js';

export class SaleDetailService {
  constructor(private readonly companyId: string, private readonly scope?: AccessScope) {}

  async getById(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          si.*,
          c.name AS customer_name,
          c.code AS customer_code,
          b.name AS branch_name,
          b.code AS branch_code,
          w.name AS warehouse_name,
          w.code AS warehouse_code,
          wl.name AS location_name,
          wl.code AS location_code,
          v.voucher_number AS accounting_voucher_number
        FROM sale_invoices si
        JOIN customers c ON c.id = si.customer_id
        LEFT JOIN branches b ON b.id = si.branch_id
        LEFT JOIN inventory_warehouses w ON w.id = si.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = si.location_id
        LEFT JOIN vouchers v ON v.id = si.accounting_voucher_id
        WHERE si.company_id = CAST($1 AS uuid)
          AND si.id = CAST($2 AS uuid)
        LIMIT 1
      `,
      this.companyId,
      id,
    );

    // Another Branch's sale is reported as not found, so Branch users cannot read it.
    if (!rows[0] || (this.scope && !canUseHolder(this.scope, holderFromColumns(rows[0].branch_id, rows[0].warehouse_id)))) {
      const error = new Error('Sale Voucher was not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    const lines = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT *
        FROM sale_invoice_lines
        WHERE company_id = CAST($1 AS uuid)
          AND sale_invoice_id = CAST($2 AS uuid)
        ORDER BY line_number ASC
      `,
      this.companyId,
      id,
    );

    const [withPayments] = await withPaymentStatus(this.companyId, 'receivables', [rows[0]], row => row.customer_account_id);
    return { ...withPayments, lines };
  }
}
