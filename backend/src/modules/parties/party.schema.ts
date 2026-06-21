import { z } from 'zod';

export const partyBusinessTypeSchema = z.enum(['individual', 'company', 'government']);
export const partyRoleSchema = z.enum(['Customer', 'Supplier', 'Customer And Supplier']);
export const mainRoleSchema = z.enum(['Customer', 'Supplier']);

const optionalText = (maxLength: number) => z.string().trim().max(maxLength).optional();
const optionalEmail = z.string().trim().email().optional().or(z.literal(''));

export const partyListQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: partyBusinessTypeSchema.optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const customerInputSchema = z.object({
  code: optionalText(20),
  name: z.string().trim().min(1).max(200),
  trade_name: optionalText(200),
  customer_type: partyBusinessTypeSchema.default('company'),
  party_type: z.enum(['Customer', 'Customer And Supplier']).default('Customer'),
  main_role: z.literal('Customer').default('Customer'),
  tax_registration_no: optionalText(50),
  email: optionalEmail,
  phone: optionalText(30),
  mobile: optionalText(30),
  billing_address: optionalText(500),
  shipping_address: optionalText(500),
  city: optionalText(100),
  country: optionalText(100),
  postal_code: optionalText(20),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  credit_limit: z.number().min(0).default(0),
  currency_code: z.string().trim().length(3).transform(value => value.toUpperCase()).default('PKR'),
  ar_account_id: z.string().uuid().optional(),
  advance_account_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
  notes: optionalText(1000),
});

export const updateCustomerInputSchema = customerInputSchema.partial();

export const supplierInputSchema = z.object({
  code: optionalText(20),
  name: z.string().trim().min(1).max(200),
  trade_name: optionalText(200),
  supplier_type: partyBusinessTypeSchema.default('company'),
  party_type: z.enum(['Supplier', 'Customer And Supplier']).default('Supplier'),
  main_role: z.literal('Supplier').default('Supplier'),
  tax_registration_no: optionalText(50),
  email: optionalEmail,
  phone: optionalText(30),
  mobile: optionalText(30),
  address: optionalText(500),
  city: optionalText(100),
  country: optionalText(100),
  postal_code: optionalText(20),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  currency_code: z.string().trim().length(3).transform(value => value.toUpperCase()).default('PKR'),
  ap_account_id: z.string().uuid().optional(),
  advance_account_id: z.string().uuid().optional(),
  bank_name: optionalText(100),
  bank_account_no: optionalText(50),
  bank_swift_code: optionalText(20),
  bank_iban: optionalText(34),
  is_active: z.boolean().default(true),
  notes: optionalText(1000),
});

export const updateSupplierInputSchema = supplierInputSchema.partial();

export type PartyListQuery = z.infer<typeof partyListQuerySchema>;
export type CustomerInput = z.infer<typeof customerInputSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;
export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierInputSchema>;
