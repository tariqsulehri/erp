import { z } from 'zod';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');
const optionalText = (max = 500) => z.string().trim().max(max).optional().or(z.literal(''));

export const BankAccountInput = z.object({
  code: z.string().trim().min(1, 'Code is required.').max(30),
  ledger_account_id: z.string().uuid(),
  bank_name: z.string().trim().min(1, 'Bank Name is required.').max(150),
  branch_name: optionalText(150),
  branch_code: optionalText(50),
  account_title: z.string().trim().min(1, 'Account Title is required.').max(200),
  account_number: z.string().trim().min(1, 'Account Number is required.').max(80),
  account_type: optionalText(80),
  iban: optionalText(34),
  swift_code: optionalText(20),
  currency_code: z.string().trim().min(3).max(3).default('PKR'),
  opening_balance: z.coerce.number().min(0, 'Opening Balance cannot be negative.').default(0),
  opening_balance_date: dateInput.optional().or(z.literal('')),
  contact_name: optionalText(150),
  address: optionalText(1000),
  post_code: optionalText(30),
  country: optionalText(100),
  city: optionalText(100),
  area: optionalText(100),
  phone_1: optionalText(40),
  phone_2: optionalText(40),
  mobile_number: optionalText(40),
  fax_number: optionalText(40),
  email: z.string().trim().email('Email is not valid.').max(120).optional().or(z.literal('')),
  website: optionalText(200),
  notes: optionalText(1000),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const BankAccountUpdateInput = BankAccountInput.partial().extend({
  code: z.string().trim().min(1, 'Code is required.').max(30).optional(),
  ledger_account_id: z.string().uuid().optional(),
  bank_name: z.string().trim().min(1, 'Bank Name is required.').max(150).optional(),
  account_title: z.string().trim().min(1, 'Account Title is required.').max(200).optional(),
  account_number: z.string().trim().min(1, 'Account Number is required.').max(80).optional(),
});

export const ListBankAccountsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const idParams = z.object({ id: z.string().uuid() });

export type BankAccountInput = z.infer<typeof BankAccountInput>;
export type BankAccountUpdateInput = z.infer<typeof BankAccountUpdateInput>;
export type ListBankAccountsQuery = z.infer<typeof ListBankAccountsQuery>;
