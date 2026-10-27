import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { plainErrorMap } from '../src/http/plain-error-map.js';

const message = (schema: z.ZodTypeAny, value: unknown) => {
  const result = schema.safeParse(value, { errorMap: plainErrorMap });
  if (result.success) throw new Error('expected a failure');
  return result.error.issues[0].message;
};

describe('plain-English default validation messages', () => {
  it('replaces the library wording with everyday words', () => {
    expect(message(z.object({ name: z.string() }), {})).toBe('This field is required.');
    expect(message(z.string(), 5)).toBe('This value is not the right kind. Check it and try again.');
    expect(message(z.string().uuid(), 'abc')).toBe('This choice is not correct. Select it again.');
    expect(message(z.string().email(), 'abc')).toBe('Enter a correct email address.');
    expect(message(z.string().regex(/^\d+$/), 'abc')).toBe('This value is not in the right format.');
    expect(message(z.string().min(1), '')).toBe('Enter a value.');
    expect(message(z.string().min(8), 'abc')).toBe('Enter at least 8 characters.');
    expect(message(z.string().max(3), 'abcd')).toBe('Use 3 characters or fewer.');
    expect(message(z.number().min(1), 0)).toBe('Enter 1 or more.');
    expect(message(z.number().positive(), 0)).toBe('Enter more than 0.');
    expect(message(z.number().max(10), 11)).toBe('Enter 10 or less.');
    expect(message(z.array(z.string()).min(1), [])).toBe('Add at least 1.');
    expect(message(z.enum(['Cash', 'Credit']), 'Card')).toBe('Choose one of: Cash, Credit.');
    expect(message(z.date(), new Date('x'))).toBe('Enter a correct date.');
  });

  it('keeps a message written in the schema', () => {
    expect(message(z.string().min(1, 'Enter a Voucher Date.'), '')).toBe('Enter a Voucher Date.');
  });
});
