import { Decimal } from 'decimal.js';

/** Debit-positive balance: Credit-nature opening balances are stored as positive numbers and negated here. */
export function signedOpeningBalance(openingBalance: unknown, normalBalance: string) {
  const amount = new Decimal(String(openingBalance ?? '0'));
  return normalBalance === 'Credit' ? amount.negated() : amount;
}

export function dateOnlyText(value: Date) {
  return value.toISOString().slice(0, 10);
}

/**
 * Places an account opening balance in a report range. Dated on or before Date From, it is part of
 * the Opening column; dated inside the range, it is a movement of that period; dated after Date To,
 * it is not part of the report yet.
 */
export function openingBalanceForRange(
  account: { openingBalance: unknown; normalBalance: string; openingBalanceDate: Date | null },
  dateFromText: string,
  dateToText: string,
) {
  const signed = signedOpeningBalance(account.openingBalance, account.normalBalance);
  const openingDateText = account.openingBalanceDate ? dateOnlyText(account.openingBalanceDate) : null;
  const zero = new Decimal(0);

  if (!openingDateText || openingDateText <= dateFromText) {
    return { opening: signed, periodDebit: zero, periodCredit: zero, openingDateText };
  }
  if (openingDateText <= dateToText) {
    return {
      opening: zero,
      periodDebit: signed.gt(0) ? signed : zero,
      periodCredit: signed.lt(0) ? signed.abs() : zero,
      openingDateText,
    };
  }
  return { opening: zero, periodDebit: zero, periodCredit: zero, openingDateText };
}

/** Opening balance included in a balance as of the given date. */
export function openingBalanceAsOf(
  account: { openingBalance: unknown; normalBalance: string; openingBalanceDate: Date | null },
  asOfDateText: string,
) {
  const openingDateText = account.openingBalanceDate ? dateOnlyText(account.openingBalanceDate) : null;
  if (openingDateText && openingDateText > asOfDateText) return new Decimal(0);
  return signedOpeningBalance(account.openingBalance, account.normalBalance);
}
