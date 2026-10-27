import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { allocateOldestFirst } from '../src/modules/parties/invoice-balances.js';

const charge = (key: string, amount: number) => ({ key, amount: new Decimal(amount) });
const plain = (result: ReturnType<typeof allocateOldestFirst>) => ({
  byCharge: Object.fromEntries([...result.byCharge].map(([key, value]) => [key, [value.paid.toFixed(2), value.open.toFixed(2)]])),
  advance: result.advance.toFixed(2),
});

describe('allocateOldestFirst', () => {
  it('pays the oldest charge in full before the next one', () => {
    expect(plain(allocateOldestFirst([charge('a', 100), charge('b', 50), charge('c', 30)], new Decimal(120)))).toEqual({
      byCharge: { a: ['100.00', '0.00'], b: ['20.00', '30.00'], c: ['0.00', '30.00'] },
      advance: '0.00',
    });
  });

  it('keeps a payment larger than all charges as Advance', () => {
    expect(plain(allocateOldestFirst([charge('a', 40)], new Decimal(55)))).toEqual({ byCharge: { a: ['40.00', '0.00'] }, advance: '15.00' });
  });

  it('leaves everything open when nothing is paid, and treats a negative payment as nothing', () => {
    expect(plain(allocateOldestFirst([charge('a', 10)], new Decimal(0)))).toEqual({ byCharge: { a: ['0.00', '10.00'] }, advance: '0.00' });
    expect(plain(allocateOldestFirst([charge('a', 10)], new Decimal(-5)))).toEqual({ byCharge: { a: ['0.00', '10.00'] }, advance: '0.00' });
  });

  it('copes with no charges', () => {
    expect(plain(allocateOldestFirst([], new Decimal(7)))).toEqual({ byCharge: {}, advance: '7.00' });
  });
});
