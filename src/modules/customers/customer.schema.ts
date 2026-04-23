import { z } from 'zod';

export const CUSTOMER_TYPES = ['individual', 'company', 'government'] as const;
export type CustomerType = typeof CUSTOMER_TYPES[number];

export const PAYMENT_TERMS = [7, 14, 30, 45, 60, 90, 120] as const;

/* ── Create ───────────────────────────────────────────────────── */
export const CreateCustomerInput = z.object({
  code:                z.string().min(1).max(20).toUpperCase().optional(), // auto if omitted
  name:                z.string().min(1).max(200).trim(),
  trade_name:          z.string().max(200).trim().optional(),
  customer_type:       z.enum(CUSTOMER_TYPES).default('company'),
  tax_registration_no: z.string().max(50).trim().optional(),

  email:    z.string().email().optional().or(z.literal('')),
  phone:    z.string().max(30).optional(),
  mobile:   z.string().max(30).optional(),

  billing_address:  z.string().max(500).optional(),
  shipping_address: z.string().max(500).optional(),
  city:             z.string().max(100).optional(),
  country:          z.string().max(100).optional(),
  postal_code:      z.string().max(20).optional(),

  payment_terms_days: z.number().int().min(0).max(365).default(30),
  credit_limit:       z.number().min(0).default(0),
  currency_code:      z.string().length(3).toUpperCase().default('USD'),

  ar_account_id:      z.string().uuid().optional(),
  advance_account_id: z.string().uuid().optional(),

  is_active: z.boolean().default(true),
  notes:     z.string().max(1000).optional(),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;

/* ── Update ───────────────────────────────────────────────────── */
export const UpdateCustomerInput = CreateCustomerInput.partial().extend({
  id: z.string().uuid(),
});
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;

/* ── List / filter query ──────────────────────────────────────── */
export const ListCustomersQuery = z.object({
  search:       z.string().optional(),
  customer_type: z.enum(CUSTOMER_TYPES).optional(),
  is_active:    z.boolean().optional(),
  page:         z.number().int().min(1).default(1),
  limit:        z.number().int().min(1).max(200).default(50),
});
export type ListCustomersQuery = z.infer<typeof ListCustomersQuery>;
