import { Prisma } from '@prisma/client';

type NumberClient = Pick<Prisma.TransactionClient, '$executeRaw' | '$queryRaw'>;

/** Document tables and their number columns. Only these can be numbered, so no table name comes from input. */
const documentNumberColumns = {
  vouchers: 'voucher_number',
  purchase_invoices: 'purchase_number',
  purchase_returns: 'purchase_return_number',
  sale_invoices: 'sale_number',
  sale_returns: 'sale_return_number',
  stock_adjustments: 'adjustment_number',
  stock_transfers: 'transfer_number',
} as const;

export type NumberedDocumentTable = keyof typeof documentNumberColumns;

/**
 * Next permanent document number such as `SI-2026-0001`, for use inside the transaction that saves the
 * document. An advisory lock per company and prefix stops two users getting the same number (including the
 * first number of a year), and the sequence is compared as a number so `10000` follows `9999`.
 */
export async function nextDocumentNumber(
  transaction: NumberClient,
  input: { companyId: string; table: NumberedDocumentTable; prefix: string; year: number | string },
) {
  const numberPrefix = `${input.prefix}-${input.year}-`;
  const column = documentNumberColumns[input.table];
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document-number:${input.companyId}:${numberPrefix}`}))`;
  const rows = await transaction.$queryRaw<{ last_sequence: number | null }[]>`
    SELECT MAX(CAST(substring(${Prisma.raw(column)} FROM ${`^${numberPrefix}([0-9]+)$`}) AS integer)) AS last_sequence
    FROM ${Prisma.raw(input.table)}
    WHERE company_id = CAST(${input.companyId} AS uuid)
      AND ${Prisma.raw(column)} LIKE ${`${numberPrefix}%`}
  `;
  const nextSequence = Number(rows[0]?.last_sequence ?? 0) + 1;
  return `${numberPrefix}${String(nextSequence).padStart(4, '0')}`;
}
