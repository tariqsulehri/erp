import { describe, expect, it } from 'vitest';
import { executiveQuerySchema } from '../src/modules/executive-ai/executive-ai.schema.js';

describe('Executive AI Schema & Validation', () => {
  it('validates a proper question', () => {
    const valid = executiveQuerySchema.safeParse({ question: 'What is our current cash position?' });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.question).toBe('What is our current cash position?');
    }
  });

  it('trims whitespace and rejects blank queries', () => {
    const blank = executiveQuerySchema.safeParse({ question: '    ' });
    expect(blank.success).toBe(false);
  });

  it('rejects questions longer than 1000 characters', () => {
    const tooLong = executiveQuerySchema.safeParse({ question: 'a'.repeat(1001) });
    expect(tooLong.success).toBe(false);
  });
});
