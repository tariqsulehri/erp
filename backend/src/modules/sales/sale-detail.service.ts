import { prisma } from '../../db/prisma.js';

export class SaleDetailService {
  constructor(private readonly companyId: string) {}

  async getById(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          si.*,
          c.name AS customer_name,
          c.code AS customer_code,
          w.name AS warehouse_name,
          w.code AS warehouse_code,
          wl.name AS location_name,
          wl.code AS location_code,
          v.voucher_number AS accounting_voucher_number
        FROM sale_invoices si
        JOIN customers c ON c.id = si.customer_id
        JOIN inventory_warehouses w ON w.id = si.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = si.location_id
        LEFT JOIN vouchers v ON v.id = si.accounting_voucher_id
        WHERE si.company_id = CAST($1 AS uuid)
          AND si.id = CAST($2 AS uuid)
        LIMIT 1
      `,
      this.companyId,
      id,
    );

    if (!rows[0]) {
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

    return { ...rows[0], lines };
  }
}
