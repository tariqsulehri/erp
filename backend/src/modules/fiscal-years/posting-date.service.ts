import { prisma } from '../../db/prisma.js';

export class PostingDateService {
  constructor(private readonly companyId: string) {}

  async validate(dateText: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        fy.id AS fiscal_year_id,
        fy.fiscal_year,
        fy.is_locked AS fiscal_year_locked,
        fp.id AS period_id,
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

    const row = rows[0];
    if (!row) {
      return {
        canPost: false,
        reason: 'Date does not fall within any active fiscal year',
      };
    }
    if (row.fiscal_year_locked) {
      return {
        canPost: false,
        reason: 'Fiscal year is locked. No new transactions allowed.',
      };
    }
    if (!row.period_id) {
      return {
        canPost: false,
        reason: 'No open period found for this date (beyond posting cutoff)',
      };
    }
    if (!row.is_open) {
      return {
        canPost: false,
        reason: `Period "${row.period_name}" is closed. Cannot post transactions.`,
        period: {
          id: row.period_id,
          period_name: row.period_name,
          is_open: row.is_open,
        },
      };
    }

    return {
      canPost: true,
      period: {
        id: row.period_id,
        period_name: row.period_name,
        is_open: row.is_open,
      },
    };
  }
}
