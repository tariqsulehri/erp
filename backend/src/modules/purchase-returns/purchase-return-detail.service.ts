import { prisma } from '../../db/prisma.js';

export class PurchaseReturnDetailService {
  constructor(private readonly companyId: string) {}

  async getById(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          pr.*,
          s.name AS supplier_name,
          s.code AS supplier_code,
          w.name AS warehouse_name,
          w.code AS warehouse_code,
          wl.name AS location_name,
          wl.code AS location_code,
          v.voucher_number AS accounting_voucher_number
        FROM purchase_returns pr
        JOIN suppliers s ON s.id = pr.supplier_id
        JOIN inventory_warehouses w ON w.id = pr.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = pr.location_id
        LEFT JOIN vouchers v ON v.id = pr.accounting_voucher_id
        WHERE pr.company_id = CAST($1 AS uuid)
          AND pr.id = CAST($2 AS uuid)
        LIMIT 1
      `,
      this.companyId,
      id,
    );

    if (!rows[0]) {
      const error = new Error('Purchase Return was not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    const lines = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT *
        FROM purchase_return_lines
        WHERE company_id = CAST($1 AS uuid)
          AND purchase_return_id = CAST($2 AS uuid)
        ORDER BY line_number ASC
      `,
      this.companyId,
      id,
    );

    return { ...rows[0], lines };
  }
}
