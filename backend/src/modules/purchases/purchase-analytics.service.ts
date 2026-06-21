import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

export const PurchaseAnalyticsQuery = z.object({
  supplier_id: z.string().uuid().optional(),
  payment_type: z.enum(['Cash', 'Credit']).optional(),
  warehouse_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export type PurchaseAnalyticsQuery = z.infer<typeof PurchaseAnalyticsQuery>;

export class PurchaseAnalyticsService {
  constructor(private readonly companyId: string) {}

  async analytics(query: PurchaseAnalyticsQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['pi.company_id = CAST($1 AS uuid)', "pi.status = 'Posted'"];

    if (query.supplier_id) {
      params.push(query.supplier_id);
      where.push(`pi.supplier_id = CAST($${params.length} AS uuid)`);
    }
    if (query.payment_type) {
      params.push(query.payment_type);
      where.push(`pi.payment_type = $${params.length}`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`pi.warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`pi.purchase_date >= CAST($${params.length} AS date)`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`pi.purchase_date <= CAST($${params.length} AS date)`);
    }

    const whereSql = where.join(' AND ');

    const summaryRows = await prisma.$queryRawUnsafe(
      `
        SELECT
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.gross_amount), 0)::text AS gross_amount,
          COALESCE(SUM(pi.discount_amount), 0)::text AS discount_amount,
          COALESCE(SUM(pi.tax_amount), 0)::text AS tax_amount,
          COALESCE(SUM(pi.freight_amount), 0)::text AS freight_amount,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount,
          COALESCE(AVG(pi.net_amount), 0)::text AS average_invoice_amount
        FROM purchase_invoices pi
        WHERE ${whereSql}
      `,
      ...params,
    );

    const monthlyPurchases = await prisma.$queryRawUnsafe(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', pi.purchase_date), 'YYYY-MM') AS month_key,
          TO_CHAR(DATE_TRUNC('month', pi.purchase_date), 'Mon YYYY') AS month_label,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.gross_amount), 0)::text AS gross_amount,
          COALESCE(SUM(pi.discount_amount), 0)::text AS discount_amount,
          COALESCE(SUM(pi.tax_amount), 0)::text AS tax_amount,
          COALESCE(SUM(pi.freight_amount), 0)::text AS freight_amount,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount,
          COALESCE(SUM(CASE WHEN pi.payment_type = 'Cash' THEN pi.net_amount ELSE 0 END), 0)::text AS cash_amount,
          COALESCE(SUM(CASE WHEN pi.payment_type = 'Credit' THEN pi.net_amount ELSE 0 END), 0)::text AS credit_amount,
          COALESCE(AVG(pi.net_amount), 0)::text AS average_invoice_amount
        FROM purchase_invoices pi
        WHERE ${whereSql}
        GROUP BY DATE_TRUNC('month', pi.purchase_date)
        ORDER BY DATE_TRUNC('month', pi.purchase_date)
      `,
      ...params,
    );

    const supplierSummary = await prisma.$queryRawUnsafe(
      `
        SELECT
          s.id AS supplier_id,
          s.code AS supplier_code,
          s.name AS supplier_name,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        WHERE ${whereSql}
        GROUP BY s.id, s.code, s.name
        ORDER BY COALESCE(SUM(pi.net_amount), 0) DESC, s.name ASC
        LIMIT 10
      `,
      ...params,
    );

    const warehouseSummary = await prisma.$queryRawUnsafe(
      `
        SELECT
          w.id AS warehouse_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount
        FROM purchase_invoices pi
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        WHERE ${whereSql}
        GROUP BY w.id, w.code, w.name
        ORDER BY COALESCE(SUM(pi.net_amount), 0) DESC, w.code ASC
      `,
      ...params,
    );

    const paymentTypeSummary = await prisma.$queryRawUnsafe(
      `
        SELECT
          pi.payment_type,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount
        FROM purchase_invoices pi
        WHERE ${whereSql}
        GROUP BY pi.payment_type
        ORDER BY pi.payment_type ASC
      `,
      ...params,
    );

    return {
      summary: Array.isArray(summaryRows)
        ? summaryRows[0] ?? {
          purchase_count: 0,
          gross_amount: '0',
          discount_amount: '0',
          tax_amount: '0',
          freight_amount: '0',
          net_amount: '0',
          average_invoice_amount: '0',
        }
        : null,
      monthlyPurchases,
      supplierSummary,
      warehouseSummary,
      paymentTypeSummary,
    };
  }
}
