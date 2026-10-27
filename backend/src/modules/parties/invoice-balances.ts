import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { signedOpeningBalance } from '../accounts/account-balance.js';

export interface Charge {
  key: string;
  amount: Decimal;
}

/**
 * Applies payments to charges oldest first: each charge (in the given order) takes as much of the paid
 * amount as it can until the payments run out. Returns what each charge received and what is still open,
 * plus any payment left over (an Advance).
 */
export function allocateOldestFirst(charges: Charge[], payments: Decimal) {
  let remaining = Decimal.max(payments, 0);
  const result = new Map<string, { paid: Decimal; open: Decimal }>();
  for (const charge of charges) {
    const paid = Decimal.min(remaining, charge.amount);
    remaining = remaining.minus(paid);
    result.set(charge.key, { paid, open: charge.amount.minus(paid) });
  }
  return { byCharge: result, advance: remaining };
}

interface AccountRow {
  id: string;
  normal_balance: string;
  opening_balance: string | null;
}

interface VoucherMovementRow {
  account_id: string;
  voucher_id: string;
  debit: string;
  credit: string;
}

/**
 * Paid and Balance Due of each posted credit invoice voucher on the given party linked accounts.
 * Receipts, payments, returns and other entries that reduce what a party owes are applied to the oldest
 * amounts first (opening balance, then vouchers by date and number), as the Aging report does.
 * `side` is 'receivables' for customers (debits raise the balance) and 'payables' for suppliers.
 */
export async function invoiceBalances(companyId: string, side: 'receivables' | 'payables', accountIds: string[]) {
  const balances = new Map<string, { paid: Decimal; balance: Decimal }>();
  const ids = [...new Set(accountIds.filter(Boolean))];
  if (!ids.length) return balances;
  const idList = Prisma.join(ids.map(id => Prisma.sql`CAST(${id} AS uuid)`));

  const [accounts, movements] = await Promise.all([
    prisma.$queryRaw<AccountRow[]>`
      SELECT id::text, normal_balance, opening_balance::text
      FROM accounts
      WHERE company_id = CAST(${companyId} AS uuid) AND id IN (${idList})
    `,
    prisma.$queryRaw<VoucherMovementRow[]>`
      SELECT vl.account_id::text, v.id::text AS voucher_id, SUM(vl.dr_amount)::text AS debit, SUM(vl.cr_amount)::text AS credit
      FROM voucher_lines vl
      JOIN vouchers v ON v.id = vl.voucher_id AND v.company_id = vl.company_id
      WHERE vl.company_id = CAST(${companyId} AS uuid)
        AND v.status = 'Posted'
        AND vl.account_id IN (${idList})
      GROUP BY vl.account_id, v.id, v.voucher_date, v.voucher_number
      ORDER BY v.voucher_date, v.voucher_number
    `,
  ]);

  for (const account of accounts) {
    const charges: Charge[] = [];
    let payments = new Decimal(0);

    // An opening balance owed is the oldest charge; an opening balance in the party's favour counts as paid.
    const debitOpening = signedOpeningBalance(account.opening_balance, account.normal_balance);
    const openingIncrease = side === 'receivables' ? debitOpening : debitOpening.negated();
    if (openingIncrease.gt(0)) charges.push({ key: `opening:${account.id}`, amount: openingIncrease });
    else payments = payments.plus(openingIncrease.abs());

    for (const movement of movements.filter(row => row.account_id === account.id)) {
      const increase = new Decimal(side === 'receivables' ? movement.debit : movement.credit);
      const decrease = new Decimal(side === 'receivables' ? movement.credit : movement.debit);
      if (increase.gt(0)) charges.push({ key: movement.voucher_id, amount: increase });
      payments = payments.plus(decrease);
    }

    for (const [key, { paid, open }] of allocateOldestFirst(charges, payments).byCharge) {
      if (!key.startsWith('opening:')) balances.set(key, { paid, balance: open });
    }
  }
  return balances;
}

interface InvoiceRow {
  status: string;
  payment_type: string;
  net_amount: unknown;
  accounting_voucher_id?: string | null;
}

/**
 * Adds paid_amount and balance_due to invoice rows: a posted Credit invoice uses its share of the party's
 * payments (oldest first); a posted Cash invoice is fully paid; drafts and cancelled documents show neither.
 */
export async function withPaymentStatus<T extends InvoiceRow>(
  companyId: string,
  side: 'receivables' | 'payables',
  rows: T[],
  partyAccountOf: (row: T) => string | null | undefined,
) {
  const credit = rows.filter(row => row.status === 'Posted' && row.payment_type === 'Credit' && row.accounting_voucher_id);
  const balances = await invoiceBalances(companyId, side, credit.map(row => partyAccountOf(row) ?? ''));
  return rows.map(row => {
    if (row.status !== 'Posted') return { ...row, paid_amount: null, balance_due: null };
    if (row.payment_type !== 'Credit') return { ...row, paid_amount: new Decimal(String(row.net_amount)).toFixed(2), balance_due: '0.00' };
    const entry = row.accounting_voucher_id ? balances.get(row.accounting_voucher_id) : undefined;
    return {
      ...row,
      paid_amount: (entry?.paid ?? new Decimal(0)).toFixed(2),
      balance_due: (entry?.balance ?? new Decimal(String(row.net_amount))).toFixed(2),
    };
  });
}
