import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

/**
 * Plain-English default messages for request checks that have no message of their own.
 * Messages written in a schema (e.g. `.min(1, 'Enter a Voucher Date.')`) always win.
 */
export const plainErrorMap: ZodErrorMap = (issue, context) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'This field is required.' };
      return { message: 'This value is not the right kind. Check it and try again.' };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'uuid') return { message: 'This choice is not correct. Select it again.' };
      if (issue.validation === 'email') return { message: 'Enter a correct email address.' };
      if (issue.validation === 'url') return { message: 'Enter a correct web address.' };
      return { message: 'This value is not in the right format.' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: Number(issue.minimum) <= 1 ? 'Enter a value.' : `Enter at least ${issue.minimum} characters.` };
      if (issue.type === 'array') return { message: `Add at least ${issue.minimum}.` };
      if (issue.type === 'number') return { message: issue.inclusive ? `Enter ${issue.minimum} or more.` : `Enter more than ${issue.minimum}.` };
      return { message: 'This value is too small.' };
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Use ${issue.maximum} characters or fewer.` };
      if (issue.type === 'array') return { message: `Add ${issue.maximum} or fewer.` };
      if (issue.type === 'number') return { message: issue.inclusive ? `Enter ${issue.maximum} or less.` : `Enter less than ${issue.maximum}.` };
      return { message: 'This value is too big.' };
    case ZodIssueCode.invalid_enum_value:
      return { message: `Choose one of: ${issue.options.join(', ')}.` };
    case ZodIssueCode.invalid_date:
      return { message: 'Enter a correct date.' };
    case ZodIssueCode.not_multiple_of:
      return { message: `Enter a multiple of ${issue.multipleOf}.` };
    case ZodIssueCode.unrecognized_keys:
      return { message: `Remove these fields: ${issue.keys.join(', ')}.` };
    default:
      return { message: context.defaultError };
  }
};

/** Installs the map for every schema. Called once when the app starts. */
export function usePlainErrorMessages() {
  z.setErrorMap(plainErrorMap);
}
