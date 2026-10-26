import { prisma } from '../../db/prisma.js';
import type { AccessScope } from '../auth/access-rules.js';
import { holderFromColumns } from '../inventory/stock-holder.js';
import { canUseHolder } from '../inventory/stock-holder-access.js';

export class SaleReturnDetailService {
  constructor(private readonly companyId: string, private readonly scope?: AccessScope) {}

  async getById(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          sr.*,
          c.name AS customer_name,
          c.code AS customer_code,
          b.name AS branch_name,
          b.code AS branch_code,
          w.name AS warehouse_name,
          w.code AS warehouse_code,
          wl.name AS location_name,
          wl.code AS location_code,
          v.voucher_number AS accounting_voucher_number
        FROM sale_returns sr
        JOIN customers c ON c.id = sr.customer_id
        LEFT JOIN branches b ON b.id = sr.branch_id
        LEFT JOIN inventory_warehouses w ON w.id = sr.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = sr.location_id
        LEFT JOIN vouchers v ON v.id = sr.accounting_voucher_id
        WHERE sr.company_id = CAST($1 AS uuid)
          AND sr.id = CAST($2 AS uuid)
        LIMIT 1
      `,
      this.companyId,
      id,
    );

    // Another Branch's return is reported as not found, so Branch users cannot read it.
    if (!rows[0] || (this.scope && !canUseHolder(this.scope, holderFromColumns(rows[0].branch_id, rows[0].warehouse_id)))) {
      const error = new Error('Sale Return was not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    const lines = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT *
        FROM sale_return_lines
        WHERE company_id = CAST($1 AS uuid)
          AND sale_return_id = CAST($2 AS uuid)
        ORDER BY line_number ASC
      `,
      this.companyId,
      id,
    );

    return { ...rows[0], lines };
  }
}
