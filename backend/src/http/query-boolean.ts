import { z } from 'zod';

/**
 * Boolean query-string filter: "true"/"false" (or real booleans) become true/false.
 * z.coerce.boolean() must not be used for this, because Boolean("false") is true.
 */
export const queryBoolean = z.preprocess(value => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
}, z.boolean());
