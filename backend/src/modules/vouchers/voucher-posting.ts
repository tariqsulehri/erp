import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { nextDocumentNumber } from '../numbering/document-number.js';

type TransactionClient = Prisma.TransactionClient;

export interface PostingAccount {
  id: string;
  code: string;
  name: string;
}

export interface PostingLine {
  account: PostingAccount;
  debit: Decimal;
  credit: Decimal;
  narration: string;
}

export interface PostedVoucherInput {
  companyId: string;
  voucherNumber: string;
  voucherType: string;
  voucherDate: string;
  reference: string | null;
  narration: string;
  userId: string | null;
  lines: PostingLine[];
  reversalOfId?: string | null;
}

function postingError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

export function postingMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Drops empty lines, rounds every amount to 2 decimals and checks that
 * total debit equals total credit exactly. Voucher header totals must come from these sums.
 */
export function balancedVoucherLines(lines: PostingLine[]) {
  const cleanLines = lines
    .map(line => ({ ...line, debit: postingMoney(line.debit), credit: postingMoney(line.credit) }))
    .filter(line => !line.debit.isZero() || !line.credit.isZero());

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);
  for (const line of cleanLines) {
    if (line.debit.lt(0) || line.credit.lt(0)) {
      throw postingError(`Voucher line for account ${line.account.code} cannot have a negative amount.`);
    }
    if (line.debit.gt(0) && line.credit.gt(0)) {
      throw postingError(`Voucher line for account ${line.account.code} cannot have both Debit and Credit.`);
    }
    totalDebit = totalDebit.plus(line.debit);
    totalCredit = totalCredit.plus(line.credit);
  }

  if (cleanLines.length < 2 || totalDebit.isZero()) {
    throw postingError('Voucher must have at least one Debit line and one Credit line.');
  }
  if (!totalDebit.eq(totalCredit)) {
    throw postingError(`Voucher is not balanced. Debit ${totalDebit.toFixed(2)} does not match Credit ${totalCredit.toFixed(2)}.`);
  }

  return { lines: cleanLines, totalDebit, totalCredit };
}

/** Next voucher number such as `RV-2026-0001`, safe under concurrent posting. */
export async function nextVoucherNumber(transaction: TransactionClient, companyId: string, prefix: string, year: number) {
  return nextDocumentNumber(transaction, { companyId, table: 'vouchers', prefix, year });
}

/** Inserts a Posted voucher and its lines in the caller's transaction and returns the new voucher id. */
export async function insertPostedVoucher(transaction: TransactionClient, input: PostedVoucherInput) {
  const { lines, totalDebit, totalCredit } = balancedVoucherLines(input.lines);

  const voucherRows = await transaction.$queryRaw<{ id: string }[]>`
    INSERT INTO vouchers (
      company_id,
      voucher_number,
      voucher_type,
      voucher_date,
      reference,
      narration,
      status,
      approval_status,
      total_debit,
      total_credit,
      created_by,
      posted_by,
      posted_at,
      reversal_of_id,
      reversal_status,
      updated_at
    )
    VALUES (
      CAST(${input.companyId} AS uuid),
      ${input.voucherNumber},
      ${input.voucherType},
      CAST(${input.voucherDate} AS date),
      ${input.reference},
      ${input.narration},
      'Posted',
      'Approved',
      CAST(${totalDebit.toFixed(2)} AS numeric),
      CAST(${totalCredit.toFixed(2)} AS numeric),
      ${input.userId}::uuid,
      ${input.userId}::uuid,
      now(),
      ${input.reversalOfId ?? null}::uuid,
      ${input.reversalOfId ? 'Reversal' : 'None'},
      now()
    )
    RETURNING id
  `;
  const voucherId = voucherRows[0].id;

  for (const [index, line] of lines.entries()) {
    await transaction.$executeRaw`
      INSERT INTO voucher_lines (
        voucher_id,
        company_id,
        account_id,
        account_code,
        account_name,
        dr_amount,
        cr_amount,
        narration,
        line_no
      )
      VALUES (
        CAST(${voucherId} AS uuid),
        CAST(${input.companyId} AS uuid),
        CAST(${line.account.id} AS uuid),
        ${line.account.code},
        ${line.account.name},
        CAST(${line.debit.toFixed(2)} AS numeric),
        CAST(${line.credit.toFixed(2)} AS numeric),
        ${line.narration},
        ${index + 1}
      )
    `;
  }

  return voucherId;
}
