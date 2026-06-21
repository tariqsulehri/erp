import { prisma } from '../../db/prisma.js';

export class SaleReturnDetailService {
  constructor(private readonly companyId: string) {}

  async getById(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          sr.*,
          c.name AS customer_name,
          c.code AS customer_code,
          w.name AS warehouse_name,
          w.code AS warehouse_code,
          wl.name AS location_name,
          wl.code AS location_code,
          v.voucher_number AS accounting_voucher_number
        FROM sale_returns sr
        JOIN customers c ON c.id = sr.customer_id
        JOIN inventory_warehouses w ON w.id = sr.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = sr.location_id
        LEFT JOIN vouchers v ON v.id = sr.accounting_voucher_id
        WHERE sr.company_id = CAST($1 AS uuid)
          AND sr.id = CAST($2 AS uuid)
        LIMIT 1
      `,
      this.companyId,
      id,
    );

    if (!rows[0]) {
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
