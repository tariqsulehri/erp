import { z } from 'zod';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');
const optionalText = (max = 500) => z.string().trim().max(max).optional().or(z.literal(''));
const chequeNumber = z.string().trim().regex(/^\d+$/, 'Cheque number must use digits only.').min(1).max(20);

export const chequeStatuses = ['Available', 'Reserved', 'Issued', 'Cleared', 'Bounced', 'Void', 'Cancelled', 'Stopped'] as const;
export const chequeBookStatuses = ['Active', 'Closed'] as const;
export const voidReasons = ['Torn', 'Text Not Clear', 'Writing Mistake', 'Cancelled', 'Printer Error', 'Other'] as const;

export const CreateChequeBookInput = z.object({
  bank_account_id: z.string().uuid(),
  book_number: z.string().trim().min(1, 'Cheque Book Number is required.').max(80),
  prefix: optionalText(20),
  suffix: optionalText(20),
  start_cheque_number: chequeNumber,
  end_cheque_number: chequeNumber,
  issued_date: dateInput.optional().or(z.literal('')),
  received_date: dateInput.optional().or(z.literal('')),
  notes: optionalText(1000),
});

export const ListChequeBooksQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  bank_account_id: z.string().uuid().optional(),
  status: z.enum(chequeBookStatuses).optional(),
  search: z.string().trim().optional(),
});

export const ListChequesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  bank_account_id: z.string().uuid().optional(),
  cheque_book_id: z.string().uuid().optional(),
  status: z.enum(chequeStatuses).optional(),
  search: z.string().trim().optional(),
});

export const AvailableChequesQuery = z.object({
  bank_account_id: z.string().uuid(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const VoidChequeInput = z.object({
  reason: z.enum(voidReasons),
  notes: optionalText(1000),
});

export const IssueChequeInput = z.object({
  issue_date: dateInput,
  payee_name: z.string().trim().min(1, 'Payee Name is required.').max(200),
  payment_reference: optionalText(120),
  amount: z.coerce.number().positive('Amount must be greater than zero.'),
});

export const idParams = z.object({ id: z.string().uuid() });

export type CreateChequeBookInput = z.infer<typeof CreateChequeBookInput>;
export type ListChequeBooksQuery = z.infer<typeof ListChequeBooksQuery>;
export type ListChequesQuery = z.infer<typeof ListChequesQuery>;
export type AvailableChequesQuery = z.infer<typeof AvailableChequesQuery>;
export type VoidChequeInput = z.infer<typeof VoidChequeInput>;
export type IssueChequeInput = z.infer<typeof IssueChequeInput>;
