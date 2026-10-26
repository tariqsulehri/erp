import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import type { SalesTaxQuery } from './business-report.schema.js';

interface TaxDocumentRow {
  document_type: 'Sale' | 'Sale Return' | 'Purchase' | 'Purchase Return';
  document_id: string;
  document_number: string;
  document_date: Date;
  party_name: string;
  tax_registration_no: string | null;
  taxable_amount: string;
  tax_amount: string;
}

function businessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

/**
 * Sales Tax / VAT summary for a period from posted documents. Output tax = sales minus sale returns,
 * input tax = purchases minus purchase returns, and the difference is the tax payable (or refundable).
 * Taxable amount = gross amount minus discount.
 */
export class SalesTaxReportService {
  constructor(private readonly companyId: string) {}

  async getSalesTax(query: SalesTaxQuery) {
    if (query.date_to < query.date_from) throw businessError('Date To cannot be earlier than Date From.');

    const rows = await prisma.$queryRaw<TaxDocumentRow[]>`
      SELECT 'Sale' AS document_type, si.id::text AS document_id, si.sale_number AS document_number, si.sale_date AS document_date,
             c.name AS party_name, c.tax_registration_no,
             (si.gross_amount - si.discount_amount)::text AS taxable_amount, si.tax_amount::text
      FROM sale_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.company_id = CAST(${this.companyId} AS uuid) AND si.status = 'Posted'
        AND si.sale_date BETWEEN CAST(${query.date_from} AS date) AND CAST(${query.date_to} AS date)
      UNION ALL
      SELECT 'Sale Return', sr.id::text, sr.sale_return_number, sr.sale_return_date, c.name, c.tax_registration_no,
             (sr.gross_amount - sr.discount_amount)::text, sr.tax_amount::text
      FROM sale_returns sr
      JOIN customers c ON c.id = sr.customer_id
      WHERE sr.company_id = CAST(${this.companyId} AS uuid) AND sr.status = 'Posted'
        AND sr.sale_return_date BETWEEN CAST(${query.date_from} AS date) AND CAST(${query.date_to} AS date)
      UNION ALL
      SELECT 'Purchase', pi.id::text, pi.purchase_number, pi.purchase_date, s.name, s.tax_registration_no,
             (pi.gross_amount - pi.discount_amount)::text, pi.tax_amount::text
      FROM purchase_invoices pi
      JOIN suppliers s ON s.id = pi.supplier_id
      WHERE pi.company_id = CAST(${this.companyId} AS uuid) AND pi.status = 'Posted'
        AND pi.purchase_date BETWEEN CAST(${query.date_from} AS date) AND CAST(${query.date_to} AS date)
      UNION ALL
      SELECT 'Purchase Return', pr.id::text, pr.purchase_return_number, pr.purchase_return_date, s.name, s.tax_registration_no,
             (pr.gross_amount - pr.discount_amount)::text, pr.tax_amount::text
      FROM purchase_returns pr
      JOIN suppliers s ON s.id = pr.supplier_id
      WHERE pr.company_id = CAST(${this.companyId} AS uuid) AND pr.status = 'Posted'
        AND pr.purchase_return_date BETWEEN CAST(${query.date_from} AS date) AND CAST(${query.date_to} AS date)
      ORDER BY document_date, document_number
    `;

    const sum = (type: TaxDocumentRow['document_type'], field: 'taxable_amount' | 'tax_amount') =>
      rows.filter(row => row.document_type === type).reduce((total, row) => total.plus(row[field]), new Decimal(0));

    const outputTaxable = sum('Sale', 'taxable_amount').minus(sum('Sale Return', 'taxable_amount'));
    const outputTax = sum('Sale', 'tax_amount').minus(sum('Sale Return', 'tax_amount'));
    const inputTaxable = sum('Purchase', 'taxable_amount').minus(sum('Purchase Return', 'taxable_amount'));
    const inputTax = sum('Purchase', 'tax_amount').minus(sum('Purchase Return', 'tax_amount'));
    const netTax = outputTax.minus(inputTax);

    return {
      date_from: query.date_from,
      date_to: query.date_to,
      summary: {
        output_taxable_amount: outputTaxable.toFixed(2),
        output_tax: outputTax.toFixed(2),
        input_taxable_amount: inputTaxable.toFixed(2),
        input_tax: inputTax.toFixed(2),
        net_tax_payable: netTax.gt(0) ? netTax.toFixed(2) : '0.00',
        net_tax_refundable: netTax.lt(0) ? netTax.abs().toFixed(2) : '0.00',
      },
      // Returns reduce tax, so they are shown as negative amounts.
      documents: rows.map(row => {
        const sign = row.document_type.endsWith('Return') ? -1 : 1;
        return {
          document_type: row.document_type,
          document_id: row.document_id,
          document_number: row.document_number,
          document_date: row.document_date.toISOString().slice(0, 10),
          party_name: row.party_name,
          tax_registration_no: row.tax_registration_no,
          tax_side: row.document_type.startsWith('Sale') ? 'Output' : 'Input',
          taxable_amount: new Decimal(row.taxable_amount).times(sign).toFixed(2),
          tax_amount: new Decimal(row.tax_amount).times(sign).toFixed(2),
        };
      }),
    };
  }
}
