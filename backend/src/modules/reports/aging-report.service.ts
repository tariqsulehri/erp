import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { dateOnlyText, signedOpeningBalance } from '../accounts/account-balance.js';
import type { AgingQuery } from './business-report.schema.js';

const BUCKETS = [
  { key: 'days_0_30', label: '0 - 30 Days', maxDays: 30 },
  { key: 'days_31_60', label: '31 - 60 Days', maxDays: 60 },
  { key: 'days_61_90', label: '61 - 90 Days', maxDays: 90 },
  { key: 'over_90', label: 'Over 90 Days', maxDays: Number.POSITIVE_INFINITY },
] as const;

type BucketKey = (typeof BUCKETS)[number]['key'];

interface PartyAccountRow {
  party_id: string;
  party_code: string;
  party_name: string;
  account_id: string;
  account_code: string;
  account_name: string;
  normal_balance: string;
  opening_balance: string | null;
  opening_balance_date: Date | null;
}

interface MovementRow {
  account_id: string;
  voucher_date: Date;
  debit: string;
  credit: string;
}

function daysBetween(fromText: string, toText: string) {
  return Math.floor((Date.parse(`${toText}T00:00:00Z`) - Date.parse(`${fromText}T00:00:00Z`)) / 86_400_000);
}

/**
 * Receivables / Payables Aging from each party's linked account.
 * Amounts that increase what the party owes (or what we owe) are matched first-in, first-out against
 * amounts that reduce it, and whatever is left open is aged by its posting date. A party that has paid
 * more than it owes shows the extra as Advance.
 */
export class AgingReportService {
  constructor(private readonly companyId: string) {}

  async getAging(query: AgingQuery) {
    const receivables = query.kind === 'receivables';
    const parties = receivables
      ? await prisma.$queryRaw<PartyAccountRow[]>`
          SELECT c.id::text AS party_id, c.code AS party_code, c.name AS party_name,
                 a.id::text AS account_id, a.code AS account_code, a.name AS account_name, a.normal_balance,
                 a.opening_balance::text, a.opening_balance_date
          FROM customers c
          JOIN accounts a ON a.id = c.ar_account_id AND a.company_id = c.company_id
          WHERE c.company_id = CAST(${this.companyId} AS uuid)
          ORDER BY c.name`
      : await prisma.$queryRaw<PartyAccountRow[]>`
          SELECT s.id::text AS party_id, s.code AS party_code, s.name AS party_name,
                 a.id::text AS account_id, a.code AS account_code, a.name AS account_name, a.normal_balance,
                 a.opening_balance::text, a.opening_balance_date
          FROM suppliers s
          JOIN accounts a ON a.id = s.ap_account_id AND a.company_id = s.company_id
          WHERE s.company_id = CAST(${this.companyId} AS uuid)
          ORDER BY s.name`;

    const accountIds = [...new Set(parties.map(party => party.account_id))];
    const movements = accountIds.length
      ? await prisma.$queryRaw<MovementRow[]>`
          SELECT vl.account_id::text, v.voucher_date, SUM(vl.dr_amount)::text AS debit, SUM(vl.cr_amount)::text AS credit
          FROM voucher_lines vl
          JOIN vouchers v ON v.id = vl.voucher_id AND v.company_id = vl.company_id
          WHERE vl.company_id = CAST(${this.companyId} AS uuid)
            AND v.status = 'Posted'
            AND v.voucher_date <= CAST(${query.as_of_date} AS date)
            AND vl.account_id IN (${Prisma.join(accountIds.map(id => Prisma.sql`CAST(${id} AS uuid)`))})
          GROUP BY vl.account_id, v.voucher_date
          ORDER BY v.voucher_date`
      : [];

    const movementsByAccount = new Map<string, MovementRow[]>();
    for (const row of movements) {
      const list = movementsByAccount.get(row.account_id) ?? [];
      list.push(row);
      movementsByAccount.set(row.account_id, list);
    }

    const zeroBuckets = () => Object.fromEntries(BUCKETS.map(bucket => [bucket.key, new Decimal(0)])) as Record<BucketKey, Decimal>;
    const totals = { ...zeroBuckets(), advance: new Decimal(0), balance: new Decimal(0) };

    const rows = parties.map(party => {
      // "Increase" is a debit for receivables and a credit for payables.
      const charges: Array<{ date: string; amount: Decimal }> = [];
      let reductions = new Decimal(0);

      const openingDateText = party.opening_balance_date ? dateOnlyText(party.opening_balance_date) : null;
      if (!openingDateText || openingDateText <= query.as_of_date) {
        const debitOpening = signedOpeningBalance(party.opening_balance, party.normal_balance);
        const increase = receivables ? debitOpening : debitOpening.negated();
        if (increase.gt(0)) charges.push({ date: openingDateText ?? '1900-01-01', amount: increase });
        else if (increase.lt(0)) reductions = reductions.plus(increase.abs());
      }

      for (const movement of movementsByAccount.get(party.account_id) ?? []) {
        const date = dateOnlyText(movement.voucher_date);
        const increase = new Decimal(receivables ? movement.debit : movement.credit);
        const decrease = new Decimal(receivables ? movement.credit : movement.debit);
        if (increase.gt(0)) charges.push({ date, amount: increase });
        reductions = reductions.plus(decrease);
      }

      const buckets = zeroBuckets();
      let remaining = reductions;
      for (const charge of charges) {
        const applied = Decimal.min(remaining, charge.amount);
        remaining = remaining.minus(applied);
        const open = charge.amount.minus(applied);
        if (open.lte(0)) continue;
        const age = daysBetween(charge.date, query.as_of_date);
        const bucket = BUCKETS.find(item => age <= item.maxDays) ?? BUCKETS[BUCKETS.length - 1];
        buckets[bucket.key] = buckets[bucket.key].plus(open);
      }
      const advance = remaining;
      const balance = BUCKETS.reduce((sum, bucket) => sum.plus(buckets[bucket.key]), new Decimal(0)).minus(advance);

      for (const bucket of BUCKETS) totals[bucket.key] = totals[bucket.key].plus(buckets[bucket.key]);
      totals.advance = totals.advance.plus(advance);
      totals.balance = totals.balance.plus(balance);

      return {
        party_id: party.party_id,
        party_code: party.party_code,
        party_name: party.party_name,
        account_id: party.account_id,
        account_code: party.account_code,
        ...Object.fromEntries(BUCKETS.map(bucket => [bucket.key, buckets[bucket.key].toFixed(2)])),
        advance: advance.toFixed(2),
        balance: balance.toFixed(2),
      };
    }).filter(row => !new Decimal(row.balance).isZero() || !new Decimal(row.advance).isZero());

    return {
      kind: query.kind,
      as_of_date: query.as_of_date,
      buckets: BUCKETS.map(bucket => ({ key: bucket.key, label: bucket.label })),
      totals: {
        ...Object.fromEntries(BUCKETS.map(bucket => [bucket.key, totals[bucket.key].toFixed(2)])),
        advance: totals.advance.toFixed(2),
        balance: totals.balance.toFixed(2),
      },
      rows,
    };
  }
}
